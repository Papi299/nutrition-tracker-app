"use client";

import Link from "next/link";
import { buttonStyles } from "@/components/ui/button";
import { usePathname } from "next/navigation";
import { useSyncExternalStore } from "react";
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

function subscribeToLocation(callback: () => void) {
  window.addEventListener("popstate", callback);
  return () => window.removeEventListener("popstate", callback);
}

export function LanguageSwitcher({
  currentLocale,
  label,
  currentLabel,
}: {
  currentLocale: Locale;
  label: string;
  currentLabel: string;
}) {
  const pathname = usePathname();
  const search = useSyncExternalStore(
    subscribeToLocation,
    () => window.location.search,
    () => "",
  );

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
            href={`${localizedPath(pathname, locale)}${search}`}
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
