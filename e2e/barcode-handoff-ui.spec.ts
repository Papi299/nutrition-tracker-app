import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  expect,
  test,
  type Browser,
  type BrowserContext,
} from "@playwright/test";
import type { Database, Json } from "@/lib/supabase/database.types";

const localSupabaseUrl = process.env.LOCAL_SUPABASE_URL;
const localSupabasePublishableKey = process.env.LOCAL_SUPABASE_PUBLISHABLE_KEY;
const localOnly = process.env.DATE_E2E_LOCAL_SUPABASE === "1";
const password = "BarcodeHandoffUiPassword123!";
const projectId = readFileSync("supabase/config.toml", "utf8").match(
  /^project_id\s*=\s*"([^"]+)"/m,
)?.[1];

if (!projectId) throw new Error("Could not read local Supabase project id.");
const databaseContainer = `supabase_db_${projectId}`;

test.skip(
  !localOnly || !localSupabaseUrl || !localSupabasePublishableKey,
  "Barcode handoff UI tests require local Supabase.",
);

function canonicalGtin(seed: number) {
  const payload = `4${String(seed).padStart(12, "0")}`;
  let sum = 0;
  let weight = 3;
  for (let index = payload.length - 1; index >= 0; index -= 1) {
    sum += (payload.charCodeAt(index) - 48) * weight;
    weight = weight === 3 ? 1 : 3;
  }
  return `${payload}${(10 - (sum % 10)) % 10}`;
}

