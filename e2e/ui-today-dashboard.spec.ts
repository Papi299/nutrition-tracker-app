import { provisionActivatedLocalUser, queryLocalAuthFixture } from "@/e2e/helpers/local-auth";
import AxeBuilder from "@axe-core/playwright";
import { createHash, randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { expect, test, type Browser, type BrowserContext, type Page } from "@playwright/test";
import { formatLocalizedDate } from "@/lib/i18n/format";
import type { Database, Json } from "@/lib/supabase/database.types";

const localSupabaseUrl = process.env.LOCAL_SUPABASE_URL;
const localSupabasePublishableKey = process.env.LOCAL_SUPABASE_PUBLISHABLE_KEY;
const localOnly = process.env.DATE_E2E_LOCAL_SUPABASE === "1";
const password = "UiPhase3SyntheticPassword123!";
const captureConfigPath = "/private/tmp/ui-phase-b-capture-config.json";
const captureConfig: { capture?: "before" | "after" | "polish"; fixturePath?: string; evidenceDir?: string } = existsSync(captureConfigPath) ? JSON.parse(readFileSync(captureConfigPath, "utf8")) : {};
const capture = captureConfig.capture;
const captureFixturePath = captureConfig.fixturePath ?? "/private/tmp/ui-phase-b-capture-fixture.json";
const dates = { populated: "2026-10-10", empty: "2026-10-11", missing: "2025-12-31", zero: "2026-02-15", historical: "2026-01-15", exceeded: "2026-11-01", large: "2026-12-01", partial: "2026-12-02", unknownMany: "2026-10-13", subtotalZero: "2026-10-14", subtotalMixed: "2026-10-15", forty: "2026-10-12", emptyTargets: "2027-01-01" } as const;
const mealTypes = ["breakfast", "lunch", "dinner", "snack", "other"] as const;
const expectedTotals = { calories: "1,420", protein_g: "85.5", carbohydrates_g: "198.25", fat_g: "31.25" };

const localeCopy = {
  en: { addFood: "Add food", notSet: "Not set", emptyMeal: "Nothing logged yet", calories: "kcal", grams: "g", addEntry: "Add entry", knownSubtotal: "Known subtotal", unknownValues: "Includes entries with unknown values." },
  he: { addFood: "הוספת מזון", notSet: "לא הוגדר", emptyMeal: "עדיין לא נרשם מזון", calories: "קק״ל", grams: "גרם", addEntry: "הוספת רשומה", knownSubtotal: "סכום ביניים ידוע", unknownValues: "כולל רשומות עם ערכים לא ידועים." },
} as const;
const renderedSourcePaths = ["app/[locale]/(app)/today/page.tsx", "app/globals.css", "components/diary/nutrition-daily-summary.tsx", "components/diary/diary-entry-list.tsx", "components/diary/diary-entry-list-item.tsx", "messages/en.json", "messages/he.json", "lib/diary-presentation.ts"];

async function assertInitialMobileShortcut(page: Page, locale: "en" | "he", width: number, height: number) {
  const shortcut = page.getByTestId("today-add-food");
  // Measure before any focus, click, fill or scroll operation can bring the action into view.
  expect(await page.evaluate(() => window.scrollY)).toBe(0);
  await expect(shortcut).toBeVisible();
  await expect(shortcut).toBeInViewport({ ratio: 1 });
  await expect(shortcut).toHaveAccessibleName(localeCopy[locale].addFood);
  await expect(shortcut).toHaveAttribute("href", "#manual-entry");
  await expect(shortcut).toHaveClass(/ui-button-primary/);
  await expect(shortcut.locator("svg")).toHaveAttribute("aria-hidden", "true");
  await expect(page.locator("html")).toHaveAttribute("dir", locale === "he" ? "rtl" : "ltr");
  const bounds = await shortcut.evaluate(element => {
    const rect = element.getBoundingClientRect();
    const parent = element.parentElement!.getBoundingClientRect();
    return { tag: element.tagName, x: rect.x, y: rect.y, width: rect.width, height: rect.height, right: rect.right, bottom: rect.bottom, parentLeft: parent.left, parentRight: parent.right };
  });
  const header = await page.locator(".mobile-app-header").boundingBox();
  const navigation = await page.getByTestId("mobile-bottom-navigation").boundingBox();
  expect(bounds.tag).toBe("A");
  expect(bounds.width).toBeGreaterThanOrEqual(44);
  expect(bounds.height).toBeGreaterThanOrEqual(44);
  expect(bounds.x).toBeGreaterThanOrEqual(0);
  expect(bounds.right).toBeLessThanOrEqual(width);
  expect(bounds.y).toBeGreaterThanOrEqual((header?.y ?? 0) + (header?.height ?? 0));
  expect(bounds.bottom).toBeLessThanOrEqual(navigation?.y ?? height);
  expect(bounds.bottom).toBeLessThanOrEqual(height);
  expect(Math.abs(locale === "he" ? bounds.x - bounds.parentLeft : bounds.right - bounds.parentRight)).toBeLessThanOrEqual(1);
  const documentWidth = await page.evaluate(() => document.documentElement.scrollWidth);
  expect(documentWidth).toBeLessThanOrEqual(width);
  return { ...bounds, navigationTop: navigation?.y, headerBottom: (header?.y ?? 0) + (header?.height ?? 0), initialScrollY: 0 };
}

test.skip(!localOnly || !localSupabaseUrl || !localSupabasePublishableKey, "Today dashboard requires the safe local fixture runner.");

test.describe.serial("Today dashboard presentation and preserved workflows", () => {
  let state: Awaited<ReturnType<BrowserContext["storageState"]>>;
  let client: SupabaseClient<Database>;
  let userId: string;
  let email: string;

  async function openPage(browser: Browser, options: Parameters<Browser["newContext"]>[0] = {}) {
    const context = await browser.newContext({ storageState: state, reducedMotion: "reduce", ...options });
    return { context, page: await context.newPage() };
  }

  async function seedFixture() {
    const profile = await client.from("profiles").insert({ id: userId, display_name: "Synthetic dashboard reviewer", preferred_language: "en", unit_system: "metric" });
    expect(profile.error).toBeNull();
    const targets = await client.from("nutrition_targets").insert([
      { user_id: userId, effective_from: "2026-01-01", calories: 1800, protein_g: 110, carbohydrates_g: 220, fat_g: 65 },
      { user_id: userId, effective_from: "2026-02-01", calories: 0, protein_g: 0, carbohydrates_g: null, fat_g: 0 },
      { user_id: userId, effective_from: "2026-03-01", calories: 2000, protein_g: 120, carbohydrates_g: 240, fat_g: 70 },
      { user_id: userId, effective_from: "2026-11-01", calories: 800, protein_g: 50, carbohydrates_g: 100, fat_g: 20 },
      { user_id: userId, effective_from: "2026-12-02", calories: 100, protein_g: null, carbohydrates_g: 0, fat_g: 2 },
      { user_id: userId, effective_from: dates.emptyTargets, calories: null, protein_g: null, carbohydrates_g: null, fat_g: null },
    ]);
    expect(targets.error).toBeNull();
    const savedMeal = await client.rpc("persist_saved_meal", {
      p_expected_edit_revision: null as unknown as number, p_locale: "und", p_name: "Synthetic lunch", p_saved_meal_id: null as unknown as string,
      p_items: [{ position: 1, food_id: null, food_name: "Chickpea salad · סלט", brand_name: null, serving_quantity: 1, serving_unit: "bowl", calories: 420, protein_g: 28, carbohydrates_g: 52, fat_g: 12, notes: null }] as Json,
    });
    expect(savedMeal.error).toBeNull();
    const savedMealId = savedMeal.data?.[0].saved_meal_id as string;
    const savedVersion = await client.from("saved_meals").select("updated_at").eq("id", savedMealId).single();
    expect(savedVersion.error).toBeNull();
    const recipe = await client.rpc("persist_recipe", {
      p_locale: "und", p_name: "Lentil soup · מרק עדשים", p_recipe_id: null as unknown as string, p_yield_servings: 1,
      p_ingredients: [{ position: 1, food_id: null, ingredient_name: "Synthetic lentil soup", brand_name: null, quantity: 1, unit: "bowl", calories: 510, protein_g: 30, carbohydrates_g: 75, fat_g: 10, notes: null }] as Json,
    });
    expect(recipe.error).toBeNull();
    const recipeId = recipe.data?.[0].recipe_id as string;
    const recipeVersion = await client.from("recipes").select("updated_at").eq("id", recipeId).single();
    expect(recipeVersion.error).toBeNull();
    for (const date of [dates.populated, dates.missing, dates.zero, dates.historical, dates.exceeded]) {
      const entries = await client.from("diary_entries").insert([
        { user_id: userId, entry_date: date, meal_type: "breakfast", source: "manual", food_name: "Greek yogurt · יוגורט", brand_name: "Synthetic kitchen", serving_quantity: 200, serving_unit: "g", calories: 180, protein_g: 20, carbohydrates_g: 12, fat_g: 4, created_at: `${date}T08:00:00Z` },
        { user_id: userId, entry_date: date, meal_type: "breakfast", source: "manual", food_name: "Rolled oats", serving_quantity: 60, serving_unit: "g", calories: 215, protein_g: 7.5, carbohydrates_g: 34.25, fat_g: 5.25, created_at: `${date}T08:05:00Z` },
        { user_id: userId, entry_date: date, meal_type: "snack", source: "manual", food_name: "Apple · תפוח", serving_quantity: 1, serving_unit: "piece", calories: 95, protein_g: 0, carbohydrates_g: 25, fat_g: 0, created_at: `${date}T15:00:00Z` },
        { user_id: userId, entry_date: date, meal_type: "other", source: "manual", food_name: "Tea · תה", serving_quantity: 1, serving_unit: "cup", calories: null, protein_g: null, carbohydrates_g: null, fat_g: null, created_at: `${date}T16:00:00Z` },
      ]);
      expect(entries.error).toBeNull();
      const loggedMeal = await client.rpc("log_saved_meal_to_diary", { p_entry_date: date, p_expected_updated_at: savedVersion.data?.updated_at as string, p_idempotency_key: randomUUID(), p_meal_type: "lunch", p_saved_meal_id: savedMealId });
      expect(loggedMeal.error).toBeNull();
      expect(loggedMeal.data?.[0].result_status).toBe("success");
      const loggedRecipe = await client.rpc("log_recipe_to_diary", { p_entry_date: date, p_expected_updated_at: recipeVersion.data?.updated_at as string, p_idempotency_key: randomUUID(), p_meal_type: "dinner", p_recipe_id: recipeId, p_requested_servings: 1 });
      expect(loggedRecipe.error).toBeNull();
      expect(loggedRecipe.data?.[0].result_status).toBe("success");
    }
    const edgeEntries = await client.from("diary_entries").insert([
      { user_id: userId, entry_date: dates.large, meal_type: "other", source: "manual", food_name: "Large synthetic snapshot", brand_name: "SyntheticBrand".repeat(8), serving_quantity: 9999999.999, serving_unit: "SyntheticUnbrokenServingUnit012345678901", calories: 999999999, protein_g: 999999.99, carbohydrates_g: 999999.99, fat_g: 999999.99 },
      { user_id: userId, entry_date: dates.partial, meal_type: "snack", source: "manual", food_name: "Partial synthetic snapshot", calories: 100, protein_g: null, carbohydrates_g: 0, fat_g: 1.25 },
    ]);
    expect(edgeEntries.error).toBeNull();
    const subtotalEntries = await client.from("diary_entries").insert([
      { user_id: userId, entry_date: dates.unknownMany, meal_type: "other", source: "manual", food_name: "Tea · תה", calories: null },
      { user_id: userId, entry_date: dates.unknownMany, meal_type: "other", source: "manual", food_name: "Coffee · קפה", calories: null },
      { user_id: userId, entry_date: dates.subtotalZero, meal_type: "other", source: "manual", food_name: "Water · מים", calories: 0 },
      { user_id: userId, entry_date: dates.subtotalMixed, meal_type: "other", source: "manual", food_name: "Water · מים", calories: 0 },
      { user_id: userId, entry_date: dates.subtotalMixed, meal_type: "other", source: "manual", food_name: "Tea · תה", calories: null },
    ]);
    expect(subtotalEntries.error).toBeNull();
    const fortyEntries = await client.from("diary_entries").insert(Array.from({ length: 40 }, (_, index) => ({
      user_id: userId, entry_date: dates.forty, meal_type: mealTypes[Math.floor(index / 8)], source: "manual" as const,
      food_name: index === 0 ? "שם מזון ארוך במיוחד עם עברית English 42% · (סינתטי) ".repeat(3) : index === 1 ? "LongUnbrokenSyntheticFoodIdentity".repeat(5) : `Synthetic diary row ${index + 1} · רשומה`,
      brand_name: index < 2 ? "LongBrandIdentityמותג".repeat(5) : "Synthetic kitchen",
      serving_quantity: 1, serving_unit: "portion", calories: index + 1, protein_g: 0.25, carbohydrates_g: 1.5, fat_g: 0,
      created_at: `${dates.forty}T08:${String(index).padStart(2, "0")}:00Z`,
    })));
    expect(fortyEntries.error).toBeNull();
  }

  test.beforeAll(async ({ browser }) => {
    client = createClient<Database>(localSupabaseUrl as string, localSupabasePublishableKey as string, { auth: { autoRefreshToken: false, persistSession: false } });
    if (capture === "after") {
      email = JSON.parse(readFileSync(captureFixturePath, "utf8")).email;
      const signedIn = await client.auth.signInWithPassword({ email, password });
      expect(signedIn.error).toBeNull();
      userId = signedIn.data.user?.id as string;
    } else {
      email = `ui-phase3-${Date.now()}-${Math.random().toString(36).slice(2)}@example.test`;
      const signedIn = await provisionActivatedLocalUser(client, { email, password });
      expect(signedIn.error).toBeNull();
      userId = signedIn.data.user?.id as string;
      await seedFixture();
      if (capture === "before") writeFileSync(captureFixturePath, JSON.stringify({ email }), { mode: 0o600 });
    }
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.goto("/en/auth/sign-in");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password").fill(password);
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page).toHaveURL(/\/en\/today\?date=\d{4}-\d{2}-\d{2}$/);
    state = await context.storageState();
    await context.close();
  });

  test("captures reproducible visual evidence", async ({ browser }) => {
    test.skip(!capture, "Explicit evidence capture only.");
    test.setTimeout(180_000);
    const output = captureConfig.evidenceDir ?? join(process.cwd(), "docs/evidence/nutrition-ux-redesign-003");
    mkdirSync(output, { recursive: true });
    let captures: { width: number; height: number; locale: "en" | "he"; fixture: keyof typeof dates; forcedColors?: "active" }[] = [
      { width: 1440, height: 900, locale: "en", fixture: "populated" },
      { width: 390, height: 844, locale: "en", fixture: "populated" },
      { width: 390, height: 844, locale: "he", fixture: "populated" },
      { width: 320, height: 720, locale: "he", fixture: "forty" },
      { width: 390, height: 844, locale: "en", fixture: "empty" },
      { width: 390, height: 844, locale: "en", fixture: "missing" },
      { width: 390, height: 844, locale: "en", fixture: "partial" },
      { width: 390, height: 844, locale: "en", fixture: "zero" },
      { width: 390, height: 844, locale: "en", fixture: "exceeded" },
      { width: 390, height: 844, locale: "en", fixture: "subtotalMixed" },
    ];
    if (capture === "after") captures.push({ width: 390, height: 844, locale: "he", fixture: "populated", forcedColors: "active" });
    if (capture === "polish") captures = captures.filter(item => item.fixture === "populated");
    const manifest = [];
    for (const item of captures) {
      const { context, page } = await openPage(browser, { viewport: { width: item.width, height: item.height }, deviceScaleFactor: 1 });
      await page.emulateMedia({ forcedColors: item.forcedColors ?? "none", reducedMotion: "reduce" });
      const route = `/${item.locale}/today?date=${dates[item.fixture]}`;
      await page.goto(route);
      await expect(page.getByTestId("manual-diary-entry-form")).toBeVisible();
      await page.evaluate(() => document.fonts.ready);
      await page.evaluate(() => window.scrollTo(0, 0));
      const geometry = await page.evaluate(() => {
        const summary = document.querySelector(".nutrition-summary")!.getBoundingClientRect();
        const heading = document.querySelector(".today-diary-title")!.getBoundingClientRect();
        const diary = document.querySelector('[data-testid="save-diary-meal-links"]')!.getBoundingClientRect();
        const rows = Array.from(document.querySelectorAll("[data-diary-entry-id]"));
        const first = rows[0]?.getBoundingClientRect();
        const navTop = document.querySelector('[data-testid="mobile-bottom-navigation"]')?.getBoundingClientRect().top ?? window.innerHeight;
        return {
          viewportWidth: document.documentElement.clientWidth, documentWidth: document.documentElement.scrollWidth, direction: document.documentElement.dir,
          summaryHeight: summary.height, diaryHeadingY: heading.top, firstEntryY: first?.top ?? null,
          firstEntryHeight: first?.height ?? null, diaryHeight: diary.height, entryCount: rows.length,
          fullyVisibleRows: rows.filter(row => { const rect = row.getBoundingClientRect(); return rect.top >= 0 && rect.bottom <= navTop; }).length,
        };
      });
      expect(geometry.documentWidth).toBeLessThanOrEqual(geometry.viewportWidth);
      const shortcutBounds = capture === "polish" ? await assertInitialMobileShortcut(page, item.locale, item.width, item.height) : undefined;
      const files = [];
      for (const fullPage of [false, true]) {
        await page.evaluate(() => window.scrollTo(0, 0));
        const name = `${capture}-${item.width}-${item.locale}-${item.fixture}${item.forcedColors ? "-forced-colors" : ""}${fullPage ? "-full" : ""}.png`;
        const image = await page.screenshot({ path: join(output, name), fullPage, animations: "disabled" });
        files.push({ name, fullPage, scope: fullPage ? "full-page" : "initial-viewport", width: image.readUInt32BE(16), height: image.readUInt32BE(20), sha256: createHash("sha256").update(image).digest("hex") });
      }
      let otherSubtotal: string | undefined;
      if (capture === "polish") {
        const section = page.locator('[data-meal-type="other"]');
        const subtotal = section.getByRole("heading", { level: 3 }).locator("..").locator("p");
        await expect(subtotal).toHaveText(localeCopy[item.locale].notSet);
        otherSubtotal = await subtotal.innerText();
        const name = `${capture}-${item.width}-${item.locale}-other-unknown.png`;
        const image = await section.screenshot({ path: join(output, name), animations: "disabled" });
        files.push({ name, fullPage: false, scope: "other-meal", width: image.readUInt32BE(16), height: image.readUInt32BE(20), sha256: createHash("sha256").update(image).digest("hex") });
      }
      manifest.push({ ...item, route, ...geometry, shortcutBounds, otherSubtotal, files });
      await context.close();
    }
    writeFileSync(join(output, `${capture}-manifest.json`), JSON.stringify({ task: "NUTRITION-UX-REDESIGN-003", baseline: "abe0124c485a9a298d9a7fbf7ace76b00771fecc", integratedApplication: true, sourceCommit: execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(), sourceTree: execFileSync("git", ["rev-parse", "HEAD^{tree}"], { encoding: "utf8" }).trim(), evidenceVersion: capture === "polish" ? "bounded-final-polish" : capture, browser: "Chromium", browserVersion: browser.version(), deviceScaleFactor: 1, reducedMotion: "reduce", fixtureTotals: expectedTotals, fixtureAccount: capture === "polish" ? "New activated synthetic local account; original nutrition snapshots recreated after prior regression reset" : "Original shared synthetic account", captures: manifest, renderedSourceFiles: renderedSourcePaths.map(path => ({ path, sha256: createHash("sha256").update(readFileSync(join(process.cwd(), path))).digest("hex") })) }, null, 2) + "\n");
  });

  test("Phase A shared colors, focus, pending controls and field feedback stay accessible", async ({ browser }) => {
    test.setTimeout(120_000);
    const audits = [];
    const output = capture === "after" ? captureConfig.evidenceDir : undefined;
    for (const locale of ["en", "he"] as const) {
      const { context, page } = await openPage(browser, { viewport: { width: 390, height: 844 } });
      for (const [name, path] of [
        ["setup", "/setup"], ["search", `/foods?date=${dates.populated}`],
        ["my-foods", "/foods/custom"], ["saved-meals", "/saved-meals"],
        ["recipes", "/recipes"], ["account", "/account"],
      ]) {
        await page.goto(`/${locale}${path}`);
        await expect(page.locator("main h1")).toBeVisible();
        await expect(page.locator("body")).toHaveCSS("background-color", "rgb(248, 250, 252)");
        expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
        const audit = await new AxeBuilder({ page }).include("main").withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();
        expect(audit.violations, `${locale} ${name}`).toEqual([]);
        audits.push({ locale, name, violations: audit.violations.length, incomplete: audit.incomplete.map(item => item.id) });
        if (output) await page.screenshot({ path: join(output, `after-shared-${locale}-${name}.png`) });
      }
      await page.goto(`/${locale}/today?date=${dates.populated}`);
      const form = page.getByTestId("manual-diary-entry-form");
      let releaseRequest: () => void = () => {};
      const released = new Promise<void>(resolve => { releaseRequest = resolve; });
      await page.route("**/today?**", async route => {
        if (route.request().method() === "POST") await released;
        await route.continue();
      });
      const submit = form.locator('button[type="submit"]');
      try {
        await submit.click();
        await expect(submit).toBeDisabled();
        await expect(submit).toHaveAttribute("aria-busy", "true");
        await expect(submit).toHaveCSS("background-color", "rgb(240, 243, 247)");
        if (output) await submit.screenshot({ path: join(output, `after-pending-${locale}.png`) });
      } finally { releaseRequest(); }
      const nameInput = form.locator('input[name="food_name"]');
      await expect(nameInput).toHaveAttribute("aria-invalid", "true");
      await expect(nameInput).toHaveCSS("border-color", "rgb(180, 35, 24)");
      // The accepted diary form associates inline feedback through its wrapping label.
      const fieldLabel = nameInput.locator("..");
      await expect(fieldLabel).toHaveJSProperty("tagName", "LABEL");
      await expect(fieldLabel.locator(".ui-field-error")).toBeVisible();
      await nameInput.focus();
      await page.keyboard.press("Shift+Tab");
      await page.keyboard.press("Tab");
      await expect(nameInput).toBeFocused();
      await expect(nameInput).toHaveCSS("outline-color", "rgb(18, 62, 149)");
      await expect(nameInput).toHaveCSS("outline-width", "3px");
      const audit = await new AxeBuilder({ page }).include("main").withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();
      expect(audit.violations).toEqual([]);
      if (output) await page.screenshot({ path: join(output, `after-validation-focus-${locale}.png`) });
      await context.close();

      const publicContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
      const publicPage = await publicContext.newPage();
      await publicPage.goto(`/${locale}/auth/sign-in`);
      const authAudit = await new AxeBuilder({ page: publicPage }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();
      expect(authAudit.violations).toEqual([]);
      if (output) await publicPage.screenshot({ path: join(output, `after-auth-${locale}.png`) });
      await publicContext.close();
    }
    if (output) writeFileSync(join(output, "shared-audits.json"), JSON.stringify(audits, null, 2) + "\n");
  });

  test("shows accurate snapshot totals, all ordered meal groups and source identity", async ({ browser }) => {
    const { context, page } = await openPage(browser);
    await page.goto(`/en/today?date=${dates.populated}`);
    const progress = page.getByTestId("target-progress");
    for (const value of Object.values(expectedTotals)) await expect(progress).toContainText(value);
    await expect(progress).toContainText("2,000");
    await expect(progress).toContainText("71%");
    expect(await page.locator('[data-meal-type]').evaluateAll(nodes => nodes.map(node => node.getAttribute("data-meal-type")))).toEqual(mealTypes);
    const entries = await client.from("diary_entries").select("id,meal_type,food_name,source,calories,protein_g,carbohydrates_g,fat_g").eq("entry_date", dates.populated).order("created_at").order("saved_meal_diary_run_id", { nullsFirst: true }).order("saved_meal_item_position", { nullsFirst: true }).order("id");
    expect(entries.error).toBeNull();
    for (const meal of mealTypes) {
      const section = page.locator(`[data-meal-type="${meal}"]`);
      const ids = entries.data?.filter(entry => entry.meal_type === meal).map(entry => entry.id);
      expect(await section.locator('[data-diary-entry-id]').evaluateAll(nodes => nodes.map(node => node.getAttribute("data-diary-entry-id")))).toEqual(ids);
      for (const entry of entries.data?.filter(entry => entry.meal_type === meal) ?? []) {
        const row = section.locator(`[data-diary-entry-id="${entry.id}"]`);
        await expect(row).toContainText(entry.food_name);
        await expect(row.getByTestId(`diary-source-${entry.source}`)).toBeVisible();
        await expect(row.locator('[dir="auto"]').first()).toBeVisible();
      }
    }
    const tea = page.locator('[data-diary-entry-id]').filter({ hasText: "Tea · תה" });
    await expect(tea).toContainText("Not set");
    const apple = page.locator('[data-diary-entry-id]').filter({ hasText: "Apple · תפוח" });
    await expect(apple).toContainText("0");
    const saveLinks = page.getByTestId("save-diary-meal-links");
    await expect(saveLinks).toBeVisible();
    await expect(saveLinks.locator("a")).toHaveCount(5);
    for (const link of await saveLinks.locator("a").all()) await expect(link).toHaveAttribute("href", new RegExp(`date=${dates.populated}`));
    await context.close();
  });

  test("distinguishes empty, historical, missing, zero and exceeded targets", async ({ browser }) => {
    const { context, page } = await openPage(browser);
    await page.goto(`/en/today?date=${dates.empty}`);
    await expect(page.getByTestId("target-progress")).toContainText("0%");
    await expect(page.locator('[data-diary-entry-id]')).toHaveCount(0);
    await page.goto(`/en/today?date=${dates.historical}`);
    await expect(page.getByTestId("target-summary")).toContainText("1,800");
    await expect(page.locator("main")).toContainText(formatLocalizedDate("en", dates.historical, { dateStyle: "long" }));
    await page.goto(`/en/today?date=${dates.missing}`);
    await expect(page.getByTestId("target-progress")).toContainText("1,420");
    await expect(page.getByTestId("target-progress")).not.toContainText(/\d+%/);
    await expect(page.getByRole("link", { name: "Manage current targets", exact: true })).toBeVisible();
    await expect(page.getByTestId("target-progress").locator(".macro-track")).toHaveCount(0);
    await page.goto(`/en/today?date=${dates.zero}`);
    await expect(page.getByTestId("target-summary")).toContainText("0");
    await expect(page.getByTestId("target-progress")).not.toContainText(/\d+%|Infinity|NaN/);
    await expect(page.getByTestId("target-progress")).toContainText("Not set");
    await page.goto(`/en/today?date=${dates.exceeded}`);
    await expect(page.getByTestId("target-progress")).toContainText("178%");
    await expect(page.getByTestId("target-progress")).toContainText("620");
    await expect(page.getByTestId("target-progress")).toContainText(/over/i);
    await expect(page.getByTestId("target-progress")).not.toContainText(/-620/);
    await expect(page.getByTestId("calorie-summary").locator(".calorie-ring")).toHaveCount(0);
    await expect(page.getByTestId("calorie-summary").locator(".macro-track > span")).toHaveAttribute("style", /width:\s*100%/);
    for (const bar of await page.locator(".macro-track > span").all()) await expect(bar).toHaveAttribute("style", /width:\s*100%/);
    await context.close();
  });

  test("large values remain readable without overflow and partial row nutrients remain unknown", async ({ browser }) => {
    const { context, page } = await openPage(browser);
    for (const locale of ["en", "he"] as const) {
      for (const width of [320, 390, 768, 1024, 1280, 1440]) {
        await page.setViewportSize({ width, height: 900 });
        await page.goto(`/${locale}/today?date=${dates.large}`);
        await expect(page.getByTestId("calorie-summary")).toContainText("999,999,999");
        await expect(page.getByTestId("calorie-summary").locator(".macro-track > span")).toHaveAttribute("style", /width:\s*100%/);
        const widths = await page.evaluate(() => ({ viewport: document.documentElement.clientWidth, content: document.documentElement.scrollWidth }));
        if (widths.content > widths.viewport) {
          const overflow = await page.locator("main *").evaluateAll(elements => elements.map(element => {
            const rect = element.getBoundingClientRect();
            return { tag: element.tagName, className: element.className, text: element.textContent?.slice(0, 100), left: rect.left, right: rect.right, width: element.clientWidth, content: element.scrollWidth };
          }).filter(element => element.content > element.width + 1 || element.right > document.documentElement.clientWidth));
          const diagnosticPath = test.info().outputPath("large-value-overflow.json");
          writeFileSync(diagnosticPath, JSON.stringify(overflow, null, 2));
          await test.info().attach("large-value-overflow.json", { path: diagnosticPath, contentType: "application/json" });
        }
        expect(widths.content, `${locale} ${width}px large-value overflow`).toBeLessThanOrEqual(widths.viewport);
        for (const value of await page.locator(".nutrition-values dd").all()) {
          const sizes = await value.evaluate(element => ({ width: element.clientWidth, content: element.scrollWidth }));
          expect(sizes.content).toBeLessThanOrEqual(sizes.width);
        }
      }
    }
    await page.goto(`/en/today?date=${dates.partial}`);
    const row = page.locator('[data-diary-entry-id]').filter({ hasText: "Partial synthetic snapshot" });
    await expect(row.locator("dl > div").filter({ hasText: "Protein (g)" }).locator("dd")).toHaveText("Not set");
    await expect(row.locator("dl > div").filter({ hasText: "Carbohydrates (g)" }).locator("dd")).toHaveText("0 g");
    await expect(row.locator("dl > div").filter({ hasText: "Fat (g)" }).locator("dd")).toHaveText("1.25 g");
    await expect(page.locator('[data-nutrition-metric="protein_g"] dl')).toContainText("0 g");
    await context.close();
  });

  test("forty full-identity rows retain exact snapshots, order, complete macros and bounded layout", async ({ browser }) => {
    test.setTimeout(120_000);
    const { context, page } = await openPage(browser);
    const fixture = await client.from("diary_entries").select("id,food_name,brand_name,meal_type").eq("entry_date", dates.forty).order("created_at").order("saved_meal_diary_run_id", { nullsFirst: true }).order("saved_meal_item_position", { nullsFirst: true }).order("id");
    expect(fixture.error).toBeNull();
    expect(fixture.data).toHaveLength(40);
    for (const locale of ["en", "he"] as const) {
      for (const width of [320, 390, 768, 1024, 1440]) {
        await page.setViewportSize({ width, height: 640 });
        await page.goto(`/${locale}/today?date=${dates.forty}`);
        await expect(page.locator("[data-diary-entry-id]")).toHaveCount(40);
        for (const [metric, total] of Object.entries({ calories: "820", protein_g: "10", carbohydrates_g: "60", fat_g: "0" })) {
          await expect(page.locator(`[data-nutrition-metric="${metric}"] dl > div`).first().locator("dd")).toHaveText(`${total} ${metric === "calories" ? localeCopy[locale].calories : localeCopy[locale].grams}`);
        }
        for (const meal of mealTypes) {
          const section = page.locator(`[data-meal-type="${meal}"]`);
          const expectedRows = fixture.data!.filter(entry => entry.meal_type === meal);
          expect(await section.locator("[data-diary-entry-id]").evaluateAll(rows => rows.map(row => row.getAttribute("data-diary-entry-id")))).toEqual(expectedRows.map(entry => entry.id));
        }
        for (const entry of fixture.data!.slice(0, 2)) {
          const row = page.locator(`[data-diary-entry-id="${entry.id}"]`);
          await expect(row).toContainText(entry.food_name);
          await expect(row).toContainText(entry.brand_name!);
          await expect(row.getByTestId("diary-source-manual")).toBeVisible();
          await expect(row.locator("dl > div")).toHaveCount(3);
          const clipping = await row.locator('[dir="auto"]').first().evaluate(element => ({ clipped: element.scrollHeight > element.clientHeight + 1, ellipsis: getComputedStyle(element).textOverflow === "ellipsis" }));
          expect(clipping).toEqual({ clipped: false, ellipsis: false });
        }
        expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
      }
    }
    await context.close();
  });

  test("known subtotals identify missing snapshots per nutrient without treating explicit zero as unknown", async ({ browser }) => {
    test.setTimeout(120_000);
    const { context, page } = await openPage(browser);
    for (const locale of ["en", "he"] as const) {
      for (const item of [
        { date: dates.populated, counts: [1, 1, 1, 1], totals: ["1,420", "85.5", "198.25", "31.25"] },
        { date: dates.partial, counts: [0, 1, 0, 0], totals: ["100", "0", "0", "1.25"] },
        { date: dates.unknownMany, counts: [2, 2, 2, 2], totals: ["0", "0", "0", "0"] },
        { date: dates.subtotalZero, counts: [0, 1, 1, 1], totals: ["0", "0", "0", "0"] },
        { date: dates.subtotalMixed, counts: [1, 2, 2, 2], totals: ["0", "0", "0", "0"] },
        { date: dates.forty, counts: [0, 0, 0, 0], totals: ["820", "10", "60", "0"] },
        { date: dates.empty, counts: [0, 0, 0, 0], totals: ["0", "0", "0", "0"] },
      ]) {
        await page.goto(`/${locale}/today?date=${item.date}`);
        for (const [index, key] of ["calories", "protein_g", "carbohydrates_g", "fat_g"].entries()) {
          const metric = page.locator(`[data-nutrition-metric="${key}"]`);
          await expect(metric).toHaveAttribute("data-unknown-count", String(item.counts[index]));
          await expect(metric.locator("dl > div").first().locator("dd")).toHaveText(`${item.totals[index]} ${key === "calories" ? localeCopy[locale].calories : localeCopy[locale].grams}`);
          if (item.counts[index] > 0) await expect(metric.locator(".nutrition-known-subtotal")).toHaveText(localeCopy[locale].knownSubtotal);
          else await expect(metric.locator(".nutrition-known-subtotal")).toHaveCount(0);
        }
        if (item.counts.some(count => count > 0)) await expect(page.locator(".nutrition-unknown-note")).toHaveText(localeCopy[locale].unknownValues);
        else await expect(page.locator(".nutrition-unknown-note")).toHaveCount(0);
      }
    }
    await page.goto(`/en/today?date=${dates.partial}`);
    await expect(page.locator('[data-nutrition-metric="protein_g"] .nutrition-target bdi')).toHaveText("Not set");
    await expect(page.locator('[data-nutrition-metric="carbohydrates_g"] .nutrition-target bdi')).toHaveText("0 g");
    await expect(page.locator('[data-nutrition-metric="carbohydrates_g"] .macro-track')).toHaveCount(0);
    await expect(page.locator('[data-nutrition-metric="fat_g"] .nutrition-target bdi')).toHaveText("2 g");
    await page.goto(`/en/today?date=${dates.emptyTargets}`);
    // The target reader normalizes an all-null target record to no configured target.
    await expect(page.getByTestId("target-summary")).toHaveCount(0);
    await expect(page.getByTestId("target-progress")).toBeVisible();
    await expect(page.getByTestId("target-progress").locator(".macro-track, .nutrition-target")).toHaveCount(0);
    await expect(page.locator(".nutrition-target-note p")).toHaveCount(1);
    await expect(page.locator(".nutrition-target-note")).toContainText("No manual target");
    await expect(page.getByRole("link", { name: "Manage current targets", exact: true })).toBeVisible();
    await context.close();
  });

  test("preserves available diary data through profile and target retrieval failures and never invents zero totals on diary failure", async ({ browser }) => {
    const { context, page } = await openPage(browser);
    for (const table of ["nutrition_targets", "profiles", "diary_entries"] as const) {
      queryLocalAuthFixture(`revoke select on table public.${table} from authenticated;`);
      try {
        await page.goto(`/en/today?date=${dates.populated}`);
        const errorId = table === "nutrition_targets" ? "target-retrieval-error" : table === "profiles" ? "profile-retrieval-error" : "diary-retrieval-error";
        await expect(page.getByTestId(errorId)).toBeVisible();
        await expect(page.getByTestId(errorId).getByRole("link")).toHaveAttribute("href", `/en/today?date=${dates.populated}`);
        if (table === "diary_entries") {
          await expect(page.getByTestId("target-progress")).toHaveCount(0);
          await expect(page.locator('[data-diary-entry-id]')).toHaveCount(0);
        } else {
          await expect(page.getByText("Greek yogurt · יוגורט", { exact: true })).toBeVisible();
          if (table === "nutrition_targets") {
            await expect(page.getByTestId("target-progress")).toHaveCount(0);
            await expect(page.getByTestId("calorie-summary")).toContainText("1,420");
            await expect(page.getByTestId("calorie-summary")).not.toContainText(/\d+%/);
          }
        }
      } finally { queryLocalAuthFixture(`grant select on table public.${table} to authenticated;`); }
      await page.reload();
      await expect(page.getByText("Greek yogurt · יוגורט", { exact: true })).toBeVisible();
    }
    // Synthetic local fixture administration preserves the authenticated role's lack of DELETE privileges.
    queryLocalAuthFixture(`delete from public.profiles where id = '${userId}'::uuid;`);
    try {
      await page.reload();
      const setup = page.getByTestId("today-setup-guidance");
      await expect(setup.getByRole("heading", { name: "Finish the basic setup" })).toBeVisible();
      await expect(setup.getByRole("link")).toHaveAttribute("href", "/en/setup");
      expect(await setup.evaluate(node => Boolean(node.compareDocumentPosition(document.querySelector("#manual-entry")!) & Node.DOCUMENT_POSITION_PRECEDING))).toBe(true);
      await expect(page.getByTestId("today-add-food")).toBeEnabled();
      if (capture === "after") {
        const output = captureConfig.evidenceDir as string;
        await setup.screenshot({ path: join(output, "after-optional-setup.png") });
        await page.screenshot({ path: join(output, "after-optional-setup-full.png"), fullPage: true });
      }
      await expect(page.getByText("Greek yogurt · יוגורט", { exact: true })).toBeVisible();
    } finally {
      expect((await client.from("profiles").insert({ id: userId, display_name: "Synthetic dashboard reviewer", preferred_language: "en", unit_system: "metric" })).error).toBeNull();
    }
    await context.close();
  });

  for (const locale of ["en", "he"] as const) {
    test(`${locale} dashboard reflows at all required widths with accessible progress and practical controls`, async ({ browser }) => {
      const { context, page } = await openPage(browser);
      for (const width of [320, 390, 768, 1024, 1280, 1440]) {
        await page.setViewportSize({ width, height: 900 });
        await page.goto(`/${locale}/today?date=${dates.populated}`);
        await expect(page.locator("html")).toHaveAttribute("dir", locale === "he" ? "rtl" : "ltr");
        await expect(page.getByTestId("target-progress")).toContainText("1,420");
        const dimensions = await page.evaluate(() => ({ viewport: document.documentElement.clientWidth, content: document.documentElement.scrollWidth }));
        expect(dimensions.content, `${locale} ${width}px overflow`).toBeLessThanOrEqual(dimensions.viewport);
        for (const progress of await page.getByRole("progressbar").all()) {
          await expect(progress).toHaveAccessibleName(/.+/);
          await expect(progress).toHaveAttribute("aria-valuenow", /\d/);
          await expect(progress).toHaveAttribute("aria-valuetext", /.+/);
        }
        await expect(page.locator('[data-nutrition-metric]')).toHaveCount(4);
        await expect(page.locator(".calorie-ring")).toHaveCount(0);
        const metricBounds = await page.locator("[data-nutrition-metric]").evaluateAll(metrics => metrics.map(metric => { const rect = metric.getBoundingClientRect(); return { top: rect.top, width: rect.width }; }));
        expect(Math.abs(metricBounds[0].top - metricBounds[1].top)).toBeLessThanOrEqual(1);
        expect(Math.abs(metricBounds[2].top - metricBounds[3].top)).toBeLessThanOrEqual(1);
        expect(Math.max(...metricBounds.map(metric => metric.width)) - Math.min(...metricBounds.map(metric => metric.width))).toBeLessThanOrEqual(1);
        if (width < 640) expect(metricBounds[2].top).toBeGreaterThan(metricBounds[0].top);
        else expect(Math.max(...metricBounds.map(metric => metric.top)) - Math.min(...metricBounds.map(metric => metric.top))).toBeLessThanOrEqual(1);
        for (const [key, value] of Object.entries(expectedTotals)) {
          const metric = page.locator(`[data-nutrition-metric="${key}"]`);
          await expect(metric.locator("h3")).toHaveText(/.+/);
          await expect(metric.locator("dl")).toContainText(value);
          expect(await metric.ariaSnapshot()).toContain(value);
          const bounds = await metric.evaluate(element => ({ left: element.getBoundingClientRect().left, right: element.getBoundingClientRect().right, width: element.clientWidth, content: element.scrollWidth }));
          expect(bounds.left).toBeGreaterThanOrEqual(0);
          expect(bounds.right).toBeLessThanOrEqual(width);
          expect(bounds.content).toBeLessThanOrEqual(bounds.width);
        }
        for (const svg of await page.getByTestId("target-progress").locator("svg").all()) expect(await svg.evaluate(element => Boolean(element.closest('[aria-hidden="true"]')))).toBe(true);
        for (const control of await page.locator('main button, main input:not([type="hidden"]), main select').all()) {
          if (!(await control.isVisible())) continue;
          const bounds = await control.boundingBox();
          expect(bounds?.height).toBeGreaterThanOrEqual(44);
          expect(bounds?.width).toBeGreaterThanOrEqual(44);
        }
        if (width < 1024) {
          const submit = page.getByTestId("manual-diary-entry-form").getByRole("button", { name: locale === "en" ? "Add entry" : "הוספת רשומה", exact: true });
          await submit.scrollIntoViewIfNeeded();
          const submitBounds = await submit.boundingBox();
          const navBounds = await page.getByTestId("mobile-bottom-navigation").boundingBox();
          expect(submitBounds?.y).toBeGreaterThanOrEqual(0);
          expect((submitBounds?.y ?? 0) + (submitBounds?.height ?? 0)).toBeLessThanOrEqual(navBounds?.y ?? 900);
        }
      }
      const axe = await new AxeBuilder({ page }).include("main").withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();
      expect(axe.violations).toEqual([]);
      await page.emulateMedia({ forcedColors: "active", reducedMotion: "reduce" });
      const date = page.locator('input[name="date"]');
      await date.focus();
      await page.keyboard.press("Shift+Tab");
      await page.keyboard.press("Tab");
      await expect(date).toBeFocused();
      await expect(date).toHaveCSS("outline-style", "solid");
      await expect(date).toHaveCSS("outline-width", "3px");
      await expect(page.getByTestId("target-progress")).toContainText("1,420");
      await context.close();
    });
  }

  for (const locale of ["en", "he"] as const) {
    test(`${locale} header Add Food is initially visible, native and preserves the mounted draft`, async ({ browser }) => {
      test.setTimeout(60_000);
      const { context, page } = await openPage(browser);
      for (const { width, height } of [{ width: 320, height: 720 }, { width: 390, height: 844 }]) {
        await page.setViewportSize({ width, height });
        await page.goto(`/${locale}/today?date=${dates.populated}`);
        await assertInitialMobileShortcut(page, locale, width, height);
        const shortcut = page.getByTestId("today-add-food");
        const form = page.getByTestId("manual-diary-entry-form");
        await expect(page.getByRole("link", { name: localeCopy[locale].addFood, exact: true })).toHaveCount(1);
        await expect(form).toHaveCount(1);
        await form.locator('input[name="food_name"]').fill(`Unsaved ${locale} ${width}px draft`);
        await form.locator('input[name="calories"]').fill("0");
        const key = await form.locator('input[name="idempotency_key"]').inputValue();
        await page.locator('input[name="date"]').fill(dates.historical);
        await form.evaluate(node => Object.defineProperty(window, "__uiPhase3PolishForm", { configurable: true, value: node }));
        await page.evaluate(() => window.scrollTo(0, 0));
        await shortcut.focus();
        await page.keyboard.press("Shift+Tab");
        await page.keyboard.press("Tab");
        await expect(shortcut).toBeFocused();
        await expect(shortcut).toHaveCSS("outline-style", "solid");
        await expect(shortcut).toHaveCSS("outline-width", "3px");
        await page.keyboard.press("Enter");
        await expect(page).toHaveURL(new RegExp(`date=${dates.populated}#manual-entry$`));
        await expect(page.locator("#manual-entry")).toBeFocused();
        expect(await form.evaluate(node => node === Reflect.get(window, "__uiPhase3PolishForm"))).toBe(true);
        await expect(form).toHaveCount(1);
        await expect(form.locator('input[name="food_name"]')).toHaveValue(`Unsaved ${locale} ${width}px draft`);
        await expect(form.locator('input[name="calories"]')).toHaveValue("0");
        await expect(form.locator('input[name="idempotency_key"]')).toHaveValue(key);
        await expect(form.locator('input[name="entry_date"]')).toHaveValue(dates.populated);
        await expect(form.getByRole("button", { name: localeCopy[locale].addEntry, exact: true })).toBeEnabled();
        await form.locator('input[name="food_name"]').fill(`Still editable ${locale} ${width}px draft`);
        await page.evaluate(() => window.scrollTo(0, 0));
        await shortcut.click();
        await expect(page.locator("#manual-entry")).toBeFocused();
        expect(await form.evaluate(node => node === Reflect.get(window, "__uiPhase3PolishForm"))).toBe(true);
        await expect(form.locator('input[name="food_name"]')).toHaveValue(`Still editable ${locale} ${width}px draft`);
        await expect(form.locator('input[name="idempotency_key"]')).toHaveValue(key);
      }
      await page.goto(`/${locale}/today?date=${dates.populated}`);
      await page.setViewportSize({ width: 390, height: 844 });
      await page.emulateMedia({ forcedColors: "active", reducedMotion: "reduce" });
      const shortcut = page.getByTestId("today-add-food");
      await shortcut.focus();
      await page.keyboard.press("Shift+Tab");
      await page.keyboard.press("Tab");
      await expect(shortcut).toBeFocused();
      await expect(shortcut).toHaveCSS("outline-width", "3px");
      await page.emulateMedia({ forcedColors: "none", reducedMotion: "reduce" });
      for (const width of [1024, 1280, 1440]) {
        await page.setViewportSize({ width, height: 900 });
        await expect(page.getByRole("link", { name: localeCopy[locale].addFood, exact: true })).toHaveCount(1);
        await expect(shortcut).toBeInViewport({ ratio: 1 });
        const original = page.getByTestId("today-add-food");
        await expect(original).toHaveAccessibleName(localeCopy[locale].addFood);
        await expect(original).toBeVisible();
        await expect(original).toHaveAttribute("href", "#manual-entry");
        await expect(page.getByTestId("target-progress")).toContainText("1,420");
      }
      await context.close();
    });

    test(`${locale} mobile header shortcut reaches the existing form without JavaScript`, async ({ browser }) => {
      for (const { width, height } of [{ width: 320, height: 720 }, { width: 390, height: 844 }]) {
        const { context, page } = await openPage(browser, { javaScriptEnabled: false, viewport: { width, height } });
        await page.goto(`/${locale}/today?date=${dates.populated}`);
        await assertInitialMobileShortcut(page, locale, width, height);
        const shortcut = page.getByTestId("today-add-food");
        await shortcut.focus();
        await page.keyboard.press("Enter");
        await expect(page.locator("#manual-entry")).toBeFocused();
        const form = page.getByTestId("manual-diary-entry-form");
        await expect(form).toHaveCount(1);
        await expect(form.locator('input[name="entry_date"]')).toHaveValue(dates.populated);
        await form.locator('input[name="food_name"]').fill("Native synthetic draft");
        await form.locator('input[name="calories"]').fill("0");
        const key = await form.locator('input[name="idempotency_key"]').inputValue();
        await page.evaluate(() => window.scrollTo(0, 0));
        await shortcut.click();
        await expect(page.locator("#manual-entry")).toBeFocused();
        await expect(form.locator('input[name="food_name"]')).toHaveValue("Native synthetic draft");
        await expect(form.locator('input[name="calories"]')).toHaveValue("0");
        await expect(form.locator('input[name="idempotency_key"]')).toHaveValue(key);
        await expect(form.getByRole("button", { name: localeCopy[locale].addEntry, exact: true })).toBeEnabled();
        await expect(page.getByTestId("target-progress")).toContainText("1,420");
        await context.close();
      }
    });

    test(`${locale} rendered meal subtotals distinguish all six null, zero, mixed, positive and empty cases`, async ({ browser }) => {
      const { context, page } = await openPage(browser);
      const copy = localeCopy[locale];
      const cases = [
        { label: "one null", date: dates.populated, meal: "other", count: 1, subtotal: copy.notSet, populated: true },
        { label: "many null", date: dates.unknownMany, meal: "other", count: 2, subtotal: copy.notSet, populated: false },
        { label: "explicit zero", date: dates.subtotalZero, meal: "other", count: 1, subtotal: `0 ${copy.calories}`, populated: false },
        { label: "zero and null", date: dates.subtotalMixed, meal: "other", count: 2, subtotal: `0 ${copy.calories} · ${copy.knownSubtotal}`, populated: false },
        { label: "positive sum", date: dates.populated, meal: "breakfast", count: 2, subtotal: `395 ${copy.calories}`, populated: true },
        { label: "empty", date: dates.empty, meal: "other", count: 0, subtotal: copy.emptyMeal, populated: false },
      ];
      for (const item of cases) {
        await page.goto(`/${locale}/today?date=${item.date}`);
        const section = page.locator(`[data-meal-type="${item.meal}"]`);
        const subtotal = section.getByRole("heading", { level: 3 }).locator("..").locator("p");
        await expect(subtotal, item.label).toHaveText(item.subtotal);
        await expect(section.locator('[data-diary-entry-id]')).toHaveCount(item.count);
        const entries = await client.from("diary_entries").select("id,calories").eq("entry_date", item.date).eq("meal_type", item.meal);
        expect(entries.error).toBeNull();
        for (const entry of entries.data ?? []) {
          const rowCalories = section.locator(`[data-diary-entry-id="${entry.id}"] > div`).first().locator("p bdi");
          await expect(rowCalories).toHaveText(entry.calories === null ? copy.notSet : `${entry.calories} ${copy.calories}`);
        }
        for (const [metric, value] of Object.entries(expectedTotals)) {
          const unit = metric === "calories" ? copy.calories : copy.grams;
          await expect(page.locator(`[data-nutrition-metric="${metric}"] dl > div`).first().locator("dd")).toHaveText(`${item.populated ? value : "0"} ${unit}`);
        }
        if (item.count === 0) await expect(subtotal).not.toHaveText(copy.notSet);
      }
      await context.close();
    });
  }

  test("preserves manual drafts and idempotency through Add Food, native disclosure and edit interactions", async ({ browser }) => {
    const { context, page } = await openPage(browser, { viewport: { width: 390, height: 844 } });
    await page.goto(`/en/today?date=${dates.populated}`);
    const form = page.getByTestId("manual-diary-entry-form");
    await form.locator('input[name="food_name"]').fill("Unsaved synthetic draft");
    await form.locator('input[name="calories"]').fill("0");
    const key = await form.locator('input[name="idempotency_key"]').inputValue();
    const add = page.getByTestId("today-add-food");
    await expect(add).toHaveAttribute("href", /#manual-entry$/);
    await add.focus();
    await page.keyboard.press("Enter");
    await expect(page.locator("#manual-entry")).toBeFocused();
    const disclosure = page.locator('details:has([data-testid="manual-diary-entry-form"]) > summary');
    if (await disclosure.count()) { await disclosure.click(); await disclosure.click(); }
    const row = page.locator('[data-diary-entry-id]').filter({ hasText: "Greek yogurt · יוגורט" });
    await row.getByRole("button", { name: "Edit", exact: true }).click();
    await row.getByRole("button", { name: "Cancel", exact: true }).click();
    await expect(form.locator('input[name="food_name"]')).toHaveValue("Unsaved synthetic draft");
    await expect(form.locator('input[name="calories"]')).toHaveValue("0");
    await expect(form.locator('input[name="idempotency_key"]')).toHaveValue(key);
    await page.reload();
    await expect(form.locator('input[name="food_name"]')).toHaveValue("Unsaved synthetic draft");
    await expect(form.locator('input[name="idempotency_key"]')).toHaveValue(key);
    await context.close();
  });

  test("initial server dashboard, native date selection and Add Food work without JavaScript", async ({ browser }) => {
    const { context, page } = await openPage(browser, { javaScriptEnabled: false, viewport: { width: 320, height: 720 } });
    await page.goto(`/he/today?date=${dates.populated}`);
    await expect(page.getByTestId("target-progress")).toContainText("1,420");
    await expect(page.getByTestId("target-progress")).toContainText("71%");
    await expect(page.getByTestId("manual-diary-entry-form")).toBeVisible();
    await page.locator('input[name="date"]').fill(dates.empty);
    await page.locator('form:has(input[name="date"])').getByRole("button").click();
    await expect(page).toHaveURL(new RegExp(`date=${dates.empty}$`));
    await expect(page.getByTestId("target-progress")).toContainText("0%");
    const add = page.getByTestId("today-add-food");
    await add.click();
    await expect(page.locator('input[name="entry_date"]')).toHaveValue(dates.empty);
    await expect(page.locator('input[name="food_name"]')).toBeVisible();
    await context.close();
  });
});
