"use client";

import { useActionState } from "react";
import type {
  AuthActionCode,
  AuthActionState,
} from "@/app/[locale]/auth/action-state";
import { initialAuthActionState } from "@/app/[locale]/auth/action-state";
import { AuthStatusNote } from "@/components/auth/auth-status-note";

export function AuthFormShell({
  action,
  emailLabel,
  emailPlaceholder,
  errorMessages,
  passwordLabel,
  passwordPlaceholder,
  pendingLabel,
  statusIdle,
  successMessages,
  submitLabel,
  autoComplete = "current-password",
}: {
  action: (
    state: AuthActionState,
    formData: FormData,
  ) => Promise<AuthActionState>;
  emailLabel: string;
  emailPlaceholder: string;
  errorMessages: Record<Exclude<AuthActionCode, "checkEmail">, string>;
  passwordLabel: string;
  passwordPlaceholder: string;
  pendingLabel: string;
  statusIdle: string;
  successMessages: Record<Extract<AuthActionCode, "checkEmail">, string>;
  submitLabel: string;
  autoComplete?: "current-password" | "new-password";
}) {
  const [state, formAction, isPending] = useActionState(
    action,
    initialAuthActionState,
  );
  const statusTone =
    state.status === "idle"
      ? "info"
      : state.status === "error"
        ? "error"
        : "success";
  const statusMessage =
    state.status === "error" && state.code
      ? errorMessages[state.code as Exclude<AuthActionCode, "checkEmail">]
      : state.status === "success" && state.code
        ? successMessages[state.code as Extract<AuthActionCode, "checkEmail">]
        : statusIdle;

  return (
    <form action={formAction} className="grid gap-5" noValidate>
      <label className="grid gap-2 text-start text-sm font-medium text-slate-900">
        <span>{emailLabel}</span>
        <input
          autoComplete="email"
          className="min-h-12 border border-slate-300 bg-white px-3 text-base text-slate-950 outline-none transition-colors placeholder:text-slate-400 focus:border-teal-700"
          name="email"
          placeholder={emailPlaceholder}
          type="email"
        />
      </label>

      <label className="grid gap-2 text-start text-sm font-medium text-slate-900">
        <span>{passwordLabel}</span>
        <input
          autoComplete={autoComplete}
          className="min-h-12 border border-slate-300 bg-white px-3 text-base text-slate-950 outline-none transition-colors placeholder:text-slate-400 focus:border-teal-700"
          name="password"
          placeholder={passwordPlaceholder}
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

      <AuthStatusNote tone={statusTone}>{statusMessage}</AuthStatusNote>
    </form>
  );
}
