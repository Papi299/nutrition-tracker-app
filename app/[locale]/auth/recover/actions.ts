"use server";

import {
  createPasswordRecoveryClient,
  recoveryCallbackUrl,
} from "@/lib/auth/password-recovery";
import { resolveAuthLocale } from "@/lib/auth/require-user";
import { isSupabasePublicEnvConfigured } from "@/lib/supabase/env";
import type { RecoveryRequestActionState } from "./action-state";

const maximumEmailLength = 254;

function readEmail(formData: FormData) {
  return String(formData.get("email") ?? "").trim();
}

function isSyntacticallyValidEmail(email: string) {
  return (
    email.length <= maximumEmailLength &&
    /^[^@\s]{1,64}@[^@\s]{1,189}\.[^@\s]+$/.test(email)
  );
}

export async function requestPasswordRecoveryAction(
  localeInput: string,
  _previousState: RecoveryRequestActionState,
  formData: FormData,
): Promise<RecoveryRequestActionState> {
  const locale = resolveAuthLocale(localeInput);
  const email = readEmail(formData);

  if (!isSyntacticallyValidEmail(email)) {
    return { code: "invalidEmail", status: "error" };
  }

  if (isSupabasePublicEnvConfigured()) {
    try {
      const supabase = createPasswordRecoveryClient();
      await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: recoveryCallbackUrl(locale),
      });
    } catch {
      // A valid request always receives the same outward state. Provider and
      // configuration failures must not become account-existence signals.
    }
  }

  return { status: "success" };
}
