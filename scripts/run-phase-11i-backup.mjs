import { spawnSync } from "node:child_process";
import {
  chmodSync,
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { basename, join, resolve } from "node:path";
import {
  assertBackupId,
  assertEncryptedDurableOutput,
  assertEncryptionRecipient,
  assertMigrationHistory,
  assertProductionSource,
  assertRedactedEvidence,
  assertStorageScope,
  EXPECTED_MIGRATION_HEAD,
  fail,
  PRODUCTION_ENVIRONMENT,
  PRODUCTION_PROJECT_REF,
  sha256,
  TASK_ID,
} from "./phase-11i-recovery-contract.mjs";

const AUTH_DURABLE_TABLES = [
  "identities",
  "mfa_factors",
  "users",
  "webauthn_credentials",
];
const USER_OWNED_TABLES = [
  "public.account_activations",
  "public.account_closures",
  "public.custom_food_creation_requests",
  "public.diary_entries",
  "public.food_aliases",
  "public.food_barcodes",
  "public.food_favorites",
  "public.manual_diary_entry_requests",
  "public.nutrition_targets",
  "public.profiles",
  "public.recipe_diary_runs",
  "public.recipe_ingredients",
  "public.recipes",
  "public.saved_meal_diary_runs",
  "public.saved_meal_items",
  "public.saved_meals",
];

const sourceEnvironment = process.env.PHASE11I_SOURCE_ENVIRONMENT;
const backupRootInput = process.env.PHASE11I_BACKUP_ROOT;
const recipientInput = process.env.PHASE11I_RECIPIENT_CERT;
const operator = process.env.PHASE11I_OPERATOR;

assertProductionSource({
  projectRef: PRODUCTION_PROJECT_REF,
  sourceEnvironment,
});
assertEncryptionRecipient(recipientInput);
if (!backupRootInput || !operator) {
  fail("PHASE11I_BACKUP_ROOT and PHASE11I_OPERATOR are required.");
}

function sanitize(message) {
  return String(message ?? "")
    .replace(/postgres(?:ql)?:\/\/\S+/gi, "[REDACTED_DB_URL]")
    .replace(/(PGPASSWORD\s*=\s*)\S+/gi, "$1[REDACTED]")
    .replace(/(Authorization:\s*Bearer\s+)\S+/gi, "$1[REDACTED]")
    .slice(0, 2_000);
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    encoding: "utf8",
    maxBuffer: 128 * 1024 * 1024,
    timeout: 15 * 60 * 1_000,
    ...options,
  });
  if (result.status !== 0) {
    fail(`${command} ${args[0] ?? ""} failed: ${sanitize(result.stderr)}`);
  }
  return result.stdout ?? "";
}

function runSupabase(args) {
  return run("npx", ["supabase", ...args]);
}

function parseLinkedEnvironment() {
  const output = runSupabase(["db", "dump", "--linked", "--dry-run"]);
  const environment = {};
  for (const name of ["PGHOST", "PGPORT", "PGUSER", "PGPASSWORD", "PGDATABASE"]) {
    const match = output.match(new RegExp(`^export ${name}="([^"]+)"$`, "m"));
    if (!match) fail(`Linked transport omitted ${name}.`);
    environment[name] = match[1];
  }
  if (
    environment.PGHOST !== "aws-0-eu-west-1.pooler.supabase.com" ||
    environment.PGPORT !== "5432" ||
    environment.PGUSER !== `cli_login_postgres.${PRODUCTION_PROJECT_REF}` ||
    environment.PGDATABASE !== "postgres"
  ) {
    fail("Linked transport does not match the approved Production project.");
  }
  return {
    ...process.env,
    ...environment,
    PGCONNECT_TIMEOUT: "20",
    PGSSLMODE: "require",
  };
}

function findPsql() {
  for (const candidate of ["/opt/homebrew/opt/libpq/bin/psql", "psql"]) {
    const probe = spawnSync(candidate, ["--version"], { encoding: "utf8" });
    if (probe.status === 0) return candidate;
  }
  fail("psql is required for safe metadata inspection.");
}

const linkedEnvironment = parseLinkedEnvironment();
const psqlBinary = findPsql();

function psql(sql) {
  return run(
    psqlBinary,
    ["-X", "-v", "ON_ERROR_STOP=1", "-q", "-A", "-t", "-F", "\t"],
    { input: `set role postgres; ${sql}`, env: linkedEnvironment },
  ).trim();
}

