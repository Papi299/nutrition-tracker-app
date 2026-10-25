import { expect, test } from "@playwright/test";
import {
  nutrientFields,
  scaleFoodNutrients,
  type FoodNutrientReference,
} from "@/lib/food-selection/nutrient-scaling";

const reference: FoodNutrientReference = {
  food_id: "synthetic-test-food",
  nutrient_basis: "per_100g",
  serving_quantity: 100,
  serving_unit: "g",
  calories: 200,
  protein_g: 20,
  carbohydrates_g: 20,
  fat_g: 5,
};

for (const quantity of [0, 25, 50, 100, 150, 200]) {
  test(`per 100 g reference nutrition represents ${quantity} g consumed`, () => {
    expect(scaleFoodNutrients(reference, quantity, "g")).toEqual({
      ok: true,
      values: {
        calories: String(quantity * 2),
        protein_g: String(quantity / 5),
        carbohydrates_g: String(quantity / 5),
        fat_g: String(quantity / 20),
      },
    });
  });
}

test("the reported Test/Tnuva 200 g example yields final 400/40/40/10 totals", () => {
  expect(scaleFoodNutrients(reference, "200", "g")).toEqual({
    ok: true,
    values: { calories: "400", protein_g: "40", carbohydrates_g: "40", fat_g: "10" },
  });
});

test("per 100 ml scales 250 ml and a fractional quantity independently", () => {
  const drink = { ...reference, nutrient_basis: "per_100ml", serving_unit: "ml" };
  expect(scaleFoodNutrients(drink, "250", "ml")).toEqual({
    ok: true,
    values: { calories: "500", protein_g: "50", carbohydrates_g: "50", fat_g: "12.5" },
  });
  expect(scaleFoodNutrients(drink, "12.5", "ml")).toEqual({
    ok: true,
    values: { calories: "25", protein_g: "2.5", carbohydrates_g: "2.5", fat_g: "0.63" },
  });
});

test("per serving divides by catalog reference amount rather than treating quantity as a serving count", () => {
  const slices = { ...reference, nutrient_basis: "per_serving", serving_quantity: 2, serving_unit: "slices" };
  expect(scaleFoodNutrients(slices, "0.5", "slices")).toEqual({
    ok: true,
    values: { calories: "50", protein_g: "5", carbohydrates_g: "5", fat_g: "1.25" },
  });
  expect(scaleFoodNutrients({ ...slices, calories: 123.5 }, 9, "slices")).toMatchObject({
    ok: true, values: { calories: "556" },
  });
  expect(scaleFoodNutrients({ ...slices, serving_quantity: 200, serving_unit: "g" }, "0.1", "kg"))
    .toMatchObject({ ok: true, values: { calories: "100", protein_g: "10" } });
});

test("known unit conversions preserve mass and volume without assuming density", () => {
  for (const [quantity, unit] of [["0.2", "kg"], ["200000", "mg"], ["200", " G "]] as const) {
    expect(scaleFoodNutrients(reference, quantity, unit)).toEqual(scaleFoodNutrients(reference, 200, "g"));
  }
  const drink = { ...reference, nutrient_basis: "per_100ml", serving_unit: "ml" };
  expect(scaleFoodNutrients(drink, "0.25", "L")).toEqual(scaleFoodNutrients(drink, 250, "ml"));
  for (const [food, unit] of [[reference, "ml"], [drink, "g"], [reference, "oz"], [reference, "serving"]] as const) {
    expect(scaleFoodNutrients(food, 100, unit)).toEqual({
      ok: false, field: "serving_unit", code: "incompatible_unit",
    });
  }
});

test("null remains unknown, zero remains zero, and nutrients are never inferred", () => {
  const partial = { ...reference, calories: null, protein_g: 0, carbohydrates_g: 3.125, fat_g: null };
  expect(scaleFoodNutrients(partial, 200, "g")).toEqual({
    ok: true, values: { calories: "", protein_g: "0", carbohydrates_g: "6.25", fat_g: "" },
  });
  expect(scaleFoodNutrients(partial, 0, "g")).toEqual({
    ok: true, values: { calories: "", protein_g: "0", carbohydrates_g: "0", fat_g: "" },
  });
  expect(scaleFoodNutrients({ ...partial, protein_g: null, carbohydrates_g: null }, 200, "g")).toEqual({
    ok: true, values: { calories: "", protein_g: "", carbohydrates_g: "", fat_g: "" },
  });
  expect(scaleFoodNutrients({ ...reference, protein_g: null, carbohydrates_g: null, fat_g: null }, 50, "g"))
    .toMatchObject({ ok: true, values: { calories: "100", protein_g: "", carbohydrates_g: "", fat_g: "" } });
});

test("calories and macro decimal ties round once after scaling original reference values", () => {
  expect(scaleFoodNutrients({ ...reference, calories: 201.4, protein_g: 1.005 }, 200, "g"))
    .toMatchObject({ ok: true, values: { calories: "403", protein_g: "2.01" } });
  expect(scaleFoodNutrients({ ...reference, calories: 50.5, protein_g: 1.005 }, 100, "g"))
    .toMatchObject({ ok: true, values: { calories: "51", protein_g: "1.01" } });
  expect(scaleFoodNutrients({ ...reference, calories: 0.5, protein_g: 0.005 }, 100, "g"))
    .toMatchObject({ ok: true, values: { calories: "1", protein_g: "0.01" } });
});

