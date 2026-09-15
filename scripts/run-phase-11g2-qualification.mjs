import { execFileSync } from "node:child_process";
import { createHash, createHmac, randomUUID } from "node:crypto";
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { performance } from "node:perf_hooks";
import { createClient } from "@supabase/supabase-js";
import {
  aggregateQualificationGroup,
  serializePrivacySafeEvidence,
  validateConcurrencyOverlap,
  validateFixtureManifest,
  validatePerformanceSample,
} from "../lib/performance/qualification.ts";

const timeoutMs = 10_000;
const warmSamples = 30;
const normativePlaywrightBoundarySatisfied = false;
const fixturePassword = process.env.PHASE11G2_FIXTURE_PASSWORD;
const closureSecret = process.env.ACCOUNT_CLOSURE_CAPABILITY_SECRET;

if (!fixturePassword || fixturePassword.length < 20) {
  throw new Error("A runtime-only G2 fixture password is required.");
}
if (!closureSecret || Buffer.byteLength(closureSecret) < 32) {
  throw new Error("A runtime-only G2 closure secret is required.");
}

function parseEnvironment(output) {
  const values = new Map();
  for (const line of output.split(/\r?\n/)) {
    const match = /^([A-Z][A-Z0-9_]*)=(.*)$/.exec(line.trim());
    if (!match) continue;
    const raw = match[2];
    values.set(
      match[1],
      raw.startsWith('"') && raw.endsWith('"') ? raw.slice(1, -1) : raw,
    );
  }
  return values;
}

function requireLoopback(value, label) {
  const parsed = new URL(value);
  if (!["127.0.0.1", "localhost"].includes(parsed.hostname)) {
    throw new Error(`Refusing to use a nonlocal ${label}.`);
  }
  return parsed.toString().replace(/\/$/, "");
}

const status = execFileSync("npx", ["supabase", "status", "-o", "env"], {
  encoding: "utf8",
});
const environment = parseEnvironment(status);
const apiUrl = requireLoopback(environment.get("API_URL"), "Supabase API");
const publishableKey =
  environment.get("PUBLISHABLE_KEY") ?? environment.get("ANON_KEY");
const serviceRoleKey =
  environment.get("SECRET_KEY") ?? environment.get("SERVICE_ROLE_KEY");
const projectId = readFileSync("supabase/config.toml", "utf8").match(
  /^project_id\s*=\s*"([^"]+)"/m,
)?.[1];
if (!publishableKey || !serviceRoleKey || !projectId) {
  throw new Error("Local Supabase did not report the required values.");
}
const databaseContainer = `supabase_db_${projectId}`;

function psql(statement) {
  return execFileSync(
    "docker",
    [
      "exec", "-i", databaseContainer, "psql", "-U", "postgres", "-d",
      "postgres", "-X", "-q", "-t", "-A",
    ],
    { encoding: "utf8", input: statement, maxBuffer: 20 * 1024 * 1024 },
  ).trim();
}

psql(`
  do $$
  declare v_id uuid;
  begin
    select id into v_id from vault.secrets
    where name = 'account_closure_capability_v1';
    if v_id is null then
      perform vault.create_secret(
        '${closureSecret.replaceAll("'", "''")}',
        'account_closure_capability_v1',
        'Synthetic local Phase 11G2 secret'
      );
    else
      perform vault.update_secret(
        v_id,
        '${closureSecret.replaceAll("'", "''")}',
        'account_closure_capability_v1',
        'Synthetic local Phase 11G2 secret'
      );
    end if;
  end $$;
`);

const administrator = createClient(apiUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

function profileClient(profile) {
  return createClient(apiUrl, publishableKey, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: {
      headers: {
        "x-client-info": `phase11g2-${profile}`,
        "user-agent": profile === "desktop"
          ? "phase11g2-desktop-chromium"
          : "phase11g2-mobile-chromium",
      },
    },
  });
}

const listed = await administrator.auth.admin.listUsers({ page: 1, perPage: 1000 });
if (listed.error) throw new Error("Could not inspect synthetic identities.");
const identities = listed.data.users
  .filter((user) => /^phase11g2-user-\d{3}@example\.test$/.test(user.email ?? ""))
  .sort((left, right) => left.email.localeCompare(right.email));
if (identities.length !== 100) {
  throw new Error("The G2 qualification requires exactly 100 synthetic identities.");
}

const fixtureManifest = validateFixtureManifest(
  JSON.parse(readFileSync("performance/fixture-manifest.json", "utf8")),
);
const samples = [];
const waves = [];
const reliabilityEvents = [];
const conflictProbes = [];

function opaqueCorrelation() {
  return `perf_${randomUUID().replaceAll("-", "")}`;
}

async function withTimeout(action) {
  let timeout;
  try {
    return await Promise.race([
      action(),
      new Promise((_, reject) => {
        timeout = setTimeout(() => reject(new Error("qualification_timeout")), timeoutMs);
      }),
    ]);
  } finally {
    clearTimeout(timeout);
  }
}

function decodeClaims(token) {
  const payload = token.split(".")[1];
  return JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
}

