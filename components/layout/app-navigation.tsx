"use client";

import Link from "next/link";
import { buttonStyles } from "@/components/ui/button";
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
        className={buttonStyles({
          variant: "ghost",
          size: "sm",
          className: isActive ? "ui-current" : undefined,
        })}
        href={`/${locale}${item.path}`}
        key={item.id}
      >
        {labels[item.id]}
      </Link>
    );
  });
}
