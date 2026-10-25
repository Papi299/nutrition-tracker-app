import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
import { customFoodNutrientCodes } from "@/lib/custom-foods/validation";
import {
  additionalNutrientCodesV1,
  additionalSnapshotToRequest,
  coreNutrientCodesV1,
  emptyAdditionalNutrientSnapshot,
  formatExactFraction,
  getNutrientDefinitionV1,
  maxAdditionalSnapshotBytes,
  normalizeAdditionalNutrientRequest,
  normalizeNutrientAmount,
  normalizeNutrientFraction,
  nutrientCodesV1,
  nutrientManifestV1,
  parseAdditionalNutrientSnapshot,
  parseExactNonnegativeDecimal,
  parseNutrientReferenceValues,
  scaleNutrientAmount,
  type AdditionalNutrientRequestV1,
} from "@/lib/nutrition-snapshots";

function request(): AdditionalNutrientRequestV1 {
  return { version: 1, values: additionalNutrientCodesV1.map((code, index) => ({ code, amount: index + 0.1234 })) };
}

test("immutable v1 manifest contains exactly the existing 35 catalog codes and 31 extensions", () => {
  expect(nutrientManifestV1).toHaveLength(35);
  expect(additionalNutrientCodesV1).toHaveLength(31);
  expect(coreNutrientCodesV1).toEqual(["energy_kcal", "protein_g", "carbohydrates_g", "fat_g"]);
  expect(new Set(nutrientCodesV1).size).toBe(35);
  expect([...nutrientCodesV1].sort()).toEqual([...customFoodNutrientCodes].sort());
  expect(Object.isFrozen(nutrientManifestV1)).toBe(true);
  for (const definition of nutrientManifestV1) expect(Object.isFrozen(definition)).toBe(true);
  for (const codes of [nutrientCodesV1, additionalNutrientCodesV1, coreNutrientCodesV1]) expect(Object.isFrozen(codes)).toBe(true);
});

