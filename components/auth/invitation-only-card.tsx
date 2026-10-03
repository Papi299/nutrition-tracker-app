import Link from "next/link";
import { LanguageSwitcher } from "@/components/language-switcher/language-switcher";
import { buttonStyles } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { Locale } from "@/lib/i18n/routing";

export function InvitationOnlyCard({
  activatedText,
  activatedLinkLabel,
  currentLanguageLabel,
  description,
  homeLabel,
  invitationInstruction,
  languageLabel,
  locale,
  skipContent,
  title,
}: {
  activatedText: string;
  activatedLinkLabel: string;
  currentLanguageLabel: string;
  description: string;
  homeLabel: string;
  invitationInstruction: string;
  languageLabel: string;
  locale: Locale;
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
          href={`/${locale}`}
        >
          {homeLabel}
        </Link>

        <Card variant="raised" className="p-6 sm:p-8">
          <h1 className="ui-page-title text-start text-3xl">
            {title}
          </h1>
          <p className="mt-4 text-start text-base leading-7 text-muted-foreground">
            {description}
          </p>
          <p className="mt-4 text-start text-base leading-7 text-muted-foreground">
            {invitationInstruction}
          </p>
          <p className="mt-6 text-start text-sm leading-6 text-muted-foreground">
            {activatedText}{" "}
            <Link
              className="ui-text-link"
              href={`/${locale}/auth/sign-in`}
            >
              {activatedLinkLabel}
            </Link>
          </p>
        </Card>
      </section>
    </main>
  );
}
