"use client";

import { useActionState, useEffect, useRef } from "react";
import {
  initialReauthenticationActionState,
  type ReauthenticationActionCode,
  type ReauthenticationActionState,
} from "@/app/[locale]/auth/reauthenticate/action-state";
import { AuthStatusNote } from "@/components/auth/auth-status-note";
import { Button } from "@/components/ui/button";
import { FieldLabel, Input } from "@/components/ui/form-controls";

export function ReauthenticationForm({
  action,
  errorMessages,
  passwordLabel,
  pendingLabel,
  statusIdle,
  submitLabel,
}: {
  action: (
    state: ReauthenticationActionState,
    formData: FormData,
  ) => Promise<ReauthenticationActionState>;
  errorMessages: Record<ReauthenticationActionCode, string>;
  passwordLabel: string;
  pendingLabel: string;
  statusIdle: string;
  submitLabel: string;
}) {
  const [state, formAction, isPending] = useActionState(
    action,
    initialReauthenticationActionState,
  );
  const formRef = useRef<HTMLFormElement>(null);
  const passwordInvalid = state.status === "error";
  const statusMessage =
    state.status === "error" && state.code
      ? errorMessages[state.code]
      : statusIdle;

  useEffect(() => {
    if (state.status === "error") {
      formRef.current
        ?.querySelector<HTMLElement>('[aria-invalid="true"]')
        ?.focus();
    }
  }, [state]);

  return (
    <form action={formAction} className="grid gap-5" noValidate ref={formRef}>
      <FieldLabel className="grid gap-2 text-start">
        <span>{passwordLabel}</span>
        <Input
          aria-describedby="reauthentication-status"
          aria-invalid={passwordInvalid}
          autoComplete="current-password"
          className="min-h-12"
          name="password"
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

      <div id="reauthentication-status" tabIndex={-1}>
        <AuthStatusNote tone={state.status === "error" ? "error" : "info"}>
          {statusMessage}
        </AuthStatusNote>
      </div>
    </form>
  );
}
