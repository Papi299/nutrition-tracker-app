import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { expect, test } from "@playwright/test";
import type { Database, Json } from "@/lib/supabase/database.types";

const localSupabaseUrl = process.env.LOCAL_SUPABASE_URL;
const localSupabasePublishableKey = process.env.LOCAL_SUPABASE_PUBLISHABLE_KEY;
const localOnly = process.env.DATE_E2E_LOCAL_SUPABASE === "1";
const password = "SavedMealPassword123!";
const projectId = readFileSync("supabase/config.toml", "utf8").match(
  /^project_id\s*=\s*"([^"]+)"/m,
)?.[1];

if (!projectId) throw new Error("Could not read the local Supabase project id.");

const databaseContainer = `supabase_db_${projectId}`;

test.skip(
  !localOnly || !localSupabaseUrl || !localSupabasePublishableKey,
  "Saved-meal persistence tests require the local-only test runner.",
);

type PersistArgs = Database["public"]["Functions"]["persist_saved_meal"]["Args"];
type NullablePersistArgs = Omit<PersistArgs, "p_saved_meal_id"> & {
  p_saved_meal_id: string | null;
};

test.describe.serial("saved-meal persistence foundation", () => {
  let userAClient: SupabaseClient<Database>;
  let userBClient: SupabaseClient<Database>;
  let userAId: string;
  let userAFoodId: string;
  let userAArchivedFoodId: string;
  let userBFoodId: string;
  let primaryMealId: string;
  const publicFoodId = randomUUID();
  const unavailableGlobalFoodId = randomUUID();
  const runId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;

  function localClient() {
    return createClient<Database>(
      localSupabaseUrl as string,
      localSupabasePublishableKey as string,
      { auth: { autoRefreshToken: false, persistSession: false } },
    );
  }

  function queryDatabase(statement: string) {
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

  function item(
    position: number,
    overrides: Record<string, Json | undefined> = {},
  ) {
    return {
      position,
      food_id: null,
      food_name: `Manual snapshot ${position}`,
      brand_name: "Snapshot Brand",
      serving_quantity: 1,
      serving_unit: "portion",
      calories: 100,
      protein_g: 4,
      carbohydrates_g: 12,
      fat_g: 3,
      notes: null,
      ...overrides,
    };
  }

  function args(
    overrides: Partial<NullablePersistArgs> = {},
  ): NullablePersistArgs {
    return {
      p_saved_meal_id: null,
      p_name: "Weekday breakfast",
      p_locale: "en",
      p_items: [item(1)] as Json,
      ...overrides,
    };
  }

  async function persist(
    client: SupabaseClient<Database>,
    overrides: Partial<NullablePersistArgs> = {},
  ) {
    return client.rpc("persist_saved_meal", args(overrides) as PersistArgs);
  }

  async function createCustomFood(
    client: SupabaseClient<Database>,
    name: string,
  ) {
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
    const userA = await createUser("saved-meal-a");
    const userB = await createUser("saved-meal-b");
    userAClient = userA.client;
    userBClient = userB.client;
    userAId = userA.userId;

    queryDatabase(`
      insert into public.foods (
        id, food_type, name, locale, data_quality, is_public, is_archived, source_id
      ) values
        (
          '${publicFoodId}', 'generic', 'Public fixture food', 'en', 'curated',
          true, false, (select id from public.food_sources where code = 'manual')
        ),
        (
          '${unavailableGlobalFoodId}', 'generic', 'Unavailable global food',
          'en', 'curated', false, false,
          (select id from public.food_sources where code = 'manual')
        );
    `);

    userAFoodId = await createCustomFood(userAClient, "Owned linked food");
    userAArchivedFoodId = await createCustomFood(userAClient, "Archived owned food");
    await userAClient.rpc("set_custom_food_archived", {
      p_food_id: userAArchivedFoodId,
      p_is_archived: true,
    });
    userBFoodId = await createCustomFood(userBClient, "Other private food");
  });

  test("creates the constrained schema, invoker RPCs, RLS, and least grants", () => {
    const state = queryDatabase(`
      select concat_ws('|', relname, relrowsecurity)
      from pg_class
      where oid in ('public.saved_meals'::regclass, 'public.saved_meal_items'::regclass)
      order by relname;

      select concat_ws('|',
        has_table_privilege('anon', 'public.saved_meals', 'select'),
        has_table_privilege('authenticated', 'public.saved_meals', 'select'),
        has_table_privilege('authenticated', 'public.saved_meals', 'delete'),
        has_table_privilege('anon', 'public.saved_meal_items', 'select'),
        has_table_privilege('authenticated', 'public.saved_meal_items', 'select'),
        has_table_privilege('authenticated', 'public.saved_meal_items', 'delete')
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
        'public.persist_saved_meal(uuid,text,text,jsonb)'::regprocedure,
        'public.set_saved_meal_archived(uuid,boolean)'::regprocedure
      );
    `);

    expect(state).toContain("saved_meal_items|t");
    expect(state).toContain("saved_meals|t");
    expect(state).toContain("f|t|f|f|t|t");
    expect(state).toContain('persist_saved_meal|f|f|t|f|search_path=""');
    expect(state).toContain('set_saved_meal_archived|f|f|t|f|search_path=""');

    expect(
      queryDatabase(`
        select count(*) from information_schema.columns
        where table_schema = 'public' and table_name = 'saved_meals'
          and column_name in ('total_calories', 'meal_type', 'is_public', 'description');
      `),
    ).toBe("0");
  });

  test("creates manual and linked snapshots in stable order, including duplicate links", async () => {
    const created = await persist(userAClient, {
      p_locale: "he",
      p_name: "  ארוחה שמורה  ",
      p_items: [
        item(1, {
          food_id: publicFoodId,
          food_name: "  Public snapshot  ",
          brand_name: "   ",
          serving_quantity: 0,
          serving_unit: "  g  ",
          calories: 0,
          protein_g: 0,
          carbohydrates_g: null,
          fat_g: 0,
          notes: "   ",
        }),
        item(2, { food_id: userAFoodId, food_name: "Owned snapshot" }),
        item(3, { food_id: userAArchivedFoodId, food_name: "Archived snapshot" }),
        item(4, { food_id: userAFoodId, food_name: "Duplicate link snapshot" }),
        item(5, { food_id: null, food_name: "Manual snapshot" }),
      ] as Json,
    });

    expect(created.error).toBeNull();
    expect(created.data?.[0]).toMatchObject({ is_archived: false, item_count: 5 });
    primaryMealId = created.data?.[0].saved_meal_id as string;

    const meal = await userAClient
      .from("saved_meals")
      .select("user_id,name,locale,is_archived")
      .eq("id", primaryMealId)
      .single();
    expect(meal.data).toEqual({
      user_id: userAId,
      name: "ארוחה שמורה",
      locale: "he",
      is_archived: false,
    });

    const items = await userAClient
      .from("saved_meal_items")
      .select("position,food_id,food_name,brand_name,serving_quantity,serving_unit,calories,protein_g,carbohydrates_g,fat_g,notes")
      .eq("saved_meal_id", primaryMealId)
      .order("position");
    expect(items.error).toBeNull();
    expect(items.data?.map(({ position }) => position)).toEqual([1, 2, 3, 4, 5]);
    expect(items.data?.[0]).toMatchObject({
      brand_name: null,
      calories: 0,
      carbohydrates_g: null,
      fat_g: 0,
      food_name: "Public snapshot",
      notes: null,
      protein_g: 0,
      serving_quantity: 0,
      serving_unit: "g",
    });
    expect(items.data?.filter(({ food_id }) => food_id === userAFoodId)).toHaveLength(2);
  });

  test("enforces ownership and linked-food readability through RLS and RPC validation", async () => {
    const otherRead = await userBClient
      .from("saved_meals")
      .select("id")
      .eq("id", primaryMealId);
    expect(otherRead.error).toBeNull();
    expect(otherRead.data).toEqual([]);

    const otherItemRead = await userBClient
      .from("saved_meal_items")
      .select("id")
      .eq("saved_meal_id", primaryMealId);
    expect(otherItemRead.data).toEqual([]);

    const spoofedMeal = await userBClient.from("saved_meals").insert({
      user_id: userAId,
      name: "Spoofed",
      locale: "en",
    });
    expect(spoofedMeal.error).not.toBeNull();

    const ownerlessMeal = await userAClient.from("saved_meals").insert({
      user_id: null as unknown as string,
      name: "Impossible public meal",
      locale: "en",
    });
    expect(ownerlessMeal.error).not.toBeNull();

    const otherUpdate = await persist(userBClient, {
      p_saved_meal_id: primaryMealId,
    });
    expect(otherUpdate.error).toBeNull();
    expect(otherUpdate.data?.[0]).toEqual({
      saved_meal_id: null,
      is_archived: null,
      item_count: null,
    });

    const otherItemInsert = await userBClient.from("saved_meal_items").insert({
      saved_meal_id: primaryMealId,
      position: 6,
      food_name: "Forbidden",
    });
    expect(otherItemInsert.error).not.toBeNull();

    const otherItemUpdate = await userBClient
      .from("saved_meal_items")
      .update({ food_name: "Forbidden update" })
      .eq("saved_meal_id", primaryMealId)
      .select("id");
    expect(otherItemUpdate.error).toBeNull();
    expect(otherItemUpdate.data).toEqual([]);

    const otherItemDelete = await userBClient
      .from("saved_meal_items")
      .delete()
      .eq("saved_meal_id", primaryMealId)
      .select("id");
    expect(otherItemDelete.error).toBeNull();
    expect(otherItemDelete.data).toEqual([]);

    const otherPrivateLink = await persist(userAClient, {
      p_items: [item(1, { food_id: userBFoodId })] as Json,
    });
    expect(otherPrivateLink.error?.code).toBe("22023");

    const unavailableGlobalLink = await persist(userAClient, {
      p_items: [item(1, { food_id: unavailableGlobalFoodId })] as Json,
    });
    expect(unavailableGlobalLink.error?.code).toBe("22023");

    const deleteMeal = await userAClient
      .from("saved_meals")
      .delete()
      .eq("id", primaryMealId);
    expect(deleteMeal.error).not.toBeNull();
  });

  test("accepts 1 and 50 items and rejects count, shape, numeric, and position errors", async () => {
    expect((await persist(userAClient)).error).toBeNull();
    expect(
      (
        await persist(userAClient, {
          p_items: Array.from({ length: 50 }, (_, index) => item(index + 1)) as Json,
        })
      ).error,
    ).toBeNull();

    const invalidPayloads: Json[] = [
      {} as Json,
      [],
      Array.from({ length: 51 }, (_, index) => item(index + 1)) as Json,
      [item(-1)],
      [item(0)],
      [item(1), item(1)],
      [item(1), item(3)],
      [item(1, { calories: 1.5 })],
      [item(1, { calories: -1 })],
      [item(1, { protein_g: -1 })],
      [item(1, { total_calories: 100 })],
      [{ ...item(1), notes: undefined }] as Json,
      [{ ...item(1), position: undefined }] as Json,
    ];

    for (const p_items of invalidPayloads) {
      const result = await persist(userAClient, { p_items });
      expect(result.error?.code).toBe("22023");
    }

    for (const invalidIdentity of [
      { p_name: "   " },
      { p_name: "n".repeat(201) },
      { p_locale: "fr" },
      { p_locale: null as unknown as string },
    ]) {
      const result = await persist(userAClient, invalidIdentity);
      expect(result.error?.code).toBe("22023");
    }
  });

  test("replaces the complete item collection, clears nullable fields, and updates timestamps only for changes", async () => {
    const before = await userAClient
      .from("saved_meals")
      .select("updated_at")
      .eq("id", primaryMealId)
      .single();

    const replacement = [
      item(1, {
        food_id: null,
        food_name: "Replacement",
        brand_name: null,
        serving_quantity: null,
        serving_unit: null,
        calories: null,
        protein_g: null,
        carbohydrates_g: 0,
        fat_g: null,
        notes: null,
      }),
      item(2, {
        food_id: publicFoodId,
        food_name: "Second replacement",
        serving_quantity: 1.2345,
        protein_g: 4.555,
      }),
    ] as Json;

    const changed = await persist(userAClient, {
      p_saved_meal_id: primaryMealId,
      p_name: "Replacement meal",
      p_locale: "und",
      p_items: replacement,
    });
    expect(changed.error).toBeNull();
    expect(changed.data?.[0].item_count).toBe(2);

    const afterChange = await userAClient
      .from("saved_meals")
      .select("updated_at,is_archived")
      .eq("id", primaryMealId)
      .single();
    expect(afterChange.data?.updated_at).not.toBe(before.data?.updated_at);

    const rows = await userAClient
      .from("saved_meal_items")
      .select("position,brand_name,serving_quantity,serving_unit,calories,protein_g,carbohydrates_g,fat_g,notes")
      .eq("saved_meal_id", primaryMealId)
      .order("position");
    expect(rows.data).toHaveLength(2);
    expect(rows.data?.[0]).toMatchObject({
      brand_name: null,
      serving_quantity: null,
      serving_unit: null,
      calories: null,
      protein_g: null,
      carbohydrates_g: 0,
      fat_g: null,
      notes: null,
    });

    const identical = await persist(userAClient, {
      p_saved_meal_id: primaryMealId,
      p_name: "Replacement meal",
      p_locale: "und",
      p_items: replacement,
    });
    expect(identical.error).toBeNull();

    const afterIdentical = await userAClient
      .from("saved_meals")
      .select("updated_at")
      .eq("id", primaryMealId)
      .single();
    expect(afterIdentical.data?.updated_at).toBe(afterChange.data?.updated_at);
    expect(
      queryDatabase(`select count(*) from public.saved_meal_items where saved_meal_id = '${primaryMealId}';`),
    ).toBe("2");
  });

  test("rolls back meal identity and prior items when a later item is invalid or unreadable", async () => {
    const before = queryDatabase(`
      select name || '|' || locale || '|' || updated_at || '|' ||
        (select string_agg(position || ':' || food_name, ',' order by position)
         from public.saved_meal_items where saved_meal_id = saved_meals.id)
      from public.saved_meals where id = '${primaryMealId}';
    `);

    for (const p_items of [
      [item(1), item(2, { calories: -5 })],
      [item(1), item(2, { food_id: userBFoodId })],
    ] as Json[][]) {
      const result = await persist(userAClient, {
        p_saved_meal_id: primaryMealId,
        p_name: "Must roll back",
        p_locale: "en",
        p_items,
      });
      expect(result.error).not.toBeNull();
      expect(
        queryDatabase(`
          select name || '|' || locale || '|' || updated_at || '|' ||
            (select string_agg(position || ':' || food_name, ',' order by position)
             from public.saved_meal_items where saved_meal_id = saved_meals.id)
          from public.saved_meals where id = '${primaryMealId}';
        `),
      ).toBe(before);
    }
  });

  test("archives, updates while archived, restores, and keeps archive submissions idempotent", async () => {
    const archived = await userAClient.rpc("set_saved_meal_archived", {
      p_saved_meal_id: primaryMealId,
      p_is_archived: true,
    });
    expect(archived.data?.[0]).toEqual({
      saved_meal_id: primaryMealId,
      is_archived: true,
    });

    const archivedTimestamp = (
      await userAClient
        .from("saved_meals")
        .select("updated_at")
        .eq("id", primaryMealId)
        .single()
    ).data?.updated_at;
    const repeated = await userAClient.rpc("set_saved_meal_archived", {
      p_saved_meal_id: primaryMealId,
      p_is_archived: true,
    });
    expect(repeated.error).toBeNull();
    expect(
      (
        await userAClient
          .from("saved_meals")
          .select("updated_at")
          .eq("id", primaryMealId)
          .single()
      ).data?.updated_at,
    ).toBe(archivedTimestamp);

    const updatedArchived = await persist(userAClient, {
      p_saved_meal_id: primaryMealId,
      p_name: "Archived but editable",
      p_locale: "en",
      p_items: [item(1)] as Json,
    });
    expect(updatedArchived.data?.[0].is_archived).toBe(true);

    const otherArchive = await userBClient.rpc("set_saved_meal_archived", {
      p_saved_meal_id: primaryMealId,
      p_is_archived: false,
    });
    expect(otherArchive.error).toBeNull();
    expect(otherArchive.data?.[0]).toEqual({
      saved_meal_id: null,
      is_archived: null,
    });

    const restored = await userAClient.rpc("set_saved_meal_archived", {
      p_saved_meal_id: primaryMealId,
      p_is_archived: false,
    });
    expect(restored.data?.[0].is_archived).toBe(false);
  });

  test("keeps snapshots stable through linked-food update, archive, restore, and deletion", async () => {
    const linkedFoodId = await createCustomFood(userAClient, "Live original name");
    const created = await persist(userAClient, {
      p_name: "Snapshot lifecycle meal",
      p_items: [
        item(1, {
          food_id: linkedFoodId,
          food_name: "Frozen snapshot name",
          brand_name: "Frozen brand",
          calories: 321,
        }),
      ] as Json,
    });
    const mealId = created.data?.[0].saved_meal_id as string;

    const updatedFood = await userAClient.rpc("persist_custom_food", {
      p_aliases: [] as Json,
      p_brand_name: "Live changed brand",
      p_food_id: linkedFoodId,
      p_locale: "he",
      p_name: "שם חי שונה",
      p_nutrient_basis: "per_serving",
      p_nutrients: [] as Json,
      p_serving_quantity: 2,
      p_serving_unit: "cups",
    });
    expect(updatedFood.error).toBeNull();

    for (const isArchived of [true, false]) {
      const result = await userAClient.rpc("set_custom_food_archived", {
        p_food_id: linkedFoodId,
        p_is_archived: isArchived,
      });
      expect(result.error).toBeNull();
    }

    let snapshot = await userAClient
      .from("saved_meal_items")
      .select("food_id,food_name,brand_name,calories")
      .eq("saved_meal_id", mealId)
      .single();
    expect(snapshot.data).toEqual({
      food_id: linkedFoodId,
      food_name: "Frozen snapshot name",
      brand_name: "Frozen brand",
      calories: 321,
    });

    const deleted = await userAClient.from("foods").delete().eq("id", linkedFoodId);
    expect(deleted.error).toBeNull();
    snapshot = await userAClient
      .from("saved_meal_items")
      .select("food_id,food_name,brand_name,calories")
      .eq("saved_meal_id", mealId)
      .single();
    expect(snapshot.data).toEqual({
      food_id: null,
      food_name: "Frozen snapshot name",
      brand_name: "Frozen brand",
      calories: 321,
    });
  });

  test("does not create or mutate diary entries and cascades meals when the user is deleted", async () => {
    const diaryCreated = await userAClient
      .from("diary_entries")
      .insert({
        user_id: userAId,
        entry_date: "2026-07-16",
        meal_type: "lunch",
        food_id: publicFoodId,
        food_name: "Historical diary snapshot",
        brand_name: "Historical brand",
        serving_quantity: 2,
        serving_unit: "servings",
        calories: 444,
        protein_g: 11,
        carbohydrates_g: 22,
        fat_g: 33,
        notes: "Must remain independent",
      })
      .select("*")
      .single();
    expect(diaryCreated.error).toBeNull();
    const diaryBefore = diaryCreated.data;

    const result = await persist(userAClient, {
      p_name: "Diary-independent meal",
      p_items: [item(1, { calories: 999, food_id: publicFoodId })] as Json,
    });
    expect(result.error).toBeNull();
    const changedMeal = await persist(userAClient, {
      p_saved_meal_id: result.data?.[0].saved_meal_id as string,
      p_name: "Changed independent meal",
      p_items: [item(1, { calories: 1, food_id: null })] as Json,
    });
    expect(changedMeal.error).toBeNull();

    const diaryAfter = await userAClient
      .from("diary_entries")
      .select("*")
      .eq("id", diaryBefore?.id as string)
      .single();
    expect(diaryAfter.error).toBeNull();
    expect(diaryAfter.data).toEqual(diaryBefore);

    const temporary = await createUser("saved-meal-cascade");
    const temporaryMeal = await persist(temporary.client, {
      p_name: "Cascade meal",
      p_items: [item(1)] as Json,
    });
    const temporaryMealId = temporaryMeal.data?.[0].saved_meal_id as string;
    queryDatabase(`delete from auth.users where id = '${temporary.userId}';`);
    expect(
      queryDatabase(`select count(*) from public.saved_meals where id = '${temporaryMealId}';`),
    ).toBe("0");
    expect(
      queryDatabase(`select count(*) from public.saved_meal_items where saved_meal_id = '${temporaryMealId}';`),
    ).toBe("0");
  });
});
