import { expect, test } from "@playwright/test";
import {
  allNutrientFields,
  nutrientCodeForField,
  scaleAllFoodNutrients,
  scaleFoodNutrients,
  type AllFoodNutrientReference,
} from "@/lib/food-selection/nutrient-scaling";
import { parseFoodNutritionReference } from "@/lib/food-selection/reference-parser";
import { nutrientCodesV1, nutrientManifestV1, type NutrientReferenceValuesV1 } from "@/lib/nutrition-snapshots";

const foodId = "11111111-1111-4111-8111-111111111111";
const fingerprint = "a".repeat(64);
const rawValues = () => Object.fromEntries(nutrientCodesV1.map((code, index) => [code, String(index + 1)])) as NutrientReferenceValuesV1;
const reference = (): AllFoodNutrientReference => ({
  food_id: foodId, nutrient_basis: "per_100g", serving_quantity: 100, serving_unit: "g",
  calories: 1, protein_g: 2, carbohydrates_g: 3, fat_g: 4,
  nutrients: rawValues(), reference_fingerprint: fingerprint,
});
const wireReference = () => ({
  food_id: foodId, name: "Synthetic coherent food", brand_name: "Synthetic brand",
  nutrient_basis: "per_100g", serving_quantity: 100, serving_unit: "g",
  food_type: "user_custom", data_quality: "user_provided", is_owned: true,
  source_id: null, source_code: null, source_name: null, source_food_id: null,
  source_updated_at: "2026-10-24T12:00:00.123456+00:00",
  reference_fingerprint: fingerprint, nutrients: rawValues(),
});

for (const quantity of [0, 25, 50, 100, 150, 200]) {
  test(`all 35 distinct reference codes produce consumed totals at ${quantity} g`, () => {
    const result = scaleAllFoodNutrients(reference(), quantity, "g");
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("Expected a valid synthetic reference");
    expect(Object.keys(result.values)).toEqual(allNutrientFields);
    expect(new Set(Object.keys(result.values)).size).toBe(35);
    for (const [index, definition] of nutrientManifestV1.entries()) {
      const field = definition.coreField ?? definition.code;
      const factor = 10 ** definition.precision;
      expect(result.values[field as keyof typeof result.values])
        .toBe(String(Math.round((index + 1) * quantity / 100 * factor) / factor));
    }
  });
}

test("all fields use compatible mass/volume conversions and verified fractional serving amounts", () => {
  const food = reference();
  expect(scaleAllFoodNutrients(food, "0.2", "kg")).toEqual(scaleAllFoodNutrients(food, 200, "g"));
  expect(scaleAllFoodNutrients(food, 200000, "mg")).toEqual(scaleAllFoodNutrients(food, 200, "g"));
  const drink = { ...food, nutrient_basis: "per_100ml", serving_unit: "ml" };
  expect(scaleAllFoodNutrients(drink, "0.25", "l")).toEqual(scaleAllFoodNutrients(drink, 250, "ml"));
  expect(scaleAllFoodNutrients(drink, "12.5", "ml")).toMatchObject({ ok: true, values: { calories: "0", protein_g: "0.25", vitamin_c_mg: "3" } });
  const slices = { ...food, nutrient_basis: "per_serving", serving_quantity: 2, serving_unit: "slices" };
  expect(scaleAllFoodNutrients(slices, 0.5, "slices")).toEqual(scaleAllFoodNutrients(food, 25, "g"));
  expect(scaleAllFoodNutrients(slices, 9, "slices")).toEqual(scaleAllFoodNutrients(food, 450, "g"));
  expect(scaleAllFoodNutrients(food, 100, "ml")).toEqual({ ok: false, field: "serving_unit", code: "incompatible_unit" });
  expect(scaleAllFoodNutrients(drink, 100, "g")).toEqual({ ok: false, field: "serving_unit", code: "incompatible_unit" });
  expect(scaleAllFoodNutrients(slices, 1, "slice").ok).toBe(false);
});

test("extension-only references preserve missing core values and independent zero/unknown nutrients", () => {
  const nutrients = Object.fromEntries(nutrientCodesV1.map(code => [code, null])) as NutrientReferenceValuesV1;
  nutrients.sodium_mg = "0";
  nutrients.vitamin_d_ug = "0.0001";
  const food = { ...reference(), nutrients };
  expect(scaleAllFoodNutrients(food, 150, "g")).toMatchObject({
    ok: true, values: { calories: "", protein_g: "", fiber_g: "", sodium_mg: "0", vitamin_d_ug: "0.0002" },
  });
  expect(scaleAllFoodNutrients(food, 0, "g")).toMatchObject({
    ok: true, values: { calories: "", protein_g: "", fiber_g: "", sodium_mg: "0", vitamin_d_ug: "0" },
  });
});

test("all-nutrient scaling rounds raw reference amounts only at the final nutrient boundary", () => {
  const food = reference();
  food.nutrients.energy_kcal = "201.4";
  food.nutrients.protein_g = "1.005";
  food.nutrients.fiber_g = "2.4689";
  expect(scaleAllFoodNutrients(food, 200, "g")).toMatchObject({ ok: true, values: { calories: "403", protein_g: "2.01", fiber_g: "4.9378" } });
  expect(scaleAllFoodNutrients(food, 50, "g")).toMatchObject({ ok: true, values: { calories: "101", protein_g: "0.5", fiber_g: "1.2345" } });
  expect(scaleFoodNutrients({ ...food, calories: 999 }, 200, "g")).toMatchObject({ ok: true, values: { calories: "403" } });
});

