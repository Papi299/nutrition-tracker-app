import { provisionActivatedLocalUserForUi, queryLocalAuthFixture } from "@/e2e/helpers/local-auth";
import type { Database, Json } from "@/lib/supabase/database.types";
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Browser, type BrowserContext, type Page } from "@playwright/test";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { execFileSync } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const baseline = process.env.UI_PHASE5B_BASELINE === "1";
const approvedHead = "5ae18263dc2af90834840ea63548c541292f0ab8";
const approvedTree = "9e3a193aefe7f60e76fd925e8ab8ae212055622d";
const evidenceDirectory = process.env.UI_PHASE5B_EVIDENCE_DIR ?? "docs/ui-phase5b/evidence";
const localUrl = process.env.LOCAL_SUPABASE_URL;
const localKey = process.env.LOCAL_SUPABASE_PUBLISHABLE_KEY;
const localOnly = process.env.DATE_E2E_LOCAL_SUPABASE === "1";
const mode = baseline ? "baseline" : "after";
const sourceFiles = [
  "app/[locale]/(app)/foods/custom/page.tsx",
  "app/[locale]/(app)/saved-meals/page.tsx",
  "app/[locale]/(app)/recipes/page.tsx",
  "components/custom-foods/custom-food-archive-control.tsx",
  "components/saved-meals/saved-meal-archive-control.tsx",
  "components/recipes/recipe-archive-control.tsx",
];
const widths = [320, 390, 768, 1440] as const;
const locales = ["en", "he"] as const;
const statuses = ["active", "archived"] as const;
const names = [
  "ספריית מזון בדיקת תצוגה אבג 123 / (מנה) ".repeat(4).trim(),
  `ארוחה 123-A/45 ${"W".repeat(160)} Hebrew/עברית`,
  `${"W".repeat(190)} 123-A/45`,
];
const brand = `${"Brand".repeat(21)} אבג-123`;
const servingUnit = `${"portion".repeat(4)}אבג123/45`;
const date = "2024-02-29";
const definitions = {
  food: { path: "foods/custom", prefix: "custom-food", attribute: "data-food-id", table: "foods", owner: "owner_user_id", archiveRpc: "set_custom_food_archived", archiveId: "p_food_id" },
  meal: { path: "saved-meals", prefix: "saved-meal", attribute: "data-saved-meal-id", table: "saved_meals", owner: "user_id", archiveRpc: "set_saved_meal_archived", archiveId: "p_saved_meal_id" },
  recipe: { path: "recipes", prefix: "recipe", attribute: "data-recipe-id", table: "recipes", owner: "user_id", archiveRpc: "set_recipe_archived", archiveId: "p_recipe_id" },
} as const;
type Kind = keyof typeof definitions;
type Status = (typeof statuses)[number];
type Locale = (typeof locales)[number];
const kinds = Object.keys(definitions) as Kind[];
const digest = (value: string | Buffer) => createHash("sha256").update(value).digest("hex");
const git = (...args: string[]) => execFileSync("git", args, { encoding: "utf8" }).trim();

test.skip(!localOnly || !localUrl || !localKey, "Phase 5B requires the repository's local-only runner.");

