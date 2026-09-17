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
import { basename, dirname, isAbsolute, join, resolve } from "node:path";
import {
  assertBackupId,
  assertHash,
  assertIsolatedRestoreTarget,
  assertMigrationHistory,
  assertProductionSource,
  assertRedactedEvidence,
  assertStorageScope,
  fail,
  PRODUCTION_ENVIRONMENT,
  PRODUCTION_PROJECT_REF,
  RECOVERY_TARGET,
  sha256,
  TASK_ID,
} from "./phase-11i-recovery-contract.mjs";

const EXPECTED_ARCHIVE_FILES = [
  "application-data.sql",
  "application-schema.sql",
  "auth-config-redacted.json",
  "auth-durable-data.sql",
  "backup-content-manifest.json",
  "migration-ledger.json",
  "roles.sql",
  "source-snapshot-redacted.json",
];

const DUMP_SESSION_SETTINGS =
  /^SET (?:transaction_timeout|statement_timeout|lock_timeout|idle_in_transaction_session_timeout|client_encoding|standard_conforming_strings|check_function_bodies|xmloption|client_min_messages|row_security)/;

function normalizedDumpLines(path) {
  return readFileSync(path, "utf8")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(
      (line) =>
        line &&
        !line.startsWith("--") &&
        !line.startsWith("\\restrict") &&
        !line.startsWith("\\unrestrict") &&
        !DUMP_SESSION_SETTINGS.test(line),
    );
}

function multisetDifference(left, right) {
  const remaining = new Map();
  for (const line of right) remaining.set(line, (remaining.get(line) ?? 0) + 1);
  const difference = [];
  for (const line of left) {
    const count = remaining.get(line) ?? 0;
    if (count > 0) remaining.set(line, count - 1);
    else difference.push(line);
  }
  return difference;
}

function isPrivilegeStatement(line) {
  return /^(?:GRANT|REVOKE|ALTER DEFAULT PRIVILEGES\b.*\b(?:GRANT|REVOKE))\b/.test(
    line,
  );
}

function grantToRevoke(statement) {
  const defaultPrivileges = /^(ALTER DEFAULT PRIVILEGES\b.*?) GRANT (.+) ON (.+) TO (.+);$/.exec(
    statement,
  );
  if (defaultPrivileges) {
    return `${defaultPrivileges[1]} REVOKE ${defaultPrivileges[2]} ON ${defaultPrivileges[3]} FROM ${defaultPrivileges[4]};`;
  }
  const grant = /^GRANT (.+) ON (.+) TO (.+);$/.exec(statement);
  if (!grant || grant[3].includes(" WITH GRANT OPTION")) {
    fail("Unsupported privilege compatibility statement.");
  }
  return `REVOKE ${grant[1]} ON ${grant[2]} FROM ${grant[3]};`;
}

const archiveInput = process.env.PHASE11I_ARCHIVE;
const manifestInput = process.env.PHASE11I_MANIFEST;
const recipientInput = process.env.PHASE11I_RECIPIENT_CERT;
const privateKeyInput = process.env.PHASE11I_RECOVERY_PRIVATE_KEY;
const reportInput = process.env.PHASE11I_RESTORE_REPORT;
const targetIdentity = process.env.PHASE11I_RESTORE_TARGET;

if (
  !archiveInput ||
  !manifestInput ||
  !recipientInput ||
  !privateKeyInput ||
  !reportInput
) {
  fail("Archive, manifest, recipient, private key, and restore report paths are required.");
}

