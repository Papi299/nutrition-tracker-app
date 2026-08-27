import {
  provisionActivatedLocalUser,
  provisionActivatedLocalUserForUi,
} from "@/e2e/helpers/local-auth";
import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  expect,
  test,
  type BrowserContext,
  type Locator,
  type Page,
} from "@playwright/test";
import type { Database } from "@/lib/supabase/database.types";

const localSupabaseUrl = process.env.LOCAL_SUPABASE_URL;
const localSupabasePublishableKey = process.env.LOCAL_SUPABASE_PUBLISHABLE_KEY;
const localOnly = process.env.DATE_E2E_LOCAL_SUPABASE === "1";
const password = "DiaryMutationCorrectness123!";
const supabaseConfig = readFileSync("supabase/config.toml", "utf8");
const projectId = supabaseConfig.match(
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

type ManualDraftValues = Partial<
  Record<
    | "brand_name"
    | "calories"
    | "carbohydrates_g"
    | "entry_date"
    | "fat_g"
    | "food_name"
    | "meal_type"
    | "notes"
    | "protein_g"
    | "serving_quantity"
    | "serving_unit",
    string
  >
>;

function manualForm(page: Page) {
  return page.getByTestId("manual-diary-entry-form");
}

function manualDraftKey(form: Locator) {
  return form.getByTestId("manual-diary-idempotency-key");
}

async function fillManualDraft(form: Locator, values: ManualDraftValues) {
  for (const [field, value] of Object.entries(values)) {
    const control = form.locator(`[name="${field}"]`);

    if (field === "meal_type") {
      await control.selectOption(value);
    } else {
      await control.fill(value);
    }
  }
}

async function expectManualDraftValues(
  form: Locator,
  values: ManualDraftValues,
) {
  for (const [field, value] of Object.entries(values)) {
    await expect(form.locator(`[name="${field}"]`)).toHaveValue(value);
  }
}

async function replacePersistedDraft(
  page: Page,
  form: Locator,
  idempotencyKey: string,
  values: ManualDraftValues,
) {
  const storageKey = await form.getAttribute("data-draft-storage-key");
  expect(storageKey).not.toBeNull();

  await page.evaluate(
    ({ key, draftKey, draftValues }) => {
      window.sessionStorage.setItem(
        key,
        JSON.stringify({
          idempotencyKey: draftKey,
          values: draftValues,
          version: 1,
        }),
      );
    },
    {
      draftKey: idempotencyKey,
      draftValues: values,
      key: storageKey as string,
    },
  );
}

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
    const result = await provisionActivatedLocalUser(client, { email, password });
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
    await provisionActivatedLocalUserForUi({ email: userAEmail, password });
    await page.goto("/en/auth/sign-in");
    await page.getByLabel("Email").fill(userAEmail);
    await page.getByLabel("Password").fill(password);
    await page.getByRole("button", { name: "Sign in" }).click();
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

  test("CJ-012 retains one logical draft key through UI validation and completes once", async ({
    browser,
  }) => {
    const context = await browser.newContext({ storageState: authenticatedState });
    const page = await context.newPage();
    await page.goto(`/en/today?date=${selectedDate}`);
    const form = manualForm(page);
    const originalKey = await manualDraftKey(form).inputValue();
    const rowsBefore = await userAClient
      .from("diary_entries")
      .select("id", { count: "exact", head: true });

    await fillManualDraft(form, {
      brand_name: "Retained validation brand",
      notes: "Retained validation notes",
    });
    await form.getByRole("button", { name: "Add entry" }).click();

    await expect(form).toContainText("Check the highlighted fields and try again.");
    await expect(manualDraftKey(form)).toHaveValue(originalKey);
    await expectManualDraftValues(form, {
      brand_name: "Retained validation brand",
      notes: "Retained validation notes",
    });

    const failedReceipt = await userAClient
      .from("manual_diary_entry_requests")
      .select("id", { count: "exact", head: true })
      .eq("idempotency_key", originalKey);
    const rowsAfterFailure = await userAClient
      .from("diary_entries")
      .select("id", { count: "exact", head: true });
    expect(failedReceipt.error).toBeNull();
    expect(failedReceipt.count).toBe(0);
    expect(rowsAfterFailure.count).toBe(rowsBefore.count);

    await form.locator('input[name="food_name"]').fill("UI validation recovery");
    await form.getByRole("button", { name: "Add entry" }).click();
    await expect(form).toContainText("Entry added.");
    await expect(manualDraftKey(form)).not.toHaveValue(originalKey);

    const completedReceipt = await userAClient
      .from("manual_diary_entry_requests")
      .select("completed_diary_entry_id,idempotency_key")
      .eq("idempotency_key", originalKey)
      .single();
    expect(completedReceipt.error).toBeNull();
    const completedRows = await userAClient
      .from("diary_entries")
      .select("food_name,id", { count: "exact" })
      .eq("id", completedReceipt.data?.completed_diary_entry_id as string);
    expect(completedRows.error).toBeNull();
    expect(completedRows.count).toBe(1);
    expect(completedRows.data?.[0]?.food_name).toBe("UI validation recovery");
    await context.close();
  });

  test("CJ-012 rotates the UI draft key only after confirmed success", async ({
    browser,
  }) => {
    const context = await browser.newContext({ storageState: authenticatedState });
    const page = await context.newPage();
    await page.goto(`/en/today?date=${selectedDate}`);
    const form = manualForm(page);
    const firstKey = await manualDraftKey(form).inputValue();

    await fillManualDraft(form, { food_name: "Confirmed first intent" });
    await form.getByRole("button", { name: "Add entry" }).click();
    await expect(form).toContainText("Entry added.");
    await expect(manualDraftKey(form)).not.toHaveValue(firstKey);
    const secondKey = await manualDraftKey(form).inputValue();

    await fillManualDraft(form, { food_name: "Confirmed second intent" });
    await form.getByRole("button", { name: "Add entry" }).click();
    await expect(form).toContainText("Entry added.");
    await expect(manualDraftKey(form)).not.toHaveValue(secondKey);

    const receipts = await userAClient
      .from("manual_diary_entry_requests")
      .select("completed_diary_entry_id,idempotency_key")
      .in("idempotency_key", [firstKey, secondKey]);
    const intendedRows = await userAClient
      .from("diary_entries")
      .select("food_name", { count: "exact" })
      .in("food_name", ["Confirmed first intent", "Confirmed second intent"]);
    expect(firstKey).not.toBe(secondKey);
    expect(receipts.error).toBeNull();
    expect(receipts.data).toHaveLength(2);
    expect(intendedRows.error).toBeNull();
    expect(intendedRows.count).toBe(2);
    await context.close();
  });

  test("CJ-012 retains the UI draft through a database rollback and exact retry", async ({
    browser,
  }) => {
    const context = await browser.newContext({ storageState: authenticatedState });
    const page = await context.newPage();
    await page.goto(`/en/today?date=${selectedDate}`);
    const form = manualForm(page);
    const originalKey = await manualDraftKey(form).inputValue();
    const foodName = `UI rollback recovery ${originalKey}`;

    queryDatabase(`
      create or replace function public.phase_11c2a_fail_ui_receipt_insert()
      returns trigger language plpgsql security invoker set search_path = '' as $$
      begin
        if new.idempotency_key = '${originalKey}'::uuid then
          raise integrity_constraint_violation using message = 'Phase 11C2A UI rollback probe.';
        end if;
        return new;
      end;
      $$;
      drop trigger if exists phase_11c2a_fail_ui_receipt_insert
        on public.manual_diary_entry_requests;
      create trigger phase_11c2a_fail_ui_receipt_insert
      before insert on public.manual_diary_entry_requests
      for each row execute function public.phase_11c2a_fail_ui_receipt_insert();
    `);

    try {
      await fillManualDraft(form, {
        food_name: foodName,
        notes: "Retain after database failure",
      });
      await form.getByRole("button", { name: "Add entry" }).click();
      await expect(form).toContainText(
        "We could not save or load diary entries right now.",
      );
      await expect(manualDraftKey(form)).toHaveValue(originalKey);
      await expectManualDraftValues(form, {
        food_name: foodName,
        notes: "Retain after database failure",
      });

      const failedRows = await userAClient
        .from("diary_entries")
        .select("id", { count: "exact", head: true })
        .eq("food_name", foodName);
      const failedReceipts = await userAClient
        .from("manual_diary_entry_requests")
        .select("id", { count: "exact", head: true })
        .eq("idempotency_key", originalKey);
      expect(failedRows.count).toBe(0);
      expect(failedReceipts.count).toBe(0);
    } finally {
      queryDatabase(`
        drop trigger if exists phase_11c2a_fail_ui_receipt_insert
          on public.manual_diary_entry_requests;
        drop function if exists public.phase_11c2a_fail_ui_receipt_insert();
      `);
    }

    await form.getByRole("button", { name: "Add entry" }).click();
    await expect(form).toContainText("Entry added.");
    const completedReceipts = await userAClient
      .from("manual_diary_entry_requests")
      .select("id", { count: "exact", head: true })
      .eq("idempotency_key", originalKey);
    const completedRows = await userAClient
      .from("diary_entries")
      .select("id", { count: "exact", head: true })
      .eq("food_name", foodName);
    expect(completedReceipts.count).toBe(1);
    expect(completedRows.count).toBe(1);
    await context.close();
  });

  test("CJ-012 recovers a committed but unacknowledged form submission with the original key", async ({
    browser,
  }) => {
    const context = await browser.newContext({ storageState: authenticatedState });
    const page = await context.newPage();
    await page.goto(`/en/today?date=${selectedDate}`);
    let form = manualForm(page);
    const originalKey = await manualDraftKey(form).inputValue();
    const foodName = `Unacknowledged UI completion ${originalKey}`;
    await fillManualDraft(form, { food_name: foodName, notes: "Retry exactly" });

    let acknowledgeIntercepted: (status: number) => void = () => undefined;
    const intercepted = new Promise<number>((resolve) => {
      acknowledgeIntercepted = resolve;
    });
    await page.route("**/*", async (route) => {
      const request = route.request();

      if (request.method() === "POST" && request.headers()["next-action"]) {
        const upstreamResponse = await route.fetch();
        acknowledgeIntercepted(upstreamResponse.status());
        await route.abort("failed");
        return;
      }

      await route.continue();
    });

    await form.getByRole("button", { name: "Add entry" }).click();
    expect(await intercepted).toBe(200);

    await expect
      .poll(async () => {
        const receipt = await userAClient
          .from("manual_diary_entry_requests")
          .select("completed_diary_entry_id", { count: "exact" })
          .eq("idempotency_key", originalKey);
        return receipt.count;
      })
      .toBe(1);

    const committedReceipt = await userAClient
      .from("manual_diary_entry_requests")
      .select("completed_diary_entry_id")
      .eq("idempotency_key", originalKey)
      .single();
    await page.unroute("**/*");
    await page.reload();
    form = manualForm(page);
    await expect(manualDraftKey(form)).toHaveValue(originalKey);
    await expectManualDraftValues(form, {
      food_name: foodName,
      notes: "Retry exactly",
    });

    await form.getByRole("button", { name: "Add entry" }).click();
    await expect(form).toContainText("Entry added.");
    await expect(manualDraftKey(form)).not.toHaveValue(originalKey);

    const recoveredReceipt = await userAClient
      .from("manual_diary_entry_requests")
      .select("completed_diary_entry_id", { count: "exact" })
      .eq("idempotency_key", originalKey);
    const recoveredRows = await userAClient
      .from("diary_entries")
      .select("food_name", { count: "exact" })
      .eq(
        "id",
        committedReceipt.data?.completed_diary_entry_id as string,
      );
    expect(recoveredReceipt.error).toBeNull();
    expect(recoveredReceipt.count).toBe(1);
    expect(recoveredRows.error).toBeNull();
    expect(recoveredRows.count).toBe(1);
    expect(recoveredRows.data?.[0]?.food_name).toBe(foodName);
    await expect(
      page.locator(
        `[data-diary-entry-id="${committedReceipt.data?.completed_diary_entry_id}"]`,
      ),
    ).toContainText(foodName);
    await context.close();
  });

  test("CJ-012 preserves conflicting values and requires explicit new-entry rotation in English and Hebrew RTL", async ({
    browser,
  }) => {
    const scenarios = [
      {
        conflict:
          "This draft was already completed with different values. Nothing new was added.",
        locale: "en",
        newDraft: "Start a new entry with these values",
        success: "Entry added.",
      },
      {
        conflict:
          "הטיוטה הזו כבר הושלמה עם ערכים שונים. לא נוספה רשומה חדשה.",
        locale: "he",
        newDraft: "התחלת רשומה חדשה עם הערכים האלה",
        success: "הרשומה נוספה.",
      },
    ] as const;

    for (const scenario of scenarios) {
      const context = await browser.newContext({ storageState: authenticatedState });
      const page = await context.newPage();
      await page.goto(`/${scenario.locale}/today?date=${selectedDate}`);
      let form = manualForm(page);
      const completedKey = await manualDraftKey(form).inputValue();
      const completedName = `Completed ${scenario.locale} ${completedKey}`;
      await fillManualDraft(form, { food_name: completedName });
      await form.getByRole("button", { name: scenario.locale === "en" ? "Add entry" : "הוספת רשומה" }).click();
      await expect(form).toContainText(scenario.success);

      const conflictingValues: ManualDraftValues = {
        brand_name: `Conflict brand ${scenario.locale}`,
        calories: "432",
        carbohydrates_g: "31.25",
        entry_date: selectedDate,
        fat_g: "12.75",
        food_name: `Conflicting ${scenario.locale} intent`,
        meal_type: "lunch",
        notes: `Conflict notes ${scenario.locale}`,
        protein_g: "22.5",
        serving_quantity: "1.25",
        serving_unit: "portion",
      };
      await replacePersistedDraft(
        page,
        form,
        completedKey,
        conflictingValues,
      );
      await page.reload();
      form = manualForm(page);
      await expect(manualDraftKey(form)).toHaveValue(completedKey);
      await expectManualDraftValues(form, conflictingValues);
      await form.getByRole("button", { name: scenario.locale === "en" ? "Add entry" : "הוספת רשומה" }).click();

      await expect(form).toContainText(scenario.conflict);
      await expectManualDraftValues(form, conflictingValues);
      const conflictingRows = await userAClient
        .from("diary_entries")
        .select("id", { count: "exact", head: true })
        .eq("food_name", conflictingValues.food_name as string);
      const retainedReceipt = await userAClient
        .from("manual_diary_entry_requests")
        .select("id", { count: "exact", head: true })
        .eq("idempotency_key", completedKey);
      expect(conflictingRows.count).toBe(0);
      expect(retainedReceipt.count).toBe(1);

      await form.getByRole("button", { name: scenario.newDraft }).click();
      await expect(manualDraftKey(form)).not.toHaveValue(completedKey);
      await expectManualDraftValues(form, conflictingValues);
      await expect(form).not.toContainText(scenario.conflict);

      if (scenario.locale === "he") {
        await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
      }

      await context.close();
    }
  });

  test("CJ-012 enforces the receipt schema, ACL, RLS, and minimum definer write boundary", async () => {
    expect(
      queryDatabase(`
        select string_agg(column_name, ',' order by ordinal_position)
        from information_schema.columns
        where table_schema = 'public'
          and table_name = 'manual_diary_entry_requests';
      `),
    ).toBe(
      "id,user_id,idempotency_key,request_payload,completed_diary_entry_id,live_diary_entry_id,completed_at,write_transaction_id",
    );
    expect(
      queryDatabase(`
        select pg_get_constraintdef(oid)
        from pg_constraint
        where conrelid = 'public.manual_diary_entry_requests'::regclass
          and conname = 'manual_diary_entry_requests_user_key';
      `),
    ).toBe("UNIQUE (user_id, idempotency_key)");
    expect(
      queryDatabase(`
        select string_agg(indexname, ',' order by indexname)
        from pg_indexes
        where schemaname = 'public'
          and tablename = 'manual_diary_entry_requests';
      `),
    ).toBe(
      "manual_diary_entry_requests_live_entry_idx,manual_diary_entry_requests_pkey,manual_diary_entry_requests_user_key",
    );
    expect(
      queryDatabase(`
        select relrowsecurity, relforcerowsecurity
        from pg_class
        where oid = 'public.manual_diary_entry_requests'::regclass;
      `),
    ).toBe("t|f");
    expect(
      queryDatabase(`
        select permissive || '|' || cmd || '|' || array_to_string(roles, ',')
        from pg_policies
        where schemaname = 'public'
          and tablename = 'manual_diary_entry_requests'
        order by policyname;
      `),
    ).toBe(
      "PERMISSIVE|SELECT|authenticated\nRESTRICTIVE|ALL|authenticated",
    );
    expect(
      queryDatabase(`
        select concat_ws('|',
          has_table_privilege('authenticated', 'public.manual_diary_entry_requests', 'SELECT'),
          has_table_privilege('authenticated', 'public.manual_diary_entry_requests', 'INSERT'),
          has_table_privilege('authenticated', 'public.manual_diary_entry_requests', 'UPDATE'),
          has_table_privilege('authenticated', 'public.manual_diary_entry_requests', 'DELETE'),
          has_table_privilege('anon', 'public.manual_diary_entry_requests', 'SELECT'),
          has_table_privilege('anon', 'public.manual_diary_entry_requests', 'INSERT'));
      `),
    ).toBe("t|f|f|f|f|f");

    const functionMetadata = queryDatabase(`
      select concat_ws('|', n.nspname, p.proname, p.provolatile, p.prosecdef,
        array_to_string(p.proconfig, ','),
        has_function_privilege('public', p.oid, 'execute'),
        has_function_privilege('anon', p.oid, 'execute'),
        has_function_privilege('authenticated', p.oid, 'execute'))
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
      where p.oid in (
        'public.create_manual_diary_entry(uuid,date,text,uuid,text,text,numeric,text,integer,numeric,numeric,numeric,text)'::regprocedure,
        'private.insert_completed_manual_diary_entry_request(uuid,jsonb,uuid)'::regprocedure
      )
      order by n.nspname, p.proname;
    `);
    expect(functionMetadata).toContain(
      'private|insert_completed_manual_diary_entry_request|v|t|search_path=""|f|f|t',
    );
    expect(functionMetadata).toContain(
      'public|create_manual_diary_entry|v|f|search_path=""|f|f|t',
    );
    expect(supabaseConfig).not.toMatch(/schemas\s*=\s*\[[^\]]*"private"/);

    const boundaryKey = randomUUID();
    const boundaryCreate = await createManual(
      userAClient,
      createArgs(boundaryKey, { p_food_name: "Receipt boundary row" }),
    );
    expect(boundaryCreate.error).toBeNull();
    const boundaryEntryId = boundaryCreate.data?.diary_entry_id as string;
    const ownerReceipt = await userAClient
      .from("manual_diary_entry_requests")
      .select("id,user_id")
      .eq("idempotency_key", boundaryKey)
      .single();
    expect(ownerReceipt.error).toBeNull();
    expect(ownerReceipt.data?.user_id).toBe(userAId);

    const userBReceipt = await userBClient
      .from("manual_diary_entry_requests")
      .select("id")
      .eq("id", ownerReceipt.data?.id as string);
    expect(userBReceipt.error).toBeNull();
    expect(userBReceipt.data).toEqual([]);

    const fabricated = await userAClient
      .from("manual_diary_entry_requests")
      .insert({
        completed_diary_entry_id: boundaryEntryId,
        idempotency_key: randomUUID(),
        live_diary_entry_id: boundaryEntryId,
        request_payload: { food_name: "fabricated" },
        user_id: userAId,
      });
    const updated = await userAClient
      .from("manual_diary_entry_requests")
      .update({ request_payload: { food_name: "updated" } })
      .eq("id", ownerReceipt.data?.id as string);
    const deleted = await userAClient
      .from("manual_diary_entry_requests")
      .delete()
      .eq("id", ownerReceipt.data?.id as string);
    const anonymous = localClient();
    const anonymousRead = await anonymous
      .from("manual_diary_entry_requests")
      .select("id");
    expect(fabricated.error?.code).toBe("42501");
    expect(updated.error?.code).toBe("42501");
    expect(deleted.error?.code).toBe("42501");
    expect(anonymousRead.error?.code).toBe("42501");

    const receiptPayload = queryDatabase(`
      select request_payload::text
      from public.manual_diary_entry_requests
      where id = '${ownerReceipt.data?.id}';
    `).replaceAll("'", "''");
    expect(() =>
      queryDatabase(`
        begin;
        set local role authenticated;
        set local request.jwt.claim.sub = '${userAId}';
        update public.diary_entries
        set notes = notes
        where id = '${boundaryEntryId}';
        select private.insert_completed_manual_diary_entry_request(
          '${randomUUID()}',
          '${receiptPayload}'::jsonb,
          '${boundaryEntryId}'
        );
        rollback;
      `),
    ).toThrow();

    expect(
      queryDatabase(`
        select concat_ws('|',
          tg.tgenabled,
          p.proname,
          p.prosecdef,
          array_to_string(p.proconfig, ','),
          pg_get_triggerdef(tg.oid) like
            '%BEFORE UPDATE ON public.diary_entries FOR EACH ROW%')
        from pg_trigger tg
        join pg_proc p on p.oid = tg.tgfoid
        where tg.tgrelid = 'public.diary_entries'::regclass
          and tg.tgname = 'diary_entries_increment_version'
          and not tg.tgisinternal;
      `),
    ).toBe('O|increment_diary_entry_version|f|search_path=""|t');

    const firstUpdate = await userAClient
      .from("diary_entries")
      .update({ notes: "Version two" })
      .eq("id", boundaryEntryId)
      .eq("version", 1)
      .select("source,user_id,version")
      .single();
    const secondUpdate = await userAClient
      .from("diary_entries")
      .update({ notes: "Version three" })
      .eq("id", boundaryEntryId)
      .eq("version", 2)
      .select("source,user_id,version")
      .single();
    const provenanceTamper = await userAClient
      .from("diary_entries")
      .update({ source: "recipe", user_id: userBId, version: 99 })
      .eq("id", boundaryEntryId);
    expect(firstUpdate.data).toEqual({
      source: "manual",
      user_id: userAId,
      version: 2,
    });
    expect(secondUpdate.data).toEqual({
      source: "manual",
      user_id: userAId,
      version: 3,
    });
    expect(provenanceTamper.error?.code).toBe("42501");
    const preservedProvenance = await userAClient
      .from("diary_entries")
      .select("source,user_id,version")
      .eq("id", boundaryEntryId)
      .single();
    expect(preservedProvenance.data).toEqual({
      source: "manual",
      user_id: userAId,
      version: 3,
    });
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

  test("CJ-014 permits exactly one concurrent application-path edit and supports a fresh-version retry", async ({
    browser,
  }) => {
    const concurrentCreate = await createManual(
      userAClient,
      createArgs(randomUUID(), {
        p_calories: 100,
        p_food_name: "Concurrent edit baseline",
        p_notes: "Concurrent baseline notes",
      }),
    );
    expect(concurrentCreate.error).toBeNull();
    const concurrentId = concurrentCreate.data?.diary_entry_id as string;
    const context = await browser.newContext({ storageState: authenticatedState });
    const firstPage = await context.newPage();
    const secondPage = await context.newPage();
    await Promise.all([
      firstPage.goto(`/en/today?date=${selectedDate}`),
      secondPage.goto(`/en/today?date=${selectedDate}`),
    ]);
    const firstEntry = firstPage.locator(
      `[data-diary-entry-id="${concurrentId}"]`,
    );
    const secondEntry = secondPage.locator(
      `[data-diary-entry-id="${concurrentId}"]`,
    );
    await Promise.all([
      firstEntry.getByRole("button", { name: "Edit" }).click(),
      secondEntry.getByRole("button", { name: "Edit" }).click(),
    ]);
    await Promise.all([
      expect(firstEntry.locator('input[name="expected_version"]')).toHaveValue(
        "1",
      ),
      expect(secondEntry.locator('input[name="expected_version"]')).toHaveValue(
        "1",
      ),
    ]);

    await firstEntry.locator('input[name="food_name"]').fill("Concurrent winner candidate one");
    await firstEntry.locator('input[name="calories"]').fill("211");
    await firstEntry.locator('textarea[name="notes"]').fill("Candidate one notes");
    await secondEntry.locator('input[name="food_name"]').fill("Concurrent winner candidate two");
    await secondEntry.locator('input[name="calories"]').fill("322");
    await secondEntry.locator('textarea[name="notes"]').fill("Candidate two notes");

    await Promise.all([
      firstEntry.getByRole("button", { name: "Save changes" }).click(),
      secondEntry.getByRole("button", { name: "Save changes" }).click(),
    ]);

    const terminalEditMessage =
      /Entry updated\.|This entry changed after you opened it, so your edit was not saved\./;
    await Promise.all([
      expect(firstEntry.locator('[role="status"], [role="alert"]')).toContainText(
        terminalEditMessage,
      ),
      expect(secondEntry.locator('[role="status"], [role="alert"]')).toContainText(
        terminalEditMessage,
      ),
    ]);

    const firstSucceeded = await firstEntry
      .getByText("Entry updated.", { exact: true })
      .isVisible();
    const secondSucceeded = await secondEntry
      .getByText("Entry updated.", { exact: true })
      .isVisible();
    const firstConflicted = await firstEntry
      .getByText(/This entry changed after you opened it/)
      .isVisible();
    const secondConflicted = await secondEntry
      .getByText(/This entry changed after you opened it/)
      .isVisible();
    expect([firstSucceeded, secondSucceeded].filter(Boolean)).toHaveLength(1);
    expect([firstConflicted, secondConflicted].filter(Boolean)).toHaveLength(1);

    const winner = firstSucceeded
      ? {
          calories: 211,
          food_name: "Concurrent winner candidate one",
          notes: "Candidate one notes",
        }
      : {
          calories: 322,
          food_name: "Concurrent winner candidate two",
          notes: "Candidate two notes",
        };
    const loserEntry = firstConflicted ? firstEntry : secondEntry;
    const loserValues = firstConflicted
      ? {
          calories: "211",
          food_name: "Concurrent winner candidate one",
          notes: "Candidate one notes",
        }
      : {
          calories: "322",
          food_name: "Concurrent winner candidate two",
          notes: "Candidate two notes",
        };
    await expect(loserEntry.locator('input[name="food_name"]')).toHaveValue(
      loserValues.food_name,
    );
    await expect(loserEntry.locator('input[name="calories"]')).toHaveValue(
      loserValues.calories,
    );
    await expect(loserEntry.locator('textarea[name="notes"]')).toHaveValue(
      loserValues.notes,
    );

    const stored = await userAClient
      .from("diary_entries")
      .select(
        "brand_name,calories,carbohydrates_g,entry_date,fat_g,food_id,food_name,meal_type,notes,protein_g,serving_quantity,serving_unit,source,user_id,version",
      )
      .eq("id", concurrentId)
      .single();
    expect(stored.error).toBeNull();
    expect(stored.data).toEqual({
      brand_name: null,
      carbohydrates_g: null,
      entry_date: selectedDate,
      fat_g: 0,
      food_id: null,
      meal_type: "breakfast",
      protein_g: 0,
      serving_quantity: 0,
      serving_unit: null,
      source: "manual",
      user_id: userAId,
      ...winner,
      version: 2,
    });

    const losingPage = firstConflicted ? firstPage : secondPage;
    await losingPage.reload();
    const refreshedEntry = losingPage.locator(
      `[data-diary-entry-id="${concurrentId}"]`,
    );
    await refreshedEntry.getByRole("button", { name: "Edit" }).click();
    await expect(
      refreshedEntry.locator('input[name="expected_version"]'),
    ).toHaveValue("2");
    await refreshedEntry.locator('input[name="food_name"]').fill("Fresh version retry");
    await refreshedEntry.locator('input[name="calories"]').fill("777");
    await refreshedEntry.getByRole("button", { name: "Save changes" }).click();
    await expect(refreshedEntry).toContainText("Entry updated.");

    const retried = await userAClient
      .from("diary_entries")
      .select("calories,food_name,version")
      .eq("id", concurrentId)
      .single();
    expect(retried.data).toEqual({
      calories: 777,
      food_name: "Fresh version retry",
      version: 3,
    });
    await context.close();
  });

  test("CJ-014 reports an application-path missing edit without disclosing or restoring the deleted row", async ({
    browser,
  }) => {
    const create = await createManual(
      userAClient,
      createArgs(randomUUID(), {
        p_calories: 410,
        p_food_name: "Edit delete race baseline",
      }),
    );
    expect(create.error).toBeNull();
    const entryId = create.data?.diary_entry_id as string;
    const context = await browser.newContext({ storageState: authenticatedState });
    const editPage = await context.newPage();
    const deletePage = await context.newPage();
    await Promise.all([
      editPage.goto(`/en/today?date=${selectedDate}`),
      deletePage.goto(`/en/today?date=${selectedDate}`),
    ]);
    const editEntry = editPage.locator(`[data-diary-entry-id="${entryId}"]`);
    const deleteEntry = deletePage.locator(
      `[data-diary-entry-id="${entryId}"]`,
    );
    await editEntry.getByRole("button", { name: "Edit" }).click();
    await expect(editEntry.locator('input[name="expected_version"]')).toHaveValue(
      "1",
    );
    await editEntry.locator('input[name="food_name"]').fill(
      "Deleted edit intent must remain local",
    );
    await deleteEntry.getByRole("button", { name: "Delete" }).click();
    await expect(deleteEntry).toHaveCount(0);

    await editEntry.getByRole("button", { name: "Save changes" }).click();
    await expect(editEntry).toContainText(
      "Could not update entry. Check the fields and try again.",
    );
    await expect(editEntry.locator('input[name="food_name"]')).toHaveValue(
      "Deleted edit intent must remain local",
    );

    const deletedRows = await userAClient
      .from("diary_entries")
      .select("id", { count: "exact", head: true })
      .eq("id", entryId);
    expect(deletedRows.count).toBe(0);
    await context.close();
  });

  test("CJ-014 hides other-owner existence at the database boundary", async () => {

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

  test("CJ-015 keeps owner deletion safe across repeated, database, session, tenant, and Hebrew states", async ({
    browser,
  }) => {
    const fixtures = await Promise.all(
      [
        "Owner delete success",
        "Repeated delete target",
        "Database delete failure target",
        "Expired Hebrew delete target",
        "Unrelated diary row must remain",
      ].map((foodName) =>
        createManual(
          userAClient,
          createArgs(randomUUID(), { p_food_name: foodName }),
        ),
      ),
    );
    expect(fixtures.every(({ error }) => error === null)).toBe(true);
    const [ownerId, repeatedId, databaseFailureId, expiredId, unrelatedId] =
      fixtures.map(({ data }) => data?.diary_entry_id as string);
    const otherOwner = await createManual(
      userBClient,
      createArgs(randomUUID(), { p_food_name: "Private delete row for user B" }),
    );
    expect(otherOwner.error).toBeNull();
    const otherOwnerId = otherOwner.data?.diary_entry_id as string;

    const unaffectedTables = [
      "manual_diary_entry_requests",
      "foods",
      "nutrition_targets",
      "saved_meals",
      "recipes",
    ] as const;
    const countsBefore = await Promise.all(
      unaffectedTables.map((table) =>
        userAClient.from(table).select("*", { count: "exact", head: true }),
      ),
    );

    const ownerContext = await browser.newContext({
      storageState: authenticatedState,
    });
    const ownerPage = await ownerContext.newPage();
    await ownerPage.goto(`/en/today?date=${selectedDate}`);
    const ownerEntry = ownerPage.locator(
      `[data-diary-entry-id="${ownerId}"]`,
    );
    await ownerEntry.getByRole("button", { name: "Delete" }).click();
    await expect(ownerEntry).toHaveCount(0);
    await ownerContext.close();

    const repeatedContext = await browser.newContext({
      storageState: authenticatedState,
    });
    const firstRepeatedPage = await repeatedContext.newPage();
    const secondRepeatedPage = await repeatedContext.newPage();
    await Promise.all([
      firstRepeatedPage.goto(`/en/today?date=${selectedDate}`),
      secondRepeatedPage.goto(`/en/today?date=${selectedDate}`),
    ]);
    const firstRepeatedEntry = firstRepeatedPage.locator(
      `[data-diary-entry-id="${repeatedId}"]`,
    );
    const secondRepeatedEntry = secondRepeatedPage.locator(
      `[data-diary-entry-id="${repeatedId}"]`,
    );
    await firstRepeatedEntry.getByRole("button", { name: "Delete" }).click();
    await expect(firstRepeatedEntry).toHaveCount(0);
    await secondRepeatedEntry.getByRole("button", { name: "Delete" }).click();
    await expect(secondRepeatedEntry).toContainText(
      "We could not delete this entry. Try again.",
    );
    const repeatedRows = await userAClient
      .from("diary_entries")
      .select("id", { count: "exact", head: true })
      .eq("id", repeatedId);
    expect(repeatedRows.count).toBe(0);
    await repeatedContext.close();

    const databaseContext = await browser.newContext({
      storageState: authenticatedState,
    });
    const databasePage = await databaseContext.newPage();
    await databasePage.goto(`/en/today?date=${selectedDate}`);
    const databaseEntry = databasePage.locator(
      `[data-diary-entry-id="${databaseFailureId}"]`,
    );
    queryDatabase(`
      create or replace function public.phase_11c2b_fail_diary_delete()
      returns trigger language plpgsql security invoker set search_path = '' as $$
      begin
        if old.id = '${databaseFailureId}'::uuid then
          raise integrity_constraint_violation using message = 'Phase 11C2B delete rollback probe.';
        end if;
        return old;
      end;
      $$;
      drop trigger if exists phase_11c2b_fail_diary_delete on public.diary_entries;
      create trigger phase_11c2b_fail_diary_delete
      before delete on public.diary_entries
      for each row execute function public.phase_11c2b_fail_diary_delete();
    `);

    try {
      await databaseEntry.getByRole("button", { name: "Delete" }).click();
      await expect(databaseEntry).toContainText(
        "We could not delete this entry. Try again.",
      );
      const preserved = await userAClient
        .from("diary_entries")
        .select("food_name")
        .eq("id", databaseFailureId)
        .single();
      expect(preserved.data?.food_name).toBe("Database delete failure target");
    } finally {
      queryDatabase(`
        drop trigger if exists phase_11c2b_fail_diary_delete on public.diary_entries;
        drop function if exists public.phase_11c2b_fail_diary_delete();
      `);
      await databaseContext.close();
    }

    const expiredContext = await browser.newContext({
      storageState: authenticatedState,
    });
    const expiredPage = await expiredContext.newPage();
    await expiredPage.goto(`/he/today?date=${selectedDate}`);
    await expect(expiredPage.locator("html")).toHaveAttribute("dir", "rtl");
    const expiredEntry = expiredPage.locator(
      `[data-diary-entry-id="${expiredId}"]`,
    );
    await expiredContext.clearCookies();
    await expiredEntry.getByRole("button", { name: "מחיקה" }).click();
    await expect(expiredEntry).toContainText(
      "לא הצלחנו למחוק את הרשומה. נסו שוב.",
    );
    const preservedExpired = await userAClient
      .from("diary_entries")
      .select("food_name")
      .eq("id", expiredId)
      .single();
    expect(preservedExpired.data?.food_name).toBe(
      "Expired Hebrew delete target",
    );
    await expiredContext.close();

    const tenantContext = await browser.newContext({
      storageState: authenticatedState,
    });
    const tenantPage = await tenantContext.newPage();
    await tenantPage.goto(`/en/today?date=${selectedDate}`);
    await expect(
      tenantPage.getByText("Private delete row for user B", { exact: true }),
    ).toHaveCount(0);
    await tenantContext.close();
    const forbiddenDelete = await userAClient
      .from("diary_entries")
      .delete()
      .eq("id", otherOwnerId)
      .select("id");
    expect(forbiddenDelete.error).toBeNull();
    expect(forbiddenDelete.data).toEqual([]);
    const otherOwnerPreserved = await userBClient
      .from("diary_entries")
      .select("food_name,user_id")
      .eq("id", otherOwnerId)
      .single();
    expect(otherOwnerPreserved.data).toEqual({
      food_name: "Private delete row for user B",
      user_id: userBId,
    });

    const unrelated = await userAClient
      .from("diary_entries")
      .select("food_name")
      .eq("id", unrelatedId)
      .single();
    expect(unrelated.data?.food_name).toBe("Unrelated diary row must remain");
    const countsAfter = await Promise.all(
      unaffectedTables.map((table) =>
        userAClient.from(table).select("*", { count: "exact", head: true }),
      ),
    );
    expect(countsAfter.map(({ count }) => count)).toEqual(
      countsBefore.map(({ count }) => count),
    );
  });
});
