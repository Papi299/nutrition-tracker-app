import { fail } from "./phase-11i-recovery-contract.mjs";

export const AUTH_DURABLE_TABLES = ["identities", "mfa_factors", "users", "webauthn_credentials"];
export const DIRECT_OWNER_COLUMNS = {
  account_activations: "user_id", account_closures: "user_id",
  custom_food_creation_requests: "user_id", diary_entries: "user_id",
  food_favorites: "user_id", manual_diary_entry_requests: "user_id",
  nutrition_targets: "user_id", profiles: "id", recipe_diary_runs: "user_id",
  recipes: "user_id", saved_meal_diary_runs: "user_id", saved_meals: "user_id",
};
const NUTRIENT_CODES = [
  "energy_kcal", "protein_g", "carbohydrates_g", "fiber_g", "sugars_g", "added_sugars_g",
  "fat_g", "saturated_fat_g", "monounsaturated_fat_g", "polyunsaturated_fat_g", "trans_fat_g",
  "cholesterol_mg", "sodium_mg", "potassium_mg", "calcium_mg", "iron_mg", "magnesium_mg",
  "phosphorus_mg", "zinc_mg", "copper_mg", "manganese_mg", "selenium_ug", "vitamin_a_rae_ug",
  "vitamin_c_mg", "vitamin_d_ug", "vitamin_e_mg", "vitamin_k_ug", "thiamin_mg", "riboflavin_mg",
  "niacin_mg", "pantothenic_acid_mg", "vitamin_b6_mg", "folate_dfe_ug", "vitamin_b12_ug",
  "choline_mg",
];

// UUIDs stay inside SQL. Only aggregate counts and invariant labels leave the database.
export function validateOwnerDatabase(rows) {
  const authCounts = Object.fromEntries(rows(`
    select 'users',count(*) from auth.users
    union all select 'identities',count(*) from auth.identities
    union all select 'sessions',count(*) from auth.sessions
    union all select 'refreshTokens',count(*) from auth.refresh_tokens
    union all select 'mfaFactors',count(*) from auth.mfa_factors
    union all select 'webauthnCredentials',count(*) from auth.webauthn_credentials
    order by 1;
  `).map(([name, count]) => [name, Number(count)]));
  if (authCounts.users !== 1 || Number(rows("select count(*) from auth.users where deleted_at is null;")[0]?.[0]) !== 1) {
    fail("Personal-use recovery requires exactly one non-deleted Auth owner.");
  }
  const owner = "(select id from auth.users where deleted_at is null)";
  const checks = [
    ...["identities", "mfa_factors", "webauthn_credentials"].map((table) =>
      ["auth_" + table, `select count(*) from auth.${table} where user_id is distinct from ${owner}`]),
    ...Object.entries(DIRECT_OWNER_COLUMNS).map(([table, column]) =>
      [table, `select count(*) from public.${table} where ${column} is distinct from ${owner}`]),
    ["recipe_ingredients", `select count(*) from public.recipe_ingredients c left join public.recipes p on p.id=c.recipe_id where p.user_id is distinct from ${owner}`],
    ["saved_meal_items", `select count(*) from public.saved_meal_items c left join public.saved_meals p on p.id=c.saved_meal_id where p.user_id is distinct from ${owner}`],
    ["foods", `select count(*) from public.foods f left join public.food_sources s on s.id=f.source_id where
      not ((f.owner_user_id is null and f.food_type in ('generic','branded')) or
      (f.owner_user_id=${owner} and f.food_type='user_custom' and not f.is_public and s.code='user_custom'))
      or (f.food_type='user_custom' and s.id is null)`],
    ["food_barcodes", `select count(*) from public.food_barcodes b left join public.foods f on f.id=b.food_id where
      f.id is null or b.scope_owner_user_id is distinct from f.owner_user_id
      or (f.owner_user_id is null and not f.is_public)`],
    ["reference_sources", "select count(*) from (values ('manual'),('user_custom'),('usda'),('foodsdictionary')) required(code) where not exists (select 1 from public.food_sources s where s.code=required.code)"],
    ["reference_nutrients", `select count(*) from (values ${NUTRIENT_CODES.map((code) => `('${code}')`).join(",")}) required(code) where not exists (select 1 from public.nutrients n where n.code=required.code)`],
  ];
  // Validate even disabled FK triggers: dumps restore with replication role 'replica'.
  // MATCH SIMPLE skips any-null keys; MATCH FULL skips only all-null keys.
  const foreignKeys = rows(`
    select c.conname, format('select count(*) from %s child where %s and not exists (select 1 from %s parent where %s)',
      c.conrelid::regclass,
      string_agg(format('child.%I is not null', a.attname), case when c.confmatchtype='f' then ' or ' else ' and ' end order by k.ordinality),
      c.confrelid::regclass,
      string_agg(format('parent.%I = child.%I', b.attname, a.attname), ' and ' order by k.ordinality))
    from pg_constraint c
    join pg_namespace n on n.oid=(select relnamespace from pg_class where oid=c.conrelid)
    cross join lateral unnest(c.conkey,c.confkey) with ordinality k(child_key,parent_key,ordinality)
    join pg_attribute a on a.attrelid=c.conrelid and a.attnum=k.child_key
    join pg_attribute b on b.attrelid=c.confrelid and b.attnum=k.parent_key
    where c.contype='f' and (n.nspname in ('public','ingestion') or
      (n.nspname='auth' and c.conrelid::regclass::text in ('auth.identities','auth.mfa_factors','auth.webauthn_credentials')))
    group by c.oid order by c.conname;
  `);
  for (const [label, sql] of [...checks, ...foreignKeys]) {
    const count = Number(rows(sql)[0]?.[0]);
    if (!Number.isSafeInteger(count) || count !== 0) fail(`Ownership/provenance integrity failed: ${label}.`);
  }
  return { authCounts, ownershipIntegrity: {
    profile: "PERSONAL_USE_ONE_NON_DELETED_OWNER", result: "PASS",
    directOwnerTablesChecked: Object.keys(DIRECT_OWNER_COLUMNS).length,
    indirectOwnerTablesChecked: 2, mixedCatalogValidated: true,
    requiredReferenceCodesPresent: true, foreignKeysChecked: foreignKeys.length,
    foreignOwnerRows: 0, orphanRows: 0,
    sourceVolatileStateAllowed: true,
  } };
}

