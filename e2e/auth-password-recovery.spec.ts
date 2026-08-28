import { readFileSync } from "node:fs";
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
  expireLocalRecovery,
  issueLocalInvitation,
  provisionActivatedLocalUser,
  provisionInvitedIncompleteLocalUser,
  queryLocalAuthFixture,
  waitForLocalInvitationLink,
  waitForLocalRecoveryLink,
} from "@/e2e/helpers/local-auth";
import type { Database } from "@/lib/supabase/database.types";

const localOnly = process.env.DATE_E2E_LOCAL_SUPABASE === "1";
const localSupabaseUrl = process.env.LOCAL_SUPABASE_URL;
const localSupabasePublishableKey = process.env.LOCAL_SUPABASE_PUBLISHABLE_KEY;
const localSupabaseFaultControlUrl =
  process.env.LOCAL_SUPABASE_FAULT_CONTROL_URL;
const configuredAppOrigin = new URL(
  process.env.PLAYWRIGHT_BASE_URL ??
    `http://127.0.0.1:${process.env.PLAYWRIGHT_PORT ?? "3100"}`,
).origin;
const oldPassword = "Phase11E2OldPassword123!";
const newPassword = "Phase11E2NewPassword456!";
const replayPassword = "Phase11E2ReplayPassword789!";
const genericRequestResult = {
  en: "If an eligible account exists and this request can be processed, recovery instructions will be sent. Wait before trying again.",
  he: "אם קיים חשבון מתאים וניתן לעבד את הבקשה, יישלחו הוראות לשחזור הסיסמה. יש להמתין לפני ניסיון נוסף.",
} as const;

test.skip(
  !localOnly || !localSupabaseUrl || !localSupabasePublishableKey,
  "Password-recovery tests require the local-only Supabase runner.",
);

