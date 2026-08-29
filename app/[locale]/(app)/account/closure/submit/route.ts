import { randomUUID } from "node:crypto";
import { getAccountAccessState } from "@/lib/auth/account-access";
import {
  accountClosureCapabilityMinimumLifetimeSeconds,
  accountClosureCapabilitySecretName,
  issueAccountClosureCapability,
} from "@/lib/account-closure/capability";
import {
  clearRecentPasswordAuthentication,
  RecentPasswordAuthenticationRequiredError,
  requireRecentPasswordAuthentication,
} from "@/lib/auth/recent-password-auth";
import {
  accountClosedPath,
  activationPath,
  signInPath,
} from "@/lib/auth/require-user";
import { cleanupClosedAccountSession } from "@/lib/auth/session-cleanup";
import {
  accountClosureReauthenticationIntent,
  reauthenticationPath,
} from "@/lib/auth/reauthentication-intent";
import { locales, type Locale } from "@/lib/i18n/routing";
import { applicationUrl, requestIsSameOrigin } from "@/lib/security/same-origin";
import { createServerClient } from "@/lib/supabase";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";

const confirmationValue = "confirm-account-closure-v1";
const noStoreHeaders = {
  "Cache-Control": "private, no-store, max-age=0",
  Expires: "0",
  Pragma: "no-cache",
  "X-Content-Type-Options": "nosniff",
};
const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

function resolveSupportedLocale(value: string): Locale | null {
  return (locales as readonly string[]).includes(value)
    ? (value as Locale)
    : null;
}

function safeFailure(locale: Locale | null, status: number) {
  const message =
    locale === "he"
      ? "לא הצלחנו לסגור את החשבון. לא בוצע שינוי חלקי."
      : "We could not close the account. No partial change was made.";

  return new Response(message, {
    headers: {
      ...noStoreHeaders,
      "Content-Type": "text/plain; charset=utf-8",
    },
    status,
  });
}

function redirectResponse(path: string) {
  return new Response(null, {
    headers: {
      ...noStoreHeaders,
      Location: applicationUrl(path).toString(),
    },
    status: 303,
  });
}

function isLocalFailureBeforeCommit(request: Request) {
  return (
    process.env.DATE_E2E_LOCAL_SUPABASE === "1" &&
    request.headers.get("x-phase11e5-closure-fault") === "before-commit"
  );
}

async function hasExactConfirmation(request: Request) {
  try {
    const form = await request.formData();
    const values = form.getAll("confirmClosure");

    return values.length === 1 && values[0] === confirmationValue;
  } catch {
    return false;
  }
}

export async function POST(
  request: Request,
  context: { params: Promise<{ locale: string }> },
) {
  const locale = resolveSupportedLocale((await context.params).locale);

  if (!locale) {
    return safeFailure(null, 404);
  }

  try {
    if (!requestIsSameOrigin(request)) {
      return safeFailure(locale, 403);
    }
  } catch {
    return safeFailure(locale, 403);
  }

  if (!(await hasExactConfirmation(request))) {
    return safeFailure(locale, 400);
  }

  let supabase: Awaited<ReturnType<typeof createServerClient>>;

  try {
    supabase = await createServerClient();
  } catch {
    return redirectResponse(signInPath(locale));
  }

  const claims = await supabase.auth.getClaims();
  const userId = claims.data?.claims?.sub;
  const sessionId = claims.data?.claims?.session_id;

  if (
    claims.error ||
    typeof userId !== "string" ||
    typeof sessionId !== "string" ||
    !uuidPattern.test(userId) ||
    !uuidPattern.test(sessionId)
  ) {
    return redirectResponse(signInPath(locale));
  }

  const access = await getAccountAccessState(supabase);

  if (access.status === "closed") {
    await cleanupClosedAccountSession(supabase);
    return redirectResponse(accountClosedPath(locale));
  }

  if (access.status === "unauthenticated") {
    return redirectResponse(signInPath(locale));
  }

  if (access.status === "activation_required") {
    return redirectResponse(activationPath(locale));
  }

  if (access.status !== "active" || access.userId !== userId) {
    return safeFailure(locale, 503);
  }

  let recentAuthentication: Awaited<
    ReturnType<typeof requireRecentPasswordAuthentication>
  >;

  try {
    recentAuthentication = await requireRecentPasswordAuthentication();
  } catch (error) {
    if (error instanceof RecentPasswordAuthenticationRequiredError) {
      return redirectResponse(
        reauthenticationPath(locale, accountClosureReauthenticationIntent),
      );
    }

    return safeFailure(locale, 503);
  }

  if (
    recentAuthentication.userId !== userId ||
    recentAuthentication.sessionId !== sessionId
  ) {
    return redirectResponse(
      reauthenticationPath(locale, accountClosureReauthenticationIntent),
    );
  }

  const nowSeconds = Math.floor(Date.now() / 1000);

  if (
    recentAuthentication.expiresAt - nowSeconds <
    accountClosureCapabilityMinimumLifetimeSeconds
  ) {
    await clearRecentPasswordAuthentication();
    return redirectResponse(
      reauthenticationPath(locale, accountClosureReauthenticationIntent),
    );
  }

  const secret = process.env[accountClosureCapabilitySecretName];

  if (!secret) {
    return safeFailure(locale, 503);
  }

  const closureRequestId = randomUUID();
  let capability: string;

  try {
    capability = issueAccountClosureCapability({
      e3ExpiresAt: recentAuthentication.expiresAt,
      nowSeconds,
      requestId: closureRequestId,
      secret,
      sessionId,
      userId,
    });
  } catch {
    return safeFailure(locale, 503);
  }

  if (isLocalFailureBeforeCommit(request)) {
    return safeFailure(locale, 503);
  }

  const result = await supabase.rpc("close_current_account", {
    p_capability: capability,
    p_closure_request_id: closureRequestId,
  });
  const outcome = result.data?.[0]?.outcome;

  if (result.error || !["closed", "already_closed"].includes(outcome ?? "")) {
    const converged = await getAccountAccessState(supabase);

    if (converged.status !== "closed") {
      return safeFailure(locale, 503);
    }
  }

  await cleanupClosedAccountSession(supabase);
  return redirectResponse(accountClosedPath(locale));
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ locale: string }> },
) {
  const locale = resolveSupportedLocale((await context.params).locale);
  const response = safeFailure(locale, 405);
  response.headers.set("Allow", "POST");
  return response;
}
