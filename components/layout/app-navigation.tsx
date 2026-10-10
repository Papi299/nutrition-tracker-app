"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, type ReactNode } from "react";
import { buttonStyles } from "@/components/ui/button";
import { NavigationIcon } from "@/components/layout/navigation-icons";
import type { Locale } from "@/lib/i18n/routing";
import {
  activePrimaryNavigation,
  navigationGroups,
  primaryNavigationItems,
  type NavigationCopy,
  type PrimaryNavigationId,
  type PrimaryNavigationLabels,
} from "@/components/layout/primary-navigation";

type NavigationItem = (typeof primaryNavigationItems)[number];

function NavigationLink({
  item,
  label,
  locale,
  activeId,
  mobile = false,
  onNavigate,
}: {
  item: NavigationItem;
  label: string;
  locale: Locale;
  activeId: PrimaryNavigationId | null;
  mobile?: boolean;
  onNavigate?: () => void;
}) {
  const active = item.id === activeId;
  return (
    <Link
      aria-current={active ? "page" : undefined}
      className={buttonStyles({
        variant: "ghost",
        size: "sm",
        className: `${mobile ? "ui-bottom-tab" : "ui-navigation-row"}${active ? " ui-current" : ""}`,
      })}
      href={`/${locale}${item.path}`}
      onClick={onNavigate}
    >
      <NavigationIcon id={item.id} />
      <span>{label}</span>
    </Link>
  );
}

export function AppNavigation({
  labels,
  locale,
  copy,
  mobile = false,
  secondaryActions,
}: {
  labels: PrimaryNavigationLabels;
  locale: Locale;
  copy: NavigationCopy;
  mobile?: boolean;
  secondaryActions?: ReactNode;
}) {
  const pathname = usePathname();
  const activeId = activePrimaryNavigation(pathname, locale);
  const moreRef = useRef<HTMLDetailsElement>(null);
  const summaryRef = useRef<HTMLElement>(null);
  const moreActive = primaryNavigationItems.some(
    (item) => item.id === activeId && item.mobileRole === "more",
  );

  useEffect(() => {
    // Browser back/forward and links outside More also dismiss the enhanced surface.
    if (moreRef.current) moreRef.current.open = false;
  }, [pathname]);

  if (!mobile) {
    return (
      <nav aria-label={copy.primaryLabel} className="desktop-navigation">
        {navigationGroups.map((group) => (
          <div className="navigation-group" key={group}>
            {group !== "primary" ? <p className="navigation-group-label">{copy[group]}</p> : null}
            {primaryNavigationItems.filter((item) => item.group === group).map((item) => (
              <NavigationLink activeId={activeId} item={item} key={item.id} label={labels[item.id]} locale={locale} />
            ))}
          </div>
        ))}
      </nav>
    );
  }

  return (
    <nav aria-label={copy.mobilePrimaryLabel} className="mobile-bottom-navigation" data-testid="mobile-bottom-navigation">
      {primaryNavigationItems.filter((item) => item.mobileRole === "primary").map((item) => (
        <NavigationLink
          activeId={activeId}
          item={item}
          key={item.id}
          label={item.id === "foodSearch" ? copy.search : item.id === "barcodeLookup" ? copy.scan : labels[item.id]}
          locale={locale}
          mobile
        />
      ))}
      <details
        className="mobile-more-navigation"
        data-testid="mobile-more-navigation"
        onKeyDown={(event) => {
          if (event.key === "Escape" && moreRef.current?.open) {
            moreRef.current.open = false;
            summaryRef.current?.focus();
            event.preventDefault();
          }
        }}
        ref={moreRef}
      >
        <summary
          className={buttonStyles({ variant: "ghost", size: "sm", className: `ui-bottom-tab${moreActive ? " ui-current" : ""}` })}
          data-active={moreActive}
          ref={summaryRef}
        >
          <NavigationIcon id="more" />
          <span>{copy.more}</span>
          {moreActive && activeId ? <span className="sr-only">{copy.currentSection}: {labels[activeId]}</span> : null}
        </summary>
        <div className="mobile-more-panel">
          <p className="ui-card-title">{copy.more}</p>
          <nav aria-label={copy.secondaryLabel} className="mobile-secondary-navigation">
            {primaryNavigationItems.filter((item) => item.mobileRole === "more").map((item) => (
              <NavigationLink
                activeId={activeId}
                item={item}
                key={item.id}
                label={labels[item.id]}
                locale={locale}
                onNavigate={() => { if (moreRef.current) moreRef.current.open = false; }}
              />
            ))}
          </nav>
          {secondaryActions}
        </div>
      </details>
    </nav>
  );
}
