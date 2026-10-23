import { provisionActivatedLocalUserForUi, queryLocalAuthFixture } from "@/e2e/helpers/local-auth";
import { attachKeyboardFocusFailure } from "@/e2e/helpers/focus-diagnostics";
import type { Database, Json } from "@/lib/supabase/database.types";
import en from "@/messages/en.json";
import he from "@/messages/he.json";
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Browser, type BrowserContext, type Locator, type Page } from "@playwright/test";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { execFileSync } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const approvedHead = "1ffd19dc90f8dc442160d3b2bbaea0c0a4ce07b7";
const approvedTree = "65dfa021dc38ce2feb0d0a1dc73d63ac39d02739";
const sourceFiles = ["components/custom-foods/custom-food-form.tsx", "components/custom-foods/custom-food-page.tsx"];
const git = (...args: string[]) => execFileSync("git", args, { encoding: "utf8" }).trim();
const digest = (value: string | Buffer) => createHash("sha256").update(value).digest("hex");
const baseline = git("rev-parse", "HEAD") === approvedHead && sourceFiles.every(file => digest(readFileSync(file)) === digest(execFileSync("git", ["show", `${approvedHead}:${file}`])));
const mode = baseline ? "baseline" : "after";
const localUrl = process.env.LOCAL_SUPABASE_URL;
const localKey = process.env.LOCAL_SUPABASE_PUBLISHABLE_KEY;
const password = "Ui5eCustomSynthetic123!";
const email = `ui5e-custom-${randomUUID()}@example.test`;
const messages = { en, he };
const widths = [320, 390, 768, 1440] as const;
const locales = ["en", "he"] as const;
const longName = `Custom מזון / 123 ${"N".repeat(174)}`;
const longBrand = `Brand מותג / 123 ${"B".repeat(101)}`;
const longUnit = `unit יחידה 123 ${"U".repeat(22)}`;
const longAlias = `Alias כינוי / 123 ${"A".repeat(175)}`;

test.skip(process.env.DATE_E2E_LOCAL_SUPABASE !== "1" || !localUrl || !localKey, "Phase 5E requires isolated synthetic local Supabase.");

