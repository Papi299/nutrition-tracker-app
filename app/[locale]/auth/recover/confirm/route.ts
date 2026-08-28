import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import {
  hasOneBoundedRecoveryToken,
  expiredRecoveryCookieOptions,
  recoveryCookieName,
  recoveryCookieOptions,
  recoveryErrorPath,
  recoveryResetPath,
} from "@/lib/auth/password-recovery";
import { resolveAuthLocale } from "@/lib/auth/require-user";
import { isSupabasePublicEnvConfigured } from "@/lib/supabase/env";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type RecoveryConfirmationRouteContext = Readonly<{
  params: Promise<{ locale: string }>;
}>;

function recoveryRedirect(path: string) {
  return new NextResponse(null, {
    headers: {
      "Cache-Control": "private, no-store",
      Location: path,
    },
    status: 303,
  });
}

export async function GET(
  request: NextRequest,
  { params }: RecoveryConfirmationRouteContext,
) {
  const { locale: localeInput } = await params;
  const locale = resolveAuthLocale(localeInput);
  const tokenHashes = request.nextUrl.searchParams.getAll("token_hash");
  const purposes = request.nextUrl.searchParams.getAll("type");
  const cookieName = recoveryCookieName(locale);

  if (
    !isSupabasePublicEnvConfigured() ||
    !hasOneBoundedRecoveryToken(tokenHashes) ||
    purposes.length !== 1 ||
    purposes[0] !== "recovery"
  ) {
    const response = recoveryRedirect(recoveryErrorPath(locale));
    response.cookies.set(
      cookieName,
      "",
      expiredRecoveryCookieOptions(locale),
    );
    return response;
  }

  const response = recoveryRedirect(recoveryResetPath(locale));
  response.cookies.set(
    cookieName,
    tokenHashes[0],
    recoveryCookieOptions(locale),
  );
  return response;
}
