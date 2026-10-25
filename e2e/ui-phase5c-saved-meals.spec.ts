import { provisionActivatedLocalUserForUi, queryLocalAuthFixture } from "@/e2e/helpers/local-auth";
import { formatLocalizedNumber } from "@/lib/i18n/format";
import type { ValidatedSavedMealItem } from "@/lib/saved-meals/validation";
import type { Database, Json } from "@/lib/supabase/database.types";
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Browser, type BrowserContext, type Locator, type Page } from "@playwright/test";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { execFileSync } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const git = (...args: string[]) => execFileSync("git", args, { encoding: "utf8" }).trim();
const approvedHead = "a8e75cdb9e3412807e18c10b9ce1a2c3e4fe35d1";
const approvedTree = "f39aafa8f56f1651a45218058667f9c6f30d5bf5";
const sourceFiles = ["components/saved-meals/saved-meal-form.tsx", "components/saved-meals/saved-meal-page.tsx", "components/saved-meals/saved-meal-use-review.tsx"];
const baseline = git("rev-parse", "HEAD") === approvedHead && git("diff", "HEAD", "--", ...sourceFiles) === "";
const mode = baseline ? "baseline" : "after";
const localUrl = process.env.LOCAL_SUPABASE_URL;
const localKey = process.env.LOCAL_SUPABASE_PUBLISHABLE_KEY;
const localOnly = process.env.DATE_E2E_LOCAL_SUPABASE === "1";
const widths = [320, 390, 768, 1440] as const;
const locales = ["en", "he"] as const;
type Locale = (typeof locales)[number];
const date = "2024-02-29";
const destinationDate = "2024-03-02";
const longName = `${"W".repeat(190)} אבג123/AB`;
const digest = (value: string | Buffer) => createHash("sha256").update(value).digest("hex");
const copy = {
  en: { add: "Add item", up: (n: number) => `Move item ${n} up`, down: (n: number) => `Move item ${n} down`, remove: "Remove item", unlink: "Remove food link", create: "Create saved meal", save: "Save changes", confirm: "Confirm and log all items", edit: "Edit saved meal", reload: "Reload current meal", notSet: "Not set", grams: "g" },
  he: { add: "הוספת פריט ריק", up: (n: number) => `הזזת פריט ${n} למעלה`, down: (n: number) => `הזזת פריט ${n} למטה`, remove: "הסרת פריט", unlink: "הסרת הקישור למזון", create: "יצירת ארוחה שמורה", save: "שמירת שינויים", confirm: "אישור והוספת כל הפריטים", edit: "עריכת הארוחה השמורה", reload: "טעינת הארוחה הנוכחית", notSet: "לא הוגדר", grams: "גרם" },
};

test.skip(!localOnly || !localUrl || !localKey, "Phase 5C requires the repository's task-isolated local-only runner.");

