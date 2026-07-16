import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { expect, test } from "@playwright/test";
import type { Database, Json } from "@/lib/supabase/database.types";

const localSupabaseUrl = process.env.LOCAL_SUPABASE_URL;
const localSupabasePublishableKey = process.env.LOCAL_SUPABASE_PUBLISHABLE_KEY;
const localOnly = process.env.DATE_E2E_LOCAL_SUPABASE === "1";
const password = "SavedMealReusePassword123!";
const projectId = readFileSync("supabase/config.toml", "utf8").match(
  /^project_id\s*=\s*"([^"]+)"/m,
)?.[1];

if (!projectId) throw new Error("Could not read the local Supabase project id.");

const databaseContainer = `supabase_db_${projectId}`;

test.skip(
  !localOnly || !localSupabaseUrl || !localSupabasePublishableKey,
  "Saved-meal diary reuse tests require the local-only test runner.",
);

type LogArgs = Database["public"]["Functions"]["log_saved_meal_to_diary"]["Args"];
type PersistArgs = Database["public"]["Functions"]["persist_saved_meal"]["Args"];

test.describe.serial("atomic saved-meal diary reuse", () => {
  let userAClient: SupabaseClient<Database>;
  let userBClient: SupabaseClient<Database>;
  let userAId: string;
  let userBId: string;
  let ownedFoodId: string;
  let archivedOwnedFoodId: string;
  let primaryMealId: string;
  let primaryVersion: string;
  const publicFoodId = randomUUID();
  const laterUnreadableFoodId = randomUUID();
  const deletedFoodId = randomUUID();
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

  function item(
    position: number,
    overrides: Record<string, Json | undefined> = {},
  ) {
    return {
      position,
      food_id: null,
      food_name: `Exact snapshot ${position}`,
      brand_name: position === 1 ? "Snapshot brand" : null,
      serving_quantity: position === 1 ? 0 : null,
      serving_unit: position === 1 ? "portion" : null,
      calories: position === 1 ? 0 : 100 + position,
      protein_g: position === 1 ? 0 : null,
      carbohydrates_g: position === 1 ? null : 20,
      fat_g: position === 1 ? 0 : 3,
      notes: position === 1 ? "Snapshot note" : null,
      ...overrides,
    };
  }

  async function persistMeal(
    client: SupabaseClient<Database>,
    name: string,
    items: Json,
    savedMealId: string | null = null,
  ) {
    return client.rpc("persist_saved_meal", {
      p_items: items,
      p_locale: "und",
      p_name: name,
      p_saved_meal_id: savedMealId as unknown as string,
    } satisfies PersistArgs);
  }

  function logArgs(overrides: Partial<LogArgs> = {}): LogArgs {
    return {
      p_entry_date: "2026-07-16",
      p_expected_updated_at: primaryVersion,
      p_idempotency_key: randomUUID(),
      p_meal_type: "breakfast",
      p_saved_meal_id: primaryMealId,
      ...overrides,
    };
  }

  async function log(
    client: SupabaseClient<Database>,
    overrides: Partial<LogArgs> = {},
  ) {
    return client.rpc("log_saved_meal_to_diary", logArgs(overrides));
  }

  test.beforeAll(async () => {
    const userA = await createUser("saved-meal-reuse-a");
    const userB = await createUser("saved-meal-reuse-b");
    userAClient = userA.client;
    userBClient = userB.client;
    userAId = userA.userId;
    userBId = userB.userId;

    queryDatabase(`
      insert into public.foods (
        id, food_type, name, locale, data_quality, is_public, is_archived, source_id
      ) values
        ('${publicFoodId}', 'generic', 'Public current name', 'en', 'curated', true, false,
          (select id from public.food_sources where code = 'manual')),
        ('${laterUnreadableFoodId}', 'generic', 'Later unreadable food', 'en', 'curated', true, false,
          (select id from public.food_sources where code = 'manual')),
        ('${deletedFoodId}', 'generic', 'Later deleted food', 'en', 'curated', true, false,
          (select id from public.food_sources where code = 'manual'));
    `);

    ownedFoodId = await createCustomFood(userAClient, "Owned readable food");
    archivedOwnedFoodId = await createCustomFood(userAClient, "Owned archived food");
    expect(
      (
        await userAClient.rpc("set_custom_food_archived", {
          p_food_id: archivedOwnedFoodId,
          p_is_archived: true,
        })
      ).error,
    ).toBeNull();

    const created = await persistMeal(
      userAClient,
      "Primary reuse meal",
      [
        item(1, { food_id: publicFoodId }),
        item(2, { food_id: ownedFoodId, food_name: "Owned frozen name" }),
        item(3, { food_id: archivedOwnedFoodId, food_name: "Archived owned frozen name" }),
        item(4, { food_id: laterUnreadableFoodId, food_name: "Unreadable frozen name" }),
        item(5, { food_id: null, food_name: "Manual frozen name" }),
      ] as Json,
    );
    expect(created.error).toBeNull();
    primaryMealId = created.data?.[0].saved_meal_id as string;
    primaryVersion = (
      await userAClient
        .from("saved_meals")
        .select("updated_at")
        .eq("id", primaryMealId)
        .single()
    ).data?.updated_at as string;

    queryDatabase(`
      update public.foods set is_public = false where id = '${laterUnreadableFoodId}';
    `);
  });

  test.afterAll(() => {
    queryDatabase(`
      delete from public.foods where id in ('${publicFoodId}', '${laterUnreadableFoodId}');
      delete from auth.users where id in ('${userAId}', '${userBId}');
    `);
  });

  test("creates the receipt/provenance schema with RLS, least grants, and synchronized types", () => {
    const state = queryDatabase(`
      select relrowsecurity from pg_class where oid = 'public.saved_meal_diary_runs'::regclass;
      select concat_ws('|',
        has_table_privilege('anon', 'public.saved_meal_diary_runs', 'select'),
        has_table_privilege('authenticated', 'public.saved_meal_diary_runs', 'select'),
        has_table_privilege('authenticated', 'public.saved_meal_diary_runs', 'insert'),
        has_table_privilege('authenticated', 'public.saved_meal_diary_runs', 'update'),
        has_table_privilege('authenticated', 'public.saved_meal_diary_runs', 'delete')
      );
      select concat_ws('|',
        has_column_privilege('anon', 'public.saved_meal_diary_runs', 'user_id', 'insert'),
        has_column_privilege('authenticated', 'public.saved_meal_diary_runs', 'user_id', 'insert'),
        has_column_privilege('authenticated', 'public.saved_meal_diary_runs', 'write_transaction_id', 'insert')
      );
      select concat_ws('|',
        has_function_privilege('public', p.oid, 'execute'),
        has_function_privilege('anon', p.oid, 'execute'),
        has_function_privilege('authenticated', p.oid, 'execute'),
        p.prosecdef,
        array_to_string(p.proconfig, ',')
      ) from pg_proc p
      where p.oid = 'public.log_saved_meal_to_diary(uuid,timestamptz,date,text,uuid)'::regprocedure;
      select count(*) from information_schema.columns
      where table_schema = 'public' and table_name = 'diary_entries'
        and column_name in ('saved_meal_diary_run_id', 'saved_meal_item_position');
    `);

    expect(state).toContain("t\nf|t|f|f|f\nf|t|f");
    expect(state).toContain('f|f|t|f|search_path=""');
    expect(state.endsWith("2")).toBe(true);

    const manual = userAClient.from("diary_entries").insert({
      entry_date: "2026-07-15",
      food_name: "Manual provenance fixture",
      meal_type: "other",
      user_id: userAId,
    });
    return expect(manual).resolves.toMatchObject({
      data: null,
      error: null,
    });
  });

  test("copies exact ordered snapshots and applies food-link rules atomically", async () => {
    const result = await log(userAClient, { p_meal_type: "lunch" });
    expect(result.error).toBeNull();
    expect(result.data?.[0]).toMatchObject({ item_count: 5, result_status: "success" });
    const diaryRunId = result.data?.[0].diary_run_id as string;

    const rows = await userAClient
      .from("diary_entries")
      .select("source,saved_meal_diary_run_id,saved_meal_item_position,entry_date,meal_type,food_id,food_name,brand_name,serving_quantity,serving_unit,calories,protein_g,carbohydrates_g,fat_g,notes")
      .eq("saved_meal_diary_run_id", diaryRunId)
      .order("saved_meal_item_position");
    expect(rows.error).toBeNull();
    expect(rows.data?.map((row) => row.saved_meal_item_position)).toEqual([1, 2, 3, 4, 5]);
    expect(rows.data?.[0]).toMatchObject({
      brand_name: "Snapshot brand",
      calories: 0,
      carbohydrates_g: null,
      entry_date: "2026-07-16",
      fat_g: 0,
      food_id: publicFoodId,
      food_name: "Exact snapshot 1",
      meal_type: "lunch",
      notes: "Snapshot note",
      protein_g: 0,
      serving_quantity: 0,
      serving_unit: "portion",
      source: "saved_meal",
    });
    expect(rows.data?.[1].food_id).toBe(ownedFoodId);
    expect(rows.data?.[2].food_id).toBe(archivedOwnedFoodId);
    expect(rows.data?.[3].food_id).toBeNull();
    expect(rows.data?.[3].food_name).toBe("Unreadable frozen name");
    expect(rows.data?.[4].food_id).toBeNull();

    const otherRows = await userBClient
      .from("diary_entries")
      .select("id")
      .eq("saved_meal_diary_run_id", diaryRunId);
    const otherRun = await userBClient
      .from("saved_meal_diary_runs")
      .select("id")
      .eq("id", diaryRunId);
    expect(otherRows.data).toEqual([]);
    expect(otherRun.data).toEqual([]);

    const crossOwnerReceipt = await userBClient.from("saved_meal_diary_runs").insert({
      entry_date: "2026-07-16",
      idempotency_key: randomUUID(),
      item_count: 1,
      meal_type: "lunch",
      saved_meal_id: primaryMealId,
      source_updated_at: primaryVersion,
      user_id: userAId,
    });
    expect(crossOwnerReceipt.error).not.toBeNull();

    const invalidProvenance = await userAClient.from("diary_entries").insert({
      entry_date: "2026-07-16",
      food_name: "Invalid direct saved-meal entry",
      meal_type: "lunch",
      saved_meal_diary_run_id: randomUUID(),
      saved_meal_item_position: 1,
      source: "saved_meal",
      user_id: userAId,
    });
    expect(invalidProvenance.error).not.toBeNull();

    const immutable = await userAClient
      .from("diary_entries")
      .update({ source: "manual" })
      .eq("saved_meal_diary_run_id", diaryRunId);
    expect(immutable.error).not.toBeNull();

    const editable = await userAClient
      .from("diary_entries")
      .update({ calories: 777, food_name: "Edited diary snapshot" })
      .eq("saved_meal_diary_run_id", diaryRunId)
      .eq("saved_meal_item_position", 1)
      .select("calories,food_name")
      .single();
    expect(editable.data).toEqual({ calories: 777, food_name: "Edited diary snapshot" });

    const source = await userAClient
      .from("saved_meal_items")
      .select("calories,food_name")
      .eq("saved_meal_id", primaryMealId)
      .eq("position", 1)
      .single();
    expect(source.data).toEqual({ calories: 0, food_name: "Exact snapshot 1" });

    const reusable = await userAClient.rpc("get_reusable_foods");
    expect(reusable.error).toBeNull();
    const recentIds = reusable.data
      ?.filter(({ collection_type }) => collection_type === "recent")
      .map(({ food_id }) => food_id);
    expect(recentIds).toEqual(expect.arrayContaining([publicFoodId, ownedFoodId]));

    const deletedLinkMeal = await persistMeal(
      userAClient,
      "Deleted link meal",
      [item(1, { food_id: deletedFoodId, food_name: "Deleted-link snapshot" })] as Json,
    );
    const deletedLinkMealId = deletedLinkMeal.data?.[0].saved_meal_id as string;
    const deletedLinkVersion = (
      await userAClient
        .from("saved_meals")
        .select("updated_at")
        .eq("id", deletedLinkMealId)
        .single()
    ).data?.updated_at as string;
    queryDatabase(`delete from public.foods where id = '${deletedFoodId}';`);
    expect(
      (
        await userAClient
          .from("saved_meal_items")
          .select("food_id")
          .eq("saved_meal_id", deletedLinkMealId)
          .single()
      ).data?.food_id,
    ).toBeNull();
    const deletedLinkRun = await userAClient.rpc("log_saved_meal_to_diary", {
      p_entry_date: "2026-07-16",
      p_expected_updated_at: deletedLinkVersion,
      p_idempotency_key: randomUUID(),
      p_meal_type: "lunch",
      p_saved_meal_id: deletedLinkMealId,
    });
    expect(deletedLinkRun.data?.[0].result_status).toBe("success");
    expect(
      (
        await userAClient
          .from("diary_entries")
          .select("food_id,food_name")
          .eq("saved_meal_diary_run_id", deletedLinkRun.data?.[0].diary_run_id as string)
          .single()
      ).data,
    ).toEqual({ food_id: null, food_name: "Deleted-link snapshot" });
  });

  test("is idempotent under sequential and concurrent retries without recreating deleted rows", async () => {
    const key = randomUUID();
    const args = logArgs({ p_idempotency_key: key, p_meal_type: "dinner" });
    const first = await userAClient.rpc("log_saved_meal_to_diary", args);
    const second = await userAClient.rpc("log_saved_meal_to_diary", args);
    expect(first.error).toBeNull();
    expect(second.data?.[0]).toEqual(first.data?.[0]);
    const diaryRunId = first.data?.[0].diary_run_id as string;

    for (const conflictArgs of [
      { ...args, p_entry_date: "2026-07-17" },
      { ...args, p_meal_type: "snack" },
      { ...args, p_saved_meal_id: randomUUID() },
      { ...args, p_expected_updated_at: "2026-07-15T00:00:00.000Z" },
    ]) {
      const conflict = await userAClient.rpc("log_saved_meal_to_diary", conflictArgs);
      expect(conflict.data?.[0].result_status).toBe("idempotency_conflict");
    }

    await userAClient
      .from("diary_entries")
      .delete()
      .eq("saved_meal_diary_run_id", diaryRunId)
      .eq("saved_meal_item_position", 5);
    const afterDelete = await userAClient.rpc("log_saved_meal_to_diary", args);
    expect(afterDelete.data?.[0]).toEqual(first.data?.[0]);
    expect(
      (
        await userAClient
          .from("diary_entries")
          .select("id", { count: "exact", head: true })
          .eq("saved_meal_diary_run_id", diaryRunId)
      ).count,
    ).toBe(4);
    await userAClient
      .from("diary_entries")
      .delete()
      .eq("saved_meal_diary_run_id", diaryRunId);
    const afterAllDeleted = await userAClient.rpc("log_saved_meal_to_diary", args);
    expect(afterAllDeleted.data?.[0]).toEqual(first.data?.[0]);
    expect(
      (
        await userAClient
          .from("diary_entries")
          .select("id", { count: "exact", head: true })
          .eq("saved_meal_diary_run_id", diaryRunId)
      ).count,
    ).toBe(0);

    const concurrentKey = randomUUID();
    const concurrentArgs = logArgs({
      p_entry_date: "2026-07-17",
      p_idempotency_key: concurrentKey,
      p_meal_type: "snack",
    });
    const [concurrentA, concurrentB] = await Promise.all([
      userAClient.rpc("log_saved_meal_to_diary", concurrentArgs),
      userAClient.rpc("log_saved_meal_to_diary", concurrentArgs),
    ]);
    expect(concurrentA.error).toBeNull();
    expect(concurrentB.error).toBeNull();
    expect(concurrentB.data?.[0]).toEqual(concurrentA.data?.[0]);
    expect(
      queryDatabase(`select count(*) from public.saved_meal_diary_runs where user_id = '${userAId}' and idempotency_key = '${concurrentKey}';`),
    ).toBe("1");
    expect(
      queryDatabase(`select count(*) from public.saved_meal_diary_runs where user_id = '${userAId}' and saved_meal_id = '${primaryMealId}' and meal_type in ('dinner', 'snack');`),
    ).toBe("2");
  });

  test("rolls back a later item failure and reports ownership, stale, archive, and completed-retry states", async () => {
    const failingMeal = await persistMeal(
      userAClient,
      "Atomic failure meal",
      [item(1), item(2, { food_name: "Reject this diary snapshot" })] as Json,
    );
    const failingMealId = failingMeal.data?.[0].saved_meal_id as string;
    const failingVersion = (
      await userAClient
        .from("saved_meals")
        .select("updated_at")
        .eq("id", failingMealId)
        .single()
    ).data?.updated_at as string;
    const failureKey = randomUUID();

    queryDatabase(`
      create function public.reject_saved_meal_diary_fixture()
      returns trigger language plpgsql set search_path = '' as $$
      begin
        if new.source = 'saved_meal' and new.food_name = 'Reject this diary snapshot' then
          raise exception 'fixture rejection';
        end if;
        return new;
      end;
      $$;
      create trigger reject_saved_meal_diary_fixture
      before insert on public.diary_entries
      for each row execute function public.reject_saved_meal_diary_fixture();
    `);
    const failed = await userAClient.rpc("log_saved_meal_to_diary", {
      p_entry_date: "2026-07-18",
      p_expected_updated_at: failingVersion,
      p_idempotency_key: failureKey,
      p_meal_type: "other",
      p_saved_meal_id: failingMealId,
    });
    expect(failed.error).not.toBeNull();
    expect(
      queryDatabase(`select count(*) from public.saved_meal_diary_runs where idempotency_key = '${failureKey}';`),
    ).toBe("0");
    expect(
      queryDatabase("select count(*) from public.diary_entries where food_name = 'Reject this diary snapshot';"),
    ).toBe("0");
    queryDatabase(`
      drop trigger reject_saved_meal_diary_fixture on public.diary_entries;
      drop function public.reject_saved_meal_diary_fixture();
    `);

    const otherUser = await log(userBClient);
    expect(otherUser.data?.[0].result_status).toBe("unavailable");

    const completedKey = randomUUID();
    const completedArgs = logArgs({ p_idempotency_key: completedKey, p_meal_type: "other" });
    const completed = await userAClient.rpc("log_saved_meal_to_diary", completedArgs);
    expect(completed.data?.[0].result_status).toBe("success");

    const changed = await persistMeal(
      userAClient,
      "Changed after review",
      [item(1, { food_name: "Changed source only" })] as Json,
      primaryMealId,
    );
    expect(changed.error).toBeNull();
    const changedVersion = (
      await userAClient
        .from("saved_meals")
        .select("updated_at")
        .eq("id", primaryMealId)
        .single()
    ).data?.updated_at as string;

    const completedRetry = await userAClient.rpc("log_saved_meal_to_diary", completedArgs);
    expect(completedRetry.data?.[0]).toEqual(completed.data?.[0]);
    expect((await log(userAClient)).data?.[0].result_status).toBe("stale_review");

    const currentArgs = logArgs({
      p_expected_updated_at: changedVersion,
      p_idempotency_key: randomUUID(),
    });
    expect(
      (
        await userAClient.rpc("set_saved_meal_archived", {
          p_is_archived: true,
          p_saved_meal_id: primaryMealId,
        })
      ).error,
    ).toBeNull();
    expect(
      (await userAClient.rpc("log_saved_meal_to_diary", currentArgs)).data?.[0]
        .result_status,
    ).toBe("archived");
    expect(
      queryDatabase(`select count(*) from public.saved_meal_diary_runs where idempotency_key = '${currentArgs.p_idempotency_key}';`),
    ).toBe("0");
    expect(
      (await userAClient.rpc("log_saved_meal_to_diary", completedArgs)).data?.[0],
    ).toEqual(completed.data?.[0]);
  });

  test("accepts every meal type and the one-item and fifty-item boundaries", async () => {
    const one = await persistMeal(userAClient, "One item meal", [item(1)] as Json);
    const oneId = one.data?.[0].saved_meal_id as string;
    const oneVersion = (
      await userAClient.from("saved_meals").select("updated_at").eq("id", oneId).single()
    ).data?.updated_at as string;

    for (const [index, mealType] of ["breakfast", "lunch", "dinner", "snack", "other"].entries()) {
      const result = await userAClient.rpc("log_saved_meal_to_diary", {
        p_entry_date: `2026-08-${String(index + 1).padStart(2, "0")}`,
        p_expected_updated_at: oneVersion,
        p_idempotency_key: randomUUID(),
        p_meal_type: mealType,
        p_saved_meal_id: oneId,
      });
      expect(result.data?.[0]).toMatchObject({ item_count: 1, result_status: "success" });
    }

    const fifty = await persistMeal(
      userAClient,
      "Fifty item meal",
      Array.from({ length: 50 }, (_, index) => item(index + 1)) as Json,
    );
    const fiftyId = fifty.data?.[0].saved_meal_id as string;
    const fiftyVersion = (
      await userAClient.from("saved_meals").select("updated_at").eq("id", fiftyId).single()
    ).data?.updated_at as string;
    const logged = await userAClient.rpc("log_saved_meal_to_diary", {
      p_entry_date: "2026-08-10",
      p_expected_updated_at: fiftyVersion,
      p_idempotency_key: randomUUID(),
      p_meal_type: "dinner",
      p_saved_meal_id: fiftyId,
    });
    expect(logged.data?.[0]).toMatchObject({ item_count: 50, result_status: "success" });
  });
});
