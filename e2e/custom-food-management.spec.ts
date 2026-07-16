import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  expect,
  test,
  type Browser,
  type BrowserContext,
  type Page,
} from "@playwright/test";
import type { Database, Json } from "@/lib/supabase/database.types";

const localSupabaseUrl = process.env.LOCAL_SUPABASE_URL;
const localSupabasePublishableKey = process.env.LOCAL_SUPABASE_PUBLISHABLE_KEY;
const localOnly = process.env.DATE_E2E_LOCAL_SUPABASE === "1";
const password = "CustomFoodManagementPassword123!";
const supabaseProjectId = readFileSync("supabase/config.toml", "utf8").match(
  /^project_id\s*=\s*"([^"]+)"/m,
)?.[1];

if (!supabaseProjectId) {
  throw new Error("Could not read the local Supabase project id.");
}

const databaseContainer = `supabase_db_${supabaseProjectId}`;

test.skip(
  !localOnly || !localSupabaseUrl || !localSupabasePublishableKey,
  "Custom-food management tests require the local-only test runner.",
);

test.describe.serial("custom-food management and archive lifecycle", () => {
  let authenticatedState: Awaited<ReturnType<BrowserContext["storageState"]>>;
  let userAClient: SupabaseClient<Database>;
  let userBClient: SupabaseClient<Database>;
  let userAId: string;
  let managedFoodId: string;
  let otherFoodId: string;
  let lifecycleFingerprint: string;
  const extraFoodIds: string[] = [];
  const publicFoodId = randomUUID();
  const runId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const userAEmail = `management-a-${runId}@example.test`;
  const userBEmail = `management-b-${runId}@example.test`;

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
    return browser.newContext({ ...options, storageState: authenticatedState });
  }

  async function persistFixture(
    client: SupabaseClient<Database>,
    overrides: Partial<
      Database["public"]["Functions"]["persist_custom_food"]["Args"]
    >,
  ) {
    const result = await client.rpc("persist_custom_food", {
      p_aliases: [] as Json,
      p_brand_name: null as unknown as string,
      p_food_id: null as unknown as string,
      p_locale: "en",
      p_name: "Phase 7C Fixture",
      p_nutrient_basis: "per_serving",
      p_nutrients: [] as Json,
      p_serving_quantity: 1,
      p_serving_unit: "serving",
      ...overrides,
    });

    expect(result.error).toBeNull();
    return result.data?.[0].food_id as string;
  }

  function foodIdFromUrl(page: Page) {
    const match = page.url().match(/\/foods\/custom\/([0-9a-f-]+)\/edit/);
    expect(match).not.toBeNull();
    return match?.[1] as string;
  }

  function fingerprint(foodId: string) {
    return queryLocalDatabase(`
      select jsonb_build_object(
        'basis', foods.custom_nutrient_basis,
        'name', foods.name,
        'brand', foods.brand_name,
        'locale', foods.locale,
        'serving_size', foods.serving_size,
        'serving_unit', foods.serving_unit,
        'nutrients', (
          select coalesce(
            jsonb_agg(
              jsonb_build_object('code', nutrients.code, 'amount', food_nutrients.amount, 'basis', food_nutrients.basis)
              order by nutrients.code
            ),
            '[]'::jsonb
          )
          from public.food_nutrients
          join public.nutrients on nutrients.id = food_nutrients.nutrient_id
          where food_nutrients.food_id = foods.id
        ),
        'aliases', (
          select coalesce(
            jsonb_agg(
              jsonb_build_object('text', food_aliases.alias_text, 'language', food_aliases.language_code)
              order by food_aliases.id
            ),
            '[]'::jsonb
          )
          from public.food_aliases
          where food_aliases.food_id = foods.id
        )
      )
      from public.foods
      where foods.id = '${foodId}';
    `);
  }

  async function assertDiarySnapshotUnchanged() {
    const diary = await userAClient
      .from("diary_entries")
      .select("food_id,food_name,brand_name,calories,protein_g,serving_quantity,serving_unit")
      .eq("food_id", managedFoodId)
      .single();

    expect(diary.error).toBeNull();
    expect(diary.data).toEqual({
      brand_name: "Historical Brand",
      calories: 999,
      food_id: managedFoodId,
      food_name: "Historical management snapshot",
      protein_g: 88,
      serving_quantity: 7,
      serving_unit: "historic portions",
    });
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
  });

  test.afterAll(() => {
    queryLocalDatabase(`
      delete from public.foods where id = '${publicFoodId}';
      delete from auth.users where email in ('${userAEmail}', '${userBEmail}');
    `);
  });

  test("renders localized active and archived empty states with navigation and mobile layout", async ({
    browser,
  }) => {
    const context = await newAuthenticatedContext(browser, {
      viewport: { height: 844, width: 390 },
    });
    const page = await context.newPage();

    await page.goto("/en/foods/custom");
    await expect(page.locator("html")).toHaveAttribute("dir", "ltr");
    await expect(page.getByTestId("custom-food-management-empty-active")).toBeVisible();
    await expect(page.getByRole("link", { name: "My foods" }).last()).toHaveAttribute(
      "href",
      "/en/foods/custom",
    );
    await expect(page.getByRole("link", { name: "Create your first custom food" })).toHaveAttribute(
      "href",
      "/en/foods/custom/new",
    );
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
      ),
    ).toBe(true);

    await page.goto("/en/foods/custom?status=archived&page=1");
    await expect(page.getByTestId("custom-food-management-empty-archived")).toBeVisible();

    await page.goto("/he/foods/custom");
    await expect(page.locator("html")).toHaveAttribute("lang", "he");
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    await expect(page.getByTestId("custom-food-management-empty-active")).toBeVisible();
    await context.close();
  });

  test("creates a food through the editor and prepares isolated pagination fixtures", async ({
    browser,
  }) => {
    const context = await newAuthenticatedContext(browser);
    const page = await context.newPage();

    await page.goto("/en/foods/custom/new");
    await page.getByLabel("Name").fill("Phase 7C Lifecycle Food");
    await page.getByLabel("Brand (optional)").fill("Lifecycle Brand");
    await page.getByLabel("Food language").selectOption("und");
    await page.getByLabel("Per 100 g", { exact: true }).check();
    await page.locator('[data-nutrient-code="energy_kcal"]').fill("123");
    await page.locator('[data-nutrient-code="protein_g"]').fill("0");
    await page.getByText("Vitamins and related nutrients", { exact: true }).click();
    await page.locator('[data-nutrient-code="vitamin_c_mg"]').fill("4.5");
    await page.getByRole("button", { name: "Add alias" }).click();
    const alias = page.getByTestId("custom-food-alias-row");
    await alias.getByLabel("Alias text").fill("  Lifecycle   alias  ");
    await alias.getByLabel("Alias language").selectOption("en");
    await page.getByRole("button", { name: "Create custom food" }).click();
    await expect(page).toHaveURL(/\/en\/foods\/custom\/[0-9a-f-]+\/edit\?saved=created$/);
    managedFoodId = foodIdFromUrl(page);
    await expect(page.getByRole("link", { name: "Back to my foods" })).toHaveAttribute(
      "href",
      "/en/foods/custom?status=active&page=1",
    );
    await page.getByRole("link", { name: "Back to my foods" }).click();
    await expect(page.locator(`[data-food-id="${managedFoodId}"]`)).toContainText(
      "Phase 7C Lifecycle Food",
    );

    const diary = await userAClient.from("diary_entries").insert({
      brand_name: "Historical Brand",
      calories: 999,
      entry_date: "2026-07-16",
      food_id: managedFoodId,
      food_name: "Historical management snapshot",
      meal_type: "dinner",
      protein_g: 88,
      serving_quantity: 7,
      serving_unit: "historic portions",
      user_id: userAId,
    });
    expect(diary.error).toBeNull();

    for (let index = 1; index <= 21; index += 1) {
      extraFoodIds.push(
        await persistFixture(userAClient, {
          p_name: `Phase 7C Page Food ${String(index).padStart(2, "0")}`,
        }),
      );
    }

    otherFoodId = await persistFixture(userBClient, {
      p_name: "Phase 7C Other User Food",
    });

    queryLocalDatabase(`
      insert into public.foods (
        id, food_type, name, locale, data_quality, is_public, is_archived, source_id
      ) values (
        '${publicFoodId}', 'generic', 'Phase 7C Public Food', 'en', 'curated', true, false,
        (select id from public.food_sources where code = 'manual')
      );
      set session_replication_role = replica;
      update public.foods
      set updated_at = '2026-07-16 12:00:00+00'
      where id = '${managedFoodId}';
      update public.foods
      set updated_at = '2026-07-15 12:00:00+00'
      where id in (${extraFoodIds.map((id) => `'${id}'`).join(",")});
      set session_replication_role = origin;
    `);

    lifecycleFingerprint = fingerprint(managedFoodId);
    await assertDiarySnapshotUnchanged();
    await context.close();
  });

  test("filters owned foods with deterministic twenty-item pagination and edit discovery", async ({
    browser,
  }) => {
    const context = await newAuthenticatedContext(browser);
    const page = await context.newPage();
    const expectedIds = [managedFoodId, ...extraFoodIds.sort()].slice(0, 20);

    await page.goto("/en/foods/custom?status=active&page=1");
    const cards = page.locator("[data-food-id]");
    await expect(cards).toHaveCount(20);
    expect(await cards.evaluateAll((items) => items.map((item) => item.getAttribute("data-food-id")))).toEqual(
      expectedIds,
    );
    await expect(page.getByRole("link", { name: "Next" })).toHaveAttribute(
      "href",
      "/en/foods/custom?status=active&page=2",
    );
    await expect(page.locator(`[data-food-id="${otherFoodId}"]`)).toHaveCount(0);
    await expect(page.locator(`[data-food-id="${publicFoodId}"]`)).toHaveCount(0);

    const managedCard = page.locator(`[data-food-id="${managedFoodId}"]`);
    await expect(managedCard).toContainText("Lifecycle Brand");
    await expect(managedCard).toContainText("Mixed or language-neutral");
    await expect(managedCard).toContainText("Per 100 g");
    await expect(managedCard).toContainText("100 g");
    await expect(managedCard.getByRole("link", { name: "Edit" })).toHaveAttribute(
      "href",
      `/en/foods/custom/${managedFoodId}/edit`,
    );
    await expect(managedCard.locator('input[name="food_id"]')).toHaveCount(0);
    await expect(managedCard.locator('input[name="is_archived"]')).toHaveCount(0);
    await managedCard.getByRole("link", { name: "Edit" }).click();
    await expect(page.getByLabel("Name")).toHaveValue("Phase 7C Lifecycle Food");

    await page.goto("/en/foods?q=phase%207c%20lifecycle%20food");
    await expect(page.getByRole("link", { name: "My foods" }).last()).toHaveAttribute(
      "href",
      "/en/foods/custom",
    );

    await page.goto("/en/foods/custom?status=active&page=2");
    await expect(page.locator("[data-food-id]")).toHaveCount(2);
    await expect(page.getByRole("link", { name: "Previous" })).toHaveAttribute(
      "href",
      "/en/foods/custom?status=active&page=1",
    );
    await expect(page.getByRole("link", { name: "Next" })).toHaveCount(0);
    await context.close();
  });

  test("rejects invalid and repeated queries without a list read and handles retrieval and session failures", async ({
    browser,
  }) => {
    const context = await newAuthenticatedContext(browser);
    const page = await context.newPage();

    queryLocalDatabase("revoke select on table public.foods from authenticated;");
    try {
      for (const path of [
        "/en/foods/custom?page=0",
        "/en/foods/custom?page=-1",
        "/en/foods/custom?page=bad",
        "/en/foods/custom?page=1&page=2",
        "/en/foods/custom?status=all",
        "/en/foods/custom?status=active&status=archived",
      ]) {
        await page.goto(path);
        await expect(page.getByTestId("custom-food-management-invalid-query")).toBeVisible();
        await expect(page.getByText("No custom-food list query was run.")).toBeVisible();
      }

      await page.goto("/en/foods/custom?status=active&page=1");
      await expect(page.getByTestId("custom-food-management-retrieval-error")).toBeVisible();
      await expect(page.getByTestId("custom-food-management-retrieval-error")).not.toContainText(
        "permission denied",
      );
    } finally {
      queryLocalDatabase("grant select on table public.foods to authenticated;");
    }

    await context.clearCookies();
    await page.goto("/he/foods/custom");
    await expect(page).toHaveURL(/\/he\/auth\/sign-in$/);
    await context.close();
  });

  test("confirms and archives an owned food while preserving data, linkage, and edit access", async ({
    browser,
  }) => {
    const context = await newAuthenticatedContext(browser);
    const page = await context.newPage();
    await page.goto("/en/foods/custom?status=active&page=1");
    const card = page.locator(`[data-food-id="${managedFoodId}"]`);

    await card.getByRole("button", { name: "Archive" }).click();
    const confirmation = card.getByTestId("custom-food-archive-confirmation");
    await expect(confirmation).toContainText("existing diary history remains unchanged");
    await expect(confirmation.getByRole("button", { name: "Confirm archive" })).toBeVisible();
    await confirmation.getByRole("button", { name: "Cancel" }).click();
    await expect(confirmation).toHaveCount(0);
    expect(queryLocalDatabase(`select is_archived from public.foods where id = '${managedFoodId}';`)).toBe(
      "f",
    );

    await card.getByRole("button", { name: "Archive" }).click();
    const confirmButton = card.getByRole("button", { name: "Confirm archive" });
    await confirmButton.click();
    await expect(page).toHaveURL(/\/en\/foods\/custom\?status=archived&saved=archived$/);
    await expect(page.getByTestId("custom-food-management-success")).toContainText(
      "archived successfully",
    );
    await expect(page.locator(`[data-food-id="${managedFoodId}"]`)).toBeVisible();

    const repeatedArchive = await userAClient.rpc("set_custom_food_archived", {
      p_food_id: managedFoodId,
      p_is_archived: true,
    });
    expect(repeatedArchive.error).toBeNull();
    expect(repeatedArchive.data?.[0].is_archived).toBe(true);
    expect(fingerprint(managedFoodId)).toBe(lifecycleFingerprint);
    await assertDiarySnapshotUnchanged();

    const search = await userAClient.rpc("search_readable_foods", {
      p_query: "Phase 7C Lifecycle Food",
    });
    const prefill = await userAClient.rpc("get_readable_food_diary_prefill", {
      p_food_id: managedFoodId,
    });
    expect(search.data?.some((food) => food.food_id === managedFoodId)).toBe(false);
    expect(prefill.data).toEqual([]);

    const archivedCard = page.locator(`[data-food-id="${managedFoodId}"]`);
    await archivedCard.getByRole("link", { name: "Edit" }).click();
    await expect(page.getByTestId("custom-food-archived-notice")).toBeVisible();
    await expect(page.getByRole("link", { name: "Back to my foods" })).toHaveAttribute(
      "href",
      "/en/foods/custom?status=archived&page=1",
    );

    await page.goto("/he/foods/custom?status=archived&page=1");
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    await expect(page.locator(`[data-food-id="${managedFoodId}"]`)).toBeVisible();
    await context.close();
  });

  test("keeps cross-user and public foods invisible and immutable through the lifecycle contract", async ({
    browser,
  }) => {
    const context = await newAuthenticatedContext(browser);
    const page = await context.newPage();
    await page.goto("/en/foods/custom?status=active&page=1");
    await expect(page.locator(`[data-food-id="${otherFoodId}"]`)).toHaveCount(0);
    await expect(page.locator(`[data-food-id="${publicFoodId}"]`)).toHaveCount(0);

    for (const foodId of [otherFoodId, publicFoodId]) {
      const attempt = await userAClient.rpc("set_custom_food_archived", {
        p_food_id: foodId,
        p_is_archived: true,
      });
      expect(attempt.error).toBeNull();
      expect(attempt.data).toEqual([{ food_id: null, is_archived: null }]);
    }

    expect(queryLocalDatabase(`select is_archived from public.foods where id = '${otherFoodId}';`)).toBe(
      "f",
    );
    expect(queryLocalDatabase(`select is_archived from public.foods where id = '${publicFoodId}';`)).toBe(
      "f",
    );
    await context.close();
  });

  test("restores the food to active search and prefill without changing stored data or diary history", async ({
    browser,
  }) => {
    const context = await newAuthenticatedContext(browser);
    const page = await context.newPage();
    await page.goto("/en/foods/custom?status=archived&page=1");
    const card = page.locator(`[data-food-id="${managedFoodId}"]`);
    await card.getByRole("button", { name: "Restore" }).click();

    await expect(page).toHaveURL(/\/en\/foods\/custom\?status=active&saved=restored$/);
    await expect(page.getByTestId("custom-food-management-success")).toContainText(
      "restored successfully",
    );
    await expect(page.locator(`[data-food-id="${managedFoodId}"]`)).toBeVisible();

    const repeatedRestore = await userAClient.rpc("set_custom_food_archived", {
      p_food_id: managedFoodId,
      p_is_archived: false,
    });
    expect(repeatedRestore.error).toBeNull();
    expect(repeatedRestore.data?.[0].is_archived).toBe(false);
    expect(fingerprint(managedFoodId)).toBe(lifecycleFingerprint);
    await assertDiarySnapshotUnchanged();

    const search = await userAClient.rpc("search_readable_foods", {
      p_query: "Phase 7C Lifecycle Food",
    });
    const prefill = await userAClient.rpc("get_readable_food_diary_prefill", {
      p_food_id: managedFoodId,
    });
    expect(search.data?.some((food) => food.food_id === managedFoodId)).toBe(true);
    expect(prefill.data?.[0]).toMatchObject({
      calories: 123,
      food_id: managedFoodId,
      nutrient_basis: "per_100g",
      protein_g: 0,
    });

    await page.goto("/en/foods/custom?status=archived&page=1");
    await expect(page.getByTestId("custom-food-management-empty-archived")).toBeVisible();
    await context.close();
  });
});
