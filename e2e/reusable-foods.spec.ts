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
const password = "ReusableFoodsPassword123!";
const supabaseProjectId = readFileSync("supabase/config.toml", "utf8").match(
  /^project_id\s*=\s*"([^"]+)"/m,
)?.[1];

if (!supabaseProjectId) {
  throw new Error("Could not read the local Supabase project id.");
}

const databaseContainer = `supabase_db_${supabaseProjectId}`;

test.skip(
  !localOnly || !localSupabaseUrl || !localSupabasePublishableKey,
  "Reusable-food tests require the local-only test runner.",
);

test.describe.serial("favorite foods and recent-food reuse", () => {
  let authenticatedState: Awaited<ReturnType<BrowserContext["storageState"]>>;
  let userAClient: SupabaseClient<Database>;
  let userBClient: SupabaseClient<Database>;
  let userAId: string;
  let userBId: string;
  let ownFoodId: string;
  let otherFoodId: string;
  const publicFoodId = randomUUID();
  const secondPublicFoodId = randomUUID();
  const archivedPublicFoodId = randomUUID();
  const limitFoodIds = Array.from({ length: 21 }, () => randomUUID());
  const runId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const userAEmail = `reuse-a-${runId}@example.test`;
  const userBEmail = `reuse-b-${runId}@example.test`;

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
        serving_unit: "portion",
      })
      .select("id")
      .single();

    expect(result.error).toBeNull();
    return result.data?.id as string;
  }

  async function newAuthenticatedContext(
    browser: Browser,
    options: Parameters<Browser["newContext"]>[0] = {},
  ) {
    return browser.newContext({ ...options, storageState: authenticatedState });
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
      "My reusable custom food",
    );
    otherFoodId = await createCustomFood(
      userBClient,
      userBId,
      "Other private reusable food",
    );

    queryLocalDatabase(`
      insert into public.foods (
        id, food_type, name, brand_name, locale, serving_size, serving_unit,
        data_quality, is_public, is_archived, source_id
      ) values
        ('${publicFoodId}', 'generic', 'Reusable Public Oats', 'Current Brand', 'en', 40, 'g', 'verified', true, false, (select id from public.food_sources where code = 'usda')),
        ('${secondPublicFoodId}', 'generic', 'Reusable Public Pear', null, 'he', 1, 'piece', 'curated', true, false, (select id from public.food_sources where code = 'manual')),
        ('${archivedPublicFoodId}', 'generic', 'Archived Reusable Food', null, 'und', 1, 'serving', 'curated', true, true, (select id from public.food_sources where code = 'manual'));

      insert into public.food_nutrients (food_id, nutrient_id, amount, basis)
      values
        ('${publicFoodId}', (select id from public.nutrients where code = 'energy_kcal'), 150, 'per_serving'),
        ('${publicFoodId}', (select id from public.nutrients where code = 'protein_g'), 5, 'per_serving'),
        ('${publicFoodId}', (select id from public.nutrients where code = 'fat_g'), 0, 'per_serving');
    `);

    const diaryRows = await userAClient.from("diary_entries").insert([
      {
        created_at: "2026-07-15T10:00:00Z",
        entry_date: "2030-12-31",
        food_id: secondPublicFoodId,
        food_name: "Historical pear snapshot",
        meal_type: "lunch",
        source: "manual",
        user_id: userAId,
      },
      {
        created_at: "2026-07-16T10:00:00Z",
        entry_date: "2020-01-01",
        food_id: publicFoodId,
        food_name: "Historical oats snapshot",
        meal_type: "breakfast",
        source: "manual",
        user_id: userAId,
      },
      {
        created_at: "2026-07-17T10:00:00Z",
        entry_date: "2026-07-17",
        food_name: "Manual entry excluded from recents",
        meal_type: "snack",
        source: "manual",
        user_id: userAId,
      },
      {
        created_at: "2026-07-14T10:00:00Z",
        entry_date: "2026-07-14",
        food_id: publicFoodId,
        food_name: "Older duplicate oats snapshot",
        meal_type: "dinner",
        source: "manual",
        user_id: userAId,
      },
    ]);
    expect(diaryRows.error).toBeNull();

    const otherDiary = await userBClient.from("diary_entries").insert({
      created_at: "2026-07-18T10:00:00Z",
      entry_date: "2026-07-18",
      food_id: otherFoodId,
      food_name: "Private other-user snapshot",
      meal_type: "lunch",
      source: "manual",
      user_id: userBId,
    });
    expect(otherDiary.error).toBeNull();
  });

  test.afterAll(() => {
    queryLocalDatabase(`
      delete from public.foods where id in (
        '${publicFoodId}', '${secondPublicFoodId}', '${archivedPublicFoodId}'
      );
      delete from public.foods where id = any(array[${limitFoodIds
        .map((foodId) => `'${foodId}'::uuid`)
        .join(",")}]);
      delete from auth.users where email in ('${userAEmail}', '${userBEmail}');
    `);
  });

  test("enforces least-privilege grants, invoker RPCs, empty search paths, and RLS", async () => {
    const privileges = queryLocalDatabase(`
      select concat_ws('|',
        has_table_privilege('anon', 'public.food_favorites', 'select'),
        has_table_privilege('authenticated', 'public.food_favorites', 'select'),
        has_table_privilege('authenticated', 'public.food_favorites', 'insert'),
        has_table_privilege('authenticated', 'public.food_favorites', 'update'),
        has_table_privilege('authenticated', 'public.food_favorites', 'delete'),
        (select relrowsecurity from pg_class where oid = 'public.food_favorites'::regclass)
      );
    `);
    expect(privileges).toBe("f|t|t|f|t|t");

    const functions = queryLocalDatabase(`
      select string_agg(
        p.proname || ':' || p.prosecdef || ':' || coalesce(array_to_string(p.proconfig, ','), ''),
        '|' order by p.proname
      )
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public'
        and p.proname in ('get_reusable_foods', 'set_food_favorite');
    `);
    expect(functions).toBe(
      'get_reusable_foods:false:search_path=""|set_food_favorite:false:search_path=""',
    );

    const executePrivileges = queryLocalDatabase(`
      select concat_ws('|',
        has_function_privilege('anon', 'public.get_reusable_foods()', 'execute'),
        has_function_privilege('authenticated', 'public.get_reusable_foods()', 'execute'),
        has_function_privilege('anon', 'public.set_food_favorite(uuid, boolean)', 'execute'),
        has_function_privilege('authenticated', 'public.set_food_favorite(uuid, boolean)', 'execute')
      );
    `);
    expect(executePrivileges).toBe("f|t|f|t");

  });

  test("allows only own favorite rows for readable nonarchived foods", async () => {
    const ownInsert = await userAClient.from("food_favorites").insert({
      food_id: publicFoodId,
      user_id: userAId,
    });
    expect(ownInsert.error).toBeNull();

    const spoofedOwner = await userAClient.from("food_favorites").insert({
      food_id: secondPublicFoodId,
      user_id: userBId,
    });
    expect(spoofedOwner.error).not.toBeNull();

    const otherPrivate = await userAClient.from("food_favorites").insert({
      food_id: otherFoodId,
      user_id: userAId,
    });
    expect(otherPrivate.error).not.toBeNull();

    const archived = await userAClient.from("food_favorites").insert({
      food_id: archivedPublicFoodId,
      user_id: userAId,
    });
    expect(archived.error).not.toBeNull();

    const forbiddenUpdate = await userAClient
      .from("food_favorites")
      .update({ created_at: "2020-01-01T00:00:00Z" })
      .eq("food_id", publicFoodId);
    expect(forbiddenUpdate.error).not.toBeNull();

    const userBFavorite = await userBClient.rpc("set_food_favorite", {
      p_food_id: secondPublicFoodId,
      p_is_favorite: true,
    });
    expect(userBFavorite.error).toBeNull();

    const crossUserDelete = await userAClient
      .from("food_favorites")
      .delete()
      .eq("user_id", userBId)
      .eq("food_id", secondPublicFoodId);
    expect(crossUserDelete.error).toBeNull();
    const stillVisibleToB = await userBClient
      .from("food_favorites")
      .select("food_id")
      .eq("food_id", secondPublicFoodId);
    expect(stillVisibleToB.data).toEqual([{ food_id: secondPublicFoodId }]);

    const visibleToA = await userAClient
      .from("food_favorites")
      .select("user_id,food_id");
    expect(visibleToA.error).toBeNull();
    expect(visibleToA.data).toEqual([{ food_id: publicFoodId, user_id: userAId }]);
  });

  test("keeps favorite and unfavorite RPC submissions idempotent", async () => {
    for (const isFavorite of [true, true, false, false]) {
      const result = await userAClient.rpc("set_food_favorite", {
        p_food_id: secondPublicFoodId,
        p_is_favorite: isFavorite,
      });
      expect(result.error).toBeNull();
      expect(result.data?.[0]).toEqual({
        food_id: secondPublicFoodId,
        is_favorite: isFavorite,
      });
    }

    const count = queryLocalDatabase(`
      select count(*) from public.food_favorites
      where user_id = '${userAId}' and food_id = '${secondPublicFoodId}';
    `);
    expect(count).toBe("0");

    const unavailable = await userAClient.rpc("set_food_favorite", {
      p_food_id: otherFoodId,
      p_is_favorite: true,
    });
    expect(unavailable.error).toBeNull();
    expect(unavailable.data).toEqual([]);
  });

  test("returns independently ordered, deduplicated favorites and recents with current metadata", async () => {
    await userAClient.rpc("set_food_favorite", {
      p_food_id: secondPublicFoodId,
      p_is_favorite: true,
    });
    await userAClient.rpc("set_food_favorite", {
      p_food_id: ownFoodId,
      p_is_favorite: true,
    });
    const tiedRecent = await userAClient.from("diary_entries").insert({
      created_at: "2026-07-16T10:00:00Z",
      entry_date: "2019-01-01",
      food_id: secondPublicFoodId,
      food_name: "Backdated recent tie snapshot",
      meal_type: "snack",
      source: "manual",
      user_id: userAId,
    });
    expect(tiedRecent.error).toBeNull();

    queryLocalDatabase(`
      update public.food_favorites
      set created_at = case food_id
        when '${publicFoodId}' then '2026-07-15T00:00:00Z'::timestamptz
        when '${secondPublicFoodId}' then '2026-07-15T00:00:00Z'::timestamptz
        when '${ownFoodId}' then '2026-07-16T00:00:00Z'::timestamptz
      end
      where user_id = '${userAId}';

      update public.foods
      set name = 'Reusable Public Oats Current', serving_size = 55
      where id = '${publicFoodId}';
    `);

    const reusable = await userAClient.rpc("get_reusable_foods");
    expect(reusable.error).toBeNull();

    const favorites = reusable.data?.filter(
      (food) => food.collection_type === "favorite",
    );
    expect(favorites?.map((food) => food.food_id)).toEqual([
      ownFoodId,
      ...[publicFoodId, secondPublicFoodId].sort(),
    ]);

    const recent = reusable.data?.filter(
      (food) => food.collection_type === "recent",
    );
    expect(recent?.map((food) => food.food_id)).toEqual(
      [publicFoodId, secondPublicFoodId].sort(),
    );
    expect(recent?.filter((food) => food.food_id === publicFoodId)).toHaveLength(1);
    expect(recent?.find((food) => food.food_id === publicFoodId)).toMatchObject({
      is_favorite: true,
      name: "Reusable Public Oats Current",
      serving_size: 55,
    });
    expect(
      reusable.data?.some((food) => food.food_id === otherFoodId),
    ).toBe(false);

    const limitFoodValues = limitFoodIds
      .map(
        (foodId, index) =>
          `('${foodId}', 'generic', 'Reuse limit ${index}', 'en', true, false, 'curated')`,
      )
      .join(",");
    const limitFavoriteValues = limitFoodIds
      .map(
        (foodId, index) =>
          `('${userAId}', '${foodId}', timestamptz '2026-08-01T00:00:00Z' + interval '${index} minutes')`,
      )
      .join(",");
    const limitDiaryValues = limitFoodIds
      .map(
        (foodId, index) =>
          `('${userAId}', '2020-01-01', 'breakfast', 'Limit snapshot ${index}', 'manual', '${foodId}', timestamptz '2026-08-01T00:00:00Z' + interval '${index} minutes')`,
      )
      .join(",");

    queryLocalDatabase(`
      insert into public.foods (
        id, food_type, name, locale, is_public, is_archived, data_quality
      ) values ${limitFoodValues};
      insert into public.food_favorites (user_id, food_id, created_at)
      values ${limitFavoriteValues};
      insert into public.diary_entries (
        user_id, entry_date, meal_type, food_name, source, food_id, created_at
      ) values ${limitDiaryValues};
    `);

    const limited = await userAClient.rpc("get_reusable_foods");
    expect(limited.error).toBeNull();
    expect(
      limited.data?.filter((food) => food.collection_type === "favorite"),
    ).toHaveLength(20);
    expect(
      limited.data?.filter((food) => food.collection_type === "recent"),
    ).toHaveLength(20);

    queryLocalDatabase(`
      delete from public.foods where id = any(array[${limitFoodIds
        .map((foodId) => `'${foodId}'::uuid`)
        .join(",")}]);
    `);
  });

  test("preserves favorites through archive, restores visibility, and cascades on deletion", async () => {
    const archived = await userAClient.rpc("set_custom_food_archived", {
      p_food_id: ownFoodId,
      p_is_archived: true,
    });
    expect(archived.error).toBeNull();

    const hidden = await userAClient.rpc("get_reusable_foods");
    expect(hidden.data?.some((food) => food.food_id === ownFoodId)).toBe(false);
    expect(
      queryLocalDatabase(`
        select count(*) from public.food_favorites
        where user_id = '${userAId}' and food_id = '${ownFoodId}';
      `),
    ).toBe("1");

    const restored = await userAClient.rpc("set_custom_food_archived", {
      p_food_id: ownFoodId,
      p_is_archived: false,
    });
    expect(restored.error).toBeNull();

    const visible = await userAClient.rpc("get_reusable_foods");
    expect(visible.data?.some((food) => food.food_id === ownFoodId)).toBe(true);

    const temporaryFoodId = await createCustomFood(
      userAClient,
      userAId,
      "Temporary favorite cascade food",
    );
    await userAClient.rpc("set_food_favorite", {
      p_food_id: temporaryFoodId,
      p_is_favorite: true,
    });
    const deletion = await userAClient.from("foods").delete().eq("id", temporaryFoodId);
    expect(deletion.error).toBeNull();
    expect(
      queryLocalDatabase(`
        select count(*) from public.food_favorites where food_id = '${temporaryFoodId}';
      `),
    ).toBe("0");
  });

  test("shows and mutates favorite state in search without changing search ranking", async ({
    browser,
  }) => {
    const context = await newAuthenticatedContext(browser);
    const page = await context.newPage();

    await page.goto("/en/foods?q=Reusable+Public+Oats+Current&date=2026-07-16");
    const result = page.locator(`[data-food-id="${publicFoodId}"]`);
    await expect(result).toBeVisible();
    await expect(result.getByRole("button", { name: /Remove .* favorites/ })).toBeVisible();
    await result.getByRole("button", { name: /Remove .* favorites/ }).click();
    await expect(result.getByText("Removed from favorites.")).toBeVisible();

    const databaseFavorite = await userAClient
      .from("food_favorites")
      .select("food_id")
      .eq("food_id", publicFoodId);
    expect(databaseFavorite.data).toEqual([]);

    await page.reload();
    await expect(result.getByRole("button", { name: /Add .* favorites/ })).toBeVisible();
    await result.getByRole("button", { name: /Add .* favorites/ }).click();
    await expect(result.getByText("Added to favorites.")).toBeVisible();
    await context.close();
  });

  test("renders separate localized collections and date-preserving read-only diary links", async ({
    browser,
  }) => {
    await userAClient.rpc("set_food_favorite", {
      p_food_id: publicFoodId,
      p_is_favorite: true,
    });
    queryLocalDatabase(`
      update public.foods
      set name = 'Reusable Public Oats Current', serving_size = 55
      where id = '${publicFoodId}';
    `);

    const context = await newAuthenticatedContext(browser, {
      viewport: { height: 844, width: 390 },
    });
    const page = await context.newPage();
    const diaryCountBefore = await userAClient
      .from("diary_entries")
      .select("id", { count: "exact", head: true });

    await page.goto("/en/foods/reuse?date=2026-07-16");
    await expect(page.locator("html")).toHaveAttribute("dir", "ltr");
    await expect(
      page.getByRole("heading", { exact: true, name: "Favorites" }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { exact: true, name: "Recent foods" }),
    ).toBeVisible();
    await expect(page.getByTestId("favorites-foods-list")).toContainText(
      "Reusable Public Oats Current",
    );
    await expect(page.getByTestId("recent-foods-list")).toContainText(
      "Reusable Public Oats Current",
    );
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
      ),
    ).toBe(true);

    const recentOats = page
      .getByTestId("recent-foods-list")
      .locator(`[data-food-id="${publicFoodId}"]`);
    const useLink = recentOats.getByRole("link", { name: "Use in diary" });
    await expect(useLink).toHaveAttribute(
      "href",
      `/en/today?date=2026-07-16&foodId=${publicFoodId}`,
    );
    await useLink.click();
    await expect(page).toHaveURL(
      new RegExp(`/en/today\\?date=2026-07-16&foodId=${publicFoodId}$`),
    );
    await expect(
      page.locator('input[name="food_name"][value="Reusable Public Oats Current"]'),
    ).toBeVisible();
    await expect(page.locator('input[name="calories"][value="150"]')).toBeVisible();
    await expect(page.locator('input[name="fat_g"][value="0"]')).toBeVisible();
    await expect(page.locator('input[name="carbohydrates_g"]')).toHaveValue("");

    const diaryCountAfter = await userAClient
      .from("diary_entries")
      .select("id", { count: "exact", head: true });
    expect(diaryCountAfter.count).toBe(diaryCountBefore.count);

    await page.goto("/he/foods/reuse");
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    await expect(
      page.getByRole("heading", { exact: true, name: "מועדפים" }),
    ).toBeVisible();
    const undatedLink = page
      .getByTestId("recent-foods-list")
      .locator(`[data-food-id="${publicFoodId}"]`)
      .getByRole("link", { name: "שימוש ביומן" });
    await expect(undatedLink).toHaveAttribute(
      "href",
      `/he/today?foodId=${publicFoodId}`,
    );
    await context.close();
  });

  test("renders a generic retrieval failure without exposing database details", async ({
    browser,
  }) => {
    const context = await newAuthenticatedContext(browser);
    const page = await context.newPage();

    queryLocalDatabase(`
      revoke select on table public.diary_entries from authenticated;
    `);

    try {
      await page.goto("/en/foods/reuse?date=2026-07-16");
      await expect(page.getByTestId("reusable-foods-error")).toContainText(
        "Reusable foods could not be loaded",
      );
      await expect(page.getByTestId("reusable-foods-error")).not.toContainText(
        "permission denied",
      );
    } finally {
      queryLocalDatabase(`
        grant select on table public.diary_entries to authenticated;
      `);
      await context.close();
    }
  });

  test("handles invalid and repeated dates and protects the route when signed out", async ({
    browser,
  }) => {
    const context = await newAuthenticatedContext(browser);
    const page = await context.newPage();

    await page.goto("/en/foods/reuse?date=2026-02-30");
    await expect(page.getByTestId("reusable-foods-date-invalid")).toBeVisible();
    await expect(
      page.getByTestId("recent-foods-list").getByRole("link", {
        name: "Use in diary",
      }).first(),
    ).toHaveAttribute("href", new RegExp(`^/en/today\\?foodId=`));

    await page.goto("/en/foods/reuse?date=2026-07-15&date=2026-07-16");
    await expect(page.getByTestId("reusable-foods-date-invalid")).toContainText(
      "Only one diary date",
    );
    await context.close();

    const signedOut = await browser.newContext();
    const signedOutPage = await signedOut.newPage();
    await signedOutPage.goto("/en/foods/reuse");
    await expect(signedOutPage).toHaveURL(/\/en\/auth\/sign-in$/);
    await signedOut.close();
  });
});
