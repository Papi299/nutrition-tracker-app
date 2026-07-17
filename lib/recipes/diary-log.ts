import "server-only";

import { getAuthenticatedUserId } from "@/lib/data/auth";
import { isUuid } from "@/lib/food-selection/query";
import { createServerClient } from "@/lib/supabase";
import type { Database } from "@/lib/supabase/database.types";
import {
  validateRecipeDiaryLogInput,
  type RecipeDiaryLogInput,
} from "./diary-log-validation";

export type LoggedRecipe = {
  created_entry_count: 1;
  diary_run_id: string;
};

export type RecipeDiaryLogErrorCode =
  | "archived"
  | "database_error"
  | "idempotency_conflict"
  | "invalid_recipe"
  | "not_loggable"
  | "stale_review"
  | "unauthenticated"
  | "unavailable"
  | "validation_error";

export type RecipeDiaryLogResult =
  | { data: LoggedRecipe; ok: true }
  | {
      code: RecipeDiaryLogErrorCode;
      fieldErrors?: Record<string, string>;
      ok: false;
    };

export async function logRecipeToDiaryForCurrentUser(
  input: RecipeDiaryLogInput,
): Promise<RecipeDiaryLogResult> {
  const validation = validateRecipeDiaryLogInput(input);
  if (!validation.ok) return validation;

  const auth = await getAuthenticatedUserId();
  if (!auth.ok) return { code: "unauthenticated", ok: false };

  const supabase = await createServerClient();
  const args: Database["public"]["Functions"]["log_recipe_to_diary"]["Args"] = {
    p_entry_date: validation.data.entry_date,
    p_expected_updated_at: validation.data.expected_source_updated_at,
    p_idempotency_key: validation.data.idempotency_key,
    p_meal_type: validation.data.meal_type,
    p_recipe_id: validation.data.recipe_id,
    p_requested_servings: validation.data.requested_servings,
  };
  const { data, error } = await supabase
    .rpc("log_recipe_to_diary", args)
    .maybeSingle();

  if (error?.code === "42501") {
    return { code: "unauthenticated", ok: false };
  }
  if (error?.code === "22023") {
    return {
      code: "validation_error",
      fieldErrors: { form: "invalid_input" },
      ok: false,
    };
  }
  if (error || !data) return { code: "database_error", ok: false };

  if (data.result_status === "success") {
    if (
      data.created_entry_count !== 1 ||
      !data.diary_run_id ||
      !isUuid(data.diary_run_id)
    ) {
      return { code: "database_error", ok: false };
    }

    return {
      data: {
        created_entry_count: 1,
        diary_run_id: data.diary_run_id,
      },
      ok: true,
    };
  }

  const statusMap: Record<string, RecipeDiaryLogErrorCode> = {
    archived: "archived",
    idempotency_conflict: "idempotency_conflict",
    invalid_recipe: "invalid_recipe",
    not_loggable: "not_loggable",
    stale_review: "stale_review",
    unavailable: "unavailable",
  };

  return {
    code: statusMap[data.result_status] ?? "database_error",
    ok: false,
  };
}