function sanitize(message) {
  return String(message ?? "")
    .replace(/postgres(?:ql)?:\/\/\S+/gi, "[REDACTED_DB_URL]")
    .replace(/(PGPASSWORD\s*=\s*)\S+/gi, "$1[REDACTED]")
    .slice(0, 2_000);
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    encoding: "utf8",
    maxBuffer: 128 * 1024 * 1024,
    timeout: 20 * 60 * 1_000,
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

function parseEnvironment(output) {
  const result = {};
  for (const line of output.split(/\r?\n/)) {
    const match = /^([A-Z][A-Z0-9_]*)=(.*)$/.exec(line.trim());
    if (!match) continue;
    const raw = match[2];
    result[match[1]] = raw.startsWith('"') && raw.endsWith('"') ? raw.slice(1, -1) : raw;
  }
  return result;
}

function regularPath(input, label) {
  const requested = resolve(input);
  const stat = lstatSync(requested);
  if (!stat.isFile() || stat.isSymbolicLink()) fail(`${label} must be a regular non-symlink file.`);
  return realpathSync(requested);
}

const archivePath = regularPath(archiveInput, "Encrypted archive");
const manifestPath = regularPath(manifestInput, "Backup manifest");
const recipientPath = regularPath(recipientInput, "Recipient certificate");
const privateKeyPath = regularPath(privateKeyInput, "Recovery private key");
if ((statSync(privateKeyPath).mode & 0o077) !== 0) {
  fail("Recovery private key must be restricted to its owner.");
}
if (!isAbsolute(reportInput)) fail("Restore report path must be absolute.");
const reportPath = resolve(reportInput);
if (existsSync(reportPath)) fail("Restore report already exists; refusing overwrite.");
const reportRoot = realpathSync(dirname(reportPath));
if ((statSync(reportRoot).mode & 0o077) !== 0) {
  fail("Restore report directory must be restricted to its owner.");
}
const recoveryStartedAt = new Date().toISOString();
const manifestBytes = readFileSync(manifestPath);
const manifest = JSON.parse(manifestBytes.toString("utf8"));
assertRedactedEvidence(manifest);
assertBackupId(manifest.backupId);
assertProductionSource({
  projectRef: manifest.sourceProjectRef,
  sourceEnvironment: manifest.sourceEnvironment,
});
if (manifest.taskId !== TASK_ID || manifest.schemaVersion !== "phase-11i-backup-manifest/v1") {
  fail("Backup manifest contract identity mismatch.");
}
if (
  basename(archivePath) !== `${manifest.backupId}.archive.cms` ||
  basename(manifestPath) !== `${manifest.backupId}.manifest.json`
) {
  fail("Selected restore artifacts do not match their backup identity.");
}
assertHash(readFileSync(archivePath), manifest.encryptedArchiveSha256, "encrypted archive");
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
if (recipientFingerprint !== manifest.encryption?.recipientCertificateSha256) {
  fail("Recovery recipient fingerprint does not match the backup manifest.");
}

const localEnvironment = parseEnvironment(runSupabase(["status", "-o", "env"]));
const targetDatabaseUrl = localEnvironment.DB_URL;
assertIsolatedRestoreTarget({ targetIdentity, targetDatabaseUrl });
const config = readFileSync("supabase/config.toml", "utf8");
const projectId = config.match(/^project_id\s*=\s*"([^"]+)"/m)?.[1];
if (!projectId || projectId !== "phase-11i-recovery-isolated") {
  fail("Local project_id must be phase-11i-recovery-isolated for recovery execution.");
}
const databaseContainer = `supabase_db_${projectId}`;

function database(sql) {
  return run(
    "docker",
    [
      "exec",
      "-i",
      databaseContainer,
      "psql",
      "-U",
      "postgres",
      "-d",
      "postgres",
      "-X",
      "-v",
      "ON_ERROR_STOP=1",
      "-q",
      "-A",
      "-t",
      "-F",
      "\t",
    ],
    { input: sql },
  ).trim();
}

function databaseFile(path) {
  run(
    "docker",
    [
      "exec",
      "-i",
      databaseContainer,
      "psql",
      "-U",
      "postgres",
      "-d",
      "postgres",
      "-X",
      "-v",
      "ON_ERROR_STOP=1",
      "-q",
    ],
    { input: readFileSync(path) },
  );
}

