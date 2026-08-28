"use server";

import { redirect } from "next/navigation";
import { verifyCurrentPasswordAndIssueRecentAuthentication } from "@/lib/auth/recent-password-auth";
import {
  activationPath,
  protectedHomePath,
  resolveAuthLocale,
  signInPath,
} from "@/lib/auth/require-user";
import type { ReauthenticationActionState } from "./action-state";

export async function reauthenticateWithPasswordAction(
  localeInput: string,
  _previousState: ReauthenticationActionState,
  formData: FormData,
): Promise<ReauthenticationActionState> {
  const locale = resolveAuthLocale(localeInput);
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
    redirect(protectedHomePath(locale));
  }

  return {
    code:
      result.status === "unavailable" ? "unavailable" : "verificationFailed",
    status: "error",
  };
}
