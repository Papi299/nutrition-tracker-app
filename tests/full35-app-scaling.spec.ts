import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { test, expect } from "@playwright/test";
import { parseFoodNutritionReference, parseFoodNutritionReferenceV2 } from "@/lib/food-selection/reference-parser";
import { allNutrientFields, convertFoodQuantity, scaleAllFoodNutrients, type AllFoodNutrientReference } from "@/lib/food-selection/nutrient-scaling";
import { nutrientCodesV1, nutrientManifestV1, parseNutrientReferenceValues, scaleNutrientAmount, type NutrientCode } from "@/lib/nutrition-snapshots";

const oracle = JSON.parse(readFileSync("tests/fixtures/full35-app-oracle.json", "utf8")) as {
  codes: NutrientCode[];
  cases: { code: NutrientCode; amount: string; quantity: string; expected: string }[];
  sourcePolicyProfile: AllFoodNutrientReference["nutrients"];
  profileExpected: Record<string, Record<NutrientCode, string | null>>;
};
function reference(nutrients = oracle.sourcePolicyProfile): AllFoodNutrientReference {
  return { food_id: "00000000-0000-4000-8000-000000000001", nutrient_basis: "per_100g",
    serving_quantity: 100, serving_unit: "g", reference_fingerprint: "a".repeat(64),
    calories: 100.5, protein_g: 1.005, carbohydrates_g: 1.005, fat_g: 1.005, nutrients };
}

test("independently transcribed manifest and Decimal oracle agree with the complete immutable contract", () => {
  expect(oracle.codes).toEqual(nutrientCodesV1);
  expect(oracle.codes).toHaveLength(35);
  expect(execFileSync("python3", ["scripts/full35-app-oracle.py", "--check"], { encoding: "utf8" })).toContain("245 vectors verified");
});

for (const [index, vector] of oracle.cases.entries()) {
  test(`F35-29/30 ${index}: ${vector.code} ${vector.amount} at ${vector.quantity} g`, () => {
    expect(scaleNutrientAmount(vector.code, vector.amount, vector.quantity, "100"))
      .toEqual({ ok: true, data: Number(vector.expected) });
  });
}

for (const quantity of ["50", "100", "200"]) {
  test(`F35-29 source policy profile retains every returned key and three nulls at ${quantity} g`, () => {
    const result = scaleAllFoodNutrients(reference(), quantity, "g");
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(result.code);
    expect(Object.keys(result.values)).toEqual(allNutrientFields);
    for (const definition of nutrientManifestV1) {
      expect(result.values[definition.code === "energy_kcal" ? "calories" : definition.code]).toBe(oracle.profileExpected[quantity][definition.code] ?? "");
    }
    for (const code of ["added_sugars_g", "folate_dfe_ug", "vitamin_k_ug"] as const) expect(result.values[code]).toBe("");
  });
}

for (const { code, maximum } of nutrientManifestV1) {
  test(`F35-30 ${code}: zero, null, strict source precision, malformed input and consumed overflow`, () => {
    expect(scaleNutrientAmount(code, "0", "200", "100")).toEqual({ ok: true, data: 0 });
    expect(scaleNutrientAmount(code, null, "200", "100")).toEqual({ ok: true, data: null });
    expect(scaleNutrientAmount(code, maximum, "200", "100")).toEqual({ ok: false, code: "amount_out_of_range" });
    for (const raw of ["-1", "NaN", "Infinity", "0x10", "1,2", "", "1e99999"]) {
      expect(parseNutrientReferenceValues({ ...oracle.sourcePolicyProfile, [code]: raw })).toMatchObject({ ok: false, code: "invalid_amount", field: code });
    }
    expect(parseNutrientReferenceValues({ ...oracle.sourcePolicyProfile, [code]: "0.12345" })).toMatchObject({ ok: false, code: "amount_precision", field: code });
    expect(parseNutrientReferenceValues({ ...oracle.sourcePolicyProfile, [code]: "10000000000" })).toMatchObject({ ok: false, code: "amount_out_of_range", field: code });
  });
}

test("F35-32 both strict application parsers preserve decimal strings, null and original serving metadata", () => {
  const wire = { ...reference(), name: "Synthetic policy vector", brand_name: null, food_type: "generic", data_quality: "imported", is_owned: false,
    source_id: null, source_code: null, source_name: null, source_food_id: "synthetic-only", source_updated_at: "2026-11-02T00:00:00.000Z" };
  const { calories: _calories, protein_g: _protein, carbohydrates_g: _carbs, fat_g: _fat, ...v1 } = wire;
  void _calories; void _protein; void _carbs; void _fat;
  expect(parseFoodNutritionReference(v1)?.nutrients).toEqual(oracle.sourcePolicyProfile);
  const v2 = { ...v1, catalog_serving_quantity: null, catalog_serving_unit: null };
  expect(parseFoodNutritionReferenceV2(v2)?.nutrients).toEqual(oracle.sourcePolicyProfile);
  expect(parseFoodNutritionReference(v2)).toBeNull();
  expect(parseFoodNutritionReferenceV2(v1)).toBeNull();
});

const conversions = [
  ["0.2", "kg", "g", "200"], ["200000", "mg", "g", "200"], ["200", "g", "kg", "0.2"],
  ["0.2", "l", "ml", "200"], ["200", "ml", "l", "0.2"], ["2", "serving", "g", "100"],
] as const;
for (const [quantity, from, to, expected] of conversions) {
  test(`F35-31 exact ${quantity} ${from} to ${to}`, () => {
    expect(convertFoodQuantity({ ...reference(), catalog_serving_quantity: 50, catalog_serving_unit: "g" }, quantity, from, to))
      .toEqual({ ok: true, quantity: expected });
  });
}
test("F35-31 conversions refuse precision loss, overflow, absent density and unverified portions", () => {
  expect(convertFoodQuantity(reference(), "1", "mg", "kg")).toMatchObject({ ok: false, code: "quantity_precision" });
  expect(convertFoodQuantity(reference(), "10000", "kg", "g")).toMatchObject({ ok: false, code: "quantity_out_of_range" });
  for (const from of ["oz", "lb", "cup", "serving", "ml", "l"]) {
    expect(scaleAllFoodNutrients(reference(), "2", from)).toMatchObject({ ok: false, code: "incompatible_unit" });
  }
  expect(scaleAllFoodNutrients(reference(), "0.0001", "g")).toMatchObject({ ok: false, code: "quantity_precision" });
  expect(scaleAllFoodNutrients({ ...reference(), nutrient_basis: "per_100ml", serving_unit: "ml" }, "0.2", "l").ok).toBe(true);
  const custom = scaleAllFoodNutrients({ ...reference(), nutrient_basis: "per_serving", serving_quantity: 2, serving_unit: "slices" }, "4", "slices");
  expect(custom.ok && custom.values.fiber_g).toBe("10.2468");
  expect(scaleAllFoodNutrients({ ...reference(), nutrient_basis: "per_serving", serving_quantity: 2, serving_unit: "slices" }, "4", "g"))
    .toMatchObject({ ok: false, code: "incompatible_unit" });
});
