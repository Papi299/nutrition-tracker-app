import { redirect } from "next/navigation";
import {
  defaultLocale,
  locales,
  type Locale,
} from "@/lib/i18n/routing";
import { createServerClient } from "@/lib/supabase";
import { isSupabasePublicEnvConfigured } from "@/lib/supabase/env";

export function resolveAuthLocale(locale: string): Locale {
  return (locales as readonly string[]).includes(locale)
    ? (locale as Locale)
    : defaultLocale;
}

export function protectedHomePath(locale: Locale) {
  return `/${locale}/today`;
}

export function signInPath(locale: Locale) {
  return `/${locale}/auth/sign-in`;
}

export async function hasAuthenticatedUser() {
  if (!isSupabasePublicEnvConfigured()) {
    return false;
  }

  const supabase = await createServerClient();
  const { data, error } = await supabase.auth.getClaims();

  return !error && Boolean(data?.claims);
}

export async function requireAuthenticatedUser(localeInput: string) {
  const locale = resolveAuthLocale(localeInput);

  if (!(await hasAuthenticatedUser())) {
    redirect(signInPath(locale));
  }
}

export async function redirectAuthenticatedUser(localeInput: string) {
  const locale = resolveAuthLocale(localeInput);

  if (await hasAuthenticatedUser()) {
    redirect(protectedHomePath(locale));
  }
}
