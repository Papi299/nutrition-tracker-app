import "server-only";

import { getAuthenticatedUserId } from "@/lib/data/auth";
import { createServerClient } from "@/lib/supabase";
import type { Database } from "@/lib/supabase/database.types";
import {
  validateSavedMealDiaryLogInput,
  type SavedMealDiaryLogInput,
} from "./diary-log-validation";

export type LoggedSavedMeal = {
  diary_run_id: string;
  item_count: number;
};

export type SavedMealDiaryLogErrorCode =
  | "archived"
  | "database_error"
  | "idempotency_conflict"
  | "not_found"
  | "stale_review"
  | "unauthenticated"
  | "validation_error";

export type SavedMealDiaryLogResult =
  | { data: LoggedSavedMeal; ok: true }
  | {
      code: SavedMealDiaryLogErrorCode;
      fieldErrors?: Record<string, string>;
      ok: false;
    };

export async function logSavedMealToDiaryForCurrentUser(
  input: SavedMealDiaryLogInput,
): Promise<SavedMealDiaryLogResult> {
  const validation = validateSavedMealDiaryLogInput(input);

  if (!validation.ok) return validation;

  const auth = await getAuthenticatedUserId();

  if (!auth.ok) return { code: "unauthenticated", ok: false };

  const supabase = await createServerClient();
  const args: Database["public"]["Functions"]["log_saved_meal_to_diary"]["Args"] = {
    p_entry_date: validation.data.entry_date,
    p_expected_updated_at: validation.data.expected_source_updated_at,
    p_idempotency_key: validation.data.idempotency_key,
    p_meal_type: validation.data.meal_type,
    p_saved_meal_id: validation.data.saved_meal_id,
  };
  const { data, error } = await supabase
    .rpc("log_saved_meal_to_diary", args)
    .maybeSingle();

  if (error?.code === "42501") return { code: "unauthenticated", ok: false };
  if (error?.code === "22023") {
    return {
      code: "validation_error",
      fieldErrors: { form: "invalid_input" },
      ok: false,
    };
  }
  if (error || !data) return { code: "database_error", ok: false };

  if (data.result_status === "success") {
    if (!data.diary_run_id || !data.item_count) {
      return { code: "database_error", ok: false };
    }

    return {
      data: {
        diary_run_id: data.diary_run_id,
        item_count: data.item_count,
      },
      ok: true,
    };
  }

  const statusMap: Record<string, SavedMealDiaryLogErrorCode> = {
    archived: "archived",
    idempotency_conflict: "idempotency_conflict",
    stale_review: "stale_review",
    unavailable: "not_found",
  };

  return {
    code: statusMap[data.result_status] ?? "database_error",
    ok: false,
  };
}
