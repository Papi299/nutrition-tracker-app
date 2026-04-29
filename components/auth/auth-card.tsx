import Link from "next/link";
import type {
  AuthActionCode,
  AuthActionState,
} from "@/app/[locale]/auth/action-state";
import { AuthFormShell } from "@/components/auth/auth-form-shell";

export function AuthCard({
  action,
  alternateHref,
  alternateLabel,
  alternateText,
  autoComplete,
  description,
  emailLabel,
  emailPlaceholder,
  errorMessages,
  homeHref,
  homeLabel,
  passwordLabel,
  passwordPlaceholder,
  pendingLabel,
  statusIdle,
  successMessages,
  submitLabel,
  title,
}: {
  action: (
    state: AuthActionState,
    formData: FormData,
  ) => Promise<AuthActionState>;
  alternateHref: string;
  alternateLabel: string;
  alternateText: string;
  autoComplete?: "current-password" | "new-password";
  description: string;
  emailLabel: string;
  emailPlaceholder: string;
  errorMessages: Record<Exclude<AuthActionCode, "checkEmail">, string>;
  homeHref: string;
  homeLabel: string;
  passwordLabel: string;
  passwordPlaceholder: string;
  pendingLabel: string;
  statusIdle: string;
  successMessages: Record<Extract<AuthActionCode, "checkEmail">, string>;
  submitLabel: string;
  title: string;
}) {
  return (
    <main className="min-h-screen bg-stone-50 px-6 py-8 text-slate-950 sm:px-10 sm:py-12">
      <section className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-md flex-col justify-center gap-8">
        <Link
          className="w-fit text-start text-sm font-medium text-teal-700 hover:text-teal-900"
          href={homeHref}
        >
          {homeLabel}
        </Link>

        <div className="border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <div className="text-start">
            <h1 className="text-3xl font-semibold text-slate-950">{title}</h1>
            <p className="mt-3 text-base leading-7 text-slate-700">
              {description}
            </p>
          </div>

          <div className="mt-8">
            <AuthFormShell
              action={action}
              autoComplete={autoComplete}
              emailLabel={emailLabel}
              emailPlaceholder={emailPlaceholder}
              errorMessages={errorMessages}
              passwordLabel={passwordLabel}
              passwordPlaceholder={passwordPlaceholder}
              pendingLabel={pendingLabel}
              statusIdle={statusIdle}
              successMessages={successMessages}
              submitLabel={submitLabel}
            />
          </div>

          <p className="mt-6 text-start text-sm text-slate-700">
            {alternateText}{" "}
            <Link
              className="font-medium text-teal-700 hover:text-teal-900"
              href={alternateHref}
            >
              {alternateLabel}
            </Link>
          </p>
        </div>
      </section>
    </main>
  );
}