test.describe.serial("Phase 5B Library presentation and native contracts", () => {
  let storageState: Awaited<ReturnType<BrowserContext["storageState"]>>;
  let client: SupabaseClient<Database>;
  let userId: string;
  let browserVersion: string;
  let fixturesReady = false;
  const fixtures: Record<Kind, Record<Status, string[]>> = {
    food: { active: [], archived: [] }, meal: { active: [], archived: [] }, recipe: { active: [], archived: [] },
  };
  const runId = randomUUID();
  const email = `ui-phase5b-${runId}@example.test`;
  const password = "UiPhase5BLibraryPassword123!";
  const measurements: unknown[] = [];
  const screenshots: unknown[] = [];
  const accessibility: unknown[] = [];
  const contracts: unknown[] = [];
  const reachability: unknown[] = [];
  let sourceIdentity: unknown;

  const pathFor = (kind: Kind, locale: Locale, status: Status = "active", page = 1) => `/${locale}/${definitions[kind].path}?status=${status}&page=${page}`;
  const cardsFor = (page: Page, kind: Kind) => page.locator(`[${definitions[kind].attribute}]`);
  const cardFor = (page: Page, kind: Kind, id: string) => page.locator(`[${definitions[kind].attribute}="${id}"]`);

  async function contextFor(browser: Browser, options: Parameters<Browser["newContext"]>[0] = {}) {
    return browser.newContext({ storageState, viewport: { width: 390, height: 1000 }, ...options });
  }

  async function persist(kind: Kind, name: string) {
    expect(name.length).toBeLessThanOrEqual(200);
    let id: string | undefined;
    if (kind === "food") {
      const result = await client.rpc("persist_custom_food", {
        p_aliases: [] as Json, p_brand_name: brand, p_food_id: null as unknown as string,
        p_locale: "he", p_name: name, p_nutrient_basis: "per_serving", p_nutrients: [] as Json,
        p_serving_quantity: 123.45, p_serving_unit: servingUnit,
      });
      expect(result.error).toBeNull();
      id = result.data?.[0]?.food_id;
    } else if (kind === "meal") {
      const result = await client.rpc("persist_saved_meal", {
        p_expected_edit_revision: null as unknown as number, p_locale: "he", p_name: name,
        p_saved_meal_id: null as unknown as string,
        p_items: [{ position: 1, food_id: null, food_name: "Synthetic snapshot אבג 123", brand_name: null,
          serving_quantity: null, serving_unit: null, calories: 0, protein_g: null, carbohydrates_g: null, fat_g: null, notes: null }] as Json,
      });
      expect(result.error).toBeNull();
      id = result.data?.[0]?.saved_meal_id;
    } else {
      const result = await client.rpc("persist_recipe", {
        p_expected_edit_revision: null as unknown as number, p_locale: "he", p_name: name,
        p_recipe_id: null as unknown as string, p_yield_servings: 123.45,
        p_ingredients: [{ position: 1, food_id: null, ingredient_name: "Synthetic ingredient אבג 123", brand_name: null,
          quantity: null, unit: null, calories: 0, protein_g: null, carbohydrates_g: null, fat_g: null, notes: null }] as Json,
      });
      expect(result.error).toBeNull();
      id = result.data?.[0]?.recipe_id;
    }
    expect(id).toMatch(/^[0-9a-f-]{36}$/);
    return id as string;
  }

  async function archiveFixture(kind: Kind, id: string, archived: boolean) {
    if (kind === "food") {
      expect((await client.rpc("set_custom_food_archived", { p_food_id: id, p_is_archived: archived })).error).toBeNull();
    } else if (kind === "meal") {
      expect((await client.rpc("set_saved_meal_archived", { p_saved_meal_id: id, p_is_archived: archived })).error).toBeNull();
    } else {
      expect((await client.rpc("set_recipe_archived", { p_recipe_id: id, p_is_archived: archived })).error).toBeNull();
    }
  }

  async function prepareFixtures() {
    if (fixturesReady) return;
    expect(brand.length).toBeLessThanOrEqual(120);
    expect(servingUnit.length).toBeLessThanOrEqual(40);
    for (const kind of kinds) {
      for (const status of statuses) {
        for (const name of names) {
          const id = await persist(kind, name);
          fixtures[kind][status].push(id);
          if (status === "archived") await archiveFixture(kind, id, true);
        }
      }
    }
    fixturesReady = true;
  }

  function ownedSnapshot() {
    return queryLocalAuthFixture(`select jsonb_build_object(
      'foods', (select coalesce(jsonb_agg(to_jsonb(f) order by f.id), '[]') from public.foods f where owner_user_id = '${userId}'),
      'meals', (select coalesce(jsonb_agg(to_jsonb(m) order by m.id), '[]') from public.saved_meals m where user_id = '${userId}'),
      'recipes', (select coalesce(jsonb_agg(to_jsonb(r) order by r.id), '[]') from public.recipes r where user_id = '${userId}'),
      'diary', (select coalesce(jsonb_agg(to_jsonb(d) order by d.id), '[]') from public.diary_entries d where user_id = '${userId}')
    );`);
  }

  async function geometry(page: Page, kind: Kind, state: string) {
    const result = await page.evaluate((attribute) => {
      const rectangle = (element: Element) => {
        const r = element.getBoundingClientRect();
        return { x: r.x, y: r.y, width: r.width, height: r.height, right: r.right, bottom: r.bottom };
      };
      const controls = (root: Element) => Array.from(root.querySelectorAll<HTMLAnchorElement | HTMLButtonElement>("a,button")).map((element) => {
        const r = element.getBoundingClientRect();
        const style = getComputedStyle(element);
        const center = { x: r.x + r.width / 2, y: r.y + r.height / 2 };
        const inVerticalViewport = center.y >= 0 && center.y < innerHeight;
        const hit = inVerticalViewport && center.x >= 0 && center.x < innerWidth ? document.elementFromPoint(center.x, center.y) : null;
        return { ...rectangle(element), text: element.textContent?.trim(), tag: element.tagName,
          disabled: element instanceof HTMLButtonElement && element.disabled,
          href: element.getAttribute("href"), current: element.getAttribute("aria-current"), rel: element.getAttribute("rel"),
          visible: r.width > 0 && r.height > 0 && style.visibility !== "hidden" && style.display !== "none",
          inVerticalViewport, reachableAtCapture: inVerticalViewport ? !!hit && (element === hit || element.contains(hit)) : null,
        };
      });
      return {
        viewport: { width: innerWidth, height: innerHeight }, dir: document.documentElement.dir, lang: document.documentElement.lang,
        media: { reducedMotion: matchMedia("(prefers-reduced-motion: reduce)").matches, forcedColors: matchMedia("(forced-colors: active)").matches },
        document: { clientWidth: document.documentElement.clientWidth, scrollWidth: document.documentElement.scrollWidth },
        body: { clientWidth: document.body.clientWidth, scrollWidth: document.body.scrollWidth },
        cards: Array.from(document.querySelectorAll(`[${attribute}]`)).map((card) => ({
          id: card.getAttribute(attribute), ...rectangle(card), scrollWidth: card.scrollWidth, clientWidth: card.clientWidth,
          heading: card.querySelector("h2")?.textContent, headingDir: card.querySelector("h2")?.getAttribute("dir"),
          headingRect: card.querySelector("h2") ? rectangle(card.querySelector("h2")!) : null,
          headingStyle: card.querySelector("h2") ? { overflow: getComputedStyle(card.querySelector("h2")!).overflow, textOverflow: getComputedStyle(card.querySelector("h2")!).textOverflow } : null,
          metadataLabels: Array.from(card.querySelectorAll("dt")).map((element) => element.textContent),
          metadataValues: Array.from(card.querySelectorAll("dd")).map((element) => element.textContent),
          actions: controls(card),
        })),
        pageActions: controls(document.querySelector("main") ?? document.body),
        confirmations: Array.from(document.querySelectorAll('[role="group"][data-testid$="archive-confirmation"]')).map((group) => ({
          ...rectangle(group), scrollWidth: group.scrollWidth, clientWidth: group.clientWidth, label: group.getAttribute("aria-label"), actions: controls(group),
        })),
      };
    }, definitions[kind].attribute);
    measurements.push({ mode, kind, state, route: new URL(page.url()).pathname + new URL(page.url()).search, ...result });
    return result;
  }

  async function screenshot(page: Page, name: string) {
    const filename = `${mode}-${name}.png`;
    const path = join(evidenceDirectory, filename);
    // Viewport captures keep the packet small; measured document width records offscreen overflow.
    const image = await page.screenshot({ path, animations: "disabled", fullPage: false });
    screenshots.push({ filename, sha256: digest(image), viewport: page.viewportSize(), route: new URL(page.url()).pathname + new URL(page.url()).search });
  }

  function assertGeometry(result: Awaited<ReturnType<typeof geometry>>, locale: Locale) {
    expect(result.dir).toBe(locale === "he" ? "rtl" : "ltr");
    expect(result.lang).toBe(locale);
    expect(result.document.scrollWidth).toBeLessThanOrEqual(result.document.clientWidth);
    expect(result.body.scrollWidth).toBeLessThanOrEqual(result.document.clientWidth);
    for (const card of result.cards) {
      expect(card.x).toBeGreaterThanOrEqual(-0.5);
      expect(card.right).toBeLessThanOrEqual(result.document.clientWidth + 0.5);
      expect(card.scrollWidth).toBeLessThanOrEqual(card.clientWidth + 1);
      expect(card.headingDir).toBe("auto");
      expect(card.headingStyle?.textOverflow).not.toBe("ellipsis");
      expect(card.headingStyle?.overflow).not.toBe("hidden");
      for (const action of card.actions) {
        expect(action.visible).toBe(true);
        expect(action.x).toBeGreaterThanOrEqual(card.x);
        expect(action.right).toBeLessThanOrEqual(card.right + 0.5);
        expect(action.width).toBeGreaterThanOrEqual(44);
        expect(action.height).toBeGreaterThanOrEqual(44);
      }
      for (let i = 0; i < card.actions.length; i += 1) {
        for (let j = i + 1; j < card.actions.length; j += 1) {
          const a = card.actions[i], b = card.actions[j];
          expect(Math.max(0, Math.min(a.right, b.right) - Math.max(a.x, b.x)) * Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.y, b.y))).toBe(0);
        }
      }
    }
    for (const action of result.pageActions.filter((action) => !action.disabled)) {
      expect(action.width).toBeGreaterThanOrEqual(44);
      expect(action.height).toBeGreaterThanOrEqual(44);
    }
    for (const group of result.confirmations) {
      expect(group.scrollWidth).toBeLessThanOrEqual(group.clientWidth + 1);
      expect(group.right).toBeLessThanOrEqual(result.document.clientWidth + 0.5);
    }
  }

  async function proveReachability(page: Page, kind: Kind, state: string) {
    const actions = cardsFor(page, kind).locator("a,button");
    const result = [];
    for (let i = 0; i < await actions.count(); i += 1) {
      const action = actions.nth(i);
      await action.scrollIntoViewIfNeeded();
      // Center the control to avoid the established fixed mobile navigation at the viewport edge.
      await action.evaluate((element) => element.scrollIntoView({ block: "center", inline: "nearest", behavior: "instant" }));
      const measurement = await action.evaluate((element) => {
        const r = element.getBoundingClientRect();
        const x = r.x + r.width / 2, y = r.y + r.height / 2;
        const hit = document.elementFromPoint(x, y);
        return { text: element.textContent?.trim(), x, y, width: r.width, height: r.height,
          insideViewport: x >= 0 && x < innerWidth && y >= 0 && y < innerHeight,
          hitTarget: !!hit && (element === hit || element.contains(hit)) };
      });
      expect(measurement.insideViewport).toBe(true);
      expect(measurement.hitTarget).toBe(true);
      result.push(measurement);
    }
    reachability.push({ kind, state, viewport: page.viewportSize(), route: new URL(page.url()).pathname + new URL(page.url()).search, actions: result });
    await page.evaluate(() => window.scrollTo(0, 0));
  }

  async function axe(page: Page, kind: Kind, state: string) {
    const result = await new AxeBuilder({ page }).include("main").withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();
    accessibility.push({ kind, state, route: new URL(page.url()).pathname + new URL(page.url()).search,
      violations: result.violations.map(({ id, impact, nodes }) => ({ id, impact, nodes: nodes.map(({ target, failureSummary }) => ({ target, failureSummary })) })) });
    if (!baseline) expect(result.violations).toEqual([]);
  }

  test.beforeAll(async ({ browser }) => {
    test.setTimeout(120_000);
    if (!localUrl || !["localhost", "127.0.0.1"].includes(new URL(localUrl).hostname)) throw new Error("Refusing nonlocal Library fixtures.");
    mkdirSync(evidenceDirectory, { recursive: true });
    sourceIdentity = { head: git("rev-parse", "HEAD"), tree: git("rev-parse", "HEAD^{tree}"), buildId: readFileSync(".next/BUILD_ID", "utf8").trim(),
      presentationDiffSha256: digest(git("diff", "HEAD", "--", ...sourceFiles)),
      sourceFileSha256: Object.fromEntries(sourceFiles.map((file) => [file, digest(readFileSync(file))])) };
    if (baseline) {
      expect(git("rev-parse", "HEAD")).toBe(approvedHead);
      expect(git("rev-parse", "HEAD^{tree}")).toBe(approvedTree);
      expect(git("diff", "HEAD", "--", ...sourceFiles)).toBe("");
    }
    browserVersion = browser.version();
    await provisionActivatedLocalUserForUi({ email, password });
    client = createClient<Database>(localUrl, localKey as string, { auth: { autoRefreshToken: false, persistSession: false } });
    const auth = await client.auth.signInWithPassword({ email, password });
    expect(auth.error).toBeNull();
    userId = auth.data.user!.id;
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.goto("/en/auth/sign-in");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password").fill(password);
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await expect(page).toHaveURL(/\/en\/today\?date=\d{4}-\d{2}-\d{2}$/);
    storageState = await context.storageState();
    await context.close();
  });

  test.afterAll(async () => {
    writeFileSync(join(evidenceDirectory, `${mode}-manifest.json`), JSON.stringify({
      task: "UI_PHASE_5B_LIBRARY_MANAGEMENT_UX_001", mode, sourceIdentity, browser: { name: "Chromium", version: browserVersion },
      fixture: { version: "phase5b-valid-library-v1", names, nameLengths: names.map((name) => name.length), nameSha256: names.map(digest),
        brand, servingUnit, brandLength: brand.length, servingUnitLength: servingUnit.length, syntheticUser: true,
        transport: "authenticated RPCs against task-isolated local Supabase", ids: fixtures },
      measurements, screenshots, accessibility, reachability, contracts,
    }, null, 2) + "\n");
    if (userId) {
      await client.auth.signOut();
      queryLocalAuthFixture(`delete from auth.users where id = '${userId}' and email = '${email}';`);
    }
  });

  test("R1 baseline archived overflow and confirmation measurements", async ({ browser }) => {
    test.skip(!baseline, "Baseline reproduction runs explicitly before presentation edits.");
    test.setTimeout(120_000);
    await prepareFixtures();
    const context = await contextFor(browser, { viewport: { width: 768, height: 1000 } });
    const page = await context.newPage();
    for (const kind of ["meal", "recipe"] as const) {
      await page.goto(pathFor(kind, "en", "archived"));
      await expect(cardsFor(page, kind)).toHaveCount(3);
      const result = await geometry(page, kind, "archived-long-name");
      expect(result.document.scrollWidth).toBeGreaterThan(768);
      await screenshot(page, `${kind}-archived-en-768`);
      await axe(page, kind, "archived-long-name");
    }
    await page.setViewportSize({ width: 390, height: 1000 });
    for (const kind of kinds) {
      await page.goto(pathFor(kind, "en"));
      const card = cardFor(page, kind, fixtures[kind].active[2]);
      await card.getByRole("button", { name: "Archive", exact: true }).click();
      await expect(card.getByTestId(`${definitions[kind].prefix}-archive-confirmation`)).toBeVisible();
      await geometry(page, kind, "open-confirmation");
      if (kind === "meal") await screenshot(page, "meal-confirmation-en-390");
      await axe(page, kind, "open-confirmation");
    }
    await context.close();
  });

  test("R3 truly empty active and archived states in both locales", async ({ browser }) => {
    test.skip(baseline, "Baseline mode only records the reproduced defect.");
    const context = await contextFor(browser);
    const page = await context.newPage();
    for (const kind of kinds) for (const locale of locales) for (const status of statuses) {
      await page.goto(pathFor(kind, locale, status));
      await expect(page.getByTestId(`${definitions[kind].prefix}-management-empty-${status}`)).toBeVisible();
      await expect(cardsFor(page, kind)).toHaveCount(0);
      assertGeometry(await geometry(page, kind, `empty-${status}`), locale);
      if (locale === "en" && status === "active") await screenshot(page, `${kind}-empty-en-390`);
      if (status === "active") await expect(page.locator(`main a[href="/${locale}/${definitions[kind].path}/new"]`)).toHaveCount(2);
    }
    await context.close();
    await prepareFixtures();
  });

  test("R2 all widths, locales and active/archived cards retain full text and reachable actions", async ({ browser }) => {
    test.skip(baseline, "Baseline mode only records the reproduced defect.");
    test.setTimeout(180_000);
    await prepareFixtures();
    const context = await contextFor(browser);
    const page = await context.newPage();
    const before = ownedSnapshot();
    for (const kind of kinds) for (const locale of locales) for (const width of widths) for (const status of statuses) {
      await page.setViewportSize({ width, height: 1000 });
      await page.goto(pathFor(kind, locale, status));
      await expect(cardsFor(page, kind)).toHaveCount(3);
      for (let i = 0; i < names.length; i += 1) {
        await expect(cardFor(page, kind, fixtures[kind][status][i]).getByRole("heading", { level: 2 })).toHaveText(names[i]);
      }
      if (kind === "food") {
        await expect(cardsFor(page, kind).first()).toContainText(brand);
        await expect(cardsFor(page, kind).first()).toContainText(servingUnit);
      }
      const result = await geometry(page, kind, status);
      assertGeometry(result, locale);
      expect(result.cards.every((card) => card.metadataLabels.length === (kind === "meal" ? 4 : 5))).toBe(true);
      await expect(page.locator('main a[aria-current="page"]')).toHaveAttribute("href", pathFor(kind, locale, status));
      const links = result.cards[0].actions.filter((action) => action.tag === "A").map((action) => action.href);
      const id = result.cards[0].id;
      expect(links).toEqual(status === "archived" || kind === "food" ? [`/${locale}/${definitions[kind].path}/${id}/edit`] :
        kind === "meal" ? [`/${locale}/saved-meals/${id}/use`, `/${locale}/saved-meals/${id}/edit`] : [`/${locale}/recipes/${id}/edit`, `/${locale}/recipes/${id}/use`]);
      const comparative = status === "archived" && locale === "en" && width === 768 && kind !== "food";
      const mobile = status === "active" && ((width === 390 && (locale === "en" && kind !== "recipe" || locale === "he" && kind === "recipe")) || width === 320 && locale === "he" && kind === "meal");
      const desktop = status === "active" && width === 1440 && locale === "en";
      if (comparative || mobile || desktop) await screenshot(page, `${kind}-${status}-${locale}-${width}`);
      if (width === 390) await axe(page, kind, `${status}-${locale}`);
      await proveReachability(page, kind, `${status}-${locale}-${width}`);
    }
    expect(ownedSnapshot()).toBe(before);
    contracts.push({ scenario: "responsive-matrix", routeStateCount: 48, noDatabaseMutation: true, fullText: true, nativeActionOrder: true });
    await context.close();
  });

  test("R5 R7 archive cancel, pending, confirm and restore with keyboard, focus and preferences", async ({ browser }) => {
    test.skip(baseline, "Baseline mode only records the reproduced defect.");
    test.setTimeout(120_000);
    const context = await contextFor(browser, { reducedMotion: "reduce" });
    const page = await context.newPage();
    for (const kind of kinds) {
      const id = fixtures[kind].active[2];
      await page.goto(pathFor(kind, "en"));
      const card = cardFor(page, kind, id);
      const before = ownedSnapshot();
      const links = card.locator("a");
      await links.first().focus();
      await expect(links.first()).toBeFocused();
      expect(await links.first().evaluate((element) => getComputedStyle(element).outlineStyle)).not.toBe("none");
      for (let i = 1; i < await links.count(); i += 1) {
        await page.keyboard.press("Tab");
        await expect(links.nth(i)).toBeFocused();
      }
      await page.keyboard.press("Tab");
      const open = card.getByRole("button", { name: "Archive", exact: true });
      await expect(open).toBeFocused();
      await page.keyboard.press("Enter");
      const confirmation = card.getByTestId(`${definitions[kind].prefix}-archive-confirmation`);
      await expect(confirmation).toHaveAttribute("role", "group");
      await expect(confirmation).toHaveAttribute("aria-label", new RegExp(names[2].slice(0, 40)));
      assertGeometry(await geometry(page, kind, "open-confirmation"), "en");
      await axe(page, kind, "confirmation");
      if (kind === "meal") await screenshot(page, "meal-confirmation-en-390");
      await confirmation.getByRole("button", { name: "Cancel", exact: true }).click();
      await expect(confirmation).toHaveCount(0);
      expect(ownedSnapshot()).toBe(before);
      await open.click();
      let release: () => void = () => {};
      const gate = new Promise<void>((resolve) => { release = resolve; });
      await page.route(`**/${definitions[kind].path}*`, async (route) => {
        if (route.request().method() === "POST") await gate;
        await route.continue();
      });
      try {
        await confirmation.getByRole("button", { name: kind === "food" ? "Confirm archive" : kind === "meal" ? "Archive meal" : "Archive recipe", exact: true }).click();
        await expect(confirmation.getByRole("button", { name: "Archiving...", exact: true })).toBeDisabled();
        await expect(confirmation.getByRole("button", { name: "Cancel", exact: true })).toBeDisabled();
        release();
        await expect(page.getByTestId(`${definitions[kind].prefix}-management-success`)).toBeVisible();
      } finally { release(); await page.unroute(`**/${definitions[kind].path}*`); }
      expect(queryLocalAuthFixture(`select is_archived from public.${definitions[kind].table} where id = '${id}' and ${definitions[kind].owner} = '${userId}';`)).toBe("t");
      await page.goto(pathFor(kind, "en", "archived"));
      await expect(cardFor(page, kind, id)).toBeVisible();
      await expect(cardFor(page, kind, id).locator('a[href*="/use"]')).toHaveCount(0);
      await cardFor(page, kind, id).getByRole("button", { name: "Restore", exact: true }).click();
      await expect(page.getByTestId(`${definitions[kind].prefix}-management-success`)).toBeVisible();
      expect(queryLocalAuthFixture(`select is_archived from public.${definitions[kind].table} where id = '${id}' and ${definitions[kind].owner} = '${userId}';`)).toBe("f");
      await page.goto(pathFor(kind, "he"));
      const heCard = cardFor(page, kind, id);
      const beforeHebrewCancel = ownedSnapshot();
      await heCard.getByRole("button", { name: "העברה לארכיון", exact: true }).click();
      const heConfirmation = heCard.getByTestId(`${definitions[kind].prefix}-archive-confirmation`);
      await expect(heConfirmation).toHaveAttribute("role", "group");
      await expect(heConfirmation).toHaveAttribute("aria-label", new RegExp(names[2].slice(0, 40)));
      assertGeometry(await geometry(page, kind, "open-confirmation-he"), "he");
      await proveReachability(page, kind, "open-confirmation-he");
      await axe(page, kind, "confirmation-he");
      await heConfirmation.getByRole("button", { name: "ביטול", exact: true }).click();
      expect(ownedSnapshot()).toBe(beforeHebrewCancel);
      contracts.push({ scenario: "archive-lifecycle", kind, cancelNoMutation: true, pendingDisabled: true, explicitArchive: true, restore: true, archivedUseSuppressed: true });
    }
    await page.emulateMedia({ forcedColors: "active", reducedMotion: "reduce" });
    await page.goto(pathFor("recipe", "he"));
    const edit = cardsFor(page, "recipe").first().locator("a").first();
    await edit.focus();
    expect(await edit.evaluate((element) => getComputedStyle(element).outlineStyle)).not.toBe("none");
    assertGeometry(await geometry(page, "recipe", "forced-colors-reduced-motion"), "he");
    await context.close();
  });

  test("R3 invalid queries, retrieval errors and native safe recovery", async ({ browser }) => {
    test.skip(baseline, "Baseline mode only records the reproduced defect.");
    test.setTimeout(120_000);
    const context = await contextFor(browser);
    const page = await context.newPage();
    for (const kind of kinds) for (const locale of locales) {
      await page.goto(`/${locale}/${definitions[kind].path}?page=0`);
      await expect(page.getByTestId(`${definitions[kind].prefix}-management-invalid-query`)).toBeVisible();
      await expect(page.getByTestId(`${definitions[kind].prefix}-management-invalid-query`).getByRole("alert")).toBeVisible();
      assertGeometry(await geometry(page, kind, "invalid-query"), locale);
      if (locale === "en" && kind === "meal") await screenshot(page, "meal-invalid-en-390");
      // Match existing local management regression fault injection; restore grants in finally.
      queryLocalAuthFixture(`revoke select on table public.${definitions[kind].table} from authenticated;`);
      try {
        await page.goto(pathFor(kind, locale));
        const failure = page.getByTestId(`${definitions[kind].prefix}-management-retrieval-error`);
        await expect(failure).toBeVisible();
        await expect(failure).not.toContainText("permission denied");
        assertGeometry(await geometry(page, kind, "retrieval-error"), locale);
        await axe(page, kind, `retrieval-${locale}`);
        if (locale === "en" && kind === "meal") await screenshot(page, "meal-retrieval-en-390");
      } finally {
        queryLocalAuthFixture(`grant select on table public.${definitions[kind].table} to authenticated;`);
      }
      await page.getByTestId(`${definitions[kind].prefix}-management-retrieval-error`).getByRole("link").click();
      await expect(cardsFor(page, kind)).toHaveCount(3);
    }
    await context.close();
  });

  test("R4 R6 R8 real pagination, out-of-range recovery and no-JavaScript native navigation", async ({ browser }) => {
    test.skip(baseline, "Baseline mode only records the reproduced defect.");
    test.setTimeout(180_000);
    for (const kind of kinds) for (let i = 0; i < 21; i += 1) await persist(kind, `Phase5B pagination ${String(i).padStart(2, "0")} אבג`);
    const context = await contextFor(browser, { javaScriptEnabled: false });
    const page = await context.newPage();
    const before = ownedSnapshot();
    for (const kind of kinds) for (const locale of locales) {
      const withDate = kind !== "food" ? `&date=${date}` : "";
      await page.goto(pathFor(kind, locale) + withDate);
      await expect(cardsFor(page, kind)).toHaveCount(20);
      const totalLabel = locale === "en" ? kind === "food" ? "24 foods in this view." : kind === "meal" ? "24 saved meals" : "24 recipes" :
        kind === "food" ? "מספר המזונות בתצוגה הזאת: 24." : kind === "meal" ? "24 ארוחות שמורות" : "24 מתכונים";
      await expect(page.getByText(totalLabel, { exact: true })).toBeVisible();
      const firstIds = await cardsFor(page, kind).evaluateAll((cards, attribute) => cards.map((card) => card.getAttribute(attribute)), definitions[kind].attribute);
      const next = page.locator('main a[rel="next"]');
      await expect(next).toHaveAttribute("href", pathFor(kind, locale, "active", 2) + withDate);
      await next.click();
      await expect(page).toHaveURL(pathFor(kind, locale, "active", 2) + withDate);
      await expect(cardsFor(page, kind)).toHaveCount(4);
      await expect(page.getByText(totalLabel, { exact: true })).toBeVisible();
      await expect(page.getByText(locale === "en" ? "Page 2" : "עמוד 2", { exact: true })).toBeVisible();
      const secondIds = await cardsFor(page, kind).evaluateAll((cards, attribute) => cards.map((card) => card.getAttribute(attribute)), definitions[kind].attribute);
      expect(secondIds.some((id) => firstIds.includes(id))).toBe(false);
      await expect(page.locator('main a[rel="prev"]')).toHaveAttribute("href", pathFor(kind, locale) + withDate);
      await expect(page.locator('main a[rel="next"]')).toHaveCount(0);
      assertGeometry(await geometry(page, kind, "native-page-2"), locale);
      if (locale === "en") await screenshot(page, `${kind}-page2-en-390`);
      const edit = cardsFor(page, kind).first().locator('a[href$="/edit"]');
      await expect(edit).toHaveAttribute("href", new RegExp(`^/${locale}/${definitions[kind].path}/[0-9a-f-]+/edit$`));
      const use = cardsFor(page, kind).first().locator('a[href*="/use"]');
      if (kind !== "food") {
        await expect(use).toHaveAttribute("href", new RegExp(`/use\\?date=${date}$`));
        const useHref = await use.getAttribute("href");
        await use.click();
        await expect(page).toHaveURL(kind === "recipe" ? `${useHref}&servings=1` : useHref!);
        await page.goto(pathFor(kind, locale, "active", 2) + withDate);
      }
      const editHref = await edit.getAttribute("href");
      await edit.click();
      await expect(page).toHaveURL(editHref!);
      await page.goto(pathFor(kind, locale, "active", 999) + withDate);
      await expect(cardsFor(page, kind)).toHaveCount(0);
      // Existing PostgREST range-error contract recovers through the native page-1 retry.
      const outOfRange = page.getByTestId(`${definitions[kind].prefix}-management-retrieval-error`);
      await expect(outOfRange).toBeVisible();
      await expect(page.getByTestId(`${definitions[kind].prefix}-management-empty-active`)).toHaveCount(0);
      const recover = outOfRange.getByRole("link");
      await expect(recover).toHaveAttribute("href", pathFor(kind, locale) + withDate);
      assertGeometry(await geometry(page, kind, "out-of-range-recovery"), locale);
      await recover.click();
      await expect(cardsFor(page, kind)).toHaveCount(20);
      await page.locator(`main a[href="${pathFor(kind, locale, "archived") + withDate}"]`).click();
      await expect(cardsFor(page, kind)).toHaveCount(3);
      await expect(page.locator('main a[aria-current="page"]')).toHaveAttribute("href", pathFor(kind, locale, "archived") + withDate);
      await expect(cardsFor(page, kind).locator('a[href*="/use"]')).toHaveCount(0);
      await page.goto(pathFor(kind, locale));
      if (kind !== "food") await expect(cardsFor(page, kind).first().locator('a[href*="/use"]')).toHaveAttribute("href", new RegExp(`/use$`));
      contracts.push({ scenario: "native-navigation", kind, locale, javaScript: false, pageSize: 20, totalCount: 24, page2Count: 4,
        retainedFilter: true, prevNextRel: true, historicalDate: kind !== "food", absentDateOmitted: true,
        outOfRange: "existing range retrieval-error with native active/page-1 retry; distinct from truly empty Library", archiveConfirmation: "Existing client-only opening requires JavaScript; native Restore is exercised separately." });
    }
    expect(ownedSnapshot()).toBe(before);
    for (const kind of kinds) {
      const id = fixtures[kind].archived[0];
      await page.goto(pathFor(kind, "en", "archived"));
      await cardFor(page, kind, id).getByRole("button", { name: "Restore", exact: true }).click();
      await expect(page.getByTestId(`${definitions[kind].prefix}-management-success`)).toBeVisible();
      expect(queryLocalAuthFixture(`select is_archived from public.${definitions[kind].table} where id = '${id}' and ${definitions[kind].owner} = '${userId}';`)).toBe("f");
      await expect(cardFor(page, kind, id)).toBeVisible();
      const beforeClientOnlyClick = ownedSnapshot();
      await cardFor(page, kind, id).getByRole("button", { name: "Archive", exact: true }).click();
      await expect(page.getByTestId(`${definitions[kind].prefix}-archive-confirmation`)).toHaveCount(0);
      expect(ownedSnapshot()).toBe(beforeClientOnlyClick);
      await archiveFixture(kind, id, true);
      contracts.push({ scenario: "no-js-archive-contract", kind, nativeRestorePost: true, activeStateVerified: true,
        archiveOpening: "Inert without JavaScript, matching existing client-only contract", clientOnlyClickNoMutation: true, fixtureRearchivedByAuthenticatedRpc: true });
    }
    await context.close();
  });
});
