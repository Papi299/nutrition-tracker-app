import { execFile, execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { promisify } from "node:util";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { expect, test } from "@playwright/test";
import type { Database, Json } from "@/lib/supabase/database.types";

const localSupabaseUrl = process.env.LOCAL_SUPABASE_URL;
const localSupabasePublishableKey = process.env.LOCAL_SUPABASE_PUBLISHABLE_KEY;
const localOnly = process.env.DATE_E2E_LOCAL_SUPABASE === "1";
const password = "BarcodeHandoffPersistence123!";
const execFileAsync = promisify(execFile);
const projectId = readFileSync("supabase/config.toml", "utf8").match(
  /^project_id\s*=\s*"([^"]+)"/m,
)?.[1];

if (!projectId) throw new Error("Could not read the local Supabase project id.");
const databaseContainer = `supabase_db_${projectId}`;

test.skip(
  !localOnly || !localSupabaseUrl || !localSupabasePublishableKey,
  "Barcode handoff persistence tests require local Supabase.",
);

function canonicalGtin(seed: number) {
  const payload = `3${String(seed).padStart(12, "0")}`;
  let sum = 0;
  let weight = 3;
  for (let index = payload.length - 1; index >= 0; index -= 1) {
    sum += (payload.charCodeAt(index) - 48) * weight;
    weight = weight === 3 ? 1 : 3;
  }
  return `${payload}${(10 - (sum % 10)) % 10}`;
}

