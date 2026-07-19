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
const password = "SavedMealUiPassword123!";
const projectId = readFileSync("supabase/config.toml", "utf8").match(
  /^project_id\s*=\s*"([^"]+)"/m,
)?.[1];

if (!projectId) throw new Error("Could not read the local Supabase project id.");

const databaseContainer = `supabase_db_${projectId}`;

test.skip(
  !localOnly || !localSupabaseUrl || !localSupabasePublishableKey,
  "Saved-meal UI tests require the local-only test runner.",
);

test.describe.serial("localized saved-meal creation, editing, and management", () => {
  let authenticatedState: Awaited<ReturnType<BrowserContext["storageState"]>>;
  let userAClient: SupabaseClient<Database>;
  let userBClient: SupabaseClient<Database>;
  let userAId: string;
  let userBMealId: string;
  let sourceMealId: string;
  const paginationMealIds: string[] = [];
  const publicFoodId = randomUUID();
  const date = "2024-02-29";
  const runId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const userAEmail = `saved-meal-ui-a-${runId}@example.test`;
  const userBEmail = `saved-meal-ui-b-${runId}@example.test`;

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

  async function persistFixture(
    client: SupabaseClient<Database>,
    name: string,
  ) {
    const result = await client.rpc("persist_saved_meal", {
      p_items: [
        {
          position: 1,
          food_id: null,
          food_name: `${name} item`,
          brand_name: null,
          serving_quantity: null,
          serving_unit: null,
          calories: null,
          protein_g: null,
          carbohydrates_g: null,
          fat_g: null,
          notes: null,
        },
      ] as Json,
      p_locale: "en",
      p_name: name,
      p_saved_meal_id: null as unknown as string,
    });
    expect(result.error).toBeNull();
    return result.data?.[0].saved_meal_id as string;
  }

  function savedMealIdFromUrl(page: Page) {
    const match = page.url().match(/\/saved-meals\/([0-9a-f-]+)\/edit/);
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
    userBMealId = await persistFixture(userBClient, "Other user's private meal");

    queryLocalDatabase(`
      insert into public.foods (
        id, food_type, name, brand_name, locale, serving_size, serving_unit,
        data_quality, is_public, is_archived, source_id
      ) values (
        '${publicFoodId}', 'generic', 'Current catalog name', 'Current catalog brand',
        'en', 99, 'catalog units', 'curated', true, false,
        (select id from public.food_sources where code = 'manual')
      );
    `);

    const diary = await userAClient.from("diary_entries").insert([
      {
        brand_name: "Historical manual brand",
        calories: 0,
        carbohydrates_g: null,
        created_at: "2026-07-16T08:00:00Z",
        entry_date: date,
        fat_g: 3,
        food_name: "First breakfast snapshot",
        meal_type: "breakfast",
        notes: "First snapshot note",
        protein_g: 4,
        serving_quantity: 0,
        serving_unit: "portion",
        user_id: userAId,
      },
      {
        brand_name: "Historical linked brand",
        calories: 321,
        carbohydrates_g: 22,
        created_at: "2026-07-16T09:00:00Z",
        entry_date: date,
        fat_g: 7,
        food_id: publicFoodId,
        food_name: "Second linked breakfast snapshot",
        meal_type: "breakfast",
        notes: null,
        protein_g: 11,
        serving_quantity: 2,
        serving_unit: "historic servings",
        user_id: userAId,
      },
      ...(["lunch", "dinner", "snack", "other"] as const).map(
        (mealType, index) => ({
          created_at: `2026-07-16T${10 + index}:00:00Z`,
          entry_date: date,
          food_name: `${mealType} source snapshot`,
          meal_type: mealType,
          user_id: userAId,
        }),
      ),
    ]);
    expect(diary.error).toBeNull();
  });

  test.afterAll(() => {
    queryLocalDatabase(`
      delete from public.foods where id = '${publicFoodId}';
      delete from auth.users where email in ('${userAEmail}', '${userBEmail}');
    `);
  });

  test("renders localized blank editors, discovery links, and fail-closed route states", async ({
    browser,
  }) => {
    const context = await newAuthenticatedContext(browser, {
      viewport: { height: 844, width: 390 },
    });
    const page = await context.newPage();

    await page.goto("/en/saved-meals/new");
    await expect(page.locator("html")).toHaveAttribute("dir", "ltr");
    await expect(page.getByRole("heading", { name: "Create a saved meal." })).toBeVisible();
    await expect(page.getByLabel("Language")).toHaveValue("en");
    await expect(page.getByTestId("saved-meal-item")).toHaveCount(1);
    await expect(page.getByRole("link", { name: "Saved meals" }).first()).toHaveAttribute(
      "href",
      "/en/saved-meals",
    );
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);

    await page.goto("/he/saved-meals/new");
    await expect(page.locator("html")).toHaveAttribute("lang", "he");
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    await expect(page.getByLabel("שפה")).toHaveValue("he");

    await page.goto(`/en/today?date=${date}`);
    await expect(page.getByTestId("save-diary-meal-links").getByRole("link")).toHaveCount(5);

    for (const mealType of ["lunch", "dinner", "snack", "other"] as const) {
      await page.goto(`/en/saved-meals/new?date=${date}&mealType=${mealType}`);
      await expect(page.getByTestId("saved-meal-item")).toHaveCount(1);
      await expect(page.getByLabel("Food name")).toHaveValue(
        `${mealType} source snapshot`,
      );
    }

    await page.goto("/en/saved-meals/new?date=2024-02-28&mealType=breakfast");
    await expect(page.getByTestId("saved-meal-source-empty")).toBeVisible();

    await page.goto("/en/foods/reuse");
    await expect(page.getByRole("link", { name: "Saved meals" }).last()).toHaveAttribute(
      "href",
      "/en/saved-meals",
    );

    await page.goto(`/en/saved-meals/new?date=${date}`);
    await expect(page.getByTestId("saved-meal-source-invalid")).toBeVisible();
    await page.goto("/en/saved-meals/not-a-uuid/edit");
    await expect(page.getByTestId("saved-meal-invalid-link")).toBeVisible();
    await page.goto(`/en/saved-meals/${userBMealId}/edit`);
    await expect(page.getByTestId("saved-meal-unavailable")).toBeVisible();
    await context.close();
  });

  test("copies exact diary snapshots in order and creates without mutating the diary", async ({
    browser,
  }) => {
    const context = await newAuthenticatedContext(browser);
    const page = await context.newPage();
    const diaryBefore = await userAClient
      .from("diary_entries")
      .select("*")
      .eq("entry_date", date)
      .order("created_at")
      .order("id");

    await page.goto(`/en/saved-meals/new?date=${date}&mealType=breakfast`);
    const items = page.getByTestId("saved-meal-item");
    await expect(items).toHaveCount(2);
    await expect(items.nth(0).getByLabel("Food name")).toHaveValue(
      "First breakfast snapshot",
    );
    await expect(items.nth(0).getByLabel("Calories")).toHaveValue("0");
    await expect(items.nth(1).getByLabel("Food name")).toHaveValue(
      "Second linked breakfast snapshot",
    );
    await expect(items.nth(1)).toContainText("Linked to a food");
    await page.getByLabel("Meal name").fill("Diary copy meal");
    await page.getByLabel("Language").selectOption("und");
    await page.getByRole("button", { name: "Create saved meal" }).click();
    await expect(page).toHaveURL(/\/en\/saved-meals\/[0-9a-f-]+\/edit\?saved=created$/);
    sourceMealId = savedMealIdFromUrl(page);
    await expect(page.getByTestId("saved-meal-success")).toContainText(
      "Saved meal created",
    );

    const persisted = await userAClient
      .from("saved_meal_items")
      .select("position,food_id,food_name,brand_name,serving_quantity,serving_unit,calories,protein_g,carbohydrates_g,fat_g,notes")
      .eq("saved_meal_id", sourceMealId)
      .order("position");
    expect(persisted.error).toBeNull();
    expect(persisted.data?.map(({ position }) => position)).toEqual([1, 2]);
    expect(persisted.data?.[0]).toMatchObject({
      calories: 0,
      carbohydrates_g: null,
      food_id: null,
      food_name: "First breakfast snapshot",
      serving_quantity: 0,
    });
    expect(persisted.data?.[1]).toMatchObject({
      brand_name: "Historical linked brand",
      food_id: publicFoodId,
      food_name: "Second linked breakfast snapshot",
      serving_quantity: 2,
      serving_unit: "historic servings",
    });

    const diaryAfter = await userAClient
      .from("diary_entries")
      .select("*")
      .eq("entry_date", date)
      .order("created_at")
      .order("id");
    expect(diaryAfter.data).toEqual(diaryBefore.data);
    await context.close();
  });

  test("preserves form values on rejection and securely replaces reordered items", async ({
    browser,
  }) => {
    const context = await newAuthenticatedContext(browser);
    const page = await context.newPage();
    await page.goto(`/en/saved-meals/${sourceMealId}/edit`);

    await page.getByLabel("Meal name").fill("Preserved after invalid row");
    await page
      .locator('input[name="item_row_key_0"]')
      .evaluate((input: HTMLInputElement) => {
        input.value = "malformed";
      });
    await page.getByRole("button", { name: "Save changes" }).click();
    await expect(page.getByText("This item identity is invalid.")).toBeVisible();
    await expect(page.getByLabel("Meal name")).toHaveValue("Preserved after invalid row");
    expect(
      queryLocalDatabase(`select name from public.saved_meals where id = '${sourceMealId}';`),
    ).toBe("Diary copy meal");

    await page.reload();
    const items = page.getByTestId("saved-meal-item");
    await items.nth(1).getByRole("button", { name: "Move item 2 up" }).click();
    await items.nth(0).getByRole("button", { name: "Remove food link" }).click();
    await page.getByRole("button", { name: "Add item" }).click();
    await page.getByRole("button", { name: "Add item" }).click();
    await expect(items).toHaveCount(4);
    await items.nth(3).getByLabel("Food name").fill("Removed before submit");
    await items.nth(3).getByRole("button", { name: "Remove item" }).click();
    await expect(items).toHaveCount(3);
    await items.nth(2).getByLabel("Food name").fill("Client-created item");
    await items.nth(2).getByLabel("Serving quantity").fill("0");
    await items.nth(2).getByLabel("Calories").fill("0");
    await items.nth(2).getByLabel("Protein (g)").fill("0");
    await items.nth(2).getByLabel("Carbohydrates (g)").fill("0");
    await items.nth(2).getByLabel("Fat (g)").fill("0");
    await page.evaluate((injectedFoodId) => {
      const input = document.createElement("input");
      input.type = "hidden";
      input.name = "item_food_id_2";
      input.value = injectedFoodId;
      document.querySelector("form")?.append(input);
    }, publicFoodId);
    await page.getByLabel("Meal name").fill("Edited ordered meal");
    await page.getByRole("button", { name: "Save changes" }).click();
    await expect(page).toHaveURL(
      new RegExp(`/en/saved-meals/${sourceMealId}/edit\\?saved=updated$`),
    );

    const persisted = await userAClient
      .from("saved_meal_items")
      .select("position,food_id,food_name,serving_quantity,calories,protein_g,carbohydrates_g,fat_g")
      .eq("saved_meal_id", sourceMealId)
      .order("position");
    expect(persisted.data).toEqual([
      {
        calories: 321,
        food_id: null,
        food_name: "Second linked breakfast snapshot",
        serving_quantity: 2,
        position: 1,
        protein_g: 11,
        carbohydrates_g: 22,
        fat_g: 7,
      },
      {
        calories: 0,
        food_id: null,
        food_name: "First breakfast snapshot",
        serving_quantity: 0,
        position: 2,
        protein_g: 4,
        carbohydrates_g: null,
        fat_g: 3,
      },
      {
        calories: 0,
        food_id: null,
        food_name: "Client-created item",
        serving_quantity: 0,
        position: 3,
        protein_g: 0,
        carbohydrates_g: 0,
        fat_g: 0,
      },
    ]);
    await context.close();
  });

  test("paginates owned meals and completes archive, archived edit, and restore", async ({
    browser,
  }) => {
    for (let index = 1; index <= 20; index += 1) {
      paginationMealIds.push(
        await persistFixture(userAClient, `Pagination meal ${String(index).padStart(2, "0")}`),
      );
    }
    queryLocalDatabase(`
      set session_replication_role = replica;
      update public.saved_meals
      set updated_at = '2026-07-16 12:00:00+00'
      where id in (${[sourceMealId, ...paginationMealIds]
        .map((id) => `'${id}'`)
        .join(",")});
      set session_replication_role = origin;
    `);

    const context = await newAuthenticatedContext(browser);
    const page = await context.newPage();
    await page.goto("/en/saved-meals?status=active&page=1");
    await expect(page.locator("[data-saved-meal-id]")).toHaveCount(20);
    await expect(page.getByText("21 saved meals")).toBeVisible();
    await expect(page.getByRole("link", { name: "Next" })).toHaveAttribute(
      "href",
      "/en/saved-meals?status=active&page=2",
    );
    await expect(page.locator(`[data-saved-meal-id="${userBMealId}"]`)).toHaveCount(0);

    const sourcePage = [sourceMealId, ...paginationMealIds].sort().indexOf(sourceMealId) < 20 ? 1 : 2;
    await page.goto(`/en/saved-meals?status=active&page=${sourcePage}`);
    const card = page.locator(`[data-saved-meal-id="${sourceMealId}"]`);
    await expect(card.getByRole("link", { name: "Use in diary" })).toHaveAttribute(
      "href",
      `/en/saved-meals/${sourceMealId}/use`,
    );
    await card.getByRole("button", { name: "Archive" }).click();
    await expect(card.getByTestId("saved-meal-archive-confirmation")).toContainText(
      "existing diary entries stay unchanged",
    );
    await card.getByRole("button", { name: "Cancel" }).click();
    await expect(card.getByTestId("saved-meal-archive-confirmation")).toHaveCount(0);
    expect(
      queryLocalDatabase(`select is_archived from public.saved_meals where id = '${sourceMealId}';`),
    ).toBe("f");
    await card.getByRole("button", { name: "Archive" }).click();
    await card.getByRole("button", { name: "Archive meal" }).click();
    await expect(page).toHaveURL(/\/en\/saved-meals\?status=archived&saved=archived$/);
    await expect(page.locator(`[data-saved-meal-id="${sourceMealId}"]`)).toBeVisible();
    await expect(
      page
        .locator(`[data-saved-meal-id="${sourceMealId}"]`)
        .getByRole("link", { name: "Use in diary" }),
    ).toHaveCount(0);
    await page.goto(`/en/saved-meals/${sourceMealId}/use?date=${date}`);
    await expect(page.getByTestId("saved-meal-use-archived")).toBeVisible();
    await page.goto("/en/saved-meals?status=archived&page=1");

    await page.getByRole("link", { name: "Edit" }).click();
    await expect(page.getByTestId("saved-meal-archived-notice")).toBeVisible();
    await expect(page.getByRole("link", { name: "Use in diary" })).toHaveCount(0);
    await page.getByLabel("Meal name").fill("Archived but still editable");
    await page.getByRole("button", { name: "Save changes" }).click();
    await expect(page.getByTestId("saved-meal-archived-notice")).toBeVisible();

    await page.goto("/en/saved-meals?status=archived&page=1");
    await page
      .locator(`[data-saved-meal-id="${sourceMealId}"]`)
      .getByRole("button", { name: "Restore" })
      .click();
    await expect(page).toHaveURL(/\/en\/saved-meals\?status=active&saved=restored$/);
    await expect(page.locator(`[data-saved-meal-id="${sourceMealId}"]`)).toBeVisible();
    await expect(
      page
        .locator(`[data-saved-meal-id="${sourceMealId}"]`)
        .getByRole("link", { name: "Use in diary" }),
    ).toBeVisible();
    await context.close();
  });

  test("reviews localized snapshots, rejects stale confirmation, and logs an editable atomic run", async ({
    browser,
  }) => {
    const context = await newAuthenticatedContext(browser, {
      viewport: { height: 844, width: 390 },
    });
    const page = await context.newPage();

    await page.goto(`/en/saved-meals/${sourceMealId}/use`);
    await expect(page).toHaveURL(
      new RegExp(`/en/saved-meals/${sourceMealId}/use\\?date=\\d{4}-\\d{2}-\\d{2}$`),
    );
    await page.goto(`/en/saved-meals/${sourceMealId}/use?date=02-29-2024`);
    await expect(page.getByText("Use the exact YYYY-MM-DD")).toBeVisible();
    await page.goto(
      `/en/saved-meals/${sourceMealId}/use?date=2024-02-29&date=2024-03-01`,
    );
    await expect(page.getByText("Only one calendar date may be supplied")).toBeVisible();
    await page.goto("/en/saved-meals/not-a-uuid/use?date=2024-02-29");
    await expect(page.getByTestId("saved-meal-use-invalid")).toBeVisible();
    await page.goto(`/en/saved-meals/${userBMealId}/use?date=2024-02-29`);
    await expect(page.getByTestId("saved-meal-use-unavailable")).toBeVisible();
    const missingMealId = randomUUID();
    await page.goto(`/en/saved-meals/${missingMealId}/use?date=2024-02-29`);
    await expect(page.getByTestId("saved-meal-use-unavailable")).toBeVisible();

    queryLocalDatabase(`
      revoke execute on function public.get_owned_saved_meal_editor(uuid) from authenticated;
    `);
    await page.goto(`/en/saved-meals/${sourceMealId}/use?date=2024-02-29`);
    await expect(page.getByTestId("saved-meal-use-retrieval-error")).toBeVisible();
    queryLocalDatabase(`
      grant execute on function public.get_owned_saved_meal_editor(uuid) to authenticated;
    `);

    await expect(async () => {
      await page.goto(`/en/saved-meals/${sourceMealId}/use?date=9999-12-31`);
      await expect(page.getByLabel("Date")).toHaveValue("9999-12-31");
    }).toPass({ timeout: 15_000 });

    await page.goto(`/he/saved-meals/${sourceMealId}/use?date=2024-02-29`);
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    await expect(page.getByRole("heading", { name: /שימוש בארוחה/ })).toBeVisible();
    await expect(page.locator("[data-saved-meal-position]")).toHaveCount(3);
    await expect(page.getByText("Second linked breakfast snapshot")).toBeVisible();
    await expect(page.getByLabel("תאריך")).toHaveValue("2024-02-29");
    await expect(page.getByRole("link", { name: "עריכת הארוחה השמורה" })).toHaveAttribute(
      "href",
      `/he/saved-meals/${sourceMealId}/edit?date=2024-02-29`,
    );
    await expect(page.locator('input[name^="item_"]')).toHaveCount(0);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);

    await page.goto(`/en/saved-meals/${sourceMealId}/edit?date=2024-02-29`);
    await expect(page.getByRole("link", { name: "Use in diary" })).toHaveAttribute(
      "href",
      `/en/saved-meals/${sourceMealId}/use?date=2024-02-29`,
    );
    await page.goto(`/en/saved-meals/${sourceMealId}/use?date=2024-02-29`);

    const useSubmit = page.getByRole("button", { name: "Confirm and log all items" });
    await useSubmit.evaluate((button) => {
      const form = button.closest("form");
      for (const [name, value] of [
        ["entry_date", "2024-03-01"],
        ["meal_type", "lunch"],
      ]) {
        const input = document.createElement("input");
        input.type = "hidden";
        input.name = name;
        input.value = value;
        input.dataset.duplicateDestination = "true";
        form?.append(input);
      }
    });
    await useSubmit.click();
    await expect(page.getByTestId("saved-meal-use-validation_error")).toBeVisible();
    expect(
      queryLocalDatabase(`select count(*) from public.saved_meal_diary_runs where user_id = '${userAId}' and entry_date in ('2024-02-29', '2024-03-01');`),
    ).toBe("0");
    await page.locator('[data-duplicate-destination="true"]').evaluateAll((inputs) => {
      for (const input of inputs) input.remove();
    });

    const sourceItems = await userAClient
      .from("saved_meal_items")
      .select("position,food_id,food_name,brand_name,serving_quantity,serving_unit,calories,protein_g,carbohydrates_g,fat_g,notes")
      .eq("saved_meal_id", sourceMealId)
      .order("position");
    expect(sourceItems.error).toBeNull();
    const changed = await userAClient.rpc("persist_saved_meal", {
      p_items: sourceItems.data as Json,
      p_locale: "und",
      p_name: "Changed after review loaded",
      p_saved_meal_id: sourceMealId,
    });
    expect(changed.error).toBeNull();

    await page.getByLabel("Meal type").selectOption("dinner");
    await page.getByRole("button", { name: "Confirm and log all items" }).click();
    await expect(page.getByTestId("saved-meal-use-stale_review")).toBeVisible();
    expect(
      queryLocalDatabase(`select count(*) from public.saved_meal_diary_runs where user_id = '${userAId}' and entry_date = '2024-02-29' and meal_type = 'dinner';`),
    ).toBe("0");

    await page.getByRole("link", { name: "Reload current meal" }).click();
    await expect(page.getByRole("heading", { name: /Changed after review loaded/ })).toBeVisible();
    await page.getByLabel("Meal type").selectOption("dinner");
    await page.getByRole("button", { name: "Confirm and log all items" }).click();
    await expect(page).toHaveURL(
      "/en/today?date=2024-02-29&savedMeal=logged",
    );
    await expect(page.getByTestId("saved-meal-logged-success")).toContainText(
      "All reviewed items were added together",
    );

    const logged = await userAClient
      .from("diary_entries")
      .select("id,source,saved_meal_diary_run_id,saved_meal_item_position,food_name")
      .eq("entry_date", "2024-02-29")
      .eq("meal_type", "dinner")
      .eq("source", "saved_meal")
      .order("saved_meal_item_position");
    expect(logged.data?.map((entry) => entry.saved_meal_item_position)).toEqual([1, 2, 3]);
    expect(new Set(logged.data?.map((entry) => entry.saved_meal_diary_run_id)).size).toBe(1);
    const diaryDomIds = await page.locator("[data-diary-entry-id]").evaluateAll((entries) =>
      entries.map((entry) => entry.getAttribute("data-diary-entry-id")),
    );
    const loggedDomPositions = logged.data?.map((entry) => diaryDomIds.indexOf(entry.id)) ?? [];
    expect(loggedDomPositions).toEqual([...loggedDomPositions].sort((a, b) => a - b));

    const firstCard = page.locator(
      `[data-diary-entry-id="${logged.data?.[0].id as string}"]`,
    );
    await firstCard.getByRole("button", { name: "Edit" }).click();
    await expect(firstCard.getByLabel("Date")).toBeDisabled();
    await expect(firstCard.getByLabel("Meal type")).toBeDisabled();
    await firstCard.getByLabel("Food name").fill("Edited after saved-meal log");
    await firstCard.getByRole("button", { name: "Save changes" }).click();
    await expect(firstCard.getByText("Entry updated.")).toBeVisible();

    const lastLoggedName = logged.data?.[2].food_name as string;
    const lastCard = page.locator(
      `[data-diary-entry-id="${logged.data?.[2].id as string}"]`,
    );
    await lastCard.getByRole("button", { name: "Delete" }).click();
    await expect(page.getByRole("heading", { name: lastLoggedName })).toHaveCount(0);
    expect(
      (
        await userAClient
          .from("saved_meal_items")
          .select("id", { count: "exact", head: true })
          .eq("saved_meal_id", sourceMealId)
      ).count,
    ).toBe(3);
    await context.close();

    const expiredContext = await newAuthenticatedContext(browser);
    const expiredPage = await expiredContext.newPage();
    await expiredPage.goto(`/en/saved-meals/${sourceMealId}/use?date=2024-03-01`);
    await expiredContext.clearCookies();
    await expiredPage
      .getByRole("button", { name: "Confirm and log all items" })
      .click();
    await expect(expiredPage.getByTestId("saved-meal-use-unauthenticated")).toBeVisible();
    await expiredContext.close();
  });
});
