import AxeBuilder from "@axe-core/playwright";
import { createClient } from "@supabase/supabase-js";
import { readFile } from "node:fs/promises";
import {
  expect,
  test,
  type APIResponse,
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
import {
  issueRecentPasswordAuthProof,
  recentPasswordAuthCookieName,
} from "@/lib/auth/recent-password-auth-proof";
import {
  accountExportSchema,
  accountExportVersion,
  type AccountExportPayload,
} from "@/lib/account-export/schema";
import type { Database } from "@/lib/supabase/database.types";

const localOnly = process.env.DATE_E2E_LOCAL_SUPABASE === "1";
const localSupabaseUrl = process.env.LOCAL_SUPABASE_URL;
const localSupabasePublishableKey = process.env.LOCAL_SUPABASE_PUBLISHABLE_KEY;
const appOrigin = new URL(
  process.env.PLAYWRIGHT_BASE_URL ??
    `http://127.0.0.1:${process.env.PLAYWRIGHT_PORT ?? "3100"}`,
).origin;
const proofSecret =
  "phase11e3-local-e2e-only-proof-secret-material-0123456789";
const currentPassword = "Phase11E4CurrentPassword123!";
const replacementPassword = "Phase11E4ReplacementPassword456!";

type ExportResponse = Pick<
  APIResponse,
  "headers" | "json" | "status" | "text"
>;

const fixtureIds = {
  referencedFood: "10000000-0000-4000-8000-000000000001",
  unrelatedFood: "10000000-0000-4000-8000-000000000002",
  customFoodA: "10000000-0000-4000-8000-000000000003",
  customFoodB: "10000000-0000-4000-8000-000000000004",
  diaryA: "10000000-0000-4000-8000-000000000005",
  diaryB: "10000000-0000-4000-8000-000000000006",
  savedMealA: "10000000-0000-4000-8000-000000000007",
  savedMealB: "10000000-0000-4000-8000-000000000008",
  recipeA: "10000000-0000-4000-8000-000000000009",
  recipeB: "10000000-0000-4000-8000-000000000010",
};

test.skip(
  !localOnly || !localSupabaseUrl || !localSupabasePublishableKey,
  "Account export tests require the local-only Supabase runner.",
);

function uniqueCredentials(label: string, password = currentPassword) {
  return {
    email: `${label.slice(0, 20)}-${Date.now().toString(36)}-${crypto.randomUUID().slice(0, 8)}@example.test`,
    password,
  };
}

function requireUuid(value: string) {
  if (!/^[0-9a-f-]{36}$/i.test(value)) {
    throw new Error("Invalid local account export fixture identifier.");
  }
}

function localClient() {
  const url = new URL(localSupabaseUrl as string);

  if (!['127.0.0.1', 'localhost'].includes(url.hostname)) {
    throw new Error("Refusing to use remote Supabase in account export tests.");
  }

  return createClient<Database>(
    localSupabaseUrl as string,
    localSupabasePublishableKey as string,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
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

async function confirmCurrentPassword(
  page: Page,
  locale: "en" | "he",
  password: string,
) {
  const label = locale === "en" ? "Current password" : "הסיסמה הנוכחית";
  const submit = locale === "en" ? "Confirm password" : "אימות הסיסמה";

  await page.getByLabel(label).fill(password);
  await page.getByRole("button", { name: submit }).click();
}

function proofCookie(
  cookies: Awaited<ReturnType<BrowserContext["cookies"]>>,
) {
  return cookies.find((cookie) => cookie.name === recentPasswordAuthCookieName);
}

async function setCopiedProof(
  context: BrowserContext,
  source: NonNullable<ReturnType<typeof proofCookie>>,
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

async function directExport(
  context: BrowserContext,
  locale: "en" | "he" = "en",
  options: {
    form?: Record<string, string>;
    headers?: Record<string, string>;
    query?: string;
  } = {},
) {
  const cookieHeader = (await context.cookies())
    .map(({ name, value }) => `${name}=${value}`)
    .join("; ");

  const response = await fetch(
    `${appOrigin}/${locale}/account/export/download${options.query ?? ""}`,
    {
      body: options.form ? new URLSearchParams(options.form) : undefined,
      headers: {
        ...(cookieHeader ? { cookie: cookieHeader } : {}),
        origin: appOrigin,
        "sec-fetch-site": "same-origin",
        ...options.headers,
      },
      method: "POST",
      redirect: "manual",
    },
  );

  return {
    headers: () => Object.fromEntries(response.headers.entries()),
    json: () => response.json(),
    status: () => response.status,
    text: () => response.text(),
  } satisfies ExportResponse;
}

function expectNotJson(response: ExportResponse) {
  expect(response.headers()["content-type"] ?? "").not.toContain(
    "application/json",
  );
  expect(response.headers()["content-disposition"]).toBeUndefined();
}

function seedExportFixtures(userA: string, userB: string) {
  requireUuid(userA);
  requireUuid(userB);

  queryLocalAuthFixture(`
    begin;

    insert into public.profiles (
      id, display_name, preferred_language, unit_system, created_at, updated_at
    ) values
      ('${userA}'::uuid, 'פרופיל ייצוא א', 'he', 'metric',
       '2026-01-01T00:00:00Z', '2026-01-02T00:00:00Z'),
      ('${userB}'::uuid, 'SECOND_TENANT_PROFILE_MARKER', 'en', 'metric',
       '2026-01-01T00:00:00Z', '2026-01-02T00:00:00Z');

    insert into public.nutrition_targets (
      id, user_id, effective_from, calories, protein_g, carbohydrates_g, fat_g,
      created_at, updated_at
    ) values
      ('20000000-0000-4000-8000-000000000001', '${userA}', '2026-01-01',
       0, null, 0, null, '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z'),
      ('20000000-0000-4000-8000-000000000002', '${userA}', '2026-02-01',
       2100, 110, 250, 70, '2026-02-01T00:00:00Z', '2026-02-01T00:00:00Z'),
      ('20000000-0000-4000-8000-000000000003', '${userB}', '2026-01-01',
       9999, 999, 999, 999, '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z');

    insert into public.foods (
      id, owner_user_id, source_id, source_food_id, food_type, name, brand_name,
      locale, serving_size, serving_unit, custom_nutrient_basis, data_quality,
      is_public, is_archived, created_at, updated_at
    ) values
      ('${fixtureIds.referencedFood}', null,
       (select id from public.food_sources where code = 'manual'),
       'phase11e4-referenced', 'generic', 'Referenced shared oats', null, 'en',
       100, 'g', null, 'curated', true, false,
       '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z'),
      ('${fixtureIds.unrelatedFood}', null,
       (select id from public.food_sources where code = 'manual'),
       'phase11e4-unrelated', 'generic', 'UNRELATED_SHARED_CATALOG_MARKER', null,
       'en', 100, 'g', null, 'curated', true, false,
       '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z'),
      ('${fixtureIds.customFoodA}', '${userA}',
       (select id from public.food_sources where code = 'user_custom'),
       null, 'user_custom', 'טחינה אישית א', 'מותג בדיקה', 'he', 0, 'g',
       'per_serving', 'user_provided', false, false,
       '2026-03-01T00:00:00Z', '2026-03-02T00:00:00Z'),
      ('${fixtureIds.customFoodB}', '${userB}',
       (select id from public.food_sources where code = 'user_custom'),
       null, 'user_custom', 'SECOND_TENANT_CUSTOM_FOOD_MARKER', null, 'en',
       1, 'portion', 'per_serving', 'user_provided', false, false,
       '2026-03-01T00:00:00Z', '2026-03-02T00:00:00Z');

    insert into public.food_aliases (food_id, alias_text, language_code)
    values
      ('${fixtureIds.customFoodA}', 'כינוי אישי א', 'he'),
      ('${fixtureIds.customFoodB}', 'SECOND_TENANT_ALIAS_MARKER', 'en');

    insert into public.food_nutrients (food_id, nutrient_id, amount, basis)
    values
      ('${fixtureIds.customFoodA}',
       (select id from public.nutrients where code = 'energy_kcal'), 0, 'per_serving'),
      ('${fixtureIds.customFoodB}',
       (select id from public.nutrients where code = 'energy_kcal'), 999, 'per_serving');

    insert into public.food_barcodes (
      food_id, canonical_gtin, provenance_source_id,
      provenance_source_food_id, verification_status
    ) values (
      '${fixtureIds.customFoodA}', '20000000000004',
      (select id from public.food_sources where code = 'user_custom'),
      null, 'user_asserted'
    );

    insert into public.food_favorites (user_id, food_id, created_at) values
      ('${userA}', '${fixtureIds.referencedFood}', '2026-03-03T00:00:00Z'),
      ('${userB}', '${fixtureIds.customFoodB}', '2026-03-03T00:00:00Z');

    insert into public.diary_entries (
      id, user_id, entry_date, meal_type, food_id, food_name, brand_name,
      serving_quantity, serving_unit, calories, protein_g, carbohydrates_g,
      fat_g, notes, source, created_at, updated_at
    ) values
      ('${fixtureIds.diaryA}', '${userA}', '2026-03-10', 'breakfast',
       '${fixtureIds.customFoodA}', 'צילום יומן היסטורי א', 'מותג היסטורי',
       0, null, 0, null, 0, null, 'הערה נשמרת', 'manual',
       '2026-03-10T08:00:00Z', '2026-03-10T08:00:00Z'),
      ('${fixtureIds.diaryB}', '${userB}', '2026-03-10', 'breakfast',
       '${fixtureIds.customFoodB}', 'SECOND_TENANT_DIARY_MARKER', null,
       1, 'portion', 999, 99, 99, 99, null, 'manual',
       '2026-03-10T08:00:00Z', '2026-03-10T08:00:00Z');

    insert into public.diary_entries (
      user_id, entry_date, meal_type, food_name, serving_quantity, calories,
      protein_g, carbohydrates_g, fat_g, notes, source, created_at, updated_at
    )
    select
      '${userA}'::uuid,
      '2026-04-01'::date,
      'snack',
      'Bulk diary ' || lpad(series::text, 4, '0'),
      0,
      0,
      null,
      0,
      null,
      case when series = 1001 then 'סוף הייצוא' else null end,
      'manual',
      '2026-04-01T00:00:00Z'::timestamptz + series * interval '1 second',
      '2026-04-01T00:00:00Z'::timestamptz + series * interval '1 second'
    from generate_series(1, 1001) as entries(series);

    insert into public.saved_meals (
      id, user_id, name, locale, created_at, updated_at
    ) values
      ('${fixtureIds.savedMealA}', '${userA}', 'ארוחה שמורה א', 'he',
       '2026-05-01T00:00:00Z', '2026-05-02T00:00:00Z'),
      ('${fixtureIds.savedMealB}', '${userB}', 'SECOND_TENANT_SAVED_MEAL_MARKER',
       'en', '2026-05-01T00:00:00Z', '2026-05-02T00:00:00Z');

    select set_config(
      'nutrition_tracker.saved_meal_revision_rpc_id',
      '${fixtureIds.savedMealA}',
      true
    );
    insert into public.saved_meal_items (
      saved_meal_id, position, food_id, food_name, brand_name,
      serving_quantity, serving_unit, calories, protein_g, carbohydrates_g,
      fat_g, notes, created_at
    ) values (
      '${fixtureIds.savedMealA}', 1, '${fixtureIds.customFoodA}',
       'צילום פריט בארוחה', null, 0, null, 0, null, 0, null,
       'פריט נשמר', '2026-05-01T00:00:00Z'
    );
    select set_config(
      'nutrition_tracker.saved_meal_revision_rpc_id',
      '${fixtureIds.savedMealB}',
      true
    );
    insert into public.saved_meal_items (
      saved_meal_id, position, food_id, food_name, brand_name,
      serving_quantity, serving_unit, calories, protein_g, carbohydrates_g,
      fat_g, notes, created_at
    ) values (
      '${fixtureIds.savedMealB}', 1, '${fixtureIds.customFoodB}',
       'SECOND_TENANT_SAVED_ITEM_MARKER', null, 1, 'portion', 999, 99, 99, 99,
       null, '2026-05-01T00:00:00Z'
    );

    insert into public.recipes (
      id, user_id, name, locale, yield_servings, created_at, updated_at
    ) values
      ('${fixtureIds.recipeA}', '${userA}', 'מתכון א', 'he', 0.001,
       '2026-06-01T00:00:00Z', '2026-06-02T00:00:00Z'),
      ('${fixtureIds.recipeB}', '${userB}', 'SECOND_TENANT_RECIPE_MARKER', 'en', 2,
       '2026-06-01T00:00:00Z', '2026-06-02T00:00:00Z');

    insert into public.recipe_ingredients (
      recipe_id, position, food_id, ingredient_name, brand_name, quantity, unit,
      calories, protein_g, carbohydrates_g, fat_g, notes, created_at
    ) values
      ('${fixtureIds.recipeA}', 1, '${fixtureIds.customFoodA}',
       'צילום מרכיב במתכון', null, 0.001, 'g', 0, null, 0, null,
       'מרכיב נשמר', '2026-06-01T00:00:00Z'),
      ('${fixtureIds.recipeB}', 1, '${fixtureIds.customFoodB}',
       'SECOND_TENANT_RECIPE_ITEM_MARKER', null, 1, 'g', 999, 99, 99, 99,
       null, '2026-06-01T00:00:00Z');

    insert into public.saved_meal_diary_runs (
      id, user_id, saved_meal_id, idempotency_key, source_updated_at,
      entry_date, meal_type, item_count, created_at
    ) values (
      '30000000-0000-4000-8000-000000000001', '${userA}',
      '${fixtureIds.savedMealA}', '30000000-0000-4000-8000-000000000002',
      '2026-05-02T00:00:00Z', '2026-05-03', 'lunch', 1,
      '2026-05-03T12:00:00Z'
    );

    insert into public.recipe_diary_runs (
      id, user_id, recipe_id, idempotency_key, source_updated_at,
      requested_servings, entry_date, meal_type, created_at
    ) values (
      '30000000-0000-4000-8000-000000000003', '${userA}',
      '${fixtureIds.recipeA}', '30000000-0000-4000-8000-000000000004',
      '2026-06-02T00:00:00Z', 0.001, '2026-06-03', 'dinner',
      '2026-06-03T18:00:00Z'
    );

    insert into public.custom_food_creation_requests (
      id, user_id, idempotency_key, request_payload, completed_food_id,
      live_food_id, completed_at
    ) values (
      '30000000-0000-4000-8000-000000000005', '${userA}',
      '30000000-0000-4000-8000-000000000006',
      '{"password":"INTERNAL_REQUEST_PAYLOAD_MARKER"}'::jsonb,
      '${fixtureIds.customFoodA}', '${fixtureIds.customFoodA}',
      '2026-03-01T00:01:00Z'
    );

    insert into public.manual_diary_entry_requests (
      id, user_id, idempotency_key, request_payload, completed_diary_entry_id,
      live_diary_entry_id, completed_at
    ) values (
      '30000000-0000-4000-8000-000000000007', '${userA}',
      '30000000-0000-4000-8000-000000000008',
      '{"access_token":"INTERNAL_MANUAL_REQUEST_MARKER"}'::jsonb,
      '${fixtureIds.diaryA}', '${fixtureIds.diaryA}',
      '2026-03-10T08:01:00Z'
    );

    commit;
  `);
}

function accountStateHash(userId: string) {
  requireUuid(userId);
  return queryLocalAuthFixture(`
    select md5(jsonb_build_object(
      'activation', (select jsonb_agg(to_jsonb(rows) order by user_id)
        from public.account_activations rows where user_id = '${userId}'),
      'profile', (select jsonb_agg(to_jsonb(rows) order by id)
        from public.profiles rows where id = '${userId}'),
      'targets', (select jsonb_agg(to_jsonb(rows) order by effective_from, id)
        from public.nutrition_targets rows where user_id = '${userId}'),
      'diary', (select jsonb_agg(to_jsonb(rows) order by entry_date, created_at, id)
        from public.diary_entries rows where user_id = '${userId}'),
      'foods', (select jsonb_agg(to_jsonb(rows) order by id)
        from public.foods rows where owner_user_id = '${userId}'),
      'favorites', (select jsonb_agg(to_jsonb(rows) order by food_id)
        from public.food_favorites rows where user_id = '${userId}'),
      'meals', (select jsonb_agg(to_jsonb(rows) order by id)
        from public.saved_meals rows where user_id = '${userId}'),
      'recipes', (select jsonb_agg(to_jsonb(rows) order by id)
        from public.recipes rows where user_id = '${userId}'),
      'meal_runs', (select jsonb_agg(to_jsonb(rows) order by id)
        from public.saved_meal_diary_runs rows where user_id = '${userId}'),
      'recipe_runs', (select jsonb_agg(to_jsonb(rows) order by id)
        from public.recipe_diary_runs rows where user_id = '${userId}'),
      'food_requests', (select jsonb_agg(to_jsonb(rows) order by id)
        from public.custom_food_creation_requests rows where user_id = '${userId}'),
      'diary_requests', (select jsonb_agg(to_jsonb(rows) order by id)
        from public.manual_diary_entry_requests rows where user_id = '${userId}')
    )::text);
  `);
}

function assertForbiddenDataAbsent(payload: unknown) {
  const forbiddenKeys = new Set(
    [
      "password",
      "passwordHash",
      "accessToken",
      "refreshToken",
      "recoveryToken",
      "invitationToken",
      "serviceRoleKey",
      "recentAuthProof",
      "recentAuthCookie",
      "providerSession",
      "appMetadata",
      "userMetadata",
      "identities",
      "aud",
      "role",
      "idempotencyKey",
      "writeTransactionId",
      "requestPayload",
      "normalizedAlias",
      "scopeOwnerUserId",
    ].map((value) => value.replaceAll(/[^a-z0-9]/gi, "").toLowerCase()),
  );

  function visit(value: unknown) {
    if (Array.isArray(value)) {
      value.forEach(visit);
      return;
    }

    if (!value || typeof value !== "object") return;

    for (const [key, child] of Object.entries(value)) {
      expect(
        forbiddenKeys.has(key.replaceAll(/[^a-z0-9]/gi, "").toLowerCase()),
        `forbidden export key: ${key}`,
      ).toBe(false);
      visit(child);
    }
  }

  visit(payload);
}

function assertCompleteTenantAExport(
  payload: AccountExportPayload,
  userA: { email: string; id: string },
  userB: { email: string; id: string },
) {
  expect(payload.schema).toBe(accountExportSchema);
  expect(payload.version).toBe(accountExportVersion);
  expect(payload.account).toMatchObject({ email: userA.email, id: userA.id });
  expect(payload.profile).toMatchObject({
    displayName: "פרופיל ייצוא א",
    preferredLanguage: "he",
  });
  expect(payload.nutritionTargets).toHaveLength(2);
  expect(payload.nutritionTargets[0]).toMatchObject({
    calories: 0,
    carbohydratesG: 0,
    fatG: null,
    proteinG: null,
  });

  expect(payload.diaryEntries).toHaveLength(1002);
  expect(payload.diaryEntries[0]).toMatchObject({
    foodName: "צילום יומן היסטורי א",
    servingQuantity: 0,
  });
  const bulk = payload.diaryEntries.slice(1);
  expect(bulk).toHaveLength(1001);
  expect(bulk[0].foodName).toBe("Bulk diary 0001");
  expect(bulk[499].foodName).toBe("Bulk diary 0500");
  expect(bulk[500].foodName).toBe("Bulk diary 0501");
  expect(bulk[999].foodName).toBe("Bulk diary 1000");
  expect(bulk[1000]).toMatchObject({
    foodName: "Bulk diary 1001",
    notes: "סוף הייצוא",
  });
  expect(new Set(payload.diaryEntries.map((row) => row.id)).size).toBe(1002);

  expect(payload.customFoods).toHaveLength(1);
  expect(payload.customFoods[0]).toMatchObject({
    id: fixtureIds.customFoodA,
    name: "טחינה אישית א",
    servingSize: 0,
  });
  expect(payload.customFoods[0].aliases[0]).toMatchObject({
    text: "כינוי אישי א",
  });
  expect(payload.customFoods[0].barcodes[0]).toMatchObject({
    canonicalGtin: "20000000000004",
    verificationStatus: "user_asserted",
  });
  expect(payload.customFoods[0].nutrients[0]).toMatchObject({ amount: 0 });

  expect(payload.favorites).toEqual([
    {
      favoritedAt: "2026-03-03T00:00:00+00:00",
      foodId: fixtureIds.referencedFood,
    },
  ]);
  expect(payload.savedMeals[0].items[0]).toMatchObject({
    foodName: "צילום פריט בארוחה",
    servingQuantity: 0,
  });
  expect(payload.recipes[0].ingredients[0]).toMatchObject({
    ingredientName: "צילום מרכיב במתכון",
    quantity: 0.001,
  });
  expect(payload.activityRecords.customFoodCreations).toHaveLength(1);
  expect(payload.activityRecords.manualDiaryEntries).toHaveLength(1);
  expect(payload.activityRecords.savedMealDiaryRuns).toHaveLength(1);
  expect(payload.activityRecords.recipeDiaryRuns).toHaveLength(1);
  expect(payload.references.foods).toEqual([
    expect.objectContaining({
      id: fixtureIds.referencedFood,
      name: "Referenced shared oats",
    }),
  ]);
  expect(payload.references.nutrients).toEqual([
    expect.objectContaining({ code: "energy_kcal" }),
  ]);

  const serialized = JSON.stringify(payload);
  for (const forbiddenValue of [
    userB.id,
    userB.email,
    "SECOND_TENANT_PROFILE_MARKER",
    "SECOND_TENANT_DIARY_MARKER",
    "SECOND_TENANT_CUSTOM_FOOD_MARKER",
    "SECOND_TENANT_SAVED_MEAL_MARKER",
    "SECOND_TENANT_RECIPE_MARKER",
    fixtureIds.unrelatedFood,
    "UNRELATED_SHARED_CATALOG_MARKER",
    "INTERNAL_REQUEST_PAYLOAD_MARKER",
    "INTERNAL_MANUAL_REQUEST_MARKER",
    proofSecret,
    recentPasswordAuthCookieName,
  ]) {
    expect(serialized).not.toContain(forbiddenValue);
  }
  assertForbiddenDataAbsent(payload);
}

test.describe.serial("Phase 11E4 synchronous account export", () => {
  test.describe.configure({ timeout: 180_000 });

  const userACredentials = uniqueCredentials("phase11e4-export-owner");
  const userBCredentials = uniqueCredentials("phase11e4-other-tenant");
  let userAId = "";
  let userBId = "";

  test.beforeAll(async () => {
    await provisionActivatedLocalUserForUi(userACredentials);
    await provisionActivatedLocalUserForUi(userBCredentials);
    userAId = queryLocalAuthFixture(
      `select id::text from auth.users where email = '${userACredentials.email}';`,
    );
    userBId = queryLocalAuthFixture(
      `select id::text from auth.users where email = '${userBCredentials.email}';`,
    );
    seedExportFixtures(userAId, userBId);
  });

  for (const locale of ["en", "he"] as const) {
    test(`CJ-034 completes the ${locale} account export journey without JavaScript`, async ({
      browser,
    }) => {
      const before = accountStateHash(userAId);
      const signedIn = await signInThroughUi(
        browser,
        locale,
        userACredentials,
      );
      await expect(signedIn.page).toHaveURL(new RegExp(`/${locale}/today`));
      await signedIn.page.getByRole("link", {
        name: locale === "en" ? "Account" : "חשבון",
      }).click();
      await expect(signedIn.page).toHaveURL(`/${locale}/account`);
      await signedIn.page.getByRole("link", {
        name: locale === "en" ? "Open data export" : "פתיחת ייצוא הנתונים",
      }).click();
      await expect(signedIn.page).toHaveURL(`/${locale}/account/export`);
      await expect(
        signedIn.page.getByRole("button", {
          name: locale === "en" ? "Download my data" : "הורדת הנתונים שלי",
        }),
      ).toHaveCount(0);
      await signedIn.page.getByRole("link", {
        name:
          locale === "en"
            ? "Confirm current password"
            : "אימות הסיסמה הנוכחית",
      }).click();
      expect(new URL(signedIn.page.url()).searchParams.get("intent")).toBe(
        "account-export",
      );
      await confirmCurrentPassword(
        signedIn.page,
        locale,
        userACredentials.password,
      );
      await expect(signedIn.page).toHaveURL(`/${locale}/account/export`);

      const downloadEvent = signedIn.page.waitForEvent("download");
      await signedIn.page.getByRole("button", {
        name: locale === "en" ? "Download my data" : "הורדת הנתונים שלי",
      }).click();
      const download = await downloadEvent;
      const downloadedPath = await download.path();
      expect(downloadedPath).not.toBeNull();
      expect(download.suggestedFilename()).toMatch(
        /^nutrition-tracker-account-export-v1-\d{4}-\d{2}-\d{2}\.json$/,
      );
      const body = await readFile(downloadedPath as string, "utf8");
      const payload = JSON.parse(body) as AccountExportPayload;
      assertCompleteTenantAExport(
        payload,
        { email: userACredentials.email, id: userAId },
        { email: userBCredentials.email, id: userBId },
      );
      expect(accountStateHash(userAId)).toBe(before);

      await signedIn.context.close();
    });
  }

  test("protects the direct route, ignores caller ownership hints, minimizes references, and returns safe headers", async ({
    browser,
    request,
  }) => {
    const unauthenticated = await request.post(
      `${appOrigin}/en/account/export/download`,
      {
        headers: { origin: appOrigin, "sec-fetch-site": "same-origin" },
        maxRedirects: 0,
      },
    );
    expect(unauthenticated.status()).toBe(303);
    expect(new URL(unauthenticated.headers().location).pathname).toBe(
      "/en/auth/sign-in",
    );
    expectNotJson(unauthenticated);

    const signedIn = await signInThroughUi(browser, "en", userACredentials);
    const noProof = await directExport(signedIn.context);
    expect(noProof.status()).toBe(303);
    expect(new URL(noProof.headers().location).pathname).toBe(
      "/en/auth/reauthenticate",
    );
    expect(new URL(noProof.headers().location).searchParams.get("intent")).toBe(
      "account-export",
    );
    expectNotJson(noProof);

    await signedIn.page.goto(
      "/en/auth/reauthenticate?intent=account-export&returnTo=https%3A%2F%2Fevil.example",
    );
    await confirmCurrentPassword(
      signedIn.page,
      "en",
      userACredentials.password,
    );
    await expect(signedIn.page).toHaveURL("/en/account/export");

    const response = await directExport(signedIn.context, "en", {
      form: {
        account_id: userBId,
        email: userBCredentials.email,
        owner: userBId,
        user_id: userBId,
      },
      headers: {
        "x-account-id": userBId,
        "x-owner": userBId,
      },
      query: `?user_id=${userBId}&account_id=${userBId}&email=${encodeURIComponent(userBCredentials.email)}&owner=${userBId}`,
    });
    expect(response.status()).toBe(200);
    expect(response.headers()).toMatchObject({
      "cache-control": "private, no-store, max-age=0",
      "content-type": "application/json; charset=utf-8",
      "cross-origin-resource-policy": "same-origin",
      expires: "0",
      pragma: "no-cache",
      "x-content-type-options": "nosniff",
    });
    expect(response.headers()["content-disposition"]).toMatch(
      /^attachment; filename="nutrition-tracker-account-export-v1-\d{4}-\d{2}-\d{2}\.json"$/,
    );
    expect(response.headers()["access-control-allow-origin"]).toBeUndefined();
    const payload = (await response.json()) as AccountExportPayload;
    assertCompleteTenantAExport(
      payload,
      { email: userACredentials.email, id: userAId },
      { email: userBCredentials.email, id: userBId },
    );

    const hostileOrigin = await directExport(signedIn.context, "en", {
      headers: {
        origin: "https://evil.example",
        "sec-fetch-site": "cross-site",
      },
    });
    expect(hostileOrigin.status()).toBe(403);
    expectNotJson(hostileOrigin);

    const getResponse = await signedIn.context.request.get(
      `${appOrigin}/en/account/export/download`,
      { maxRedirects: 0 },
    );
    expect(getResponse.status()).toBe(405);
    expect(getResponse.headers().allow).toBe("POST");
    expectNotJson(getResponse);

    await signedIn.context.close();
  });

  test("rejects forged, expired, different-session, and sign-out-era proofs", async ({
    browser,
  }) => {
    const primary = await signInThroughUi(browser, "en", userACredentials);
    const secondSession = await signInThroughUi(
      browser,
      "en",
      userACredentials,
    );
    await primary.page.goto(
      "/en/auth/reauthenticate?intent=account-export",
    );
    await confirmCurrentPassword(
      primary.page,
      "en",
      userACredentials.password,
    );
    const validProof = proofCookie(await primary.context.cookies());
    expect(validProof).toBeDefined();

    const forged = `${validProof!.value.slice(0, -1)}${validProof!.value.endsWith("A") ? "B" : "A"}`;
    await setCopiedProof(primary.context, validProof!, forged);
    const forgedResponse = await directExport(primary.context);
    expect(forgedResponse.status()).toBe(303);
    expectNotJson(forgedResponse);

    const [, encodedPayload] = validProof!.value.split(".");
    const proofPayload = JSON.parse(
      Buffer.from(encodedPayload, "base64url").toString("utf8"),
    ) as { sid: string; sub: string };
    const expired = issueRecentPasswordAuthProof({
      nowSeconds: Math.floor(Date.now() / 1000) - 601,
      secret: proofSecret,
      sessionId: proofPayload.sid,
      userId: proofPayload.sub,
    });
    await setCopiedProof(primary.context, validProof!, expired);
    const expiredResponse = await directExport(primary.context);
    expect(expiredResponse.status()).toBe(303);
    expectNotJson(expiredResponse);

    await setCopiedProof(secondSession.context, validProof!);
    const copiedResponse = await directExport(secondSession.context);
    expect(copiedResponse.status()).toBe(303);
    expectNotJson(copiedResponse);

    await setCopiedProof(primary.context, validProof!);
    expect((await directExport(primary.context)).status()).toBe(200);
    await primary.page.goto("/en/today");
    await primary.page.getByRole("button", { name: "Sign out" }).click();
    await expect(primary.page).toHaveURL("/en");
    await primary.page.goto("/en/auth/sign-in");
    await primary.page.getByLabel("Email").fill(userACredentials.email);
    await primary.page.getByLabel("Password").fill(userACredentials.password);
    await primary.page.getByRole("button", { name: "Sign in" }).click();
    await setCopiedProof(primary.context, validProof!);
    const oldSessionResponse = await directExport(primary.context);
    expect(oldSessionResponse.status()).toBe(303);
    expectNotJson(oldSessionResponse);

    await primary.context.close();
    await secondSession.context.close();
  });

  test("blocks activation-incomplete identities at the surface and direct endpoint", async ({
    browser,
  }) => {
    const credentials = uniqueCredentials("phase11e4-incomplete");
    const client = localClient();
    const provisioned = await provisionInvitedIncompleteLocalUser(
      client,
      credentials,
    );
    const userId = provisioned.data.user?.id as string;
    const signedIn = await signInThroughUi(browser, "he", credentials);
    await expect(signedIn.page).toHaveURL("/he/auth/activate");
    await signedIn.page.goto("/he/account/export");
    await expect(signedIn.page).toHaveURL("/he/auth/activate");
    await signedIn.page.goto(
      "/he/auth/reauthenticate?intent=account-export",
    );
    await expect(signedIn.page).toHaveURL("/he/auth/activate");
    const response = await directExport(signedIn.context, "he");
    expect(response.status()).toBe(303);
    expect(new URL(response.headers().location).pathname).toBe(
      "/he/auth/activate",
    );
    expectNotJson(response);
    expect(
      queryLocalAuthFixture(`
        select count(*) from public.account_activations
        where user_id = '${userId}'::uuid;
      `),
    ).toBe("0");
    expect(proofCookie(await signedIn.context.cookies())).toBeUndefined();

    await client.auth.signOut({ scope: "local" });
    await signedIn.context.close();
  });

  test("returns no partial attachment on an injected mid-collection failure and mutates no account data", async ({
    browser,
  }) => {
    const signedIn = await signInThroughUi(browser, "en", userACredentials);
    await signedIn.page.goto(
      "/en/auth/reauthenticate?intent=account-export",
    );
    await confirmCurrentPassword(
      signedIn.page,
      "en",
      userACredentials.password,
    );
    const before = accountStateHash(userAId);
    const response = await directExport(signedIn.context, "en", {
      headers: { "x-phase11e4-export-fault": "after-diary" },
    });

    expect(response.status()).toBe(500);
    expectNotJson(response);
    expect(response.headers()["cache-control"]).toBe(
      "private, no-store, max-age=0",
    );
    const body = await response.text();
    expect(body).toBe(
      "We could not prepare the account export. No partial file was downloaded.",
    );
    expect(body).not.toContain("צילום יומן היסטורי א");
    expect(accountStateHash(userAId)).toBe(before);

    await signedIn.context.close();
  });

  test("keeps both localized account surfaces free of serious automated accessibility issues", async ({
    browser,
  }, testInfo) => {
    for (const locale of ["en", "he"] as const) {
      const signedIn = await signInThroughUi(
        browser,
        locale,
        userACredentials,
        true,
      );
      await signedIn.page.goto(`/${locale}/account/export`);
      await expect(signedIn.page.locator("html")).toHaveAttribute(
        "dir",
        locale === "he" ? "rtl" : "ltr",
      );
      const accessibility = await new AxeBuilder({ page: signedIn.page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
        .analyze();
      await testInfo.attach(`axe-account-export-${locale}`, {
        body: Buffer.from(JSON.stringify(accessibility.violations, null, 2)),
        contentType: "application/json",
      });
      expect(
        accessibility.violations.filter(
          (finding) =>
            finding.impact === "critical" || finding.impact === "serious",
        ),
      ).toEqual([]);
      await signedIn.context.close();
    }
  });

  test("does not treat password recovery or ordinary sign-in as export reauthentication", async ({
    browser,
  }) => {
    const credentials = uniqueCredentials("phase11e4-recovery");
    await provisionActivatedLocalUserForUi(credentials);
    const authenticated = await signInThroughUi(browser, "en", credentials);
    const recoveryRequest = await browser.newContext({ javaScriptEnabled: false });
    const recoveryPage = await recoveryRequest.newPage();
    await recoveryPage.goto("/en/auth/recover");
    await recoveryPage.getByLabel("Email").fill(credentials.email);
    await recoveryPage
      .getByRole("button", { name: "Request recovery instructions" })
      .click();
    const recoveryLink = await waitForLocalRecoveryLink(credentials.email);

    await authenticated.page.goto(recoveryLink);
    await expect(authenticated.page).toHaveURL("/en/auth/recover/reset");
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
    await authenticated.page.getByLabel("Email").fill(credentials.email);
    await authenticated.page.getByLabel("Password").fill(replacementPassword);
    await authenticated.page.getByRole("button", { name: "Sign in" }).click();
    expect(proofCookie(await authenticated.context.cookies())).toBeUndefined();

    const recoveryOnly = await directExport(authenticated.context);
    expect(recoveryOnly.status()).toBe(303);
    expect(new URL(recoveryOnly.headers().location).pathname).toBe(
      "/en/auth/reauthenticate",
    );
    expectNotJson(recoveryOnly);
    await authenticated.page.goto(
      "/en/auth/reauthenticate?intent=account-export",
    );
    await confirmCurrentPassword(
      authenticated.page,
      "en",
      replacementPassword,
    );
    expect((await directExport(authenticated.context)).status()).toBe(200);

    await authenticated.context.close();
    await recoveryRequest.close();
  });
});