test.describe.serial("UI Phase 5E Custom Food", () => {
  let client: SupabaseClient<Database>;
  let userId: string;
  let storageState: Awaited<ReturnType<BrowserContext["storageState"]>>;
  let foodId: string;
  let archivedId: string;
  let evidenceDirectory: string;
  let browserVersion: string;
  let sourceIdentity: unknown;
  const measurements: unknown[] = [];
  const screenshots: unknown[] = [];
  const contracts: unknown[] = [];
  const accessibility: unknown[] = [];
  const field = (page: Page, name: string) => page.getByTestId("custom-food-form").locator(`[name="${name}"]`);
  const rows = (page: Page) => page.getByTestId("custom-food-alias-row");
  const submit = (page: Page) => page.getByTestId("custom-food-form").locator('button[type="submit"]');
  const summary = (page: Page) => page.getByTestId("custom-food-validation-summary");
  const contextFor = (browser: Browser, options: Parameters<Browser["newContext"]>[0] = {}) => browser.newContext({ storageState, viewport: { width: 390, height: 1000 }, ...options });

  async function persist(name: string) {
    const result = await client.rpc("persist_custom_food", {
      p_aliases: [{ alias_text: longAlias, language_code: "und" }, { alias_text: "Second synthetic כינוי", language_code: "en" }, { alias_text: "Third synthetic כינוי", language_code: "en" }] as Json,
      p_brand_name: longBrand,
      p_food_id: null as unknown as string,
      p_locale: "und",
      p_name: name,
      p_nutrient_basis: "per_serving",
      p_nutrients: [{ amount: 123.125, code: "energy_kcal" }, { amount: 0, code: "protein_g" }, { amount: 1.25, code: "sodium_mg" }] as Json,
      p_serving_quantity: 1.125,
      p_serving_unit: longUnit,
    });
    expect(result.error).toBeNull();
    return result.data![0].food_id;
  }

  function databaseSnapshot() {
    return queryLocalAuthFixture(`select jsonb_build_object(
      'foods',(select coalesce(jsonb_agg(to_jsonb(f) order by f.id),'[]') from public.foods f where f.owner_user_id='${userId}'),
      'nutrients',(select coalesce(jsonb_agg(to_jsonb(n) order by n.id),'[]') from public.food_nutrients n join public.foods f on f.id=n.food_id where f.owner_user_id='${userId}'),
      'aliases',(select coalesce(jsonb_agg(to_jsonb(a) order by a.id),'[]') from public.food_aliases a join public.foods f on f.id=a.food_id where f.owner_user_id='${userId}'),
      'receipts',(select coalesce(jsonb_agg(to_jsonb(r) order by r.id),'[]') from public.custom_food_creation_requests r where r.user_id='${userId}'),
      'diary',(select coalesce(jsonb_agg(to_jsonb(d) order by d.id),'[]') from public.diary_entries d where d.user_id='${userId}'));`);
  }

  async function measure(page: Page, state: string) {
    const result = await page.evaluate(() => {
      const rect = (element: Element) => { const r = element.getBoundingClientRect(); return { x: r.x, y: r.y, right: r.right, bottom: r.bottom, width: r.width, height: r.height }; };
      const form = document.querySelector('[data-testid="custom-food-form"]')!;
      const visible = (element: Element) => element.checkVisibility() && element.getBoundingClientRect().height > 0;
      return {
        locale: document.documentElement.lang, direction: document.documentElement.dir,
        viewport: { width: innerWidth, height: innerHeight },
        document: { clientWidth: document.documentElement.clientWidth, scrollWidth: document.documentElement.scrollWidth },
        body: { clientWidth: document.body.clientWidth, scrollWidth: document.body.scrollWidth },
        focused: { name: document.activeElement?.getAttribute("name"), id: document.activeElement?.id, tag: document.activeElement?.tagName },
        firstError: form.querySelector('[aria-invalid="true"]') ? rect(form.querySelector('[aria-invalid="true"]')!) : null,
        controls: Array.from(form.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLButtonElement>('input:not([type="hidden"]):not([type="checkbox"]):not([type="radio"]),select,button,summary,a')).filter(visible).map(element => ({ ...rect(element), name: element.getAttribute("name"), tag: element.tagName, text: element.textContent?.trim() })),
        labelsAndErrors: Array.from(form.querySelectorAll('label > span,.ui-field-error,h1,h2,legend:not(.sr-only),p')).filter(visible).map(element => ({ ...rect(element), text: element.textContent, scrollWidth: element.scrollWidth, clientWidth: element.clientWidth, overflow: getComputedStyle(element).overflow, textOverflow: getComputedStyle(element).textOverflow })),
        sections: Array.from(form.querySelectorAll('fieldset,details,[data-testid="custom-food-alias-row"]')).filter(visible).map(element => ({ ...rect(element), scrollWidth: element.scrollWidth, clientWidth: element.clientWidth })),
        disclosures: Array.from(form.querySelectorAll('details')).map(element => ({ open: element.open, summary: rect(element.querySelector("summary")!), invalidNames: Array.from(element.querySelectorAll('[aria-invalid="true"]')).map(input => input.getAttribute("name")) })),
        invalid: Array.from(form.querySelectorAll('[aria-invalid="true"]')).map(element => ({ name: element.getAttribute("name"), visible: visible(element), descriptions: (element.getAttribute("aria-describedby") ?? "").split(/\s+/).filter(Boolean).map(id => ({ id, text: document.getElementById(id)?.textContent ?? null })) })),
      };
    });
    measurements.push({ mode, state, route: new URL(page.url()).pathname + new URL(page.url()).search, ...result });
    return result;
  }

  function assertGeometry(result: Awaited<ReturnType<typeof measure>>) {
    expect(result.document.scrollWidth).toBeLessThanOrEqual(result.document.clientWidth);
    expect(result.body.scrollWidth).toBeLessThanOrEqual(result.document.clientWidth);
    for (const element of [...result.controls, ...result.labelsAndErrors, ...result.sections]) {
      expect(element.x).toBeGreaterThanOrEqual(-0.5);
      expect(element.right).toBeLessThanOrEqual(result.document.clientWidth + 0.5);
    }
    for (const element of [...result.labelsAndErrors, ...result.sections]) expect(element.scrollWidth).toBeLessThanOrEqual(element.clientWidth + 1);
    for (const element of result.controls.filter(control => ["BUTTON", "SUMMARY", "A"].includes(control.tag))) {
      expect(element.width).toBeGreaterThanOrEqual(44);
      expect(element.height).toBeGreaterThanOrEqual(44);
    }
  }

  async function capture(page: Page, label: string) {
    const filename = `custom-food-${mode}-${label}.png`;
    const image = await page.screenshot({ path: join(evidenceDirectory, filename), animations: "disabled" });
    screenshots.push({ filename, sha256: digest(image), viewport: page.viewportSize(), locale: await page.locator("html").getAttribute("lang"), route: new URL(page.url()).pathname + new URL(page.url()).search });
  }

  async function axe(page: Page, state: string) {
    const result = await new AxeBuilder({ page }).include("main").withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
    accessibility.push({ state, locale: await page.locator("html").getAttribute("lang"), violations: result.violations.map(({ id, impact, nodes }) => ({ id, impact, nodes: nodes.map(({ target, failureSummary }) => ({ target, failureSummary })) })) });
    if (!baseline) expect(result.violations).toEqual([]);
  }

  async function description(control: Locator) {
    return control.evaluate(element => ({ name: element.getAttribute("name"), invalid: element.getAttribute("aria-invalid"), focused: document.activeElement === element, descriptions: (element.getAttribute("aria-describedby") ?? "").split(/\s+/).filter(Boolean).map(id => ({ id, text: document.getElementById(id)?.textContent ?? null })) }));
  }

  async function fillInvalidCreate(page: Page, locale: "en" | "he") {
    const t = messages[locale].CustomFoodEditor;
    await field(page, "brand_name").fill(longBrand);
    await field(page, "serving_quantity").fill("0");
    await field(page, "serving_unit").fill(longUnit);
    await field(page, "nutrient_protein_g").fill("0");
    await page.getByText(t.nutrients.groups.minerals, { exact: true }).click();
    await field(page, "nutrient_sodium_mg").fill("-1");
    await page.getByText(t.nutrients.groups.minerals, { exact: true }).click();
    for (const value of [longAlias, "Duplicate כינוי", "duplicate כינוי"]) {
      await page.getByRole("button", { name: t.aliases.add, exact: true }).click();
      await rows(page).last().locator('input[name^="alias_text_"]').fill(value);
      await rows(page).last().locator("select").selectOption("und");
    }
  }

  async function keyboardDestination(page: Page, link: Locator, expectedControl: Locator) {
    try {
      await link.focus();
      await page.keyboard.press("Enter");
      await expect(expectedControl).toBeFocused();
      await expect(expectedControl).toBeVisible();
      const hit = await expectedControl.evaluate(element => { const r = element.getBoundingClientRect(); const hit = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2); const nav = document.querySelector('[data-testid="mobile-bottom-navigation"]'); const navTop = nav?.checkVisibility() ? nav.getBoundingClientRect().top : innerHeight; return { hit: !!hit && (hit === element || element.contains(hit)), y: r.y, bottom: r.bottom, viewportHeight: innerHeight, navTop }; });
      expect(hit.hit).toBe(true);
      expect(hit.y).toBeGreaterThanOrEqual(0);
      expect(hit.bottom).toBeLessThanOrEqual(Math.min(hit.viewportHeight, hit.navTop));
      return { ...(await description(expectedControl)), ...hit };
    } catch (error) {
      // Diagnostic failures must preserve the original keyboard assertion error.
      await attachKeyboardFocusFailure(page, link, expectedControl, test.info()).catch(() => {});
      throw error;
    }
  }

  test.beforeAll(async ({ browser }) => {
    test.setTimeout(120_000);
    if (!localUrl || !["localhost", "127.0.0.1"].includes(new URL(localUrl).hostname)) throw new Error("Refusing nonlocal fixtures.");
    evidenceDirectory = join(process.cwd(), "docs/ui-phase5e/evidence");
    mkdirSync(evidenceDirectory, { recursive: true });
    sourceIdentity = { head: git("rev-parse", "HEAD"), tree: git("rev-parse", "HEAD^{tree}"), buildId: readFileSync(".next/BUILD_ID", "utf8").trim(), productionDiffSha256: digest(git("diff", "HEAD", "--", ...sourceFiles, "messages/en.json", "messages/he.json")), sourceFileSha256: Object.fromEntries([...sourceFiles, "messages/en.json", "messages/he.json"].map(file => [file, digest(readFileSync(file))])) };
    if (baseline) { expect(git("rev-parse", "HEAD")).toBe(approvedHead); expect(git("rev-parse", "HEAD^{tree}")).toBe(approvedTree); }
    browserVersion = browser.version();
    await provisionActivatedLocalUserForUi({ email, password });
    client = createClient<Database>(localUrl, localKey as string, { auth: { autoRefreshToken: false, persistSession: false } });
    const auth = await client.auth.signInWithPassword({ email, password });
    expect(auth.error).toBeNull(); userId = auth.data.user!.id;
    foodId = await persist(longName);
    archivedId = await persist(`Archived מזון 123 ${"R".repeat(166)}`);
    expect((await client.rpc("set_custom_food_archived", { p_food_id: archivedId, p_is_archived: true })).error).toBeNull();
    const context = await browser.newContext(); const page = await context.newPage();
    await page.goto("/en/auth/sign-in"); await page.getByLabel("Email").fill(email); await page.getByLabel("Password").fill(password); await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await expect(page).toHaveURL(/\/en\/today\?date=\d{4}-\d{2}-\d{2}$/); storageState = await context.storageState(); await context.close();
  });

  test.afterAll(async () => {
    if (evidenceDirectory) writeFileSync(join(evidenceDirectory, `custom-food-${mode}-manifest.json`), JSON.stringify({ task: "UI_PHASE_5E_PROFILE_CUSTOM_FOOD_SECONDARY_UX_001", mode, sourceIdentity, browser: { name: "Chromium", version: browserVersion }, fixture: { synthetic: true, email, userId, foodId, archivedId, longName, longBrand, longUnit, longAlias }, measurements, screenshots, contracts, accessibility }, null, 2) + "\n");
    if (userId) { await client.auth.signOut(); queryLocalAuthFixture(`delete from auth.users where id='${userId}' and email='${email}';`); }
  });

  test("baseline exact-approved long-form rejection, alias identity and disclosure measurements", async ({ browser }) => {
    test.skip(!baseline, "Exact approved baseline capture only."); test.setTimeout(120_000);
    const context = await contextFor(browser); const page = await context.newPage(); const before = databaseSnapshot();
    for (const [locale, width] of [["en", 390], ["he", 320]] as const) {
      await page.setViewportSize({ width, height: 1000 }); await page.goto(`/${locale}/foods/custom/new`);
      await measure(page, "blank-create-baseline");
      await fillInvalidCreate(page, locale);
      const key = await field(page, "creation_key").inputValue();
      await submit(page).click(); await expect(field(page, "name")).toHaveAttribute("aria-invalid", "true");
      await expect(page.locator("#custom-food-nutrient_sodium_mg-error")).toHaveCount(1);
      await expect(summary(page)).toHaveCount(0);
      const measurement = await measure(page, "long-form-rejection-baseline");
      expect(measurement.firstError!.bottom).toBeLessThan(0);
      expect(measurement.invalid.find(control => control.name === "nutrient_sodium_mg")!.visible).toBe(false);
      expect(await field(page, "creation_key").inputValue()).toBe(key);
      await capture(page, `rejection-${locale}-${width}`);
      const staleBefore = await description(field(page, "alias_text_2"));
      await rows(page).first().getByRole("button", { name: messages[locale].CustomFoodEditor.aliases.remove, exact: true }).click();
      const staleAfter = await description(field(page, "alias_text_1"));
      expect(staleBefore.invalid).toBe("true"); expect(staleAfter.invalid).toBe("false");
      measurements.push({ state: "alias-error-identity-baseline", locale, staleBefore, staleAfter, errorsAfter: await page.locator('[id^="custom-food-alias_"][id$="-error"]').count() });
    }
    await page.setViewportSize({ width: 390, height: 1000 }); await page.goto(`/en/foods/custom/${foodId}/edit`);
    await page.getByText(en.CustomFoodEditor.nutrients.groups.minerals, { exact: true }).click(); await field(page, "nutrient_sodium_mg").fill("-1"); await page.getByText(en.CustomFoodEditor.nutrients.groups.minerals, { exact: true }).click();
    await field(page, "alias_text_2").fill(await field(page, "alias_text_1").inputValue()); await field(page, "alias_language_2").selectOption(await field(page, "alias_language_1").inputValue()); await submit(page).click(); await expect(field(page, "alias_text_2")).toHaveAttribute("aria-invalid", "true");
    await measure(page, "edit-rejection-baseline"); await capture(page, "edit-rejection-en-390"); await axe(page, "baseline-rejected-edit");
    expect(databaseSnapshot()).toBe(before); contracts.push({ state: "baseline", rejectedCreateAndEditNoMutation: true, creationKeyUnchanged: true }); await context.close();
  });

  test("R3 R4 Create summary focuses visible identity, serving, collapsed nutrient and stable alias destinations", async ({ browser }) => {
    test.skip(baseline, "Changed-source acceptance."); test.setTimeout(120_000);
    const before = databaseSnapshot();
    for (const locale of locales) {
      const context = await contextFor(browser); const page = await context.newPage(); await page.goto(`/${locale}/foods/custom/new`); await fillInvalidCreate(page, locale);
      const key = await field(page, "creation_key").inputValue(); const storageKey = await page.getByTestId("custom-food-form").getAttribute("data-draft-storage-key");
      await submit(page).click(); await expect(summary(page)).toBeFocused(); await expect(field(page, "creation_key")).toHaveValue(key);
      await expect(field(page, "brand_name")).toHaveValue(longBrand); await expect(field(page, "nutrient_protein_g")).toHaveValue("0");
      const retained = await page.evaluate(key => JSON.parse(sessionStorage.getItem(key!)!), storageKey);
      expect(retained.idempotencyKey).toBe(key); expect(retained.values.aliases).toHaveLength(3); expect(retained.values.nutrients.sodium_mg).toBe("-1");
      const identity = await keyboardDestination(page, summary(page).getByRole("link", { name: messages[locale].CustomFoodEditor.identity.name, exact: true }), field(page, "name"));
      const serving = await keyboardDestination(page, summary(page).getByRole("link", { name: messages[locale].CustomFoodEditor.basis.servingQuantity, exact: true }), field(page, "serving_quantity"));
      const nutrientLink = summary(page).locator('a[href="#custom-food-nutrient_sodium_mg"]');
      const nutrient = await keyboardDestination(page, nutrientLink, field(page, "nutrient_sodium_mg"));
      expect(await field(page, "nutrient_sodium_mg").evaluate(element => element.closest("details")?.open)).toBe(true);
      for (const result of [identity, serving, nutrient]) { expect(result.invalid).toBe("true"); expect(result.descriptions.some(d => !!d.text)).toBe(true); }
      const aliasLink = summary(page).getByRole("link").filter({ hasText: messages[locale].CustomFoodEditor.aliases.row.replace("{number}", "3") });
      const aliasTarget = await aliasLink.getAttribute("href");
      await keyboardDestination(page, aliasLink, field(page, "alias_text_2"));
      const stableKey = await rows(page).nth(2).getAttribute("data-alias-key"); expect(stableKey).toBeTruthy();
      await rows(page).first().getByRole("button", { name: messages[locale].CustomFoodEditor.aliases.remove, exact: true }).click();
      await expect(rows(page).nth(1)).toHaveAttribute("data-alias-key", stableKey!); await expect(field(page, "alias_text_1")).toHaveAttribute("aria-invalid", "true");
      await keyboardDestination(page, summary(page).locator(`a[href="${aliasTarget}"]`), field(page, "alias_text_1"));
      await page.getByRole("button", { name: messages[locale].CustomFoodEditor.aliases.add, exact: true }).click(); await expect(field(page, "alias_text_2")).toHaveAttribute("aria-invalid", "false");
      const resubmittedAliases = await rows(page).evaluateAll(elements => elements.map(row => ({ key: row.getAttribute("data-alias-key"), text: row.querySelector<HTMLInputElement>('input[name^="alias_text_"]')!.value, language: row.querySelector<HTMLSelectElement>("select")!.value })));
      let release!: () => void; let received!: () => void;
      const held = new Promise<void>(resolve => { release = resolve; }); const requestReceived = new Promise<void>(resolve => { received = resolve; });
      await page.route("**/foods/custom/new", async route => {
        if (route.request().method() !== "POST" || !route.request().headers()["next-action"]) { await route.continue(); return; }
        received(); await held; await route.continue();
      });
      try {
        await submit(page).click(); await requestReceived;
        await expect(submit(page)).toBeDisabled(); await expect(summary(page)).toHaveCount(0); await expect(page.locator('[id^="custom-food-"][id$="-error"]')).toHaveCount(0);
        for (const name of ["name", "serving_quantity", "nutrient_sodium_mg", "alias_text_1"]) { await expect(field(page, name)).toHaveAttribute("aria-invalid", "false"); await expect(field(page, name)).not.toHaveAttribute("aria-describedby", /-error/); }
        await expect(field(page, "creation_key")).toHaveValue(key); await expect(field(page, "brand_name")).toHaveValue(longBrand); await expect(field(page, "nutrient_protein_g")).toHaveValue("0"); await expect(field(page, "nutrient_sodium_mg")).toHaveValue("-1");
        expect(await rows(page).evaluateAll(elements => elements.map(row => ({ key: row.getAttribute("data-alias-key"), text: row.querySelector<HTMLInputElement>('input[name^="alias_text_"]')!.value, language: row.querySelector<HTMLSelectElement>("select")!.value })))).toEqual(resubmittedAliases);
        contracts.push({ state: "repeated-create-request-pending", locale, genuinePostHeldBeforeContinue: true, oldSummaryAndAssociationsCleared: true, creationKeyAndAliasValuesPreserved: true, submitDisabled: true });
      } finally { release(); }
      await expect(summary(page)).toBeFocused(); await page.unroute("**/foods/custom/new");
      await expect(field(page, "creation_key")).toHaveValue(key); await expect(field(page, "brand_name")).toHaveValue(longBrand); await expect(field(page, "nutrient_protein_g")).toHaveValue("0"); await expect(field(page, "nutrient_sodium_mg")).toHaveValue("-1");
      expect(await rows(page).evaluateAll(elements => elements.map(row => ({ key: row.getAttribute("data-alias-key"), text: row.querySelector<HTMLInputElement>('input[name^="alias_text_"]')!.value, language: row.querySelector<HTMLSelectElement>("select")!.value })))).toEqual(resubmittedAliases);
      await expect(field(page, "alias_text_1")).toHaveAttribute("aria-invalid", "true"); await expect(field(page, "alias_text_2")).toHaveAttribute("aria-invalid", "false");
      await keyboardDestination(page, summary(page).locator(`a[href="${aliasTarget}"]`), field(page, "alias_text_1"));
      contracts.push({ state: "repeated-create-rejection", locale, aliasKeysAndValuesPreserved: true, existingDraftRevisionRemount: true, creationKeyUnchanged: true });
      assertGeometry(await measure(page, "create-validation-navigation")); await summary(page).evaluate(element => element.scrollIntoView({ block: "start", behavior: "instant" })); await capture(page, `rejection-${locale}-390`); await axe(page, "rejected-create");
      for (const width of widths) {
        await page.setViewportSize({ width, height: 1000 });
        if (width === 320 || width === 1440) {
          await field(page, "nutrient_sodium_mg").evaluate(element => { element.closest("details")!.open = false; });
          const destination = await keyboardDestination(page, summary(page).locator('a[href="#custom-food-nutrient_sodium_mg"]'), field(page, "nutrient_sodium_mg"));
          contracts.push({ state: "create-rejected-responsive-destination", locale, width, destination, ancestorDisclosureOpened: true, bottomNavigationClear: true });
        }
        assertGeometry(await measure(page, "create-validation-navigation-matrix"));
        if ((locale === "he" && width === 320) || (locale === "en" && width === 1440)) { await summary(page).evaluate(element => element.scrollIntoView({ block: "start", behavior: "instant" })); await capture(page, `rejection-${locale}-${width}`); }
      }
      await page.setViewportSize({ width: 390, height: 1000 });
      await page.reload(); await expect(field(page, "creation_key")).toHaveValue(key); await expect(field(page, "brand_name")).toHaveValue(longBrand); await expect(field(page, "nutrient_sodium_mg")).toHaveValue("-1"); await expect(rows(page)).toHaveCount(3);
      contracts.push({ state: "create-validation", locale, identity, serving, nutrient, draftKeyPreserved: true, sessionRestored: true, aliasIdentityPreservedAfterRemoval: true, newAliasDoesNotInheritError: true }); await context.close();
    }
    expect(databaseSnapshot()).toBe(before);
  });

  test("R3 R5 Edit validation preserves aliases, revision, values and closed group navigation", async ({ browser }) => {
    test.skip(baseline, "Changed-source acceptance."); test.setTimeout(120_000); const before = databaseSnapshot();
    for (const locale of locales) {
      const context = await contextFor(browser); const page = await context.newPage(); await page.goto(`/${locale}/foods/custom/${foodId}/edit`);
      await page.getByText(messages[locale].CustomFoodEditor.nutrients.groups.minerals, { exact: true }).click(); await field(page, "nutrient_sodium_mg").fill("-1"); await page.getByText(messages[locale].CustomFoodEditor.nutrients.groups.minerals, { exact: true }).click();
      await field(page, "alias_text_2").fill(await field(page, "alias_text_1").inputValue()); await field(page, "alias_language_2").selectOption(await field(page, "alias_language_1").inputValue()); await submit(page).click(); await expect(summary(page)).toBeFocused();
      await expect(field(page, "name")).toHaveValue(longName); await expect(field(page, "brand_name")).toHaveValue(longBrand); await expect(field(page, "nutrient_protein_g")).toHaveValue("0");
      const beforeNavigation = await measure(page, "edit-rejected-closed-group"); expect(beforeNavigation.invalid.find(control => control.name === "nutrient_sodium_mg")?.visible).toBe(false);
      const destination = await keyboardDestination(page, summary(page).locator('a[href="#custom-food-nutrient_sodium_mg"]'), field(page, "nutrient_sodium_mg"));
      const aliasTarget = await summary(page).getByRole("link").last().getAttribute("href");
      const retainedSummaryLink = await summary(page).locator(`a[href="${aliasTarget}"]`).elementHandle();
      const retainedAliasInput = await field(page, "alias_text_2").elementHandle();
      await rows(page).first().getByRole("button", { name: messages[locale].CustomFoodEditor.aliases.remove, exact: true }).click();
      await keyboardDestination(page, summary(page).locator(`a[href="${aliasTarget}"]`), field(page, "alias_text_1")); await expect(field(page, "alias_text_1")).toHaveAttribute("aria-invalid", "true");
      // Reindexing preserves the error link and its surviving input, including focus between commits.
      expect(await summary(page).locator(`a[href="${aliasTarget}"]`).evaluate((current, previous) => current === previous, retainedSummaryLink)).toBe(true);
      expect(await field(page, "alias_text_1").evaluate((current, previous) => current === previous, retainedAliasInput)).toBe(true);
      assertGeometry(await measure(page, "edit-validation-navigation")); await summary(page).evaluate(element => element.scrollIntoView({ block: "start", behavior: "instant" })); if (locale === "en") await capture(page, "edit-rejection-en-390"); await axe(page, "rejected-edit");
      for (const width of widths) {
        await page.setViewportSize({ width, height: 1000 });
        if (width === 320 || width === 1440) {
          await field(page, "nutrient_sodium_mg").evaluate(element => { element.closest("details")!.open = false; });
          const responsiveDestination = await keyboardDestination(page, summary(page).locator('a[href="#custom-food-nutrient_sodium_mg"]'), field(page, "nutrient_sodium_mg"));
          contracts.push({ state: "edit-rejected-responsive-destination", locale, width, destination: responsiveDestination, ancestorDisclosureOpened: true, bottomNavigationClear: true });
        }
        assertGeometry(await measure(page, "edit-validation-navigation-matrix"));
        if ((locale === "he" && width === 320) || (locale === "en" && width === 1440)) { await summary(page).evaluate(element => element.scrollIntoView({ block: "start", behavior: "instant" })); await capture(page, `edit-rejection-${locale}-${width}`); }
      }
      contracts.push({ state: "edit-validation", locale, destination, rejectionNoMutation: true, aliasErrorFollowsSurvivingRow: true }); await context.close();
    }
    expect(databaseSnapshot()).toBe(before);
  });

  test("R10 EN HE responsive matrix, disclosure touch targets, forced colors and reduced motion", async ({ browser }) => {
    test.skip(baseline, "Changed-source acceptance."); test.setTimeout(180_000); const before = databaseSnapshot();
    for (const locale of locales) for (const width of widths) {
      const context = await contextFor(browser, { viewport: { width, height: 1000 }, reducedMotion: "reduce" }); const page = await context.newPage();
      await page.goto(`/${locale}/foods/custom/new`); assertGeometry(await measure(page, "blank-create"));
      await field(page, "name").fill(longName); await field(page, "brand_name").fill(longBrand); await field(page, "serving_quantity").fill("1.125"); await field(page, "serving_unit").fill(longUnit); await field(page, "nutrient_protein_g").fill("0");
      await page.getByRole("button", { name: messages[locale].CustomFoodEditor.aliases.add, exact: true }).click(); await field(page, "alias_text_0").fill(longAlias);
      for (const disclosure of await page.getByTestId("custom-food-form").locator("details summary").all()) await disclosure.click();
      assertGeometry(await measure(page, "populated-create-open-groups")); await expect(field(page, "name")).toHaveAttribute("dir", "auto"); await expect(field(page, "brand_name")).toHaveAttribute("dir", "auto"); await expect(field(page, "alias_text_0")).toHaveAttribute("dir", "auto");
      await page.goto(`/${locale}/foods/custom/${foodId}/edit`); assertGeometry(await measure(page, "existing-long-edit"));
      await page.goto(`/${locale}/foods/custom/${archivedId}/edit`); await expect(page.getByTestId("custom-food-archived-notice")).toBeVisible(); assertGeometry(await measure(page, "archived-long-edit"));
      await expect(page.locator("html")).toHaveAttribute("dir", locale === "he" ? "rtl" : "ltr");
      if (width === 320 || width === 1440) { await capture(page, `archived-${locale}-${width}`); await axe(page, "archived-edit"); }
      if (width === 390) {
        const disclosure = page.getByTestId("custom-food-form").locator("details summary").first(); await disclosure.focus(); await page.keyboard.press("Enter"); expect(await disclosure.evaluate(element => element.closest("details")?.open)).toBe(true);
        const normalFocus = await disclosure.evaluate(element => ({ outlineStyle: getComputedStyle(element).outlineStyle, outlineWidth: getComputedStyle(element).outlineWidth, transitionDuration: getComputedStyle(element).transitionDuration })); expect(normalFocus.outlineStyle).not.toBe("none");
        await page.emulateMedia({ forcedColors: "active" }); await disclosure.focus(); const forcedFocus = await disclosure.evaluate(element => ({ outlineStyle: getComputedStyle(element).outlineStyle, outlineWidth: getComputedStyle(element).outlineWidth })); expect(forcedFocus.outlineStyle).not.toBe("none"); expect(parseFloat(forcedFocus.outlineWidth)).toBeGreaterThanOrEqual(2); await page.emulateMedia({ forcedColors: "none" }); measurements.push({ state: "disclosure-focus-modes", locale, normalFocus, forcedFocus, reducedMotion: true });
      }
      await context.close();
    }
    expect(databaseSnapshot()).toBe(before); contracts.push({ state: "responsive-matrix", locales, widths, renderAndDisclosureNoMutation: true, mixedTextDirAuto: true });
  });
});
