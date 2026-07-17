import "server-only";

import { getAuthenticatedUserId } from "@/lib/data/auth";
import type { DataResult } from "@/lib/data/result";
import { isUuid } from "@/lib/food-selection/query";
import { createServerClient } from "@/lib/supabase";
import {
  parseRecipeEditorIngredients,
  type RecipeEditorIngredient,
} from "./editor-parser";
import { recipeLocales, type RecipeLocale } from "./validation";

export { parseRecipeEditorIngredients, type RecipeEditorIngredient } from "./editor-parser";

export type OwnedRecipeEditor = {
  created_at: string;
  ingredients: RecipeEditorIngredient[];
  is_archived: boolean;
  locale: RecipeLocale;
  name: string;
  recipe_id: string;
  updated_at: string;
  yield_servings: number;
};

const localeSet = new Set<string>(recipeLocales);

export async function getOwnedRecipeEditor(
  recipeId: string,
): Promise<DataResult<OwnedRecipeEditor>> {
  if (!isUuid(recipeId)) {
    return {
      code: "validation_error",
      fieldErrors: { recipe_id: "invalid_uuid" },
      ok: false,
    };
  }

  const auth = await getAuthenticatedUserId();
  if (!auth.ok) return auth;

  const supabase = await createServerClient();
  const { data, error } = await supabase
    .rpc("get_owned_recipe_editor", { p_recipe_id: recipeId })
    .maybeSingle();

  if (error) return { code: "database_error", ok: false };
  if (!data) return { code: "not_found", ok: false };

  const ingredients = parseRecipeEditorIngredients(data.ingredients);
  if (
    !ingredients ||
    !isUuid(data.recipe_id) ||
    typeof data.name !== "string" ||
    data.name.trim() !== data.name ||
    data.name.length < 1 ||
    data.name.length > 200 ||
    !localeSet.has(data.locale) ||
    typeof data.is_archived !== "boolean" ||
    typeof data.created_at !== "string" ||
    Number.isNaN(Date.parse(data.created_at)) ||
    typeof data.updated_at !== "string" ||
    Number.isNaN(Date.parse(data.updated_at)) ||
    typeof data.yield_servings !== "number" ||
    !Number.isFinite(data.yield_servings) ||
    data.yield_servings < 0.001 ||
    data.yield_servings > 10_000
  ) {
    return { code: "database_error", ok: false };
  }

  return {
    data: {
      created_at: data.created_at,
      ingredients,
      is_archived: data.is_archived,
      locale: data.locale as RecipeLocale,
      name: data.name,
      recipe_id: data.recipe_id,
      updated_at: data.updated_at,
      yield_servings: data.yield_servings,
    },
    ok: true,
  };
}
