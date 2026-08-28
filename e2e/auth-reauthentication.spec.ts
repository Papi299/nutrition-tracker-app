import AxeBuilder from "@axe-core/playwright";
import { createClient } from "@supabase/supabase-js";
import {
  expect,
  test,
  type Browser,
  type BrowserContext,
  type Page,
} from "@playwright/test";
import {
  provisionActivatedLocalUserForUi,
  provisionInvitedIncompleteLocalUser,
  queryLocalAuthFixture,
  waitForLocalRecoveryLink,
} from "@/e2e/helpers/local-auth";
import { recentPasswordAuthCookieName } from "@/lib/auth/recent-password-auth-proof";
import type { Database } from "@/lib/supabase/database.types";

const localOnly = process.env.DATE_E2E_LOCAL_SUPABASE === "1";
const localSupabaseUrl = process.env.LOCAL_SUPABASE_URL;
const localSupabasePublishableKey = process.env.LOCAL_SUPABASE_PUBLISHABLE_KEY;
const faultControlUrl = process.env.LOCAL_SUPABASE_FAULT_CONTROL_URL;
const appOrigin = new URL(
  process.env.PLAYWRIGHT_BASE_URL ??
    `http://127.0.0.1:${process.env.PLAYWRIGHT_PORT ?? "3100"}`,
).origin;
const currentPassword = "Phase11E3CurrentPassword123!";
const replacementPassword = "Phase11E3ReplacementPassword456!";

test.skip(
  !localOnly || !localSupabaseUrl || !localSupabasePublishableKey,
  "Recent-password authentication tests require the local-only Supabase runner.",
);

function localClient() {
  const url = new URL(localSupabaseUrl as string);

  if (!["127.0.0.1", "localhost"].includes(url.hostname)) {
    throw new Error("Refusing to use remote Supabase in reauthentication tests.");
  }

  return createClient<Database>(
    localSupabaseUrl as string,
    localSupabasePublishableKey as string,
    {
      auth: {
        autoRefreshToken: false,
        detectSessionInUrl: false,
        persistSession: false,
      },
    },
  );
}

function uniqueCredentials(label: string, password = currentPassword) {
  return {
    email: `${label.slice(0, 20)}-${Date.now().toString(36)}-${crypto.randomUUID().slice(0, 8)}@example.test`,
    password,
  };
}

async function signInThroughUi(
  browser: Browser,
  locale: "en" | "he",
  credentials: { email: string; password: string },
  javaScriptEnabled = false,
) {
  const context = await browser.newContext({ javaScriptEnabled });
  const page = await context.newPage();
  const labels =
    locale === "en"
      ? { email: "Email", password: "Password", submit: "Sign in" }
      : { email: "אימייל", password: "סיסמה", submit: "כניסה" };

  await page.goto(`/${locale}/auth/sign-in`);
  await page.getByLabel(labels.email).fill(credentials.email);
  await page.getByLabel(labels.password).fill(credentials.password);
  await page.getByRole("button", { name: labels.submit }).click();

  return { context, page };
}

async function openReauthentication(page: Page, locale: "en" | "he") {
  await page.goto(`/${locale}/auth/reauthenticate`);
  await expect(page.getByRole("heading", {
    name:
      locale === "en"
        ? "Confirm your current password"
        : "אימות הסיסמה הנוכחית",
  })).toBeVisible();
}

async function submitPassword(
  page: Page,
  locale: "en" | "he",
  password: string,
) {
  const label = locale === "en" ? "Current password" : "הסיסמה הנוכחית";
  const submit = locale === "en" ? "Confirm password" : "אימות הסיסמה";

  await page.getByLabel(label).fill(password);
  await page.getByRole("button", { name: submit }).click();
}

function recentProofCookie(
  cookies: Awaited<ReturnType<BrowserContext["cookies"]>>,
) {
  return cookies.find((cookie) => cookie.name === recentPasswordAuthCookieName);
}

