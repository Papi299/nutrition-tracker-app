import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  expect,
  test,
  type Browser,
  type BrowserContext,
  type Locator,
  type Page,
  type Request,
} from "@playwright/test";
import type { Database } from "@/lib/supabase/database.types";

const localSupabaseUrl = process.env.LOCAL_SUPABASE_URL;
const localSupabasePublishableKey = process.env.LOCAL_SUPABASE_PUBLISHABLE_KEY;
const localOnly = process.env.DATE_E2E_LOCAL_SUPABASE === "1";
const password = "DiaryNoJavaScript123!";
const supabaseConfig = readFileSync("supabase/config.toml", "utf8");
const projectId = supabaseConfig.match(
  /^project_id\s*=\s*"([^"]+)"/m,
)?.[1];

if (!projectId) throw new Error("Could not read the local Supabase project id.");

const databaseContainer = `supabase_db_${projectId}`;

test.skip(
  !localOnly || !localSupabaseUrl || !localSupabasePublishableKey,
  "No-JavaScript diary tests require the local-only test runner.",
);

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

test.describe.serial("Phase 11C CJ-012 no-JavaScript manual diary completion", () => {
  let authenticatedState: Awaited<ReturnType<BrowserContext["storageState"]>>;
  let userClient: SupabaseClient<Database>;
  let otherUserClient: SupabaseClient<Database>;
  let userId: string;
  let otherUserId: string;

  const runId = `${Date.now()}-${randomUUID()}`;
  const email = `diary-nojs-${runId}@example.test`;
  const otherEmail = `diary-nojs-other-${runId}@example.test`;

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

  async function openNoJavaScriptPage(
    browser: Browser,
    locale: "en" | "he",
    date: string,
  ) {
    const context = await browser.newContext({
      javaScriptEnabled: false,
      storageState: authenticatedState,
    });
    const page = await context.newPage();
    await page.goto(`/${locale}/today?date=${date}`);
    return { context, page };
  }

  async function countsForIntent(
    client: SupabaseClient<Database>,
    foodName: string,
    requestKey: string,
  ) {
    const entries = await client
      .from("diary_entries")
      .select("id", { count: "exact", head: true })
      .eq("food_name", foodName);
    const receipts = await client
      .from("manual_diary_entry_requests")
      .select("id", { count: "exact", head: true })
      .eq("idempotency_key", requestKey);
    expect(entries.error).toBeNull();
    expect(receipts.error).toBeNull();
    return { entries: entries.count, receipts: receipts.count };
  }

  test.beforeAll(async ({ browser }) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.goto("/en/auth/sign-up");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password").fill(password);
    await page.getByRole("button", { name: "Create account" }).click();
    await expect(page).toHaveURL(/\/en\/today\?date=\d{4}-\d{2}-\d{2}$/);
    authenticatedState = await context.storageState();
    await context.close();

    userClient = localClient();
    const signIn = await userClient.auth.signInWithPassword({ email, password });
    expect(signIn.error).toBeNull();
    userId = signIn.data.user?.id as string;

    otherUserClient = localClient();
    const otherSignUp = await otherUserClient.auth.signUp({
      email: otherEmail,
      password,
    });
    expect(otherSignUp.error).toBeNull();
    otherUserId = otherSignUp.data.user?.id as string;
  });

  test("CJ-012 no-JavaScript success preserves date, snapshot null/zero semantics, receipt identity, and tenant ownership", async ({
    browser,
  }) => {
    const selectedDate = "2032-09-13";
    const otherTenantMarker = `OTHER TENANT NOJS MARKER ${runId}`;
    const markerInsert = await otherUserClient.from("diary_entries").insert({
      entry_date: selectedDate,
      food_name: otherTenantMarker,
      meal_type: "breakfast",
      source: "manual",
      user_id: otherUserId,
    });
    expect(markerInsert.error).toBeNull();

    const { context, page } = await openNoJavaScriptPage(
      browser,
      "en",
      selectedDate,
    );
    const form = manualForm(page);
    const requestKey = await manualDraftKey(form).inputValue();
    const foodName = `Native zero snapshot ${requestKey}`;
    await expect(page.getByText(otherTenantMarker, { exact: true })).toHaveCount(0);
    await fillManualDraft(form, {
      brand_name: "",
      calories: "0",
      carbohydrates_g: "12.5",
      fat_g: "0",
      food_name: foodName,
      meal_type: "lunch",
      notes: "",
      protein_g: "",
      serving_quantity: "0",
      serving_unit: "",
    });
    await form.getByRole("button", { name: "Add entry" }).click();

    await expect(page).toHaveURL(
      new RegExp(`/en/today\\?date=${selectedDate}$`),
    );
    await expect(form).toContainText("Entry added.");
    await expect(manualDraftKey(form)).not.toHaveValue(requestKey);
    await expect(page.getByText(foodName, { exact: true })).toBeVisible();
    await expect(page.getByText(otherTenantMarker, { exact: true })).toHaveCount(0);

    const entry = await userClient
      .from("diary_entries")
      .select(
        "brand_name,calories,carbohydrates_g,entry_date,fat_g,food_name,meal_type,notes,protein_g,serving_quantity,serving_unit,source,user_id",
      )
      .eq("food_name", foodName)
      .single();
    const receipt = await userClient
      .from("manual_diary_entry_requests")
      .select("completed_diary_entry_id,user_id")
      .eq("idempotency_key", requestKey)
      .single();
    expect(entry.error).toBeNull();
    expect(entry.data).toMatchObject({
      brand_name: null,
      calories: 0,
      carbohydrates_g: 12.5,
      entry_date: selectedDate,
      fat_g: 0,
      food_name: foodName,
      meal_type: "lunch",
      notes: null,
      protein_g: null,
      serving_quantity: 0,
      serving_unit: null,
      source: "manual",
      user_id: userId,
    });
    expect(receipt.error).toBeNull();
    expect(receipt.data?.completed_diary_entry_id).not.toBeNull();
    expect(receipt.data?.user_id).toBe(userId);
    expect(await countsForIntent(userClient, foodName, requestKey)).toEqual({
      entries: 1,
      receipts: 1,
    });
    const otherMarker = await otherUserClient
      .from("diary_entries")
      .select("id", { count: "exact", head: true })
      .eq("food_name", otherTenantMarker);
    expect(otherMarker.count).toBe(1);
    await context.close();
  });

  test("CJ-012 no-JavaScript Hebrew validation preserves fields and request identity through correction and retry", async ({
    browser,
  }) => {
    const selectedDate = "2032-09-14";
    const otherTenantMarker = `סמן דייר אחר ${runId}`;
    const markerInsert = await otherUserClient.from("diary_entries").insert({
      entry_date: selectedDate,
      food_name: otherTenantMarker,
      meal_type: "breakfast",
      source: "manual",
      user_id: otherUserId,
    });
    expect(markerInsert.error).toBeNull();
    const { context, page } = await openNoJavaScriptPage(
      browser,
      "he",
      selectedDate,
    );
    const form = manualForm(page);
    const requestKey = await manualDraftKey(form).inputValue();
    const retainedNotes = `הערות שנשמרו ${requestKey}`;
    await fillManualDraft(form, {
      calories: "-1",
      food_name: "",
      notes: retainedNotes,
    });
    await form.getByRole("button", { name: "הוספת רשומה" }).click();

    expect(await countsForIntent(userClient, "", requestKey)).toEqual({
      entries: 0,
      receipts: 0,
    });
    await expect(page.locator("html")).toHaveAttribute("lang", "he");
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    await expect(form).toContainText("יש לבדוק את השדות המסומנים ולנסות שוב.");
    await expect(form).toContainText("זהו שדה חובה.");
    await expect(form).toContainText("ערכים לא יכולים להיות שליליים.");
    await expect(page.getByText(otherTenantMarker, { exact: true })).toHaveCount(0);
    await expectManualDraftValues(form, {
      calories: "-1",
      food_name: "",
      notes: retainedNotes,
    });
    await expect(manualDraftKey(form)).toHaveValue(requestKey);

    const correctedName = `תיקון ללא JavaScript ${requestKey}`;
    await fillManualDraft(form, {
      calories: "0",
      food_name: correctedName,
    });
    await form.getByRole("button", { name: "הוספת רשומה" }).click();
    await expect(form).toContainText("הרשומה נוספה.");
    await expect(page.getByText(correctedName, { exact: true })).toBeVisible();
    await expect(page.getByText(otherTenantMarker, { exact: true })).toHaveCount(0);
    expect(await countsForIntent(userClient, correctedName, requestKey)).toEqual({
      entries: 1,
      receipts: 1,
    });
    const otherMarker = await otherUserClient
      .from("diary_entries")
      .select("id", { count: "exact", head: true })
      .eq("food_name", otherTenantMarker);
    expect(otherMarker.count).toBe(1);
    await context.close();
  });

  test("CJ-012 no-JavaScript database rollback retains a retryable draft and converges after local failure removal", async ({
    browser,
  }) => {
    const selectedDate = "2032-09-15";
    const { context, page } = await openNoJavaScriptPage(
      browser,
      "en",
      selectedDate,
    );
    const form = manualForm(page);
    const requestKey = await manualDraftKey(form).inputValue();
    const foodName = `Native rollback recovery ${requestKey}`;
    const retainedValues = {
      calories: "221",
      food_name: foodName,
      notes: "Retained after native database failure",
    } as const;

    queryDatabase(`
      create or replace function public.phase_11c_cj012_fail_nojs_receipt_insert()
      returns trigger language plpgsql security invoker set search_path = '' as $$
      begin
        if new.idempotency_key = '${requestKey}'::uuid then
          raise integrity_constraint_violation using message = 'Phase 11C CJ-012 no-JS rollback probe.';
        end if;
        return new;
      end;
      $$;
      drop trigger if exists phase_11c_cj012_fail_nojs_receipt_insert
        on public.manual_diary_entry_requests;
      create trigger phase_11c_cj012_fail_nojs_receipt_insert
      before insert on public.manual_diary_entry_requests
      for each row execute function public.phase_11c_cj012_fail_nojs_receipt_insert();
    `);

    try {
      await fillManualDraft(form, retainedValues);
      await form.getByRole("button", { name: "Add entry" }).click();
      await expect(form).toContainText(
        "We could not save or load diary entries right now.",
      );
      await expectManualDraftValues(form, retainedValues);
      await expect(manualDraftKey(form)).toHaveValue(requestKey);
      expect(await countsForIntent(userClient, foodName, requestKey)).toEqual({
        entries: 0,
        receipts: 0,
      });
    } finally {
      queryDatabase(`
        drop trigger if exists phase_11c_cj012_fail_nojs_receipt_insert
          on public.manual_diary_entry_requests;
        drop function if exists public.phase_11c_cj012_fail_nojs_receipt_insert();
      `);
    }

    await form.getByRole("button", { name: "Add entry" }).click();
    await expect(form).toContainText("Entry added.");
    await expect(page.getByText(foodName, { exact: true })).toBeVisible();
    expect(await countsForIntent(userClient, foodName, requestKey)).toEqual({
      entries: 1,
      receipts: 1,
    });
    await context.close();
  });

  test("CJ-012 no-JavaScript exact native HTTP replay converges without a duplicate", async ({
    browser,
  }) => {
    const selectedDate = "2032-09-16";
    const { context, page } = await openNoJavaScriptPage(
      browser,
      "en",
      selectedDate,
    );
    const form = manualForm(page);
    const requestKey = await manualDraftKey(form).inputValue();
    const foodName = `Native uncertain replay ${requestKey}`;
    let submittedRequest: Request | null = null;
    page.on("request", (request) => {
      if (
        request.method() === "POST" &&
        new URL(request.url()).pathname === "/en/today"
      ) {
        submittedRequest = request;
      }
    });

    await fillManualDraft(form, {
      food_name: foodName,
      notes: "Replay the exact native request",
    });
    await form.getByRole("button", { name: "Add entry" }).click();
    await expect(form).toContainText("Entry added.");
    expect(submittedRequest).not.toBeNull();
    expect(await countsForIntent(userClient, foodName, requestKey)).toEqual({
      entries: 1,
      receipts: 1,
    });

    // A completed supported form submission rotates its key, so the captured
    // native request is replayed to model a committed-but-unacknowledged POST.
    const capturedRequest = submittedRequest as unknown as Request;
    const body = capturedRequest.postDataBuffer();
    expect(body).not.toBeNull();
    const replay = await context.request.fetch(capturedRequest.url(), {
      data: body as Buffer,
      headers: {
        "content-type": capturedRequest.headers()["content-type"],
        origin: new URL(capturedRequest.url()).origin,
      },
      method: "POST",
    });
    expect(replay.status()).toBeLessThan(400);
    expect(await countsForIntent(userClient, foodName, requestKey)).toEqual({
      entries: 1,
      receipts: 1,
    });
    await context.close();
  });

  test("CJ-012 no-JavaScript conflict retains the completed key until explicit new-entry intent", async ({
    browser,
  }) => {
    const selectedDate = "2032-09-17";
    const { context, page } = await openNoJavaScriptPage(
      browser,
      "en",
      selectedDate,
    );
    const form = manualForm(page);
    const completedKey = await manualDraftKey(form).inputValue();
    const completedName = `Completed native intent ${completedKey}`;
    await fillManualDraft(form, { food_name: completedName });
    await form.getByRole("button", { name: "Add entry" }).click();
    await expect(form).toContainText("Entry added.");

    const conflictingValues = {
      calories: "432",
      food_name: `Conflicting native intent ${completedKey}`,
      meal_type: "dinner",
      notes: "Preserve this conflicting native draft",
    } as const;
    await manualDraftKey(form).evaluate(
      (element, key) => {
        (element as HTMLInputElement).value = key;
      },
      completedKey,
    );
    await fillManualDraft(form, conflictingValues);
    await form.getByRole("button", { name: "Add entry" }).click();

    await expect(form).toContainText(
      "This draft was already completed with different values. Nothing new was added.",
    );
    await expect(manualDraftKey(form)).toHaveValue(completedKey);
    await expectManualDraftValues(form, conflictingValues);
    expect(
      await countsForIntent(
        userClient,
        conflictingValues.food_name,
        completedKey,
      ),
    ).toEqual({ entries: 0, receipts: 1 });
    const original = await userClient
      .from("diary_entries")
      .select("food_name")
      .eq("food_name", completedName)
      .single();
    expect(original.data?.food_name).toBe(completedName);

    await form
      .getByRole("button", { name: "Start a new entry with these values" })
      .click();
    const newKey = await manualDraftKey(form).inputValue();
    expect(newKey).not.toBe(completedKey);
    await expectManualDraftValues(form, conflictingValues);
    await expect(form).not.toContainText(
      "This draft was already completed with different values.",
    );

    await form.getByRole("button", { name: "Add entry" }).click();
    await expect(form).toContainText("Entry added.");
    expect(
      await countsForIntent(userClient, conflictingValues.food_name, newKey),
    ).toEqual({ entries: 1, receipts: 1 });
    const completedReceipts = await userClient
      .from("manual_diary_entry_requests")
      .select("id", { count: "exact", head: true })
      .in("idempotency_key", [completedKey, newKey]);
    expect(completedReceipts.count).toBe(2);
    await context.close();
  });
});
