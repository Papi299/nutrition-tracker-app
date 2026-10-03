"use client";

import { useActionState, useEffect, useRef } from "react";
import {
  initialRecoveryResetActionState,
  type RecoveryResetActionCode,
  type RecoveryResetActionState,
} from "@/app/[locale]/auth/recover/reset/action-state";
import { AuthStatusNote } from "@/components/auth/auth-status-note";
import { Button } from "@/components/ui/button";
import { FieldLabel, Input } from "@/components/ui/form-controls";

export function RecoveryResetForm({
  action,
  errorMessages,
  passwordConfirmationLabel,
  passwordLabel,
  pendingLabel,
  statusIdle,
  submitLabel,
}: {
  action: (
    state: RecoveryResetActionState,
    formData: FormData,
  ) => Promise<RecoveryResetActionState>;
  errorMessages: Record<RecoveryResetActionCode, string>;
  passwordConfirmationLabel: string;
  passwordLabel: string;
  pendingLabel: string;
  statusIdle: string;
  submitLabel: string;
}) {
  const [state, formAction, isPending] = useActionState(
    action,
    initialRecoveryResetActionState,
  );
  const formRef = useRef<HTMLFormElement>(null);
  const passwordInvalid = state.status === "error";
  const statusMessage =
    state.status === "error" && state.code
      ? errorMessages[state.code]
      : statusIdle;

  useEffect(() => {
    if (state.status === "error") {
      formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
    }
  }, [state]);

  return (
    <form action={formAction} className="grid gap-5" noValidate ref={formRef}>
      <FieldLabel className="grid gap-2 text-start">
        <span>{passwordLabel}</span>
        <Input
          aria-describedby="recovery-reset-status"
          aria-invalid={passwordInvalid}
          autoComplete="new-password"
          className="min-h-12"
          name="password"
          type="password"
        />
      </FieldLabel>

      <FieldLabel className="grid gap-2 text-start">
        <span>{passwordConfirmationLabel}</span>
        <Input
          aria-describedby="recovery-reset-status"
          aria-invalid={passwordInvalid}
          autoComplete="new-password"
          className="min-h-12"
          name="passwordConfirmation"
          type="password"
        />
      </FieldLabel>

      <Button
        disabled={isPending}
        pending={isPending}
        size="lg"
        type="submit"
      >
        {isPending ? pendingLabel : submitLabel}
      </Button>

      <div id="recovery-reset-status" tabIndex={-1}>
        <AuthStatusNote tone={state.status === "error" ? "error" : "info"}>
          {statusMessage}
        </AuthStatusNote>
      </div>
    </form>
  );
}
