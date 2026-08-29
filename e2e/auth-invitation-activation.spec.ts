import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import {
  expect,
  test,
  type Browser,
  type BrowserContext,
  type Page,
} from "@playwright/test";
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
const accountAccessRequiredTables = [
  "custom_food_creation_requests",
  "diary_entries",
  "food_aliases",
  "food_barcodes",
  "food_favorites",
  "food_nutrients",
  "foods",
  "manual_diary_entry_requests",
  "nutrition_targets",
  "profiles",
  "recipe_diary_runs",
  "recipe_ingredients",
  "recipes",
  "saved_meal_diary_runs",
  "saved_meal_items",
  "saved_meals",
] as const;
const intentionallyLifecycleTables = [
  "account_activations",
  "account_closures",
  "food_sources",
  "nutrients",
] as const;
const accountAccessRequiredRpcs = [
  "private.insert_completed_custom_food_creation_request(uuid, jsonb, uuid)|DEFINER",
  "private.insert_completed_manual_diary_entry_request(uuid, jsonb, uuid)|DEFINER",
  "private.insert_new_owned_custom_food_barcode(uuid, text)|DEFINER",
  "private.lock_readable_food_for_diary_create(uuid)|DEFINER",
  "public.create_custom_food(uuid, text, text, text, text, numeric, text, jsonb, jsonb)|INVOKER",
  "public.create_manual_diary_entry(uuid, date, text, uuid, text, text, numeric, text, integer, numeric, numeric, numeric, text)|INVOKER",
  "public.get_owned_custom_food_editor(uuid)|INVOKER",
  "public.get_owned_recipe_editor(uuid)|INVOKER",
  "public.get_owned_recipe_use_contract(uuid, numeric)|INVOKER",
  "public.get_owned_saved_meal_editor(uuid)|INVOKER",
  "public.get_readable_food_diary_prefill(uuid)|INVOKER",
  "public.get_reusable_foods()|INVOKER",
  "public.log_recipe_to_diary(uuid, timestamp with time zone, numeric, date, text, uuid)|INVOKER",
  "public.log_saved_meal_to_diary(uuid, timestamp with time zone, date, text, uuid)|INVOKER",
  "public.lookup_readable_food_by_gtin(text)|INVOKER",
  "public.persist_custom_food(uuid, text, text, text, text, numeric, text, jsonb, jsonb)|INVOKER",
  "public.persist_custom_food(uuid, text, text, text, text, numeric, text, jsonb, jsonb, bigint)|INVOKER",
  "public.persist_custom_food_with_barcode(text, text, text, text, text, numeric, text, jsonb, jsonb)|INVOKER",
  "public.persist_recipe(uuid, text, text, numeric, jsonb)|INVOKER",
  "public.persist_recipe(uuid, text, text, numeric, jsonb, bigint)|INVOKER",
  "public.persist_saved_meal(uuid, text, text, jsonb)|INVOKER",
  "public.persist_saved_meal(uuid, text, text, jsonb, bigint)|INVOKER",
  "public.persist_setup(text, text, date, integer, numeric, numeric, numeric)|INVOKER",
  "public.search_readable_foods(text)|INVOKER",
  "public.set_custom_food_archived(uuid, boolean)|INVOKER",
  "public.set_food_favorite(uuid, boolean)|INVOKER",
  "public.set_recipe_archived(uuid, boolean)|INVOKER",
  "public.set_saved_meal_archived(uuid, boolean)|INVOKER",
] as const;
const intentionallyLifecycleRpcs = [
  "public.close_current_account(uuid, text)|DEFINER",
  "public.complete_invited_account_activation(boolean, boolean)|DEFINER",
  "public.current_account_access_state()|INVOKER",
  "public.is_current_account_access_allowed()|INVOKER",
  "public.is_current_account_activated()|INVOKER",
  "public.is_current_account_closed()|INVOKER",
  "public.is_valid_canonical_gtin(text)|INVOKER",
  "public.is_valid_food_canonical_gtin(text)|INVOKER",
  "public.normalize_food_search_text(text)|INVOKER",
  "public.prevent_diary_provenance_changes()|INVOKER",
  "public.set_updated_at()|INVOKER",
] as const;

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

function sessionFromAuthCookies(contextCookies: Awaited<ReturnType<BrowserContext["cookies"]>>) {
  const authCookies = contextCookies
    .filter((cookie) => cookie.name.includes("-auth-token"))
    .sort((left, right) => left.name.localeCompare(right.name));

  expect(authCookies.length).toBeGreaterThan(0);
  const encoded = authCookies.map((cookie) => cookie.value).join("");
  const serialized = encoded.startsWith("base64-")
    ? Buffer.from(encoded.slice("base64-".length), "base64url").toString(
        "utf8",
      )
    : decodeURIComponent(encoded);

  return JSON.parse(serialized) as {
    access_token: string;
    refresh_token: string;
  };
}

