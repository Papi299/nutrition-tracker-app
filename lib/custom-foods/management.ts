import "server-only";

import { getAuthenticatedUserId } from "@/lib/data/auth";
import type { DataResult } from "@/lib/data/result";
import { createServerClient } from "@/lib/supabase";
import {
  customFoodLocales,
  customFoodNutrientBases,
  type CustomFoodLocale,
  type CustomFoodNutrientBasis,
} from "./validation";
import {
  customFoodManagementPageSize,
  type CustomFoodManagementStatus,
} from "./management-query";

export type ManagedCustomFood = {
  brand_name: string | null;
  food_id: string;
  is_archived: boolean;
  locale: CustomFoodLocale;
  name: string;
  nutrient_basis: CustomFoodNutrientBasis;
  serving_quantity: number;
  serving_unit: string;
  updated_at: string;
};

export type ManagedCustomFoodPage = {
  foods: ManagedCustomFood[];
  has_next: boolean;
  has_previous: boolean;
  page: number;
  status: CustomFoodManagementStatus;
  total_count: number;
};

const localeSet = new Set<string>(customFoodLocales);
const nutrientBasisSet = new Set<string>(customFoodNutrientBases);

export async function listOwnedCustomFoods(
  status: CustomFoodManagementStatus,
  page: number,
): Promise<DataResult<ManagedCustomFoodPage>> {
  const auth = await getAuthenticatedUserId();

  if (!auth.ok) {
    return auth;
  }

  const offset = (page - 1) * customFoodManagementPageSize;
  const supabase = await createServerClient();
  const { count, data, error } = await supabase
    .from("foods")
    .select(
      "id,name,brand_name,locale,custom_nutrient_basis,serving_size,serving_unit,is_archived,updated_at",
      { count: "exact" },
    )
    .eq("owner_user_id", auth.data)
    .eq("food_type", "user_custom")
    .eq("is_public", false)
    .eq("is_archived", status === "archived")
    .order("updated_at", { ascending: false })
    .order("id", { ascending: true })
    .range(offset, offset + customFoodManagementPageSize - 1);

  if (error || !data || count === null) {
    return { code: "database_error", ok: false };
  }

  const foods: ManagedCustomFood[] = [];

  for (const food of data) {
    if (
      !food.locale ||
      !localeSet.has(food.locale) ||
      !food.custom_nutrient_basis ||
      !nutrientBasisSet.has(food.custom_nutrient_basis) ||
      typeof food.serving_size !== "number" ||
      !food.serving_unit
    ) {
      return { code: "database_error", ok: false };
    }

    foods.push({
      brand_name: food.brand_name,
      food_id: food.id,
      is_archived: food.is_archived,
      locale: food.locale as CustomFoodLocale,
      name: food.name,
      nutrient_basis: food.custom_nutrient_basis as CustomFoodNutrientBasis,
      serving_quantity: food.serving_size,
      serving_unit: food.serving_unit,
      updated_at: food.updated_at,
    });
  }

  return {
    data: {
      foods,
      has_next: offset + foods.length < count,
      has_previous: page > 1,
      page,
      status,
      total_count: count,
    },
    ok: true,
  };
}
