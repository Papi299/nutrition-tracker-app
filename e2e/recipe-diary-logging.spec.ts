import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { expect, test } from "@playwright/test";
import type { Database, Json } from "@/lib/supabase/database.types";

const localSupabaseUrl = process.env.LOCAL_SUPABASE_URL;
const localSupabasePublishableKey = process.env.LOCAL_SUPABASE_PUBLISHABLE_KEY;
const localOnly = process.env.DATE_E2E_LOCAL_SUPABASE === "1";
const password = "RecipeDiaryLoggingPassword123!";
const projectId = readFileSync("supabase/config.toml", "utf8").match(
  /^project_id\s*=\s*"([^"]+)"/m,
)?.[1];

if (!projectId) throw new Error("Could not read the local Supabase project id.");
const databaseContainer = `supabase_db_${projectId}`;

test.skip(
  !localOnly || !localSupabaseUrl || !localSupabasePublishableKey,
  "Recipe diary logging tests require the local-only test runner.",
);

type LogArgs = Database["public"]["Functions"]["log_recipe_to_diary"]["Args"];
type PersistArgs = Database["public"]["Functions"]["persist_recipe"]["Args"];
type UseArgs = Database["public"]["Functions"]["get_owned_recipe_use_contract"]["Args"];

test.describe.serial("atomic reviewed recipe diary logging", () => {
  let userAClient: SupabaseClient<Database>;
  let userBClient: SupabaseClient<Database>;
  let userAId: string;
  let userBId: string;
  let primaryRecipeId: string;
  let primaryVersion: string;
  let oneRecipeId: string;
  let oneVersion: string;
  let fiftyRecipeId: string;
  let fiftyVersion: string;
  let overflowRecipeId: string;
  let overflowVersion: string;
  let otherRecipeId: string;
  const publicFoodId = randomUUID();
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
      brand_name: null,
      calories: 0,
      carbohydrates_g: 0,
      fat_g: 0,
      food_id: null,
      ingredient_name: `Recipe snapshot ${position}`,
      notes: null,
      position,
      protein_g: 0,
      quantity: 1,
      unit: "portion",
      ...overrides,
    };
  }

  async function persistRecipe(
    client: SupabaseClient<Database>,
    name: string,
    yieldServings: number,
    ingredients: Json,
    recipeId: string | null = null,
  ) {
    const result = await client.rpc("persist_recipe", {
      p_ingredients: ingredients,
      p_locale: "und",
      p_name: name,
      p_recipe_id: recipeId as unknown as string,
      p_yield_servings: yieldServings,
    } satisfies PersistArgs);
    expect(result.error).toBeNull();
    return result.data?.[0].recipe_id as string;
  }

  async function version(client: SupabaseClient<Database>, recipeId: string) {
    const result = await client
      .from("recipes")
      .select("updated_at")
      .eq("id", recipeId)
      .single();
    expect(result.error).toBeNull();
    return result.data?.updated_at as string;
  }

  function logArgs(overrides: Partial<LogArgs> = {}): LogArgs {
    return {
      p_entry_date: "2026-07-17",
      p_expected_updated_at: primaryVersion,
      p_idempotency_key: randomUUID(),
      p_meal_type: "lunch",
      p_recipe_id: primaryRecipeId,
      p_requested_servings: 1.5,
      ...overrides,
    };
  }

  async function derive(
    client: SupabaseClient<Database>,
    recipeId: string,
    requestedServings: number,
  ) {
    const result = await client.rpc("get_owned_recipe_use_contract", {
      p_recipe_id: recipeId,
      p_requested_servings: requestedServings,
    } satisfies UseArgs);
    expect(result.error).toBeNull();
    return result.data?.[0];
  }

  test.beforeAll(async () => {
    const userA = await createUser("recipe-diary-a");
    const userB = await createUser("recipe-diary-b");
    userAClient = userA.client;
    userBClient = userB.client;
    userAId = userA.userId;
    userBId = userB.userId;

    queryDatabase(`
      insert into public.foods (
        id, food_type, name, locale, data_quality, is_public, is_archived, source_id
      ) values (
        '${publicFoodId}', 'generic', 'Linked current food', 'en', 'curated', true, false,
        (select id from public.food_sources where code = 'manual')
      );
    `);

    primaryRecipeId = await persistRecipe(userAClient, "Recipe snapshot name", 3, [
      ingredient(1, {
        calories: 100,
        carbohydrates_g: null,
        fat_g: 0,
        food_id: publicFoodId,
        protein_g: 0.01,
      }),
      ingredient(2, {
        calories: 201,
        carbohydrates_g: 5,
        fat_g: 0,
        protein_g: 0.02,
      }),
    ] as Json);
    primaryVersion = await version(userAClient, primaryRecipeId);

    oneRecipeId = await persistRecipe(userAClient, "One ingredient recipe", 1, [
      ingredient(1),
    ] as Json);
    oneVersion = await version(userAClient, oneRecipeId);

    fiftyRecipeId = await persistRecipe(
      userAClient,
      "Fifty ingredient recipe",
      1,
      Array.from({ length: 50 }, (_, index) =>
        ingredient(index + 1, { calories: 1 }),
      ) as Json,
    );
    fiftyVersion = await version(userAClient, fiftyRecipeId);

    overflowRecipeId = await persistRecipe(userAClient, "Overflow recipe", 1, [
      ingredient(1, {
        calories: 2_147_483_647,
        carbohydrates_g: 999_999.99,
        fat_g: 999_999.99,
        protein_g: 999_999.99,
      }),
    ] as Json);
    overflowVersion = await version(userAClient, overflowRecipeId);

    otherRecipeId = await persistRecipe(userBClient, "Other owner recipe", 1, [
      ingredient(1, { calories: 10 }),
    ] as Json);
  });

  test.afterAll(() => {
    queryDatabase(`
      delete from public.foods where id = '${publicFoodId}';
      delete from auth.users where id in ('${userAId}', '${userBId}');
    `);
  });

  test("creates owner-only receipts, immutable provenance, and least invoker grants", async () => {
    const metadata = queryDatabase(`
      select relrowsecurity
      from pg_class where oid = 'public.recipe_diary_runs'::regclass;
      select concat_ws('|',
        has_table_privilege('anon', 'public.recipe_diary_runs', 'select'),
        has_table_privilege('authenticated', 'public.recipe_diary_runs', 'select'),
        has_table_privilege('authenticated', 'public.recipe_diary_runs', 'insert'),
        has_table_privilege('authenticated', 'public.recipe_diary_runs', 'update'),
        has_table_privilege('authenticated', 'public.recipe_diary_runs', 'delete')
      );
      select concat_ws('|',
        has_column_privilege('anon', 'public.recipe_diary_runs', 'user_id', 'insert'),
        has_column_privilege('authenticated', 'public.recipe_diary_runs', 'user_id', 'insert'),
        has_column_privilege('authenticated', 'public.recipe_diary_runs', 'write_transaction_id', 'insert')
      );
      select concat_ws('|',
        p.provolatile,
        p.prosecdef,
        array_to_string(p.proconfig, ','),
        has_function_privilege('public', p.oid, 'execute'),
        has_function_privilege('anon', p.oid, 'execute'),
        has_function_privilege('authenticated', p.oid, 'execute')
      ) from pg_proc p
      where p.oid = 'public.log_recipe_to_diary(uuid,timestamptz,numeric,date,text,uuid)'::regprocedure;
      select count(*) from information_schema.columns
      where table_schema = 'public' and table_name = 'diary_entries'
        and column_name = 'recipe_diary_run_id';
    `);
    expect(metadata).toContain("t\nf|t|f|f|f\nf|t|f");
    expect(metadata).toContain('v|f|search_path=""|f|f|t');
    expect(metadata.endsWith("1")).toBe(true);

    const manual = await userAClient.from("diary_entries").insert({
      entry_date: "2026-07-16",
      food_name: "Manual provenance remains valid",
      meal_type: "other",
      user_id: userAId,
    });
    expect(manual.error).toBeNull();

    const crossOwnerRun = await userBClient.from("recipe_diary_runs").insert({
      entry_date: "2026-07-17",
      idempotency_key: randomUUID(),
      meal_type: "lunch",
      recipe_id: primaryRecipeId,
      requested_servings: 1,
      source_updated_at: primaryVersion,
      user_id: userBId,
    });
    expect(crossOwnerRun.error).not.toBeNull();
  });

  test("inserts one exact aggregate snapshot for one and fifty ingredients", async () => {
    const contract = await derive(userAClient, primaryRecipeId, 1.5);
    expect(contract?.result_status).toBe("ready");
    const primary = await userAClient.rpc("log_recipe_to_diary", logArgs());
    expect(primary.error).toBeNull();
    expect(primary.data?.[0]).toMatchObject({
      created_entry_count: 1,
      result_status: "success",
    });
    const primaryRunId = primary.data?.[0].diary_run_id as string;
    const row = await userAClient
      .from("diary_entries")
      .select("*")
      .eq("recipe_diary_run_id", primaryRunId)
      .single();
    expect(row.error).toBeNull();
    expect(row.data).toMatchObject({
      brand_name: null,
      calories: contract?.diary_calories,
      carbohydrates_g: null,
      entry_date: "2026-07-17",
      fat_g: 0,
      food_id: null,
      food_name: "Recipe snapshot name",
      meal_type: "lunch",
      notes: null,
      protein_g: contract?.diary_protein_g,
      recipe_diary_run_id: primaryRunId,
      saved_meal_diary_run_id: null,
      saved_meal_item_position: null,
      serving_quantity: 1.5,
      serving_unit: null,
      source: "recipe",
      user_id: userAId,
    });
    expect(contract?.diary_calories).toBe(151);
    expect(contract?.diary_protein_g).toBe(0.02);

    const one = await userAClient.rpc("log_recipe_to_diary", {
      ...logArgs(),
      p_entry_date: "2026-07-18",
      p_expected_updated_at: oneVersion,
      p_recipe_id: oneRecipeId,
      p_requested_servings: 1,
    });
    const fifty = await userAClient.rpc("log_recipe_to_diary", {
      ...logArgs(),
      p_entry_date: "2026-07-19",
      p_expected_updated_at: fiftyVersion,
      p_recipe_id: fiftyRecipeId,
      p_requested_servings: 1,
    });
    expect(one.data?.[0]).toMatchObject({ created_entry_count: 1, result_status: "success" });
    expect(fifty.data?.[0]).toMatchObject({ created_entry_count: 1, result_status: "success" });
    expect(
      queryDatabase(`
        select count(*) from public.diary_entries
        where recipe_diary_run_id in (
          '${one.data?.[0].diary_run_id}', '${fifty.data?.[0].diary_run_id}'
        );
      `),
    ).toBe("2");
    expect(
      (
        await userAClient
          .from("diary_entries")
          .select("calories,protein_g,carbohydrates_g,fat_g")
          .eq("recipe_diary_run_id", one.data?.[0].diary_run_id as string)
          .single()
      ).data,
    ).toEqual({ calories: 0, protein_g: 0, carbohydrates_g: 0, fat_g: 0 });
    expect(
      (
        await userAClient
          .from("diary_entries")
          .select("calories")
          .eq("recipe_diary_run_id", fifty.data?.[0].diary_run_id as string)
          .single()
      ).data?.calories,
    ).toBe(50);

    const otherRead = await userBClient
      .from("recipe_diary_runs")
      .select("id")
      .eq("id", primaryRunId);
    expect(otherRead.data).toEqual([]);
    const updateRun = await userAClient
      .from("recipe_diary_runs")
      .update({ meal_type: "snack" })
      .eq("id", primaryRunId);
    const deleteRun = await userAClient
      .from("recipe_diary_runs")
      .delete()
      .eq("id", primaryRunId);
    expect(updateRun.error).not.toBeNull();
    expect(deleteRun.error).not.toBeNull();

    const reusable = await userAClient.rpc("get_reusable_foods");
    expect(reusable.data?.filter(({ collection_type }) => collection_type === "recent")).toEqual([]);
    expect(
      queryDatabase(`
        select concat_ws('|',
          (select count(*) from public.food_favorites where user_id = '${userAId}'),
          (select count(*) from public.saved_meals where user_id = '${userAId}')
        );
      `),
    ).toBe("0|0");
  });

  test("converges sequential and concurrent retries and rejects token conflicts", async () => {
    const key = randomUUID();
    const args = logArgs({
      p_entry_date: "2026-07-20",
      p_idempotency_key: key,
      p_meal_type: "dinner",
    });
    const first = await userAClient.rpc("log_recipe_to_diary", args);
    const second = await userAClient.rpc("log_recipe_to_diary", args);
    expect(first.error).toBeNull();
    expect(second.data?.[0]).toEqual(first.data?.[0]);

    for (const conflict of [
      { ...args, p_recipe_id: oneRecipeId },
      { ...args, p_expected_updated_at: "2026-07-16T00:00:00Z" },
      { ...args, p_requested_servings: 2 },
      { ...args, p_entry_date: "2026-07-21" },
      { ...args, p_meal_type: "snack" },
    ]) {
      expect(
        (await userAClient.rpc("log_recipe_to_diary", conflict)).data?.[0]
          .result_status,
      ).toBe("idempotency_conflict");
    }

    const concurrentKey = randomUUID();
    const concurrentArgs = logArgs({
      p_entry_date: "2026-07-21",
      p_idempotency_key: concurrentKey,
      p_meal_type: "snack",
    });
    const [concurrentA, concurrentB] = await Promise.all([
      userAClient.rpc("log_recipe_to_diary", concurrentArgs),
      userAClient.rpc("log_recipe_to_diary", concurrentArgs),
    ]);
    expect(concurrentA.error).toBeNull();
    expect(concurrentB.data?.[0]).toEqual(concurrentA.data?.[0]);
    expect(
      queryDatabase(`
        select concat_ws('|',
          (select count(*) from public.recipe_diary_runs where idempotency_key = '${concurrentKey}'),
          (select count(*) from public.diary_entries where recipe_diary_run_id = '${concurrentA.data?.[0].diary_run_id}')
        );
      `),
    ).toBe("1|1");

    const runId = first.data?.[0].diary_run_id as string;
    await userAClient.from("diary_entries").delete().eq("recipe_diary_run_id", runId);
    expect((await userAClient.rpc("log_recipe_to_diary", args)).data?.[0]).toEqual(
      first.data?.[0],
    );
    expect(
      (
        await userAClient
          .from("diary_entries")
          .select("id", { count: "exact", head: true })
          .eq("recipe_diary_run_id", runId)
      ).count,
    ).toBe(0);

    const directOldRunInsert = await userAClient.from("diary_entries").insert({
      entry_date: args.p_entry_date,
      food_name: "Forbidden old run reuse",
      meal_type: args.p_meal_type,
      recipe_diary_run_id: runId,
      serving_quantity: args.p_requested_servings,
      source: "recipe",
      user_id: userAId,
    });
    expect(directOldRunInsert.error).not.toBeNull();

    const newCopy = await userAClient.rpc("log_recipe_to_diary", {
      ...args,
      p_idempotency_key: randomUUID(),
    });
    expect(newCopy.data?.[0].result_status).toBe("success");
    expect(newCopy.data?.[0].diary_run_id).not.toBe(runId);
  });

  test("preserves completed retries while stale, archive, ownership, integrity, and overflow writes fail closed", async () => {
    const completedArgs = logArgs({
      p_entry_date: "2026-07-22",
      p_idempotency_key: randomUUID(),
      p_meal_type: "other",
    });
    const completed = await userAClient.rpc("log_recipe_to_diary", completedArgs);
    expect(completed.data?.[0].result_status).toBe("success");

    const stateRecipeId = await persistRecipe(userAClient, "State recipe", 2, [
      ingredient(1, { calories: 1, food_id: publicFoodId }),
      ingredient(2, { calories: 2 }),
    ] as Json);
    const stateIngredients = [
      ingredient(1, { calories: 1, food_id: publicFoodId }),
      ingredient(2, { calories: 2 }),
    ] as Json;

    for (const mutation of [
      () => persistRecipe(userAClient, "State recipe renamed", 2, stateIngredients, stateRecipeId),
      () => persistRecipe(userAClient, "State recipe renamed", 3, stateIngredients, stateRecipeId),
      () => persistRecipe(userAClient, "State recipe renamed", 3, [
        ingredient(1, { calories: 9, food_id: publicFoodId }),
        ingredient(2, { calories: 2 }),
      ] as Json, stateRecipeId),
      () => persistRecipe(userAClient, "State recipe renamed", 3, [
        ingredient(1, { calories: 2 }),
        ingredient(2, { calories: 9, food_id: publicFoodId }),
      ] as Json, stateRecipeId),
      () => persistRecipe(userAClient, "State recipe renamed", 3, [
        ingredient(1, { calories: 2 }),
        ingredient(2, { calories: 9, food_id: null }),
      ] as Json, stateRecipeId),
    ]) {
      const reviewedVersion = await version(userAClient, stateRecipeId);
      await new Promise((resolve) => setTimeout(resolve, 5));
      await mutation();
      const stale = await userAClient.rpc("log_recipe_to_diary", {
        ...logArgs(),
        p_expected_updated_at: reviewedVersion,
        p_idempotency_key: randomUUID(),
        p_recipe_id: stateRecipeId,
        p_requested_servings: 1,
      });
      expect(stale.data?.[0].result_status).toBe("stale_review");
    }

    const archiveReviewedVersion = await version(userAClient, stateRecipeId);
    await userAClient.rpc("set_recipe_archived", {
      p_is_archived: true,
      p_recipe_id: stateRecipeId,
    });
    expect(
      (
        await userAClient.rpc("log_recipe_to_diary", {
          ...logArgs(),
          p_expected_updated_at: archiveReviewedVersion,
          p_idempotency_key: randomUUID(),
          p_recipe_id: stateRecipeId,
          p_requested_servings: 1,
        })
      ).data?.[0].result_status,
    ).toBe("archived");
    await userAClient.rpc("set_recipe_archived", {
      p_is_archived: false,
      p_recipe_id: stateRecipeId,
    });
    expect(
      (
        await userAClient.rpc("log_recipe_to_diary", {
          ...logArgs(),
          p_expected_updated_at: archiveReviewedVersion,
          p_idempotency_key: randomUUID(),
          p_recipe_id: stateRecipeId,
          p_requested_servings: 1,
        })
      ).data?.[0].result_status,
    ).toBe("stale_review");

    await persistRecipe(userAClient, "Primary edited later", 3, [
      ingredient(1, { calories: 100, carbohydrates_g: null, fat_g: 0, protein_g: 0.01 }),
      ingredient(2, { calories: 201, carbohydrates_g: 5, fat_g: 0, protein_g: 0.02 }),
    ] as Json, primaryRecipeId);
    expect((await userAClient.rpc("log_recipe_to_diary", completedArgs)).data?.[0]).toEqual(
      completed.data?.[0],
    );
    await userAClient.rpc("set_recipe_archived", {
      p_is_archived: true,
      p_recipe_id: primaryRecipeId,
    });
    expect((await userAClient.rpc("log_recipe_to_diary", completedArgs)).data?.[0]).toEqual(
      completed.data?.[0],
    );
    await userAClient.rpc("set_recipe_archived", {
      p_is_archived: false,
      p_recipe_id: primaryRecipeId,
    });

    const cross = await userAClient.rpc("log_recipe_to_diary", {
      ...logArgs(),
      p_expected_updated_at: await version(userBClient, otherRecipeId),
      p_idempotency_key: randomUUID(),
      p_recipe_id: otherRecipeId,
    });
    const missing = await userAClient.rpc("log_recipe_to_diary", {
      ...logArgs(),
      p_idempotency_key: randomUUID(),
      p_recipe_id: randomUUID(),
    });
    expect(cross.data?.[0].result_status).toBe("unavailable");
    expect(missing.data?.[0].result_status).toBe("unavailable");

    const overflowKey = randomUUID();
    const overflow = await userAClient.rpc("log_recipe_to_diary", {
      ...logArgs(),
      p_expected_updated_at: overflowVersion,
      p_idempotency_key: overflowKey,
      p_recipe_id: overflowRecipeId,
      p_requested_servings: 1.001,
    });
    expect(overflow.data?.[0].result_status).toBe("not_loggable");
    expect(
      queryDatabase(`select count(*) from public.recipe_diary_runs where idempotency_key = '${overflowKey}';`),
    ).toBe("0");

    const invalidRecipeId = await persistRecipe(userAClient, "Invalid collection", 1, [
      ingredient(1, { calories: 1 }),
    ] as Json);
    queryDatabase(`
      set session_replication_role = replica;
      delete from public.recipe_ingredients where recipe_id = '${invalidRecipeId}';
      set session_replication_role = origin;
    `);
    const invalidKey = randomUUID();
    const invalid = await userAClient.rpc("log_recipe_to_diary", {
      ...logArgs(),
      p_expected_updated_at: await version(userAClient, invalidRecipeId),
      p_idempotency_key: invalidKey,
      p_recipe_id: invalidRecipeId,
      p_requested_servings: 1,
    });
    expect(invalid.data?.[0].result_status).toBe("invalid_recipe");
    expect(
      queryDatabase(`select count(*) from public.recipe_diary_runs where idempotency_key = '${invalidKey}';`),
    ).toBe("0");
  });

  test("keeps linked snapshots authoritative and makes diary edits and deletion historically independent", async () => {
    const linkedRecipeId = await persistRecipe(userAClient, "Linked frozen recipe", 2, [
      ingredient(1, { calories: 10, food_id: publicFoodId, protein_g: 1 }),
    ] as Json);
    const linkedVersion = await version(userAClient, linkedRecipeId);
    queryDatabase(`
      update public.foods set name = 'Changed linked current food', is_archived = true
      where id = '${publicFoodId}';
    `);
    const logged = await userAClient.rpc("log_recipe_to_diary", {
      ...logArgs(),
      p_expected_updated_at: linkedVersion,
      p_idempotency_key: randomUUID(),
      p_recipe_id: linkedRecipeId,
      p_requested_servings: 1,
    });
    expect(logged.data?.[0].result_status).toBe("success");
    const runId = logged.data?.[0].diary_run_id as string;
    const entry = await userAClient
      .from("diary_entries")
      .select("id,calories,food_id,food_name,entry_date,meal_type")
      .eq("recipe_diary_run_id", runId)
      .single();
    expect(entry.data).toMatchObject({
      calories: 5,
      food_id: null,
      food_name: "Linked frozen recipe",
    });

    const immutableProvenance = await userAClient
      .from("diary_entries")
      .update({ source: "manual" })
      .eq("id", entry.data?.id as string);
    const immutableDate = await userAClient
      .from("diary_entries")
      .update({ entry_date: "2026-07-30" })
      .eq("id", entry.data?.id as string);
    const immutableMeal = await userAClient
      .from("diary_entries")
      .update({ meal_type: "snack" })
      .eq("id", entry.data?.id as string);
    expect(immutableProvenance.error).not.toBeNull();
    expect(immutableDate.error).not.toBeNull();
    expect(immutableMeal.error).not.toBeNull();

    const editable = await userAClient
      .from("diary_entries")
      .update({ calories: 7, food_name: "Edited historical snapshot", serving_quantity: 2 })
      .eq("id", entry.data?.id as string)
      .select("calories,food_name,serving_quantity")
      .single();
    expect(editable.data).toEqual({
      calories: 7,
      food_name: "Edited historical snapshot",
      serving_quantity: 2,
    });
    expect(
      (
        await userAClient.from("recipes").select("name").eq("id", linkedRecipeId).single()
      ).data?.name,
    ).toBe("Linked frozen recipe");

    await userAClient.rpc("set_recipe_archived", {
      p_is_archived: true,
      p_recipe_id: linkedRecipeId,
    });
    await userAClient.rpc("set_recipe_archived", {
      p_is_archived: false,
      p_recipe_id: linkedRecipeId,
    });
    expect(
      (
        await userAClient
          .from("diary_entries")
          .select("calories,food_name")
          .eq("id", entry.data?.id as string)
          .single()
      ).data,
    ).toEqual({ calories: 7, food_name: "Edited historical snapshot" });

    await userAClient.from("diary_entries").delete().eq("id", entry.data?.id as string);
    expect(
      (
        await userAClient.from("recipe_diary_runs").select("id").eq("id", runId).single()
      ).data?.id,
    ).toBe(runId);
    expect(
      (
        await userAClient.from("recipes").select("id").eq("id", linkedRecipeId).single()
      ).data?.id,
    ).toBe(linkedRecipeId);
  });

  test("rolls receipt and diary insertion back together after a later failure", async () => {
    const failingRecipeId = await persistRecipe(userAClient, "Reject recipe diary fixture", 1, [
      ingredient(1, { calories: 10 }),
    ] as Json);
    const failingVersion = await version(userAClient, failingRecipeId);
    const failureKey = randomUUID();
    queryDatabase(`
      create function public.reject_recipe_diary_fixture()
      returns trigger language plpgsql set search_path = '' as $$
      begin
        if new.source = 'recipe' and new.food_name = 'Reject recipe diary fixture' then
          raise exception 'fixture rejection';
        end if;
        return new;
      end;
      $$;
      create trigger reject_recipe_diary_fixture
      before insert on public.diary_entries
      for each row execute function public.reject_recipe_diary_fixture();
    `);
    try {
      const failed = await userAClient.rpc("log_recipe_to_diary", {
        ...logArgs(),
        p_expected_updated_at: failingVersion,
        p_idempotency_key: failureKey,
        p_recipe_id: failingRecipeId,
        p_requested_servings: 1,
      });
      expect(failed.error).not.toBeNull();
      expect(
        queryDatabase(`
          select concat_ws('|',
            (select count(*) from public.recipe_diary_runs where idempotency_key = '${failureKey}'),
            (select count(*) from public.diary_entries where food_name = 'Reject recipe diary fixture')
          );
        `),
      ).toBe("0|0");
    } finally {
      queryDatabase(`
        drop trigger reject_recipe_diary_fixture on public.diary_entries;
        drop function public.reject_recipe_diary_fixture();
      `);
    }
  });
});
