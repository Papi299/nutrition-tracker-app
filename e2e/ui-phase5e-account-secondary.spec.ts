import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Browser, type BrowserContext, type Locator, type Page } from "@playwright/test";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { execFileSync } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { provisionActivatedLocalUserForUi, queryLocalAuthFixture } from "@/e2e/helpers/local-auth";
import { accountExportSchema } from "@/lib/account-export/schema";
import type { Database } from "@/lib/supabase/database.types";
import en from "@/messages/en.json";
import he from "@/messages/he.json";

const approvedHead = "1ffd19dc90f8dc442160d3b2bbaea0c0a4ce07b7";
const approvedTree = "65dfa021dc38ce2feb0d0a1dc73d63ac39d02739";
const sourceFiles = [
  "app/[locale]/(app)/account/page.tsx",
  "app/[locale]/(app)/account/export/page.tsx",
  "app/[locale]/(app)/account/closure/page.tsx",
  "app/[locale]/(app)/sign-out-failed/page.tsx",
  "components/reliability/recovery-panel.tsx",
  "components/reliability/localized-error-boundary.tsx",
  "app/global-error.tsx",
];
const protectedFiles = [
  "app/[locale]/(app)/account/export/download/route.ts",
  "app/[locale]/(app)/account/closure/submit/route.ts",
  "lib/auth/recent-password-auth.ts",
  "lib/auth/recent-password-auth-proof.ts",
  "lib/auth/reauthentication-intent.ts",
  "components/auth/sign-out-button.tsx",
  "app/[locale]/auth/actions.ts",
];
const git = (...args: string[]) => execFileSync("git", args, { encoding: "utf8" }).trim();
const digest = (value: string | Buffer) => createHash("sha256").update(value).digest("hex");
const baseline = sourceFiles.every(file => digest(readFileSync(file)) === digest(execFileSync("git", ["show", `${approvedHead}:${file}`])));
const mode = baseline ? "baseline" : "after";
const localUrl = process.env.LOCAL_SUPABASE_URL;
const localKey = process.env.LOCAL_SUPABASE_PUBLISHABLE_KEY;
const recoveryControl = process.env.LOCAL_RELIABILITY_FAULT_CONTROL_URL;
const email = `ui5e-account-${randomUUID()}@example.test`;
const password = "Ui5eSyntheticAccountPassword123!";
const widths = [320, 390, 768, 1440] as const;
const locales = ["en", "he"] as const;
const messages = { en, he };
type Locale = typeof locales[number];

test.skip(process.env.DATE_E2E_LOCAL_SUPABASE !== "1" || !localUrl || !localKey, "Phase 5E Account tests require isolated synthetic local Supabase.");

