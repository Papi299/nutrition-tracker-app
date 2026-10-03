"use client";

import { useActionState } from "react";
import {
  initialActivationActionState,
  type ActivationActionCode,
  type ActivationActionState,
} from "@/app/[locale]/auth/activate/action-state";
import { AuthStatusNote } from "@/components/auth/auth-status-note";
import { Button } from "@/components/ui/button";
import { FieldLabel, Input } from "@/components/ui/form-controls";

export function ActivationForm({
  action,
  ageLabel,
  errorMessages,
  israelLabel,
  passwordConfirmationLabel,
  passwordLabel,
  pendingLabel,
  statusIdle,
  submitLabel,
}: {
  action: (
    state: ActivationActionState,
    formData: FormData,
  ) => Promise<ActivationActionState>;
  ageLabel: string;
  errorMessages: Record<ActivationActionCode, string>;
  israelLabel: string;
  passwordConfirmationLabel: string;
  passwordLabel: string;
  pendingLabel: string;
  statusIdle: string;
  submitLabel: string;
}) {
  const [state, formAction, isPending] = useActionState(
    action,
    initialActivationActionState,
  );
  const statusMessage =
    state.status === "error" && state.code
      ? errorMessages[state.code]
      : statusIdle;
  const passwordInvalid =
    state.status === "error" &&
    ["passwordMismatch", "passwordRequired", "passwordTooShort"].includes(
      state.code ?? "",
    );

  return (
    <form action={formAction} className="grid gap-5" noValidate>
      <FieldLabel className="grid gap-2 text-start">
        <span>{passwordLabel}</span>
        <Input
          aria-describedby="activation-form-status"
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
          aria-describedby="activation-form-status"
          aria-invalid={passwordInvalid}
          autoComplete="new-password"
          className="min-h-12"
          name="passwordConfirmation"
          type="password"
        />
      </FieldLabel>

      <label className="flex min-h-12 items-start gap-3 text-start text-sm leading-6 text-foreground">
        <input
          aria-describedby="activation-form-status"
          className="mt-1 size-5 shrink-0 accent-primary"
          name="age18Attested"
          type="checkbox"
        />
        <span>{ageLabel}</span>
      </label>

      <label className="flex min-h-12 items-start gap-3 text-start text-sm leading-6 text-foreground">
        <input
          aria-describedby="activation-form-status"
          className="mt-1 size-5 shrink-0 accent-primary"
          name="israelAttested"
          type="checkbox"
        />
        <span>{israelLabel}</span>
      </label>

      <Button
        disabled={isPending}
        pending={isPending}
        size="lg"
        type="submit"
      >
        {isPending ? pendingLabel : submitLabel}
      </Button>

      <div id="activation-form-status" tabIndex={-1}>
        <AuthStatusNote tone={state.status === "error" ? "error" : "info"}>
          {statusMessage}
        </AuthStatusNote>
      </div>
    </form>
  );
}