test.describe.serial("not-found custom-food barcode handoff UI", () => {
  const offset = (Date.now() % 10_000_000) * 100;
  const runId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const codes = {
    attach: canonicalGtin(offset + 1),
    omit: canonicalGtin(offset + 2),
    validation: canonicalGtin(offset + 3),
    noJs: canonicalGtin(offset + 4),
    otherUser: canonicalGtin(offset + 5),
    owned: canonicalGtin(offset + 6),
    public: canonicalGtin(offset + 7),
    archived: canonicalGtin(offset + 8),
    submitConflict: canonicalGtin(offset + 9),
    ambiguous: canonicalGtin(offset + 10),
  };
  const publicFoodId = randomUUID();
  const submitConflictPublicFoodId = randomUUID();
  let storageState: Awaited<ReturnType<BrowserContext["storageState"]>>;
  let userA: SupabaseClient<Database>;
  let userB: SupabaseClient<Database>;
  let userAId: string;
  let userBId: string;
  let ownedFoodId: string;
  let archivedFoodId: string;

  function localClient() {
    return createClient<Database>(
      localSupabaseUrl as string,
      localSupabasePublishableKey as string,
      { auth: { autoRefreshToken: false, persistSession: false } },
    );
  }

  function queryDatabase(statement: string) {
    return execFileSync(
      "docker",
      [
        "exec",
        databaseContainer,
        "psql",
        "-U",
        "postgres",
        "-d",
        "postgres",
        "-v",
        "ON_ERROR_STOP=1",
        "-At",
        "-c",
        statement,
      ],
      { encoding: "utf8" },
    ).trim();
  }

  async function context(
    browser: Browser,
    options: Parameters<Browser["newContext"]>[0] = {},
  ) {
    return browser.newContext({ ...options, storageState });
  }

  async function persistFood(client: SupabaseClient<Database>, name: string) {
    const result = await client.rpc("persist_custom_food", {
      p_aliases: [] as Json,
      p_brand_name: null as unknown as string,
      p_food_id: null as unknown as string,
      p_locale: "en",
      p_name: name,
      p_nutrient_basis: "per_serving",
      p_nutrients: [] as Json,
      p_serving_quantity: 1,
      p_serving_unit: "serving",
    });
    expect(result.error).toBeNull();
    return result.data?.[0].food_id as string;
  }

  function insertMapping(
    foodId: string,
    gtin: string,
    source: "manual" | "user_custom",
  ) {
    queryDatabase(`
      insert into public.food_barcodes (
        food_id, canonical_gtin, provenance_source_id, verification_status
      ) values (
        '${foodId}', '${gtin}',
        (select id from public.food_sources where code = '${source}'),
        '${source === "user_custom" ? "user_asserted" : "curated_verified"}'
      );
    `);
  }

  function handoff(code: string, locale = "en", meal = "lunch") {
    return `/${locale}/foods/custom/new?barcode=${code}&date=2026-07-17${
      meal ? `&mealType=${meal}` : ""
    }`;
  }

  async function fillMinimum(page: import("@playwright/test").Page, name: string) {
    await page.getByLabel("Name", { exact: true }).fill(name);
    await page.getByLabel("Serving quantity").fill("1");
    await page.getByLabel("Serving unit").fill("serving");
  }

  test.beforeAll(async ({ browser }) => {
    const signup = await browser.newContext();
    const page = await signup.newPage();
    const emailA = `phase9c-ui-a-${runId}@example.test`;
    await page.goto("/en/auth/sign-up");
    await page.getByLabel("Email").fill(emailA);
    await page.getByLabel("Password").fill(password);
    await page.getByRole("button", { name: "Create account" }).click();
    await expect(page).toHaveURL(/\/en\/today\?date=\d{4}-\d{2}-\d{2}$/);
    storageState = await signup.storageState();
    await signup.close();

    userA = localClient();
    const signedA = await userA.auth.signInWithPassword({ email: emailA, password });
    userAId = signedA.data.user?.id as string;

    userB = localClient();
    const signedB = await userB.auth.signUp({
      email: `phase9c-ui-b-${runId}@example.test`,
      password,
    });
    userBId = signedB.data.user?.id as string;

    ownedFoodId = await persistFood(userA, `Phase 9C UI owned ${runId}`);
    archivedFoodId = await persistFood(userA, `Phase 9C UI archived ${runId}`);
    const otherFoodId = await persistFood(userB, `Phase 9C UI other ${runId}`);
    insertMapping(ownedFoodId, codes.owned, "user_custom");
    insertMapping(archivedFoodId, codes.archived, "user_custom");
    insertMapping(otherFoodId, codes.otherUser, "user_custom");
    await userA.rpc("set_custom_food_archived", {
      p_food_id: archivedFoodId,
      p_is_archived: true,
    });

    queryDatabase(`
      insert into public.foods (
        id, food_type, name, locale, data_quality, is_public, is_archived, source_id
      ) values (
        '${publicFoodId}', 'generic', 'Phase 9C UI public', 'en', 'curated', true, false,
        (select id from public.food_sources where code = 'manual')
      );
    `);
    insertMapping(publicFoodId, codes.public, "manual");
  });

  test.afterAll(() => {
    queryDatabase(`
      delete from public.foods where id in ('${publicFoodId}', '${submitConflictPublicFoodId}');
      delete from auth.users where id in ('${userAId}', '${userBId}');
    `);
  });

  test("carries strict canonical context from Phase 9B and renders localized read-only forms", async ({ browser }) => {
    const session = await context(browser, { viewport: { height: 844, width: 390 } });
    const page = await session.newPage();
    await page.goto(`/en/foods/barcode?code=${codes.attach}&date=2026-07-17&mealType=dinner`);
    const handoffLink = page.getByRole("link", {
      name: "Create private food with this barcode",
    });
    await expect(handoffLink).toHaveAttribute(
      "href",
      `/en/foods/custom/new?barcode=${codes.attach}&date=2026-07-17&mealType=dinner`,
    );
    await handoffLink.click();
    await expect(page.getByTestId("custom-food-barcode-context")).toBeVisible();
    await expect(page.getByTestId("custom-food-canonical-gtin")).toHaveText(codes.attach);
    await expect(page.getByTestId("custom-food-canonical-gtin")).toHaveAttribute("dir", "ltr");
    await expect(page.locator('input[name="barcode"], input[name="date"], input[name="mealType"]')).toHaveCount(0);
    await expect(page.getByLabel("Create this food without attaching the barcode")).not.toBeChecked();
    await page.getByLabel("Name", { exact: true }).focus();
    await expect(page.getByLabel("Name", { exact: true })).toBeFocused();

    await page.goto(handoff(codes.otherUser, "he", "other"));
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    await expect(page.getByTestId("custom-food-barcode-context")).toBeVisible();
    await expect(page.getByTestId("custom-food-canonical-gtin")).toHaveAttribute("dir", "ltr");

    await page.goto("/en/foods/custom/new");
    await expect(page.getByTestId("custom-food-barcode-context")).toHaveCount(0);
    await session.close();
  });

  test("fails closed for malformed handoffs, conflicts, ambiguity, database failure, and expired sessions", async ({ browser }) => {
    const session = await context(browser);
    const page = await session.newPage();
    for (const suffix of [
      "date=2026-07-17",
      `barcode=036000291452&date=2026-07-17`,
      `barcode=%20${codes.attach}%20&date=2026-07-17`,
      "barcode=09780306406157&date=2026-07-17",
      `barcode=${codes.attach}&date=2026-07-17&extra=x`,
      `barcode=${codes.attach}&barcode=${codes.omit}&date=2026-07-17`,
    ]) {
      await page.goto(`/en/foods/custom/new?${suffix}`);
      await expect(page.getByTestId("barcode-handoff-invalid")).toBeVisible();
      await expect(page.locator('form:has(input[name="food_id"])')).toHaveCount(0);
    }

    await page.goto(handoff(codes.owned));
    await expect(page.getByTestId("barcode-handoff-found_owned")).toBeVisible();
    await expect(page.locator('form:has(input[name="food_id"])')).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Edit existing custom food" })).toHaveAttribute(
      "href",
      `/en/foods/custom/${ownedFoodId}/edit`,
    );

    await page.goto(handoff(codes.public));
    await expect(page.getByTestId("barcode-handoff-found_public")).toBeVisible();
    await expect(page.locator('form:has(input[name="food_id"])')).toHaveCount(0);
    await page.goto(handoff(codes.archived));
    await expect(page.getByTestId("barcode-handoff-unavailable")).toBeVisible();
    await expect(page.locator('form:has(input[name="food_id"])')).toHaveCount(0);
    await session.close();

    const ambiguous = await context(browser, {
      extraHTTPHeaders: { "x-phase9c-handoff-fault": "ambiguous" },
    });
    const ambiguousPage = await ambiguous.newPage();
    await ambiguousPage.goto(handoff(codes.ambiguous));
    await expect(ambiguousPage.getByTestId("barcode-handoff-ambiguous")).toBeVisible();
    await expect(ambiguousPage.locator('form:has(input[name="food_id"])')).toHaveCount(0);
    await ambiguous.close();

    const failed = await context(browser, {
      extraHTTPHeaders: { "x-phase9c-handoff-fault": "database_error" },
    });
    const failedPage = await failed.newPage();
    await failedPage.goto(handoff(codes.attach));
    await expect(failedPage.getByTestId("barcode-handoff-database-error")).toBeVisible();
    await expect(failedPage.locator('form:has(input[name="food_id"])')).toHaveCount(0);
    await failed.close();

    const expired = await context(browser);
    await expired.clearCookies();
    const expiredPage = await expired.newPage();
    await expiredPage.goto(handoff(codes.attach, "he"));
    await expect(expiredPage).toHaveURL(/\/he\/auth\/sign-in$/);
    await expired.close();
  });

  test("attaches atomically, logs only after review, and then resolves as owned", async ({ browser }) => {
    const session = await context(browser);
    const page = await session.newPage();
    const beforeDiary = queryDatabase(`select count(*) from public.diary_entries where user_id = '${userAId}';`);
    await page.goto(handoff(codes.attach, "en", "dinner"));
    await fillMinimum(page, `Phase 9C attached UI ${runId}`);
    await page.evaluate(() => {
      const form = document.querySelector("form");
      for (const [name, value] of [
        ["barcode", "00000000000000"],
        ["owner_user_id", "00000000-0000-0000-0000-000000000000"],
        ["verification_status", "curated_verified"],
        ["scope_owner_user_id", ""],
      ]) {
        const input = document.createElement("input");
        input.name = name;
        input.value = value;
        form?.append(input);
      }
    });
    await page.getByRole("button", { name: "Create custom food" }).click();
    await expect(page).toHaveURL(
      /\/en\/today\?date=2026-07-17&foodId=[0-9a-f-]+&mealType=dinner&customFood=created$/,
    );
    await expect(page.getByTestId("custom-food-created-success")).toBeVisible();
    await expect(page.getByTestId("selected-food-summary")).toContainText(
      `Phase 9C attached UI ${runId}`,
    );
    await expect(page.locator('select[name="meal_type"]')).toHaveValue("dinner");
    const foodId = new URL(page.url()).searchParams.get("foodId") as string;
    expect(
      queryDatabase(`
        select
          canonical_gtin,
          scope_owner_user_id = '${userAId}',
          verification_status
        from public.food_barcodes where food_id = '${foodId}';
      `),
    ).toBe(`${codes.attach}|t|user_asserted`);
    expect(queryDatabase(`select count(*) from public.diary_entries where user_id = '${userAId}';`)).toBe(beforeDiary);
    await page.reload();
    expect(queryDatabase(`select count(*) from public.diary_entries where user_id = '${userAId}';`)).toBe(beforeDiary);
    await page.getByRole("button", { name: "Add entry" }).click();
    expect(queryDatabase(`select count(*) from public.diary_entries where user_id = '${userAId}';`)).toBe(String(Number(beforeDiary) + 1));
    await page.goto(`/en/foods/barcode?code=${codes.attach}&date=2026-07-17`);
    await expect(page.getByTestId("barcode-found_owned")).toContainText(
      `Phase 9C attached UI ${runId}`,
    );
    await session.close();
  });

  test("preserves explicit omission through validation and creates complete barcode-free food", async ({ browser }) => {
    const session = await context(browser);
    const page = await session.newPage();
    await page.goto(handoff(codes.validation, "en", "snack"));
    await page.getByLabel("Create this food without attaching the barcode").check();
    await page.getByLabel("Serving quantity").fill("1");
    await page.getByLabel("Serving unit").fill("serving");
    await page.getByRole("button", { name: "Create custom food" }).click();
    await expect(page.getByText("Check the highlighted fields and try again.")).toBeVisible();
    await expect(page.getByLabel("Create this food without attaching the barcode")).toBeChecked();

    await page.goto(handoff(codes.omit, "en", "snack"));
    await fillMinimum(page, `Phase 9C omitted UI ${runId}`);
    await page.getByLabel("Create this food without attaching the barcode").check();
    await page.locator('[data-nutrient-code="energy_kcal"]').fill("88");
    await page.getByRole("button", { name: "Add alias" }).click();
    await page.getByLabel("Alias text").fill("Omitted Barcode Alias");
    await page.getByRole("button", { name: "Create custom food" }).click();
    await expect(page).toHaveURL(
      /\/en\/today\?date=2026-07-17&foodId=[0-9a-f-]+&mealType=snack&customFood=created$/,
    );
    await expect(page.getByTestId("selected-food-summary")).toContainText(
      `Phase 9C omitted UI ${runId}`,
    );
    await expect(page.locator('select[name="meal_type"]')).toHaveValue("snack");
    const foodId = new URL(page.url()).searchParams.get("foodId") as string;
    expect(queryDatabase(`select count(*) from public.food_barcodes where food_id = '${foodId}';`)).toBe("0");
    expect(
      queryDatabase(`
        select
          (select count(*) from public.food_nutrients where food_id = '${foodId}'),
          (select count(*) from public.food_aliases where food_id = '${foodId}');
      `),
    ).toBe("1|1");
    await page.goto(`/en/foods/barcode?code=${codes.omit}&date=2026-07-17`);
    await expect(page.getByTestId("barcode-not-found")).toBeVisible();
    await session.close();
  });

  test("reports a write-time public conflict with values intact and supports no-JavaScript attachment", async ({ browser }) => {
    const session = await context(browser);
    const page = await session.newPage();
    const conflictName = `Phase 9C submitted conflict ${runId}`;
    await page.goto(handoff(codes.submitConflict));
    await fillMinimum(page, conflictName);
    queryDatabase(`
      insert into public.foods (
        id, food_type, name, locale, data_quality, is_public, is_archived, source_id
      ) values (
        '${submitConflictPublicFoodId}', 'generic', 'Phase 9C late public', 'en', 'curated', true, false,
        (select id from public.food_sources where code = 'manual')
      );
    `);
    insertMapping(submitConflictPublicFoodId, codes.submitConflict, "manual");
    await page.getByRole("button", { name: "Create custom food" }).click();
    await expect(page.getByTestId("barcode-save-public-conflict")).toBeVisible();
    await expect(page.getByLabel("Name", { exact: true })).toHaveValue(conflictName);
    expect(queryDatabase(`select count(*) from public.foods where name = '${conflictName}';`)).toBe("0");
    await session.close();

    const noJs = await context(browser, { javaScriptEnabled: false });
    const noJsPage = await noJs.newPage();
    await noJsPage.goto(handoff(codes.noJs));
    await fillMinimum(noJsPage, `Phase 9C no JS ${runId}`);
    await noJsPage.getByRole("button", { name: "Create custom food" }).click();
    await expect(noJsPage).toHaveURL(
      /\/en\/today\?date=2026-07-17&foodId=[0-9a-f-]+&mealType=lunch&customFood=created$/,
    );
    const noJsFoodId = new URL(noJsPage.url()).searchParams.get("foodId") as string;
    expect(queryDatabase(`select canonical_gtin from public.food_barcodes where food_id = '${noJsFoodId}';`)).toBe(codes.noJs);
    await noJs.close();
  });
});
