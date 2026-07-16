import "server-only";

import { getAuthenticatedUserId } from "@/lib/data/auth";
import type { DataResult } from "@/lib/data/result";
import { isUuid } from "@/lib/food-selection/query";
import type { Database } from "@/lib/supabase/database.types";
import { createServerClient } from "@/lib/supabase";

export type FoodFavoriteState =
  Database["public"]["Functions"]["set_food_favorite"]["Returns"][number];

export async function setFoodFavoriteForCurrentUser(
  foodId: string,
  isFavorite: boolean,
): Promise<DataResult<FoodFavoriteState>> {
  if (!isUuid(foodId)) {
    return {
      code: "validation_error",
      fieldErrors: { food_id: "invalid_uuid" },
      ok: false,
    };
  }

  const auth = await getAuthenticatedUserId();

  if (!auth.ok) {
    return auth;
  }

  const supabase = await createServerClient();
  const { data, error } = await supabase.rpc("set_food_favorite", {
    p_food_id: foodId,
    p_is_favorite: isFavorite,
  });

  if (error) {
    return { code: "database_error", ok: false };
  }

  const result = data.at(0);

  if (
    !result ||
    result.food_id !== foodId ||
    result.is_favorite !== isFavorite
  ) {
    return { code: "not_found", ok: false };
  }

  return { data: result, ok: true };
}
