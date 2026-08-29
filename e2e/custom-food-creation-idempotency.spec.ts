import {
  provisionActivatedLocalUser,
  provisionActivatedLocalUserForUi,
} from "@/e2e/helpers/local-auth";
import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  expect,
  test,
  type Browser,
  type BrowserContext,
  type Page,
} from "@playwright/test";
import type { Database, Json } from "@/lib/supabase/database.types";

const localSupabaseUrl = process.env.LOCAL_SUPABASE_URL;
const localSupabasePublishableKey =
  process.env.LOCAL_SUPABASE_PUBLISHABLE_KEY;
const localOnly = process.env.DATE_E2E_LOCAL_SUPABASE === "1";
const password = "CustomFoodIdempotency123!";
const supabaseProjectId = readFileSync("supabase/config.toml", "utf8").match(
  /^project_id\s*=\s*"([^"]+)"/m,
)?.[1];

if (!supabaseProjectId) {
  throw new Error("Could not read the local Supabase project id.");
}

const databaseContainer = `supabase_db_${supabaseProjectId}`;

test.skip(
  !localOnly || !localSupabaseUrl || !localSupabasePublishableKey,
  "CJ-018 idempotency tests require the local-only test runner.",
);

type CreateArgs =
  Database["public"]["Functions"]["create_custom_food"]["Args"];

