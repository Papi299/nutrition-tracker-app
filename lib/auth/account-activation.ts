import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { createServerClient } from "@/lib/supabase";
import type { Database } from "@/lib/supabase/database.types";
import { isSupabasePublicEnvConfigured } from "@/lib/supabase/env";

export const eligibilityStatementVersion =
  "p11e-e001-private-beta-eligibility-v1";

export type AccountActivationState =
  | { status: "unauthenticated" }
  | { status: "incomplete"; userId: string }
  | { status: "complete"; userId: string }
  | { status: "unavailable"; userId: string };

export async function getAccountActivationState(
  suppliedClient?: SupabaseClient<Database>,
): Promise<AccountActivationState> {
  if (!isSupabasePublicEnvConfigured()) {
    return { status: "unauthenticated" };
  }

  const supabase = suppliedClient ?? (await createServerClient());
  const { data: claimsData, error: claimsError } =
    await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub;

  if (claimsError || !userId) {
    return { status: "unauthenticated" };
  }

  const { data, error } = await supabase.rpc(
    "is_current_account_activated",
  );

  if (error) {
    return { status: "unavailable", userId };
  }

  if (data !== true) {
    return { status: "incomplete", userId };
  }

  return { status: "complete", userId };
}
