import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  expect,
  test,
  type Browser,
  type BrowserContext,
} from "@playwright/test";
import type { Database } from "@/lib/supabase/database.types";

const localSupabaseUrl = process.env.LOCAL_SUPABASE_URL;
const localSupabasePublishableKey = process.env.LOCAL_SUPABASE_PUBLISHABLE_KEY;
const localOnly = process.env.DATE_E2E_LOCAL_SUPABASE === "1";
const password = "RetrievalStatePassword123!";
const supabaseProjectId = readFileSync("supabase/config.toml", "utf8").match(
  /^project_id\s*=\s*"([^"]+)"/m,
)?.[1];

if (!supabaseProjectId) {
  throw new Error("Could not read the local Supabase project id.");
}

const databaseContainer = `supabase_db_${supabaseProjectId}`;

test.skip(
  !localOnly || !localSupabaseUrl || !localSupabasePublishableKey,
  "Retrieval-state tests require the local-only test runner.",
);

test.describe.serial("retrieval states and authenticated core loop", () => {
  let authenticatedState: Awaited<ReturnType<BrowserContext["storageState"]>>;
  let userAClient: SupabaseClient<Database>;
  let userAId: string;
  let userBId: string;
  const runId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const userAEmail = `retrieval-a-${runId}@example.test`;
  const userBEmail = `retrieval-b-${runId}@example.test`;
  const selectedDate = "2031-01-15";

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

  function setAuthenticatedSelect(
    table: "nutrition_targets" | "profiles",
    enabled: boolean,
  ) {
    const statement = enabled
      ? `grant select on table public.${table} to authenticated;`
      : `revoke select on table public.${table} from authenticated;`;

    execFileSync(
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
        "-c",
        statement,
      ],
      { stdio: "pipe" },
    );
  }

  async function openAuthenticatedPage(browser: Browser) {
    const context = await browser.newContext({ storageState: authenticatedState });
    return { context, page: await context.newPage() };
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

    expect(
      (
        await userBClient.from("profiles").insert({
          display_name: "PRIVATE RETRIEVAL USER B",
          id: userBId,
          preferred_language: "en",
          unit_system: "metric",
        })
      ).error,
    ).toBeNull();
    expect(
      (
        await userBClient.from("nutrition_targets").insert({
          calories: 8888,
          effective_from: selectedDate,
          user_id: userBId,
        })
      ).error,
    ).toBeNull();
    expect(
      (
        await userBClient.from("diary_entries").insert({
          calories: 8888,
          entry_date: selectedDate,
          food_name: "PRIVATE RETRIEVAL ENTRY B",
          meal_type: "breakfast",
          source: "manual",
          user_id: userBId,
        })
      ).error,
    ).toBeNull();
  });

  test("distinguishes legitimate missing profile and target states", async ({
    browser,
  }) => {
    const { context, page } = await openAuthenticatedPage(browser);

    await page.goto(`/en/setup?effectiveDate=${selectedDate}`);
    await expect(
      page.locator('form:has(input[name="effectiveDate"])'),
    ).toBeVisible();
    await expect(page.locator('input[name="display_name"]')).toHaveValue("");
    await expect(page.getByTestId("setup-retrieval-error")).toHaveCount(0);

    await page.goto(`/en/today?date=${selectedDate}`);
    await expect(
      page.getByRole("heading", { name: "Finish the basic setup" }),
    ).toBeVisible();
    await expect(page.getByTestId("profile-retrieval-error")).toHaveCount(0);

    const profileInsert = await userAClient.from("profiles").insert({
      display_name: "Core loop user A",
      id: userAId,
      preferred_language: "en",
      unit_system: "metric",
    });
    expect(profileInsert.error).toBeNull();

    await page.reload();
    await expect(
      page.getByRole("heading", {
        name: "No manual target is effective for this date",
      }),
    ).toBeVisible();
    await expect(page.getByTestId("target-retrieval-error")).toHaveCount(0);
    await context.close();
  });

  test("blocks Setup and preserves diary UI on an English profile read failure", async ({
    browser,
  }) => {
    const { context, page } = await openAuthenticatedPage(browser);
    setAuthenticatedSelect("profiles", false);

    try {
      await page.goto(`/en/setup?effectiveDate=${selectedDate}`);
      await expect(page.locator("html")).toHaveAttribute("dir", "ltr");
      await expect(page.getByTestId("setup-retrieval-error")).toContainText(
        "Setup could not be loaded",
      );
      await expect(
        page.locator('form:has(input[name="effectiveDate"])'),
      ).toHaveCount(0);

      await page.goto(`/en/today?date=${selectedDate}`);
      await expect(page.getByTestId("profile-retrieval-error")).toContainText(
        "Profile status could not be loaded",
      );
      await expect(
        page.getByRole("heading", { name: "Finish the basic setup" }),
      ).toHaveCount(0);
      await expect(page.getByRole("heading", { name: "Add manual entry" })).toBeVisible();
    } finally {
      setAuthenticatedSelect("profiles", true);
      await context.close();
    }
  });

  test("blocks Setup and hides fabricated target states on a Hebrew target read failure", async ({
    browser,
  }) => {
    const { context, page } = await openAuthenticatedPage(browser);
    setAuthenticatedSelect("nutrition_targets", false);

    try {
      await page.goto(`/he/setup?effectiveDate=${selectedDate}`);
      await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
      await expect(page.getByTestId("setup-retrieval-error")).toContainText(
        "לא הצלחנו לטעון את ההגדרה",
      );
      await expect(
        page.locator('form:has(input[name="effectiveDate"])'),
      ).toHaveCount(0);

      await page.goto(`/he/today?date=${selectedDate}`);
      await expect(page.getByTestId("target-retrieval-error")).toContainText(
        "לא הצלחנו לטעון את היעדים",
      );
      await expect(
        page.getByRole("heading", { name: "אין יעד ידני שבתוקף לתאריך הזה" }),
      ).toHaveCount(0);
      await expect(page.getByTestId("target-progress")).toHaveCount(0);
      await expect(page.locator('input[name="food_name"]')).toBeVisible();
    } finally {
      setAuthenticatedSelect("nutrition_targets", true);
      await context.close();
    }
  });

  test("redirects an expired authenticated session to localized sign-in", async ({
    browser,
  }) => {
    const context = await browser.newContext({ storageState: authenticatedState });
    await context.clearCookies();
    const page = await context.newPage();

    await page.goto(`/he/today?date=${selectedDate}`);
    await expect(page).toHaveURL(/\/he\/auth\/sign-in$/);
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    await context.close();
  });

  test("covers the authenticated core loop and cross-user isolation", async ({
    browser,
  }) => {
    const { context, page } = await openAuthenticatedPage(browser);

    await page.goto(`/en/setup?effectiveDate=${selectedDate}`);
    await page.getByLabel("Display name").fill("Accepted Phase 5 user");
    await page.getByLabel("Calories").fill("2000");
    await page.getByLabel("Protein (g)").fill("100");
    await page.getByLabel("Carbohydrates (g)").fill("200");
    await page.getByLabel("Fat (g)").fill("60");
    await page.getByRole("button", { name: "Save changes" }).click();
    await expect(page).toHaveURL(new RegExp(`/en/today\\?date=${selectedDate}$`));

    await page.locator('input[name="food_name"]').fill("Core loop meal");
    await page.locator('input[name="calories"]').fill("500");
    await page.locator('input[name="protein_g"]').fill("25");
    await page.locator('input[name="carbohydrates_g"]').fill("50");
    await page.locator('input[name="fat_g"]').fill("10");
    await page.getByRole("button", { name: "Add entry" }).click();
    await expect(page.getByText("Core loop meal", { exact: true })).toBeVisible();

    const totals = page
      .getByRole("heading", { name: "Daily totals" })
      .locator("xpath=ancestor::section[1]");
    await expect(totals).toContainText("500");
    await expect(totals).toContainText("25g");
    await expect(page.getByTestId("target-progress")).toContainText("2000");

    const entry = page.getByRole("listitem").filter({ hasText: "Core loop meal" });
    await entry.getByRole("button", { name: "Edit" }).click();
    await entry.locator('input[name="food_name"]').fill("Core loop meal edited");
    await entry.locator('input[name="calories"]').fill("600");
    await entry.getByRole("button", { name: "Save changes" }).click();
    await expect(
      page.getByText("Core loop meal edited", { exact: true }),
    ).toBeVisible();

    await page.reload();
    const persistedEntry = page
      .getByRole("listitem")
      .filter({ hasText: "Core loop meal edited" });
    await expect(persistedEntry).toBeVisible();
    await expect(totals).toContainText("600");
    await persistedEntry.getByRole("button", { name: "Delete" }).click();
    await expect(persistedEntry).toHaveCount(0);
    await page.reload();
    await expect(
      page.getByText("Core loop meal edited", { exact: true }),
    ).toHaveCount(0);

    const profiles = await userAClient.from("profiles").select("id,display_name");
    const targets = await userAClient
      .from("nutrition_targets")
      .select("user_id,calories");
    const diaryEntries = await userAClient
      .from("diary_entries")
      .select("user_id,food_name");

    expect(profiles.error).toBeNull();
    expect(targets.error).toBeNull();
    expect(diaryEntries.error).toBeNull();
    expect(profiles.data?.every((profile) => profile.id === userAId)).toBe(true);
    expect(targets.data?.every((target) => target.user_id === userAId)).toBe(true);
    expect(diaryEntries.data?.every((entryRow) => entryRow.user_id === userAId)).toBe(
      true,
    );
    expect(profiles.data?.some((profile) => profile.id === userBId)).toBe(false);
    expect(targets.data?.some((target) => target.calories === 8888)).toBe(false);
    expect(
      diaryEntries.data?.some(
        (entryRow) => entryRow.food_name === "PRIVATE RETRIEVAL ENTRY B",
      ),
    ).toBe(false);
    await context.close();
  });
});