// New captures require completed activation; historical restore policy stays unchanged.
export function validateCompletedOwnerActivation(rows) {
  const counts = rows(`
    select count(*), count(*) filter (where
      user_id = (select id from auth.users where deleted_at is null)
      and eligibility_statement_version = 'p11e-e001-private-beta-eligibility-v1'
      and activation_completed_at is not null
      and eligibility_accepted_at is not null
      and activation_completed_at = eligibility_accepted_at)
    from public.account_activations;
  `);
  if (counts.length !== 1 || counts[0].length !== 2 ||
      Number(counts[0][0]) !== 1 || Number(counts[0][1]) !== 1) {
    fail("New personal-use backup requires one completed activation for the sole owner.");
  }
  return 1;
}

export function assertDatabaseSecurity({ rlsDisabledTables, unexpectedMutationGrants, securityDefinerMissingSearchPath }) {
  if (rlsDisabledTables.length || unexpectedMutationGrants.length || securityDefinerMissingSearchPath.length) {
    fail("RLS, grant, or SECURITY DEFINER search_path validation failed.");
  }
}

export function assertRestoredCounts(source, restored) {
  const tables = new Set([...Object.keys(source), ...Object.keys(restored)]);
  for (const table of tables) {
    if (!Number.isSafeInteger(source[table]) || source[table] < 0 || source[table] !== restored[table]) {
      fail("Application row-count mismatch after restore.");
    }
  }
}

export function assertRestoredAuth(source, restored) {
  for (const durable of ["users", "identities", "mfaFactors", "webauthnCredentials"]) {
    if (!Number.isSafeInteger(source[durable]) || source[durable] < 0 || restored[durable] !== source[durable]) {
      fail(`Auth durable-state mismatch for ${durable}.`);
    }
  }
  if (restored.sessions !== 0 || restored.refreshTokens !== 0) {
    fail("Volatile Auth session state was unexpectedly restored.");
  }
}
