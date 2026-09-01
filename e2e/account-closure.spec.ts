import AxeBuilder from "@axe-core/playwright";
import { createHmac } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import {
  expect,
  test,
  type Browser,
  type BrowserContext,
  type Page,
} from "@playwright/test";
import {
  provisionActivatedLocalUser,
  provisionActivatedLocalUserForUi,
  provisionInvitedIncompleteLocalUser,
  queryLocalAuthFixture,
  waitForLocalRecoveryLink,
} from "@/e2e/helpers/local-auth";
import {
  accountClosureCapabilityIntent,
  accountClosurePolicyVersion,
  issueAccountClosureCapability,
} from "@/lib/account-closure/capability";
import {
  issueRecentPasswordAuthProof,
  recentPasswordAuthCookieName,
} from "@/lib/auth/recent-password-auth-proof";
import type { Database } from "@/lib/supabase/database.types";

const localOnly = process.env.DATE_E2E_LOCAL_SUPABASE === "1";
const localSupabaseUrl = process.env.LOCAL_SUPABASE_URL;
const localSupabasePublishableKey = process.env.LOCAL_SUPABASE_PUBLISHABLE_KEY;
const localSupabaseServiceRoleKey = process.env.LOCAL_SUPABASE_SERVICE_ROLE_KEY;
const capabilitySecret = process.env.ACCOUNT_CLOSURE_CAPABILITY_SECRET;
const faultControlUrl = process.env.LOCAL_SUPABASE_FAULT_CONTROL_URL;
const appOrigin = new URL(
  process.env.PLAYWRIGHT_BASE_URL ??
    `http://127.0.0.1:${process.env.PLAYWRIGHT_PORT ?? "3100"}`,
).origin;
const currentPassword = "Phase11E5CurrentPassword123!";
const replacementPassword = "Phase11E5ReplacementPassword456!";

test.skip(
  !localOnly ||
    !localSupabaseUrl ||
    !localSupabasePublishableKey ||
    !localSupabaseServiceRoleKey ||
    !capabilitySecret,
  "Account-closure tests require the local-only Supabase runner.",
);

function uniqueCredentials(label: string, password = currentPassword) {
  return {
    email: `${label.slice(0, 20)}-${Date.now().toString(36)}-${crypto.randomUUID().slice(0, 8)}@example.test`,
    password,
  };
}

