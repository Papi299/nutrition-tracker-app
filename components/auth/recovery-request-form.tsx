"use client";

import { useActionState, useEffect, useRef } from "react";
import {
  initialRecoveryRequestActionState,
  type RecoveryRequestActionState,
} from "@/app/[locale]/auth/recover/action-state";
import { AuthStatusNote } from "@/components/auth/auth-status-note";

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
      <label className="grid gap-2 text-start text-sm font-medium text-slate-900">
        <span>{emailLabel}</span>
        <input
          aria-describedby="recovery-request-status"
          aria-invalid={emailInvalid}
          autoComplete="email"
          className="min-h-12 border border-slate-300 bg-white px-3 text-base text-slate-950 outline-none transition-colors placeholder:text-slate-400 focus:border-teal-700"
          maxLength={254}
          name="email"
          placeholder={emailPlaceholder}
          type="email"
        />
      </label>

      <button
        className="min-h-12 bg-teal-700 px-4 text-base font-semibold text-white transition-colors hover:bg-teal-800 disabled:cursor-wait disabled:bg-slate-300 disabled:text-slate-600"
        disabled={isPending}
        type="submit"
      >
        {isPending ? pendingLabel : submitLabel}
      </button>

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