function sessionInventory(userId: string) {
  if (!/^[0-9a-f-]{36}$/i.test(userId)) {
    throw new Error("Invalid local user identifier.");
  }

  return JSON.parse(
    queryLocalAuthFixture(`
      select json_build_object(
        'sessions', (
          select count(*) from auth.sessions
          where user_id = '${userId}'::uuid
        ),
        'unrevoked_refresh_tokens', (
          select count(*) from auth.refresh_tokens
          where user_id::uuid = '${userId}'::uuid and revoked = false
        )
      )::text;
    `),
  ) as { sessions: number; unrevoked_refresh_tokens: number };
}

async function armFault(path: string) {
  if (!faultControlUrl) {
    throw new Error("Local Supabase fault control is unavailable.");
  }

  const url = new URL(path, faultControlUrl);

  if (!["127.0.0.1", "localhost"].includes(url.hostname)) {
    throw new Error("Refusing to use nonlocal Auth fault control.");
  }

  const response = await fetch(url, { method: "POST" });

  if (!response.ok) {
    throw new Error("Could not arm the local Auth fault.");
  }
}

async function setCopiedProof(
  context: BrowserContext,
  source: NonNullable<ReturnType<typeof recentProofCookie>>,
  value = source.value,
) {
  await context.addCookies([
    {
      domain: source.domain,
      expires: Math.floor(Date.now() / 1000) + 600,
      httpOnly: true,
      name: recentPasswordAuthCookieName,
      path: "/",
      sameSite: "Strict",
      secure: true,
      value,
    },
  ]);
}