function localClient() {
  const url = new URL(localSupabaseUrl as string);

  if (!["127.0.0.1", "localhost"].includes(url.hostname)) {
    throw new Error("Refusing to use remote Supabase in closure tests.");
  }

  return createClient<Database>(
    localSupabaseUrl as string,
    localSupabasePublishableKey as string,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}

function localAdminClient() {
  return createClient<Database>(
    localSupabaseUrl as string,
    localSupabaseServiceRoleKey as string,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}

function jwtClaims(accessToken: string) {
  const payload = accessToken.split(".")[1];
  return JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as {
    session_id: string;
    sub: string;
  };
}

function sessionFromAuthCookies(
  contextCookies: Awaited<ReturnType<BrowserContext["cookies"]>>,
) {
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

function signRawCapability(payload: string, secret: string) {
  const encoded = Buffer.from(payload).toString("base64url");
  const authenticated = `v1.${encoded}`;
  const signature = createHmac("sha256", secret)
    .update(authenticated)
    .digest("base64url");
  return `${authenticated}.${signature}`;
}

function signCapability(payload: Record<string, unknown>, secret: string) {
  return signRawCapability(JSON.stringify(payload), secret);
}

function capabilityForSession(
  accessToken: string,
  requestId = crypto.randomUUID(),
) {
  const claims = jwtClaims(accessToken);
  const nowSeconds = Math.floor(Date.now() / 1000);
  return {
    capability: issueAccountClosureCapability({
      e3ExpiresAt: nowSeconds + 600,
      nowSeconds,
      requestId,
      secret: capabilitySecret as string,
      sessionId: claims.session_id,
      userId: claims.sub,
    }),
    claims,
    requestId,
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

async function establishClosureProof(
  page: Page,
  locale: "en" | "he",
  password: string,
) {
  const copy =
    locale === "en"
      ? {
          link: "Confirm current password",
          password: "Current password",
          submit: "Confirm password",
        }
      : {
          link: "אימות הסיסמה הנוכחית",
          password: "הסיסמה הנוכחית",
          submit: "אימות הסיסמה",
        };

  await page.goto(`/${locale}/account/closure`);
  await page.getByRole("link", { name: copy.link }).click();
  await expect(page).toHaveURL(
    `/${locale}/auth/reauthenticate?intent=account-closure`,
  );
  await page.getByLabel(copy.password).fill(password);
  await page.getByRole("button", { name: copy.submit }).click();
  await expect(page).toHaveURL(`/${locale}/account/closure`);
}

function closureCount(userId: string) {
  return queryLocalAuthFixture(`
    select count(*)
    from public.account_closures
    where user_id = '${userId}'::uuid;
  `);
}

function productFingerprint(userId: string) {
  return queryLocalAuthFixture(`
    with owned_rows as (
      select 'account_activations' category, user_id::text row_id, to_jsonb(x)::text body
      from public.account_activations x where user_id = '${userId}'::uuid
      union all select 'profiles', id::text, to_jsonb(x)::text
      from public.profiles x where id = '${userId}'::uuid
      union all select 'nutrition_targets', id::text, to_jsonb(x)::text
      from public.nutrition_targets x where user_id = '${userId}'::uuid
      union all select 'diary_entries', id::text, to_jsonb(x)::text
      from public.diary_entries x where user_id = '${userId}'::uuid
      union all select 'foods', id::text, to_jsonb(x)::text
      from public.foods x where owner_user_id = '${userId}'::uuid
      union all select 'food_aliases', aliases.id::text, to_jsonb(aliases)::text
      from public.food_aliases aliases join public.foods foods on foods.id = aliases.food_id
      where foods.owner_user_id = '${userId}'::uuid
      union all select 'food_barcodes', barcodes.id::text, to_jsonb(barcodes)::text
      from public.food_barcodes barcodes join public.foods foods on foods.id = barcodes.food_id
      where foods.owner_user_id = '${userId}'::uuid
      union all select 'food_nutrients', nutrients.food_id::text || ':' || nutrients.nutrient_id::text, to_jsonb(nutrients)::text
      from public.food_nutrients nutrients join public.foods foods on foods.id = nutrients.food_id
      where foods.owner_user_id = '${userId}'::uuid
      union all select 'food_favorites', user_id::text || ':' || food_id::text, to_jsonb(x)::text
      from public.food_favorites x where user_id = '${userId}'::uuid
      union all select 'saved_meals', id::text, to_jsonb(x)::text
      from public.saved_meals x where user_id = '${userId}'::uuid
      union all select 'saved_meal_items', items.id::text, to_jsonb(items)::text
      from public.saved_meal_items items join public.saved_meals meals on meals.id = items.saved_meal_id
      where meals.user_id = '${userId}'::uuid
      union all select 'saved_meal_diary_runs', id::text, to_jsonb(x)::text
      from public.saved_meal_diary_runs x where user_id = '${userId}'::uuid
      union all select 'recipes', id::text, to_jsonb(x)::text
      from public.recipes x where user_id = '${userId}'::uuid
      union all select 'recipe_ingredients', ingredients.id::text, to_jsonb(ingredients)::text
      from public.recipe_ingredients ingredients join public.recipes recipes on recipes.id = ingredients.recipe_id
      where recipes.user_id = '${userId}'::uuid
      union all select 'recipe_diary_runs', id::text, to_jsonb(x)::text
      from public.recipe_diary_runs x where user_id = '${userId}'::uuid
      union all select 'manual_diary_entry_requests', id::text, to_jsonb(x)::text
      from public.manual_diary_entry_requests x where user_id = '${userId}'::uuid
      union all select 'custom_food_creation_requests', id::text, to_jsonb(x)::text
      from public.custom_food_creation_requests x where user_id = '${userId}'::uuid
    )
    select md5(coalesce(string_agg(category || '|' || row_id || '|' || body, E'\n'
      order by category, row_id), ''))
    from owned_rows;
  `);
}

function gtin14(seed: string) {
  const digits = seed.replace(/\D/g, "").padEnd(13, "7").slice(0, 13);
  const sum = [...digits].reduce(
    (total, digit, index) =>
      total + Number(digit) * ((13 - index) % 2 === 1 ? 3 : 1),
    0,
  );
  return `${digits}${(10 - (sum % 10)) % 10}`;
}

function seedRepresentativeProductData(userId: string) {
  const ids = Array.from({ length: 13 }, () => crypto.randomUUID());
  const [
    targetId,
    foodId,
    diaryId,
    savedMealId,
    savedItemId,
    savedRunId,
    savedDiaryId,
    recipeId,
    recipeItemId,
    recipeRunId,
    recipeDiaryId,
    manualRequestId,
    customRequestId,
  ] = ids;
  const barcode = gtin14(`${Date.now()}${Math.floor(Math.random() * 1000)}`);

  queryLocalAuthFixture(`
    begin;

    insert into public.profiles (id, display_name, preferred_language, unit_system)
    values ('${userId}', 'Closure invariant profile', 'en', 'metric');

    insert into public.nutrition_targets (
      id, user_id, effective_from, calories, protein_g, carbohydrates_g, fat_g
    ) values (
      '${targetId}', '${userId}', '2026-08-29', 0, null, 0, 70
    );

    insert into public.foods (
      id, owner_user_id, source_id, food_type, name, locale, serving_size,
      serving_unit, custom_nutrient_basis, data_quality, is_public, is_archived
    ) values (
      '${foodId}', '${userId}',
      (select id from public.food_sources where code = 'user_custom'),
      'user_custom', 'Closure custom food', 'en', 1, 'portion',
      'per_serving', 'user_provided', false, false
    );

    insert into public.food_aliases (food_id, alias_text, language_code)
    values ('${foodId}', 'Closure alias', 'en');

    insert into public.food_barcodes (
      food_id, canonical_gtin, provenance_source_id, verification_status
    ) values (
      '${foodId}', '${barcode}',
      (select id from public.food_sources where code = 'user_custom'),
      'user_asserted'
    );

    insert into public.food_nutrients (food_id, nutrient_id, amount, basis)
    values (
      '${foodId}',
      (select id from public.nutrients where code = 'energy_kcal'),
      0, 'per_serving'
    );

    insert into public.food_favorites (user_id, food_id)
    values ('${userId}', '${foodId}');

    insert into public.diary_entries (
      id, user_id, entry_date, meal_type, food_id, food_name,
      serving_quantity, serving_unit, calories, source
    ) values (
      '${diaryId}', '${userId}', '2026-08-29', 'breakfast', '${foodId}',
      'Closure diary snapshot', 0, 'portion', 0, 'manual'
    );

    insert into public.manual_diary_entry_requests (
      id, user_id, idempotency_key, request_payload,
      completed_diary_entry_id, live_diary_entry_id
    ) values (
      '${manualRequestId}', '${userId}', gen_random_uuid(), '{}'::jsonb,
      '${diaryId}', '${diaryId}'
    );

    insert into public.saved_meals (id, user_id, name, locale)
    values ('${savedMealId}', '${userId}', 'Closure saved meal', 'en');
    select set_config(
      'nutrition_tracker.saved_meal_revision_rpc_id',
      '${savedMealId}',
      true
    );
    insert into public.saved_meal_items (
      id, saved_meal_id, position, food_id, food_name, serving_quantity,
      serving_unit, calories
    ) values (
      '${savedItemId}', '${savedMealId}', 1, '${foodId}',
      'Closure saved snapshot', 0, 'portion', 0
    );

    insert into public.saved_meal_diary_runs (
      id, user_id, saved_meal_id, idempotency_key, source_updated_at,
      entry_date, meal_type, item_count
    ) values (
      '${savedRunId}', '${userId}', '${savedMealId}', gen_random_uuid(), now(),
      '2026-08-29', 'lunch', 1
    );
    insert into public.diary_entries (
      id, user_id, entry_date, meal_type, food_id, food_name,
      serving_quantity, serving_unit, calories, source,
      saved_meal_diary_run_id, saved_meal_item_position
    ) values (
      '${savedDiaryId}', '${userId}', '2026-08-29', 'lunch', '${foodId}',
      'Closure saved diary snapshot', 0, 'portion', 0, 'saved_meal',
      '${savedRunId}', 1
    );

    insert into public.recipes (id, user_id, name, locale, yield_servings)
    values ('${recipeId}', '${userId}', 'Closure recipe', 'en', 1);
    insert into public.recipe_ingredients (
      id, recipe_id, position, food_id, ingredient_name, quantity, unit, calories
    ) values (
      '${recipeItemId}', '${recipeId}', 1, '${foodId}',
      'Closure recipe snapshot', 1, 'portion', 0
    );
    insert into public.recipe_diary_runs (
      id, user_id, recipe_id, idempotency_key, source_updated_at,
      requested_servings, entry_date, meal_type
    ) values (
      '${recipeRunId}', '${userId}', '${recipeId}', gen_random_uuid(), now(),
      1, '2026-08-29', 'dinner'
    );
    insert into public.diary_entries (
      id, user_id, entry_date, meal_type, food_name, serving_quantity,
      serving_unit, calories, source, recipe_diary_run_id
    ) values (
      '${recipeDiaryId}', '${userId}', '2026-08-29', 'dinner',
      'Closure recipe diary snapshot', 1, 'serving', 0, 'recipe',
      '${recipeRunId}'
    );

    insert into public.custom_food_creation_requests (
      id, user_id, idempotency_key, request_payload, completed_food_id,
      live_food_id
    ) values (
      '${customRequestId}', '${userId}', gen_random_uuid(), '{}'::jsonb,
      '${foodId}', '${foodId}'
    );

    commit;
  `);
}

async function directClosurePost(
  context: BrowserContext,
  locale: "en" | "he",
  options: {
    crossOrigin?: boolean;
    duplicateConfirmation?: boolean;
    failureBeforeCommit?: boolean;
    ownerHint?: string;
  } = {},
) {
  const cookieHeader = (await context.cookies())
    .map(({ name, value }) => `${name}=${value}`)
    .join("; ");
  const body = new URLSearchParams();
  body.append("confirmClosure", "confirm-account-closure-v1");

  if (options.duplicateConfirmation) {
    body.append("confirmClosure", "confirm-account-closure-v1");
  }

  if (options.ownerHint) {
    body.append("account_id", options.ownerHint);
    body.append("owner", options.ownerHint);
    body.append("user_id", options.ownerHint);
  }

  const url = new URL(
    `/${locale}/account/closure/submit`,
    appOrigin,
  );

  if (options.ownerHint) {
    url.searchParams.set("account_id", options.ownerHint);
    url.searchParams.set("owner", options.ownerHint);
    url.searchParams.set("user_id", options.ownerHint);
  }

  return fetch(url, {
    body,
    headers: {
      cookie: cookieHeader,
      origin: options.crossOrigin ? "https://example.test" : appOrigin,
      "sec-fetch-site": options.crossOrigin ? "cross-site" : "same-origin",
      ...(options.ownerHint
        ? {
            "x-account-id": options.ownerHint,
            "x-owner": options.ownerHint,
            "x-user-id": options.ownerHint,
          }
        : {}),
      ...(options.failureBeforeCommit
        ? { "x-phase11e5-closure-fault": "before-commit" }
        : {}),
    },
    method: "POST",
    redirect: "manual",
  });
}

async function assertNoSeriousAxe(page: Page) {
  const scan = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
    .analyze();
  expect(
    scan.violations.filter(
      (finding) =>
        finding.impact === "critical" || finding.impact === "serious",
    ),
  ).toEqual([]);
}

async function requestRecovery(page: Page, email: string) {
  await page.goto("/en/auth/recover");
  await page.getByLabel("Email").fill(email);
  await page
    .getByRole("button", { name: "Request recovery instructions" })
    .click();
}

async function submitNewPassword(page: Page, password: string) {
  await page.getByLabel("New password", { exact: true }).fill(password);
  await page.getByLabel("Confirm new password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Update password" }).click();
}

test.describe.serial("Phase 11E5 account closure", () => {
  test.describe.configure({ timeout: 180_000 });

  test("verifies the TypeScript capability in PostgreSQL and rejects direct, cross-user, cross-session, malformed, and privileged attacks", async () => {
    const credentialsA = uniqueCredentials("phase11e5-db-a");
    const credentialsB = uniqueCredentials("phase11e5-db-b");
    const clientA = localClient();
    const clientB = localClient();
    const signedA = await provisionActivatedLocalUser(clientA, credentialsA);
    const signedB = await provisionActivatedLocalUser(clientB, credentialsB);
    const sessionA = signedA.data.session!;
    const userA = signedA.data.user!.id;
    const userB = signedB.data.user!.id;
    queryLocalAuthFixture(`
      insert into public.profiles (id, display_name, preferred_language, unit_system)
      values ('${userA}', 'Closure DB attack fixture', 'en', 'metric');
    `);

    const clientAOtherSession = localClient();
    const otherSession = await clientAOtherSession.auth.signInWithPassword(
      credentialsA,
    );
    expect(otherSession.error).toBeNull();

    const incompleteClient = localClient();
    const incomplete = await provisionInvitedIncompleteLocalUser(
      incompleteClient,
      uniqueCredentials("phase11e5-incomplete"),
    );
    const incompleteCapability = capabilityForSession(
      incomplete.data.session!.access_token,
    );
    const incompleteClosure = await incompleteClient.rpc(
      "close_current_account",
      {
        p_capability: incompleteCapability.capability,
        p_closure_request_id: incompleteCapability.requestId,
      },
    );
    expect(incompleteClosure.error).not.toBeNull();

    const valid = capabilityForSession(sessionA.access_token);
    const [version, encodedPayload, signature] = valid.capability.split(".");
    const forged = `${version}.${encodedPayload}.${signature[0] === "A" ? "B" : "A"}${signature.slice(1)}`;

    for (const capability of [
      "",
      forged,
      "v1.not-base64.not-base64",
      `v1.${"a".repeat(2100)}.signature`,
    ]) {
      const denied = await clientA.rpc("close_current_account", {
        p_capability: capability,
        p_closure_request_id: valid.requestId,
      });
      expect(denied.error).not.toBeNull();
    }

    const crossUser = await clientB.rpc("close_current_account", {
      p_capability: valid.capability,
      p_closure_request_id: valid.requestId,
    });
    expect(crossUser.error).not.toBeNull();
    const crossSession = await clientAOtherSession.rpc("close_current_account", {
      p_capability: valid.capability,
      p_closure_request_id: valid.requestId,
    });
    expect(crossSession.error).not.toBeNull();

    const now = Math.floor(Date.now() / 1000);
    const basePayload = {
      v: 1,
      sub: userA,
      sid: valid.claims.session_id,
      intent: accountClosureCapabilityIntent,
      rid: valid.requestId,
      policy: accountClosurePolicyVersion,
      iat: now,
      exp: now + 60,
    };

    for (const payload of [
      { ...basePayload, intent: "account-export" },
      { ...basePayload, policy: "wrong-policy" },
      { ...basePayload, sub: userB },
      { ...basePayload, sub: "not-a-uuid" },
      { ...basePayload, sid: jwtClaims(otherSession.data.session!.access_token).session_id },
      { ...basePayload, rid: crypto.randomUUID() },
      { ...basePayload, iat: now - 120, exp: now - 60 },
      // Stay beyond the allowed 30-second skew after preceding RPC assertions.
      { ...basePayload, iat: now + 60, exp: now + 90 },
      { ...basePayload, iat: now + 0.5 },
      { ...basePayload, unexpected: true },
      Object.fromEntries(
        Object.entries(basePayload).filter(([key]) => key !== "exp"),
      ),
    ]) {
      const denied = await clientA.rpc("close_current_account", {
        p_capability: signCapability(payload, capabilitySecret as string),
        p_closure_request_id: valid.requestId,
      });
      expect(denied.error).not.toBeNull();
    }

    const wrongSecret = await clientA.rpc("close_current_account", {
      p_capability: signCapability(basePayload, `${capabilitySecret}-wrong`),
      p_closure_request_id: valid.requestId,
    });
    expect(wrongSecret.error).not.toBeNull();
    const duplicateField = await clientA.rpc("close_current_account", {
      p_capability: signRawCapability(
        JSON.stringify(basePayload).replace(
          '"v":1,',
          '"v":1,"v":1,',
        ),
        capabilitySecret as string,
      ),
      p_closure_request_id: valid.requestId,
    });
    expect(duplicateField.error).not.toBeNull();
    expect(closureCount(userA)).toBe("0");

    const directInsert = await clientA.from("account_closures").insert({
      closure_policy_version: accountClosurePolicyVersion,
      closure_request_id: crypto.randomUUID(),
      user_id: userB,
    });
    expect(directInsert.error?.code).toBe("42501");
    const otherStatus = await clientA
      .from("account_closures")
      .select("closure_id")
      .eq("user_id", userB);
    expect(otherStatus).toMatchObject({ data: [], error: null });

    const first = capabilityForSession(sessionA.access_token);
    const second = capabilityForSession(sessionA.access_token);
    expect(
      queryLocalAuthFixture(`
        select private.verify_account_closure_capability(
          '${first.capability}',
          '${userA}'::uuid,
          '${first.claims.session_id}'::uuid,
          '${first.requestId}'::uuid,
          floor(extract(epoch from clock_timestamp()))::bigint
        );
      `),
    ).toBe("t");
    const concurrent = await Promise.all([
      clientA.rpc("close_current_account", {
        p_capability: first.capability,
        p_closure_request_id: first.requestId,
      }),
      clientA.rpc("close_current_account", {
        p_capability: second.capability,
        p_closure_request_id: second.requestId,
      }),
    ]);
    expect(
      concurrent.map((result) => ({
        code: result.error?.code ?? null,
        data: result.data,
        message: result.error?.message ?? null,
      })),
    ).toEqual([
      expect.objectContaining({ code: null }),
      expect.objectContaining({ code: null }),
    ]);
    expect(concurrent.map((result) => result.data?.[0]?.outcome).sort()).toEqual(
      ["already_closed", "closed"],
    );
    expect(closureCount(userA)).toBe("1");

    const replay = await clientA.rpc("close_current_account", {
      p_capability: first.capability,
      p_closure_request_id: first.requestId,
    });
    expect(replay.error).toBeNull();
    expect(replay.data?.[0]?.outcome).toBe("already_closed");
    expect(closureCount(userA)).toBe("1");

    expect(await clientA.rpc("is_current_account_activated")).toMatchObject({
      data: true,
      error: null,
    });
    expect(
      await clientA.rpc("is_current_account_access_allowed"),
    ).toMatchObject({ data: false, error: null });
    expect(await clientA.rpc("current_account_access_state")).toMatchObject({
      data: "closed",
      error: null,
    });
    expect(await clientB.rpc("current_account_access_state")).toMatchObject({
      data: "active",
      error: null,
    });

    const staleRead = await clientA
      .from("profiles")
      .select("display_name")
      .eq("id", userA);
    expect(staleRead).toMatchObject({ data: [], error: null });
    const staleInsert = await clientA.from("nutrition_targets").insert({
      effective_from: "2026-08-30",
      user_id: userA,
    });
    const staleUpdate = await clientA
      .from("profiles")
      .update({ display_name: "Blocked stale update" })
      .eq("id", userA)
      .select("id");
    const staleDelete = await clientA
      .from("profiles")
      .delete()
      .eq("id", userA)
      .select("id");
    expect(staleInsert.error?.code).toBe("42501");
    expect(staleUpdate).toMatchObject({ data: [], error: null });
    expect(staleDelete.error?.code).toBe("42501");
    const protectedRpc = await clientA.rpc("create_manual_diary_entry", {
      p_brand_name: "Blocked brand",
      p_calories: 0,
      p_carbohydrates_g: 0,
      p_entry_date: "2026-08-29",
      p_fat_g: 0,
      p_food_id: crypto.randomUUID(),
      p_food_name: "Blocked stale JWT",
      p_idempotency_key: crypto.randomUUID(),
      p_meal_type: "breakfast",
      p_notes: "Blocked",
      p_protein_g: 0,
      p_serving_quantity: 1,
      p_serving_unit: "g",
    });
    expect(protectedRpc.error).not.toBeNull();
    expect(() =>
      queryLocalAuthFixture(`
        select set_config('request.jwt.claim.sub', '${userA}', false);
        set role authenticated;
        select private.lock_readable_food_for_diary_create(null);
      `),
    ).toThrow(/account_access_required/);
    const activationReplay = await clientA.rpc(
      "complete_invited_account_activation",
      { p_age_18_attested: true, p_israel_attested: true },
    );
    expect(activationReplay.error).not.toBeNull();

    const closure = await clientA
      .from("account_closures")
      .select("closure_id")
      .single();
    expect(closure.error).toBeNull();
    const directUpdate = await clientA
      .from("account_closures")
      .update({ closure_policy_version: accountClosurePolicyVersion })
      .eq("closure_id", closure.data!.closure_id);
    const directDelete = await clientA
      .from("account_closures")
      .delete()
      .eq("closure_id", closure.data!.closure_id);
    expect(directUpdate.error?.code).toBe("42501");
    expect(directDelete.error?.code).toBe("42501");

    const hardDelete = await localAdminClient().auth.admin.deleteUser(userA);
    expect(hardDelete.error).not.toBeNull();
    expect(
      queryLocalAuthFixture(`
        select count(*) from auth.users where id = '${userA}'::uuid;
      `),
    ).toBe("1");
    expect(closureCount(userA)).toBe("1");
    expect(
      queryLocalAuthFixture(`
        select concat_ws('|',
          has_schema_privilege('authenticated', 'vault', 'USAGE'),
          has_table_privilege('authenticated', 'vault.secrets', 'SELECT'),
          has_table_privilege('authenticated', 'vault.secrets', 'INSERT'),
          has_table_privilege('authenticated', 'vault.decrypted_secrets', 'SELECT'),
          has_function_privilege(
            'authenticated',
            'vault.create_secret(text,text,text,uuid)',
            'EXECUTE'
          )
        );
      `),
    ).toBe("f|f|f|f|f");
  });

  test("converges simultaneous server form submissions and ignores every caller ownership hint", async ({
    browser,
  }) => {
    const credentialsA = uniqueCredentials("phase11e5-form-a");
    const credentialsB = uniqueCredentials("phase11e5-form-b");
    await provisionActivatedLocalUserForUi(credentialsA);
    const clientB = localClient();
    const signedB = await provisionActivatedLocalUser(clientB, credentialsB);
    const userA = queryLocalAuthFixture(`
      select id::text from auth.users where email = '${credentialsA.email}';
    `);
    const userB = signedB.data.user!.id;
    const staleA = localClient();
    expect((await staleA.auth.signInWithPassword(credentialsA)).error).toBeNull();
    const signedIn = await signInThroughUi(browser, "en", credentialsA, false);
    await establishClosureProof(signedIn.page, "en", credentialsA.password);
    const staleCookies = await signedIn.context.cookies();

    const responses = await Promise.all([
      directClosurePost(signedIn.context, "en", { ownerHint: userB }),
      directClosurePost(signedIn.context, "en", { ownerHint: userB }),
    ]);

    for (const response of responses) {
      expect(response.status).toBe(303);
      expect(response.headers.get("location")).toBe(
        `${appOrigin}/en/auth/account-closed`,
      );
    }

    expect(closureCount(userA)).toBe("1");
    expect(closureCount(userB)).toBe("0");
    expect(await clientB.rpc("current_account_access_state")).toMatchObject({
      data: "active",
      error: null,
    });
    expect(await staleA.rpc("is_current_account_access_allowed")).toMatchObject({
      data: false,
      error: null,
    });

    const staleContext = await browser.newContext({ javaScriptEnabled: false });
    await staleContext.addCookies(staleCookies);
    const stalePage = await staleContext.newPage();
    await stalePage.goto("/en/account/closure");
    await expect(stalePage).toHaveURL("/en/auth/account-closed");
    expect(closureCount(userA)).toBe("1");
    await staleContext.close();
    await signedIn.context.close();
  });

  test("rejects a stale cookie closure POST after E3 when the exact Auth session is globally revoked", async ({
    browser,
  }) => {
    const credentials = uniqueCredentials("phase11e5-revoked-post");
    await provisionActivatedLocalUserForUi(credentials);
    const userId = queryLocalAuthFixture(`
      select id::text from auth.users where email = '${credentials.email}';
    `);
    const signedIn = await signInThroughUi(browser, "en", credentials, false);
    await establishClosureProof(signedIn.page, "en", credentials.password);
    const session = sessionFromAuthCookies(await signedIn.context.cookies());
    const claims = jwtClaims(session.access_token);

    expect(claims.sub).toBe(userId);
    expect(
      queryLocalAuthFixture(`
        select count(*)
        from auth.sessions
        where id = '${claims.session_id}'::uuid
          and user_id = '${userId}'::uuid;
      `),
    ).toBe("1");

    const revoked = await localAdminClient().auth.admin.signOut(
      session.access_token,
      "global",
    );
    expect(revoked.error).toBeNull();
    expect(
      queryLocalAuthFixture(`
        select count(*)
        from auth.sessions
        where id = '${claims.session_id}'::uuid
          and user_id = '${userId}'::uuid;
      `),
    ).toBe("0");
    const response = await directClosurePost(signedIn.context, "en");
    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe(
      `${appOrigin}/en/auth/sign-in`,
    );
    expect(closureCount(userId)).toBe("0");
    await signedIn.context.close();
  });

  test("denies a valid capability at the RPC after its exact Auth session is revoked", async () => {
    const credentials = uniqueCredentials("phase11e5-revoked-rpc");
    const client = localClient();
    const signed = await provisionActivatedLocalUser(client, credentials);
    const session = signed.data.session!;
    const userId = signed.data.user!.id;
    const capability = capabilityForSession(session.access_token);

    expect(
      queryLocalAuthFixture(`
        select count(*)
        from auth.sessions
        where id = '${capability.claims.session_id}'::uuid
          and user_id = '${userId}'::uuid;
      `),
    ).toBe("1");

    const revoked = await localAdminClient().auth.admin.signOut(
      session.access_token,
      "local",
    );
    expect(revoked.error).toBeNull();
    expect(
      queryLocalAuthFixture(`
        select count(*)
        from auth.sessions
        where id = '${capability.claims.session_id}'::uuid
          and user_id = '${userId}'::uuid;
      `),
    ).toBe("0");

    const denied = await client.rpc("close_current_account", {
      p_capability: capability.capability,
      p_closure_request_id: capability.requestId,
    });
    expect(denied.error?.code).toBe("42501");
    expect(closureCount(userId)).toBe("0");
  });

  test("CJ-035 completes the English cancellation and closure journey without JavaScript while all product data remains unchanged", async ({
    browser,
  }) => {
    const credentials = uniqueCredentials("phase11e5-cj035-en");
    await provisionActivatedLocalUserForUi(credentials);
    const userId = queryLocalAuthFixture(`
      select id::text from auth.users where email = '${credentials.email}';
    `);
    seedRepresentativeProductData(userId);
    const before = productFingerprint(userId);
    const staleClient = localClient();
    const staleSignIn = await staleClient.auth.signInWithPassword(credentials);
    expect(staleSignIn.error).toBeNull();

    const signedIn = await signInThroughUi(browser, "en", credentials, false);
    await expect(signedIn.page).toHaveURL(/\/en\/today/);
    await signedIn.page.goto("/en/account");
    await signedIn.page
      .getByRole("link", { name: "Review account closure" })
      .click();
    await expect(
      signedIn.page.getByRole("heading", { name: "Close account" }),
    ).toBeVisible();
    await expect(
      signedIn.page.getByRole("link", { name: "Export my data first" }),
    ).toHaveAttribute("href", "/en/account/export");
    await expect(
      signedIn.page.locator(
        'input[name*="capability" i], input[name*="user" i], input[name*="session" i]',
      ),
    ).toHaveCount(0);
    expect(await signedIn.page.content()).not.toContain(
      capabilitySecret as string,
    );
    expect(await signedIn.page.content()).not.toContain(
      "ACCOUNT_CLOSURE_CAPABILITY_SECRET",
    );
    const noProof = await directClosurePost(signedIn.context, "en");
    expect(noProof.status).toBe(303);
    expect(noProof.headers.get("location")).toBe(
      `${appOrigin}/en/auth/reauthenticate?intent=account-closure`,
    );
    await signedIn.context.addCookies([
      {
        httpOnly: true,
        name: recentPasswordAuthCookieName,
        sameSite: "Strict",
        secure: true,
        url: appOrigin,
        value: "v1.forged.forged",
      },
    ]);
    const forgedProof = await directClosurePost(signedIn.context, "en");
    expect(forgedProof.status).toBe(303);
    expect(closureCount(userId)).toBe("0");
    const axeSignedIn = await signInThroughUi(browser, "en", credentials, true);
    await axeSignedIn.page.goto("/en/account/closure");
    await assertNoSeriousAxe(axeSignedIn.page);
    await axeSignedIn.context.close();

    await signedIn.page
      .getByRole("link", { name: "Cancel and keep my account active" })
      .click();
    await expect(signedIn.page).toHaveURL("/en/account");
    expect(closureCount(userId)).toBe("0");
    expect(productFingerprint(userId)).toBe(before);

    await establishClosureProof(signedIn.page, "en", credentials.password);
    await signedIn.page
      .getByRole("link", { name: "Export my data first" })
      .click();
    await expect(signedIn.page).toHaveURL("/en/account/export");
    const preClosureDownloadEvent = signedIn.page.waitForEvent("download");
    await signedIn.page
      .getByRole("button", { name: "Download my data" })
      .click();
    const preClosureDownload = await preClosureDownloadEvent;
    expect(await preClosureDownload.path()).not.toBeNull();
    expect(preClosureDownload.suggestedFilename()).toMatch(
      /^nutrition-tracker-account-export-v1-\d{4}-\d{2}-\d{2}\.json$/,
    );
    expect(productFingerprint(userId)).toBe(before);
    await signedIn.page.goto("/en/account/closure");
    const validProof = (await signedIn.context.cookies()).find(
      (cookie) => cookie.name === recentPasswordAuthCookieName,
    );
    expect(validProof).toBeDefined();
    const proofPayload = JSON.parse(
      Buffer.from(validProof!.value.split(".")[1], "base64url").toString(
        "utf8",
      ),
    ) as { sid: string; sub: string };
    const expiredProof = issueRecentPasswordAuthProof({
      nowSeconds: Math.floor(Date.now() / 1000) - 601,
      secret: process.env.AUTH_REAUTH_PROOF_SECRET as string,
      sessionId: proofPayload.sid,
      userId: proofPayload.sub,
    });
    await signedIn.context.addCookies([
      {
        httpOnly: true,
        name: recentPasswordAuthCookieName,
        sameSite: "Strict",
        secure: true,
        url: appOrigin,
        value: expiredProof,
      },
    ]);
    const expiredProofAttempt = await directClosurePost(
      signedIn.context,
      "en",
    );
    expect(expiredProofAttempt.status).toBe(303);
    expect(expiredProofAttempt.headers.get("location")).toBe(
      `${appOrigin}/en/auth/reauthenticate?intent=account-closure`,
    );
    expect(closureCount(userId)).toBe("0");
    await signedIn.context.addCookies([
      {
        httpOnly: true,
        name: recentPasswordAuthCookieName,
        sameSite: "Strict",
        secure: true,
        url: appOrigin,
        value: validProof!.value,
      },
    ]);
    const differentSession = await signInThroughUi(
      browser,
      "en",
      credentials,
      false,
    );
    await differentSession.context.addCookies([
      {
        httpOnly: true,
        name: recentPasswordAuthCookieName,
        sameSite: "Strict",
        secure: true,
        url: appOrigin,
        value: validProof!.value,
      },
    ]);
    const crossSessionProof = await directClosurePost(
      differentSession.context,
      "en",
    );
    expect(crossSessionProof.status).toBe(303);
    expect(closureCount(userId)).toBe("0");
    await differentSession.context.close();
    await signedIn.page
      .getByRole("link", { name: "Cancel and keep my account active" })
      .click();
    await expect(signedIn.page).toHaveURL("/en/account");
    expect(closureCount(userId)).toBe("0");
    expect(productFingerprint(userId)).toBe(before);

    await signedIn.page.goto("/en/account/closure");
    const missingConfirmation = await fetch(
      `${appOrigin}/en/account/closure/submit`,
      {
        body: new URLSearchParams(),
        headers: {
          cookie: (await signedIn.context.cookies())
            .map(({ name, value }) => `${name}=${value}`)
            .join("; "),
          origin: appOrigin,
          "sec-fetch-site": "same-origin",
        },
        method: "POST",
        redirect: "manual",
      },
    );
    expect(missingConfirmation.status).toBe(400);
    expect((await directClosurePost(signedIn.context, "en", {
      duplicateConfirmation: true,
    })).status).toBe(400);
    expect((await directClosurePost(signedIn.context, "en", {
      crossOrigin: true,
    })).status).toBe(403);
    expect((await directClosurePost(signedIn.context, "en", {
      failureBeforeCommit: true,
    })).status).toBe(503);
    const getMutation = await fetch(
      `${appOrigin}/en/account/closure/submit`,
      { redirect: "manual" },
    );
    expect(getMutation.status).toBe(405);
    expect(getMutation.headers.get("allow")).toBe("POST");
    expect(closureCount(userId)).toBe("0");
    expect(productFingerprint(userId)).toBe(before);

    const preClosureCookies = await signedIn.context.cookies();
    await signedIn.page
      .getByLabel(
        "I understand that closing this account takes effect immediately and cannot be undone in the app.",
      )
      .check();
    await signedIn.page
      .getByRole("button", { name: "Close my account" })
      .click();
    await expect(signedIn.page).toHaveURL("/en/auth/account-closed");
    await expect(
      signedIn.page.getByRole("heading", { name: "Account closed" }),
    ).toBeVisible();
    const closedStatus = await fetch(
      `${appOrigin}/en/auth/account-closed`,
      { redirect: "manual" },
    );
    expect(closedStatus.status).toBe(200);
    expect(closedStatus.headers.get("cache-control")).toContain("no-store");
    expect(closureCount(userId)).toBe("1");
    expect(productFingerprint(userId)).toBe(before);
    expect(
      (await signedIn.context.cookies()).some(
        (cookie) =>
          cookie.name.startsWith("sb-") ||
          cookie.name === recentPasswordAuthCookieName,
      ),
    ).toBe(false);

    const staleProfile = await staleClient
      .from("profiles")
      .select("display_name")
      .eq("id", userId);
    const staleTargets = await staleClient
      .from("nutrition_targets")
      .select("id")
      .eq("user_id", userId);
    const staleDiary = await staleClient
      .from("diary_entries")
      .select("id")
      .eq("user_id", userId);
    expect(staleProfile).toMatchObject({ data: [], error: null });
    expect(staleTargets).toMatchObject({ data: [], error: null });
    expect(staleDiary).toMatchObject({ data: [], error: null });

    const staleContext = await browser.newContext({ javaScriptEnabled: false });
    await staleContext.addCookies(preClosureCookies);
    const stalePage = await staleContext.newPage();
    for (const path of [
      "/en/today",
      "/en/setup",
      "/en/foods",
      "/en/saved-meals",
      "/en/recipes",
      "/en/account/export",
    ]) {
      await stalePage.goto(path);
      await expect(stalePage).toHaveURL("/en/auth/account-closed");
    }
    const oldCookieHeader = preClosureCookies
      .map(({ name, value }) => `${name}=${value}`)
      .join("; ");
    const staleExport = await fetch(
      `${appOrigin}/en/account/export/download`,
      {
        headers: {
          cookie: oldCookieHeader,
          origin: appOrigin,
          "sec-fetch-site": "same-origin",
        },
        method: "POST",
        redirect: "manual",
      },
    );
    expect(staleExport.status).toBe(303);
    expect(staleExport.headers.get("location")).toBe(
      `${appOrigin}/en/auth/account-closed`,
    );

    const signedInAgain = await signInThroughUi(
      browser,
      "en",
      credentials,
      false,
    );
    await expect(signedInAgain.page).toHaveURL("/en/auth/account-closed");
    expect(productFingerprint(userId)).toBe(before);
    expect(
      queryLocalAuthFixture(`
        select json_build_object(
          'buckets', (select count(*) from storage.buckets),
          'objects', (select count(*) from storage.objects)
        )::text;
      `),
    ).toBe('{"buckets" : 0, "objects" : 0}');
    await staleContext.close();
    await signedInAgain.context.close();
    await signedIn.context.close();
  });

  test("completes Hebrew RTL closure without JavaScript and remains closed when post-commit provider cleanup fails", async ({
    browser,
  }) => {
    const credentials = uniqueCredentials("phase11e5-cj035-he");
    await provisionActivatedLocalUserForUi(credentials);
    const userId = queryLocalAuthFixture(`
      select id::text from auth.users where email = '${credentials.email}';
    `);
    const staleClient = localClient();
    expect((await staleClient.auth.signInWithPassword(credentials)).error).toBeNull();
    const signedIn = await signInThroughUi(browser, "he", credentials, false);
    await expect(signedIn.page).toHaveURL(/\/he\/today/);
    await signedIn.page.getByRole("link", { name: "חשבון" }).click();
    await signedIn.page
      .getByRole("link", { name: "בדיקת סגירת החשבון" })
      .click();
    await expect(
      signedIn.page.getByRole("heading", { name: "סגירת החשבון" }),
    ).toBeVisible();
    await expect(
      signedIn.page.getByRole("link", { name: "ייצוא הנתונים שלי תחילה" }),
    ).toHaveAttribute("href", "/he/account/export");
    await signedIn.page
      .getByRole("link", { name: "ביטול והשארת החשבון פעיל" })
      .click();
    await expect(signedIn.page).toHaveURL("/he/account");
    expect(closureCount(userId)).toBe("0");
    await establishClosureProof(signedIn.page, "he", credentials.password);
    await signedIn.page
      .getByRole("link", { name: "ביטול והשארת החשבון פעיל" })
      .click();
    await expect(signedIn.page).toHaveURL("/he/account");
    expect(closureCount(userId)).toBe("0");
    await signedIn.page.goto("/he/account/closure");
    await expect(signedIn.page.locator("html")).toHaveAttribute("dir", "rtl");
    const axeSignedIn = await signInThroughUi(browser, "he", credentials, true);
    await axeSignedIn.page.goto("/he/account/closure");
    await assertNoSeriousAxe(axeSignedIn.page);
    await axeSignedIn.context.close();

    if (!faultControlUrl) {
      throw new Error("Local sign-out fault control is unavailable.");
    }
    const fault = await fetch(faultControlUrl, { method: "POST" });
    expect(fault.ok).toBe(true);

    await signedIn.page
      .getByLabel(
        "ברור לי שסגירת החשבון נכנסת לתוקף מיד ואי אפשר לבטל אותה באפליקציה.",
      )
      .check();
    await signedIn.page
      .getByRole("button", { name: "סגירת החשבון שלי" })
      .click();
    await expect(signedIn.page).toHaveURL("/he/auth/account-closed");
    await expect(signedIn.page.locator("html")).toHaveAttribute("dir", "rtl");
    await expect(
      signedIn.page.getByRole("heading", { name: "החשבון נסגר" }),
    ).toBeVisible();
    const closedAxeContext = await browser.newContext();
    const closedAxePage = await closedAxeContext.newPage();
    await closedAxePage.goto("/he/auth/account-closed");
    await assertNoSeriousAxe(closedAxePage);
    await closedAxeContext.close();
    expect(closureCount(userId)).toBe("1");
    expect(
      (await signedIn.context.cookies()).some(
        (cookie) =>
          cookie.name.startsWith("sb-") ||
          cookie.name === recentPasswordAuthCookieName,
      ),
    ).toBe(false);
    expect(
      await staleClient.rpc("is_current_account_access_allowed"),
    ).toMatchObject({ data: false, error: null });
    await signedIn.context.close();
  });

  test("recovery can replace the provider password but never reopens a closed application account", async ({
    browser,
  }) => {
    const credentials = uniqueCredentials("phase11e5-recovery");
    const client = localClient();
    const provisioned = await provisionActivatedLocalUser(client, credentials);
    const session = provisioned.data.session!;
    const userId = provisioned.data.user!.id;
    const closure = capabilityForSession(session.access_token);
    const committed = await client.rpc("close_current_account", {
      p_capability: closure.capability,
      p_closure_request_id: closure.requestId,
    });
    expect(committed.error).toBeNull();
    expect(closureCount(userId)).toBe("1");
    await client.auth.signOut({ scope: "local" });

    const context = await browser.newContext({ javaScriptEnabled: false });
    const page = await context.newPage();
    await requestRecovery(page, credentials.email);
    const recoveryLink = await waitForLocalRecoveryLink(credentials.email);
    await page.goto(recoveryLink);
    await expect(page).toHaveURL("/en/auth/recover/reset");
    await submitNewPassword(page, replacementPassword);
    await expect(page).toHaveURL("/en/auth/sign-in?recovery=complete");

    await page.getByLabel("Email").fill(credentials.email);
    await page.getByLabel("Password").fill(replacementPassword);
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page).toHaveURL("/en/auth/account-closed");
    expect(closureCount(userId)).toBe("1");
    expect(
      (await context.cookies()).some(
        (cookie) => cookie.name === recentPasswordAuthCookieName,
      ),
    ).toBe(false);
    await context.close();
  });
});
