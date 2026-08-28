import Link from "next/link";
import type {
  AuthActionCode,
  AuthActionState,
} from "@/app/[locale]/auth/action-state";
import { AuthFormShell } from "@/components/auth/auth-form-shell";
import { AuthStatusNote } from "@/components/auth/auth-status-note";
import { LanguageSwitcher } from "@/components/language-switcher/language-switcher";
import type { Locale } from "@/lib/i18n/routing";

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
  locale,
  languageLabel,
  currentLanguageLabel,
  passwordLabel,
  passwordPlaceholder,
  pendingLabel,
  recoveryHref,
  recoveryLabel,
  successNotice,
  statusIdle,
  submitLabel,
  skipContent,
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
  errorMessages: Record<AuthActionCode, string>;
  homeHref: string;
  homeLabel: string;
  locale: Locale;
  languageLabel: string;
  currentLanguageLabel: string;
  passwordLabel: string;
  passwordPlaceholder: string;
  pendingLabel: string;
  recoveryHref: string;
  recoveryLabel: string;
  successNotice?: string;
  statusIdle: string;
  submitLabel: string;
  skipContent: string;
  title: string;
}) {
  return (
    <main className="min-h-screen bg-stone-50 px-6 py-8 text-slate-950 sm:px-10 sm:py-12">
      <a className="skip-link" href="#main-content">
        {skipContent}
      </a>
      <section
        className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-md flex-col justify-center gap-8"
        id="main-content"
        tabIndex={-1}
      >
        <LanguageSwitcher
          currentLabel={currentLanguageLabel}
          currentLocale={locale}
          label={languageLabel}
        />
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
            {successNotice ? (
              <div className="mb-5" id="auth-success-status">
                <AuthStatusNote tone="success">{successNotice}</AuthStatusNote>
              </div>
            ) : null}
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
              submitLabel={submitLabel}
            />
          </div>

          <p className="mt-5 text-start text-sm">
            <Link
              className="font-medium text-teal-700 hover:text-teal-900"
              href={recoveryHref}
            >
              {recoveryLabel}
            </Link>
          </p>

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
