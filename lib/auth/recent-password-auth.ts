import "server-only";

import { cookies } from "next/headers";
import {
  createClient as createSupabaseClient,
  type SupabaseClient,
} from "@supabase/supabase-js";
import { getAccountActivationState } from "@/lib/auth/account-activation";
import {
  expiredRecentPasswordAuthCookieOptions,
  issueRecentPasswordAuthProof,
  recentPasswordAuthCookieName,
  recentPasswordAuthCookieOptions,
  verifyRecentPasswordAuthProof,
} from "@/lib/auth/recent-password-auth-proof";
import { createServerClient } from "@/lib/supabase";
import type { Database } from "@/lib/supabase/database.types";
import {
  getSupabasePublicEnv,
  isSupabasePublicEnvConfigured,
} from "@/lib/supabase/env";

type CurrentAuthIdentity = Readonly<{
  email?: string;
  sessionId: string;
  userId: string;
}>;

export type RecentPasswordAuthInspection =
  | Readonly<{
      expiresAt: number;
      issuedAt: number;
      sessionId: string;
      status: "valid";
      userId: string;
    }>
  | Readonly<{
      status:
        | "activation_required"
        | "invalid"
        | "missing"
        | "unauthenticated"
        | "unavailable";
    }>;

export type RecentPasswordVerificationResult = Readonly<{
  status:
    | "activation_required"
    | "success"
    | "unauthenticated"
    | "unavailable"
    | "verification_failed";
}>;

export class RecentPasswordAuthenticationRequiredError extends Error {
  constructor(
    readonly reason: Exclude<
      RecentPasswordAuthInspection["status"],
      "valid"
    >,
  ) {
    super("Recent password authentication is required.");
    this.name = "RecentPasswordAuthenticationRequiredError";
  }
}

function readProofSecret() {
  const secret = process.env.AUTH_REAUTH_PROOF_SECRET;

  if (!secret) {
    throw new Error("Recent-password authentication is unavailable.");
  }

  return secret;
}

function isUuid(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value,
    )
  );
}

async function currentAuthIdentity(
  supabase: SupabaseClient<Database>,
): Promise<CurrentAuthIdentity | null> {
  const claimsResult = await supabase.auth.getClaims();
  const claims = claimsResult.data?.claims;

  if (
    claimsResult.error ||
    !isUuid(claims?.sub) ||
    !isUuid(claims?.session_id)
  ) {
    return null;
  }

  return {
    email: typeof claims.email === "string" ? claims.email : undefined,
    sessionId: claims.session_id,
    userId: claims.sub,
  };
}

function createPasswordVerificationClient() {
  const { publishableKey, url } = getSupabasePublicEnv();

  return createSupabaseClient<Database>(url, publishableKey, {
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: false,
    },
  });
}

async function disposeTemporarySession(
  client: ReturnType<typeof createPasswordVerificationClient>,
) {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const { error } = await client.auth.signOut({ scope: "local" });

      if (!error) {
        return true;
      }
    } catch {
      // A bounded retry handles a single transient provider failure without
      // ever widening cleanup to global sign-out.
    }
  }

  return false;
}

export async function inspectRecentPasswordAuthentication(): Promise<RecentPasswordAuthInspection> {
  if (!isSupabasePublicEnvConfigured()) {
    return { status: "unauthenticated" };
  }

  try {
    const supabase = await createServerClient();
    const identity = await currentAuthIdentity(supabase);

    if (!identity) {
      return { status: "unauthenticated" };
    }

    const activation = await getAccountActivationState(supabase);

    if (activation.status === "incomplete") {
      return { status: "activation_required" };
    }

    if (activation.status !== "complete" || activation.userId !== identity.userId) {
      return { status: "unavailable" };
    }

    const proof = (await cookies()).get(recentPasswordAuthCookieName)?.value;

    if (!proof) {
      return { status: "missing" };
    }

    const verification = verifyRecentPasswordAuthProof({
      currentSessionId: identity.sessionId,
      currentUserId: identity.userId,
      nowSeconds: Math.floor(Date.now() / 1000),
      proof,
      secret: readProofSecret(),
    });

    if (verification.status !== "valid") {
      return { status: "invalid" };
    }

    return {
      expiresAt: verification.expiresAt,
      issuedAt: verification.issuedAt,
      sessionId: identity.sessionId,
      status: "valid",
      userId: identity.userId,
    };
  } catch {
    return { status: "unavailable" };
  }
}