function issueClosureCapability(accessToken) {
  const claims = decodeClaims(accessToken);
  const requestId = randomUUID();
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    v: 1,
    sub: claims.sub,
    sid: claims.session_id,
    intent: "account-closure",
    rid: requestId,
    policy: "p11e-e5-account-closure-v1",
    iat: now,
    exp: now + 60,
  };
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const authenticated = `v1.${encoded}`;
  const signature = createHmac("sha256", closureSecret)
    .update(authenticated)
    .digest("base64url");
  return { capability: `${authenticated}.${signature}`, requestId };
}

async function requireSuccess(result, integrity = true) {
  if (result.error) throw new Error(`application_failure:${result.error.code ?? "unknown"}`);
  if (!integrity) throw new Error("integrity_failure");
  return result.data;
}

async function loadActors(profile) {
  const actors = [];
  for (let index = 0; index < 10; index += 1) {
    const identity = identities[index];
    const client = profileClient(profile);
    const signedIn = await client.auth.signInWithPassword({
      email: identity.email,
      password: fixturePassword,
    });
    if (signedIn.error || !signedIn.data.session) {
      throw new Error("Could not authenticate a G2 fixture actor.");
    }
    const [food, publicFood, savedMeal, recipe, diary, ownedBarcode, publicBarcode] =
      await Promise.all([
        administrator.from("foods").select("id,custom_food_edit_revision,name").eq("owner_user_id", identity.id).order("created_at").limit(1).single(),
        administrator.from("foods").select("id").eq("is_public", true).order("created_at").limit(1).single(),
        administrator.from("saved_meals").select("id,updated_at,saved_meal_edit_revision").eq("user_id", identity.id).order("created_at").limit(1).single(),
        administrator.from("recipes").select("id,updated_at,recipe_edit_revision").eq("user_id", identity.id).order("created_at").limit(1).single(),
        administrator.from("diary_entries").select("id,version").eq("user_id", identity.id).eq("source", "manual").order("created_at").limit(1).single(),
        administrator.from("food_barcodes").select("canonical_gtin").eq("scope_owner_user_id", identity.id).limit(1).single(),
        administrator.from("food_barcodes").select("canonical_gtin").is("scope_owner_user_id", null).limit(1).single(),
      ]);
    const actorFixtures = { food, publicFood, savedMeal, recipe, diary, ownedBarcode, publicBarcode };
    for (const [fixtureName, result] of Object.entries(actorFixtures)) {
      if (result.error || !result.data) {
        throw new Error(
          `The G2 actor fixture is incomplete: ${fixtureName} for ordinal ${index + 1}.`,
        );
      }
    }
    actors.push({
      client,
      email: identity.email,
      identityId: identity.id,
      ordinal: index + 1,
      session: signedIn.data.session,
      food: food.data,
      publicFood: publicFood.data,
      savedMeal: savedMeal.data,
      recipe: recipe.data,
      diary: diary.data,
      ownedBarcode: ownedBarcode.data.canonical_gtin,
      publicBarcode: publicBarcode.data.canonical_gtin,
    });
  }
  return actors;
}

async function deleteBy(table, column, value) {
  const result = await administrator.from(table).delete().eq(column, value);
  if (result.error) throw new Error("Local G2 cleanup failed.");
}

const baseItems = [{
  position: 1,
  food_id: null,
  food_name: "Synthetic measured item",
  brand_name: null,
  serving_quantity: 1,
  serving_unit: "serving",
  calories: 100,
  protein_g: 5,
  carbohydrates_g: 10,
  fat_g: 3,
  notes: null,
}];
const baseIngredients = [{
  position: 1,
  food_id: null,
  ingredient_name: "Synthetic measured ingredient",
  brand_name: null,
  quantity: 1,
  unit: "portion",
  calories: 100,
  protein_g: 5,
  carbohydrates_g: 10,
  fat_g: 3,
  notes: null,
}];
const baseNutrients = [
  { code: "energy_kcal", amount: 101 },
  { code: "protein_g", amount: 8.5 },
  { code: "carbohydrates_g", amount: 18.25 },
  { code: "fat_g", amount: 5.75 },
];

function withoutDatabaseId(value) {
  const result = { ...value };
  delete result.id;
  return result;
}

