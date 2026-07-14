import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { expect, test } from "@playwright/test";
import type { Database, Json } from "@/lib/supabase/database.types";

const localSupabaseUrl = process.env.LOCAL_SUPABASE_URL;
const localSupabasePublishableKey = process.env.LOCAL_SUPABASE_PUBLISHABLE_KEY;
const localOnly = process.env.DATE_E2E_LOCAL_SUPABASE === "1";
const password = "CustomFoodPassword123!";
const supabaseProjectId = readFileSync("supabase/config.toml", "utf8").match(
  /^project_id\s*=\s*"([^"]+)"/m,
)?.[1];

if (!supabaseProjectId) {
  throw new Error("Could not read the local Supabase project id.");
}

const databaseContainer = `supabase_db_${supabaseProjectId}`;

test.skip(
  !localOnly || !localSupabaseUrl || !localSupabasePublishableKey,
  "Custom-food persistence tests require the local-only test runner.",
);

type PersistArgs = Database["public"]["Functions"]["persist_custom_food"]["Args"];
type NullablePersistArgs = Omit<
  PersistArgs,
  "p_brand_name" | "p_food_id" | "p_serving_quantity" | "p_serving_unit"
> & {
  p_brand_name: string | null;
  p_food_id: string | null;
  p_serving_quantity: number | null;
  p_serving_unit: string | null;
};

const expectedNutrientCodes = [
  "energy_kcal",
  "protein_g",
  "carbohydrates_g",
  "fiber_g",
  "sugars_g",
  "added_sugars_g",
  "fat_g",
  "saturated_fat_g",
  "monounsaturated_fat_g",
  "polyunsaturated_fat_g",
  "trans_fat_g",
  "cholesterol_mg",
  "sodium_mg",
  "potassium_mg",
  "calcium_mg",
  "iron_mg",
  "magnesium_mg",
  "phosphorus_mg",
  "zinc_mg",
  "copper_mg",
  "manganese_mg",
  "selenium_ug",
  "vitamin_a_rae_ug",
  "vitamin_c_mg",
  "vitamin_d_ug",
  "vitamin_e_mg",
  "vitamin_k_ug",
  "thiamin_mg",
  "riboflavin_mg",
  "niacin_mg",
  "pantothenic_acid_mg",
  "vitamin_b6_mg",
  "folate_dfe_ug",
  "vitamin_b12_ug",
  "choline_mg",
] as const;

