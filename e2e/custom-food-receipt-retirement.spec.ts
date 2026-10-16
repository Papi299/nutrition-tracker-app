import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { expect, test, type Browser, type BrowserContext, type Page, type Request, type TestInfo } from "@playwright/test";
import { createHash, randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { isAbsolute, join, relative } from "node:path";
import { provisionActivatedLocalUser, queryLocalAuthFixture } from "@/e2e/helpers/local-auth";
import type { Database } from "@/lib/supabase/database.types";

const localUrl = process.env.LOCAL_SUPABASE_URL;
const localKey = process.env.LOCAL_SUPABASE_PUBLISHABLE_KEY;
const locales = ["en", "he"] as const;
type Locale = (typeof locales)[number];
type Account = { client: SupabaseClient<Database>; id: string; state: Awaited<ReturnType<BrowserContext["storageState"]>> };
type Evidence = { records: unknown[]; requests: unknown[]; errors: string[] };
const evidenceByTest = new Map<string, Evidence>();
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const prefix = "nutrition-tracker:custom-food-creation-draft:v1:";
const hash = (value: string | Buffer) => createHash("sha256").update(value).digest("hex");
const route = (value: string) => { const url = new URL(value); return url.pathname + url.search; };
const sourceFiles = ["components/custom-foods/custom-food-form.tsx", "components/language-switcher/language-switcher.tsx", "lib/i18n/locale-query.ts", "package-lock.json"];

test.skip(process.env.DATE_E2E_LOCAL_SUPABASE !== "1" || !localUrl || !localKey, "Receipt lifecycle requires the isolated local-only fixture.");
test.use({ trace: "off", video: "off", actionTimeout: 15_000, navigationTimeout: 30_000 });

function newEvidence(info: TestInfo): Evidence {
  const evidence: Evidence = { records: [], requests: [], errors: [] };
  evidenceByTest.set(info.testId, evidence);
  return evidence;
}

test.afterEach(async ({ browser }, info) => {
  const evidence = evidenceByTest.get(info.testId);
  if (evidence) persistEvidence(info, browser, evidence);
  evidenceByTest.delete(info.testId);
});

function persistEvidence(info: TestInfo, browser: Browser, evidence: Evidence) {
  const destination = process.env.UI5_RECEIPT_EVIDENCE_DIR;
  if (!destination) return;
  if (!isAbsolute(destination) || !relative(process.cwd(), destination).startsWith("..")) throw new Error("Receipt evidence must be outside the checkout.");
  const directory = join(destination, info.project.name, info.title.replace(/[^A-Za-z0-9_-]+/g, "-"));
  mkdirSync(directory, { recursive: true });
  const git = (...args: string[]) => execFileSync("git", args, { encoding: "utf8" }).trim();
  writeFileSync(join(directory, "record.json"), JSON.stringify({
    taskId: "UI_PHASE_5_RECEIPT_RETIREMENT_ROUTER_SYNC_001", timestampUtc: new Date().toISOString(),
    source: { head: git("rev-parse", "HEAD"), tree: git("rev-parse", "HEAD^{tree}"), productionDiffSha256: hash(git("diff", "HEAD", "--", ...sourceFiles)), fileSha256: Object.fromEntries(sourceFiles.filter(existsSync).map(file => [file, hash(readFileSync(file))])), buildId: existsSync(".next/BUILD_ID") ? readFileSync(".next/BUILD_ID", "utf8").trim() : null },
    browser: { project: info.project.name, engine: browser.browserType().name(), version: browser.version() },
    result: info.status, expectedStatus: info.expectedStatus, assertionErrors: info.errors.map(error => error.message?.replace(/\u001b\[[0-9;]*m/g, "")), ...evidence,
    limits: ["Synthetic local accounts only. No credentials, Auth storage, storage values or complete request headers are serialized.", "The rendered language links are the application-visible useSearchParams consumer; no production diagnostic hooks are added.", "Controlled native History API query changes supplement the genuine creation redirect; they are not the primary reproduction."],
  }, null, 2) + "\n");
}

async function hrefs(page: Page) {
  return page.locator("a[hreflang]").evaluateAll(elements => {
    const links = elements.map(element => ({ locale: element.getAttribute("hreflang"), href: element.getAttribute("href") }));
    // Desktop and mobile navigation share the same contract. Keep every distinct
    // pair so disagreement between either rendered navigation still fails.
    return links.filter((link, index) => links.findIndex(candidate => candidate.locale === link.locale && candidate.href === link.href) === index);
  });
}

async function state(page: Page) {
  return { url: route(page.url()), hrefs: await hrefs(page), ...(await page.evaluate(() => ({
    rawHrefs: Array.from(document.querySelectorAll("a[hreflang]")).map(element => ({ locale: element.getAttribute("hreflang"), href: element.getAttribute("href") })),
    historyLength: history.length, historyMarkers: { appRouter: Boolean(history.state?.__NA), pagesRouter: Boolean(history.state?._N), routerTree: Boolean(history.state?.__PRIVATE_NEXTJS_INTERNALS_TREE) },
    direction: document.documentElement.dir,
  }))) };
}

async function switchLanguage(page: Page, locale: Locale) {
  const link = page.locator(`a[hreflang="${locale}"]:visible`).first();
  await expect(link).toBeVisible();
  const href = await link.getAttribute("href");
  await link.click();
  await expect(page.locator("html")).toHaveAttribute("lang", locale);
  await expect(page).toHaveURL(url => url.pathname.startsWith(`/${locale}/`));
  return { href, destination: route(page.url()) };
}

function observe(page: Page, evidence: Evidence, phase: () => string) {
  page.on("pageerror", error => evidence.errors.push(error.message));
  page.on("console", message => { if (message.type() === "error") evidence.errors.push(message.text()); });
  page.on("request", (request: Request) => {
    const url = new URL(request.url());
    if (url.origin !== new URL(page.url()).origin || url.pathname.startsWith("/_next/static/")) return;
    const headers = request.headers();
    const prefetch = headers["next-router-prefetch"] === "1" || headers.purpose === "prefetch";
    evidence.requests.push({ phase: phase(), url: url.pathname + url.search, method: request.method(), kind: prefetch ? "prefetch" : request.isNavigationRequest() ? "document-navigation" : headers.rsc === "1" ? "App-Router-RSC" : headers["next-action"] ? "Server-Action" : request.resourceType(), prefetch, action: Boolean(headers["next-action"]) });
  });
}

test.describe("Custom Food receipt retirement and App Router coherence", () => {
  let account: Account;

  function snapshot() {
    // Include the full owner food aggregate, receipt and independent diary/target tables.
    return hash(queryLocalAuthFixture(`select jsonb_build_object(
      'foods',(select coalesce(jsonb_agg(to_jsonb(x) order by x.id),'[]') from public.foods x where owner_user_id='${account.id}'),
      'nutrients',(select coalesce(jsonb_agg(to_jsonb(x) order by x.food_id,x.nutrient_id),'[]') from public.food_nutrients x join public.foods f on f.id=x.food_id where f.owner_user_id='${account.id}'),
      'aliases',(select coalesce(jsonb_agg(to_jsonb(x) order by x.id),'[]') from public.food_aliases x join public.foods f on f.id=x.food_id where f.owner_user_id='${account.id}'),
      'barcodes',(select coalesce(jsonb_agg(to_jsonb(x) order by x.id),'[]') from public.food_barcodes x join public.foods f on f.id=x.food_id where f.owner_user_id='${account.id}'),
      'receipts',(select coalesce(jsonb_agg(to_jsonb(x) order by x.id),'[]') from public.custom_food_creation_requests x where user_id='${account.id}'),
      'diary',(select coalesce(jsonb_agg(to_jsonb(x) order by x.id),'[]') from public.diary_entries x where user_id='${account.id}'),
      'targets',(select coalesce(jsonb_agg(to_jsonb(x) order by x.id),'[]') from public.nutrition_targets x where user_id='${account.id}')
    );`));
  }

  function counts() {
    return queryLocalAuthFixture(`select (select count(*) from public.foods where owner_user_id='${account.id}'),(select count(*) from public.custom_food_creation_requests where user_id='${account.id}');`).split("|").map(Number);
  }

  async function newContext(browser: Browser, javaScriptEnabled = true) {
    return browser.newContext({ storageState: account.state, javaScriptEnabled, viewport: { width: 1440, height: 1000 }, timezoneId: "Asia/Jerusalem" });
  }

  async function fillCreate(page: Page, name: string) {
    await expect(page.getByTestId("custom-food-creation-key")).toHaveValue(uuid);
    await expect(page.getByTestId("custom-food-form").locator('button[type="submit"]')).toBeEnabled();
    await page.locator('[name="name"]').fill(name);
    await page.locator('[name="serving_quantity"]').fill("1");
    await page.locator('[name="serving_unit"]').fill("portion");
    await page.locator('[name="nutrient_energy_kcal"]').fill("123.25");
    await page.locator('[name="nutrient_protein_g"]').fill("0");
  }

  async function receiptFood(key: string) {
    const result = await account.client.from("custom_food_creation_requests").select("completed_food_id").eq("idempotency_key", key).single();
    expect(result.error).toBeNull();
    expect(result.data?.completed_food_id).toMatch(uuid);
    return result.data!.completed_food_id;
  }

  test.beforeAll(async ({ browser }) => {
    test.setTimeout(90_000);
    if (!localUrl || !["127.0.0.1", "localhost"].includes(new URL(localUrl).hostname)) throw new Error("Refusing nonlocal receipt fixture.");
    const client = createClient<Database>(localUrl, localKey!, { auth: { autoRefreshToken: false, persistSession: false } });
    const email = `ui5-receipt-${randomUUID()}@example.test`;
    const password = `Synthetic-${randomUUID()}-A1!`;
    const signedIn = await provisionActivatedLocalUser(client, { email, password });
    expect(signedIn.error).toBeNull();
    const id = signedIn.data.user!.id; expect(id).toMatch(uuid);
    const context = await browser.newContext();
    try {
      const page = await context.newPage(); await page.goto("/en/auth/sign-in");
      await page.getByLabel("Email").fill(email); await page.getByLabel("Password", { exact: true }).fill(password);
      await page.getByRole("button", { name: "Sign in", exact: true }).click();
      await expect(page).toHaveURL(/\/en\/today\?date=/);
      account = { client, id, state: await context.storageState() };
    } finally { await context.close(); }
  });
  test.afterAll(async () => { if (account) await account.client.auth.signOut(); });

  for (const locale of locales) {
    test(`R1 R2 R5 R6 ${locale} genuine creation retires one receipt and synchronizes actual locale navigation`, async ({ browser }, info) => {
      test.setTimeout(120_000);
      const evidence = newEvidence(info);
      const context = await newContext(browser);
      let phase = "create-page";
      try {
        const page = await context.newPage(); observe(page, evidence, () => phase);
        await page.goto(`/${locale}/foods/custom/new`);
        await fillCreate(page, `Receipt lifecycle ${locale} ${randomUUID()}`);
        const key = await page.getByTestId("custom-food-creation-key").inputValue();
        const storageKey = await page.getByTestId("custom-food-form").getAttribute("data-draft-storage-key");
        expect(storageKey).toBeTruthy();
        await expect.poll(() => page.evaluate(storage => Boolean(sessionStorage.getItem(storage)), storageKey!)).toBe(true);
        const unrelatedKey = prefix + "receipt-regression-unrelated";
        const unrelatedDraft = await page.evaluate(({ original, unrelated, otherRequest }) => {
          const draft = JSON.parse(sessionStorage.getItem(original)!); draft.idempotencyKey = otherRequest;
          const value = JSON.stringify(draft); sessionStorage.setItem(unrelated, value); return value;
        }, { original: storageKey!, unrelated: unrelatedKey, otherRequest: randomUUID() });
        const beforeCounts = counts();
        const start = await state(page);
        const documentToken = randomUUID();
        await page.evaluate(token => {
          Object.assign(window, { __receiptDocumentToken: token, __receiptEditorForms: [] as Element[] });
          new MutationObserver(() => {
            const form = document.querySelector('[data-testid="custom-food-form"]');
            const value = form?.querySelector<HTMLInputElement>('[name="food_id"]')?.value;
            const observed = (window as unknown as { __receiptEditorForms: Element[] }).__receiptEditorForms;
            if (form && value && !observed.includes(form)) observed.push(form);
          }).observe(document.documentElement, { childList: true, subtree: true });
        }, documentToken);
        phase = "explicit-create";
        const responsePromise = page.waitForResponse(response => response.request().method() === "POST" && Boolean(response.request().headers()["next-action"]));
        await page.getByTestId("custom-food-form").locator('button[type="submit"]').click();
        const response = await responsePromise;
        const redirect = response.headers()["x-action-redirect"];
        expect(redirect).toMatch(new RegExp(`^/${locale}/foods/custom/[0-9a-f-]+/edit\\?saved=created&creationRequest=${key};push$`));
        const initialRedirect = new URL(redirect!.replace(/;push$/, ""), page.url());
        const foodId = await receiptFood(key);
        expect(initialRedirect.pathname).toBe(`/${locale}/foods/custom/${foodId}/edit`);
        await expect(page).toHaveURL(url => url.pathname === initialRedirect.pathname && url.searchParams.get("saved") === "created" && !url.searchParams.has("creationRequest"));
        await expect(page.getByTestId("custom-food-success")).toBeVisible();
        const afterCreateCounts = counts(); expect(afterCreateCounts).toEqual(beforeCounts.map(value => value + 1));
        const acceptedFingerprint = snapshot();
        phase = "post-retirement-settling";
        const settlingRequestOffset = evidence.requests.length;
        const expectedHrefs = locales.map(value => ({ locale: value, href: `/${value}/foods/custom/${foodId}/edit?saved=created` }));
        try { await expect.poll(() => hrefs(page), { timeout: 4_000 }).toEqual(expectedHrefs); } catch { /* Keep observing the actual failing navigation for baseline evidence. */ }
        const afterRetirement = await state(page);
        const settlingRequests = evidence.requests.slice(settlingRequestOffset) as { kind: string; prefetch: boolean }[];
        expect(settlingRequests.filter(request => !request.prefetch && ["App-Router-RSC", "document-navigation"].includes(request.kind))).toEqual([]);
        evidence.records.push({ kind: "genuine-success-retirement", locale, initialPathnameAndQuery: start.url, initialRedirect: initialRedirect.pathname + initialRedirect.search, initialReceiptPresent: initialRedirect.searchParams.get("creationRequest") === key, foodId, beforeCounts, afterCreateCounts, afterRetirement, acceptedFingerprint });
        expect.soft(afterRetirement.hrefs).toEqual(expectedHrefs);
        expect(afterRetirement.historyLength).toBe(start.historyLength + 1);
        const cleanup = await page.evaluate(({ matching, unrelated, value }) => ({ matchingRemoved: sessionStorage.getItem(matching) === null, unrelatedRetained: sessionStorage.getItem(unrelated) === value }), { matching: storageKey!, unrelated: unrelatedKey, value: unrelatedDraft });
        expect(cleanup).toEqual({ matchingRemoved: true, unrelatedRetained: true });
        expect(await page.evaluate(() => (window as unknown as { __receiptDocumentToken: string }).__receiptDocumentToken)).toBe(documentToken);
        const formReference = await page.getByTestId("custom-food-form").elementHandle();
        await page.locator('[name="name"]').fill("Unsaved editor text retained through retirement settling");
        await expect(page.locator('[name="name"]')).toHaveValue("Unsaved editor text retained through retirement settling");
        expect(await formReference!.evaluate(element => element.isConnected)).toBe(true);
        expect(await page.evaluate(() => (window as unknown as { __receiptEditorForms: Element[] }).__receiptEditorForms.length)).toBe(1);
        expect(snapshot()).toBe(acceptedFingerprint);
        evidence.records.push({ kind: "draft-and-editor-preservation", cleanup, editorMounts: 1, documentTokenPreserved: true, databaseSha256: acceptedFingerprint });
        const other: Locale = locale === "en" ? "he" : "en";
        const hrefsCoherent = JSON.stringify(afterRetirement.hrefs) === JSON.stringify(expectedHrefs);
        phase = hrefsCoherent ? "after-hrefs-coherent" : "after-hrefs-still-stale";
        evidence.records.push({ kind: "pre-locale-click-barrier", phase, hrefsCoherent, state: await state(page), settlingRequests });
        for (const destination of [other, locale]) {
          phase = `actual-locale-click-${destination}`;
          const requestOffset = evidence.requests.length;
          const navigation = await switchLanguage(page, destination);
          await expect(page).toHaveURL(url => url.pathname === `/${destination}/foods/custom/${foodId}/edit` && url.searchParams.get("saved") === "created" && !url.searchParams.has("creationRequest"));
          await expect(page.locator('[name="name"]')).not.toHaveValue("");
          await expect(page.getByTestId("custom-food-success")).toBeVisible();
          const newRequests = evidence.requests.slice(requestOffset) as { url: string; prefetch: boolean; kind: string }[];
          expect.soft(newRequests.filter(request => !request.prefetch && request.url.includes("creationRequest="))).toEqual([]);
          expect(newRequests.filter(request => request.kind === "document-navigation")).toEqual([]);
          expect(snapshot()).toBe(acceptedFingerprint);
          expect(await receiptFood(key)).toBe(foodId);
          evidence.records.push({ kind: "actual-locale-navigation", destinationLocale: destination, ...navigation, settled: await state(page), requests: newRequests, databaseSha256: acceptedFingerprint });
        }
        phase = "browser-back-forward";
        for (const [direction, destination] of [["back", other], ["forward", locale]] as const) {
          const requestOffset = evidence.requests.length;
          if (direction === "back") await page.goBack(); else await page.goForward();
          await expect(page.locator("html")).toHaveAttribute("lang", destination);
          await expect(page).toHaveURL(url => url.pathname === `/${destination}/foods/custom/${foodId}/edit` && url.search === "?saved=created");
          await expect.poll(() => hrefs(page)).toEqual(expectedHrefs);
          expect(await page.evaluate(() => (window as unknown as { __receiptDocumentToken: string }).__receiptDocumentToken)).toBe(documentToken);
          const newRequests = evidence.requests.slice(requestOffset) as { kind: string }[];
          expect(newRequests.filter(request => request.kind === "document-navigation")).toEqual([]);
          expect(snapshot()).toBe(acceptedFingerprint);
          evidence.records.push({ kind: "history-traversal", direction, destinationLocale: destination, state: await state(page), documentTokenPreserved: true, requests: newRequests, databaseSha256: acceptedFingerprint });
        }
        const stableForm = await page.getByTestId("custom-food-form").elementHandle();
        const unsaved = "Unsaved values survive a subsequent supported query update";
        await page.locator('[name="name"]').fill(unsaved);
        phase = "subsequent-supported-native-history-update";
        const requestOffset = evidence.requests.length;
        const historyLength = await page.evaluate(() => history.length);
        await page.evaluate(() => { const next = new URL(location.href); next.search = "?saved=updated"; history.replaceState(null, "", next.pathname + next.search); });
        await expect.poll(() => hrefs(page)).toEqual(locales.map(value => ({ locale: value, href: `/${value}/foods/custom/${foodId}/edit?saved=updated` })));
        await expect(page.locator('[name="name"]')).toHaveValue(unsaved);
        expect(await stableForm!.evaluate(element => element.isConnected)).toBe(true);
        expect(await page.evaluate(() => history.length)).toBe(historyLength);
        expect(evidence.requests.slice(requestOffset)).toEqual([]);
        expect(snapshot()).toBe(acceptedFingerprint);
        const actionRequests = (evidence.requests as { method: string; action: boolean }[]).filter(request => request.method === "POST" && request.action);
        expect(actionRequests).toHaveLength(1);
        expect(evidence.errors).toEqual([]);
        evidence.records.push({ kind: "final-invariants", foodId, receiptFoodId: await receiptFood(key), explicitActionCount: actionRequests.length, databaseBeforeSha256: acceptedFingerprint, databaseAfterSha256: snapshot(), subsequentQuery: await state(page), unsavedValuesRetained: true, editorNodeRetained: true, noExtraHistoryEntry: true });
      } finally { await context.close(); }
    });

    test(`R3 ${locale} native genuine creation retains the unretired receipt through locale roundtrip`, async ({ browser }, info) => {
      test.setTimeout(90_000);
      const evidence = newEvidence(info);
      const context = await newContext(browser, false);
      let phase = "native-create";
      try {
        const page = await context.newPage(); observe(page, evidence, () => phase);
        await page.goto(`/${locale}/foods/custom/new`); await fillCreate(page, `Native receipt ${randomUUID()}`);
        const key = await page.getByTestId("custom-food-creation-key").inputValue();
        const beforeCounts = counts();
        const responsePromise = page.waitForResponse(response => response.request().method() === "POST");
        await page.getByTestId("custom-food-form").locator('button[type="submit"]').click();
        const response = await responsePromise;
        const initialRedirect = response.headers().location;
        await expect(page).toHaveURL(url => url.pathname.includes("/edit") && url.searchParams.get("creationRequest") === key && url.searchParams.get("saved") === "created");
        const foodId = await receiptFood(key); const acceptedFingerprint = snapshot();
        expect(counts()).toEqual(beforeCounts.map(value => value + 1));
        expect(await hrefs(page)).toEqual(locales.map(value => ({ locale: value, href: `/${value}/foods/custom/${foodId}/edit?saved=created&creationRequest=${key}` })));
        evidence.records.push({ kind: "native-success", locale, initialRedirect, initialReceiptPresent: true, foodId, state: await state(page), databaseSha256: acceptedFingerprint });
        for (const destination of [locale === "en" ? "he" : "en", locale] as const) {
          phase = `native-locale-click-${destination}`;
          evidence.records.push({ kind: "native-locale-navigation", ...await switchLanguage(page, destination), state: await state(page) });
          expect(new URL(page.url()).searchParams.get("creationRequest")).toBe(key);
          expect(new URL(page.url()).pathname).toBe(`/${destination}/foods/custom/${foodId}/edit`);
          await expect(page.getByTestId("custom-food-success")).toBeVisible();
          expect(snapshot()).toBe(acceptedFingerprint);
        }
        expect((evidence.requests as { method: string }[]).filter(request => request.method === "POST")).toHaveLength(1);
        expect(evidence.errors).toEqual([]);
        evidence.records.push({ kind: "native-final", foodId, databaseBeforeSha256: acceptedFingerprint, databaseAfterSha256: snapshot() });
      } finally { await context.close(); }
    });

    test(`R4 ${locale} route receipt validation and matching-only draft cleanup remain authoritative`, async ({ browser }, info) => {
      test.setTimeout(120_000);
      const evidence = newEvidence(info);
      const context = await newContext(browser);
      try {
        const page = await context.newPage(); observe(page, evidence, () => "controlled-route-receipt");
        await page.goto(`/${locale}/foods/custom/new`);
        await fillCreate(page, `Receipt matrix draft ${randomUUID()}`);
        const key = await page.getByTestId("custom-food-creation-key").inputValue();
        const storageKey = await page.getByTestId("custom-food-form").getAttribute("data-draft-storage-key");
        const draft = await page.evaluate(storage => sessionStorage.getItem(storage!), storageKey);
        expect(draft).toBeTruthy();
        const created = await account.client.rpc("persist_custom_food", { p_aliases: [], p_brand_name: null as unknown as string, p_food_id: null as unknown as string, p_locale: locale, p_name: "Receipt validation persisted fixture", p_nutrient_basis: "per_serving", p_nutrients: [], p_serving_quantity: 1, p_serving_unit: "portion" });
        expect(created.error).toBeNull(); const foodId = created.data![0].food_id;
        const acceptedFingerprint = snapshot(); const unrelated = randomUUID();
        const cases = [
          { name: "missing", query: "saved=created", expected: "saved=created", removed: false, href: "saved=created" },
          { name: "invalid-uuid", query: "saved=created&creationRequest=invalid", expected: "saved=created&creationRequest=invalid", removed: false, href: "saved=created" },
          { name: "repeated", query: `saved=created&creationRequest=${key}&creationRequest=${unrelated}`, expected: `saved=created&creationRequest=${key}&creationRequest=${unrelated}`, removed: false, href: "saved=created" },
          { name: "mismatched-valid", query: `saved=created&creationRequest=${unrelated}`, expected: "saved=created", removed: false, href: "saved=created" },
          { name: "updated-notice", query: `saved=updated&creationRequest=${key}`, expected: `saved=updated&creationRequest=${key}`, removed: false, href: "saved=updated" },
          { name: "matching-created", query: `saved=created&creationRequest=${key}`, expected: "saved=created", removed: true, href: "saved=created" },
          { name: "unsupported-query", query: `saved=created&creationRequest=${key}&unrelated=discard&date=2026-09-20`, expected: "saved=created&unrelated=discard&date=2026-09-20", removed: true, href: "saved=created" },
        ];
        for (const scenario of cases) {
          await page.evaluate(({ storage, value }) => sessionStorage.setItem(storage!, value!), { storage: storageKey, value: draft });
          await page.goto(`/${locale}/foods/custom/${foodId}/edit?${scenario.query}`);
          await expect(page.getByTestId("custom-food-form")).toBeVisible();
          await expect(page).toHaveURL(url => url.search.slice(1) === scenario.expected);
          let assertionsPassed = false;
          try {
            await expect.poll(() => hrefs(page)).toEqual(locales.map(value => ({ locale: value, href: `/${value}/foods/custom/${foodId}/edit?${scenario.href}` })));
            const matchingRemoved = await page.evaluate(storage => sessionStorage.getItem(storage!) === null, storageKey);
            expect(matchingRemoved).toBe(scenario.removed);
            expect(snapshot()).toBe(acceptedFingerprint);
            assertionsPassed = true;
          } finally {
            evidence.records.push({ kind: "receipt-validation", locale, case: scenario.name, suppliedQuery: scenario.query, expectedQuery: scenario.expected, state: await state(page), matchingRemoved: await page.evaluate(storage => sessionStorage.getItem(storage!) === null, storageKey), databaseBeforeSha256: acceptedFingerprint, databaseAfterSha256: snapshot(), assertionsPassed });
          }
        }
        expect((evidence.requests as { method: string }[]).filter(request => request.method === "POST")).toEqual([]);
        expect(evidence.errors).toEqual([]);
      } finally { await context.close(); }
    });
  }
});