function safeIdentifier(value) {
  if (!/^[a-z_][a-z0-9_]*$/.test(value)) fail("Unexpected database identifier.");
  return value;
}

const workRoot = mkdtempSync(join(tmpdir(), "phase11i-restore-"));
chmodSync(workRoot, 0o700);
const tarPath = join(workRoot, `${manifest.backupId}.tar`);
const contentRoot = join(workRoot, "content");
mkdirSync(contentRoot, { mode: 0o700 });

try {
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
    privateKeyPath,
    "-out",
    tarPath,
  ]);
  chmodSync(tarPath, 0o600);
  assertHash(readFileSync(tarPath), manifest.plaintextArchiveSha256, "decrypted archive");

  const members = run("tar", ["-tf", tarPath])
    .split(/\r?\n/)
    .filter(Boolean);
  const normalizedMembers = members.map((member) =>
    member === "." || member === "./" ? "" : member.replace(/^\.\//, ""),
  );
  if (
    normalizedMembers.length !== EXPECTED_ARCHIVE_FILES.length + 1 ||
    members.some(
      (member) => member.startsWith("/") || member.split("/").includes(".."),
    ) ||
    normalizedMembers.filter((member) => member === "").length !== 1 ||
    EXPECTED_ARCHIVE_FILES.some(
      (expected) => normalizedMembers.filter((member) => member === expected).length !== 1,
    )
  ) {
    fail("Encrypted archive member inventory is unsafe or unexpected.");
  }
  const verboseMembers = run("tar", ["-tvf", tarPath])
    .split(/\r?\n/)
    .filter(Boolean);
  if (
    verboseMembers.length !== members.length ||
    verboseMembers.some((line) => {
      const member = members.find((candidate) => line.endsWith(` ${candidate}`));
      if (!member) return true;
      const normalized =
        member === "." || member === "./" ? "" : member.replace(/^\.\//, "");
      return normalized === "" ? line[0] !== "d" : line[0] !== "-";
    })
  ) {
    fail("Encrypted archive contains a link or non-regular member.");
  }
  run("tar", ["-xf", tarPath, "-C", contentRoot]);

  for (const filename of EXPECTED_ARCHIVE_FILES) {
    const extracted = join(contentRoot, filename);
    const stat = lstatSync(extracted);
    if (
      !stat.isFile() ||
      stat.isSymbolicLink() ||
      dirname(realpathSync(extracted)) !== realpathSync(contentRoot)
    ) {
      fail(`Extracted backup member is not a controlled regular file: ${filename}.`);
    }
  }

  const contentManifestPath = join(contentRoot, "backup-content-manifest.json");
  const contentManifestBytes = readFileSync(contentManifestPath);
  assertHash(
    contentManifestBytes,
    manifest.contentManifestSha256,
    "backup content manifest",
  );
  const contentManifest = JSON.parse(contentManifestBytes.toString("utf8"));
  assertRedactedEvidence(contentManifest);
  if (
    contentManifest.backupId !== manifest.backupId ||
    contentManifest.sourceCommit !== manifest.sourceCommit ||
    contentManifest.taskId !== TASK_ID ||
    contentManifest.sourceProjectRef !== PRODUCTION_PROJECT_REF ||
    contentManifest.sourceEnvironment !== PRODUCTION_ENVIRONMENT
  ) {
    fail("Backup content manifest identity mismatch.");
  }
  const expectedComponentFiles = [
    "application-data.sql",
    "application-schema.sql",
    "auth-config-redacted.json",
    "auth-durable-data.sql",
    "migration-ledger.json",
    "roles.sql",
    "source-snapshot-redacted.json",
  ];
  const artifactFilenames = contentManifest.artifacts
    .map((artifact) => artifact.filename)
    .sort();
  if (JSON.stringify(artifactFilenames) !== JSON.stringify(expectedComponentFiles)) {
    fail("Backup content manifest artifact inventory mismatch.");
  }
  for (const artifact of contentManifest.artifacts) {
    const path = join(contentRoot, artifact.filename);
    assertHash(readFileSync(path), artifact.sha256, artifact.component);
  }

  const migrations = JSON.parse(
    readFileSync(join(contentRoot, "migration-ledger.json"), "utf8"),
  ).versions;
  assertMigrationHistory(migrations);
  const sourceSnapshot = JSON.parse(
    readFileSync(join(contentRoot, "source-snapshot-redacted.json"), "utf8"),
  );
  assertRedactedEvidence(sourceSnapshot);
  assertStorageScope(sourceSnapshot.storage);

  runSupabase(["db", "reset", "--local"]);

  const localRolesPath = join(workRoot, "local-roles.sql");
  const localSchemaPath = join(workRoot, "local-application-schema.sql");
  runSupabase(["db", "dump", "--local", "--role-only", "--file", localRolesPath]);
  runSupabase([
    "db",
    "dump",
    "--local",
    "--schema",
    "public,ingestion",
    "--file",
    localSchemaPath,
  ]);
  const roleComparison = {
    sourceSha256: sha256(readFileSync(join(contentRoot, "roles.sql"))),
    restoreSha256: sha256(readFileSync(localRolesPath)),
  };
  const schemaComparison = {
    sourceSha256: sha256(readFileSync(join(contentRoot, "application-schema.sql"))),
    restoreSha256: sha256(readFileSync(localSchemaPath)),
  };
  const sourceRoleLines = normalizedDumpLines(join(contentRoot, "roles.sql"));
  const localRoleLines = normalizedDumpLines(localRolesPath);
  const sourceOnlyRoles = multisetDifference(sourceRoleLines, localRoleLines);
  const localOnlyRoles = multisetDifference(localRoleLines, sourceRoleLines);
  const expectedProviderRoleDelta =
    sourceOnlyRoles.length === 1 &&
    /^ALTER ROLE "supabase_admin" SET "statement_timeout" TO /.test(
      sourceOnlyRoles[0],
    ) &&
    localOnlyRoles.length === 1 &&
    localOnlyRoles[0] ===
      'GRANT SET ON PARAMETER "log_min_messages" TO "supabase_realtime_admin";';
  if (!expectedProviderRoleDelta) {
    fail("Unexpected custom or provider role drift from the isolated baseline.");
  }
  roleComparison.equal = false;
  roleComparison.applicationAndCustomRolesEqual = true;
  roleComparison.providerManagedCompatibilityDelta = {
    sourceOnlyStatements: sourceOnlyRoles.length,
    localOnlyStatements: localOnlyRoles.length,
    classification: "EXPECTED_SUPABASE_PROVIDER_VERSION_DELTA",
  };

  const sourceSchemaLines = normalizedDumpLines(
    join(contentRoot, "application-schema.sql"),
  );
  const localSchemaLines = normalizedDumpLines(localSchemaPath);
  const sourceOnlySchema = multisetDifference(sourceSchemaLines, localSchemaLines);
  const localOnlySchema = multisetDifference(localSchemaLines, sourceSchemaLines);
  const nonPrivilegeDifferences = [...sourceOnlySchema, ...localOnlySchema].filter(
    (line) => !isPrivilegeStatement(line),
  );
  if (nonPrivilegeDifferences.length > 0) {
    fail("Source and migration-replayed application structures differ.");
  }

  const compatibilitySql = [
    ...localOnlySchema.filter((line) => line.startsWith("GRANT ")).map(grantToRevoke),
    ...localOnlySchema
      .filter((line) => line.startsWith("ALTER DEFAULT PRIVILEGES "))
      .map(grantToRevoke),
    ...sourceOnlySchema,
  ];
  if (compatibilitySql.length > 0) database(compatibilitySql.join("\n"));

  const faithfulSchemaPath = join(workRoot, "privilege-faithful-schema.sql");
  runSupabase([
    "db",
    "dump",
    "--local",
    "--schema",
    "public,ingestion",
    "--file",
    faithfulSchemaPath,
  ]);
  const faithfulSchemaLines = normalizedDumpLines(faithfulSchemaPath);
  const sourceAfterCompatibility = multisetDifference(
    sourceSchemaLines,
    faithfulSchemaLines,
  );
  const targetAfterCompatibility = multisetDifference(
    faithfulSchemaLines,
    sourceSchemaLines,
  );
  if (sourceAfterCompatibility.length || targetAfterCompatibility.length) {
    fail("Privilege-faithful compatibility transform did not reproduce source schema state.");
  }
  schemaComparison.equal = true;
  schemaComparison.normalizedSourceSha256 = sha256(
    Buffer.from(JSON.stringify([...sourceSchemaLines].sort())),
  );
  schemaComparison.normalizedRestoreSha256 = sha256(
    Buffer.from(JSON.stringify([...faithfulSchemaLines].sort())),
  );
  schemaComparison.compatibilityTransform = {
    classification: "DETERMINISTIC_APPLICATION_ACL_SYNCHRONIZATION",
    structuralDifferences: nonPrivilegeDifferences.length,
    sourcePrivilegesAdded: sourceOnlySchema.length,
    targetOnlyPrivilegesRemoved: localOnlySchema.length,
  };

  const sourceTables = Object.keys(sourceSnapshot.tableCounts).map((qualified) => {
    const [schema, table] = qualified.split(".");
    safeIdentifier(schema);
    safeIdentifier(table);
    return `"${schema}"."${table}"`;
  });
  database(
    "set session_replication_role=replica; truncate table auth.identities,auth.mfa_factors,auth.webauthn_credentials,auth.users cascade; reset session_replication_role;",
  );
  databaseFile(join(contentRoot, "auth-durable-data.sql"));
  database(
    `set session_replication_role=replica; truncate table ${sourceTables.join(",")} restart identity cascade; reset session_replication_role;`,
  );
  databaseFile(join(contentRoot, "application-data.sql"));

  const restoredMigrations = database(
    "select version from supabase_migrations.schema_migrations order by version;",
  )
    .split(/\r?\n/)
    .filter(Boolean);
  if (JSON.stringify(restoredMigrations) !== JSON.stringify(migrations)) {
    fail("Migration history mismatch after restore.");
  }

  const countSql = Object.keys(sourceSnapshot.tableCounts)
    .map((qualified) => {
      const [schema, table] = qualified.split(".");
      return `select '${qualified}',count(*)::bigint from "${schema}"."${table}"`;
    })
    .join(" union all ");
  const restoreCounts = Object.fromEntries(
    database(`${countSql} order by 1;`)
      .split(/\r?\n/)
      .filter(Boolean)
      .map((line) => {
        const [table, count] = line.split("\t");
        return [table, Number(count)];
      }),
  );
  const countMismatches = [...
    new Set([
      ...Object.keys(sourceSnapshot.tableCounts),
      ...Object.keys(restoreCounts),
    ]),
  ]
    .filter(
      (table) => restoreCounts[table] !== sourceSnapshot.tableCounts[table],
    )
    .map((table) => ({
      table,
      source: sourceSnapshot.tableCounts[table],
      restore: restoreCounts[table],
    }));
  if (countMismatches.length) {
    fail(`Application row-count mismatch after restore: ${JSON.stringify(countMismatches)}`);
  }

  const restoredAuthCounts = Object.fromEntries(
    database(`
      select 'identities',count(*) from auth.identities
      union all select 'mfaFactors',count(*) from auth.mfa_factors
      union all select 'refreshTokens',count(*) from auth.refresh_tokens
      union all select 'sessions',count(*) from auth.sessions
      union all select 'users',count(*) from auth.users
      union all select 'webauthnCredentials',count(*) from auth.webauthn_credentials
      order by 1;
    `)
      .split(/\r?\n/)
      .filter(Boolean)
      .map((line) => {
        const [name, count] = line.split("\t");
        return [name, Number(count)];
      }),
  );
  for (const durable of ["users", "identities", "mfaFactors", "webauthnCredentials"]) {
    if (restoredAuthCounts[durable] !== sourceSnapshot.authCounts[durable]) {
      fail(`Auth durable-state mismatch for ${durable}.`);
    }
  }
  if (restoredAuthCounts.sessions !== 0 || restoredAuthCounts.refreshTokens !== 0) {
    fail("Volatile Auth session state was unexpectedly restored.");
  }

  const restoredStorage = Object.fromEntries(
    database(
      "select 'buckets',count(*) from storage.buckets union all select 'objects',count(*) from storage.objects order by 1;",
    )
      .split(/\r?\n/)
      .map((line) => {
        const [name, count] = line.split("\t");
        return [name, Number(count)];
      }),
  );
  assertStorageScope(restoredStorage);

  const rlsDisabledTables = database(`
    select n.nspname||'.'||c.relname
    from pg_class c join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='public' and c.relkind in ('r','p') and not c.relrowsecurity
    order by 1;
  `)
    .split(/\r?\n/)
    .filter(Boolean);
  const unexpectedMutationGrants = database(`
    select grantee||':'||table_name||':'||privilege_type
    from information_schema.role_table_grants
    where table_schema='public' and grantee in ('PUBLIC','anon')
      and privilege_type in ('INSERT','UPDATE','DELETE','TRUNCATE','TRIGGER','REFERENCES')
    order by 1;
  `)
    .split(/\r?\n/)
    .filter(Boolean);
  const securityDefinerMissingSearchPath = database(`
    select n.nspname||'.'||p.proname
    from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname in ('public','ingestion') and p.prosecdef
      and not exists (
        select 1 from unnest(coalesce(p.proconfig,array[]::text[])) entry
        where entry like 'search_path=%'
      )
    order by 1;
  `)
    .split(/\r?\n/)
    .filter(Boolean);
  if (
    rlsDisabledTables.length ||
    unexpectedMutationGrants.length ||
    securityDefinerMissingSearchPath.length
  ) {
    fail("RLS, grant, or SECURITY DEFINER regression after restore.");
  }

  const recoveryRestoredAt = new Date().toISOString();
  const report = {
    schemaVersion: "phase-11i-restore-report/v1",
    backupId: manifest.backupId,
    sourceCommit: manifest.sourceCommit,
    sourceTree: manifest.sourceTree,
    targetIdentity: RECOVERY_TARGET,
    targetProjectId: projectId,
    recoveryStartedAt,
    recoveryRestoredAt,
    archiveIntegrity: "PASS",
    contentIntegrity: "PASS",
    migrationHistory: {
      count: restoredMigrations.length,
      head: restoredMigrations.at(-1),
      equal: true,
    },
    roleComparison,
    schemaComparison,
    sourceSafeCounts: sourceSnapshot.tableCounts,
    restoreSafeCounts: restoreCounts,
    authComparison: {
      source: sourceSnapshot.authCounts,
      restore: restoredAuthCounts,
      durableStateEqual: true,
      volatileSessionsRestored: false,
    },
    storage: restoredStorage,
    rlsComparison: { disabledPublicTables: [], equal: true },
    grantComparison: { unexpectedAnonymousOrPublicMutationGrants: [], equal: true },
    securityDefinerSearchPaths: { missing: [], result: "PASS" },
    vaultRecoveryBoundary: "SYNTHETIC_SECRET_REPROVISION_REQUIRED_FOR_SMOKE",
    plaintextTemporaryRemovalGuaranteedByFinally: true,
  };
  assertRedactedEvidence(report);
  writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, { mode: 0o600 });
  process.stdout.write(`${JSON.stringify({ status: "RESTORE_COMPLETE", reportPath, ...report })}\n`);
} finally {
  rmSync(workRoot, { force: true, recursive: true });
}