function localClient() {
  const parsedUrl = new URL(localSupabaseUrl as string);

  if (!["127.0.0.1", "localhost"].includes(parsedUrl.hostname)) {
    throw new Error("Refusing to use remote Supabase in recovery tests.");
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

function uniqueEmail(label: string) {
  return `${label.slice(0, 20)}-${Date.now().toString(36)}-${crypto.randomUUID().slice(0, 8)}@example.test`;
}

function escapedSqlLiteral(value: string) {
  return value.replaceAll("'", "''");
}

async function failNextLocalRecoveryRequest() {
  if (!localSupabaseFaultControlUrl) {
    throw new Error("Local Supabase fault control is unavailable.");
  }

  const controlUrl = new URL(
    "/__phase11e2/recovery-failure",
    localSupabaseFaultControlUrl,
  );

  if (!["127.0.0.1", "localhost"].includes(controlUrl.hostname)) {
    throw new Error("Refusing to use nonlocal recovery fault control.");
  }

  const response = await fetch(controlUrl, { method: "POST" });

  if (!response.ok) {
    throw new Error("Could not arm the local recovery failure.");
  }
}

async function requestRecovery(
  page: Page,
  locale: "en" | "he",
  email: string,
) {
  const labels =
    locale === "en"
      ? {
          email: "Email",
          recovery: "Forgot your password?",
          submit: "Request recovery instructions",
        }
      : {
          email: "אימייל",
          recovery: "שכחתם את הסיסמה?",
          submit: "בקשת הוראות לשחזור",
        };

  await page.goto(`/${locale}/auth/sign-in`);
  await page.getByRole("link", { name: labels.recovery }).click();
  await expect(page).toHaveURL(`/${locale}/auth/recover`);
  await page.getByLabel(labels.email).fill(email);
  await page.getByRole("button", { name: labels.submit }).click();
  await expect(page.getByText(genericRequestResult[locale])).toBeVisible();

  return page.locator("#recovery-request-status").innerText();
}

async function submitNewPassword(
  page: Page,
  locale: "en" | "he",
  password: string,
  confirmation = password,
) {
  const labels =
    locale === "en"
      ? {
          confirmation: "Confirm new password",
          password: "New password",
          submit: "Update password",
        }
      : {
          confirmation: "אימות הסיסמה החדשה",
          password: "סיסמה חדשה",
          submit: "עדכון הסיסמה",
        };

  await page.getByLabel(labels.password, { exact: true }).fill(password);
  await page.getByLabel(labels.confirmation, { exact: true }).fill(confirmation);
  await page.getByRole("button", { name: labels.submit }).click();
}

async function expectGenericRecoveryFailure(
  page: Page,
  locale: "en" | "he",
) {
  await expect(page).toHaveURL(`/${locale}/auth/recover/error`);
  await expect(page.locator("html")).toHaveAttribute("lang", locale);
  await expect(page.locator("html")).toHaveAttribute(
    "dir",
    locale === "en" ? "ltr" : "rtl",
  );
  const body = await page.locator("body").innerText();

  expect(body).not.toMatch(
    /supabase|token_hash|access_token|refresh_token|otp|stack|invalid user|expired/i,
  );
  expect(page.url()).not.toMatch(/token|redirect|next|user_id|email=/i);
}

async function signInThroughUi(
  browser: Browser,
  locale: "en" | "he",
  email: string,
  password: string,
) {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  const labels =
    locale === "en"
      ? { email: "Email", password: "Password", submit: "Sign in" }
      : { email: "אימייל", password: "סיסמה", submit: "כניסה" };

  await page.goto(`/${locale}/auth/sign-in`);
  await page.getByLabel(labels.email).fill(email);
  await page.getByLabel(labels.password).fill(password);
  await page.getByRole("button", { name: labels.submit }).click();

  return { context, page };
}

function applicationSnapshot(userIds: string[]) {
  const ids = userIds.map((id) => `'${id}'::uuid`).join(", ");

  return queryLocalAuthFixture(`
    select json_build_object(
      'activation', (
        select coalesce(json_agg(json_build_object(
          'user_id', user_id,
          'completed_at', activation_completed_at,
          'version', eligibility_statement_version,
          'accepted_at', eligibility_accepted_at
        ) order by user_id), '[]'::json)
        from public.account_activations where user_id in (${ids})
      ),
      'profiles', (
        select coalesce(json_agg(row_to_json(profiles) order by id), '[]'::json)
        from public.profiles where id in (${ids})
      ),
      'targets', (
        select coalesce(json_agg(row_to_json(targets) order by user_id, effective_from), '[]'::json)
        from public.nutrition_targets as targets where user_id in (${ids})
      ),
      'diary_count', (
        select count(*) from public.diary_entries where user_id in (${ids})
      ),
      'custom_food_count', (
        select count(*) from public.foods where owner_user_id in (${ids})
      ),
      'favorite_count', (
        select count(*) from public.food_favorites where user_id in (${ids})
      ),
      'saved_meal_count', (
        select count(*) from public.saved_meals where user_id in (${ids})
      ),
      'recipe_count', (
        select count(*) from public.recipes where user_id in (${ids})
      ),
      'invited_at', (
        select coalesce(json_agg(json_build_object(
          'id', id,
          'invited_at', invited_at
        ) order by id), '[]'::json)
        from auth.users where id in (${ids})
      )
    )::text;
  `);
}

async function expectPasswordSignIn(
  email: string,
  password: string,
  succeeds: boolean,
) {
  const client = localClient();
  const result = await client.auth.signInWithPassword({ email, password });

  if (succeeds) {
    expect(result.error).toBeNull();
    expect(result.data.user?.email).toBe(email);
    await client.auth.signOut({ scope: "local" });
  } else {
    expect(result.error).not.toBeNull();
    expect(result.data.user).toBeNull();
  }
}

function recoveryCookieMetadata(
  cookies: Awaited<ReturnType<BrowserContext["cookies"]>>,
  locale: "en" | "he",
) {
  const recoveryCookie = cookies.find(
    (cookie) => cookie.name === `nutrition_tracker_recovery_${locale}`,
  );

  return recoveryCookie
    ? {
        httpOnly: recoveryCookie.httpOnly,
        name: recoveryCookie.name,
        path: recoveryCookie.path,
        sameSite: recoveryCookie.sameSite,
      }
    : null;
}

test.describe.serial("Phase 11E2 password recovery", () => {
  test("CJ-007 is enumeration-safe, localized, rate-limit-safe, and non-mutating without JavaScript", async ({
    browser,
  }) => {
    const client = localClient();
    const knownEmail = uniqueEmail("phase11e2-known-request");
    const absentEmail = uniqueEmail("phase11e2-absent-request");
    const providerFailureEmail = uniqueEmail("phase11e2-provider-failure");
    const known = await provisionActivatedLocalUser(client, {
      email: knownEmail,
      password: oldPassword,
    });
    const userId = known.data.user?.id as string;
    await client.auth.signOut({ scope: "local" });
    const providerFailureUser = await provisionActivatedLocalUser(client, {
      email: providerFailureEmail,
      password: oldPassword,
    });
    const providerFailureUserId = providerFailureUser.data.user?.id as string;
    await client.auth.signOut({ scope: "local" });
    const before = applicationSnapshot([userId, providerFailureUserId]);
    const context = await browser.newContext({ javaScriptEnabled: false });
    const page = await context.newPage();

    const knownResult = await requestRecovery(page, "en", knownEmail);
    const firstRecoverySentAt = queryLocalAuthFixture(`
      select recovery_sent_at::text from auth.users
      where id = '${userId}'::uuid;
    `);
    expect(firstRecoverySentAt).not.toBe("");
    await page.getByLabel("Email").fill(knownEmail);
    await page
      .getByRole("button", { name: "Request recovery instructions" })
      .click();
    await expect(page.getByText(genericRequestResult.en)).toBeVisible();
    const repeatedResult = await page
      .locator("#recovery-request-status")
      .innerText();
    const secondRecoverySentAt = queryLocalAuthFixture(`
      select recovery_sent_at::text from auth.users
      where id = '${userId}'::uuid;
    `);
    expect(repeatedResult).toBe(knownResult);
    expect(secondRecoverySentAt).toBe(firstRecoverySentAt);
    await waitForLocalRecoveryLink(knownEmail);

    const absentResult = await requestRecovery(page, "en", absentEmail);
    expect(absentResult).toBe(knownResult);
    expect(
      queryLocalAuthFixture(`
        select count(*) from auth.users
        where email = '${escapedSqlLiteral(absentEmail)}';
      `),
    ).toBe("0");

    await failNextLocalRecoveryRequest();
    const providerFailureResult = await requestRecovery(
      page,
      "en",
      providerFailureEmail,
    );
    expect(providerFailureResult).toBe(knownResult);
    expect(
      queryLocalAuthFixture(`
        select coalesce(recovery_sent_at::text, '') from auth.users
        where id = '${providerFailureUserId}'::uuid;
      `),
    ).toBe("");

    await page.goto("/he/auth/recover");
    await page.getByLabel("אימייל").fill("not-an-email");
    await page.getByRole("button", { name: "בקשת הוראות לשחזור" }).click();
    await expect(page.getByText("יש להזין כתובת אימייל תקינה.")).toBeVisible();
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");

    expect(applicationSnapshot([userId, providerFailureUserId])).toBe(before);
    await context.close();
  });

  test("CJ-008 callback rejects malformed, duplicate, wrong-purpose, and hostile redirect inputs without disclosure", async ({
    browser,
  }) => {
    const context = await browser.newContext({ javaScriptEnabled: false });
    const page = await context.newPage();
    const invalidToken = "phase11e2_invalid_recovery_token";

    for (const path of [
      "/en/auth/recover/confirm",
      `/en/auth/recover/confirm?token_hash=${invalidToken}`,
      `/en/auth/recover/confirm?token_hash=${invalidToken}&type=invite`,
      `/en/auth/recover/confirm?token_hash=${invalidToken}&type=signup`,
      `/en/auth/recover/confirm?token_hash=${invalidToken}&type=magiclink`,
      `/en/auth/recover/confirm?token_hash=${invalidToken}&type=email_change`,
      `/en/auth/recover/confirm?token_hash=${invalidToken}&type=recovery&type=recovery`,
      `/en/auth/recover/confirm?token_hash=${invalidToken}&token_hash=other&type=recovery`,
      "/en/auth/recover/confirm?token_hash=bad%20hash&type=recovery",
      `/en/auth/recover/confirm?token_hash=${"a".repeat(513)}&type=recovery`,
    ]) {
      await page.goto(path);
      await expectGenericRecoveryFailure(page, "en");
    }

    await page.goto(
      `/he/auth/recover/confirm?token_hash=${invalidToken}&type=invite&next=${encodeURIComponent("https://example.com/private")}`,
    );
    await expectGenericRecoveryFailure(page, "he");
    expect(new URL(page.url()).origin).toBe(configuredAppOrigin);

    for (const hostileInput of [
      ["next", "https://example.com/private"],
      ["redirect", "//example.com/private"],
      ["returnTo", "javascript:alert(1)"],
      ["callback", encodeURIComponent("https://example.com/private")],
    ]) {
      const query = new URLSearchParams({
        [hostileInput[0]]: hostileInput[1],
        token_hash: invalidToken,
        type: "recovery",
      });
      await page.goto(`/en/auth/recover/confirm?${query}`);
      await expect(page).toHaveURL("/en/auth/recover/reset");
      expect(new URL(page.url()).origin).toBe(configuredAppOrigin);
      await submitNewPassword(page, "en", newPassword);
      await expectGenericRecoveryFailure(page, "en");
    }
    await context.close();
  });

  test("CJ-008 completes real local recovery for an activated user without JavaScript and preserves application state", async ({
    browser,
  }) => {
    const client = localClient();
    const email = uniqueEmail("phase11e2-activated");
    const provisioned = await provisionActivatedLocalUser(client, {
      email,
      password: oldPassword,
    });
    const userId = provisioned.data.user?.id as string;
    const setup = await client.rpc("persist_setup", {
      p_calories: 2100,
      p_carbohydrates_g: 230,
      p_display_name: "Recovery invariant profile",
      p_effective_from: "2026-08-27",
      p_fat_g: 70,
      p_preferred_language: "en",
      p_protein_g: 120,
    });
    expect(setup.error).toBeNull();

    const preexistingSession = client;
    await expectPasswordSignIn(email, oldPassword, true);
    const before = applicationSnapshot([userId]);
    const context = await browser.newContext({ javaScriptEnabled: false });
    const page = await context.newPage();

    await requestRecovery(page, "en", email);
    const recoveryLink = await waitForLocalRecoveryLink(email);
    const link = new URL(recoveryLink);
    expect(link.origin).toBe(configuredAppOrigin);
    expect(link.pathname).toBe("/en/auth/recover/confirm");
    expect(link.searchParams.get("type")).toBe("recovery");

    const response = await page.goto(recoveryLink);
    await expect(page).toHaveURL("/en/auth/recover/reset");
    expect(new URL(page.url()).search).toBe("");
    expect(response?.headers()["cache-control"]).toContain("no-store");
    expect(recoveryCookieMetadata(await context.cookies(), "en")).toEqual({
      httpOnly: true,
      name: "nutrition_tracker_recovery_en",
      path: "/en/auth/recover",
      sameSite: "Lax",
    });

    await submitNewPassword(page, "en", "short", "different");
    await expect(page.getByText("Password must be at least 6 characters.")).toBeVisible();
    expect(recoveryCookieMetadata(await context.cookies(), "en")).not.toBeNull();

    await submitNewPassword(page, "en", newPassword, replayPassword);
    await expect(page.getByText("The passwords do not match.")).toBeVisible();
    expect(recoveryCookieMetadata(await context.cookies(), "en")).not.toBeNull();

    await submitNewPassword(page, "en", newPassword);
    await expect(page).toHaveURL("/en/auth/sign-in?recovery=complete");
    await expect(
      page.getByText("Your password was updated. Sign in with the new password."),
    ).toBeVisible();
    expect(recoveryCookieMetadata(await context.cookies(), "en")).toBeNull();
    expect(
      (await context.cookies()).some(
        (cookie) =>
          cookie.name.startsWith("sb-") && cookie.name.includes("-auth-token"),
      ),
    ).toBe(false);

    await expectPasswordSignIn(email, oldPassword, false);
    await expectPasswordSignIn(email, newPassword, true);
    expect(applicationSnapshot([userId])).toBe(before);

    const priorSessionAfterReset = await preexistingSession.auth.getUser();
    expect(priorSessionAfterReset.error).not.toBeNull();
    expect(priorSessionAfterReset.data.user).toBeNull();
    expect(
      JSON.parse(
        queryLocalAuthFixture(`
          select json_build_object(
            'sessions', (
              select count(*) from auth.sessions where user_id = '${userId}'::uuid
            ),
            'unrevoked_refresh_tokens', (
              select count(*) from auth.refresh_tokens
              where user_id = '${userId}' and revoked is false
            )
          )::text;
        `),
      ),
    ).toEqual({ sessions: 0, unrevoked_refresh_tokens: 0 });

    const replayContext = await browser.newContext({ javaScriptEnabled: false });
    const replayPage = await replayContext.newPage();
    await replayPage.goto(recoveryLink);
    await expect(replayPage).toHaveURL("/en/auth/recover/reset");
    await submitNewPassword(replayPage, "en", replayPassword);
    await expectGenericRecoveryFailure(replayPage, "en");
    await expectPasswordSignIn(email, replayPassword, false);
    await expectPasswordSignIn(email, newPassword, true);
    expect(applicationSnapshot([userId])).toBe(before);
    await replayContext.close();
    await context.close();
  });

  test("CJ-008 rejects random, expired, and invitation-purpose provider tokens generically", async ({
    browser,
  }) => {
    const randomContext = await browser.newContext({ javaScriptEnabled: false });
    const randomPage = await randomContext.newPage();
    await randomPage.goto(
      "/en/auth/recover/confirm?token_hash=phase11e2_random_recovery_token&type=recovery",
    );
    await expect(randomPage).toHaveURL("/en/auth/recover/reset");
    await submitNewPassword(randomPage, "en", newPassword);
    await expectGenericRecoveryFailure(randomPage, "en");
    await randomContext.close();

    const expiredClient = localClient();
    const expiredEmail = uniqueEmail("phase11e2-expired");
    const expiredUser = await provisionActivatedLocalUser(expiredClient, {
      email: expiredEmail,
      password: oldPassword,
    });
    const expiredUserId = expiredUser.data.user?.id as string;
    await expiredClient.auth.signOut({ scope: "local" });
    const expiredContext = await browser.newContext({ javaScriptEnabled: false });
    const expiredPage = await expiredContext.newPage();
    await requestRecovery(expiredPage, "en", expiredEmail);
    const expiredLink = await waitForLocalRecoveryLink(expiredEmail);
    expireLocalRecovery(expiredUserId);
    await expiredPage.goto(expiredLink);
    await submitNewPassword(expiredPage, "en", newPassword);
    await expectGenericRecoveryFailure(expiredPage, "en");
    await expectPasswordSignIn(expiredEmail, oldPassword, true);
    await expectPasswordSignIn(expiredEmail, newPassword, false);
    await expiredContext.close();

    const invitationEmail = uniqueEmail("phase11e2-wrong-purpose");
    await issueLocalInvitation({
      appOrigin: configuredAppOrigin,
      email: invitationEmail,
      locale: "en",
    });
    const invitationLink = await waitForLocalInvitationLink(invitationEmail);
    const wrongPurposeLink = new URL(invitationLink);
    wrongPurposeLink.pathname = "/en/auth/recover/confirm";
    wrongPurposeLink.searchParams.set("type", "recovery");
    const invitationContext = await browser.newContext({ javaScriptEnabled: false });
    const invitationPage = await invitationContext.newPage();
    await invitationPage.goto(wrongPurposeLink.toString());
    await submitNewPassword(invitationPage, "en", newPassword);
    await expectGenericRecoveryFailure(invitationPage, "en");
    expect(
      queryLocalAuthFixture(`
        select count(*) from public.account_activations as activations
        join auth.users as users on users.id = activations.user_id
        where users.email = '${escapedSqlLiteral(invitationEmail)}';
      `),
    ).toBe("0");
    await invitationContext.close();
  });

  test("CJ-008 binds completion to recovery identity A, not caller input or authenticated identity B", async ({
    browser,
  }) => {
    const clientA = localClient();
    const emailA = uniqueEmail("phase11e2-identity-a");
    const userA = await provisionActivatedLocalUser(clientA, {
      email: emailA,
      password: oldPassword,
    });
    const userAId = userA.data.user?.id as string;
    await clientA.auth.signOut({ scope: "local" });

    const clientB = localClient();
    const emailB = uniqueEmail("phase11e2-identity-b");
    const userB = await provisionActivatedLocalUser(clientB, {
      email: emailB,
      password: oldPassword,
    });
    const userBId = userB.data.user?.id as string;
    await clientB.auth.signOut({ scope: "local" });
    const before = applicationSnapshot([userAId, userBId]);

    const requestContext = await browser.newContext({ javaScriptEnabled: false });
    const requestPage = await requestContext.newPage();
    await requestRecovery(requestPage, "en", emailA);
    const recoveryLink = new URL(await waitForLocalRecoveryLink(emailA));
    recoveryLink.searchParams.set("user_id", userBId);
    recoveryLink.searchParams.set("email", emailB);
    recoveryLink.searchParams.set("next", "https://example.com/private");

    const signedInB = await signInThroughUi(browser, "en", emailB, oldPassword);
    await expect(signedInB.page).toHaveURL(/\/en\/today(?:\?|$)/);
    await signedInB.page.goto("/en/auth/recover/reset");
    await expectGenericRecoveryFailure(signedInB.page, "en");

    await signedInB.page.goto(recoveryLink.toString());
    await expect(signedInB.page).toHaveURL("/en/auth/recover/reset");
    expect(new URL(signedInB.page.url()).origin).toBe(configuredAppOrigin);
    await submitNewPassword(signedInB.page, "en", newPassword);
    await expect(signedInB.page).toHaveURL(
      "/en/auth/sign-in?recovery=complete",
    );

    await expectPasswordSignIn(emailA, oldPassword, false);
    await expectPasswordSignIn(emailA, newPassword, true);
    await expectPasswordSignIn(emailB, oldPassword, true);
    await expectPasswordSignIn(emailB, newPassword, false);
    expect(applicationSnapshot([userAId, userBId])).toBe(before);
    await signedInB.context.close();
    await requestContext.close();
  });

  test("CJ-008 completes Hebrew recovery for an invited incomplete identity while activation and RLS remain closed", async ({
    browser,
  }) => {
    const client = localClient();
    const email = uniqueEmail("phase11e2-incomplete-he");
    const provisioned = await provisionInvitedIncompleteLocalUser(client, {
      email,
      password: oldPassword,
    });
    const userId = provisioned.data.user?.id as string;
    await client.auth.signOut({ scope: "local" });
    const before = applicationSnapshot([userId]);
    const context = await browser.newContext({ javaScriptEnabled: false });
    const page = await context.newPage();

    await requestRecovery(page, "he", email);
    const recoveryLink = await waitForLocalRecoveryLink(email);
    expect(new URL(recoveryLink).pathname).toBe("/he/auth/recover/confirm");
    await page.goto(recoveryLink);
    await expect(page).toHaveURL("/he/auth/recover/reset");
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    await submitNewPassword(page, "he", newPassword);
    await expect(page).toHaveURL("/he/auth/sign-in?recovery=complete");
    expect(applicationSnapshot([userId])).toBe(before);
    await context.close();

    const signedIn = await signInThroughUi(browser, "he", email, newPassword);
    await expect(signedIn.page).toHaveURL("/he/auth/activate");
    await signedIn.page.goto("/he/today");
    await expect(signedIn.page).toHaveURL("/he/auth/activate");
    expect(
      queryLocalAuthFixture(`
        select count(*) from public.account_activations
        where user_id = '${userId}'::uuid;
      `),
    ).toBe("0");

    const recoveredClient = localClient();
    const recovered = await recoveredClient.auth.signInWithPassword({
      email,
      password: newPassword,
    });
    expect(recovered.error).toBeNull();
    expect(await recoveredClient.rpc("is_current_account_activated")).toMatchObject({
      data: false,
      error: null,
    });
    const protectedInsert = await recoveredClient.from("profiles").insert({
      display_name: "Blocked recovery activation bypass",
      id: userId,
      preferred_language: "he",
      unit_system: "metric",
    });
    expect(protectedInsert.error?.code).toBe("42501");
    const protectedRead = await recoveredClient
      .from("profiles")
      .select("id")
      .eq("id", userId);
    expect(protectedRead).toMatchObject({ data: [], error: null });
    await recoveredClient.auth.signOut({ scope: "local" });
    expect(applicationSnapshot([userId])).toBe(before);

    const signupEmail = uniqueEmail("phase11e2-signup-still-closed");
    const signup = await localClient().auth.signUp({
      email: signupEmail,
      password: newPassword,
    });
    expect(signup.error).not.toBeNull();
    expect(
      queryLocalAuthFixture(`
        select count(*) from auth.users
        where email = '${escapedSqlLiteral(signupEmail)}';
      `),
    ).toBe("0");
    await signedIn.context.close();
  });

  test("recovery request and failure surfaces retain focused accessibility semantics", async ({
    page,
  }, testInfo) => {
    await page.goto("/en/auth/recover");
    await expect(page.getByRole("heading", { name: "Recover your password" })).toBeVisible();
    await expect(page.getByLabel("Email")).toHaveAttribute("autocomplete", "email");
    const requestScan = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
      .analyze();
    await testInfo.attach("axe-recovery-request", {
      body: Buffer.from(JSON.stringify(requestScan.violations, null, 2)),
      contentType: "application/json",
    });
    expect(
      requestScan.violations.filter(
        (finding) => finding.impact === "critical" || finding.impact === "serious",
      ),
    ).toEqual([]);

    await page.goto("/he/auth/recover/error");
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    const errorScan = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
      .analyze();
    await testInfo.attach("axe-recovery-error-he", {
      body: Buffer.from(JSON.stringify(errorScan.violations, null, 2)),
      contentType: "application/json",
    });
    expect(
      errorScan.violations.filter(
        (finding) => finding.impact === "critical" || finding.impact === "serious",
      ),
    ).toEqual([]);

    const config = readFileSync("supabase/config.toml", "utf8");
    const appActions = readFileSync(
      "app/[locale]/auth/recover/actions.ts",
      "utf8",
    );
    expect(config).toMatch(/^enable_signup = false$/m);
    expect(appActions).not.toMatch(/admin\.|service.?role|inviteUserByEmail/i);
  });
});