function operationCatalog(profile, recoveryCompletionActors = []) {
  return [
    {
      metricId: "PERF-001", id: "invited_activation", journeys: ["CJ-002", "CJ-003"], threshold: 1000,
      async execute(actor) {
        const data = await requireSuccess(await actor.client.rpc("complete_invited_account_activation", {
          p_age_18_attested: true, p_israel_attested: true,
        }));
        return Array.isArray(data) ? data.length === 1 : Boolean(data);
      },
    },
    {
      metricId: "PERF-001", id: "sign_in", journeys: ["CJ-004"], threshold: 1000,
      async execute(actor, state) {
        const client = profileClient(profile);
        const result = await client.auth.signInWithPassword({ email: actor.email, password: fixturePassword });
        state.client = client;
        return !result.error && Boolean(result.data.session);
      },
      async cleanup(_actor, state) { await state.client?.auth.signOut({ scope: "local" }); },
    },
    {
      metricId: "PERF-001", id: "sign_out", journeys: ["CJ-005"], threshold: 1000,
      async prepare(actor) {
        const client = profileClient(profile);
        const result = await client.auth.signInWithPassword({ email: actor.email, password: fixturePassword });
        if (result.error) throw new Error("auth_prepare_failure");
        return { client };
      },
      async execute(_actor, state) {
        const result = await state.client.auth.signOut({ scope: "local" });
        return !result.error;
      },
    },
    {
      metricId: "PERF-001", id: "recovery_request", journeys: ["CJ-007"], threshold: 1000,
      selectActors(_actors, concurrency) {
        const offset = concurrency === 1 ? 0 : 31;
        return identities.slice(offset, offset + 31).map((identity) => ({
          email: identity.email,
        }));
      },
      uniqueWarmActors: true,
      async execute(actor) {
        const client = profileClient(profile);
        const result = await client.auth.resetPasswordForEmail(actor.email, {
          redirectTo: "http://127.0.0.1:3100/en/auth/confirm?next=/en/auth/reset",
        });
        return !result.error;
      },
    },
    {
      metricId: "PERF-001", id: "recovery_completion", journeys: ["CJ-008"], threshold: 1000,
      selectActors() { return recoveryCompletionActors; },
      async prepare(actor) {
        const client = profileClient(profile);
        const signedIn = await client.auth.signInWithPassword({
          email: actor.email,
          password: actor.password,
        });
        if (signedIn.error) throw new Error("recovery_completion_prepare_failure");
        const replacement = actor.password === fixturePassword
          ? "Phase11G2LocalReplacement-2026!"
          : fixturePassword;
        return { actor, client, replacement };
      },
      async execute(_actor, state) {
        const result = await state.client.auth.updateUser({
          password: state.replacement,
        });
        if (!result.error) state.actor.password = state.replacement;
        return !result.error && Boolean(result.data.user);
      },
      async cleanup(_actor, state) {
        await state.client?.auth.signOut({ scope: "local" });
      },
    },
    {
      metricId: "PERF-002", id: "setup", journeys: ["CJ-009", "CJ-010"], threshold: 1000,
      async execute(actor) {
        const data = await requireSuccess(await actor.client.rpc("persist_setup", {
          p_display_name: `Synthetic G2 profile ${String(actor.ordinal).padStart(3, "0")}`,
          p_preferred_language: actor.ordinal % 2 === 0 ? "he" : "en",
          p_effective_from: "2026-07-31", p_calories: 2100,
          p_protein_g: 110, p_carbohydrates_g: 230, p_fat_g: 70,
        }));
        return data?.length === 1;
      },
    },
    {
      metricId: "PERF-002", id: "target_update", journeys: ["CJ-011"], threshold: 1000,
      async execute(actor) {
        const data = await requireSuccess(await actor.client.from("nutrition_targets")
          .update({ calories: 2100 + actor.ordinal })
          .eq("user_id", actor.identityId).eq("effective_from", "2026-07-31")
          .select("calories").single());
        return data.calories === 2100 + actor.ordinal;
      },
    },
    {
      metricId: "PERF-002", id: "diary_create", journeys: ["CJ-012", "CJ-013"], threshold: 1000,
      async prepare() { return { key: randomUUID() }; },
      async execute(actor, state) {
        const data = await requireSuccess(await actor.client.rpc("create_manual_diary_entry", {
          p_idempotency_key: state.key, p_entry_date: "2026-08-29", p_meal_type: "snack",
          p_food_id: null, p_food_name: "Synthetic measured diary entry", p_brand_name: null,
          p_serving_quantity: 1, p_serving_unit: "serving", p_calories: 100,
          p_protein_g: 5, p_carbohydrates_g: 10, p_fat_g: 3, p_notes: null,
        }));
        state.diaryId = data?.[0]?.diary_entry_id;
        return Boolean(state.diaryId) && data[0].result_status === "success";
      },
      async cleanup(_actor, state) {
        await deleteBy("manual_diary_entry_requests", "idempotency_key", state.key);
        if (state.diaryId) await deleteBy("diary_entries", "id", state.diaryId);
      },
    },
    {
      metricId: "PERF-002", id: "diary_edit", journeys: ["CJ-014"], threshold: 1000,
      async prepare(actor, index) {
        const current = await actor.client.from("diary_entries").select("version").eq("id", actor.diary.id).single();
        if (current.error) throw new Error("diary_prepare_failure");
        return { index, version: current.data.version };
      },
      async execute(actor, state) {
        const data = await requireSuccess(await actor.client.from("diary_entries")
          .update({ notes: `g2-${profile}-${state.index}` })
          .eq("id", actor.diary.id).eq("version", state.version)
          .select("notes,version").single());
        return data.version === state.version + 1;
      },
    },
    {
      metricId: "PERF-002", id: "diary_delete", journeys: ["CJ-015"], threshold: 1000,
      async prepare(actor) {
        const key = randomUUID();
        const created = await actor.client.rpc("create_manual_diary_entry", {
          p_idempotency_key: key, p_entry_date: "2026-08-28", p_meal_type: "other",
          p_food_id: null, p_food_name: "Synthetic delete probe", p_brand_name: null,
          p_serving_quantity: 1, p_serving_unit: "serving", p_calories: 1,
          p_protein_g: 0, p_carbohydrates_g: 0, p_fat_g: 0, p_notes: null,
        });
        if (created.error) throw new Error("delete_prepare_failure");
        return { key, diaryId: created.data[0].diary_entry_id };
      },
      async execute(actor, state) {
        const data = await requireSuccess(await actor.client.from("diary_entries")
          .delete().eq("id", state.diaryId).select("id"));
        return data.length === 1;
      },
      async cleanup(_actor, state) {
        await deleteBy("manual_diary_entry_requests", "idempotency_key", state.key);
      },
    },
    {
      metricId: "PERF-003", id: "search", journeys: ["CJ-016"], threshold: 750,
      async execute(actor) {
        const data = await requireSuccess(await actor.client.rpc("search_readable_foods", { p_query: "Launch Apple" }));
        return data.length === 20 && data.every((row) => row.food_id && row.name);
      },
    },
    {
      metricId: "PERF-003", id: "prefill", journeys: ["CJ-017"], threshold: 750,
      async execute(actor) {
        const data = await requireSuccess(await actor.client.rpc("get_readable_food_diary_prefill", { p_food_id: actor.publicFood.id }));
        return data.length === 1 && data[0].food_id === actor.publicFood.id;
      },
    },
    {
      metricId: "PERF-004", id: "custom_food_create", journeys: ["CJ-018"], threshold: 1250,
      async prepare() { return { key: randomUUID() }; },
      async execute(actor, state) {
        const data = await requireSuccess(await actor.client.rpc("create_custom_food", {
          p_idempotency_key: state.key, p_name: "Synthetic measured custom food", p_brand_name: null,
          p_locale: "en", p_nutrient_basis: "per_serving", p_serving_quantity: 1,
          p_serving_unit: "serving", p_nutrients: baseNutrients, p_aliases: [],
        }));
        state.foodId = data?.[0]?.food_id;
        return Boolean(state.foodId);
      },
      async cleanup(_actor, state) {
        await deleteBy("custom_food_creation_requests", "idempotency_key", state.key);
        if (state.foodId) await deleteBy("foods", "id", state.foodId);
      },
    },
    {
      metricId: "PERF-004", id: "custom_food_edit", journeys: ["CJ-019", "CJ-020"], threshold: 1250,
      async prepare(actor, index) {
        const editor = await actor.client.rpc("get_owned_custom_food_editor", { p_food_id: actor.food.id });
        if (editor.error) throw new Error("custom_edit_prepare_failure");
        return { editor: editor.data[0], index };
      },
      async execute(actor, state) {
        const data = await requireSuccess(await actor.client.rpc("persist_custom_food", {
          p_food_id: actor.food.id, p_name: `Owned measured food ${profile}-${state.index}`,
          p_brand_name: null, p_locale: "en", p_nutrient_basis: "per_serving",
          p_serving_quantity: 1, p_serving_unit: "serving",
          p_nutrients: state.editor.nutrients, p_aliases: state.editor.aliases,
          p_expected_edit_revision: state.editor.edit_revision,
        }));
        return data?.[0]?.food_id === actor.food.id;
      },
    },
    {
      metricId: "PERF-004", id: "saved_meal_create", journeys: ["CJ-021"], threshold: 1250,
      async execute(actor, state) {
        const data = await requireSuccess(await actor.client.rpc("persist_saved_meal", {
          p_saved_meal_id: null, p_name: "Synthetic measured saved meal", p_locale: "en", p_items: baseItems,
        }));
        state.savedMealId = data?.[0]?.saved_meal_id;
        return Boolean(state.savedMealId) && data[0].item_count === 1;
      },
      async cleanup(_actor, state) { if (state.savedMealId) await deleteBy("saved_meals", "id", state.savedMealId); },
    },
    {
      metricId: "PERF-004", id: "saved_meal_edit", journeys: ["CJ-022", "CJ-023"], threshold: 1250,
      async prepare(actor, index) {
        const editor = await actor.client.rpc("get_owned_saved_meal_editor", { p_saved_meal_id: actor.savedMeal.id });
        if (editor.error) throw new Error("saved_edit_prepare_failure");
        return { editor: editor.data[0], index };
      },
      async execute(actor, state) {
        const items = state.editor.items.map(withoutDatabaseId);
        const data = await requireSuccess(await actor.client.rpc("persist_saved_meal", {
          p_saved_meal_id: actor.savedMeal.id, p_name: `Synthetic measured meal ${profile}-${state.index}`,
          p_locale: "en", p_items: items,
          p_expected_edit_revision: state.editor.edit_revision,
        }));
        return data?.[0]?.saved_meal_id === actor.savedMeal.id;
      },
    },
    {
      metricId: "PERF-004", id: "saved_meal_use", journeys: ["CJ-024"], threshold: 1250,
      async prepare(actor) {
        const meal = await actor.client.from("saved_meals").select("updated_at").eq("id", actor.savedMeal.id).single();
        if (meal.error) throw new Error("saved_use_prepare_failure");
        return { key: randomUUID(), updatedAt: meal.data.updated_at };
      },
      async execute(actor, state) {
        const data = await requireSuccess(await actor.client.rpc("log_saved_meal_to_diary", {
          p_saved_meal_id: actor.savedMeal.id, p_expected_updated_at: state.updatedAt,
          p_entry_date: "2026-08-27", p_meal_type: "dinner", p_idempotency_key: state.key,
        }));
        state.runId = data?.[0]?.diary_run_id;
        return Boolean(state.runId) && data[0].result_status === "success";
      },
      async cleanup(_actor, state) {
        if (state.runId) {
          await deleteBy("diary_entries", "saved_meal_diary_run_id", state.runId);
          await deleteBy("saved_meal_diary_runs", "id", state.runId);
        }
      },
    },
    {
      metricId: "PERF-004", id: "recipe_create", journeys: ["CJ-025"], threshold: 1250,
      async execute(actor, state) {
        const data = await requireSuccess(await actor.client.rpc("persist_recipe", {
          p_recipe_id: null, p_name: "Synthetic measured recipe", p_locale: "en",
          p_yield_servings: 4, p_ingredients: baseIngredients,
        }));
        state.recipeId = data?.[0]?.recipe_id;
        return Boolean(state.recipeId) && data[0].ingredient_count === 1;
      },
      async cleanup(_actor, state) { if (state.recipeId) await deleteBy("recipes", "id", state.recipeId); },
    },
    {
      metricId: "PERF-004", id: "recipe_edit", journeys: ["CJ-025", "CJ-026"], threshold: 1250,
      async prepare(actor, index) {
        const editor = await actor.client.rpc("get_owned_recipe_editor", { p_recipe_id: actor.recipe.id });
        if (editor.error) throw new Error("recipe_edit_prepare_failure");
        return { editor: editor.data[0], index };
      },
      async execute(actor, state) {
        const ingredients = state.editor.ingredients.map(withoutDatabaseId);
        const data = await requireSuccess(await actor.client.rpc("persist_recipe", {
          p_recipe_id: actor.recipe.id, p_name: `Synthetic measured recipe ${profile}-${state.index}`,
          p_locale: "en", p_yield_servings: 4, p_ingredients: ingredients,
          p_expected_edit_revision: state.editor.edit_revision,
        }));
        return data?.[0]?.recipe_id === actor.recipe.id;
      },
    },
    {
      metricId: "PERF-004", id: "recipe_calculate", journeys: ["CJ-027"], threshold: 1250,
      async execute(actor) {
        const data = await requireSuccess(await actor.client.rpc("get_owned_recipe_use_contract", {
          p_recipe_id: actor.recipe.id, p_requested_servings: 1,
        }));
        return data?.[0]?.result_status === "ready";
      },
    },
    {
      metricId: "PERF-004", id: "recipe_use", journeys: ["CJ-027"], threshold: 1250,
      async prepare(actor) {
        const recipe = await actor.client.from("recipes").select("updated_at").eq("id", actor.recipe.id).single();
        if (recipe.error) throw new Error("recipe_use_prepare_failure");
        return { key: randomUUID(), updatedAt: recipe.data.updated_at };
      },
      async execute(actor, state) {
        const data = await requireSuccess(await actor.client.rpc("log_recipe_to_diary", {
          p_recipe_id: actor.recipe.id, p_expected_updated_at: state.updatedAt,
          p_requested_servings: 1, p_entry_date: "2026-08-26", p_meal_type: "lunch",
          p_idempotency_key: state.key,
        }));
        state.runId = data?.[0]?.diary_run_id;
        return Boolean(state.runId) && data[0].result_status === "success";
      },
      async cleanup(_actor, state) {
        if (state.runId) {
          await deleteBy("diary_entries", "recipe_diary_run_id", state.runId);
          await deleteBy("recipe_diary_runs", "id", state.runId);
        }
      },
    },
    {
      metricId: "PERF-005", id: "barcode_owned", journeys: ["CJ-028", "CJ-029"], threshold: 750,
      async execute(actor) {
        const data = await requireSuccess(await actor.client.rpc("lookup_readable_food_by_gtin", { p_gtin: actor.ownedBarcode }));
        return data.length === 1 && data[0].result_status === "found_owned";
      },
    },
    {
      metricId: "PERF-005", id: "barcode_public", journeys: ["CJ-028", "CJ-030"], threshold: 750,
      async execute(actor) {
        const data = await requireSuccess(await actor.client.rpc("lookup_readable_food_by_gtin", { p_gtin: actor.publicBarcode }));
        return data.length === 1 && data[0].result_status === "found_public";
      },
    },
    {
      metricId: "PERF-005", id: "barcode_miss", journeys: ["CJ-028", "CJ-031"], threshold: 750,
      async execute(actor) {
        const data = await requireSuccess(await actor.client.rpc("lookup_readable_food_by_gtin", { p_gtin: "39999999999995" }));
        return data.length === 1 && data[0].result_status === "not_found_local";
      },
    },
    {
      metricId: "PERF-006", id: "account_closure", journeys: ["CJ-035"], threshold: 2000,
      async execute(actor, state) {
        const sessionResult = await actor.client.auth.getSession();
        const token = sessionResult.data.session?.access_token;
        if (!token) throw new Error("closure_session_failure");
        const issued = issueClosureCapability(token);
        const data = await requireSuccess(await actor.client.rpc("close_current_account", {
          p_closure_request_id: issued.requestId, p_capability: issued.capability,
        }));
        state.closedUser = actor.identityId;
        const access = await actor.client.rpc("current_account_access_state");
        return ["closed", "already_closed"].includes(data?.[0]?.outcome) && access.data === "closed";
      },
      async cleanup(_actor, state) {
        if (state.closedUser) {
          psql(`delete from public.account_closures where user_id = '${state.closedUser}'::uuid;`);
        }
      },
    },
  ];
}

