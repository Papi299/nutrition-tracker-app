"use client";

import { useActionState, useEffect, useRef } from "react";
import type {
  AuthActionCode,
  AuthActionState,
} from "@/app/[locale]/auth/action-state";
import { initialAuthActionState } from "@/app/[locale]/auth/action-state";
import { AuthStatusNote } from "@/components/auth/auth-status-note";
import { Button } from "@/components/ui/button";
import { FieldLabel, Input } from "@/components/ui/form-controls";

export function AuthFormShell({
  action,
  emailLabel,
  emailPlaceholder,
  errorMessages,
  passwordLabel,
  passwordPlaceholder,
  pendingLabel,
  statusIdle,
  submitLabel,
  autoComplete = "current-password",
}: {
  action: (
    state: AuthActionState,
    formData: FormData,
  ) => Promise<AuthActionState>;
  emailLabel: string;
  emailPlaceholder: string;
  errorMessages: Record<AuthActionCode, string>;
  passwordLabel: string;
  passwordPlaceholder: string;
  pendingLabel: string;
  statusIdle: string;
  submitLabel: string;
  autoComplete?: "current-password" | "new-password";
}) {
  const [state, formAction, isPending] = useActionState(
    action,
    initialAuthActionState,
  );
  const formRef = useRef<HTMLFormElement>(null);
  const statusTone =
    state.status === "idle" ? "info" : "error";
  const statusMessage =
    state.status === "error" && state.code
      ? errorMessages[state.code]
      : statusIdle;
  const emailInvalid = state.status === "error" && state.code === "invalidEmail";
  const passwordInvalid =
    state.status === "error" &&
    (state.code === "passwordRequired" || state.code === "passwordTooShort");

  useEffect(() => {
    if (state.status !== "error") return;

    const target = formRef.current?.querySelector<HTMLElement>(
      '[aria-invalid="true"], [role="alert"]',
    );
    target?.focus();
  }, [state]);

  return (
    <form action={formAction} className="grid gap-5" noValidate ref={formRef}>
      <FieldLabel className="grid gap-2 text-start">
        <span>{emailLabel}</span>
        <Input
          aria-describedby="auth-form-status"
          aria-invalid={emailInvalid}
          autoComplete="email"
          className="min-h-12"
          name="email"
          placeholder={emailPlaceholder}
          type="email"
        />
      </FieldLabel>

      <FieldLabel className="grid gap-2 text-start">
        <span>{passwordLabel}</span>
        <Input
          aria-describedby="auth-form-status"
          aria-invalid={passwordInvalid}
          autoComplete={autoComplete}
          className="min-h-12"
          name="password"
          placeholder={passwordPlaceholder}
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

      <div id="auth-form-status" tabIndex={-1}>
        <AuthStatusNote tone={statusTone}>{statusMessage}</AuthStatusNote>
      </div>
    </form>
  );
}
