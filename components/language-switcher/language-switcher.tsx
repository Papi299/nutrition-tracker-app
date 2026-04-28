import Link from "next/link";
import { locales, type Locale } from "@/lib/i18n/routing";

const languageNames: Record<Locale, string> = {
  en: "English",
  he: "עברית",
};

export function LanguageSwitcher({
  currentLocale,
  label,
  currentLabel,
}: {
  currentLocale: Locale;
  label: string;
  currentLabel: string;
}) {
  return (
    <nav aria-label={label} className="flex flex-wrap gap-2">
      {locales.map((locale) => {
        const isCurrent = locale === currentLocale;

        return (
          <Link
            aria-current={isCurrent ? "page" : undefined}
            className={[
              "min-h-10 rounded-full border px-4 py-2 text-sm font-medium transition-colors",
              isCurrent
                ? "border-teal-700 bg-teal-700 text-white"
                : "border-slate-300 bg-white text-slate-800 hover:border-teal-700",
            ].join(" ")}
            dir={locale === "he" ? "rtl" : "ltr"}
            href={`/${locale}`}
            hrefLang={locale}
            key={locale}
            lang={locale}
          >
            <span>{languageNames[locale]}</span>
            {isCurrent ? (
              <span className="sr-only"> {currentLabel}</span>
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}
