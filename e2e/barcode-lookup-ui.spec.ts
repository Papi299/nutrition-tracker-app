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
import type { Database } from "@/lib/supabase/database.types";

const localSupabaseUrl = process.env.LOCAL_SUPABASE_URL;
const localSupabasePublishableKey = process.env.LOCAL_SUPABASE_PUBLISHABLE_KEY;
const localOnly = process.env.DATE_E2E_LOCAL_SUPABASE === "1";
const password = "BarcodeLookupUiPassword123!";
const supabaseProjectId = readFileSync("supabase/config.toml", "utf8").match(
  /^project_id\s*=\s*"([^"]+)"/m,
)?.[1];

if (!supabaseProjectId) throw new Error("Could not read local Supabase project id.");
const databaseContainer = `supabase_db_${supabaseProjectId}`;

test.skip(
  !localOnly || !localSupabaseUrl || !localSupabasePublishableKey,
  "Barcode lookup UI tests require the local-only runner.",
);

function canonicalGtin(seed: number) {
  const payload = `3${String(seed).padStart(12, "0")}`;
  let sum = 0;
  let weight = 3;
  for (let index = payload.length - 1; index >= 0; index -= 1) {
    sum += (payload.charCodeAt(index) - 48) * weight;
    weight = weight === 3 ? 1 : 3;
  }
  return `${payload}${(10 - (sum % 10)) % 10}`;
}