test.describe.serial("UI Phase 5C Saved Meal forms and exact snapshot review", () => {
  let storageState: Awaited<ReturnType<BrowserContext["storageState"]>>;
  let client: SupabaseClient<Database>;
  let userId: string;
  let browserVersion: string;
  let evidenceDirectory: string;
  let sourceIdentity: unknown;
  let longMealId: string;
  let oneMealId: string;
  let archivedMealId: string;
  let foodId: string;
  let sourceItems: ValidatedSavedMealItem[];
  const email = `ui-phase5c-${randomUUID()}@example.test`;
  const password = "UiPhase5CSavedMealPassword123!";
  const measurements: unknown[] = [];
  const screenshots: unknown[] = [];
  const screenshotNames = new Set<string>();
  const accessibility: unknown[] = [];
  const contracts: unknown[] = [];

  async function contextFor(browser: Browser, options: Parameters<Browser["newContext"]>[0] = {}) {
    return browser.newContext({ storageState, viewport: { width: 390, height: 1000 }, ...options });
  }

  function item(position: number, overrides: Partial<ValidatedSavedMealItem> = {}): ValidatedSavedMealItem {
    return { position, food_id: null, food_name: `Synthetic ${position} אבג / 123 ${"W".repeat(200)}`.slice(0, 200),
      brand_name: `${"B".repeat(110)} אבג-123/AB`.slice(0, 120), serving_quantity: position === 1 ? 0 : position === 2 ? null : 1.125,
      serving_unit: position === 2 ? null : `${"U".repeat(30)} אבג123/AB`, calories: position === 2 ? null : position === 1 ? 0 : 321,
      protein_g: position === 1 ? null : 0, carbohydrates_g: position === 2 ? null : 22.12, fat_g: position === 1 ? 0 : 3.5,
      notes: `הערה mixed 123/A אבג ${"N".repeat(1000)}`.slice(0, 1000), ...overrides };
  }

  async function persist(name: string, items: ValidatedSavedMealItem[], id: string | null = null) {
    const result = await client.rpc("persist_saved_meal", {
      p_expected_edit_revision: id ? Number(queryLocalAuthFixture(`select saved_meal_edit_revision from public.saved_meals where id = '${id}' and user_id = '${userId}';`)) : null as unknown as number,
      p_items: items as unknown as Json, p_locale: "he", p_name: name, p_saved_meal_id: id as unknown as string,
    });
    expect(result.error).toBeNull();
    expect(result.data?.[0]?.saved_meal_id).toMatch(/^[0-9a-f-]{36}$/);
    return result.data![0].saved_meal_id;
  }

  async function persistedItems(id: string) {
    const result = await client.from("saved_meal_items").select("position,food_id,food_name,brand_name,serving_quantity,serving_unit,calories,protein_g,carbohydrates_g,fat_g,notes").eq("saved_meal_id", id).order("position");
    expect(result.error).toBeNull();
    return result.data!;
  }

  function diarySnapshot() {
    return queryLocalAuthFixture(`select jsonb_build_object(
      'entries', (select coalesce(jsonb_agg(to_jsonb(d) order by d.id), '[]') from public.diary_entries d where user_id = '${userId}'),
      'runs', (select coalesce(jsonb_agg(to_jsonb(r) order by r.id), '[]') from public.saved_meal_diary_runs r where user_id = '${userId}')
    );`);
  }

  function mealSnapshot(id: string) {
    return queryLocalAuthFixture(`select jsonb_build_object(
      'meal', (select to_jsonb(m) from public.saved_meals m where id = '${id}' and user_id = '${userId}'),
      'items', (select jsonb_agg(to_jsonb(i) order by i.position) from public.saved_meal_items i where saved_meal_id = '${id}')
    );`);
  }

  const editorItems = (page: Page) => page.getByTestId("saved-meal-item");
  const editorField = (page: Page, name: string) => page.locator(`main [name="${name}"]`);
  const submit = (page: Page) => page.locator('main button[type="submit"]').last();
  const summary = (page: Page) => page.getByTestId("saved-meal-validation-summary");

  async function editorValues(page: Page) {
    return editorItems(page).evaluateAll((rows) => rows.map((row) => ({ rowKey: row.getAttribute("data-row-key"),
      fields: Object.fromEntries(Array.from(row.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>("input,textarea")).map((control) => [control.name.replace(/_\d+$/, ""), control.value])) })));
  }

  async function geometry(page: Page, state: string) {
    const result = await page.evaluate(() => {
      const rect = (element: Element) => { const r = element.getBoundingClientRect(); return { x: r.x, y: r.y, right: r.right, bottom: r.bottom, width: r.width, height: r.height }; };
      const canvas = document.createElement("canvas"); canvas.width = canvas.height = 1; const context = canvas.getContext("2d")!;
      const srgb = (color: string) => { context.clearRect(0, 0, 1, 1); context.fillStyle = color; context.fillRect(0, 0, 1, 1); return Array.from(context.getImageData(0, 0, 1, 1).data).slice(0, 3); };
      const luminance = (channels: number[]) => { const [r, g, b] = channels.map((v) => v / 255).map((v) => v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
      const presentation = (element: Element) => { const style = getComputedStyle(element); const borderRgb = srgb(style.borderColor), backgroundRgb = srgb(style.backgroundColor); const a = luminance(borderRgb), b = luminance(backgroundRgb); return { border: style.borderColor, background: style.backgroundColor, borderRgb, backgroundRgb, boundaryContrast: (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05) }; };
      const root = document.querySelector("main")!;
      return { viewport: { width: innerWidth, height: innerHeight }, locale: document.documentElement.lang, direction: document.documentElement.dir,
        document: { scrollWidth: document.documentElement.scrollWidth, clientWidth: document.documentElement.clientWidth },
        body: { scrollWidth: document.body.scrollWidth, clientWidth: document.body.clientWidth },
        cards: Array.from(root.querySelectorAll('[data-saved-meal-position],[data-testid="saved-meal-item"]')).map((card) => ({ ...rect(card), scrollWidth: card.scrollWidth, clientWidth: card.clientWidth, rowKey: card.getAttribute("data-row-key"), position: card.getAttribute("data-saved-meal-position"), actions: Array.from(card.querySelectorAll<HTMLButtonElement>("button")).map((action) => ({ ...rect(action), disabled: action.disabled, label: action.getAttribute("aria-label") ?? action.textContent })) })),
        controls: Array.from(root.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement | HTMLButtonElement>('input:not([type="hidden"]),select,textarea,button')).map((control) => ({ ...rect(control), name: control.getAttribute("name"), text: control.textContent?.trim(), tag: control.tagName, disabled: control.disabled, ...presentation(control) })),
        actions: Array.from(root.querySelectorAll("a,button")).map((element) => ({ ...rect(element), href: element.getAttribute("href"), text: element.textContent?.trim() })),
        text: Array.from(root.querySelectorAll("h1,h3,dd")).map((element) => ({ ...rect(element), text: element.textContent, overflow: getComputedStyle(element).overflow, textOverflow: getComputedStyle(element).textOverflow })),
      };
    });
    measurements.push({ mode, state, route: new URL(page.url()).pathname + new URL(page.url()).search, ...result });
    return result;
  }

  function assertGeometry(result: Awaited<ReturnType<typeof geometry>>, locale: Locale) {
    expect(result.locale).toBe(locale);
    expect(result.direction).toBe(locale === "he" ? "rtl" : "ltr");
    expect(result.document.scrollWidth).toBeLessThanOrEqual(result.document.clientWidth);
    expect(result.body.scrollWidth).toBeLessThanOrEqual(result.document.clientWidth);
    for (const element of [...result.cards, ...result.controls, ...result.text, ...result.actions]) {
      expect(element.x).toBeGreaterThanOrEqual(-0.5);
      expect(element.right).toBeLessThanOrEqual(result.document.clientWidth + 0.5);
    }
    for (const card of result.cards) {
      expect(card.scrollWidth).toBeLessThanOrEqual(card.clientWidth + 1);
      for (let i = 0; i < card.actions.length; i += 1) for (let j = i + 1; j < card.actions.length; j += 1) {
        const a = card.actions[i], b = card.actions[j];
        expect(Math.max(0, Math.min(a.right, b.right) - Math.max(a.x, b.x)) * Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.y, b.y))).toBe(0);
      }
    }
    for (const text of result.text) { expect(text.textOverflow).not.toBe("ellipsis"); expect(text.overflow).not.toBe("hidden"); }
    for (const control of result.controls.filter((control) => control.tag === "BUTTON" && !control.disabled)) {
      expect(control.width).toBeGreaterThanOrEqual(44);
      expect(control.height).toBeGreaterThanOrEqual(44);
    }
  }

  async function screenshot(page: Page, label: string) {
    const filename = `${mode}-${label}.png`;
    expect(screenshotNames.has(filename), "Evidence filenames must be unique within a run.").toBe(false);
    screenshotNames.add(filename);
    const image = await page.screenshot({ path: join(evidenceDirectory, filename), animations: "disabled" });
    screenshots.push({ filename, sha256: digest(image), viewport: page.viewportSize(), route: new URL(page.url()).pathname + new URL(page.url()).search });
  }

  async function axe(page: Page, state: string) {
    const result = await new AxeBuilder({ page }).include("main").withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
    accessibility.push({ mode, state, locale: await page.locator("html").getAttribute("lang"), violations: result.violations.map(({ id, impact, nodes }) => ({ id, impact, nodes: nodes.map(({ target, failureSummary }) => ({ target, failureSummary })) })) });
    if (!baseline) expect(result.violations).toEqual([]);
  }

  async function reachControl(control: Locator) {
    await control.evaluate((element) => element.scrollIntoView({ block: "center", inline: "nearest", behavior: "instant" }));
    const result = await control.evaluate((element) => { const r = element.getBoundingClientRect(); const x = r.x + r.width / 2, y = r.y + r.height / 2; const hit = document.elementFromPoint(x, y); return { x, y, width: r.width, height: r.height, hit: !!hit && (hit === element || element.contains(hit)), viewport: { width: innerWidth, height: innerHeight } }; });
    expect(result.x).toBeGreaterThanOrEqual(0); expect(result.x).toBeLessThan(result.viewport.width);
    expect(result.y).toBeGreaterThanOrEqual(0); expect(result.y).toBeLessThan(result.viewport.height); expect(result.hit).toBe(true);
    return result;
  }

  async function assertReview(page: Page, id: string, locale: Locale) {
    const parent = await client.from("saved_meals").select("name").eq("id", id).single(); expect(parent.error).toBeNull(); await expect(page.locator("main h1")).toContainText(parent.data!.name);
    const rows = await persistedItems(id);
    const cards = page.locator("[data-saved-meal-position]");
    await expect(cards).toHaveCount(rows.length);
    for (const [index, row] of rows.entries()) {
      const card = cards.nth(index);
      await expect(card).toHaveAttribute("data-saved-meal-position", String(row.position));
      await expect(card.getByRole("heading", { level: 3 })).toHaveText(row.food_name);
      if (row.brand_name !== null) expect(await card.textContent()).toContain(row.brand_name);
      if (row.notes !== null) expect(await card.textContent()).toContain(row.notes);
      const number = (value: number | null, suffix = "") => value === null ? copy[locale].notSet : `${formatLocalizedNumber(locale, value)}${suffix ? ` ${suffix}` : ""}`;
      const serving = row.serving_quantity === null && row.serving_unit === null ? copy[locale].notSet : [row.serving_quantity === null ? null : formatLocalizedNumber(locale, row.serving_quantity), row.serving_unit].filter((part) => part !== null).join(" ");
      await expect(card.locator("dd")).toHaveText([serving, number(row.calories), number(row.protein_g, copy[locale].grams), number(row.carbohydrates_g, copy[locale].grams), number(row.fat_g, copy[locale].grams)]);
    }
    contracts.push({ mode, state: "review-fidelity", id, locale, orderedSnapshotSha256: digest(JSON.stringify(rows)), rowCount: rows.length, compared: "all ordered names, brands, units, quantities, nutrients, notes and null/zero localized display" });
  }

  async function navigationMeasurement(page: Page, field: Locator, state: string) {
    const result = await field.evaluate((control) => { const r = control.getBoundingClientRect(); const descriptions = (control.getAttribute("aria-describedby") ?? "").split(/\s+/).filter(Boolean).map((id) => ({ id, text: document.getElementById(id)?.textContent ?? null })); const active = document.activeElement; return { field: control.getAttribute("name"), fieldId: control.id, fieldY: r.y, fieldHeight: r.height, viewportHeight: innerHeight, scrollY, distanceAboveViewport: Math.max(0, -r.bottom), focused: active?.id || active?.getAttribute("data-testid") || active?.tagName, invalid: control.getAttribute("aria-invalid"), descriptions }; });
    measurements.push({ mode, state, locale: await page.locator("html").getAttribute("lang"), ...result });
    return result;
  }

  async function followError(page: Page, field: Locator) {
    const id = await field.getAttribute("id");
    expect(id).toBeTruthy();
    const link = summary(page).locator(`a[href="#${id}"]`);
    await expect(link).toHaveCount(1);
    await link.focus();
    await page.keyboard.press("Enter");
    await expect(field).toBeFocused();
    await expect(field).toBeVisible();
    const result = await navigationMeasurement(page, field, "error-link-destination");
    expect(result.fieldY).toBeGreaterThanOrEqual(0);
    expect(result.fieldY + result.fieldHeight).toBeLessThan(result.viewportHeight - 60);
    expect(result.invalid).toBe("true");
    expect(result.descriptions.every(({ text }) => text !== null)).toBe(true);
    expect(result.descriptions.some(({ id, text }) => id.endsWith("-error") && !!text)).toBe(true);
  }

  async function holdActionResponse(page: Page) {
    let release!: () => void;
    let responseReceived!: () => void;
    let submissions = 0;
    const held = new Promise<void>((resolve) => { release = resolve; });
    const received = new Promise<void>((resolve) => { responseReceived = resolve; });
    await page.route("**/saved-meals/**", async (route) => {
      if (route.request().method() !== "POST" || !route.request().headers()["next-action"]) {
        await route.continue();
        return;
      }
      submissions += 1;
      // Hold the real server result; the authoritative action and database still run.
      const response = await route.fetch();
      responseReceived();
      await held;
      await route.fulfill({ response });
    });
    return { received, release, count: () => submissions };
  }

  test.beforeAll(async ({ browser }, testInfo) => {
    test.setTimeout(120_000);
    if (!localUrl || !["localhost", "127.0.0.1"].includes(new URL(localUrl).hostname)) throw new Error("Refusing nonlocal Phase 5C fixtures.");
    evidenceDirectory = join(testInfo.project.outputDir, "ui-phase5c-saved-meal-evidence");
    mkdirSync(evidenceDirectory, { recursive: true });
    sourceIdentity = { head: git("rev-parse", "HEAD"), tree: git("rev-parse", "HEAD^{tree}"), buildId: readFileSync(".next/BUILD_ID", "utf8").trim(), productionDiffSha256: digest(git("diff", "HEAD", "--", ...sourceFiles)), sourceFileSha256: Object.fromEntries(sourceFiles.map((file) => [file, digest(readFileSync(file))])) };
    if (baseline) { expect(git("rev-parse", "HEAD")).toBe(approvedHead); expect(git("rev-parse", "HEAD^{tree}")).toBe(approvedTree); }
    browserVersion = browser.version();
    await provisionActivatedLocalUserForUi({ email, password });
    client = createClient<Database>(localUrl, localKey as string, { auth: { autoRefreshToken: false, persistSession: false } });
    const auth = await client.auth.signInWithPassword({ email, password });
    expect(auth.error).toBeNull(); userId = auth.data.user!.id;
    const food = await client.rpc("persist_custom_food", { p_aliases: [] as Json, p_brand_name: "Current catalog brand", p_food_id: null as unknown as string, p_locale: "en", p_name: "Current catalog identity", p_nutrient_basis: "per_serving", p_nutrients: [] as Json, p_serving_quantity: 99, p_serving_unit: "catalog units" });
    expect(food.error).toBeNull(); foodId = food.data![0].food_id;
    sourceItems = Array.from({ length: 12 }, (_, i) => item(i + 1, i === 1 ? { food_id: foodId } : {}));
    expect(longName.length).toBeLessThanOrEqual(200);
    longMealId = await persist(longName, sourceItems);
    oneMealId = await persist("Normal snapshot ארוחה / 123", [item(1, { food_name: "Normal zero snapshot", brand_name: null, notes: null, serving_unit: "portion" })]);
    archivedMealId = await persist("Archived editable ארוחה", [item(1)]);
    expect((await client.rpc("set_saved_meal_archived", { p_saved_meal_id: archivedMealId, p_is_archived: true })).error).toBeNull();
    const diary = await client.from("diary_entries").insert(sourceItems.map(({ position, item_id, ...snapshot }) => { expect(item_id).toBeUndefined(); return { ...snapshot, user_id: userId, entry_date: date, meal_type: "breakfast" as const, created_at: `2026-07-16T08:${String(position).padStart(2, "0")}:00Z` }; }));
    expect(diary.error).toBeNull();
    const context = await browser.newContext(); const page = await context.newPage();
    await page.goto("/en/auth/sign-in"); await page.getByLabel("Email").fill(email); await page.getByLabel("Password").fill(password); await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await expect(page).toHaveURL(/\/en\/today\?date=\d{4}-\d{2}-\d{2}$/); storageState = await context.storageState(); await context.close();
  });

  test.afterAll(async () => {
    if (evidenceDirectory) writeFileSync(join(evidenceDirectory, `${mode}-manifest.json`), JSON.stringify({ task: "UI_PHASE_5C_SAVED_MEAL_FORMS_REVIEW_001", mode, sourceIdentity, browser: { name: "Chromium", version: browserVersion }, fixture: { synthetic: true, transport: "authenticated RPCs on task-local Supabase", longName, nameLength: longName.length, items: sourceItems, itemCount: sourceItems?.length, snapshotSha256: digest(JSON.stringify(sourceItems ?? [])), ids: { longMealId, oneMealId, archivedMealId } }, measurements, screenshots, accessibility, contracts }, null, 2) + "\n");
    if (userId) { await client.auth.signOut(); queryLocalAuthFixture(`delete from auth.users where id = '${userId}' and email = '${email}';`); }
  });

  test("R1 baseline F02/F09/F10/F11 rendered defect evidence", async ({ browser }) => {
    test.skip(!baseline, "Baseline reproduction requires the exact approved unchanged production source."); test.setTimeout(120_000);
    const context = await contextFor(browser); const page = await context.newPage(); const diaryBefore = diarySnapshot();
    for (const [locale, width] of [["he", 320], ["en", 390]] as const) {
      await page.setViewportSize({ width, height: 1000 }); await page.goto(`/${locale}/saved-meals/${longMealId}/use?date=${date}`); await assertReview(page, longMealId, locale);
      const result = await geometry(page, "long-review-baseline"); expect(result.document.scrollWidth).toBeGreaterThan(width); await screenshot(page, `review-${locale}-${width}`); await axe(page, "long-review-baseline");
    }
    await page.goto(`/en/saved-meals/new?date=${date}&mealType=breakfast`);
    const values = await editorValues(page); await editorField(page, "name").fill(" ");
    const name = editorField(page, "name"); await submit(page).scrollIntoViewIfNeeded();
    const before = await navigationMeasurement(page, name, "invalid-name-before-submit"); expect(before.distanceAboveViewport).toBeGreaterThan(4300); await screenshot(page, "long-create-before-rejection-en-390");
    await submit(page).click(); await expect(name).toHaveAttribute("aria-invalid", "true");
    const after = await navigationMeasurement(page, name, "invalid-name-after-rejection"); expect(after.distanceAboveViewport).toBeGreaterThan(4300);
    await screenshot(page, "long-create-rejected-en-390"); expect(await editorValues(page)).toEqual(values); await geometry(page, "legacy-editor-boundary-and-touch"); expect(diarySnapshot()).toBe(diaryBefore);
    contracts.push({ state: "baseline-invalid-create", noSavedMealCreated: queryLocalAuthFixture(`select count(*) from public.saved_meals where user_id = '${userId}';`) === "3", diaryUnchanged: true }); await context.close();
  });

  test("R1/R7 responsive review and editor matrix retains complete exact snapshots", async ({ browser }) => {
    test.skip(baseline, "Changed-source acceptance follows baseline capture."); test.setTimeout(240_000);
    const context = await contextFor(browser); const page = await context.newPage(); const before = diarySnapshot();
    for (const locale of locales) for (const width of widths) {
      await page.setViewportSize({ width, height: 1000 });
      for (const [state, route] of [
        ["blank-create", `/${locale}/saved-meals/new`], ["diary-create", `/${locale}/saved-meals/new?date=${date}&mealType=breakfast`],
        ["existing-edit", `/${locale}/saved-meals/${longMealId}/edit`], ["archived-edit", `/${locale}/saved-meals/${archivedMealId}/edit`],
        ["normal-review", `/${locale}/saved-meals/${oneMealId}/use?date=${date}`], ["many-long-review", `/${locale}/saved-meals/${longMealId}/use?date=${date}`],
      ]) {
        await page.goto(route); await expect(page.locator("main h1")).toBeVisible();
        expect(await page.evaluate(() => document.activeElement?.tagName)).toBe("BODY");
        if (state.endsWith("review")) await assertReview(page, state === "normal-review" ? oneMealId : longMealId, locale);
        if (state === "archived-edit") await expect(page.getByTestId("saved-meal-archived-notice")).toBeVisible();
        assertGeometry(await geometry(page, state), locale);
        if ((locale === "he" && width === 320 && state === "many-long-review") || (locale === "en" && [390, 1440].includes(width) && state === "many-long-review") || (locale === "en" && width === 390 && ["blank-create", "existing-edit"].includes(state))) await screenshot(page, `${state}-${locale}-${width}`);
        if (locale === "he" && width === 320 && state === "many-long-review") {
          await page.locator("[data-saved-meal-position]").first().evaluate((element) => element.scrollIntoView({ block: "start", behavior: "instant" }));
          await screenshot(page, "review-first-snapshot-he-320");
        }
        if (width === 320 && ["many-long-review", "blank-create", "existing-edit", "archived-edit"].includes(state)) await axe(page, state);
      }
    }
    expect(diarySnapshot()).toBe(before); contracts.push({ state: "responsive-navigation", diaryAndReceiptsUnchanged: true, combinations: 48 }); await context.close();
  });

  test("R2 long rejected Create focuses summary and supports repeated keyboard correction without data loss", async ({ browser }) => {
    test.skip(baseline, "Changed-source validation navigation."); test.setTimeout(120_000);
    for (const locale of locales) {
    const context = await contextFor(browser); const page = await context.newPage(); const before = diarySnapshot();
    const countBefore = queryLocalAuthFixture(`select count(*) from public.saved_meals where user_id = '${userId}';`);
    await page.goto(`/${locale}/saved-meals/new?date=${date}&mealType=breakfast`); await editorField(page, "name").fill(" ");
    await editorField(page, "item_notes_11").fill("Unsaved last note אבג / 123"); const values = await editorValues(page);
    await submit(page).scrollIntoViewIfNeeded(); expect((await navigationMeasurement(page, editorField(page, "name"), "create-before-rejection")).distanceAboveViewport).toBeGreaterThan(4300); await screenshot(page, `long-create-before-rejection-${locale}-390`);
    for (let attempt = 0; attempt < 2; attempt += 1) {
      await submit(page).click(); await expect(summary(page)).toBeFocused(); await expect(summary(page)).toHaveAttribute("role", "alert");
      expect(await editorValues(page)).toEqual(values); expect(queryLocalAuthFixture(`select count(*) from public.saved_meals where user_id = '${userId}';`)).toBe(countBefore); expect(diarySnapshot()).toBe(before);
      if (attempt === 0) for (const width of widths) { await page.setViewportSize({ width, height: 1000 }); assertGeometry(await geometry(page, "long-create-validation"), locale); }
      await page.setViewportSize({ width: 390, height: 1000 });
      await followError(page, editorField(page, "name"));
    }
    if (locale === "en") await screenshot(page, "create-error-navigation-en-390"); await axe(page, "invalid-create");
    await editorField(page, "name").fill(`Corrected unsaved source copy ${locale}`); await submit(page).click(); await expect(page).toHaveURL(/\/saved-meals\/[0-9a-f-]+\/edit\?saved=created$/);
    const createdId = page.url().match(/\/saved-meals\/([0-9a-f-]+)\/edit/)![1]; const rows = await persistedItems(createdId);
    expect(rows).toEqual(sourceItems.map((row, index) => index === 11 ? { ...row, notes: "Unsaved last note אבג / 123" } : row));
    expect(diarySnapshot()).toBe(before); contracts.push({ state: "invalid-create", locale, fullValuesAndRowKeysRetained: true, repeatedKeyboardRecovery: true, persistedOnlyAfterCorrection: true, sourceDiaryUnchanged: true }); await context.close();
    }
  });

  test("R3 item errors follow stable rows after rejection and reorder; Edit saves only explicit correction", async ({ browser }) => {
    test.skip(baseline, "Changed-source row-bound validation."); test.setTimeout(120_000);
    for (const locale of locales) {
      const id = await persist(`Long edit ${locale}`, sourceItems); const before = mealSnapshot(id); const diaryBefore = diarySnapshot();
      const context = await contextFor(browser, { viewport: { width: 320, height: 1000 } }); const page = await context.newPage(); await page.goto(`/${locale}/saved-meals/${id}/edit`);
      await editorField(page, "name").fill(`Unsaved edit ${locale}`); await editorField(page, "item_notes_11").fill(`Unsaved final ${locale}`); await editorField(page, "item_calories_0").fill("1.5");
      const values = await editorValues(page); const invalidRowKey = values[0].rowKey;
      await submit(page).scrollIntoViewIfNeeded(); await navigationMeasurement(page, editorField(page, "item_calories_0"), "edit-before-rejection"); await submit(page).click(); await expect(summary(page)).toBeFocused();
      for (const width of widths) { await page.setViewportSize({ width, height: 1000 }); assertGeometry(await geometry(page, "long-edit-validation"), locale); }
      await page.setViewportSize({ width: 320, height: 1000 });
      expect(await editorValues(page)).toEqual(values); expect(mealSnapshot(id)).toBe(before); expect(diarySnapshot()).toBe(diaryBefore); await followError(page, editorField(page, "item_calories_0"));
      await editorItems(page).nth(0).getByRole("button", { name: copy[locale].down(1), exact: true }).click();
      const invalidRow = page.locator(`[data-row-key="${invalidRowKey}"]`); await expect(invalidRow).toHaveCount(1); await expect(invalidRow.locator('input[name="item_calories_1"]')).toHaveAttribute("aria-invalid", "true");
      await expect(editorField(page, "item_calories_0")).toHaveAttribute("aria-invalid", "false"); await followError(page, editorField(page, "item_calories_1"));
      await submit(page).click(); await expect(summary(page)).toBeFocused(); await followError(page, editorField(page, "item_calories_1"));
      await page.keyboard.press("ControlOrMeta+A"); await page.keyboard.type("0"); await expect(editorField(page, "item_calories_1")).toHaveValue("0"); await submit(page).click(); await expect(page).toHaveURL(new RegExp(`/saved-meals/${id}/edit\\?saved=updated$`));
      const expected = sourceItems.map((row, index) => index === 11 ? { ...row, notes: `Unsaved final ${locale}` } : row); [expected[0], expected[1]] = [expected[1], expected[0]];
      expect(await persistedItems(id)).toEqual(expected.map((row, index) => ({ ...row, position: index + 1 }))); expect(diarySnapshot()).toBe(diaryBefore);
      contracts.push({ state: "invalid-edit-reorder", locale, rejectedAggregateUnchanged: true, errorRowKey: invalidRowKey, preservedValues: true, correctedOrder: true, diaryUnchanged: true }); await context.close();
    }
  });

  test("R4/R5 item operations preserve provenance, row keys, snapshots and the 50-item boundary", async ({ browser }) => {
    test.skip(baseline, "Changed-source item presentation."); test.setTimeout(120_000);
    for (const locale of locales) {
      const id = await persist(`Operations ${locale}`, sourceItems.slice(0, 3)); const diaryBefore = diarySnapshot(); const context = await contextFor(browser, { viewport: { width: 320, height: 1000 } }); const page = await context.newPage(); await page.goto(`/${locale}/saved-meals/${id}/edit`);
      const rows = editorItems(page); const original = await editorValues(page); await expect(rows.nth(0).getByRole("button", { name: copy[locale].up(1), exact: true })).toBeDisabled(); await expect(rows.nth(2).getByRole("button", { name: copy[locale].down(3), exact: true })).toBeDisabled();
      await expect(rows.nth(1).getByRole("button", { name: copy[locale].unlink, exact: true })).toBeVisible();
      if (locale === "en") {
        await rows.nth(1).locator("legend").evaluate((element) => element.scrollIntoView({ block: "start", behavior: "instant" }));
        await screenshot(page, "linked-item-actions-en-320");
      }
      await rows.nth(1).getByRole("button", { name: copy[locale].up(2), exact: true }).click(); await rows.nth(0).getByRole("button", { name: copy[locale].unlink, exact: true }).click(); await expect(rows.nth(0).getByRole("button", { name: copy[locale].unlink, exact: true })).toHaveCount(0);
      await page.getByRole("button", { name: copy[locale].add, exact: true }).click(); await expect(rows).toHaveCount(4); const addedKey = (await editorValues(page))[3].rowKey; expect(addedKey).toMatch(/^client:/); await rows.nth(3).getByRole("button", { name: copy[locale].remove, exact: true }).click();
      expect((await editorValues(page)).map(({ rowKey }) => rowKey)).toEqual([original[1].rowKey, original[0].rowKey, original[2].rowKey]); assertGeometry(await geometry(page, "item-operations"), locale);
      for (let i = 0; i < 3; i += 1) { const controls = rows.nth(i).getByRole("button"); for (let j = 0; j < await controls.count(); j += 1) if (await controls.nth(j).isEnabled()) await reachControl(controls.nth(j)); }
      if (locale === "en") { await rows.nth(0).locator("legend").evaluate((element) => element.scrollIntoView({ block: "start", behavior: "instant" })); await screenshot(page, "unlinked-item-actions-en-320"); }
      await submit(page).click(); await expect(page).toHaveURL(/saved=updated$/); expect(await persistedItems(id)).toEqual([{ ...sourceItems[1], position: 1, food_id: null }, { ...sourceItems[0], position: 2 }, sourceItems[2]]); expect(diarySnapshot()).toBe(diaryBefore);
      const maximumId = await persist(`Maximum ${locale}`, Array.from({ length: 50 }, (_, index) => item(index + 1, { food_name: `Maximum item ${index + 1}`, notes: null }))); await page.goto(`/${locale}/saved-meals/${maximumId}/edit`); await expect(rows).toHaveCount(50); await expect(page.getByRole("button", { name: copy[locale].add, exact: true })).toBeDisabled();
      await rows.nth(49).getByRole("button", { name: copy[locale].remove, exact: true }).click(); await expect(rows).toHaveCount(49); await expect(page.getByRole("button", { name: copy[locale].add, exact: true })).toBeEnabled(); expect((await persistedItems(maximumId)).length).toBe(50);
      contracts.push({ state: "item-operations-and-max", locale, stableKeys: true, linkedSnapshotRetainedAfterUnlink: true, noAutosave: true, enabledControlsAtLeast44: true }); await context.close();
    }
  });

  test("R9 collection and hidden identity errors have visible keyboard destinations", async ({ browser }) => {
    test.skip(baseline, "Changed-source validation destinations."); const context = await contextFor(browser); const page = await context.newPage(); const before = mealSnapshot(longMealId);
    for (const injected of ["row-key", "duplicate-row-key", "collection"] as const) {
      await page.goto(`/en/saved-meals/${longMealId}/edit`); const values = await editorValues(page);
      await editorField(page, injected === "row-key" ? "item_row_key_0" : injected === "duplicate-row-key" ? "item_row_key_1" : "item_count").evaluate((control: HTMLInputElement, value) => { control.value = value; }, injected === "row-key" ? "malformed" : injected === "duplicate-row-key" ? values[0].rowKey! : "0");
      await submit(page).click(); await expect(summary(page)).toBeFocused(); const links = summary(page).getByRole("link"); expect(await links.count()).toBeGreaterThan(0);
      for (let i = 0; i < await links.count(); i += 1) { const href = await links.nth(i).getAttribute("href"); expect(href).toMatch(/^#/); const target = page.locator(`[id="${href!.slice(1)}"]`); await expect(target).toHaveCount(1); await expect(target).toBeVisible(); expect(await target.getAttribute("type")).not.toBe("hidden"); await links.nth(i).focus(); await page.keyboard.press("Enter"); await expect(target).toBeFocused(); }
      if (injected === "duplicate-row-key") await expect(links).toHaveAttribute("href", "#saved-meal-row-1");
      expect((await editorValues(page)).map(({ rowKey }) => rowKey)).toEqual(values.map(({ rowKey }) => rowKey)); expect(mealSnapshot(longMealId)).toBe(before);
    }
    contracts.push({ state: "collection-row-key-errors", visibleTargets: true, hiddenInputNeverFocused: true, noMutation: true }); await context.close();
  });

  test("R1/R9 destination errors and stale review reflow at every required locale and width", async ({ browser }) => {
    test.skip(baseline, "Changed-source responsive rejected review."); test.setTimeout(120_000);
    const before = diarySnapshot();
    for (const locale of locales) {
      const id = await persist(`Rejected responsive ${locale}`, sourceItems.slice(0, 3));
      const context = await contextFor(browser); const page = await context.newPage(); await page.goto(`/${locale}/saved-meals/${id}/use?date=${date}`);
      await editorField(page, "entry_date").fill(""); await submit(page).click(); await expect(page.getByTestId("saved-meal-use-validation_error")).toBeVisible();
      for (const width of widths) { await page.setViewportSize({ width, height: 1000 }); assertGeometry(await geometry(page, "destination-validation"), locale); }
      await editorField(page, "entry_date").fill(date); await persist(`Changed responsive ${locale}`, sourceItems.slice(0, 3), id); await submit(page).click(); await expect(page.getByTestId("saved-meal-use-stale_review")).toBeVisible();
      for (const width of widths) { await page.setViewportSize({ width, height: 1000 }); assertGeometry(await geometry(page, "stale-review"), locale); await reachControl(page.getByTestId("saved-meal-use-stale_review").getByRole("link")); await reachControl(submit(page)); }
      expect(diarySnapshot()).toBe(before); await context.close();
    }
    contracts.push({ state: "rejected-review-matrix", combinations: 16, invalidAndStaleNoDiaryMutation: true });
  });

  test("R8 explicit confirmation alone logs; invalid and stale reviews preserve database state", async ({ browser }) => {
    test.skip(baseline, "Changed-source exact logging regression."); test.setTimeout(120_000);
    const id = await persist("Explicit confirmation source", sourceItems.slice(0, 3)); const context = await contextFor(browser, { viewport: { width: 320, height: 1000 } }); const page = await context.newPage(); const before = diarySnapshot();
    await page.goto(`/he/saved-meals/${id}/use?date=${date}`); expect(diarySnapshot()).toBe(before); await editorField(page, "entry_date").fill(destinationDate); await editorField(page, "meal_type").selectOption("dinner"); expect(diarySnapshot()).toBe(before);
    await page.getByRole("link", { name: copy.he.edit, exact: true }).click(); await expect(page).toHaveURL(/\/edit\?date=/); expect(diarySnapshot()).toBe(before);
    await page.goto(`/he/saved-meals/${id}/use?date=${destinationDate}`); await editorField(page, "entry_date").fill(""); await submit(page).click(); await expect(page.getByTestId("saved-meal-use-validation_error")).toBeVisible(); await expect(editorField(page, "entry_date")).toHaveAttribute("aria-invalid", "true");
    const described = await editorField(page, "entry_date").getAttribute("aria-describedby"); expect(described).toBeTruthy(); for (const target of described!.split(/\s+/)) await expect(page.locator(`[id="${target}"]`)).toBeVisible(); expect(diarySnapshot()).toBe(before); assertGeometry(await geometry(page, "destination-validation"), "he"); await axe(page, "destination-validation"); await screenshot(page, "destination-validation-he-320");
    await editorField(page, "entry_date").fill(destinationDate); await editorField(page, "meal_type").selectOption("dinner"); await persist("Changed after review loaded", sourceItems.slice(0, 3), id); await submit(page).click(); await expect(page.getByTestId("saved-meal-use-stale_review")).toBeVisible(); expect(diarySnapshot()).toBe(before);
    const reload = page.getByTestId("saved-meal-use-stale_review").getByRole("link"); await reachControl(reload); await screenshot(page, "stale-review-reload-he-320"); assertGeometry(await geometry(page, "stale-review"), "he"); await axe(page, "stale-review"); await reload.click(); await assertReview(page, id, "he"); expect(diarySnapshot()).toBe(before);
    // A native refresh captures the fresh confirmation separately from stale feedback.
    await page.reload(); await expect(page.getByTestId("saved-meal-use-stale_review")).toHaveCount(0); await assertReview(page, id, "he"); expect(diarySnapshot()).toBe(before);
    await editorField(page, "meal_type").selectOption("dinner"); await reachControl(submit(page)); await screenshot(page, "confirmation-he-320");
    await submit(page).click(); await expect(page).toHaveURL(`/he/today?date=${destinationDate}&savedMeal=logged`);
    const logged = await client.from("diary_entries").select("food_id,food_name,brand_name,serving_quantity,serving_unit,calories,protein_g,carbohydrates_g,fat_g,notes,saved_meal_item_position,saved_meal_diary_run_id,entry_date,meal_type").eq("user_id", userId).eq("source", "saved_meal").eq("entry_date", destinationDate).order("saved_meal_item_position");
    expect(logged.error).toBeNull(); expect(logged.data).toHaveLength(3); expect(new Set(logged.data!.map((row) => row.saved_meal_diary_run_id)).size).toBe(1);
    expect(logged.data!.map(({ saved_meal_item_position, saved_meal_diary_run_id: run, entry_date: entryDate, meal_type: mealType, ...snapshot }) => { expect(run).toBeTruthy(); expect(entryDate).toBe(destinationDate); expect(mealType).toBe("dinner"); return { ...snapshot, position: saved_meal_item_position }; })).toEqual(sourceItems.slice(0, 3));
    const after = diarySnapshot(); await page.reload(); expect(diarySnapshot()).toBe(after); await page.goto(`/he/saved-meals/${archivedMealId}/use?date=${date}`); await expect(page.getByTestId("saved-meal-use-archived")).toBeVisible(); expect(diarySnapshot()).toBe(after);
    contracts.push({ state: "explicit-logging", openingChangingDestinationEditingInvalidStaleNoMutation: true, oneAtomicRun: true, exactOrderedSnapshots: true, date: destinationDate, mealType: "dinner", redirectAndReloadSafe: true, archivedRejected: true }); await context.close();
  });

  test("R9/R10 real delayed server responses expose pending states without automatic submission", async ({ browser }) => {
    test.skip(baseline, "Changed-source pending presentation."); test.setTimeout(120_000);
    const context = await contextFor(browser); const page = await context.newPage();
    const diaryBefore = diarySnapshot(); const mealBefore = mealSnapshot(longMealId);
    await page.goto(`/en/saved-meals/${longMealId}/edit`); await editorField(page, "name").fill(" ");
    const editor = await holdActionResponse(page);
    try {
      await editorField(page, "name").focus(); await page.keyboard.press("Tab"); expect(editor.count()).toBe(0);
      const values = await editorValues(page); await submit(page).click(); await editor.received;
      await expect(submit(page)).toBeDisabled(); await expect(submit(page)).toHaveAttribute("aria-busy", "true");
      await expect(page.getByRole("button", { name: copy.en.add, exact: true })).toBeDisabled();
      const itemActions = editorItems(page).getByRole("button");
      for (let i = 0; i < await itemActions.count(); i += 1) await expect(itemActions.nth(i)).toBeDisabled();
      expect(editor.count()).toBe(1); expect(await editorValues(page)).toEqual(values); expect(mealSnapshot(longMealId)).toBe(mealBefore); expect(diarySnapshot()).toBe(diaryBefore);
      editor.release(); await expect(summary(page)).toBeFocused(); await expect(submit(page)).toBeEnabled();
      await expect(submit(page)).not.toHaveAttribute("aria-busy", "true"); expect(editor.count()).toBe(1);
    } finally { editor.release(); await page.unrouteAll({ behavior: "wait" }); }

    await page.goto(`/en/saved-meals/${oneMealId}/use?date=${date}`); const review = await holdActionResponse(page);
    try {
      await editorField(page, "entry_date").fill(destinationDate); await editorField(page, "meal_type").selectOption("dinner"); await editorField(page, "meal_type").focus();
      expect(review.count()).toBe(0); expect(diarySnapshot()).toBe(diaryBefore);
      await editorField(page, "entry_date").fill(""); await submit(page).click(); await review.received;
      await expect(submit(page)).toBeDisabled(); await expect(submit(page)).toHaveAttribute("aria-busy", "true"); expect(review.count()).toBe(1); expect(diarySnapshot()).toBe(diaryBefore);
      review.release(); await expect(page.getByTestId("saved-meal-use-validation_error")).toBeVisible(); await expect(submit(page)).toBeEnabled(); await expect(submit(page)).not.toHaveAttribute("aria-busy", "true"); expect(review.count()).toBe(1); expect(diarySnapshot()).toBe(diaryBefore);
    } finally { review.release(); await page.unrouteAll({ behavior: "wait" }); }
    contracts.push({ state: "real-pending-responses", authoritativeServerResults: true, editorItemAndSubmitControlsDisabled: true, confirmationDisabled: true, oneExplicitPostPerAttempt: true, noFocusOrDestinationAutosubmit: true, rejectedDataUnchanged: true }); await context.close();
  });

  test("R9/R10 rendered contrast, keyboard focus, reduced motion, forced colors and native paths", async ({ browser }) => {
    test.skip(baseline, "Changed-source accessibility presentation."); test.setTimeout(120_000);
    for (const locale of locales) {
      const context = await contextFor(browser, { viewport: { width: 320, height: 1000 }, reducedMotion: "reduce", forcedColors: "active" }); const page = await context.newPage(); await page.goto(`/${locale}/saved-meals/${oneMealId}/use?date=${date}`); assertGeometry(await geometry(page, "forced-colors-review"), locale);
      await editorField(page, "entry_date").focus();
      const mealType = editorField(page, "meal_type");
      // Native date controls expose separate keyboard stops for their date segments.
      for (let stop = 0; stop < 8 && !await mealType.evaluate((element) => element === document.activeElement); stop += 1) await page.keyboard.press("Tab");
      await expect(mealType).toBeFocused();
      const focus = await mealType.evaluate((element) => ({ width: getComputedStyle(element).outlineWidth, style: getComputedStyle(element).outlineStyle, color: getComputedStyle(element).outlineColor, reduced: matchMedia("(prefers-reduced-motion: reduce)").matches, forced: matchMedia("(forced-colors: active)").matches })); expect(parseFloat(focus.width)).toBeGreaterThanOrEqual(3); expect(focus.style).toBe("solid"); expect(focus.reduced).toBe(true); expect(focus.forced).toBe(true); accessibility.push({ state: "forced-colors-keyboard-focus", locale, ...focus }); await context.close();
    }
    const context = await contextFor(browser); const page = await context.newPage(); await page.goto("/en/saved-meals/new"); await page.mouse.move(0, 0);
    const controls = (await geometry(page, "input-boundaries")).controls.filter((control) => control.tag !== "BUTTON");
    for (const control of controls) { expect(control.boundaryContrast).toBeGreaterThanOrEqual(3); accessibility.push({ state: "rendered-input-boundary", ...control }); }
    await editorField(page, "name").focus(); await page.keyboard.press("Tab"); const focus = await editorField(page, "meal_locale").evaluate((element) => ({ width: getComputedStyle(element).outlineWidth, style: getComputedStyle(element).outlineStyle, color: getComputedStyle(element).outlineColor })); expect(parseFloat(focus.width)).toBeGreaterThanOrEqual(3); expect(focus.style).toBe("solid"); accessibility.push({ state: "normal-keyboard-focus", ...focus }); await context.close();
    const noJs = await contextFor(browser, { javaScriptEnabled: false }); const native = await noJs.newPage(); const diaryBefore = diarySnapshot(); await native.goto(`/en/saved-meals/${oneMealId}/use?date=${date}`); await assertReview(native, oneMealId, "en"); await native.getByRole("link", { name: copy.en.edit, exact: true }).click(); await expect(native).toHaveURL(/\/edit\?date=/); await expect(editorItems(native)).toHaveCount(1); const key = await editorItems(native).first().getAttribute("data-row-key"); await native.getByRole("button", { name: copy.en.add, exact: true }).click(); await expect(editorItems(native)).toHaveCount(1); expect(await editorItems(native).first().getAttribute("data-row-key")).toBe(key); expect(diarySnapshot()).toBe(diaryBefore); contracts.push({ state: "no-javascript", exactServerRenderedReviewAndNativeEditLink: true, addRequiresEstablishedReactState: true, noFullNoJsSupportClaim: true, diaryUnchanged: true }); await noJs.close();
  });
});
