import { randomUUID } from "node:crypto";
import { expect, test, type BrowserContext, type Locator, type Page } from "@playwright/test";
import { provisionActivatedLocalUserForUi } from "@/e2e/helpers/local-auth";

const localOnly = process.env.DATE_E2E_LOCAL_SUPABASE === "1";
test.skip(!localOnly, "Primary navigation requires the local-only authenticated runner.");

// Product destinations are independent of the implementation's metadata table.
const primaryRoutes = [
  "/today", "/foods", "/foods/barcode", "/foods/reuse", "/foods/custom",
  "/saved-meals", "/recipes", "/setup", "/account",
] as const;
const mobileRoutes = ["/today", "/foods", "/foods/barcode", "/foods/custom"] as const;
const secondaryRoutes = ["/foods/reuse", "/saved-meals", "/recipes", "/setup", "/account"] as const;
const nestedRoutes = [
  ["/foods?query=apple", "/foods"],
  ["/foods/barcode?date=2026-09-26&meal=dinner", "/foods/barcode"],
  ["/foods/custom/new", "/foods/custom"],
  ["/saved-meals/new", "/saved-meals"],
  ["/recipes/new", "/recipes"],
  ["/account/export", "/account"],
  ["/account/closure", "/account"],
] as const;
const navigationNames = {
  en: { primary: "Primary navigation", mobile: "Mobile primary navigation", secondary: "Secondary navigation", language: "Choose language", signOut: "Sign out" },
  he: { primary: "ניווט ראשי", mobile: "ניווט ראשי בנייד", secondary: "ניווט משני", language: "בחירת שפה", signOut: "יציאה" },
} as const;
type Locale = keyof typeof navigationNames;
let authenticatedState: Awaited<ReturnType<BrowserContext["storageState"]>>;

test.beforeAll(async ({ browser }) => {
  const email = `primary-nav-${randomUUID()}@example.test`;
  const password = "PrimaryNavigationPassword123!";
  await provisionActivatedLocalUserForUi({ email, password });
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto("/en/auth/sign-in");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/\/en\/today\?date=/);
  authenticatedState = await context.storageState();
  await context.close();
});

test.beforeEach(async ({ context }) => {
  await context.addCookies(authenticatedState.cookies);
});

function desktopNav(page: Page, locale: Locale) {
  return page.getByTestId("desktop-sidebar")
    .getByRole("navigation", { name: navigationNames[locale].primary, exact: true });
}

function mobileNav(page: Page) {
  return page.getByTestId("mobile-bottom-navigation");
}

function more(page: Page) {
  return page.getByTestId("mobile-more-navigation");
}

function routeLink(nav: Locator, locale: Locale, route: string) {
  return nav.locator(`a:not([hreflang])[href="/${locale}${route}"]`);
}

async function expectActive(nav: Locator, locale: Locale, route: string) {
  const active = routeLink(nav, locale, route);
  await expect(nav.locator('a:not([hreflang])[aria-current="page"]')).toHaveCount(1);
  await expect(active).toHaveAttribute("aria-current", "page");
  await expect(active).toHaveClass(/(?:^| )ui-current(?: |$)/);
  await expect(nav.locator("a.ui-current:not([hreflang])")).toHaveCount(1);
  const selectedStyle = await active.evaluate((element) => {
    const style = getComputedStyle(element);
    return {
      weight: Number.parseInt(style.fontWeight),
      underline: style.textDecorationLine.includes("underline"),
      border: Number.parseFloat(style.borderInlineStartWidth) >= 2 && style.borderInlineStartColor !== "rgba(0, 0, 0, 0)",
    };
  });
  expect(selectedStyle.weight >= 700 || selectedStyle.underline || selectedStyle.border).toBe(true);
  for (const otherRoute of primaryRoutes.filter((value) => value !== route)) {
    const inactive = routeLink(nav, locale, otherRoute);
    if (await inactive.count()) {
      await expect(inactive).not.toHaveAttribute("aria-current");
      await expect(inactive).not.toHaveClass(/(?:^| )ui-current(?: |$)/);
    }
  }
}

async function expectFocus(page: Page, control: Locator) {
  await control.focus();
  await page.keyboard.press("Shift+Tab");
  await page.keyboard.press("Tab");
  await expect(control).toBeFocused();
  await expect(control).toHaveCSS("outline-style", "solid");
  await expect(control).toHaveCSS("outline-width", "3px");
}

