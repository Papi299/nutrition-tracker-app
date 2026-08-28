"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  createPasswordRecoveryClient,
  expiredRecoveryCookieOptions,
  hasOneBoundedRecoveryToken,
  recoveryCookieName,
  recoveryErrorPath,
} from "@/lib/auth/password-recovery";
import { resolveAuthLocale, signInPath } from "@/lib/auth/require-user";
import { createServerClient } from "@/lib/supabase";
import type { RecoveryResetActionState } from "./action-state";

const minimumPasswordLength = 6;

function validatePasswordForm(
  formData: FormData,
): RecoveryResetActionState | null {
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

  return null;
}

export async function completePasswordRecoveryAction(
  localeInput: string,
  _previousState: RecoveryResetActionState,
  formData: FormData,
): Promise<RecoveryResetActionState> {
  const locale = resolveAuthLocale(localeInput);
  const validationError = validatePasswordForm(formData);

  if (validationError) {
    return validationError;
  }

  const cookieStore = await cookies();
  const cookieName = recoveryCookieName(locale);
  const tokenHash = cookieStore.get(cookieName)?.value ?? "";

  if (!hasOneBoundedRecoveryToken([tokenHash])) {
    cookieStore.set(cookieName, "", expiredRecoveryCookieOptions(locale));
    redirect(recoveryErrorPath(locale));
  }

  const password = String(formData.get("password"));
  let recoveryClient: ReturnType<typeof createPasswordRecoveryClient> | null =
    null;
  let passwordUpdated = false;

  try {
    recoveryClient = createPasswordRecoveryClient();
    const verified = await recoveryClient.auth.verifyOtp({
      token_hash: tokenHash,
      type: "recovery",
    });
    const verifiedUserId = verified.data.user?.id;

    if (
      !verified.error &&
      verifiedUserId &&
      verified.data.session?.user.id === verifiedUserId
    ) {
      const updated = await recoveryClient.auth.updateUser({ password });
      passwordUpdated =
        !updated.error && updated.data.user?.id === verifiedUserId;
    }
  } catch {
    passwordUpdated = false;
  }

  if (!passwordUpdated) {
    cookieStore.set(cookieName, "", expiredRecoveryCookieOptions(locale));
    try {
      await recoveryClient?.auth.signOut({ scope: "local" });
    } catch {
      // The recovery bearer is discarded with this server action either way.
    }
    redirect(recoveryErrorPath(locale));
  }

  try {
    await recoveryClient?.auth.signOut({ scope: "local" });
  } catch {
    // The isolated client is non-persistent; no recovery bearer reaches the
    // browser even if provider-side local-session revocation is unavailable.
  }

  try {
    const applicationClient = await createServerClient();
    await applicationClient.auth.signOut({ scope: "local" });
  } catch {
    // The provider-derived password update has already succeeded. Browser
    // Supabase cookies are also removed below before the safe sign-in return.
  }

  for (const cookie of cookieStore.getAll()) {
    if (
      cookie.name.startsWith("sb-") &&
      (cookie.name.includes("-auth-token") ||
        cookie.name.includes("-code-verifier"))
    ) {
      cookieStore.delete(cookie.name);
    }
  }

  cookieStore.set(cookieName, "", expiredRecoveryCookieOptions(locale));

  redirect(`${signInPath(locale)}?recovery=complete`);
}