test.describe.serial("CJ-018 custom-food creation idempotency", () => {
  let authenticatedState: Awaited<ReturnType<BrowserContext["storageState"]>>;
  let userAClient: SupabaseClient<Database>;
  let userBClient: SupabaseClient<Database>;
  let userAId: string;
  let userBId: string;
  const runId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const userAEmail = `cj018-a-${runId}@example.test`;
  const userBEmail = `cj018-b-${runId}@example.test`;

  function localClient() {
    return createClient<Database>(
      localSupabaseUrl as string,
      localSupabasePublishableKey as string,
      { auth: { autoRefreshToken: false, persistSession: false } },
    );
  }

  function queryDatabase(statement: string) {
    return execFileSync(
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
        "-At",
        "-c",
        statement,
      ],
      { encoding: "utf8" },
    ).trim();
  }

  function creationArgs(
    idempotencyKey: string,
    overrides: Partial<CreateArgs> = {},
  ): CreateArgs {
    return {
      p_aliases: [
        { alias_text: " Raw alias ", language_code: "en" },
        { alias_text: "כינוי גולמי", language_code: "he" },
      ] as Json,
      p_brand_name: "CJ-018 Brand",
      p_idempotency_key: idempotencyKey,
      p_locale: "en",
      p_name: "CJ-018 Food",
      p_nutrient_basis: "per_serving",
      p_nutrients: [
        { amount: 100, code: "energy_kcal" },
        { amount: 0, code: "protein_g" },
      ] as Json,
      p_serving_quantity: 1,
      p_serving_unit: "serving",
      ...overrides,
    };
  }

  function createFood(
    client: SupabaseClient<Database>,
    idempotencyKey: string,
    overrides: Partial<CreateArgs> = {},
  ) {
    return client.rpc(
      "create_custom_food",
      creationArgs(idempotencyKey, overrides),
    );
  }

  function installReceiptFailure(idempotencyKey: string) {
    queryDatabase(`
      create or replace function private.fail_cj018_receipt_for_test()
      returns trigger
      language plpgsql
      security invoker
      set search_path = ''
      as \$\$
      begin
        if new.idempotency_key = '${idempotencyKey}'::uuid then
          raise exception 'CJ-018 local receipt failure';
        end if;
        return new;
      end;
      \$\$;

      drop trigger if exists fail_cj018_receipt_for_test
      on public.custom_food_creation_requests;

      create trigger fail_cj018_receipt_for_test
      before insert on public.custom_food_creation_requests
      for each row execute function private.fail_cj018_receipt_for_test();
    `);
  }

  function removeReceiptFailure() {
    queryDatabase(`
      drop trigger if exists fail_cj018_receipt_for_test
      on public.custom_food_creation_requests;
      drop function if exists private.fail_cj018_receipt_for_test();
    `);
  }

  async function newAuthenticatedContext(browser: Browser) {
    return browser.newContext({ storageState: authenticatedState });
  }

  function creationKey(page: Page) {
    return page.getByTestId("custom-food-creation-key");
  }

  async function fillMinimalCreation(
    page: Page,
    name: string,
    locale: "en" | "he" = "en",
  ) {
    await expect(
      page.getByRole("button", {
        name:
          locale === "en" ? "Create custom food" : "יצירת מזון מותאם אישית",
      }),
    ).toBeEnabled();
    await page.getByLabel(locale === "en" ? "Name" : "שם").fill(name);
    await page
      .getByLabel(locale === "en" ? "Serving quantity" : "כמות מנה")
      .fill("1");
    await page
      .getByLabel(locale === "en" ? "Serving unit" : "יחידת מנה")
      .fill(locale === "en" ? "serving" : "מנה");
  }

  function foodIdFromUrl(page: Page) {
    const match = page
      .url()
      .match(/\/foods\/custom\/([0-9a-f-]+)\/edit\?saved=created$/);
    expect(match).not.toBeNull();
    return match?.[1] as string;
  }

  test.beforeAll(async ({ browser }) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    await provisionActivatedLocalUserForUi({ email: userAEmail, password });
    await page.goto("/en/auth/sign-in");
    await page.getByLabel("Email").fill(userAEmail);
    await page.getByLabel("Password").fill(password);
    await page.getByRole("button", { name: "Sign in" }).click();
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
    const userBSignUp = await provisionActivatedLocalUser(userBClient, {
      email: userBEmail,
      password,
    });
    expect(userBSignUp.error).toBeNull();
    userBId = userBSignUp.data.user?.id as string;
  });

  test.afterAll(() => {
    removeReceiptFailure();
    queryDatabase(
      `delete from auth.users where email in ('${userAEmail}', '${userBEmail}');`,
    );
  });

  test("CJ-018 durably converges sequential and concurrent exact creation replays", async () => {
    const sequentialKey = randomUUID();
    const first = await createFood(userAClient, sequentialKey, {
      p_aliases: [
        { alias_text: "  Canonical   alias  ", language_code: "en" },
        { alias_text: "כינוי", language_code: "he" },
      ] as Json,
      p_brand_name: "   " as unknown as string,
      p_name: "  Canonical food  ",
      p_nutrient_basis: "per_100g",
      p_nutrients: [
        { amount: 0, code: "protein_g" },
        { amount: 125.25, code: "energy_kcal" },
      ] as Json,
      p_serving_quantity: 7,
      p_serving_unit: "ignored",
    });
    const replay = await createFood(userAClient, sequentialKey, {
      p_aliases: [
        { alias_text: "כינוי", language_code: "he" },
        { alias_text: "  Canonical   alias  ", language_code: "en" },
      ] as Json,
      p_brand_name: null as unknown as string,
      p_name: "Canonical food",
      p_nutrient_basis: "per_100g",
      p_nutrients: [
        { amount: 125.25, code: "energy_kcal" },
        { amount: 0, code: "protein_g" },
      ] as Json,
      p_serving_quantity: 999,
      p_serving_unit: "also ignored",
    });

    expect(first.error).toBeNull();
    expect(replay.error).toBeNull();
    expect(first.data?.[0].replayed).toBe(false);
    expect(replay.data?.[0]).toMatchObject({
      food_id: first.data?.[0].food_id,
      replayed: true,
    });

    const concurrentKey = randomUUID();
    const [concurrentA, concurrentB] = await Promise.all([
      createFood(userAClient, concurrentKey, {
        p_name: "Concurrent CJ-018 food",
      }),
      createFood(userAClient, concurrentKey, {
        p_name: "Concurrent CJ-018 food",
      }),
    ]);
    expect(concurrentA.error).toBeNull();
    expect(concurrentB.error).toBeNull();
    expect(concurrentA.data?.[0].food_id).toBe(
      concurrentB.data?.[0].food_id,
    );

    expect(
      queryDatabase(`
        select
          (select count(*) from public.custom_food_creation_requests
           where user_id = '${userAId}'
             and idempotency_key in ('${sequentialKey}', '${concurrentKey}')),
          (select count(distinct completed_food_id)
           from public.custom_food_creation_requests
           where user_id = '${userAId}'
             and idempotency_key in ('${sequentialKey}', '${concurrentKey}')),
          (select count(*) from public.food_nutrients
           where food_id = '${first.data?.[0].food_id}'),
          (select count(*) from public.food_aliases
           where food_id = '${first.data?.[0].food_id}'),
          (select custom_food_edit_revision from public.foods
           where id = '${first.data?.[0].food_id}');
      `),
    ).toBe("2|2|2|2|1");
  });

  test("CJ-018 rejects conflicting replays, preserves later state, and permits identical new intent", async () => {
    const completedKey = randomUUID();
    const originalArgs = {
      p_aliases: [
        { alias_text: "Original replay alias", language_code: "en" },
      ] as Json,
      p_name: "Original replay food",
      p_nutrients: [
        { amount: 0, code: "protein_g" },
        { amount: 55, code: "energy_kcal" },
      ] as Json,
    };
    const created = await createFood(userAClient, completedKey, originalArgs);
    expect(created.error).toBeNull();
    const foodId = created.data?.[0].food_id as string;

    const conflict = await createFood(userAClient, completedKey, {
      ...originalArgs,
      p_nutrients: [{ amount: 55, code: "energy_kcal" }] as Json,
    });
    expect(conflict.error?.code).toBe("PT409");

    const edited = await userAClient.rpc("persist_custom_food", {
      ...creationArgs(randomUUID(), {
        p_aliases: [
          { alias_text: "Later edited alias", language_code: "en" },
        ] as Json,
        p_brand_name: "Later brand",
        p_name: "Later edited food",
        p_nutrients: [{ amount: 999, code: "energy_kcal" }] as Json,
      }),
      p_expected_edit_revision: 1,
      p_food_id: foodId,
      p_idempotency_key: undefined,
    } as unknown as Database["public"]["Functions"]["persist_custom_food"]["Args"]);
    expect(edited.error).toBeNull();
    const archived = await userAClient.rpc("set_custom_food_archived", {
      p_food_id: foodId,
      p_is_archived: true,
    });
    expect(archived.error).toBeNull();
    const beforeReplay = queryDatabase(`
      select name || '|' || brand_name || '|' || is_archived || '|' ||
        custom_food_edit_revision || '|' ||
        (select count(*) from public.food_nutrients where food_id = foods.id) ||
        '|' ||
        (select count(*) from public.food_aliases where food_id = foods.id)
      from public.foods where id = '${foodId}';
    `);

    const replay = await createFood(userAClient, completedKey, originalArgs);
    expect(replay.error).toBeNull();
    expect(replay.data?.[0].food_id).toBe(foodId);
    expect(
      queryDatabase(`
        select name || '|' || brand_name || '|' || is_archived || '|' ||
          custom_food_edit_revision || '|' ||
          (select count(*) from public.food_nutrients where food_id = foods.id) ||
          '|' ||
          (select count(*) from public.food_aliases where food_id = foods.id)
        from public.foods where id = '${foodId}';
      `),
    ).toBe(beforeReplay);

    const intentional = await createFood(
      userAClient,
      randomUUID(),
      originalArgs,
    );
    expect(intentional.error).toBeNull();
    expect(intentional.data?.[0].food_id).not.toBe(foodId);
    expect(
      queryDatabase(`
        select count(*) from public.custom_food_creation_requests
        where user_id = '${userAId}'
          and completed_food_id in (
            '${foodId}', '${intentional.data?.[0].food_id}'
          );
      `),
    ).toBe("2");
  });

  test("CJ-018 rolls back aggregate and receipt together before same-key retry", async () => {
    const failureKey = randomUUID();
    const failureName = `CJ-018 rollback ${failureKey}`;
    installReceiptFailure(failureKey);
    try {
      const failed = await createFood(userAClient, failureKey, {
        p_aliases: [
          { alias_text: "Rollback alias", language_code: "en" },
        ] as Json,
        p_name: failureName,
        p_nutrients: [
          { amount: 1, code: "energy_kcal" },
          { amount: 0, code: "fat_g" },
        ] as Json,
      });
      expect(failed.error).not.toBeNull();
      expect(
        queryDatabase(`
          select
            (select count(*) from public.custom_food_creation_requests
             where idempotency_key = '${failureKey}'),
            (select count(*) from public.foods
             where owner_user_id = '${userAId}' and name = '${failureName}'),
            (select count(*) from public.food_nutrients
             where food_id in (
               select id from public.foods
               where owner_user_id = '${userAId}' and name = '${failureName}'
             )),
            (select count(*) from public.food_aliases
             where food_id in (
               select id from public.foods
               where owner_user_id = '${userAId}' and name = '${failureName}'
             ));
        `),
      ).toBe("0|0|0|0");
    } finally {
      removeReceiptFailure();
    }

    const retried = await createFood(userAClient, failureKey, {
      p_aliases: [
        { alias_text: "Rollback alias", language_code: "en" },
      ] as Json,
      p_name: failureName,
      p_nutrients: [
        { amount: 1, code: "energy_kcal" },
        { amount: 0, code: "fat_g" },
      ] as Json,
    });
    expect(retried.error).toBeNull();
    expect(
      queryDatabase(`
        select
          (select count(*) from public.custom_food_creation_requests
           where idempotency_key = '${failureKey}'),
          (select count(*) from public.foods
           where owner_user_id = '${userAId}' and name = '${failureName}');
      `),
    ).toBe("1|1");
  });

  test("CJ-018 scopes identical creation keys and receipts to the authenticated owner", async () => {
    const sharedKey = randomUUID();
    const ownerA = await createFood(userAClient, sharedKey, {
      p_name: "Owner A shared-key food",
    });
    const ownerB = await createFood(userBClient, sharedKey, {
      p_name: "Owner B shared-key food",
    });
    expect(ownerA.error).toBeNull();
    expect(ownerB.error).toBeNull();
    expect(ownerA.data?.[0].food_id).not.toBe(ownerB.data?.[0].food_id);

    const receiptA = await userAClient
      .from("custom_food_creation_requests")
      .select("user_id,completed_food_id")
      .eq("idempotency_key", sharedKey);
    const receiptB = await userBClient
      .from("custom_food_creation_requests")
      .select("user_id,completed_food_id")
      .eq("idempotency_key", sharedKey);
    expect(receiptA.data).toEqual([
      {
        completed_food_id: ownerA.data?.[0].food_id,
        user_id: userAId,
      },
    ]);
    expect(receiptB.data).toEqual([
      {
        completed_food_id: ownerB.data?.[0].food_id,
        user_id: userBId,
      },
    ]);

    const hiddenFood = await userAClient
      .from("foods")
      .select("id")
      .eq("id", ownerB.data?.[0].food_id as string);
    expect(hiddenFood.data).toEqual([]);
    await userAClient
      .from("foods")
      .update({ name: "Forged owner overwrite" })
      .eq("id", ownerB.data?.[0].food_id as string);
    expect(
      queryDatabase(
        `select name from public.foods where id = '${ownerB.data?.[0].food_id}';`,
      ),
    ).toBe("Owner B shared-key food");
  });

  test("CJ-018 keeps creation receipts force-RLS and direct-write denied", async () => {
    const securityKey = randomUUID();
    const created = await createFood(userAClient, securityKey, {
      p_name: "Receipt security food",
    });
    expect(created.error).toBeNull();

    const catalog = queryDatabase(`
      select concat_ws('|',
        c.relrowsecurity,
        c.relforcerowsecurity,
        (
          select pg_get_constraintdef(oid)
          from pg_constraint
          where conrelid = c.oid
            and conname = 'custom_food_creation_requests_user_key'
        ),
        (
          select string_agg(cmd || ':' || roles::text, ',' order by policyname)
          from pg_policies
          where schemaname = 'public'
            and tablename = 'custom_food_creation_requests'
        )
      )
      from pg_class c
      where c.oid = 'public.custom_food_creation_requests'::regclass;

      select concat_ws('|',
        has_function_privilege(
          'public',
          'public.create_custom_food(uuid,text,text,text,text,numeric,text,jsonb,jsonb)',
          'execute'
        ),
        has_function_privilege(
          'anon',
          'public.create_custom_food(uuid,text,text,text,text,numeric,text,jsonb,jsonb)',
          'execute'
        ),
        has_function_privilege(
          'authenticated',
          'public.create_custom_food(uuid,text,text,text,text,numeric,text,jsonb,jsonb)',
          'execute'
        ),
        prosecdef,
        array_to_string(proconfig, ',')
      )
      from pg_proc
      where oid =
        'public.create_custom_food(uuid,text,text,text,text,numeric,text,jsonb,jsonb)'
          ::regprocedure;

      select concat_ws('|',
        n.nspname,
        has_function_privilege('public', p.oid, 'execute'),
        has_function_privilege('anon', p.oid, 'execute'),
        has_function_privilege('authenticated', p.oid, 'execute'),
        p.prosecdef,
        array_to_string(p.proconfig, ',')
      )
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
      where p.oid =
        'private.insert_completed_custom_food_creation_request(uuid,jsonb,uuid)'
          ::regprocedure;
    `);
    expect(catalog).toContain(
      "t|t|UNIQUE (user_id, idempotency_key)|SELECT:{authenticated}",
    );
    expect(catalog).toContain('f|f|t|f|search_path=""');
    expect(catalog).toContain('private|f|f|t|t|search_path=""');

    const directInsert = await userAClient
      .from("custom_food_creation_requests")
      .insert({
        completed_food_id: created.data?.[0].food_id as string,
        idempotency_key: randomUUID(),
        live_food_id: created.data?.[0].food_id as string,
        request_payload: {},
        user_id: userAId,
      });
    expect(directInsert.error?.code).toBe("42501");
    const directUpdate = await userAClient
      .from("custom_food_creation_requests")
      .update({ completed_food_id: randomUUID() })
      .eq("idempotency_key", securityKey);
    expect(directUpdate.error?.code).toBe("42501");
    const directDelete = await userAClient
      .from("custom_food_creation_requests")
      .delete()
      .eq("idempotency_key", securityKey);
    expect(directDelete.error?.code).toBe("42501");

    const anonymous = localClient();
    const anonymousRead = await anonymous
      .from("custom_food_creation_requests")
      .select("id")
      .eq("idempotency_key", securityKey);
    expect(anonymousRead.error?.code).toBe("42501");
    const anonymousCreate = await createFood(anonymous, randomUUID(), {
      p_name: "Anonymous creation denied",
    });
    expect(anonymousCreate.error).not.toBeNull();
  });

  test("CJ-018 retains one UI creation key through validation and ordinary success", async ({
    browser,
  }) => {
    const context = await newAuthenticatedContext(browser);
    const page = await context.newPage();
    await page.goto("/en/foods/custom/new");
    await expect(creationKey(page)).toHaveValue(uuidPatternForTest);
    const originalKey = await creationKey(page).inputValue();
    await page.getByLabel("Name").fill("UI validation retained food");
    await page.getByRole("button", { name: "Create custom food" }).click();
    await expect(page.getByText("Enter a positive finite serving quantity."))
      .toBeVisible();
    await expect(creationKey(page)).toHaveValue(originalKey);
    await expect(page.getByLabel("Name")).toHaveValue(
      "UI validation retained food",
    );

    await page.getByLabel("Serving quantity").fill("1");
    await page.getByLabel("Serving unit").fill("serving");
    await page.getByRole("button", { name: "Create custom food" }).click();
    await expect(page).toHaveURL(
      /\/en\/foods\/custom\/[0-9a-f-]+\/edit\?saved=created$/,
    );
    const foodId = foodIdFromUrl(page);
    const receipt = await userAClient
      .from("custom_food_creation_requests")
      .select("completed_food_id", { count: "exact" })
      .eq("idempotency_key", originalKey);
    expect(receipt.count).toBe(1);
    expect(receipt.data?.[0].completed_food_id).toBe(foodId);
    expect(
      queryDatabase(
        `select owner_user_id || '|' || is_public || '|' || custom_food_edit_revision from public.foods where id = '${foodId}';`,
      ),
    ).toBe(`${userAId}|false|1`);

    await page.goto("/en/foods/custom/new");
    await expect(creationKey(page)).not.toHaveValue(originalKey);
    await context.close();
  });

  test("CJ-018 retains the UI draft through database rollback and exact retry", async ({
    browser,
  }) => {
    const context = await newAuthenticatedContext(browser);
    const page = await context.newPage();
    await page.goto("/en/foods/custom/new");
    const originalKey = await creationKey(page).inputValue();
    const name = `UI rollback ${originalKey}`;
    await fillMinimalCreation(page, name);
    installReceiptFailure(originalKey);
    try {
      await page.getByRole("button", { name: "Create custom food" }).click();
      await expect(
        page.getByText(
          "We could not save this custom food right now. Try again in a moment.",
        ),
      ).toBeVisible();
      await expect(creationKey(page)).toHaveValue(originalKey);
      await expect(page.getByLabel("Name")).toHaveValue(name);
      expect(
        queryDatabase(`
          select
            (select count(*) from public.custom_food_creation_requests
             where idempotency_key = '${originalKey}'),
            (select count(*) from public.foods
             where owner_user_id = '${userAId}' and name = '${name}');
        `),
      ).toBe("0|0");
    } finally {
      removeReceiptFailure();
    }

    await page.getByRole("button", { name: "Create custom food" }).click();
    await expect(page).toHaveURL(/\/edit\?saved=created$/);
    expect(
      queryDatabase(`
        select
          (select count(*) from public.custom_food_creation_requests
           where idempotency_key = '${originalKey}'),
          (select count(*) from public.foods
           where owner_user_id = '${userAId}' and name = '${name}');
      `),
    ).toBe("1|1");
    await context.close();
  });

  test("CJ-018 recovers a committed but unacknowledged creation response", async ({
    browser,
  }) => {
    const context = await newAuthenticatedContext(browser);
    const page = await context.newPage();
    await page.goto("/en/foods/custom/new");
    const originalKey = await creationKey(page).inputValue();
    const name = `Unacknowledged CJ-018 ${originalKey}`;
    await fillMinimalCreation(page, name);

    let resolveIntercepted: (response: {
      redirect: string | undefined;
      status: number;
    }) => void = () => undefined;
    const intercepted = new Promise<{
      redirect: string | undefined;
      status: number;
    }>((resolve) => {
      resolveIntercepted = resolve;
    });
    await page.route("**/*", async (route) => {
      const request = route.request();
      if (request.method() === "POST" && request.headers()["next-action"]) {
        const upstream = await route.fetch();
        resolveIntercepted({
          redirect: upstream.headers()["x-action-redirect"],
          status: upstream.status(),
        });
        await route.abort("failed");
        return;
      }
      await route.continue();
    });

    await page.getByRole("button", { name: "Create custom food" }).click();
    const interceptedResponse = await intercepted;
    expect(interceptedResponse.status).toBe(200);
    expect(interceptedResponse.redirect).toMatch(
      new RegExp(
        `^/en/foods/custom/[0-9a-f-]+/edit\\?saved=created&creationRequest=${originalKey};push$`,
      ),
    );
    const committedReceipt = await expect
      .poll(async () => {
        const receipt = await userAClient
          .from("custom_food_creation_requests")
          .select("completed_food_id")
          .eq("idempotency_key", originalKey)
          .maybeSingle();
        return receipt.data?.completed_food_id ?? null;
      })
      .not.toBeNull();
    void committedReceipt;

    const receipt = await userAClient
      .from("custom_food_creation_requests")
      .select("completed_food_id")
      .eq("idempotency_key", originalKey)
      .single();
    await page.unroute("**/*");
    await page.reload();
    await expect(creationKey(page)).toHaveValue(originalKey);
    await expect(page.getByLabel("Name")).toHaveValue(name);
    await page.getByRole("button", { name: "Create custom food" }).click();
    await expect(page).toHaveURL(/\/edit\?saved=created$/);
    expect(foodIdFromUrl(page)).toBe(receipt.data?.completed_food_id);
    expect(
      queryDatabase(`
        select
          (select count(*) from public.custom_food_creation_requests
           where idempotency_key = '${originalKey}'),
          (select count(*) from public.foods
           where id = '${receipt.data?.completed_food_id}'),
          (select count(*) from public.food_nutrients
           where food_id = '${receipt.data?.completed_food_id}'),
          (select count(*) from public.food_aliases
           where food_id = '${receipt.data?.completed_food_id}');
      `),
    ).toBe("1|1|0|0");
    await context.close();
  });

  test("CJ-018 preserves conflicting values and requires explicit new-intent rotation in English and Hebrew RTL", async ({
    browser,
  }) => {
    const scenarios = [
      {
        conflict:
          "This creation request was already completed with different values. Nothing new was created.",
        locale: "en",
        newIntent: "Start new custom food with these values",
        submit: "Create custom food",
      },
      {
        conflict:
          "בקשת היצירה הזאת כבר הושלמה עם ערכים אחרים. לא נוצר דבר חדש.",
        locale: "he",
        newIntent: "התחלת מזון מותאם אישית חדש עם הערכים האלה",
        submit: "יצירת מזון מותאם אישית",
      },
    ] as const;

    for (const scenario of scenarios) {
      const context = await newAuthenticatedContext(browser);
      const page = await context.newPage();
      await page.goto(`/${scenario.locale}/foods/custom/new`);
      const completedKey = await creationKey(page).inputValue();
      const completed = await createFood(userAClient, completedKey, {
        p_locale: scenario.locale,
        p_name: `Completed ${scenario.locale} intent`,
      });
      expect(completed.error).toBeNull();
      const conflictingName = `Conflicting ${scenario.locale} intent`;
      await fillMinimalCreation(page, conflictingName, scenario.locale);
      await page.getByRole("button", { name: scenario.submit }).click();
      await expect(
        page.getByTestId("custom-food-creation-conflict"),
      ).toContainText(scenario.conflict);
      await expect(creationKey(page)).toHaveValue(completedKey);
      await expect(
        page.getByLabel(scenario.locale === "en" ? "Name" : "שם"),
      ).toHaveValue(conflictingName);
      await expect(page.locator("html")).toHaveAttribute(
        "dir",
        scenario.locale === "en" ? "ltr" : "rtl",
      );

      await page.getByRole("button", { name: scenario.newIntent }).click();
      const rotatedKey = await creationKey(page).inputValue();
      expect(rotatedKey).not.toBe(completedKey);
      await expect(
        page.getByLabel(scenario.locale === "en" ? "Name" : "שם"),
      ).toHaveValue(conflictingName);
      await page.getByRole("button", { name: scenario.submit }).click();
      await expect(page).toHaveURL(
        new RegExp(
          `/${scenario.locale}/foods/custom/[0-9a-f-]+/edit\\?saved=created$`,
        ),
      );
      const newFoodId = foodIdFromUrl(page);
      expect(newFoodId).not.toBe(completed.data?.[0].food_id);
      expect(
        queryDatabase(`
          select count(*) from public.custom_food_creation_requests
          where user_id = '${userAId}'
            and idempotency_key in ('${completedKey}', '${rotatedKey}');
        `),
      ).toBe("2");
      await context.close();
    }
  });
});

const uuidPatternForTest =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
