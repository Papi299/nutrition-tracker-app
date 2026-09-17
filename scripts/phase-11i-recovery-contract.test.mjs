import assert from "node:assert/strict";
import test from "node:test";
import {
  assertBackupId,
  assertEncryptedDurableOutput,
  assertEncryptionRecipient,
  assertHash,
  assertIsolatedRestoreTarget,
  assertMigrationHistory,
  assertPre11KStatus,
  assertProductionSource,
  assertRedactedEvidence,
  assertRoleSeparation,
  assertStorageScope,
  buildRetentionPlan,
  EXPECTED_MIGRATION_COUNT,
  EXPECTED_MIGRATION_HEAD,
  measureRpo,
  measureRto,
  PRODUCTION_ENVIRONMENT,
  PRODUCTION_PROJECT_REF,
  RECOVERY_TARGET,
  sha256,
} from "./phase-11i-recovery-contract.mjs";

const backupId = "phase11i-hskfanrqwtqknzpquwhg-20260917T120000Z-deadbeef";
const root = "/restricted/phase11i";

test("wrong Production project ref is rejected", () => {
  assert.throws(() =>
    assertProductionSource({
      projectRef: "wrongprojectref00000",
      sourceEnvironment: PRODUCTION_ENVIRONMENT,
    }),
  );
});

test("non-Production source is rejected for a Production backup", () => {
  assert.throws(() =>
    assertProductionSource({
      projectRef: PRODUCTION_PROJECT_REF,
      sourceEnvironment: "Preview",
    }),
  );
});

test("missing encryption recipient is rejected", () => {
  assert.throws(() => assertEncryptionRecipient(""));
});

test("plaintext durable output is rejected", () => {
  assert.throws(() => assertEncryptedDurableOutput("/restricted/backup.sql"));
  assert.doesNotThrow(() =>
    assertEncryptedDurableOutput(`/restricted/${backupId}.archive.cms`),
  );
});

test("malformed backup ID is rejected", () => {
  assert.throws(() => assertBackupId("phase11i-latest"));
});

test("retention traversal and symlink escape are rejected", () => {
  const common = {
    backupId,
    completedAt: "2026-09-17T12:00:00Z",
    valid: true,
  };
  assert.throws(() =>
    buildRetentionPlan({
      rootRealPath: root,
      now: "2026-09-18T12:00:00Z",
      artifacts: [{ ...common, path: `/restricted/../escape/${backupId}.archive.cms` }],
    }),
  );
  assert.throws(() =>
    buildRetentionPlan({
      rootRealPath: root,
      now: "2026-09-18T12:00:00Z",
      artifacts: [
        { ...common, path: `${root}/${backupId}.archive.cms`, isSymlink: true },
      ],
    }),
  );
});

test("retention cannot delete the current valid backup", () => {
  const oldId = "phase11i-hskfanrqwtqknzpquwhg-20260701T120000Z-aaaaaaaa";
  const plan = buildRetentionPlan({
    rootRealPath: root,
    now: "2026-09-17T13:00:00Z",
    artifacts: [
      {
        backupId: oldId,
        completedAt: "2026-07-01T12:00:00Z",
        path: `${root}/${oldId}.archive.cms`,
        valid: true,
      },
      {
        backupId,
        completedAt: "2026-09-17T12:00:00Z",
        path: `${root}/${backupId}.archive.cms`,
        valid: true,
      },
    ],
  });
  assert.deepEqual(plan.deletePaths, [`${root}/${oldId}.archive.cms`]);
  assert.deepEqual(plan.retainPaths, [`${root}/${backupId}.archive.cms`]);
});

test("manifest or archive hash mismatch is rejected", () => {
  const bytes = Buffer.from("phase11i");
  assert.throws(() => assertHash(bytes, "0".repeat(64), "archive"));
  assert.doesNotThrow(() => assertHash(bytes, sha256(bytes), "archive"));
});

test("source migration mismatch is rejected", () => {
  const versions = Array.from({ length: EXPECTED_MIGRATION_COUNT }, (_, index) =>
    String(20260000000000 + index),
  );
  versions[versions.length - 1] = EXPECTED_MIGRATION_HEAD;
  assert.doesNotThrow(() => assertMigrationHistory(versions));
  assert.throws(() => assertMigrationHistory(versions.slice(1)));
  assert.throws(() => assertMigrationHistory([...versions.slice(0, -1), "99999999999999"]));
});

test("restore target must be isolated and local", () => {
  assert.doesNotThrow(() =>
    assertIsolatedRestoreTarget({
      targetIdentity: RECOVERY_TARGET,
      targetDatabaseUrl: "postgresql://postgres:local@127.0.0.1:54322/postgres",
    }),
  );
  assert.throws(() =>
    assertIsolatedRestoreTarget({
      targetIdentity: "ordinary-development",
      targetDatabaseUrl: "postgresql://postgres:local@127.0.0.1:54322/postgres",
    }),
  );
});

test("Production restore target is rejected", () => {
  assert.throws(() =>
    assertIsolatedRestoreTarget({
      targetIdentity: RECOVERY_TARGET,
      targetDatabaseUrl:
        "postgresql://postgres:redacted@db.hskfanrqwtqknzpquwhg.supabase.co/postgres",
    }),
  );
});

test("Production source connection reused as restore target is rejected", () => {
  const url = "postgresql://postgres:local@127.0.0.1:54322/postgres";
  assert.throws(() =>
    assertIsolatedRestoreTarget({
      targetIdentity: RECOVERY_TARGET,
      targetDatabaseUrl: url,
      sourceDatabaseUrl: url,
    }),
  );
});

test("missing RPO timestamps are rejected", () => {
  assert.throws(() => measureRpo({ backupCompletedAt: "", qualificationAt: "" }));
});

test("RPO over 24 hours is rejected", () => {
  assert.throws(() =>
    measureRpo({
      backupCompletedAt: "2026-09-15T00:00:00Z",
      qualificationAt: "2026-09-17T00:00:01Z",
    }),
  );
});

test("RTO over 8 hours is rejected", () => {
  assert.throws(() =>
    measureRto({
      recoveryStartedAt: "2026-09-17T00:00:00Z",
      recoveryCompletedAt: "2026-09-17T08:00:01Z",
    }),
  );
});

test("secret-like evidence fields and raw database URLs are rejected", () => {
  assert.throws(() => assertRedactedEvidence({ password: "redacted" }));
  assert.throws(() =>
    assertRedactedEvidence({ note: "postgresql://postgres:secret@example.test/db" }),
  );
  assert.throws(() => assertRedactedEvidence({ operatorEmail: "person@example.test" }));
});

test("Storage non-zero state blocks incomplete backup scope", () => {
  assert.throws(() => assertStorageScope({ buckets: 1, objects: 0 }));
  assert.throws(() => assertStorageScope({ buckets: 0, objects: 1 }));
});

test("approver and executor separation is required", () => {
  assert.throws(() =>
    assertRoleSeparation({
      restoreExecutor: "Maor Pichhadze",
      recoveryApprover: "maor pichhadze",
    }),
  );
});

test("finding closure and Phase 11J credit before Phase 11K are rejected", () => {
  assert.doesNotThrow(() =>
    assertPre11KStatus({
      findingStatus: "OPEN",
      openFindingCount: 18,
      phase11Status: "INCOMPLETE",
      phase11JStarted: false,
    }),
  );
  assert.throws(() =>
    assertPre11KStatus({
      findingStatus: "CLOSED",
      openFindingCount: 17,
      phase11Status: "COMPLETE",
      phase11JStarted: true,
    }),
  );
});