async function exportCollection(actor, expectedDiaryEntries) {
  const owned = await actor.client.from("foods").select("id").eq("owner_user_id", actor.identityId);
  if (owned.error) throw new Error("application_failure:export_owned");
  const ownedIds = owned.data.map((row) => row.id);
  const tables = [
    ["account_activations", "user_id"], ["profiles", "id"],
    ["nutrition_targets", "user_id"], ["food_favorites", "user_id"],
    ["saved_meals", "user_id"], ["saved_meal_diary_runs", "user_id"],
    ["recipes", "user_id"], ["recipe_diary_runs", "user_id"],
    ["custom_food_creation_requests", "user_id"],
    ["manual_diary_entry_requests", "user_id"],
  ];
  const collected = {};
  for (const [table, column] of tables) {
    const result = await actor.client.from(table).select("*").eq(column, actor.identityId);
    if (result.error) throw new Error("application_failure:export_collection");
    collected[table] = result.data;
  }
  const diary = [];
  for (let from = 0; ; from += 500) {
    const result = await actor.client.from("diary_entries").select("*")
      .eq("user_id", actor.identityId).order("entry_date").order("created_at")
      .range(from, from + 499);
    if (result.error) throw new Error("application_failure:export_diary");
    diary.push(...result.data);
    if (result.data.length < 500) break;
  }
  const related = {};
  for (const table of ["food_aliases", "food_barcodes", "food_nutrients"]) {
    const columns = table === "food_barcodes"
      ? "food_id,canonical_gtin,provenance_source_id,provenance_source_food_id,verification_status"
      : "*";
    const result = ownedIds.length === 0
      ? { data: [], error: null }
      : await actor.client.from(table).select(columns).in("food_id", ownedIds);
    if (result.error) throw new Error("application_failure:export_related");
    related[table] = result.data;
  }
  const serialized = JSON.stringify({ collected, diary, owned: owned.data, related });
  return diary.length === expectedDiaryEntries && serialized.length > 100;
}

