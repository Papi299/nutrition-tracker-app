"use server";

import { redirect } from "next/navigation";
import { verifyCurrentPasswordAndIssueRecentAuthentication } from "@/lib/auth/recent-password-auth";
import {
  activationPath,
  resolveAuthLocale,
  signInPath,
} from "@/lib/auth/require-user";
import {
  reauthenticationDestination,
  resolveReauthenticationIntent,
} from "@/lib/auth/reauthentication-intent";
import type { ReauthenticationActionState } from "./action-state";

export async function reauthenticateWithPasswordAction(
  localeInput: string,
  intentInput: string | null,
  _previousState: ReauthenticationActionState,
  formData: FormData,
): Promise<ReauthenticationActionState> {
  const locale = resolveAuthLocale(localeInput);
  const intent = resolveReauthenticationIntent(intentInput);
  const password = String(formData.get("password") ?? "");

  if (!password) {
    return { code: "passwordRequired", status: "error" };
  }

  const result = await verifyCurrentPasswordAndIssueRecentAuthentication(
    password,
  );

  if (result.status === "unauthenticated") {
    redirect(signInPath(locale));
  }

  if (result.status === "activation_required") {
    redirect(activationPath(locale));
  }

  if (result.status === "success") {
    redirect(reauthenticationDestination(locale, intent));
  }

  return {
    code:
      result.status === "unavailable" ? "unavailable" : "verificationFailed",
    status: "error",
  };
}