test.describe.serial("manual barcode lookup and found-food review", () => {
  let authenticatedState: Awaited<ReturnType<BrowserContext["storageState"]>>;
  let userAClient: SupabaseClient<Database>;
  let userBClient: SupabaseClient<Database>;
  let userAId: string;
  let userBId: string;
  let ownedFoodId: string;
  let sharedOwnedFoodId: string;
  let archivedFoodId: string;
  let otherFoodId: string;
  const publicFoodId = randomUUID();
  const sharedPublicFoodId = randomUUID();
  const runSeed = Date.now() % 100_000_000_000;
  const codes = {
    archived: canonicalGtin(runSeed + 1),
    notFound: canonicalGtin(runSeed + 2),
    other: canonicalGtin(runSeed + 3),
    owned: canonicalGtin(runSeed + 4),
    public: canonicalGtin(runSeed + 5),
    shared: canonicalGtin(runSeed + 6),
  };
  const runId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;

  function localClient() {
    return createClient<Database>(
      localSupabaseUrl as string,
      localSupabasePublishableKey as string,
      { auth: { autoRefreshToken: false, persistSession: false } },
    );
  }

  function queryLocalDatabase(statement: string) {
    let lastError: unknown;
    for (let attempt = 0; attempt < 5; attempt += 1) {
      try {
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
      } catch (error) {
        lastError = error;
        if (attempt < 4) execFileSync("sleep", ["1"]);
      }
    }
    throw lastError;
  }

  async function newAuthenticatedContext(
    browser: Browser,
    options: Parameters<Browser["newContext"]>[0] = {},
  ) {
    return browser.newContext({ ...options, storageState: authenticatedState });
  }

  async function createCustomFood(
    client: SupabaseClient<Database>,
    ownerId: string,
    name: string,
    brandName: string | null = null,
  ) {
    const result = await client
      .from("foods")
      .insert({
        brand_name: brandName,
        custom_nutrient_basis: "per_serving",
        data_quality: "user_provided",
        food_type: "user_custom",
        is_public: false,
        locale: "en",
        name,
        owner_user_id: ownerId,
        serving_size: 1,
        serving_unit: "serving",
      })
      .select("id")
      .single();
    expect(result.error).toBeNull();
    return result.data?.id as string;
  }

  test.beforeAll(async ({ browser }) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    const userAEmail = `barcode-ui-a-${runId}@example.test`;
    const userBEmail = `barcode-ui-b-${runId}@example.test`;

    await page.goto("/en/auth/sign-up");
    await page.getByLabel("Email").fill(userAEmail);
    await page.getByLabel("Password").fill(password);
    await page.getByRole("button", { name: "Create account" }).click();
    await expect(page).toHaveURL(/\/en\/today\?date=\d{4}-\d{2}-\d{2}$/);
    authenticatedState = await context.storageState();
    await context.close();

    userAClient = localClient();
    const userASignIn = await userAClient.auth.signInWithPassword({
      email: userAEmail,
      password,
    });
    expect(userASignIn.error).toBeNull();
    userAId = userASignIn.data.user?.id as string;

    userBClient = localClient();
    const userBSignUp = await userBClient.auth.signUp({
      email: userBEmail,
      password,
    });
    expect(userBSignUp.error).toBeNull();
    userBId = userBSignUp.data.user?.id as string;

    ownedFoodId = await createCustomFood(
      userAClient,
      userAId,
      "My Barcode Oat Bowl",
      "Home Brand",
    );
    sharedOwnedFoodId = await createCustomFood(
      userAClient,
      userAId,
      "My Preferred Shared Barcode",
    );
    archivedFoodId = await createCustomFood(
      userAClient,
      userAId,
      "Archived Barcode Food",
    );
    otherFoodId = await createCustomFood(
      userBClient,
      userBId,
      "Other User Secret Barcode Food",
    );

    queryLocalDatabase(`
      update public.foods set is_archived = true where id = '${archivedFoodId}';

      insert into public.foods (
        id, food_type, name, brand_name, locale, serving_size, serving_unit,
        data_quality, is_public, is_archived, source_id
      ) values
        ('${publicFoodId}', 'branded', 'Public Barcode Yogurt', 'מותג Global', 'he', 150, 'g', 'verified', true, false, (select id from public.food_sources where code = 'usda')),
        ('${sharedPublicFoodId}', 'generic', 'Public Shared Barcode Food', null, 'en', 100, 'g', 'curated', true, false, (select id from public.food_sources where code = 'manual'));

      insert into public.food_nutrients (food_id, nutrient_id, amount, basis) values
        ('${ownedFoodId}', (select id from public.nutrients where code = 'energy_kcal'), 210, 'per_serving'),
        ('${ownedFoodId}', (select id from public.nutrients where code = 'protein_g'), 8.5, 'per_serving'),
        ('${publicFoodId}', (select id from public.nutrients where code = 'energy_kcal'), 95, 'per_serving');

      insert into public.food_barcodes (
        food_id, canonical_gtin, provenance_source_id,
        provenance_source_food_id, verification_status
      ) values
        ('${ownedFoodId}', '${codes.owned}', (select id from public.food_sources where code = 'user_custom'), 'owned-ui-fixture', 'user_asserted'),
        ('${publicFoodId}', '${codes.public}', (select id from public.food_sources where code = 'usda'), 'public-ui-fixture', 'curated_verified'),
        ('${sharedOwnedFoodId}', '${codes.shared}', (select id from public.food_sources where code = 'user_custom'), null, 'user_asserted'),
        ('${sharedPublicFoodId}', '${codes.shared}', (select id from public.food_sources where code = 'manual'), null, 'curated_verified'),
        ('${archivedFoodId}', '${codes.archived}', (select id from public.food_sources where code = 'user_custom'), null, 'user_asserted'),
        ('${otherFoodId}', '${codes.other}', (select id from public.food_sources where code = 'user_custom'), null, 'user_asserted');
    `);
  });

  test("bootstraps a browser-local date and supports localized no-JavaScript manual entry", async ({ browser }) => {
    const context = await newAuthenticatedContext(browser, {
      timezoneId: "Asia/Jerusalem",
    });
    const page = await context.newPage();
    await page.clock.install({ time: new Date("2026-07-16T22:30:00.000Z") });
    await page.goto(`/en/foods/barcode?code=${codes.public}&mealType=lunch`);
    await expect(page).toHaveURL(
      `/en/foods/barcode?date=2026-07-17&code=${codes.public}&mealType=lunch`,
    );
    await expect(page.getByTestId("barcode-found_public")).toBeVisible();
    await context.close();

    const noJs = await newAuthenticatedContext(browser, { javaScriptEnabled: false });
    const noJsPage = await noJs.newPage();
    await noJsPage.goto(`/he/foods/barcode?code=${codes.public}&mealType=other`);
    await expect(noJsPage.locator("html")).toHaveAttribute("dir", "rtl");
    await noJsPage
      .getByRole("textbox", { name: "תאריך לוח שנה" })
      .fill("2025-01-02");
    await noJsPage.getByRole("button", { name: "המשך עם התאריך" }).click();
    await expect(noJsPage).toHaveURL(
      `/he/foods/barcode?date=2025-01-02&code=${codes.public}&mealType=other`,
    );
    await expect(noJsPage.getByTestId("barcode-found_public")).toBeVisible();
    await expect(noJsPage.getByTestId("canonical-gtin")).toHaveAttribute("dir", "ltr");
    await noJs.close();
  });

  test("renders initial, invalid, canonical redirect, discovery, mobile, keyboard, and session states", async ({ browser }) => {
    const context = await newAuthenticatedContext(browser, {
      viewport: { height: 800, width: 390 },
    });
    const page = await context.newPage();
    await page.goto("/en/foods/barcode?date=2026-07-17");
    await expect(page.getByTestId("barcode-initial")).toBeVisible();
    const barcodeInput = page.locator('input[name="code"]');
    await expect(barcodeInput).toHaveAttribute("type", "text");
    await barcodeInput.focus();
    await page.keyboard.type("12345671");
    await page.getByRole("button", { name: "Look up barcode" }).press("Enter");
    await expect(page.getByTestId("barcode-invalid")).toContainText("check digit");

    await page.goto("/en/foods/barcode?code=96385074&date=2026-07-17&mealType=dinner");
    await expect(page).toHaveURL(
      "/en/foods/barcode?code=00000096385074&date=2026-07-17&mealType=dinner",
    );

    await page.goto("/en/foods?date=2026-07-17");
    await expect(page.getByRole("link", { name: "Look up barcode" })).toHaveAttribute(
      "href",
      "/en/foods/barcode?date=2026-07-17",
    );
    await expect(page.getByRole("link", { name: "Barcode lookup" })).toHaveAttribute(
      "href",
      "/en/foods/barcode",
    );
    await context.close();

    const expired = await newAuthenticatedContext(browser);
    await expired.clearCookies();
    const expiredPage = await expired.newPage();
    await expiredPage.goto("/he/foods/barcode?date=2026-07-17");
    await expect(expiredPage).toHaveURL(/\/he\/auth\/sign-in$/);
    await expired.close();
  });

  test("reviews owned, public, and owned-before-public results without mutation", async ({ browser }) => {
    const context = await newAuthenticatedContext(browser);
    const page = await context.newPage();
    const before = await userAClient
      .from("diary_entries")
      .select("id", { count: "exact", head: true });

    await page.goto(`/en/foods/barcode?code=${codes.owned}&date=2026-07-17&mealType=lunch`);
    const owned = page.getByTestId("barcode-found_owned");
    await expect(owned.getByRole("heading", { name: "My Barcode Oat Bowl" })).toHaveAttribute("dir", "auto");
    await expect(owned).toContainText("Your custom food");
    await expect(owned).toContainText("User asserted");
    await expect(owned.getByRole("link", { name: "Edit custom food" })).toHaveAttribute(
      "href",
      `/en/foods/custom/${ownedFoodId}/edit`,
    );
    await expect(owned.getByRole("link", { name: "Review for diary" })).toHaveAttribute(
      "href",
      `/en/today?date=2026-07-17&foodId=${ownedFoodId}&mealType=lunch`,
    );

    await page.goto(`/he/foods/barcode?code=${codes.public}&date=2026-07-17`);
    const publicReview = page.getByTestId("barcode-found_public");
    await expect(publicReview).toContainText("Public Barcode Yogurt");
    await expect(publicReview).toContainText("USDA FoodData Central");
    await expect(publicReview.getByRole("link", { name: "עריכת מזון מותאם" })).toHaveCount(0);
    await expect(page.getByTestId("canonical-gtin")).toHaveText(codes.public);
    await expect(page.getByTestId("canonical-gtin")).toHaveAttribute("dir", "ltr");

    await page.goto(`/en/foods/barcode?code=${codes.shared}&date=2026-07-17`);
    await expect(page.getByTestId("barcode-found_owned")).toContainText(
      "My Preferred Shared Barcode",
    );
    await page.reload();
    await page.goBack();
    const after = await userAClient
      .from("diary_entries")
      .select("id", { count: "exact", head: true });
    expect(after.count).toBe(before.count);
    await context.close();
  });

  test("keeps archived, other-user, local miss, and database failure states distinct", async ({ browser }) => {
    const context = await newAuthenticatedContext(browser);
    const page = await context.newPage();
    await page.goto(`/en/foods/barcode?code=${codes.archived}&date=2026-07-17`);
    await expect(page.getByTestId("barcode-unavailable")).toBeVisible();
    await expect(page.getByRole("link", { name: "Review for diary" })).toHaveCount(0);

    for (const code of [codes.other, codes.notFound]) {
      await page.goto(`/en/foods/barcode?code=${code}&date=2026-07-17`);
      const notFound = page.getByTestId("barcode-not-found");
      await expect(notFound).toBeVisible();
      await expect(notFound).not.toContainText("Other User Secret");
      await expect(notFound.getByRole("link", { name: "Create custom food" })).toHaveAttribute(
        "href",
        "/en/foods/custom/new",
      );
    }
    await context.close();

    const faultContext = await newAuthenticatedContext(browser, {
      extraHTTPHeaders: { "x-phase9b-barcode-fault": "database_error" },
    });
    const faultPage = await faultContext.newPage();
    await faultPage.goto(`/en/foods/barcode?code=${codes.public}&date=2026-07-17&mealType=snack`);
    const failure = faultPage.getByTestId("barcode-database-error");
    await expect(failure).toContainText("not a not-found result");
    await expect(failure).not.toContainText("permission denied");
    await expect(failure.getByRole("link", { name: "Try this barcode again" })).toHaveAttribute(
      "href",
      `/en/foods/barcode?code=${codes.public}&date=2026-07-17&mealType=snack`,
    );
    await faultContext.close();
  });

  test("hands off to editable Today prefill, preserves meal removal, and writes only on explicit submission", async ({ browser }) => {
    const context = await newAuthenticatedContext(browser);
    const page = await context.newPage();
    const date = "2025-05-06";
    const before = await userAClient
      .from("diary_entries")
      .select("id", { count: "exact", head: true });

    await page.goto(`/en/foods/barcode?code=${codes.owned}&date=${date}&mealType=dinner`);
    await page.getByRole("link", { name: "Review for diary" }).click();
    await expect(page.getByTestId("selected-food-summary")).toContainText("My Barcode Oat Bowl");
    await expect(page.locator('select[name="meal_type"]')).toHaveValue("dinner");
    await expect(page.locator('input[name="calories"]')).toHaveValue("210");
    await page.locator('input[name="calories"]').fill("211");
    await expect(page.getByRole("link", { name: "Remove selected food" })).toHaveAttribute(
      "href",
      `/en/today?date=${date}&mealType=dinner`,
    );
    const beforeSubmit = await userAClient
      .from("diary_entries")
      .select("id", { count: "exact", head: true });
    expect(beforeSubmit.count).toBe(before.count);

    await page.getByRole("button", { name: "Add entry" }).click();
    await expect(page.getByText("Entry added.")).toBeVisible();
    const saved = await userAClient
      .from("diary_entries")
      .select("food_id,meal_type,calories,entry_date")
      .eq("food_id", ownedFoodId)
      .eq("entry_date", date)
      .single();
    expect(saved.data).toEqual({
      calories: 211,
      entry_date: date,
      food_id: ownedFoodId,
      meal_type: "dinner",
    });

    await page.goto(`/en/today?date=${date}&foodId=${ownedFoodId}`);
    await expect(page.locator('select[name="meal_type"]')).toHaveValue("breakfast");
    await context.close();
  });

  test("fails closed on invalid Today meal context and keeps existing success banners", async ({ browser }) => {
    const context = await newAuthenticatedContext(browser);
    const page = await context.newPage();
    for (const suffix of ["mealType=brunch", "mealType=lunch&mealType=dinner"]) {
      await page.goto(`/en/today?date=2026-07-17&foodId=${ownedFoodId}&${suffix}`);
      await expect(page.getByTestId("food-selection-context-invalid")).toBeVisible();
      await expect(page.getByTestId("selected-food-summary")).toHaveCount(0);
      await expect(page.locator('input[name="food_name"]')).toHaveValue("");
    }

    await page.goto("/en/today?date=2026-07-17&savedMeal=logged&recipe=logged");
    await expect(page.getByTestId("saved-meal-logged-success")).toBeVisible();
    await expect(page.getByTestId("recipe-logged-success")).toBeVisible();
    await context.close();
  });
});