const exportOperations = [
  { id: "account_export_small", actorIndex: 0, expected: 10 },
  { id: "account_export_median", actorIndex: 1, expected: 180 },
  { id: "account_export_maximum", actorIndex: 2, expected: 1002 },
].map((shape) => ({
  metricId: "PERF-006", id: shape.id, journeys: ["CJ-034"], threshold: 2000,
  concurrency: [1], actorIndex: shape.actorIndex,
  execute: (actor) => exportCollection(actor, shape.expected),
})).concat({
  metricId: "PERF-006", id: "account_export_mixed_concurrent",
  journeys: ["CJ-034"], threshold: 2000, concurrency: [10],
  execute: (actor) => exportCollection(
    actor,
    actor.ordinal === 1 ? 10 : actor.ordinal === 2 ? 180 : actor.ordinal === 3 ? 1002 : 30,
  ),
});

async function measurePrepared({ operation, actor, profile, concurrency, sampleIndex, temperature, waveId, state, deferCleanup = false }) {
  const correlationId = opaqueCorrelation();
  const startedAtMs = performance.now();
  let classification = "succeeded";
  let outcome = "success";
  let integrityPassed = false;
  try {
    if (state.prepareFailed) throw new Error("framework_failure");
    integrityPassed = await withTimeout(() => operation.execute(actor, state));
    if (!integrityPassed) throw new Error("integrity_failure");
  } catch (error) {
    outcome = "failure";
    const message = error instanceof Error ? error.message : "unhandled_error";
    classification = message === "qualification_timeout"
      ? "timeout"
      : message.includes("integrity")
        ? "integrity_failure"
        : message.includes("framework_failure")
          ? "framework_failure"
        : message.includes("application_failure")
          ? "unexpected_5xx"
          : "unhandled_error";
  }
  const observedEnd = performance.now();
  const durationMs = classification === "timeout"
    ? timeoutMs
    : Number((observedEnd - startedAtMs).toFixed(3));
  const sample = {
    schemaVersion: "1", metricId: operation.metricId, operationId: operation.id,
    journeyIds: operation.journeys, profile, concurrency, temperature,
    sampleIndex, ...(waveId ? { waveId } : {}),
    startedAtMs: Number(startedAtMs.toFixed(3)),
    endedAtMs: Number((startedAtMs + durationMs).toFixed(3)), durationMs,
    outcome, classification, correlationId, integrityPassed,
  };
  samples.push(sample);
  if (outcome === "failure") {
    reliabilityEvents.push({ metricId: operation.metricId, operationId: operation.id, profile, concurrency, classification, correlationId });
  }
  if (!deferCleanup) {
    await cleanupMeasuredState(operation, actor, state, sample, profile, concurrency);
  }
  return sample;
}

