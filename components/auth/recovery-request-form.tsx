"use client";

import { useActionState, useEffect, useRef } from "react";
import {
  initialRecoveryRequestActionState,
  type RecoveryRequestActionState,
} from "@/app/[locale]/auth/recover/action-state";
import { AuthStatusNote } from "@/components/auth/auth-status-note";
import { Button } from "@/components/ui/button";
import { FieldLabel, Input } from "@/components/ui/form-controls";

export function RecoveryRequestForm({
  action,
  emailLabel,
  emailPlaceholder,
  invalidEmailMessage,
  pendingLabel,
  statusIdle,
  statusSuccess,
  submitLabel,
}: {
  action: (
    state: RecoveryRequestActionState,
    formData: FormData,
  ) => Promise<RecoveryRequestActionState>;
  emailLabel: string;
  emailPlaceholder: string;
  invalidEmailMessage: string;
  pendingLabel: string;
  statusIdle: string;
  statusSuccess: string;
  submitLabel: string;
}) {
  const [state, formAction, isPending] = useActionState(
    action,
    initialRecoveryRequestActionState,
  );
  const formRef = useRef<HTMLFormElement>(null);
  const emailInvalid = state.status === "error";
  const statusMessage =
    state.status === "success"
      ? statusSuccess
      : state.status === "error"
        ? invalidEmailMessage
        : statusIdle;

  useEffect(() => {
    if (state.status === "error") {
      formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
    }
  }, [state]);

  return (
    <form action={formAction} className="grid gap-5" noValidate ref={formRef}>
      <FieldLabel className="grid gap-2 text-start">
        <span>{emailLabel}</span>
        <Input
          aria-describedby="recovery-request-status"
          aria-invalid={emailInvalid}
          autoComplete="email"
          className="min-h-12"
          maxLength={254}
          name="email"
          placeholder={emailPlaceholder}
          type="email"
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

      <div id="recovery-request-status" tabIndex={-1}>
        <AuthStatusNote
          tone={
            state.status === "error"
              ? "error"
              : state.status === "success"
                ? "success"
                : "info"
          }
        >
          {statusMessage}
        </AuthStatusNote>
      </div>
    </form>
  );
}
