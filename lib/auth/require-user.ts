import { redirect } from "next/navigation";
import {
  defaultLocale,
  locales,
  type Locale,
} from "@/lib/i18n/routing";
import { createServerClient } from "@/lib/supabase";
import { isSupabasePublicEnvConfigured } from "@/lib/supabase/env";
import { getAccountActivationState } from "./account-activation";

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

export function activationPath(locale: Locale) {
  return `/${locale}/auth/activate`;
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

export async function requireActivatedUser(localeInput: string) {
  const locale = resolveAuthLocale(localeInput);
  const state = await getAccountActivationState();

  if (state.status === "unauthenticated") {
    redirect(signInPath(locale));
  }

  if (state.status !== "complete") {
    redirect(activationPath(locale));
  }
}

export async function redirectAuthenticatedUser(localeInput: string) {
  const locale = resolveAuthLocale(localeInput);
  const state = await getAccountActivationState();

  if (state.status === "complete") {
    redirect(protectedHomePath(locale));
  }

  if (state.status !== "unauthenticated") {
    redirect(activationPath(locale));
  }
}
