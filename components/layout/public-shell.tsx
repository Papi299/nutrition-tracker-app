import { LanguageSwitcher } from "@/components/language-switcher/language-switcher";
import type { Locale } from "@/lib/i18n/routing";

export function PublicShell({
  locale,
  appName,
  navHome,
  languageLabel,
  currentLanguageLabel,
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
  languageLabel: string;
  currentLanguageLabel: string;
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
    <main className="min-h-screen bg-stone-50 text-slate-950">
      <section className="mx-auto flex min-h-screen w-full max-w-5xl flex-col gap-12 px-6 py-8 sm:px-10 sm:py-12">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-start">
            <p className="text-lg font-semibold text-slate-950">{appName}</p>
            <a
              className="text-sm font-medium text-teal-700 hover:text-teal-900"
              href={`/${locale}`}
            >
              {navHome}
            </a>
          </div>
          <LanguageSwitcher
            currentLabel={currentLanguageLabel}
            currentLocale={locale}
            label={languageLabel}
          />
        </header>

        <div className="flex flex-1 flex-col justify-center gap-12">
          <div className="max-w-3xl text-start">
            <p className="text-sm font-semibold uppercase tracking-[0.16em] text-teal-700">
              {foundationLabel}
            </p>
            <h1 className="mt-5 text-4xl font-semibold leading-tight sm:text-6xl">
              {title}
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-700">
              {description}
            </p>
          </div>

          <section aria-labelledby="future-pillars">
            <h2
              className="mb-4 text-start text-base font-semibold text-slate-900"
              id="future-pillars"
            >
              {pillarsTitle}
            </h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
              {pillars.map((pillar) => (
                <div
                  className="border border-slate-200 bg-white p-4 text-start shadow-sm"
                  key={pillar}
                >
                  <p className="text-sm font-medium text-slate-900">
                    {pillar}
                  </p>
                </div>
              ))}
            </div>
          </section>

          <div className="flex flex-col gap-3 border-s-4 border-teal-600 ps-5 text-start text-sm leading-6 text-slate-700 sm:max-w-2xl">
            <p className="font-medium text-slate-900">{statusTitle}</p>
            <p>{statusBody}</p>
            <p>
              <span className="font-medium text-slate-900">
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
