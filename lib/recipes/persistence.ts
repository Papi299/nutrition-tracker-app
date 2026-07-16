import "server-only";

import { getAuthenticatedUserId } from "@/lib/data/auth";
import { validationError, type DataResult } from "@/lib/data/result";
import { createServerClient } from "@/lib/supabase";
import type { Database, Json } from "@/lib/supabase/database.types";
import {
  validateRecipeArchiveInput,
  validateRecipeInput,
  type RecipeArchiveInput,
  type RecipeInput,
} from "./validation";

export type PersistedRecipe = {
  recipe_id: string;
  is_archived: boolean;
  ingredient_count: number;
};

export type ArchivedRecipe = {
  recipe_id: string;
  is_archived: boolean;
};

function rpcError(error: { code?: string } | null) {
  if (error?.code === "42501") return { code: "unauthenticated", ok: false } as const;
  if (error?.code === "22023") return validationError({ form: "invalid_input" });
  return { code: "database_error", ok: false } as const;
}

export async function persistRecipeForCurrentUser(
  input: RecipeInput,
): Promise<DataResult<PersistedRecipe>> {
  const validation = validateRecipeInput(input);
  if (!validation.ok) return validation;

  const auth = await getAuthenticatedUserId();
  if (!auth.ok) return auth;

  const supabase = await createServerClient();
  const args = {
    p_ingredients: validation.data.ingredients as Json,
    p_locale: validation.data.locale,
    p_name: validation.data.name,
    p_recipe_id: validation.data.recipe_id,
    p_yield_servings: validation.data.yield_servings,
  };
  const { data, error } = await supabase
    .rpc("persist_recipe", args as Database["public"]["Functions"]["persist_recipe"]["Args"])
    .maybeSingle();

  if (error) return rpcError(error);
  if (!data?.recipe_id) return { code: "not_found", ok: false };
  return { data: data as PersistedRecipe, ok: true };
}

export async function setRecipeArchivedForCurrentUser(
  input: RecipeArchiveInput,
): Promise<DataResult<ArchivedRecipe>> {
  const validation = validateRecipeArchiveInput(input);
  if (!validation.ok) return validation;

  const auth = await getAuthenticatedUserId();
  if (!auth.ok) return auth;

  const supabase = await createServerClient();
  const { data, error } = await supabase
    .rpc("set_recipe_archived", {
      p_is_archived: validation.data.is_archived,
      p_recipe_id: validation.data.recipe_id,
    })
    .maybeSingle();

  if (error) return rpcError(error);
  if (!data?.recipe_id) return { code: "not_found", ok: false };
  return { data, ok: true };
}
