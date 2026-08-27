import { spawnSync } from "node:child_process";
import {
  copyFileSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
} from "node:fs";
import { basename, join } from "node:path";
import { tmpdir } from "node:os";

const pendingMigrations = [
  "20260718150000_allow_phase_10e_terminal_run_classification.sql",
  "20260719080000_create_foundation_lifecycle_foundation.sql",
  "20260719120000_harden_foundation_lifecycle_diff_validation.sql",
  "20260719160000_execute_foundation_lifecycle_updates.sql",
  "20260721100000_restore_strict_terminal_run_immutability.sql",
];
const appliedCutoff = "20260718140000";
const simulatedLogin = "phase10e_cli_login_test";
const simulatedPassword = "phase10e-local-hosted-role-only";
const authorityRole = "phase10e_migration_role_admin_test";

function fail(message) {
  throw new Error(message);
}

function run(name, args, options = {}) {
  const result = spawnSync(name, args, {
    encoding: "utf8",
    maxBuffer: 128 * 1024 * 1024,
    timeout: options.timeout ?? 180_000,
    env: options.env ?? process.env,
    input: options.input,
  });
  if (result.status !== 0 && !options.allowFailure) {
    fail((result.stderr || result.stdout || `${name} failed`).trim());
  }
  return result;
}

