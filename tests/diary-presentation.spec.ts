import { expect, test } from "@playwright/test";
import { calculateDiaryTotals, compareNutritionTarget, roundDiaryValue, type NutrientKey } from "@/lib/diary-presentation";

const keys: NutrientKey[] = ["calories", "protein_g", "carbohydrates_g", "fat_g"];
const empty = { calories: 0, protein_g: 0, carbohydrates_g: 0, fat_g: 0 };
const snapshots = [
  { calories: 137, protein_g: 10.125, carbohydrates_g: null, fat_g: 0 },
  { calories: null, protein_g: 0, carbohydrates_g: 2.555, fat_g: 3.2 },
  { calories: 123.4, protein_g: 4.125, carbohydrates_g: 5.255, fat_g: null },
];

test("empty diary and null nutrients retain the established aggregate zero", () => {
  expect(calculateDiaryTotals([])).toEqual(empty);
  expect(calculateDiaryTotals([{ calories: null, protein_g: null, carbohydrates_g: null, fat_g: null }])).toEqual(empty);
  expect(calculateDiaryTotals([empty])).toEqual(empty);
});

test("snapshot totals match both previous reducers including fractional and large values", () => {
  for (const entries of [snapshots, [...snapshots, { calories: 999999999, protein_g: 999999.125, carbohydrates_g: 999999.555, fat_g: 999999.005 }]]) {
    // Independent per-field summation matches the previous presentation contracts.
    const previousTotals = Object.fromEntries(keys.map(key => [key, entries.reduce((sum, entry) => sum + (entry[key] ?? 0), 0)]));
    const previousProgress = Object.fromEntries(keys.map(key => [key, entries.reduce((sum, entry) => sum + (entry[key] === null ? 0 : Number(entry[key])), 0)]));
    expect(calculateDiaryTotals(entries)).toEqual(previousTotals);
    expect(calculateDiaryTotals(entries)).toEqual(previousProgress);
  }
  expect(calculateDiaryTotals(snapshots)).toEqual({ calories: 260.4, protein_g: 14.25, carbohydrates_g: 7.8100000000000005, fat_g: 3.2 });
});

test("display rounding matches integer calories and two-decimal grams without rounding stored snapshots", () => {
  expect(roundDiaryValue(260.4, "calories")).toBe(260);
  expect(roundDiaryValue(260.5, "calories")).toBe(261);
  for (const key of keys.filter(key => key !== "calories")) {
    expect(roundDiaryValue(7.8100000000000005, key)).toBe(7.81);
    expect(roundDiaryValue(3.125, key)).toBe(3.13);
  }
  expect(snapshots[0].protein_g).toBe(10.125);
});

test("missing and explicit zero targets remain distinct and never divide by zero", () => {
  expect(compareNutritionTarget(123, null)).toEqual({ percent: null, fill: 0, remaining: null });
  expect(compareNutritionTarget(123, 0)).toEqual({ percent: null, fill: 0, remaining: -123 });
  expect(compareNutritionTarget(0, 0)).toEqual({ percent: null, fill: 0, remaining: 0 });
});

test("positive targets preserve actual percentage and comparison while bounding visual fill", () => {
  expect(compareNutritionTarget(0, 2000)).toEqual({ percent: 0, fill: 0, remaining: 2000 });
  expect(compareNutritionTarget(1420, 2000)).toEqual({ percent: 71, fill: 71, remaining: 580 });
  expect(compareNutritionTarget(2100, 2000)).toEqual({ percent: 105, fill: 100, remaining: -100 });
  const result = compareNutritionTarget(999999999, 1);
  expect(result.percent).toBe(99999999900);
  expect(result.fill).toBe(100);
});

test("rounding percentage does not fabricate a completed visual target", () => {
  const result = compareNutritionTarget(1999, 2000);
  expect(result.percent).toBe(100);
  expect(result.fill).toBe(99.95);
  expect(result.remaining).toBe(1);
});