function sqlString(value: string) {
  return `'${escapedSqlLiteral(value)}'`;
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
  test("classifies every authenticated table and RPC and applies the canonical restrictive account-access gate", () => {
    const classifiedTables = JSON.parse(
      queryLocalAuthFixture(`
        select coalesce(json_agg(table_name order by table_name), '[]'::json)::text
        from (
          select relations.relname as table_name
          from pg_class as relations
          join pg_namespace as namespaces
            on namespaces.oid = relations.relnamespace
          where namespaces.nspname = 'public'
            and relations.relkind in ('r', 'p')
            and (
              has_table_privilege(
                'authenticated',
                relations.oid,
                'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER'
              )
              or has_any_column_privilege(
                'authenticated',
                relations.oid,
                'SELECT,INSERT,UPDATE,REFERENCES'
              )
            )
        ) as authenticated_tables;
      `),
    );
    expect(classifiedTables).toEqual(
      [...accountAccessRequiredTables, ...intentionallyLifecycleTables].sort(),
    );

    const restrictivelyGatedTables = JSON.parse(
      queryLocalAuthFixture(`
        select coalesce(json_agg(table_name order by table_name), '[]'::json)::text
        from (
          select relations.relname as table_name
          from pg_policy as policies
          join pg_class as relations on relations.oid = policies.polrelid
          join pg_namespace as namespaces
            on namespaces.oid = relations.relnamespace
          where namespaces.nspname = 'public'
            and policies.polname = 'account_access_required'
            and policies.polpermissive is false
            and policies.polcmd = '*'
            and policies.polqual is not null
            and policies.polwithcheck is not null
            and (
              select roles.oid
              from pg_roles as roles
              where roles.rolname = 'authenticated'
            ) = any(policies.polroles)
        ) as gated_tables;
      `),
    );
    expect(restrictivelyGatedTables).toEqual([...accountAccessRequiredTables]);

    const callableRpcs = JSON.parse(
      queryLocalAuthFixture(`
        select coalesce(json_agg(identity order by identity), '[]'::json)::text
        from (
          select distinct format(
            '%I.%I(%s)|%s',
            namespaces.nspname,
            procedures.proname,
            oidvectortypes(procedures.proargtypes),
            case when procedures.prosecdef then 'DEFINER' else 'INVOKER' end
          ) as identity
          from pg_proc as procedures
          join pg_namespace as namespaces
            on namespaces.oid = procedures.pronamespace
          where namespaces.nspname in ('public', 'private')
            and has_function_privilege(
              'authenticated',
              procedures.oid,
              'EXECUTE'
            )
        ) as authenticated_functions;
      `),
    );
    expect(callableRpcs).toEqual(
      [...accountAccessRequiredRpcs, ...intentionallyLifecycleRpcs].sort(),
    );

    expect(
      queryLocalAuthFixture(`
        select concat_ws(
          '|',
          procedures.prosecdef,
          array_to_string(procedures.proconfig, ','),
          has_function_privilege('public', procedures.oid, 'EXECUTE'),
          has_function_privilege('anon', procedures.oid, 'EXECUTE'),
          has_function_privilege('authenticated', procedures.oid, 'EXECUTE'),
          has_function_privilege('service_role', procedures.oid, 'EXECUTE')
        )
        from pg_proc as procedures
        where procedures.oid =
          'public.is_current_account_activated()'::regprocedure;
      `),
    ).toBe('f|search_path=""|f|f|t|f');
  });

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

  test("CJ-002 blocks direct protected table and RPC access until durable activation", async ({
    browser,
  }) => {
    const invitation = await newInvitation("en");
    const context = await browser.newContext({ javaScriptEnabled: false });
    const page = await context.newPage();

    await page.goto(invitation.link);
    await expect(page).toHaveURL("/en/auth/activate");
    expect(
      queryLocalAuthFixture(`
        select count(*) from public.account_activations
        where user_id = '${invitation.userId}'::uuid;
      `),
    ).toBe("0");

    const preActivation = localClient();
    const restored = await preActivation.auth.setSession(
      sessionFromAuthCookies(await context.cookies()),
    );
    expect(restored.error).toBeNull();
    expect(restored.data.user?.id).toBe(invitation.userId);

    const activationState = await preActivation.rpc(
      "is_current_account_activated",
    );
    expect(activationState).toMatchObject({ data: false, error: null });

    const directInsert = await preActivation.from("profiles").insert({
      id: invitation.userId,
      display_name: "Blocked pre-activation insert",
      preferred_language: "en",
      unit_system: "metric",
    });
    expect(directInsert.error?.code).toBe("42501");
    expect(
      queryLocalAuthFixture(`
        select count(*) from public.profiles
        where id = '${invitation.userId}'::uuid;
      `),
    ).toBe("0");

    queryLocalAuthFixture(`
      insert into public.profiles (
        id,
        display_name,
        preferred_language,
        unit_system
      ) values (
        '${invitation.userId}'::uuid,
        'Protected fixture profile',
        'en',
        'metric'
      );

      insert into public.nutrition_targets (
        user_id,
        effective_from,
        calories,
        protein_g,
        carbohydrates_g,
        fat_g
      ) values (
        '${invitation.userId}'::uuid,
        '2026-08-27',
        1900,
        100,
        180,
        60
      );
    `);

    const protectedRead = await preActivation
      .from("profiles")
      .select("id, display_name")
      .eq("id", invitation.userId);
    expect(protectedRead.error).toBeNull();
    expect(protectedRead.data).toEqual([]);

    const protectedUpdate = await preActivation
      .from("profiles")
      .update({ display_name: "Blocked pre-activation update" })
      .eq("id", invitation.userId)
      .select("id");
    expect(protectedUpdate.error).toBeNull();
    expect(protectedUpdate.data).toEqual([]);

    const preActivationSetup = await preActivation.rpc("persist_setup", {
      p_calories: 2200,
      p_carbohydrates_g: 230,
      p_display_name: "Blocked pre-activation RPC",
      p_effective_from: "2026-08-27",
      p_fat_g: 75,
      p_preferred_language: "en",
      p_protein_g: 125,
    });
    expect(preActivationSetup.error?.code).toBe("42501");
    expect(
      JSON.parse(
        queryLocalAuthFixture(`
        select json_build_object(
          'display_name', profiles.display_name,
          'calories', targets.calories
        )::text
        from public.profiles as profiles
        join public.nutrition_targets as targets
          on targets.user_id = profiles.id
        where profiles.id = '${invitation.userId}'::uuid
          and targets.effective_from = '2026-08-27';
        `),
      ),
    ).toEqual({
      calories: 1900,
      display_name: "Protected fixture profile",
    });

    for (const definerInvocation of [
      "select private.insert_completed_custom_food_creation_request(null, null, null);",
      "select private.insert_completed_manual_diary_entry_request(null, null, null);",
      "select private.insert_new_owned_custom_food_barcode(null, null);",
      "select private.lock_readable_food_for_diary_create(null);",
    ]) {
      expect(() =>
        queryLocalAuthFixture(`
          select set_config(
            'request.jwt.claim.sub',
            ${sqlString(invitation.userId)},
            false
          );
          set role authenticated;
          ${definerInvocation}
        `),
      ).toThrow(/account_access_required/);
    }

    await completeActivationForm(page, "en");
    await expect(page).toHaveURL(/\/en\/today(?:\?|$)/);

    const activated = localClient();
    const activatedSignIn = await activated.auth.signInWithPassword({
      email: invitation.email,
      password: activatedPassword,
    });
    expect(activatedSignIn.error).toBeNull();
    expect(
      await activated.rpc("is_current_account_activated"),
    ).toMatchObject({ data: true, error: null });

    const activatedSetup = await activated.rpc("persist_setup", {
      p_calories: 2200,
      p_carbohydrates_g: 230,
      p_display_name: "Activated setup succeeds",
      p_effective_from: "2026-08-27",
      p_fat_g: 75,
      p_preferred_language: "en",
      p_protein_g: 125,
    });
    expect(activatedSetup.error).toBeNull();

    const activatedRead = await activated
      .from("profiles")
      .select("id, display_name")
      .eq("id", invitation.userId)
      .single();
    expect(activatedRead).toMatchObject({
      data: {
        display_name: "Activated setup succeeds",
        id: invitation.userId,
      },
      error: null,
    });

    const activatedUpdate = await activated
      .from("profiles")
      .update({ display_name: "Activated direct update succeeds" })
      .eq("id", invitation.userId)
      .select("id, display_name")
      .single();
    expect(activatedUpdate).toMatchObject({
      data: {
        display_name: "Activated direct update succeeds",
        id: invitation.userId,
      },
      error: null,
    });

    const activatedDefinerResult = queryLocalAuthFixture(`
      select set_config(
        'request.jwt.claim.sub',
        ${sqlString(invitation.userId)},
        false
      );
      set role authenticated;
      select private.lock_readable_food_for_diary_create(null);
    `);
    expect(activatedDefinerResult).toMatch(/f$/);
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
