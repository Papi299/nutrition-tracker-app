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
type VersionedPersistArgs = Extract<
  PersistArgs,
  { p_expected_edit_revision: number }
>;
type NullablePersistArgs = Omit<
  VersionedPersistArgs,
  | "p_brand_name"
  | "p_expected_edit_revision"
  | "p_food_id"
  | "p_serving_quantity"
  | "p_serving_unit"
> & {
  p_brand_name: string | null;
  p_expected_edit_revision: number | null;
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

  function executeLocalDatabase(statement: string) {
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

  function queryLocalDatabase(statement: string) {
    let lastError: unknown;

    for (let attempt = 0; attempt < 5; attempt += 1) {
      try {
        return executeLocalDatabase(statement);
      } catch (error) {
        lastError = error;

        if (attempt < 4) {
          execFileSync("sleep", ["1"]);
        }
      }
    }

    throw lastError;
  }

  function editRevision(foodId: string) {
    return Number(
      queryLocalDatabase(`
        select custom_food_edit_revision
        from public.foods
        where id = '${foodId}';
      `),
    );
  }

  function aggregateFingerprint(foodId: string) {
    return queryLocalDatabase(`
      select jsonb_build_object(
        'name', foods.name,
        'brand', foods.brand_name,
        'locale', foods.locale,
        'basis', foods.custom_nutrient_basis,
        'serving_size', foods.serving_size,
        'serving_unit', foods.serving_unit,
        'is_archived', foods.is_archived,
        'revision', foods.custom_food_edit_revision,
        'nutrients', (
          select coalesce(
            jsonb_agg(
              jsonb_build_object(
                'code', nutrients.code,
                'amount', food_nutrients.amount,
                'basis', food_nutrients.basis
              ) order by nutrients.code
            ),
            '[]'::jsonb
          )
          from public.food_nutrients
          join public.nutrients on nutrients.id = food_nutrients.nutrient_id
          where food_nutrients.food_id = foods.id
        ),
        'aliases', (
          select coalesce(
            jsonb_agg(
              jsonb_build_object(
                'text', food_aliases.alias_text,
                'language', food_aliases.language_code
              ) order by food_aliases.id
            ),
            '[]'::jsonb
          )
          from public.food_aliases
          where food_aliases.food_id = foods.id
        )
      )
      from public.foods
      where foods.id = '${foodId}';
    `);
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
      p_expected_edit_revision: null,
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
    const args = persistenceArgs(overrides);

    if (args.p_food_id && args.p_expected_edit_revision === null) {
      const currentRevision = queryLocalDatabase(`
          select custom_food_edit_revision
          from public.foods
          where id = '${args.p_food_id}';
        `);
      args.p_expected_edit_revision =
        currentRevision === "" ? 1 : Number(currentRevision);
    }

    return client.rpc("persist_custom_food", args as VersionedPersistArgs);
  }

  async function persistVersioned(
    client: SupabaseClient<Database>,
    args: NullablePersistArgs,
  ) {
    return client.rpc("persist_custom_food", args as VersionedPersistArgs);
  }

  async function requirePromptRpc<T>(label: string, operation: PromiseLike<T>) {
    let timer: ReturnType<typeof setTimeout> | undefined;

    try {
      return await Promise.race([
        operation,
        new Promise<never>((_, reject) => {
          timer = setTimeout(
            () => reject(new Error(`${label} RPC did not settle promptly.`)),
            5_000,
          );
        }),
      ]);
    } finally {
      if (timer) clearTimeout(timer);
    }
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

  test("keeps mutation RPCs authenticated-only and revision helpers least-privileged", () => {
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
          'public.persist_custom_food(uuid,text,text,text,text,numeric,text,jsonb,jsonb,bigint)'::regprocedure,
          'public.set_custom_food_archived(uuid,boolean)'::regprocedure,
          'public.enforce_custom_food_edit_revision()'::regprocedure,
          'public.advance_custom_food_edit_revision_from_child()'::regprocedure
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

      select conname || '|' || pg_get_constraintdef(oid)
      from pg_constraint
      where conrelid = 'public.foods'::regclass
        and conname = 'foods_custom_nutrient_basis_check';

      select 'revision_constraint|' || pg_get_constraintdef(oid)
      from pg_constraint
      where conrelid = 'public.foods'::regclass
        and conname = 'foods_custom_food_edit_revision_check';

      select 'creation_only_wrapper|' ||
        (position(
          'Existing custom foods require an expected edit revision.' in
          pg_get_functiondef(
            'public.persist_custom_food(uuid,text,text,text,text,numeric,text,jsonb,jsonb)'::regprocedure
          )
        ) > 0);

      select 'revision_triggers|' || count(*)
      from pg_trigger
      where not tgisinternal
        and tgname like '%custom_food_edit_revision%';
    `);

    expect(state).toContain(
      'persist_custom_food|f|f|t|f|search_path=""',
    );
    expect(state).toContain(
      'set_custom_food_archived|f|f|t|f|search_path=""',
    );
    expect(state).toContain(
      'enforce_custom_food_edit_revision|f|f|f|f|search_path=""',
    );
    expect(state).toContain(
      'advance_custom_food_edit_revision_from_child|f|f|f|t|search_path=""',
    );
    expect(state).toContain("food_aliases|true");
    expect(state).toContain("food_nutrients|true");
    expect(state).toContain("foods|true");
    expect(state).toContain("diary_entries|true");
    expect(state).toContain(
      "foods_custom_nutrient_basis_check|CHECK",
    );
    expect(state).toContain("custom_nutrient_basis IS NOT NULL");
    expect(state).toContain("revision_constraint|CHECK");
    expect(state).toContain("custom_food_edit_revision");
    expect(state).toContain("custom_food_edit_revision IS NOT NULL");
    expect(state).toContain("creation_only_wrapper|true");
    expect(state).toContain("revision_triggers|7");
  });

  test("rejects a null custom-food revision at the constraint boundary", () => {
    const nullRevisionFoodId = randomUUID();
    const nonCustomFoodId = randomUUID();

    const proof = queryLocalDatabase(`
      do $constraint_test$
      declare
        rejected_constraint text;
      begin
        set local session_replication_role = replica;

        begin
          insert into public.foods (
            id, owner_user_id, source_id, food_type, name, locale,
            custom_nutrient_basis, custom_food_edit_revision, data_quality,
            is_public, is_archived
          ) values (
            '${nullRevisionFoodId}', '${userAId}',
            (select id from public.food_sources where code = 'user_custom'),
            'user_custom', 'Null revision constraint probe', 'en',
            'per_serving', null, 'user_provided', false, false
          );

          raise exception 'Expected null custom-food revision rejection.';
        exception
          when check_violation then
            get stacked diagnostics rejected_constraint = constraint_name;
            if rejected_constraint <> 'foods_custom_food_edit_revision_check' then
              raise exception 'Unexpected constraint: %', rejected_constraint;
            end if;
        end;

        insert into public.foods (
          id, source_id, food_type, name, locale,
          custom_food_edit_revision, data_quality, is_public, is_archived
        ) values (
          '${nonCustomFoodId}',
          (select id from public.food_sources where code = 'manual'),
          'generic', 'Null non-custom revision probe', 'en', null, 'curated',
          true, false
        );
      end;
      $constraint_test$;

      select
        (select count(*) from public.foods where id = '${nullRevisionFoodId}')
        || '|' ||
        (select custom_food_edit_revision is null from public.foods where id = '${nonCustomFoodId}');
    `);

    expect(proof).toContain("0|t");
    queryLocalDatabase(`delete from public.foods where id = '${nonCustomFoodId}';`);
  });

  test("enforces custom-food nutrient bases with strict null semantics", () => {
    const nullInsertId = randomUUID();
    const validBasisIds = [randomUUID(), randomUUID(), randomUUID()];

    queryLocalDatabase(`
      do $constraint_test$
      begin
        insert into public.foods (
          id, owner_user_id, source_id, food_type, name, locale,
          custom_nutrient_basis, data_quality, is_public, is_archived
        ) values (
          '${nullInsertId}', '${userAId}',
          (select id from public.food_sources where code = 'user_custom'),
          'user_custom', 'Missing basis', 'en', null, 'user_provided', false,
          false
        );

        raise exception 'Expected null custom-food basis rejection.';
      exception
        when check_violation then null;
      end;
      $constraint_test$;
    `);
    expect(
      queryLocalDatabase(`
        select count(*) from public.foods where id = '${nullInsertId}';
      `),
    ).toBe("0");

    queryLocalDatabase(`
      insert into public.foods (
        id, owner_user_id, source_id, food_type, name, locale,
        custom_nutrient_basis, data_quality, is_public, is_archived
      ) values
        (
          '${validBasisIds[0]}', '${userAId}',
          (select id from public.food_sources where code = 'user_custom'),
          'user_custom', 'Valid per serving', 'en', 'per_serving',
          'user_provided', false, false
        ),
        (
          '${validBasisIds[1]}', '${userAId}',
          (select id from public.food_sources where code = 'user_custom'),
          'user_custom', 'Valid per 100 grams', 'en', 'per_100g',
          'user_provided', false, false
        ),
        (
          '${validBasisIds[2]}', '${userAId}',
          (select id from public.food_sources where code = 'user_custom'),
          'user_custom', 'Valid per 100 milliliters', 'en', 'per_100ml',
          'user_provided', false, false
        );
    `);
    expect(
      queryLocalDatabase(`
        select count(*) || '|' || count(distinct custom_nutrient_basis)
        from public.foods
        where id in (${validBasisIds.map((id) => `'${id}'`).join(",")});
      `),
    ).toBe("3|3");

    queryLocalDatabase(`
      do $constraint_test$
      begin
        update public.foods
        set custom_nutrient_basis = null
        where id = '${validBasisIds[1]}';

        raise exception 'Expected null custom-food basis update rejection.';
      exception
        when check_violation then null;
      end;
      $constraint_test$;
    `);
    expect(
      queryLocalDatabase(`
        select custom_nutrient_basis
        from public.foods
        where id = '${validBasisIds[1]}';
      `),
    ).toBe("per_100g");

    queryLocalDatabase(`
      do $constraint_test$
      declare
        rejected_basis text;
      begin
        foreach rejected_basis in array array[
          'per_serving',
          'per_100g',
          'per_100ml'
        ] loop
          begin
            update public.foods
            set custom_nutrient_basis = rejected_basis
            where id = '${publicFoodId}';

            raise exception 'Expected non-custom basis rejection for %.',
              rejected_basis;
          exception
            when check_violation then null;
          end;
        end loop;
      end;
      $constraint_test$;
    `);
    expect(
      queryLocalDatabase(`
        select custom_nutrient_basis is null
        from public.foods
        where id = '${publicFoodId}';
      `),
    ).toBe("t");

    queryLocalDatabase(`
      delete from public.foods
      where id in (${validBasisIds.map((id) => `'${id}'`).join(",")});
    `);
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
      custom_nutrient_basis: "per_serving",
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

  test("advances child revisions when the creation marker is absent in a fresh backend", async () => {
    const created = await persistVersioned(userAClient, persistenceArgs({
      p_aliases: [{ alias_text: "Fresh backend alias", language_code: "en" }] as Json,
      p_name: "Fresh backend revision food",
      p_nutrients: [{ amount: 17, code: "energy_kcal" }] as Json,
    }));
    expect(created.error).toBeNull();
    const foodId = created.data?.[0].food_id as string;

    // One new psql process creates one new PostgreSQL backend. Every statement
    // below therefore runs in the same session without prior custom-GUC state.
    const freshBackendOutput = executeLocalDatabase(`
      create temporary table fresh_backend_revision_proof as
      select
        current_setting(
          'nutrition_tracker.creating_custom_food_id',
          true
        ) is null as marker_absent,
        custom_food_edit_revision as revision_before,
        null::bigint as revision_after_alias,
        null::bigint as revision_after_nutrient
      from public.foods
      where id = '${foodId}';

      update public.food_aliases
      set alias_text = 'Fresh backend alias changed'
      where food_id = '${foodId}';

      update fresh_backend_revision_proof
      set revision_after_alias = (
        select custom_food_edit_revision
        from public.foods
        where id = '${foodId}'
      );

      update public.food_nutrients
      set amount = amount + 1
      where food_id = '${foodId}';

      update fresh_backend_revision_proof
      set revision_after_nutrient = (
        select custom_food_edit_revision
        from public.foods
        where id = '${foodId}'
      );

      select concat_ws(
        '|', marker_absent, revision_before, revision_after_alias,
        revision_after_nutrient
      )
      from fresh_backend_revision_proof;
    `);
    const proof = freshBackendOutput.split("\n").at(-1);

    expect(proof).toBe("t|1|2|3");
  });

  test("advances the aggregate revision for parent, nutrient-only, alias-only, and archive changes", async () => {
    const base = persistenceArgs({
      p_aliases: [{ alias_text: "Revision alias", language_code: "en" }] as Json,
      p_brand_name: "Revision brand",
      p_name: "Revision aggregate food",
      p_nutrients: [{ amount: 10, code: "energy_kcal" }] as Json,
    });
    const created = await persistVersioned(userAClient, base);
    expect(created.error).toBeNull();
    const foodId = created.data?.[0].food_id as string;
    expect(editRevision(foodId)).toBe(1);

    const parentRevision = editRevision(foodId);
    const parentArgs = {
      ...base,
      p_brand_name: "Revision parent changed",
      p_expected_edit_revision: parentRevision,
      p_food_id: foodId,
    };
    expect(
      (await persistVersioned(userAClient, parentArgs)).error,
    ).toBeNull();
    expect(editRevision(foodId)).toBeGreaterThan(parentRevision);

    const nutrientRevision = editRevision(foodId);
    const nutrientArgs = {
      ...parentArgs,
      p_expected_edit_revision: nutrientRevision,
      p_nutrients: [{ amount: 11, code: "energy_kcal" }] as Json,
    };
    expect(
      (await persistVersioned(userAClient, nutrientArgs)).error,
    ).toBeNull();
    expect(editRevision(foodId)).toBeGreaterThan(nutrientRevision);

    const aliasRevision = editRevision(foodId);
    const aliasArgs = {
      ...nutrientArgs,
      p_aliases: [{ alias_text: "Revision alias changed", language_code: "en" }] as Json,
      p_expected_edit_revision: aliasRevision,
    };
    expect(
      (await persistVersioned(userAClient, aliasArgs)).error,
    ).toBeNull();
    expect(editRevision(foodId)).toBeGreaterThan(aliasRevision);

    const noOpRevision = editRevision(foodId);
    expect(
      (
        await persistVersioned(userAClient, {
          ...aliasArgs,
          p_expected_edit_revision: noOpRevision,
        })
      ).error,
    ).toBeNull();
    expect(editRevision(foodId)).toBe(noOpRevision);

    const noOpParentWrite = await userAClient
      .from("foods")
      .update({ name: parentArgs.p_name })
      .eq("id", foodId);
    expect(noOpParentWrite.error).toBeNull();
    expect(editRevision(foodId)).toBe(noOpRevision);
    const aliasRow = await userAClient
      .from("food_aliases")
      .select("id")
      .eq("food_id", foodId)
      .single();
    expect(aliasRow.error).toBeNull();
    const directAliasWrite = await userAClient
      .from("food_aliases")
      .update({ alias_text: "Revision alias changed directly" })
      .eq("id", aliasRow.data?.id as string);
    expect(directAliasWrite.error).toBeNull();
    expect(editRevision(foodId)).toBeGreaterThan(noOpRevision);

    const archived = await userAClient.rpc("set_custom_food_archived", {
      p_food_id: foodId,
      p_is_archived: true,
    });
    expect(archived.error).toBeNull();
    const archivedRevision = editRevision(foodId);
    expect(archivedRevision).toBeGreaterThan(noOpRevision);
    expect(
      (
        await userAClient.rpc("set_custom_food_archived", {
          p_food_id: foodId,
          p_is_archived: true,
        })
      ).error,
    ).toBeNull();
    expect(editRevision(foodId)).toBe(archivedRevision);

    expect(
      (
        await userAClient.rpc("set_custom_food_archived", {
          p_food_id: foodId,
          p_is_archived: false,
        })
      ).error,
    ).toBeNull();
    expect(editRevision(foodId)).toBeGreaterThan(archivedRevision);
  });

  test("rejects stale, missing, malformed, and forged edit revisions before replacement", async () => {
    const base = persistenceArgs({
      p_aliases: [{ alias_text: "Direct original alias", language_code: "en" }] as Json,
      p_brand_name: "Direct original brand",
      p_name: "Direct RPC source",
      p_nutrients: [{ amount: 20, code: "energy_kcal" }] as Json,
    });
    const created = await persistVersioned(userAClient, base);
    expect(created.error).toBeNull();
    const foodId = created.data?.[0].food_id as string;
    const loadedRevision = editRevision(foodId);
    const accepted = await persistVersioned(userAClient, {
      ...base,
      p_aliases: [{ alias_text: "Direct accepted alias", language_code: "en" }] as Json,
      p_brand_name: "Direct accepted brand",
      p_expected_edit_revision: loadedRevision,
      p_food_id: foodId,
      p_name: "Direct accepted edit",
      p_nutrients: [{ amount: 77, code: "energy_kcal" }] as Json,
    });
    expect(accepted.error).toBeNull();
    const acceptedFingerprint = aggregateFingerprint(foodId);
    const acceptedRevision = editRevision(foodId);

    const stale = await requirePromptRpc("stale", persistVersioned(userAClient, {
      ...base,
      p_aliases: [{ alias_text: "Direct stale alias", language_code: "en" }] as Json,
      p_brand_name: "Direct stale brand",
      p_expected_edit_revision: loadedRevision,
      p_food_id: foodId,
      p_name: "Direct stale edit",
      p_nutrients: [{ amount: 999, code: "energy_kcal" }] as Json,
    }));
    expect(stale.error?.code).toBe("PT409");
    expect(aggregateFingerprint(foodId)).toBe(acceptedFingerprint);
    expect(editRevision(foodId)).toBe(acceptedRevision);

    const missing = await requirePromptRpc("missing", userAClient.rpc("persist_custom_food", {
      ...base,
      p_food_id: foodId,
    } as Exclude<PersistArgs, { p_expected_edit_revision: number }>));
    expect(missing.error?.code).toBe("22023");
    expect(aggregateFingerprint(foodId)).toBe(acceptedFingerprint);

    const invalid = await requirePromptRpc("invalid", persistVersioned(userAClient, {
      ...base,
      p_expected_edit_revision: 0,
      p_food_id: foodId,
    }));
    expect(invalid.error?.code).toBe("22023");

    const malformed = await requirePromptRpc("malformed", userAClient.rpc("persist_custom_food", {
      ...base,
      p_expected_edit_revision: "not-a-revision",
      p_food_id: foodId,
    } as unknown as VersionedPersistArgs));
    expect(malformed.error).not.toBeNull();
    expect(aggregateFingerprint(foodId)).toBe(acceptedFingerprint);

    const forged = await requirePromptRpc("forged", persistVersioned(userAClient, {
      ...base,
      p_expected_edit_revision: acceptedRevision + 999,
      p_food_id: foodId,
    }));
    expect(forged.error?.code).toBe("PT409");
    expect(aggregateFingerprint(foodId)).toBe(acceptedFingerprint);
  });

  test("rejects semantic replacement when the aggregate revision is exhausted", async () => {
    const base = persistenceArgs({
      p_aliases: [{ alias_text: "Exhaustion alias", language_code: "en" }] as Json,
      p_brand_name: "Exhaustion brand",
      p_name: "Revision exhaustion source",
      p_nutrients: [{ amount: 31, code: "energy_kcal" }] as Json,
    });
    const created = await persistVersioned(userAClient, base);
    expect(created.error).toBeNull();
    const foodId = created.data?.[0].food_id as string;

    queryLocalDatabase(`
      begin;
      set local session_replication_role = replica;
      update public.foods
      set custom_food_edit_revision = 9223372036854775807
      where id = '${foodId}';
      commit;
    `);

    const exhaustedFingerprint = aggregateFingerprint(foodId);
    const replacement = await requirePromptRpc(
      "exhausted revision",
      persistVersioned(userAClient, {
        ...base,
        p_expected_edit_revision: "9223372036854775807" as unknown as number,
        p_food_id: foodId,
        p_name: "Revision exhaustion replacement",
      }),
    );

    expect(replacement.error?.code).toBe("54000");
    expect(aggregateFingerprint(foodId)).toBe(exhaustedFingerprint);
  });

  test("persists empty-food bases without inferring from 100 g or 100 ml servings", async () => {
    const cases: Array<{
      basis: "per_serving" | "per_100g" | "per_100ml";
      name: string;
      quantity: number | null;
      unit: string | null;
    }> = [
      {
        basis: "per_100g",
        name: "Empty per 100 gram food",
        quantity: null,
        unit: null,
      },
      {
        basis: "per_100ml",
        name: "Empty per 100 milliliter food",
        quantity: null,
        unit: null,
      },
      {
        basis: "per_serving",
        name: "Exact 100 gram serving",
        quantity: 100,
        unit: "g",
      },
      {
        basis: "per_serving",
        name: "Exact 100 milliliter serving",
        quantity: 100,
        unit: "ml",
      },
    ];
    const createdIds: string[] = [];

    for (const item of cases) {
      const created = await persist(userAClient, {
        p_aliases: [] as Json,
        p_brand_name: null,
        p_name: item.name,
        p_nutrient_basis: item.basis,
        p_nutrients: [] as Json,
        p_serving_quantity: item.quantity,
        p_serving_unit: item.unit,
      });
      expect(created.error).toBeNull();
      createdIds.push(created.data?.[0].food_id as string);
    }

    const foods = await userAClient
      .from("foods")
      .select("name,custom_nutrient_basis,serving_size,serving_unit")
      .in("id", createdIds);
    expect(foods.data).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          custom_nutrient_basis: "per_100g",
          name: "Empty per 100 gram food",
        }),
        expect.objectContaining({
          custom_nutrient_basis: "per_100ml",
          name: "Empty per 100 milliliter food",
        }),
        {
          custom_nutrient_basis: "per_serving",
          name: "Exact 100 gram serving",
          serving_size: 100,
          serving_unit: "g",
        },
        {
          custom_nutrient_basis: "per_serving",
          name: "Exact 100 milliliter serving",
          serving_size: 100,
          serving_unit: "ml",
        },
      ]),
    );
    expect(
      queryLocalDatabase(`
        select count(*)
        from public.food_nutrients
        where food_id in (${createdIds.map((id) => `'${id}'`).join(",")});
      `),
    ).toBe("0");
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
        'edit_revision', (select custom_food_edit_revision from public.foods where id = '${userAFoodId}'),
        'nutrients', (select jsonb_agg(jsonb_build_array(id, updated_at) order by id) from public.food_nutrients where food_id = '${userAFoodId}'),
        'aliases', (select jsonb_agg(jsonb_build_array(id, updated_at) order by id) from public.food_aliases where food_id = '${userAFoodId}')
      )::text;
    `);

    const repeated = await persist(userAClient, args);
    expect(repeated.error).toBeNull();

    const after = queryLocalDatabase(`
      select jsonb_build_object(
        'food_updated_at', (select updated_at from public.foods where id = '${userAFoodId}'),
        'edit_revision', (select custom_food_edit_revision from public.foods where id = '${userAFoodId}'),
        'nutrients', (select jsonb_agg(jsonb_build_array(id, updated_at) order by id) from public.food_nutrients where food_id = '${userAFoodId}'),
        'aliases', (select jsonb_agg(jsonb_build_array(id, updated_at) order by id) from public.food_aliases where food_id = '${userAFoodId}')
      )::text;
    `);
    expect(after).toBe(before);
  });

  test("rolls back basis, food, and child changes when a nutrient write fails", async () => {
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
      p_nutrient_basis: "per_100ml",
      p_nutrients: [] as Json,
    });
    expect(cleared.error).toBeNull();

    const clearedState = queryLocalDatabase(`
      select
        (select count(*) from public.food_nutrients where food_id = '${userAFoodId}') || '|' ||
        (select count(*) from public.food_aliases where food_id = '${userAFoodId}') || '|' ||
        (select custom_nutrient_basis from public.foods where id = '${userAFoodId}');
    `);
    expect(clearedState).toBe("0|0|per_100ml");

    const updatedAt = queryLocalDatabase(`
      select updated_at from public.foods where id = '${userAFoodId}';
    `);
    const repeatedClear = await persist(userAClient, {
      p_aliases: [] as Json,
      p_food_id: userAFoodId,
      p_nutrient_basis: "per_100ml",
      p_nutrients: [] as Json,
    });
    expect(repeatedClear.error).toBeNull();
    expect(
      queryLocalDatabase(`
        select updated_at from public.foods where id = '${userAFoodId}';
      `),
    ).toBe(updatedAt);

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
