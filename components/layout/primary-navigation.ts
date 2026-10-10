import type { Locale } from "@/lib/i18n/routing";

export const primaryNavigationItems = [
  { id: "today", path: "/today", includeChildren: false, group: "primary", mobileRole: "primary" },
  { id: "foodSearch", path: "/foods", includeChildren: false, group: "logFood", mobileRole: "primary" },
  { id: "barcodeLookup", path: "/foods/barcode", includeChildren: false, group: "logFood", mobileRole: "primary" },
  { id: "reusableFoods", path: "/foods/reuse", includeChildren: false, group: "library", mobileRole: "more" },
  { id: "myFoods", path: "/foods/custom", includeChildren: true, group: "library", mobileRole: "primary" },
  { id: "savedMeals", path: "/saved-meals", includeChildren: true, group: "library", mobileRole: "more" },
  { id: "recipes", path: "/recipes", includeChildren: true, group: "library", mobileRole: "more" },
  { id: "profileTargets", path: "/setup", includeChildren: false, group: "settings", mobileRole: "more" },
  { id: "account", path: "/account", includeChildren: true, group: "settings", mobileRole: "more" },
] as const;

export const navigationGroups = ["primary", "logFood", "library", "settings"] as const;
export type NavigationCopy = {
  primaryLabel: string;
  mobilePrimaryLabel: string;
  secondaryLabel: string;
  logFood: string;
  library: string;
  settings: string;
  more: string;
  search: string;
  scan: string;
  currentSection: string;
};

export type PrimaryNavigationId = (typeof primaryNavigationItems)[number]["id"];
export type PrimaryNavigationLabels = Record<PrimaryNavigationId, string>;

export function activePrimaryNavigation(
  pathname: string | null,
  locale: Locale,
): PrimaryNavigationId | null {
  // Next supplies a pathname; stripping search/hash also keeps URL inputs unambiguous.
  const path = pathname?.split(/[?#]/, 1)[0].replace(/\/+$/, "");

  return (
    primaryNavigationItems.find((item) => {
      const sectionPath = `/${locale}${item.path}`;
      return (
        path === sectionPath ||
        (item.includeChildren && path?.startsWith(`${sectionPath}/`))
      );
    })?.id ?? null
  );
}
