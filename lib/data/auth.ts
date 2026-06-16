import "server-only";

import { createServerClient } from "@/lib/supabase";
import { isSupabasePublicEnvConfigured } from "@/lib/supabase/env";
import type { DataResult } from "./result";

export async function getAuthenticatedUserId(): Promise<DataResult<string>> {
  if (!isSupabasePublicEnvConfigured()) {
    return { code: "unauthenticated", ok: false };
  }

  const supabase = await createServerClient();
  const { data, error } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;

  if (error || !userId) {
    return { code: "unauthenticated", ok: false };
  }

  return { data: userId, ok: true };
}
