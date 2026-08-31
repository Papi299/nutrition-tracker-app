import { createClient } from "@supabase/supabase-js";

const date = "2026-08-29";

function definition(value) {
  return {
    actionKind: "click",
    concurrency: [1, 10],
    ...value,
  };
}

function requireUuidFromUrl(page, pattern) {
  const match = pattern.exec(page.url());
  if (!match) throw new Error("incorrect_redirect");
  return match[1];
}

function alternatePassword(current) {
  return current === "Phase11G2LocalReplacement-2026!"
    ? "Phase11G2LocalReplacement-2027!"
    : "Phase11G2LocalReplacement-2026!";
}

export function createPlaywrightOperationCatalog(helpers) {
  const {
    administrator,
    apiUrl,
    clearSession,
    countRows,
    deleteRows,
    ensureSignedIn,
    establishRecentAuthentication,
    identities,
    insertRows,
    publishableKey,
    selectRows,
    updateRows,
  } = helpers;

  const operations = [
    definition({
      metricId: "PERF-001",
      id: "invited_activation",
      journeys: ["CJ-002", "CJ-003"],
      threshold: 1_000,
      triggerId: "auth.activation.submit",
      triggerDescription: "Click Activate account after completing the accepted invitation eligibility form.",
      expectedMethod: "POST",
      expectedPath: "/en/auth/activate",
      serverRouteTemplate: "/[locale]/auth/activate",
      stableConditionId: "auth.activation.today-visible",
      stableDescription: "The browser reaches the localized Today page with an active account session.",
      stableRouteTemplate: "/[locale]/today",
      async prepare({ actor, page, slot }) {
        const original = await selectRows("account_activations", "*", {
          user_id: actor.identityId,
        });
        const activationPassword = `${actor.password}-activation`;
        await deleteRows("account_activations", { user_id: actor.identityId });
        await clearSession(slot);
        await page.locator('input[name="email"]').fill(actor.email);
        await page.locator('input[name="password"]').fill(actor.password);
        await page.getByRole("button", { name: "Sign in" }).click();
        await page.waitForURL("/en/auth/activate");
        await page.locator('input[name="password"]').fill(activationPassword);
        await page.locator('input[name="passwordConfirmation"]').fill(activationPassword);
        await page.locator('input[name="age18Attested"]').check();
        await page.locator('input[name="israelAttested"]').check();
        return { original };
      },
      async trigger({ page }) {
        await page.getByRole("button", { name: "Activate account" }).click();
      },
      async stable({ page }) {
        await page.waitForURL(/\/en\/today\?date=\d{4}-\d{2}-\d{2}$/);
        await page.getByRole("button", { name: "Sign out" }).waitFor();
      },
      async failureDiagnostic({ page }) {
        const status = (await page.locator("#activation-form-status").textContent().catch(() => ""))?.trim();
        const errorCode = [
          ["We could not complete activation. Check the details and try again.", "activationFailed"],
          ["Confirm the 18+ participation boundary.", "ageRequired"],
          ["Confirm the Israel participation boundary.", "israelRequired"],
          ["Supabase environment values are missing on this machine.", "missingConfig"],
          ["The passwords do not match.", "passwordMismatch"],
          ["Enter a password.", "passwordRequired"],
          ["Password must be at least 6 characters.", "passwordTooShort"],
        ].find(([message]) => message === status)?.[1] ?? "none";
        return {
          currentPath: new URL(page.url()).pathname,
          errorCode,
        };
      },
      async integrity({ actor }) {
        return countRows("account_activations", { user_id: actor.identityId }).then((count) => count === 1);
      },
      async cleanup({ actor, page, state }) {
        await page.context().clearCookies();
        const restored = await administrator.auth.admin.updateUserById(actor.identityId, {
          password: actor.password,
        });
        if (restored.error) throw new Error("activation_password_restore_failed");
        await deleteRows("account_activations", { user_id: actor.identityId });
        await insertRows("account_activations", state.original);
      },
    }),
    definition({
      metricId: "PERF-001",
      id: "sign_in",
      journeys: ["CJ-004"],
      threshold: 1_000,
      focused: true,
      triggerId: "auth.sign-in.submit",
      triggerDescription: "Click the localized Sign in form submit button.",
      expectedMethod: "POST",
      expectedPath: "/en/auth/sign-in",
      serverRouteTemplate: "/[locale]/auth/sign-in",
      stableConditionId: "auth.sign-in.today-visible",
      stableDescription: "The browser has reached the localized Today page.",
      stableRouteTemplate: "/[locale]/today",
      async prepare({ actor, slot }) {
        await clearSession(slot);
        await slot.page.locator('input[name="email"]').fill(actor.email);
        await slot.page.locator('input[name="password"]').fill(actor.password);
        return {};
      },
      async trigger({ page }) {
        await page.getByRole("button", { name: "Sign in" }).click();
      },
      async stable({ page }) {
        await page.waitForURL(/\/en\/today\?date=\d{4}-\d{2}-\d{2}$/);
        await page.getByRole("button", { name: "Sign out" }).waitFor();
      },
      async integrity({ page }) {
        return /\/en\/today/.test(new URL(page.url()).pathname);
      },
      async cleanup({ page }) {
        await page.context().clearCookies();
      },
    }),
    definition({
      metricId: "PERF-001",
      id: "sign_out",
      journeys: ["CJ-005"],
      threshold: 1_000,
      focused: true,
      triggerId: "auth.sign-out.submit",
      triggerDescription: "Click the authenticated application Sign out button.",
      expectedMethod: "POST",
      expectedPath: "/en/today",
      serverRouteTemplate: "/[locale]/today",
      stableConditionId: "auth.sign-out.sign-in-visible",
      stableDescription: "The localized public entry page is visible and the authenticated shell is absent.",
      stableRouteTemplate: "/[locale]",
      async prepare({ actor, page }) {
        await ensureSignedIn(page, actor);
        await page.goto(`/en/today?date=${date}`);
        await page.getByRole("button", { name: "Sign out" }).waitFor();
        return {};
      },
      async trigger({ page }) {
        await page.getByRole("button", { name: "Sign out" }).click();
      },
      async stable({ page }) {
        await page.waitForURL(/\/en$/);
        await page.getByRole("link", { name: "Sign in", exact: true }).waitFor();
      },
      async integrity({ page }) {
        return (
          new URL(page.url()).pathname === "/en" &&
          (await page.getByRole("button", { name: "Sign out" }).count()) === 0
        );
      },
    }),
    definition({
      metricId: "PERF-001",
      id: "recovery_request",
      journeys: ["CJ-007"],
      threshold: 1_000,
      focused: true,
      triggerId: "auth.recovery-request.submit",
      triggerDescription: "Click Request recovery instructions after entering the synthetic identity email.",
      expectedMethod: "POST",
      expectedPath: "/en/auth/recover",
      serverRouteTemplate: "/[locale]/auth/recover",
      stableConditionId: "auth.recovery-request.generic-status-visible",
      stableDescription: "The enumeration-safe localized recovery-request success status is visible.",
      stableRouteTemplate: "/[locale]/auth/recover",
      async prepare({ actor, slot }) {
        await administrator.auth.admin.updateUserById(actor.identityId, {
          password: actor.password,
        });
        helpers.psql(`update auth.users set recovery_sent_at = null where id = '${actor.identityId}'::uuid;`);
        await clearSession(slot);
        await slot.page.goto("/en/auth/recover");
        await slot.page.locator('input[name="email"]').fill(actor.email);
        return {};
      },
      async trigger({ page }) {
        await page.getByRole("button", { name: "Request recovery instructions" }).click();
      },
      async stable({ page }) {
        const status = page.locator("#recovery-request-status");
        await status.getByText(/If an eligible account exists/i).waitFor();
      },
      async integrity({ actor }) {
        return helpers.psql(
          `select recovery_sent_at is not null from auth.users where id = '${actor.identityId}'::uuid;`,
        ) === "t";
      },
    }),
    definition({
      metricId: "PERF-001",
      id: "recovery_completion",
      journeys: ["CJ-008"],
      threshold: 1_000,
      focused: true,
      triggerId: "auth.recovery-completion.submit",
      triggerDescription: "Click the recovery reset submit after loading the real application callback/reset flow.",
      expectedMethod: "POST",
      expectedPath: "/en/auth/recover/reset",
      serverRouteTemplate: "/[locale]/auth/recover/reset",
      stableConditionId: "auth.recovery-completion.sign-in-visible",
      stableDescription: "The browser reaches the localized Sign in page with recovery completion state.",
      stableRouteTemplate: "/[locale]/auth/sign-in",
      async prepare({ actor, slot }) {
        await clearSession(slot);
        const generated = await administrator.auth.admin.generateLink({
          email: actor.email,
          type: "recovery",
        });
        const tokenHash = generated.data?.properties?.hashed_token;
        if (generated.error || !tokenHash) {
          throw new Error("Could not prepare a local recovery completion.");
        }
        await slot.page.goto(
          `/en/auth/recover/confirm?token_hash=${encodeURIComponent(tokenHash)}&type=recovery`,
        );
        await slot.page.waitForURL("/en/auth/recover/reset");
        const originalPassword = actor.password;
        const replacement = alternatePassword(actor.password);
        await slot.page.locator('input[name="password"]').fill(replacement);
        await slot.page.locator('input[name="passwordConfirmation"]').fill(replacement);
        return { originalPassword, replacement };
      },
      async trigger({ page }) {
        await page.getByRole("button", { name: "Update password" }).click();
      },
      async stable({ page }) {
        await page.waitForURL(/\/en\/auth\/sign-in\?recovery=complete$/);
        await page.getByRole("heading", { level: 1, name: "Sign in" }).waitFor();
      },
      async integrity({ actor, state }) {
        const client = createClient(apiUrl, publishableKey, {
          auth: { autoRefreshToken: false, persistSession: false },
        });
        const signedIn = await client.auth.signInWithPassword({
          email: actor.email,
          password: state.replacement,
        });
        if (signedIn.error || !signedIn.data.session) return false;
        await client.auth.signOut({ scope: "local" });
        actor.password = state.replacement;
        return true;
      },
      async cleanup({ actor, page, state }) {
        const restored = await administrator.auth.admin.updateUserById(actor.identityId, {
          password: state.originalPassword,
        });
        if (restored.error) throw new Error("Could not restore the local recovery actor.");
        actor.password = state.originalPassword;
        await page.context().clearCookies();
      },
    }),
    definition({
      metricId: "PERF-002",
      id: "setup",
      journeys: ["CJ-009", "CJ-010"],
      threshold: 1_000,
      focused: true,
      triggerId: "setup.initial.submit",
      triggerDescription: "Click the initial setup Save setup button after completing profile and target fields.",
      expectedMethod: "POST",
      expectedPath: "/en/setup",
      serverRouteTemplate: "/[locale]/setup",
      stableConditionId: "setup.initial.today-stable",
      stableDescription: "The localized Today page for the effective date is visible after committed setup.",
      stableRouteTemplate: "/[locale]/today",
      async prepare({ actor, page, profile, concurrency, sampleIndex }) {
        await ensureSignedIn(page, actor);
        const profiles = await selectRows("profiles", "*", { id: actor.identityId });
        const targets = await selectRows("nutrition_targets", "*", { user_id: actor.identityId });
        await deleteRows("nutrition_targets", { user_id: actor.identityId });
        await deleteRows("profiles", { id: actor.identityId });
        await page.goto(`/en/setup?effectiveDate=${date}`);
        const displayName = `G2 setup ${profile} ${concurrency} ${sampleIndex}`;
        await page.locator('input[name="display_name"]').fill(displayName);
        await page.locator('select[name="preferred_language"]').selectOption("en");
        for (const [name, value] of [
          ["calories", "2100"],
          ["protein_g", "110"],
          ["carbohydrates_g", "230"],
          ["fat_g", "70"],
        ]) await page.locator(`input[name="${name}"]`).fill(value);
        return { displayName, profiles, targets };
      },
      async trigger({ page }) {
        await page.getByRole("button", { name: "Save setup" }).click();
      },
      async stable({ page }) {
        await page.waitForURL(`/en/today?date=${date}`);
        await page.getByTestId("target-summary").waitFor();
      },
      async integrity({ actor, state }) {
        const profiles = await selectRows("profiles", "display_name", { id: actor.identityId });
        const targets = await selectRows("nutrition_targets", "effective_from", {
          effective_from: date,
          user_id: actor.identityId,
        });
        return profiles[0]?.display_name === state.displayName && targets.length === 1;
      },
      async cleanup({ actor, state }) {
        await deleteRows("nutrition_targets", { user_id: actor.identityId });
        await deleteRows("profiles", { id: actor.identityId });
        await insertRows("profiles", state.profiles);
        await insertRows("nutrition_targets", state.targets);
      },
    }),
    definition({
      metricId: "PERF-002",
      id: "target_update",
      journeys: ["CJ-011"],
      threshold: 1_000,
      triggerId: "setup.target-update.submit",
      triggerDescription: "Click Save changes on setup for an existing effective-dated target.",
      expectedMethod: "POST",
      expectedPath: "/en/setup",
      serverRouteTemplate: "/[locale]/setup",
      stableConditionId: "setup.target-update.today-stable",
      stableDescription: "The Today target summary is visible for the updated effective date.",
      stableRouteTemplate: "/[locale]/today",
      async prepare({ actor, page, concurrency, sampleIndex }) {
        await ensureSignedIn(page, actor);
        const effectiveDate = "2026-07-31";
        const profileRows = await selectRows("profiles", "*", { id: actor.identityId });
        const targetRows = await selectRows("nutrition_targets", "*", {
          effective_from: effectiveDate,
          user_id: actor.identityId,
        });
        if (profileRows.length !== 1 || targetRows.length !== 1) {
          throw new Error("The target-update fixture is incomplete.");
        }
        await page.goto(`/en/setup?effectiveDate=${effectiveDate}`);
        const calories = 2_200 + concurrency + sampleIndex;
        await page.locator('select[name="preferred_language"]').selectOption("en");
        await page.locator('input[name="calories"]').fill(String(calories));
        return { calories, effectiveDate, profileRows, targetRows };
      },
      async trigger({ page }) {
        await page.getByRole("button", { name: "Save changes" }).click();
      },
      async stable({ page, state }) {
        await page.waitForURL(`/en/today?date=${state.effectiveDate}`);
        await page.getByTestId("target-summary").waitFor();
      },
      async integrity({ actor, state }) {
        const rows = await selectRows("nutrition_targets", "calories", {
          effective_from: state.effectiveDate,
          user_id: actor.identityId,
        });
        return rows[0]?.calories === state.calories;
      },
      async cleanup({ actor, state }) {
        await updateRows("profiles", state.profileRows[0], { id: actor.identityId });
        await updateRows("nutrition_targets", state.targetRows[0], {
          id: state.targetRows[0].id,
        });
      },
    }),
    definition({
      metricId: "PERF-002",
      id: "diary_create",
      journeys: ["CJ-012", "CJ-013"],
      threshold: 1_000,
      focused: true,
      triggerId: "diary.create.submit",
      triggerDescription: "Click Add entry on the real manual diary form.",
      expectedMethod: "POST",
      expectedPath: "/en/today",
      serverRouteTemplate: "/[locale]/today",
      stableConditionId: "diary.create.committed-row-visible",
      stableDescription: "Entry added status and the committed diary row are both visible.",
      stableRouteTemplate: "/[locale]/today",
      async prepare({ actor, page, profile, concurrency, sampleIndex }) {
        await ensureSignedIn(page, actor);
        await page.goto(`/en/today?date=${date}`);
        const form = page.getByTestId("manual-diary-entry-form");
        const foodName = `G2 diary ${profile} ${concurrency} ${sampleIndex}`;
        await form.locator('select[name="meal_type"]').selectOption("snack");
        await form.locator('input[name="food_name"]').fill(foodName);
        await form.locator('input[name="serving_quantity"]').fill("1");
        await form.locator('input[name="serving_unit"]').fill("serving");
        await form.locator('input[name="calories"]').fill("100");
        await form.locator('input[name="protein_g"]').fill("5");
        await form.locator('input[name="carbohydrates_g"]').fill("10");
        await form.locator('input[name="fat_g"]').fill("3");
        const idempotencyKey = await form.locator('input[name="idempotency_key"]').inputValue();
        return { foodName, form, idempotencyKey };
      },
      async trigger({ state }) {
        await state.form.getByRole("button", { name: "Add entry" }).click();
      },
      async stable({ page, state }) {
        await state.form.getByText("Entry added.", { exact: true }).waitFor();
        await page.locator("[data-diary-entry-id]").filter({ hasText: state.foodName }).waitFor();
      },
      async integrity({ actor, state }) {
        const rows = await selectRows("diary_entries", "id", {
          food_name: state.foodName,
          user_id: actor.identityId,
        });
        state.diaryId = rows[0]?.id;
        return rows.length === 1;
      },
      async cleanup({ state }) {
        await deleteRows("manual_diary_entry_requests", {
          idempotency_key: state.idempotencyKey,
        });
        if (state.diaryId) await deleteRows("diary_entries", { id: state.diaryId });
      },
    }),
    definition({
      metricId: "PERF-002",
      id: "diary_edit",
      journeys: ["CJ-014"],
      threshold: 1_000,
      triggerId: "diary.edit.submit",
      triggerDescription: "Click Save changes in the real diary entry editor.",
      expectedMethod: "POST",
      expectedPath: "/en/today",
      serverRouteTemplate: "/[locale]/today",
      stableConditionId: "diary.edit.committed-row-visible",
      stableDescription: "Entry updated status and the committed edited value are visible in the diary row.",
      stableRouteTemplate: "/[locale]/today",
      async prepare({ actor, page, profile, concurrency, sampleIndex }) {
        await ensureSignedIn(page, actor);
        const rows = await selectRows(
          "diary_entries",
          "id,entry_date,food_name,version,updated_at",
          { source: "manual", user_id: actor.identityId },
          { limit: 1, order: "created_at" },
        );
        const original = rows[0];
        if (!original) throw new Error("The diary-edit fixture is incomplete.");
        await page.goto(`/en/today?date=${original.entry_date}`);
        const row = page.locator(`[data-diary-entry-id="${original.id}"]`);
        await row.getByRole("button", { name: "Edit" }).click();
        const foodName = `G2 edit ${profile} ${concurrency} ${sampleIndex}`;
        await row.locator('input[name="food_name"]').fill(foodName);
        return { foodName, original, row };
      },
      async trigger({ state }) {
        await state.row.getByRole("button", { name: "Save changes" }).click();
      },
      async stable({ state }) {
        await state.row.getByText("Entry updated.", { exact: true }).waitFor();
        await state.row.getByText(state.foodName, { exact: true }).waitFor();
      },
      async integrity({ state }) {
        const rows = await selectRows("diary_entries", "food_name,version", {
          id: state.original.id,
        });
        return rows[0]?.food_name === state.foodName && rows[0]?.version === state.original.version + 1;
      },
      async cleanup({ state }) {
        await updateRows(
          "diary_entries",
          {
            food_name: state.original.food_name,
            updated_at: state.original.updated_at,
            version: state.original.version,
          },
          { id: state.original.id },
        );
      },
    }),
    definition({
      metricId: "PERF-002",
      id: "diary_delete",
      journeys: ["CJ-015"],
      threshold: 1_000,
      triggerId: "diary.delete.submit",
      triggerDescription: "Click Delete on a real diary entry row.",
      expectedMethod: "POST",
      expectedPath: "/en/today",
      serverRouteTemplate: "/[locale]/today",
      stableConditionId: "diary.delete.row-absent",
      stableDescription: "The deleted diary row is absent from the refreshed stable UI.",
      stableRouteTemplate: "/[locale]/today",
      async prepare({ actor, page, profile, concurrency, sampleIndex }) {
        await ensureSignedIn(page, actor);
        const source = (await selectRows(
          "diary_entries",
          "*",
          { source: "manual", user_id: actor.identityId },
          { limit: 1, order: "created_at" },
        ))[0];
        if (!source) throw new Error("The diary-delete fixture is incomplete.");
        const id = crypto.randomUUID();
        const row = {
          ...source,
          created_at: new Date().toISOString(),
          entry_date: date,
          food_name: `G2 delete ${profile} ${concurrency} ${sampleIndex}`,
          id,
          updated_at: new Date().toISOString(),
          version: 1,
        };
        await insertRows("diary_entries", [row]);
        await page.goto(`/en/today?date=${date}`);
        const locator = page.locator(`[data-diary-entry-id="${id}"]`);
        await locator.waitFor();
        return { id, locator };
      },
      async trigger({ state }) {
        await state.locator.getByRole("button", { name: "Delete" }).click();
      },
      async stable({ state }) {
        await state.locator.waitFor({ state: "detached" });
      },
      async integrity({ state }) {
        return countRows("diary_entries", { id: state.id }).then((count) => count === 0);
      },
      async cleanup({ state }) {
        await deleteRows("diary_entries", { id: state.id });
      },
    }),
    definition({
      metricId: "PERF-003",
      id: "search",
      journeys: ["CJ-016"],
      threshold: 750,
      focused: true,
      triggerId: "foods.search.submit",
      triggerDescription: "Click Search foods after entering the launch-shaped ranked query.",
      expectedMethod: "GET",
      expectedPath: "/en/foods",
      serverRouteTemplate: "/[locale]/foods",
      stableConditionId: "foods.search.ranked-results-visible",
      stableDescription: "The ranked result list is visible and contains the expected 20 results.",
      stableRouteTemplate: "/[locale]/foods",
      async prepare({ actor, page }) {
        await ensureSignedIn(page, actor);
        await page.goto(`/en/foods?date=${date}`);
        await page.locator('input[name="q"]').fill("Launch Apple");
        return {};
      },
      async trigger({ page }) {
        await page.getByRole("button", { name: "Search foods" }).click();
      },
      async stable({ page }) {
        await page.waitForURL(/\/en\/foods\?.*q=Launch(?:\+|%20)Apple/);
        await page.getByTestId("food-search-results").waitFor();
        await page.getByTestId("food-search-results").getByRole("listitem").nth(19).waitFor();
      },
      async integrity({ page }) {
        return page.getByTestId("food-search-results").getByRole("listitem").count().then((count) => count === 20);
      },
    }),
    definition({
      metricId: "PERF-003",
      id: "prefill",
      journeys: ["CJ-017"],
      threshold: 750,
      triggerId: "foods.prefill.use-in-diary",
      triggerDescription: "Click Use in diary on a real ranked food search result.",
      expectedMethod: "GET",
      expectedPath: "/en/today",
      serverRouteTemplate: "/[locale]/today",
      stableConditionId: "foods.prefill.editable-form-visible",
      stableDescription: "The selected-food summary and editable diary prefill are visible.",
      stableRouteTemplate: "/[locale]/today",
      async prepare({ actor, page }) {
        await ensureSignedIn(page, actor);
        await page.goto(`/en/foods?date=${date}&q=Launch+Apple`);
        const link = page.getByTestId("food-search-results").getByRole("link", { name: "Use in diary" }).first();
        const href = await link.getAttribute("href");
        const foodId = href ? new URL(href, "http://local").searchParams.get("foodId") : null;
        if (!foodId) throw new Error("The food-prefill fixture is incomplete.");
        return { foodId, link };
      },
      async trigger({ state }) {
        await state.link.click();
      },
      async stable({ page }) {
        await page.getByTestId("selected-food-summary").waitFor();
        await page.getByTestId("manual-diary-entry-form").waitFor();
      },
      async integrity({ page, state }) {
        return (await page.locator('input[name="food_id"]').inputValue()) === state.foodId;
      },
    }),
  ];

  async function firstOwned(table, columns, ownerColumn, actor) {
    const rows = await selectRows(
      table,
      columns,
      { [ownerColumn]: actor.identityId },
      { limit: 1, order: "created_at" },
    );
    if (!rows[0]) throw new Error(`The ${table} fixture is incomplete.`);
    return rows[0];
  }

  operations.push(
    definition({
      metricId: "PERF-004",
      id: "custom_food_create",
      journeys: ["CJ-018"],
      threshold: 1_250,
      triggerId: "custom-food.create.submit",
      triggerDescription: "Click Create custom food on the accepted custom-food form.",
      expectedMethod: "POST",
      expectedPath: "/en/foods/custom/new",
      serverRouteTemplate: "/[locale]/foods/custom/new",
      stableConditionId: "custom-food.create.editor-success",
      stableDescription: "The created-food editor URL and creation success status are visible.",
      stableRouteTemplate: "/[locale]/foods/custom/[id]/edit",
      async prepare({ actor, page, profile, concurrency, sampleIndex }) {
        await ensureSignedIn(page, actor);
        await page.goto("/en/foods/custom/new");
        const name = `G2 custom ${profile} ${concurrency} ${sampleIndex}`;
        await page.locator('input[name="name"]').fill(name);
        await page.locator('input[name="serving_quantity"]').fill("1");
        await page.locator('input[name="serving_unit"]').fill("serving");
        const creationKey = await page.locator('input[name="creation_key"]').inputValue();
        return { creationKey, name };
      },
      async trigger({ page }) {
        await page.getByRole("button", { name: "Create custom food" }).click();
      },
      async stable({ page, state }) {
        await page.getByTestId("custom-food-success").waitFor();
        state.foodId = requireUuidFromUrl(page, /\/foods\/custom\/([0-9a-f-]+)\/edit\?saved=created$/);
      },
      async integrity({ actor, state }) {
        const rows = await selectRows("foods", "name", {
          id: state.foodId,
          owner_user_id: actor.identityId,
        });
        return rows[0]?.name === state.name;
      },
      async cleanup({ state }) {
        await deleteRows("custom_food_creation_requests", { idempotency_key: state.creationKey });
        await deleteRows("foods", { id: state.foodId });
      },
    }),
    definition({
      metricId: "PERF-004",
      id: "custom_food_edit",
      journeys: ["CJ-019", "CJ-020"],
      threshold: 1_250,
      triggerId: "custom-food.edit.submit",
      triggerDescription: "Click Save custom food in the owned custom-food editor.",
      expectedMethod: "POST",
      expectedPath: null,
      expectedPathFor: (state) => state.expectedPath,
      serverRouteTemplate: "/[locale]/foods/custom/[id]/edit",
      stableConditionId: "custom-food.edit.editor-success",
      stableDescription: "The updated editor URL, success status, and committed name are visible.",
      stableRouteTemplate: "/[locale]/foods/custom/[id]/edit",
      async prepare({ actor, page, profile, concurrency, sampleIndex }) {
        await ensureSignedIn(page, actor);
        const original = await firstOwned(
          "foods",
          "id,name,custom_food_edit_revision,updated_at",
          "owner_user_id",
          actor,
        );
        const expectedPath = `/en/foods/custom/${original.id}/edit`;
        await page.goto(expectedPath);
        const name = `G2 custom edit ${profile} ${concurrency} ${sampleIndex}`;
        await page.locator('input[name="name"]').fill(name);
        return { expectedPath, name, original };
      },
      async trigger({ page }) {
        await page.getByRole("button", { name: "Save custom food" }).click();
      },
      async stable({ page, state }) {
        await page.waitForURL(`${state.expectedPath}?saved=updated`);
        await page.getByTestId("custom-food-success").waitFor();
      },
      async integrity({ state }) {
        const rows = await selectRows("foods", "name", { id: state.original.id });
        return rows[0]?.name === state.name;
      },
      async cleanup({ state }) {
        await updateRows("foods", {
          name: state.original.name,
        }, { id: state.original.id });
      },
    }),
  );

  operations.push(
    definition({
      metricId: "PERF-004",
      id: "saved_meal_create",
      journeys: ["CJ-021"],
      threshold: 1_250,
      triggerId: "saved-meal.create.submit",
      triggerDescription: "Click Create saved meal on the real blank saved-meal form.",
      expectedMethod: "POST",
      expectedPath: "/en/saved-meals/new",
      serverRouteTemplate: "/[locale]/saved-meals/new",
      stableConditionId: "saved-meal.create.editor-success",
      stableDescription: "The created saved-meal editor and creation success status are visible.",
      stableRouteTemplate: "/[locale]/saved-meals/[id]/edit",
      async prepare({ actor, page, profile, concurrency, sampleIndex }) {
        await ensureSignedIn(page, actor);
        await page.goto("/en/saved-meals/new");
        const name = `G2 meal ${profile} ${concurrency} ${sampleIndex}`;
        await page.locator('input[name="name"]').fill(name);
        for (const [field, value] of [
          ["item_food_name_0", "Synthetic measured item"],
          ["item_serving_quantity_0", "1"],
          ["item_serving_unit_0", "serving"],
          ["item_calories_0", "100"],
          ["item_protein_g_0", "5"],
          ["item_carbohydrates_g_0", "10"],
          ["item_fat_g_0", "3"],
        ]) await page.locator(`[name="${field}"]`).fill(value);
        return { name };
      },
      async trigger({ page }) {
        await page.getByRole("button", { name: "Create saved meal" }).click();
      },
      async stable({ page, state }) {
        await page.getByTestId("saved-meal-success").waitFor();
        state.savedMealId = requireUuidFromUrl(page, /\/saved-meals\/([0-9a-f-]+)\/edit\?saved=created$/);
      },
      async integrity({ actor, state }) {
        const rows = await selectRows("saved_meals", "name", {
          id: state.savedMealId,
          user_id: actor.identityId,
        });
        const items = await countRows("saved_meal_items", { saved_meal_id: state.savedMealId });
        return rows[0]?.name === state.name && items === 1;
      },
      async cleanup({ state }) {
        await deleteRows("saved_meals", { id: state.savedMealId });
      },
    }),
    definition({
      metricId: "PERF-004",
      id: "saved_meal_edit",
      journeys: ["CJ-022", "CJ-023"],
      threshold: 1_250,
      triggerId: "saved-meal.edit.submit",
      triggerDescription: "Click Save changes in the owned saved-meal editor.",
      expectedMethod: "POST",
      expectedPath: null,
      expectedPathFor: (state) => state.expectedPath,
      serverRouteTemplate: "/[locale]/saved-meals/[id]/edit",
      stableConditionId: "saved-meal.edit.editor-success",
      stableDescription: "The updated saved-meal editor, success status, and committed name are visible.",
      stableRouteTemplate: "/[locale]/saved-meals/[id]/edit",
      async prepare({ actor, page, profile, concurrency, sampleIndex }) {
        await ensureSignedIn(page, actor);
        const original = await firstOwned(
          "saved_meals",
          "id,name,saved_meal_edit_revision,updated_at",
          "user_id",
          actor,
        );
        const expectedPath = `/en/saved-meals/${original.id}/edit`;
        await page.goto(expectedPath);
        const name = `G2 meal edit ${profile} ${concurrency} ${sampleIndex}`;
        await page.locator('input[name="name"]').fill(name);
        return { expectedPath, name, original };
      },
      async trigger({ page }) {
        await page.getByRole("button", { name: "Save changes" }).click();
      },
      async stable({ page, state }) {
        await page.waitForURL(`${state.expectedPath}?saved=updated`);
        await page.getByTestId("saved-meal-success").waitFor();
      },
      async integrity({ state }) {
        const rows = await selectRows("saved_meals", "name", { id: state.original.id });
        return rows[0]?.name === state.name;
      },
    }),
    definition({
      metricId: "PERF-004",
      id: "saved_meal_use",
      journeys: ["CJ-024"],
      threshold: 1_250,
      triggerId: "saved-meal.use.submit",
      triggerDescription: "Click Confirm and log all items on the accepted saved-meal review.",
      expectedMethod: "POST",
      expectedPath: null,
      expectedPathFor: (state) => state.expectedPath,
      serverRouteTemplate: "/[locale]/saved-meals/[id]/use",
      stableConditionId: "saved-meal.use.diary-success",
      stableDescription: "The Today page and saved-meal logged success state are visible after atomic logging.",
      stableRouteTemplate: "/[locale]/today",
      async prepare({ actor, page }) {
        await ensureSignedIn(page, actor);
        const meal = await firstOwned("saved_meals", "id", "user_id", actor);
        const expectedPath = `/en/saved-meals/${meal.id}/use`;
        await page.goto(`${expectedPath}?date=2026-08-27`);
        await page.locator('select[name="meal_type"]').selectOption("dinner");
        return { expectedPath, mealId: meal.id };
      },
      async trigger({ page }) {
        await page.getByRole("button", { name: "Confirm and log all items" }).click();
      },
      async stable({ page }) {
        await page.waitForURL("/en/today?date=2026-08-27&savedMeal=logged");
        await page.getByTestId("saved-meal-logged-success").waitFor();
      },
      async integrity({ actor, state }) {
        const runs = await selectRows("saved_meal_diary_runs", "id", {
          entry_date: "2026-08-27",
          saved_meal_id: state.mealId,
          user_id: actor.identityId,
        });
        state.runId = runs.at(-1)?.id;
        return Boolean(state.runId) && (await countRows("diary_entries", {
          saved_meal_diary_run_id: state.runId,
        })) > 0;
      },
      async cleanup({ state }) {
        if (!state.runId) return;
        await deleteRows("diary_entries", { saved_meal_diary_run_id: state.runId });
        await deleteRows("saved_meal_diary_runs", { id: state.runId });
      },
    }),
    definition({
      metricId: "PERF-004",
      id: "recipe_create",
      journeys: ["CJ-025"],
      threshold: 1_250,
      triggerId: "recipe.create.submit",
      triggerDescription: "Click Create recipe on the real blank recipe form.",
      expectedMethod: "POST",
      expectedPath: "/en/recipes/new",
      serverRouteTemplate: "/[locale]/recipes/new",
      stableConditionId: "recipe.create.editor-success",
      stableDescription: "The created recipe editor and creation success status are visible.",
      stableRouteTemplate: "/[locale]/recipes/[id]/edit",
      async prepare({ actor, page, profile, concurrency, sampleIndex }) {
        await ensureSignedIn(page, actor);
        await page.goto("/en/recipes/new");
        const name = `G2 recipe ${profile} ${concurrency} ${sampleIndex}`;
        await page.locator('input[name="name"]').fill(name);
        await page.locator('input[name="yield_servings"]').fill("4");
        for (const [field, value] of [
          ["ingredient_ingredient_name_0", "Synthetic measured ingredient"],
          ["ingredient_quantity_0", "1"],
          ["ingredient_unit_0", "portion"],
          ["ingredient_calories_0", "100"],
          ["ingredient_protein_g_0", "5"],
          ["ingredient_carbohydrates_g_0", "10"],
          ["ingredient_fat_g_0", "3"],
        ]) await page.locator(`[name="${field}"]`).fill(value);
        return { name };
      },
      async trigger({ page }) {
        await page.getByRole("button", { name: "Create recipe" }).click();
      },
      async stable({ page, state }) {
        await page.getByTestId("recipe-success").waitFor();
        state.recipeId = requireUuidFromUrl(page, /\/recipes\/([0-9a-f-]+)\/edit\?saved=created$/);
      },
      async integrity({ actor, state }) {
        const rows = await selectRows("recipes", "name", {
          id: state.recipeId,
          user_id: actor.identityId,
        });
        return rows[0]?.name === state.name && (await countRows("recipe_ingredients", {
          recipe_id: state.recipeId,
        })) === 1;
      },
      async cleanup({ state }) {
        await deleteRows("recipes", { id: state.recipeId });
      },
    }),
    definition({
      metricId: "PERF-004",
      id: "recipe_edit",
      journeys: ["CJ-025", "CJ-026"],
      threshold: 1_250,
      triggerId: "recipe.edit.submit",
      triggerDescription: "Click Save changes in the owned recipe editor.",
      expectedMethod: "POST",
      expectedPath: null,
      expectedPathFor: (state) => state.expectedPath,
      serverRouteTemplate: "/[locale]/recipes/[id]/edit",
      stableConditionId: "recipe.edit.editor-success",
      stableDescription: "The updated recipe editor, success status, and committed name are visible.",
      stableRouteTemplate: "/[locale]/recipes/[id]/edit",
      async prepare({ actor, page, profile, concurrency, sampleIndex }) {
        await ensureSignedIn(page, actor);
        const original = await firstOwned(
          "recipes",
          "id,name,recipe_edit_revision,updated_at",
          "user_id",
          actor,
        );
        const expectedPath = `/en/recipes/${original.id}/edit`;
        await page.goto(expectedPath);
        const name = `G2 recipe edit ${profile} ${concurrency} ${sampleIndex}`;
        await page.locator('input[name="name"]').fill(name);
        return { expectedPath, name, original };
      },
      async trigger({ page }) {
        await page.getByRole("button", { name: "Save changes" }).click();
      },
      async stable({ page, state }) {
        await page.waitForURL(`${state.expectedPath}?saved=updated`);
        await page.getByTestId("recipe-success").waitFor();
      },
      async integrity({ state }) {
        const rows = await selectRows("recipes", "name", { id: state.original.id });
        return rows[0]?.name === state.name;
      },
      async cleanup({ state }) {
        await updateRows("recipes", {
          name: state.original.name,
        }, { id: state.original.id });
      },
    }),
    definition({
      metricId: "PERF-004",
      id: "recipe_calculate",
      journeys: ["CJ-027"],
      threshold: 1_250,
      triggerId: "recipe.calculate.submit",
      triggerDescription: "Click Calculate and review after changing requested servings.",
      expectedMethod: "GET",
      expectedPath: null,
      expectedPathFor: (state) => state.expectedPath,
      serverRouteTemplate: "/[locale]/recipes/[id]/use",
      stableConditionId: "recipe.calculate.review-ready",
      stableDescription: "The recalculated recipe review-ready state is visible with canonical servings.",
      stableRouteTemplate: "/[locale]/recipes/[id]/use",
      async prepare({ actor, page }) {
        await ensureSignedIn(page, actor);
        const recipe = await firstOwned("recipes", "id", "user_id", actor);
        const expectedPath = `/en/recipes/${recipe.id}/use`;
        await page.goto(`${expectedPath}?date=2026-08-26&mealType=lunch&servings=1`);
        await page.locator('input[name="servings"]').fill("2");
        return { expectedPath, recipeId: recipe.id };
      },
      async trigger({ page }) {
        await page.getByRole("button", { name: "Calculate and review" }).click();
      },
      async stable({ page }) {
        await page.getByTestId("recipe-review-ready").waitFor();
        await page.waitForURL(/servings=2/);
      },
      async integrity({ page }) {
        return (await page.locator('input[name="servings"]').inputValue()) === "2";
      },
    }),
    definition({
      metricId: "PERF-004",
      id: "recipe_use",
      journeys: ["CJ-027"],
      threshold: 1_250,
      triggerId: "recipe.use.submit",
      triggerDescription: "Click Add reviewed recipe to diary on the accepted review-ready state.",
      expectedMethod: "POST",
      expectedPath: null,
      expectedPathFor: (state) => state.expectedPath,
      serverRouteTemplate: "/[locale]/recipes/[id]/use",
      stableConditionId: "recipe.use.diary-success",
      stableDescription: "The Today page and recipe logged success state are visible after atomic logging.",
      stableRouteTemplate: "/[locale]/today",
      async prepare({ actor, page }) {
        await ensureSignedIn(page, actor);
        const recipe = await firstOwned("recipes", "id", "user_id", actor);
        const expectedPath = `/en/recipes/${recipe.id}/use`;
        await page.goto(`${expectedPath}?date=2026-08-26&mealType=lunch&servings=1`);
        await page.getByTestId("recipe-review-ready").waitFor();
        return { expectedPath, recipeId: recipe.id };
      },
      async trigger({ page }) {
        await page.getByRole("button", { name: "Add reviewed recipe to diary" }).click();
      },
      async stable({ page }) {
        await page.waitForURL("/en/today?date=2026-08-26&recipe=logged");
        await page.getByTestId("recipe-logged-success").waitFor();
      },
      async integrity({ actor, state }) {
        const runs = await selectRows("recipe_diary_runs", "id", {
          entry_date: "2026-08-26",
          recipe_id: state.recipeId,
          user_id: actor.identityId,
        });
        state.runId = runs.at(-1)?.id;
        return Boolean(state.runId) && (await countRows("diary_entries", {
          recipe_diary_run_id: state.runId,
        })) === 1;
      },
      async cleanup({ state }) {
        if (!state.runId) return;
        await deleteRows("diary_entries", { recipe_diary_run_id: state.runId });
        await deleteRows("recipe_diary_runs", { id: state.runId });
      },
    }),
  );

  function barcodeOperation({ id, status, code }) {
    return definition({
      metricId: "PERF-005",
      id,
      journeys: status === "found_owned"
        ? ["CJ-028", "CJ-029"]
        : status === "found_public"
          ? ["CJ-028", "CJ-030"]
          : ["CJ-028", "CJ-031"],
      threshold: 750,
      triggerId: `barcode.${status}.submit`,
      triggerDescription: "Click Look up barcode on the supported manual barcode form.",
      expectedMethod: "GET",
      expectedPath: "/en/foods/barcode",
      serverRouteTemplate: "/[locale]/foods/barcode",
      stableConditionId: `barcode.${status}.stable-result`,
      stableDescription: `The deterministic ${status} manual barcode result is visible.`,
      stableRouteTemplate: "/[locale]/foods/barcode",
      async prepare({ actor, page }) {
        await ensureSignedIn(page, actor);
        let resolvedCode = code;
        if (!resolvedCode && status === "found_owned") {
          resolvedCode = (await selectRows(
            "food_barcodes",
            "canonical_gtin",
            { scope_owner_user_id: actor.identityId },
            { limit: 1 },
          ))[0]?.canonical_gtin;
        }
        if (!resolvedCode && status === "found_public") {
          resolvedCode = (await selectRows(
            "food_barcodes",
            "canonical_gtin",
            { scope_owner_user_id: null },
            { limit: 1 },
          ))[0]?.canonical_gtin;
        }
        if (!resolvedCode) throw new Error("The barcode fixture is incomplete.");
        await page.goto(`/en/foods/barcode?date=${date}`);
        await page.locator('input[name="code"]').fill(resolvedCode);
        return { code: resolvedCode };
      },
      async trigger({ page }) {
        await page.getByRole("button", { name: "Look up barcode" }).click();
      },
      async stable({ page }) {
        const testId = status === "not_found_local" ? "barcode-not-found" : `barcode-${status}`;
        await page.getByTestId(testId).waitFor();
      },
      async integrity({ page }) {
        const testId = status === "not_found_local" ? "barcode-not-found" : `barcode-${status}`;
        return page.getByTestId(testId).isVisible();
      },
    });
  }

  operations.push(
    barcodeOperation({ id: "barcode_owned", status: "found_owned" }),
    barcodeOperation({ id: "barcode_public", status: "found_public" }),
    barcodeOperation({ id: "barcode_miss", status: "not_found_local", code: "39999999999995" }),
    definition({
      metricId: "PERF-006",
      id: "account_closure",
      journeys: ["CJ-035"],
      threshold: 2_000,
      triggerId: "account.closure.submit",
      triggerDescription: "Click Close my account after accepted reauthentication and explicit confirmation.",
      expectedMethod: "POST",
      expectedPath: "/en/account/closure/submit",
      serverRouteTemplate: "/[locale]/account/closure/submit",
      stableConditionId: "account.closure.closed-state",
      stableDescription: "The explicit localized account-closed page is visible and the authenticated session is cleared.",
      stableRouteTemplate: "/[locale]/auth/account-closed",
      actor({ actorIndex, profile }) {
        return identities[(profile === "mobile" ? 10 : 0) + actorIndex];
      },
      async prepare({ actor, page }) {
        await deleteRows("account_closures", { user_id: actor.identityId });
        await page.context().clearCookies();
        await establishRecentAuthentication(page, actor, "account-closure");
        const beforeDiaryCount = await countRows("diary_entries", { user_id: actor.identityId });
        await page.locator('input[name="confirmClosure"]').check();
        return { beforeDiaryCount };
      },
      async trigger({ page }) {
        await page.getByRole("button", { name: "Close my account" }).click();
      },
      async stable({ page }) {
        await page.waitForURL("/en/auth/account-closed");
        await page.getByRole("heading", { level: 1, name: "Account closed" }).waitFor();
      },
      async integrity({ actor, page, state }) {
        const cookies = await page.context().cookies();
        return (
          (await countRows("account_closures", { user_id: actor.identityId })) === 1 &&
          (await countRows("diary_entries", { user_id: actor.identityId })) === state.beforeDiaryCount &&
          cookies.every((cookie) => !cookie.name.includes("auth-token"))
        );
      },
      async cleanup({ actor, page }) {
        await deleteRows("account_closures", { user_id: actor.identityId });
        await page.context().clearCookies();
      },
    }),
  );

  function exportOperation({ id, actorIndex, expected, concurrency, focused = true }) {
    return definition({
      metricId: "PERF-006",
      id,
      journeys: ["CJ-034"],
      threshold: 2_000,
      concurrency,
      focused,
      triggerId: "account.export.download",
      triggerDescription: "Click Download my data on the accepted synchronous account export page.",
      expectedMethod: "POST",
      expectedPath: "/en/account/export/download",
      serverRouteTemplate: "/[locale]/account/export/download",
      stableConditionId: "account.export.download-ready",
      stableDescription: "The browser download event resolves to a readable, versioned JSON export.",
      stableRouteTemplate: "/[locale]/account/export",
      actor({ actorIndex: concurrentActorIndex }) {
        return identities[actorIndex ?? concurrentActorIndex];
      },
      async prepare({ actor, page }) {
        await establishRecentAuthentication(page, actor, "account-export");
        const expectedDiaryEntries = expected ?? (actor.ordinal === 1
          ? 10
          : actor.ordinal === 2
            ? 180
            : actor.ordinal === 3
              ? 1_002
              : 30);
        const beforeCount = await countRows("diary_entries", { user_id: actor.identityId });
        return { beforeCount, expectedDiaryEntries };
      },
      async trigger({ page, state }) {
        state.downloadPromise = page.waitForEvent("download");
        await page.getByRole("button", { name: "Download my data" }).click();
      },
      async stable({ state }) {
        const download = await state.downloadPromise;
        const path = await download.path();
        if (!path) throw new Error("incorrect_visibility");
        state.payload = JSON.parse(await import("node:fs/promises").then(({ readFile }) => readFile(path, "utf8")));
      },
      async integrity({ actor, state }) {
        const afterCount = await countRows("diary_entries", { user_id: actor.identityId });
        state.afterCount = afterCount;
        state.observedEntryCount = state.payload?.diaryEntries?.length ?? -1;
        return (
          state.payload?.schema === "nutrition-tracker-account-export" &&
          state.payload?.version === 1 &&
          state.payload?.diaryEntries?.length === state.expectedDiaryEntries &&
          state.beforeCount === afterCount
        );
      },
      integrityDiagnostic(state) {
        return {
          afterEntryCount: state.afterCount,
          beforeEntryCount: state.beforeCount,
          expectedEntryCount: state.expectedDiaryEntries,
          observedEntryCount: state.observedEntryCount,
          schemaMatched: state.payload?.schema === "nutrition-tracker-account-export",
          versionMatched: state.payload?.version === 1,
        };
      },
    });
  }

  operations.push(
    exportOperation({ id: "account_export_small", actorIndex: 0, expected: 10, concurrency: [1] }),
    exportOperation({ id: "account_export_median", actorIndex: 1, expected: 180, concurrency: [1] }),
    exportOperation({ id: "account_export_maximum", actorIndex: 2, expected: 1_002, concurrency: [1] }),
    exportOperation({ id: "account_export_mixed_concurrent", concurrency: [10] }),
  );

  return operations;
}