test.describe.serial("UI Phase 5E Account and secondary presentation", () => {
  let client: SupabaseClient<Database>;
  let userId: string;
  let gatedState: Awaited<ReturnType<BrowserContext["storageState"]>>;
  let readyState: Awaited<ReturnType<BrowserContext["storageState"]>>;
  let evidenceDirectory: string;
  let browserVersion: string;
  let sourceIdentity: unknown;
  const measurements: unknown[] = [];
  const screenshots: unknown[] = [];
  const accessibility: unknown[] = [];
  const contracts: unknown[] = [];

  function databaseSnapshot() {
    return queryLocalAuthFixture(`select jsonb_build_object(
      'activation',(select coalesce(jsonb_agg(to_jsonb(x) order by x.user_id),'[]') from public.account_activations x where x.user_id='${userId}'),
      'profile',(select coalesce(jsonb_agg(to_jsonb(x) order by x.id),'[]') from public.profiles x where x.id='${userId}'),
      'targets',(select coalesce(jsonb_agg(to_jsonb(x) order by x.id),'[]') from public.nutrition_targets x where x.user_id='${userId}'),
      'diary',(select coalesce(jsonb_agg(to_jsonb(x) order by x.id),'[]') from public.diary_entries x where x.user_id='${userId}'),
      'foods',(select coalesce(jsonb_agg(to_jsonb(x) order by x.id),'[]') from public.foods x where x.owner_user_id='${userId}'),
      'savedMeals',(select coalesce(jsonb_agg(to_jsonb(x) order by x.id),'[]') from public.saved_meals x where x.user_id='${userId}'),
      'recipes',(select coalesce(jsonb_agg(to_jsonb(x) order by x.id),'[]') from public.recipes x where x.user_id='${userId}'),
      'closures',(select coalesce(jsonb_agg(to_jsonb(x) order by x.user_id),'[]') from public.account_closures x where x.user_id='${userId}'));`);
  }

  async function signIn(page: Page, locale: Locale) {
    const copy = messages[locale].Auth;
    await page.goto(`/${locale}/auth/sign-in`);
    await page.getByLabel(copy.signIn.emailLabel).fill(email);
    await page.getByLabel(copy.signIn.passwordLabel).fill(password);
    await page.getByRole("button", { name: copy.signIn.submit, exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`/${locale}/today(?:\\?date=\\d{4}-\\d{2}-\\d{2})?$`));
  }

  async function confirmPassword(page: Page, locale: Locale, intent: "account-export" | "account-closure") {
    await page.getByRole("link", { name: messages[locale].Account.export.confirmPassword, exact: true }).click();
    await expect(page).toHaveURL(`/${locale}/auth/reauthenticate?intent=${intent}`);
    await page.getByLabel(locale === "en" ? "Current password" : "הסיסמה הנוכחית").fill(password);
    await page.getByRole("button", { name: locale === "en" ? "Confirm password" : "אימות הסיסמה", exact: true }).click();
    await expect(page).toHaveURL(`/${locale}/account/${intent === "account-export" ? "export" : "closure"}`);
  }

  const contextFor = (browser: Browser, ready: boolean, options: Parameters<Browser["newContext"]>[0] = {}) => browser.newContext({ storageState: ready ? readyState : gatedState, viewport: { width: 390, height: 1000 }, ...options });

  async function measure(page: Page, state: string) {
    const result = await page.evaluate(() => {
      const rect = (element: Element | Range) => { const r = element.getBoundingClientRect(); return { x: r.x, y: r.y, right: r.right, bottom: r.bottom, width: r.width, height: r.height }; };
      const root = document.querySelector("main")!;
      return {
        locale: document.documentElement.lang,
        direction: document.documentElement.dir,
        viewport: { width: innerWidth, height: innerHeight },
        document: { clientWidth: document.documentElement.clientWidth, scrollWidth: document.documentElement.scrollWidth },
        body: { clientWidth: document.body.clientWidth, scrollWidth: document.body.scrollWidth },
        cards: Array.from(root.querySelectorAll("section, .ui-card")).map(element => ({ ...rect(element), className: element.className, clientWidth: element.clientWidth, scrollWidth: element.scrollWidth })),
        controls: Array.from(root.querySelectorAll<HTMLAnchorElement | HTMLButtonElement | HTMLInputElement>("a,button,input:not([type=hidden])")).map(element => {
          const target = element instanceof HTMLInputElement && element.type === "checkbox" ? element.closest("label") ?? element : element;
          const style = getComputedStyle(element);
          return { ...rect(element), target: rect(target), text: target.textContent?.trim(), name: element.getAttribute("name"), type: element.getAttribute("type"), tag: element.tagName, className: element.className, disabled: "disabled" in element && element.disabled, color: style.color, background: style.backgroundColor, outline: style.outline, transitionDuration: style.transitionDuration };
        }),
        text: Array.from(root.querySelectorAll("h1,h2,p,li,label")).map(element => {
          const range = document.createRange(); range.selectNodeContents(element);
          return { ...rect(element), content: rect(range), text: element.textContent?.trim(), overflow: getComputedStyle(element).overflow, textOverflow: getComputedStyle(element).textOverflow, whiteSpace: getComputedStyle(element).whiteSpace };
        }),
        alerts: Array.from(root.querySelectorAll('[role="alert"],[role="status"]')).map(element => ({ role: element.getAttribute("role"), text: element.textContent?.trim() })),
        headings: Array.from(root.querySelectorAll("h1,h2,h3")).map(element => ({ tag: element.tagName, text: element.textContent?.trim() })),
      };
    });
    measurements.push({ mode, state, route: new URL(page.url()).pathname, ...result });
    if (!baseline) {
      expect(result.document.scrollWidth).toBeLessThanOrEqual(result.document.clientWidth);
      expect(result.body.scrollWidth).toBeLessThanOrEqual(result.document.clientWidth);
      for (const item of [...result.cards, ...result.controls, ...result.text]) { expect(item.x).toBeGreaterThanOrEqual(-0.5); expect(item.right).toBeLessThanOrEqual(result.document.clientWidth + 0.5); }
      for (const card of result.cards) expect(card.scrollWidth).toBeLessThanOrEqual(card.clientWidth + 1);
      for (const item of result.text) { expect(item.overflow).not.toBe("hidden"); expect(item.textOverflow).not.toBe("ellipsis"); expect(item.content.x).toBeGreaterThanOrEqual(-0.5); expect(item.content.right).toBeLessThanOrEqual(result.document.clientWidth + 0.5); }
      for (const control of result.controls.filter(control => !control.disabled)) { expect(control.target.width).toBeGreaterThanOrEqual(44); expect(control.target.height).toBeGreaterThanOrEqual(44); }
    }
    expect(result.direction).toBe(result.locale === "he" ? "rtl" : "ltr");
    expect(result.headings.filter(heading => heading.tag === "H1")).toHaveLength(1);
    return result;
  }

  async function reachable(control: Locator) {
    await control.evaluate(element => element.scrollIntoView({ block: "center", inline: "nearest", behavior: "instant" }));
    const result = await control.evaluate(element => {
      const r = element.getBoundingClientRect(), x = r.x + r.width / 2, y = r.y + r.height / 2, hit = document.elementFromPoint(x, y);
      const nav = document.querySelector(".mobile-bottom-navigation"), navTop = nav && getComputedStyle(nav).display !== "none" ? nav.getBoundingClientRect().top : innerHeight;
      return { x, y, width: r.width, height: r.height, hit: !!hit && (hit === element || element.contains(hit)), navTop, bottom: r.bottom };
    });
    if (!baseline) { expect(result.hit).toBe(true); expect(result.bottom).toBeLessThanOrEqual(result.navTop); }
    return result;
  }

  async function capture(page: Page, label: string) {
    const filename = `account-secondary-${mode}-${label}.png`;
    const image = await page.screenshot({ path: join(evidenceDirectory, filename), animations: "disabled", fullPage: true });
    screenshots.push({ filename, sha256: digest(image), viewport: page.viewportSize(), locale: await page.locator("html").getAttribute("lang"), route: new URL(page.url()).pathname });
  }

  async function axe(page: Page, state: string) {
    const result = await new AxeBuilder({ page }).include("main").withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
    accessibility.push({ state, locale: await page.locator("html").getAttribute("lang"), violations: result.violations.map(({ id, impact, nodes }) => ({ id, impact, nodes: nodes.map(({ target, failureSummary }) => ({ target, failureSummary })) })) });
    if (!baseline) expect(result.violations).toEqual([]);
  }

  async function accountContract(page: Page, locale: Locale, ready: boolean, kind: "export" | "closure") {
    const copy = messages[locale].Account[kind];
    await expect(page.getByRole("heading", { level: 1, name: copy.title, exact: true })).toBeVisible();
    await expect(page.getByText(copy.description, { exact: true })).toBeVisible();
    await expect(page.getByRole("link", { name: copy.back, exact: true })).toHaveAttribute("href", `/${locale}/account`);
    if (kind === "export") await expect(page.getByText(messages[locale].Account.export.security, { exact: true })).toBeVisible();
    else {
      for (const consequence of Object.values(messages[locale].Account.closure.consequences)) await expect(page.getByText(consequence, { exact: true })).toBeVisible();
      await expect(page.getByText(messages[locale].Account.closure.exportOffer, { exact: false })).toBeVisible();
      await expect(page.getByRole("link", { name: messages[locale].Account.closure.exportLink, exact: true })).toHaveAttribute("href", `/${locale}/account/export`);
      await expect(page.locator('main input[name*="capability" i],main input[name*="user" i],main input[name*="session" i]')).toHaveCount(0);
    }
    const form = page.locator(`main form[action="/${locale}/account/${kind}/${kind === "export" ? "download" : "submit"}"]`);
    if (!ready) {
      await expect(form).toHaveCount(0);
      await expect(page.getByRole("status")).toContainText(copy.reauthRequired);
      await expect(page.getByRole("link", { name: copy.confirmPassword, exact: true })).toHaveAttribute("href", `/${locale}/auth/reauthenticate?intent=account-${kind}`);
      return;
    }
    await expect(form).toHaveAttribute("method", "post");
    await expect(form.locator('button[type="submit"]')).toHaveCount(1);
    await expect(form.locator('button[type="submit"]')).toBeEnabled();
    if (kind === "closure") {
      const checkbox = form.locator('input[type="checkbox"][name="confirmClosure"]');
      await expect(checkbox).toHaveCount(1);
      await expect(checkbox).toHaveAttribute("value", "confirm-account-closure-v1");
      await expect(checkbox).not.toBeChecked();
      expect(await checkbox.evaluate(element => (element as HTMLInputElement).required)).toBe(false);
      await expect(page.getByRole("checkbox", { name: messages[locale].Account.closure.confirmation, exact: true })).toHaveCount(1);
      await expect(form.locator("input")).toHaveCount(1);
      if (!baseline) await expect(form.locator('button[type="submit"]')).toHaveClass(/ui-button-destructive/);
    }
    contracts.push({ state: `${kind}-ready`, locale, action: await form.getAttribute("action"), method: await form.getAttribute("method"), explicitSubmit: true, closureSubmitted: false });
  }

  test.beforeAll(async ({ browser }) => {
    test.setTimeout(120_000);
    if (!localUrl || !["localhost", "127.0.0.1"].includes(new URL(localUrl).hostname)) throw new Error("Refusing nonlocal Account fixtures.");
    evidenceDirectory = join(process.cwd(), "docs/ui-phase5e/evidence");
    mkdirSync(evidenceDirectory, { recursive: true });
    const protectedHashes = Object.fromEntries(protectedFiles.map(file => {
      const actual = digest(readFileSync(file));
      expect(actual).toBe(digest(execFileSync("git", ["show", `${approvedHead}:${file}`])));
      return [file, actual];
    }));
    sourceIdentity = { head: git("rev-parse", "HEAD"), tree: git("rev-parse", "HEAD^{tree}"), buildId: readFileSync(".next/BUILD_ID", "utf8").trim(), productionDiffSha256: digest(git("diff", "HEAD", "--", ...sourceFiles)), sourceFileSha256: Object.fromEntries(sourceFiles.map(file => [file, digest(readFileSync(file))])), protectedFileSha256: protectedHashes };
    if (baseline) { expect(git("rev-parse", "HEAD")).toBe(approvedHead); expect(git("rev-parse", "HEAD^{tree}")).toBe(approvedTree); }
    browserVersion = browser.version();
    await provisionActivatedLocalUserForUi({ email, password });
    client = createClient<Database>(localUrl, localKey as string, { auth: { autoRefreshToken: false, persistSession: false } });
    const auth = await client.auth.signInWithPassword({ email, password }); expect(auth.error).toBeNull(); userId = auth.data.user!.id;
    expect((await client.from("diary_entries").insert({ user_id: userId, entry_date: "2024-02-29", food_name: "UI5E synthetic account non-mutation אבג / 123", meal_type: "snack", source: "manual", calories: 0, protein_g: null, carbohydrates_g: 0, fat_g: null })).error).toBeNull();
    const context = await browser.newContext(); const page = await context.newPage();
    await signIn(page, "en"); gatedState = await context.storageState();
    await page.goto("/en/account/export"); await confirmPassword(page, "en", "account-export");
    readyState = await context.storageState(); await context.close();
  });

  test.afterAll(async () => {
    if (evidenceDirectory) writeFileSync(join(evidenceDirectory, `account-secondary-${mode}-manifest.json`), JSON.stringify({ task: "UI_PHASE_5E_PROFILE_CUSTOM_FOOD_SECONDARY_UX_001", mode, sourceIdentity, browser: { name: "Chromium", version: browserVersion }, fixture: { synthetic: true, email, userId, seed: "one diary row with explicit-zero/null on 2024-02-29" }, measurements, screenshots, accessibility, contracts, limitations: ["Automated Chromium evidence; no manual screen-reader, physical-device, or OS IME qualification.", "Closure form is never submitted by this presentation suite.", "Root catastrophic fallback remains unchanged; supported local recoverable-error fixture only."] }, null, 2) + "\n");
    if (userId) queryLocalAuthFixture(`delete from auth.users where id='${userId}' and email='${email}';`);
  });

  test("R7 R8 R9 R10 Account and sign-out EN HE responsive states and native security contracts", async ({ browser }) => {
    test.setTimeout(240_000);
    const before = databaseSnapshot();
    for (const locale of locales) {
      const gated = await contextFor(browser, false), ready = await contextFor(browser, true);
      const gatedPage = await gated.newPage(), readyPage = await ready.newPage();
      let closurePosts = 0;
      for (const page of [gatedPage, readyPage]) page.on("request", request => { if (request.method() === "POST" && new URL(request.url()).pathname.endsWith("/account/closure/submit")) closurePosts += 1; });
      for (const width of widths) {
        for (const page of [gatedPage, readyPage]) await page.setViewportSize({ width, height: 1000 });
        await gatedPage.goto(`/${locale}/account`);
        await expect(gatedPage.getByRole("heading", { level: 1, name: messages[locale].Account.title, exact: true })).toBeVisible();
        expect(await gatedPage.locator("main h2").allTextContents()).toEqual([messages[locale].Account.export.title, messages[locale].Account.closure.title]);
        await measure(gatedPage, "account-overview");
        if (width === (locale === "en" ? 1440 : 390)) { await capture(gatedPage, `overview-${locale}-${width}`); await axe(gatedPage, "account-overview"); }
        for (const [kind, page, isReady] of [["export", gatedPage, false], ["export", readyPage, true], ["closure", gatedPage, false], ["closure", readyPage, true]] as const) {
          await page.goto(`/${locale}/account/${kind}`); await accountContract(page, locale, isReady, kind);
          const state = `${kind}-${isReady ? "ready" : "gated"}`;
          await measure(page, state);
          const capturesAt = kind === "closure" && isReady && locale === "he" ? 320 : kind === "export" && isReady && locale === "en" ? 1440 : 390;
          if (width === capturesAt) { await capture(page, `${state}-${locale}-${width}`); await axe(page, state); }
          for (const control of await page.locator("main a,main button").all()) measurements.push({ state: `${state}-reachability`, locale, viewportWidth: width, control: await control.textContent(), ...await reachable(control) });
        }
        await gatedPage.goto(`/${locale}/sign-out-failed`);
        await expect(gatedPage.getByRole("heading", { level: 1, name: messages[locale].AppShell.signOutFailure.title })).toBeVisible();
        await expect(gatedPage.locator("main").getByRole("alert")).toContainText(messages[locale].AppShell.signOutFailure.body);
        await expect(gatedPage.getByRole("button", { name: messages[locale].AppShell.signOutFailure.retry, exact: true })).toHaveAttribute("type", "submit");
        await measure(gatedPage, "sign-out-failure");
        if (width === 390) { await capture(gatedPage, `signout-${locale}-${width}`); await axe(gatedPage, "sign-out-failure"); }
      }
      expect(closurePosts).toBe(0); await gated.close(); await ready.close();
    }
    expect(databaseSnapshot()).toBe(before);
    contracts.push({ state: "responsive-nonmutation", beforeSha256: digest(before), afterSha256: digest(databaseSnapshot()), closurePosts: 0, snapshotUnchanged: true });
  });

  test("R9 R10 localized recovery uses explicit retry without replay at all required widths", async ({ browser }) => {
    test.skip(!recoveryControl, "The approved local runner must provide its supported recoverable-error fixture.");
    test.setTimeout(180_000);
    const controlUrl = new URL(recoveryControl as string);
    expect(["127.0.0.1", "localhost"]).toContain(controlUrl.hostname);
    const before = databaseSnapshot();
    for (const locale of locales) {
      const context = await contextFor(browser, false), page = await context.newPage();
      for (const width of widths) {
        await page.setViewportSize({ width, height: 1000 });
        expect((await fetch(controlUrl, { method: "POST" })).status).toBe(204);
        await page.goto(`/${locale}/local-reliability-fixture`);
        const recovery = page.getByTestId("reliability-recovery");
        await expect(recovery).toHaveAttribute("role", "alert");
        await expect(recovery.locator("code")).toHaveText(/^obs_[0-9a-f]{32}$/);
        await expect(recovery).toContainText(messages[locale].Reliability.boundary.body);
        await expect(recovery.getByRole("link")).toHaveAttribute("href", `/${locale}`);
        await measure(page, "localized-recovery");
        if (width === 390) { await capture(page, `recovery-${locale}-${width}`); await axe(page, "localized-recovery"); }
        await recovery.getByRole("button", { name: messages[locale].Reliability.boundary.retry, exact: true }).click();
        await expect(page).toHaveURL(new RegExp(`/${locale}/today(?:\\?date=\\d{4}-\\d{2}-\\d{2})?$`));
        expect(databaseSnapshot()).toBe(before);
      }
      await context.close();
    }
    contracts.push({ state: "safe-localized-recovery", locales, widths, explicitRetryOnly: true, snapshotUnchanged: true, referenceVisible: true });
  });

  test("R7 R8 R10 R11 keyboard, focus modes and native no-JavaScript Account navigation", async ({ browser }) => {
    test.setTimeout(180_000);
    const before = databaseSnapshot();
    const context = await contextFor(browser, true, { reducedMotion: "reduce" }), page = await context.newPage();
    await page.goto("/he/account/closure");
    const checkbox = page.getByRole("checkbox", { name: he.Account.closure.confirmation, exact: true });
    await checkbox.focus(); await page.keyboard.press("Space"); await expect(checkbox).toBeChecked(); await page.keyboard.press("Space"); await expect(checkbox).not.toBeChecked();
    for (const forcedColors of ["none", "active"] as const) {
      await page.emulateMedia({ forcedColors });
      const control = page.getByRole("link", { name: he.Account.closure.cancel, exact: true }); await control.focus();
      const focus = await control.evaluate(element => ({ focused: document.activeElement === element, outlineStyle: getComputedStyle(element).outlineStyle, outlineWidth: getComputedStyle(element).outlineWidth, transitionDuration: getComputedStyle(element).transitionDuration }));
      expect(focus.focused).toBe(true); expect(focus.outlineStyle).not.toBe("none"); expect(parseFloat(focus.outlineWidth)).toBeGreaterThanOrEqual(2);
      measurements.push({ state: "keyboard-focus", forcedColors, reducedMotion: true, ...focus });
    }
    await context.close();
    for (const locale of locales) {
      const nativeContext = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 390, height: 1000 } }), native = await nativeContext.newPage();
      await signIn(native, locale);
      await native.goto(`/${locale}/account`);
      await native.getByRole("link", { name: messages[locale].Account.closure.open, exact: true }).click();
      await accountContract(native, locale, false, "closure");
      await confirmPassword(native, locale, "account-closure"); await accountContract(native, locale, true, "closure");
      await native.getByRole("link", { name: messages[locale].Account.closure.cancel, exact: true }).click();
      await expect(native).toHaveURL(`/${locale}/account`);
      await native.getByRole("link", { name: messages[locale].Account.export.open, exact: true }).click(); await accountContract(native, locale, true, "export");
      const downloadEvent = native.waitForEvent("download"); await native.getByRole("button", { name: messages[locale].Account.export.download, exact: true }).click();
      const download = await downloadEvent; expect(download.suggestedFilename()).toMatch(/^nutrition-tracker-account-export-v1-\d{4}-\d{2}-\d{2}\.json$/);
      const path = await download.path(); expect(path).not.toBeNull(); const payload = JSON.parse(readFileSync(path as string, "utf8"));
      expect(payload.schema).toBe(accountExportSchema); expect(payload.account.id).toBe(userId);
      expect(databaseSnapshot()).toBe(before);
      contracts.push({ state: "native-nojs-account", locale, reauthenticationThroughOriginalFlow: true, closureCancellation: true, closureSubmitted: false, explicitNativeExport: true, exportedOwner: userId, snapshotUnchanged: true });
      await nativeContext.close();
    }
  });
});
