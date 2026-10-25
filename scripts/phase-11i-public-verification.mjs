import { assertCaptureImplementation, SYNTHETIC_CAPTURE_SCOPE } from "./phase-11i-capture-consistency.mjs";
import {
  assertMigrationHistory, assertStorageScope, fail,
  recoveryMigrationBoundary,
} from "./phase-11i-recovery-contract.mjs";

function exactKeys(value, expected, label) {
  if (!value || typeof value !== "object" || Array.isArray(value) ||
      Object.keys(value).sort().join(",") !== [...expected].sort().join(",")) {
    fail(`Public verification summary has unexpected or missing fields: ${label}.`);
  }
}

export function assertPublicVerificationSummary(summary, boundary = recoveryMigrationBoundary()) {
  exactKeys(summary, ["schemaVersion", "migration", "storage", "ownerState", "sourceCaptureConsistency"], "summary");
  exactKeys(summary.migration, ["count", "head", "historySha256"], "migration");
  exactKeys(summary.storage, ["buckets", "objects"], "storage");
  exactKeys(summary.ownerState, ["profile", "authUserCount", "accountActivationCount", "ownershipValidation"], "ownerState");
  if (summary.schemaVersion !== "phase-11i-public-verification-summary/v2" ||
      summary.migration.count !== boundary.count ||
      summary.migration.head !== boundary.head ||
      summary.migration.historySha256 !== boundary.historySha256) {
    fail("Public verification summary migration or schema mismatch.");
  }
  assertStorageScope(summary.storage);
  if (summary.ownerState.profile !== "PERSONAL_USE_ONE_NON_DELETED_OWNER" ||
      summary.ownerState.authUserCount !== 1 ||
      summary.ownerState.accountActivationCount !== 1 ||
      summary.ownerState.ownershipValidation !== "PASS") {
    fail("Public verification summary owner/activation invariant failed.");
  }
  if (summary.sourceCaptureConsistency !== SYNTHETIC_CAPTURE_SCOPE) {
    fail("Public verification summary source capture consistency failed.");
  }
}

// Select individual validated scalars; the encrypted snapshot never becomes public.
export function buildPublicVerificationSummary({
  migrations, storage, ownerValidation, accountActivationCount, sourceCaptureConsistency,
}, boundary = recoveryMigrationBoundary()) {
  assertMigrationHistory(migrations, boundary);
  assertStorageScope(storage);
  const summary = {
    schemaVersion: "phase-11i-public-verification-summary/v2",
    migration: { count: migrations.length, head: migrations.at(-1), historySha256: boundary.historySha256 },
    storage: { buckets: storage.buckets, objects: storage.objects },
    ownerState: {
      profile: ownerValidation?.ownershipIntegrity?.profile,
      authUserCount: ownerValidation?.authCounts?.users,
      accountActivationCount,
      ownershipValidation: ownerValidation?.ownershipIntegrity?.result,
    },
    sourceCaptureConsistency,
  };
  assertPublicVerificationSummary(summary, boundary);
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
export function assertNewBackupPublicVerification(manifest, boundary = recoveryMigrationBoundary()) {
  if (!manifest || typeof manifest !== "object" || Array.isArray(manifest) ||
      Object.keys(manifest).some((key) => !PUBLIC_MANIFEST_KEYS.has(key))) {
    fail("Public backup manifest has unexpected fields.");
  }
  if (manifest.sourceProjectRef !== undefined || manifest.sourceEnvironment !== undefined) {
    assertCaptureImplementation({ projectRef: manifest.sourceProjectRef, sourceEnvironment: manifest.sourceEnvironment });
  }
  assertPublicVerificationSummary(manifest.publicVerificationSummary, boundary);
  if (manifest.migrationHead !== manifest.publicVerificationSummary.migration.head) {
    fail("Public verification summary disagrees with manifest migration head.");
  }
}
