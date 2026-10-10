import { provisionActivatedLocalUser, queryLocalAuthFixture } from "@/e2e/helpers/local-auth";
import AxeBuilder from "@axe-core/playwright";
import { createHash, randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { expect, test, type Browser, type BrowserContext } from "@playwright/test";
import { formatLocalizedDate } from "@/lib/i18n/format";
import type { Database, Json } from "@/lib/supabase/database.types";

const localSupabaseUrl = process.env.LOCAL_SUPABASE_URL;
const localSupabasePublishableKey = process.env.LOCAL_SUPABASE_PUBLISHABLE_KEY;
const localOnly = process.env.DATE_E2E_LOCAL_SUPABASE === "1";
const password = "UiPhase3SyntheticPassword123!";
const captureConfigPath = "/private/tmp/ui-phase3-capture-config.json";
const captureConfig: { capture?: "before" | "after"; fixturePath?: string; evidenceDir?: string } = existsSync(captureConfigPath) ? JSON.parse(readFileSync(captureConfigPath, "utf8")) : {};
const capture = captureConfig.capture;
const captureFixturePath = captureConfig.fixturePath ?? "/private/tmp/ui-phase3-capture-fixture.json";
const dates = { populated: "2026-10-10", empty: "2026-10-11", missing: "2025-12-31", zero: "2026-02-15", historical: "2026-01-15", exceeded: "2026-11-01", large: "2026-12-01", partial: "2026-12-02" } as const;
const mealTypes = ["breakfast", "lunch", "dinner", "snack", "other"] as const;
const expectedTotals = { calories: "1,420", protein_g: "85.5", carbohydrates_g: "198.25", fat_g: "31.25" };

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
    test.setTimeout(120_000);
    const output = captureConfig.evidenceDir ?? join(process.cwd(), "docs/evidence/ui-phase3");
    mkdirSync(output, { recursive: true });
    const captures: { width: number; height: number; locale: "en" | "he"; fixture: keyof typeof dates; forcedColors?: "active" }[] = [
      { width: 1440, height: 900, locale: "en", fixture: "populated" }, { width: 1440, height: 900, locale: "he", fixture: "populated" },
      { width: 1280, height: 900, locale: "en", fixture: "empty" }, { width: 390, height: 844, locale: "en", fixture: "populated" },
      { width: 390, height: 844, locale: "he", fixture: "populated" }, { width: 390, height: 844, locale: "en", fixture: "empty" },
      { width: 320, height: 720, locale: "he", fixture: "populated" }, { width: 390, height: 844, locale: "en", fixture: "missing" },
      { width: 1440, height: 900, locale: "en", fixture: "exceeded" }, { width: 390, height: 844, locale: "he", fixture: "exceeded" },
    ];
    if (capture === "after") captures.push({ width: 390, height: 844, locale: "en", fixture: "populated", forcedColors: "active" }, { width: 390, height: 844, locale: "he", fixture: "populated", forcedColors: "active" });
    const manifest = [];
    for (const item of captures) {
      const { context, page } = await openPage(browser, { viewport: { width: item.width, height: item.height }, deviceScaleFactor: 1 });
      await page.emulateMedia({ forcedColors: item.forcedColors ?? "none", reducedMotion: "reduce" });
      const route = `/${item.locale}/today?date=${dates[item.fixture]}`;
      await page.goto(route);
      await expect(page.getByTestId("manual-diary-entry-form")).toBeVisible();
      await page.evaluate(() => document.fonts.ready);
      const geometry = await page.evaluate(() => ({ viewportWidth: document.documentElement.clientWidth, documentWidth: document.documentElement.scrollWidth, direction: document.documentElement.dir }));
      expect(geometry.documentWidth).toBeLessThanOrEqual(geometry.viewportWidth);
      const files = [];
      for (const fullPage of [false, true]) {
        await page.evaluate(() => window.scrollTo(0, 0));
        const name = `${capture}-${item.width}-${item.locale}-${item.fixture}${item.forcedColors ? "-forced-colors" : ""}${fullPage ? "-full" : ""}.png`;
        const image = await page.screenshot({ path: join(output, name), fullPage, animations: "disabled" });
        files.push({ name, fullPage, sha256: createHash("sha256").update(image).digest("hex") });
      }
      manifest.push({ ...item, route, ...geometry, files });
      await context.close();
    }
    writeFileSync(join(output, `${capture}-manifest.json`), JSON.stringify({ baseline: "c3fc47c4ac032d87cf10ef279156795aff5cdbab", browser: "Chromium", deviceScaleFactor: 1, reducedMotion: "reduce", fixtureTotals: expectedTotals, captures: manifest }, null, 2) + "\n");
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
    await page.goto(`/en/today?date=${dates.zero}`);
    await expect(page.getByTestId("target-summary")).toContainText("0");
    await expect(page.getByTestId("target-progress")).not.toContainText(/\d+%|Infinity|NaN/);
    await expect(page.getByTestId("target-progress")).toContainText("Not set");
    await page.goto(`/en/today?date=${dates.exceeded}`);
    await expect(page.getByTestId("target-progress")).toContainText("178%");
    await expect(page.getByTestId("target-progress")).toContainText("620");
    await expect(page.getByTestId("target-progress")).toContainText(/over/i);
    await expect(page.getByTestId("target-progress")).not.toContainText(/-620/);
    await expect(page.getByTestId("calorie-summary").locator("circle.calorie-ring-fill")).toHaveAttribute("stroke-dasharray", "100 100");
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
        await expect(page.getByTestId("calorie-summary").locator("circle.calorie-ring-fill")).toHaveAttribute("stroke-dasharray", "100 100");
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
    await expect(row.locator("dl > div").filter({ hasText: "Carbohydrates (g)" }).locator("dd")).toHaveText("0");
    await expect(row.locator("dl > div").filter({ hasText: "Fat (g)" }).locator("dd")).toHaveText("1.25");
    await expect(page.locator('[data-nutrition-metric="protein_g"] dl')).toContainText("0 g");
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
      await expect(page.getByRole("heading", { name: "Finish the basic setup" })).toBeVisible();
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

  test("preserves manual drafts and idempotency through Add Food, native disclosure and edit interactions", async ({ browser }) => {
    const { context, page } = await openPage(browser, { viewport: { width: 390, height: 844 } });
    await page.goto(`/en/today?date=${dates.populated}`);
    const form = page.getByTestId("manual-diary-entry-form");
    await form.locator('input[name="food_name"]').fill("Unsaved synthetic draft");
    await form.locator('input[name="calories"]').fill("0");
    const key = await form.locator('input[name="idempotency_key"]').inputValue();
    const add = page.getByRole("link", { name: "Add food", exact: true }).first();
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
    const add = page.locator('a[href$="#manual-entry"]').first();
    await add.click();
    await expect(page.locator('input[name="entry_date"]')).toHaveValue(dates.empty);
    await expect(page.locator('input[name="food_name"]')).toBeVisible();
    await context.close();
  });
});
