import "server-only";

import { getAuthenticatedUserId } from "@/lib/data/auth";
import { createServerClient } from "@/lib/supabase";
import type { Database } from "@/lib/supabase/database.types";
import { parseFoodSelectionQuery } from "./query";

type GeneratedFoodDiaryPrefill =
  Database["public"]["Functions"]["get_readable_food_diary_prefill"]["Returns"][number];

export type FoodDiaryPrefill = Omit<
  GeneratedFoodDiaryPrefill,
  | "brand_name"
  | "calories"
  | "carbohydrates_g"
  | "fat_g"
  | "nutrient_basis"
  | "protein_g"
  | "serving_quantity"
  | "serving_unit"
  | "source_code"
  | "source_name"
> & {
  brand_name: string | null;
  calories: number | null;
  carbohydrates_g: number | null;
  fat_g: number | null;
  nutrient_basis: string | null;
  protein_g: number | null;
  serving_quantity: number | null;
  serving_unit: string | null;
  source_code: string | null;
  source_name: string | null;
};

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
    "get_readable_food_diary_prefill",
    { p_food_id: query.foodId },
  );

  if (error) {
    return { status: "database_error" };
  }

  if (!data?.[0]) {
    return { status: "unavailable" };
  }

  return { data: data[0] as FoodDiaryPrefill, status: "ready" };
}
