import { provisionActivatedLocalUserForUi, queryLocalAuthFixture } from "@/e2e/helpers/local-auth";
import type { Database } from "@/lib/supabase/database.types";
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
const sourceFiles = ["components/setup/setup-form.tsx", "components/setup/setup-page.tsx"];
const git = (...args: string[]) => execFileSync("git", args, { encoding: "utf8" }).trim();
const digest = (value: string | Buffer) => createHash("sha256").update(value).digest("hex");
const baseline = sourceFiles.every(file => digest(readFileSync(file)) === digest(execFileSync("git", ["show", `${approvedHead}:${file}`])));
const mode = baseline ? "baseline" : "after";
const evidenceDirectory = join("docs", "ui-phase5e", "evidence");
const localUrl = process.env.LOCAL_SUPABASE_URL;
const localKey = process.env.LOCAL_SUPABASE_PUBLISHABLE_KEY;
const locales = ["en", "he"] as const;
const widths = [320, 390, 768, 1440] as const;
const targetFields = ["calories", "protein_g", "carbohydrates_g", "fat_g"] as const;
const messages = { en, he };
const date = "2024-02-29";
const password = "Ui5eSetupSyntheticPassword123!";
type Locale = (typeof locales)[number];
type Account = { client: SupabaseClient<Database>; id: string; email: string; storageState: Awaited<ReturnType<BrowserContext["storageState"]>> };

test.skip(process.env.DATE_E2E_LOCAL_SUPABASE !== "1" || !localUrl || !localKey, "Phase 5E Setup requires the isolated local-only test runner.");