export async function requireRecentPasswordAuthentication() {
  const inspection = await inspectRecentPasswordAuthentication();

  if (inspection.status !== "valid") {
    throw new RecentPasswordAuthenticationRequiredError(inspection.status);
  }

  return inspection;
}

export async function clearRecentPasswordAuthentication() {
  const cookieStore = await cookies();
  cookieStore.set(
    recentPasswordAuthCookieName,
    "",
    expiredRecentPasswordAuthCookieOptions(),
  );
}

export async function verifyCurrentPasswordAndIssueRecentAuthentication(
  password: string,
): Promise<RecentPasswordVerificationResult> {
  if (!isSupabasePublicEnvConfigured()) {
    return { status: "unavailable" };
  }

  try {
    const primaryClient = await createServerClient();
    const identity = await currentAuthIdentity(primaryClient);

    if (!identity) {
      return { status: "unauthenticated" };
    }

    const activation = await getAccountActivationState(primaryClient);

    if (activation.status === "incomplete") {
      return { status: "activation_required" };
    }

    if (activation.status !== "complete" || activation.userId !== identity.userId) {
      return { status: "unavailable" };
    }

    const currentUser = await primaryClient.auth.getUser();
    const currentEmail = currentUser.data.user?.email;

    if (
      currentUser.error ||
      currentUser.data.user?.id !== identity.userId ||
      !currentEmail ||
      (identity.email && currentEmail !== identity.email)
    ) {
      return { status: "unauthenticated" };
    }

    const verificationClient = createPasswordVerificationClient();
    let verified: Awaited<
      ReturnType<typeof verificationClient.auth.signInWithPassword>
    >;

    try {
      verified = await verificationClient.auth.signInWithPassword({
        email: currentEmail,
        password,
      });
    } catch {
      await disposeTemporarySession(verificationClient);
      return { status: "verification_failed" };
    }

    if (verified.error || !verified.data.session || !verified.data.user) {
      await disposeTemporarySession(verificationClient);
      return { status: "verification_failed" };
    }

    let returnedIdentityMatches = false;
    let disposed = false;

    try {
      const temporaryClaims = await verificationClient.auth.getClaims(
        verified.data.session.access_token,
      );
      returnedIdentityMatches =
        verified.data.user.id === identity.userId &&
        verified.data.session.user.id === identity.userId &&
        temporaryClaims.data?.claims?.sub === identity.userId &&
        isUuid(temporaryClaims.data?.claims?.session_id) &&
        !temporaryClaims.error;
    } catch {
      returnedIdentityMatches = false;
    } finally {
      disposed = await disposeTemporarySession(verificationClient);
    }

    if (!disposed || !returnedIdentityMatches) {
      return { status: "verification_failed" };
    }

    const stillCurrent = await currentAuthIdentity(primaryClient);
    const stillCurrentUser = await primaryClient.auth.getUser();

    if (
      !stillCurrent ||
      stillCurrent.userId !== identity.userId ||
      stillCurrent.sessionId !== identity.sessionId ||
      stillCurrentUser.error ||
      stillCurrentUser.data.user?.id !== identity.userId
    ) {
      return { status: "unauthenticated" };
    }

    const proof = issueRecentPasswordAuthProof({
      nowSeconds: Math.floor(Date.now() / 1000),
      secret: readProofSecret(),
      sessionId: identity.sessionId,
      userId: identity.userId,
    });
    const cookieStore = await cookies();
    cookieStore.set(
      recentPasswordAuthCookieName,
      proof,
      recentPasswordAuthCookieOptions(),
    );

    return { status: "success" };
  } catch {
    return { status: "unavailable" };
  }
}
