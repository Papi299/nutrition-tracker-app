"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { getAccountActivationState } from "@/lib/auth/account-activation";
import {
  protectedHomePath,
  resolveAuthLocale,
  signInPath,
} from "@/lib/auth/require-user";
import { createServerClient } from "@/lib/supabase";
import type { Database } from "@/lib/supabase/database.types";
import {
  getSupabasePublicEnv,
  isSupabasePublicEnvConfigured,
} from "@/lib/supabase/env";
import type { ActivationActionState } from "./action-state";

const minimumPasswordLength = 6;

function validateActivationForm(formData: FormData): ActivationActionState | null {
  const password = String(formData.get("password") ?? "");
  const passwordConfirmation = String(
    formData.get("passwordConfirmation") ?? "",
  );

  if (!password) {
    return { code: "passwordRequired", status: "error" };
  }

  if (password.length < minimumPasswordLength) {
    return { code: "passwordTooShort", status: "error" };
  }

  if (password !== passwordConfirmation) {
    return { code: "passwordMismatch", status: "error" };
  }

  if (formData.get("age18Attested") !== "on") {
    return { code: "ageRequired", status: "error" };
  }

  if (formData.get("israelAttested") !== "on") {
    return { code: "israelRequired", status: "error" };
  }

  return null;
}

export async function activateAccountAction(
  localeInput: string,
  _previousState: ActivationActionState,
  formData: FormData,
): Promise<ActivationActionState> {
  const locale = resolveAuthLocale(localeInput);
  const validationError = validateActivationForm(formData);

  if (validationError) {
    return validationError;
  }

  if (!isSupabasePublicEnvConfigured()) {
    return { code: "missingConfig", status: "error" };
  }

  const supabase = await createServerClient();
  const state = await getAccountActivationState(supabase);

  if (state.status === "unauthenticated") {
    redirect(signInPath(locale));
  }

  if (state.status === "complete") {
    redirect(protectedHomePath(locale));
  }

  const { data: identityData, error: identityError } =
    await supabase.auth.getUser();

  if (identityError || !identityData.user?.email) {
    return { code: "activationFailed", status: "error" };
  }

  const password = String(formData.get("password"));
  const { error: passwordError } = await supabase.auth.updateUser({ password });

  if (passwordError) {
    return { code: "activationFailed", status: "error" };
  }

  const { publishableKey, url } = getSupabasePublicEnv();
  const passwordSupabase = createSupabaseClient<Database>(url, publishableKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
  const { data: passwordSignInData, error: passwordSignInError } =
    await passwordSupabase.auth.signInWithPassword({
      email: identityData.user.email,
      password,
    });

  if (passwordSignInError || !passwordSignInData.session) {
    return { code: "activationFailed", status: "error" };
  }

  const { error: staleSessionError } = await passwordSupabase.auth.signOut({
    scope: "others",
  });

  if (staleSessionError) {
    return { code: "activationFailed", status: "error" };
  }

  const { error: activationError } = await passwordSupabase.rpc(
    "complete_invited_account_activation",
    {
      p_age_18_attested: true,
      p_israel_attested: true,
    },
  );

  if (activationError) {
    return { code: "activationFailed", status: "error" };
  }

  const { error: sessionCookieError } = await supabase.auth.setSession({
    access_token: passwordSignInData.session.access_token,
    refresh_token: passwordSignInData.session.refresh_token,
  });

  if (sessionCookieError) {
    return { code: "activationFailed", status: "error" };
  }

  revalidatePath("/", "layout");
  redirect(protectedHomePath(locale));
}
