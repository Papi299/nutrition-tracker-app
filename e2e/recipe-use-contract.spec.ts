import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { expect, test } from "@playwright/test";
import type { Database, Json } from "@/lib/supabase/database.types";

const localSupabaseUrl = process.env.LOCAL_SUPABASE_URL;
const localSupabasePublishableKey = process.env.LOCAL_SUPABASE_PUBLISHABLE_KEY;
const localOnly = process.env.DATE_E2E_LOCAL_SUPABASE === "1";
const password = "RecipeUsePassword123!";
const projectId = readFileSync("supabase/config.toml", "utf8").match(
  /^project_id\s*=\s*"([^"]+)"/m,
)?.[1];

if (!projectId) throw new Error("Could not read the local Supabase project id.");
const databaseContainer = `supabase_db_${projectId}`;

test.skip(
  !localOnly || !localSupabaseUrl || !localSupabasePublishableKey,
  "Recipe use-contract tests require the local-only test runner.",
);

type PersistArgs = Database["public"]["Functions"]["persist_recipe"]["Args"];
type UseArgs = Database["public"]["Functions"]["get_owned_recipe_use_contract"]["Args"];

test.describe.serial("recipe nutrition use-contract foundation", () => {
  let userAClient: SupabaseClient<Database>;
  let userBClient: SupabaseClient<Database>;
  let userAId: string;
  let derivationRecipeId: string;
  let boundaryRecipeId: string;
  let fractionalRecipeId: string;
  let overflowRecipeId: string;
  let incompleteRecipeId: string;
  const runId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;

  function localClient() {
    return createClient<Database>(
      localSupabaseUrl as string,
      localSupabasePublishableKey as string,
      { auth: { autoRefreshToken: false, persistSession: false } },
    );
  }

  function queryDatabase(statement: string) {
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

  async function createUser(prefix: string) {
    const client = localClient();
    const result = await client.auth.signUp({
      email: `${prefix}-${runId}@example.test`,
      password,
    });
    expect(result.error).toBeNull();
    expect(result.data.session).not.toBeNull();
    return { client, userId: result.data.user?.id as string };
  }

  function ingredient(position: number, overrides: Record<string, Json> = {}) {
    return {
      position,
      food_id: null,
      ingredient_name: `Snapshot ${position}`,
      brand_name: null,
      quantity: 1,
      unit: "portion",
      calories: 0,
      protein_g: 0,
      carbohydrates_g: 0,
      fat_g: 0,
      notes: null,
      ...overrides,
    };
  }

  async function persist(
    client: SupabaseClient<Database>,
    name: string,
    yieldServings: number,
    ingredients: Json,
  ) {
    const result = await client.rpc("persist_recipe", {
      p_recipe_id: null as unknown as string,
      p_name: name,
      p_locale: "en",
      p_yield_servings: yieldServings,
      p_ingredients: ingredients,
    } as PersistArgs);
    expect(result.error).toBeNull();
    return result.data?.[0].recipe_id as string;
  }

  async function derive(
    client: SupabaseClient<Database>,
    recipeId: string,
    requestedServings: number,
  ) {
    const result = await client.rpc("get_owned_recipe_use_contract", {
      p_recipe_id: recipeId,
      p_requested_servings: requestedServings,
    } as UseArgs);
    expect(result.error).toBeNull();
    expect(result.data).toHaveLength(1);
    return result.data?.[0];
  }

  test.beforeAll(async () => {
    const userA = await createUser("recipe-use-a");
    const userB = await createUser("recipe-use-b");
    userAClient = userA.client;
    userBClient = userB.client;
    userAId = userA.userId;

    derivationRecipeId = await persist(userAClient, "Exact derivation", 3, [
      ingredient(1, {
        calories: 100,
        protein_g: 0.01,
        carbohydrates_g: null,
        fat_g: 0,
      }),
      ingredient(2, {
        calories: 201,
        protein_g: 0.01,
        carbohydrates_g: 5,
        fat_g: null,
      }),
    ] as Json);
    boundaryRecipeId = await persist(userAClient, "Rounding boundaries", 1, [
      ingredient(1, { calories: 1, protein_g: 1 }),
    ] as Json);
    fractionalRecipeId = await persist(userAClient, "Fractional yield", 2.5, [
      ingredient(1, { calories: 1, protein_g: 0.1 }),
      ingredient(2, { calories: 2, protein_g: 0.2 }),
    ] as Json);
    overflowRecipeId = await persist(userAClient, "Diary overflow", 1, [
      ingredient(1, {
        calories: 2_147_483_647,
        protein_g: 999_999.99,
        carbohydrates_g: 999_999.99,
        fat_g: 999_999.99,
      }),
    ] as Json);
    incompleteRecipeId = await persist(userAClient, "Unknown nutrition", 1, [
      ingredient(1, {
        calories: null,
        protein_g: null,
        carbohydrates_g: null,
        fat_g: null,
      }),
    ] as Json);
  });

  test("installs a stable invoker RPC with authenticated-only execution", () => {
    const metadata = queryDatabase(`
      select concat_ws('|',
        p.provolatile,
        p.prosecdef,
        array_to_string(p.proconfig, ','),
        has_function_privilege('public', p.oid, 'execute'),
        has_function_privilege('anon', p.oid, 'execute'),
        has_function_privilege('authenticated', p.oid, 'execute'),
        pg_get_function_arguments(p.oid)
      )
      from pg_proc p
      where p.oid = 'public.get_owned_recipe_use_contract(uuid,numeric)'::regprocedure;
    `);
    expect(metadata).toBe(
      's|f|search_path=""|f|f|t|p_recipe_id uuid, p_requested_servings numeric',
    );

  });

  test("enforces complete ingredient collections at transaction end", async () => {
    const validRecipeId = randomUUID();
    queryDatabase(`
      begin;
      insert into public.recipes (id, user_id, name, locale, yield_servings)
      values ('${validRecipeId}', '${userAId}', 'Same transaction', 'en', 1);
      insert into public.recipe_ingredients (recipe_id, position, ingredient_name)
      values ('${validRecipeId}', 1, 'First');
      commit;
    `);
    expect(
      queryDatabase(
        `select count(*) from public.recipe_ingredients where recipe_id = '${validRecipeId}';`,
      ),
    ).toBe("1");

    expect(() =>
      queryDatabase(`
        insert into public.recipes (user_id, name, locale, yield_servings)
        values ('${userAId}', 'Empty collection', 'en', 1);
      `),
    ).toThrow();
    expect(() =>
      queryDatabase(
        `delete from public.recipe_ingredients where recipe_id = '${validRecipeId}';`,
      ),
    ).toThrow();
    expect(() =>
      queryDatabase(`
        update public.recipe_ingredients set position = 2
        where recipe_id = '${validRecipeId}' and position = 1;
      `),
    ).toThrow();

    const replaced = await userAClient.rpc("persist_recipe", {
      p_recipe_id: validRecipeId,
      p_name: "Same transaction replaced",
      p_locale: "en",
      p_yield_servings: 2,
      p_ingredients: [ingredient(1), ingredient(2)] as Json,
    });
    expect(replaced.error).toBeNull();
    expect(replaced.data?.[0].ingredient_count).toBe(2);

    const secondRecipeId = randomUUID();
    queryDatabase(`
      begin;
      insert into public.recipes (id, user_id, name, locale, yield_servings)
      values ('${secondRecipeId}', '${userAId}', 'Move target', 'en', 1);
      insert into public.recipe_ingredients (recipe_id, position, ingredient_name)
      values ('${secondRecipeId}', 1, 'Target first');
      commit;
    `);
    expect(() =>
      queryDatabase(`
        update public.recipe_ingredients
        set recipe_id = '${secondRecipeId}', position = 2
        where recipe_id = '${validRecipeId}' and position = 1;
      `),
    ).toThrow();

    queryDatabase(`delete from public.recipes where id in ('${validRecipeId}', '${secondRecipeId}');`);
    expect(
      queryDatabase(
        `select count(*) from public.recipe_ingredients where recipe_id in ('${validRecipeId}', '${secondRecipeId}');`,
      ),
    ).toBe("0");
  });

  test("derives exact values once and reports each nutrient's completeness independently", async () => {
    const result = await derive(userAClient, derivationRecipeId, 1.5);
    expect(result).toMatchObject({
      result_status: "ready",
      ingredient_count: 2,
      calories_known_ingredient_count: 2,
      calories_complete: true,
      calories_whole_recipe: 301,
      calories_requested: 150.5,
      diary_calories: 151,
      protein_known_ingredient_count: 2,
      protein_complete: true,
      protein_whole_recipe: 0.02,
      protein_requested: 0.01,
      diary_protein_g: 0.01,
      carbohydrates_known_ingredient_count: 1,
      carbohydrates_complete: false,
      carbohydrates_whole_recipe: null,
      carbohydrates_requested: null,
      diary_carbohydrates_g: null,
      fat_known_ingredient_count: 1,
      fat_complete: false,
      fat_whole_recipe: null,
      diary_fat_g: null,
    });
    expect(result?.calories_per_serving).toBeCloseTo(301 / 3, 10);

    const wholeRequest = await derive(userAClient, derivationRecipeId, 3);
    expect(wholeRequest?.calories_requested).toBe(301);
    expect(wholeRequest?.diary_calories).toBe(301);

    const fractional = await derive(userAClient, fractionalRecipeId, 1.25);
    expect(fractional).toMatchObject({
      calories_whole_recipe: 3,
      calories_per_serving: 1.2,
      calories_requested: 1.5,
      diary_calories: 2,
      protein_whole_recipe: 0.3,
      protein_per_serving: 0.12,
      protein_requested: 0.15,
      diary_protein_g: 0.15,
    });
    expect((await derive(userAClient, fractionalRecipeId, 2.5))?.calories_requested).toBe(3);
    expect((await derive(userAClient, fractionalRecipeId, 3))?.calories_requested).toBe(3.6);
  });

  test("uses PostgreSQL rounding at calorie and macro boundaries", async () => {
    for (const [requested, diaryCalories] of [
      [0.499, 0],
      [0.5, 1],
      [0.501, 1],
    ] as const) {
      expect((await derive(userAClient, boundaryRecipeId, requested))?.diary_calories).toBe(
        diaryCalories,
      );
    }
    for (const [requested, diaryProtein] of [
      [0.004, 0],
      [0.005, 0.01],
      [1.234, 1.23],
      [1.235, 1.24],
    ] as const) {
      expect((await derive(userAClient, boundaryRecipeId, requested))?.diary_protein_g).toBe(
        diaryProtein,
      );
    }
  });

  test("accepts diary maxima, classifies overflow, and does not treat unknowns as overflow", async () => {
    expect(await derive(userAClient, overflowRecipeId, 1)).toMatchObject({
      result_status: "ready",
      diary_calories: 2_147_483_647,
      diary_protein_g: 999_999.99,
      diary_carbohydrates_g: 999_999.99,
      diary_fat_g: 999_999.99,
    });
    const overflowCases = [
      {
        calories: 2_147_483_647,
        protein_g: null,
        carbohydrates_g: null,
        fat_g: null,
      },
      {
        calories: null,
        protein_g: 999_999.99,
        carbohydrates_g: null,
        fat_g: null,
      },
      {
        calories: null,
        protein_g: null,
        carbohydrates_g: 999_999.99,
        fat_g: null,
      },
      {
        calories: null,
        protein_g: null,
        carbohydrates_g: null,
        fat_g: 999_999.99,
      },
    ];
    for (const nutrientValues of overflowCases) {
      const updated = await userAClient
        .from("recipe_ingredients")
        .update(nutrientValues)
        .eq("recipe_id", overflowRecipeId);
      expect(updated.error).toBeNull();
      expect(await derive(userAClient, overflowRecipeId, 1.001)).toMatchObject({
        result_status: "not_loggable",
        calories_requested: null,
        protein_requested: null,
        carbohydrates_requested: null,
        fat_requested: null,
        diary_calories: null,
        diary_protein_g: null,
        diary_carbohydrates_g: null,
        diary_fat_g: null,
      });
    }
    expect(await derive(userAClient, incompleteRecipeId, 10_000)).toMatchObject({
      result_status: "ready",
      calories_complete: false,
      calories_requested: null,
      diary_calories: null,
    });
  });

  test("validates request precision in the database", async () => {
    for (const requested of [0, -1, 0.0009, 1.0001, 10_000.001, 10_001]) {
      const result = await userAClient.rpc("get_owned_recipe_use_contract", {
        p_recipe_id: derivationRecipeId,
        p_requested_servings: requested,
      } as UseArgs);
      expect(result.error?.code).toBe("22023");
    }
  });

  test("makes other-user and missing recipes indistinguishably unavailable", async () => {
    const other = await derive(userBClient, derivationRecipeId, 1);
    const missing = await derive(userBClient, randomUUID(), 1);
    expect(other).toEqual(missing);
    expect(other).toEqual({
      result_status: "unavailable",
      recipe_id: null,
      recipe_name: null,
      recipe_locale: null,
      is_archived: null,
      source_updated_at: null,
      yield_servings: null,
      requested_servings: null,
      ingredient_count: null,
      calories_known_ingredient_count: null,
      calories_complete: null,
      calories_whole_recipe: null,
      calories_per_serving: null,
      calories_requested: null,
      protein_known_ingredient_count: null,
      protein_complete: null,
      protein_whole_recipe: null,
      protein_per_serving: null,
      protein_requested: null,
      carbohydrates_known_ingredient_count: null,
      carbohydrates_complete: null,
      carbohydrates_whole_recipe: null,
      carbohydrates_per_serving: null,
      carbohydrates_requested: null,
      fat_known_ingredient_count: null,
      fat_complete: null,
      fat_whole_recipe: null,
      fat_per_serving: null,
      fat_requested: null,
      diary_calories: null,
      diary_protein_g: null,
      diary_carbohydrates_g: null,
      diary_fat_g: null,
    });
  });

  test("returns archived and transient invalid states without derived values", async () => {
    const activeVersion = (await derive(userAClient, derivationRecipeId, 1))
      ?.source_updated_at;
    await new Promise((resolve) => setTimeout(resolve, 5));
    expect(
      (
        await userAClient.rpc("set_recipe_archived", {
          p_recipe_id: derivationRecipeId,
          p_is_archived: true,
        })
      ).error,
    ).toBeNull();
    const archived = await derive(userAClient, derivationRecipeId, 1);
    expect(archived).toMatchObject({
      result_status: "archived",
      is_archived: true,
      ingredient_count: 2,
      calories_complete: true,
      calories_requested: null,
      diary_calories: null,
    });
    expect(archived?.source_updated_at).not.toBe(activeVersion);
    await new Promise((resolve) => setTimeout(resolve, 5));
    await userAClient.rpc("set_recipe_archived", {
      p_recipe_id: derivationRecipeId,
      p_is_archived: false,
    });
    const restored = await derive(userAClient, derivationRecipeId, 1);
    expect(restored).toMatchObject({ result_status: "ready", ingredient_count: 2 });
    expect(restored?.source_updated_at).not.toBe(archived?.source_updated_at);

    const invalidStatus = queryDatabase(`
      begin;
      set local role authenticated;
      set local request.jwt.claim.sub = '${userAId}';
      delete from public.recipe_ingredients where recipe_id = '${derivationRecipeId}';
      select result_status
      from public.get_owned_recipe_use_contract('${derivationRecipeId}', 1);
      rollback;
    `);
    expect(invalidStatus).toContain("invalid_recipe");
  });

  test("uses frozen snapshots, versions ingredient changes, and performs no unrelated writes", async () => {
    const publicFoodId = randomUUID();
    queryDatabase(`
      insert into public.foods (
        id, food_type, name, locale, data_quality, is_public, is_archived, source_id
      ) values (
        '${publicFoodId}', 'generic', 'Linked source', 'en', 'curated', true, false,
        (select id from public.food_sources where code = 'manual')
      );
    `);
    const linkedRecipeId = await persist(userAClient, "Frozen linked snapshot", 1, [
      ingredient(1, { food_id: publicFoodId, calories: 42, protein_g: 2 }),
    ] as Json);
    const before = await derive(userAClient, linkedRecipeId, 1);
    const unrelatedBefore = queryDatabase(`
      select (select count(*) from public.diary_entries) || '|' ||
        (select count(*) from public.saved_meals) || '|' ||
        (select count(*) from public.saved_meal_items);
    `);

    queryDatabase(`
      update public.foods set name = 'Changed source', is_archived = true
      where id = '${publicFoodId}';
      update public.foods set is_archived = false where id = '${publicFoodId}';
    `);
    const afterFoodEdit = await derive(userAClient, linkedRecipeId, 1);
    expect(afterFoodEdit).toMatchObject({
      calories_whole_recipe: 42,
      protein_whole_recipe: 2,
      source_updated_at: before?.source_updated_at,
    });

    const ingredientId = queryDatabase(
      `select id from public.recipe_ingredients where recipe_id = '${linkedRecipeId}';`,
    );
    await new Promise((resolve) => setTimeout(resolve, 5));
    expect(
      (
        await userAClient
          .from("recipe_ingredients")
          .update({ quantity: 2 })
          .eq("id", ingredientId)
      ).error,
    ).toBeNull();
    const afterIngredientEdit = await derive(userAClient, linkedRecipeId, 1);
    expect(afterIngredientEdit?.source_updated_at).not.toBe(before?.source_updated_at);
    expect(afterIngredientEdit?.calories_whole_recipe).toBe(42);

    await new Promise((resolve) => setTimeout(resolve, 5));
    queryDatabase(`delete from public.foods where id = '${publicFoodId}';`);
    const afterFoodDelete = await derive(userAClient, linkedRecipeId, 1);
    expect(afterFoodDelete?.source_updated_at).not.toBe(
      afterIngredientEdit?.source_updated_at,
    );
    expect(afterFoodDelete).toMatchObject({
      calories_whole_recipe: 42,
      protein_whole_recipe: 2,
    });
    expect(
      queryDatabase(`
        select (select count(*) from public.diary_entries) || '|' ||
          (select count(*) from public.saved_meals) || '|' ||
          (select count(*) from public.saved_meal_items);
      `),
    ).toBe(unrelatedBefore);
  });
});
