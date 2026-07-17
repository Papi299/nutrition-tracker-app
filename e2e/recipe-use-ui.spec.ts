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
const password = "RecipeUseUiPassword123!";
const projectId = readFileSync("supabase/config.toml", "utf8").match(
  /^project_id\s*=\s*"([^"]+)"/m,
)?.[1];

if (!projectId) throw new Error("Could not read the local Supabase project id.");
const databaseContainer = `supabase_db_${projectId}`;

test.skip(
  !localOnly || !localSupabaseUrl || !localSupabasePublishableKey,
  "Recipe use UI tests require the local-only test runner.",
);

type PersistRecipeArgs = Database["public"]["Functions"]["persist_recipe"]["Args"];

test.describe.serial("localized recipe nutrition display and reviewed preview", () => {
  let authenticatedState: Awaited<ReturnType<BrowserContext["storageState"]>>;
  let userAClient: SupabaseClient<Database>;
  let userAId: string;
  let activeRecipeId: string;
  let archivedRecipeId: string;
  let invalidRecipeId: string;
  let overflowRecipeId: string;
  let otherRecipeId: string;
  const publicFoodId = randomUUID();
  const runId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const userAEmail = `recipe-use-ui-a-${runId}@example.test`;
  const userBEmail = `recipe-use-ui-b-${runId}@example.test`;

  function localClient() {
    return createClient<Database>(
      localSupabaseUrl as string,
      localSupabasePublishableKey as string,
      { auth: { autoRefreshToken: false, persistSession: false } },
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

  async function newAuthenticatedContext(
    browser: Browser,
    options: Parameters<Browser["newContext"]>[0] = {},
  ) {
    return browser.newContext({ ...options, storageState: authenticatedState });
  }

  function ingredient(position: number, overrides: Record<string, Json> = {}) {
    return {
      brand_name: null,
      calories: 0,
      carbohydrates_g: 0,
      fat_g: 0,
      food_id: null,
      ingredient_name: `Preview ingredient ${position}`,
      notes: null,
      position,
      protein_g: 0,
      quantity: 1,
      unit: "portion",
      ...overrides,
    };
  }

  async function persistRecipe(
    client: SupabaseClient<Database>,
    name: string,
    yieldServings: number,
    ingredients: Json,
  ) {
    const result = await client.rpc("persist_recipe", {
      p_ingredients: ingredients,
      p_locale: "en",
      p_name: name,
      p_recipe_id: null as unknown as string,
      p_yield_servings: yieldServings,
    } as PersistRecipeArgs);
    expect(result.error).toBeNull();
    return result.data?.[0].recipe_id as string;
  }

  function previewUrl(
    recipeId: string,
    values = "date=2024-02-29&mealType=lunch&servings=1.25",
    locale = "en",
  ) {
    return `/${locale}/recipes/${recipeId}/use?${values}`;
  }

  async function contractValue(
    page: Page,
    perspective: string,
    nutrient: string,
  ) {
    return page
      .getByTestId(`recipe-use-${perspective}`)
      .getByText(nutrient, { exact: true })
      .locator("xpath=following-sibling::dd//*[@data-contract-value]")
      .getAttribute("data-contract-value");
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

    const userBClient = localClient();
    const userBSignUp = await userBClient.auth.signUp({
      email: userBEmail,
      password,
    });
    expect(userBSignUp.error).toBeNull();

    queryLocalDatabase(`
      insert into public.foods (
        id, food_type, name, locale, data_quality, is_public, is_archived, source_id
      ) values (
        '${publicFoodId}', 'generic', 'Preview linked food', 'en', 'curated',
        true, false, (select id from public.food_sources where code = 'manual')
      );
    `);

    activeRecipeId = await persistRecipe(userAClient, "Preview מרק", 2.5, [
      ingredient(1, {
        calories: 1,
        carbohydrates_g: null,
        fat_g: 0,
        food_id: publicFoodId,
        protein_g: 0.1,
        quantity: 100,
        unit: "g",
      }),
      ingredient(2, {
        calories: 2,
        carbohydrates_g: 5,
        fat_g: 1,
        protein_g: 0.2,
      }),
    ] as Json);
    overflowRecipeId = await persistRecipe(userAClient, "Overflow preview", 1, [
      ingredient(1, { calories: 2_147_483_647 }),
    ] as Json);
    archivedRecipeId = await persistRecipe(userAClient, "Archived preview", 1, [
      ingredient(1, { calories: 10 }),
    ] as Json);
    expect(
      (
        await userAClient.rpc("set_recipe_archived", {
          p_is_archived: true,
          p_recipe_id: archivedRecipeId,
        })
      ).error,
    ).toBeNull();
    invalidRecipeId = await persistRecipe(userAClient, "Integrity preview", 1, [
      ingredient(1, { calories: 10 }),
    ] as Json);
    otherRecipeId = await persistRecipe(userBClient, "Other preview", 1, [
      ingredient(1, { calories: 10 }),
    ] as Json);
  });

  test.afterAll(() => {
    queryLocalDatabase(`
      delete from auth.users where email in ('${userAEmail}', '${userBEmail}');
      delete from public.foods where id = '${publicFoodId}';
    `);
  });

  test("canonicalizes browser-local date, default servings, and normalized URLs", async ({
    browser,
  }) => {
    const context = await newAuthenticatedContext(browser, {
      timezoneId: "Pacific/Kiritimati",
      viewport: { height: 844, width: 390 },
    });
    const page = await context.newPage();
    await page.goto(`/en/recipes/${activeRecipeId}/use?mealType=lunch`);
    const browserDate = await page.evaluate(() => {
      const now = new Date();
      return `${String(now.getFullYear()).padStart(4, "0")}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
    });
    await expect(page).toHaveURL(
      `/en/recipes/${activeRecipeId}/use?date=${browserDate}&mealType=lunch&servings=1`,
    );
    await expect(page.getByTestId("recipe-review-ready")).toBeVisible();

    await page.goto(`/en/recipes/${activeRecipeId}/use`);
    await expect(page).toHaveURL(
      `/en/recipes/${activeRecipeId}/use?date=${browserDate}&servings=1`,
    );
    await expect(page.getByTestId("recipe-review-incomplete")).toBeVisible();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);

    await page.goto(
      previewUrl(activeRecipeId, "date=9999-12-31&mealType=dinner&servings=01.500"),
    );
    await expect(page).toHaveURL(previewUrl(activeRecipeId, "date=9999-12-31&mealType=dinner&servings=1.5"));
    await expect(page.getByLabel("Date")).toHaveValue("9999-12-31");
    await expect(page.getByLabel("Meal type")).toHaveValue("dinner");
    await expect(
      page.getByRole("textbox", { exact: true, name: "Requested servings" }),
    ).toHaveValue("1.5");

    await page.goto(previewUrl(activeRecipeId, "date=2024-02-29&mealType=snack&servings=0.001", "he"));
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    await expect(page.getByLabel("תאריך")).toHaveValue("2024-02-29");
    await expect(page.getByLabel("סוג ארוחה")).toHaveValue("snack");
    await expect(page.getByTestId("recipe-review-ready")).toBeVisible();
    expect(await contractValue(page, "diary_value", "שומן")).toBe("0");
    await context.close();

    const noScriptContext = await newAuthenticatedContext(browser, {
      javaScriptEnabled: false,
    });
    const noScriptPage = await noScriptContext.newPage();
    await noScriptPage.goto(
      `/en/recipes/${activeRecipeId}/use?mealType=other&servings=1.5`,
    );
    await noScriptPage
      .getByRole("textbox", { exact: true, name: "Calendar date" })
      .fill("2024-02-29");
    await noScriptPage.getByRole("button", { name: "Continue" }).click();
    await expect(noScriptPage).toHaveURL(
      previewUrl(activeRecipeId, "date=2024-02-29&mealType=other&servings=1.5"),
    );
    await noScriptContext.close();
  });

  test("rejects invalid route and query input before derivation", async ({ browser }) => {
    const context = await newAuthenticatedContext(browser);
    const page = await context.newPage();
    queryLocalDatabase(`
      revoke execute on function public.get_owned_recipe_use_contract(uuid, numeric)
      from authenticated;
    `);
    try {
      await page.goto("/en/recipes/not-a-uuid/use?date=2024-02-29&servings=1");
      await expect(page.getByTestId("recipe-use-invalid_link")).toContainText(
        "No recipe or nutrition lookup was run",
      );

      const invalidQueries = [
        "date=2026-02-29&servings=1",
        "date=2024-02-29&date=2024-03-01&servings=1",
        "date=2024-02-29&mealType=brunch&servings=1",
        "date=2024-02-29&mealType=lunch&mealType=dinner&servings=1",
        "date=2024-02-29&servings=1e2",
        "date=2024-02-29&servings=1.0001",
        "date=2024-02-29&servings=1&unknown=value",
      ];
      for (const query of invalidQueries) {
        await page.goto(previewUrl(activeRecipeId, query));
        await expect(page.getByTestId("recipe-use-query-error")).toBeVisible();
      }

    } finally {
      queryLocalDatabase(`
        grant execute on function public.get_owned_recipe_use_contract(uuid, numeric)
        to authenticated;
      `);
    }
    await context.close();
  });

  test("displays every database perspective, independent completeness, and review context without writes", async ({
    browser,
  }) => {
    const context = await newAuthenticatedContext(browser);
    const page = await context.newPage();
    const before = queryLocalDatabase(`
      select concat_ws('|',
        (select count(*) from public.diary_entries where user_id = '${userAId}'),
        (select count(*) from public.saved_meal_diary_runs where user_id = '${userAId}'),
        (select updated_at from public.recipes where id = '${activeRecipeId}'),
        to_regclass('public.recipe_use_receipts') is null,
        not exists (
          select 1 from information_schema.columns
          where table_schema = 'public' and table_name = 'diary_entries'
            and column_name = 'recipe_id'
        )
      );
    `);
    await page.goto(previewUrl(activeRecipeId));

    await expect(
      page.getByRole("heading", { exact: true, name: "Preview מרק" }),
    ).toBeVisible();
    await expect(page.getByTestId("recipe-use-identity")).toContainText("2.5");
    await expect(page.getByTestId("recipe-use-identity")).toContainText("2");
    expect(await contractValue(page, "whole_recipe_value", "Calories")).toBe("3");
    expect(await contractValue(page, "per_serving_value", "Calories")).toBe("1.2");
    expect(await contractValue(page, "requested_value", "Calories")).toBe("1.5");
    expect(await contractValue(page, "diary_value", "Calories")).toBe("2");
    expect(await contractValue(page, "whole_recipe_value", "Protein")).toBe("0.3");
    expect(await contractValue(page, "requested_value", "Protein")).toBe("0.15");
    expect(await contractValue(page, "whole_recipe_value", "Fat")).toBe("1");
    expect(await contractValue(page, "whole_recipe_value", "Carbohydrates")).toBe("unknown");
    await expect(page.getByText("Known for 1 of 2 ingredients", { exact: true })).toBeVisible();
    await expect(page.getByText("No partial total is shown", { exact: false })).toBeVisible();
    await expect(page.getByTestId("recipe-review-ready")).toContainText(
      "No diary entry has been created",
    );
    await expect(page.getByText("Current linked-food", { exact: false })).toBeVisible();

    await page
      .getByRole("textbox", { exact: true, name: "Requested servings" })
      .fill("3");
    await page.getByRole("button", { name: "Calculate and review" }).click();
    await expect(page).toHaveURL(previewUrl(activeRecipeId, "date=2024-02-29&mealType=lunch&servings=3"));
    expect(
      queryLocalDatabase(`
        select concat_ws('|',
          (select count(*) from public.diary_entries where user_id = '${userAId}'),
          (select count(*) from public.saved_meal_diary_runs where user_id = '${userAId}'),
          (select updated_at from public.recipes where id = '${activeRecipeId}'),
          to_regclass('public.recipe_use_receipts') is null,
          not exists (
            select 1 from information_schema.columns
            where table_schema = 'public' and table_name = 'diary_entries'
              and column_name = 'recipe_id'
          )
        );
      `),
    ).toBe(before);
    await context.close();
  });

  test("keeps snapshot nutrition stable through quantity and linked-food changes while source versions advance", async ({
    browser,
  }) => {
    const context = await newAuthenticatedContext(browser);
    const page = await context.newPage();
    await page.goto(previewUrl(activeRecipeId));
    const initialVersion = await page.locator("time[datetime]").first().getAttribute("datetime");
    expect(await contractValue(page, "whole_recipe_value", "Calories")).toBe("3");

    const ingredientId = queryLocalDatabase(
      `select id from public.recipe_ingredients where recipe_id = '${activeRecipeId}' and position = 1;`,
    );
    await new Promise((resolve) => setTimeout(resolve, 5));
    const quantityUpdate = await userAClient
      .from("recipe_ingredients")
      .update({ quantity: 250 })
      .eq("id", ingredientId);
    expect(quantityUpdate.error).toBeNull();
    queryLocalDatabase(`
      update public.foods set name = 'Changed linked food', is_archived = true
      where id = '${publicFoodId}';
      update public.foods set is_archived = false where id = '${publicFoodId}';
    `);
    await page.reload();
    const quantityVersion = await page.locator("time[datetime]").first().getAttribute("datetime");
    expect(quantityVersion).not.toBe(initialVersion);
    expect(await contractValue(page, "whole_recipe_value", "Calories")).toBe("3");

    await new Promise((resolve) => setTimeout(resolve, 5));
    queryLocalDatabase(`delete from public.foods where id = '${publicFoodId}';`);
    await page.reload();
    const unlinkVersion = await page.locator("time[datetime]").first().getAttribute("datetime");
    expect(unlinkVersion).not.toBe(quantityVersion);
    expect(await contractValue(page, "whole_recipe_value", "Calories")).toBe("3");
    await context.close();
  });

  test("shows owner lifecycle, overflow, and integrity states without nutrition leakage", async ({
    browser,
  }) => {
    const context = await newAuthenticatedContext(browser);
    const page = await context.newPage();
    const missingId = randomUUID();

    await page.goto(previewUrl(otherRecipeId));
    await expect(page.getByTestId("recipe-use-unavailable")).toBeVisible();
    const crossUserText = await page.getByTestId("recipe-use-unavailable").textContent();
    await page.goto(previewUrl(missingId));
    expect(await page.getByTestId("recipe-use-unavailable").textContent()).toBe(
      crossUserText,
    );

    await page.goto(previewUrl(archivedRecipeId));
    await expect(page.getByTestId("recipe-use-archived")).toBeVisible();
    await expect(page.getByTestId("recipe-use-whole_recipe_value")).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Open archived recipe editor" })).toHaveAttribute(
      "href",
      `/en/recipes/${archivedRecipeId}/edit`,
    );

    await page.goto(previewUrl(overflowRecipeId, "date=2024-02-29&mealType=lunch&servings=1.001"));
    await expect(page.getByTestId("recipe-use-not-loggable")).toContainText(
      "Try a smaller requested-serving amount",
    );
    await expect(
      page.getByRole("textbox", { exact: true, name: "Requested servings" }),
    ).toHaveValue("1.001");
    await expect(page.locator("[data-contract-value]")).toHaveCount(0);

    queryLocalDatabase(`
      set session_replication_role = replica;
      delete from public.recipe_ingredients where recipe_id = '${invalidRecipeId}';
      set session_replication_role = origin;
    `);
    try {
      await page.goto(previewUrl(invalidRecipeId));
      await expect(page.getByTestId("recipe-use-invalid_recipe")).toBeVisible();
      await expect(page.getByTestId("recipe-use-invalid_recipe")).not.toContainText(
        "contiguous",
      );
      await expect(page.locator("[data-contract-value]")).toHaveCount(0);
    } finally {
      queryLocalDatabase(`
        insert into public.recipe_ingredients (
          recipe_id, position, ingredient_name, quantity, unit, calories,
          protein_g, carbohydrates_g, fat_g
        ) values ('${invalidRecipeId}', 1, 'Restored fixture', 1, 'portion', 10, 0, 0, 0);
      `);
    }

    await page.goto(previewUrl(activeRecipeId));
    const activeVersion = await page.locator("time[datetime]").first().getAttribute("datetime");
    await new Promise((resolve) => setTimeout(resolve, 5));
    await userAClient.rpc("set_recipe_archived", {
      p_is_archived: true,
      p_recipe_id: activeRecipeId,
    });
    await page.reload();
    await expect(page.getByTestId("recipe-use-archived")).toBeVisible();
    await new Promise((resolve) => setTimeout(resolve, 5));
    await userAClient.rpc("set_recipe_archived", {
      p_is_archived: false,
      p_recipe_id: activeRecipeId,
    });
    await page.reload();
    const restoredVersion = await page.locator("time[datetime]").first().getAttribute("datetime");
    expect(restoredVersion).not.toBe(activeVersion);
    await context.close();
  });

  test("adds active-only discovery and a saved editor summary that ignores unsaved fields", async ({
    browser,
  }) => {
    const context = await newAuthenticatedContext(browser);
    const page = await context.newPage();
    await page.goto("/en/recipes?status=active&page=1");
    const activeCard = page.locator(`[data-recipe-id="${activeRecipeId}"]`);
    await expect(activeCard.getByRole("link", { name: "Nutrition & diary preview" })).toHaveAttribute(
      "href",
      `/en/recipes/${activeRecipeId}/use`,
    );
    await expect(activeCard).not.toContainText("Calories");

    await page.goto("/en/recipes?status=archived&page=1");
    const archivedCard = page.locator(`[data-recipe-id="${archivedRecipeId}"]`);
    await expect(archivedCard.getByRole("link", { name: "Nutrition & diary preview" })).toHaveCount(0);

    await page.goto(`/en/recipes/${activeRecipeId}/edit`);
    const summary = page.getByTestId("recipe-editor-nutrition-summary");
    await expect(summary).toContainText("Whole recipe: 3");
    await expect(summary).toContainText("One serving: 1.2");
    await expect(summary).toContainText("Known for 1 of 2 ingredients");
    await expect(summary.getByRole("link", { name: "Nutrition & diary preview" })).toHaveAttribute(
      "href",
      `/en/recipes/${activeRecipeId}/use`,
    );
    await page.getByTestId("recipe-ingredient").first().getByLabel("Calories").fill("9");
    await expect(summary).toContainText("Whole recipe: 3");
    await page.getByRole("button", { name: "Save changes" }).click();
    await expect(page).toHaveURL(new RegExp(`/en/recipes/${activeRecipeId}/edit\\?saved=updated$`));
    await expect(page.getByTestId("recipe-editor-nutrition-summary")).toContainText(
      "Whole recipe: 11",
    );

    await page.goto(`/en/recipes/${archivedRecipeId}/edit`);
    await expect(page.getByTestId("recipe-archived-notice")).toBeVisible();
    await expect(page.getByTestId("recipe-editor-nutrition-summary")).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Nutrition & diary preview" })).toHaveCount(0);
    await context.close();
  });

  test("shows generic retrieval failure, keeps the editor usable, and protects expired sessions", async ({
    browser,
  }) => {
    const context = await newAuthenticatedContext(browser);
    const page = await context.newPage();
    queryLocalDatabase(`
      alter function public.get_owned_recipe_use_contract(uuid, numeric)
      rename to get_owned_recipe_use_contract_test_hidden;
      notify pgrst, 'reload schema';
      select pg_sleep(0.5);
    `);
    try {
      await page.goto(previewUrl(activeRecipeId));
      await expect(page.getByTestId("recipe-use-retrieval-error")).toBeVisible();
      await expect(page.getByTestId("recipe-use-retrieval-error")).not.toContainText(
        "PGRST",
      );
      await page.goto(`/en/recipes/${activeRecipeId}/edit`);
      await expect(page.getByTestId("recipe-editor-nutrition-summary")).toContainText(
        "summary could not be loaded",
      );
      await expect(page.getByRole("button", { name: "Save changes" })).toBeEnabled();
    } finally {
      queryLocalDatabase(`
        alter function public.get_owned_recipe_use_contract_test_hidden(uuid, numeric)
        rename to get_owned_recipe_use_contract;
        notify pgrst, 'reload schema';
        select pg_sleep(0.5);
      `);
    }
    await context.close();

    const signedOut = await browser.newContext();
    const signedOutPage = await signedOut.newPage();
    await signedOutPage.goto(previewUrl(activeRecipeId));
    await expect(signedOutPage).toHaveURL(/\/en\/auth\/sign-in/);
    await signedOut.close();
  });
});
