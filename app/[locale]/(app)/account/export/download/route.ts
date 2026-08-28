import { getAccountActivationState } from "@/lib/auth/account-activation";
import {
  RecentPasswordAuthenticationRequiredError,
  requireRecentPasswordAuthentication,
} from "@/lib/auth/recent-password-auth";
import {
  activationPath,
  resolveAuthLocale,
  signInPath,
} from "@/lib/auth/require-user";
import {
  accountExportReauthenticationIntent,
  reauthenticationPath,
} from "@/lib/auth/reauthentication-intent";
import { collectAccountExport } from "@/lib/account-export/collector";
import {
  accountExportFilename,
  serializeAccountExport,
} from "@/lib/account-export/schema";
import {
  accountExportFailureInjection,
  accountExportRequestIsSameOrigin,
  applicationUrl,
} from "@/lib/account-export/security";
import { createServerClient } from "@/lib/supabase";
import type { Locale } from "@/lib/i18n/routing";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";

const noStoreHeaders = {
  "Cache-Control": "private, no-store, max-age=0",
  Expires: "0",
  Pragma: "no-cache",
  "X-Content-Type-Options": "nosniff",
};

function safeFailure(locale: Locale, status: number) {
  const message =
    locale === "he"
      ? "לא הצלחנו להכין את ייצוא החשבון. לא הורד קובץ חלקי."
      : "We could not prepare the account export. No partial file was downloaded.";

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

export async function POST(
  request: Request,
  context: { params: Promise<{ locale: string }> },
) {
  const locale = resolveAuthLocale((await context.params).locale);

  try {
    if (!accountExportRequestIsSameOrigin(request)) {
      return safeFailure(locale, 403);
    }
  } catch {
    return safeFailure(locale, 403);
  }

  let supabase: Awaited<ReturnType<typeof createServerClient>>;

  try {
    supabase = await createServerClient();
  } catch {
    return redirectResponse(signInPath(locale));
  }

  const claims = await supabase.auth.getClaims();
  const userId = claims.data?.claims?.sub;

  if (claims.error || typeof userId !== "string") {
    return redirectResponse(signInPath(locale));
  }

  const activation = await getAccountActivationState(supabase);

  if (activation.status === "unauthenticated") {
    return redirectResponse(signInPath(locale));
  }

  if (activation.status !== "complete" || activation.userId !== userId) {
    return redirectResponse(activationPath(locale));
  }

  try {
    const recentAuthentication =
      await requireRecentPasswordAuthentication();

    if (recentAuthentication.userId !== userId) {
      return redirectResponse(
        reauthenticationPath(locale, accountExportReauthenticationIntent),
      );
    }
  } catch (error) {
    if (error instanceof RecentPasswordAuthenticationRequiredError) {
      return redirectResponse(
        reauthenticationPath(locale, accountExportReauthenticationIntent),
      );
    }

    return safeFailure(locale, 500);
  }

  const currentUser = await supabase.auth.getUser();
  const user = currentUser.data.user;

  if (currentUser.error || !user || user.id !== userId) {
    return redirectResponse(signInPath(locale));
  }

  try {
    const exportedAt = new Date();
    const payload = await collectAccountExport({
      account: {
        created_at: user.created_at,
        email: user.email,
        id: user.id,
      },
      exportedAt,
      failureInjection: accountExportFailureInjection(request),
      supabase,
    });
    const body = serializeAccountExport(payload);
    const filename = accountExportFilename(exportedAt);

    return new Response(body, {
      headers: {
        ...noStoreHeaders,
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Content-Type": "application/json; charset=utf-8",
        "Cross-Origin-Resource-Policy": "same-origin",
      },
      status: 200,
    });
  } catch {
    return safeFailure(locale, 500);
  }
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ locale: string }> },
) {
  const locale = resolveAuthLocale((await context.params).locale);
  const response = safeFailure(locale, 405);
  response.headers.set("Allow", "POST");
  return response;
}
