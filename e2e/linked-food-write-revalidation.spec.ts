import { provisionActivatedLocalUser } from "@/e2e/helpers/local-auth";
import { execFileSync, spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { expect, test } from "@playwright/test";
import type { Database, Json } from "@/lib/supabase/database.types";

const localSupabaseUrl = process.env.LOCAL_SUPABASE_URL;
const localSupabasePublishableKey = process.env.LOCAL_SUPABASE_PUBLISHABLE_KEY;
const localOnly = process.env.DATE_E2E_LOCAL_SUPABASE === "1";
const password = "LinkedFoodRevalidation123!";
const projectId = readFileSync("supabase/config.toml", "utf8").match(
  /^project_id\s*=\s*"([^"]+)"/m,
)?.[1];

if (!projectId) {
  throw new Error("Could not read the local Supabase project id.");
}

const databaseContainer = `supabase_db_${projectId}`;

test.skip(
  !localOnly || !localSupabaseUrl || !localSupabasePublishableKey,
  "Linked-food write revalidation tests require the local-only test runner.",
);

type CreateArgs =
  Database["public"]["Functions"]["create_manual_diary_entry"]["Args"];

test.describe.serial("linked-food diary write revalidation", () => {
  let userAClient: SupabaseClient<Database>;
  let userBClient: SupabaseClient<Database>;
  let userAId: string;
  let userBId: string;
  const runId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const publicFoodIds = new Set<string>();

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

  function psqlSession() {
    return spawn(
      "docker",
      [
        "exec",
        "-i",
        databaseContainer,
        "psql",
        "-U",
        "postgres",
        "-d",
        "postgres",
        "-v",
        "ON_ERROR_STOP=1",
        "-At",
      ],
      { stdio: "pipe" },
    );
  }

  function waitForOutput(
    child: ChildProcessWithoutNullStreams,
    marker: string,
  ): Promise<string> {
    return new Promise((resolve, reject) => {
      let output = "";
      let errorOutput = "";
      const timeout = setTimeout(() => {
        reject(new Error(`Timed out waiting for ${marker}. Output: ${output}\n${errorOutput}`));
      }, 10_000);

      child.stdout.on("data", (chunk: Buffer) => {
        output += chunk.toString();
        if (output.includes(marker)) {
          clearTimeout(timeout);
          resolve(output);
        }
      });
      child.stderr.on("data", (chunk: Buffer) => {
        errorOutput += chunk.toString();
      });
      child.once("error", (error) => {
        clearTimeout(timeout);
        reject(error);
      });
      child.once("exit", (code) => {
        if (!output.includes(marker)) {
          clearTimeout(timeout);
          reject(
            new Error(
              `psql exited with ${code} before ${marker}. Output: ${output}\n${errorOutput}`,
            ),
          );
        }
      });
    });
  }

  async function waitForLockWait(queryFragment: string) {
    const escapedFragment = queryFragment.replaceAll("'", "''");

    for (let attempt = 0; attempt < 100; attempt += 1) {
      const waiting = queryDatabase(`
        select count(*)
        from pg_stat_activity
        where pid <> pg_backend_pid()
          and wait_event_type = 'Lock'
          and query like '%${escapedFragment}%';
      `);
      if (waiting !== "0") return;
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    throw new Error(`No deterministic lock wait observed for ${queryFragment}.`);
  }

  async function createUser(prefix: string) {
    const client = localClient();
    const result = await provisionActivatedLocalUser(client, {
      email: `${prefix}-${runId}@example.test`,
      password,
    });
    expect(result.error).toBeNull();
    expect(result.data.session).not.toBeNull();
    return { client, userId: result.data.user?.id as string };
  }

  async function createOwnedFood(
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

  function createPublicFood(name: string, isArchived = false) {
    const id = randomUUID();
    publicFoodIds.add(id);
    queryDatabase(`
      insert into public.foods (
        id, food_type, name, locale, data_quality, is_public, is_archived, source_id
      ) values (
        '${id}', 'generic', '${name}', 'en', 'curated', true, ${isArchived},
        (select id from public.food_sources where code = 'manual')
      );
    `);
    return id;
  }

  function createArgs(
    key: string,
    foodId: string | null,
    foodName: string,
  ): CreateArgs {
    return {
      p_brand_name: "Linked snapshot brand",
      p_calories: 123,
      p_carbohydrates_g: 3.5,
      p_entry_date: "2033-04-12",
      p_fat_g: 0,
      p_food_id: foodId as unknown as string,
      p_food_name: foodName,
      p_idempotency_key: key,
      p_meal_type: "lunch",
      p_notes: "Linked-food revalidation probe",
      p_protein_g: 8.25,
      p_serving_quantity: 1,
      p_serving_unit: "portion",
    };
  }

  async function createManual(
    client: SupabaseClient<Database>,
    args: CreateArgs,
  ) {
    return client.rpc("create_manual_diary_entry", args).single();
  }

  async function setOwnedArchived(foodId: string, isArchived: boolean) {
    const result = await userAClient.rpc("set_custom_food_archived", {
      p_food_id: foodId,
      p_is_archived: isArchived,
    });
    expect(result.error).toBeNull();
  }

  test.beforeAll(async () => {
    const userA = await createUser("linked-food-revalidation-a");
    const userB = await createUser("linked-food-revalidation-b");
    userAClient = userA.client;
    userBClient = userB.client;
    userAId = userA.userId;
    userBId = userB.userId;
  });

  test.afterAll(() => {
    queryDatabase(`
      delete from auth.users where id in ('${userAId}', '${userBId}');
      delete from public.foods
      where id in (${[...publicFoodIds].map((id) => `'${id}'`).join(",") || "null"});
    `);
  });

  test("preserves completed receipts and permits one controlled retry after unavailable", async () => {
    const completedFoodId = await createOwnedFood(
      userAClient,
      "Completed linked source",
    );
    const completedKey = randomUUID();
    const completedArgs = createArgs(
      completedKey,
      completedFoodId,
      "Completed linked snapshot",
    );
    const completed = await createManual(userAClient, completedArgs);
    expect(completed.error).toBeNull();
    expect(completed.data?.result_status).toBe("success");

    await setOwnedArchived(completedFoodId, true);
    const archivedReplay = await createManual(userAClient, completedArgs);
    expect(archivedReplay.data).toEqual(completed.data);
    expect(
      queryDatabase(`
        select concat_ws('|',
          (select count(*) from public.diary_entries where id = '${completed.data?.diary_entry_id}'),
          (select count(*) from public.manual_diary_entry_requests where idempotency_key = '${completedKey}')
        );
      `),
    ).toBe("1|1");

    const conflict = await createManual(userAClient, {
      ...completedArgs,
      p_food_name: "Conflicting completed payload",
    });
    expect(conflict.data?.result_status).toBe("idempotency_conflict");

    expect(
      (
        await userAClient
          .from("diary_entries")
          .delete()
          .eq("id", completed.data?.diary_entry_id as string)
      ).error,
    ).toBeNull();
    expect(
      (await userAClient.from("foods").delete().eq("id", completedFoodId)).error,
    ).toBeNull();
    const deletedReplay = await createManual(userAClient, completedArgs);
    expect(deletedReplay.data).toEqual(completed.data);
    expect(
      queryDatabase(`select count(*) from public.diary_entries where id = '${completed.data?.diary_entry_id}';`),
    ).toBe("0");

    const retryFoodId = await createOwnedFood(userAClient, "Retry linked source");
    await setOwnedArchived(retryFoodId, true);
    const retryKey = randomUUID();
    const retryArgs = createArgs(retryKey, retryFoodId, "Retry linked snapshot");
    const unavailable = await createManual(userAClient, retryArgs);
    expect(unavailable.data?.result_status).toBe("unavailable");
    expect(
      queryDatabase(`
        select concat_ws('|',
          (select count(*) from public.diary_entries where food_name = 'Retry linked snapshot'),
          (select count(*) from public.manual_diary_entry_requests where idempotency_key = '${retryKey}')
        );
      `),
    ).toBe("0|0");

    await setOwnedArchived(retryFoodId, false);
    const restoredRetry = await createManual(userAClient, retryArgs);
    expect(restoredRetry.data?.result_status).toBe("success");
    expect(
      queryDatabase(`
        select concat_ws('|',
          (select count(*) from public.diary_entries where food_name = 'Retry linked snapshot'),
          (select count(*) from public.manual_diary_entry_requests where idempotency_key = '${retryKey}')
        );
      `),
    ).toBe("1|1");
  });

  test("accepts active readable links and rejects archived, missing, and tenant-inaccessible links", async () => {
    const ownedFoodId = await createOwnedFood(userAClient, "Active owned source");
    const publicFoodId = createPublicFood("Active public source");
    const archivedPublicFoodId = createPublicFood("Archived public source", true);
    const otherFoodId = await createOwnedFood(userBClient, "Other private source");
    const unownedPrivateFoodId = randomUUID();
    publicFoodIds.add(unownedPrivateFoodId);
    queryDatabase(`
      insert into public.foods (
        id, food_type, name, locale, data_quality, is_public, is_archived, source_id
      ) values (
        '${unownedPrivateFoodId}', 'generic', 'Unowned private source', 'en',
        'curated', false, false,
        (select id from public.food_sources where code = 'manual')
      );
    `);

    for (const [foodId, name] of [
      [ownedFoodId, "Active owned snapshot"],
      [publicFoodId, "Active public snapshot"],
    ] as const) {
      const result = await createManual(
        userAClient,
        createArgs(randomUUID(), foodId, name),
      );
      expect(result.error).toBeNull();
      expect(result.data?.result_status, `${name} should be readable`).toBe(
        "success",
      );
      const stored = await userAClient
        .from("diary_entries")
        .select("brand_name,calories,fat_g,food_id,food_name,protein_g")
        .eq("id", result.data?.diary_entry_id as string)
        .single();
      expect(stored.data).toEqual({
        brand_name: "Linked snapshot brand",
        calories: 123,
        fat_g: 0,
        food_id: foodId,
        food_name: name,
        protein_g: 8.25,
      });
    }

    for (const foodId of [
      archivedPublicFoodId,
      randomUUID(),
      otherFoodId,
      unownedPrivateFoodId,
    ]) {
      const key = randomUUID();
      const result = await createManual(
        userAClient,
        createArgs(key, foodId, "Unavailable linked snapshot"),
      );
      expect(result.error).toBeNull();
      expect(result.data?.result_status).toBe("unavailable");
      expect(
        queryDatabase(`select count(*) from public.manual_diary_entry_requests where idempotency_key = '${key}';`),
      ).toBe("0");
    }

    const manual = await createManual(
      userAClient,
      createArgs(randomUUID(), null, "Unlinked manual snapshot"),
    );
    expect(manual.data?.result_status).toBe("success");
    expect(
      (
        await userAClient
          .from("diary_entries")
          .select("food_id")
          .eq("id", manual.data?.diary_entry_id as string)
          .single()
      ).data,
    ).toEqual({ food_id: null });
  });

  test("enforces the active-readable insert policy without constraining historical updates", async () => {
    const activeOwnedFoodId = await createOwnedFood(userAClient, "RLS active owned");
    const archivedOwnedFoodId = await createOwnedFood(userAClient, "RLS archived owned");
    await setOwnedArchived(archivedOwnedFoodId, true);
    const activePublicFoodId = createPublicFood("RLS active public");
    const otherFoodId = await createOwnedFood(userBClient, "RLS other private");

    const row = (overrides: Record<string, unknown>) => ({
      entry_date: "2033-04-13",
      food_id: null,
      food_name: `RLS probe ${randomUUID()}`,
      meal_type: "dinner",
      source: "manual" as const,
      user_id: userAId,
      ...overrides,
    });

    for (const foodId of [activeOwnedFoodId, activePublicFoodId]) {
      const result = await userAClient.from("diary_entries").insert(row({ food_id: foodId }));
      expect(result.error).toBeNull();
    }
    expect((await userAClient.from("diary_entries").insert(row({}))).error).toBeNull();

    for (const foodId of [archivedOwnedFoodId, otherFoodId]) {
      const result = await userAClient.from("diary_entries").insert(row({ food_id: foodId }));
      expect(result.error?.code).toBe("42501");
    }
    const otherOwner = await userAClient
      .from("diary_entries")
      .insert(row({ food_id: null, user_id: userBId }));
    expect(otherOwner.error?.code).toBe("42501");

    const historical = await userAClient
      .from("diary_entries")
      .insert(
        row({
          calories: 44,
          food_id: activeOwnedFoodId,
          food_name: "Historical active snapshot",
          protein_g: 5,
        }),
      )
      .select("id")
      .single();
    expect(historical.error).toBeNull();
    await setOwnedArchived(activeOwnedFoodId, true);
    const edited = await userAClient
      .from("diary_entries")
      .update({ calories: 55, food_name: "Historical edited snapshot" })
      .eq("id", historical.data?.id as string)
      .select("calories,food_id,food_name,protein_g")
      .single();
    expect(edited.data).toEqual({
      calories: 55,
      food_id: activeOwnedFoodId,
      food_name: "Historical edited snapshot",
      protein_g: 5,
    });
    expect(
      (
        await userAClient
          .from("diary_entries")
          .delete()
          .eq("id", historical.data?.id as string)
      ).error,
    ).toBeNull();
  });

  test("serializes creation-first and archive-first outcomes with an explicit food-row lock", async () => {
    const creationFirstFoodId = await createOwnedFood(
      userAClient,
      "Creation-first lock source",
    );
    const creationFirstKey = randomUUID();
    const creationSession = psqlSession();
    const creationReady = waitForOutput(creationSession, "CREATION_LOCK_HELD");
    creationSession.stdin.write(`
      begin;
      set local role authenticated;
      set local request.jwt.claim.sub = '${userAId}';
      select concat_ws('|', result_status, diary_entry_id)
      from public.create_manual_diary_entry(
        '${creationFirstKey}', '2033-04-14', 'lunch', '${creationFirstFoodId}',
        'Creation-first linked snapshot', null, 1, 'portion', 10, 1, 2, 3, null
      );
      \\echo CREATION_LOCK_HELD
    `);
    expect(await creationReady).toContain("success|");

    const archiveSession = psqlSession();
    const archiveDone = waitForOutput(archiveSession, "ARCHIVE_COMMITTED");
    archiveSession.stdin.write(`
      begin;
      set local role authenticated;
      set local request.jwt.claim.sub = '${userAId}';
      update public.foods
      set is_archived = true
      where id = '${creationFirstFoodId}';
      commit;
      \\echo ARCHIVE_COMMITTED
      \\q
    `);

    await waitForLockWait(`where id = '${creationFirstFoodId}'`);
    creationSession.stdin.write("commit;\n\\q\n");
    expect(await archiveDone).toContain("ARCHIVE_COMMITTED");
    expect(
      queryDatabase(`
        select concat_ws('|',
          (select is_archived from public.foods where id = '${creationFirstFoodId}'),
          (select count(*) from public.diary_entries where food_name = 'Creation-first linked snapshot'),
          (select count(*) from public.manual_diary_entry_requests where idempotency_key = '${creationFirstKey}')
        );
      `),
    ).toBe("t|1|1");

    const archiveFirstFoodId = await createOwnedFood(userAClient, "Archive-first source");
    await setOwnedArchived(archiveFirstFoodId, true);
    const archiveFirstKey = randomUUID();
    const archiveFirst = await createManual(
      userAClient,
      createArgs(archiveFirstKey, archiveFirstFoodId, "Archive-first linked snapshot"),
    );
    expect(archiveFirst.data?.result_status).toBe("unavailable");
    expect(
      queryDatabase(`
        select concat_ws('|',
          (select count(*) from public.diary_entries where food_name = 'Archive-first linked snapshot'),
          (select count(*) from public.manual_diary_entry_requests where idempotency_key = '${archiveFirstKey}')
        );
      `),
    ).toBe("0|0");
  });

  test("retains the function, ACL, receipt, and policy security boundaries", () => {
    const state = queryDatabase(`
      select concat_ws('|',
        p.provolatile,
        p.prosecdef,
        array_to_string(p.proconfig, ','),
        has_function_privilege('public', p.oid, 'execute'),
        has_function_privilege('anon', p.oid, 'execute'),
        has_function_privilege('authenticated', p.oid, 'execute'),
        pg_get_function_identity_arguments(p.oid),
        pg_get_function_result(p.oid)
      )
      from pg_proc p
      where p.oid = 'public.create_manual_diary_entry(uuid,date,text,uuid,text,text,numeric,text,integer,numeric,numeric,numeric,text)'::regprocedure;

      select concat_ws('|',
        p.provolatile,
        p.prosecdef,
        array_to_string(p.proconfig, ','),
        has_function_privilege('public', p.oid, 'execute'),
        has_function_privilege('anon', p.oid, 'execute'),
        has_function_privilege('authenticated', p.oid, 'execute'),
        position('FOR SHARE' in upper(pg_get_functiondef(p.oid))) > 0
      )
      from pg_proc p
      where p.oid = 'private.lock_readable_food_for_diary_create(uuid)'::regprocedure;

      select concat_ws(
        '|',
        policyname,
        cmd,
        roles::text,
        replace(coalesce(qual, ''), chr(10), ' '),
        replace(coalesce(with_check, ''), chr(10), ' ')
      )
      from pg_policies
      where schemaname = 'public'
        and tablename = 'diary_entries'
        and policyname in (
          'Users can insert their own diary entries',
          'Users can update their own diary entries'
        )
      order by cmd;

      select concat_ws('|',
        has_table_privilege('authenticated', 'public.manual_diary_entry_requests', 'SELECT'),
        has_table_privilege('authenticated', 'public.manual_diary_entry_requests', 'INSERT'),
        has_table_privilege('anon', 'public.manual_diary_entry_requests', 'SELECT'),
        has_function_privilege(
          'authenticated',
          'private.insert_completed_manual_diary_entry_request(uuid,jsonb,uuid)',
          'execute'
        )
      );
    `);

    const [functionState, lockHelper, insertPolicy, updatePolicy, receiptState] =
      state.split("\n");
    expect(functionState).toContain('v|f|search_path=""|f|f|t');
    expect(functionState).toContain(
      "p_idempotency_key uuid, p_entry_date date, p_meal_type text, p_food_id uuid",
    );
    expect(functionState).toContain(
      "TABLE(result_status text, diary_entry_id uuid, completed_at timestamp with time zone)",
    );
    expect(lockHelper).toBe('v|t|search_path=""|f|f|t|t');
    expect(insertPolicy).toContain("is_archived");
    expect(insertPolicy).toContain("lock_readable_food_for_diary_create");
    expect(insertPolicy).toContain("saved_meal_diary_runs");
    expect(insertPolicy).toContain("recipe_diary_runs");
    expect(updatePolicy).not.toContain("is_archived");
    expect(receiptState).toBe("t|f|f|t");
  });
});
