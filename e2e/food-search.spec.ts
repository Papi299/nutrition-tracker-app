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
const password = "FoodSearchPassword123!";
const supabaseProjectId = readFileSync("supabase/config.toml", "utf8").match(
  /^project_id\s*=\s*"([^"]+)"/m,
)?.[1];

if (!supabaseProjectId) {
  throw new Error("Could not read the local Supabase project id.");
}

const databaseContainer = `supabase_db_${supabaseProjectId}`;

test.skip(
  !localOnly || !localSupabaseUrl || !localSupabasePublishableKey,
  "Food-search tests require the local-only test runner.",
);

test.describe.serial("read-only food search helpers and UI", () => {
  let authenticatedState: Awaited<ReturnType<BrowserContext["storageState"]>>;
  let userAClient: SupabaseClient<Database>;
  let userBClient: SupabaseClient<Database>;
  let userAId: string;
  let userBId: string;
  const runId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const userAEmail = `search-a-${runId}@example.test`;
  const userBEmail = `search-b-${runId}@example.test`;
  const exactAppleId = randomUUID();
  const aliasFoodId = randomUUID();
  const hebrewFoodId = randomUUID();
  const mixedFoodId = randomUUID();
  const brandFoodId = randomUUID();
  const prefixFoodId = randomUUID();
  const typoFoodId = randomUUID();
  const archivedFoodId = randomUUID();
  let ownFoodId: string;
  let otherFoodId: string;

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

  async function newAuthenticatedContext(browser: Browser) {
    return browser.newContext({ storageState: authenticatedState });
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
      "My Private Apple Mix",
    );
    otherFoodId = await createCustomFood(
      userBClient,
      userBId,
      "Other Private Apple",
    );

    const ownAlias = await userAClient.from("food_aliases").insert({
      alias_text: "Personal Orchard",
      food_id: ownFoodId,
      language_code: "en",
    });
    expect(ownAlias.error).toBeNull();

    const otherAlias = await userBClient.from("food_aliases").insert({
      alias_text: "Secret Apple",
      food_id: otherFoodId,
      language_code: "en",
    });
    expect(otherAlias.error).toBeNull();

    const berryValues = Array.from({ length: 25 }, (_, index) => {
      const sequence = String(index + 1).padStart(2, "0");
      return `('${randomUUID()}', 'generic', 'Berry Test ${sequence}', 'en', true, false, 'curated', (select id from public.food_sources where code = 'manual'))`;
    }).join(",\n");

    queryLocalDatabase(`
      insert into public.foods (
        id, food_type, name, brand_name, locale, serving_size, serving_unit,
        data_quality, is_public, is_archived, source_id
      ) values
        ('${exactAppleId}', 'generic', 'Apple', null, 'en', 100, 'g', 'verified', true, false, (select id from public.food_sources where code = 'usda')),
        ('${aliasFoodId}', 'generic', 'Groundnut Butter', null, 'en', 2, 'tbsp', 'curated', true, false, (select id from public.food_sources where code = 'manual')),
        ('${hebrewFoodId}', 'generic', 'Sesame Paste', null, 'he', 1, 'tbsp', 'curated', true, false, (select id from public.food_sources where code = 'manual')),
        ('${mixedFoodId}', 'branded', 'Cottage Cheese', 'Tnuva', 'und', 100, 'g', 'verified', true, false, (select id from public.food_sources where code = 'foodsdictionary')),
        ('${brandFoodId}', 'branded', 'Whole Grain Cereal', 'Acme Foods', 'en', 30, 'g', 'imported', true, false, (select id from public.food_sources where code = 'foodsdictionary')),
        ('${prefixFoodId}', 'generic', 'Banana Bread', null, 'en', 1, 'slice', 'curated', true, false, (select id from public.food_sources where code = 'manual')),
        ('${typoFoodId}', 'generic', 'Yogurt', null, 'en', 150, 'g', 'verified', true, false, (select id from public.food_sources where code = 'usda')),
        ('${archivedFoodId}', 'generic', 'Archived Nectarine', null, 'en', 1, 'piece', 'curated', true, true, (select id from public.food_sources where code = 'manual'));

      insert into public.foods (
        id, food_type, name, locale, is_public, is_archived, data_quality, source_id
      ) values
        ${berryValues};

      insert into public.food_aliases (food_id, alias_text, language_code) values
        ('${aliasFoodId}', '  PEANUT   Butter  ', 'en'),
        ('${aliasFoodId}', 'Apple', 'und'),
        ('${aliasFoodId}', 'Shared Label', 'en'),
        ('${aliasFoodId}', ' shared   label ', 'und'),
        ('${hebrewFoodId}', '  טחינה   גולמית  ', 'he'),
        ('${mixedFoodId}', ' קוטג  5%   Tnuva ', 'und');
    `);
  });

  test("keeps the RPC authenticated-only, invoker-rights, and RLS-backed", async () => {
    const privilegeState = queryLocalDatabase(`
      select
        has_function_privilege('anon', 'public.search_readable_foods(text)', 'execute'),
        has_function_privilege('authenticated', 'public.search_readable_foods(text)', 'execute'),
        prosecdef
      from pg_proc
      where oid = 'public.search_readable_foods(text)'::regprocedure;
    `);
    expect(privilegeState).toBe("f|t|f");

  });

  test("normalizes and ranks canonical, English, Hebrew, and und matches", async () => {
    const apple = await userAClient.rpc("search_readable_foods", {
      p_query: "  APPLE  ",
    });
    expect(apple.error).toBeNull();
    expect(apple.data?.[0]).toMatchObject({
      data_quality: "verified",
      food_id: exactAppleId,
      food_type: "generic",
      is_owned: false,
      locale: "en",
      match_category: "canonical_exact",
      name: "Apple",
      serving_size: 100,
      serving_unit: "g",
      source_code: "usda",
      source_name: "USDA FoodData Central",
      source_trust_level: "verified",
      source_type: "imported",
    });
    expect(apple.data?.findIndex((food) => food.food_id === exactAppleId)).toBeLessThan(
      apple.data?.findIndex((food) => food.food_id === aliasFoodId) as number,
    );

    const englishAlias = await userAClient.rpc("search_readable_foods", {
      p_query: " PEANUT    BUTTER ",
    });
    expect(englishAlias.error).toBeNull();
    expect(englishAlias.data?.[0]).toMatchObject({
      food_id: aliasFoodId,
      match_category: "alias_exact",
      matched_alias: "  PEANUT   Butter  ",
    });

    const hebrewAlias = await userAClient.rpc("search_readable_foods", {
      p_query: "טחינה גולמית",
    });
    expect(hebrewAlias.data?.[0]).toMatchObject({
      food_id: hebrewFoodId,
      match_category: "alias_exact",
      matched_alias: "  טחינה   גולמית  ",
    });

    const mixedAlias = await userAClient.rpc("search_readable_foods", {
      p_query: "קוטג 5% tnuva",
    });
    expect(mixedAlias.data?.[0]).toMatchObject({
      food_id: mixedFoodId,
      match_category: "alias_exact",
      matched_alias: " קוטג  5%   Tnuva ",
    });
  });

  test("supports brand, prefix, substring, and conservative trigram matching", async () => {
    const brandExact = await userAClient.rpc("search_readable_foods", {
      p_query: "acme foods",
    });
    expect(brandExact.data?.[0]).toMatchObject({
      food_id: brandFoodId,
      match_category: "brand_exact",
    });

    const brandPrefix = await userAClient.rpc("search_readable_foods", {
      p_query: "acme",
    });
    expect(brandPrefix.data?.[0]).toMatchObject({
      food_id: brandFoodId,
      match_category: "brand_prefix",
    });

    const canonicalPrefix = await userAClient.rpc("search_readable_foods", {
      p_query: "bana",
    });
    expect(canonicalPrefix.data?.[0]).toMatchObject({
      food_id: prefixFoodId,
      match_category: "canonical_prefix",
    });

    const substring = await userAClient.rpc("search_readable_foods", {
      p_query: "grain cereal",
    });
    expect(substring.data?.[0]).toMatchObject({
      food_id: brandFoodId,
      match_category: "canonical_substring",
    });

    const typo = await userAClient.rpc("search_readable_foods", {
      p_query: "yogrt",
    });
    expect(typo.data?.[0]).toMatchObject({
      food_id: typoFoodId,
      match_category: "canonical_fuzzy",
    });
  });

  test("deduplicates foods, caps results, excludes archived and other-user rows", async () => {
    const duplicateAliases = await userAClient.rpc("search_readable_foods", {
      p_query: "shared label",
    });
    expect(
      duplicateAliases.data?.filter((food) => food.food_id === aliasFoodId),
    ).toHaveLength(1);

    const apples = await userAClient.rpc("search_readable_foods", {
      p_query: "apple",
    });
    expect(apples.data?.some((food) => food.food_id === exactAppleId)).toBe(true);
    expect(apples.data?.some((food) => food.food_id === ownFoodId)).toBe(true);
    expect(apples.data?.some((food) => food.food_id === otherFoodId)).toBe(false);
    expect(
      apples.data?.some((food) => food.name === "Other Private Apple"),
    ).toBe(false);

    const secret = await userAClient.rpc("search_readable_foods", {
      p_query: "secret apple",
    });
    expect(secret.data?.some((food) => food.food_id === otherFoodId)).toBe(false);
    expect(secret.data?.some((food) => food.matched_alias === "Secret Apple")).toBe(
      false,
    );

    const archived = await userAClient.rpc("search_readable_foods", {
      p_query: "archived nectarine",
    });
    expect(archived.data?.some((food) => food.food_id === archivedFoodId)).toBe(
      false,
    );

    const capped = await userAClient.rpc("search_readable_foods", {
      p_query: "berry",
    });
    expect(capped.error).toBeNull();
    expect(capped.data).toHaveLength(20);
    expect(capped.data?.map((food) => food.name)).toEqual(
      Array.from({ length: 20 }, (_, index) =>
        `Berry Test ${String(index + 1).padStart(2, "0")}`,
      ),
    );
  });

  test("renders stable English UI states, metadata, navigation, and preserved queries", async ({
    browser,
  }) => {
    const context = await newAuthenticatedContext(browser);
    const page = await context.newPage();

    await page.goto("/en/foods");
    await expect(page.locator("html")).toHaveAttribute("dir", "ltr");
    await expect(page.getByTestId("food-search-initial")).toBeVisible();
    await expect(page.getByRole("link", { name: "Food search" })).toHaveAttribute(
      "href",
      "/en/foods",
    );

    await page.goto("/en/foods?q=a");
    await expect(page.getByTestId("food-search-too-short")).toBeVisible();
    await expect(page.getByLabel("Food name, alias, or brand")).toHaveValue("a");

    const longQuery = "x".repeat(101);
    await page.goto(`/en/foods?q=${longQuery}`);
    await expect(page.getByTestId("food-search-invalid")).toContainText(
      "100 characters or fewer",
    );
    await expect(page.getByLabel("Food name, alias, or brand")).toHaveValue(
      longQuery,
    );

    await page.goto("/en/foods?q=apple&q=banana");
    await expect(page.getByTestId("food-search-invalid")).toContainText(
      "Only one search query",
    );

    await page.goto("/en/foods?q=no-such-catalog-food");
    await expect(page.getByTestId("food-search-empty")).toBeVisible();

    await page.goto("/en/foods?q=peanut%20butter");
    await expect(page).toHaveURL(/\/en\/foods\?q=peanut%20butter$/);
    await expect(page.getByLabel("Food name, alias, or brand")).toHaveValue(
      "peanut butter",
    );
    const result = page.locator(`[data-food-id="${aliasFoodId}"]`);
    await expect(result).toContainText("Groundnut Butter");
    await expect(result).toContainText("PEANUT   Butter");
    await expect(result).toContainText("Generic food");
    await expect(result).toContainText("Curated");
    await expect(result).toContainText("Manual entry");
    await expect(
      result.getByRole("button", {
        name: "Add Groundnut Butter to favorites",
      }),
    ).toBeVisible();
    await expect(
      result.locator(
        'input[name="food_id"], input[name="foodId"], input[name="is_favorite"], input[name="user_id"], input[name="owner_id"]',
      ),
    ).toHaveCount(0);

    await context.close();
  });

  test("renders Hebrew RTL search and mixed-script metadata", async ({ browser }) => {
    const context = await newAuthenticatedContext(browser);
    const page = await context.newPage();

    await page.goto("/he/foods?q=%D7%A7%D7%95%D7%98%D7%92%205%25%20tnuva");
    await expect(page.locator("html")).toHaveAttribute("lang", "he");
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    await expect(page.getByRole("heading", { name: "Cottage Cheese" })).toBeVisible();
    await expect(page.locator(`[data-food-id="${mixedFoodId}"]`)).toContainText(
      "קוטג  5%   Tnuva",
    );
    await expect(page.getByRole("link", { name: "חיפוש מזון" })).toHaveAttribute(
      "href",
      "/he/foods",
    );

    await context.close();
  });

  test("shows a generic retrieval failure without leaking database details", async ({
    browser,
  }) => {
    const context = await newAuthenticatedContext(browser);
    const page = await context.newPage();

    queryLocalDatabase("revoke select on table public.foods from authenticated;");

    try {
      await page.goto("/en/foods?q=apple");
      await expect(page.getByTestId("food-search-error")).toContainText(
        "Food search could not be loaded",
      );
      await expect(page.getByTestId("food-search-error")).not.toContainText(
        "permission denied",
      );
    } finally {
      queryLocalDatabase("grant select on table public.foods to authenticated;");
      await context.close();
    }
  });

  test("redirects an expired session to localized sign-in", async ({ browser }) => {
    const context = await newAuthenticatedContext(browser);
    await context.clearCookies();
    const page = await context.newPage();

    await page.goto("/he/foods?q=apple");
    await expect(page).toHaveURL(/\/he\/auth\/sign-in$/);
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    await context.close();
  });
});