test("mixed manual fields are excluded independently and their invalid raw values cannot block automatic fields", () => {
  const food = reference();
  food.nutrients.energy_kcal = "NaN";
  food.nutrients.vitamin_d_ug = "9999999999.9999";
  const result = scaleAllFoodNutrients(food, 200, "g", ["protein_g", "fiber_g", "sodium_mg"]);
  expect(result).toMatchObject({ ok: true, values: { calories: "", protein_g: "4", fiber_g: "10", sodium_mg: "26", vitamin_d_ug: "" } });
  expect(scaleAllFoodNutrients(food, null, null, []).ok).toBe(true);
  expect(scaleAllFoodNutrients(food, 200, "g", ["vitamin_d_ug"]))
    .toEqual({ ok: false, field: "form", code: "nutrient_out_of_range" });
});

test("automatic quantities use exact persisted three-decimal values and reject overflow or missing reference metadata", () => {
  const food = reference();
  expect(scaleAllFoodNutrients(food, "0.0001", "g")).toEqual({ ok: false, field: "serving_quantity", code: "quantity_precision" });
  expect(scaleAllFoodNutrients(food, "10000000", "g")).toEqual({ ok: false, field: "serving_quantity", code: "quantity_out_of_range" });
  for (const quantity of [null, "", "Infinity", Number.NaN, -1]) {
    expect(scaleAllFoodNutrients(food, quantity, "g")).toEqual({ ok: false, field: "serving_quantity", code: "invalid_quantity" });
  }
  expect(scaleAllFoodNutrients({ ...food, nutrient_basis: null }, 100, "g")).toEqual({ ok: false, field: "form", code: "missing_reference" });
  expect(scaleAllFoodNutrients({ ...food, serving_quantity: 50 }, 100, "g")).toEqual({ ok: false, field: "form", code: "invalid_reference" });
});

test("repeated all-nutrient quantity changes derive from the immutable raw reference map", () => {
  const food = reference();
  food.nutrients.fiber_g = "2.4689";
  Object.freeze(food.nutrients);
  Object.freeze(food);
  const initial = JSON.stringify(food);
  for (let iteration = 0; iteration < 20; iteration += 1) {
    for (const quantity of [25, 200, 50, 150, 100]) expect(scaleAllFoodNutrients(food, quantity, "g").ok).toBe(true);
    expect(scaleAllFoodNutrients(food, 100, "g")).toMatchObject({ ok: true, values: { fiber_g: "2.4689" } });
  }
  expect(JSON.stringify(food)).toBe(initial);
  expect(allNutrientFields.map(nutrientCodeForField)).toEqual(nutrientCodesV1);
});

test("coherent wire parsing preserves one raw map and derives compatible core properties without early rounding", () => {
  const raw = wireReference();
  raw.nutrients.energy_kcal = "201.4000";
  const parsed = parseFoodNutritionReference(raw, foodId);
  expect(parsed).not.toBeNull();
  expect(parsed).toMatchObject({ calories: 201.4, nutrients: { energy_kcal: "201.4" }, reference_fingerprint: fingerprint });
  expect(scaleAllFoodNutrients(parsed!, 200, "g")).toMatchObject({ ok: true, values: { calories: "403" } });
  expect(parseFoodNutritionReference({ ...raw, is_owned: false, food_type: "generic" })?.is_owned).toBe(false);
});

test("coherent parser retains extension-only and identity-only references for explicit manual handling", () => {
  const raw = wireReference();
  raw.nutrients = Object.fromEntries(nutrientCodesV1.map(code => [code, null])) as NutrientReferenceValuesV1;
  raw.nutrients.vitamin_c_mg = "0.0001";
  expect(parseFoodNutritionReference(raw)).toMatchObject({ calories: null, protein_g: null, nutrients: { vitamin_c_mg: "0.0001" } });
  const identityOnly = { ...raw, nutrient_basis: null, serving_quantity: null, serving_unit: null, nutrients: { ...raw.nutrients, vitamin_c_mg: null } };
  const parsed = parseFoodNutritionReference(identityOnly);
  expect(parsed).not.toBeNull();
  expect(scaleAllFoodNutrients(parsed!, 100, "g")).toEqual({ ok: false, field: "form", code: "missing_reference" });
  expect(parseFoodNutritionReference({ ...identityOnly, nutrients: raw.nutrients })).toBeNull();
});

test("coherent parser rejects unsupported contracts, invalid identities and mismatched reference dimensions", () => {
  const raw = wireReference();
  for (const invalid of [
    { ...raw, version: 2 }, { ...raw, nutrients: { sodium_mg: "1" } },
    { ...raw, nutrient_basis: "future_basis" }, { ...raw, reference_fingerprint: "bad" },
    { ...raw, is_owned: null }, { ...raw, food_id: "not-a-uuid" },
    { ...raw, serving_quantity: 99 }, { ...raw, serving_unit: "ml" },
    { ...raw, serving_quantity: Number.POSITIVE_INFINITY }, { ...raw, serving_quantity: -1 },
    { ...raw, source_updated_at: "not-a-date" }, { ...raw, source_id: "bad" },
    { ...raw, food_type: "future" }, { ...raw, data_quality: "future" },
    { ...raw, nutrients: { ...raw.nutrients, energy_kcal: 201.4 } },
    { ...raw, nutrients: { ...raw.nutrients, energy_kcal: "0.00001" } },
  ]) expect(parseFoodNutritionReference(invalid)).toBeNull();
  expect(parseFoodNutritionReference(raw, "22222222-2222-4222-8222-222222222222")).toBeNull();
  const missing = { ...raw } as Record<string, unknown>; delete missing.source_name;
  expect(parseFoodNutritionReference(missing)).toBeNull();
});