async function cleanupMeasuredState(operation, actor, state, sample, profile, concurrency) {
  try {
    await operation.cleanup?.(actor, state);
  } catch {
    reliabilityEvents.push({ metricId: operation.metricId, operationId: operation.id, profile, concurrency, classification: "framework_failure", correlationId: sample.correlationId });
    sample.outcome = "failure";
    sample.classification = "framework_failure";
    sample.integrityPassed = false;
  }
}

async function prepareState(operation, actor, index) {
  try {
    return await operation.prepare?.(actor, index) ?? {};
  } catch {
    return { prepareFailed: true };
  }
}

async function runOperation(operation, actors, profile, concurrency) {
  process.stderr.write(
    `G2 ${operation.metricId} ${operation.id} ${profile} c${concurrency}\n`,
  );
  const selectedActors = operation.selectActors
    ? operation.selectActors(actors, concurrency)
    : operation.actorIndex === undefined
      ? actors
      : [actors[operation.actorIndex]];
  const coldActor = selectedActors[0];
  const coldState = await prepareState(operation, coldActor, 0);
  await measurePrepared({ operation, actor: coldActor, profile, concurrency, sampleIndex: 0, temperature: "cold", state: coldState });

  if (concurrency === 1) {
    for (let index = 1; index <= warmSamples; index += 1) {
      const actor = operation.uniqueWarmActors
        ? selectedActors[index]
        : selectedActors[(index - 1) % selectedActors.length];
      const state = await prepareState(operation, actor, index);
      await measurePrepared({ operation, actor, profile, concurrency, sampleIndex: index, temperature: "warm", state });
    }
    return;
  }

  for (let waveIndex = 1; waveIndex <= warmSamples / 10; waveIndex += 1) {
    const waveId = `${operation.id}-${profile}-${waveIndex}`;
    const prepared = [];
    for (let actorIndex = 0; actorIndex < 10; actorIndex += 1) {
      const actor = operation.uniqueWarmActors
        ? selectedActors[(waveIndex - 1) * 10 + actorIndex + 1]
        : selectedActors[actorIndex];
      prepared.push({
        actor,
        state: await prepareState(operation, actor, waveIndex * 10 + actorIndex),
      });
    }
    const measured = await Promise.all(prepared.map(({ actor, state }, actorIndex) => measurePrepared({
      operation, actor, profile, concurrency, sampleIndex: (waveIndex - 1) * 10 + actorIndex + 1,
      temperature: "warm", waveId, state, deferCleanup: true,
    })));
    for (let index = 0; index < prepared.length; index += 1) {
      await cleanupMeasuredState(
        operation,
        prepared[index].actor,
        prepared[index].state,
        measured[index],
        profile,
        concurrency,
      );
    }
    const waveSamples = samples.filter((sample) => sample.waveId === waveId);
    const points = waveSamples.flatMap((sample) => [
      { at: sample.startedAtMs, delta: 1 }, { at: sample.endedAtMs, delta: -1 },
    ]).sort((left, right) => left.at - right.at || left.delta - right.delta);
    let active = 0;
    let maximumActive = 0;
    for (const point of points) {
      active += point.delta;
      maximumActive = Math.max(maximumActive, active);
    }
    waves.push({
      waveId,
      metricId: operation.metricId,
      operationId: operation.id,
      profile,
      expectedOperations: 10,
      maximumActive,
      overlapPassed:
        maximumActive === 10 &&
        validateConcurrencyOverlap(waveSamples.map(validatePerformanceSample)),
    });
  }
}