function requireEqual(label, actual, expected) {
  if (actual !== expected) {
    fail(`${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

function parseStatusEnvironment(output) {
  return Object.fromEntries(
    output.split(/\r?\n/).flatMap((line) => {
      const match = /^([A-Z][A-Z0-9_]*)=(.*)$/.exec(line.trim());
      if (!match) return [];
      const raw = match[2];
      return [[
        match[1],
        raw.startsWith('"') && raw.endsWith('"') ? raw.slice(1, -1) : raw,
      ]];
    }),
  );
}

function requireLocalUrl(label, value) {
  if (!value) fail(`${label} is unavailable.`);
  const hostname = new URL(value).hostname;
  if (hostname !== "127.0.0.1" && hostname !== "localhost") {
    fail(`Refusing nonlocal ${label}.`);
  }
}

const localSupabaseWorkdir =
  process.env.HOSTED_ROLE_SUPABASE_WORKDIR ?? process.cwd();
const localSupabaseDirectory = join(localSupabaseWorkdir, "supabase");
const config = readFileSync(
  join(localSupabaseDirectory, "config.toml"),
  "utf8",
);
const projectId = config.match(/^project_id\s*=\s*"([^"]+)"/m)?.[1];
if (!projectId) fail("Could not read the local Supabase project id.");
const databaseContainer = `supabase_db_${projectId}`;
const status = run(
  "npx",
  [
    "supabase",
    "status",
    "-o",
    "env",
    "--workdir",
    localSupabaseWorkdir,
  ],
);
const local = parseStatusEnvironment(status.stdout);
requireLocalUrl("API_URL", local.API_URL);
requireLocalUrl("DB_URL", local.DB_URL);
const databasePassword = decodeURIComponent(new URL(local.DB_URL).password);
if (!databasePassword) fail("Local database password is unavailable.");

function psql(args, sql, options = {}) {
  return run(
    "docker",
    [
      "exec",
      "-e",
      `PGPASSWORD=${options.password ?? databasePassword}`,
      "-i",
      databaseContainer,
      "psql",
      "-h",
      "127.0.0.1",
      "-U",
      options.user ?? "supabase_admin",
      "-d",
      "postgres",
      "-X",
      "-v",
      "ON_ERROR_STOP=1",
      "-q",
      "-At",
      ...args,
    ],
    {
      input: sql,
      allowFailure: options.allowFailure,
      timeout: options.timeout,
    },
  );
}

function database(sql) {
  return psql([], sql).stdout.trim();
}

function databaseAsHostedLogin(sql, options = {}) {
  return psql([], sql, {
    user: simulatedLogin,
    password: simulatedPassword,
    allowFailure: options.allowFailure,
    timeout: options.timeout,
  });
}

function jsonLines(output) {
  return output
    .split(/\r?\n/)
    .filter((line) => line.startsWith("{"))
    .map((line) => JSON.parse(line));
}

function catalogFingerprint() {
  return database(`
    select md5(pg_catalog.jsonb_build_object(
      'memberships', coalesce((
        select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
          'granted', granted.rolname,
          'member', member.rolname,
          'grantor', grantor.rolname,
          'admin', memberships.admin_option
        ) order by granted.rolname, member.rolname, grantor.rolname)
        from pg_catalog.pg_auth_members memberships
        join pg_catalog.pg_roles granted on granted.oid = memberships.roleid
        join pg_catalog.pg_roles member on member.oid = memberships.member
        join pg_catalog.pg_roles grantor on grantor.oid = memberships.grantor
        where granted.rolname like 'ingestion_%'
      ), '[]'::jsonb),
      'ingestion_acl', (
        select nspacl from pg_catalog.pg_namespace where nspname = 'ingestion'
      )
    )::text);
  `);
}

function publicFingerprint() {
  return database(`
    with rows as (
      select 'diary_entries' relation, to_jsonb(x)::text body from public.diary_entries x
      union all select 'food_aliases', to_jsonb(x)::text from public.food_aliases x
      union all select 'food_barcodes', to_jsonb(x)::text from public.food_barcodes x
      union all select 'food_favorites', to_jsonb(x)::text from public.food_favorites x
      union all select 'food_nutrients', to_jsonb(x)::text from public.food_nutrients x
      union all select 'food_sources', to_jsonb(x)::text from public.food_sources x
      union all select 'foods', to_jsonb(x)::text from public.foods x
      union all select 'nutrients', to_jsonb(x)::text from public.nutrients x
      union all select 'nutrition_targets', to_jsonb(x)::text from public.nutrition_targets x
      union all select 'profiles', to_jsonb(x)::text from public.profiles x
      union all select 'recipe_diary_runs', to_jsonb(x)::text from public.recipe_diary_runs x
      union all select 'recipe_ingredients', to_jsonb(x)::text from public.recipe_ingredients x
      union all select 'recipes', to_jsonb(x)::text from public.recipes x
      union all select 'saved_meal_diary_runs', to_jsonb(x)::text from public.saved_meal_diary_runs x
      union all select 'saved_meal_items', to_jsonb(x)::text from public.saved_meal_items x
      union all select 'saved_meals', to_jsonb(x)::text from public.saved_meals x
    )
    select md5(coalesce(string_agg(
      relation || chr(31) || body,
      chr(30) order by relation collate "C", body collate "C"
    ), '')) from rows;
  `);
}

function cleanupMigrationAuthority() {
  database(`
    do $cleanup$
    begin
      if exists (
        select 1 from pg_catalog.pg_roles
        where rolname = '${authorityRole}'
      ) then
        execute 'revoke ${authorityRole} from postgres';
        execute 'drop role ${authorityRole}';
      end if;
    end
    $cleanup$;
  `);
}

function setupMigrationAuthority(includeLifecycleRole = false) {
  cleanupMigrationAuthority();
  database(`
    create role ${authorityRole} noinherit nologin;
    grant ingestion_definer to ${authorityRole} with admin option;
    ${includeLifecycleRole
      ? `grant ingestion_lifecycle_definer to ${authorityRole} with admin option;`
      : ""}
    grant ${authorityRole} to postgres;
  `);
}

function ensureLifecycleRole() {
  database(`
    do $role$
    begin
      if not exists (
        select 1 from pg_catalog.pg_roles
        where rolname = 'ingestion_lifecycle_definer'
      ) then
        create role ingestion_lifecycle_definer
          noinherit nologin nosuperuser nocreatedb nocreaterole nobypassrls;
      end if;
    end
    $role$;
  `);
}

function cleanupSimulatedLogin() {
  cleanupMigrationAuthority();
  database(`
    do $cleanup$
    begin
      if exists (
        select 1 from pg_catalog.pg_roles
        where rolname = '${simulatedLogin}'
      ) then
        execute 'revoke postgres from ${simulatedLogin}';
        execute 'drop role ${simulatedLogin}';
      end if;
    end
    $cleanup$;
  `);
}

function createSimulatedLogin() {
  cleanupSimulatedLogin();
  database(`
    create role ${simulatedLogin}
      login noinherit nosuperuser nocreatedb nocreaterole nobypassrls
      password '${simulatedPassword}';
    grant postgres to ${simulatedLogin};
  `);
}

function roleCatalogState() {
  return JSON.parse(database(`
    select pg_catalog.jsonb_build_object(
      'postgres_memberships', (
        select count(*) from pg_catalog.pg_auth_members memberships
        join pg_catalog.pg_roles granted on granted.oid = memberships.roleid
        join pg_catalog.pg_roles member on member.oid = memberships.member
        where granted.rolname like 'ingestion_%'
          and member.rolname = 'postgres'
      ),
      'consumer_memberships', (
        select count(*) from pg_catalog.pg_auth_members memberships
        join pg_catalog.pg_roles granted on granted.oid = memberships.roleid
        join pg_catalog.pg_roles member on member.oid = memberships.member
        where granted.rolname like 'ingestion_%'
          and member.rolname in (
            'anon', 'authenticated', 'service_role', 'authenticator'
          )
      ),
      'definer_create', pg_catalog.has_schema_privilege(
        'ingestion_definer', 'ingestion', 'create'
      ),
      'lifecycle_create', case when exists (
        select 1 from pg_catalog.pg_roles
        where rolname = 'ingestion_lifecycle_definer'
      ) then pg_catalog.has_schema_privilege(
        'ingestion_lifecycle_definer', 'ingestion', 'create'
      ) else false end
    )::text;
  `));
}

const temporaryRoot = mkdtempSync(join(tmpdir(), "phase10e-hosted-role-"));
const temporarySupabase = join(temporaryRoot, "supabase");
const temporaryMigrations = join(temporarySupabase, "migrations");
const temporaryTemplates = join(temporarySupabase, "templates");

try {
  mkdirSync(temporaryMigrations, { recursive: true });
  mkdirSync(temporaryTemplates, { recursive: true });
  copyFileSync(
    join(localSupabaseDirectory, "config.toml"),
    join(temporarySupabase, "config.toml"),
  );
  copyFileSync("supabase/seed.sql", join(temporarySupabase, "seed.sql"));
  copyFileSync(
    join(localSupabaseDirectory, "templates", "invite.html"),
    join(temporaryTemplates, "invite.html"),
  );
  const appliedMigrations = readdirSync("supabase/migrations")
    .filter((file) => /^\d{14}_.+\.sql$/.test(file))
    .filter((file) => file.slice(0, 14) <= appliedCutoff)
    .sort();
  requireEqual("pre-Phase 10E migration count", appliedMigrations.length, 27);
  for (const file of appliedMigrations) {
    copyFileSync(
      join("supabase/migrations", file),
      join(temporaryMigrations, file),
    );
  }

  run(
    "npx",
    ["supabase", "db", "reset", "--local", "--workdir", temporaryRoot],
    { timeout: 300_000 },
  );
  requireEqual(
    "27-migration baseline",
    database(`
      select count(*) || '|' || max(version)
      from supabase_migrations.schema_migrations;
    `),
    `27|${appliedCutoff}`,
  );
  database(`
    revoke ingestion_approver, ingestion_definer, ingestion_operator,
      ingestion_promotion_definer
    from postgres;
  `);
  requireEqual(
    "production-shaped baseline ingestion memberships",
    Number(roleCatalogState().postgres_memberships),
    0,
  );

  createSimulatedLogin();
  setupMigrationAuthority();
  const roleEvidence = jsonLines(databaseAsHostedLogin(`
    begin;
    select pg_catalog.jsonb_build_object(
      'stage', 'login',
      'session_user', session_user,
      'current_user', current_user,
      'role_setting', current_setting('role', true)
    )::text;
    set role postgres;
    select pg_catalog.jsonb_build_object(
      'stage', 'executor',
      'session_user', session_user,
      'current_user', current_user,
      'role_setting', current_setting('role', true)
    )::text;
    grant ingestion_definer to postgres;
    set role ingestion_definer;
    select pg_catalog.jsonb_build_object(
      'stage', 'temporary',
      'session_user', session_user,
      'current_user', current_user,
      'role_setting', current_setting('role', true)
    )::text;
    reset role;
    select pg_catalog.jsonb_build_object(
      'stage', 'after_reset',
      'session_user', session_user,
      'current_user', current_user,
      'role_setting', current_setting('role', true)
    )::text;
    rollback;
  `).stdout);
  requireEqual("role evidence rows", roleEvidence.length, 4);
  requireEqual("login session user", roleEvidence[0].session_user, simulatedLogin);
  requireEqual("login current user", roleEvidence[0].current_user, simulatedLogin);
  requireEqual("executor session user", roleEvidence[1].session_user, simulatedLogin);
  requireEqual("executor current user", roleEvidence[1].current_user, "postgres");
  requireEqual("executor role setting", roleEvidence[1].role_setting, "postgres");
  requireEqual("temporary current user", roleEvidence[2].current_user, "ingestion_definer");
  requireEqual("after RESET ROLE current user", roleEvidence[3].current_user, simulatedLogin);
  requireEqual("after RESET ROLE setting", roleEvidence[3].role_setting, "none");

  const beforeOriginalFailure = catalogFingerprint();
  const originalFailure = databaseAsHostedLogin(`
    begin;
    set role postgres;
    grant ingestion_definer to postgres;
    grant usage, create on schema ingestion to ingestion_definer;
    set role ingestion_definer;
    reset role;
    revoke create on schema ingestion from ingestion_definer;
    revoke ingestion_definer from postgres;
    commit;
  `, { allowFailure: true });
  if (originalFailure.status === 0) {
    fail("The original unsafe RESET ROLE cleanup unexpectedly succeeded.");
  }
  if (!/permission denied for schema ingestion/i.test(originalFailure.stderr)) {
    fail("The original hosted-role failure was not reproduced exactly.");
  }
  requireEqual(
    "original failure rollback",
    catalogFingerprint(),
    beforeOriginalFailure,
  );

  const injections = [
    {
      name: "before_effective_role_restoration",
      sql: `
        grant ingestion_definer to postgres;
        grant usage, create on schema ingestion to ingestion_definer;
        set role ingestion_definer;
        do $fail$ begin raise exception 'injected-before-restoration'; end $fail$;
      `,
    },
    {
      name: "after_effective_role_restoration",
      sql: `
        grant ingestion_definer to postgres;
        grant usage, create on schema ingestion to ingestion_definer;
        set role ingestion_definer;
        set role postgres;
        do $fail$ begin raise exception 'injected-after-restoration'; end $fail$;
      `,
    },
    {
      name: "before_schema_privilege_cleanup",
      sql: `
        grant ingestion_definer to postgres;
        grant usage, create on schema ingestion to ingestion_definer;
        set role ingestion_definer;
        set role postgres;
        do $fail$ begin raise exception 'injected-before-schema-cleanup'; end $fail$;
      `,
    },
    {
      name: "before_membership_cleanup",
      sql: `
        grant ingestion_definer to postgres;
        grant usage, create on schema ingestion to ingestion_definer;
        set role ingestion_definer;
        set role postgres;
        revoke create on schema ingestion from ingestion_definer;
        do $fail$ begin raise exception 'injected-before-membership-cleanup'; end $fail$;
      `,
    },
  ];
  const failureResults = [];
  for (const injection of injections) {
    const before = catalogFingerprint();
    const publicBefore = publicFingerprint();
    const result = databaseAsHostedLogin(`
      begin;
      set role postgres;
      ${injection.sql}
      commit;
    `, { allowFailure: true });
    if (result.status === 0 || !result.stderr.includes("injected-")) {
      fail(`Failure injection did not fire: ${injection.name}`);
    }
    requireEqual(`${injection.name} catalog rollback`, catalogFingerprint(), before);
    requireEqual(`${injection.name} public rollback`, publicFingerprint(), publicBefore);
    failureResults.push(injection.name);
  }

  const initialPublicFingerprint = publicFingerprint();
  const migrationResults = [];
  for (const file of pendingMigrations) {
    if (file === pendingMigrations[1]) {
      ensureLifecycleRole();
    }
    setupMigrationAuthority(file !== pendingMigrations[0]);
    const version = file.slice(0, 14);
    const name = basename(file, ".sql").slice(15);
    const sql = readFileSync(join("supabase/migrations", file), "utf8");
    const result = databaseAsHostedLogin(`
      begin;
      set role postgres;
      ${sql}
      insert into supabase_migrations.schema_migrations (
        version, name, statements
      ) values (
        '${version}', '${name}', array[]::text[]
      );
      select pg_catalog.jsonb_build_object(
        'version', '${version}',
        'session_user', session_user,
        'current_user', current_user,
        'role_setting', current_setting('role', true),
        'history_count', (
          select count(*) from supabase_migrations.schema_migrations
        ),
        'memberships', (
          select count(*) from pg_catalog.pg_auth_members memberships
          join pg_catalog.pg_roles granted on granted.oid = memberships.roleid
          join pg_catalog.pg_roles member on member.oid = memberships.member
          where granted.rolname in (
            'ingestion_definer', 'ingestion_lifecycle_definer',
            'ingestion_promotion_definer'
          )
            and member.rolname = 'postgres'
        )
      )::text;
      commit;
    `, { timeout: 180_000 });
    const evidence = jsonLines(result.stdout).at(-1);
    if (!evidence) fail(`Migration ${file} returned no role evidence.`);
    requireEqual(`${file} session user`, evidence.session_user, simulatedLogin);
    requireEqual(`${file} current user`, evidence.current_user, "postgres");
    requireEqual(`${file} role setting`, evidence.role_setting, "postgres");
    requireEqual(`${file} temporary memberships`, Number(evidence.memberships), 0);
    cleanupMigrationAuthority();
    requireEqual(
      `${file} public fingerprint`,
      publicFingerprint(),
      initialPublicFingerprint,
    );
    const catalog = roleCatalogState();
    requireEqual(`${file} postgres memberships`, Number(catalog.postgres_memberships), 0);
    requireEqual(`${file} consumer memberships`, Number(catalog.consumer_memberships), 0);
    requireEqual(`${file} ingestion_definer CREATE`, catalog.definer_create, false);
    requireEqual(`${file} lifecycle CREATE`, catalog.lifecycle_create, false);
    copyFileSync(
      join("supabase/migrations", file),
      join(temporaryMigrations, file),
    );
    migrationResults.push({
      version,
      session_user: evidence.session_user,
      current_user: evidence.current_user,
      role_setting: evidence.role_setting,
      history_count: Number(evidence.history_count),
    });

    if (file === pendingMigrations[0]) {
      const replay = run(
        "npx",
        [
          "supabase",
          "migration",
          "up",
          "--local",
          "--include-all",
          "--workdir",
          temporaryRoot,
        ],
        { timeout: 180_000 },
      );
      requireEqual("Migration 1 normal replay exit", replay.status, 0);
      requireEqual(
        "Migration 1 replay history",
        database(`
          select count(*) || '|' || max(version)
          from supabase_migrations.schema_migrations;
        `),
        "28|20260718150000",
      );
    }
  }

  requireEqual(
    "complete migration history",
    database(`
      select count(*) || '|' || max(version)
      from supabase_migrations.schema_migrations;
    `),
    "32|20260721100000",
  );
  requireEqual("complete public fingerprint", publicFingerprint(), initialPublicFingerprint);
  const finalCatalog = roleCatalogState();
  requireEqual("final postgres memberships", Number(finalCatalog.postgres_memberships), 0);
  requireEqual("final consumer memberships", Number(finalCatalog.consumer_memberships), 0);
  requireEqual("final ingestion_definer CREATE", finalCatalog.definer_create, false);
  requireEqual("final lifecycle CREATE", finalCatalog.lifecycle_create, false);
  requireEqual(
    "strict terminal guard",
    database(`
      select position(
        'terminal import runs are immutable'
        in pg_catalog.pg_get_functiondef(
          'ingestion.protect_terminal_run()'::regprocedure
        )
      ) > 0;
    `),
    "t",
  );

  process.stdout.write(`${JSON.stringify({
    status: "hosted_role_compatibility_passed",
    original_behavior: roleEvidence,
    original_permission_failure_reproduced: true,
    rollback_injections: failureResults,
    migrations: migrationResults,
    final_history_count: 32,
    public_fingerprint_unchanged: true,
    direct_catalog_cleanup: finalCatalog,
  })}\n`);
} finally {
  try {
    cleanupSimulatedLogin();
  } finally {
    rmSync(temporaryRoot, { recursive: true, force: true });
  }
}
