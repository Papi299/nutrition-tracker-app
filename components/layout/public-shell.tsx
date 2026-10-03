import { Card } from "@/components/ui/card";
import { buttonStyles } from "@/components/ui/button";
import { feedbackStyles } from "@/components/ui/feedback";
import { LanguageSwitcher } from "@/components/language-switcher/language-switcher";
import type { Locale } from "@/lib/i18n/routing";

export function PublicShell({
  locale,
  appName,
  navHome,
  navSignIn,
  navSignUp,
  languageLabel,
  currentLanguageLabel,
  skipContent,
  foundationLabel,
  title,
  description,
  pillarsTitle,
  pillars,
  statusTitle,
  statusBody,
  mixedSampleLabel,
  mixedSampleText,
}: {
  locale: Locale;
  appName: string;
  navHome: string;
  navSignIn: string;
  navSignUp: string;
  languageLabel: string;
  currentLanguageLabel: string;
  skipContent: string;
  foundationLabel: string;
  title: string;
  description: string;
  pillarsTitle: string;
  pillars: string[];
  statusTitle: string;
  statusBody: string;
  mixedSampleLabel: string;
  mixedSampleText: string;
}) {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <a className="skip-link" href="#main-content">
        {skipContent}
      </a>
      <section className="mx-auto flex min-h-screen w-full max-w-5xl flex-col gap-12 px-4 py-6 sm:px-8 sm:py-10">
        <header className="flex flex-col gap-4 rounded-xl border border-border bg-surface p-5 shadow-xs sm:flex-row sm:items-center sm:justify-between">
          <div className="text-start">
            <p className="ui-card-title">{appName}</p>
            <nav className="flex flex-wrap gap-3 text-sm font-medium">
              <a className={buttonStyles({ variant: "ghost", size: "sm" })} href={`/${locale}`}>
                {navHome}
              </a>
              <a
                className={buttonStyles({ variant: "ghost", size: "sm" })}
                href={`/${locale}/auth/sign-in`}
              >
                {navSignIn}
              </a>
              <a
                className={buttonStyles({ variant: "ghost", size: "sm" })}
                href={`/${locale}/auth/sign-up`}
              >
                {navSignUp}
              </a>
            </nav>
          </div>
          <LanguageSwitcher
            currentLabel={currentLanguageLabel}
            currentLocale={locale}
            label={languageLabel}
          />
        </header>

        <div
          className="flex flex-1 flex-col justify-center gap-12"
          id="main-content"
          tabIndex={-1}
        >
          <div className="max-w-3xl text-start">
            <p className="ui-eyebrow">
              {foundationLabel}
            </p>
            <h1 className="mt-5 ui-page-title">
              {title}
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-muted-foreground">
              {description}
            </p>
          </div>

          <section aria-labelledby="future-pillars">
            <h2
              className="mb-4 text-start text-base font-semibold text-foreground"
              id="future-pillars"
            >
              {pillarsTitle}
            </h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
              {pillars.map((pillar) => (
                <Card className="p-4 text-start" key={pillar}>
                  <p className="text-sm font-medium text-foreground">
                    {pillar}
                  </p>
                </Card>
              ))}
            </div>
          </section>

          <div className={feedbackStyles("info", "flex flex-col gap-3 sm:max-w-2xl")}>
            <p className="font-medium text-foreground">{statusTitle}</p>
            <p>{statusBody}</p>
            <p>
              <span className="font-medium text-foreground">
                {mixedSampleLabel}
              </span>{" "}
              <span dir="auto">{mixedSampleText}</span>
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}
