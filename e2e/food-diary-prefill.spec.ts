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
const password = "FoodPrefillPassword123!";
const supabaseProjectId = readFileSync("supabase/config.toml", "utf8").match(
  /^project_id\s*=\s*"([^"]+)"/m,
)?.[1];

if (!supabaseProjectId) {
  throw new Error("Could not read the local Supabase project id.");
}

const databaseContainer = `supabase_db_${supabaseProjectId}`;

test.skip(
  !localOnly || !localSupabaseUrl || !localSupabasePublishableKey,
  "Food diary prefill tests require the local-only test runner.",
);

test.describe.serial("food selection and diary snapshot prefill", () => {
  let authenticatedState: Awaited<ReturnType<BrowserContext["storageState"]>>;
  let userAClient: SupabaseClient<Database>;
  let userBClient: SupabaseClient<Database>;
  let userAId: string;
  let userBId: string;
  let ownFoodId: string;
  let otherFoodId: string;
  let deletableOwnFoodId: string;
  const perServingFoodId = randomUUID();
  const per100gFoodId = randomUUID();
  const per100mlFoodId = randomUUID();
  const noBasisFoodId = randomUUID();
  const archivedFoodId = randomUUID();
  const runId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const userAEmail = `prefill-a-${runId}@example.test`;
  const userBEmail = `prefill-b-${runId}@example.test`;

  function localClient() {
    return createClient<Database>(
      localSupabaseUrl as string,
      localSupabasePublishableKey as string,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      },
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

        if (attempt < 4) {
          execFileSync("sleep", ["1"]);
        }
      }
    }

    throw lastError;
  }

  async function newAuthenticatedContext(
    browser: Browser,
    options: Parameters<Browser["newContext"]>[0] = {},
  ) {
    return browser.newContext({
      ...options,
      storageState: authenticatedState,
    });
  }

  async function createCustomFood(
    client: SupabaseClient<Database>,
    ownerId: string,
    name: string,
  ) {
    const result = await client
      .from("foods")
      .insert({
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

    ownFoodId = await createCustomFood(
      userAClient,
      userAId,
      "Phase 6C Own Private Food",
    );
    deletableOwnFoodId = await createCustomFood(
      userAClient,
      userAId,
      "Phase 6C Deletable Food",
    );
    otherFoodId = await createCustomFood(
      userBClient,
      userBId,
      "Phase 6C Other Private Food",
    );

    queryLocalDatabase(`
      insert into public.foods (
        id, food_type, name, brand_name, locale, serving_size, serving_unit,
        data_quality, is_public, is_archived, source_id
      ) values
        ('${perServingFoodId}', 'branded', 'Phase 6C Serving Priority', 'Snapshot Brand', 'en', 2, 'slices', 'verified', true, false, (select id from public.food_sources where code = 'manual')),
        ('${per100gFoodId}', 'generic', 'Phase 6C Gram Priority', null, 'en', 25, null, 'curated', true, false, (select id from public.food_sources where code = 'manual')),
        ('${per100mlFoodId}', 'generic', 'Phase 6C Milliliter Priority', null, 'en', null, null, 'curated', true, false, (select id from public.food_sources where code = 'manual')),
        ('${noBasisFoodId}', 'generic', 'Phase 6C Identity Only', null, 'en', 3, 'bowls', 'curated', true, false, (select id from public.food_sources where code = 'manual')),
        ('${archivedFoodId}', 'generic', 'Phase 6C Archived Food', null, 'en', 1, 'item', 'curated', true, true, (select id from public.food_sources where code = 'manual'));

      insert into public.food_nutrients (food_id, nutrient_id, amount, basis) values
        ('${perServingFoodId}', (select id from public.nutrients where code = 'energy_kcal'), 123.5, 'per_serving'),
        ('${perServingFoodId}', (select id from public.nutrients where code = 'protein_g'), 0, 'per_serving'),
        ('${perServingFoodId}', (select id from public.nutrients where code = 'fat_g'), 4.5, 'per_serving'),
        ('${perServingFoodId}', (select id from public.nutrients where code = 'energy_kcal'), 999, 'per_100g'),
        ('${perServingFoodId}', (select id from public.nutrients where code = 'carbohydrates_g'), 88, 'per_100g'),
        ('${per100gFoodId}', (select id from public.nutrients where code = 'energy_kcal'), 777, 'per_serving'),
        ('${per100gFoodId}', (select id from public.nutrients where code = 'energy_kcal'), 201.4, 'per_100g'),
        ('${per100gFoodId}', (select id from public.nutrients where code = 'protein_g'), 11.25, 'per_100g'),
        ('${per100mlFoodId}', (select id from public.nutrients where code = 'energy_kcal'), 50.5, 'per_100ml'),
        ('${per100mlFoodId}', (select id from public.nutrients where code = 'carbohydrates_g'), 0, 'per_100ml'),
        ('${ownFoodId}', (select id from public.nutrients where code = 'energy_kcal'), 75, 'per_serving'),
        ('${ownFoodId}', (select id from public.nutrients where code = 'protein_g'), 6, 'per_serving');
    `);
  });

  test("keeps the invoker RPC authenticated-only and applies one nutrient basis", async () => {
    const privilegeState = queryLocalDatabase(`
      select
        has_function_privilege('anon', 'public.get_readable_food_diary_prefill(uuid)', 'execute'),
        has_function_privilege('authenticated', 'public.get_readable_food_diary_prefill(uuid)', 'execute'),
        prosecdef,
        array_to_string(proconfig, ',')
      from pg_proc
      where oid = 'public.get_readable_food_diary_prefill(uuid)'::regprocedure;
    `);
    expect(privilegeState).toContain("f|t|f|search_path=\"\"");

    const perServing = await userAClient.rpc("get_readable_food_diary_prefill", {
      p_food_id: perServingFoodId,
    });
    expect(perServing.error).toBeNull();
    expect(perServing.data?.[0]).toMatchObject({
      calories: 124,
      carbohydrates_g: null,
      fat_g: 4.5,
      is_owned: false,
      nutrient_basis: "per_serving",
      protein_g: 0,
      serving_quantity: 2,
      serving_unit: "slices",
    });

    const per100g = await userAClient.rpc("get_readable_food_diary_prefill", {
      p_food_id: per100gFoodId,
    });
    expect(per100g.data?.[0]).toMatchObject({
      calories: 201,
      nutrient_basis: "per_100g",
      protein_g: 11.25,
      serving_quantity: 100,
      serving_unit: "g",
    });

    const per100ml = await userAClient.rpc("get_readable_food_diary_prefill", {
      p_food_id: per100mlFoodId,
    });
    expect(per100ml.data?.[0]).toMatchObject({
      calories: 51,
      carbohydrates_g: 0,
      nutrient_basis: "per_100ml",
      serving_quantity: 100,
      serving_unit: "ml",
    });

    const noBasis = await userAClient.rpc("get_readable_food_diary_prefill", {
      p_food_id: noBasisFoodId,
    });
    expect(noBasis.data?.[0]).toMatchObject({
      calories: null,
      nutrient_basis: null,
      protein_g: null,
      serving_quantity: 3,
      serving_unit: "bowls",
    });

    const ownFood = await userAClient.rpc("get_readable_food_diary_prefill", {
      p_food_id: ownFoodId,
    });
    expect(ownFood.data?.[0]).toMatchObject({
      food_id: ownFoodId,
      is_owned: true,
      nutrient_basis: "per_serving",
    });

    for (const inaccessibleId of [otherFoodId, archivedFoodId]) {
      const inaccessible = await userAClient.rpc(
        "get_readable_food_diary_prefill",
        { p_food_id: inaccessibleId },
      );
      expect(inaccessible.error).toBeNull();
      expect(inaccessible.data).toEqual([]);
    }
  });

  test("preserves a historical date and saves user-edited linked snapshots", async ({
    browser,
  }) => {
    const context = await newAuthenticatedContext(browser);
    const page = await context.newPage();
    const selectedDate = "2025-04-03";

    await page.goto(`/en/today?date=${selectedDate}`);
    const findFood = page.getByRole("link", { name: "Find a food" });
    await expect(findFood).toHaveAttribute(
      "href",
      `/en/foods?date=${selectedDate}`,
    );
    await findFood.click();
    await page.getByLabel("Food name, alias, or brand").fill("Phase 6C Serving");
    await page.getByRole("button", { name: "Search foods" }).click();
    await expect(page.locator('input[name="date"]')).toHaveValue(selectedDate);

    const result = page.locator(`[data-food-id="${perServingFoodId}"]`);
    const useInDiary = result.getByRole("link", { name: "Use in diary" });
    await expect(useInDiary).toHaveAttribute(
      "href",
      `/en/today?date=${selectedDate}&foodId=${perServingFoodId}`,
    );

    const beforeSelection = await userAClient
      .from("diary_entries")
      .select("id", { count: "exact", head: true })
      .eq("food_id", perServingFoodId);
    await useInDiary.click();
    const afterSelection = await userAClient
      .from("diary_entries")
      .select("id", { count: "exact", head: true })
      .eq("food_id", perServingFoodId);
    expect(afterSelection.count).toBe(beforeSelection.count);

    await expect(page).toHaveURL(
      new RegExp(`/en/today\\?date=${selectedDate}&foodId=${perServingFoodId}$`),
    );
    await expect(page.locator("html")).toHaveAttribute("dir", "ltr");
    await expect(page.getByTestId("selected-food-summary")).toContainText(
      "Per serving",
    );
    await expect(page.locator('input[name="food_name"]')).toHaveValue(
      "Phase 6C Serving Priority",
    );
    await expect(page.locator('input[name="brand_name"]')).toHaveValue(
      "Snapshot Brand",
    );
    await expect(page.locator('input[name="serving_quantity"]')).toHaveValue("2");
    await expect(page.locator('input[name="serving_unit"]')).toHaveValue("slices");
    await expect(page.locator('input[name="calories"]')).toHaveValue("124");
    await expect(page.locator('input[name="protein_g"]')).toHaveValue("0");
    await expect(page.locator('input[name="carbohydrates_g"]')).toHaveValue("");
    await expect(page.locator('input[name="fat_g"]')).toHaveValue("4.5");

    await page.locator('input[name="food_name"]').fill("");
    await page.getByRole("button", { name: "Add entry" }).click();
    await expect(page.getByText("This field is required.")).toBeVisible();
    await expect(page.locator('input[name="food_id"]')).toHaveValue(
      perServingFoodId,
    );

    await page.locator('input[name="serving_quantity"]').fill("9");
    await expect(page.locator('input[name="calories"]')).toHaveValue("124");
    await page.locator('input[name="food_name"]').fill("Edited selected snapshot");
    await page.locator('input[name="brand_name"]').fill("Edited Snapshot Brand");
    await page.locator('input[name="calories"]').fill("130");
    await page.locator('input[name="protein_g"]').fill("1.5");
    await page.locator('input[name="carbohydrates_g"]').fill("2.5");
    await page.locator('input[name="fat_g"]').fill("");
    await page.locator('textarea[name="notes"]').fill("Reviewed before submit");
    await page.getByRole("button", { name: "Add entry" }).click();
    await expect(page.getByText("Entry added.")).toBeVisible();

    const saved = await userAClient
      .from("diary_entries")
      .select("*")
      .eq("food_id", perServingFoodId)
      .single();
    expect(saved.error).toBeNull();
    expect(saved.data).toMatchObject({
      brand_name: "Edited Snapshot Brand",
      calories: 130,
      carbohydrates_g: 2.5,
      entry_date: selectedDate,
      fat_g: null,
      food_id: perServingFoodId,
      food_name: "Edited selected snapshot",
      notes: "Reviewed before submit",
      protein_g: 1.5,
      serving_quantity: 9,
      serving_unit: "slices",
      source: "manual",
      user_id: userAId,
    });
    await context.close();
  });

  test("removes selection without relinking and keeps manual creation unlinked", async ({
    browser,
  }) => {
    const context = await newAuthenticatedContext(browser);
    const page = await context.newPage();
    const selectedDate = "2025-04-04";

    await page.goto(
      `/en/today?date=${selectedDate}&foodId=${per100gFoodId}`,
    );
    await page.getByRole("link", { name: "Remove selected food" }).click();
    await expect(page).toHaveURL(`/en/today?date=${selectedDate}`);
    await expect(page.locator('input[name="food_id"]')).toHaveCount(0);
    await page.locator('input[name="food_name"]').fill("Unlinked manual snapshot");
    await page.getByRole("button", { name: "Add entry" }).click();
    await expect(page.getByText("Entry added.")).toBeVisible();

    const manualEntry = await userAClient
      .from("diary_entries")
      .select("food_id,source")
      .eq("food_name", "Unlinked manual snapshot")
      .single();
    expect(manualEntry.data).toEqual({ food_id: null, source: "manual" });
    await context.close();
  });

  test("uses browser-local Today for direct Foods navigation while preserving foodId", async ({
    browser,
  }) => {
    const context = await newAuthenticatedContext(browser, {
      timezoneId: "Asia/Jerusalem",
    });
    const page = await context.newPage();
    await page.clock.install({ time: new Date("2026-07-14T22:30:00.000Z") });

    await page.goto("/en/foods?q=Phase%206C%20Milliliter");
    const useInDiary = page
      .locator(`[data-food-id="${per100mlFoodId}"]`)
      .getByRole("link", { name: "Use in diary" });
    await expect(useInDiary).toHaveAttribute(
      "href",
      `/en/today?foodId=${per100mlFoodId}`,
    );
    await useInDiary.click();
    await expect(page).toHaveURL((url) => {
      return (
        url.pathname === "/en/today" &&
        url.searchParams.get("date") === "2026-07-15" &&
        url.searchParams.get("foodId") === per100mlFoodId
      );
    });
    await expect(page.getByTestId("selected-food-summary")).toContainText(
      "Per 100 ml",
    );
    await context.close();
  });

  test("supports own custom food and hides other-user and archived selections", async ({
    browser,
  }) => {
    const context = await newAuthenticatedContext(browser);
    const page = await context.newPage();

    await page.goto(`/en/today?date=2026-07-14&foodId=${ownFoodId}`);
    await expect(page.getByTestId("selected-food-summary")).toContainText(
      "Your custom food",
    );
    await expect(page.locator('input[name="calories"]')).toHaveValue("75");
    await page
      .locator('input[name="food_name"]')
      .fill("Phase 11C2B active owned application snapshot");
    await page.getByRole("button", { name: "Add entry" }).click();
    await expect(page.getByText("Entry added.")).toBeVisible();
    const activeOwnedEntry = await userAClient
      .from("diary_entries")
      .select("calories,food_id,food_name,user_id")
      .eq("food_name", "Phase 11C2B active owned application snapshot")
      .single();
    expect(activeOwnedEntry.data).toEqual({
      calories: 75,
      food_id: ownFoodId,
      food_name: "Phase 11C2B active owned application snapshot",
      user_id: userAId,
    });

    for (const inaccessibleId of [otherFoodId, archivedFoodId]) {
      await page.goto(`/en/today?date=2026-07-14&foodId=${inaccessibleId}`);
      await expect(page.getByTestId("food-selection-unavailable")).toBeVisible();
      await expect(page.getByTestId("selected-food-summary")).toHaveCount(0);
      await expect(page.locator('input[name="food_name"]')).toHaveValue("");
    }
    await context.close();
  });

  test("rejects invalid and repeated foodId without running a lookup", async ({
    browser,
  }) => {
    const context = await newAuthenticatedContext(browser);
    const page = await context.newPage();

    queryLocalDatabase(
      "revoke select on table public.food_nutrients from authenticated;",
    );

    try {
      await page.goto("/en/today?date=2026-07-14&foodId=not-a-uuid");
      await expect(page.getByTestId("food-selection-invalid")).toContainText(
        "No food lookup was run",
      );
      await expect(page.getByTestId("food-selection-error")).toHaveCount(0);

      await page.goto(
        `/en/today?date=2026-07-14&foodId=${perServingFoodId}&foodId=${per100gFoodId}`,
      );
      await expect(page.getByTestId("food-selection-invalid")).toContainText(
        "Only one food selection",
      );
      await expect(page.getByTestId("food-selection-error")).toHaveCount(0);
    } finally {
      queryLocalDatabase(
        "grant select on table public.food_nutrients to authenticated;",
      );
      await context.close();
    }
  });

  test("omits invalid Foods date context deterministically", async ({ browser }) => {
    const context = await newAuthenticatedContext(browser);
    const page = await context.newPage();

    await page.goto("/en/foods?date=2026-02-30&q=Phase%206C%20Serving");
    await expect(page.getByTestId("food-search-date-context-invalid")).toBeVisible();
    await expect(page.locator('input[name="date"]')).toHaveCount(0);
    await expect(
      page
        .locator(`[data-food-id="${perServingFoodId}"]`)
        .getByRole("link", { name: "Use in diary" }),
    ).toHaveAttribute("href", `/en/today?foodId=${perServingFoodId}`);

    await page.goto(
      "/en/foods?date=2026-07-14&date=2026-07-15&q=Phase%206C%20Serving",
    );
    await expect(page.getByTestId("food-search-date-context-invalid")).toContainText(
      "Only one diary date",
    );
    await expect(page.locator('input[name="date"]')).toHaveCount(0);
    await context.close();
  });

  test("shows generic retrieval failure and redirects expired sessions", async ({
    browser,
  }) => {
    const context = await newAuthenticatedContext(browser);
    const page = await context.newPage();

    queryLocalDatabase(
      "revoke select on table public.food_nutrients from authenticated;",
    );

    try {
      await page.goto(
        `/en/today?date=2026-07-14&foodId=${perServingFoodId}`,
      );
      await expect(page.getByTestId("food-selection-error")).toContainText(
        "could not retrieve",
      );
      await expect(page.getByTestId("food-selection-error")).not.toContainText(
        "permission denied",
      );
    } finally {
      queryLocalDatabase(
        "grant select on table public.food_nutrients to authenticated;",
      );
    }

    await context.clearCookies();
    await page.goto(`/he/today?date=2026-07-14&foodId=${perServingFoodId}`);
    await expect(page).toHaveURL(/\/he\/auth\/sign-in$/);
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    await context.close();
  });

  test("CJ-013 preserves Hebrew RTL while logging a valid selected food", async ({
    browser,
  }) => {
    const context = await newAuthenticatedContext(browser);
    const page = await context.newPage();

    await page.goto(`/he/today?date=2026-07-14&foodId=${perServingFoodId}`);
    await expect(page.locator("html")).toHaveAttribute("lang", "he");
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    await expect(page.getByTestId("selected-food-summary")).toContainText(
      "למנה",
    );
    await page
      .locator('input[name="food_name"]')
      .fill("Phase 11C2B Hebrew linked snapshot");
    await page.getByRole("button", { name: "הוספת רשומה" }).click();
    await expect(page.getByText("הרשומה נוספה.")).toBeVisible();
    const saved = await userAClient
      .from("diary_entries")
      .select("food_id,food_name,user_id")
      .eq("food_name", "Phase 11C2B Hebrew linked snapshot")
      .single();
    expect(saved.data).toEqual({
      food_id: perServingFoodId,
      food_name: "Phase 11C2B Hebrew linked snapshot",
      user_id: userAId,
    });
    await context.close();
  });

  test("CJ-013 submits a selected public food with mobile and keyboard behavior", async ({
    browser,
  }) => {
    const context = await newAuthenticatedContext(browser, {
      viewport: { height: 844, width: 390 },
    });
    const page = await context.newPage();
    const snapshotName = "Phase 11C2B mobile keyboard public snapshot";

    await page.goto(`/en/today?date=2033-04-10&foodId=${per100gFoodId}`);
    await expect(page.locator("html")).toHaveAttribute("dir", "ltr");
    await expect(page.getByTestId("manual-diary-entry-form")).toBeVisible();
    await expect(page.locator('input[name="food_id"]')).toHaveValue(
      per100gFoodId,
    );
    const foodName = page.locator('input[name="food_name"]');
    await foodName.fill(snapshotName);
    await foodName.press("Enter");
    await expect(page.getByText("Entry added.")).toBeVisible();

    const saved = await userAClient
      .from("diary_entries")
      .select("entry_date,food_id,food_name,user_id")
      .eq("food_name", snapshotName)
      .single();
    expect(saved.data).toEqual({
      entry_date: "2033-04-10",
      food_id: per100gFoodId,
      food_name: snapshotName,
      user_id: userAId,
    });
    await context.close();
  });

  test("CJ-013 rejects an owned food archived after prefill without creating a diary row or receipt", async ({
    browser,
  }) => {
    const staleFoodId = await createCustomFood(
      userAClient,
      userAId,
      "Phase 11C2B stale linked source",
    );
    const submittedName = "Phase 11C2B stale linked submission";
    const context = await newAuthenticatedContext(browser);
    const page = await context.newPage();

    await page.goto(`/en/today?date=2033-04-11&foodId=${staleFoodId}`);
    await expect(page.locator('input[name="food_id"]')).toHaveValue(staleFoodId);
    const requestKey = await page
      .getByTestId("manual-diary-idempotency-key")
      .inputValue();

    const archived = await userAClient
      .from("foods")
      .update({ is_archived: true })
      .eq("id", staleFoodId);
    expect(archived.error).toBeNull();

    await page.locator('input[name="food_name"]').fill(submittedName);
    await page.getByRole("button", { name: "Add entry" }).click();

    await expect(page.getByTestId("manual-diary-entry-form")).toContainText(
      "We could not save or load diary entries right now.",
    );
    await expect(page.locator('input[name="food_name"]')).toHaveValue(
      submittedName,
    );
    await expect(page.locator('input[name="food_id"]')).toHaveValue(staleFoodId);
    expect(
      (
        await userAClient
          .from("diary_entries")
          .select("id", { count: "exact", head: true })
          .eq("food_name", submittedName)
      ).count,
    ).toBe(0);
    expect(
      (
        await userAClient
          .from("manual_diary_entry_requests")
          .select("id", { count: "exact", head: true })
          .eq("idempotency_key", requestKey)
      ).count,
    ).toBe(0);

    await context.close();
  });

  test("CJ-013 rejects database and expired-session submissions without a partial diary write", async ({
    browser,
  }) => {
    const failedFoodId = await createCustomFood(
      userAClient,
      userAId,
      "Phase 11C2B Failed Linked Food",
    );
    const expiredFoodId = await createCustomFood(
      userAClient,
      userAId,
      "Phase 11C2B Expired Linked Food",
    );
    const failedName = "Phase 11C2B failed linked submission";
    const expiredName = "Phase 11C2B expired linked submission";
    const selectedDate = "2033-04-11";
    const countsBefore = await Promise.all([
      userAClient
        .from("diary_entries")
        .select("id", { count: "exact", head: true }),
      userAClient
        .from("manual_diary_entry_requests")
        .select("id", { count: "exact", head: true }),
    ]);

    const failedContext = await newAuthenticatedContext(browser);
    const failedPage = await failedContext.newPage();
    await failedPage.goto(
      `/en/today?date=${selectedDate}&foodId=${failedFoodId}`,
    );
    await failedPage.locator('input[name="food_name"]').fill(failedName);
    queryLocalDatabase(`
      create or replace function public.phase_11c2b_fail_linked_diary_insert()
      returns trigger language plpgsql security invoker set search_path = '' as $$
      begin
        if new.food_name = '${failedName}' then
          raise integrity_constraint_violation using message = 'Phase 11C2B linked diary rollback probe.';
        end if;
        return new;
      end;
      $$;
      drop trigger if exists phase_11c2b_fail_linked_diary_insert on public.diary_entries;
      create trigger phase_11c2b_fail_linked_diary_insert
      before insert on public.diary_entries
      for each row execute function public.phase_11c2b_fail_linked_diary_insert();
    `);

    try {
      await failedPage.getByRole("button", { name: "Add entry" }).click();
      await expect(
        failedPage.getByTestId("manual-diary-entry-form"),
      ).toContainText("We could not save or load diary entries right now.");
      await expect(failedPage.locator('input[name="food_name"]')).toHaveValue(
        failedName,
      );
    } finally {
      queryLocalDatabase(`
        drop trigger if exists phase_11c2b_fail_linked_diary_insert on public.diary_entries;
        drop function if exists public.phase_11c2b_fail_linked_diary_insert();
      `);
      await failedContext.close();
    }

    const expiredContext = await newAuthenticatedContext(browser);
    const expiredPage = await expiredContext.newPage();
    await expiredPage.goto(
      `/he/today?date=${selectedDate}&foodId=${expiredFoodId}`,
    );
    await expect(expiredPage.locator("html")).toHaveAttribute("dir", "rtl");
    await expiredPage.locator('input[name="food_name"]').fill(expiredName);
    await expiredContext.clearCookies();
    await expiredPage.getByRole("button", { name: "הוספת רשומה" }).click();
    await expect(expiredPage.getByTestId("manual-diary-entry-form")).toContainText(
      "יש להיכנס שוב לפני שימוש ביומן.",
    );
    await expect(expiredPage.locator('input[name="food_name"]')).toHaveValue(
      expiredName,
    );
    await expiredContext.close();

    const rejectedRows = await userAClient
      .from("diary_entries")
      .select("food_name")
      .in("food_name", [failedName, expiredName]);
    const countsAfter = await Promise.all([
      userAClient
        .from("diary_entries")
        .select("id", { count: "exact", head: true }),
      userAClient
        .from("manual_diary_entry_requests")
        .select("id", { count: "exact", head: true }),
    ]);
    expect(rejectedRows.error).toBeNull();
    expect(rejectedRows.data).toEqual([]);
    expect(countsAfter.map(({ count }) => count)).toEqual(
      countsBefore.map(({ count }) => count),
    );
  });

  test("CJ-013 preserves the application-saved snapshot when the source changes or disappears", async ({
    browser,
  }) => {
    const snapshotFoodId = await createCustomFood(
      userAClient,
      userAId,
      "Phase 11C2B Snapshot Source",
    );
    queryLocalDatabase(`
      insert into public.food_nutrients (food_id, nutrient_id, amount, basis)
      values
        ('${snapshotFoodId}', (select id from public.nutrients where code = 'energy_kcal'), 120, 'per_serving'),
        ('${snapshotFoodId}', (select id from public.nutrients where code = 'protein_g'), 8, 'per_serving');
    `);

    const context = await newAuthenticatedContext(browser);
    const page = await context.newPage();
    const selectedDate = "2033-04-12";
    const snapshotName = "Phase 11C2B immutable linked snapshot";
    await page.goto(
      `/en/today?date=${selectedDate}&foodId=${snapshotFoodId}`,
    );
    await expect(page.locator('input[name="calories"]')).toHaveValue("120");
    await expect(page.locator('input[name="protein_g"]')).toHaveValue("8");
    await page.locator('input[name="food_name"]').fill(snapshotName);
    await page.locator('input[name="calories"]').fill("135");
    await page.locator('input[name="protein_g"]').fill("9.5");
    await page.locator('input[name="fat_g"]').fill("0");
    await page.getByRole("button", { name: "Add entry" }).click();
    await expect(page.getByText("Entry added.")).toBeVisible();

    const saved = await userAClient
      .from("diary_entries")
      .select("id,calories,fat_g,food_id,food_name,protein_g")
      .eq("food_name", snapshotName)
      .single();
    expect(saved.data).toMatchObject({
      calories: 135,
      fat_g: 0,
      food_id: snapshotFoodId,
      food_name: snapshotName,
      protein_g: 9.5,
    });

    queryLocalDatabase(`
      update public.foods
      set name = 'Phase 11C2B changed source name'
      where id = '${snapshotFoodId}';
      update public.food_nutrients
      set amount = 999
      where food_id = '${snapshotFoodId}';
    `);
    const afterSourceChange = await userAClient
      .from("diary_entries")
      .select("calories,fat_g,food_id,food_name,protein_g")
      .eq("id", saved.data?.id as string)
      .single();
    expect(afterSourceChange.data).toEqual({
      calories: 135,
      fat_g: 0,
      food_id: snapshotFoodId,
      food_name: snapshotName,
      protein_g: 9.5,
    });

    const deleted = await userAClient
      .from("foods")
      .delete()
      .eq("id", snapshotFoodId);
    expect(deleted.error).toBeNull();
    const afterSourceDeletion = await userAClient
      .from("diary_entries")
      .select("calories,fat_g,food_id,food_name,protein_g")
      .eq("id", saved.data?.id as string)
      .single();
    expect(afterSourceDeletion.data).toEqual({
      calories: 135,
      fat_g: 0,
      food_id: null,
      food_name: snapshotName,
      protein_g: 9.5,
    });
    await context.close();
  });

  test("enforces private-link RLS and preserves snapshots when a linked food is deleted", async () => {
    const tampered = await userAClient.from("diary_entries").insert({
      entry_date: "2026-07-14",
      food_id: otherFoodId,
      food_name: "Tampered private link",
      meal_type: "lunch",
      source: "manual",
      user_id: userAId,
    });
    expect(tampered.error).not.toBeNull();

    const linkedSnapshot = {
      brand_name: "Historical Brand",
      calories: 42,
      carbohydrates_g: 3,
      entry_date: "2026-07-14",
      fat_g: 4,
      food_id: deletableOwnFoodId,
      food_name: "Historical linked snapshot",
      meal_type: "dinner",
      notes: "Must survive food deletion",
      protein_g: 2,
      serving_quantity: 1,
      serving_unit: "serving",
      source: "manual",
      user_id: userAId,
    };
    const inserted = await userAClient
      .from("diary_entries")
      .insert(linkedSnapshot)
      .select("id")
      .single();
    expect(inserted.error).toBeNull();

    const deletedFood = await userAClient
      .from("foods")
      .delete()
      .eq("id", deletableOwnFoodId);
    expect(deletedFood.error).toBeNull();

    const preserved = await userAClient
      .from("diary_entries")
      .select("*")
      .eq("id", inserted.data?.id as string)
      .single();
    expect(preserved.error).toBeNull();
    expect(preserved.data).toMatchObject({
      ...linkedSnapshot,
      food_id: null,
    });
  });
});