test("the application manifest agrees with every existing SQL code and canonical unit", () => {
  const dictionary = readFileSync("supabase/migrations/20260714120000_custom_food_persistence_foundation.sql", "utf8");
  const sqlUnits = Object.fromEntries([...dictionary.matchAll(/\('([a-z0-9_]+)', '[^']*', '[^']*', '(kcal|g|mg|ug)'/g)]
    .map(match => [match[1], match[2]]));
  expect(Object.keys(sqlUnits)).toHaveLength(35);
  expect(Object.fromEntries(nutrientManifestV1.map(({ code, unit }) => [code, unit]))).toEqual(sqlUnits);
  expect(nutrientManifestV1.filter(({ unit }) => unit === "kcal")).toHaveLength(1);
  expect(nutrientManifestV1.filter(({ unit }) => unit === "g")).toHaveLength(10);
  expect(nutrientManifestV1.filter(({ unit }) => unit === "mg")).toHaveLength(18);
  expect(nutrientManifestV1.filter(({ unit }) => unit === "ug")).toHaveLength(6);
});

test("the frozen contract retains core column authority and approved numeric boundaries", () => {
  expect(getNutrientDefinitionV1("energy_kcal")).toMatchObject({ coreField: "calories", precision: 0, maximum: "2147483647" });
  for (const code of coreNutrientCodesV1.filter(code => code !== "energy_kcal")) {
    expect(getNutrientDefinitionV1(code)).toMatchObject({ coreField: code, precision: 2, maximum: "999999.99" });
  }
  for (const code of additionalNutrientCodesV1) {
    expect(getNutrientDefinitionV1(code)).toMatchObject({ coreField: null, precision: 4, maximum: "9999999999.9999" });
  }
  expect(getNutrientDefinitionV1("unsupported")).toBeUndefined();
  expect(maxAdditionalSnapshotBytes).toBe(16_384);
});

test("legacy uncaptured SQL NULL differs from a captured dense snapshot of unknown nutrients", () => {
  expect(parseAdditionalNutrientSnapshot(null)).toEqual({ ok: true, data: null });
  expect(normalizeAdditionalNutrientRequest(null)).toEqual({ ok: true, data: null });
  const empty = emptyAdditionalNutrientSnapshot();
  expect(Object.keys(empty.values)).toEqual(additionalNutrientCodesV1);
  expect(Object.values(empty.values).every(value => value === null)).toBe(true);
  expect(parseAdditionalNutrientSnapshot(empty)).toEqual({ ok: true, data: empty });
  expect(additionalSnapshotToRequest(null)).toBeNull();
  empty.values.sodium_mg = 0;
  expect(emptyAdditionalNutrientSnapshot().values.sodium_mg).toBeNull();
  expect(parseAdditionalNutrientSnapshot(empty)).toMatchObject({ ok: true, data: { values: { sodium_mg: 0 } } });
});

test("request arrays validate every unique code before building the dense canonical object", () => {
  const input = request();
  input.values.reverse();
  const normalized = normalizeAdditionalNutrientRequest(input);
  expect(normalized.ok).toBe(true);
  if (!normalized.ok || normalized.data === null) throw new Error("Expected a captured snapshot");
  expect(Object.keys(normalized.data.values)).toEqual(additionalNutrientCodesV1);
  for (const [index, code] of additionalNutrientCodesV1.entries()) expect(normalized.data.values[code]).toBe(index + 0.1234);
  expect(parseAdditionalNutrientSnapshot(normalized.data)).toEqual(normalized);
  expect(additionalSnapshotToRequest(normalized.data)).toEqual(request());
});

test("duplicate, unsupported, missing and extra request codes fail without a partial snapshot", () => {
  const duplicate = request(); duplicate.values[30] = duplicate.values[0];
  expect(normalizeAdditionalNutrientRequest(duplicate)).toMatchObject({ ok: false, code: "duplicate_code" });
  const unsupported = request();
  expect(normalizeAdditionalNutrientRequest({ ...unsupported, values: [...unsupported.values.slice(0, 30), { code: "energy_kcal", amount: 5 }] }))
    .toMatchObject({ ok: false, code: "unsupported_code" });
  for (const values of [request().values.slice(0, 30), [...request().values, request().values[0]], {}]) {
    expect(normalizeAdditionalNutrientRequest({ version: 1, values })).toMatchObject({ ok: false, code: "invalid_code_count" });
  }
});

test("unknown versions and malformed envelope or item keys fail closed", () => {
  for (const version of [0, 2, "1", null]) {
    expect(normalizeAdditionalNutrientRequest({ ...request(), version })).toMatchObject({ ok: false, code: "unsupported_version" });
    expect(parseAdditionalNutrientSnapshot({ ...emptyAdditionalNutrientSnapshot(), version })).toMatchObject({ ok: false, code: "unsupported_version" });
  }
  for (const value of [undefined, [], true, "{}", { version: 1 }, { ...request(), extra: true }]) {
    expect(normalizeAdditionalNutrientRequest(value)).toMatchObject({ ok: false, code: "invalid_snapshot" });
    expect(parseAdditionalNutrientSnapshot(value)).toMatchObject({ ok: false, code: "invalid_snapshot" });
  }
  for (const item of [{ code: "fiber_g" }, { code: "fiber_g", amount: 1, unit: "g" }, null]) {
    const input = request();
    expect(normalizeAdditionalNutrientRequest({ ...input, values: [item, ...input.values.slice(1)] })).toMatchObject({ ok: false, code: "invalid_snapshot" });
  }
});

test("stored snapshots require exactly 31 extension keys and normalized numeric or null values", () => {
  const empty = emptyAdditionalNutrientSnapshot();
  const missing = { ...empty.values } as Record<string, unknown>; delete missing.fiber_g;
  for (const values of [missing, { ...empty.values, energy_kcal: 1 }, { ...empty.values, other: null }, []]) {
    expect(parseAdditionalNutrientSnapshot({ version: 1, values })).toMatchObject({ ok: false, code: "invalid_code_count" });
  }
  for (const value of ["0", false, [], {}, undefined, Number.NaN, Number.POSITIVE_INFINITY, -1]) {
    expect(parseAdditionalNutrientSnapshot({ ...empty, values: { ...empty.values, fiber_g: value } })).toMatchObject({ ok: false, code: "invalid_amount" });
  }
  expect(parseAdditionalNutrientSnapshot({ ...empty, values: { ...empty.values, fiber_g: 0.00001 } }))
    .toMatchObject({ ok: false, code: "amount_precision" });
});

test("request normalization rounds once at four decimals before enforcing representability", () => {
  for (const [amount, expected] of [[0.00005, 0.0001], [1.23445, 1.2345], [0.00001, 0], [9999999999.99994, 9999999999.9999]]) {
    const input = request(); input.values[0].amount = amount;
    expect(normalizeAdditionalNutrientRequest(input)).toMatchObject({ ok: true, data: { values: { fiber_g: expected } } });
  }
  for (const amount of [9999999999.99995, 10000000000, Number.MAX_VALUE]) {
    const input = request(); input.values[0].amount = amount;
    expect(normalizeAdditionalNutrientRequest(input)).toMatchObject({ ok: false, code: "amount_out_of_range" });
  }
  for (const amount of [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY, -0.00001, "1", false]) {
    const input = request();
    expect(normalizeAdditionalNutrientRequest({ ...input, values: [{ code: "fiber_g", amount }, ...input.values.slice(1)] }))
      .toMatchObject({ ok: false, code: "invalid_amount" });
  }
});

test("oversized and cyclic envelopes are rejected safely", () => {
  const input = request();
  expect(normalizeAdditionalNutrientRequest({ ...input, values: [{ code: "fiber_g", amount: "1".repeat(maxAdditionalSnapshotBytes) }, ...input.values.slice(1)] }))
    .toMatchObject({ ok: false, code: "snapshot_too_large" });
  const cyclic: Record<string, unknown> = { version: 1 }; cyclic.values = cyclic;
  expect(normalizeAdditionalNutrientRequest(cyclic)).toMatchObject({ ok: false, code: "invalid_snapshot" });
});

test("all 35 nutrients scale original exact decimals without rounding a reference first", () => {
  for (const [index, code] of nutrientCodesV1.entries()) {
    const raw = String(index + 1);
    for (const quantity of [0, 25, 50, 100, 150, 200]) {
      const expected = normalizeNutrientAmount(code, String((index + 1) * quantity / 100));
      expect(scaleNutrientAmount(code, raw, quantity, 100)).toEqual(expected);
    }
    expect(scaleNutrientAmount(code, raw, 250, 100)).toEqual(normalizeNutrientAmount(code, String((index + 1) * 2.5)));
    expect(scaleNutrientAmount(code, raw, 12.5, 100)).toEqual(normalizeNutrientAmount(code, String((index + 1) / 8)));
    expect(scaleNutrientAmount(code, raw, 0.5, 2)).toEqual(normalizeNutrientAmount(code, String((index + 1) / 4)));
    expect(scaleNutrientAmount(code, raw, 9, 2)).toEqual(normalizeNutrientAmount(code, String((index + 1) * 4.5)));
  }
  expect(scaleNutrientAmount("energy_kcal", "201.4", 200, 100)).toEqual({ ok: true, data: 403 });
  expect(scaleNutrientAmount("vitamin_b12_ug", "0.0001", "150", "100")).toEqual({ ok: true, data: 0.0002 });
  expect(scaleNutrientAmount("protein_g", "1.005", 100, 100)).toEqual({ ok: true, data: 1.01 });
});

test("every nutrient retains null and zero independently and enforces its final rounded maximum", () => {
  for (const definition of nutrientManifestV1) {
    expect(scaleNutrientAmount(definition.code, null, 0, 100)).toEqual({ ok: true, data: null });
    expect(scaleNutrientAmount(definition.code, "0", 150, 100)).toEqual({ ok: true, data: 0 });
    expect(normalizeNutrientAmount(definition.code, definition.maximum))
      .toEqual({ ok: true, data: Number(definition.maximum) });
    const overflowing = definition.precision === 0 ? "2147483647.5"
      : definition.precision === 2 ? "999999.995" : "9999999999.99995";
    expect(normalizeNutrientAmount(definition.code, overflowing))
      .toEqual({ ok: false, code: "amount_out_of_range" });
  }
});

test("raw reference parsing accepts all35 decimal text values including extension-only foods", () => {
  const values: Record<string, string | null> = Object.fromEntries(nutrientCodesV1.map(code => [code, null]));
  values.sodium_mg = "0.0001";
  expect(parseNutrientReferenceValues(values)).toEqual({ ok: true, data: values });
  values.energy_kcal = "201.4000";
  expect(parseNutrientReferenceValues(values)).toMatchObject({ ok: true, data: { energy_kcal: "201.4" } });
  for (const code of nutrientCodesV1) {
    expect(parseNutrientReferenceValues({ ...values, [code]: "9999999999.9999" }).ok).toBe(true);
    expect(parseNutrientReferenceValues({ ...values, [code]: "10000000000" })).toMatchObject({ ok: false, code: "amount_out_of_range", field: code });
    expect(parseNutrientReferenceValues({ ...values, [code]: "0.00001" })).toMatchObject({ ok: false, code: "amount_precision", field: code });
  }
});

test("raw reference maps reject missing/extra codes, numeric values, and malformed decimals", () => {
  const values = Object.fromEntries(nutrientCodesV1.map(code => [code, null]));
  const missing = { ...values }; delete missing.sodium_mg;
  for (const value of [missing, { ...values, unsupported: null }, null]) {
    expect(parseNutrientReferenceValues(value)).toMatchObject({ ok: false, code: "invalid_code_count" });
  }
  for (const value of [0, "NaN", "Infinity", "-0.001", "", "0x10"]) {
    expect(parseNutrientReferenceValues({ ...values, energy_kcal: value })).toMatchObject({ ok: false, code: "invalid_amount" });
  }
});

test("exact fraction utilities preserve null and zero and reject unsafe representations", () => {
  for (const value of ["1e-4", "0.0001", "+.0001"]) expect(parseExactNonnegativeDecimal(value)).not.toBeNull();
  for (const value of [true, {}, [], Number.NaN, "NaN", "Infinity", "0x10", "-1e-400", "1e99999", "1".repeat(401)]) {
    expect(parseExactNonnegativeDecimal(value)).toBeNull();
  }
  expect(normalizeNutrientAmount("sodium_mg", null)).toEqual({ ok: true, data: null });
  expect(scaleNutrientAmount("sodium_mg", null, 0, 100)).toEqual({ ok: true, data: null });
  expect(scaleNutrientAmount("sodium_mg", "0", 150, 100)).toEqual({ ok: true, data: 0 });
  expect(scaleNutrientAmount("sodium_mg", 1, 10, 0)).toMatchObject({ ok: false, code: "invalid_amount" });
  expect(formatExactFraction({ numerator: BigInt(1), denominator: BigInt(0) }, 4)).toBeNull();
  expect(normalizeNutrientFraction("sodium_mg", { numerator: BigInt(1), denominator: BigInt(20000) }))
    .toEqual({ ok: true, data: 0.0001 });
});

test("repeated calculations never mutate a reference or compound rounded previews", () => {
  const reference = Object.freeze({ energy_kcal: "201.4", vitamin_c_mg: "0.1234" });
  for (let repeat = 0; repeat < 20; repeat += 1) {
    for (const quantity of [25, 50, 200, 150, 100]) {
      expect(scaleNutrientAmount("energy_kcal", reference.energy_kcal, quantity, 100).ok).toBe(true);
      expect(scaleNutrientAmount("vitamin_c_mg", reference.vitamin_c_mg, quantity, 100).ok).toBe(true);
    }
    expect(scaleNutrientAmount("vitamin_c_mg", reference.vitamin_c_mg, 100, 100)).toEqual({ ok: true, data: 0.1234 });
  }
  expect(reference).toEqual({ energy_kcal: "201.4", vitamin_c_mg: "0.1234" });
});
