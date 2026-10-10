import type { Tables } from "@/lib/supabase/database.types";

export type NutrientKey = "calories" | "protein_g" | "carbohydrates_g" | "fat_g";
type Snapshot = Pick<Tables<"diary_entries">, NutrientKey>;
export type DiaryTotals = Record<NutrientKey, number>;

// Diary snapshots are authoritative; unknown nutrients contribute zero only to aggregates.
export function calculateDiaryTotals(entries: readonly Snapshot[]): DiaryTotals {
  return entries.reduce<DiaryTotals>(
    (totals, entry) => ({
      calories: totals.calories + (entry.calories ?? 0),
      carbohydrates_g: totals.carbohydrates_g + (entry.carbohydrates_g ?? 0),
      fat_g: totals.fat_g + (entry.fat_g ?? 0),
      protein_g: totals.protein_g + (entry.protein_g ?? 0),
    }),
    { calories: 0, carbohydrates_g: 0, fat_g: 0, protein_g: 0 },
  );
}

export function compareNutritionTarget(consumed: number, target: number | null) {
  const ratio = target !== null && target > 0 ? consumed / target : null;
  return {
    percent: ratio === null ? null : Math.round(ratio * 100),
    fill: ratio === null ? 0 : Math.min(Math.max(ratio * 100, 0), 100),
    remaining: target === null ? null : target - consumed,
  };
}

export function roundDiaryValue(value: number, key: NutrientKey) {
  return key === "calories" ? Math.round(value) : Math.round(value * 100) / 100;
}
