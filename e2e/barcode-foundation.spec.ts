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
const password = "BarcodeFoundationPassword123!";
const execFileAsync = promisify(execFile);
const gtinRunOffset = (Date.now() % 100_000_000) * 100;
const supabaseProjectId = readFileSync("supabase/config.toml", "utf8").match(
  /^project_id\s*=\s*"([^"]+)"/m,
)?.[1];

if (!supabaseProjectId) {
  throw new Error("Could not read the local Supabase project id.");
}

const databaseContainer = `supabase_db_${supabaseProjectId}`;

test.skip(
  !localOnly || !localSupabaseUrl || !localSupabasePublishableKey,
  "Barcode foundation tests require the local-only test runner.",
);

function canonicalGtin(seed: number) {
  const payload = `2${String(gtinRunOffset + seed).padStart(12, "0")}`;
  let sum = 0;
  let weight = 3;

  for (let index = payload.length - 1; index >= 0; index -= 1) {
    sum += (payload.charCodeAt(index) - 48) * weight;
    weight = weight === 3 ? 1 : 3;
  }

  return `${payload}${(10 - (sum % 10)) % 10}`;
}

test.describe.serial("barcode identity and local lookup foundation", () => {
  let userAClient: SupabaseClient<Database>;
  let userBClient: SupabaseClient<Database>;
  let userAId: string;
  let userBId: string;
  let manualSourceId: string;
  let userCustomSourceId: string;
  let usdaSourceId: string;
  let ownedActiveFoodId: string;
  let ownedArchivedWithPublicFoodId: string;
  let ownedArchivedOnlyFoodId: string;
  let otherActiveFoodId: string;
  let otherArchivedFoodId: string;
  const runId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const publicOwnedFoodId = randomUUID();
  const publicOnlyFoodId = randomUUID();
  const publicBeatsArchivedFoodId = randomUUID();
  const publicArchivedFoodId = randomUUID();
  const invalidParentFoodId = randomUUID();
  const codes = {
    ownedWins: canonicalGtin(1),
    publicOnly: canonicalGtin(2),
    publicBeatsArchived: canonicalGtin(3),
    ownedArchived: canonicalGtin(4),
    publicArchived: canonicalGtin(5),
    otherActive: canonicalGtin(6),
    otherArchived: canonicalGtin(7),
    missing: canonicalGtin(8),
  };

  function localClient() {
    return createClient<Database>(
      localSupabaseUrl as string,
      localSupabasePublishableKey as string,
      { auth: { autoRefreshToken: false, persistSession: false } },
    );
  }

  function executeLocalDatabaseSync(statement: string) {
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
        return executeLocalDatabaseSync(statement);
      } catch (error) {
        lastError = error;

        if (attempt < 4) {
          execFileSync("sleep", ["1"]);
        }
      }
    }

    throw lastError;
  }

  async function retryLocalApi<
    T extends { error: { code?: string } | null },
  >(operation: () => PromiseLike<T>) {
    let result = await operation();

    for (let attempt = 0; result.error?.code === "PGRST002" && attempt < 4; attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, 1_000));
      result = await operation();
    }

    return result;
  }

  function lookupBarcode(client: SupabaseClient<Database>, canonical: string) {
    return retryLocalApi(() =>
      client.rpc("lookup_readable_food_by_gtin", { p_gtin: canonical }),
    );
  }

  async function executeLocalDatabase(statement: string) {
    const result = await execFileAsync(
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
      { encoding: "utf8", maxBuffer: 1024 * 1024 },
    );
    return result.stdout.trim();
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

  async function createCustomFood(
    client: SupabaseClient<Database>,
    name: string,
  ) {
    const result = await client.rpc(
      "persist_custom_food",
      {
        p_aliases: [] as Json,
        p_brand_name: null,
        p_food_id: null,
        p_locale: "en",
        p_name: name,
        p_nutrient_basis: "per_serving",
        p_nutrients: [] as Json,
        p_serving_quantity: 1,
        p_serving_unit: "serving",
      } as unknown as Database["public"]["Functions"]["persist_custom_food"]["Args"],
    );
    expect(result.error).toBeNull();
    return result.data?.[0].food_id as string;
  }

  async function archiveFood(
    client: SupabaseClient<Database>,
    foodId: string,
  ) {
    const result = await client.rpc("set_custom_food_archived", {
      p_food_id: foodId,
      p_is_archived: true,
    });
    expect(result.error).toBeNull();
  }

  function insertMapping({
    canonical,
    foodId,
    provenanceSource = "usda",
    provenanceSourceFoodId = null,
    scope = null,
    verification = "provider_reported",
    retry = true,
  }: {
    canonical: string;
    foodId: string;
    provenanceSource?: string;
    provenanceSourceFoodId?: string | null;
    scope?: string | null;
    verification?: string;
    retry?: boolean;
  }) {
    const statement = `
      insert into public.food_barcodes (
        food_id,
        canonical_gtin,
        scope_owner_user_id,
        provenance_source_id,
        provenance_source_food_id,
        verification_status
      ) values (
        '${foodId}',
        '${canonical}',
        ${scope === null ? "null" : `'${scope}'`},
        (select id from public.food_sources where code = '${provenanceSource}'),
        ${provenanceSourceFoodId === null ? "null" : `'${provenanceSourceFoodId}'`},
        '${verification}'
      );
    `;

    if (retry) {
      queryLocalDatabase(statement);
      return;
    }

    executeLocalDatabaseSync(statement);
  }

  test.beforeAll(async () => {
    const userA = await createUser("barcode-a");
    const userB = await createUser("barcode-b");
    userAClient = userA.client;
    userAId = userA.userId;
    userBClient = userB.client;
    userBId = userB.userId;

    const sources = await userAClient
      .from("food_sources")
      .select("id,code")
      .in("code", ["manual", "user_custom", "usda"]);
    expect(sources.error).toBeNull();
    manualSourceId = sources.data?.find(({ code }) => code === "manual")?.id as string;
    userCustomSourceId = sources.data?.find(({ code }) => code === "user_custom")?.id as string;
    usdaSourceId = sources.data?.find(({ code }) => code === "usda")?.id as string;

    ownedActiveFoodId = await createCustomFood(userAClient, "Owned barcode food");
    ownedArchivedWithPublicFoodId = await createCustomFood(
      userAClient,
      "Owned archived with public fallback",
    );
    ownedArchivedOnlyFoodId = await createCustomFood(
      userAClient,
      "Owned archived only",
    );
    otherActiveFoodId = await createCustomFood(userBClient, "Other private active");
    otherArchivedFoodId = await createCustomFood(
      userBClient,
      "Other private archived",
    );
    await archiveFood(userAClient, ownedArchivedWithPublicFoodId);
    await archiveFood(userAClient, ownedArchivedOnlyFoodId);
    await archiveFood(userBClient, otherArchivedFoodId);

    queryLocalDatabase(`
      insert into public.foods (
        id, source_id, source_food_id, food_type, name, brand_name, locale,
        serving_size, serving_unit, data_quality, is_public, is_archived
      ) values
        (
          '${publicOwnedFoodId}', '${manualSourceId}', 'barcode-public-owned-${runId}',
          'branded', 'Public counterpart', 'Public Brand', 'en', 50, 'g',
          'curated', true, false
        ),
        (
          '${publicOnlyFoodId}', '${manualSourceId}', 'barcode-public-only-${runId}',
          'branded', 'Public barcode food', 'Exact Brand', 'he', 330, 'ml',
          'verified', true, false
        ),
        (
          '${publicBeatsArchivedFoodId}', '${manualSourceId}',
          'barcode-public-fallback-${runId}', 'generic', 'Public active fallback', null,
          'en', 100, 'g', 'curated', true, false
        ),
        (
          '${publicArchivedFoodId}', '${manualSourceId}',
          'barcode-public-archived-${runId}', 'generic', 'Public archived barcode', null,
          'en', 100, 'g', 'curated', true, true
        ),
        (
          '${invalidParentFoodId}', '${manualSourceId}', 'barcode-hidden-parent-${runId}',
          'generic', 'Unavailable global food', null, 'en', null, null,
          'unknown', false, false
        );
    `);

    insertMapping({ canonical: codes.ownedWins, foodId: publicOwnedFoodId });
    insertMapping({
      canonical: codes.ownedWins,
      foodId: ownedActiveFoodId,
      provenanceSource: "user_custom",
      provenanceSourceFoodId: "owned-assertion",
      scope: userBId,
      verification: "user_asserted",
    });
    insertMapping({
      canonical: codes.ownedWins,
      foodId: otherActiveFoodId,
      provenanceSource: "user_custom",
      verification: "user_asserted",
    });
    insertMapping({
      canonical: codes.publicOnly,
      foodId: publicOnlyFoodId,
      provenanceSourceFoodId: "usda-barcode-2",
      verification: "curated_verified",
    });
    insertMapping({
      canonical: codes.publicOnly,
      foodId: otherActiveFoodId,
      provenanceSource: "user_custom",
      verification: "user_asserted",
    });
    insertMapping({
      canonical: codes.publicBeatsArchived,
      foodId: publicBeatsArchivedFoodId,
    });
    insertMapping({
      canonical: codes.publicBeatsArchived,
      foodId: ownedArchivedWithPublicFoodId,
      provenanceSource: "user_custom",
      verification: "user_asserted",
    });
    insertMapping({
      canonical: codes.ownedArchived,
      foodId: ownedArchivedOnlyFoodId,
      provenanceSource: "user_custom",
      verification: "user_asserted",
    });
    insertMapping({ canonical: codes.publicArchived, foodId: publicArchivedFoodId });
    insertMapping({
      canonical: codes.otherActive,
      foodId: otherActiveFoodId,
      provenanceSource: "user_custom",
      verification: "user_asserted",
    });
    insertMapping({
      canonical: codes.otherArchived,
      foodId: otherArchivedFoodId,
      provenanceSource: "user_custom",
      verification: "user_asserted",
    });
  });

  test("creates exact generated schema, constraints, indexes, RLS, and ACLs", async () => {
    type BarcodeRow = Database["public"]["Tables"]["food_barcodes"]["Row"];
    type ScopeIsNullable = null extends BarcodeRow["scope_owner_user_id"]
      ? true
      : false;
    type LookupRow = Database["public"]["Functions"]["lookup_readable_food_by_gtin"]["Returns"][number];
    const scopeIsNullable: ScopeIsNullable = true;
    const lookupField: keyof LookupRow = "mapping_provenance_source_food_id";
    expect(scopeIsNullable).toBe(true);
    expect(lookupField).toBe("mapping_provenance_source_food_id");

    const schema = queryLocalDatabase(`
      select current_setting('server_version_num')::integer >= 150000;

      select string_agg(column_name || ':' || data_type || ':' || is_nullable, ',' order by ordinal_position)
      from information_schema.columns
      where table_schema = 'public' and table_name = 'food_barcodes';

      select string_agg(conname, ',' order by conname)
      from pg_constraint
      where conrelid = 'public.food_barcodes'::regclass;

      select string_agg(indexname, ',' order by indexname)
      from pg_indexes
      where schemaname = 'public' and tablename = 'food_barcodes';

      select relrowsecurity from pg_class where oid = 'public.food_barcodes'::regclass;

      select count(*) from pg_policies
      where schemaname = 'public' and tablename = 'food_barcodes';

      select string_agg(column_name, ',' order by column_name)
      from information_schema.column_privileges
      where table_schema = 'public' and table_name = 'food_barcodes'
        and grantee = 'authenticated' and privilege_type = 'SELECT';

      select concat_ws('|',
        has_table_privilege('authenticated', 'public.food_barcodes', 'INSERT'),
        has_table_privilege('authenticated', 'public.food_barcodes', 'UPDATE'),
        has_table_privilege('authenticated', 'public.food_barcodes', 'DELETE'),
        has_table_privilege('authenticated', 'public.food_barcodes', 'TRUNCATE'),
        has_table_privilege('anon', 'public.food_barcodes', 'SELECT')
      );
    `);

    expect(schema).toContain("t\n");
    expect(schema).toContain("id:uuid:NO");
    expect(schema).toContain("scope_owner_user_id:uuid:YES");
    expect(schema).toContain("canonical_gtin:text:NO");
    expect(schema).toContain("food_barcodes_canonical_gtin_check");
    expect(schema).toContain("food_barcodes_scope_gtin_key");
    expect(schema).toContain("food_barcodes_food_gtin_key");
    expect(schema).toContain("food_barcodes_provenance_source_id_idx");
    expect(schema).toContain("canonical_gtin,food_id,provenance_source_food_id,provenance_source_id,scope_owner_user_id,verification_status");
    expect(schema).toContain("f|f|f|f|f");

    const functions = queryLocalDatabase(`
      select concat_ws('|', p.proname, p.provolatile, p.prosecdef,
        array_to_string(p.proconfig, ','),
        has_function_privilege('public', p.oid, 'EXECUTE'),
        has_function_privilege('anon', p.oid, 'EXECUTE'),
        has_function_privilege('authenticated', p.oid, 'EXECUTE'))
      from pg_proc p
      where p.oid in (
        'public.is_valid_canonical_gtin(text)'::regprocedure,
        'public.derive_food_barcode_scope()'::regprocedure,
        'public.lookup_readable_food_by_gtin(text)'::regprocedure
      )
      order by p.proname;
    `);
    expect(functions).toContain(
      'derive_food_barcode_scope|v|f|search_path=""|f|f|f',
    );
    expect(functions).toContain(
      'is_valid_canonical_gtin|i|f|search_path=""|f|f|t',
    );
    expect(functions).toContain(
      'lookup_readable_food_by_gtin|s|f|search_path=""|f|f|t',
    );

    const authenticatedValidation = await userAClient.rpc(
      "is_valid_canonical_gtin",
      { p_gtin: codes.publicOnly },
    );
    expect(authenticatedValidation).toMatchObject({ data: true, error: null });

    const anonymousValidation = await localClient().rpc(
      "is_valid_canonical_gtin",
      { p_gtin: codes.publicOnly },
    );
    expect(anonymousValidation.error).not.toBeNull();
  });

  test("enforces canonical validation, derived scope, parent state, and mapping fields", () => {
    expect(
      queryLocalDatabase(`
        select concat_ws('|',
          public.is_valid_canonical_gtin('${codes.publicOnly}'),
          public.is_valid_canonical_gtin(null),
          public.is_valid_canonical_gtin('not-a-gtin'),
          public.is_valid_canonical_gtin('00000000000001')
        );
      `),
    ).toBe("t|f|f|f");

    const tamperedPublic = canonicalGtin(20);
    const tamperedOwned = canonicalGtin(21);
    insertMapping({
      canonical: tamperedPublic,
      foodId: publicOnlyFoodId,
      scope: userAId,
    });
    insertMapping({
      canonical: tamperedOwned,
      foodId: ownedActiveFoodId,
      provenanceSource: "user_custom",
      scope: userBId,
      verification: "user_asserted",
    });
    expect(
      queryLocalDatabase(`
        select canonical_gtin || '|' || coalesce(scope_owner_user_id::text, 'public')
        from public.food_barcodes
        where canonical_gtin in ('${tamperedPublic}', '${tamperedOwned}')
        order by canonical_gtin;
      `),
    ).toContain(`|public`);
    expect(
      queryLocalDatabase(`
        select scope_owner_user_id from public.food_barcodes
        where canonical_gtin = '${tamperedOwned}';
      `),
    ).toBe(userAId);

    for (const statement of [
      `insert into public.food_barcodes (food_id, canonical_gtin, provenance_source_id, verification_status)
       values ('${publicOnlyFoodId}', '00000000000001', '${usdaSourceId}', 'curated_verified')`,
      `insert into public.food_barcodes (food_id, canonical_gtin, provenance_source_id, verification_status)
       values ('${invalidParentFoodId}', '${canonicalGtin(22)}', '${usdaSourceId}', 'curated_verified')`,
      `insert into public.food_barcodes (food_id, canonical_gtin, provenance_source_id, provenance_source_food_id, verification_status)
       values ('${publicOnlyFoodId}', '${canonicalGtin(23)}', '${usdaSourceId}', ' untrimmed ', 'curated_verified')`,
      `insert into public.food_barcodes (food_id, canonical_gtin, provenance_source_id, verification_status)
       values ('${publicOnlyFoodId}', '${canonicalGtin(24)}', '${usdaSourceId}', 'trusted')`,
    ]) {
      expect(() => executeLocalDatabaseSync(statement)).toThrow();
    }

    expect(
      queryLocalDatabase(`
        select count(*) from public.food_barcodes
        where food_id in ('${ownedArchivedWithPublicFoodId}', '${publicArchivedFoodId}');
      `),
    ).toBe("2");
  });

  test("enforces public and per-user uniqueness while allowing approved scopes", async () => {
    const duplicatePublicCode = canonicalGtin(30);
    const duplicateUserCode = canonicalGtin(31);
    const pairCode = canonicalGtin(32);
    const publicA = randomUUID();
    const publicB = randomUUID();
    const ownA = await createCustomFood(userAClient, "Duplicate own A");
    const ownB = await createCustomFood(userAClient, "Duplicate own B");

    queryLocalDatabase(`
      insert into public.foods (id, source_id, food_type, name, data_quality, is_public)
      values
        ('${publicA}', '${manualSourceId}', 'generic', 'Duplicate public A', 'curated', true),
        ('${publicB}', '${manualSourceId}', 'generic', 'Duplicate public B', 'curated', true);
    `);
    insertMapping({ canonical: duplicatePublicCode, foodId: publicA });
    expect(() =>
      insertMapping({ canonical: duplicatePublicCode, foodId: publicB, retry: false }),
    ).toThrow();

    insertMapping({
      canonical: duplicateUserCode,
      foodId: ownA,
      provenanceSource: "user_custom",
      verification: "user_asserted",
    });
    expect(() =>
      insertMapping({
        canonical: duplicateUserCode,
        foodId: ownB,
        provenanceSource: "user_custom",
        retry: false,
        verification: "user_asserted",
      }),
    ).toThrow();

    insertMapping({ canonical: pairCode, foodId: publicB });
    insertMapping({
      canonical: pairCode,
      foodId: ownB,
      provenanceSource: "user_custom",
      verification: "user_asserted",
    });
    insertMapping({
      canonical: pairCode,
      foodId: otherActiveFoodId,
      provenanceSource: "user_custom",
      verification: "user_asserted",
    });
    expect(
      queryLocalDatabase(`
        select count(*) || '|' || count(distinct scope_owner_user_id)
        from public.food_barcodes where canonical_gtin = '${pairCode}';
      `),
    ).toBe("3|2");

    expect(() =>
      insertMapping({
        canonical: pairCode,
        foodId: ownB,
        provenanceSource: "user_custom",
        retry: false,
        verification: "user_asserted",
      }),
    ).toThrow();
  });

  test("fails closed under concurrent duplicate attempts", async () => {
    const publicCode = canonicalGtin(40);
    const userCode = canonicalGtin(41);
    const crossUserCode = canonicalGtin(42);
    const publicFoods = [randomUUID(), randomUUID()];
    const ownFoods = [
      await createCustomFood(userAClient, "Concurrent own A"),
      await createCustomFood(userAClient, "Concurrent own B"),
    ];
    const crossUserFoods = [
      await createCustomFood(userAClient, "Concurrent cross A"),
      await createCustomFood(userBClient, "Concurrent cross B"),
    ];
    queryLocalDatabase(`
      insert into public.foods (id, source_id, food_type, name, data_quality, is_public)
      values
        ('${publicFoods[0]}', '${manualSourceId}', 'generic', 'Concurrent public A', 'curated', true),
        ('${publicFoods[1]}', '${manualSourceId}', 'generic', 'Concurrent public B', 'curated', true);
    `);

    const insertSql = (foodId: string, code: string, sourceId: string) => `
      begin;
      insert into public.food_barcodes (
        food_id, canonical_gtin, provenance_source_id, verification_status
      ) values ('${foodId}', '${code}', '${sourceId}', 'user_asserted');
      select pg_sleep(0.25);
      commit;
    `;

    const publicAttempts = await Promise.allSettled([
      executeLocalDatabase(insertSql(publicFoods[0], publicCode, usdaSourceId)),
      executeLocalDatabase(insertSql(publicFoods[1], publicCode, usdaSourceId)),
    ]);
    expect(publicAttempts.filter(({ status }) => status === "fulfilled")).toHaveLength(1);
    expect(publicAttempts.filter(({ status }) => status === "rejected")).toHaveLength(1);
    expect(
      queryLocalDatabase(`select count(*) from public.food_barcodes where canonical_gtin = '${publicCode}';`),
    ).toBe("1");

    const userAttempts = await Promise.allSettled([
      executeLocalDatabase(insertSql(ownFoods[0], userCode, userCustomSourceId)),
      executeLocalDatabase(insertSql(ownFoods[1], userCode, userCustomSourceId)),
    ]);
    expect(userAttempts.filter(({ status }) => status === "fulfilled")).toHaveLength(1);
    expect(userAttempts.filter(({ status }) => status === "rejected")).toHaveLength(1);

    const crossUserAttempts = await Promise.allSettled([
      executeLocalDatabase(
        insertSql(crossUserFoods[0], crossUserCode, userCustomSourceId),
      ),
      executeLocalDatabase(
        insertSql(crossUserFoods[1], crossUserCode, userCustomSourceId),
      ),
    ]);
    expect(crossUserAttempts.every(({ status }) => status === "fulfilled")).toBe(true);
    expect(
      queryLocalDatabase(`select count(*) from public.food_barcodes where canonical_gtin = '${crossUserCode}';`),
    ).toBe("2");
  });

  test("derives visibility from parent foods and grants no authenticated DML", async () => {
    const visible = await userAClient
      .from("food_barcodes")
      .select(
        "food_id,canonical_gtin,scope_owner_user_id,provenance_source_id,provenance_source_food_id,verification_status",
      );
    expect(visible.error).toBeNull();
    expect(visible.data?.some(({ food_id }) => food_id === publicOnlyFoodId)).toBe(true);
    expect(visible.data?.some(({ food_id }) => food_id === ownedActiveFoodId)).toBe(true);
    expect(visible.data?.some(({ food_id }) => food_id === otherActiveFoodId)).toBe(false);
    expect(
      visible.data?.find(({ food_id }) => food_id === ownedActiveFoodId)
        ?.scope_owner_user_id,
    ).toBe(userAId);

    const allColumns = await userAClient.from("food_barcodes").select("*");
    expect(allColumns.error).not.toBeNull();

    const anonymous = await localClient()
      .from("food_barcodes")
      .select("canonical_gtin");
    expect(anonymous.error).not.toBeNull();

    const attemptedInsert = await userAClient.from("food_barcodes").insert({
      canonical_gtin: canonicalGtin(50),
      food_id: ownedActiveFoodId,
      provenance_source_id: userCustomSourceId,
      verification_status: "user_asserted",
    });
    expect(attemptedInsert.error).not.toBeNull();

    const attemptedUpdate = await userAClient
      .from("food_barcodes")
      .update({ verification_status: "curated_verified" })
      .eq("canonical_gtin", codes.ownedWins);
    expect(attemptedUpdate.error).not.toBeNull();

    const attemptedDelete = await userAClient
      .from("food_barcodes")
      .delete()
      .eq("canonical_gtin", codes.ownedWins);
    expect(attemptedDelete.error).not.toBeNull();
  });

  test("returns exact owner-aware precedence, archive, miss, and metadata states", async () => {
    const owned = await lookupBarcode(userAClient, codes.ownedWins);
    expect(owned.error).toBeNull();
    expect(owned.data).toEqual([
      expect.objectContaining({
        canonical_gtin: codes.ownedWins,
        food_id: ownedActiveFoodId,
        food_name: "Owned barcode food",
        food_source_code: "user_custom",
        food_source_trust_level: "user_provided",
        mapping_provenance_source_code: "user_custom",
        mapping_provenance_source_food_id: "owned-assertion",
        mapping_verification_status: "user_asserted",
        ownership_kind: "owned_custom",
        result_status: "found_owned",
      }),
    ]);
    expect(Object.keys(owned.data?.[0] ?? {})).not.toContain("calories");

    const publicResult = await lookupBarcode(userAClient, codes.publicOnly);
    expect(publicResult.error).toBeNull();
    expect(publicResult.data).toEqual([
      expect.objectContaining({
        brand_name: "Exact Brand",
        food_id: publicOnlyFoodId,
        food_locale: "he",
        food_source_code: "manual",
        food_source_type: "manual",
        mapping_provenance_source_code: "usda",
        mapping_provenance_source_food_id: "usda-barcode-2",
        mapping_provenance_source_trust_level: "verified",
        mapping_verification_status: "curated_verified",
        ownership_kind: "public",
        result_status: "found_public",
        serving_size: 330,
        serving_unit: "ml",
      }),
    ]);

    const publicFallback = await lookupBarcode(
      userAClient,
      codes.publicBeatsArchived,
    );
    expect(publicFallback.data?.[0]).toMatchObject({
      food_id: publicBeatsArchivedFoodId,
      result_status: "found_public",
    });

    for (const code of [codes.ownedArchived, codes.publicArchived]) {
      const archived = await lookupBarcode(userAClient, code);
      expect(archived.error).toBeNull();
      expect(archived.data?.[0]).toEqual(
        expect.objectContaining({
          canonical_gtin: code,
          food_id: null,
          food_name: null,
          mapping_verification_status: null,
          result_status: "archived_or_unavailable",
        }),
      );
    }

    for (const code of [codes.otherActive, codes.otherArchived, codes.missing]) {
      const missing = await lookupBarcode(userAClient, code);
      expect(missing.error).toBeNull();
      expect(missing.data?.[0]).toEqual(
        expect.objectContaining({
          canonical_gtin: code,
          food_id: null,
          result_status: "not_found_local",
        }),
      );
      expect(
        Object.entries(missing.data?.[0] ?? {})
          .filter(([key]) => !["canonical_gtin", "result_status"].includes(key))
          .every(([, value]) => value === null),
      ).toBe(true);
    }
  });

  test("rejects invalid RPC input and keeps lookup read-only", async () => {
    const invalid = await lookupBarcode(userAClient, "00000000000001");
    expect(invalid.error?.code).toBe("22023");

    const anonymous = await lookupBarcode(localClient(), codes.publicOnly);
    expect(anonymous.error).not.toBeNull();

    const before = queryLocalDatabase(`
      select updated_at from public.food_barcodes
      where food_id = '${publicOnlyFoodId}' and canonical_gtin = '${codes.publicOnly}';
    `);
    const lookup = await lookupBarcode(userAClient, codes.publicOnly);
    expect(lookup.error).toBeNull();
    const after = queryLocalDatabase(`
      select updated_at from public.food_barcodes
      where food_id = '${publicOnlyFoodId}' and canonical_gtin = '${codes.publicOnly}';
    `);
    expect(after).toBe(before);
  });

  test("cascades parent and user deletion, restricts provenance deletion, and updates timestamps", async () => {
    const foodCascadeId = await createCustomFood(userAClient, "Barcode cascade food");
    const foodCascadeCode = canonicalGtin(60);
    insertMapping({
      canonical: foodCascadeCode,
      foodId: foodCascadeId,
      provenanceSource: "user_custom",
      verification: "user_asserted",
    });
    queryLocalDatabase(`delete from public.foods where id = '${foodCascadeId}';`);
    expect(
      queryLocalDatabase(`select count(*) from public.food_barcodes where canonical_gtin = '${foodCascadeCode}';`),
    ).toBe("0");

    const disposableUser = await createUser("barcode-disposable");
    const disposableFoodId = await createCustomFood(
      disposableUser.client,
      "Disposable user barcode",
    );
    const disposableCode = canonicalGtin(61);
    insertMapping({
      canonical: disposableCode,
      foodId: disposableFoodId,
      provenanceSource: "user_custom",
      verification: "user_asserted",
    });
    queryLocalDatabase(`delete from auth.users where id = '${disposableUser.userId}';`);
    expect(
      queryLocalDatabase(`select count(*) from public.food_barcodes where canonical_gtin = '${disposableCode}';`),
    ).toBe("0");

    const provenanceCode = `phase9a_${Date.now()}`;
    const provenanceId = randomUUID();
    const provenanceMappingCode = canonicalGtin(62);
    queryLocalDatabase(`
      insert into public.food_sources (
        id, code, name, source_type, trust_level, is_external
      ) values (
        '${provenanceId}', '${provenanceCode}', 'Phase 9A provenance',
        'imported', 'curated', false
      );
    `);
    insertMapping({
      canonical: provenanceMappingCode,
      foodId: publicOnlyFoodId,
      provenanceSource: provenanceCode,
      verification: "curated_verified",
    });
    expect(() =>
      executeLocalDatabaseSync(
        `delete from public.food_sources where id = '${provenanceId}';`,
      ),
    ).toThrow();

    const timestampCode = canonicalGtin(63);
    insertMapping({
      canonical: timestampCode,
      foodId: ownedActiveFoodId,
      provenanceSource: "user_custom",
      verification: "user_asserted",
    });
    const before = queryLocalDatabase(`
      select updated_at from public.food_barcodes where canonical_gtin = '${timestampCode}';
    `);
    queryLocalDatabase(`
      select pg_sleep(0.02);
      update public.food_barcodes
      set verification_status = 'curated_verified'
      where canonical_gtin = '${timestampCode}';
    `);
    const after = queryLocalDatabase(`
      select updated_at from public.food_barcodes where canonical_gtin = '${timestampCode}';
    `);
    expect(after).not.toBe(before);
  });
});
