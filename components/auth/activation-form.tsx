"use client";

import { useActionState } from "react";
import {
  initialActivationActionState,
  type ActivationActionCode,
  type ActivationActionState,
} from "@/app/[locale]/auth/activate/action-state";
import { AuthStatusNote } from "@/components/auth/auth-status-note";

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
      <label className="grid gap-2 text-start text-sm font-medium text-slate-900">
        <span>{passwordLabel}</span>
        <input
          aria-describedby="activation-form-status"
          aria-invalid={passwordInvalid}
          autoComplete="new-password"
          className="min-h-12 border border-slate-300 bg-white px-3 text-base text-slate-950 outline-none transition-colors focus:border-teal-700"
          name="password"
          type="password"
        />
      </label>

      <label className="grid gap-2 text-start text-sm font-medium text-slate-900">
        <span>{passwordConfirmationLabel}</span>
        <input
          aria-describedby="activation-form-status"
          aria-invalid={passwordInvalid}
          autoComplete="new-password"
          className="min-h-12 border border-slate-300 bg-white px-3 text-base text-slate-950 outline-none transition-colors focus:border-teal-700"
          name="passwordConfirmation"
          type="password"
        />
      </label>

      <label className="flex min-h-12 items-start gap-3 text-start text-sm leading-6 text-slate-900">
        <input
          aria-describedby="activation-form-status"
          className="mt-1 size-5 shrink-0 accent-teal-700"
          name="age18Attested"
          type="checkbox"
        />
        <span>{ageLabel}</span>
      </label>

      <label className="flex min-h-12 items-start gap-3 text-start text-sm leading-6 text-slate-900">
        <input
          aria-describedby="activation-form-status"
          className="mt-1 size-5 shrink-0 accent-teal-700"
          name="israelAttested"
          type="checkbox"
        />
        <span>{israelLabel}</span>
      </label>

      <button
        className="min-h-12 bg-teal-700 px-4 text-base font-semibold text-white transition-colors hover:bg-teal-800 disabled:cursor-wait disabled:bg-slate-300 disabled:text-slate-600"
        disabled={isPending}
        type="submit"
      >
        {isPending ? pendingLabel : submitLabel}
      </button>

      <div id="activation-form-status" tabIndex={-1}>
        <AuthStatusNote tone={state.status === "error" ? "error" : "info"}>
          {statusMessage}
        </AuthStatusNote>
      </div>
    </form>
  );
}
