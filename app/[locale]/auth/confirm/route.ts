import { redirect } from "next/navigation";
import type { NextRequest } from "next/server";
import { resolveAuthLocale } from "@/lib/auth/require-user";
import { createServerClient } from "@/lib/supabase";
import { isSupabasePublicEnvConfigured } from "@/lib/supabase/env";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type ConfirmationRouteContext = Readonly<{
  params: Promise<{ locale: string }>;
}>;

function confirmationErrorPath(locale: string) {
  return `/${locale}/auth/confirmation-error`;
}

function hasOneBoundedValue(values: string[]) {
  return (
    values.length === 1 &&
    values[0].length > 0 &&
    values[0].length <= 2048 &&
    !/\s/.test(values[0])
  );
}

export async function GET(
  request: NextRequest,
  { params }: ConfirmationRouteContext,
) {
  const { locale: localeInput } = await params;
  const locale = resolveAuthLocale(localeInput);
  const tokenHashes = request.nextUrl.searchParams.getAll("token_hash");
  const purposes = request.nextUrl.searchParams.getAll("type");

  if (
    !isSupabasePublicEnvConfigured() ||
    !hasOneBoundedValue(tokenHashes) ||
    purposes.length !== 1 ||
    purposes[0] !== "invite"
  ) {
    redirect(confirmationErrorPath(locale));
  }

  let verificationFailed = false;

  try {
    const supabase = await createServerClient();
    const { error } = await supabase.auth.verifyOtp({
      token_hash: tokenHashes[0],
      type: "invite",
    });
    verificationFailed = Boolean(error);
  } catch {
    verificationFailed = true;
  }

  if (verificationFailed) {
    redirect(confirmationErrorPath(locale));
  }

  redirect(`/${locale}/auth/activate`);
}
