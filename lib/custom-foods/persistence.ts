import "server-only";

import { getAuthenticatedUserId } from "@/lib/data/auth";
import { validationError, type DataResult } from "@/lib/data/result";
import { createServerClient } from "@/lib/supabase";
import type { Database, Json } from "@/lib/supabase/database.types";
import {
  validateCustomFoodArchiveInput,
  validateCustomFoodInput,
  type CustomFoodArchiveInput,
  type CustomFoodInput,
  type CustomFoodNutrientBasis,
} from "./validation";

export type PersistedCustomFood = {
  food_id: string;
  is_archived: boolean;
  nutrient_basis: CustomFoodNutrientBasis;
};

export type ArchivedCustomFood = {
  food_id: string;
  is_archived: boolean;
};

type GeneratedPersistCustomFoodArgs =
  Database["public"]["Functions"]["persist_custom_food"]["Args"];
type PersistCustomFoodRpcArgs = Omit<
  GeneratedPersistCustomFoodArgs,
  "p_brand_name" | "p_food_id"
> & {
  p_brand_name: string | null;
  p_food_id: string | null;
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

export async function persistCustomFoodForCurrentUser(
  input: CustomFoodInput,
): Promise<DataResult<PersistedCustomFood>> {
  const validation = validateCustomFoodInput(input);

  if (!validation.ok) {
    return validation;
  }

  const auth = await getAuthenticatedUserId();

  if (!auth.ok) {
    return auth;
  }

  const supabase = await createServerClient();
  const rpcArgs: PersistCustomFoodRpcArgs = {
    p_aliases: validation.data.aliases as Json,
    p_brand_name: validation.data.brand_name,
    p_food_id: validation.data.food_id,
    p_locale: validation.data.locale,
    p_name: validation.data.name,
    p_nutrient_basis: validation.data.nutrient_basis,
    p_nutrients: validation.data.nutrients as Json,
    p_serving_quantity: validation.data.serving_quantity,
    p_serving_unit: validation.data.serving_unit,
  };
  const { data, error } = await supabase
    // Generated function arguments omit PostgreSQL's runtime null acceptance.
    .rpc("persist_custom_food", rpcArgs as GeneratedPersistCustomFoodArgs)
    .maybeSingle();

  if (error) {
    return rpcError(error);
  }

  if (!data?.food_id) {
    return { code: "not_found", ok: false };
  }

  return {
    data: data as PersistedCustomFood,
    ok: true,
  };
}

export async function setCustomFoodArchivedForCurrentUser(
  input: CustomFoodArchiveInput,
): Promise<DataResult<ArchivedCustomFood>> {
  const validation = validateCustomFoodArchiveInput(input);

  if (!validation.ok) {
    return validation;
  }

  const auth = await getAuthenticatedUserId();

  if (!auth.ok) {
    return auth;
  }

  const supabase = await createServerClient();
  const { data, error } = await supabase
    .rpc("set_custom_food_archived", {
      p_food_id: validation.data.food_id,
      p_is_archived: validation.data.is_archived,
    })
    .maybeSingle();

  if (error) {
    return rpcError(error);
  }

  if (!data?.food_id) {
    return { code: "not_found", ok: false };
  }

  return { data, ok: true };
}
