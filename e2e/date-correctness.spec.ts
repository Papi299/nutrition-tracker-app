import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { expect, test, type Browser, type BrowserContext, type Page } from "@playwright/test";
import type { Database } from "@/lib/supabase/database.types";

const localSupabaseUrl = process.env.LOCAL_SUPABASE_URL;
const localSupabasePublishableKey = process.env.LOCAL_SUPABASE_PUBLISHABLE_KEY;
const localOnly = process.env.DATE_E2E_LOCAL_SUPABASE === "1";
const password = "DateTestPassword123!";

test.skip(
  !localOnly || !localSupabaseUrl || !localSupabasePublishableKey,
  "Authenticated date tests require the local-only test runner.",
);

test.describe.serial("calendar-date and effective-target correctness", () => {
  let authenticatedState: Awaited<ReturnType<BrowserContext["storageState"]>>;
  let userAClient: SupabaseClient<Database>;
  let userAId: string;
  let userBId: string;
  const runId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const userAEmail = `date-a-${runId}@example.test`;
  const userBEmail = `date-b-${runId}@example.test`;

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

  async function createTarget(page: Page, date: string, calories: string) {
    await page.goto(`/en/setup?effectiveDate=${date}`);
    await page.getByLabel("Calories").fill(calories);
    await page.getByLabel("Protein (g)").fill(calories === "0" ? "" : "100");
    await page
      .getByLabel("Carbohydrates (g)")
      .fill(calories === "0" ? "" : "200");
    await page.getByLabel("Fat (g)").fill(calories === "0" ? "" : "60");
    await page.getByRole("button", { name: /Save (setup|changes)/ }).click();
    await expect(page).toHaveURL(new RegExp(`/en/today\\?date=${date}$`));
  }

  async function createDiaryEntry(
    page: Page,
    date: string,
    foodName: string,
    calories: string,
  ) {
    await page.goto(`/en/today?date=${date}`);
    await page.locator('input[name="entry_date"]').fill(date);
    await page.locator('input[name="food_name"]').fill(foodName);
    await page.locator('input[name="calories"]').fill(calories);
    await page.getByRole("button", { name: "Add entry" }).click();
    await expect(page.getByText("Entry added.")).toBeVisible();
    await expect(page.getByText(foodName, { exact: true })).toBeVisible();
  }

  async function newAuthenticatedContext(
    browser: Browser,
    options: Parameters<Browser["newContext"]>[0] = {},
  ) {
    return browser.newContext({
      ...options,
      storageState: authenticatedState,
    });
  }

  test.beforeAll(async ({ browser }) => {
    const context = await browser.newContext();
    const page = await context.newPage();

    await page.goto("/en/auth/sign-up");
    await page.getByLabel("Email").fill(userAEmail);
    await page.getByLabel("Password").fill(password);
    await page.getByRole("button", { name: "Create account" }).click();
    await expect(page).toHaveURL(/\/en\/today\?date=\d{4}-\d{2}-\d{2}$/);

    await page.goto("/en/setup?effectiveDate=2026-01-01");
    await page.getByLabel("Display name").fill("Date test user A");
    await page.getByLabel("Calories").fill("2000");
    await page.getByLabel("Protein (g)").fill("100");
    await page.getByLabel("Carbohydrates (g)").fill("200");
    await page.getByLabel("Fat (g)").fill("60");
    await page.getByRole("button", { name: "Save setup" }).click();
    await expect(page).toHaveURL(/\/en\/today\?date=2026-01-01$/);

    await createTarget(page, "2026-02-01", "2200");
    await createTarget(page, "2026-03-01", "0");
    await createTarget(page, "2027-02-01", "2400");
    await createDiaryEntry(page, "2026-01-15", "January meal", "2100");
    await createDiaryEntry(page, "2026-02-15", "February meal", "100");

    authenticatedState = await context.storageState();
    await context.close();

    userAClient = localClient();
    const userASignIn = await userAClient.auth.signInWithPassword({
      email: userAEmail,
      password,
    });
    expect(userASignIn.error).toBeNull();
    userAId = userASignIn.data.user?.id as string;

    const userBClient = localClient();
    const userBSignUp = await userBClient.auth.signUp({
      email: userBEmail,
      password,
    });
    expect(userBSignUp.error).toBeNull();
    userBId = userBSignUp.data.user?.id as string;

    const profileInsert = await userBClient.from("profiles").insert({
      display_name: "Private user B",
      id: userBId,
      preferred_language: "en",
      unit_system: "metric",
    });
    expect(profileInsert.error).toBeNull();

    const targetInsert = await userBClient.from("nutrition_targets").insert({
      calories: 9999,
      effective_from: "2026-01-01",
      user_id: userBId,
    });
    expect(targetInsert.error).toBeNull();

    const diaryInsert = await userBClient.from("diary_entries").insert({
      calories: 9999,
      entry_date: "2026-01-15",
      food_name: "PRIVATE USER B ENTRY",
      meal_type: "breakfast",
      source: "manual",
      user_id: userBId,
    });
    expect(diaryInsert.error).toBeNull();
  });

  test("canonicalizes an undated Today route to Jerusalem local date", async ({
    browser,
  }) => {
    const context = await newAuthenticatedContext(browser, {
      timezoneId: "Asia/Jerusalem",
    });
    const page = await context.newPage();
    await page.clock.install({ time: new Date("2026-01-15T22:30:00.000Z") });

    await page.goto("/en/today");
    await expect(page).toHaveURL(/\/en\/today\?date=2026-01-16$/);

    await page.goto("/en/setup");
    await expect(page).toHaveURL(/\/en\/setup\?effectiveDate=2026-01-16$/);
    await context.close();
  });

  test("selects the effective target for historical, pre-target, and future dates", async ({
    browser,
  }) => {
    const context = await newAuthenticatedContext(browser);
    const page = await context.newPage();

    await page.goto("/en/today?date=2025-12-31");
    await expect(
      page.getByRole("heading", { name: "No manual target is effective for this date" }),
    ).toBeVisible();

    for (const [date, calories] of [
      ["2026-01-01", "2000"],
      ["2026-01-15", "2000"],
      ["2026-02-01", "2200"],
      ["2026-02-15", "2200"],
      ["2027-02-15", "2400"],
    ]) {
      await page.goto(`/en/today?date=${date}`);
      await expect(page.getByTestId("target-summary")).toContainText(calories);
      await expect(page.getByTestId("target-progress")).toContainText(calories);
    }

    await context.close();
  });

  test("changes diary rows and target progress together while preserving zero and null", async ({
    browser,
  }) => {
    const context = await newAuthenticatedContext(browser);
    const page = await context.newPage();

    await page.goto("/en/today?date=2026-01-15");
    await expect(page.getByText("January meal", { exact: true })).toBeVisible();
    await expect(page.getByText("February meal", { exact: true })).not.toBeVisible();
    await expect(page.getByTestId("target-progress")).toContainText("100 over");

    await page.goto("/en/today?date=2026-02-15");
    await expect(page.getByText("February meal", { exact: true })).toBeVisible();
    await expect(page.getByText("January meal", { exact: true })).not.toBeVisible();
    await expect(page.getByTestId("target-summary")).toContainText("2200");

    await page.goto("/en/today?date=2026-03-15");
    await expect(page.getByTestId("target-summary")).toContainText("0");
    await expect(page.getByTestId("target-summary")).toContainText("Not set");
    await expect(page.getByTestId("target-progress")).toContainText("0");
    await expect(page.getByTestId("target-progress")).toContainText("Not set");
    await context.close();
  });

  test("preserves an explicit date through create, edit, and reload", async ({
    browser,
  }) => {
    const context = await newAuthenticatedContext(browser);
    const page = await context.newPage();
    const date = "2026-01-15";

    await createDiaryEntry(page, date, "Date preservation meal", "50");
    const entry = page.getByRole("listitem").filter({
      hasText: "Date preservation meal",
    });
    await entry.getByRole("button", { name: "Edit" }).click();
    await expect(entry.locator('input[name="entry_date"]')).toHaveValue(date);
    await entry.locator('input[name="food_name"]').fill("Date preserved meal");
    await entry.getByRole("button", { name: "Save changes" }).click();
    await expect(page.getByText("Date preserved meal", { exact: true })).toBeVisible();

    await page.reload();
    await expect(page).toHaveURL(new RegExp(`date=${date}$`));
    await expect(page.getByText("Date preserved meal", { exact: true })).toBeVisible();
    await expect(page.locator('input[name="entry_date"]')).toHaveValue(date);

    const persistedEntry = await userAClient
      .from("diary_entries")
      .select("entry_date")
      .eq("food_name", "Date preserved meal")
      .single();
    expect(persistedEntry.error).toBeNull();
    expect(persistedEntry.data?.entry_date).toBe(date);
    await context.close();
  });

  test("rejects invalid, unsupported, and repeated date queries", async ({ browser }) => {
    const context = await newAuthenticatedContext(browser);
    const page = await context.newPage();

    await page.goto("/en/today?date=2026-02-30");
    await expect(page.getByText(/does not exist/)).toBeVisible();
    await expect(page.getByText("January meal", { exact: true })).not.toBeVisible();

    await page.goto("/en/today?date=2026-01-01T00%3A00%3A00Z");
    await expect(page.getByText(/exact YYYY-MM-DD/)).toBeVisible();

    await page.goto("/en/today?date=2026-01-01&date=2026-02-01");
    await expect(page.getByText(/Only one calendar date/)).toBeVisible();

    await page.goto("/en/setup?effectiveDate=2026-02-30");
    await expect(page.getByText(/does not exist/)).toBeVisible();
    await expect(
      page.locator('input[name="effectiveDate"][type="hidden"]'),
    ).toHaveCount(0);
    await context.close();
  });

  test("keeps current-target management separate from historical diary dates", async ({
    browser,
  }) => {
    const context = await newAuthenticatedContext(browser);
    const page = await context.newPage();

    await page.goto("/en/today?date=2026-01-15");
    const manageLink = page.getByRole("link", { name: "Manage current targets" }).first();
    await expect(manageLink).toHaveAttribute("href", "/en/setup");
    await context.close();
  });

  test("preserves English LTR and Hebrew RTL", async ({ browser }) => {
    const context = await newAuthenticatedContext(browser);
    const page = await context.newPage();

    await page.goto("/en/today?date=2026-01-15");
    await expect(page.locator("html")).toHaveAttribute("dir", "ltr");
    await page.goto("/he/today?date=2026-01-15");
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    await context.close();
  });

  test("provides no-JavaScript fallbacks and server-renders explicit dates", async ({
    browser,
  }) => {
    const context = await newAuthenticatedContext(browser, {
      javaScriptEnabled: false,
    });
    const page = await context.newPage();

    await page.goto("/en/today");
    await expect(page.locator("#today-bootstrap-date")).toBeVisible();
    await page.locator("#today-bootstrap-date").fill("2026-01-15");
    await page.getByRole("button", { name: "Continue with date" }).click();
    await expect(page).toHaveURL(/\/en\/today\?date=2026-01-15$/);
    await expect(page.getByText("January meal", { exact: true })).toBeVisible();

    await page.goto("/en/setup");
    await expect(page.locator("#setup-bootstrap-date")).toBeVisible();
    await page.locator("#setup-bootstrap-date").fill("2026-02-01");
    await page.getByRole("button", { name: "Continue with date" }).click();
    await expect(page).toHaveURL(/\/en\/setup\?effectiveDate=2026-02-01$/);
    await expect(page.locator('input[name="effectiveDate"]')).toHaveValue("2026-02-01");
    await expect(page.locator('input[name="effectiveDate"]')).toHaveAttribute("type", "hidden");
    await context.close();
  });

  test("enforces RLS isolation for targets and diary entries", async () => {
    const targets = await userAClient.from("nutrition_targets").select("user_id,calories");
    const diaryEntries = await userAClient.from("diary_entries").select("user_id,food_name");

    expect(targets.error).toBeNull();
    expect(diaryEntries.error).toBeNull();
    expect(targets.data?.every((target) => target.user_id === userAId)).toBe(true);
    expect(diaryEntries.data?.every((entry) => entry.user_id === userAId)).toBe(true);
    expect(targets.data?.some((target) => target.calories === 9999)).toBe(false);
    expect(
      diaryEntries.data?.some((entry) => entry.food_name === "PRIVATE USER B ENTRY"),
    ).toBe(false);
    expect(userAId).not.toBe(userBId);
  });
});
