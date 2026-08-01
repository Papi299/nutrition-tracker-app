import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  expect,
  test,
  type BrowserContext,
} from "@playwright/test";
import type { Database } from "@/lib/supabase/database.types";

const localSupabaseUrl = process.env.LOCAL_SUPABASE_URL;
const localSupabasePublishableKey = process.env.LOCAL_SUPABASE_PUBLISHABLE_KEY;
const localOnly = process.env.DATE_E2E_LOCAL_SUPABASE === "1";
const password = "DiaryMutationCorrectness123!";
const projectId = readFileSync("supabase/config.toml", "utf8").match(
  /^project_id\s*=\s*"([^"]+)"/m,
)?.[1];

if (!projectId) throw new Error("Could not read the local Supabase project id.");

const databaseContainer = `supabase_db_${projectId}`;

test.skip(
  !localOnly || !localSupabaseUrl || !localSupabasePublishableKey,
  "Diary mutation correctness tests require the local-only test runner.",
);

type CreateArgs =
  Database["public"]["Functions"]["create_manual_diary_entry"]["Args"];

test.describe.serial("Phase 11C2A diary mutation correctness", () => {
  let authenticatedState: Awaited<ReturnType<BrowserContext["storageState"]>>;
  let userAClient: SupabaseClient<Database>;
  let userBClient: SupabaseClient<Database>;
  let userAId: string;
  let userBId: string;
  const runId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const userAEmail = `diary-correctness-a-${runId}@example.test`;
  const userBEmail = `diary-correctness-b-${runId}@example.test`;
  const selectedDate = "2032-08-01";

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

  async function createUser(email: string) {
    const client = localClient();
    const result = await client.auth.signUp({ email, password });
    expect(result.error).toBeNull();
    expect(result.data.session).not.toBeNull();
    return { client, userId: result.data.user?.id as string };
  }

  function createArgs(
    idempotencyKey: string,
    overrides: Partial<CreateArgs> = {},
  ): CreateArgs {
    return {
      p_brand_name: null as unknown as string,
      p_calories: 0,
      p_carbohydrates_g: null as unknown as number,
      p_entry_date: selectedDate,
      p_fat_g: 0,
      p_food_id: null as unknown as string,
      p_food_name: `Manual snapshot ${idempotencyKey}`,
      p_idempotency_key: idempotencyKey,
      p_meal_type: "breakfast",
      p_notes: null as unknown as string,
      p_protein_g: 0,
      p_serving_quantity: 0,
      p_serving_unit: null as unknown as string,
      ...overrides,
    };
  }

  async function createManual(
    client: SupabaseClient<Database>,
    args: CreateArgs,
  ) {
    return client.rpc("create_manual_diary_entry", args).maybeSingle();
  }

  test.beforeAll(async ({ browser }) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.goto("/en/auth/sign-up");
    await page.getByLabel("Email").fill(userAEmail);
    await page.getByLabel("Password").fill(password);
    await page.getByRole("button", { name: "Create account" }).click();
    await expect(page).toHaveURL(/\/en\/today\?date=\d{4}-\d{2}-\d{2}$/);
    authenticatedState = await context.storageState();
    await context.close();

    const userAClientSession = localClient();
    const userASignIn = await userAClientSession.auth.signInWithPassword({
      email: userAEmail,
      password,
    });
    expect(userASignIn.error).toBeNull();
    const userB = await createUser(userBEmail);
    userAClient = userAClientSession;
    userBClient = userB.client;
    userAId = userASignIn.data.user?.id as string;
    userBId = userB.userId;
  });

  test("CJ-012 durably converges sequential, concurrent, uncertain, deleted, conflicting, and owner-scoped replays", async () => {
    const sequentialKey = randomUUID();
    const sequentialArgs = createArgs(sequentialKey, {
      p_food_name: "Sequential canonical snapshot",
    });
    const first = await createManual(userAClient, sequentialArgs);
    const replay = await createManual(userAClient, sequentialArgs);

    expect(first.error).toBeNull();
    expect(replay.error).toBeNull();
    expect(first.data?.result_status).toBe("success");
    expect(replay.data).toEqual(first.data);

    const sequentialRows = await userAClient
      .from("diary_entries")
      .select("id", { count: "exact" })
      .eq("id", first.data?.diary_entry_id as string);
    const sequentialReceipts = await userAClient
      .from("manual_diary_entry_requests")
      .select("id", { count: "exact" })
      .eq("idempotency_key", sequentialKey);
    expect(sequentialRows.error).toBeNull();
    expect(sequentialRows.count).toBe(1);
    expect(sequentialReceipts.error).toBeNull();
    expect(sequentialReceipts.count).toBe(1);

    const conflict = await createManual(userAClient, {
      ...sequentialArgs,
      p_food_name: "Different canonical snapshot",
    });
    expect(conflict.error).toBeNull();
    expect(conflict.data?.result_status).toBe("idempotency_conflict");

    const precisionKey = randomUUID();
    const precisionFirst = await createManual(
      userAClient,
      createArgs(precisionKey, {
        p_fat_g: 4.125,
        p_food_name: "Canonical precision snapshot",
        p_serving_quantity: 1.2345,
      }),
    );
    const precisionReplay = await createManual(
      userAClient,
      createArgs(precisionKey, {
        p_fat_g: 4.13,
        p_food_name: "Canonical precision snapshot",
        p_serving_quantity: 1.235,
      }),
    );
    expect(precisionFirst.error).toBeNull();
    expect(precisionReplay.error).toBeNull();
    expect(precisionReplay.data).toEqual(precisionFirst.data);

    const precisionRow = await userAClient
      .from("diary_entries")
      .select("fat_g,serving_quantity")
      .eq("id", precisionFirst.data?.diary_entry_id as string)
      .single();
    expect(precisionRow.error).toBeNull();
    expect(precisionRow.data).toEqual({
      fat_g: 4.13,
      serving_quantity: 1.235,
    });

    const concurrentKey = randomUUID();
    const concurrentArgs = createArgs(concurrentKey, {
      p_food_name: "Concurrent canonical snapshot",
    });
    const concurrent = await Promise.all([
      createManual(userAClient, concurrentArgs),
      createManual(userAClient, concurrentArgs),
    ]);
    expect(concurrent.every((result) => result.error === null)).toBe(true);
    expect(concurrent.map((result) => result.data?.result_status)).toEqual([
      "success",
      "success",
    ]);
    expect(concurrent[0].data?.diary_entry_id).toBe(
      concurrent[1].data?.diary_entry_id,
    );

    const concurrentRows = await userAClient
      .from("diary_entries")
      .select("id", { count: "exact" })
      .eq("id", concurrent[0].data?.diary_entry_id as string);
    expect(concurrentRows.count).toBe(1);

    const uncertainKey = randomUUID();
    const uncertainArgs = createArgs(uncertainKey, {
      p_food_name: "Committed response intentionally ignored",
    });
    await createManual(userAClient, uncertainArgs);
    const recovered = await createManual(userAClient, uncertainArgs);
    expect(recovered.error).toBeNull();
    expect(recovered.data?.result_status).toBe("success");

    const completedId = recovered.data?.diary_entry_id as string;
    const deletion = await userAClient
      .from("diary_entries")
      .delete()
      .eq("id", completedId);
    expect(deletion.error).toBeNull();

    const deletedReplay = await createManual(userAClient, uncertainArgs);
    expect(deletedReplay.error).toBeNull();
    expect(deletedReplay.data).toEqual(recovered.data);
    const deletedRows = await userAClient
      .from("diary_entries")
      .select("id", { count: "exact" })
      .eq("id", completedId);
    const retainedReceipt = await userAClient
      .from("manual_diary_entry_requests")
      .select("completed_diary_entry_id,live_diary_entry_id")
      .eq("idempotency_key", uncertainKey)
      .single();
    expect(deletedRows.count).toBe(0);
    expect(retainedReceipt.data).toEqual({
      completed_diary_entry_id: completedId,
      live_diary_entry_id: null,
    });

    const userBReplay = await createManual(
      userBClient,
      createArgs(sequentialKey, {
        p_food_name: "Independent user namespace",
      }),
    );
    expect(userBReplay.error).toBeNull();
    expect(userBReplay.data?.result_status).toBe("success");
    expect(userBReplay.data?.diary_entry_id).not.toBe(
      first.data?.diary_entry_id,
    );
  });

  test("CJ-012 rolls back both the diary row and receipt when completion fails", async () => {
    const failureKey = randomUUID();
    const failureName = `Rollback probe ${failureKey}`;

    queryDatabase(`
      create or replace function public.phase_11c2a_fail_receipt_insert()
      returns trigger language plpgsql security invoker set search_path = '' as $$
      begin
        if new.idempotency_key = '${failureKey}'::uuid then
          raise integrity_constraint_violation using message = 'Phase 11C2A rollback probe.';
        end if;
        return new;
      end;
      $$;
      drop trigger if exists phase_11c2a_fail_receipt_insert
        on public.manual_diary_entry_requests;
      create trigger phase_11c2a_fail_receipt_insert
      before insert on public.manual_diary_entry_requests
      for each row execute function public.phase_11c2a_fail_receipt_insert();
    `);

    try {
      const failed = await createManual(
        userAClient,
        createArgs(failureKey, { p_food_name: failureName }),
      );
      expect(failed.error).not.toBeNull();

      const rows = await userAClient
        .from("diary_entries")
        .select("id", { count: "exact" })
        .eq("food_name", failureName);
      const receipts = await userAClient
        .from("manual_diary_entry_requests")
        .select("id", { count: "exact" })
        .eq("idempotency_key", failureKey);
      expect(rows.count).toBe(0);
      expect(receipts.count).toBe(0);
    } finally {
      queryDatabase(`
        drop trigger if exists phase_11c2a_fail_receipt_insert
          on public.manual_diary_entry_requests;
        drop function if exists public.phase_11c2a_fail_receipt_insert();
      `);
    }
  });

  test("CJ-014 carries the authoritative version and preserves stale submitted values", async ({
    browser,
  }) => {
    const create = await createManual(
      userAClient,
      createArgs(randomUUID(), {
        p_calories: 100,
        p_food_name: "Optimistic edit baseline",
      }),
    );
    expect(create.error).toBeNull();
    const entryId = create.data?.diary_entry_id as string;

    const context = await browser.newContext({ storageState: authenticatedState });
    const firstPage = await context.newPage();
    await firstPage.goto(`/en/today?date=${selectedDate}`);
    const firstEntry = firstPage.locator(`[data-diary-entry-id="${entryId}"]`);
    await firstEntry.getByRole("button", { name: "Edit" }).click();
    await expect(firstEntry.locator('input[name="expected_version"]')).toHaveValue(
      "1",
    );

    const stalePage = await context.newPage();
    await stalePage.goto(`/en/today?date=${selectedDate}`);
    const staleEntry = stalePage.locator(`[data-diary-entry-id="${entryId}"]`);
    await staleEntry.getByRole("button", { name: "Edit" }).click();
    await expect(staleEntry.locator('input[name="expected_version"]')).toHaveValue(
      "1",
    );

    await firstPage.bringToFront();
    await firstEntry.locator('input[name="food_name"]').fill("Winning edit");
    await firstEntry.getByRole("button", { name: "Save changes" }).click();
    await expect(firstPage.getByText("Winning edit", { exact: true })).toBeVisible();

    await stalePage.bringToFront();
    await staleEntry
      .locator('input[name="food_name"]')
      .fill("Stale submitted intent");
    await staleEntry.locator('input[name="calories"]').fill("321");
    await staleEntry.getByRole("button", { name: "Save changes" }).click();
    await expect(staleEntry).toContainText(
      "This entry changed after you opened it, so your edit was not saved.",
    );
    await expect(staleEntry.locator('input[name="food_name"]')).toHaveValue(
      "Stale submitted intent",
    );
    await expect(staleEntry.locator('input[name="calories"]')).toHaveValue(
      "321",
    );

    const stored = await userAClient
      .from("diary_entries")
      .select("calories,food_name,version")
      .eq("id", entryId)
      .single();
    expect(stored.error).toBeNull();
    expect(stored.data).toEqual({
      calories: 100,
      food_name: "Winning edit",
      version: 2,
    });
    await context.close();
  });

  test("CJ-014 permits at most one same-version update and hides other-owner existence", async () => {
    const concurrentCreate = await createManual(
      userAClient,
      createArgs(randomUUID(), { p_food_name: "Concurrent edit baseline" }),
    );
    const concurrentId = concurrentCreate.data?.diary_entry_id as string;
    const concurrentUpdates = await Promise.all([
      userAClient
        .from("diary_entries")
        .update({ food_name: "Concurrent edit one" })
        .eq("id", concurrentId)
        .eq("user_id", userAId)
        .eq("version", 1)
        .select("id,version")
        .maybeSingle(),
      userAClient
        .from("diary_entries")
        .update({ food_name: "Concurrent edit two" })
        .eq("id", concurrentId)
        .eq("user_id", userAId)
        .eq("version", 1)
        .select("id,version")
        .maybeSingle(),
    ]);
    expect(concurrentUpdates.filter((result) => result.data !== null)).toHaveLength(
      1,
    );
    expect(concurrentUpdates.every((result) => result.error === null)).toBe(true);

    const otherOwner = await createManual(
      userBClient,
      createArgs(randomUUID(), { p_food_name: "Private user B edit row" }),
    );
    const otherOwnerId = otherOwner.data?.diary_entry_id as string;
    const missingId = randomUUID();
    const [otherOwnerAttempt, missingAttempt] = await Promise.all([
      userAClient
        .from("diary_entries")
        .update({ food_name: "Forbidden" })
        .eq("id", otherOwnerId)
        .eq("user_id", userAId)
        .eq("version", 1)
        .select("id")
        .maybeSingle(),
      userAClient
        .from("diary_entries")
        .update({ food_name: "Missing" })
        .eq("id", missingId)
        .eq("user_id", userAId)
        .eq("version", 1)
        .select("id")
        .maybeSingle(),
    ]);
    expect(otherOwnerAttempt).toEqual(missingAttempt);

    const otherOwnerStored = await userBClient
      .from("diary_entries")
      .select("food_name,user_id,version")
      .eq("id", otherOwnerId)
      .single();
    expect(otherOwnerStored.data).toEqual({
      food_name: "Private user B edit row",
      user_id: userBId,
      version: 1,
    });
  });
});
