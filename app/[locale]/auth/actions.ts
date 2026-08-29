"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { defaultLocale, locales, type Locale } from "@/lib/i18n/routing";
import { getAccountAccessState } from "@/lib/auth/account-access";
import { clearRecentPasswordAuthentication } from "@/lib/auth/recent-password-auth";
import { cleanupClosedAccountSession } from "@/lib/auth/session-cleanup";
import { accountClosedPath } from "@/lib/auth/require-user";
import { createServerClient } from "@/lib/supabase";
import { isSupabasePublicEnvConfigured } from "@/lib/supabase/env";
import type { AuthActionState } from "./action-state";

const minimumPasswordLength = 6;

function resolveLocale(locale: string): Locale {
  return (locales as readonly string[]).includes(locale)
    ? (locale as Locale)
    : defaultLocale;
}

function readCredentials(formData: FormData) {
  return {
    email: String(formData.get("email") ?? "").trim(),
    password: String(formData.get("password") ?? ""),
  };
}

function validateCredentials(formData: FormData): AuthActionState | null {
  const { email, password } = readCredentials(formData);

  if (!email || !email.includes("@")) {
    return { code: "invalidEmail", status: "error" };
  }

  if (!password) {
    return { code: "passwordRequired", status: "error" };
  }

  if (password.length < minimumPasswordLength) {
    return { code: "passwordTooShort", status: "error" };
  }

  return null;
}

function getMissingConfigState(): AuthActionState | null {
  if (isSupabasePublicEnvConfigured()) {
    return null;
  }

  return { code: "missingConfig", status: "error" };
}

export async function signInAction(
  localeInput: string,
  _previousState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const locale = resolveLocale(localeInput);
  const validationError = validateCredentials(formData);

  if (validationError) {
    return validationError;
  }

  const missingConfig = getMissingConfigState();

  if (missingConfig) {
    return missingConfig;
  }

  const { email, password } = readCredentials(formData);
  const supabase = await createServerClient();
  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    return { code: "authFailed", status: "error" };
  }

  const accessState = await getAccountAccessState(supabase);

  if (accessState.status === "active") {
    redirect(`/${locale}/today`);
  }

  if (accessState.status === "closed") {
    await cleanupClosedAccountSession(supabase);
    redirect(accountClosedPath(locale));
  }

  if (accessState.status === "activation_required") {
    redirect(`/${locale}/auth/activate`);
  }

  await cleanupClosedAccountSession(supabase);
  return { code: "authFailed", status: "error" };
}

export async function signOutAction(localeInput: string) {
  const locale = resolveLocale(localeInput);
  let signOutFailed = false;

  if (isSupabasePublicEnvConfigured()) {
    const supabase = await createServerClient();

    try {
      const { error } = await supabase.auth.signOut();

      if (error) {
        signOutFailed = true;
      }
    } catch {
      signOutFailed = true;
    }
  }

  if (signOutFailed) {
    redirect(`/${locale}/sign-out-failed`);
  }

  await clearRecentPasswordAuthentication();

  revalidatePath("/", "layout");
  redirect(`/${locale}`);
}
