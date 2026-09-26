import { randomUUID } from "node:crypto";
import { expect, test, type Locator, type Page } from "@playwright/test";
import { provisionActivatedLocalUserForUi } from "@/e2e/helpers/local-auth";

const localOnly = process.env.DATE_E2E_LOCAL_SUPABASE === "1";
test.skip(!localOnly, "Primary navigation requires the local-only authenticated runner.");

const primaryRoutes = [
  "/today", "/foods", "/foods/barcode", "/foods/reuse", "/foods/custom",
  "/saved-meals", "/recipes", "/setup", "/account",
];

function primaryNav(page: Page, locale: string) {
  return page.locator("header nav")
    .filter({ has: page.locator(`a[href="/${locale}/today"]`) })
    .filter({ has: page.locator(`a[href="/${locale}/foods/barcode"]`) });
}

async function expectActive(nav: Locator, locale: string, route: string) {
  const active = nav.locator(`a[href="/${locale}${route}"]`);
  await expect(nav.locator('a[aria-current="page"]')).toHaveCount(1);
  await expect(active).toHaveAttribute("aria-current", "page");
  await expect(active).toHaveClass(/(?:^| )bg-teal-700(?: |$)/);
  await expect(active).toHaveClass(/(?:^| )text-white(?: |$)/);
  await expect(nav.locator("a.bg-teal-700")).toHaveCount(1);

  for (const otherRoute of primaryRoutes.filter((value) => value !== route)) {
    const inactive = nav.locator(`a[href="/${locale}${otherRoute}"]`);
    await expect(inactive).not.toHaveAttribute("aria-current");
    await expect(inactive).toHaveClass(/(?:^| )bg-white(?: |$)/);
    await expect(inactive).toHaveClass(/(?:^| )text-slate-800(?: |$)/);
    await expect(inactive).toHaveClass(/(?:^| )border-slate-300(?: |$)/);
  }
}

for (const locale of ["en", "he"] as const) {
  test(`${locale} authenticated primary navigation follows actual pages and nested sections`, async ({ page }) => {
    const email = `primary-nav-${randomUUID()}@example.test`;
    const password = "PrimaryNavigationPassword123!";
    await provisionActivatedLocalUserForUi({ email, password });
    await page.goto("/en/auth/sign-in");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password", { exact: true }).fill(password);
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await expect(page).toHaveURL(/\/en\/today\?date=/);

    await page.goto(`/${locale}/today?date=2026-09-26`);
    await expect(page.locator("html")).toHaveAttribute("dir", locale === "he" ? "rtl" : "ltr");
    const nav = primaryNav(page, locale);
    await expectActive(nav, locale, "/today");

    // Real client navigation must replace Today's active styling, including overlapping food routes.
    for (const route of ["/foods", "/foods/barcode", "/today"]) {
      await nav.locator(`a[href="/${locale}${route}"]`).click();
      await expect(page).toHaveURL(new RegExp(`/${locale}${route}(?:\\?|$)`));
      await expectActive(nav, locale, route);
    }

    for (const [route, section] of [
      ["/foods?query=apple", "/foods"],
      ["/foods/barcode?date=2026-09-26&meal=dinner", "/foods/barcode"],
      ["/foods/reuse", "/foods/reuse"],
      ["/foods/custom", "/foods/custom"],
      ["/foods/custom/new", "/foods/custom"],
      ["/saved-meals", "/saved-meals"],
      ["/saved-meals/new", "/saved-meals"],
      ["/recipes", "/recipes"],
      ["/recipes/new", "/recipes"],
      ["/setup", "/setup"],
      ["/account", "/account"],
      ["/account/export", "/account"],
      ["/account/closure", "/account"],
    ]) {
      await page.goto(`/${locale}${route}`);
      await expectActive(nav, locale, section);
    }

    // Keyboard focus remains visible on both an inactive and the active item.
    for (const route of ["/today", "/account"]) {
      const link = nav.locator(`a[href="/${locale}${route}"]`);
      await link.focus();
      await page.keyboard.press("Shift+Tab");
      await page.keyboard.press("Tab");
      await expect(link).toBeFocused();
      await expect(link).toHaveCSS("outline-style", "solid");
      await expect(link).toHaveCSS("outline-width", "3px");
    }
  });
}
