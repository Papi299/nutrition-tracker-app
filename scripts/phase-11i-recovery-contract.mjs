import { createHash } from "node:crypto";
import { dirname, isAbsolute, relative, resolve } from "node:path";

export const TASK_ID = "PHASE-11I-RECOVERY-QUALIFICATION-001";
export const PRODUCTION_PROJECT_REF = "hskfanrqwtqknzpquwhg";
export const PRODUCTION_ENVIRONMENT = "Production";
export const RECOVERY_TARGET = "PHASE_11I_RECOVERY_ISOLATED";
export const EXPECTED_MIGRATION_COUNT = 43;
export const EXPECTED_MIGRATION_HEAD = "20260830143000";
export const RPO_LIMIT_MS = 24 * 60 * 60 * 1_000;
export const RTO_LIMIT_MS = 8 * 60 * 60 * 1_000;
export const RETENTION_DAYS = 30;
export const BACKUP_ID_PATTERN =
  /^phase11i-hskfanrqwtqknzpquwhg-\d{8}T\d{6}Z-[a-f0-9]{8}$/;

const secretPatterns = [
  /postgres(?:ql)?:\/\//i,
  /(?:^|\s)PGPASSWORD\s*=/i,
  /authorization\s*:\s*bearer/i,
  /\bsbp_[A-Za-z0-9_-]{12,}\b/,
  /\beyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{10,}\b/,
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
  /\$2[aby]\$\d{2}\$[./A-Za-z0-9]{53}/,
  /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i,
];

const forbiddenEvidenceKeys = new Set([
  "accessToken",
  "authorization",
  "connectionString",
  "cookie",
  "databaseUrl",
  "dbUrl",
  "email",
  "password",
  "passwordHash",
  "privateKey",
  "refreshToken",
  "smtpPass",
  "token",
]);

export function fail(message) {
  throw new Error(message);
}

export function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

