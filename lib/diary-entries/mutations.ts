import "server-only";

import { getAuthenticatedUserId } from "@/lib/data/auth";
import type {
  DataErrorCode,
  DataResult,
  DataSuccess,
} from "@/lib/data/result";
import { createServerClient } from "@/lib/supabase";
import type { Database, Tables } from "@/lib/supabase/database.types";
import {
  validateDiaryEntryCreateInput,
  validateDiaryEntryIdempotencyKey,
  validateDiaryEntryUpdateInput,
  validateDiaryEntryVersion,
  type DiaryEntryCreateInput,
  type DiaryEntryUpdateInput,
} from "./validation";

export type DiaryEntry = Tables<"diary_entries">;

export type DeletedDiaryEntry = {
  deleted: true;
  id: string;
};

export type CreatedManualDiaryEntry = {
  completed_at: string;
  diary_entry_id: string;
};

export type DiaryEntryMutationError = {
  code: DataErrorCode | "conflict";
  fieldErrors?: Record<string, string>;
  ok: false;
};

export type DiaryEntryMutationResult<T> =
  | DataSuccess<T>
  | DiaryEntryMutationError;

export async function createDiaryEntryForCurrentUser(
  input: DiaryEntryCreateInput,
  idempotencyKey: string,
): Promise<DiaryEntryMutationResult<CreatedManualDiaryEntry>> {
  const userIdResult = await getAuthenticatedUserId();

  if (!userIdResult.ok) {
    return userIdResult;
  }

  const validationResult = validateDiaryEntryCreateInput(input);

  if (!validationResult.ok) {
    return validationResult;
  }

  const idempotencyKeyResult =
    validateDiaryEntryIdempotencyKey(idempotencyKey);

  if (!idempotencyKeyResult.ok) {
    return idempotencyKeyResult;
  }

  const supabase = await createServerClient();
  const args = {
    p_brand_name: validationResult.data.brand_name,
    p_calories: validationResult.data.calories,
    p_carbohydrates_g: validationResult.data.carbohydrates_g,
    p_entry_date: validationResult.data.entry_date,
    p_fat_g: validationResult.data.fat_g,
    p_food_id: validationResult.data.food_id,
    p_food_name: validationResult.data.food_name,
    p_idempotency_key: idempotencyKeyResult.data,
    p_meal_type: validationResult.data.meal_type,
    p_notes: validationResult.data.notes,
    p_protein_g: validationResult.data.protein_g,
    p_serving_quantity: validationResult.data.serving_quantity,
    p_serving_unit: validationResult.data.serving_unit,
  };
  const { data, error } = await supabase
    // Generated function arguments omit PostgreSQL's runtime null acceptance.
    .rpc(
      "create_manual_diary_entry",
      args as Database["public"]["Functions"]["create_manual_diary_entry"]["Args"],
    )
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

  if (error || !data) {
    return { code: "database_error", ok: false };
  }

  if (data.result_status === "idempotency_conflict") {
    return { code: "conflict", ok: false };
  }

  if (data.result_status === "unavailable") {
    return { code: "not_found", ok: false };
  }

  if (
    data.result_status !== "success" ||
    !data.diary_entry_id ||
    !data.completed_at
  ) {
    return { code: "database_error", ok: false };
  }

  return {
    data: {
      completed_at: data.completed_at,
      diary_entry_id: data.diary_entry_id,
    },
    ok: true,
  };
}

export async function updateCurrentDiaryEntry(
  id: string,
  expectedVersion: unknown,
  input: DiaryEntryUpdateInput,
): Promise<DiaryEntryMutationResult<DiaryEntry>> {
  const entryId = id.trim();

  if (entryId === "") {
    return { code: "not_found", ok: false };
  }

  const userIdResult = await getAuthenticatedUserId();

  if (!userIdResult.ok) {
    return userIdResult;
  }

  const validationResult = validateDiaryEntryUpdateInput(input);

  if (!validationResult.ok) {
    return validationResult;
  }

  const versionResult = validateDiaryEntryVersion(expectedVersion);

  if (!versionResult.ok) {
    return versionResult;
  }

  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("diary_entries")
    .update(validationResult.data)
    .eq("id", entryId)
    .eq("user_id", userIdResult.data)
    .eq("version", versionResult.data)
    .select("*")
    .maybeSingle();

  if (error) {
    return { code: "database_error", ok: false };
  }

  if (!data) {
    const { data: currentEntry, error: currentEntryError } = await supabase
      .from("diary_entries")
      .select("version")
      .eq("id", entryId)
      .eq("user_id", userIdResult.data)
      .maybeSingle();

    if (currentEntryError) {
      return { code: "database_error", ok: false };
    }

    return currentEntry
      ? { code: "conflict", ok: false }
      : { code: "not_found", ok: false };
  }

  return { data, ok: true };
}

export async function deleteCurrentDiaryEntry(
  id: string,
): Promise<DataResult<DeletedDiaryEntry>> {
  const entryId = id.trim();

  if (entryId === "") {
    return { code: "not_found", ok: false };
  }

  const userIdResult = await getAuthenticatedUserId();

  if (!userIdResult.ok) {
    return userIdResult;
  }

  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("diary_entries")
    .delete()
    .eq("id", entryId)
    .eq("user_id", userIdResult.data)
    .select("id")
    .maybeSingle();

  if (error) {
    return { code: "database_error", ok: false };
  }

  if (!data) {
    return { code: "not_found", ok: false };
  }

  return { data: { deleted: true, id: data.id }, ok: true };
}
