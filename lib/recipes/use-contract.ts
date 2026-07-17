import "server-only";

import { getAuthenticatedUserId } from "@/lib/data/auth";
import { createServerClient } from "@/lib/supabase";
import type { Database } from "@/lib/supabase/database.types";
import {
  parseRecipeUseContractPayload,
  type RecipeUseContract,
} from "./use-contract-parser";
import {
  validateRecipeUseContractInput,
  type RecipeUseContractInput,
} from "./use-contract-validation";

export type RecipeUseContractState =
  | { fieldErrors: Record<string, string>; status: "validation_error" }
  | { status: "database_error" | "unauthenticated" | "unavailable" }
  | {
      data: RecipeUseContract;
      status: "archived" | "invalid_recipe" | "not_loggable" | "ready";
    };

export async function getOwnedRecipeUseContract(
  input: RecipeUseContractInput,
): Promise<RecipeUseContractState> {
  const validation = validateRecipeUseContractInput(input);
  if (!validation.ok) {
    return {
      fieldErrors: validation.fieldErrors ?? { form: "invalid_input" },
      status: "validation_error",
    };
  }

  const auth = await getAuthenticatedUserId();
  if (!auth.ok) return { status: "unauthenticated" };

  const supabase = await createServerClient();
  const { data, error } = await supabase
    .rpc("get_owned_recipe_use_contract", {
      p_recipe_id: validation.data.recipe_id,
      p_requested_servings: validation.data.requested_servings,
    } as Database["public"]["Functions"]["get_owned_recipe_use_contract"]["Args"])
    .maybeSingle();

  if (error?.code === "42501") return { status: "unauthenticated" };
  if (error?.code === "22023") {
    return {
      fieldErrors: { requested_servings: "invalid_number" },
      status: "validation_error",
    };
  }
  if (error || !data) return { status: "database_error" };

  const parsed = parseRecipeUseContractPayload(
    data,
    validation.data.requested_servings,
  );
  if (!parsed) return { status: "database_error" };
  return parsed;
}
