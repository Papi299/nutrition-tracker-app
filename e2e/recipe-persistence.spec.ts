import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { expect, test } from "@playwright/test";
import type { Database, Json } from "@/lib/supabase/database.types";

const localSupabaseUrl = process.env.LOCAL_SUPABASE_URL;
const localSupabasePublishableKey = process.env.LOCAL_SUPABASE_PUBLISHABLE_KEY;
const localOnly = process.env.DATE_E2E_LOCAL_SUPABASE === "1";
const password = "RecipePassword123!";
const projectId = readFileSync("supabase/config.toml", "utf8").match(
  /^project_id\s*=\s*"([^"]+)"/m,
)?.[1];

if (!projectId) throw new Error("Could not read the local Supabase project id.");
const databaseContainer = `supabase_db_${projectId}`;

test.skip(
  !localOnly || !localSupabaseUrl || !localSupabasePublishableKey,
  "Recipe persistence tests require the local-only test runner.",
);

type PersistArgs = Database["public"]["Functions"]["persist_recipe"]["Args"];
type NullablePersistArgs = Omit<PersistArgs, "p_recipe_id"> & {
  p_recipe_id: string | null;
};

test.describe.serial("recipe persistence foundation", () => {
  let userAClient: SupabaseClient<Database>;
  let userBClient: SupabaseClient<Database>;
  let userAId: string;
  let userAFoodId: string;
  let userAArchivedFoodId: string;
  let userBFoodId: string;
  let primaryRecipeId: string;
  const publicFoodId = randomUUID();
  const unavailableGlobalFoodId = randomUUID();
  const constraintRecipeId = randomUUID();
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

  function ingredient(position: number, overrides: Record<string, Json | undefined> = {}) {
    return {
      position,
      food_id: null,
      ingredient_name: `Manual ingredient ${position}`,
      brand_name: "Snapshot brand",
      quantity: 1,
      unit: "portion",
      calories: 100,
      protein_g: 4,
      carbohydrates_g: 12,
      fat_g: 3,
      notes: null,
      ...overrides,
    };
  }

  function args(overrides: Partial<NullablePersistArgs> = {}): NullablePersistArgs {
    return {
      p_recipe_id: null,
      p_name: "Vegetable soup",
      p_locale: "en",
      p_yield_servings: 4,
      p_ingredients: [ingredient(1)] as Json,
      ...overrides,
    };
  }

  async function persist(
    client: SupabaseClient<Database>,
    overrides: Partial<NullablePersistArgs> = {},
  ) {
    return client.rpc("persist_recipe", args(overrides) as PersistArgs);
  }

  async function createCustomFood(client: SupabaseClient<Database>, name: string) {
    const result = await client.rpc("persist_custom_food", {
      p_aliases: [] as Json,
      p_brand_name: null as unknown as string,
      p_food_id: null as unknown as string,
      p_locale: "en",
      p_name: name,
      p_nutrient_basis: "per_serving",
      p_nutrients: [] as Json,
      p_serving_quantity: 1,
      p_serving_unit: "portion",
    });
    expect(result.error).toBeNull();
    return result.data?.[0].food_id as string;
  }

  test.beforeAll(async () => {
    const userA = await createUser("recipe-a");
    const userB = await createUser("recipe-b");
    userAClient = userA.client;
    userBClient = userB.client;
    userAId = userA.userId;

    queryDatabase(`
      insert into public.foods (
        id, food_type, name, locale, data_quality, is_public, is_archived, source_id
      ) values
        (
          '${publicFoodId}', 'generic', 'Public recipe food', 'en', 'curated',
          true, false, (select id from public.food_sources where code = 'manual')
        ),
        (
          '${unavailableGlobalFoodId}', 'generic', 'Unavailable recipe food',
          'en', 'curated', false, false,
          (select id from public.food_sources where code = 'manual')
        );
    `);
    userAFoodId = await createCustomFood(userAClient, "Owned recipe food");
    userAArchivedFoodId = await createCustomFood(userAClient, "Archived recipe food");
    await userAClient.rpc("set_custom_food_archived", {
      p_food_id: userAArchivedFoodId,
      p_is_archived: true,
    });
    userBFoodId = await createCustomFood(userBClient, "Other recipe food");
  });

  test("creates constrained tables, invoker RPCs, RLS, indexes, and least grants", () => {
    const state = queryDatabase(`
      select concat_ws('|', relname, relrowsecurity)
      from pg_class
      where oid in ('public.recipes'::regclass, 'public.recipe_ingredients'::regclass)
      order by relname;

      select concat_ws('|',
        has_table_privilege('anon', 'public.recipes', 'select'),
        has_table_privilege('authenticated', 'public.recipes', 'select'),
        has_table_privilege('authenticated', 'public.recipes', 'delete'),
        has_table_privilege('anon', 'public.recipe_ingredients', 'select'),
        has_table_privilege('authenticated', 'public.recipe_ingredients', 'select'),
        has_table_privilege('authenticated', 'public.recipe_ingredients', 'delete')
      );

      select string_agg(concat_ws('|', p.proname,
        has_function_privilege('public', p.oid, 'execute'),
        has_function_privilege('anon', p.oid, 'execute'),
        has_function_privilege('authenticated', p.oid, 'execute'),
        p.prosecdef,
        array_to_string(p.proconfig, ',')
      ), E'\n' order by p.proname)
      from pg_proc p
      where p.oid in (
        'public.persist_recipe(uuid,text,text,numeric,jsonb)'::regprocedure,
        'public.set_recipe_archived(uuid,boolean)'::regprocedure
      );

      select count(*) from pg_indexes
      where schemaname = 'public' and indexname in (
        'recipes_user_archive_updated_idx',
        'recipe_ingredients_position_key',
        'recipe_ingredients_food_idx'
      );
    `);

    expect(state).toContain("recipe_ingredients|t");
    expect(state).toContain("recipes|t");
    expect(state).toContain("f|t|f|f|t|t");
    expect(state).toContain('persist_recipe|f|f|t|f|search_path=""');
    expect(state).toContain('set_recipe_archived|f|f|t|f|search_path=""');
    expect(state).toContain("3");
    expect(
      queryDatabase(`
        select count(*) from information_schema.columns
        where table_schema = 'public' and table_name = 'recipes'
          and column_name in (
            'total_calories', 'default_meal_type', 'is_public', 'description',
            'instructions', 'image_url', 'prep_time'
          );
      `),
    ).toBe("0");

    queryDatabase(`
      insert into public.recipes (id, user_id, name, locale, yield_servings)
      values ('${constraintRecipeId}', '${userAId}', 'Constraint fixture', 'und', 1);
      insert into public.recipe_ingredients (
        recipe_id, position, ingredient_name, quantity, unit
      ) values ('${constraintRecipeId}', 1, 'Salt to taste', null, null);
    `);
    expect(() =>
      queryDatabase(`
        insert into public.recipes (user_id, name, locale, yield_servings)
        values ('${userAId}', 'Invalid yield', 'en', 0);
      `),
    ).toThrow();
    expect(() =>
      queryDatabase(`
        insert into public.recipe_ingredients (
          recipe_id, position, ingredient_name, quantity, unit
        ) values ('${constraintRecipeId}', 2, 'Invalid pair', 1, null);
      `),
    ).toThrow();
    expect(() =>
      queryDatabase(`
        insert into public.recipe_ingredients (
          recipe_id, position, ingredient_name, quantity, unit
        ) values ('${constraintRecipeId}', 2, 'Invalid quantity', 0, 'g');
      `),
    ).toThrow();
  });

  test("creates manual and linked snapshots in stable order with positive yield", async () => {
    const created = await persist(userAClient, {
      p_locale: "he",
      p_name: "  מרק ירקות  ",
      p_yield_servings: 2.5,
      p_ingredients: [
        ingredient(1, {
          food_id: publicFoodId,
          ingredient_name: "  Public snapshot  ",
          brand_name: "   ",
          quantity: null,
          unit: null,
          calories: 0,
          protein_g: 0,
          carbohydrates_g: null,
          fat_g: 0,
          notes: "   ",
        }),
        ingredient(2, { food_id: userAFoodId, ingredient_name: "Owned snapshot" }),
        ingredient(3, {
          food_id: userAArchivedFoodId,
          ingredient_name: "Archived snapshot",
        }),
        ingredient(4, { food_id: userAFoodId, ingredient_name: "Duplicate link" }),
        ingredient(5, { food_id: null, ingredient_name: "Manual snapshot" }),
      ] as Json,
    });

    expect(created.error).toBeNull();
    expect(created.data?.[0]).toMatchObject({ is_archived: false, ingredient_count: 5 });
    primaryRecipeId = created.data?.[0].recipe_id as string;

    const recipe = await userAClient
      .from("recipes")
      .select("user_id,name,locale,yield_servings,is_archived")
      .eq("id", primaryRecipeId)
      .single();
    expect(recipe.data).toEqual({
      user_id: userAId,
      name: "מרק ירקות",
      locale: "he",
      yield_servings: 2.5,
      is_archived: false,
    });

    const ingredients = await userAClient
      .from("recipe_ingredients")
      .select("position,food_id,ingredient_name,brand_name,quantity,unit,calories,protein_g,carbohydrates_g,fat_g,notes")
      .eq("recipe_id", primaryRecipeId)
      .order("position");
    expect(ingredients.error).toBeNull();
    expect(ingredients.data?.map(({ position }) => position)).toEqual([1, 2, 3, 4, 5]);
    expect(ingredients.data?.[0]).toMatchObject({
      brand_name: null,
      calories: 0,
      carbohydrates_g: null,
      fat_g: 0,
      ingredient_name: "Public snapshot",
      notes: null,
      protein_g: 0,
      quantity: null,
      unit: null,
    });
    expect(ingredients.data?.filter(({ food_id }) => food_id === userAFoodId)).toHaveLength(2);
  });

  test("enforces ownership and readable-food links through direct RLS and RPC writes", async () => {
    expect(
      (await userBClient.from("recipes").select("id").eq("id", primaryRecipeId)).data,
    ).toEqual([]);
    expect(
      (
        await userBClient
          .from("recipe_ingredients")
          .select("id")
          .eq("recipe_id", primaryRecipeId)
      ).data,
    ).toEqual([]);

    const spoofed = await userBClient.from("recipes").insert({
      user_id: userAId,
      name: "Spoofed",
      locale: "en",
      yield_servings: 1,
    });
    expect(spoofed.error).not.toBeNull();

    const otherUpdate = await persist(userBClient, { p_recipe_id: primaryRecipeId });
    expect(otherUpdate.error).toBeNull();
    expect(otherUpdate.data?.[0]).toEqual({
      recipe_id: null,
      is_archived: null,
      ingredient_count: null,
    });

    const otherInsert = await userBClient.from("recipe_ingredients").insert({
      recipe_id: primaryRecipeId,
      position: 6,
      ingredient_name: "Forbidden",
    });
    expect(otherInsert.error).not.toBeNull();

    for (const food_id of [userBFoodId, unavailableGlobalFoodId]) {
      const result = await persist(userAClient, {
        p_ingredients: [ingredient(1, { food_id })] as Json,
      });
      expect(result.error?.code).toBe("22023");
    }

    const deletion = await userAClient.from("recipes").delete().eq("id", primaryRecipeId);
    expect(deletion.error).not.toBeNull();
  });

  test("accepts 1 and 50 ingredients and rejects yield, shape, pairing, numeric, and position errors", async () => {
    expect((await persist(userAClient)).error).toBeNull();
    expect(
      (
        await persist(userAClient, {
          p_ingredients: Array.from({ length: 50 }, (_, index) =>
            ingredient(index + 1),
          ) as Json,
        })
      ).error,
    ).toBeNull();

    const invalidIngredients: Json[] = [
      {} as Json,
      [],
      Array.from({ length: 51 }, (_, index) => ingredient(index + 1)) as Json,
      [ingredient(0)],
      [ingredient(1), ingredient(1)],
      [ingredient(1), ingredient(3)],
      [ingredient(1, { quantity: null, unit: "g" })],
      [ingredient(1, { quantity: 1, unit: null })],
      [ingredient(1, { quantity: 0, unit: "g" })],
      [ingredient(1, { quantity: 0.0004, unit: "g" })],
      [ingredient(1, { calories: 1.5 })],
      [ingredient(1, { protein_g: -1 })],
      [ingredient(1, { total_calories: 100 })],
      [{ ...ingredient(1), notes: undefined }] as Json,
    ];
    for (const p_ingredients of invalidIngredients) {
      expect((await persist(userAClient, { p_ingredients })).error?.code).toBe("22023");
    }

    for (const invalid of [
      { p_name: "   " },
      { p_locale: "fr" },
      { p_yield_servings: 0 },
      { p_yield_servings: 0.0004 },
      { p_yield_servings: -1 },
      { p_yield_servings: 10000.001 },
    ]) {
      expect((await persist(userAClient, invalid)).error?.code).toBe("22023");
    }
  });

  test("full-replaces, reorders, clears, unlinks, and preserves child ids on identical submissions", async () => {
    const originalTimestamp = queryDatabase(
      `select updated_at from public.recipes where id = '${primaryRecipeId}';`,
    );
    const replacement = [
      ingredient(1, {
        food_id: null,
        ingredient_name: "Salt to taste",
        brand_name: null,
        quantity: null,
        unit: null,
        calories: null,
        protein_g: null,
        carbohydrates_g: 0,
        fat_g: null,
        notes: null,
      }),
      ingredient(2, {
        food_id: publicFoodId,
        ingredient_name: "Second ingredient",
        quantity: 1.2345,
        protein_g: 4.555,
      }),
    ] as Json;
    const changed = await persist(userAClient, {
      p_recipe_id: primaryRecipeId,
      p_name: "Updated recipe",
      p_locale: "und",
      p_yield_servings: 8,
      p_ingredients: replacement,
    });
    expect(changed.error).toBeNull();
    expect(
      queryDatabase(`select updated_at from public.recipes where id = '${primaryRecipeId}';`),
    ).not.toBe(originalTimestamp);

    const beforeIdentical = queryDatabase(`
      select updated_at || '|' ||
        (select string_agg(id::text, ',' order by position)
         from public.recipe_ingredients where recipe_id = recipes.id)
      from public.recipes where id = '${primaryRecipeId}';
    `);
    const identical = await persist(userAClient, {
      p_recipe_id: primaryRecipeId,
      p_name: "Updated recipe",
      p_locale: "und",
      p_yield_servings: 8,
      p_ingredients: replacement,
    });
    expect(identical.error).toBeNull();
    expect(
      queryDatabase(`
        select updated_at || '|' ||
          (select string_agg(id::text, ',' order by position)
           from public.recipe_ingredients where recipe_id = recipes.id)
        from public.recipes where id = '${primaryRecipeId}';
      `),
    ).toBe(beforeIdentical);

    const rows = await userAClient
      .from("recipe_ingredients")
      .select("position,food_id,ingredient_name,quantity,unit,calories,carbohydrates_g")
      .eq("recipe_id", primaryRecipeId)
      .order("position");
    expect(rows.data?.[0]).toMatchObject({
      food_id: null,
      ingredient_name: "Salt to taste",
      quantity: null,
      unit: null,
      calories: null,
      carbohydrates_g: 0,
    });
  });

  test("rolls back identity, yield, and ingredients when a later ingredient is invalid or unreadable", async () => {
    const before = queryDatabase(`
      select name || '|' || yield_servings || '|' || updated_at || '|' ||
        (select string_agg(position || ':' || ingredient_name, ',' order by position)
         from public.recipe_ingredients where recipe_id = recipes.id)
      from public.recipes where id = '${primaryRecipeId}';
    `);
    for (const p_ingredients of [
      [ingredient(1), ingredient(2, { calories: -5 })],
      [ingredient(1), ingredient(2, { food_id: userBFoodId })],
    ] as Json[][]) {
      const result = await persist(userAClient, {
        p_recipe_id: primaryRecipeId,
        p_name: "Must roll back",
        p_yield_servings: 9,
        p_ingredients,
      });
      expect(result.error).not.toBeNull();
      expect(
        queryDatabase(`
          select name || '|' || yield_servings || '|' || updated_at || '|' ||
            (select string_agg(position || ':' || ingredient_name, ',' order by position)
             from public.recipe_ingredients where recipe_id = recipes.id)
          from public.recipes where id = '${primaryRecipeId}';
        `),
      ).toBe(before);
    }
  });

  test("archives idempotently, edits while archived, restores, and preserves ingredients", async () => {
    const archived = await userAClient.rpc("set_recipe_archived", {
      p_recipe_id: primaryRecipeId,
      p_is_archived: true,
    });
    expect(archived.data?.[0]).toEqual({ recipe_id: primaryRecipeId, is_archived: true });
    const archivedState = queryDatabase(`
      select updated_at || '|' || (select count(*) from public.recipe_ingredients
        where recipe_id = recipes.id) from public.recipes where id = '${primaryRecipeId}';
    `);
    expect(
      (
        await userAClient.rpc("set_recipe_archived", {
          p_recipe_id: primaryRecipeId,
          p_is_archived: true,
        })
      ).error,
    ).toBeNull();
    expect(
      queryDatabase(`
        select updated_at || '|' || (select count(*) from public.recipe_ingredients
          where recipe_id = recipes.id) from public.recipes where id = '${primaryRecipeId}';
      `),
    ).toBe(archivedState);

    const updated = await persist(userAClient, {
      p_recipe_id: primaryRecipeId,
      p_name: "Archived but editable",
      p_ingredients: [ingredient(1)] as Json,
    });
    expect(updated.data?.[0].is_archived).toBe(true);
    expect(
      (
        await userBClient.rpc("set_recipe_archived", {
          p_recipe_id: primaryRecipeId,
          p_is_archived: false,
        })
      ).data?.[0],
    ).toEqual({ recipe_id: null, is_archived: null });
    expect(
      (
        await userAClient.rpc("set_recipe_archived", {
          p_recipe_id: primaryRecipeId,
          p_is_archived: false,
        })
      ).data?.[0].is_archived,
    ).toBe(false);
  });

  test("keeps snapshots authoritative when a linked food changes, archives, restores, or deletes", async () => {
    const linkedFoodId = await createCustomFood(userAClient, "Live original");
    const created = await persist(userAClient, {
      p_name: "Lifecycle recipe",
      p_ingredients: [
        ingredient(1, {
          food_id: linkedFoodId,
          ingredient_name: "Frozen ingredient",
          brand_name: "Frozen brand",
          calories: 321,
        }),
      ] as Json,
    });
    const recipeId = created.data?.[0].recipe_id as string;

    expect(
      (
        await userAClient.rpc("persist_custom_food", {
          p_aliases: [] as Json,
          p_brand_name: "Changed brand",
          p_food_id: linkedFoodId,
          p_locale: "he",
          p_name: "שם שונה",
          p_nutrient_basis: "per_serving",
          p_nutrients: [] as Json,
          p_serving_quantity: 2,
          p_serving_unit: "cups",
        })
      ).error,
    ).toBeNull();
    for (const p_is_archived of [true, false]) {
      expect(
        (
          await userAClient.rpc("set_custom_food_archived", {
            p_food_id: linkedFoodId,
            p_is_archived,
          })
        ).error,
      ).toBeNull();
    }

    let snapshot = await userAClient
      .from("recipe_ingredients")
      .select("food_id,ingredient_name,brand_name,calories")
      .eq("recipe_id", recipeId)
      .single();
    expect(snapshot.data).toEqual({
      food_id: linkedFoodId,
      ingredient_name: "Frozen ingredient",
      brand_name: "Frozen brand",
      calories: 321,
    });
    expect((await userAClient.from("foods").delete().eq("id", linkedFoodId)).error).toBeNull();
    snapshot = await userAClient
      .from("recipe_ingredients")
      .select("food_id,ingredient_name,brand_name,calories")
      .eq("recipe_id", recipeId)
      .single();
    expect(snapshot.data).toEqual({
      food_id: null,
      ingredient_name: "Frozen ingredient",
      brand_name: "Frozen brand",
      calories: 321,
    });
  });

  test("does not mutate diary or saved meals and cascades recipes with their user", async () => {
    const before = queryDatabase(`
      select (select count(*) from public.diary_entries) || '|' ||
        (select count(*) from public.saved_meals) || '|' ||
        (select count(*) from public.saved_meal_items);
    `);
    const result = await persist(userAClient, {
      p_name: "Independent recipe",
      p_ingredients: [ingredient(1, { food_id: publicFoodId })] as Json,
    });
    expect(result.error).toBeNull();
    expect(
      queryDatabase(`
        select (select count(*) from public.diary_entries) || '|' ||
          (select count(*) from public.saved_meals) || '|' ||
          (select count(*) from public.saved_meal_items);
      `),
    ).toBe(before);

    const temporary = await createUser("recipe-cascade");
    const temporaryRecipe = await persist(temporary.client);
    const temporaryRecipeId = temporaryRecipe.data?.[0].recipe_id as string;
    queryDatabase(`delete from auth.users where id = '${temporary.userId}';`);
    expect(
      queryDatabase(`select count(*) from public.recipes where id = '${temporaryRecipeId}';`),
    ).toBe("0");
    expect(
      queryDatabase(
        `select count(*) from public.recipe_ingredients where recipe_id = '${temporaryRecipeId}';`,
      ),
    ).toBe("0");
  });
});
