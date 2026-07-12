import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  expect,
  test,
  type BrowserContext,
  type Page,
} from "@playwright/test";
import type { Database } from "@/lib/supabase/database.types";

const localSupabaseUrl = process.env.LOCAL_SUPABASE_URL;
const localSupabasePublishableKey = process.env.LOCAL_SUPABASE_PUBLISHABLE_KEY;
const localOnly = process.env.DATE_E2E_LOCAL_SUPABASE === "1";
const password = "SetupPersistencePassword123!";

test.skip(
  !localOnly || !localSupabaseUrl || !localSupabasePublishableKey,
  "Setup persistence tests require the local-only test runner.",
);

test.describe.serial("atomic setup persistence", () => {
  let authenticatedState: Awaited<ReturnType<BrowserContext["storageState"]>>;
  let userAClient: SupabaseClient<Database>;
  let userBClient: SupabaseClient<Database>;
  let userAId: string;
  let userBId: string;
  const runId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const userAEmail = `setup-a-${runId}@example.test`;
  const userBEmail = `setup-b-${runId}@example.test`;

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

  function rpcArgs(
    overrides: Partial<Database["public"]["Functions"]["persist_setup"]["Args"]> = {},
  ): Database["public"]["Functions"]["persist_setup"]["Args"] {
    return {
      p_calories: 2000,
      p_carbohydrates_g: 200,
      p_display_name: "Atomic setup user A",
      p_effective_from: "2028-05-01",
      p_fat_g: 60,
      p_preferred_language: "en",
      p_protein_g: 100,
      ...overrides,
    };
  }

  async function submitSetup(
    page: Page,
    {
      date,
      displayName,
      locale,
      preferredLanguage,
      targets,
    }: {
      date: string;
      displayName: string;
      locale: "en" | "he";
      preferredLanguage: "en" | "he";
      targets: Partial<
        Record<
          "calories" | "carbohydrates_g" | "fat_g" | "protein_g",
          string
        >
      >;
    },
  ) {
    await page.goto(`/${locale}/setup?effectiveDate=${date}`);
    const form = page.locator('form:has(input[name="effectiveDate"])');

    await form.locator('input[name="display_name"]').fill(displayName);
    await form
      .locator('select[name="preferred_language"]')
      .selectOption(preferredLanguage);

    for (const field of [
      "calories",
      "protein_g",
      "carbohydrates_g",
      "fat_g",
    ] as const) {
      await form.locator(`input[name="${field}"]`).fill(targets[field] ?? "");
    }

    await form.locator('button[type="submit"]').click();
    await expect(page).toHaveURL(
      new RegExp(`/${preferredLanguage}/today\\?date=${date}$`),
    );
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

    userBClient = localClient();
    const userBSignUp = await userBClient.auth.signUp({
      email: userBEmail,
      password,
    });
    expect(userBSignUp.error).toBeNull();
    userBId = userBSignUp.data.user?.id as string;

    const profileInsert = await userBClient.from("profiles").insert({
      display_name: "Private setup user B",
      id: userBId,
      preferred_language: "en",
      unit_system: "metric",
    });
    expect(profileInsert.error).toBeNull();

    const targetInsert = await userBClient.from("nutrition_targets").insert({
      calories: 7777,
      effective_from: "2028-08-01",
      user_id: userBId,
    });
    expect(targetInsert.error).toBeNull();
  });

  test("creates a first profile and intentional all-null reset in English", async ({
    browser,
  }) => {
    const context = await browser.newContext({ storageState: authenticatedState });
    const page = await context.newPage();

    await submitSetup(page, {
      date: "2028-01-01",
      displayName: "First atomic profile",
      locale: "en",
      preferredLanguage: "en",
      targets: {},
    });

    await expect(
      page.getByRole("heading", {
        name: "No manual target is effective for this date",
      }),
    ).toBeVisible();

    const profile = await userAClient
      .from("profiles")
      .select("display_name,preferred_language")
      .eq("id", userAId)
      .single();
    const reset = await userAClient
      .from("nutrition_targets")
      .select("calories,protein_g,carbohydrates_g,fat_g")
      .eq("effective_from", "2028-01-01")
      .single();

    expect(profile.error).toBeNull();
    expect(profile.data).toEqual({
      display_name: "First atomic profile",
      preferred_language: "en",
    });
    expect(reset.error).toBeNull();
    expect(reset.data).toEqual({
      calories: null,
      carbohydrates_g: null,
      fat_g: null,
      protein_g: null,
    });
    await context.close();
  });

  test("clears all targets atomically without leaking the earlier target", async ({
    browser,
  }) => {
    const earlierTarget = await userAClient.from("nutrition_targets").insert({
      calories: 2100,
      carbohydrates_g: 210,
      effective_from: "2028-02-01",
      fat_g: 70,
      protein_g: 110,
      user_id: userAId,
    });
    expect(earlierTarget.error).toBeNull();

    const context = await browser.newContext({ storageState: authenticatedState });
    const page = await context.newPage();
    await submitSetup(page, {
      date: "2028-03-01",
      displayName: "Profile and reset committed together",
      locale: "en",
      preferredLanguage: "en",
      targets: {},
    });

    const profile = await userAClient
      .from("profiles")
      .select("display_name")
      .eq("id", userAId)
      .single();
    const reset = await userAClient
      .from("nutrition_targets")
      .select("calories,protein_g,carbohydrates_g,fat_g")
      .eq("effective_from", "2028-03-01")
      .single();

    expect(profile.data?.display_name).toBe("Profile and reset committed together");
    expect(reset.data).toEqual({
      calories: null,
      carbohydrates_g: null,
      fat_g: null,
      protein_g: null,
    });

    await page.goto("/en/today?date=2028-02-15");
    await expect(page.getByTestId("target-summary")).toContainText("2100");
    await page.goto("/en/today?date=2028-03-15");
    await expect(
      page.getByRole("heading", {
        name: "No manual target is effective for this date",
      }),
    ).toBeVisible();
    await expect(page.getByTestId("target-summary")).toHaveCount(0);
    await context.close();
  });

  test("clears one field, preserves explicit zeros, and submits in Hebrew", async ({
    browser,
  }) => {
    const targetInsert = await userAClient.from("nutrition_targets").insert({
      calories: 1800,
      carbohydrates_g: 180,
      effective_from: "2028-04-01",
      fat_g: 50,
      protein_g: 90,
      user_id: userAId,
    });
    expect(targetInsert.error).toBeNull();

    const context = await browser.newContext({ storageState: authenticatedState });
    const page = await context.newPage();
    await page.goto("/he/setup?effectiveDate=2028-04-01");
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");

    await submitSetup(page, {
      date: "2028-04-01",
      displayName: "זרימה אטומית",
      locale: "he",
      preferredLanguage: "he",
      targets: {
        calories: "0",
        carbohydrates_g: "20",
        fat_g: "0",
      },
    });
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");

    const target = await userAClient
      .from("nutrition_targets")
      .select("calories,protein_g,carbohydrates_g,fat_g")
      .eq("effective_from", "2028-04-01")
      .single();
    expect(target.data).toEqual({
      calories: 0,
      carbohydrates_g: 20,
      fat_g: 0,
      protein_g: null,
    });
    await expect(page.getByTestId("target-summary")).toContainText("0");
    await context.close();
  });

  test("is idempotent and rolls back a profile update when the target fails", async () => {
    const first = await userAClient.rpc("persist_setup", rpcArgs());
    const second = await userAClient.rpc("persist_setup", rpcArgs());
    expect(first.error).toBeNull();
    expect(second.error).toBeNull();
    expect(second.data?.[0]?.target_id).toBe(first.data?.[0]?.target_id);

    const rows = await userAClient
      .from("nutrition_targets")
      .select("id", { count: "exact" })
      .eq("effective_from", "2028-05-01");
    expect(rows.error).toBeNull();
    expect(rows.count).toBe(1);

    const profileBefore = await userAClient
      .from("profiles")
      .select("display_name,preferred_language")
      .eq("id", userAId)
      .single();
    const failed = await userAClient.rpc(
      "persist_setup",
      rpcArgs({
        p_display_name: "THIS PROFILE CHANGE MUST ROLL BACK",
        p_effective_from: "2028-06-01",
        p_protein_g: 1_000_000,
      }),
    );
    expect(failed.error).not.toBeNull();

    const profileAfter = await userAClient
      .from("profiles")
      .select("display_name,preferred_language")
      .eq("id", userAId)
      .single();
    const failedTarget = await userAClient
      .from("nutrition_targets")
      .select("id", { count: "exact" })
      .eq("effective_from", "2028-06-01");

    expect(profileAfter.data).toEqual(profileBefore.data);
    expect(failedTarget.count).toBe(0);
  });

  test("rejects unauthenticated execution and cannot affect another user", async () => {
    const userBProfileBefore = await userBClient
      .from("profiles")
      .select("display_name,preferred_language")
      .eq("id", userBId)
      .single();
    const userBTargetBefore = await userBClient
      .from("nutrition_targets")
      .select("calories")
      .eq("effective_from", "2028-08-01")
      .single();

    const userAWrite = await userAClient.rpc(
      "persist_setup",
      rpcArgs({
        p_calories: 1234,
        p_display_name: "User A remains the derived owner",
        p_effective_from: "2028-08-01",
      }),
    );
    expect(userAWrite.error).toBeNull();

    const userBProfileAfter = await userBClient
      .from("profiles")
      .select("display_name,preferred_language")
      .eq("id", userBId)
      .single();
    const userBTargetAfter = await userBClient
      .from("nutrition_targets")
      .select("calories")
      .eq("effective_from", "2028-08-01")
      .single();

    expect(userBProfileAfter.data).toEqual(userBProfileBefore.data);
    expect(userBTargetAfter.data).toEqual(userBTargetBefore.data);
    expect(userBTargetAfter.data?.calories).toBe(7777);
    expect(userAId).not.toBe(userBId);

    const anonymousClient = localClient();
    const anonymous = await anonymousClient.rpc(
      "persist_setup",
      rpcArgs({ p_effective_from: "2028-07-01" }),
    );
    expect(anonymous.data).toBeNull();
    expect(anonymous.error).not.toBeNull();
  });
});
