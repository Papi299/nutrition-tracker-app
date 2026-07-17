import "server-only";

import { getAuthenticatedUserId } from "@/lib/data/auth";
import type { DataResult } from "@/lib/data/result";
import { isUuid } from "@/lib/food-selection/query";
import { createServerClient } from "@/lib/supabase";
import {
  recipeManagementPageSize,
  type RecipeManagementStatus,
} from "./management-query";
import { recipeLocales, type RecipeLocale } from "./validation";

export type ManagedRecipe = {
  created_at: string;
  ingredient_count: number;
  is_archived: boolean;
  locale: RecipeLocale;
  name: string;
  recipe_id: string;
  updated_at: string;
  yield_servings: number;
};

export type ManagedRecipePage = {
  has_next: boolean;
  has_previous: boolean;
  page: number;
  recipes: ManagedRecipe[];
  status: RecipeManagementStatus;
  total_count: number;
};

const localeSet = new Set<string>(recipeLocales);

export async function listOwnedRecipes(
  status: RecipeManagementStatus,
  page: number,
): Promise<DataResult<ManagedRecipePage>> {
  const auth = await getAuthenticatedUserId();
  if (!auth.ok) return auth;

  const offset = (page - 1) * recipeManagementPageSize;
  const supabase = await createServerClient();
  const { count, data, error } = await supabase
    .from("recipes")
    .select(
      "id,name,locale,yield_servings,is_archived,created_at,updated_at,recipe_ingredients(count)",
      { count: "exact" },
    )
    .eq("user_id", auth.data)
    .eq("is_archived", status === "archived")
    .order("updated_at", { ascending: false })
    .order("id", { ascending: true })
    .range(offset, offset + recipeManagementPageSize - 1);

  if (error || !data || count === null) {
    return { code: "database_error", ok: false };
  }

  const recipes: ManagedRecipe[] = [];
  for (const recipe of data) {
    const ingredientCount = recipe.recipe_ingredients.at(0)?.count;
    if (
      !isUuid(recipe.id) ||
      typeof recipe.name !== "string" ||
      recipe.name.length < 1 ||
      recipe.name.length > 200 ||
      recipe.name.trim() !== recipe.name ||
      !localeSet.has(recipe.locale) ||
      typeof ingredientCount !== "number" ||
      !Number.isInteger(ingredientCount) ||
      ingredientCount < 0 ||
      ingredientCount > 50 ||
      recipe.is_archived !== (status === "archived") ||
      typeof recipe.created_at !== "string" ||
      Number.isNaN(Date.parse(recipe.created_at)) ||
      typeof recipe.updated_at !== "string" ||
      Number.isNaN(Date.parse(recipe.updated_at)) ||
      typeof recipe.yield_servings !== "number" ||
      !Number.isFinite(recipe.yield_servings) ||
      recipe.yield_servings < 0.001 ||
      recipe.yield_servings > 10_000
    ) {
      return { code: "database_error", ok: false };
    }

    recipes.push({
      created_at: recipe.created_at,
      ingredient_count: ingredientCount,
      is_archived: recipe.is_archived,
      locale: recipe.locale as RecipeLocale,
      name: recipe.name,
      recipe_id: recipe.id,
      updated_at: recipe.updated_at,
      yield_servings: recipe.yield_servings,
    });
  }

  return {
    data: {
      has_next: offset + recipes.length < count,
      has_previous: page > 1,
      page,
      recipes,
      status,
      total_count: count,
    },
    ok: true,
  };
}