const runStarted = performance.now();
for (const profile of ["desktop", "mobile"]) {
  const actors = await loadActors(profile);
  const recoveryCompletionActors = [];
  for (const identity of identities.slice(62, 72)) {
    const reset = await administrator.auth.admin.updateUserById(identity.id, {
      password: fixturePassword,
    });
    if (reset.error) throw new Error("Could not reset a recovery-completion actor.");
    recoveryCompletionActors.push({ email: identity.email, password: fixturePassword });
  }
  const operations = [
    ...operationCatalog(profile, recoveryCompletionActors),
    ...exportOperations,
  ];
  for (const operation of operations) {
    const allowed = operation.concurrency ?? [1, 10];
    for (const concurrency of allowed) {
      await runOperation(operation, actors, profile, concurrency);
    }
  }

  for (const kind of ["custom_food", "saved_meal", "recipe"]) {
    const actor = actors[0];
    let staleRevisionRejected = false;
    if (kind === "custom_food") {
      const editor = await actor.client.rpc("get_owned_custom_food_editor", {
        p_food_id: actor.food.id,
      });
      const current = editor.data?.[0];
      if (!editor.error && current) {
        const args = {
          p_food_id: actor.food.id, p_name: `Conflict accepted ${profile}`,
          p_brand_name: current.brand_name, p_locale: current.locale,
          p_nutrient_basis: current.nutrient_basis,
          p_serving_quantity: current.serving_quantity,
          p_serving_unit: current.serving_unit, p_nutrients: current.nutrients,
          p_aliases: current.aliases, p_expected_edit_revision: current.edit_revision,
        };
        const accepted = await actor.client.rpc("persist_custom_food", args);
        const stale = await actor.client.rpc("persist_custom_food", {
          ...args, p_name: `Conflict rejected ${profile}`,
        });
        staleRevisionRejected = !accepted.error && Boolean(stale.error);
      }
    } else if (kind === "saved_meal") {
      const editor = await actor.client.rpc("get_owned_saved_meal_editor", {
        p_saved_meal_id: actor.savedMeal.id,
      });
      const current = editor.data?.[0];
      if (!editor.error && current) {
        const items = current.items.map(withoutDatabaseId);
        const args = {
          p_saved_meal_id: actor.savedMeal.id,
          p_name: `Conflict accepted ${profile}`, p_locale: current.locale,
          p_items: items, p_expected_edit_revision: current.edit_revision,
        };
        const accepted = await actor.client.rpc("persist_saved_meal", args);
        const stale = await actor.client.rpc("persist_saved_meal", {
          ...args, p_name: `Conflict rejected ${profile}`,
        });
        staleRevisionRejected = !accepted.error && Boolean(stale.error);
      }
    } else {
      const editor = await actor.client.rpc("get_owned_recipe_editor", {
        p_recipe_id: actor.recipe.id,
      });
      const current = editor.data?.[0];
      if (!editor.error && current) {
        const ingredients = current.ingredients.map(withoutDatabaseId);
        const args = {
          p_recipe_id: actor.recipe.id, p_name: `Conflict accepted ${profile}`,
          p_locale: current.locale, p_yield_servings: current.yield_servings,
          p_ingredients: ingredients,
          p_expected_edit_revision: current.edit_revision,
        };
        const accepted = await actor.client.rpc("persist_recipe", args);
        const stale = await actor.client.rpc("persist_recipe", {
          ...args, p_name: `Conflict rejected ${profile}`,
        });
        staleRevisionRejected = !accepted.error && Boolean(stale.error);
      }
    }
    conflictProbes.push({ profile, conflictType: kind, staleRevisionRejected });
  }
}

