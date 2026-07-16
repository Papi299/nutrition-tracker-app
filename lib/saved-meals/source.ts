import "server-only";

import { getAuthenticatedUserId } from "@/lib/data/auth";
import type { DataResult } from "@/lib/data/result";
import type { DiaryEntryMealType } from "@/lib/diary-entries/validation";
import { createServerClient } from "@/lib/supabase";

export type SavedMealDiarySourceItem = {
  brand_name: string | null;
  calories: number | null;
  carbohydrates_g: number | null;
  diary_entry_id: string;
  fat_g: number | null;
  food_id: string | null;
  food_name: string;
  notes: string | null;
  protein_g: number | null;
  serving_quantity: number | null;
  serving_unit: string | null;
};

export async function getSavedMealDiarySource(
  date: string,
  mealType: DiaryEntryMealType,
): Promise<DataResult<SavedMealDiarySourceItem[]>> {
  const auth = await getAuthenticatedUserId();

  if (!auth.ok) return auth;

  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("diary_entries")
    .select(
      "id,food_id,food_name,brand_name,serving_quantity,serving_unit,calories,protein_g,carbohydrates_g,fat_g,notes",
    )
    .eq("user_id", auth.data)
    .eq("entry_date", date)
    .eq("meal_type", mealType)
    .order("created_at", { ascending: true })
    .order("id", { ascending: true });

  if (error || !data) return { code: "database_error", ok: false };

  return {
    data: data.map((entry) => ({
      brand_name: entry.brand_name,
      calories: entry.calories,
      carbohydrates_g: entry.carbohydrates_g,
      diary_entry_id: entry.id,
      fat_g: entry.fat_g,
      food_id: entry.food_id,
      food_name: entry.food_name,
      notes: entry.notes,
      protein_g: entry.protein_g,
      serving_quantity: entry.serving_quantity,
      serving_unit: entry.serving_unit,
    })),
    ok: true,
  };
}
