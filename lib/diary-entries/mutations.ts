import "server-only";

import { getAuthenticatedUserId } from "@/lib/data/auth";
import type { DataResult } from "@/lib/data/result";
import { createServerClient } from "@/lib/supabase";
import type { Tables } from "@/lib/supabase/database.types";
import {
  validateDiaryEntryCreateInput,
  validateDiaryEntryUpdateInput,
  type DiaryEntryCreateInput,
  type DiaryEntryUpdateInput,
} from "./validation";

export type DiaryEntry = Tables<"diary_entries">;

export type DeletedDiaryEntry = {
  deleted: true;
  id: string;
};

export async function createDiaryEntryForCurrentUser(
  input: DiaryEntryCreateInput,
): Promise<DataResult<DiaryEntry>> {
  const userIdResult = await getAuthenticatedUserId();

  if (!userIdResult.ok) {
    return userIdResult;
  }

  const validationResult = validateDiaryEntryCreateInput(input);

  if (!validationResult.ok) {
    return validationResult;
  }

  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("diary_entries")
    .insert({
      ...validationResult.data,
      user_id: userIdResult.data,
    })
    .select("*")
    .single();

  if (error) {
    return { code: "database_error", ok: false };
  }

  return { data, ok: true };
}

export async function updateCurrentDiaryEntry(
  id: string,
  input: DiaryEntryUpdateInput,
): Promise<DataResult<DiaryEntry>> {
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

  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("diary_entries")
    .update(validationResult.data)
    .eq("id", entryId)
    .eq("user_id", userIdResult.data)
    .select("*")
    .maybeSingle();

  if (error) {
    return { code: "database_error", ok: false };
  }

  if (!data) {
    return { code: "not_found", ok: false };
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
