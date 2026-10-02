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
  assertEncryptedDurableOutput,
  assertEncryptionRecipient,
  assertMigrationHistory,
  assertRedactedEvidence,
  assertStorageScope,
  EXPECTED_MIGRATION_HEAD,
  fail,
  sha256,
  TASK_ID,
} from "./phase-11i-recovery-contract.mjs";

import { AUTH_DURABLE_TABLES, assertDatabaseSecurity, validateCompletedOwnerActivation, validateOwnerDatabase } from "./phase-11i-owner-validation.mjs";
import { assertNewBackupPublicVerification, buildPublicVerificationSummary } from "./phase-11i-public-verification.mjs";

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    encoding: "utf8",
    maxBuffer: 128 * 1024 * 1024,
    timeout: 15 * 60 * 1_000,
    ...options,
  });
  if (result.status !== 0) {
    fail(`${command} ${args[0] ?? ""} failed (exit ${result.status}).`);
  }
  return result.stdout ?? "";
}

export async function captureBackup({
  sourceIdentity, assertSourceIdentity, assertArtifactIdentity, assertRecipient,
  backupRootInput, recipientInput, operator, privateKey, project, authConfig,
  rows, psqlBinary, runSupabase,
}) {
  assertSourceIdentity(sourceIdentity);
  assertEncryptionRecipient(recipientInput);
  if (!backupRootInput || !operator) fail("Backup root and operator are required.");
  function safeIdentifier(value) {
    if (!/^[a-z_][a-z0-9_]*$/.test(value)) fail("Unexpected database identifier.");
    return value;
  }

  function exactTableCounts(tableRows, stage) {
    const sql = tableRows
      .map(([schema, table]) => {
        safeIdentifier(schema);
        safeIdentifier(table);
        return `select '${schema}.${table}', count(*)::bigint from "${schema}"."${table}"`;
      })
      .join(" union all ");
    return Object.fromEntries(
      rows(`${sql} order by 1;`, stage).map(([table, count]) => [table, Number(count)]),
    );
  }

  const backupStartedAt = new Date().toISOString();
  const repositoryCommit = run("git", ["rev-parse", "HEAD"]).trim();
  const repositoryTree = run("git", ["rev-parse", "HEAD^{tree}"]).trim();
  const repositoryParent = run("git", ["rev-parse", "HEAD^"]).trim();
  const backupId = `phase11i-${sourceIdentity.projectRef}-${backupStartedAt
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}Z$/, "Z")}-${repositoryCommit.slice(0, 8)}`;
  assertArtifactIdentity(backupId);

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
    assertRecipient(recipientFingerprint);
    if (
      project.id !== sourceIdentity.projectRef ||
      project.status !== "ACTIVE_HEALTHY"
    ) {
      fail("Source project identity or health mismatch.");
    }

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
      "MIGRATION_LEDGER",
    ).map(([version]) => version);
    assertMigrationHistory(migrations);

    const applicationTables = rows(
      "select table_schema,table_name from information_schema.tables where table_type='BASE TABLE' and table_schema in ('public','ingestion') order by 1,2;",
      "APPLICATION_TABLE_INVENTORY",
    );
    const tableCounts = exactTableCounts(applicationTables, "PRE_DUMP_TABLE_COUNTS");
    const ownerValidation = validateOwnerDatabase((sql) => rows(sql, "OWNER_VALIDATION"));
    const { authCounts, ownershipIntegrity } = ownerValidation;
    const accountActivationCount = validateCompletedOwnerActivation((sql) => rows(sql, "OWNER_ACTIVATION"));

    const [storageBuckets, storageObjects] = rows(`
      select (select count(*) from storage.buckets),
             (select count(*) from storage.objects);
    `, "STORAGE_SCOPE").at(0).map(Number);
    assertStorageScope({ buckets: storageBuckets, objects: storageObjects });

    const vaultRows = rows("select name from vault.secrets order by name;", "VAULT_INVENTORY");
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
    `, "RLS_VALIDATION").map(([name]) => name);


    const unexpectedMutationGrants = rows(`
      select grantee,table_name,privilege_type
      from information_schema.role_table_grants
      where table_schema='public'
        and grantee in ('PUBLIC','anon')
        and privilege_type in ('INSERT','UPDATE','DELETE','TRUNCATE','TRIGGER','REFERENCES')
      order by 1,2,3;
    `, "GRANT_VALIDATION");


    const securityDefinerMissingSearchPath = rows(`
      select n.nspname||'.'||p.proname
      from pg_proc p join pg_namespace n on n.oid=p.pronamespace
      where n.nspname in ('public','ingestion') and p.prosecdef
        and not exists (
          select 1 from unnest(coalesce(p.proconfig,array[]::text[])) entry
          where entry in ('search_path=""', 'search_path=')
        )
      order by 1;
    `, "SECURITY_DEFINER_VALIDATION").map(([name]) => name);
    assertDatabaseSecurity({ rlsDisabledTables, unexpectedMutationGrants, securityDefinerMissingSearchPath });

    const authTables = rows(
      "select table_name from information_schema.tables where table_schema='auth' and table_type='BASE TABLE' order by table_name;",
      "AUTH_TABLE_INVENTORY",
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

    runSupabase(["db", "dump", "--role-only", "--file", artifactPaths.roles]);
    runSupabase([
      "db",
      "dump",
      "--schema",
      "public,ingestion",
      "--file",
      artifactPaths.schema,
    ]);
    runSupabase([
      "db",
      "dump",
      "--data-only",
      "--schema",
      "public,ingestion",
      "--file",
      artifactPaths.data,
    ]);
    runSupabase([
      "db",
      "dump",
      "--data-only",
      "--schema",
      "auth",
      "--exclude",
      authExclusions,
      "--file",
      artifactPaths.auth,
    ]);

    // Fail rather than publish a count-inconsistent capture if writes occurred during the dumps.
    const afterCounts = exactTableCounts(applicationTables, "POST_DUMP_TABLE_COUNTS");
    if (JSON.stringify(afterCounts) !== JSON.stringify(tableCounts)) fail("Source changed during backup capture.");
    const afterAuth = validateOwnerDatabase((sql) => rows(sql, "POST_DUMP_OWNER_VALIDATION")).authCounts;
    for (const durable of ["users", "identities", "mfaFactors", "webauthnCredentials"]) {
      if (afterAuth[durable] !== authCounts[durable]) fail("Durable Auth changed during backup capture.");
    }
    if (validateCompletedOwnerActivation((sql) => rows(sql, "POST_DUMP_OWNER_ACTIVATION")) !== accountActivationCount) {
      fail("Owner activation changed during backup capture.");
    }
    const publicVerificationSummary = buildPublicVerificationSummary({
      migrations, storage: { buckets: storageBuckets, objects: storageObjects },
      ownerValidation, accountActivationCount, sourceCaptureConsistency: "PASS",
    });
    const sourceSnapshot = {
      sourceProjectRef: sourceIdentity.projectRef,
      sourceEnvironment: sourceIdentity.sourceEnvironment,
      projectRegion: project.region,
      projectHealth: project.status,
      postgresVersion: project.database?.version,
      migrationCount: migrations.length,
      migrationHead: migrations.at(-1),
      applicationTableCount: applicationTables.length,
      tableCounts,
      authCounts,
      ownershipIntegrity,
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

    const contentManifest = {
      schemaVersion: "phase-11i-backup-content/v1",
      taskId: TASK_ID,
      backupId,
      sourceProjectRef: sourceIdentity.projectRef,
      sourceEnvironment: sourceIdentity.sourceEnvironment,
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
      publicVerificationSummary,
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
    assertNewBackupPublicVerification(finalManifest);
    assertRedactedEvidence(finalManifest);
    const manifestBytes = Buffer.from(`${JSON.stringify(finalManifest, null, 2)}\n`);
    writeFileSync(manifestPath, manifestBytes, { mode: 0o600 });
    chmodSync(manifestPath, 0o600);

    return {
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
    };
  } catch (error) {
    rmSync(archivePath, { force: true });
    rmSync(manifestPath, { force: true });
    throw error;
  } finally {
    rmSync(workRoot, { force: true, recursive: true });
  }

}
