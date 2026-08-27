import { provisionActivatedLocalUser } from "@/e2e/helpers/local-auth";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  expect,
  test,
  type Browser,
  type BrowserContext,
  type Page,
} from "@playwright/test";
import type { Database } from "@/lib/supabase/database.types";

const localSupabaseUrl = process.env.LOCAL_SUPABASE_URL;
const localSupabasePublishableKey = process.env.LOCAL_SUPABASE_PUBLISHABLE_KEY;
const localSupabaseFaultControlUrl =
  process.env.LOCAL_SUPABASE_FAULT_CONTROL_URL;
const localOnly = process.env.DATE_E2E_LOCAL_SUPABASE === "1";
const configuredAppUrl = new URL(
  process.env.PLAYWRIGHT_BASE_URL ??
    `http://127.0.0.1:${process.env.PLAYWRIGHT_PORT ?? "3100"}`,
);
configuredAppUrl.hostname = "localhost";
const localAppBaseUrl = configuredAppUrl.toString();
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

async function expireBrowserAuthSession(context: BrowserContext) {
  const authCookiePattern = /^sb-.*-auth-token(?:\.\d+)?$/;
  const authCookies = (await context.cookies()).filter(({ name }) =>
    authCookiePattern.test(name),
  );

  expect(authCookies.length).toBeGreaterThan(0);
  await context.clearCookies({ name: authCookiePattern });
  expect(
    (await context.cookies()).filter(({ name }) => authCookiePattern.test(name)),
  ).toEqual([]);
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
  const result = await provisionActivatedLocalUser(client, { email, password });

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
  await expect(page).toHaveURL(
    new RegExp(`/${locale}/today(?:\\?date=\\d{4}-\\d{2}-\\d{2})?$`),
  );
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

async function matchingRowCounts(
  client: SupabaseClient<Database>,
  foodName: string,
) {
  const [entries, requests] = await Promise.all([
    client
      .from("diary_entries")
      .select("id", { count: "exact", head: true })
      .eq("food_name", foodName),
    client
      .from("manual_diary_entry_requests")
      .select("id", { count: "exact", head: true })
      .contains("request_payload", { food_name: foodName }),
  ]);

  expect(entries.error).toBeNull();
  expect(requests.error).toBeNull();

  return {
    entries: entries.count ?? 0,
    requests: requests.count ?? 0,
  };
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
  test("CJ-004 signs in without JavaScript and binds only the authenticated tenant in English and Hebrew", async ({
    browser,
  }) => {
    const userA = await provisionUser("phase11c-auth-nojs-a");
    const userB = await provisionUser("phase11c-auth-nojs-b");
    const userAClient = await authenticatedClient(userA.email);
    const userBClient = await authenticatedClient(userB.email);
    const date = "2032-05-01";
    const userAMarker = "PHASE11C AUTH TENANT A PRIVATE";
    const userBMarker = "PHASE11C AUTH TENANT B PRIVATE";
    await addDiaryEntry(userAClient, userA.userId, userAMarker, date);
    await addDiaryEntry(userBClient, userB.userId, userBMarker, date);
    const beforeA = await applicationRowCounts(userAClient, userA.userId);
    const beforeB = await applicationRowCounts(userBClient, userB.userId);

    const cases = [
      {
        locale: "en" as const,
        dir: "ltr",
        email: userA.email,
        ownMarker: userAMarker,
        otherMarker: userBMarker,
      },
      {
        locale: "he" as const,
        dir: "rtl",
        email: userB.email,
        ownMarker: userBMarker,
        otherMarker: userAMarker,
      },
    ];

    for (const authCase of cases) {
      const context = await browser.newContext({ javaScriptEnabled: false });
      const page = await context.newPage();
      await signInThroughUi(
        page,
        authCase.locale,
        authCase.email,
        "?next=https%3A%2F%2Fexample.invalid%2Fprivate",
      );
      await expect(page.locator("html")).toHaveAttribute("lang", authCase.locale);
      await expect(page.locator("html")).toHaveAttribute("dir", authCase.dir);
      expect(page.url()).not.toContain("example.invalid");

      await page.goto(
        `/${authCase.locale}/today?date=${date}&user_id=${userB.userId}`,
      );
      await expect(page.getByText(authCase.ownMarker, { exact: true })).toBeVisible();
      await expect(page.getByText(authCase.otherMarker, { exact: true })).toHaveCount(0);
      await context.close();
    }

    expect(await applicationRowCounts(userAClient, userA.userId)).toEqual(beforeA);
    expect(await applicationRowCounts(userBClient, userB.userId)).toEqual(beforeB);
    await expectScopedDiaryIsolation(
      userAClient,
      userBClient,
      userBMarker,
      userB.userId,
    );
    await expectScopedDiaryIsolation(
      userBClient,
      userAClient,
      userAMarker,
      userA.userId,
    );
  });

  test("CJ-004 keeps no-JavaScript invalid credentials generic, localized, and non-mutating", async ({
    browser,
  }) => {
    const user = await provisionUser("phase11c-auth-nojs-invalid");
    const userClient = await authenticatedClient(user.email);
    const before = await applicationRowCounts(userClient, user.userId);
    const cases = [
      {
        locale: "en" as const,
        dir: "ltr",
        emailLabel: "Email",
        passwordLabel: "Password",
        submit: "Sign in",
        message:
          "We could not complete that auth request. Check the details and try again.",
      },
      {
        locale: "he" as const,
        dir: "rtl",
        emailLabel: "אימייל",
        passwordLabel: "סיסמה",
        submit: "כניסה",
        message:
          "לא הצלחנו להשלים את פעולת האימות. כדאי לבדוק את הפרטים ולנסות שוב.",
      },
    ];

    for (const authCase of cases) {
      for (const email of [
        user.email,
        uniqueEmail(`phase11c-auth-nojs-unknown-${authCase.locale}`),
      ]) {
        const context = await browser.newContext({ javaScriptEnabled: false });
        const page = await context.newPage();
        await page.goto(
          `/${authCase.locale}/auth/sign-in?next=%2F%2Fexample.invalid%2Fprivate`,
        );
        await page.getByLabel(authCase.emailLabel).fill(email);
        await page.getByLabel(authCase.passwordLabel).fill(`${password}-wrong`);
        await page.getByRole("button", { name: authCase.submit }).click();
        await expect(page.getByText(authCase.message, { exact: true })).toBeVisible();
        expect(new URL(page.url()).pathname).toBe(
          `/${authCase.locale}/auth/sign-in`,
        );
        expect(new URL(page.url()).hostname).toBe("127.0.0.1");
        await expect(page.locator("html")).toHaveAttribute("dir", authCase.dir);

        await page.goto(`/${authCase.locale}/today?date=2032-05-01`);
        await expect(page).toHaveURL(
          new RegExp(`/${authCase.locale}/auth/sign-in$`),
        );
        await context.close();
      }
    }

    expect(await applicationRowCounts(userClient, user.userId)).toEqual(before);
  });

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
        protectedLabel: "מעקב תזונתי ידני בחשבון מחובר",
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

  test("CJ-005 signs out one tenant without affecting another authenticated tenant session", async ({
    browser,
  }) => {
    const userA = await provisionUser("phase11c-signout-tenant-a");
    const userB = await provisionUser("phase11c-signout-tenant-b");
    const userAClient = await authenticatedClient(userA.email);
    const userBClient = await authenticatedClient(userB.email);
    const date = "2032-05-02";
    const userAMarker = "PHASE11C SIGNOUT TENANT A PRIVATE";
    const userBMarker = "PHASE11C SIGNOUT TENANT B PRIVATE";
    await addDiaryEntry(userAClient, userA.userId, userAMarker, date);
    await addDiaryEntry(userBClient, userB.userId, userBMarker, date);
    const beforeA = await applicationRowCounts(userAClient, userA.userId);
    const beforeB = await applicationRowCounts(userBClient, userB.userId);

    const contextA = await browser.newContext({
      baseURL: localAppBaseUrl,
      javaScriptEnabled: false,
    });
    const contextB = await browser.newContext({
      baseURL: localAppBaseUrl,
      javaScriptEnabled: false,
    });
    const pageA = await contextA.newPage();
    const pageB = await contextB.newPage();
    await signInThroughUi(pageA, "en", userA.email);
    await signInThroughUi(pageB, "en", userB.email);
    await pageA.goto(`/en/today?date=${date}&user_id=${userB.userId}`);
    await pageB.goto(`/en/today?date=${date}&user_id=${userA.userId}`);
    await expect(pageA.getByText(userAMarker, { exact: true })).toBeVisible();
    await expect(pageA.getByText(userBMarker, { exact: true })).toHaveCount(0);
    await expect(pageB.getByText(userBMarker, { exact: true })).toBeVisible();
    await expect(pageB.getByText(userAMarker, { exact: true })).toHaveCount(0);

    await pageA.getByRole("button", { name: "Sign out" }).click();
    await expect(pageA).toHaveURL(/\/en$/);
    await pageA.goto(`/en/today?date=${date}`);
    await expect(pageA).toHaveURL(/\/en\/auth\/sign-in$/);
    await expect(pageA.getByText(userAMarker, { exact: true })).toHaveCount(0);
    await expect(pageA.getByText(userBMarker, { exact: true })).toHaveCount(0);

    await pageB.reload();
    await expect(pageB).toHaveURL(
      new RegExp(`/en/today\\?date=${date}&user_id=${userA.userId}$`),
    );
    await expect(pageB.getByText(userBMarker, { exact: true })).toBeVisible();
    await expect(pageB.getByText(userAMarker, { exact: true })).toHaveCount(0);

    expect(await applicationRowCounts(userAClient, userA.userId)).toEqual(beforeA);
    expect(await applicationRowCounts(userBClient, userB.userId)).toEqual(beforeB);
    await expectScopedDiaryIsolation(
      userAClient,
      userBClient,
      userBMarker,
      userB.userId,
    );
    await contextA.close();
    await contextB.close();
  });

  test("CJ-006 provides a no-JavaScript localized reauthentication fallback without partial or cross-tenant writes", async ({
    browser,
  }) => {
    test.slow();
    const userA = await provisionUser("phase11c-expired-nojs-a");
    const userB = await provisionUser("phase11c-expired-nojs-b");
    const userAClient = await authenticatedClient(userA.email);
    const userBClient = await authenticatedClient(userB.email);
    const date = "2032-05-03";
    const attemptedEntry = "PHASE11C NOJS EXPIRED RETRY ENTRY";
    const otherTenantEntry = "PHASE11C NOJS OTHER TENANT SECRET";
    await addDiaryEntry(userBClient, userB.userId, otherTenantEntry, date);
    const beforeA = await applicationRowCounts(userAClient, userA.userId);
    const beforeB = await applicationRowCounts(userBClient, userB.userId);

    const signedInContext = await browser.newContext({ baseURL: localAppBaseUrl });
    const signedInPage = await signedInContext.newPage();
    await signInThroughUi(signedInPage, "en", userA.email);
    const storageState = await signedInContext.storageState();
    await signedInContext.close();

    const context = await browser.newContext({
      baseURL: localAppBaseUrl,
      javaScriptEnabled: false,
      storageState,
    });
    const page = await context.newPage();
    await page.goto(`/en/today?date=${date}`);
    await expect(page.getByText(otherTenantEntry, { exact: true })).toHaveCount(0);
    await page.locator('input[name="food_name"]').fill(attemptedEntry);
    await expireBrowserAuthSession(context);
    await page.getByRole("button", { name: "Add entry" }).click();

    await expect(page).toHaveURL(/\/en\/auth\/sign-in$/);
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
    await expect(page.getByText(otherTenantEntry, { exact: true })).toHaveCount(0);
    expect(await matchingRowCounts(userAClient, attemptedEntry)).toEqual({
      entries: 0,
      requests: 0,
    });
    expect(await applicationRowCounts(userAClient, userA.userId)).toEqual(beforeA);
    expect(await applicationRowCounts(userBClient, userB.userId)).toEqual(beforeB);
    const reauthenticationPath = new URL(page.url()).pathname;
    await context.close();

    const recoveryContext = await browser.newContext({
      baseURL: localAppBaseUrl,
      javaScriptEnabled: false,
    });
    const recoveryPage = await recoveryContext.newPage();
    await recoveryPage.goto(reauthenticationPath);
    await recoveryPage.getByLabel("Email").fill(userA.email);
    await recoveryPage.getByLabel("Password").fill(password);
    await recoveryPage.getByRole("button", { name: "Sign in" }).click();
    await expect(recoveryPage).toHaveURL(
      /\/en\/today(?:\?date=\d{4}-\d{2}-\d{2})?$/,
    );
    await recoveryPage.goto(`/en/today?date=${date}`);
    await expect(recoveryPage).toHaveURL(
      new RegExp(`/en/today\\?date=${date}$`),
    );
    const replaySentinelName = "sb-phase11c-replay-regression-auth-token";
    await recoveryContext.addCookies([
      {
        name: replaySentinelName,
        url: localAppBaseUrl,
        value: "must-not-be-replayed",
      },
    ]);
    await recoveryPage.locator('input[name="food_name"]').fill(attemptedEntry);
    const nativePostResponsePromise = recoveryPage.waitForResponse((response) => {
      const responseUrl = new URL(response.url());
      return (
        response.request().method() === "POST" &&
        responseUrl.pathname === "/en/today"
      );
    });
    await recoveryPage.getByRole("button", { name: "Add entry" }).click();
    const nativePostResponse = await nativePostResponsePromise;
    const setCookieHeaders = (await nativePostResponse.headersArray())
      .filter(({ name }) => name.toLowerCase() === "set-cookie")
      .map(({ value }) => value);
    expect(setCookieHeaders.join("\n")).not.toContain(`${replaySentinelName}=`);
    expect(await matchingRowCounts(userAClient, attemptedEntry)).toEqual({
      entries: 1,
      requests: 1,
    });
    await expect(recoveryPage).toHaveURL(
      new RegExp(`/en/today\\?date=${date}$`),
    );
    await expect(
      recoveryPage.getByText(attemptedEntry, { exact: true }),
    ).toBeVisible();
    await expectScopedDiaryIsolation(
      userAClient,
      userBClient,
      otherTenantEntry,
      userB.userId,
    );
    expect(await applicationRowCounts(userBClient, userB.userId)).toEqual(beforeB);
    await recoveryContext.close();

    const hebrewSignedInContext = await browser.newContext({
      baseURL: localAppBaseUrl,
    });
    const hebrewSignedInPage = await hebrewSignedInContext.newPage();
    await signInThroughUi(hebrewSignedInPage, "he", userA.email);
    const hebrewStorageState = await hebrewSignedInContext.storageState();
    await hebrewSignedInContext.close();
    const hebrewContext = await browser.newContext({
      baseURL: localAppBaseUrl,
      javaScriptEnabled: false,
      storageState: hebrewStorageState,
    });
    const hebrewPage = await hebrewContext.newPage();
    const hebrewAttempt = "PHASE11C NOJS HEBREW EXPIRED ENTRY";
    await hebrewPage.goto(`/he/today?date=${date}`);
    await hebrewPage.locator('input[name="food_name"]').fill(hebrewAttempt);
    await expireBrowserAuthSession(hebrewContext);
    await hebrewPage.getByRole("button", { name: "הוספת רשומה" }).click();
    await expect(hebrewPage).toHaveURL(/\/he\/auth\/sign-in$/);
    await expect(hebrewPage.locator("html")).toHaveAttribute("lang", "he");
    await expect(hebrewPage.locator("html")).toHaveAttribute("dir", "rtl");
    await expect(hebrewPage.getByText(otherTenantEntry, { exact: true })).toHaveCount(0);
    expect(await matchingRowCounts(userAClient, hebrewAttempt)).toEqual({
      entries: 0,
      requests: 0,
    });
    expect(await applicationRowCounts(userBClient, userB.userId)).toEqual(beforeB);
    await hebrewContext.close();
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
