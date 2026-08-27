import Link from "next/link";
import { LanguageSwitcher } from "@/components/language-switcher/language-switcher";
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
          href={`/${locale}`}
        >
          {homeLabel}
        </Link>

        <div className="border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <h1 className="text-start text-3xl font-semibold text-slate-950">
            {title}
          </h1>
          <p className="mt-4 text-start text-base leading-7 text-slate-700">
            {description}
          </p>
          <p className="mt-4 text-start text-base leading-7 text-slate-700">
            {invitationInstruction}
          </p>
          <p className="mt-6 text-start text-sm text-slate-700">
            {activatedText}{" "}
            <Link
              className="font-medium text-teal-700 hover:text-teal-900"
              href={`/${locale}/auth/sign-in`}
            >
              {activatedLinkLabel}
            </Link>
          </p>
        </div>
      </section>
    </main>
  );
}
