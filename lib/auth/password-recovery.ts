import "server-only";

import { createClient } from "@supabase/supabase-js";
import type { Locale } from "@/lib/i18n/routing";
import type { Database } from "@/lib/supabase/database.types";
import { getSupabasePublicEnv } from "@/lib/supabase/env";

const recoveryCookiePrefix = "nutrition_tracker_recovery_";
const recoveryCookieMaxAgeSeconds = 10 * 60;

export function recoveryRequestPath(locale: Locale) {
  return `/${locale}/auth/recover`;
}

export function recoveryCallbackPath(locale: Locale) {
  return `/${locale}/auth/recover/confirm`;
}

export function recoveryResetPath(locale: Locale) {
  return `/${locale}/auth/recover/reset`;
}

export function recoveryErrorPath(locale: Locale) {
  return `/${locale}/auth/recover/error`;
}

export function recoveryCookieName(locale: Locale) {
  return `${recoveryCookiePrefix}${locale}`;
}

export function recoveryCookieOptions(locale: Locale) {
  return {
    httpOnly: true,
    maxAge: recoveryCookieMaxAgeSeconds,
    path: recoveryRequestPath(locale),
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
  };
}

export function expiredRecoveryCookieOptions(locale: Locale) {
  return {
    ...recoveryCookieOptions(locale),
    maxAge: 0,
  };
}

export function hasOneBoundedRecoveryToken(values: string[]) {
  return (
    values.length === 1 &&
    /^[A-Za-z0-9_-]{16,512}$/.test(values[0])
  );
}

export function recoveryCallbackUrl(locale: Locale) {
  const rawOrigin = process.env.APP_ORIGIN;

  if (!rawOrigin) {
    throw new Error("The server-owned application origin is not configured.");
  }

  const origin = new URL(rawOrigin);

  if (
    !["http:", "https:"].includes(origin.protocol) ||
    origin.username ||
    origin.password ||
    origin.pathname !== "/" ||
    origin.search ||
    origin.hash
  ) {
    throw new Error("The server-owned application origin is invalid.");
  }

  return new URL(recoveryCallbackPath(locale), origin).toString();
}

export function createPasswordRecoveryClient() {
  const { publishableKey, url } = getSupabasePublicEnv();

  return createClient<Database>(url, publishableKey, {
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      flowType: "implicit",
      persistSession: false,
    },
  });
}