test.describe.serial("UI Phase 5E Profile and Targets", () => {
  let blank: Account;
  let populated: Account;
  let browserVersion: string;
  let sourceIdentity: unknown;
  const measurements: unknown[] = [];
  const screenshots: unknown[] = [];
  const contracts: unknown[] = [];
  const accessibility: unknown[] = [];

  const field = (page: Page, name: string) => page.locator(`main [name="${name}"]`);
  const form = (page: Page) => page.locator('form:has(input[name="effectiveDate"])');
  const save = (page: Page) => form(page).locator('button[type="submit"]');
  const contextFor = (browser: Browser, account = populated, options: Parameters<Browser["newContext"]>[0] = {}) => browser.newContext({ storageState: account.storageState, viewport: { width: 390, height: 1000 }, ...options });

  async function accountFor(browser: Browser, label: string): Promise<Account> {
    const email = `ui5e-setup-${label}-${randomUUID()}@example.test`;
    await provisionActivatedLocalUserForUi({ email, password });
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.goto("/en/auth/sign-in");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password").fill(password);
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await expect(page).toHaveURL(/\/en\/today\?date=/);
    const storageState = await context.storageState();
    await context.close();
    const client = createClient<Database>(localUrl!, localKey!, { auth: { autoRefreshToken: false, persistSession: false } });
    const auth = await client.auth.signInWithPassword({ email, password });
    expect(auth.error).toBeNull();
    const id = auth.data.user!.id;
    expect(id).toMatch(/^[0-9a-f-]{36}$/);
    return { client, email, id, storageState };
  }

  function snapshot(account = populated) {
    return queryLocalAuthFixture(`select jsonb_build_object(
      'profile',(select to_jsonb(p) from public.profiles p where p.id='${account.id}'),
      'targets',(select coalesce(jsonb_agg(to_jsonb(t) order by t.id),'[]') from public.nutrition_targets t where t.user_id='${account.id}'),
      'diary',(select coalesce(jsonb_agg(to_jsonb(d) order by d.id),'[]') from public.diary_entries d where d.user_id='${account.id}')
    );`);
  }

  async function values(page: Page) {
    return form(page).locator('input[name],select[name]').evaluateAll(elements => Object.fromEntries(elements.filter(element => ["effectiveDate", "display_name", "preferred_language", "calories", "protein_g", "carbohydrates_g", "fat_g"].includes((element as HTMLInputElement).name)).map(element => {
      const control = element as HTMLInputElement | HTMLSelectElement;
      return [control.name, control.value];
    })));
  }

  async function associations(control: Locator) {
    return control.evaluate(element => {
      const rectangle = element.getBoundingClientRect();
      return { name: element.getAttribute("name"), id: element.id, invalid: element.getAttribute("aria-invalid"), focused: document.activeElement === element, distanceAboveViewport: Math.max(0, -rectangle.bottom), y: rectangle.y, height: rectangle.height, viewportHeight: innerHeight, descriptions: (element.getAttribute("aria-describedby") ?? "").split(/\s+/).filter(Boolean).map(id => ({ id, text: document.getElementById(id)?.textContent ?? null })) };
    });
  }

  async function geometry(page: Page, state: string) {
    const result = await page.evaluate(() => {
      const rect = (element: Element) => { const r = element.getBoundingClientRect(); return { x: r.x, y: r.y, right: r.right, bottom: r.bottom, width: r.width, height: r.height }; };
      const root = document.querySelector('form:has(input[name="effectiveDate"])')!;
      return { locale: document.documentElement.lang, direction: document.documentElement.dir, viewport: { width: innerWidth, height: innerHeight }, document: { clientWidth: document.documentElement.clientWidth, scrollWidth: document.documentElement.scrollWidth }, body: { scrollWidth: document.body.scrollWidth }, controls: Array.from(root.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLButtonElement>('input:not([type="hidden"]),select,button')).map(element => ({ ...rect(element), name: element.name, tag: element.tagName, disabled: element.disabled, direction: getComputedStyle(element).direction, outline: getComputedStyle(element).outline })), text: Array.from(document.querySelectorAll('main h1,main h2,main p,main label > span,[id$="-error"]')).map(element => ({ ...rect(element), text: element.textContent, overflow: getComputedStyle(element).overflow, textOverflow: getComputedStyle(element).textOverflow })) };
    });
    measurements.push({ mode, state, route: new URL(page.url()).pathname + new URL(page.url()).search, ...result });
    return result;
  }

  function assertGeometry(result: Awaited<ReturnType<typeof geometry>>, locale: Locale) {
    expect(result.locale).toBe(locale);
    expect(result.direction).toBe(locale === "he" ? "rtl" : "ltr");
    expect(result.document.scrollWidth).toBeLessThanOrEqual(result.document.clientWidth);
    expect(result.body.scrollWidth).toBeLessThanOrEqual(result.document.clientWidth);
    for (const element of [...result.controls, ...result.text]) {
      expect(element.x).toBeGreaterThanOrEqual(-0.5);
      expect(element.right).toBeLessThanOrEqual(result.document.clientWidth + 0.5);
    }
    for (const control of result.controls.filter(control => !control.disabled)) {
      expect(control.width).toBeGreaterThanOrEqual(44);
      expect(control.height).toBeGreaterThanOrEqual(44);
    }
    for (const element of result.text) {
      expect(element.overflow).not.toBe("hidden");
      expect(element.textOverflow).not.toBe("ellipsis");
    }
  }

  async function reachable(control: Locator) {
    await control.evaluate(element => element.scrollIntoView({ block: "center", inline: "nearest", behavior: "instant" }));
    const rectangle = await control.evaluate(element => {
      const r = element.getBoundingClientRect();
      const x = r.x + r.width / 2, y = r.y + r.height / 2;
      const hit = document.elementFromPoint(x, y);
      return { x, y, width: r.width, height: r.height, visibleAtCenter: !!hit && (hit === element || element.contains(hit)) };
    });
    expect(rectangle.visibleAtCenter).toBe(true);
    return rectangle;
  }

  async function capture(page: Page, label: string) {
    const filename = `setup-${mode}-${label}.png`;
    const image = await page.screenshot({ path: join(evidenceDirectory, filename), animations: "disabled" });
    screenshots.push({ filename, sha256: digest(image), viewport: page.viewportSize(), route: new URL(page.url()).pathname + new URL(page.url()).search });
  }

  async function axe(page: Page, state: string) {
    const result = await new AxeBuilder({ page }).include("main").withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
    accessibility.push({ state, locale: await page.locator("html").getAttribute("lang"), violations: result.violations.map(({ id, impact, nodes }) => ({ id, impact, nodes: nodes.map(({ target, failureSummary }) => ({ target, failureSummary })) })) });
    if (!baseline) expect(result.violations).toEqual([]);
  }

  async function reject(page: Page, locale: Locale) {
    await field(page, "display_name").fill(`אבג/123 ${"W".repeat(81)}`);
    await field(page, "preferred_language").selectOption(locale);
    for (const name of targetFields) await field(page, name).fill("-1.125");
    const before = await values(page);
    await save(page).scrollIntoViewIfNeeded();
    const beforeResponse = await associations(field(page, "display_name"));
    await save(page).click();
    await expect(form(page).getByRole("alert")).toContainText(messages[locale].Setup.errors.validation);
    await expect(form(page)).toContainText(messages[locale].Setup.errors.displayNameTooLong);
    const after = await values(page);
    if (baseline) {
      expect(after).toEqual({ ...before, preferred_language: "en" });
    } else expect(after).toEqual(before);
    const controls = await Promise.all(["display_name", ...targetFields].map(name => associations(field(page, name))));
    measurements.push({ state: "rejected-server-validation", locale, beforeResponse, controls, submittedValues: before, returnedValues: after, fullValuesPreserved: JSON.stringify(before) === JSON.stringify(after), preferredLanguagePreserved: before.preferred_language === after.preferred_language, effectiveDate: before.effectiveDate });
    return controls;
  }

  test.beforeAll(async ({ browser }) => {
    test.setTimeout(120_000);
    if (!localUrl || !["localhost", "127.0.0.1"].includes(new URL(localUrl).hostname)) throw new Error("Refusing nonlocal fixtures.");
    mkdirSync(evidenceDirectory, { recursive: true });
    sourceIdentity = { approvedHead, approvedTree, head: git("rev-parse", "HEAD"), tree: git("rev-parse", "HEAD^{tree}"), buildId: readFileSync(".next/BUILD_ID", "utf8").trim(), productionDiffSha256: digest(git("diff", "HEAD", "--", ...sourceFiles)), sourceFileSha256: Object.fromEntries(sourceFiles.map(file => [file, digest(readFileSync(file))])) };
    if (baseline) {
      expect(git("rev-parse", "HEAD")).toBe(approvedHead);
      expect(git("rev-parse", "HEAD^{tree}")).toBe(approvedTree);
    }
    browserVersion = browser.version();
    blank = await accountFor(browser, "blank");
    populated = await accountFor(browser, "populated");
    const persisted = await populated.client.rpc("persist_setup", { p_display_name: "Synthetic אבג/123 profile", p_preferred_language: "en", p_effective_from: date, p_calories: 0, p_protein_g: 12.125, p_carbohydrates_g: null as unknown as number, p_fat_g: 0 });
    expect(persisted.error).toBeNull();
  });

  test.afterAll(() => {
    writeFileSync(join(evidenceDirectory, `setup-${mode}-manifest.json`), `${JSON.stringify({ mode, sourceIdentity, browserVersion, fixture: { blank: { email: blank?.email, userId: blank?.id }, populated: { email: populated?.email, userId: populated?.id }, date }, measurements, screenshots, contracts, accessibility, limitations: ["Automated axe is not manual screen-reader qualification.", "Unsupported preferred language is injected only to exercise the existing server rejection contract.", "Broader date, atomic-write, idempotency and no-JavaScript recovery regressions remain in setup-persistence.spec.ts."] }, null, 2)}\n`);
  });

  test("baseline reproduces missing invalid-field descriptions and rejected-submission focus", async ({ browser }) => {
    test.skip(!baseline, "Baseline-only reproduction.");
    for (const locale of locales) {
      const context = await contextFor(browser);
      const page = await context.newPage();
      const before = snapshot();
      await page.goto(`/${locale}/setup?effectiveDate=${date}`);
      expect(await page.evaluate(() => document.activeElement?.tagName)).toBe("BODY");
      const controls = await reject(page, locale);
      for (const control of controls) {
        expect(control.invalid).toBeNull();
        expect(control.descriptions).toEqual([]);
        expect(control.focused).toBe(false);
      }
      await capture(page, `invalid-${locale}-390`);
      assertGeometry(await geometry(page, "invalid"), locale);
      await axe(page, "invalid");
      await field(page, "preferred_language").evaluate(element => {
        const option = document.createElement("option"); option.value = "xx"; option.textContent = "Unsupported synthetic language"; (element as HTMLSelectElement).append(option); (element as HTMLSelectElement).value = "xx"; element.dispatchEvent(new Event("change", { bubbles: true }));
      });
      await save(page).click();
      await expect(form(page)).toContainText(messages[locale].Setup.errors.invalidLanguage);
      const language = await associations(field(page, "preferred_language"));
      expect(language.invalid).toBeNull();
      expect(language.descriptions).toEqual([]);
      measurements.push({ state: "unsupported-language-server-rejection", locale, control: language });
      expect(snapshot()).toBe(before);
      contracts.push({ state: "baseline-rejection", locale, databaseUnchanged: true, snapshotSha256: digest(before), textNumericAndDateValuesPreserved: true, preferredLanguagePreserved: locale === "en", preferredLanguageReset: locale === "he" ? { submitted: "he", rendered: "en" } : null, effectiveDate: date });
      await context.close();
    }
  });

  test("after covers blank, populated and invalid Setup at all required EN/HE widths", async ({ browser }) => {
    test.skip(baseline, "Changed-source matrix.");
    test.setTimeout(120_000);
    for (const locale of locales) for (const account of [blank, populated]) {
      const context = await contextFor(browser, account);
      const page = await context.newPage();
      const before = snapshot(account);
      await page.goto(`/${locale}/setup?effectiveDate=${date}`);
      expect(await page.evaluate(() => document.activeElement?.tagName)).toBe("BODY");
      const state = account === blank ? "blank" : "populated";
      for (const width of widths) {
        await page.setViewportSize({ width, height: 1000 });
        assertGeometry(await geometry(page, state), locale);
        await reachable(save(page));
        if ((locale === "en" && width === 1440 && state === "populated") || (locale === "he" && width === 320 && state === "blank")) await capture(page, `${state}-${locale}-${width}`);
      }
      if (account === populated) {
        await page.setViewportSize({ width: 390, height: 1000 });
        const controls = await reject(page, locale);
        await expect(field(page, "display_name")).toBeFocused();
        for (const control of controls) {
          expect(control.invalid).toBe("true");
          expect(control.id).toBe(`setup-${control.name}`);
          const expected = control.name === "display_name" ? messages[locale].Setup.errors.displayNameTooLong : messages[locale].Setup.errors.negativeValue;
          expect(control.descriptions).toContainEqual({ id: `setup-${control.name}-error`, text: expected });
        }
        await capture(page, `invalid-${locale}-390`);
        for (const width of widths) { await page.setViewportSize({ width, height: 1000 }); assertGeometry(await geometry(page, "invalid"), locale); }
        await axe(page, "invalid");
      } else await axe(page, "blank");
      expect(snapshot(account)).toBe(before);
      contracts.push({ state: `${state}-matrix`, locale, widths, databaseUnchanged: true, snapshotSha256: digest(before), effectiveDate: date });
      await context.close();
    }
  });

  test("after focuses the first remaining invalid field after each response without losing zero or blank values", async ({ browser }) => {
    test.skip(baseline, "Changed-source rejection focus.");
    for (const locale of locales) {
      const context = await contextFor(browser);
      const page = await context.newPage();
      await page.goto(`/${locale}/setup?effectiveDate=${date}`);
      const before = snapshot();
      await reject(page, locale);
      await expect(field(page, "display_name")).toBeFocused();
      await field(page, "display_name").fill("Unsaved אבג/123 profile");
      await field(page, "calories").fill("0");
      await field(page, "fat_g").fill("");
      const retained = await values(page);
      await save(page).click();
      await expect(field(page, "protein_g")).toBeFocused();
      await expect(field(page, "display_name")).not.toHaveAttribute("aria-invalid", "true");
      await expect(field(page, "calories")).not.toHaveAttribute("aria-invalid", "true");
      expect(await values(page)).toEqual(retained);
      await field(page, "protein_g").fill("12.125");
      await field(page, "carbohydrates_g").fill("");
      await field(page, "preferred_language").evaluate(element => {
        const option = document.createElement("option"); option.value = "xx"; option.textContent = "Unsupported synthetic language"; (element as HTMLSelectElement).append(option); (element as HTMLSelectElement).value = "xx"; element.dispatchEvent(new Event("change", { bubbles: true }));
      });
      await save(page).click();
      await expect(field(page, "preferred_language")).toBeFocused();
      const language = await associations(field(page, "preferred_language"));
      expect(language.invalid).toBe("true");
      expect(language.descriptions.some(description => description.text?.includes(messages[locale].Setup.errors.invalidLanguage))).toBe(true);
      measurements.push({ state: "unsupported-language-server-rejection", locale, control: language });
      await field(page, "preferred_language").focus();
      await page.keyboard.press("Tab");
      await expect(field(page, "calories")).toBeFocused();
      const focus = await field(page, "calories").evaluate(element => ({ style: getComputedStyle(element).outlineStyle, width: getComputedStyle(element).outlineWidth }));
      expect(focus.style).not.toBe("none"); expect(parseFloat(focus.width)).toBeGreaterThanOrEqual(2);
      await page.emulateMedia({ forcedColors: "active", reducedMotion: "reduce" });
      await field(page, "preferred_language").focus(); await page.keyboard.press("Tab");
      const forced = await field(page, "calories").evaluate(element => ({ style: getComputedStyle(element).outlineStyle, width: getComputedStyle(element).outlineWidth, transitionDuration: getComputedStyle(element).transitionDuration }));
      expect(forced.style).not.toBe("none"); expect(parseFloat(forced.width)).toBeGreaterThanOrEqual(2); expect(parseFloat(forced.transitionDuration)).toBeLessThanOrEqual(0.001);
      accessibility.push({ state: "keyboard-focus-media", locale, focus, forced });
      expect(snapshot()).toBe(before);
      contracts.push({ state: "repeated-validation", locale, databaseUnchanged: true, snapshotSha256: digest(before), retainedBlankAndZero: true });
      await context.close();
    }
  });

  test("after progressive rejection retains native permalink, date, values and field descriptions", async ({ browser }) => {
    test.skip(baseline, "Changed-source progressive descriptions.");
    for (const locale of locales) {
      const context = await contextFor(browser, populated, { javaScriptEnabled: false, viewport: { width: 320, height: 1000 } });
      const page = await context.newPage();
      const before = snapshot();
      await page.goto(`/${locale}/setup?effectiveDate=${date}`);
      await expect(form(page)).toHaveAttribute("action", `/${locale}/setup/nojs?effectiveDate=${date}`);
      await field(page, "display_name").fill("W".repeat(81));
      await field(page, "calories").fill("0");
      await field(page, "protein_g").fill("");
      const retained = await values(page);
      await save(page).click();
      await expect(page).toHaveURL(`/${locale}/setup/nojs?effectiveDate=${date}`);
      await expect(field(page, "display_name")).toHaveAttribute("aria-invalid", "true");
      const control = await associations(field(page, "display_name"));
      expect(control.descriptions.some(description => description.text?.includes(messages[locale].Setup.errors.displayNameTooLong))).toBe(true);
      expect(await values(page)).toEqual(retained);
      await expect(field(page, "effectiveDate")).toHaveValue(date);
      assertGeometry(await geometry(page, "progressive-invalid"), locale);
      expect(snapshot()).toBe(before);
      contracts.push({ state: "progressive-rejection", locale, nativePermalink: true, effectiveDate: date, fullValuesPreserved: true, databaseUnchanged: true, snapshotSha256: digest(before) });
      await context.close();
    }
  });
});
