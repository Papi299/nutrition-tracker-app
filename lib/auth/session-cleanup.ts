import "server-only";

import { cookies } from "next/headers";
import type { SupabaseClient } from "@supabase/supabase-js";
import { clearRecentPasswordAuthentication } from "@/lib/auth/recent-password-auth";
import type { Database } from "@/lib/supabase/database.types";

export async function clearBrowserAuthenticationState() {
  const cookieStore = await cookies();

  for (const cookie of cookieStore.getAll()) {
    if (
      cookie.name.startsWith("sb-") &&
      (cookie.name.includes("-auth-token") ||
        cookie.name.includes("-code-verifier"))
    ) {
      cookieStore.delete(cookie.name);
    }
  }

  await clearRecentPasswordAuthentication();
}

export async function cleanupClosedAccountSession(
  supabase: SupabaseClient<Database>,
) {
  try {
    await supabase.auth.signOut({ scope: "global" });
  } catch {
    // Closure is database-authoritative. Provider cleanup is best effort and
    // browser credentials are removed below even when global sign-out fails.
  }

  await clearBrowserAuthenticationState();
}
