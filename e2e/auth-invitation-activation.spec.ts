import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { expect, test, type Browser, type Page } from "@playwright/test";
import {
  expireLocalInvitation,
  issueLocalInvitation,
  provisionUnactivatedLocalUser,
  queryLocalAuthFixture,
  waitForLocalInvitationLink,
} from "@/e2e/helpers/local-auth";
import type { Database } from "@/lib/supabase/database.types";

const localOnly = process.env.DATE_E2E_LOCAL_SUPABASE === "1";
const localSupabaseUrl = process.env.LOCAL_SUPABASE_URL;
const localSupabasePublishableKey = process.env.LOCAL_SUPABASE_PUBLISHABLE_KEY;
const configuredAppOrigin = new URL(
  process.env.PLAYWRIGHT_BASE_URL ??
    `http://127.0.0.1:${process.env.PLAYWRIGHT_PORT ?? "3100"}`,
).origin;
const activatedPassword = "Phase11E1ActivatedPassword123!";
const existingPassword = "Phase11E1ExistingPassword123!";

test.skip(
  !localOnly || !localSupabaseUrl || !localSupabasePublishableKey,
  "Invitation and activation tests require the local-only Supabase runner.",
);

function localClient() {
  const parsedUrl = new URL(localSupabaseUrl as string);

  if (parsedUrl.hostname !== "127.0.0.1" && parsedUrl.hostname !== "localhost") {
    throw new Error("Refusing to use a remote Supabase API in activation tests.");
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

function escapedSqlLiteral(value: string) {
  return value.replaceAll("'", "''");
}

function tokenHashFromInvitation(link: string) {
  const tokenHash = new URL(link).searchParams.get("token_hash");

  expect(tokenHash).toBeTruthy();
  return tokenHash as string;
}

async function newInvitation(locale: "en" | "he") {
  const email = uniqueEmail(`phase11e1-invite-${locale}`);
  const { userId } = await issueLocalInvitation({
    appOrigin: configuredAppOrigin,
    email,
    locale,
  });
  const link = await waitForLocalInvitationLink(email);

  return { email, link, userId };
}

async function expectGenericConfirmationFailure(
  page: Page,
  locale: "en" | "he",
  path: string,
  forbiddenValues: string[] = [],
) {
  const response = await page.goto(path);

  await expect(page).toHaveURL(`/${locale}/auth/confirmation-error`);
  await expect(page.locator("html")).toHaveAttribute("lang", locale);
  await expect(page.locator("html")).toHaveAttribute(
    "dir",
    locale === "en" ? "ltr" : "rtl",
  );
  const body = await page.locator("body").innerText();

  expect(body).not.toMatch(/supabase|otp|token_hash|stack|expired|invalid user/i);
  for (const forbiddenValue of forbiddenValues) {
    expect(body).not.toContain(forbiddenValue);
    expect(page.url()).not.toContain(forbiddenValue);
  }
  expect(response?.headers()["cache-control"]).toContain("no-store");
}

async function completeActivationForm(
  page: Page,
  locale: "en" | "he",
  password = activatedPassword,
) {
  const labels =
    locale === "en"
      ? {
          age: "I confirm that I am 18 or older.",
          confirm: "Confirm password",
          israel:
            "I confirm that I meet the Israel participation boundary for this private beta.",
          password: "Password",
          submit: "Activate account",
        }
      : {
          age: "אני מאשר/ת שגילי 18 ומעלה.",
          confirm: "אימות סיסמה",
          israel:
            "אני מאשר/ת שאני עומד/ת בתנאי ההשתתפות בבטא הפרטית המוגבלת לישראל.",
          password: "סיסמה",
          submit: "הפעלת החשבון",
        };

  await page.getByLabel(labels.password, { exact: true }).fill(password);
  await page.getByLabel(labels.confirm, { exact: true }).fill(password);
  await page.getByLabel(labels.age, { exact: true }).check();
  await page.getByLabel(labels.israel, { exact: true }).check();
  await page.getByRole("button", { name: labels.submit, exact: true }).click();
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

test.describe.serial("Phase 11E1 invited activation and confirmation", () => {
  test("CJ-002 closes public enrollment while preserving the localized no-JavaScript invitation boundary", async ({
    browser,
  }) => {
    const config = readFileSync("supabase/config.toml", "utf8");
    const authSection = config.match(/\[auth\]([\s\S]*?)(?=\n\[|$)/)?.[1];
    const emailAuthSection = config.match(
      /\[auth\.email\]([\s\S]*?)(?=\n\[|$)/,
    )?.[1];
    const authActions = readFileSync("app/[locale]/auth/actions.ts", "utf8");
    const signupEmail = uniqueEmail("phase11e1-public-signup-denied");
    const client = localClient();
    const before = queryLocalAuthFixture(`
      select count(*) from auth.users
      where email = '${escapedSqlLiteral(signupEmail)}';
    `);

    expect(authSection).toMatch(/^enable_signup = false$/m);
    expect(emailAuthSection).toMatch(/^enable_signup = true$/m);
    expect(authActions).not.toMatch(/signUp|sign-up/i);

    for (const localeCase of [
      {
        dir: "ltr",
        heading: "Invitation-only private beta",
        locale: "en" as const,
        nav: "Private beta",
      },
      {
        dir: "rtl",
        heading: "בטא פרטית בהזמנה בלבד",
        locale: "he" as const,
        nav: "בטא פרטית",
      },
    ]) {
      const context = await browser.newContext({ javaScriptEnabled: false });
      const page = await context.newPage();

      await page.goto(`/${localeCase.locale}`);
      await page.getByRole("link", { name: localeCase.nav, exact: true }).click();
      await expect(page).toHaveURL(`/${localeCase.locale}/auth/sign-up`);
      await expect(
        page.getByRole("heading", { name: localeCase.heading, exact: true }),
      ).toBeVisible();
      await expect(page.locator("html")).toHaveAttribute("dir", localeCase.dir);
      await expect(page.locator("form")).toHaveCount(0);
      await expect(page.getByLabel(/email|אימייל/i)).toHaveCount(0);
      await context.close();
    }

    const signup = await client.auth.signUp({
      email: signupEmail,
      password: activatedPassword,
    });

    expect(signup.error).not.toBeNull();
    expect(signup.data.user).toBeNull();
    expect(signup.data.session).toBeNull();
    expect(
      queryLocalAuthFixture(`
        select count(*) from auth.users
        where email = '${escapedSqlLiteral(signupEmail)}';
      `),
    ).toBe(before);
    expect(
      queryLocalAuthFixture(`
        select count(*)
        from public.account_activations as activations
        join auth.users as users on users.id = activations.user_id
        where users.email = '${escapedSqlLiteral(signupEmail)}';
      `),
    ).toBe("0");
  });

  test("CJ-003 confirms a real local invite server-side without JavaScript and clears the token URL", async ({
    browser,
  }) => {
    const invitation = await newInvitation("en");
    const invitationUrl = new URL(invitation.link);

    expect(invitationUrl.origin).toBe(configuredAppOrigin);
    expect(invitationUrl.pathname).toBe("/en/auth/confirm");
    expect(invitationUrl.searchParams.get("type")).toBe("invite");
    expect(
      queryLocalAuthFixture(`
        select (invited_at is not null)::text
        from auth.users where id = '${invitation.userId}'::uuid;
      `),
    ).toBe("true");

    const context = await browser.newContext({ javaScriptEnabled: false });
    const page = await context.newPage();
    const response = await page.goto(invitation.link);

    await expect(page).toHaveURL("/en/auth/activate");
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
    await expect(page.locator("html")).toHaveAttribute("dir", "ltr");
    await expect(
      page.getByRole("heading", { name: "Complete account activation" }),
    ).toBeVisible();
    expect(page.url()).not.toContain("token_hash");
    expect(page.url()).not.toContain(tokenHashFromInvitation(invitation.link));
    expect(response?.headers()["cache-control"]).toContain("no-store");

    await page.goto("/en/today");
    await expect(page).toHaveURL("/en/auth/activate");
    await context.close();
  });

  test("CJ-002 validates attestations, completes Hebrew activation without JavaScript, and remains idempotent", async ({
    browser,
  }) => {
    const invitation = await newInvitation("he");
    const context = await browser.newContext({ javaScriptEnabled: false });
    const page = await context.newPage();

    await page.goto(invitation.link);
    await expect(page).toHaveURL("/he/auth/activate");
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");

    await page.getByLabel("סיסמה", { exact: true }).fill(activatedPassword);
    await page.getByLabel("אימות סיסמה", { exact: true }).fill("different-password");
    await page.getByLabel("אני מאשר/ת שגילי 18 ומעלה.").check();
    await page
      .getByLabel(
        "אני מאשר/ת שאני עומד/ת בתנאי ההשתתפות בבטא הפרטית המוגבלת לישראל.",
      )
      .check();
    await page.getByRole("button", { name: "הפעלת החשבון" }).click();
    await expect(page.getByText("הסיסמאות אינן תואמות.")).toBeVisible();
    expect(
      queryLocalAuthFixture(`
        select count(*) from public.account_activations
        where user_id = '${invitation.userId}'::uuid;
      `),
    ).toBe("0");

    await page.getByLabel("סיסמה", { exact: true }).fill(activatedPassword);
    await page.getByLabel("אימות סיסמה", { exact: true }).fill(activatedPassword);
    await page
      .getByLabel(
        "אני מאשר/ת שאני עומד/ת בתנאי ההשתתפות בבטא הפרטית המוגבלת לישראל.",
      )
      .check();
    await page.getByRole("button", { name: "הפעלת החשבון" }).click();
    await expect(
      page.getByText("יש לאשר את תנאי ההשתתפות לגיל 18 ומעלה."),
    ).toBeVisible();

    await page.getByLabel("סיסמה", { exact: true }).fill(activatedPassword);
    await page.getByLabel("אימות סיסמה", { exact: true }).fill(activatedPassword);
    await page.getByLabel("אני מאשר/ת שגילי 18 ומעלה.").check();
    await page.getByRole("button", { name: "הפעלת החשבון" }).click();
    await expect(
      page.getByText("יש לאשר את תנאי ההשתתפות המוגבלים לישראל."),
    ).toBeVisible();

    await completeActivationForm(page, "he");
    await expect(page).toHaveURL(/\/he\/today(?:\?|$)/);

    const activation = JSON.parse(
      queryLocalAuthFixture(`
        select json_build_object(
          'user_id', activations.user_id,
          'version', activations.eligibility_statement_version,
          'timestamps_match',
            activations.activation_completed_at = activations.eligibility_accepted_at,
          'server_timestamp',
            activations.activation_completed_at <= statement_timestamp(),
          'invited', users.invited_at is not null,
          'password_authenticated', exists (
            select 1
            from auth.sessions as sessions
            join auth.mfa_amr_claims as claims
              on claims.session_id = sessions.id
            where sessions.user_id = users.id
              and claims.authentication_method = 'password'
          ),
          'stale_otp_session', exists (
            select 1
            from auth.sessions as sessions
            join auth.mfa_amr_claims as claims
              on claims.session_id = sessions.id
            where sessions.user_id = users.id
              and claims.authentication_method = 'otp'
          )
        )
        from public.account_activations as activations
        join auth.users as users on users.id = activations.user_id
        where activations.user_id = '${invitation.userId}'::uuid;
      `),
    );

    expect(activation).toEqual({
      invited: true,
      password_authenticated: true,
      server_timestamp: true,
      stale_otp_session: false,
      timestamps_match: true,
      user_id: invitation.userId,
      version: "p11e-e001-private-beta-eligibility-v1",
    });

    const client = localClient();
    const signIn = await client.auth.signInWithPassword({
      email: invitation.email,
      password: activatedPassword,
    });
    expect(signIn.error).toBeNull();

    const beforeRetry = queryLocalAuthFixture(`
      select activation_completed_at::text || '|' || eligibility_accepted_at::text
      from public.account_activations
      where user_id = '${invitation.userId}'::uuid;
    `);
    const retry = await client.rpc("complete_invited_account_activation", {
      p_age_18_attested: true,
      p_israel_attested: true,
    });
    expect(retry.error).toBeNull();
    expect(
      queryLocalAuthFixture(`
        select count(*)::text || '|' ||
          min(activation_completed_at)::text || '|' ||
          min(eligibility_accepted_at)::text
        from public.account_activations
        where user_id = '${invitation.userId}'::uuid;
      `),
    ).toBe(`1|${beforeRetry}`);

    await page.goto("/he/auth/activate");
    await expect(page).toHaveURL(/\/he\/today(?:\?|$)/);
    await context.close();

    const signedInAgain = await signInThroughUi(
      browser,
      "he",
      invitation.email,
      activatedPassword,
    );
    await expect(signedInAgain.page).toHaveURL(/\/he\/today(?:\?|$)/);
    await signedInAgain.context.close();
  });

  test("CJ-003 keeps invalid, malformed, wrong-purpose, and external redirect inputs generic and same-origin without JavaScript", async ({
    browser,
  }) => {
    const context = await browser.newContext({ javaScriptEnabled: false });
    const page = await context.newPage();

    await expectGenericConfirmationFailure(page, "en", "/en/auth/confirm");
    await expectGenericConfirmationFailure(
      page,
      "en",
      "/en/auth/confirm?token_hash=bad%20hash&type=invite",
      ["bad hash"],
    );
    const invalidToken = "phase11e1-invalid-token-hash";
    await expectGenericConfirmationFailure(
      page,
      "en",
      `/en/auth/confirm?token_hash=${invalidToken}&type=invite`,
      [invalidToken],
    );

    for (const purpose of ["recovery", "signup", "magiclink", "email", "other"]) {
      await expectGenericConfirmationFailure(
        page,
        "he",
        `/he/auth/confirm?token_hash=${invalidToken}&type=${purpose}`,
        [invalidToken],
      );
    }

    for (const next of [
      "https://example.com",
      "//example.com",
      "%2F%2Fexample.com",
      "javascript:alert(1)",
    ]) {
      await expectGenericConfirmationFailure(
        page,
        "en",
        `/en/auth/confirm?token_hash=${invalidToken}&type=invite&next=${encodeURIComponent(next)}`,
        [invalidToken, "example.com"],
      );
      expect(new URL(page.url()).origin).toBe(configuredAppOrigin);
    }

    const safeInvitation = await newInvitation("en");
    const validWithHostileNext = new URL(safeInvitation.link);
    validWithHostileNext.searchParams.set("next", "https://example.com/private");
    await page.goto(validWithHostileNext.toString());
    await expect(page).toHaveURL("/en/auth/activate");
    expect(new URL(page.url()).origin).toBe(configuredAppOrigin);
    await context.close();
  });

  test("CJ-003 rejects expired and replayed invitation tokens without JavaScript or disclosure", async ({
    browser,
  }) => {
    const expired = await newInvitation("en");
    expireLocalInvitation(expired.userId);
    const expiredContext = await browser.newContext({ javaScriptEnabled: false });
    const expiredPage = await expiredContext.newPage();
    await expectGenericConfirmationFailure(
      expiredPage,
      "en",
      expired.link,
      [tokenHashFromInvitation(expired.link)],
    );
    await expiredContext.close();

    const replayed = await newInvitation("he");
    const firstContext = await browser.newContext({ javaScriptEnabled: false });
    const firstPage = await firstContext.newPage();
    await firstPage.goto(replayed.link);
    await expect(firstPage).toHaveURL("/he/auth/activate");

    const replayContext = await browser.newContext({ javaScriptEnabled: false });
    const replayPage = await replayContext.newPage();
    await expectGenericConfirmationFailure(
      replayPage,
      "he",
      replayed.link,
      [tokenHashFromInvitation(replayed.link)],
    );
    await firstContext.close();
    await replayContext.close();
  });

  test("CJ-002 gates incomplete identities, permits sign-out, and rejects unauthenticated or non-invited activation", async ({
    browser,
  }) => {
    const unauthenticated = localClient();
    const unauthenticatedAttempt = await unauthenticated.rpc(
      "complete_invited_account_activation",
      {
        p_age_18_attested: true,
        p_israel_attested: true,
      },
    );
    expect(unauthenticatedAttempt.error).not.toBeNull();

    const email = uniqueEmail("phase11e1-incomplete");
    const client = localClient();
    const provisioned = await provisionUnactivatedLocalUser(client, {
      email,
      password: existingPassword,
    });
    const userId = provisioned.data.user?.id as string;
    const nonInvitedAttempt = await client.rpc(
      "complete_invited_account_activation",
      {
        p_age_18_attested: true,
        p_israel_attested: true,
      },
    );
    expect(nonInvitedAttempt.error).not.toBeNull();
    expect(
      queryLocalAuthFixture(`
        select count(*) from public.account_activations
        where user_id = '${userId}'::uuid;
      `),
    ).toBe("0");
    await client.auth.signOut();

    const signedIn = await signInThroughUi(
      browser,
      "en",
      email,
      existingPassword,
    );
    await expect(signedIn.page).toHaveURL("/en/auth/activate");
    await signedIn.page.goto("/en/today");
    await expect(signedIn.page).toHaveURL("/en/auth/activate");
    await signedIn.page.getByRole("button", { name: "Sign out" }).click();
    await expect(signedIn.page).toHaveURL("/en");
    await signedIn.context.close();
  });

  test("CJ-002 requires password completion and cannot bind activation to another invited identity", async () => {
    const invitationA = await newInvitation("en");
    const invitationB = await newInvitation("en");
    const clientA = localClient();
    const verifiedA = await clientA.auth.verifyOtp({
      token_hash: tokenHashFromInvitation(invitationA.link),
      type: "invite",
    });
    expect(verifiedA.error).toBeNull();

    const beforePassword = await clientA.rpc(
      "complete_invited_account_activation",
      {
        p_age_18_attested: true,
        p_israel_attested: true,
      },
    );
    expect(beforePassword.error).not.toBeNull();

    const passwordUpdate = await clientA.auth.updateUser({
      password: activatedPassword,
    });
    expect(passwordUpdate.error).toBeNull();

    const withoutPasswordAuthentication = await clientA.rpc(
      "complete_invited_account_activation",
      {
        p_age_18_attested: true,
        p_israel_attested: true,
      },
    );
    expect(withoutPasswordAuthentication.error).not.toBeNull();

    await clientA.auth.signOut();
    const passwordSession = await clientA.auth.signInWithPassword({
      email: invitationA.email,
      password: activatedPassword,
    });
    expect(passwordSession.error).toBeNull();

    const forged = await clientA.rpc(
      "complete_invited_account_activation",
      {
        p_age_18_attested: true,
        p_israel_attested: true,
        p_user_id: invitationB.userId,
      } as never,
    );
    expect(forged.error).not.toBeNull();
    expect(
      queryLocalAuthFixture(`
        select count(*) from public.account_activations
        where user_id in (
          '${invitationA.userId}'::uuid,
          '${invitationB.userId}'::uuid
        );
      `),
    ).toBe("0");

    const completed = await clientA.rpc(
      "complete_invited_account_activation",
      {
        p_age_18_attested: true,
        p_israel_attested: true,
      },
    );
    expect(completed.error).toBeNull();
    expect(
      queryLocalAuthFixture(`
        select string_agg(user_id::text, ',' order by user_id)
        from public.account_activations
        where user_id in (
          '${invitationA.userId}'::uuid,
          '${invitationB.userId}'::uuid
        );
      `),
    ).toBe(invitationA.userId);
  });
});
