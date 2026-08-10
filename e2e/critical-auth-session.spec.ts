import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  expect,
  test,
  type Browser,
  type Page,
} from "@playwright/test";
import type { Database } from "@/lib/supabase/database.types";

const localSupabaseUrl = process.env.LOCAL_SUPABASE_URL;
const localSupabasePublishableKey = process.env.LOCAL_SUPABASE_PUBLISHABLE_KEY;
const localSupabaseFaultControlUrl =
  process.env.LOCAL_SUPABASE_FAULT_CONTROL_URL;
const localOnly = process.env.DATE_E2E_LOCAL_SUPABASE === "1";
const password = "Phase11C1AuthPassword123!";

test.skip(
  !localOnly || !localSupabaseUrl || !localSupabasePublishableKey,
  "Critical auth/session tests require the local-only test runner.",
);

type Locale = "en" | "he";

function localClient() {
  const parsedUrl = new URL(localSupabaseUrl as string);

  if (parsedUrl.hostname !== "127.0.0.1" && parsedUrl.hostname !== "localhost") {
    throw new Error("Refusing to use a remote Supabase API in auth/session tests.");
  }

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

function uniqueEmail(label: string) {
  return `${label}-${Date.now()}-${crypto.randomUUID()}@example.test`;
}

async function armNextSignOutFailure() {
  expect(localSupabaseFaultControlUrl).toBeTruthy();
  const controlUrl = new URL(localSupabaseFaultControlUrl as string);

  expect(["127.0.0.1", "localhost"]).toContain(controlUrl.hostname);
  const response = await fetch(controlUrl, { method: "POST" });
  expect(response.status).toBe(204);
}

async function provisionUser(label: string) {
  const email = uniqueEmail(label);
  const client = localClient();
  const result = await client.auth.signUp({ email, password });

  expect(result.error).toBeNull();
  expect(result.data.session).not.toBeNull();
  expect(result.data.user?.id).toBeTruthy();

  const userId = result.data.user?.id as string;
  await client.auth.signOut();

  return { email, userId };
}

async function authenticatedClient(email: string) {
  const client = localClient();
  const result = await client.auth.signInWithPassword({ email, password });

  expect(result.error).toBeNull();
  expect(result.data.session).not.toBeNull();

  return client;
}

async function signInThroughUi(
  page: Page,
  locale: Locale,
  email: string,
  destination = "",
) {
  const labels =
    locale === "en"
      ? { email: "Email", password: "Password", submit: "Sign in" }
      : { email: "אימייל", password: "סיסמה", submit: "כניסה" };

  await page.goto(`/${locale}/auth/sign-in${destination}`);
  await page.getByLabel(labels.email).fill(email);
  await page.getByLabel(labels.password).fill(password);
  await page.getByRole("button", { name: labels.submit }).click();
  await expect(page).toHaveURL(new RegExp(`/${locale}/today\\?date=\\d{4}-\\d{2}-\\d{2}$`));
}

async function applicationRowCounts(
  client: SupabaseClient<Database>,
  userId: string,
) {
  const queries = await Promise.all([
    client.from("profiles").select("id", { count: "exact", head: true }).eq("id", userId),
    client
      .from("nutrition_targets")
      .select("user_id", { count: "exact", head: true })
      .eq("user_id", userId),
    client
      .from("diary_entries")
      .select("user_id", { count: "exact", head: true })
      .eq("user_id", userId),
    client
      .from("foods")
      .select("owner_user_id", { count: "exact", head: true })
      .eq("owner_user_id", userId),
    client
      .from("food_favorites")
      .select("user_id", { count: "exact", head: true })
      .eq("user_id", userId),
    client
      .from("saved_meals")
      .select("user_id", { count: "exact", head: true })
      .eq("user_id", userId),
    client
      .from("recipes")
      .select("user_id", { count: "exact", head: true })
      .eq("user_id", userId),
    client
      .from("food_barcodes")
      .select("scope_owner_user_id", { count: "exact", head: true })
      .eq("scope_owner_user_id", userId),
  ]);

  for (const query of queries) {
    expect(query.error).toBeNull();
  }

  return queries.map(({ count }) => count ?? 0);
}

async function openSignedInPage(
  browser: Browser,
  locale: Locale,
  email: string,
) {
  const context = await browser.newContext();
  const page = await context.newPage();
  await signInThroughUi(page, locale, email);
  return { context, page };
}

async function addDiaryEntry(
  client: SupabaseClient<Database>,
  userId: string,
  foodName: string,
  date: string,
) {
  const result = await client.from("diary_entries").insert({
    entry_date: date,
    food_name: foodName,
    meal_type: "breakfast",
    source: "manual",
    user_id: userId,
  });

  expect(result.error).toBeNull();
}

async function expectScopedDiaryIsolation(
  userAClient: SupabaseClient<Database>,
  userBClient: SupabaseClient<Database>,
  otherTenantEntry: string,
  userBId: string,
) {
  const hiddenFromUserA = await userAClient
    .from("diary_entries")
    .select("food_name, user_id")
    .eq("food_name", otherTenantEntry);
  expect(hiddenFromUserA.error).toBeNull();
  expect(hiddenFromUserA.data).toEqual([]);

  const visibleToUserB = await userBClient
    .from("diary_entries")
    .select("food_name, user_id")
    .eq("food_name", otherTenantEntry);
  expect(visibleToUserB.error).toBeNull();
  expect(visibleToUserB.data).toEqual([
    { food_name: otherTenantEntry, user_id: userBId },
  ]);
}

test.describe("Phase 11C1 critical auth and session acceptance", () => {
  test("CJ-004 signs an existing user in through English UI without application mutation or unsafe redirect", async ({
    page,
  }) => {
    const { email, userId } = await provisionUser("phase11c1-signin-en");
    const beforeClient = await authenticatedClient(email);
    const before = await applicationRowCounts(beforeClient, userId);

    await signInThroughUi(
      page,
      "en",
      email,
      "?next=https%3A%2F%2Fexample.invalid%2Fprivate",
    );
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
    await expect(page.locator("html")).toHaveAttribute("dir", "ltr");

    await page.goto("/en/auth/sign-in?next=//example.invalid/private");
    await expect(page).toHaveURL(/\/en\/today\?date=\d{4}-\d{2}-\d{2}$/);
    expect(page.url()).not.toContain("example.invalid");

    const afterClient = await authenticatedClient(email);
    expect(await applicationRowCounts(afterClient, userId)).toEqual(before);
    expect(before).toEqual([0, 0, 0, 0, 0, 0, 0, 0]);
  });

  test("CJ-004 keeps invalid-credential responses enumeration-safe in English and Hebrew RTL", async ({
    browser,
  }) => {
    const { email, userId } = await provisionUser("phase11c1-signin-invalid");
    const cases = [
      {
        locale: "en" as const,
        message:
          "We could not complete that auth request. Check the details and try again.",
        submit: "Sign in",
        emailLabel: "Email",
        passwordLabel: "Password",
        dir: "ltr",
      },
      {
        locale: "he" as const,
        message:
          "לא הצלחנו להשלים את פעולת האימות. כדאי לבדוק את הפרטים ולנסות שוב.",
        submit: "כניסה",
        emailLabel: "אימייל",
        passwordLabel: "סיסמה",
        dir: "rtl",
      },
    ];

    for (const authCase of cases) {
      const context = await browser.newContext();
      const page = await context.newPage();
      const attempts = [email, uniqueEmail("phase11c1-unknown")];

      for (const attemptedEmail of attempts) {
        await page.goto(`/${authCase.locale}/auth/sign-in`);
        await page.getByLabel(authCase.emailLabel).fill(attemptedEmail);
        await page.getByLabel(authCase.passwordLabel).fill(`${password}-wrong`);
        await page.getByRole("button", { name: authCase.submit }).click();
        await expect(page.getByText(authCase.message, { exact: true })).toBeVisible();
        await expect(page).toHaveURL(new RegExp(`/${authCase.locale}/auth/sign-in$`));
        await expect(page.locator("html")).toHaveAttribute("dir", authCase.dir);
      }

      await context.close();
    }

    const client = await authenticatedClient(email);
    expect(await applicationRowCounts(client, userId)).toEqual([0, 0, 0, 0, 0, 0, 0, 0]);
  });

  test("CJ-005 signs out through the English server-action UI without JavaScript, data loss, or history leakage", async ({
    browser,
  }) => {
    const { email, userId } = await provisionUser("phase11c1-signout-en");
    const dataClient = await authenticatedClient(email);
    const date = "2032-04-05";
    const privateEntry = "PHASE11C1 PRIVATE SIGNOUT ENTRY";
    await addDiaryEntry(dataClient, userId, privateEntry, date);
    const beforeCounts = await applicationRowCounts(dataClient, userId);
    expect(beforeCounts).toEqual([0, 0, 1, 0, 0, 0, 0, 0]);

    const signedIn = await openSignedInPage(browser, "en", email);
    const storageState = await signedIn.context.storageState();
    await signedIn.context.close();

    const context = await browser.newContext({ javaScriptEnabled: false, storageState });
    const firstPage = await context.newPage();
    const stalePage = await context.newPage();
    await firstPage.goto(`/en/today?date=${date}`);
    await stalePage.goto(`/en/today?date=${date}`);
    await expect(firstPage.getByText(privateEntry, { exact: true })).toBeVisible();
    await expect(stalePage.getByText(privateEntry, { exact: true })).toBeVisible();

    await firstPage.getByRole("button", { name: "Sign out" }).click();
    await expect(firstPage).toHaveURL(/\/en$/);
    await expect(firstPage.getByRole("button", { name: "Sign out" })).toHaveCount(0);

    await stalePage.getByRole("button", { name: "Sign out" }).click();
    await expect(stalePage).toHaveURL(/\/en$/);
    await expect(stalePage.getByRole("button", { name: "Sign out" })).toHaveCount(0);
    await stalePage.goto(`/en/today?date=${date}`);
    await expect(stalePage).toHaveURL(/\/en\/auth\/sign-in$/);
    await stalePage.goBack();
    await expect(stalePage.getByText(privateEntry, { exact: true })).toHaveCount(0);
    await stalePage.goForward();
    await expect(stalePage).toHaveURL(/\/en\/auth\/sign-in$/);
    await context.close();

    const verificationClient = await authenticatedClient(email);
    const preserved = await verificationClient
      .from("diary_entries")
      .select("food_name")
      .eq("food_name", privateEntry);
    expect(preserved.error).toBeNull();
    expect(preserved.data).toEqual([{ food_name: privateEntry }]);
    expect(await applicationRowCounts(verificationClient, userId)).toEqual(
      beforeCounts,
    );
  });

  test("CJ-005 signs out through the Hebrew RTL UI and preserves tenant data", async ({
    browser,
  }) => {
    const { email, userId } = await provisionUser("phase11c1-signout-he");
    const dataClient = await authenticatedClient(email);
    const date = "2032-04-06";
    const privateEntry = "PHASE11C1 HEBREW PRIVATE ENTRY";
    await addDiaryEntry(dataClient, userId, privateEntry, date);

    const { context, page } = await openSignedInPage(browser, "he", email);
    await page.goto(`/he/today?date=${date}`);
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    await expect(page.getByText(privateEntry, { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "יציאה" }).click();
    await expect(page).toHaveURL(/\/he$/);
    await page.goto(`/he/today?date=${date}`);
    await expect(page).toHaveURL(/\/he\/auth\/sign-in$/);
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    await expect(page.getByText(privateEntry, { exact: true })).toHaveCount(0);
    await context.close();

    const verificationClient = await authenticatedClient(email);
    const preserved = await verificationClient
      .from("diary_entries")
      .select("food_name")
      .eq("food_name", privateEntry);
    expect(preserved.data).toEqual([{ food_name: privateEntry }]);
  });

  test("CJ-005 keeps failed English and Hebrew sign-out honest without JavaScript and permits safe retry", async ({
    browser,
  }) => {
    test.slow();
    const cases = [
      {
        locale: "en" as const,
        dir: "ltr",
        protectedLabel: "Signed-in manual nutrition tracker",
        signOutLabel: "Sign out",
        error:
          "We could not sign you out. You are still signed in. Try again.",
        retryLabel: "Try signing out again",
      },
      {
        locale: "he" as const,
        dir: "rtl",
        protectedLabel: "מעקב תזונה ידני לחשבון מחובר",
        signOutLabel: "יציאה",
        error:
          "לא הצלחנו לנתק את החשבון. החשבון עדיין מחובר. כדאי לנסות שוב.",
        retryLabel: "ניסיון נוסף ליציאה",
      },
    ];

    for (const signOutCase of cases) {
      const { email, userId } = await provisionUser(
        `phase11c1-signout-failure-${signOutCase.locale}`,
      );
      const dataClient = await authenticatedClient(email);
      const date = signOutCase.locale === "en" ? "2032-04-17" : "2032-04-18";
      const privateEntry = `PHASE11C1 ${signOutCase.locale.toUpperCase()} FAILED SIGNOUT ENTRY`;
      await addDiaryEntry(dataClient, userId, privateEntry, date);
      const beforeCounts = await applicationRowCounts(dataClient, userId);
      expect(beforeCounts).toEqual([0, 0, 1, 0, 0, 0, 0, 0]);

      const signedIn = await openSignedInPage(
        browser,
        signOutCase.locale,
        email,
      );
      const storageState = await signedIn.context.storageState();
      await signedIn.context.close();

      const context = await browser.newContext({
        javaScriptEnabled: false,
        storageState,
      });
      const page = await context.newPage();
      const protectedUrl = `/${signOutCase.locale}/today?date=${date}`;
      await page.goto(protectedUrl);
      await expect(page.locator("html")).toHaveAttribute("dir", signOutCase.dir);
      await expect(
        page.getByText(signOutCase.protectedLabel, { exact: true }),
      ).toBeVisible();
      await expect(page.getByText(privateEntry, { exact: true })).toBeVisible();

      await armNextSignOutFailure();
      await page
        .getByRole("button", { name: signOutCase.signOutLabel })
        .click();

      await expect(page).toHaveURL(
        new RegExp(`/${signOutCase.locale}/sign-out-failed$`),
      );
      await expect(page.getByText(signOutCase.error, { exact: true })).toBeVisible();
      await expect(
        page.getByRole("button", { name: signOutCase.retryLabel }),
      ).toBeVisible();
      await expect(
        page.getByText(signOutCase.protectedLabel, { exact: true }),
      ).toBeVisible();
      await expect(
        page.getByText("Deterministic local sign-out failure", { exact: true }),
      ).toHaveCount(0);
      expect(await applicationRowCounts(dataClient, userId)).toEqual(beforeCounts);

      await page.goto(protectedUrl);
      await expect(page).toHaveURL(
        new RegExp(`/${signOutCase.locale}/today\\?date=${date}$`),
      );
      await expect(page.getByText(privateEntry, { exact: true })).toBeVisible();
      await page.goto(`/${signOutCase.locale}/sign-out-failed`);
      await expect(page.getByText(signOutCase.error, { exact: true })).toBeVisible();

      await page
        .getByRole("button", { name: signOutCase.retryLabel })
        .click();
      await expect(page).toHaveURL(new RegExp(`/${signOutCase.locale}$`));
      await expect(
        page.getByText(signOutCase.protectedLabel, { exact: true }),
      ).toHaveCount(0);

      await page.goto(protectedUrl);
      await expect(page).toHaveURL(
        new RegExp(`/${signOutCase.locale}/auth/sign-in$`),
      );
      await expect(page.getByText(privateEntry, { exact: true })).toHaveCount(0);
      await page.goBack();
      await expect(page.getByText(privateEntry, { exact: true })).toHaveCount(0);
      await page.goForward();
      await expect(page).toHaveURL(
        new RegExp(`/${signOutCase.locale}/auth/sign-in$`),
      );
      await context.close();

      const verificationClient = await authenticatedClient(email);
      expect(await applicationRowCounts(verificationClient, userId)).toEqual(
        beforeCounts,
      );
    }
  });

  test("CJ-006 rejects an expired-session English diary mutation and permits one safe reauthenticated retry", async ({
    browser,
  }) => {
    const userA = await provisionUser("phase11c1-expired-a");
    const userB = await provisionUser("phase11c1-expired-b");
    const userAClient = await authenticatedClient(userA.email);
    const userBClient = await authenticatedClient(userB.email);
    const date = "2032-04-07";
    const attemptedEntry = "PHASE11C1 EXPIRED RETRY ENTRY";
    const otherTenantEntry = "PHASE11C1 OTHER TENANT SECRET";
    await addDiaryEntry(userBClient, userB.userId, otherTenantEntry, date);

    const { context, page } = await openSignedInPage(browser, "en", userA.email);
    await page.goto(`/en/today?date=${date}`);
    await page.locator('input[name="food_name"]').fill(attemptedEntry);
    await context.clearCookies();
    await page.getByRole("button", { name: "Add entry" }).click();
    await expect(page.getByText("Sign in again before using the diary.", { exact: true })).toBeVisible();
    await expect(page.getByText(otherTenantEntry, { exact: true })).toHaveCount(0);
    await expectScopedDiaryIsolation(
      userAClient,
      userBClient,
      otherTenantEntry,
      userB.userId,
    );

    const failedRows = await userAClient
      .from("diary_entries")
      .select("food_name")
      .eq("food_name", attemptedEntry);
    expect(failedRows.error).toBeNull();
    expect(failedRows.data).toEqual([]);

    await signInThroughUi(page, "en", userA.email);
    await page.goto(`/en/today?date=${date}`);
    await page.locator('input[name="food_name"]').fill(attemptedEntry);
    await page.getByRole("button", { name: "Add entry" }).click();
    await expect(page.getByText(attemptedEntry, { exact: true })).toBeVisible();

    const retriedRows = await userAClient
      .from("diary_entries")
      .select("food_name")
      .eq("food_name", attemptedEntry);
    expect(retriedRows.error).toBeNull();
    expect(retriedRows.data).toEqual([{ food_name: attemptedEntry }]);
    await expectScopedDiaryIsolation(
      userAClient,
      userBClient,
      otherTenantEntry,
      userB.userId,
    );
    await context.close();
  });

  test("CJ-006 rejects an expired-session Hebrew RTL diary mutation without partial or cross-tenant disclosure", async ({
    browser,
  }) => {
    const userA = await provisionUser("phase11c1-expired-he-a");
    const userB = await provisionUser("phase11c1-expired-he-b");
    const userAClient = await authenticatedClient(userA.email);
    const userBClient = await authenticatedClient(userB.email);
    const date = "2032-04-08";
    const attemptedEntry = "PHASE11C1 HEBREW EXPIRED ENTRY";
    const otherTenantEntry = "PHASE11C1 HEBREW OTHER TENANT SECRET";
    await addDiaryEntry(userBClient, userB.userId, otherTenantEntry, date);

    const { context, page } = await openSignedInPage(browser, "he", userA.email);
    await page.goto(`/he/today?date=${date}`);
    await page.locator('input[name="food_name"]').fill(attemptedEntry);
    await context.clearCookies();
    await page.getByRole("button", { name: "הוספת רשומה" }).click();
    await expect(page.getByText("יש להיכנס שוב לפני שימוש ביומן.", { exact: true })).toBeVisible();
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    await expect(page.getByText(otherTenantEntry, { exact: true })).toHaveCount(0);
    await expectScopedDiaryIsolation(
      userAClient,
      userBClient,
      otherTenantEntry,
      userB.userId,
    );

    const rows = await userAClient
      .from("diary_entries")
      .select("food_name")
      .eq("food_name", attemptedEntry);
    expect(rows.error).toBeNull();
    expect(rows.data).toEqual([]);
    await context.close();
  });
});
