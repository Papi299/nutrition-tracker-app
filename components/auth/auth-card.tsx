import Link from "next/link";
import type {
  AuthActionCode,
  AuthActionState,
} from "@/app/[locale]/auth/action-state";
import { AuthFormShell } from "@/components/auth/auth-form-shell";
import { AuthStatusNote } from "@/components/auth/auth-status-note";
import { LanguageSwitcher } from "@/components/language-switcher/language-switcher";
import { buttonStyles } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
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
    <main className="min-h-screen bg-background px-6 py-8 text-foreground sm:px-10 sm:py-12">
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
          className={buttonStyles({
            variant: "ghost",
            size: "sm",
            className: "w-fit text-start",
          })}
          href={homeHref}
        >
          {homeLabel}
        </Link>

        <Card variant="raised" className="p-6 sm:p-8">
          <div className="text-start">
            <h1 className="ui-page-title text-3xl">{title}</h1>
            <p className="mt-3 text-base leading-7 text-muted-foreground">
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
              className="ui-text-link"
              href={recoveryHref}
            >
              {recoveryLabel}
            </Link>
          </p>

          <p className="mt-6 text-start text-sm leading-6 text-muted-foreground">
            {alternateText}{" "}
            <Link
              className="ui-text-link"
              href={alternateHref}
            >
              {alternateLabel}
            </Link>
          </p>
        </Card>
      </section>
    </main>
  );
}
