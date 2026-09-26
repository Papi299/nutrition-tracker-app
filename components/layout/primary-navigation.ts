import type { Locale } from "@/lib/i18n/routing";

export const primaryNavigationItems = [
  { id: "today", path: "/today", includeChildren: false },
  { id: "foodSearch", path: "/foods", includeChildren: false },
  { id: "barcodeLookup", path: "/foods/barcode", includeChildren: false },
  { id: "reusableFoods", path: "/foods/reuse", includeChildren: false },
  { id: "myFoods", path: "/foods/custom", includeChildren: true },
  { id: "savedMeals", path: "/saved-meals", includeChildren: true },
  { id: "recipes", path: "/recipes", includeChildren: true },
  { id: "profileTargets", path: "/setup", includeChildren: false },
  { id: "account", path: "/account", includeChildren: true },
] as const;

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
