"use client";

import Link from "next/link";
import { buttonStyles } from "@/components/ui/button";
import { usePathname, useSearchParams } from "next/navigation";
import { localeNavigationQuery } from "@/lib/i18n/locale-query";
import { locales, type Locale } from "@/lib/i18n/routing";

const languageNames: Record<Locale, string> = {
  en: "English",
  he: "עברית",
};

export const localePreferenceCookie = "nutrition_tracker_locale";

function localizedPath(pathname: string, locale: Locale) {
  const segments = pathname.split("/");

  if (segments.length > 1 && locales.includes(segments[1] as Locale)) {
    segments[1] = locale;
    return segments.join("/") || `/${locale}`;
  }

  return `/${locale}`;
}

type LanguageSwitcherProps = {
  currentLocale: Locale;
  label: string;
  currentLabel: string;
};

export function LanguageSwitcher(props: LanguageSwitcherProps) {
  const pathname = usePathname();

  if (locales.some((locale) => pathname === `/${locale}` || pathname === `/${locale}/auth/account-closed`)) {
    return <LanguageLinks {...props} pathname={pathname} search="" />;
  }

  return <ContextualLanguageSwitcher {...props} pathname={pathname} />;
}

function ContextualLanguageSwitcher(props: LanguageSwitcherProps & { pathname: string }) {
  const searchParams = useSearchParams();
  const search = localeNavigationQuery(props.pathname, searchParams);

  return <LanguageLinks {...props} search={search} />;
}

function LanguageLinks({
  currentLocale,
  label,
  currentLabel,
  pathname,
  search,
}: LanguageSwitcherProps & { pathname: string; search: string }) {
  return (
    <nav aria-label={label} className="flex flex-wrap gap-2">
      {locales.map((locale) => {
        const isCurrent = locale === currentLocale;

        return (
          <Link
            aria-current={isCurrent ? "page" : undefined}
            className={buttonStyles({
              variant: "ghost",
              size: "sm",
              className: isCurrent ? "ui-current" : undefined,
            })}
            dir={locale === "he" ? "rtl" : "ltr"}
            href={`${localizedPath(pathname, locale)}${search ? `?${search}` : ""}`}
            hrefLang={locale}
            key={locale}
            lang={locale}
            onClick={() => {
              document.cookie = `${localePreferenceCookie}=${locale}; Path=/; Max-Age=31536000; SameSite=Lax`;
            }}
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