function rows(sql) {
  const output = psql(sql);
  return output ? output.split(/\r?\n/).map((line) => line.split("\t")) : [];
}

function safeIdentifier(value) {
  if (!/^[a-z_][a-z0-9_]*$/.test(value)) fail("Unexpected database identifier.");
  return value;
}

function exactTableCounts(tableRows) {
  const sql = tableRows
    .map(([schema, table]) => {
      safeIdentifier(schema);
      safeIdentifier(table);
      return `select '${schema}.${table}', count(*)::bigint from "${schema}"."${table}"`;
    })
    .join(" union all ");
  return Object.fromEntries(
    rows(`${sql} order by 1;`).map(([table, count]) => [table, Number(count)]),
  );
}

function accessToken() {
  if (process.env.SUPABASE_ACCESS_TOKEN) return process.env.SUPABASE_ACCESS_TOKEN;
  if (process.platform === "darwin") {
    const result = spawnSync(
      "security",
      ["find-generic-password", "-s", "Supabase CLI", "-a", "supabase", "-w"],
      { encoding: "utf8" },
    );
    if (result.status === 0 && result.stdout.trim()) return result.stdout.trim();
  }
  fail("A Supabase access token is required for redacted provider metadata.");
}

async function managementJson(path) {
  const response = await fetch(`https://api.supabase.com${path}`, {
    headers: { Authorization: `Bearer ${accessToken()}` },
  });
  if (!response.ok) fail(`Supabase Management API read failed (${response.status}).`);
  return response.json();
}

const backupStartedAt = new Date().toISOString();
const repositoryCommit = run("git", ["rev-parse", "HEAD"]).trim();
const repositoryTree = run("git", ["rev-parse", "HEAD^{tree}"]).trim();
const repositoryParent = run("git", ["rev-parse", "HEAD^"]).trim();
const backupId = `phase11i-${PRODUCTION_PROJECT_REF}-${backupStartedAt
  .replace(/[-:]/g, "")
  .replace(/\.\d{3}Z$/, "Z")}-${repositoryCommit.slice(0, 8)}`;
assertBackupId(backupId);

const backupRootRequested = resolve(backupRootInput);
if (lstatSync(backupRootRequested).isSymbolicLink()) {
  fail("Backup root must not be a symlink.");
}
const backupRoot = realpathSync(backupRootRequested);
if ((statSync(backupRoot).mode & 0o077) !== 0) {
  fail("Backup root must be a non-symlink directory restricted to its owner.");
}
const recipientRequested = resolve(recipientInput);
const recipientStat = lstatSync(recipientRequested);
if (!recipientStat.isFile() || recipientStat.isSymbolicLink()) {
  fail("Encryption recipient must be a regular non-symlink certificate.");
}
const recipientPath = realpathSync(recipientRequested);

const archivePath = join(backupRoot, `${backupId}.archive.cms`);
const manifestPath = join(backupRoot, `${backupId}.manifest.json`);
assertEncryptedDurableOutput(archivePath);
if (existsSync(archivePath) || existsSync(manifestPath)) {
  fail("Backup identity already exists; refusing overwrite.");
}

const workRoot = mkdtempSync(join(tmpdir(), "phase11i-backup-"));
const contentRoot = join(workRoot, "content");
const tarPath = join(workRoot, `${backupId}.tar`);
const verificationTar = join(workRoot, `${backupId}.verified.tar`);
mkdirSync(contentRoot, { mode: 0o700 });
chmodSync(workRoot, 0o700);

