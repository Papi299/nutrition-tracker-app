import AxeBuilder from "@axe-core/playwright";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { expect, test, type Browser, type BrowserContext, type Locator, type Page, type TestInfo } from "@playwright/test";
import { createHash, randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { isAbsolute, join, relative } from "node:path";
import { provisionActivatedLocalUser, queryLocalAuthFixture } from "@/e2e/helpers/local-auth";
import type { Database, Json } from "@/lib/supabase/database.types";
import en from "@/messages/en.json";
import he from "@/messages/he.json";

const localUrl = process.env.LOCAL_SUPABASE_URL;
const localKey = process.env.LOCAL_SUPABASE_PUBLISHABLE_KEY;
const localOnly = process.env.DATE_E2E_LOCAL_SUPABASE === "1";
const locales = ["en", "he"] as const;
const modes = [false, true] as const;
const widths = [320, 390, 768, 1024, 1440] as const;
const date = "2026-09-20";
const copies = { en, he };
type Locale = (typeof locales)[number];
type Account = { client: SupabaseClient<Database>; id: string; state: Awaited<ReturnType<BrowserContext["storageState"]>> };
type Evidence = { records: unknown[]; screenshots: unknown[]; axe: unknown[] };
const hash = (value: string | Buffer) => createHash("sha256").update(value).digest("hex");
const git = (...args: string[]) => execFileSync("git", args, { encoding: "utf8" }).trim();
const sourceFiles = ["components/language-switcher/language-switcher.tsx", "lib/i18n/locale-query.ts", "components/setup/setup-page.tsx", "app/[locale]/setup/nojs/page.tsx", "app/[locale]/(app)/foods/custom/[foodId]/edit/page.tsx", "messages/en.json", "messages/he.json"];

test.skip(!localOnly || !localUrl || !localKey, "Final UI corrections require the existing isolated local-only runner.");
test.use({ trace: "off", video: "off" });

function evidenceDirectory(info: TestInfo) {
  const value = info.project.metadata.correctionsEvidenceDirectory;
  if (typeof value !== "string") return null;
  if (!isAbsolute(value) || !relative(process.cwd(), value).startsWith("..")) throw new Error("Correction evidence must be outside the source checkout.");
  const directory = join(value, info.project.name, info.title.replace(/[^A-Za-z0-9_-]+/g, "-"));
  mkdirSync(directory, { recursive: true });
  return directory;
}

function persistEvidence(info: TestInfo, browser: Browser, evidence: Evidence) {
  const directory = evidenceDirectory(info);
  if (!directory) return;
  const files = sourceFiles.filter(existsSync);
  writeFileSync(join(directory, "manifest.json"), JSON.stringify({
    taskId: "UI_PHASE_5_FINAL_CORRECTIONS_001", timestampUtc: new Date().toISOString(),
    source: { head: git("rev-parse", "HEAD"), tree: git("rev-parse", "HEAD^{tree}"), buildId: existsSync(".next/BUILD_ID") ? readFileSync(".next/BUILD_ID", "utf8").trim() : null,
      productionDiffSha256: hash(git("diff", "HEAD", "--", ...files)), fileSha256: Object.fromEntries(files.map(file => [file, hash(readFileSync(file))])) },
    browser: { project: info.project.name, version: browser.version() }, ...evidence,
    limits: ["Synthetic local fixtures only; no physical devices, actual zoom or manual assistive technology.", "JavaScript-disabled axe is not executed; native DOM, keyboard and database assertions are independent.", "Credentials and Auth storage remain in memory and are excluded from artifacts."],
  }, null, 2) + "\n");
}

async function capture(info: TestInfo, page: Page, evidence: Evidence, label: string) {
  const directory = evidenceDirectory(info);
  if (!directory) return;
  const filename = `${label}.png`;
  const bytes = await page.screenshot({ path: join(directory, filename), animations: "disabled" });
  const url = new URL(page.url());
  evidence.screenshots.push({ filename, sha256: hash(bytes), route: url.pathname + url.search, viewport: page.viewportSize() });
}

async function geometry(page: Page) {
  const result = await page.evaluate(() => ({
    locale: document.documentElement.lang, direction: document.documentElement.dir,
    viewport: { width: innerWidth, height: innerHeight },
    document: { clientWidth: document.documentElement.clientWidth, scrollWidth: document.documentElement.scrollWidth },
    bodyWidth: document.body.scrollWidth, mainCount: document.querySelectorAll("main").length,
  }));
  expect(result.document.scrollWidth).toBeLessThanOrEqual(result.document.clientWidth);
  expect(result.bodyWidth).toBeLessThanOrEqual(result.document.clientWidth);
  expect(result.direction).toBe(result.locale === "he" ? "rtl" : "ltr");
  return result;
}

async function focusedElement(page: Page) {
  return page.evaluate(() => {
    const element = document.activeElement;
    return element ? { tag: element.tagName, id: element.id, name: element.getAttribute("name"), href: element.getAttribute("href"), focusVisible: element.matches(":focus-visible") } : null;
  });
}

async function keyboardFocus(page: Page, target: Locator) {
  const engine = page.context().browser()?.browserType().name() ?? "unknown";
  const platform = process.platform;
  const shortcut = engine === "webkit" && platform === "darwin" ? "Alt+Tab" : "Tab";
  const focusOrder: Awaited<ReturnType<typeof focusedElement>>[] = [];
  for (let step = 0; step < 50; step += 1) {
    await page.keyboard.press(shortcut);
    const activeElement = await focusedElement(page);
    focusOrder.push(activeElement);
    if (await target.evaluate(element => document.activeElement === element)) {
      await expect(target).toBeFocused();
      expect(await target.evaluate(element => element.matches(":focus-visible"))).toBe(true);
      return { steps: step + 1, shortcut, engine, platform, focusOrder, activeElement };
    }
  }
  throw new Error(`The recovery link was not reachable within 50 keyboard ${shortcut} stops on ${engine}/${platform}: ${JSON.stringify(focusOrder)}`);
}

function assertQuery(url: URL, expected: Record<string, string>) {
  expect(Object.fromEntries(url.searchParams)).toEqual(expected);
  expect([...url.searchParams]).toHaveLength(Object.keys(expected).length);
}

async function browserToday(page: Page) {
  return page.evaluate(() => {
    const value = new Date();
    return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;
  });
}

async function axe(page: Page, evidence: Evidence, state: string) {
  const result = await new AxeBuilder({ page }).include("main").withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
  evidence.axe.push({ state, violations: result.violations.map(({ id, impact, nodes }) => ({ id, impact, targets: nodes.map(node => node.target) })) });
  expect(result.violations).toEqual([]);
}

const form = (page: Page) => page.locator('form:has(input[name="effectiveDate"])');
const field = (page: Page, name: string) => form(page).locator(`[name="${name}"]`);

async function values(page: Page) {
  return form(page).locator("input[name],select[name]").evaluateAll(elements => Object.fromEntries(elements.filter(element => ["effectiveDate", "display_name", "preferred_language", "calories", "protein_g", "carbohydrates_g", "fat_g"].includes((element as HTMLInputElement).name)).map(element => [(element as HTMLInputElement).name, (element as HTMLInputElement).value])));
}

async function languageLink(page: Page, locale: Locale) {
  const link = page.locator(`a[hreflang="${locale}"]:visible`).first();
  if (await link.count() === 0) {
    const details = page.getByTestId("mobile-more-navigation");
    await details.locator("summary").click();
  }
  await expect(link).toBeVisible();
  return link;
}

async function localeHrefs(page: Page, path: string, expectedQuery: Record<string, string>) {
  const records: { locale: Locale; href: string }[] = [];
  const origin = new URL(page.url()).origin;
  for (const locale of locales) {
    const links = page.locator(`a[hreflang="${locale}"]`);
    expect(await links.count()).toBeGreaterThan(0);
    for (const href of await links.evaluateAll(elements => elements.map(element => element.getAttribute("href")))) {
      expect(href).not.toBeNull();
      const url = new URL(href!, page.url());
      expect(url.origin).toBe(origin); expect(url.pathname).toBe(`/${locale}${path}`);
      assertQuery(url, expectedQuery);
      records.push({ locale, href: href! });
    }
  }
  return records;
}

async function switchLocale(page: Page, context: BrowserContext, locale: Locale, path: string, expectedQuery: Record<string, string>, javaScriptEnabled: boolean) {
  const sourceUrl = new URL(page.url());
  const renderedLocaleHrefs = await localeHrefs(page, path, expectedQuery);
  const target = await languageLink(page, locale);
  const href = await target.getAttribute("href");
  expect(href).not.toBeNull();
  const targetUrl = new URL(href!, page.url());
  expect(targetUrl.origin).toBe(new URL(page.url()).origin);
  expect(targetUrl.pathname).toBe(`/${locale}${path}`);
  assertQuery(targetUrl, expectedQuery);
  let documentRequests = 0;
  const recordRequest = (request: import("@playwright/test").Request) => { if (request.isNavigationRequest() && request.resourceType() === "document") documentRequests += 1; };
  page.on("request", recordRequest);
  try {
    await target.click();
    await expect(page).toHaveURL(url => url.pathname === `/${locale}${path}` && [...url.searchParams].length === Object.keys(expectedQuery).length && Object.entries(expectedQuery).every(([key, value]) => url.searchParams.get(key) === value));
    assertQuery(new URL(page.url()), expectedQuery);
    await expect(page.locator("html")).toHaveAttribute("lang", locale);
    if (javaScriptEnabled) {
      expect(documentRequests).toBe(0);
      const cookie = (await context.cookies()).find(item => item.name === "nutrition_tracker_locale");
      expect(cookie).toMatchObject({ value: locale, path: "/", sameSite: "Lax" });
      expect(cookie!.expires).toBeGreaterThan(Date.now() / 1000 + 30_000_000);
    } else expect(documentRequests).toBeGreaterThan(0);
  } finally { page.off("request", recordRequest); }
  const destination = new URL(page.url());
  return { source: sourceUrl.pathname + sourceUrl.search, sourceQuery: [...sourceUrl.searchParams], renderedLocaleHrefs, nativeHref: href, nativeQuery: [...targetUrl.searchParams], destination: destination.pathname + destination.search, destinationQuery: [...destination.searchParams], navigation: javaScriptEnabled ? "App Router" : "native document" };
}

test.describe.serial("final Phase 5 bounded corrections", () => {
  let account: Account;
  const run = randomUUID();
  const email = `ui5-final-corrections-${run}@example.test`;
  const password = `Synthetic-${randomUUID()}-A1!`;
  const unavailableId = randomUUID();
  const ids: Record<"food" | "meal" | "recipe", string[]> = { food: [], meal: [], recipe: [] };

  function snapshot() {
    return hash(queryLocalAuthFixture(`select jsonb_build_object(
      'profiles',(select coalesce(jsonb_agg(to_jsonb(x) order by x.id),'[]') from public.profiles x where id='${account.id}'),
      'targets',(select coalesce(jsonb_agg(to_jsonb(x) order by x.id),'[]') from public.nutrition_targets x where user_id='${account.id}'),
      'diary',(select coalesce(jsonb_agg(to_jsonb(x) order by x.id),'[]') from public.diary_entries x where user_id='${account.id}'),
      'foods',(select coalesce(jsonb_agg(to_jsonb(x) order by x.id),'[]') from public.foods x where owner_user_id='${account.id}'),
      'nutrients',(select coalesce(jsonb_agg(to_jsonb(x) order by x.food_id,x.nutrient_id),'[]') from public.food_nutrients x join public.foods f on f.id=x.food_id where f.owner_user_id='${account.id}'),
      'meals',(select coalesce(jsonb_agg(to_jsonb(x) order by x.id),'[]') from public.saved_meals x where user_id='${account.id}'),
      'mealItems',(select coalesce(jsonb_agg(to_jsonb(x) order by x.saved_meal_id,x.position),'[]') from public.saved_meal_items x join public.saved_meals m on m.id=x.saved_meal_id where m.user_id='${account.id}'),
      'recipes',(select coalesce(jsonb_agg(to_jsonb(x) order by x.id),'[]') from public.recipes x where user_id='${account.id}'),
      'ingredients',(select coalesce(jsonb_agg(to_jsonb(x) order by x.recipe_id,x.position),'[]') from public.recipe_ingredients x join public.recipes r on r.id=x.recipe_id where r.user_id='${account.id}')
    );`));
  }

  const contextFor = (browser: Browser, javaScriptEnabled: boolean, authenticated = true) => browser.newContext({ ...(authenticated ? { storageState: account.state } : {}), javaScriptEnabled, timezoneId: "Asia/Jerusalem", viewport: { width: 390, height: 1000 } });

  async function seedLibrary() {
    for (let index = 0; index < 22; index += 1) {
      const archived = index === 21;
      const food = await account.client.rpc("persist_custom_food", { p_aliases: [] as Json, p_brand_name: null as unknown as string, p_food_id: null as unknown as string, p_locale: "en", p_name: `Correction food ${index} אבג`, p_nutrient_basis: "per_serving", p_nutrients: [] as Json, p_serving_quantity: 1, p_serving_unit: "portion" });
      expect(food.error).toBeNull(); ids.food.push(food.data![0].food_id);
      const meal = await account.client.rpc("persist_saved_meal", { p_expected_edit_revision: null as unknown as number, p_locale: "en", p_name: `Correction meal ${index} אבג`, p_saved_meal_id: null as unknown as string, p_items: [{ position: 1, food_id: null, food_name: "Frozen synthetic snapshot", brand_name: null, serving_quantity: null, serving_unit: null, calories: 0, protein_g: null, carbohydrates_g: 0, fat_g: null, notes: null }] as Json });
      expect(meal.error).toBeNull(); ids.meal.push(meal.data![0].saved_meal_id);
      const recipe = await account.client.rpc("persist_recipe", { p_expected_edit_revision: null as unknown as number, p_locale: "en", p_name: `Correction recipe ${index} אבג`, p_recipe_id: null as unknown as string, p_yield_servings: 2, p_ingredients: [{ position: 1, food_id: null, ingredient_name: "Frozen synthetic ingredient", brand_name: null, quantity: null, unit: null, calories: 0, protein_g: null, carbohydrates_g: 0, fat_g: null, notes: null }] as Json });
      expect(recipe.error).toBeNull(); ids.recipe.push(recipe.data![0].recipe_id);
      if (archived) {
        expect((await account.client.rpc("set_custom_food_archived", { p_food_id: ids.food[index], p_is_archived: true })).error).toBeNull();
        expect((await account.client.rpc("set_saved_meal_archived", { p_saved_meal_id: ids.meal[index], p_is_archived: true })).error).toBeNull();
        expect((await account.client.rpc("set_recipe_archived", { p_recipe_id: ids.recipe[index], p_is_archived: true })).error).toBeNull();
      }
    }
  }

  test.beforeAll(async ({ browser }) => {
    test.setTimeout(120_000);
    if (!localUrl || !["localhost", "127.0.0.1"].includes(new URL(localUrl).hostname)) throw new Error("Refusing nonlocal correction fixtures.");
    const client = createClient<Database>(localUrl, localKey!, { auth: { autoRefreshToken: false, persistSession: false } });
    const signedIn = await provisionActivatedLocalUser(client, { email, password });
    const id = signedIn.data.user!.id; expect(id).toMatch(/^[0-9a-f-]{36}$/);
    const context = await browser.newContext();
    try {
      const page = await context.newPage(); await page.goto("/en/auth/sign-in");
      await page.getByLabel("Email").fill(email); await page.getByLabel("Password", { exact: true }).fill(password);
      await page.getByRole("button", { name: "Sign in", exact: true }).click(); await expect(page).toHaveURL(/\/en\/today\?date=/);
      account = { client, id, state: await context.storageState() };
    } finally { await context.close(); }
    await seedLibrary();
  });

  test.afterAll(async () => { if (account) await account.client.auth.signOut(); });

  for (const locale of locales) {
    test(`R1 ${locale} progressive landmarks, accurate dates and zero/null persistence`, async ({ browser }, info) => {
      test.setTimeout(180_000);
      const evidence: Evidence = { records: [], screenshots: [], axe: [] };
      try {
        for (const javaScriptEnabled of modes) {
          const context = await contextFor(browser, javaScriptEnabled);
          try {
            const page = await context.newPage(); const before = snapshot();
            await page.goto(`/${locale}/setup/nojs?effectiveDate=${date}`);
            for (const width of widths) {
              await page.setViewportSize({ width, height: 1000 });
              await expect(field(page, "effectiveDate")).toHaveValue(date);
              await field(page, "display_name").focus(); await page.keyboard.press("Tab");
              await expect(field(page, "preferred_language")).toBeFocused();
              const measure = await geometry(page); expect(measure.mainCount).toBe(1);
              await expect(page.locator("main main")).toHaveCount(0);
              expect(snapshot()).toBe(before);
              evidence.records.push({ state: "progressive-ready", locale, javaScriptEnabled, width, geometry: measure, canonicalEffectiveDate: await field(page, "effectiveDate").inputValue(), focus: await focusedElement(page), values: await values(page), databaseUnchanged: true, snapshotSha256: before });
            }
            await page.setViewportSize({ width: 390, height: 1000 });
            if (!javaScriptEnabled) await capture(info, page, evidence, "progressive-ready");
            await field(page, "display_name").fill("W".repeat(81)); await field(page, "preferred_language").selectOption(locale);
            await field(page, "calories").fill("0"); await field(page, "protein_g").fill(""); await field(page, "carbohydrates_g").fill("2.125"); await field(page, "fat_g").fill("0");
            const submitted = await values(page); await form(page).locator('button[type="submit"]').click();
            await expect(field(page, "display_name")).toHaveAttribute("aria-invalid", "true");
            expect(await values(page)).toEqual(submitted);
            const descriptions = await field(page, "display_name").evaluate(element => (element.getAttribute("aria-describedby") ?? "").split(/\s+/).filter(Boolean).map(id => document.getElementById(id)?.textContent));
            expect(descriptions).toContain(copies[locale].Setup.errors.displayNameTooLong);
            expect(snapshot()).toBe(before);
            for (const width of widths) {
              await page.setViewportSize({ width, height: 1000 });
              const retainedValues = await values(page); expect(retainedValues).toEqual(submitted);
              await expect(field(page, "effectiveDate")).toHaveValue(date);
              await field(page, "display_name").focus(); await page.keyboard.press("Tab");
              await expect(field(page, "preferred_language")).toBeFocused();
              const measure = await geometry(page); expect(measure.mainCount).toBe(1);
              await expect(page.locator("main main")).toHaveCount(0);
              expect(snapshot()).toBe(before);
              evidence.records.push({ state: "progressive-rejected", locale, javaScriptEnabled, width, geometry: measure, canonicalEffectiveDate: await field(page, "effectiveDate").inputValue(), focus: await focusedElement(page), submittedValues: submitted, retainedValues, descriptions, databaseUnchanged: true, snapshotSha256: before });
            }
            await page.setViewportSize({ width: 390, height: 1000 });
            if (!javaScriptEnabled) await capture(info, page, evidence, "progressive-rejected");

            const today = await browserToday(page);
            for (const effectiveDate of [today, date, "2090-01-15"]) for (const suffix of ["", "/nojs"]) {
              await page.goto(`/${locale}/setup${suffix}?effectiveDate=${effectiveDate}`);
              const measure = await geometry(page); expect(measure.mainCount).toBe(1); await expect(page.locator("main main")).toHaveCount(0);
              await expect(field(page, "effectiveDate")).toHaveValue(effectiveDate);
              const description = copies[locale].Setup.targets.description.replace("{date}", effectiveDate);
              const renderedDescription = page.getByText(description, { exact: true });
              await expect(renderedDescription).toBeVisible();
              expect(description).not.toContain("the current calendar date on this device"); expect(description).not.toContain("התאריך הנוכחי במכשיר הזה");
              const canonicalEffectiveDate = await field(page, "effectiveDate").inputValue();
              const actualDescription = await renderedDescription.innerText();
              expect(actualDescription).toContain(canonicalEffectiveDate);
              expect(snapshot()).toBe(before); evidence.records.push({ state: "effective-date", locale, javaScriptEnabled, progressive: suffix !== "", requestedEffectiveDate: effectiveDate, canonicalEffectiveDate, actualDescription, geometry: measure, databaseUnchanged: true });
            }
            for (const query of ["", "?effectiveDate=2026-02-30", `?effectiveDate=${date}&effectiveDate=${date}`]) {
              await page.goto(`/${locale}/setup/nojs${query}`); expect((await geometry(page)).mainCount).toBe(1);
              await expect(page.locator("main main")).toHaveCount(0); expect(snapshot()).toBe(before);
            }
            const privilege = queryLocalAuthFixture("select has_table_privilege('authenticated','public.profiles','SELECT');"); expect(privilege).toBe("t");
            try {
              queryLocalAuthFixture("revoke select on table public.profiles from authenticated;");
              await page.goto(`/${locale}/setup/nojs?effectiveDate=${date}`); await expect(page.getByTestId("setup-retrieval-error")).toBeVisible();
              expect((await geometry(page)).mainCount).toBe(1); await expect(form(page)).toHaveCount(0); expect(snapshot()).toBe(before);
            } finally {
              queryLocalAuthFixture("grant select on table public.profiles to authenticated;");
              expect(queryLocalAuthFixture("select has_table_privilege('authenticated','public.profiles','SELECT');")).toBe(privilege);
            }
            await page.goto(`/${locale}/setup?effectiveDate=2090-01-15`);
            if (javaScriptEnabled) await axe(page, evidence, "hydrated-Setup");
            await field(page, "display_name").fill(`Synthetic correction ${locale}`); await field(page, "preferred_language").selectOption(locale);
            await field(page, "calories").fill("0"); await field(page, "protein_g").fill(""); await field(page, "carbohydrates_g").fill("0"); await field(page, "fat_g").fill("70.5");
            await form(page).locator('button[type="submit"]').click(); await expect(page).toHaveURL(`/${locale}/today?date=2090-01-15`);
            const stored = await account.client.from("nutrition_targets").select("effective_from,calories,protein_g,carbohydrates_g,fat_g").eq("user_id", account.id).eq("effective_from", "2090-01-15").single();
            expect(stored.error).toBeNull(); expect(stored.data).toEqual({ effective_from: "2090-01-15", calories: 0, protein_g: null, carbohydrates_g: 0, fat_g: 70.5 });
            evidence.records.push({ state: "explicit-save", locale, javaScriptEnabled, storedValues: stored.data, explicitSubmit: true });
          } finally { await context.close(); }
          const signedOut = await contextFor(browser, javaScriptEnabled, false);
          try { const page = await signedOut.newPage(); await page.goto(`/${locale}/setup/nojs?effectiveDate=${date}`); expect((await geometry(page)).mainCount).toBe(1); await expect(page.locator("main main")).toHaveCount(0); await expect(form(page)).toHaveCount(0); }
          finally { await signedOut.close(); }
        }
      } finally { persistEvidence(info, browser, evidence); }
    });

    test(`R2 ${locale} native and hydrated supported context reaches actual destinations`, async ({ browser }, info) => {
      test.setTimeout(240_000); const evidence: Evidence = { records: [], screenshots: [], axe: [] };
      const other: Locale = locale === "en" ? "he" : "en";
      const routes: { path: string; query: Record<string, string>; kind: "barcode" | "search" | "today" | "library" }[] = [
        { path: "/foods/barcode", query: { date, mealType: "lunch" }, kind: "barcode" },
        { path: "/foods", query: { date, q: "Correction  food" }, kind: "search" },
        { path: "/today", query: { date }, kind: "today" },
        ...["/foods/custom", "/saved-meals", "/recipes"].flatMap(path => [
          { path, query: { ...(path === "/foods/custom" ? {} : { date }), status: "active", page: "2" } as Record<string, string>, kind: "library" as const },
          { path, query: { ...(path === "/foods/custom" ? {} : { date }), status: "archived", page: "1" } as Record<string, string>, kind: "library" as const },
        ]),
      ];
      try {
        for (const javaScriptEnabled of modes) {
          const context = await contextFor(browser, javaScriptEnabled); const page = await context.newPage();
          const hydrationErrors: string[] = []; page.on("pageerror", error => hydrationErrors.push(error.message));
          page.on("console", message => { if (message.type() === "error" && /hydration|did not match|server rendered/i.test(message.text())) hydrationErrors.push(message.text()); });
          try {
            const before = snapshot();
            for (const route of routes) {
              await page.goto(`/${locale}${route.path}?${new URLSearchParams(route.query)}`);
              for (const destination of [other, locale]) {
                const navigation = await switchLocale(page, context, destination, route.path, route.query, javaScriptEnabled);
                let renderedContext: unknown;
                if (route.kind === "barcode") {
                  await expect(page.locator('input[name="date"]')).toHaveValue(date); await expect(page.locator('select[name="mealType"]')).toHaveValue("lunch");
                  renderedContext = { date: await page.locator('input[name="date"]').inputValue(), mealType: await page.locator('select[name="mealType"]').inputValue() };
                }
                if (route.kind === "search") {
                  await expect(page.locator('input[name="q"]')).toHaveValue(route.query.q); await expect(page.locator('input[name="date"]')).toHaveValue(date);
                  renderedContext = { date: await page.locator('input[name="date"]').inputValue(), q: await page.locator('input[name="q"]').inputValue() };
                }
                if (route.kind === "today") {
                  await expect(page.locator("#diary-date")).toHaveValue(date);
                  renderedContext = { date: await page.locator("#diary-date").inputValue(), displayDate: await page.locator('main time[datetime]').first().getAttribute("datetime") };
                  expect((renderedContext as { displayDate: string }).displayDate).toBe(date);
                }
                if (route.kind === "library") {
                  const prefix = route.path === "/foods/custom" ? "custom-food" : route.path === "/saved-meals" ? "saved-meal" : "recipe";
                  const attribute = route.path === "/foods/custom" ? "data-food-id" : route.path === "/saved-meals" ? "data-saved-meal-id" : "data-recipe-id";
                  const kind = route.path === "/foods/custom" ? "food" : route.path === "/saved-meals" ? "meal" : "recipe";
                  const management = route.path === "/foods/custom" ? copies[destination].CustomFoodManagement : route.path === "/saved-meals" ? copies[destination].SavedMealManagement : copies[destination].RecipeManagement;
                  const cards = page.getByTestId(`${prefix}-management-list`).locator(`[${attribute}]`);
                  await expect(cards).toHaveCount(1);
                  await expect(cards).toHaveAttribute(attribute, ids[kind][route.query.status === "archived" ? 21 : 0]);
                  const activeFilter = page.locator(`main a[aria-current="page"][href*="status=${route.query.status}"]`); await expect(activeFilter).toHaveCount(1);
                  const filterHref = await activeFilter.getAttribute("href");
                  const expectedFilter = { ...(route.query.date ? { date: route.query.date } : {}), status: route.query.status, page: "1" };
                  assertQuery(new URL(filterHref!, page.url()), expectedFilter);
                  const pagination = page.getByRole("navigation", { name: management.pagination.label, exact: true });
                  const pageText = pagination.getByText(management.pagination.current.replace("{page}", route.query.page), { exact: true });
                  await expect(pageText).toBeVisible();
                  const previous = pagination.locator('a[rel="prev"]');
                  await expect(previous).toHaveCount(route.query.page === "2" ? 1 : 0);
                  await expect(pagination.locator('a[rel="next"]')).toHaveCount(0);
                  const previousHref = await previous.count() ? await previous.getAttribute("href") : null;
                  if (previousHref) assertQuery(new URL(previousHref, page.url()), expectedFilter);
                  renderedContext = { cardIds: await cards.evaluateAll((elements, name) => elements.map(element => element.getAttribute(name)), attribute), activeFilter: { text: await activeFilter.innerText(), href: filterHref, query: [...new URL(filterHref!, page.url()).searchParams] }, pageText: await pageText.innerText(), previousHref, nextHref: null };
                }
                expect(snapshot()).toBe(before); evidence.records.push({ state: "locale-navigation", javaScriptEnabled, from: destination === other ? locale : other, to: destination, ...navigation, renderedContext, geometry: await geometry(page), databaseUnchanged: true, snapshotSha256: before });
              }
              if (route.kind === "barcode" && !javaScriptEnabled) await capture(info, page, evidence, "native-barcode-roundtrip");
            }
            if (javaScriptEnabled) {
              const changedQuery = { date: "2026-08-19", q: "Correction  food אבג" };
              await page.goto(`/${locale}/foods/barcode?date=${date}&mealType=lunch`);
              await page.locator('input[name="date"]').fill(changedQuery.date);
              await page.locator('input[name="code"]').fill("4006381333931");
              await page.locator('form:has(input[name="code"]) button[type="submit"]').click();
              await expect(page).toHaveURL(url => url.pathname === `/${locale}/foods/barcode` && url.searchParams.get("date") === changedQuery.date && url.searchParams.get("code") === "04006381333931" && url.searchParams.get("mealType") === "lunch");
              assertQuery(new URL(page.url()), { code: "04006381333931", date: changedQuery.date, mealType: "lunch" });
              await expect(page.locator('input[name="date"]')).toHaveValue(changedQuery.date);
              const searchDestination = page.getByTestId("food-discovery-navigation").locator(`a[href="/${locale}/foods?date=${changedQuery.date}"]`);
              await searchDestination.click();
              await expect(page).toHaveURL(`/${locale}/foods?date=${changedQuery.date}`);
              await page.locator('input[name="q"]').fill(changedQuery.q); await page.locator('form[role="search"] button[type="submit"]').click();
              await expect(page).toHaveURL(url => url.searchParams.get("q") === changedQuery.q && url.searchParams.get("date") === changedQuery.date);
              await switchLocale(page, context, other, "/foods", changedQuery, true);
              for (const [operation, restoredLocale, destinationLocale] of [["back", locale, other], ["forward", other, locale]] as const) {
                if (operation === "back") await page.goBack(); else await page.goForward();
                await expect(page).toHaveURL(url => url.pathname === `/${restoredLocale}/foods` && url.searchParams.get("q") === changedQuery.q && url.searchParams.get("date") === changedQuery.date);
                await expect(page.locator("html")).toHaveAttribute("lang", restoredLocale);
                assertQuery(new URL(page.url()), changedQuery);
                await expect(page.locator('input[name="q"]')).toHaveValue(changedQuery.q);
                await expect(page.locator('input[name="date"]')).toHaveValue(changedQuery.date);
                const href = await (await languageLink(page, destinationLocale)).getAttribute("href");
                const localeUrl = new URL(href!, page.url());
                expect(localeUrl.pathname).toBe(`/${destinationLocale}/foods`); assertQuery(localeUrl, changedQuery);
                expect(snapshot()).toBe(before);
                evidence.records.push({ state: "hydrated-history", operation, actualUrl: page.url(), actualQuery: [...new URL(page.url()).searchParams], nativeHref: href, date: await page.locator('input[name="date"]').inputValue(), q: await page.locator('input[name="q"]').inputValue(), databaseUnchanged: true, snapshotSha256: before });
              }
              expect(hydrationErrors).toEqual([]); expect(snapshot()).toBe(before);
              await axe(page, evidence, "hydrated-search-roundtrip");
              const response = await context.request.get("/", { maxRedirects: 0 }); expect(response.headers().location).toMatch(new RegExp(`/${other}(?:$|\\?)`));
            }
          } finally { await context.close(); }
        }
      } finally { persistEvidence(info, browser, evidence); }
    });

    test(`R3 ${locale} negative, absent and security-sensitive locale context`, async ({ browser }, info) => {
      test.setTimeout(180_000); const evidence: Evidence = { records: [], screenshots: [], axe: [] }; const other: Locale = locale === "en" ? "he" : "en";
      const negatives: { path: string; search: string; query: Record<string, string> }[] = [
        { path: "/foods/barcode", search: `date=${date}&date=${date}&mealType=lunch`, query: {} },
        { path: "/foods/barcode", search: `date=${date}&mealType=unsupported`, query: {} },
        { path: "/foods/barcode", search: `date=${date}&mealType=lunch&returnTo=https%3A%2F%2Finvalid.example`, query: {} },
        { path: "/foods", search: `date=2026-02-30&q=Correction`, query: { q: "Correction" } },
        { path: "/foods", search: `date=${date}&q=one&q=two&access_token=not-a-credential`, query: { date } },
        { path: "/saved-meals", search: `date=${date}&status=active&status=archived&page=2`, query: { date } },
        { path: "/recipes", search: `date=${date}&status=archived&page=0&next=https%3A%2F%2Finvalid.example`, query: { date } },
        { path: "/foods/custom", search: `date=${date}&status=archived&page=1&token_hash=not-a-credential`, query: { status: "archived", page: "1" } },
      ];
      try {
        for (const javaScriptEnabled of modes) {
          const context = await contextFor(browser, javaScriptEnabled); const page = await context.newPage();
          try {
            const before = snapshot();
            for (const item of negatives) {
              await page.goto(`/${locale}${item.path}?${item.search}`);
              const source = new URL(page.url());
              const renderedLocaleHrefs = await localeHrefs(page, item.path, item.query);
              const link = await languageLink(page, other); const href = await link.getAttribute("href"); expect(href).not.toBeNull();
              const nativeUrl = new URL(href!, page.url());
              expect(nativeUrl.origin).toBe(source.origin); expect(nativeUrl.pathname).toBe(`/${other}${item.path}`); assertQuery(nativeUrl, item.query);
              expect(href).not.toMatch(/returnTo|access_token|token_hash|next=|invalid\.example/);
              const expectedDestinationQuery = javaScriptEnabled && item.path === "/foods/barcode" && !item.query.date ? { date: await browserToday(page) } : item.query;
              await link.click(); await expect(page.locator("html")).toHaveAttribute("lang", other);
              await expect(page).toHaveURL(url => url.pathname === `/${other}${item.path}` && [...url.searchParams].length === Object.keys(expectedDestinationQuery).length && Object.entries(expectedDestinationQuery).every(([key, value]) => url.searchParams.get(key) === value));
              const destination = new URL(page.url()); assertQuery(destination, expectedDestinationQuery);
              expect(destination.origin).toBe(source.origin);
              for (const key of ["access_token", "refresh_token", "token_hash", "returnTo", "next", "redirect"]) expect(destination.searchParams.has(key)).toBe(false);
              let bootstrapDate: string | null = null;
              if (javaScriptEnabled && item.path === "/foods/barcode" && !item.query.date) {
                await expect(page.locator('input[name="date"]')).toHaveValue(expectedDestinationQuery.date);
                bootstrapDate = await page.locator('input[name="date"]').inputValue();
              }
              expect(snapshot()).toBe(before); evidence.records.push({ state: "negative-context", javaScriptEnabled, path: item.path, submittedQuery: item.search, actualSource: source.pathname + source.search, actualSourceQuery: [...source.searchParams], renderedLocaleHrefs, href, nativeQuery: [...nativeUrl.searchParams], actualDestination: destination.pathname + destination.search, actualDestinationQuery: [...destination.searchParams], bootstrapDate, databaseUnchanged: true, snapshotSha256: before });
            }
            await page.goto(`/${locale}/account`);
            evidence.records.push({ state: "absent-context", javaScriptEnabled, ...await switchLocale(page, context, other, "/account", {}, javaScriptEnabled) }); expect(snapshot()).toBe(before);
            for (const intent of ["account-export", "account-closure"]) {
              await page.goto(`/${locale}/auth/reauthenticate?intent=${intent}&token_hash=not-a-credential&next=https%3A%2F%2Finvalid.example`);
              const navigation = await switchLocale(page, context, other, "/auth/reauthenticate", { intent }, javaScriptEnabled); await expect(page.getByLabel(copies[other].Auth.reauthentication.passwordLabel)).toBeVisible(); expect(snapshot()).toBe(before);
              evidence.records.push({ state: "bounded-auth-intent", javaScriptEnabled, ...navigation, databaseUnchanged: true });
            }
          } finally { await context.close(); }
          const publicContext = await contextFor(browser, javaScriptEnabled, false); const publicPage = await publicContext.newPage();
          try {
            await publicPage.goto(`/${locale}`); evidence.records.push({ state: "public-absent-context", javaScriptEnabled, ...await switchLocale(publicPage, publicContext, other, "", {}, javaScriptEnabled) });
            await publicPage.goto(`/${locale}/auth/sign-in?recovery=complete&access_token=not-a-credential&returnTo=https%3A%2F%2Finvalid.example`);
            evidence.records.push({ state: "public-recovery-notice", javaScriptEnabled, ...await switchLocale(publicPage, publicContext, other, "/auth/sign-in", { recovery: "complete" }, javaScriptEnabled) });
            await expect(publicPage.getByText(copies[other].Auth.signIn.recoveryComplete, { exact: true })).toBeVisible();
            await publicPage.goto(`/${locale}/auth/sign-in?recovery=complete&recovery=complete`);
            evidence.records.push({ state: "public-repeated-recovery", javaScriptEnabled, ...await switchLocale(publicPage, publicContext, other, "/auth/sign-in", {}, javaScriptEnabled) });
            await publicPage.goto(`/${locale}/auth/account-closed?token_hash=not-a-credential`);
            evidence.records.push({ state: "public-ignored-context", javaScriptEnabled, ...await switchLocale(publicPage, publicContext, other, "/auth/account-closed", {}, javaScriptEnabled) });
          } finally { await publicContext.close(); }
        }
      } finally { persistEvidence(info, browser, evidence); }
    });

    test(`R4 ${locale} invalid and unavailable recovery targets remain native and reachable`, async ({ browser }, info) => {
      test.setTimeout(180_000); const evidence: Evidence = { records: [], screenshots: [], axe: [] };
      try {
        for (const javaScriptEnabled of modes) {
          const context = await contextFor(browser, javaScriptEnabled); const page = await context.newPage();
          try {
            const before = snapshot();
            for (const state of ["invalid", "unavailable"] as const) for (const width of widths) {
              await page.setViewportSize({ width, height: 1000 });
              await page.goto(`/${locale}/foods/custom/${state === "invalid" ? "not-a-uuid" : unavailableId}/edit`);
              const region = page.getByTestId(state === "invalid" ? "custom-food-invalid-link" : "custom-food-unavailable");
              await expect(region).toBeVisible(); const target: Locator = region.getByRole("link", { name: copies[locale].CustomFoodEditor.retrieval.back, exact: true });
              await expect(target).toHaveAttribute("href", `/${locale}/foods`);
              await target.scrollIntoViewIfNeeded(); const rectangle = await target.boundingBox(); expect(rectangle).not.toBeNull();
              expect(rectangle!.width).toBeGreaterThanOrEqual(44); expect(rectangle!.height).toBeGreaterThanOrEqual(44);
              expect(rectangle!.x).toBeGreaterThanOrEqual(0); expect(rectangle!.x + rectangle!.width).toBeLessThanOrEqual(width + 0.5);
              const keyboard = await keyboardFocus(page, target);
              const outline = await target.evaluate(element => ({ style: getComputedStyle(element).outlineStyle, width: getComputedStyle(element).outlineWidth }));
              expect(outline.style).not.toBe("none"); expect(parseFloat(outline.width)).toBeGreaterThanOrEqual(2);
              const measure = await geometry(page); expect(measure.mainCount).toBe(1); expect(snapshot()).toBe(before);
              if (width === 320 && !javaScriptEnabled) await capture(info, page, evidence, `native-recovery-${state}`);
              if (width === 390 && javaScriptEnabled) await axe(page, evidence, `recovery-${state}`);
              await expect(target).toBeFocused();
              const source = new URL(page.url()); let documentRequests = 0;
              const recordRequest = (request: import("@playwright/test").Request) => { if (request.isNavigationRequest() && request.resourceType() === "document") documentRequests += 1; };
              page.on("request", recordRequest);
              try {
                await page.keyboard.press("Enter"); await expect(page).toHaveURL(`/${locale}/foods`); await expect(page.locator('form[role="search"]')).toBeVisible();
                if (javaScriptEnabled) expect(documentRequests).toBe(0);
                else expect(documentRequests).toBeGreaterThan(0);
              } finally { page.off("request", recordRequest); }
              expect(snapshot()).toBe(before);
              evidence.records.push({ state, javaScriptEnabled, locale, width, rectangle, outline, keyboard, source: source.pathname + source.search, actualDestination: new URL(page.url()).pathname + new URL(page.url()).search, documentRequests, navigation: javaScriptEnabled ? "App Router" : "native document", geometry: measure, destinationGeometry: await geometry(page), databaseUnchanged: true, snapshotSha256: before });
            }
          } finally { await context.close(); }
        }
      } finally { persistEvidence(info, browser, evidence); }
    });
  }
});
