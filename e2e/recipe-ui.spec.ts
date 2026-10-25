import {
  provisionActivatedLocalUser,
  provisionActivatedLocalUserForUi,
} from "@/e2e/helpers/local-auth";
import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  expect,
  test,
  type Browser,
  type BrowserContext,
  type Locator,
  type Page,
  type Request,
  type TestInfo,
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
    await provisionActivatedLocalUserForUi({ email: userAEmail, password });
    await page.goto("/en/auth/sign-in");
    await page.getByLabel("Email").fill(userAEmail);
    await page.getByLabel("Password").fill(password);
    await page.getByRole("button", { name: "Sign in" }).click();
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
    const userBSignUp = await provisionActivatedLocalUser(userBClient, {
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
    await expect(page.locator('select[name="recipe_locale"]')).toHaveValue("en");
    await expect(page.getByLabel("Yield servings")).toHaveValue("1");
    await expect(page.getByTestId("recipe-ingredient")).toHaveCount(1);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);

    await page.goto("/he/recipes/new");
    await expect(page.locator("html")).toHaveAttribute("lang", "he");
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    await expect(page.locator('select[name="recipe_locale"]')).toHaveValue("he");
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
    await expect(card.getByRole("spinbutton", { name: "Quantity" })).toHaveValue("100");
    await expect(card.locator('input[name="ingredient_unit_0"]')).toHaveValue("g");
    await expect(card.getByRole("spinbutton", { name: "Calories" })).toHaveValue("116");
    await expect(card).toContainText("Linked food provenance");
    // This scenario intentionally retains manual consumed totals after selection.
    for (const details of await card.locator("details").all()) {
      if (await details.getAttribute("open") === null) await details.locator("summary").click();
    }
    for (const mode of await card.locator('input[name^="ingredient_automatic_"]').all()) await mode.uncheck();
    await card.getByRole("spinbutton", { name: "Quantity" }).fill("50");
    await expect(card.getByRole("spinbutton", { name: "Calories" })).toHaveValue("116");
    queryLocalDatabase(`
      update public.foods
      set name = 'Recipe public lentils revised', serving_size = 75
      where id = '${publicFoodId}';
    `);
    await expect(card.getByLabel("Ingredient name")).toHaveValue("Recipe public lentils");
    await expect(card.getByRole("spinbutton", { name: "Quantity" })).toHaveValue("50");
    await expect(card.getByRole("spinbutton", { name: "Calories" })).toHaveValue("116");
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
    await expect(ownedCard.getByRole("spinbutton", { name: "Calories" })).toHaveValue("0");
    await ownedCard.getByLabel("Food name, alias, or brand").fill("Recipe archived tempeh");
    await ownedCard.getByRole("button", { name: "Search foods" }).click();
    await expect(ownedCard.getByText("Recipe archived tempeh", { exact: true })).toHaveCount(0);
    await ownedCard.getByRole("button", { name: "Remove ingredient" }).click();
    await expect(page.getByTestId("recipe-ingredient")).toHaveCount(1);

    await page.getByLabel("Recipe name").fill("Lentil bowl");
    await page.locator('select[name="recipe_locale"]').selectOption("und");
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
    await cards.nth(1).getByRole("spinbutton", { name: "Calories" }).fill("0");
    await cards.nth(1).getByRole("spinbutton", { name: "Protein (g)" }).fill("0");
    await cards.nth(1).getByRole("spinbutton", { name: "Carbohydrates (g)" }).fill("0");
    await cards.nth(1).getByRole("spinbutton", { name: "Fat (g)" }).fill("0");
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

  test("CJ-025 preserves stale submitted values and requires fresh localized review before retry", async ({
    browser,
  }) => {
    const context = await newAuthenticatedContext(browser);
    const winnerPage = await context.newPage();
    const englishStalePage = await context.newPage();
    const hebrewStalePage = await context.newPage();
    const editRevisionBefore = Number(
      queryLocalDatabase(`
        select recipe_edit_revision
        from public.recipes
        where id = '${sourceRecipeId}';
      `),
    );

    await Promise.all([
      winnerPage.goto(`/en/recipes/${sourceRecipeId}/edit`),
      englishStalePage.goto(`/en/recipes/${sourceRecipeId}/edit`),
      hebrewStalePage.goto(`/he/recipes/${sourceRecipeId}/edit`),
    ]);
    await expect(hebrewStalePage.locator("html")).toHaveAttribute("dir", "rtl");

    await winnerPage.getByLabel("Recipe name").fill("Accepted browser aggregate A");
    await winnerPage
      .getByLabel("Ingredient name")
      .first()
      .fill("Accepted browser ingredient A");
    await englishStalePage
      .getByLabel("Recipe name")
      .fill("Preserved stale English B");
    await englishStalePage
      .getByLabel("Ingredient name")
      .first()
      .fill("Preserved stale English ingredient B");
    await hebrewStalePage
      .getByLabel("שם המתכון")
      .fill("ערכים ישנים שנשמרו בטופס");
    await hebrewStalePage
      .getByLabel("שם המרכיב")
      .first()
      .fill("מרכיב ישן שנשמר בטופס");

    await winnerPage.getByRole("button", { name: "Save changes" }).click();
    await expect(winnerPage).toHaveURL(
      new RegExp(`/en/recipes/${sourceRecipeId}/edit\\?saved=updated$`),
    );
    const acceptedSourceVersion = queryLocalDatabase(`
      select updated_at
      from public.recipes
      where id = '${sourceRecipeId}';
    `);
    expect(
      queryLocalDatabase(`
        select recipe_edit_revision
        from public.recipes
        where id = '${sourceRecipeId}';
      `),
    ).toBe(String(editRevisionBefore + 1));

    await englishStalePage.getByRole("button", { name: "Save changes" }).click();
    const englishConflict = englishStalePage.getByTestId("recipe-edit-conflict");
    await expect(englishConflict).toContainText(
      "This recipe changed after you loaded the editor. Your submitted values were not saved. Reload the current recipe and review it before trying again.",
    );
    await expect(englishStalePage.getByLabel("Recipe name")).toHaveValue(
      "Preserved stale English B",
    );
    await expect(
      englishStalePage.getByLabel("Ingredient name").first(),
    ).toHaveValue("Preserved stale English ingredient B");
    await expect(englishStalePage).not.toHaveURL(/saved=updated/);

    await hebrewStalePage
      .getByRole("button", { name: "שמירת שינויים" })
      .click();
    const hebrewConflict = hebrewStalePage.getByTestId("recipe-edit-conflict");
    await expect(hebrewConflict).toContainText(
      "המתכון השתנה לאחר טעינת העורך. הערכים שנשלחו לא נשמרו. יש לטעון מחדש את המתכון הנוכחי ולבדוק אותו לפני ניסיון נוסף.",
    );
    await expect(hebrewStalePage.getByLabel("שם המתכון")).toHaveValue(
      "ערכים ישנים שנשמרו בטופס",
    );
    await expect(
      hebrewStalePage.getByLabel("שם המרכיב").first(),
    ).toHaveValue("מרכיב ישן שנשמר בטופס");

    expect(
      queryLocalDatabase(`
        select concat_ws('|',
          recipes.name,
          recipes.updated_at,
          (
            select ingredient_name
            from public.recipe_ingredients
            where recipe_id = recipes.id
            order by position
            limit 1
          )
        )
        from public.recipes
        where id = '${sourceRecipeId}';
      `),
    ).toBe(
      `Accepted browser aggregate A|${acceptedSourceVersion}|Accepted browser ingredient A`,
    );

    await englishConflict
      .getByRole("link", { name: "Reload current recipe and review" })
      .click();
    await expect(englishStalePage.getByLabel("Recipe name")).toHaveValue(
      "Accepted browser aggregate A",
    );
    await expect(
      englishStalePage.getByLabel("Ingredient name").first(),
    ).toHaveValue("Accepted browser ingredient A");
    await englishStalePage
      .getByLabel("Recipe name")
      .fill("Intentional fresh retry B");
    await englishStalePage
      .getByLabel("Ingredient name")
      .first()
      .fill("Intentional fresh retry ingredient B");
    await englishStalePage.getByRole("button", { name: "Save changes" }).click();
    await expect(englishStalePage).toHaveURL(
      new RegExp(`/en/recipes/${sourceRecipeId}/edit\\?saved=updated$`),
    );
    expect(
      queryLocalDatabase(`
        select concat_ws('|',
          recipes.name,
          recipes.recipe_edit_revision,
          (
            select ingredient_name
            from public.recipe_ingredients
            where recipe_id = recipes.id
            order by position
            limit 1
          )
        )
        from public.recipes
        where id = '${sourceRecipeId}';
      `),
    ).toBe(
      `Intentional fresh retry B|${editRevisionBefore + 2}|Intentional fresh retry ingredient B`,
    );
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

  test.describe("F04 ingredient picker keyboard intent", () => {
    const mixedFoodName = `F04 טופו mixed ${runId}`;
    let mixedFoodId: string;

    type ActionObservation = {
      actionId: string;
      intent: "search" | "selection" | "save" | "unknown";
      value?: string;
    };
    type OwnedDatabaseSnapshot = {
      recipes: Database["public"]["Tables"]["recipes"]["Row"][];
      ingredients: Database["public"]["Tables"]["recipe_ingredients"]["Row"][];
      diary_entries: Database["public"]["Tables"]["diary_entries"]["Row"][];
    };

    function identifyAction(request: Request): ActionObservation | null {
      const actionId = request.headers()["next-action"];
      if (request.method() !== "POST" || !actionId) return null;
      const body = request.postData() ?? "";
      if (/name="[^"]*(?:recipe_id|ingredient_count)"/.test(body)) {
        return { actionId, intent: "save" };
      }
      try {
        const argumentsValue: unknown = JSON.parse(body);
        if (
          Array.isArray(argumentsValue) && argumentsValue.length === 1 &&
          typeof argumentsValue[0] === "string"
        ) {
          const value = argumentsValue[0];
          return {
            actionId,
            intent: /^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(value)
              ? "selection" : "search",
            value,
          };
        }
      } catch {
        // Recipe saves encode FormData; picker actions encode one string.
      }
      return { actionId, intent: "unknown" };
    }

    function observeActions(page: Page) {
      const actions: ActionObservation[] = [];
      page.on("request", (request) => {
        const action = identifyAction(request);
        if (action) actions.push(action);
      });
      return actions;
    }

    function ownedDatabaseSnapshot(): OwnedDatabaseSnapshot {
      return JSON.parse(queryLocalDatabase(`
        select jsonb_build_object(
          'recipes', coalesce((select jsonb_agg(to_jsonb(r) order by r.id)
            from public.recipes r where r.user_id = '${userAId}'), '[]'::jsonb),
          'ingredients', coalesce((select jsonb_agg(to_jsonb(i) order by i.id)
            from public.recipe_ingredients i join public.recipes r on r.id = i.recipe_id
            where r.user_id = '${userAId}'), '[]'::jsonb),
          'diary_entries', coalesce((select jsonb_agg(to_jsonb(d) order by d.id)
            from public.diary_entries d where d.user_id = '${userAId}'), '[]'::jsonb)
        );
      `));
    }

    async function editorSnapshot(page: Page) {
      return page.locator('form:has(input[name="recipe_id"])').evaluate((form) => {
        const entries = [...new FormData(form as HTMLFormElement).entries()]
          .filter(([name]) => !name.startsWith("$ACTION"));
        return Object.fromEntries(entries);
      });
    }

    async function attachStateEvidence(
      testInfo: TestInfo,
      page: Page,
      actions: ActionObservation[],
      before: ReturnType<typeof ownedDatabaseSnapshot>,
    ) {
      await testInfo.attach("F04-server-actions-and-database-state", {
        body: JSON.stringify({
          actions, before, after: ownedDatabaseSnapshot(), url: page.url(),
        }, null, 2),
        contentType: "application/json",
      });
    }

    async function searchAndWait(
      page: Page,
      picker: Locator,
      query: string,
      activation: "input-enter" | "click" | "button-enter" | "button-space" = "input-enter",
    ) {
      const input = picker.locator('input[type="search"]');
      const button = picker.locator('button[type="button"]').first();
      await input.fill(query);
      const responsePromise = page.waitForResponse((response) => {
        const action = identifyAction(response.request());
        return action?.intent === "search" && action.value === query;
      });
      if (activation === "input-enter") await input.press("Enter");
      else if (activation === "click") await button.click();
      else {
        await button.focus();
        await button.press(activation === "button-enter" ? "Enter" : "Space");
      }
      await responsePromise;
      await expect(input).toBeEnabled();
    }

    function expectOnlySearches(actions: ActionObservation[]) {
      expect(actions.length).toBeGreaterThan(0);
      expect(actions.every((action) => action.intent === "search")).toBe(true);
      expect(new Set(actions.map((action) => action.actionId)).size).toBe(1);
    }

    test.beforeAll(async () => {
      mixedFoodId = await createCustomFood(userAClient, mixedFoodName);
    });

    test("F04 R1 Enter searches an invalid Create without submitting validation or writing", async ({ browser }, testInfo) => {
      const context = await newAuthenticatedContext(browser);
      const page = await context.newPage();
      await page.goto("/en/recipes/new");
      const actions = observeActions(page);
      const before = ownedDatabaseSnapshot();
      try {
        const picker = page.getByTestId("recipe-food-picker").first();
        await picker.locator('input[type="search"]').fill(mixedFoodName);
        await picker.locator('input[type="search"]').press("Enter");
        await expect(picker.getByText(mixedFoodName, { exact: true })).toBeVisible({ timeout: 5_000 });
        await expect(page.locator("#recipe-name-error")).toHaveCount(0);
        await expect(page.getByLabel("Recipe name")).toHaveAttribute("aria-invalid", "false");
        await expect(page).toHaveURL("/en/recipes/new");
        expectOnlySearches(actions);
        expect(actions[0].value).toBe(mixedFoodName);
        expect(ownedDatabaseSnapshot()).toEqual(before);
      } finally {
        await attachStateEvidence(testInfo, page, actions, before);
        await context.close();
      }
    });

    test("F04 R2 Enter preserves a valid unsaved Create and all persisted aggregates", async ({ browser }, testInfo) => {
      const context = await newAuthenticatedContext(browser);
      const page = await context.newPage();
      await page.goto("/en/recipes/new");
      await page.getByLabel("Recipe name").fill("F04 valid unsaved recipe");
      await page.getByLabel("Ingredient name").fill("F04 unsaved manual ingredient");
      await page.getByRole("spinbutton", { name: "Calories" }).fill("0");
      const valuesBefore = await editorSnapshot(page);
      const actions = observeActions(page);
      const before = ownedDatabaseSnapshot();
      try {
        const picker = page.getByTestId("recipe-food-picker").first();
        await picker.locator('input[type="search"]').fill(mixedFoodName);
        await picker.locator('input[type="search"]').press("Enter");
        await expect(picker.getByText(mixedFoodName, { exact: true })).toBeVisible({ timeout: 5_000 });
        await expect(page).toHaveURL("/en/recipes/new");
        expect(await editorSnapshot(page)).toEqual(valuesBefore);
        expectOnlySearches(actions);
        expect(ownedDatabaseSnapshot()).toEqual(before);
      } finally {
        await attachStateEvidence(testInfo, page, actions, before);
        await context.close();
      }
    });

    test("F04 R3 Enter preserves an unsaved owned Edit, row keys, revision, and ingredients", async ({ browser }, testInfo) => {
      const recipeId = await persistFixture(userAClient, "F04 existing recipe");
      const context = await newAuthenticatedContext(browser);
      const page = await context.newPage();
      await page.goto(`/en/recipes/${recipeId}/edit`);
      await page.getByLabel("Recipe name").fill("F04 unsaved edit");
      await page.getByLabel("Ingredient name").fill("F04 unsaved ingredient edit");
      const valuesBefore = await editorSnapshot(page);
      const rowKeysBefore = await page.getByTestId("recipe-ingredient").evaluateAll(
        (cards) => cards.map((card) => card.getAttribute("data-row-key")),
      );
      const actions = observeActions(page);
      const before = ownedDatabaseSnapshot();
      try {
        const picker = page.getByTestId("recipe-food-picker").first();
        await picker.locator('input[type="search"]').fill(mixedFoodName);
        await picker.locator('input[type="search"]').press("Enter");
        await expect(picker.getByText(mixedFoodName, { exact: true })).toBeVisible({ timeout: 5_000 });
        await expect(page).toHaveURL(`/en/recipes/${recipeId}/edit`);
        expect(await editorSnapshot(page)).toEqual(valuesBefore);
        expect(await page.getByTestId("recipe-ingredient").evaluateAll(
          (cards) => cards.map((card) => card.getAttribute("data-row-key")),
        )).toEqual(rowKeysBefore);
        expectOnlySearches(actions);
        expect(ownedDatabaseSnapshot()).toEqual(before);
      } finally {
        await attachStateEvidence(testInfo, page, actions, before);
        await context.close();
      }
    });

    test("F04 R4 Enter and Search button share results, too-short, empty, and actual validation-error behavior", async ({ browser }) => {
      const context = await newAuthenticatedContext(browser);
      const page = await context.newPage();
      await page.goto("/en/recipes/new");
      const picker = page.getByTestId("recipe-food-picker").first();
      const actions = observeActions(page);
      const before = ownedDatabaseSnapshot();
      const absentQuery = `zzunmatched${randomUUID().replaceAll("-", "")}`;
      for (const query of [mixedFoodName, "x", absentQuery]) {
        await searchAndWait(page, picker, query, "click");
        const buttonResults = await picker.locator("li").allTextContents();
        const buttonStatus = await picker.locator("p").allTextContents();
        await searchAndWait(page, picker, query);
        expect(await picker.locator("li").allTextContents()).toEqual(buttonResults);
        expect(await picker.locator("p").allTextContents()).toEqual(buttonStatus);
        if (query === mixedFoodName) await expect(picker.getByText(mixedFoodName, { exact: true })).toBeVisible();
        else if (query === "x") await expect(picker.getByRole("alert")).toContainText("at least 2");
        else await expect(picker).toContainText("No readable active foods found.");
      }
      const overlongQuery = "x".repeat(101);
      for (const activation of ["click", "input-enter"] as const) {
        // Bypass the DOM length limit to exercise the real server validation path.
        await picker.locator('input[type="search"]').evaluate((input, value) => {
          Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set?.call(input, value);
          input.dispatchEvent(new Event("input", { bubbles: true }));
        }, overlongQuery);
        const responsePromise = page.waitForResponse((response) => {
          const action = identifyAction(response.request());
          return action?.intent === "search" && action.value === overlongQuery;
        });
        if (activation === "click") await picker.locator("button").first().click();
        else await picker.locator('input[type="search"]').press("Enter");
        await responsePromise;
        await expect(picker.getByRole("alert")).toHaveText("Food search is unavailable right now.");
        await expect(picker.locator("li")).toHaveCount(0);
      }
      expectOnlySearches(actions);
      expect(ownedDatabaseSnapshot()).toEqual(before);
      await context.close();
    });

    test("F04 R5 R6 keyboard selection preserves snapshots until explicit Create and Edit", async ({ browser }, testInfo) => {
      const context = await newAuthenticatedContext(browser);
      const page = await context.newPage();
      await page.goto("/en/recipes/new");
      const actions = observeActions(page);
      const before = ownedDatabaseSnapshot();
      const picker = page.getByTestId("recipe-food-picker").first();
      await searchAndWait(page, picker, mixedFoodName);
      await picker.getByRole("button", { name: "Use snapshot" }).click();
      const card = page.getByTestId("recipe-ingredient").first();
      await expect(card.getByLabel("Ingredient name")).toHaveValue(mixedFoodName);
      await expect(card.getByRole("spinbutton", { name: "Calories" })).toHaveValue("0");
      await expect(card.getByRole("spinbutton", { name: "Protein (g)" })).toHaveValue("3.5");
      await expect(card.getByRole("spinbutton", { name: "Carbohydrates (g)" })).toHaveValue("");
      await expect(card.getByRole("spinbutton", { name: "Fat (g)" })).toHaveValue("");
      await expect(card.getByRole("spinbutton", { name: "Quantity" })).toHaveValue("2");
      await card.getByRole("spinbutton", { name: "Quantity" }).fill("4");
      await expect(card.getByRole("spinbutton", { name: "Protein (g)" })).toHaveValue("7");
      await expect(card.getByRole("spinbutton", { name: "Calories" })).toHaveValue("0");
      expect(actions.map((action) => action.intent)).toEqual(["search", "selection"]);
      expect(actions[1].value).toBe(mixedFoodId);
      expect(actions[1].actionId).not.toBe(actions[0].actionId);
      expect(ownedDatabaseSnapshot()).toEqual(before);

      await page.getByLabel("Recipe name").fill("F04 explicit created recipe");
      await page.getByRole("button", { name: "Create recipe", exact: true }).click();
      await expect(page).toHaveURL(/\/en\/recipes\/[0-9a-f-]+\/edit\?saved=created$/);
      const recipeId = recipeIdFromUrl(page);
      expect(actions.at(-1)?.intent).toBe("save");
      const created = await userAClient.from("recipe_ingredients")
        .select("food_id,ingredient_name,quantity,calories,protein_g,carbohydrates_g,fat_g")
        .eq("recipe_id", recipeId).single();
      expect(created.error).toBeNull();
      expect(created.data).toEqual({
        food_id: mixedFoodId, ingredient_name: mixedFoodName, quantity: 4,
        calories: 0, protein_g: 7, carbohydrates_g: null, fat_g: null,
      });
      const createdBefore = ownedDatabaseSnapshot();
      const revisionBefore = Number(queryLocalDatabase(`select recipe_edit_revision from public.recipes where id = '${recipeId}';`));
      await page.getByLabel("Recipe name").fill("F04 explicit updated recipe");
      await searchAndWait(page, page.getByTestId("recipe-food-picker").first(), mixedFoodName);
      expect(ownedDatabaseSnapshot()).toEqual(createdBefore);
      await page.getByRole("button", { name: "Save changes", exact: true }).click();
      await expect(page).toHaveURL(`/en/recipes/${recipeId}/edit?saved=updated`);
      expect(actions.at(-1)?.intent).toBe("save");
      expect(queryLocalDatabase(`select name || '|' || recipe_edit_revision from public.recipes where id = '${recipeId}';`))
        .toBe(`F04 explicit updated recipe|${revisionBefore + 1}`);
      expect(ownedDatabaseSnapshot().diary_entries).toEqual(before.diary_entries);
      await attachStateEvidence(testInfo, page, actions, before);
      await context.close();
    });

    test("F04 R7 second-row, Tab, native button Enter and Space, and ordinary-field submit remain functional", async ({ browser }) => {
      const context = await newAuthenticatedContext(browser);
      const page = await context.newPage();
      await page.goto("/en/recipes/new");
      await page.getByRole("button", { name: "Add blank ingredient" }).click();
      const cards = page.getByTestId("recipe-ingredient");
      const firstPicker = cards.first().getByTestId("recipe-food-picker");
      const secondPicker = cards.nth(1).getByTestId("recipe-food-picker");
      const before = ownedDatabaseSnapshot();
      const actions = observeActions(page);
      await searchAndWait(page, secondPicker, mixedFoodName);
      await expect(secondPicker.getByText(mixedFoodName, { exact: true })).toBeVisible();
      await expect(firstPicker.locator("li")).toHaveCount(0);
      await secondPicker.locator('input[type="search"]').focus();
      await page.keyboard.press("Tab");
      await expect(secondPicker.locator("button").first()).toBeFocused();
      expect(await secondPicker.locator("button").first().evaluate(
        (button) => getComputedStyle(button).outlineStyle,
      )).not.toBe("none");
      await searchAndWait(page, secondPicker, mixedFoodName, "button-enter");
      await searchAndWait(page, secondPicker, mixedFoodName, "button-space");
      expectOnlySearches(actions);
      expect(ownedDatabaseSnapshot()).toEqual(before);
      await page.getByLabel("Recipe name").fill("F04 ordinary field native save");
      await cards.nth(0).getByLabel("Ingredient name").fill("F04 first manual row");
      await cards.nth(1).getByLabel("Ingredient name").fill("F04 second manual row");
      await page.getByLabel("Recipe name").press("Enter");
      await expect(page).toHaveURL(/\/en\/recipes\/[0-9a-f-]+\/edit\?saved=created$/);
      expect(actions.at(-1)?.intent).toBe("save");
      expect(ownedDatabaseSnapshot().recipes.length).toBe(before.recipes.length + 1);
      expect(ownedDatabaseSnapshot().ingredients.length).toBe(before.ingredients.length + 2);
      expect(ownedDatabaseSnapshot().diary_entries).toEqual(before.diary_entries);
      await context.close();
    });

    test("F04 R7 rapid Enter keeps one pending search and never submits the Recipe", async ({ browser }) => {
      const context = await newAuthenticatedContext(browser);
      const page = await context.newPage();
      await page.goto("/en/recipes/new");
      const picker = page.getByTestId("recipe-food-picker").first();
      const input = picker.locator('input[type="search"]');
      const before = ownedDatabaseSnapshot();
      const actions = observeActions(page);
      let releaseSearch: () => void = () => {};
      const searchGate = new Promise<void>((resolve) => { releaseSearch = resolve; });
      let searchRequests = 0;
      await page.route("**/recipes/new", async (route) => {
        const action = identifyAction(route.request());
        if (action?.intent === "search" && action.value === mixedFoodName) {
          searchRequests += 1;
          await searchGate;
        }
        await route.continue();
      });
      try {
        await input.fill(mixedFoodName);
        const prevented = await input.evaluate((element) => {
          // Dispatch in one browser task to cover repeats before pending renders.
          return Array.from({ length: 3 }, () => {
            const event = new KeyboardEvent("keydown", {
              bubbles: true, cancelable: true, code: "Enter", key: "Enter",
            });
            element.dispatchEvent(event);
            return event.defaultPrevented;
          });
        });
        expect(prevented).toEqual([true, true, true]);
        await expect.poll(() => searchRequests).toBe(1);
        await expect(input).toBeDisabled();
        await expect(picker.locator("button").first()).toBeDisabled();
        await page.keyboard.press("Enter");
        await page.keyboard.press("Enter");
        expect(searchRequests).toBe(1);
        releaseSearch();
        await expect(picker.getByText(mixedFoodName, { exact: true })).toBeVisible();
        await expect(input).toBeEnabled();
        expectOnlySearches(actions);
        expect(actions).toHaveLength(1);
        expect(ownedDatabaseSnapshot()).toEqual(before);
      } finally {
        releaseSearch();
        await page.unroute("**/recipes/new");
        await context.close();
      }
    });

    test("F04 R7 simulated composition Enter and composition-ending keyCode 229 stay local before normal search", async ({ browser }, testInfo) => {
      const context = await newAuthenticatedContext(browser);
      const page = await context.newPage();
      await page.goto("/en/recipes/new");
      const picker = page.getByTestId("recipe-food-picker").first();
      const input = picker.locator('input[type="search"]');
      const before = ownedDatabaseSnapshot();
      const actions = observeActions(page);
      await input.fill("F04 partial composition draft");
      await input.dispatchEvent("compositionstart", { data: "טופו" });
      await input.press("Enter");
      const compositionEvents = await input.evaluate((element, committedQuery) => {
        const input = element as HTMLInputElement;
        const form = input.form as HTMLFormElement;
        const submitter = form.querySelector<HTMLButtonElement>('button[type="submit"]');
        function submitIsBlocked() {
          let blocked = false;
          form.addEventListener("submit", (event) => { blocked = event.defaultPrevented; }, { once: true });
          form.requestSubmit(submitter);
          return blocked;
        }
        element.dispatchEvent(new CompositionEvent("compositionend", { bubbles: true, data: "טופו" }));
        const composingEnter = new KeyboardEvent("keydown", {
          bubbles: true, cancelable: true, code: "Enter", isComposing: true, key: "Enter",
        });
        element.dispatchEvent(composingEnter);
        const composingSubmitBlocked = submitIsBlocked();
        // Model committed text using real input events; no physical OS IME is claimed.
        const beforeInput = new InputEvent("beforeinput", {
          bubbles: true, cancelable: true, data: "טופו", inputType: "insertCompositionText",
        });
        element.dispatchEvent(beforeInput);
        Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set?.call(input, committedQuery);
        element.dispatchEvent(new InputEvent("input", {
          bubbles: true, data: "טופו", inputType: "insertCompositionText",
        }));
        element.dispatchEvent(new CompositionEvent("compositionstart", { bubbles: true, data: "טופו" }));
        element.dispatchEvent(new CompositionEvent("compositionend", { bubbles: true, data: "טופו" }));
        const endingEnter = new KeyboardEvent("keydown", {
          bubbles: true, cancelable: true, code: "Enter", key: "Enter", keyCode: 229,
        });
        element.dispatchEvent(endingEnter);
        return {
          composingEnter: composingEnter.defaultPrevented,
          endingEnter: endingEnter.defaultPrevented,
          beforeInput: beforeInput.defaultPrevented,
          composingSubmitBlocked,
          endingSubmitBlocked: submitIsBlocked(),
        };
      }, mixedFoodName);
      await page.evaluate(() => new Promise<void>((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
      }));
      expect(actions).toEqual([]);
      expect(compositionEvents).toEqual({
        composingEnter: false, endingEnter: false, beforeInput: false,
        composingSubmitBlocked: true, endingSubmitBlocked: true,
      });
      await expect(input).toHaveValue(mixedFoodName);
      await expect(page.locator("#recipe-name-error")).toHaveCount(0);
      expect(ownedDatabaseSnapshot()).toEqual(before);
      const responsePromise = page.waitForResponse((response) => {
        const action = identifyAction(response.request());
        return action?.intent === "search" && action.value === mixedFoodName;
      });
      await input.press("Enter");
      await responsePromise;
      await expect(picker.getByText(mixedFoodName, { exact: true })).toBeVisible();
      expectOnlySearches(actions);
      expect(actions[0].value).toBe(mixedFoodName);
      expect(ownedDatabaseSnapshot()).toEqual(before);
      await page.getByLabel("Recipe name").fill("F04 explicit save after composition");
      await page.getByLabel("Ingredient name").fill("F04 composed draft ingredient");
      await input.focus();
      await input.dispatchEvent("keydown", {
        bubbles: true, cancelable: true, isComposing: true, key: "Enter",
      });
      const saveButton = page.getByRole("button", { name: "Create recipe", exact: true });
      // Model browsers where pointer activation does not focus the button.
      const focusOnPointer = saveButton.evaluate((button) => new Promise<boolean>((resolve) => {
        button.addEventListener("mousedown", (event) => {
          event.preventDefault();
          resolve(button.ownerDocument.activeElement?.matches('input[type="search"]') ?? false);
        }, { once: true });
      }));
      await expect(input).toBeFocused();
      await saveButton.click();
      expect(await focusOnPointer).toBe(true);
      await expect(page).toHaveURL(/\/en\/recipes\/[0-9a-f-]+\/edit\?saved=created$/);
      expect(actions.at(-1)?.intent).toBe("save");
      expect(ownedDatabaseSnapshot().recipes.length).toBe(before.recipes.length + 1);
      expect(ownedDatabaseSnapshot().ingredients.length).toBe(before.ingredients.length + 1);
      expect(ownedDatabaseSnapshot().diary_entries).toEqual(before.diary_entries);
      await testInfo.attach("F04-IME-coverage-limitation", {
        body: "Composition events, native Enter during simulated composition, native isComposing, compositionend-before-keydown keyCode 229, uncanceled keydown/beforeinput, committed text, narrowly blocked submit events, and explicit pointer saving with input focus retained were exercised in Chromium. This does not qualify physical Japanese, Chinese, Korean, or browser-specific OS IME behavior.",
        contentType: "text/plain",
      });
      await context.close();
    });

    test("F04 R8 English LTR and Hebrew RTL Enter search preserve Hebrew and mixed-direction queries", async ({ browser }) => {
      const context = await newAuthenticatedContext(browser);
      const page = await context.newPage();
      const actions = observeActions(page);
      const before = ownedDatabaseSnapshot();
      for (const locale of ["en", "he"] as const) {
        await page.goto(`/${locale}/recipes/new`);
        await expect(page.locator("html")).toHaveAttribute("dir", locale === "he" ? "rtl" : "ltr");
        const picker = page.getByTestId("recipe-food-picker").first();
        for (const query of ["טופו", mixedFoodName]) {
          await searchAndWait(page, picker, query);
          await expect(picker.getByText(mixedFoodName, { exact: true })).toBeVisible();
          await expect(picker.locator('input[type="search"]')).toHaveValue(query);
        }
        await expect(page.locator("#recipe-name-error")).toHaveCount(0);
        await expect(page).toHaveURL(`/${locale}/recipes/new`);
      }
      expectOnlySearches(actions);
      expect(ownedDatabaseSnapshot()).toEqual(before);
      await context.close();
    });
  });
});