test.describe.serial("custom food nutrient and persistence foundation", () => {
  let userAClient: SupabaseClient<Database>;
  let userBClient: SupabaseClient<Database>;
  let userAId: string;
  let userAFoodId: string;
  let userBFoodId: string;
  let archivedFoodId: string;
  const publicFoodId = randomUUID();
  const runId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;

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

  async function createUser(prefix: string) {
    const client = localClient();
    const signUp = await client.auth.signUp({
      email: `${prefix}-${runId}@example.test`,
      password,
    });

    expect(signUp.error).toBeNull();
    expect(signUp.data.session).not.toBeNull();
    expect(signUp.data.user?.id).toBeTruthy();

    return { client, userId: signUp.data.user?.id as string };
  }

  function persistenceArgs(
    overrides: Partial<NullablePersistArgs> = {},
  ): NullablePersistArgs {
    return {
      p_aliases: [
        { alias_text: "  Everyday   oats  ", language_code: "en" },
        { alias_text: "  שיבולת   שועל  ", language_code: "he" },
        { alias_text: "Oats שיבולת", language_code: "und" },
      ] as Json,
      p_brand_name: "Kitchen Brand",
      p_food_id: null,
      p_locale: "en",
      p_name: "Everyday Oats",
      p_nutrient_basis: "per_serving",
      p_nutrients: [
        { amount: 140, code: "energy_kcal" },
        { amount: 5, code: "protein_g" },
        { amount: 0, code: "fat_g" },
        { amount: 27, code: "carbohydrates_g" },
      ] as Json,
      p_serving_quantity: 40,
      p_serving_unit: "g serving",
      ...overrides,
    };
  }

  async function persist(
    client: SupabaseClient<Database>,
    overrides: Partial<NullablePersistArgs> = {},
  ) {
    return client.rpc(
      "persist_custom_food",
      persistenceArgs(overrides) as PersistArgs,
    );
  }

  test.beforeAll(async () => {
    const userA = await createUser("custom-food-a");
    const userB = await createUser("custom-food-b");
    userAClient = userA.client;
    userAId = userA.userId;
    userBClient = userB.client;

    queryLocalDatabase(`
      insert into public.foods (
        id, food_type, name, locale, data_quality, is_public, is_archived,
        source_id
      ) values (
        '${publicFoodId}', 'generic', 'Phase 7A Public Food', 'en', 'curated',
        true, false,
        (select id from public.food_sources where code = 'manual')
      );
    `);

    const otherFood = await persist(userBClient, {
      p_aliases: [] as Json,
      p_brand_name: null,
      p_locale: "he",
      p_name: "מזון פרטי של משתמש אחר",
      p_nutrient_basis: "per_100g",
      p_nutrients: [{ amount: 88, code: "energy_kcal" }] as Json,
      p_serving_quantity: null,
      p_serving_unit: null,
    });
    expect(otherFood.error).toBeNull();
    userBFoodId = otherFood.data?.[0].food_id as string;
  });

  test("installs the complete bilingual V1 nutrient dictionary", async () => {
    const nutrients = await userAClient
      .from("nutrients")
      .select(
        "code,name_en,name_he,unit,nutrient_group,display_order,is_energy,is_macro,is_required_for_mvp",
      )
      .order("display_order");

    expect(nutrients.error).toBeNull();
    expect(nutrients.data).toHaveLength(35);
    expect(nutrients.data?.map(({ code }) => code)).toEqual(
      expectedNutrientCodes,
    );
    expect(nutrients.data).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "fiber_g",
          name_en: "Dietary Fiber",
          name_he: "סיבים תזונתיים",
          nutrient_group: "macro",
          unit: "g",
        }),
        expect.objectContaining({
          code: "selenium_ug",
          name_en: "Selenium",
          name_he: "סלניום",
          nutrient_group: "mineral",
          unit: "ug",
        }),
        expect.objectContaining({
          code: "vitamin_b12_ug",
          name_en: "Vitamin B12",
          name_he: "ויטמין B12",
          nutrient_group: "vitamin",
          unit: "ug",
        }),
      ]),
    );
    expect(new Set(nutrients.data?.map(({ display_order }) => display_order)).size).toBe(35);
  });

  test("keeps both invoker RPCs authenticated-only and preserves table RLS", () => {
    const state = queryLocalDatabase(`
      select string_agg(result, E'\\n' order by result)
      from (
        select concat_ws('|',
          p.proname,
          has_function_privilege('public', p.oid, 'execute'),
          has_function_privilege('anon', p.oid, 'execute'),
          has_function_privilege('authenticated', p.oid, 'execute'),
          p.prosecdef,
          array_to_string(p.proconfig, ',')
        ) as result
        from pg_proc p
        where p.oid in (
          'public.persist_custom_food(uuid,text,text,text,text,numeric,text,jsonb,jsonb)'::regprocedure,
          'public.set_custom_food_archived(uuid,boolean)'::regprocedure
        )
      ) checks;

      select relname || '|' || relrowsecurity
      from pg_class
      where oid in (
        'public.foods'::regclass,
        'public.food_nutrients'::regclass,
        'public.food_aliases'::regclass,
        'public.diary_entries'::regclass
      )
      order by relname;
    `);

    expect(state).toContain(
      'persist_custom_food|f|f|t|f|search_path=""',
    );
    expect(state).toContain(
      'set_custom_food_archived|f|f|t|f|search_path=""',
    );
    expect(state).toContain("food_aliases|true");
    expect(state).toContain("food_nutrients|true");
    expect(state).toContain("foods|true");
    expect(state).toContain("diary_entries|true");
  });

  test("creates one owned private custom food with one basis and raw aliases", async () => {
    const created = await persist(userAClient);

    expect(created.error).toBeNull();
    expect(created.data?.[0]).toMatchObject({
      is_archived: false,
      nutrient_basis: "per_serving",
    });
    userAFoodId = created.data?.[0].food_id as string;

    const food = await userAClient
      .from("foods")
      .select("*,food_sources(code)")
      .eq("id", userAFoodId)
      .single();
    expect(food.data).toMatchObject({
      brand_name: "Kitchen Brand",
      data_quality: "user_provided",
      food_sources: { code: "user_custom" },
      food_type: "user_custom",
      is_archived: false,
      is_public: false,
      locale: "en",
      name: "Everyday Oats",
      owner_user_id: userAId,
      serving_size: 40,
      serving_unit: "g serving",
      source_food_id: null,
    });

    const nutrients = await userAClient
      .from("food_nutrients")
      .select("amount,basis,nutrients(code)")
      .eq("food_id", userAFoodId);
    expect(nutrients.error).toBeNull();
    expect(nutrients.data).toHaveLength(4);
    expect(nutrients.data).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          amount: 0,
          basis: "per_serving",
          nutrients: { code: "fat_g" },
        }),
      ]),
    );
    expect(new Set(nutrients.data?.map(({ basis }) => basis))).toEqual(
      new Set(["per_serving"]),
    );

    const aliases = await userAClient
      .from("food_aliases")
      .select("alias_text,language_code,normalized_alias")
      .eq("food_id", userAFoodId);
    expect(aliases.data).toEqual(
      expect.arrayContaining([
        {
          alias_text: "  Everyday   oats  ",
          language_code: "en",
          normalized_alias: "everyday oats",
        },
        {
          alias_text: "  שיבולת   שועל  ",
          language_code: "he",
          normalized_alias: "שיבולת שועל",
        },
        {
          alias_text: "Oats שיבולת",
          language_code: "und",
          normalized_alias: "oats שיבולת",
        },
      ]),
    );
  });

  test("forces 100 g and 100 ml while accepting expanded nutrients and zero", async () => {
    const per100g = await persist(userAClient, {
      p_aliases: [{ alias_text: "טחינה מלאה", language_code: "he" }] as Json,
      p_brand_name: "מותג",
      p_locale: "he",
      p_name: "טחינה",
      p_nutrient_basis: "per_100g",
      p_nutrients: [
        { amount: 0, code: "fiber_g" },
        { amount: 4.2, code: "iron_mg" },
        { amount: 0.8, code: "vitamin_b6_mg" },
      ] as Json,
      p_serving_quantity: 7,
      p_serving_unit: "ignored",
    });
    const per100ml = await persist(userAClient, {
      p_aliases: [{ alias_text: "Drink משקה", language_code: "und" }] as Json,
      p_brand_name: null,
      p_locale: "und",
      p_name: "Mixed drink",
      p_nutrient_basis: "per_100ml",
      p_nutrients: [
        { amount: 9, code: "sugars_g" },
        { amount: 1.4, code: "vitamin_c_mg" },
      ] as Json,
      p_serving_quantity: null,
      p_serving_unit: null,
    });

    expect(per100g.error).toBeNull();
    expect(per100ml.error).toBeNull();

    const foods = await userAClient
      .from("foods")
      .select("id,serving_size,serving_unit")
      .in("id", [
        per100g.data?.[0].food_id as string,
        per100ml.data?.[0].food_id as string,
      ]);
    expect(foods.data).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ serving_size: 100, serving_unit: "g" }),
        expect.objectContaining({ serving_size: 100, serving_unit: "ml" }),
      ]),
    );
  });

  test("rejects malformed collections and invalid serving values atomically", async () => {
    const invalidPayloads: Partial<NullablePersistArgs>[] = [
      { p_serving_quantity: null },
      { p_serving_unit: "   " },
      { p_nutrients: [{ amount: 1, code: "unknown_code" }] as Json },
      {
        p_nutrients: [
          { amount: 1, code: "protein_g" },
          { amount: 2, code: "protein_g" },
        ] as Json,
      },
      { p_nutrients: [{ amount: -1, code: "protein_g" }] as Json },
      { p_aliases: [{ alias_text: "  ", language_code: "en" }] as Json },
      {
        p_aliases: [
          { alias_text: "Duplicate Alias", language_code: "en" },
          { alias_text: " duplicate   alias ", language_code: "en" },
        ] as Json,
      },
      {
        p_aliases: Array.from({ length: 21 }, (_, index) => ({
          alias_text: `Alias ${index}`,
          language_code: "en",
        })) as Json,
      },
    ];

    for (const invalidPayload of invalidPayloads) {
      const invalid = await persist(userAClient, invalidPayload);
      expect(invalid.error).not.toBeNull();
      expect(invalid.data).toBeNull();
    }
  });

  test("fully replaces nutrients and aliases without changing diary snapshots", async () => {
    const diary = await userAClient
      .from("diary_entries")
      .insert({
        brand_name: "Snapshot Brand",
        calories: 140,
        carbohydrates_g: 27,
        entry_date: "2026-07-14",
        fat_g: 0,
        food_id: userAFoodId,
        food_name: "Snapshot Oats",
        meal_type: "breakfast",
        protein_g: 5,
        serving_quantity: 40,
        serving_unit: "g serving",
        user_id: userAId,
      })
      .select("id")
      .single();
    expect(diary.error).toBeNull();

    const updated = await persist(userAClient, {
      p_aliases: [{ alias_text: "Replacement alias", language_code: "en" }] as Json,
      p_brand_name: "Replacement Brand",
      p_food_id: userAFoodId,
      p_name: "Replacement Oats",
      p_nutrient_basis: "per_100g",
      p_nutrients: [
        { amount: 222, code: "energy_kcal" },
        { amount: 8.5, code: "fiber_g" },
        { amount: 0, code: "sodium_mg" },
      ] as Json,
      p_serving_quantity: null,
      p_serving_unit: null,
    });
    expect(updated.error).toBeNull();

    const nutrients = await userAClient
      .from("food_nutrients")
      .select("amount,basis,nutrients(code)")
      .eq("food_id", userAFoodId);
    expect(nutrients.data).toHaveLength(3);
    expect(nutrients.data).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          amount: 8.5,
          basis: "per_100g",
          nutrients: { code: "fiber_g" },
        }),
        expect.objectContaining({
          amount: 0,
          basis: "per_100g",
          nutrients: { code: "sodium_mg" },
        }),
      ]),
    );
    expect(
      nutrients.data?.some(({ nutrients: nutrient }) =>
        Array.isArray(nutrient)
          ? false
          : nutrient?.code === "protein_g",
      ),
    ).toBe(false);

    const aliases = await userAClient
      .from("food_aliases")
      .select("alias_text")
      .eq("food_id", userAFoodId);
    expect(aliases.data).toEqual([{ alias_text: "Replacement alias" }]);

    const snapshot = await userAClient
      .from("diary_entries")
      .select("food_name,brand_name,calories,protein_g,carbohydrates_g,fat_g,food_id")
      .eq("id", diary.data?.id as string)
      .single();
    expect(snapshot.data).toEqual({
      brand_name: "Snapshot Brand",
      calories: 140,
      carbohydrates_g: 27,
      fat_g: 0,
      food_id: userAFoodId,
      food_name: "Snapshot Oats",
      protein_g: 5,
    });
  });

  test("preserves timestamps and child identities on an identical update", async () => {
    const args = {
      p_aliases: [{ alias_text: "Replacement alias", language_code: "en" }] as Json,
      p_brand_name: "Replacement Brand",
      p_food_id: userAFoodId,
      p_name: "Replacement Oats",
      p_nutrient_basis: "per_100g",
      p_nutrients: [
        { amount: 222, code: "energy_kcal" },
        { amount: 8.5, code: "fiber_g" },
        { amount: 0, code: "sodium_mg" },
      ] as Json,
      p_serving_quantity: null,
      p_serving_unit: null,
    } satisfies Partial<NullablePersistArgs>;
    const before = queryLocalDatabase(`
      select jsonb_build_object(
        'food_updated_at', (select updated_at from public.foods where id = '${userAFoodId}'),
        'nutrients', (select jsonb_agg(jsonb_build_array(id, updated_at) order by id) from public.food_nutrients where food_id = '${userAFoodId}'),
        'aliases', (select jsonb_agg(jsonb_build_array(id, updated_at) order by id) from public.food_aliases where food_id = '${userAFoodId}')
      )::text;
    `);

    const repeated = await persist(userAClient, args);
    expect(repeated.error).toBeNull();

    const after = queryLocalDatabase(`
      select jsonb_build_object(
        'food_updated_at', (select updated_at from public.foods where id = '${userAFoodId}'),
        'nutrients', (select jsonb_agg(jsonb_build_array(id, updated_at) order by id) from public.food_nutrients where food_id = '${userAFoodId}'),
        'aliases', (select jsonb_agg(jsonb_build_array(id, updated_at) order by id) from public.food_aliases where food_id = '${userAFoodId}')
      )::text;
    `);
    expect(after).toBe(before);
  });

  test("rolls back food and child changes when a nutrient write fails", async () => {
    const before = queryLocalDatabase(`
      select jsonb_build_object(
        'food', (select to_jsonb(f) - 'updated_at' from public.foods f where id = '${userAFoodId}'),
        'nutrients', (select jsonb_agg(to_jsonb(n) - 'updated_at' order by id) from public.food_nutrients n where food_id = '${userAFoodId}'),
        'aliases', (select jsonb_agg(to_jsonb(a) - 'updated_at' order by id) from public.food_aliases a where food_id = '${userAFoodId}')
      )::text;
    `);

    const failed = await persist(userAClient, {
      p_aliases: [{ alias_text: "Should Roll Back", language_code: "en" }] as Json,
      p_brand_name: "Should Roll Back",
      p_food_id: userAFoodId,
      p_name: "Should Roll Back",
      // Finite/nonnegative, but intentionally exceeds numeric(14,4) storage.
      p_nutrients: [{ amount: 10_000_000_000, code: "energy_kcal" }] as Json,
    });
    expect(failed.error?.code).toBe("22003");

    const after = queryLocalDatabase(`
      select jsonb_build_object(
        'food', (select to_jsonb(f) - 'updated_at' from public.foods f where id = '${userAFoodId}'),
        'nutrients', (select jsonb_agg(to_jsonb(n) - 'updated_at' order by id) from public.food_nutrients n where food_id = '${userAFoodId}'),
        'aliases', (select jsonb_agg(to_jsonb(a) - 'updated_at' order by id) from public.food_aliases a where food_id = '${userAFoodId}')
      )::text;
    `);
    expect(after).toBe(before);
  });

  test("clears complete child collections and blocks unauthorized writes", async () => {
    const cleared = await persist(userAClient, {
      p_aliases: [] as Json,
      p_food_id: userAFoodId,
      p_nutrients: [] as Json,
    });
    expect(cleared.error).toBeNull();

    const childCount = queryLocalDatabase(`
      select
        (select count(*) from public.food_nutrients where food_id = '${userAFoodId}') || '|' ||
        (select count(*) from public.food_aliases where food_id = '${userAFoodId}');
    `);
    expect(childCount).toBe("0|0");

    for (const inaccessibleFoodId of [userBFoodId, publicFoodId]) {
      const write = await persist(userAClient, {
        p_food_id: inaccessibleFoodId,
        p_name: "Unauthorized replacement",
      });
      expect(write.error, `persist ${inaccessibleFoodId}`).toBeNull();
      expect(write.data).toEqual([
        { food_id: null, is_archived: null, nutrient_basis: null },
      ]);

      const archive = await userAClient.rpc("set_custom_food_archived", {
        p_food_id: inaccessibleFoodId,
        p_is_archived: true,
      });
      expect(archive.error, `archive ${inaccessibleFoodId}`).toBeNull();
      expect(archive.data).toEqual([{ food_id: null, is_archived: null }]);
    }

    const otherFood = await userBClient
      .from("foods")
      .select("name,is_archived")
      .eq("id", userBFoodId)
      .single();
    expect(otherFood.data).toEqual({
      is_archived: false,
      name: "מזון פרטי של משתמש אחר",
    });
    expect(queryLocalDatabase(`select name from public.foods where id = '${publicFoodId}';`)).toBe(
      "Phase 7A Public Food",
    );
  });

  test("archives without deletion, hides search and prefill, then restores both", async () => {
    const created = await persist(userAClient, {
      p_aliases: [{ alias_text: "Archive search alias", language_code: "en" }] as Json,
      p_brand_name: null,
      p_name: "Phase 7A Archive Candidate",
      p_nutrients: [
        { amount: 321, code: "energy_kcal" },
        { amount: 0, code: "protein_g" },
      ] as Json,
    });
    expect(created.error).toBeNull();
    archivedFoodId = created.data?.[0].food_id as string;

    const diary = await userAClient
      .from("diary_entries")
      .insert({
        calories: 321,
        entry_date: "2026-07-13",
        food_id: archivedFoodId,
        food_name: "Archived snapshot",
        meal_type: "lunch",
        protein_g: 0,
        user_id: userAId,
      })
      .select("id")
      .single();
    expect(diary.error).toBeNull();

    const archived = await userAClient.rpc("set_custom_food_archived", {
      p_food_id: archivedFoodId,
      p_is_archived: true,
    });
    expect(archived.error).toBeNull();
    expect(archived.data?.[0]).toEqual({
      food_id: archivedFoodId,
      is_archived: true,
    });

    const archivedSearch = await userAClient.rpc("search_readable_foods", {
      p_query: "Phase 7A Archive Candidate",
    });
    const archivedPrefill = await userAClient.rpc(
      "get_readable_food_diary_prefill",
      { p_food_id: archivedFoodId },
    );
    expect(archivedSearch.data).toEqual([]);
    expect(archivedPrefill.data).toEqual([]);
    expect(
      queryLocalDatabase(`
        select
          (select count(*) from public.foods where id = '${archivedFoodId}') || '|' ||
          (select count(*) from public.food_nutrients where food_id = '${archivedFoodId}') || '|' ||
          (select count(*) from public.food_aliases where food_id = '${archivedFoodId}');
      `),
    ).toBe("1|2|1");

    const snapshot = await userAClient
      .from("diary_entries")
      .select("food_id,food_name,calories,protein_g")
      .eq("id", diary.data?.id as string)
      .single();
    expect(snapshot.data).toEqual({
      calories: 321,
      food_id: archivedFoodId,
      food_name: "Archived snapshot",
      protein_g: 0,
    });

    const unarchived = await userAClient.rpc("set_custom_food_archived", {
      p_food_id: archivedFoodId,
      p_is_archived: false,
    });
    expect(unarchived.data?.[0].is_archived).toBe(false);

    const restoredSearch = await userAClient.rpc("search_readable_foods", {
      p_query: "Phase 7A Archive Candidate",
    });
    const restoredPrefill = await userAClient.rpc(
      "get_readable_food_diary_prefill",
      { p_food_id: archivedFoodId },
    );
    expect(restoredSearch.data?.[0].food_id).toBe(archivedFoodId);
    expect(restoredPrefill.data?.[0]).toMatchObject({
      calories: 321,
      food_id: archivedFoodId,
      protein_g: 0,
    });
  });
});