const cardinalityPairs = Object.keys(fixtureManifest.cardinalities)
  .sort()
  .map((table) => `'${table}', (select count(*) from public.${table})`)
  .join(", ");
const postRunCardinalities = JSON.parse(
  psql(`select jsonb_build_object(${cardinalityPairs})::text;`),
);
const postRunCardinalityPassed = Object.entries(fixtureManifest.cardinalities)
  .every(([table, expected]) => postRunCardinalities[table] === expected);

const validatedSamples = samples.map(validatePerformanceSample);
const groups = [];
const keys = [...new Set(validatedSamples.map((sample) => [sample.metricId, sample.operationId, sample.profile, sample.concurrency].join("|")))];
for (const key of keys) {
  const [metricId, operationId, profile, concurrencyText] = key.split("|");
  const groupSamples = validatedSamples.filter((sample) =>
    sample.metricId === metricId && sample.operationId === operationId &&
    sample.profile === profile && sample.concurrency === Number(concurrencyText));
  const threshold = [...operationCatalog(profile), ...exportOperations]
    .find((operation) => operation.id === operationId).threshold;
  groups.push(aggregateQualificationGroup({
    samples: groupSamples,
    thresholdMs: threshold,
    minimumWarmSamples: warmSamples,
  }));
}

const migrationFiles = readdirSync("supabase/migrations").filter((name) => name.endsWith(".sql")).sort();
const schemaIdentitySha256 = createHash("sha256").update(
  migrationFiles.map((name) => `${name}\n${readFileSync(`supabase/migrations/${name}`, "utf8")}`).join("\n"),
).digest("hex");
const sourceHasher = createHash("sha256");
for (const path of [
  "scripts/run-phase-11g2-qualification.mjs",
  "performance/fixture-manifest.json",
  "performance/fixture.sql",
]) {
  sourceHasher.update(path);
  sourceHasher.update("\0");
  sourceHasher.update(readFileSync(path));
  sourceHasher.update("\0");
}
const sourceIdentitySha256 = sourceHasher.digest("hex");
const fixtureCardinalities = Object.entries(fixtureManifest.cardinalities)
  .sort(([left], [right]) => left.localeCompare(right))
  .map(([relation, count]) => ({ relation, count }));
const observedPostRunCardinalities = Object.entries(postRunCardinalities)
  .sort(([left], [right]) => left.localeCompare(right))
  .map(([relation, count]) => ({ relation, count }));
const report = {
  schemaVersion: "1", evidenceType: "phase-11g2-local-performance-capacity-qualification",
  measurementBoundary:
    "Supabase client submit-to-stable-response plus immediate integrity verification; diagnostic only because it does not include the normative Playwright UI boundary",
  normativePlaywrightBoundarySatisfied,
  fixtureVersion: fixtureManifest.fixtureVersion, fixtureCardinalities,
  approvedConcurrency: fixtureManifest.approvedConcurrency, timeoutMs, percentileMethod: "nearest-rank",
  warmSamplesPerGroup: warmSamples, schemaIdentitySha256, sourceIdentitySha256,
  runtime: {
    node: process.version, supabaseCli: execFileSync("npx", ["supabase", "--version"], { encoding: "utf8" }).trim(),
    database: psql("show server_version;"), totalDurationMs: Number((performance.now() - runStarted).toFixed(3)),
  },
  groups, concurrencyWaves: waves, conflictProbes, reliabilityEvents,
  postRunCardinalities: observedPostRunCardinalities, postRunCardinalityPassed,
  sampleCount: validatedSamples.length, passed: groups.every((group) => group.passed) &&
    waves.every((wave) => wave.overlapPassed) &&
    conflictProbes.every((probe) => probe.staleRevisionRejected) &&
    postRunCardinalityPassed &&
    normativePlaywrightBoundarySatisfied &&
    reliabilityEvents.length === 0,
};

mkdirSync("performance/evidence", { recursive: true });
writeFileSync(
  "performance/evidence/performance-samples.json",
  serializePrivacySafeEvidence({ schemaVersion: "1", samples: validatedSamples }),
);
writeFileSync(
  "performance/evidence/performance-report.json",
  serializePrivacySafeEvidence(report),
);
process.stdout.write(serializePrivacySafeEvidence(report));
if (!report.passed) process.exitCode = 1;
