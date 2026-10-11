import { provisionActivatedLocalUser, queryLocalAuthFixture } from "@/e2e/helpers/local-auth";
import AxeBuilder from "@axe-core/playwright";
import { execFileSync } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { expect, test, type Browser, type BrowserContext, type Page } from "@playwright/test";
import type { Database, Json } from "@/lib/supabase/database.types";

const localSupabaseUrl = process.env.LOCAL_SUPABASE_URL;
const localSupabasePublishableKey = process.env.LOCAL_SUPABASE_PUBLISHABLE_KEY;
const localOnly = process.env.DATE_E2E_LOCAL_SUPABASE === "1";
const password = "UiPhase4SyntheticPassword123!";
const date = "2026-01-15";
const configPath = "/private/tmp/ui-phase4-capture-config.json";
const captureConfig: { capture?: "before" | "after"; fixturePath?: string; evidenceDir?: string; reuseFixture?: boolean } = existsSync(configPath) ? JSON.parse(readFileSync(configPath, "utf8")) : {};
const capture = captureConfig.capture;
const fixturePath = captureConfig.fixturePath ?? "/private/tmp/ui-phase4-capture-fixture.json";
const renderedSources = ["app/[locale]/(app)/foods/page.tsx", "app/[locale]/(app)/foods/reuse/page.tsx", "app/[locale]/(app)/foods/barcode/page.tsx", "app/[locale]/(app)/today/page.tsx", "components/foods/food-favorite-control.tsx", "components/barcodes/barcode-lookup-form.tsx", "components/barcodes/barcode-camera-scanner.tsx", "components/diary/diary-entry-form.tsx", "app/globals.css", "messages/en.json", "messages/he.json"];
type Fixture = { searchTerm: string; barcode: string; email: string; emptyEmail: string; yogurtId: string; oatsId: string; appleId: string; crispbreadId: string; savedMealId: string; recipeId: string };
const copy = {
  en: { query: "Food name, alias, or brand", submit: "Search foods", select: "Use in diary", add: "Add entry", favorite: "Add Apple · תפוח to favorites", unfavorite: "Remove Apple · תפוח from favorites" },
  he: { query: "שם מזון, כינוי או מותג", submit: "חיפוש מזונות", select: "שימוש ביומן", add: "הוספת רשומה", favorite: "הוספת Apple · תפוח למועדפים", unfavorite: "הסרת Apple · תפוח מהמועדפים" },
} as const;

test.skip(!localOnly || !localSupabaseUrl || !localSupabasePublishableKey, "Food discovery requires the safe local fixture runner.");

