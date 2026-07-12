import "server-only";

import { getAuthenticatedUserId } from "@/lib/data/auth";
import type { DataResult } from "@/lib/data/result";
import { createServerClient } from "@/lib/supabase";
import type { Tables } from "@/lib/supabase/database.types";
import { validateTargetDate } from "./validation";

export type NutritionTarget = Tables<"nutrition_targets">;

export function hasConfiguredTargetValues(target: NutritionTarget) {
  return (
    target.calories !== null ||
    target.protein_g !== null ||
    target.carbohydrates_g !== null ||
    target.fat_g !== null
  );
}

export async function getEffectiveTargetForDate(
  date: string,
): Promise<DataResult<NutritionTarget | null>> {
  const userIdResult = await getAuthenticatedUserId();

  if (!userIdResult.ok) {
    return userIdResult;
  }

  const dateResult = validateTargetDate(date);

  if (!dateResult.ok) {
    return dateResult;
  }

  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("nutrition_targets")
    .select("*")
    .eq("user_id", userIdResult.data)
    .lte("effective_from", dateResult.data)
    .order("effective_from", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    return { code: "database_error", ok: false };
  }

  return {
    data: data && hasConfiguredTargetValues(data) ? data : null,
    ok: true,
  };
}
