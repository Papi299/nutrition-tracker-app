import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { createServerClient } from "@/lib/supabase";
import type { Database } from "@/lib/supabase/database.types";
import { isSupabasePublicEnvConfigured } from "@/lib/supabase/env";
import {
  classifyObservabilityEnvironment,
  emitObservabilityEvent,
} from "@/lib/observability";

export type AccountAccessState =
  | { status: "unauthenticated" }
  | { status: "activation_required"; userId: string }
  | { status: "active"; userId: string }
  | { status: "closed"; userId: string }
  | { status: "unavailable"; userId: string };

export type AccountLifecycleState =
  | { status: "unauthenticated" }
  | { status: "activation_required" }
  | { status: "active" }
  | { status: "closed" }
  | { status: "unavailable" };

function emitAccountAccessFailure() {
  emitObservabilityEvent({
    environment: classifyObservabilityEnvironment(),
    errorCode: "database_unexpected",
    name: "dependency.failure",
    operation: "read",
    outcome: "unavailable",
    routeTemplate: "server_operation",
    runtime: "node",
    severity: "error",
    surface: "database",
  });
}

export async function getAccountLifecycleState(
  suppliedClient?: SupabaseClient<Database>,
): Promise<AccountLifecycleState> {
  if (!isSupabasePublicEnvConfigured()) {
    return { status: "unauthenticated" };
  }

  const supabase = suppliedClient ?? (await createServerClient());
  const { data, error } = await supabase.rpc(
    "current_account_access_state",
  );

  if (error) {
    const { data: claimsData, error: claimsError } =
      await supabase.auth.getClaims();
    const userId = claimsData?.claims?.sub;

    if (claimsError || typeof userId !== "string") {
      return { status: "unauthenticated" };
    }

    emitAccountAccessFailure();
    return { status: "unavailable" };
  }

  if (
    data === "unauthenticated" ||
    data === "closed" ||
    data === "active" ||
    data === "activation_required"
  ) {
    return { status: data };
  }

  return { status: "unavailable" };
}

export async function getAccountAccessState(
  suppliedClient?: SupabaseClient<Database>,
): Promise<AccountAccessState> {
  if (!isSupabasePublicEnvConfigured()) {
    return { status: "unauthenticated" };
  }

  const supabase = suppliedClient ?? (await createServerClient());
  const { data: claimsData, error: claimsError } =
    await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub;

  if (claimsError || typeof userId !== "string") {
    return { status: "unauthenticated" };
  }

  const { data, error } = await supabase.rpc(
    "current_account_access_state",
  );

  if (error) {
    emitAccountAccessFailure();
    return { status: "unavailable", userId };
  }

  if (data === "unauthenticated") {
    return { status: "unauthenticated" };
  }

  if (data === "closed") {
    return { status: "closed", userId };
  }

  if (data === "active") {
    return { status: "active", userId };
  }

  if (data === "activation_required") {
    return { status: "activation_required", userId };
  }

  return { status: "unavailable", userId };
}
