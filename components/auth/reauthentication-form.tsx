"use client";

import { useActionState, useEffect, useRef } from "react";
import {
  initialReauthenticationActionState,
  type ReauthenticationActionCode,
  type ReauthenticationActionState,
} from "@/app/[locale]/auth/reauthenticate/action-state";
import { AuthStatusNote } from "@/components/auth/auth-status-note";

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
      <label className="grid gap-2 text-start text-sm font-medium text-slate-900">
        <span>{passwordLabel}</span>
        <input
          aria-describedby="reauthentication-status"
          aria-invalid={passwordInvalid}
          autoComplete="current-password"
          className="min-h-12 border border-slate-300 bg-white px-3 text-base text-slate-950 outline-none transition-colors focus:border-teal-700"
          name="password"
          type="password"
        />
      </label>

      <button
        className="min-h-12 bg-teal-700 px-4 text-base font-semibold text-white transition-colors hover:bg-teal-800 disabled:cursor-wait disabled:bg-slate-300 disabled:text-slate-600"
        disabled={isPending}
        type="submit"
      >
        {isPending ? pendingLabel : submitLabel}
      </button>

      <div id="reauthentication-status" tabIndex={-1}>
        <AuthStatusNote tone={state.status === "error" ? "error" : "info"}>
          {statusMessage}
        </AuthStatusNote>
      </div>
    </form>
  );
}
