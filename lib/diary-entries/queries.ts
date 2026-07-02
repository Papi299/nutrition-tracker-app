import "server-only";

import { getAuthenticatedUserId } from "@/lib/data/auth";
import type { DataResult } from "@/lib/data/result";
import { createServerClient } from "@/lib/supabase";
import type { Tables } from "@/lib/supabase/database.types";
import { validateDiaryEntryDate } from "./validation";

export type DiaryEntry = Tables<"diary_entries">;

export async function listCurrentDiaryEntriesForDate(
  entryDate: string,
): Promise<DataResult<DiaryEntry[]>> {
  const userIdResult = await getAuthenticatedUserId();

  if (!userIdResult.ok) {
    return userIdResult;
  }

  const dateResult = validateDiaryEntryDate(entryDate);

  if (!dateResult.ok) {
    return dateResult;
  }

  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("diary_entries")
    .select("*")
    .eq("user_id", userIdResult.data)
    .eq("entry_date", dateResult.data)
    .order("created_at", { ascending: true })
    .order("id", { ascending: true });

  if (error) {
    return { code: "database_error", ok: false };
  }

  return { data: data ?? [], ok: true };
}