async function expectNoOverflow(page: Page) {
  const dimensions = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    content: document.documentElement.scrollWidth,
  }));
  expect(dimensions.content).toBeLessThanOrEqual(dimensions.viewport);
}

async function expectContentClearance(page: Page) {
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  const lastControl = page.locator('main a:visible, main button:visible, main input:not([type="hidden"]):visible, main select:visible, main textarea:visible').last();
  const [controlBounds, navBounds] = await Promise.all([
    lastControl.boundingBox(), mobileNav(page).boundingBox(),
  ]);
  expect(controlBounds).not.toBeNull();
  expect(navBounds).not.toBeNull();
  expect(controlBounds!.y + controlBounds!.height).toBeLessThanOrEqual(navBounds!.y);
}

async function expectIconsHidden(nav: Locator) {
  const icons = nav.locator("svg");
  expect(await icons.count()).toBeGreaterThan(0);
  for (const icon of await icons.all()) {
    await expect(icon).toHaveAttribute("aria-hidden", "true");
  }
}

for (const locale of ["en", "he"] as const) {
  test(`${locale} desktop sidebar preserves all destinations, nested active states, and keyboard focus`, async ({ page }) => {
    test.setTimeout(90_000);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(`/${locale}/today?date=2026-09-26`);
    await expect(page.locator("html")).toHaveAttribute("dir", locale === "he" ? "rtl" : "ltr");
    await expect(page.getByTestId("desktop-sidebar")).toBeVisible();
    await expect(mobileNav(page)).toBeHidden();
    const nav = desktopNav(page, locale);
    await expect(nav).toBeVisible();
    await expect(nav.getByRole("link")).toHaveCount(9);
    await expect(page.getByRole("main")).toHaveAttribute("id", "main-content");
    await expectIconsHidden(nav);
    await expectActive(nav, locale, "/today");

    // Use real client navigation, including the overlapping food destinations.
    for (const route of primaryRoutes) {
      await routeLink(nav, locale, route).click();
      await expect.poll(() => new URL(page.url()).pathname).toBe(`/${locale}${route}`);
      await expectActive(nav, locale, route);
      await expectNoOverflow(page);
    }
    for (const [route, section] of nestedRoutes) {
      await page.goto(`/${locale}${route}`);
      await expectActive(nav, locale, section);
    }
    for (const route of ["/today", "/account"]) {
      await expectFocus(page, routeLink(nav, locale, route));
    }
  });

  test(`${locale} mobile primary and More destinations retain route, locale, and keyboard behavior`, async ({ page }) => {
    test.setTimeout(90_000);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`/${locale}/today?date=2026-09-26`);
    await expect(page.getByTestId("desktop-sidebar")).toBeHidden();
    const nav = mobileNav(page);
    await expect(nav).toBeVisible();
    await expect(nav).toHaveAttribute("aria-label", navigationNames[locale].mobile);
    const menu = more(page);
    await expect(menu).toHaveJSProperty("tagName", "DETAILS");
    const trigger = menu.locator("summary");
    await expect(trigger).not.toHaveAttribute("aria-current");
    await expect(menu).not.toHaveAttribute("open");
    await expect(nav.getByRole("link")).toHaveCount(4);
    await expectIconsHidden(nav);

    for (const route of mobileRoutes) {
      await routeLink(nav, locale, route).click();
      await expect.poll(() => new URL(page.url()).pathname).toBe(`/${locale}${route}`);
      await expectActive(nav, locale, route);
      await expect(trigger).toHaveAttribute("data-active", "false");
    }

    await expectFocus(page, trigger);
    await trigger.press("Enter");
    await expect(menu).toHaveAttribute("open");
    const secondary = menu.getByRole("navigation", { name: navigationNames[locale].secondary, exact: true });
    await expect(secondary.getByRole("link")).toHaveCount(5);
    await expect(menu.getByRole("navigation", { name: navigationNames[locale].language, exact: true })).toBeVisible();
    await expect(menu.getByRole("button", { name: navigationNames[locale].signOut, exact: true })).toBeVisible();
    await page.keyboard.press("Tab");
    await expect(routeLink(secondary, locale, "/foods/reuse")).toBeFocused();
    await page.keyboard.press("Shift+Tab");
    await expect(trigger).toBeFocused();
    await trigger.press("Space");
    await expect(menu).not.toHaveAttribute("open");

    for (const route of secondaryRoutes) {
      await trigger.click();
      await routeLink(secondary, locale, route).click();
      await expect.poll(() => new URL(page.url()).pathname).toBe(`/${locale}${route}`);
      await expect(trigger).toHaveAttribute("data-active", "true");
      await expect(trigger).not.toHaveAttribute("aria-current");
      await expect(menu).not.toHaveAttribute("open");
      await trigger.press("Enter");
      await expectActive(secondary, locale, route);
      await routeLink(secondary, locale, route).focus();
      await page.keyboard.press("Escape");
      await expect(menu).not.toHaveAttribute("open");
      await expect(trigger).toBeFocused();
    }

    await page.goto(`/${locale}/recipes/new`);
    await expect(trigger).toHaveAttribute("data-active", "true");
    await trigger.click();
    await expectActive(secondary, locale, "/recipes");
    const otherLocale = locale === "en" ? "he" : "en";
    await menu.locator(`a[hreflang="${otherLocale}"]`).click();
    await expect.poll(() => new URL(page.url()).pathname).toBe(`/${otherLocale}/recipes/new`);
    await expect(page.locator("html")).toHaveAttribute("dir", otherLocale === "he" ? "rtl" : "ltr");
  });

  test(`${locale} shell transitions at 1024px without overflow, obscured controls, or incorrect direction`, async ({ page }) => {
    test.setTimeout(90_000);
    for (const width of [320, 390, 768, 1024, 1280, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      for (const route of ["/today?date=2026-09-26", "/recipes/new"]) {
        await page.goto(`/${locale}${route}`);
        const sidebar = page.getByTestId("desktop-sidebar");
        const nav = mobileNav(page);
        const main = page.getByRole("main");
        if (width < 1024) {
          await expect(sidebar).toBeHidden();
          await expect(nav).toBeVisible();
          await expect(nav).toHaveCSS("position", "fixed");
          const first = await routeLink(nav, locale, "/today").boundingBox();
          const last = await more(page).locator("summary").boundingBox();
          expect(first).not.toBeNull();
          expect(last).not.toBeNull();
          if (locale === "he") expect(first!.x).toBeGreaterThan(last!.x);
          else expect(first!.x).toBeLessThan(last!.x);
          await expectContentClearance(page);
          await more(page).locator("summary").click();
          const menuBounds = await more(page).locator(".mobile-more-panel").boundingBox();
          expect(menuBounds?.x).toBeGreaterThanOrEqual(0);
          expect(menuBounds!.x + menuBounds!.width).toBeLessThanOrEqual(width);
          await expectNoOverflow(page);
          await more(page).locator("summary").click();
        } else {
          await expect(sidebar).toBeVisible();
          await expect(nav).toBeHidden();
          const sidebarBounds = await sidebar.boundingBox();
          const mainBounds = await main.boundingBox();
          expect(sidebarBounds!.width).toBeGreaterThanOrEqual(240);
          expect(sidebarBounds!.width).toBeLessThanOrEqual(280);
          if (locale === "he") expect(sidebarBounds!.x).toBeGreaterThan(mainBounds!.x);
          else expect(sidebarBounds!.x).toBeLessThan(mainBounds!.x);
        }
        await expectNoOverflow(page);
      }
    }
    // Inspect loaded authored CSS: computed styles resolve env() to zero on desktop engines.
    const safeAreaCss = await page.evaluate(() => {
      const rules = Array.from(document.styleSheets).flatMap((sheet) => Array.from(sheet.cssRules));
      return rules.map((rule) => rule.cssText).join("\n");
    });
    expect(safeAreaCss).toContain("env(safe-area-inset-bottom");
  });

  test(`${locale} short tablet More keeps every system action within keyboard and scroll reach`, async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 390 });
    await page.goto(`/${locale}/recipes`);
    const menu = more(page);
    const trigger = menu.locator("summary");
    await trigger.focus();
    await trigger.press("Enter");
    const panel = menu.locator(".mobile-more-panel");
    const panelBounds = await panel.boundingBox();
    const navBounds = await mobileNav(page).boundingBox();
    expect(panelBounds!.x).toBeGreaterThanOrEqual(0);
    expect(panelBounds!.y).toBeGreaterThanOrEqual(0);
    expect(panelBounds!.x + panelBounds!.width).toBeLessThanOrEqual(768);
    expect(panelBounds!.y + panelBounds!.height).toBeLessThanOrEqual(navBounds!.y);
    for (const route of secondaryRoutes) {
      await page.keyboard.press("Tab");
      await expect(routeLink(menu, locale, route)).toBeFocused();
    }
    for (const language of ["en", "he"]) {
      await page.keyboard.press("Tab");
      await expect(menu.locator(`a[hreflang="${language}"]`)).toBeFocused();
      await expect(menu.locator(`a[hreflang="${language}"]`)).toBeInViewport({ ratio: 1 });
    }
    const signOut = menu.getByRole("button", { name: navigationNames[locale].signOut, exact: true });
    await page.keyboard.press("Tab");
    await expect(signOut).toBeFocused();
    await expect(signOut).toBeInViewport({ ratio: 1 });
    const finalBounds = await signOut.boundingBox();
    expect(finalBounds!.y + finalBounds!.height).toBeLessThanOrEqual(navBounds!.y);
    await page.keyboard.press("Shift+Tab");
    await expect(menu.locator('a[hreflang="he"]')).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(menu).not.toHaveAttribute("open");
    await expect(trigger).toBeFocused();
    await expectNoOverflow(page);
  });

  test(`${locale} navigation retains forced-color selection, reduced motion, and 44px mobile targets`, async ({ page }) => {
    await page.emulateMedia({ forcedColors: "active", reducedMotion: "reduce" });
    for (const width of [1440, 320]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(`/${locale}/recipes`);
      const nav = width >= 1024 ? desktopNav(page, locale) : mobileNav(page);
      if (width < 1024) await more(page).locator("summary").click();
      const active = routeLink(nav, locale, "/recipes");
      await expect(active).toHaveAttribute("aria-current", "page");
      await expect(active).toHaveCSS("text-decoration-line", "underline");
      const focusable = width >= 1024 ? routeLink(nav, locale, "/today") : more(page).locator("summary");
      await expectFocus(page, focusable);
      const focusColors = await focusable.evaluate((element) => {
        const probe = document.createElement("span");
        probe.style.color = "Highlight";
        probe.style.forcedColorAdjust = "none";
        document.body.append(probe);
        const highlight = getComputedStyle(probe).color;
        probe.remove();
        return { highlight, outline: getComputedStyle(element).outlineColor };
      });
      expect(focusColors.outline).toBe(focusColors.highlight);
      for (const control of await nav.locator("a:visible, summary:visible, button:visible").all()) {
        const appearance = await control.evaluate((element) => {
          const bounds = element.getBoundingClientRect();
          const style = getComputedStyle(element);
          return { height: bounds.height, width: bounds.width, transitions: style.transitionDuration.split(",").map(parseFloat) };
        });
        expect(appearance.transitions.every((duration) => duration <= 0.00001)).toBe(true);
        if (width < 1024) {
          expect(appearance.height).toBeGreaterThanOrEqual(44);
          expect(appearance.width).toBeGreaterThanOrEqual(44);
        }
      }
      if (width < 1024) {
        await expect(more(page).locator("summary")).toHaveCSS("text-decoration-line", "underline");
      }
    }
  });

  test(`${locale} no-JavaScript desktop and native mobile More reach all nine destinations`, async ({ browser }) => {
    test.setTimeout(90_000);
    for (const width of [1440, 390]) {
      const context = await browser.newContext({
        javaScriptEnabled: false,
        storageState: authenticatedState,
        viewport: { width, height: 900 },
      });
      const page = await context.newPage();
      await page.goto(`/${locale}/today?date=2026-09-26`);
      for (const route of primaryRoutes) {
        const nav = width >= 1024 ? desktopNav(page, locale) : mobileNav(page);
        if (width < 1024 && secondaryRoutes.some((secondaryRoute) => secondaryRoute === route)) {
          const menu = more(page);
          await expect(menu).toHaveJSProperty("tagName", "DETAILS");
          await menu.locator("summary").press("Enter");
          await expect(menu).toHaveAttribute("open");
        }
        await routeLink(nav, locale, route).click();
        await expect.poll(() => new URL(page.url()).pathname).toBe(`/${locale}${route}`);
        await expect(page.getByRole("main")).toBeVisible();
        await expectActive(nav, locale, route);
      }
      await context.close();
    }
  });
}