test.describe.serial("Phase 11E3 recent password reauthentication", () => {
  test.describe.configure({ timeout: 120_000 });

  test("binds explicit password verification to the current activated user and exact session without JavaScript", async ({
    browser,
  }) => {
    const current = uniqueCredentials("phase11e3-current-user");
    const other = uniqueCredentials(
      "phase11e3-other-user",
      "Phase11E3OtherAccountPassword789!",
    );
    await provisionActivatedLocalUserForUi(current);
    await provisionActivatedLocalUserForUi(other);
    const primary = await signInThroughUi(browser, "en", current);
    const sameUserOtherSession = await signInThroughUi(browser, "en", current);
    await expect(primary.page).toHaveURL(/\/en\/today/);
    await expect(sameUserOtherSession.page).toHaveURL(/\/en\/today/);
    const userId = queryLocalAuthFixture(`
      select id::text from auth.users where email = '${current.email}';
    `);
    const before = sessionInventory(userId);

    expect(before).toEqual({ sessions: 2, unrevoked_refresh_tokens: 2 });
    await primary.page.goto(
      "/en/auth/reauthenticate?returnTo=https%3A%2F%2Fevil.example",
    );
    await expect(
      primary.page.getByRole("heading", {
        name: "Confirm your current password",
      }),
    ).toBeVisible();
    await expect(
      primary.page.locator(
        'input[name="email"], input[name="userId"], input[name="sessionId"], input[name="returnTo"]',
      ),
    ).toHaveCount(0);

    await primary.page.getByRole("button", { name: "Confirm password" }).click();
    await expect(
      primary.page.getByText("Enter your current password."),
    ).toBeVisible();
    await submitPassword(primary.page, "en", "wrong-password");
    await expect(
      primary.page.getByText(
        "We could not confirm that password. Check it and try again.",
      ),
    ).toBeVisible();
    await submitPassword(primary.page, "en", other.password);
    await expect(
      primary.page.getByText(
        "We could not confirm that password. Check it and try again.",
      ),
    ).toBeVisible();

    await primary.page.locator("form").evaluate((form) => {
      for (const [name, value] of [
        ["email", "attacker@example.test"],
        ["userId", "00000000-0000-4000-8000-000000000001"],
        ["sessionId", "00000000-0000-4000-8000-000000000002"],
        ["returnTo", "https://evil.example"],
      ]) {
        const field = document.createElement("input");
        field.name = name;
        field.type = "hidden";
        field.value = value;
        form.append(field);
      }
    });
    await submitPassword(primary.page, "en", current.password);
    await expect(primary.page).toHaveURL(/\/en\/today/);
    expect(primary.page.url()).not.toContain("evil.example");

    const cookie = recentProofCookie(await primary.context.cookies());
    expect(cookie).toBeDefined();
    expect(cookie).toMatchObject({
      httpOnly: true,
      path: "/",
      sameSite: "Strict",
      secure: true,
    });
    expect(cookie?.domain.startsWith(".")).toBe(false);
    expect((cookie?.expires ?? 0) - Date.now() / 1000).toBeGreaterThan(500);
    expect((cookie?.expires ?? 0) - Date.now() / 1000).toBeLessThanOrEqual(600);
    expect(
      await primary.page.evaluate(() => document.cookie),
    ).not.toContain(recentPasswordAuthCookieName);
    expect(sessionInventory(userId)).toEqual(before);

    await primary.page.goto("/en/auth/reauthenticate");
    await expect(primary.page).toHaveURL(/\/en\/today/);
    await setCopiedProof(sameUserOtherSession.context, cookie!);
    await openReauthentication(sameUserOtherSession.page, "en");
    await primary.page.goto("/he/auth/reauthenticate");
    await expect(primary.page).toHaveURL(/\/he\/today/);

    await primary.context.close();
    await sameUserOtherSession.context.close();
  });

  test("fails closed for tampering and does not carry proof across sign-out or a new session", async ({
    browser,
  }) => {
    const credentials = uniqueCredentials("phase11e3-tamper-session");
    await provisionActivatedLocalUserForUi(credentials);
    const signedIn = await signInThroughUi(browser, "en", credentials);
    await openReauthentication(signedIn.page, "en");
    await submitPassword(signedIn.page, "en", credentials.password);
    const validCookie = recentProofCookie(await signedIn.context.cookies());

    expect(validCookie).toBeDefined();
    const [version, payload, signature] = validCookie!.value.split(".");
    const tamperedPayload = `${payload[0] === "A" ? "B" : "A"}${payload.slice(1)}`;
    const tamperedSignature = `${signature[0] === "A" ? "B" : "A"}${signature.slice(1)}`;
    const variants = [
      `${version}.${tamperedPayload}.${signature}`,
      `${version}.${payload}.${tamperedSignature}`,
      `${version}.${payload}`,
      `v2.${payload}.${signature}`,
      "not.a.valid%proof",
      "x".repeat(1500),
    ];

    for (const value of variants) {
      await setCopiedProof(signedIn.context, validCookie!, value);
      await openReauthentication(signedIn.page, "en");
    }

    await setCopiedProof(signedIn.context, validCookie!);
    await signedIn.page.goto("/en/auth/reauthenticate");
    await expect(signedIn.page).toHaveURL(/\/en\/today/);
    await signedIn.page.getByRole("button", { name: "Sign out" }).click();
    await expect(signedIn.page).toHaveURL("/en");
    expect(recentProofCookie(await signedIn.context.cookies())).toBeUndefined();

    await signedIn.page.goto("/en/auth/sign-in");
    await signedIn.page.getByLabel("Email").fill(credentials.email);
    await signedIn.page.getByLabel("Password").fill(credentials.password);
    await signedIn.page.getByRole("button", { name: "Sign in" }).click();
    await expect(signedIn.page).toHaveURL(/\/en\/today/);
    expect(recentProofCookie(await signedIn.context.cookies())).toBeUndefined();
    await setCopiedProof(signedIn.context, validCookie!);
    await openReauthentication(signedIn.page, "en");
    await signedIn.context.close();
  });

  test("contains provider failures and identity mismatch while preserving primary and unrelated sessions", async ({
    browser,
  }) => {
    const credentials = uniqueCredentials("phase11e3-provider-fault");
    await provisionActivatedLocalUserForUi(credentials);
    const signedIn = await signInThroughUi(browser, "en", credentials);
    const secondSession = await signInThroughUi(browser, "en", credentials);
    const userId = queryLocalAuthFixture(`
      select id::text from auth.users where email = '${credentials.email}';
    `);
    const before = sessionInventory(userId);

    await armFault("/__phase11e3/password-failure");
    await openReauthentication(signedIn.page, "en");
    await submitPassword(signedIn.page, "en", credentials.password);
    await expect(
      signedIn.page.getByText(
        "We could not confirm that password. Check it and try again.",
      ),
    ).toBeVisible();
    expect(await signedIn.page.locator("body").innerText()).not.toMatch(
      /supabase|unexpected_failure|503|access_token|refresh_token|stack/i,
    );
    expect(recentProofCookie(await signedIn.context.cookies())).toBeUndefined();

    await armFault("/__phase11e3/identity-mismatch");
    await submitPassword(signedIn.page, "en", credentials.password);
    await expect(
      signedIn.page.getByText(
        "We could not confirm that password. Check it and try again.",
      ),
    ).toBeVisible();
    expect(recentProofCookie(await signedIn.context.cookies())).toBeUndefined();
    expect(sessionInventory(userId)).toEqual(before);

    await armFault("/__phase11c/signout-failure");
    await submitPassword(signedIn.page, "en", credentials.password);
    await expect(signedIn.page).toHaveURL(/\/en\/today/);
    expect(sessionInventory(userId)).toEqual(before);
    await secondSession.page.goto("/en/today");
    await expect(secondSession.page).toHaveURL(/\/en\/today/);

    await signedIn.context.close();
    await secondSession.context.close();
  });

  test("supports Hebrew without JavaScript and preserves the incomplete-invite activation and RLS boundary", async ({
    browser,
  }, testInfo) => {
    const activated = uniqueCredentials("phase11e3-he-activated");
    await provisionActivatedLocalUserForUi(activated);
    const signedIn = await signInThroughUi(browser, "he", activated);
    await openReauthentication(signedIn.page, "he");
    await expect(signedIn.page.locator("html")).toHaveAttribute("lang", "he");
    await expect(signedIn.page.locator("html")).toHaveAttribute("dir", "rtl");
    await expect(signedIn.page.getByLabel("הסיסמה הנוכחית")).toHaveAttribute(
      "autocomplete",
      "current-password",
    );
    const accessibilitySession = await signInThroughUi(
      browser,
      "he",
      activated,
      true,
    );
    await expect(accessibilitySession.page).toHaveURL(/\/he\/today/);
    await openReauthentication(accessibilitySession.page, "he");
    const accessibility = await new AxeBuilder({
      page: accessibilitySession.page,
    })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
      .analyze();
    await testInfo.attach("axe-reauthentication-he", {
      body: Buffer.from(JSON.stringify(accessibility.violations, null, 2)),
      contentType: "application/json",
    });
    expect(
      accessibility.violations.filter(
        (finding) =>
          finding.impact === "critical" || finding.impact === "serious",
      ),
    ).toEqual([]);
    await submitPassword(signedIn.page, "he", activated.password);
    await expect(signedIn.page).toHaveURL(/\/he\/today/);

    const incomplete = uniqueCredentials("phase11e3-he-incomplete");
    const incompleteClient = localClient();
    const provisioned = await provisionInvitedIncompleteLocalUser(
      incompleteClient,
      incomplete,
    );
    const incompleteUserId = provisioned.data.user?.id as string;
    const incompleteBrowser = await signInThroughUi(browser, "he", incomplete);
    await expect(incompleteBrowser.page).toHaveURL("/he/auth/activate");
    await incompleteBrowser.page.goto("/he/auth/reauthenticate");
    await expect(incompleteBrowser.page).toHaveURL("/he/auth/activate");
    expect(
      queryLocalAuthFixture(`
        select count(*) from public.account_activations
        where user_id = '${incompleteUserId}'::uuid;
      `),
    ).toBe("0");
    expect(await incompleteClient.rpc("is_current_account_activated")).toMatchObject({
      data: false,
      error: null,
    });
    const blockedWrite = await incompleteClient.from("profiles").insert({
      display_name: "Blocked E3 activation bypass",
      id: incompleteUserId,
      preferred_language: "he",
      unit_system: "metric",
    });
    expect(blockedWrite.error?.code).toBe("42501");
    expect(
      await incompleteClient.from("profiles").select("id").eq("id", incompleteUserId),
    ).toMatchObject({ data: [], error: null });
    expect(recentProofCookie(await incompleteBrowser.context.cookies())).toBeUndefined();

    await incompleteClient.auth.signOut({ scope: "local" });
    await accessibilitySession.context.close();
    await signedIn.context.close();
    await incompleteBrowser.context.close();
  });

  test("preserves P11E-E006 across real recovery and requires explicit new-password reauthentication", async ({
    browser,
  }) => {
    const credentials = uniqueCredentials("phase11e3-recovery-separation");
    await provisionActivatedLocalUserForUi(credentials);
    const authenticated = await signInThroughUi(browser, "en", credentials);
    await openReauthentication(authenticated.page, "en");
    await submitPassword(authenticated.page, "en", credentials.password);
    expect(recentProofCookie(await authenticated.context.cookies())).toBeDefined();

    const requestContext = await browser.newContext({ javaScriptEnabled: false });
    const requestPage = await requestContext.newPage();
    await requestPage.goto("/en/auth/recover");
    expect(recentProofCookie(await requestContext.cookies())).toBeUndefined();
    await requestPage.getByLabel("Email").fill(credentials.email);
    await requestPage
      .getByRole("button", { name: "Request recovery instructions" })
      .click();
    await expect(
      requestPage.getByText(
        "If an eligible account exists and this request can be processed, recovery instructions will be sent. Wait before trying again.",
      ),
    ).toBeVisible();
    expect(recentProofCookie(await requestContext.cookies())).toBeUndefined();
    const recoveryLink = await waitForLocalRecoveryLink(credentials.email);

    await authenticated.page.goto(recoveryLink);
    await expect(authenticated.page).toHaveURL("/en/auth/recover/reset");
    expect(recentProofCookie(await authenticated.context.cookies())).toBeDefined();
    await authenticated.page
      .getByLabel("New password", { exact: true })
      .fill(replacementPassword);
    await authenticated.page
      .getByLabel("Confirm new password", { exact: true })
      .fill(replacementPassword);
    await authenticated.page
      .getByRole("button", { name: "Update password" })
      .click();
    await expect(authenticated.page).toHaveURL(
      "/en/auth/sign-in?recovery=complete",
    );
    expect(recentProofCookie(await authenticated.context.cookies())).toBeUndefined();

    await authenticated.page.getByLabel("Email").fill(credentials.email);
    await authenticated.page.getByLabel("Password").fill(replacementPassword);
    await authenticated.page.getByRole("button", { name: "Sign in" }).click();
    await expect(authenticated.page).toHaveURL(/\/en\/today/);
    expect(recentProofCookie(await authenticated.context.cookies())).toBeUndefined();
    await openReauthentication(authenticated.page, "en");
    await submitPassword(authenticated.page, "en", replacementPassword);
    await expect(authenticated.page).toHaveURL(/\/en\/today/);
    expect(recentProofCookie(await authenticated.context.cookies())).toBeDefined();

    await authenticated.context.close();
    await requestContext.close();
  });

  test("keeps the E3 route free of redirect parameters and server-secret exposure", async ({
    page,
  }) => {
    expect(appOrigin).toMatch(/^http:\/\/(127\.0\.0\.1|localhost):\d+$/);
    const source = await fetch(new URL("/en/auth/reauthenticate", appOrigin), {
      redirect: "manual",
    });

    expect([303, 307]).toContain(source.status);
    expect(source.headers.get("location")).toBe("/en/auth/sign-in");
    expect(process.env.AUTH_REAUTH_PROOF_SECRET).toBeDefined();
    await page.goto("/en/auth/sign-in");
    expect(await page.content()).not.toContain("AUTH_REAUTH_PROOF_SECRET");
    expect(await page.content()).not.toContain(
      process.env.AUTH_REAUTH_PROOF_SECRET as string,
    );
  });
});
