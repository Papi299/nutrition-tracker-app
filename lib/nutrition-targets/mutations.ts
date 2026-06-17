import "server-only";

import { getAuthenticatedUserId } from "@/lib/data/auth";
import type { DataResult } from "@/lib/data/result";
import { createServerClient } from "@/lib/supabase";
import type { Tables } from "@/lib/supabase/database.types";
import {
  validateNutritionTargetInput,
  type NutritionTargetInput,
} from "./validation";

export type NutritionTarget = Tables<"nutrition_targets">;

export async function upsertTargetForDate(
  input: NutritionTargetInput,
): Promise<DataResult<NutritionTarget>> {
  const userIdResult = await getAuthenticatedUserId();

  if (!userIdResult.ok) {
    return userIdResult;
  }

  const validationResult = validateNutritionTargetInput(input);

  if (!validationResult.ok) {
    return validationResult;
  }

  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("nutrition_targets")
    .upsert(
      {
        calories: validationResult.data.calories,
        carbohydrates_g: validationResult.data.carbohydrates_g,
        effective_from: validationResult.data.effective_from,
        fat_g: validationResult.data.fat_g,
        protein_g: validationResult.data.protein_g,
        user_id: userIdResult.data,
      },
      {
        onConflict: "user_id,effective_from",
      },
    )
    .select("*")
    .single();

  if (error) {
    return { code: "database_error", ok: false };
  }

  return { data, ok: true };
}