export function canonicalize(value) {
  if (Array.isArray(value)) {
    return `[${value.map((entry) => canonicalize(entry)).join(",")}]`;
  }
  if (value && typeof value === "object") {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonicalize(value[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

export function assertBackupId(backupId) {
  if (!BACKUP_ID_PATTERN.test(backupId ?? "")) {
    fail("Malformed Phase 11I backup ID.");
  }
}

export function assertProductionSource({ projectRef, sourceEnvironment }) {
  if (projectRef !== PRODUCTION_PROJECT_REF) {
    fail("Production project reference mismatch.");
  }
  if (sourceEnvironment !== PRODUCTION_ENVIRONMENT) {
    fail("Production backup requires source environment Production.");
  }
}

export function assertEncryptionRecipient(recipientPath) {
  if (!recipientPath || !isAbsolute(recipientPath)) {
    fail("A trusted absolute encryption-recipient certificate path is required.");
  }
}

export function assertEncryptedDurableOutput(outputPath) {
  if (!outputPath?.endsWith(".archive.cms")) {
    fail("Durable Phase 11I output must be a CMS encrypted archive.");
  }
  if (/\.(?:sql|dump|tar|jsonl?)$/i.test(outputPath)) {
    fail("Plaintext durable backup output is forbidden.");
  }
}

export function assertMigrationHistory(versions) {
  if (!Array.isArray(versions) || versions.length !== EXPECTED_MIGRATION_COUNT) {
    fail("Source migration count mismatch.");
  }
  if (versions.at(-1) !== EXPECTED_MIGRATION_HEAD) {
    fail("Source migration head mismatch.");
  }
  if (new Set(versions).size !== versions.length) {
    fail("Source migration ledger contains duplicates.");
  }
  if ([...versions].sort().some((version, index) => version !== versions[index])) {
    fail("Source migration ledger is not ordered.");
  }
}

export function assertStorageScope({ buckets, objects }) {
  if (buckets !== 0 || objects !== 0) {
    fail("PHASE_11I_STORAGE_BACKUP_SCOPE_EXPANSION_REQUIRED");
  }
}

export function assertIsolatedRestoreTarget({
  targetIdentity,
  targetDatabaseUrl,
  sourceDatabaseUrl,
}) {
  if (targetIdentity !== RECOVERY_TARGET) {
    fail("Restore target identity is not the approved isolated target.");
  }
  let target;
  try {
    target = new URL(targetDatabaseUrl);
  } catch {
    fail("Restore target database URL is invalid.");
  }
  if (!["127.0.0.1", "localhost", "::1"].includes(target.hostname)) {
    fail("Production or non-local restore targets are forbidden.");
  }
  if (sourceDatabaseUrl && targetDatabaseUrl === sourceDatabaseUrl) {
    fail("Source Production connection cannot be reused as the restore target.");
  }
}

export function assertRoleSeparation({ restoreExecutor, recoveryApprover }) {
  if (!restoreExecutor || !recoveryApprover) {
    fail("Restore executor and Recovery Approver are required.");
  }
  if (restoreExecutor.trim().toLowerCase() === recoveryApprover.trim().toLowerCase()) {
    fail("Restore executor and Recovery Approver must remain separate.");
  }
}

function elapsed(start, end, label) {
  const startMs = Date.parse(start ?? "");
  const endMs = Date.parse(end ?? "");
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs < startMs) {
    fail(`${label} timestamps are missing or invalid.`);
  }
  return endMs - startMs;
}

export function measureRpo({ backupCompletedAt, qualificationAt }) {
  const elapsedMs = elapsed(backupCompletedAt, qualificationAt, "RPO");
  if (elapsedMs > RPO_LIMIT_MS) fail("RPO exceeds 24 hours.");
  return { elapsedMs, thresholdMs: RPO_LIMIT_MS, result: "PASS" };
}

export function measureRto({ recoveryStartedAt, recoveryCompletedAt }) {
  const elapsedMs = elapsed(recoveryStartedAt, recoveryCompletedAt, "RTO");
  if (elapsedMs > RTO_LIMIT_MS) fail("PHASE_11I_RTO_FAILED");
  return { elapsedMs, thresholdMs: RTO_LIMIT_MS, result: "PASS" };
}

export function assertHash(bytes, expected, label = "artifact") {
  if (!/^[a-f0-9]{64}$/.test(expected ?? "") || sha256(bytes) !== expected) {
    fail(`${label} hash mismatch.`);
  }
}

export function assertRedactedEvidence(value, path = "evidence") {
  if (Array.isArray(value)) {
    value.forEach((entry, index) => assertRedactedEvidence(entry, `${path}[${index}]`));
    return;
  }
  if (value && typeof value === "object") {
    for (const [key, child] of Object.entries(value)) {
      if (forbiddenEvidenceKeys.has(key)) {
        fail(`Secret-like evidence field is forbidden: ${path}.${key}`);
      }
      assertRedactedEvidence(child, `${path}.${key}`);
    }
    return;
  }
  if (typeof value === "string" && secretPatterns.some((pattern) => pattern.test(value))) {
    fail(`Secret-like or PII value is forbidden at ${path}.`);
  }
}

export function assertPre11KStatus({
  findingStatus,
  openFindingCount,
  phase11Status,
  phase11JStarted,
}) {
  if (
    findingStatus !== "OPEN" ||
    openFindingCount !== 18 ||
    phase11Status !== "INCOMPLETE" ||
    phase11JStarted !== false
  ) {
    fail("Finding closure or later-phase credit is forbidden before Phase 11K.");
  }
}

function assertOwnedPath(rootRealPath, candidatePath) {
  const resolved = resolve(candidatePath);
  const pathFromRoot = relative(rootRealPath, resolved);
  if (
    !pathFromRoot ||
    pathFromRoot.startsWith("..") ||
    isAbsolute(pathFromRoot) ||
    dirname(resolved) !== rootRealPath
  ) {
    fail("Retention artifact escapes the controlled backup root.");
  }
  return resolved;
}

export function buildRetentionPlan({
  rootRealPath,
  artifacts,
  now,
  retentionDays = RETENTION_DAYS,
}) {
  if (!isAbsolute(rootRealPath)) fail("Retention root must be absolute.");
  const nowMs = Date.parse(now ?? "");
  if (!Number.isFinite(nowMs)) fail("Retention evaluation time is invalid.");
  if (!Number.isInteger(retentionDays) || retentionDays < RETENTION_DAYS) {
    fail("Retention window cannot be shorter than 30 days.");
  }
  if (!Array.isArray(artifacts) || artifacts.length === 0) {
    fail("Retention requires at least one valid backup artifact.");
  }

  const normalized = artifacts.map((artifact) => {
    assertBackupId(artifact.backupId);
    if (artifact.isSymlink) fail("Retention refuses symlink artifacts.");
    if (!artifact.valid) fail("Retention refuses malformed or invalid manifests.");
    const expectedName = `${artifact.backupId}.archive.cms`;
    if (artifact.path.split("/").at(-1) !== expectedName) {
      fail("Retention artifact filename does not match its manifest identity.");
    }
    const completedMs = Date.parse(artifact.completedAt ?? "");
    if (!Number.isFinite(completedMs) || completedMs > nowMs) {
      fail("Retention artifact completion timestamp is invalid.");
    }
    return {
      ...artifact,
      path: assertOwnedPath(rootRealPath, artifact.path),
      completedMs,
    };
  });

  normalized.sort((left, right) => left.completedMs - right.completedMs);
  const current = normalized.at(-1);
  const cutoffMs = nowMs - retentionDays * 24 * 60 * 60 * 1_000;
  const deletePaths = normalized
    .filter((artifact) => artifact !== current && artifact.completedMs < cutoffMs)
    .map((artifact) => artifact.path);
  const retainPaths = normalized
    .filter((artifact) => !deletePaths.includes(artifact.path))
    .map((artifact) => artifact.path);

  if (!retainPaths.includes(current.path)) {
    fail("Retention cannot delete the current valid backup.");
  }
  return { cutoffMs, currentBackupId: current.backupId, deletePaths, retainPaths };
}