test("repeated quantity edits derive from immutable reference values without rounding drift", () => {
  const food = Object.freeze({ ...reference, calories: 201.4, protein_g: 1.005 });
  const original = { ...food };
  for (let iteration = 0; iteration < 20; iteration += 1) {
    for (const quantity of [25, 200, 150, 50, 100]) scaleFoodNutrients(food, quantity, "g");
    expect(scaleFoodNutrients(food, 100, "g")).toMatchObject({
      ok: true, values: { calories: "201", protein_g: "1.01" },
    });
  }
  expect(food).toEqual(original);
});

test("automatic field selection skips manual fields, including their invalid or overflowing reference amounts", () => {
  const food = { ...reference, calories: Number.POSITIVE_INFINITY, protein_g: 9999999999 };
  expect(scaleFoodNutrients(food, 200, "g", ["carbohydrates_g", "fat_g"])).toEqual({
    ok: true, values: { calories: "", protein_g: "", carbohydrates_g: "40", fat_g: "10" },
  });
  expect(scaleFoodNutrients(food, null, null, [])).toEqual({
    ok: true, values: { calories: "", protein_g: "", carbohydrates_g: "", fat_g: "" },
  });
  expect(scaleFoodNutrients(reference, 200, "g", nutrientFields)).toEqual(scaleFoodNutrients(reference, 200, "g"));
});

test("automatic calculation rejects missing, negative, nonfinite and malformed quantities", () => {
  for (const quantity of [null, undefined, "", " ", -1, "-1", Number.NaN, Number.POSITIVE_INFINITY, "Infinity", "0x64"]) {
    expect(scaleFoodNutrients(reference, quantity, "g")).toEqual({
      ok: false, field: "serving_quantity", code: "invalid_quantity",
    });
  }
});

test("the multiplier uses only quantities exactly representable in persisted three-decimal storage", () => {
  for (const quantity of ["0.0001", "100.1234", 100.1234, "9999999.9991"]) {
    expect(scaleFoodNutrients(reference, quantity, "g")).toEqual({
      ok: false, field: "serving_quantity", code: "quantity_precision",
    });
  }
  expect(scaleFoodNutrients(reference, "100.0000", "g")).toEqual(scaleFoodNutrients(reference, 100, "g"));
  expect(scaleFoodNutrients(reference, "1e2", "g")).toEqual(scaleFoodNutrients(reference, 100, "g"));
  expect(scaleFoodNutrients({ ...reference, calories: 100000, protein_g: null, carbohydrates_g: null, fat_g: null }, "0.001", "g"))
    .toMatchObject({ ok: true, values: { calories: "1" } });
});

test("storage bounds reject quantity and consumed nutrition overflow before persistence", () => {
  const empty = { ...reference, calories: null, protein_g: null, carbohydrates_g: null, fat_g: null };
  expect(scaleFoodNutrients(empty, "9999999.999", "g").ok).toBe(true);
  expect(scaleFoodNutrients(empty, "10000000", "g")).toEqual({
    ok: false, field: "serving_quantity", code: "quantity_out_of_range",
  });
  expect(scaleFoodNutrients({ ...reference, calories: 2147483647, protein_g: 999999.994 }, 100, "g").ok).toBe(true);
  for (const food of [
    { ...reference, calories: 2147483647.5 },
    { ...reference, protein_g: 999999.995 },
    { ...reference, carbohydrates_g: 999999.995 },
    { ...reference, fat_g: 999999.995 },
    { ...reference, calories: Number.MAX_VALUE },
  ]) {
    expect(scaleFoodNutrients(food, 100, "g")).toEqual({
      ok: false, field: "form", code: "nutrient_out_of_range",
    });
  }
});

test("absent or inconsistent reference metadata and incompatible free-text units fail explicitly", () => {
  for (const food of [
    { ...reference, nutrient_basis: null },
    { ...reference, nutrient_basis: "unknown" },
    { ...reference, serving_quantity: null },
    { ...reference, serving_quantity: 0 },
    { ...reference, serving_quantity: Number.NaN },
    { ...reference, serving_unit: null },
    { ...reference, serving_unit: " " },
  ]) {
    expect(scaleFoodNutrients(food, 100, "g")).toEqual({ ok: false, field: "form", code: "missing_reference" });
  }
  expect(scaleFoodNutrients({ ...reference, serving_quantity: 50 }, 100, "g"))
    .toEqual({ ok: false, field: "form", code: "invalid_reference" });
  for (const unit of [null, undefined, "", " "]) {
    expect(scaleFoodNutrients(reference, 100, unit))
      .toEqual({ ok: false, field: "serving_unit", code: "incompatible_unit" });
  }
  const food = { ...reference, nutrient_basis: "per_serving", serving_unit: "slices" };
  expect(scaleFoodNutrients(food, 100, "slice").ok).toBe(false);
  expect(scaleFoodNutrients(food, 100, "Slices").ok).toBe(false);
});

test("each calculated nutrient requires a finite nonnegative reference independently", () => {
  for (const field of nutrientFields) {
    for (const amount of [-1, Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]) {
      expect(scaleFoodNutrients({ ...reference, [field]: amount }, 100, "g"))
        .toEqual({ ok: false, field: "form", code: "invalid_reference" });
    }
  }
});
