import "server-only";

import { getAuthenticatedUserId } from "@/lib/data/auth";
import type { DataResult } from "@/lib/data/result";
import { createServerClient } from "@/lib/supabase";
import {
  savedMealManagementPageSize,
  type SavedMealManagementStatus,
} from "./management-query";
import { savedMealLocales, type SavedMealLocale } from "./validation";

export type ManagedSavedMeal = {
  created_at: string;
  item_count: number;
  is_archived: boolean;
  locale: SavedMealLocale;
  name: string;
  saved_meal_id: string;
  updated_at: string;
};

export type ManagedSavedMealPage = {
  has_next: boolean;
  has_previous: boolean;
  meals: ManagedSavedMeal[];
  page: number;
  status: SavedMealManagementStatus;
  total_count: number;
};

const localeSet = new Set<string>(savedMealLocales);

export async function listOwnedSavedMeals(
  status: SavedMealManagementStatus,
  page: number,
): Promise<DataResult<ManagedSavedMealPage>> {
  const auth = await getAuthenticatedUserId();

  if (!auth.ok) return auth;

  const offset = (page - 1) * savedMealManagementPageSize;
  const supabase = await createServerClient();
  const { count, data, error } = await supabase
    .from("saved_meals")
    .select(
      "id,name,locale,is_archived,created_at,updated_at,saved_meal_items(count)",
      { count: "exact" },
    )
    .eq("user_id", auth.data)
    .eq("is_archived", status === "archived")
    .order("updated_at", { ascending: false })
    .order("id", { ascending: true })
    .range(offset, offset + savedMealManagementPageSize - 1);

  if (error || !data || count === null) {
    return { code: "database_error", ok: false };
  }

  const meals: ManagedSavedMeal[] = [];

  for (const meal of data) {
    const itemCount = meal.saved_meal_items.at(0)?.count;

    if (!localeSet.has(meal.locale) || typeof itemCount !== "number") {
      return { code: "database_error", ok: false };
    }

    meals.push({
      created_at: meal.created_at,
      item_count: itemCount,
      is_archived: meal.is_archived,
      locale: meal.locale as SavedMealLocale,
      name: meal.name,
      saved_meal_id: meal.id,
      updated_at: meal.updated_at,
    });
  }

  return {
    data: {
      has_next: offset + meals.length < count,
      has_previous: page > 1,
      meals,
      page,
      status,
      total_count: count,
    },
    ok: true,
  };
}