test.describe.serial("atomic custom-food barcode persistence", () => {
  const runOffset = (Date.now() % 10_000_000) * 100;
  const runId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const publicFoodId = randomUUID();
  const archivedPublicFoodId = randomUUID();
  let userA: SupabaseClient<Database>;
  let userB: SupabaseClient<Database>;
  let userAId: string;
  let userBId: string;
  let preexistingAId: string;
  let preexistingBId: string;

  const codes = {
    atomic: canonicalGtin(runOffset + 1),
    concurrent: canonicalGtin(runOffset + 2),
    crossUser: canonicalGtin(runOffset + 3),
    publicConflict: canonicalGtin(runOffset + 4),
    archivedPublic: canonicalGtin(runOffset + 5),
    archivedOwned: canonicalGtin(runOffset + 6),
    race: canonicalGtin(runOffset + 7),
    barcodeRollback: canonicalGtin(runOffset + 8),
    scopeRollback: canonicalGtin(runOffset + 9),
    aliasRollback: canonicalGtin(runOffset + 10),
    nutrientRollback: canonicalGtin(runOffset + 11),
  };

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

  async function queryDatabaseAsync(statement: string) {
    return execFileAsync(
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
    );
  }

  async function createUser(prefix: string) {
    const client = localClient();
    const result = await client.auth.signUp({
      email: `${prefix}-${runId}@example.test`,
      password,
    });
    expect(result.error).toBeNull();
    return { client, id: result.data.user?.id as string };
  }

  function args(
    gtin: string,
    name: string,
    overrides: Partial<
      Database["public"]["Functions"]["persist_custom_food_with_barcode"]["Args"]
    > = {},
  ): Database["public"]["Functions"]["persist_custom_food_with_barcode"]["Args"] {
    return {
      p_aliases: [] as Json,
      p_brand_name: null as unknown as string,
      p_gtin: gtin,
      p_locale: "en",
      p_name: name,
      p_nutrient_basis: "per_serving",
      p_nutrients: [] as Json,
      p_serving_quantity: 1,
      p_serving_unit: "serving",
      ...overrides,
    };
  }

  async function ordinaryFood(client: SupabaseClient<Database>, name: string) {
    const result = await client.rpc("persist_custom_food", {
      p_aliases: [] as Json,
      p_brand_name: null as unknown as string,
      p_food_id: null as unknown as string,
      p_locale: "en",
      p_name: name,
      p_nutrient_basis: "per_serving",
      p_nutrients: [] as Json,
      p_serving_quantity: 1,
      p_serving_unit: "serving",
    });
    expect(result.error).toBeNull();
    return result.data?.[0].food_id as string;
  }

  function insertMapping(foodId: string, gtin: string, source = "manual") {
    queryDatabase(`
      insert into public.food_barcodes (
        food_id, canonical_gtin, provenance_source_id, verification_status
      ) values (
        '${foodId}', '${gtin}',
        (select id from public.food_sources where code = '${source}'),
        'curated_verified'
      );
    `);
  }

  test.beforeAll(async () => {
    const createdA = await createUser("phase9c-a");
    const createdB = await createUser("phase9c-b");
    userA = createdA.client;
    userB = createdB.client;
    userAId = createdA.id;
    userBId = createdB.id;
    preexistingAId = await ordinaryFood(userA, `Phase 9C preexisting A ${runId}`);
    preexistingBId = await ordinaryFood(userB, `Phase 9C preexisting B ${runId}`);

    queryDatabase(`
      insert into public.foods (
        id, food_type, name, locale, data_quality, is_public, is_archived, source_id
      ) values
        ('${publicFoodId}', 'generic', 'Phase 9C public conflict', 'en', 'curated', true, false,
          (select id from public.food_sources where code = 'manual')),
        ('${archivedPublicFoodId}', 'generic', 'Phase 9C archived public', 'en', 'curated', true, true,
          (select id from public.food_sources where code = 'manual'));
    `);
    insertMapping(publicFoodId, codes.publicConflict);
    insertMapping(archivedPublicFoodId, codes.archivedPublic);
  });

  test.afterAll(() => {
    queryDatabase(`
      drop trigger if exists phase9c_fail_barcode on public.food_barcodes;
      drop trigger if exists zz_phase9c_fail_scope on public.food_barcodes;
      drop trigger if exists phase9c_fail_alias on public.food_aliases;
      drop trigger if exists phase9c_fail_nutrient on public.food_nutrients;
      drop function if exists public.phase9c_fail_barcode();
      drop function if exists public.phase9c_fail_scope();
      drop function if exists public.phase9c_fail_alias();
      drop function if exists public.phase9c_fail_nutrient();
      delete from public.foods where id in ('${publicFoodId}', '${archivedPublicFoodId}');
      delete from auth.users where id in ('${userAId}', '${userBId}');
    `);
  });

  test("enforces food-specific canonical validation, ACLs, and generated shape", async () => {
    type PersistRow =
      Database["public"]["Functions"]["persist_custom_food_with_barcode"]["Returns"][number];
    const typedRow: PersistRow = {
      canonical_gtin: codes.atomic,
      food_id: randomUUID(),
      is_archived: false,
      result_status: "ambiguous",
    };
    expect(typedRow.result_status).toBe("ambiguous");

    expect(
      queryDatabase(`
        select
          public.is_valid_canonical_gtin('09780306406157'),
          public.is_valid_food_canonical_gtin('09780306406157'),
          public.is_valid_canonical_gtin('09791090636071'),
          public.is_valid_food_canonical_gtin('09791090636071');
      `),
    ).toBe("t|f|t|f");

    const metadata = queryDatabase(`
      select
        p.proname,
        p.provolatile,
        p.prosecdef,
        array_to_string(p.proconfig, ','),
        has_function_privilege('public', p.oid, 'execute'),
        has_function_privilege('anon', p.oid, 'execute'),
        has_function_privilege('authenticated', p.oid, 'execute')
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
      where (n.nspname, p.proname) in (
        ('public', 'is_valid_food_canonical_gtin'),
        ('public', 'persist_custom_food_with_barcode'),
        ('private', 'insert_new_owned_custom_food_barcode')
      )
      order by n.nspname, p.proname;
    `);
    expect(metadata).toContain('is_valid_food_canonical_gtin|i|f|search_path=""|f|f|t');
    expect(metadata).toContain('persist_custom_food_with_barcode|v|f|search_path=""|f|f|t');
    expect(metadata).toContain('insert_new_owned_custom_food_barcode|v|t|search_path=""|f|f|t');

    expect(
      queryDatabase(`
        select
          has_table_privilege('authenticated', 'public.food_barcodes', 'INSERT'),
          has_table_privilege('authenticated', 'public.food_barcodes', 'UPDATE'),
          has_table_privilege('authenticated', 'public.food_barcodes', 'DELETE'),
          has_table_privilege('authenticated', 'public.food_barcodes', 'TRUNCATE'),
          to_regprocedure('public.insert_new_owned_custom_food_barcode(uuid,text)') is null,
          pg_get_constraintdef(oid) like '%is_valid_food_canonical_gtin%'
        from pg_constraint
        where conname = 'food_barcodes_canonical_gtin_check';
      `),
    ).toBe("f|f|f|f|t|t");

    for (const isbn of ["09780306406157", "09791090636071"]) {
      const lookup = await userA.rpc("lookup_readable_food_by_gtin", { p_gtin: isbn });
      expect(lookup.error?.code).toBe("22023");
      expect(() => insertMapping(publicFoodId, isbn)).toThrow();
    }
  });

  test("keeps the private helper non-exposed and rejects unauthenticated, other-user, and preexisting parents", () => {
    expect(() =>
      queryDatabase(`
        begin;
        set local role anon;
        select private.insert_new_owned_custom_food_barcode('${preexistingAId}', '${codes.atomic}');
        rollback;
      `),
    ).toThrow();

    for (const [actor, foodId] of [
      [userAId, preexistingAId],
      [userAId, preexistingBId],
    ]) {
      expect(() =>
        queryDatabase(`
          begin;
          set local role authenticated;
          set local request.jwt.claim.sub = '${actor}';
          select private.insert_new_owned_custom_food_barcode('${foodId}', '${codes.atomic}');
          rollback;
        `),
      ).toThrow();
    }
  });

  test("creates food, nutrients, aliases, and one fixed private mapping atomically without unrelated writes", async () => {
    const before = queryDatabase(`
      select
        (select count(*) from public.diary_entries where user_id = '${userAId}'),
        (select count(*) from public.food_favorites where user_id = '${userAId}');
    `);
    const result = await userA.rpc(
      "persist_custom_food_with_barcode",
      args(codes.atomic, `Phase 9C atomic ${runId}`, {
        p_aliases: [
          { alias_text: "  Atomic Alias  ", language_code: "en" },
          { alias_text: "כינוי אטומי", language_code: "he" },
        ] as Json,
        p_brand_name: "Atomic Brand",
        p_nutrient_basis: "per_100g",
        p_nutrients: [
          { amount: 123, code: "energy_kcal" },
          { amount: 7.5, code: "protein_g" },
        ] as Json,
        p_serving_quantity: null as unknown as number,
        p_serving_unit: null as unknown as string,
      }),
    );
    expect(result.error).toBeNull();
    expect(result.data?.[0]).toMatchObject({
      canonical_gtin: codes.atomic,
      is_archived: false,
      result_status: "created",
    });
    const foodId = result.data?.[0].food_id as string;

    const persisted = queryDatabase(`
      select
        foods.owner_user_id = '${userAId}',
        foods.food_type,
        foods.is_public,
        foods.is_archived,
        foods.custom_nutrient_basis,
        foods.serving_size,
        foods.serving_unit,
        (select count(*) from public.food_nutrients where food_id = foods.id),
        (select count(*) from public.food_aliases where food_id = foods.id),
        food_barcodes.scope_owner_user_id = '${userAId}',
        food_barcodes.verification_status,
        food_barcodes.provenance_source_food_id is null,
        food_sources.code
      from public.foods
      join public.food_barcodes on food_barcodes.food_id = foods.id
      join public.food_sources on food_sources.id = food_barcodes.provenance_source_id
      where foods.id = '${foodId}';
    `);
    expect(persisted).toBe("t|user_custom|f|f|per_100g|100.000|g|2|2|t|user_asserted|t|user_custom");
    expect(queryDatabase(`select count(*) from public.food_barcodes where canonical_gtin = '${codes.atomic}';`)).toBe("1");
    expect(
      queryDatabase(`
        select
          (select count(*) from public.diary_entries where user_id = '${userAId}'),
          (select count(*) from public.food_favorites where user_id = '${userAId}');
      `),
    ).toBe(before);
  });

  test("converges sequential and concurrent same-user retries and permits isolated cross-user mappings", async () => {
    const duplicate = await userA.rpc(
      "persist_custom_food_with_barcode",
      args(codes.atomic, "Ignored duplicate values"),
    );
    expect(duplicate.data?.[0]).toMatchObject({ result_status: "owned_existing" });

    const concurrent = await Promise.all([
      userA.rpc("persist_custom_food_with_barcode", args(codes.concurrent, `Concurrent A ${runId}`)),
      userA.rpc("persist_custom_food_with_barcode", args(codes.concurrent, `Concurrent B ${runId}`)),
    ]);
    expect(concurrent.every((item) => item.error === null)).toBe(true);
    expect(concurrent.map((item) => item.data?.[0].result_status).sort()).toEqual([
      "created",
      "owned_existing",
    ]);
    expect(queryDatabase(`select count(*) from public.food_barcodes where canonical_gtin = '${codes.concurrent}';`)).toBe("1");

    const crossUser = await Promise.all([
      userA.rpc("persist_custom_food_with_barcode", args(codes.crossUser, `Cross A ${runId}`)),
      userB.rpc("persist_custom_food_with_barcode", args(codes.crossUser, `Cross B ${runId}`)),
    ]);
    expect(crossUser.map((item) => item.data?.[0].result_status)).toEqual([
      "created",
      "created",
    ]);
    expect(queryDatabase(`select count(*) from public.food_barcodes where canonical_gtin = '${codes.crossUser}';`)).toBe("2");
  });

  test("returns owned, archived, public, and generic conflicts without writing", async () => {
    const archivedOwnedId = await ordinaryFood(userA, `Archived conflict ${runId}`);
    insertMapping(archivedOwnedId, codes.archivedOwned, "user_custom");
    await userA.rpc("set_custom_food_archived", {
      p_food_id: archivedOwnedId,
      p_is_archived: true,
    });

    const before = queryDatabase("select count(*) from public.foods;");
    const cases = [
      [codes.atomic, "owned_existing", false],
      [codes.archivedOwned, "owned_archived", true],
      [codes.publicConflict, "public_existing", false],
      [codes.archivedPublic, "archived_or_unavailable", null],
    ] as const;
    for (const [gtin, status, archived] of cases) {
      const result = await userA.rpc(
        "persist_custom_food_with_barcode",
        args(gtin, `Should not exist ${gtin}`),
      );
      expect(result.error).toBeNull();
      expect(result.data?.[0]).toMatchObject({ is_archived: archived, result_status: status });
    }
    expect(queryDatabase("select count(*) from public.foods;")).toBe(before);
  });

  test("serializes a public mapping race through the documented advisory lock", async () => {
    const raceFoodId = randomUUID();
    queryDatabase(`
      insert into public.foods (
        id, food_type, name, locale, data_quality, is_public, is_archived, source_id
      ) values (
        '${raceFoodId}', 'generic', 'Phase 9C race public', 'en', 'curated', true, false,
        (select id from public.food_sources where code = 'manual')
      );
    `);

    const publicWriter = queryDatabaseAsync(`
      begin;
      select pg_advisory_xact_lock(
        hashtextextended('nutrition-tracker:food-barcode:${codes.race}', 0)
      );
      insert into public.food_barcodes (
        food_id, canonical_gtin, provenance_source_id, verification_status
      ) values (
        '${raceFoodId}', '${codes.race}',
        (select id from public.food_sources where code = 'manual'),
        'curated_verified'
      );
      select pg_sleep(1);
      commit;
    `);
    await new Promise((resolve) => setTimeout(resolve, 250));
    const result = await userA.rpc(
      "persist_custom_food_with_barcode",
      args(codes.race, `Race should not create ${runId}`),
    );
    await publicWriter;
    expect(result.error).toBeNull();
    expect(result.data?.[0]).toMatchObject({
      food_id: raceFoodId,
      result_status: "public_existing",
    });
    expect(queryDatabase(`select count(*) from public.foods where name = 'Race should not create ${runId}';`)).toBe("0");
    queryDatabase(`delete from public.foods where id = '${raceFoodId}';`);
  });

  test("rolls back food, nutrients, aliases, and mapping for isolated insertion failures", async () => {
    queryDatabase(`
      create function public.phase9c_fail_barcode() returns trigger
      language plpgsql set search_path = '' as $$ begin raise exception 'barcode fault'; end; $$;
      create trigger phase9c_fail_barcode before insert on public.food_barcodes
      for each row when (new.canonical_gtin = '${codes.barcodeRollback}')
      execute function public.phase9c_fail_barcode();

      create function public.phase9c_fail_scope() returns trigger
      language plpgsql set search_path = '' as $$ begin raise exception 'scope fault'; end; $$;
      create trigger zz_phase9c_fail_scope before insert on public.food_barcodes
      for each row when (new.canonical_gtin = '${codes.scopeRollback}')
      execute function public.phase9c_fail_scope();

      create function public.phase9c_fail_alias() returns trigger
      language plpgsql set search_path = '' as $$ begin raise exception 'alias fault'; end; $$;
      create trigger phase9c_fail_alias before insert on public.food_aliases
      for each row when (new.alias_text = 'ROLLBACK_ALIAS')
      execute function public.phase9c_fail_alias();

      create function public.phase9c_fail_nutrient() returns trigger
      language plpgsql set search_path = '' as $$ begin raise exception 'nutrient fault'; end; $$;
      create trigger phase9c_fail_nutrient before insert on public.food_nutrients
      for each row when (new.amount = 98765)
      execute function public.phase9c_fail_nutrient();
    `);

    const failures = [
      [codes.barcodeRollback, `Barcode rollback ${runId}`, {}],
      [codes.scopeRollback, `Scope rollback ${runId}`, {}],
      [codes.aliasRollback, `Alias rollback ${runId}`, {
        p_aliases: [{ alias_text: "ROLLBACK_ALIAS", language_code: "en" }] as Json,
      }],
      [codes.nutrientRollback, `Nutrient rollback ${runId}`, {
        p_nutrients: [{ amount: 98765, code: "energy_kcal" }] as Json,
      }],
    ] as const;

    for (const [gtin, name, overrides] of failures) {
      const result = await userA.rpc(
        "persist_custom_food_with_barcode",
        args(gtin, name, overrides),
      );
      expect(result.error).not.toBeNull();
      expect(queryDatabase(`select count(*) from public.foods where name = '${name}';`)).toBe("0");
      expect(queryDatabase(`select count(*) from public.food_barcodes where canonical_gtin = '${gtin}';`)).toBe("0");
    }

    queryDatabase(`
      drop trigger phase9c_fail_barcode on public.food_barcodes;
      drop trigger zz_phase9c_fail_scope on public.food_barcodes;
      drop trigger phase9c_fail_alias on public.food_aliases;
      drop trigger phase9c_fail_nutrient on public.food_nutrients;
      drop function public.phase9c_fail_barcode();
      drop function public.phase9c_fail_scope();
      drop function public.phase9c_fail_alias();
      drop function public.phase9c_fail_nutrient();
    `);
  });
});
