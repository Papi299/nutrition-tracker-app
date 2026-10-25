import "server-only";

import { getAuthenticatedUserId } from "@/lib/data/auth";
import { createServerClient } from "@/lib/supabase";
import { parseFoodSelectionQuery } from "./query";
import { parseFoodNutritionReference, type FoodDiaryPrefill } from "./reference-parser";
export type { FoodDiaryPrefill } from "./reference-parser";

export type FoodDiaryPrefillState =
  | { status: "missing" }
  | { status: "invalid" | "repeated" }
  | { status: "unauthenticated" }
  | { status: "unavailable" }
  | { status: "database_error" }
  | { data: FoodDiaryPrefill; status: "ready" };

export async function getReadableFoodDiaryPrefill(
  value: string | string[] | undefined,
): Promise<FoodDiaryPrefillState> {
  const query = parseFoodSelectionQuery(value);

  if (query.status !== "valid") {
    return query;
  }

  const authResult = await getAuthenticatedUserId();

  if (!authResult.ok) {
    return { status: "unauthenticated" };
  }

  const supabase = await createServerClient();
  const { data, error } = await supabase.rpc(
    "get_readable_food_nutrition_reference_v1",
    { p_food_id: query.foodId },
  );

  if (error) {
    return { status: "database_error" };
  }

  if (!data || data.length === 0) {
    return { status: "unavailable" };
  }
  const prefill = data.length === 1 ? parseFoodNutritionReference(data[0], query.foodId) : null;
  return prefill ? { data: prefill, status: "ready" } : { status: "database_error" };
}