try {
  const project = await managementJson(`/v1/projects/${PRODUCTION_PROJECT_REF}`);
  if (
    project.id !== PRODUCTION_PROJECT_REF ||
    project.region !== "eu-west-1" ||
    project.status !== "ACTIVE_HEALTHY"
  ) {
    fail("Production project identity, region, or health mismatch.");
  }

  const authConfig = await managementJson(
    `/v1/projects/${PRODUCTION_PROJECT_REF}/config/auth`,
  );
  const redirectAllowList = String(authConfig.uri_allow_list ?? "")
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
  const redactedAuthConfig = {
    signupEnabled: authConfig.disable_signup === false,
    anonymousSignupEnabled: authConfig.external_anonymous_users_enabled === true,
    emailPasswordEnabled: authConfig.external_email_enabled === true,
    phoneEnabled: authConfig.external_phone_enabled === true,
    passwordMinLength: authConfig.password_min_length,
    passwordRequiredCharacters: authConfig.password_required_characters,
    siteUrl: authConfig.site_url,
    redirectAllowList: {
      count: redirectAllowList.length,
      allHttps: redirectAllowList.every((entry) => entry.startsWith("https://")),
      localhostEntries: redirectAllowList.filter((entry) =>
        /^https?:\/\/(?:localhost|127\.0\.0\.1)(?::|\/|$)/.test(entry),
      ).length,
    },
    customSmtpConfigured: Boolean(authConfig.smtp_host && authConfig.smtp_user),
    smtpQualificationState: "NOT_DELIVERY_QUALIFIED",
    leakedPasswordProtection: authConfig.password_hibp_enabled === true,
    dec033ExceptionState:
      authConfig.password_hibp_enabled === true
        ? "NOT_REQUIRED"
        : "ACCEPTED_FREE_PLAN_LIMITATION",
  };
  assertRedactedEvidence(redactedAuthConfig);

  const migrations = rows(
    "select version from supabase_migrations.schema_migrations order by version;",
  ).map(([version]) => version);
  assertMigrationHistory(migrations);

  const applicationTables = rows(
    "select table_schema,table_name from information_schema.tables where table_type='BASE TABLE' and table_schema in ('public','ingestion') order by 1,2;",
  );
  const tableCounts = exactTableCounts(applicationTables);
  for (const table of USER_OWNED_TABLES) {
    if (tableCounts[table] !== 0) fail(`Expected zero user-owned rows in ${table}.`);
  }
  for (const [table, expected] of [
    ["public.foods", 353],
    ["public.food_nutrients", 1199],
    ["public.nutrients", 35],
    ["public.food_sources", 4],
  ]) {
    if (tableCounts[table] !== expected) fail(`Reference count mismatch for ${table}.`);
  }

  const authCounts = Object.fromEntries(
    rows(`
      select 'users',count(*) from auth.users
      union all select 'identities',count(*) from auth.identities
      union all select 'sessions',count(*) from auth.sessions
      union all select 'refreshTokens',count(*) from auth.refresh_tokens
      union all select 'mfaFactors',count(*) from auth.mfa_factors
      union all select 'webauthnCredentials',count(*) from auth.webauthn_credentials
      order by 1;
    `).map(([name, count]) => [name, Number(count)]),
  );
  if (
    authCounts.users !== 0 ||
    authCounts.identities !== 0 ||
    authCounts.sessions !== 0 ||
    authCounts.refreshTokens !== 0
  ) {
    fail("Production Auth zero-user baseline mismatch.");
  }

  const [storageBuckets, storageObjects] = rows(`
    select (select count(*) from storage.buckets),
           (select count(*) from storage.objects);
  `).at(0).map(Number);
  assertStorageScope({ buckets: storageBuckets, objects: storageObjects });

  const vaultRows = rows("select name from vault.secrets order by name;");
  const vaultSecretNames = vaultRows.map(([name]) => name);
  if (
    vaultSecretNames.length !== 1 ||
    vaultSecretNames[0] !== "account_closure_capability_v1"
  ) {
    fail("Vault secret-name inventory mismatch.");
  }

  const rlsDisabledTables = rows(`
    select n.nspname||'.'||c.relname
    from pg_class c join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='public' and c.relkind in ('r','p') and not c.relrowsecurity
    order by 1;
  `).map(([name]) => name);
  if (rlsDisabledTables.length) fail("A public application table has RLS disabled.");

  const unexpectedMutationGrants = rows(`
    select grantee,table_name,privilege_type
    from information_schema.role_table_grants
    where table_schema='public'
      and grantee in ('PUBLIC','anon')
      and privilege_type in ('INSERT','UPDATE','DELETE','TRUNCATE','TRIGGER','REFERENCES')
    order by 1,2,3;
  `);
  if (unexpectedMutationGrants.length) fail("Unexpected anonymous/PUBLIC mutation grant.");

  const securityDefinerMissingSearchPath = rows(`
    select n.nspname||'.'||p.proname
    from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname in ('public','ingestion') and p.prosecdef
      and not exists (
        select 1 from unnest(coalesce(p.proconfig,array[]::text[])) entry
        where entry like 'search_path=%'
      )
    order by 1;
  `).map(([name]) => name);
  if (securityDefinerMissingSearchPath.length) {
    fail("SECURITY DEFINER function is missing an intentional search_path.");
  }

  const authTables = rows(
    "select table_name from information_schema.tables where table_schema='auth' and table_type='BASE TABLE' order by table_name;",
  ).map(([name]) => name);
  for (const required of AUTH_DURABLE_TABLES) {
    if (!authTables.includes(required)) fail(`Required Auth durable table missing: ${required}.`);
  }
  const authExclusions = authTables
    .filter((table) => !AUTH_DURABLE_TABLES.includes(table))
    .map((table) => `auth.${table}`)
    .join(",");

  const artifactPaths = {
    roles: join(contentRoot, "roles.sql"),
    schema: join(contentRoot, "application-schema.sql"),
    data: join(contentRoot, "application-data.sql"),
    auth: join(contentRoot, "auth-durable-data.sql"),
    migrationLedger: join(contentRoot, "migration-ledger.json"),
    authConfig: join(contentRoot, "auth-config-redacted.json"),
    sourceSnapshot: join(contentRoot, "source-snapshot-redacted.json"),
  };

  runSupabase(["db", "dump", "--linked", "--role-only", "--file", artifactPaths.roles]);
  runSupabase([
    "db",
    "dump",
    "--linked",
    "--schema",
    "public,ingestion",
    "--file",
    artifactPaths.schema,
  ]);
  runSupabase([
    "db",
    "dump",
    "--linked",
    "--data-only",
    "--schema",
    "public,ingestion",
    "--file",
    artifactPaths.data,
  ]);
  runSupabase([
    "db",
    "dump",
    "--linked",
    "--data-only",
    "--schema",
    "auth",
    "--exclude",
    authExclusions,
    "--file",
    artifactPaths.auth,
  ]);

  const sourceSnapshot = {
    sourceProjectRef: PRODUCTION_PROJECT_REF,
    sourceEnvironment: PRODUCTION_ENVIRONMENT,
    projectRegion: project.region,
    projectHealth: project.status,
    postgresVersion: project.database?.version,
    migrationCount: migrations.length,
    migrationHead: migrations.at(-1),
    applicationTableCount: applicationTables.length,
    tableCounts,
    authCounts,
    storage: { buckets: storageBuckets, objects: storageObjects },
    vaultSecretNames,
    rlsDisabledTables,
    unexpectedMutationGrants,
    securityDefinerMissingSearchPath,
  };
  assertRedactedEvidence(sourceSnapshot);
  writeFileSync(
    artifactPaths.migrationLedger,
    `${JSON.stringify({ versions: migrations }, null, 2)}\n`,
    { mode: 0o600 },
  );
  writeFileSync(artifactPaths.authConfig, `${JSON.stringify(redactedAuthConfig, null, 2)}\n`, {
    mode: 0o600,
  });
  writeFileSync(artifactPaths.sourceSnapshot, `${JSON.stringify(sourceSnapshot, null, 2)}\n`, {
    mode: 0o600,
  });

  const artifacts = Object.entries(artifactPaths).map(([component, path]) => {
    chmodSync(path, 0o600);
    const bytes = readFileSync(path);
    if (!bytes.length) fail(`${component} backup artifact is empty.`);
    return {
      component,
      filename: basename(path),
      bytes: bytes.length,
      sha256: sha256(bytes),
    };
  });

  const recipientFingerprint = run("openssl", [
    "x509",
    "-in",
    recipientPath,
    "-noout",
    "-fingerprint",
    "-sha256",
  ])
    .trim()
    .split("=")
    .at(-1)
    .replaceAll(":", "")
    .toLowerCase();
  const contentManifest = {
    schemaVersion: "phase-11i-backup-content/v1",
    taskId: TASK_ID,
    backupId,
    sourceProjectRef: PRODUCTION_PROJECT_REF,
    sourceEnvironment: PRODUCTION_ENVIRONMENT,
    sourceRepository: "Papi299/nutrition-tracker-app",
    sourceCommit: repositoryCommit,
    sourceTree: repositoryTree,
    sourceParent: repositoryParent,
    backupStartedAt,
    backupScope: {
      applicationSchemas: ["public", "ingestion"],
      rolesAndGrants: true,
      migrationLedger: true,
      authDurableTables: AUTH_DURABLE_TABLES.map((table) => `auth.${table}`),
      authExcludedVolatileState: [
        "auth.sessions",
        "auth.refresh_tokens",
        "auth.one_time_tokens",
        "auth.flow_state",
        "auth.mfa_challenges",
        "auth.mfa_recovery_codes",
      ],
      storage: "STORAGE_NOT_USED_CURRENTLY",
      vault: "IDENTIFIER_ONLY_SEPARATE_REPROVISION_CONTROL",
    },
    migrationHead: EXPECTED_MIGRATION_HEAD,
    artifacts,
    encryption: {
      format: "CMS AuthEnvelopedData DER",
      contentEncryption: "AES-256-GCM",
      keyTransport: "RSA-3072 recipient certificate",
      recipientCertificateSha256: recipientFingerprint,
      privateKeyCommitted: false,
    },
    operator,
  };
  assertRedactedEvidence(contentManifest);
  const contentManifestPath = join(contentRoot, "backup-content-manifest.json");
  const contentManifestBytes = Buffer.from(
    `${JSON.stringify(contentManifest, null, 2)}\n`,
    "utf8",
  );
  writeFileSync(contentManifestPath, contentManifestBytes, { mode: 0o600 });

  run("tar", ["-cf", tarPath, "-C", contentRoot, "."]);
  chmodSync(tarPath, 0o600);
  const plaintextArchiveBytes = statSync(tarPath).size;
  const plaintextArchiveSha256 = sha256(readFileSync(tarPath));
  run("openssl", [
    "cms",
    "-encrypt",
    "-binary",
    "-aes-256-gcm",
    "-outform",
    "DER",
    "-in",
    tarPath,
    "-out",
    archivePath,
    recipientPath,
  ]);
  chmodSync(archivePath, 0o600);
  const cmsDescription = run("openssl", [
    "cms",
    "-cmsout",
    "-print",
    "-inform",
    "DER",
    "-in",
    archivePath,
  ]);
  if (!cmsDescription.includes("id-smime-ct-authEnvelopedData")) {
    fail("Encrypted archive is not CMS AuthEnvelopedData.");
  }

  const privateKey = process.env.PHASE11I_RECOVERY_PRIVATE_KEY;
  if (privateKey) {
    run("openssl", [
      "cms",
      "-decrypt",
      "-binary",
      "-inform",
      "DER",
      "-in",
      archivePath,
      "-recip",
      recipientPath,
      "-inkey",
      realpathSync(resolve(privateKey)),
      "-out",
      verificationTar,
    ]);
    if (sha256(readFileSync(verificationTar)) !== plaintextArchiveSha256) {
      fail("Post-encryption decrypt verification mismatch.");
    }
  }

  const backupCompletedAt = new Date().toISOString();
  const finalManifest = {
    ...contentManifest,
    schemaVersion: "phase-11i-backup-manifest/v1",
    backupCompletedAt,
    dumpTools: {
      supabaseCli: runSupabase(["--version"]).trim(),
      psql: run(psqlBinary, ["--version"]).trim(),
      openssl: run("openssl", ["version"]).trim(),
    },
    plaintextArchiveBytes,
    plaintextArchiveSha256,
    plaintextTemporaryRemoved: true,
    encryptedArchiveBytes: statSync(archivePath).size,
    encryptedArchiveSha256: sha256(readFileSync(archivePath)),
    contentManifestSha256: sha256(contentManifestBytes),
    postEncryptionDecryptVerification: privateKey ? "PASS" : "PENDING_RESTORE",
    credentialScanStatus: "REDACTED_MANIFEST_PASS",
  };
  assertRedactedEvidence(finalManifest);
  const manifestBytes = Buffer.from(`${JSON.stringify(finalManifest, null, 2)}\n`);
  writeFileSync(manifestPath, manifestBytes, { mode: 0o600 });
  chmodSync(manifestPath, 0o600);

  process.stdout.write(
    `${JSON.stringify({
      status: "BACKUP_COMPLETE",
      backupId,
      archivePath,
      manifestPath,
      backupStartedAt,
      backupCompletedAt,
      encryptedArchiveSha256: finalManifest.encryptedArchiveSha256,
      manifestSha256: sha256(manifestBytes),
      migrationHead: finalManifest.migrationHead,
      sourceSafeCounts: sourceSnapshot,
      recipientCertificateSha256: recipientFingerprint,
      plaintextTemporaryRemoved: true,
    })}\n`,
  );
} finally {
  rmSync(workRoot, { force: true, recursive: true });
}
