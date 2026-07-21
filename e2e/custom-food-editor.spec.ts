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
const password = "CustomFoodEditorPassword123!";
const supabaseProjectId = readFileSync("supabase/config.toml", "utf8").match(
  /^project_id\s*=\s*"([^"]+)"/m,
)?.[1];

if (!supabaseProjectId) {
  throw new Error("Could not read the local Supabase project id.");
}

const databaseContainer = `supabase_db_${supabaseProjectId}`;

test.skip(
  !localOnly || !localSupabaseUrl || !localSupabasePublishableKey,
  "Custom-food editor tests require the local-only test runner.",
);

test.describe.serial("localized custom-food creation and editing UI", () => {
  let authenticatedState: Awaited<ReturnType<BrowserContext["storageState"]>>;
  let userAClient: SupabaseClient<Database>;
  let userBClient: SupabaseClient<Database>;
  let userAId: string;
  let emptyBasisFoodId: string;
  let archivedFoodId: string;
  let otherFoodId: string;
  let mainFoodId: string;
  const publicFoodId = randomUUID();
  const runId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const userAEmail = `editor-a-${runId}@example.test`;
  const userBEmail = `editor-b-${runId}@example.test`;

  function localClient() {
    return createClient<Database>(
      localSupabaseUrl as string,
      localSupabasePublishableKey as string,
      {
        auth: { autoRefreshToken: false, persistSession: false },
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
      p_name: "Phase 7B Fixture",
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
    const match = page
      .url()
      .match(/\/foods\/custom\/([0-9a-f-]+)\/edit\?saved=(?:created|updated)$/);
    expect(match).not.toBeNull();
    return match?.[1] as string;
  }

  async function selectBasis(page: Page, label: string) {
    await page.getByLabel(label, { exact: true }).check();
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

    emptyBasisFoodId = await persistFixture(userAClient, {
      p_name: "Empty persisted milliliter basis",
      p_nutrient_basis: "per_100ml",
      p_serving_quantity: null as unknown as number,
      p_serving_unit: null as unknown as string,
    });
    archivedFoodId = await persistFixture(userAClient, {
      p_name: "Phase 7B Archived Food",
      p_nutrients: [{ amount: 33, code: "energy_kcal" }] as Json,
    });
    const archive = await userAClient.rpc("set_custom_food_archived", {
      p_food_id: archivedFoodId,
      p_is_archived: true,
    });
    expect(archive.error).toBeNull();

    otherFoodId = await persistFixture(userBClient, {
      p_name: "Other user custom editor food",
      p_nutrient_basis: "per_100g",
      p_serving_quantity: null as unknown as number,
      p_serving_unit: null as unknown as string,
    });

    queryLocalDatabase(`
      insert into public.foods (
        id, food_type, name, locale, data_quality, is_public, is_archived,
        source_id
      ) values (
        '${publicFoodId}', 'generic', 'Phase 7B Public Catalog Food', 'en',
        'curated', true, false,
        (select id from public.food_sources where code = 'manual')
      );
    `);
  });

  test.afterAll(() => {
    queryLocalDatabase(`
      delete from public.foods where id = '${publicFoodId}';
      delete from auth.users where email in ('${userAEmail}', '${userBEmail}');
    `);
  });

  test("keeps editor retrieval authenticated-only, invoker-secured and owner-scoped", async () => {
    const privilegeState = queryLocalDatabase(`
      select
        has_function_privilege('public', 'public.get_owned_custom_food_editor(uuid)', 'execute'),
        has_function_privilege('anon', 'public.get_owned_custom_food_editor(uuid)', 'execute'),
        has_function_privilege('authenticated', 'public.get_owned_custom_food_editor(uuid)', 'execute'),
        prosecdef,
        array_to_string(proconfig, ',')
      from pg_proc
      where oid = 'public.get_owned_custom_food_editor(uuid)'::regprocedure;
    `);
    expect(privilegeState).toBe('f|f|t|f|search_path=""');

    const own = await userAClient.rpc("get_owned_custom_food_editor", {
      p_food_id: emptyBasisFoodId,
    });
    expect(own.error).toBeNull();
    expect(own.data?.[0]).toMatchObject({
      aliases: [],
      food_id: emptyBasisFoodId,
      is_archived: false,
      nutrient_basis: "per_100ml",
      nutrients: [],
      serving_quantity: 100,
      serving_unit: "ml",
    });

    const archived = await userAClient.rpc("get_owned_custom_food_editor", {
      p_food_id: archivedFoodId,
    });
    expect(archived.data?.[0]).toMatchObject({ is_archived: true });

    for (const inaccessibleId of [otherFoodId, publicFoodId, randomUUID()]) {
      const inaccessible = await userAClient.rpc("get_owned_custom_food_editor", {
        p_food_id: inaccessibleId,
      });
      expect(inaccessible.error).toBeNull();
      expect(inaccessible.data).toEqual([]);
    }
  });

  test("renders English and Hebrew create routes with defaults, groups and mobile layout", async ({
    browser,
  }) => {
    const context = await newAuthenticatedContext(browser, {
      viewport: { height: 844, width: 390 },
    });
    const page = await context.newPage();

    await page.goto("/en/foods/custom/new");
    await expect(page.locator("html")).toHaveAttribute("dir", "ltr");
    await expect(page.getByRole("heading", { name: "Create a custom food." })).toBeVisible();
    await expect(page.getByLabel("Food language")).toHaveValue("en");
    await expect(page.getByLabel("Per serving", { exact: true })).toBeChecked();
    await expect(page.getByTestId("custom-food-serving-fields")).toBeVisible();
    await expect(page.locator("[data-nutrient-code]")).toHaveCount(35);
    await expect(page.locator("details")).toHaveCount(3);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);

    await selectBasis(page, "Per 100 g");
    await expect(page.getByTestId("custom-food-fixed-basis")).toContainText("100 g");
    await expect(page.getByLabel("Serving quantity")).toHaveCount(0);
    await selectBasis(page, "Per 100 ml");
    await expect(page.getByTestId("custom-food-fixed-basis")).toContainText("100 ml");

    await page.goto("/he/foods/custom/new");
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    await expect(page.getByLabel("שפת המזון")).toHaveValue("he");
    await expect(page.getByLabel("למנה", { exact: true })).toBeChecked();
    await context.close();
  });

  test("rejects invalid values and duplicate aliases while preserving entered fields", async ({
    browser,
  }) => {
    const context = await newAuthenticatedContext(browser);
    const page = await context.newPage();

    await page.goto("/en/foods/custom/new");
    await page.getByLabel("Name").fill("  Preserved mixed מזון  ");
    await page.getByLabel("Brand (optional)").fill("Brand מותג");
    await page.getByLabel("Food language").selectOption("und");
    await page.locator('[data-nutrient-code="energy_kcal"]').fill("-1");
    await page.getByRole("button", { name: "Add alias" }).click();
    await page.getByRole("button", { name: "Add alias" }).click();
    const aliases = page.getByTestId("custom-food-alias-row");
    await aliases.nth(0).getByLabel("Alias text").fill(" Label ");
    await aliases.nth(0).getByLabel("Alias language").selectOption("en");
    await aliases.nth(1).getByLabel("Alias text").fill("label");
    await aliases.nth(1).getByLabel("Alias language").selectOption("en");
    await page.getByRole("button", { name: "Create custom food" }).click();

    await expect(page.getByText("Nutrient values cannot be negative.")).toBeVisible();
    await expect(page.getByText("Enter a positive finite serving quantity.")).toBeVisible();
    await expect(page.getByText("This normalized alias is already used")).toBeVisible();
    await expect(page.getByLabel("Name")).toHaveValue("  Preserved mixed מזון  ");
    await expect(page.getByLabel("Food language")).toHaveValue("und");
    await expect(aliases.nth(0).getByLabel("Alias text")).toHaveValue(" Label ");
    await context.close();
  });

  test("creates an exact 100 g per-serving food with grouped nutrients, zero and raw aliases", async ({
    browser,
  }) => {
    const context = await newAuthenticatedContext(browser);
    const page = await context.newPage();

    await page.goto("/en/foods/custom/new");
    await page.getByLabel("Name").fill("Phase 7B Created Food");
    await page.getByLabel("Brand (optional)").fill("Editor Brand");
    await page.getByLabel("Food language").selectOption("und");
    await page.getByLabel("Serving quantity").fill("100");
    await page.getByLabel("Serving unit").fill("g");
    await page.locator('[data-nutrient-code="energy_kcal"]').fill("123.4");
    await page.locator('[data-nutrient-code="protein_g"]').fill("0");
    await page.locator('[data-nutrient-code="fat_g"]').fill("4.5");

    await page.getByText("Additional carbohydrates and fats", { exact: true }).click();
    await page.locator('[data-nutrient-code="fiber_g"]').fill("2.5");
    await page.getByText("Minerals", { exact: true }).click();
    await page.locator('[data-nutrient-code="sodium_mg"]').fill("7");
    await page.getByText("Vitamins and related nutrients", { exact: true }).click();
    await page.locator('[data-nutrient-code="vitamin_c_mg"]').fill("8");

    await page.getByRole("button", { name: "Add alias" }).click();
    await page.getByRole("button", { name: "Add alias" }).click();
    const aliases = page.getByTestId("custom-food-alias-row");
    await aliases.nth(0).getByLabel("Alias text").fill("  Raw   Alias  ");
    await aliases.nth(0).getByLabel("Alias language").selectOption("en");
    await aliases.nth(1).getByLabel("Alias text").fill("  כינוי   גולמי  ");
    await aliases.nth(1).getByLabel("Alias language").selectOption("he");
    await page.getByRole("button", { name: "Create custom food" }).click();

    await expect(page).toHaveURL(/\/en\/foods\/custom\/[0-9a-f-]+\/edit\?saved=created$/);
    mainFoodId = foodIdFromUrl(page);
    await expect(page.getByTestId("custom-food-success")).toContainText("created successfully");
    await page.reload();
    await expect(page.getByLabel("Name")).toHaveValue("Phase 7B Created Food");
    await expect(page.getByLabel("Per serving", { exact: true })).toBeChecked();
    await expect(page.getByLabel("Serving quantity")).toHaveValue("100");
    await expect(page.locator('[data-nutrient-code="protein_g"]')).toHaveValue("0");

    expect(
      queryLocalDatabase(`
        select custom_nutrient_basis || '|' || serving_size || '|' || serving_unit || '|' || locale
        from public.foods where id = '${mainFoodId}';
      `),
    ).toBe("per_serving|100.000|g|und");
    expect(
      queryLocalDatabase(`
        select count(*) || '|' || count(*) filter (where amount = 0)
        from public.food_nutrients where food_id = '${mainFoodId}';
      `),
    ).toBe("6|1");
    expect(
      queryLocalDatabase(`
        select string_agg('[' || alias_text || ']|' || language_code, E'\\n' order by created_at)
        from public.food_aliases where food_id = '${mainFoodId}';
      `),
    ).toBe("[  Raw   Alias  ]|en\n[  כינוי   גולמי  ]|he");
    await context.close();
  });

  test("creates fixed per-100 g and per-100 ml foods in English and Hebrew", async ({
    browser,
  }) => {
    const context = await newAuthenticatedContext(browser);
    const page = await context.newPage();

    await page.goto("/en/foods/custom/new");
    await page.getByLabel("Name").fill("Phase 7B Gram Food");
    await selectBasis(page, "Per 100 g");
    await page.getByRole("button", { name: "Create custom food" }).click();
    await expect(page).toHaveURL(/saved=created$/);
    const gramId = foodIdFromUrl(page);

    await page.goto("/he/foods/custom/new");
    await page.getByLabel("שם").fill("מזון נוזלי אישי");
    await page.getByLabel("שפת המזון").selectOption("he");
    await selectBasis(page, "ל-100 מ״ל");
    await page.getByRole("button", { name: "יצירת מזון אישי" }).click();
    await expect(page).toHaveURL(/\/he\/foods\/custom\/[0-9a-f-]+\/edit\?saved=created$/);
    const milliliterId = foodIdFromUrl(page);

    expect(
      queryLocalDatabase(`
        select string_agg(custom_nutrient_basis || '|' || serving_size || '|' || serving_unit || '|' || locale, E'\\n' order by custom_nutrient_basis)
        from public.foods where id in ('${gramId}', '${milliliterId}');
      `),
    ).toBe("per_100g|100.000|g|en\nper_100ml|100.000|ml|he");
    await context.close();
  });

  test("loads an empty food from its durable basis without inference", async ({ browser }) => {
    const context = await newAuthenticatedContext(browser);
    const page = await context.newPage();

    await page.goto(`/en/foods/custom/${emptyBasisFoodId}/edit`);
    await expect(page.getByLabel("Per 100 ml", { exact: true })).toBeChecked();
    await expect(page.getByTestId("custom-food-fixed-basis")).toContainText("100 ml");
    await expect(page.locator('[data-nutrient-code="energy_kcal"]')).toHaveValue("");
    await page.getByLabel("Name").fill("Empty basis edited safely");
    await page.getByRole("button", { name: "Save custom food" }).click();
    await expect(page).toHaveURL(new RegExp(`${emptyBasisFoodId}/edit\\?saved=updated$`));
    expect(
      queryLocalDatabase(`
        select custom_nutrient_basis || '|' || count(food_nutrients.id)
        from public.foods
        left join public.food_nutrients on food_nutrients.food_id = foods.id
        where foods.id = '${emptyBasisFoodId}'
        group by foods.custom_nutrient_basis;
      `),
    ).toBe("per_100ml|0");
    await context.close();
  });

  test("updates basis and aliases without conversion while preserving diary snapshots", async ({
    browser,
  }) => {
    const diary = await userAClient.from("diary_entries").insert({
      brand_name: "Editor Brand",
      calories: 123,
      carbohydrates_g: null,
      entry_date: "2026-07-14",
      fat_g: 4.5,
      food_id: mainFoodId,
      food_name: "Phase 7B Created Food",
      meal_type: "lunch",
      protein_g: 0,
      serving_quantity: 100,
      serving_unit: "g",
      source: "manual",
      user_id: userAId,
    });
    expect(diary.error).toBeNull();

    const context = await newAuthenticatedContext(browser);
    const page = await context.newPage();
    await page.goto(`/en/foods/custom/${mainFoodId}/edit`);
    await page.getByLabel("Name").fill("Phase 7B Updated Food");
    await selectBasis(page, "Per 100 ml");
    const aliases = page.getByTestId("custom-food-alias-row");
    await aliases.nth(0).getByRole("button", { name: "Remove alias" }).click();
    await page.getByRole("button", { name: "Add alias" }).click();
    const updatedAliases = page.getByTestId("custom-food-alias-row");
    await updatedAliases.last().getByLabel("Alias text").fill("Updated מזון");
    await updatedAliases.last().getByLabel("Alias language").selectOption("und");
    await page.getByRole("button", { name: "Save custom food" }).click();
    await expect(page).toHaveURL(new RegExp(`${mainFoodId}/edit\\?saved=updated$`));
    await page.reload();
    await expect(page.getByLabel("Name")).toHaveValue("Phase 7B Updated Food");
    await expect(page.getByLabel("Per 100 ml", { exact: true })).toBeChecked();

    expect(
      queryLocalDatabase(`
        select custom_nutrient_basis || '|' || count(distinct food_nutrients.basis) || '|' || min(food_nutrients.basis)
        from public.foods
        join public.food_nutrients on food_nutrients.food_id = foods.id
        where foods.id = '${mainFoodId}'
        group by foods.custom_nutrient_basis;
      `),
    ).toBe("per_100ml|1|per_100ml");
    expect(
      queryLocalDatabase(`
        select food_name || '|' || calories || '|' || protein_g || '|' || fat_g
        from public.diary_entries where food_id = '${mainFoodId}';
      `),
    ).toBe("Phase 7B Created Food|123|0.00|4.50");

    const prefill = await userAClient.rpc("get_readable_food_diary_prefill", {
      p_food_id: mainFoodId,
    });
    expect(prefill.data?.[0]).toMatchObject({
      calories: 123,
      name: "Phase 7B Updated Food",
      nutrient_basis: "per_100ml",
      protein_g: 0,
    });

    await page.goto("/en/foods?q=phase%207b%20updated%20food");
    const ownResult = page.locator(`[data-food-id="${mainFoodId}"]`);
    await expect(ownResult.getByRole("link", { name: "Edit" })).toHaveAttribute(
      "href",
      `/en/foods/custom/${mainFoodId}/edit`,
    );

    await page.goto("/en/foods?q=phase%207b%20public%20catalog");
    const publicResult = page.locator(`[data-food-id="${publicFoodId}"]`);
    await expect(publicResult).toBeVisible();
    await expect(publicResult.getByRole("link", { name: "Edit" })).toHaveCount(0);
    await context.close();
  });

  test("clears nutrients and aliases while retaining the newly selected basis", async ({
    browser,
  }) => {
    const context = await newAuthenticatedContext(browser);
    const page = await context.newPage();
    await page.goto(`/en/foods/custom/${mainFoodId}/edit`);
    await selectBasis(page, "Per 100 g");
    await page.locator("[data-nutrient-code]").evaluateAll((inputs) => {
      for (const input of inputs) {
        const element = input as HTMLInputElement;
        element.value = "";
        element.dispatchEvent(new Event("input", { bubbles: true }));
      }
    });
    while ((await page.getByTestId("custom-food-alias-row").count()) > 0) {
      await page
        .getByTestId("custom-food-alias-row")
        .first()
        .getByRole("button", { name: "Remove alias" })
        .click();
    }
    await page.getByRole("button", { name: "Save custom food" }).click();
    await expect(page).toHaveURL(new RegExp(`${mainFoodId}/edit\\?saved=updated$`));
    expect(
      queryLocalDatabase(`
        select custom_nutrient_basis || '|' ||
          (select count(*) from public.food_nutrients where food_id = foods.id) || '|' ||
          (select count(*) from public.food_aliases where food_id = foods.id)
        from public.foods where id = '${mainFoodId}';
      `),
    ).toBe("per_100g|0|0");
    await context.close();
  });

  test("edits archived owned food without unarchiving or making it searchable", async ({
    browser,
  }) => {
    const context = await newAuthenticatedContext(browser);
    const page = await context.newPage();
    await page.goto(`/en/foods/custom/${archivedFoodId}/edit`);
    await expect(page.getByTestId("custom-food-archived-notice")).toBeVisible();
    await expect(page.getByRole("button", { name: /archive/i })).toHaveCount(0);
    await page.getByLabel("Name").fill("Phase 7B Archived Food Edited");
    await page.getByRole("button", { name: "Save custom food" }).click();
    await expect(page).toHaveURL(new RegExp(`${archivedFoodId}/edit\\?saved=updated$`));
    expect(
      queryLocalDatabase(`select name || '|' || is_archived from public.foods where id = '${archivedFoodId}';`),
    ).toBe("Phase 7B Archived Food Edited|true");

    const search = await userAClient.rpc("search_readable_foods", {
      p_query: "phase 7b archived food edited",
    });
    expect(search.data?.some((food) => food.food_id === archivedFoodId)).toBe(
      false,
    );
    const prefill = await userAClient.rpc("get_readable_food_diary_prefill", {
      p_food_id: archivedFoodId,
    });
    expect(prefill.data).toEqual([]);
    await context.close();
  });

  test("shows invalid, unavailable, retrieval-failure and expired-session states safely", async ({
    browser,
  }) => {
    const context = await newAuthenticatedContext(browser);
    const page = await context.newPage();

    await page.goto(`/en/foods/custom/${emptyBasisFoodId}/edit`);
    await page.locator('input[name="food_id"]').evaluate((input, otherId) => {
      (input as HTMLInputElement).value = otherId;
    }, otherFoodId);
    await page.getByRole("button", { name: "Save custom food" }).click();
    await expect(
      page.getByText("Check the highlighted fields and try again.", {
        exact: true,
      }),
    ).toBeVisible();
    expect(
      queryLocalDatabase(`select name from public.foods where id = '${otherFoodId}';`),
    ).toBe("Other user custom editor food");

    queryLocalDatabase(
      "revoke execute on function public.get_owned_custom_food_editor(uuid) from authenticated;",
    );
    try {
      await page.goto("/en/foods/custom/not-a-uuid/edit");
      await expect(page.getByTestId("custom-food-invalid-link")).toContainText(
        "No food lookup was run",
      );
      await page.goto(`/en/foods/custom/${emptyBasisFoodId}/edit`);
      await expect(page.getByTestId("custom-food-retrieval-error")).toBeVisible();
      await expect(page.getByTestId("custom-food-retrieval-error")).not.toContainText(
        "permission denied",
      );
    } finally {
      queryLocalDatabase(
        "grant execute on function public.get_owned_custom_food_editor(uuid) to authenticated;",
      );
    }

    await expect
      .poll(
        async () => {
          const result = await userAClient.rpc("get_owned_custom_food_editor", {
            p_food_id: emptyBasisFoodId,
          });
          return result.error?.message ?? null;
        },
        { timeout: 10_000 },
      )
      .toBeNull();

    for (const unavailableId of [otherFoodId, publicFoodId, randomUUID()]) {
      await page.goto(`/en/foods/custom/${unavailableId}/edit`);
      await expect(page.getByTestId("custom-food-unavailable")).toBeVisible();
    }

    queryLocalDatabase("revoke select on table public.nutrients from authenticated;");
    try {
      await page.goto("/he/foods/custom/new");
      await expect(page.getByTestId("custom-food-retrieval-error")).toBeVisible();
      await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    } finally {
      queryLocalDatabase("grant select on table public.nutrients to authenticated;");
    }

    await context.clearCookies();
    await page.goto("/he/foods/custom/new");
    await expect(page).toHaveURL(/\/he\/auth\/sign-in$/);
    await context.close();
  });
});
