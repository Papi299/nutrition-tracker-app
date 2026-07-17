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
const password = "RecipeUiPassword123!";
const projectId = readFileSync("supabase/config.toml", "utf8").match(
  /^project_id\s*=\s*"([^"]+)"/m,
)?.[1];

if (!projectId) throw new Error("Could not read the local Supabase project id.");
const databaseContainer = `supabase_db_${projectId}`;

test.skip(
  !localOnly || !localSupabaseUrl || !localSupabasePublishableKey,
  "Recipe UI tests require the local-only test runner.",
);

type PersistRecipeArgs = Database["public"]["Functions"]["persist_recipe"]["Args"];

test.describe.serial("localized recipe creation, editing, and management", () => {
  let authenticatedState: Awaited<ReturnType<BrowserContext["storageState"]>>;
  let userAClient: SupabaseClient<Database>;
  let userBClient: SupabaseClient<Database>;
  let userAId: string;
  let userAArchivedFoodId: string;
  let userBFoodId: string;
  let userBRecipeId: string;
  let sourceRecipeId: string;
  const publicFoodId = randomUUID();
  const runId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const userAEmail = `recipe-ui-a-${runId}@example.test`;
  const userBEmail = `recipe-ui-b-${runId}@example.test`;

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

  async function createCustomFood(
    client: SupabaseClient<Database>,
    name: string,
  ) {
    const result = await client.rpc("persist_custom_food", {
      p_aliases: [] as Json,
      p_brand_name: "Private test brand",
      p_food_id: null as unknown as string,
      p_locale: "en",
      p_name: name,
      p_nutrient_basis: "per_serving",
      p_nutrients: [
        { amount: 0, code: "energy_kcal" },
        { amount: 3.5, code: "protein_g" },
      ] as Json,
      p_serving_quantity: 2,
      p_serving_unit: "pieces",
    });
    expect(result.error).toBeNull();
    return result.data?.[0].food_id as string;
  }

  async function persistFixture(
    client: SupabaseClient<Database>,
    name: string,
  ) {
    const result = await client.rpc("persist_recipe", {
      p_ingredients: [
        {
          brand_name: null,
          calories: null,
          carbohydrates_g: null,
          fat_g: null,
          food_id: null,
          ingredient_name: `${name} ingredient`,
          notes: null,
          position: 1,
          protein_g: null,
          quantity: null,
          unit: null,
        },
      ] as Json,
      p_locale: "en",
      p_name: name,
      p_recipe_id: null as unknown as string,
      p_yield_servings: 1,
    } as PersistRecipeArgs);
    expect(result.error).toBeNull();
    return result.data?.[0].recipe_id as string;
  }

  function recipeIdFromUrl(page: Page) {
    const match = page.url().match(/\/recipes\/([0-9a-f-]+)\/edit/);
    expect(match).not.toBeNull();
    return match?.[1] as string;
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

    queryLocalDatabase(`
      insert into public.foods (
        id, food_type, name, brand_name, locale, serving_size, serving_unit,
        data_quality, is_public, is_archived, source_id
      ) values (
        '${publicFoodId}', 'generic', 'Recipe public lentils', 'Catalog test brand',
        'en', 100, 'g', 'curated', true, false,
        (select id from public.food_sources where code = 'manual')
      );
      insert into public.food_nutrients (food_id, nutrient_id, amount, basis)
      select '${publicFoodId}', id,
        case code when 'energy_kcal' then 116 else 9 end,
        'per_100g'
      from public.nutrients
      where code in ('energy_kcal', 'protein_g');
    `);

    await createCustomFood(userAClient, "Recipe owned tempeh");
    userAArchivedFoodId = await createCustomFood(
      userAClient,
      "Recipe archived tempeh",
    );
    const archived = await userAClient.rpc("set_custom_food_archived", {
      p_food_id: userAArchivedFoodId,
      p_is_archived: true,
    });
    expect(archived.error).toBeNull();
    userBFoodId = await createCustomFood(userBClient, "Recipe other tempeh");
    userBRecipeId = await persistFixture(userBClient, "Other private recipe");
  });

  test.afterAll(() => {
    queryLocalDatabase(`
      delete from public.foods where id = '${publicFoodId}';
      delete from auth.users where email in ('${userAEmail}', '${userBEmail}');
    `);
  });

  test("installs a least-privilege editor RPC and renders localized fail-closed routes", async ({
    browser,
  }) => {
    expect(
      queryLocalDatabase(`
        select concat_ws('|', p.prosecdef, p.provolatile, p.proconfig[1],
          has_function_privilege('public', p.oid, 'execute'),
          has_function_privilege('anon', p.oid, 'execute'),
          has_function_privilege('authenticated', p.oid, 'execute'))
        from pg_proc p
        where p.oid = 'public.get_owned_recipe_editor(uuid)'::regprocedure;
      `),
    ).toBe("f|s|search_path=\"\"|f|f|t");

    const ownMissing = await userAClient.rpc("get_owned_recipe_editor", {
      p_recipe_id: randomUUID(),
    });
    expect(ownMissing.error).toBeNull();
    expect(ownMissing.data).toEqual([]);
    const crossUser = await userAClient.rpc("get_owned_recipe_editor", {
      p_recipe_id: userBRecipeId,
    });
    expect(crossUser.error).toBeNull();
    expect(crossUser.data).toEqual([]);

    const context = await newAuthenticatedContext(browser, {
      viewport: { height: 844, width: 390 },
    });
    const page = await context.newPage();
    await page.goto("/en/recipes");
    await expect(page.getByTestId("recipe-management-empty-active")).toBeVisible();
    await expect(page.getByRole("link", { name: "Create recipe" })).toHaveAttribute(
      "href",
      "/en/recipes/new",
    );
    await page.goto("/en/recipes/new");
    await expect(page.locator("html")).toHaveAttribute("dir", "ltr");
    await expect(page.getByLabel("Language")).toHaveValue("en");
    await expect(page.getByLabel("Yield servings")).toHaveValue("1");
    await expect(page.getByTestId("recipe-ingredient")).toHaveCount(1);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);

    await page.goto("/he/recipes/new");
    await expect(page.locator("html")).toHaveAttribute("lang", "he");
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    await expect(page.getByLabel("שפה")).toHaveValue("he");
    await page.goto("/en/recipes/not-a-uuid/edit");
    await expect(page.getByTestId("recipe-invalid-link")).toBeVisible();
    await page.goto(`/en/recipes/${userBRecipeId}/edit`);
    await expect(page.getByTestId("recipe-unavailable")).toBeVisible();
    await page.goto("/en/recipes?status=active&status=archived");
    await expect(page.getByTestId("recipe-management-invalid-query")).toBeVisible();
    await context.close();
  });

  test("selects only readable active foods, prefills an editable snapshot, and creates atomically", async ({
    browser,
  }) => {
    const context = await newAuthenticatedContext(browser);
    const page = await context.newPage();
    const recipeCountBefore = queryLocalDatabase(
      `select count(*) from public.recipes where user_id = '${userAId}';`,
    );
    const unrelatedBefore = queryLocalDatabase(`
      select concat_ws('|',
        (select count(*) from public.diary_entries where user_id = '${userAId}'),
        (select count(*) from public.saved_meals where user_id = '${userAId}'));
    `);

    await page.goto("/en/recipes/new");
    const card = page.getByTestId("recipe-ingredient").first();
    await card.getByLabel("Food name, alias, or brand").fill("Recipe public lentils");
    await card.getByRole("button", { name: "Search foods" }).click();
    await expect(card.getByText("Recipe public lentils", { exact: true })).toBeVisible();
    await card
      .getByRole("listitem")
      .filter({ hasText: "Recipe public lentils" })
      .getByRole("button", { name: "Use snapshot" })
      .click();
    await expect(card.getByLabel("Ingredient name")).toHaveValue("Recipe public lentils");
    await expect(card.getByLabel("Quantity")).toHaveValue("100");
    await expect(card.locator('input[name="ingredient_unit_0"]')).toHaveValue("g");
    await expect(card.getByLabel("Calories")).toHaveValue("116");
    await expect(card).toContainText("Linked food provenance");
    await card.getByLabel("Quantity").fill("50");
    await expect(card.getByLabel("Calories")).toHaveValue("116");
    queryLocalDatabase(`
      update public.foods
      set name = 'Recipe public lentils revised', serving_size = 75
      where id = '${publicFoodId}';
    `);
    await expect(card.getByLabel("Ingredient name")).toHaveValue("Recipe public lentils");
    await expect(card.getByLabel("Quantity")).toHaveValue("50");
    await expect(card.getByLabel("Calories")).toHaveValue("116");
    expect(
      queryLocalDatabase(`select count(*) from public.recipes where user_id = '${userAId}';`),
    ).toBe(recipeCountBefore);

    await page.getByRole("button", { name: "Add blank ingredient" }).click();
    const ownedCard = page.getByTestId("recipe-ingredient").nth(1);
    await ownedCard.getByLabel("Food name, alias, or brand").fill("Recipe owned tempeh");
    await ownedCard.getByRole("button", { name: "Search foods" }).click();
    await expect(ownedCard.getByText("Recipe owned tempeh", { exact: true })).toBeVisible();
    await expect(ownedCard.getByText("Recipe other tempeh", { exact: true })).toHaveCount(0);
    await ownedCard
      .getByRole("listitem")
      .filter({ hasText: "Recipe owned tempeh" })
      .getByRole("button", { name: "Use snapshot" })
      .click();
    await expect(ownedCard.getByLabel("Ingredient name")).toHaveValue("Recipe owned tempeh");
    await expect(ownedCard.getByLabel("Calories")).toHaveValue("0");
    await ownedCard.getByLabel("Food name, alias, or brand").fill("Recipe archived tempeh");
    await ownedCard.getByRole("button", { name: "Search foods" }).click();
    await expect(ownedCard.getByText("Recipe archived tempeh", { exact: true })).toHaveCount(0);
    await ownedCard.getByRole("button", { name: "Remove ingredient" }).click();
    await expect(page.getByTestId("recipe-ingredient")).toHaveCount(1);

    await page.getByLabel("Recipe name").fill("Lentil bowl");
    await page.getByLabel("Language").selectOption("und");
    await page.getByLabel("Yield servings").fill("2.5");
    await page.getByRole("button", { name: "Create recipe" }).click();
    await expect(page).toHaveURL(/\/en\/recipes\/[0-9a-f-]+\/edit\?saved=created$/);
    sourceRecipeId = recipeIdFromUrl(page);
    await expect(page.getByTestId("recipe-success")).toContainText("Recipe created");

    const persisted = await userAClient
      .from("recipe_ingredients")
      .select("position,food_id,ingredient_name,quantity,unit,calories,protein_g")
      .eq("recipe_id", sourceRecipeId)
      .single();
    expect(persisted.error).toBeNull();
    expect(persisted.data).toEqual({
      calories: 116,
      food_id: publicFoodId,
      ingredient_name: "Recipe public lentils",
      position: 1,
      protein_g: 9,
      quantity: 50,
      unit: "g",
    });
    expect(
      queryLocalDatabase(`select name from public.foods where id = '${publicFoodId}';`),
    ).toBe("Recipe public lentils revised");
    expect(queryLocalDatabase(`
      select concat_ws('|',
        (select count(*) from public.diary_entries where user_id = '${userAId}'),
        (select count(*) from public.saved_meals where user_id = '${userAId}'));
    `)).toBe(unrelatedBefore);
    await context.close();
  });

  test("preserves rejected values and securely replaces reordered or unlinked snapshots", async ({
    browser,
  }) => {
    const context = await newAuthenticatedContext(browser);
    const page = await context.newPage();
    await page.goto(`/en/recipes/${sourceRecipeId}/edit`);

    await page.getByLabel("Recipe name").fill("Rejected tamper stays visible");
    await page
      .locator('input[name="ingredient_selected_food_id_0"]')
      .evaluate((input: HTMLInputElement, foodId) => {
        input.value = foodId;
      }, userBFoodId);
    await page.getByRole("button", { name: "Save changes" }).click();
    await expect(page.getByText("This food link is not valid for this ingredient.")).toBeVisible();
    await expect(page.getByLabel("Recipe name")).toHaveValue(
      "Rejected tamper stays visible",
    );
    expect(
      queryLocalDatabase(`select name from public.recipes where id = '${sourceRecipeId}';`),
    ).toBe("Lentil bowl");

    await page.reload();
    const cards = page.getByTestId("recipe-ingredient");
    await cards.nth(0).getByRole("button", { name: "Remove food link" }).click();
    await page.getByRole("button", { name: "Add blank ingredient" }).click();
    await expect(cards).toHaveCount(2);
    await cards.nth(1).getByLabel("Ingredient name").fill("Zero nutrient spice");
    await cards.nth(1).getByLabel("Calories").fill("0");
    await cards.nth(1).getByLabel("Protein (g)").fill("0");
    await cards.nth(1).getByLabel("Carbohydrates (g)").fill("0");
    await cards.nth(1).getByLabel("Fat (g)").fill("0");
    await cards.nth(1).getByRole("button", { name: "Move ingredient 2 up" }).click();
    await page.getByLabel("Recipe name").fill("Ordered unlinked bowl");
    await page.getByRole("button", { name: "Save changes" }).click();
    await expect(page).toHaveURL(
      new RegExp(`/en/recipes/${sourceRecipeId}/edit\\?saved=updated$`),
    );

    const persisted = await userAClient
      .from("recipe_ingredients")
      .select("position,food_id,ingredient_name,calories,protein_g,carbohydrates_g,fat_g")
      .eq("recipe_id", sourceRecipeId)
      .order("position");
    expect(persisted.error).toBeNull();
    expect(persisted.data).toEqual([
      {
        calories: 0,
        carbohydrates_g: 0,
        fat_g: 0,
        food_id: null,
        ingredient_name: "Zero nutrient spice",
        position: 1,
        protein_g: 0,
      },
      {
        calories: 116,
        carbohydrates_g: null,
        fat_g: null,
        food_id: null,
        ingredient_name: "Recipe public lentils",
        position: 2,
        protein_g: 9,
      },
    ]);
    await context.close();
  });

  test("paginates owned recipes and completes archive, archived edit, and restore", async ({
    browser,
  }) => {
    const paginationIds: string[] = [];
    for (let index = 1; index <= 20; index += 1) {
      paginationIds.push(
        await persistFixture(userAClient, `Pagination recipe ${String(index).padStart(2, "0")}`),
      );
    }
    queryLocalDatabase(`
      set session_replication_role = replica;
      update public.recipes
      set updated_at = '2020-01-01 12:00:00+00'
      where id in (${[sourceRecipeId, ...paginationIds].map((id) => `'${id}'`).join(",")});
      set session_replication_role = origin;
    `);

    const context = await newAuthenticatedContext(browser);
    const page = await context.newPage();
    await page.goto("/en/recipes?status=active&page=1");
    await expect(page.locator("[data-recipe-id]")).toHaveCount(20);
    await expect(page.getByText("21 recipes")).toBeVisible();
    await expect(page.getByRole("link", { name: "Next" })).toHaveAttribute(
      "href",
      "/en/recipes?status=active&page=2",
    );
    await expect(page.locator(`[data-recipe-id="${userBRecipeId}"]`)).toHaveCount(0);

    const sourcePage = [sourceRecipeId, ...paginationIds].sort().indexOf(sourceRecipeId) < 20 ? 1 : 2;
    await page.goto(`/en/recipes?status=active&page=${sourcePage}`);
    const card = page.locator(`[data-recipe-id="${sourceRecipeId}"]`);
    await expect(card).toContainText("2 ingredients");
    await card.getByRole("button", { name: "Archive" }).click();
    await expect(card.getByTestId("recipe-archive-confirmation")).toContainText(
      "ingredients and snapshots stay stored",
    );
    await card.getByRole("button", { name: "Cancel" }).click();
    expect(
      queryLocalDatabase(`select is_archived from public.recipes where id = '${sourceRecipeId}';`),
    ).toBe("f");
    await card.getByRole("button", { name: "Archive" }).click();
    await card.getByRole("button", { name: "Archive recipe" }).click();
    await expect(page).toHaveURL(/\/en\/recipes\?status=archived&saved=archived$/);
    await expect(page.locator(`[data-recipe-id="${sourceRecipeId}"]`)).toBeVisible();

    await page.getByRole("link", { name: "Edit" }).click();
    await expect(page.getByTestId("recipe-archived-notice")).toBeVisible();
    await page.getByLabel("Recipe name").fill("Archived but editable");
    await page.getByRole("button", { name: "Save changes" }).click();
    await expect(page.getByTestId("recipe-archived-notice")).toBeVisible();

    await page.goto("/en/recipes?status=archived&page=1");
    await page
      .locator(`[data-recipe-id="${sourceRecipeId}"]`)
      .getByRole("button", { name: "Restore" })
      .click();
    await expect(page).toHaveURL(/\/en\/recipes\?status=active&saved=restored$/);
    await expect(page.locator(`[data-recipe-id="${sourceRecipeId}"]`)).toBeVisible();
    await context.close();
  });
});
