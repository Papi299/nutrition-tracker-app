import { expect, test } from "@playwright/test";
import { activePrimaryNavigation } from "@/components/layout/primary-navigation";

// Expected sections are independent of the implementation's route table.
const routes = [
  ["/today", "today"],
  ["/foods", "foodSearch"],
  ["/foods/barcode", "barcodeLookup"],
  ["/foods/reuse", "reusableFoods"],
  ["/foods/custom", "myFoods"],
  ["/foods/custom/new", "myFoods"],
  ["/foods/custom/food-id/edit", "myFoods"],
  ["/saved-meals", "savedMeals"],
  ["/saved-meals/new", "savedMeals"],
  ["/saved-meals/meal-id/edit", "savedMeals"],
  ["/saved-meals/meal-id/use", "savedMeals"],
  ["/recipes", "recipes"],
  ["/recipes/new", "recipes"],
  ["/recipes/recipe-id/edit", "recipes"],
  ["/recipes/recipe-id/use", "recipes"],
  ["/setup", "profileTargets"],
  ["/account", "account"],
  ["/account/export", "account"],
  ["/account/closure", "account"],
] as const;

for (const locale of ["en", "he"] as const) {
  for (const [path, expected] of routes) {
    test(`${locale}${path} selects only ${expected}`, () => {
      expect(activePrimaryNavigation(`/${locale}${path}`, locale)).toBe(expected);
      expect(activePrimaryNavigation(`/${locale}${path}/`, locale)).toBe(expected);
      expect(
        activePrimaryNavigation(`/${locale}${path}?date=2026-09-26&meal=dinner#form`, locale),
      ).toBe(expected);
    });
  }

  test(`${locale} rejects unknown, overlapping, and other-locale routes`, () => {
    for (const path of [
      "/foods/unknown", "/foods/barcode-extra", "/foods/barcode/unknown",
      "/foods/reuse-extra", "/foods/customized", "/saved-meals-extra",
      "/recipes-extra", "/account-extra", "/today-extra", "/today/unknown",
      "/setup-extra", "/setup/unknown", "/sign-out-failed", "/auth/sign-in",
    ]) {
      expect(activePrimaryNavigation(`/${locale}${path}`, locale)).toBeNull();
    }
    const otherLocale = locale === "en" ? "he" : "en";
    expect(activePrimaryNavigation(`/${otherLocale}/today`, locale)).toBeNull();
    expect(activePrimaryNavigation("/today", locale)).toBeNull();
    expect(activePrimaryNavigation(null, locale)).toBeNull();
  });
}
