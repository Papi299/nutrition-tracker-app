"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Locale } from "@/lib/i18n/routing";
import {
  activePrimaryNavigation,
  primaryNavigationItems,
  type PrimaryNavigationLabels,
} from "@/components/layout/primary-navigation";

export function AppNavigation({
  labels,
  locale,
}: {
  labels: PrimaryNavigationLabels;
  locale: Locale;
}) {
  const activeId = activePrimaryNavigation(usePathname(), locale);

  return primaryNavigationItems.map((item) => {
    const isActive = item.id === activeId;

    return (
      <Link
        aria-current={isActive ? "page" : undefined}
        className={[
          "min-h-10 px-4 py-2 text-sm font-semibold transition-colors",
          isActive
            ? "bg-teal-700 text-white hover:bg-teal-800"
            : "border border-slate-300 bg-white text-slate-800 hover:border-teal-700 hover:text-teal-800",
        ].join(" ")}
        href={`/${locale}${item.path}`}
        key={item.id}
      >
        {labels[item.id]}
      </Link>
    );
  });
}
