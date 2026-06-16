import "server-only";

import { getAuthenticatedUserId } from "@/lib/data/auth";
import type { DataResult } from "@/lib/data/result";
import { createServerClient } from "@/lib/supabase";
import type { Tables } from "@/lib/supabase/database.types";

export type Profile = Tables<"profiles">;

export async function getCurrentProfile(): Promise<
  DataResult<Profile | null>
> {
  const userIdResult = await getAuthenticatedUserId();

  if (!userIdResult.ok) {
    return userIdResult;
  }

  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userIdResult.data)
    .maybeSingle();

  if (error) {
    return { code: "database_error", ok: false };
  }

  return { data, ok: true };
}
