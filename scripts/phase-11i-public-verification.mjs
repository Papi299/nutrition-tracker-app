import {
  assertMigrationHistory, assertStorageScope, fail,
  EXPECTED_MIGRATION_COUNT, EXPECTED_MIGRATION_HEAD,
} from "./phase-11i-recovery-contract.mjs";

function exactKeys(value, expected, label) {
  if (!value || typeof value !== "object" || Array.isArray(value) ||
      Object.keys(value).sort().join(",") !== [...expected].sort().join(",")) {
    fail(`Public verification summary has unexpected or missing fields: ${label}.`);
  }
}

export function assertPublicVerificationSummary(summary) {
  exactKeys(summary, ["schemaVersion", "migration", "storage", "ownerState", "sourceCaptureConsistency"], "summary");
  exactKeys(summary.migration, ["count", "head"], "migration");
  exactKeys(summary.storage, ["buckets", "objects"], "storage");
  exactKeys(summary.ownerState, ["profile", "authUserCount", "accountActivationCount", "ownershipValidation"], "ownerState");
  if (summary.schemaVersion !== "phase-11i-public-verification-summary/v1" ||
      summary.migration.count !== EXPECTED_MIGRATION_COUNT ||
      summary.migration.head !== EXPECTED_MIGRATION_HEAD) {
    fail("Public verification summary migration or schema mismatch.");
  }
  assertStorageScope(summary.storage);
  if (summary.ownerState.profile !== "PERSONAL_USE_ONE_NON_DELETED_OWNER" ||
      summary.ownerState.authUserCount !== 1 ||
      summary.ownerState.accountActivationCount !== 1 ||
      summary.ownerState.ownershipValidation !== "PASS") {
    fail("Public verification summary owner/activation invariant failed.");
  }
  if (summary.sourceCaptureConsistency !== "PASS") {
    fail("Public verification summary source capture consistency failed.");
  }
}

// Select individual validated scalars; the encrypted snapshot never becomes public.
export function buildPublicVerificationSummary({
  migrations, storage, ownerValidation, accountActivationCount, sourceCaptureConsistency,
}) {
  assertMigrationHistory(migrations);
  assertStorageScope(storage);
  const summary = {
    schemaVersion: "phase-11i-public-verification-summary/v1",
    migration: { count: migrations.length, head: migrations.at(-1) },
    storage: { buckets: storage.buckets, objects: storage.objects },
    ownerState: {
      profile: ownerValidation?.ownershipIntegrity?.profile,
      authUserCount: ownerValidation?.authCounts?.users,
      accountActivationCount,
      ownershipValidation: ownerValidation?.ownershipIntegrity?.result,
    },
    sourceCaptureConsistency,
  };
  assertPublicVerificationSummary(summary);
  return summary;
}

// Existing outer metadata is allow-listed too, so a full snapshot cannot be added
// beside the summary and accidentally published by the two-file upload.
const PUBLIC_MANIFEST_KEYS = new Set([
  "schemaVersion", "taskId", "backupId", "sourceProjectRef", "sourceEnvironment",
  "sourceRepository", "sourceCommit", "sourceTree", "sourceParent", "backupStartedAt",
  "backupScope", "migrationHead", "artifacts", "encryption", "operator",
  "backupCompletedAt", "dumpTools", "plaintextArchiveBytes", "plaintextArchiveSha256",
  "plaintextTemporaryRemoved", "encryptedArchiveBytes", "encryptedArchiveSha256",
  "contentManifestSha256", "postEncryptionDecryptVerification", "credentialScanStatus",
  "publicVerificationSummary",
]);
export function assertNewBackupPublicVerification(manifest) {
  if (!manifest || typeof manifest !== "object" || Array.isArray(manifest) ||
      Object.keys(manifest).some((key) => !PUBLIC_MANIFEST_KEYS.has(key))) {
    fail("Public backup manifest has unexpected fields.");
  }
  assertPublicVerificationSummary(manifest.publicVerificationSummary);
  if (manifest.migrationHead !== manifest.publicVerificationSummary.migration.head) {
    fail("Public verification summary disagrees with manifest migration head.");
  }
}
