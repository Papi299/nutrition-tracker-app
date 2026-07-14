import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { expect, test } from "@playwright/test";
import type { Database } from "@/lib/supabase/database.types";

const localSupabaseUrl = process.env.LOCAL_SUPABASE_URL;
const localSupabasePublishableKey = process.env.LOCAL_SUPABASE_PUBLISHABLE_KEY;
const localOnly = process.env.DATE_E2E_LOCAL_SUPABASE === "1";
const password = "FoodAliasPassword123!";
const supabaseProjectId = readFileSync("supabase/config.toml", "utf8").match(
  /^project_id\s*=\s*"([^"]+)"/m,
)?.[1];

if (!supabaseProjectId) {
  throw new Error("Could not read the local Supabase project id.");
}

const databaseContainer = `supabase_db_${supabaseProjectId}`;

test.skip(
  !localOnly || !localSupabaseUrl || !localSupabasePublishableKey,
  "Food-alias tests require the local-only test runner.",
);

test.describe.serial("food alias and search-readiness foundation", () => {
  let userAClient: SupabaseClient<Database>;
  let userBClient: SupabaseClient<Database>;
  let userAId: string;
  let userBId: string;
  let userAFoodAId: string;
  let userAFoodBId: string;
  let userBFoodId: string;
  let userBAliasId: string;
  const publicFoodId = randomUUID();
  const publicAliasId = randomUUID();
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

  async function createUser(emailPrefix: string) {
    const client = localClient();
    const signUp = await client.auth.signUp({
      email: `${emailPrefix}-${runId}@example.test`,
      password,
    });

    expect(signUp.error).toBeNull();
    expect(signUp.data.session).not.toBeNull();
    expect(signUp.data.user?.id).toBeTruthy();

    return {
      client,
      userId: signUp.data.user?.id as string,
    };
  }

  async function createCustomFood(
    client: SupabaseClient<Database>,
    ownerUserId: string,
    name: string,
  ) {
    const insert: Database["public"]["Tables"]["foods"]["Insert"] = {
      food_type: "user_custom",
      is_public: false,
      name,
      owner_user_id: ownerUserId,
    };
    const result = await client.from("foods").insert(insert).select("id").single();

    expect(result.error).toBeNull();
    return result.data?.id as string;
  }

  test.beforeAll(async () => {
    const userA = await createUser("alias-a");
    const userB = await createUser("alias-b");
    userAClient = userA.client;
    userAId = userA.userId;
    userBClient = userB.client;
    userBId = userB.userId;

    userAFoodAId = await createCustomFood(
      userAClient,
      userAId,
      "User A custom food A",
    );
    userAFoodBId = await createCustomFood(
      userAClient,
      userAId,
      "User A custom food B",
    );
    userBFoodId = await createCustomFood(
      userBClient,
      userBId,
      "User B private custom food",
    );

    const userBAlias = await userBClient
      .from("food_aliases")
      .insert({
        alias_text: "PRIVATE USER B ALIAS",
        food_id: userBFoodId,
        language_code: "en",
      })
      .select("id")
      .single();
    expect(userBAlias.error).toBeNull();
    userBAliasId = userBAlias.data?.id as string;

    queryLocalDatabase(`
      insert into public.foods (
        id,
        food_type,
        name,
        brand_name,
        is_public
      ) values (
        '${publicFoodId}',
        'branded',
        'Phase 6A Public Food',
        'Public Brand',
        true
      );

      insert into public.food_aliases (
        id,
        food_id,
        alias_text,
        language_code
      ) values (
        '${publicAliasId}',
        '${publicFoodId}',
        '  Public   Alias  ',
        'en'
      );
    `);
  });

  test("preserves raw English, Hebrew, and und aliases while normalizing conservatively", async () => {
    const aliasRows: Database["public"]["Tables"]["food_aliases"]["Insert"][] = [
      {
        alias_text: "  PEANUT   Butter  ",
        food_id: userAFoodAId,
        language_code: "en",
      },
      {
        alias_text: "  חמאת   בוטנים  ",
        food_id: userAFoodAId,
        language_code: "he",
      },
      {
        alias_text: " קוטג  5%   Tnuva ",
        food_id: userAFoodAId,
        language_code: "und",
      },
    ];
    const inserted = await userAClient
      .from("food_aliases")
      .insert(aliasRows)
      .select("alias_text,language_code,normalized_alias");

    expect(inserted.error).toBeNull();
    expect(inserted.data).toEqual(
      expect.arrayContaining([
        {
          alias_text: "  PEANUT   Butter  ",
          language_code: "en",
          normalized_alias: "peanut butter",
        },
        {
          alias_text: "  חמאת   בוטנים  ",
          language_code: "he",
          normalized_alias: "חמאת בוטנים",
        },
        {
          alias_text: " קוטג  5%   Tnuva ",
          language_code: "und",
          normalized_alias: "קוטג 5% tnuva",
        },
      ]),
    );

    const blank = await userAClient.from("food_aliases").insert({
      alias_text: " \t\n ",
      food_id: userAFoodAId,
      language_code: "en",
    });
    expect(blank.error).not.toBeNull();

    const invalidLanguage = await userAClient.from("food_aliases").insert({
      alias_text: "French alias",
      food_id: userAFoodAId,
      language_code: "fr",
    });
    expect(invalidLanguage.error).not.toBeNull();

    const tooLong = await userAClient.from("food_aliases").insert({
      alias_text: "x".repeat(201),
      food_id: userAFoodAId,
      language_code: "en",
    });
    expect(tooLong.error).not.toBeNull();

    const duplicate = await userAClient.from("food_aliases").insert({
      alias_text: "peanut\t butter",
      food_id: userAFoodAId,
      language_code: "en",
    });
    expect(duplicate.error?.code).toBe("23505");

    const sameAliasDifferentFood = await userAClient
      .from("food_aliases")
      .insert({
        alias_text: "peanut butter",
        food_id: userAFoodBId,
        language_code: "en",
      })
      .select("normalized_alias")
      .single();
    expect(sameAliasDifferentFood.error).toBeNull();
    expect(sameAliasDifferentFood.data?.normalized_alias).toBe("peanut butter");
  });

  test("inherits read and write access from each parent food", async () => {
    const visibleAliases = await userAClient
      .from("food_aliases")
      .select("id,alias_text,food_id,normalized_alias");

    expect(visibleAliases.error).toBeNull();
    expect(visibleAliases.data?.some((alias) => alias.id === publicAliasId)).toBe(
      true,
    );
    expect(visibleAliases.data?.some((alias) => alias.id === userBAliasId)).toBe(
      false,
    );

    const publicAlias = visibleAliases.data?.find(
      (alias) => alias.id === publicAliasId,
    );
    expect(publicAlias).toMatchObject({
      alias_text: "  Public   Alias  ",
      normalized_alias: "public alias",
    });

    const ownAlias = await userAClient
      .from("food_aliases")
      .update({ alias_text: "  Creamy   PEANUT Butter  " })
      .eq("food_id", userAFoodAId)
      .eq("language_code", "en")
      .select("alias_text,normalized_alias")
      .single();
    expect(ownAlias.error).toBeNull();
    expect(ownAlias.data).toEqual({
      alias_text: "  Creamy   PEANUT Butter  ",
      normalized_alias: "creamy peanut butter",
    });

    const ownDisposableAlias = await userAClient
      .from("food_aliases")
      .insert({
        alias_text: "Disposable own alias",
        food_id: userAFoodAId,
        language_code: "und",
      })
      .select("id")
      .single();
    expect(ownDisposableAlias.error).toBeNull();

    const ownDelete = await userAClient
      .from("food_aliases")
      .delete()
      .eq("id", ownDisposableAlias.data?.id as string)
      .select("id");
    expect(ownDelete.error).toBeNull();
    expect(ownDelete.data).toHaveLength(1);

    for (const foodId of [publicFoodId, userBFoodId]) {
      const forbiddenInsert = await userAClient.from("food_aliases").insert({
        alias_text: `Forbidden ${foodId}`,
        food_id: foodId,
        language_code: "en",
      });
      expect(forbiddenInsert.error).not.toBeNull();
    }

    for (const aliasId of [publicAliasId, userBAliasId]) {
      const forbiddenUpdate = await userAClient
        .from("food_aliases")
        .update({ alias_text: "Forbidden update" })
        .eq("id", aliasId)
        .select("id");
      expect(forbiddenUpdate.error).toBeNull();
      expect(forbiddenUpdate.data).toEqual([]);

      const forbiddenDelete = await userAClient
        .from("food_aliases")
        .delete()
        .eq("id", aliasId)
        .select("id");
      expect(forbiddenDelete.error).toBeNull();
      expect(forbiddenDelete.data).toEqual([]);
    }

    const privateAliasStillExists = await userBClient
      .from("food_aliases")
      .select("alias_text")
      .eq("id", userBAliasId)
      .single();
    expect(privateAliasStillExists.error).toBeNull();
    expect(privateAliasStillExists.data?.alias_text).toBe("PRIVATE USER B ALIAS");
  });

  test("cascades aliases while preserving existing diary food-link snapshots", async () => {
    const disposableFoodId = await createCustomFood(
      userAClient,
      userAId,
      "Disposable alias parent",
    );
    const disposableAliasId = randomUUID();
    const alias = await userAClient.from("food_aliases").insert({
      alias_text: "Disposable parent alias",
      food_id: disposableFoodId,
      id: disposableAliasId,
      language_code: "en",
    });
    expect(alias.error).toBeNull();

    const linkedDiary = await userAClient
      .from("diary_entries")
      .insert({
        entry_date: "2032-02-02",
        food_id: disposableFoodId,
        food_name: "Disposable snapshot name",
        meal_type: "breakfast",
        source: "manual",
        user_id: userAId,
      })
      .select("id")
      .single();
    expect(linkedDiary.error).toBeNull();

    const publicDiaryLink = await userAClient.from("diary_entries").insert({
      entry_date: "2032-02-02",
      food_id: publicFoodId,
      food_name: "Public snapshot name",
      meal_type: "lunch",
      source: "manual",
      user_id: userAId,
    });
    expect(publicDiaryLink.error).toBeNull();

    const privateDiaryLink = await userAClient.from("diary_entries").insert({
      entry_date: "2032-02-02",
      food_id: userBFoodId,
      food_name: "Forbidden private snapshot",
      meal_type: "dinner",
      source: "manual",
      user_id: userAId,
    });
    expect(privateDiaryLink.error).not.toBeNull();

    const parentDelete = await userAClient
      .from("foods")
      .delete()
      .eq("id", disposableFoodId)
      .select("id");
    expect(parentDelete.error).toBeNull();
    expect(parentDelete.data).toHaveLength(1);

    expect(
      queryLocalDatabase(
        `select count(*) from public.food_aliases where id = '${disposableAliasId}';`,
      ),
    ).toBe("0");

    const preservedDiary = await userAClient
      .from("diary_entries")
      .select("food_id,food_name")
      .eq("id", linkedDiary.data?.id as string)
      .single();
    expect(preservedDiary.error).toBeNull();
    expect(preservedDiary.data).toEqual({
      food_id: null,
      food_name: "Disposable snapshot name",
    });
  });

  test("has the required generated types, RLS, grants, extension, and indexes", () => {
    type AliasRow = Database["public"]["Tables"]["food_aliases"]["Row"];
    type NormalizedAliasIsRequired = AliasRow["normalized_alias"] extends string
      ? true
      : false;
    const normalizedAliasIsRequired: NormalizedAliasIsRequired = true;
    expect(normalizedAliasIsRequired).toBe(true);

    expect(
      queryLocalDatabase(
        "select extname from pg_extension where extname = 'pg_trgm';",
      ),
    ).toBe("pg_trgm");
    expect(
      queryLocalDatabase(`
        select relrowsecurity
        from pg_class
        where oid = 'public.food_aliases'::regclass;
      `),
    ).toBe("t");
    expect(
      queryLocalDatabase(`
        select count(*)
        from pg_policies
        where schemaname = 'public'
          and tablename = 'food_aliases';
      `),
    ).toBe("4");
    expect(
      queryLocalDatabase(`
        select string_agg(privilege_type, ',' order by privilege_type)
        from information_schema.table_privileges
        where table_schema = 'public'
          and table_name = 'food_aliases'
          and grantee = 'authenticated';
      `),
    ).toBe("DELETE,INSERT,SELECT,UPDATE");
    expect(
      queryLocalDatabase(`
        select count(*)
        from information_schema.table_privileges
        where table_schema = 'public'
          and table_name = 'food_aliases'
          and grantee in ('anon', 'PUBLIC');
      `),
    ).toBe("0");
    expect(
      queryLocalDatabase(`
        select is_generated || '|' || is_nullable
        from information_schema.columns
        where table_schema = 'public'
          and table_name = 'food_aliases'
          and column_name = 'normalized_alias';
      `),
    ).toBe("ALWAYS|NO");
    expect(
      queryLocalDatabase(`
        select delete_rule
        from information_schema.referential_constraints
        where constraint_schema = 'public'
          and constraint_name = 'food_aliases_food_id_fkey';
      `),
    ).toBe("CASCADE");
    expect(
      queryLocalDatabase(`
        select string_agg(indexname, ',' order by indexname)
        from pg_indexes
        where schemaname = 'public'
          and indexname in (
            'food_aliases_normalized_alias_trgm_idx',
            'foods_brand_name_trgm_idx',
            'foods_name_trgm_idx'
          );
      `),
    ).toBe(
      "food_aliases_normalized_alias_trgm_idx,foods_brand_name_trgm_idx,foods_name_trgm_idx",
    );
    expect(
      queryLocalDatabase(`
        select count(*)
        from pg_indexes
        where schemaname = 'public'
          and indexname in (
            'food_aliases_normalized_alias_trgm_idx',
            'foods_brand_name_trgm_idx',
            'foods_name_trgm_idx'
          )
          and indexdef like '%USING gin%'
          and indexdef like '%gin_trgm_ops%';
      `),
    ).toBe("3");
    expect(
      queryLocalDatabase(`
        select count(*)
        from information_schema.triggers
        where event_object_schema = 'public'
          and event_object_table = 'food_aliases'
          and trigger_name = 'food_aliases_set_updated_at';
      `),
    ).toBe("1");
    expect(
      queryLocalDatabase(`
        select p.provolatile::text || '|' || p.proisstrict::text
        from pg_proc p
        join pg_namespace n on n.oid = p.pronamespace
        where n.nspname = 'public'
          and p.proname = 'normalize_food_search_text';
      `),
    ).toBe("i|true");
    expect(
      queryLocalDatabase(`
        select
          has_function_privilege(
            'authenticated',
            'public.normalize_food_search_text(text)',
            'EXECUTE'
          ) || '|' ||
          has_function_privilege(
            'anon',
            'public.normalize_food_search_text(text)',
            'EXECUTE'
          );
      `),
    ).toBe("true|false");
  });
});
