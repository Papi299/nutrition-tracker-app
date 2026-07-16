import "server-only";

import { getAuthenticatedUserId } from "@/lib/data/auth";
import { validationError, type DataResult } from "@/lib/data/result";
import { createServerClient } from "@/lib/supabase";
import type { Database, Json } from "@/lib/supabase/database.types";
import {
  validateSavedMealArchiveInput,
  validateSavedMealInput,
  type SavedMealArchiveInput,
  type SavedMealInput,
} from "./validation";

export type PersistedSavedMeal = {
  saved_meal_id: string;
  is_archived: boolean;
  item_count: number;
};

export type ArchivedSavedMeal = {
  saved_meal_id: string;
  is_archived: boolean;
};

function rpcError(error: { code?: string } | null) {
  if (error?.code === "42501") {
    return { code: "unauthenticated", ok: false } as const;
  }

  if (error?.code === "22023") {
    return validationError({ form: "invalid_input" });
  }

  return { code: "database_error", ok: false } as const;
}

export async function persistSavedMealForCurrentUser(
  input: SavedMealInput,
): Promise<DataResult<PersistedSavedMeal>> {
  const validation = validateSavedMealInput(input);

  if (!validation.ok) return validation;

  const auth = await getAuthenticatedUserId();

  if (!auth.ok) return auth;

  const supabase = await createServerClient();
  const args = {
    p_items: validation.data.items as Json,
    p_locale: validation.data.locale,
    p_name: validation.data.name,
    p_saved_meal_id: validation.data.saved_meal_id,
  };
  const { data, error } = await supabase
    .rpc(
      "persist_saved_meal",
      args as Database["public"]["Functions"]["persist_saved_meal"]["Args"],
    )
    .maybeSingle();

  if (error) return rpcError(error);
  if (!data?.saved_meal_id) return { code: "not_found", ok: false };

  return { data: data as PersistedSavedMeal, ok: true };
}

export async function setSavedMealArchivedForCurrentUser(
  input: SavedMealArchiveInput,
): Promise<DataResult<ArchivedSavedMeal>> {
  const validation = validateSavedMealArchiveInput(input);

  if (!validation.ok) return validation;

  const auth = await getAuthenticatedUserId();

  if (!auth.ok) return auth;

  const supabase = await createServerClient();
  const { data, error } = await supabase
    .rpc("set_saved_meal_archived", {
      p_is_archived: validation.data.is_archived,
      p_saved_meal_id: validation.data.saved_meal_id,
    })
    .maybeSingle();

  if (error) return rpcError(error);
  if (!data?.saved_meal_id) return { code: "not_found", ok: false };

  return { data, ok: true };
}