test.describe.serial("Phase 4 food discovery and logging presentation", () => {
  let state: Awaited<ReturnType<BrowserContext["storageState"]>>;
  let emptyState: Awaited<ReturnType<BrowserContext["storageState"]>>;
  let client: SupabaseClient<Database>;
  let userId: string;
  let fixture: Fixture;

  function localClient() {
    return createClient<Database>(localSupabaseUrl as string, localSupabasePublishableKey as string, { auth: { autoRefreshToken: false, persistSession: false } });
  }

  async function signInUi(browser: Browser, email: string) {
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.goto("/en/auth/sign-in");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password").fill(password);
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await expect(page).toHaveURL(/\/en\/today\?date=\d{4}-\d{2}-\d{2}$/);
    const storage = await context.storageState();
    await context.close();
    return storage;
  }

  async function openPage(browser: Browser, options: Parameters<Browser["newContext"]>[0] = {}, empty = false) {
    const context = await browser.newContext({ ...options, storageState: empty ? emptyState : state });
    return { context, page: await context.newPage() };
  }

  async function seedFixture() {
    const custom = await client.rpc("persist_custom_food", {
      p_aliases: [{ alias_text: `${fixture.searchTerm} yogurt`, language_code: "en" }] as Json,
      p_brand_name: "Synthetic kitchen", p_food_id: null as unknown as string, p_locale: "und", p_name: "Greek yogurt · יוגורט", p_nutrient_basis: "per_serving",
      p_nutrients: [{ code: "energy_kcal", amount: 180 }, { code: "protein_g", amount: 20 }, { code: "carbohydrates_g", amount: 12 }, { code: "fat_g", amount: 4 }] as Json,
      p_serving_quantity: 200, p_serving_unit: "g",
    });
    expect(custom.error).toBeNull();
    fixture.yogurtId = custom.data?.[0].food_id as string;
    queryLocalAuthFixture(`
      insert into public.foods (id, food_type, name, brand_name, locale, serving_size, serving_unit, data_quality, is_public, is_archived, source_id) values
        ('${fixture.oatsId}', 'generic', 'Rolled oats', 'Synthetic pantry', 'en', 60, 'g', 'verified', true, false, (select id from public.food_sources where code = 'usda')),
        ('${fixture.appleId}', 'generic', 'Apple · תפוח', null, 'und', null, null, 'unknown', true, false, null),
        ('${fixture.crispbreadId}', 'branded', 'Wholegrain crispbread with sesame · פריכיות', '${"SyntheticLongUnbrokenBrand".repeat(4)}', 'he', 1, 'piece', 'curated', true, false, (select id from public.food_sources where code = 'manual'));
      insert into public.food_aliases (food_id, alias_text, language_code) values
        ('${fixture.oatsId}', '${fixture.searchTerm} oats', 'en'), ('${fixture.appleId}', '${fixture.searchTerm} apple', 'en'), ('${fixture.crispbreadId}', '${fixture.searchTerm} crispbread', 'en');
      insert into public.food_nutrients (food_id, nutrient_id, amount, basis) values
        ('${fixture.oatsId}', (select id from public.nutrients where code = 'energy_kcal'), 215, 'per_serving'),
        ('${fixture.oatsId}', (select id from public.nutrients where code = 'protein_g'), 7.5, 'per_serving'),
        ('${fixture.oatsId}', (select id from public.nutrients where code = 'fat_g'), 0, 'per_serving');
      insert into public.food_barcodes (food_id, canonical_gtin, provenance_source_id, provenance_source_food_id, verification_status) values
        ('${fixture.oatsId}', '${fixture.barcode}', (select id from public.food_sources where code = 'usda'), 'ui-phase4-synthetic-oats', 'curated_verified');
    `);
    const favorites = await client.from("food_favorites").insert([{ user_id: userId, food_id: fixture.yogurtId }, { user_id: userId, food_id: fixture.oatsId }]);
    expect(favorites.error).toBeNull();
    const diary = await client.from("diary_entries").insert([
      { user_id: userId, entry_date: date, meal_type: "breakfast", source: "manual", food_id: fixture.yogurtId, food_name: "Greek yogurt · יוגורט", brand_name: "Synthetic kitchen", serving_quantity: 200, serving_unit: "g", calories: 180, protein_g: 20, carbohydrates_g: 12, fat_g: 4, created_at: `${date}T08:00:00Z` },
      { user_id: userId, entry_date: date, meal_type: "breakfast", source: "manual", food_id: fixture.oatsId, food_name: "Rolled oats", serving_quantity: 60, serving_unit: "g", calories: 215, protein_g: 7.5, carbohydrates_g: null, fat_g: 0, created_at: `${date}T08:05:00Z` },
    ]);
    expect(diary.error).toBeNull();
    const profile = await client.from("profiles").insert({ id: userId, display_name: "Synthetic discovery reviewer", preferred_language: "en", unit_system: "metric" });
    expect(profile.error).toBeNull();
    const targets = await client.from("nutrition_targets").insert({ user_id: userId, effective_from: "2026-01-01", calories: 1800, protein_g: 110, carbohydrates_g: 220, fat_g: 65 });
    expect(targets.error).toBeNull();
    const meal = await client.rpc("persist_saved_meal", { p_expected_edit_revision: null as unknown as number, p_items: [{ position: 1, food_id: null, food_name: "Chickpea salad · סלט", brand_name: null, serving_quantity: 1, serving_unit: "bowl", calories: 420, protein_g: 28, carbohydrates_g: 52, fat_g: 12, notes: null }] as Json, p_locale: "und", p_name: "Synthetic lunch", p_saved_meal_id: null as unknown as string });
    expect(meal.error).toBeNull();
    fixture.savedMealId = meal.data?.[0].saved_meal_id as string;
    const recipe = await client.rpc("persist_recipe", { p_ingredients: [{ position: 1, food_id: null, ingredient_name: "Synthetic lentil soup", brand_name: null, quantity: 1, unit: "bowl", calories: 510, protein_g: 30, carbohydrates_g: 75, fat_g: 10, notes: null }] as Json, p_locale: "und", p_name: "Lentil soup · מרק עדשים", p_recipe_id: null as unknown as string, p_yield_servings: 1 });
    expect(recipe.error).toBeNull();
    fixture.recipeId = recipe.data?.[0].recipe_id as string;
  }

  test.beforeAll(async ({ browser }) => {
    client = localClient();
    if (capture === "after" || captureConfig.reuseFixture) {
      fixture = JSON.parse(readFileSync(fixturePath, "utf8")) as Fixture;
      const auth = await client.auth.signInWithPassword({ email: fixture.email, password });
      expect(auth.error).toBeNull();
      userId = auth.data.user?.id as string;
    } else {
      const run = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const payload = `8${String(Date.now() % 100_000_000_000).padStart(12, "0")}`;
      const sum = [...payload].reverse().reduce((total, digit, index) => total + Number(digit) * (index % 2 === 0 ? 3 : 1), 0);
      fixture = { searchTerm: capture ? "Discovery" : `Phase4-${run}`, barcode: `${payload}${(10 - sum % 10) % 10}`, email: `ui-phase4-${run}@example.test`, emptyEmail: `ui-phase4-empty-${run}@example.test`, yogurtId: "", oatsId: randomUUID(), appleId: randomUUID(), crispbreadId: randomUUID(), savedMealId: "", recipeId: "" };
      const auth = await provisionActivatedLocalUser(client, { email: fixture.email, password });
      expect(auth.error).toBeNull();
      userId = auth.data.user?.id as string;
      const emptyAuth = await provisionActivatedLocalUser(localClient(), { email: fixture.emptyEmail, password });
      expect(emptyAuth.error).toBeNull();
      await seedFixture();
      if (capture === "before") writeFileSync(fixturePath, JSON.stringify(fixture), { mode: 0o600 });
    }
    state = await signInUi(browser, fixture.email);
    emptyState = await signInUi(browser, fixture.emptyEmail);
  });

  test("captures reproducible visual evidence", async ({ browser }) => {
    test.skip(!capture, "Explicit evidence capture only.");
    test.setTimeout(180_000);
    const output = captureConfig.evidenceDir ?? join(process.cwd(), "docs/evidence/ui-phase4");
    mkdirSync(output, { recursive: true });
    const captures: { width: number; height: number; locale: "en" | "he"; screen: string; fullPage?: boolean }[] = [
      ...(["en", "he"] as const).flatMap(locale => [
        { width: 390, height: 844, locale, screen: "search-initial" }, { width: 390, height: 844, locale, screen: "search-populated", fullPage: true },
        { width: 1440, height: 900, locale, screen: "search-populated" }, { width: 390, height: 844, locale, screen: "reuse-populated" },
        { width: 390, height: 844, locale, screen: "barcode-initial" }, { width: 390, height: 844, locale, screen: "today-handoff", fullPage: true },
      ]),
      { width: 390, height: 844, locale: "en", screen: "reuse-empty" }, { width: 390, height: 844, locale: "en", screen: "barcode-found" },
      { width: 320, height: 720, locale: "he", screen: "search-populated", fullPage: true }, { width: 1024, height: 900, locale: "en", screen: "search-populated" },
    ];
    const manifest = [];
    for (const item of captures) {
      const { context, page } = await openPage(browser, { viewport: { width: item.width, height: item.height }, deviceScaleFactor: 1 }, item.screen === "reuse-empty");
      await page.emulateMedia({ reducedMotion: "reduce" });
      const routes: Record<string, string> = {
        "search-initial": `/${item.locale}/foods?date=${date}`, "search-populated": `/${item.locale}/foods?date=${date}&q=${fixture.searchTerm}`,
        "reuse-populated": `/${item.locale}/foods/reuse?date=${date}`, "reuse-empty": `/${item.locale}/foods/reuse?date=${date}`,
        "barcode-initial": `/${item.locale}/foods/barcode?date=${date}&mealType=lunch`, "barcode-found": `/${item.locale}/foods/barcode?date=${date}&mealType=lunch&code=${fixture.barcode}`,
        "today-handoff": `/${item.locale}/today?date=${date}&mealType=breakfast&foodId=${fixture.yogurtId}`,
      };
      const route = routes[item.screen];
      await page.goto(route);
      await expect(page.locator("main h1")).toBeVisible();
      if (item.screen === "search-populated") await expect(page.getByTestId("food-search-results").locator("[data-food-id]")).toHaveCount(4);
      if (item.screen === "barcode-found") await expect(page.getByTestId("barcode-found_public")).toBeVisible();
      if (item.screen === "today-handoff") {
        await expect(page.getByTestId("selected-food-summary")).toBeVisible();
        await page.getByTestId("selected-food-summary").evaluate(element => element.scrollIntoView({ block: "start" }));
      }
      await page.evaluate(() => document.fonts.ready);
      const geometry = await page.evaluate(() => ({ viewportWidth: document.documentElement.clientWidth, documentWidth: document.documentElement.scrollWidth, direction: document.documentElement.dir, scrollY: window.scrollY }));
      if (capture === "after") expect(geometry.documentWidth).toBeLessThanOrEqual(geometry.viewportWidth);
      const files = [];
      for (const fullPage of item.fullPage ? [false, true] : [false]) {
        const name = `${capture}-${item.width}-${item.locale}-${item.screen}${fullPage ? "-full" : ""}.png`;
        const bytes = await page.screenshot({ path: join(output, name), fullPage, animations: "disabled" });
        files.push({ name, sha256: createHash("sha256").update(bytes).digest("hex"), width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20), fullPage });
      }
      manifest.push({ ...item, route, ...geometry, files });
      await context.close();
    }
    const sources = [...renderedSources];
    if (capture === "after") {
      for (const path of ["components/foods/food-discovery-navigation.tsx", "components/foods/food-discovery-header.tsx", "components/foods/food-result-card.tsx", "components/foods/food-result-metadata.tsx", "components/foods/food-discovery-options.tsx", "components/foods/food-discovery-date-context.tsx", "app/[locale]/(app)/saved-meals/page.tsx", "app/[locale]/(app)/recipes/page.tsx"]) if (existsSync(path)) sources.push(path);
    }
    writeFileSync(join(output, `${capture}-manifest.json`), JSON.stringify({ baseline: "88b332c042ee9c461ffeaa20494e2a69c77ff6a3", evidenceVersion: capture, browser: "Chromium", deviceScaleFactor: 1, reducedMotion: "reduce", fixture: "Same activated synthetic local account and rows for before/after; separate empty account. Owned mixed-language yogurt, readable public oats with barcode, missing-serving apple, long unbroken crispbread brand, matched aliases, favorites/recent overlap, fixed historical date 2026-01-15. No production or personal data.", selectedFoodNutrition: { calories: 180, protein_g: 20, carbohydrates_g: 12, fat_g: 4, serving_quantity: 200, serving_unit: "g" }, captures: manifest, renderedSourceFiles: sources.map(path => ({ path, sha256: createHash("sha256").update(capture === "before" ? execFileSync("git", ["show", `88b332c042ee9c461ffeaa20494e2a69c77ff6a3:${path}`]) : readFileSync(path)).digest("hex") })) }, null, 2) + "\n");
  });


  async function assertNoOverflow(page: Page, width: number) {
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
  }

  async function assertPracticalTargets(page: Page) {
    for (const target of await page.locator("main a.ui-button, main button:not([disabled]), main summary, #food-search-query, #barcode-lookup-form input:not([type=hidden]), #barcode-lookup-form select").all()) {
      if (!await target.isVisible()) continue;
      const bounds = await target.boundingBox();
      expect(bounds?.height, await target.textContent() ?? "input").toBeGreaterThanOrEqual(43.5);
      if (await target.evaluate(element => element.matches("button, summary"))) expect(bounds?.width).toBeGreaterThanOrEqual(43.5);
    }
  }

  test("keeps search immediately available and discovery reflow usable at every required width and locale", async ({ browser }) => {
    test.setTimeout(180_000);
    for (const locale of ["en", "he"] as const) {
      for (const width of [320, 390, 768, 1024, 1280, 1440]) {
        const { context, page } = await openPage(browser, { viewport: { width, height: width === 320 ? 720 : 900 } });
        for (const path of [`/${locale}/foods?date=${date}`, `/${locale}/foods?date=${date}&q=${fixture.searchTerm}`, `/${locale}/foods/reuse?date=${date}`, `/${locale}/foods/barcode?date=${date}`]) {
          await page.goto(path);
          await expect(page.locator("html")).toHaveAttribute("dir", locale === "he" ? "rtl" : "ltr");
          const nav = page.getByTestId("food-discovery-navigation");
          await expect(nav.locator('a[aria-current="page"]')).toHaveCount(1);
          const current = new URL((await nav.locator('a[aria-current="page"]').getAttribute("href"))!, "http://127.0.0.1");
          expect(current.pathname).toBe(new URL(path, "http://127.0.0.1").pathname);
          await expect(nav.locator("a")).toHaveCount(3);
          await assertNoOverflow(page, width);
          if (path.endsWith(`/foods?date=${date}`)) {
            expect(await page.evaluate(() => window.scrollY)).toBe(0);
            await expect(page.locator("#food-search-query")).toBeInViewport({ ratio: 1 });
            await expect(page.locator("#food-search-query")).toHaveAttribute("type", "search");
            await expect(page.locator("#food-search-query")).toHaveAttribute("aria-describedby", "food-search-help");
          }
          if (path.includes(`q=${fixture.searchTerm}`)) {
            await expect(page.getByTestId("food-search-results").locator("[data-food-id]")).toHaveCount(4);
            for (const card of await page.getByTestId("food-search-results").locator("[data-food-id]").all()) {
              await expect(card.locator("details")).not.toHaveAttribute("open");
              await expect(card.locator("h3[dir=auto]")).toBeVisible();
              await expect(card.getByRole("link", { name: copy[locale].select, exact: true })).toBeVisible();
            }
            const oats = page.locator(`[data-food-id="${fixture.oatsId}"]`);
            await expect(oats).not.toContainText(/215|7\.5/);
            await oats.locator("details summary").click();
            await expect(oats.locator("details")).toContainText("USDA FoodData Central");
            await assertNoOverflow(page, width);
          }
          await assertPracticalTargets(page);
        }
        await context.close();
      }
    }
  });

  test("retains native search, metadata disclosure, historical selection, and manual barcode handoff without JavaScript", async ({ browser }) => {
    test.setTimeout(90_000);
    for (const locale of ["en", "he"] as const) {
      const { context, page } = await openPage(browser, { javaScriptEnabled: false, viewport: { width: 390, height: 844 } });
      await page.goto(`/${locale}/today?date=${date}`);
      await page.locator(`#manual-entry a[href="/${locale}/foods?date=${date}"]`).click();
      await page.locator("#food-search-query").fill(fixture.searchTerm);
      await page.locator('form[role=search] button[type=submit]').click();
      await expect(page).toHaveURL(url => url.pathname === `/${locale}/foods` && url.searchParams.get("date") === date && url.searchParams.get("q") === fixture.searchTerm);
      const card = page.locator(`[data-food-id="${fixture.yogurtId}"]`);
      await card.locator("details summary").click();
      await expect(card.locator("details")).toHaveAttribute("open", "");
      await expect(card.locator("details")).toContainText(`${fixture.searchTerm} yogurt`);
      await card.getByRole("link", { name: copy[locale].select, exact: true }).click();
      await expect(page).toHaveURL(url => url.pathname === `/${locale}/today` && url.searchParams.get("date") === date && url.searchParams.get("foodId") === fixture.yogurtId);
      const form = page.getByTestId("manual-diary-entry-form");
      await expect(form.locator('[name=entry_date]')).toHaveValue(date);
      await expect(form.locator('[name=food_name]')).toHaveValue("Greek yogurt · יוגורט");
      await expect(form.locator('[name=calories]')).toHaveValue("180");
      await page.locator(`#manual-entry a[href="/${locale}/foods/reuse?date=${date}"]`).click();
      await page.getByTestId("favorites-foods-list").locator(`[data-food-id="${fixture.yogurtId}"]`).getByRole("link", { name: copy[locale].select, exact: true }).click();
      await expect(form.locator('[name=entry_date]')).toHaveValue(date);
      await expect(form.locator('[name=food_name]')).toHaveValue("Greek yogurt · יוגורט");
      await page.locator(`#manual-entry a[href="/${locale}/foods/barcode?date=${date}"]`).click();
      await page.locator('#barcode-lookup-form [name=mealType]').selectOption("lunch");
      await page.locator('#barcode-lookup-form [name=code]').fill(fixture.barcode);
      await page.locator('#barcode-lookup-form button[type=submit]').click();
      await expect(page.getByTestId("barcode-found_public")).toBeVisible();
      const navigation = page.getByTestId("food-discovery-navigation");
      const scan = new URL((await navigation.locator('a[aria-current="page"]').getAttribute("href"))!, "http://127.0.0.1");
      expect(scan.searchParams.get("date")).toBe(date);
      expect(scan.searchParams.get("mealType")).toBe("lunch");
      for (const link of await navigation.locator('a:not([aria-current="page"])').all()) {
        const destination = new URL((await link.getAttribute("href"))!, "http://127.0.0.1");
        expect(destination.searchParams.get("date")).toBe(date);
        expect(destination.searchParams.has("mealType")).toBe(false);
      }
      const back = page.locator("main header").locator('a[href*="/today?"]');
      const backTarget = new URL((await back.getAttribute("href"))!, "http://127.0.0.1");
      expect(backTarget.searchParams.get("date")).toBe(date);
      expect(backTarget.searchParams.get("mealType")).toBe("lunch");
      const review = page.getByTestId("barcode-found_public").locator('a[href*="/today?"]');
      const target = new URL((await review.getAttribute("href"))!, "http://127.0.0.1");
      expect(target.searchParams.get("date")).toBe(date);
      expect(target.searchParams.get("mealType")).toBe("lunch");
      expect(target.searchParams.get("foodId")).toBe(fixture.oatsId);
      await review.click();
      await expect(form.locator('[name=entry_date]')).toHaveValue(date);
      await expect(form.locator('[name=meal_type]')).toHaveValue("lunch");
      await expect(form.locator('[name=food_name]')).toHaveValue("Rolled oats");
      await expect(form.locator('[name=fat_g]')).toHaveValue("0");
      await expect(form.locator('[name=carbohydrates_g]')).toHaveValue("");
      const name = `Phase 4 native ${locale} review`;
      await form.locator('[name=food_name]').fill(name);
      await form.getByRole("button", { name: copy[locale].add, exact: true }).click();
      await expect(page.locator('[data-diary-entry-id]').filter({ hasText: name })).toBeVisible();
      const logged = await client.from("diary_entries").select("id,entry_date,meal_type,food_id,fat_g,carbohydrates_g").eq("user_id", userId).eq("food_name", name).single();
      expect(logged.error).toBeNull();
      expect(logged.data).toMatchObject({ entry_date: date, meal_type: "lunch", food_id: fixture.oatsId, fat_g: 0, carbohydrates_g: null });
      expect((await client.from("diary_entries").delete().eq("id", logged.data!.id)).error).toBeNull();
      await context.close();
    }
  });

  test("preserves collection membership, favorite persistence, and readable action feedback", async ({ browser }) => {
    const { context, page } = await openPage(browser);
    await page.goto(`/en/foods/reuse?date=${date}`);
    for (const section of ["favorites", "recent"]) {
      const list = page.getByTestId(`${section}-foods-list`);
      await expect(list.locator(`[data-food-id="${fixture.yogurtId}"]`)).toHaveCount(1);
      await expect(list.locator(`[data-food-id="${fixture.oatsId}"]`)).toHaveCount(1);
    }
    await page.goto(`/en/foods?date=${date}&q=${fixture.searchTerm}`);
    const apple = page.locator(`[data-food-id="${fixture.appleId}"]`);
    await apple.getByRole("button", { name: copy.en.favorite, exact: true }).click();
    await expect(apple.getByRole("status")).toContainText("Added to favorites");
    await expect(apple.getByRole("button", { name: copy.en.unfavorite, exact: true })).toHaveAttribute("aria-pressed", "true");
    const favorite = await client.from("food_favorites").select("food_id").eq("user_id", userId).eq("food_id", fixture.appleId);
    expect(favorite.data).toHaveLength(1);
    await apple.getByRole("button", { name: copy.en.unfavorite, exact: true }).click();
    await expect(apple.getByRole("status")).toContainText("Removed from favorites");
    const removed = await client.from("food_favorites").select("food_id").eq("user_id", userId).eq("food_id", fixture.appleId);
    expect(removed.data).toHaveLength(0);
    await context.close();
  });

  test("distinguishes initial, invalid, too-short, no-result, and empty collection states", async ({ browser }) => {
    const { context, page } = await openPage(browser);
    const states = [["", "initial"], ["&q=a", "too-short"], [`&q=${fixture.searchTerm}&q=oats`, "invalid"], [`&q=${"x".repeat(101)}`, "invalid"], ["&q=zzphase4nomatchqq", "empty"]] as const;
    for (const [query, stateName] of states) {
      await page.goto(`/en/foods?date=${date}${query}`);
      await expect(page.getByTestId(`food-search-${stateName}`)).toBeVisible();
      await expect(page.getByTestId("food-search-results")).toHaveCount(0);
    }
    await page.goto(`/en/foods?date=2026-02-30&q=${fixture.searchTerm}`);
    await expect(page.getByTestId("food-search-date-context-invalid")).toBeVisible();
    await expect(page.locator(`[data-food-id="${fixture.yogurtId}"]`).getByRole("link", { name: copy.en.select, exact: true })).not.toHaveAttribute("href", /date=/);
    await context.close();
    const empty = await openPage(browser, {}, true);
    await empty.page.goto(`/en/foods/reuse?date=${date}`);
    await expect(empty.page.getByTestId("favorites-foods-empty")).toBeVisible();
    await expect(empty.page.getByTestId("recent-foods-empty")).toBeVisible();
    await expect(empty.page.getByTestId("reusable-foods-error")).toHaveCount(0);
    await empty.context.close();
  });

  test("retains selected historical date through supported discovery and prepared-item routes", async ({ browser }) => {
    const { context, page } = await openPage(browser);
    await page.goto(`/en/foods?date=${date}`);
    for (const link of await page.getByTestId("food-discovery-navigation").locator("a").all()) await expect(link).toHaveAttribute("href", new RegExp(`date=${date}`));
    const options = page.locator("main details").filter({ has: page.locator('a[href*="/saved-meals"]') });
    await options.locator("summary").click();
    for (const path of ["saved-meals", "recipes"]) {
      const link = options.locator(`a[href*="/${path}"]`);
      await expect(link).toHaveAttribute("href", new RegExp(`date=${date}`));
      await link.click();
      const itemId = path === "saved-meals" ? fixture.savedMealId : fixture.recipeId;
      const use = page.locator(`a[href*="/${itemId}/use"]`);
      await expect(use).toHaveAttribute("href", new RegExp(`date=${date}`));
      await use.click();
      await expect(page.locator('main input[type="date"]')).toHaveValue(date);
      await page.goto(`/en/foods?date=${date}`);
      await options.locator("summary").click();
    }
    await context.close();
  });

  test("requires explicit editable snapshot submission and preserves blank, zero, and serving semantics", async ({ browser }) => {
    const { context, page } = await openPage(browser);
    const before = await client.from("diary_entries").select("id").eq("user_id", userId).eq("entry_date", date);
    expect(before.error).toBeNull();
    await page.goto(`/en/today?date=${date}`);
    await page.locator(`#manual-entry a[href="/en/foods?date=${date}"]`).click();
    await page.locator("#food-search-query").fill(fixture.searchTerm);
    await page.locator('form[role=search] button[type=submit]').click();
    await page.locator(`[data-food-id="${fixture.oatsId}"]`).getByRole("link", { name: copy.en.select, exact: true }).click();
    const form = page.getByTestId("manual-diary-entry-form");
    await expect(page.getByTestId("selected-food-summary")).toContainText("Rolled oats");
    await expect(form.locator('[name=entry_date]')).toHaveValue(date);
    await expect(form.locator('[name=calories]')).toHaveValue("215");
    await expect(form.locator('[name=fat_g]')).toHaveValue("0");
    await expect(form.locator('[name=carbohydrates_g]')).toHaveValue("");
    const selected = await client.from("diary_entries").select("id").eq("user_id", userId).eq("entry_date", date);
    expect(selected.data).toHaveLength(before.data!.length);
    await form.locator('[name=serving_quantity]').fill("2");
    await expect(form.locator('[name=calories]')).toHaveValue("215");
    await form.locator('[name=meal_type]').selectOption("dinner");
    await form.locator('[name=food_name]').fill("Phase 4 reviewed oats");
    await form.locator('[name=calories]').fill("0");
    await form.getByRole("button", { name: copy.en.add, exact: true }).click();
    await expect(page.locator('[data-diary-entry-id]').filter({ hasText: "Phase 4 reviewed oats" })).toBeVisible();
    const logged = await client.from("diary_entries").select("id,entry_date,meal_type,food_id,serving_quantity,calories,fat_g,carbohydrates_g").eq("user_id", userId).eq("food_name", "Phase 4 reviewed oats").single();
    expect(logged.error).toBeNull();
    expect(logged.data).toMatchObject({ entry_date: date, meal_type: "dinner", food_id: fixture.oatsId, serving_quantity: 2, calories: 0, fat_g: 0, carbohydrates_g: null });
    const cleanup = await client.from("diary_entries").delete().eq("id", logged.data!.id);
    expect(cleanup.error).toBeNull();
    await context.close();
  });

  test("keeps localized accessible names and navigation semantics with zero axe violations", async ({ browser }) => {
    test.setTimeout(120_000);
    for (const locale of ["en", "he"] as const) {
      const { context, page } = await openPage(browser, { viewport: { width: 390, height: 844 } });
      for (const path of [`/${locale}/foods?date=${date}&q=${fixture.searchTerm}`, `/${locale}/foods/reuse?date=${date}`, `/${locale}/foods/barcode?date=${date}&code=${fixture.barcode}`, `/${locale}/today?date=${date}&foodId=${fixture.yogurtId}`]) {
        await page.goto(path);
        await expect(page.locator("main h1")).toHaveCount(1);
        expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
        for (const icon of await page.locator("main .ui-button svg, main summary svg").all()) await expect(icon).toHaveAttribute("aria-hidden", "true");
      }
      await context.close();
    }
  });

  test("preserves native keyboard focus and disclosures in reduced motion and forced colors", async ({ browser }) => {
    for (const locale of ["en", "he"] as const) {
      const { context, page } = await openPage(browser, { viewport: { width: 320, height: 720 } });
      await page.emulateMedia({ reducedMotion: "reduce", forcedColors: "active" });
      await page.goto(`/${locale}/foods?date=${date}&q=${fixture.searchTerm}`);
      const query = page.locator("#food-search-query");
      await query.focus();
      await expect(query).toBeFocused();
      const focus = await query.evaluate(element => ({ outline: getComputedStyle(element).outlineStyle, width: getComputedStyle(element).outlineWidth, shadow: getComputedStyle(element).boxShadow }));
      expect(focus.outline !== "none" && focus.width !== "0px" || focus.shadow !== "none").toBe(true);
      const summary = page.locator(`[data-food-id="${fixture.yogurtId}"] details summary`);
      await summary.focus();
      await page.keyboard.press("Enter");
      await expect(page.locator(`[data-food-id="${fixture.yogurtId}"] details`)).toHaveAttribute("open", "");
      await page.keyboard.press("Enter");
      await expect(page.locator(`[data-food-id="${fixture.yogurtId}"] details`)).not.toHaveAttribute("open");
      await assertNoOverflow(page, 320);
      await context.close();
    }
  });

  test("preserves selected-food drafts and idempotency while disclosures and final controls remain usable", async ({ browser }) => {
    const { context, page } = await openPage(browser, { viewport: { width: 390, height: 844 } });
    const route = `/en/today?date=${date}&foodId=${fixture.yogurtId}`;
    await page.goto(route);
    const form = page.getByTestId("manual-diary-entry-form");
    await form.locator('[name=notes]').fill("Phase 4 preserved synthetic draft");
    const key = await page.getByTestId("manual-diary-idempotency-key").inputValue();
    await form.evaluate(element => { element.dataset.phase4Identity = "original-form"; });
    const details = page.getByTestId("selected-food-summary").locator("details");
    await details.locator("summary").click();
    await expect(details).toHaveAttribute("open", "");
    await expect(form).toHaveAttribute("data-phase4-identity", "original-form");
    await expect(form.locator('[name=notes]')).toHaveValue("Phase 4 preserved synthetic draft");
    await expect(page.getByTestId("manual-diary-idempotency-key")).toHaveValue(key);
    await page.reload();
    await expect(form.locator('[name=notes]')).toHaveValue("Phase 4 preserved synthetic draft");
    await expect(page.getByTestId("manual-diary-idempotency-key")).toHaveValue(key);
    const submit = form.getByRole("button", { name: copy.en.add, exact: true });
    await submit.focus();
    await expect(submit).toBeFocused();
    const button = await submit.boundingBox();
    const navigation = await page.getByTestId("mobile-bottom-navigation").boundingBox();
    expect(button!.height).toBeGreaterThanOrEqual(44);
    expect(button!.y + button!.height).toBeLessThanOrEqual(navigation!.y);
    await context.close();
  });


  test("recovers invalid and repeated listing dates natively and retains historical context across filters and lists", async ({ browser }) => {
    test.setTimeout(90_000);
    for (const locale of ["en", "he"] as const) {
      const { context, page } = await openPage(browser, { javaScriptEnabled: false });
      for (const path of ["saved-meals", "recipes"] as const) {
        const prefix = path === "saved-meals" ? "saved-meal" : "recipe";
        for (const query of ["date=2026-02-30", `date=${date}&date=${date}`]) {
          await page.goto(`/${locale}/${path}?${query}`);
          await expect(page.getByTestId("food-discovery-date-error")).toBeVisible();
          await expect(page.getByRole("alert")).toBeVisible();
          await expect(page.getByTestId(`${prefix}-management-list`)).toHaveCount(0);
          await expect(page.locator('main a[href*="/use"]')).toHaveCount(0);
          await page.locator("#food-discovery-recovery-date").fill(date);
          await page.getByTestId("food-discovery-date-error").locator('button[type=submit]').click();
          await expect(page).toHaveURL(url => url.pathname === `/${locale}/${path}` && url.searchParams.getAll("date").length === 1 && url.searchParams.get("date") === date);
          await expect(page.getByTestId(`${prefix}-management-list`)).toBeVisible();
          const filter = page.locator('main nav a[href*="status=archived"]');
          const target = new URL((await filter.getAttribute("href"))!, "http://127.0.0.1");
          expect(target.searchParams.get("date")).toBe(date);
          expect(target.searchParams.get("status")).toBe("archived");
          await filter.click();
          await expect(page).toHaveURL(url => url.searchParams.get("date") === date && url.searchParams.get("status") === "archived");
          const next = path === "saved-meals" ? "recipes" : "saved-meals";
          const cross = page.locator(`main header a[href^="/${locale}/${next}?"]`);
          await expect(cross).toHaveAttribute("href", `/${locale}/${next}?date=${date}`);
          await cross.click();
          await expect(page).toHaveURL(url => url.pathname === `/${locale}/${next}` && url.searchParams.get("date") === date);
          const back = page.locator(`main header a[href^="/${locale}/today?"]`);
          await expect(back).toHaveAttribute("href", `/${locale}/today?date=${date}`);
        }
      }
      await context.close();
    }
  });

});
