import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  assertBackupId,
  assertEncryptedDurableOutput,
  assertEncryptionRecipient,
  assertGitHubBackupWorkflowContract,
  assertHash,
  assertIsolatedRestoreTarget,
  assertMigrationHistory,
  assertPre11KStatus,
  assertProductionSource,
  assertRecipientCertificateFingerprint,
  assertRedactedEvidence,
  assertRoleSeparation,
  assertStorageScope,
  buildRetentionPlan,
  EXPECTED_RECIPIENT_CERT_SHA256,
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
const githubBackupWorkflow = readFileSync(
  ".github/workflows/phase-11i-production-backup.yml",
  "utf8",
);
const githubBackupRunbook = readFileSync(
  "docs/phase-11i-github-artifact-backup-automation.md",
  "utf8",
);

function assertWorkflowRejected(workflow = githubBackupWorkflow, runbook = githubBackupRunbook) {
  assert.throws(() => assertGitHubBackupWorkflowContract({ workflow, runbook }));
}

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

test("unexpected encryption recipient fingerprint is rejected", () => {
  assert.doesNotThrow(() =>
    assertRecipientCertificateFingerprint(EXPECTED_RECIPIENT_CERT_SHA256),
  );
  assert.throws(() => assertRecipientCertificateFingerprint("0".repeat(64)));
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

test("GitHub backup workflow and runbook satisfy the complete contract", () => {
  assert.doesNotThrow(() =>
    assertGitHubBackupWorkflowContract({
      workflow: githubBackupWorkflow,
      runbook: githubBackupRunbook,
    }),
  );
});

test("GitHub backup workflow requires the daily 02:17 schedule", () => {
  assertWorkflowRejected(githubBackupWorkflow.replace("17 2 * * *", "18 2 * * *"));
});

test("GitHub backup workflow requires the Asia/Jerusalem timezone", () => {
  assertWorkflowRejected(githubBackupWorkflow.replace("Asia/Jerusalem", "UTC"));
});

test("GitHub backup workflow requires workflow_dispatch", () => {
  assertWorkflowRejected(githubBackupWorkflow.replace("  workflow_dispatch:\n", ""));
});

test("GitHub backup workflow requires least-privilege contents read", () => {
  assertWorkflowRejected(githubBackupWorkflow.replace("contents: read", "contents: write"));
});

test("GitHub backup workflow fixes the exact Production project", () => {
  assertWorkflowRejected(
    githubBackupWorkflow.replace("hskfanrqwtqknzpquwhg", "wrongprojectref00000"),
  );
});

test("GitHub backup workflow forbids a private recovery key reference", () => {
  assertWorkflowRejected(`${githubBackupWorkflow}\n# PHASE11I_RECOVERY_PRIVATE_KEY\n`);
});

test("GitHub backup workflow forbids plaintext artifact selection", () => {
  assertWorkflowRejected(
    githubBackupWorkflow.replace(
      "${{ steps.verify.outputs.archive_path }}",
      "/tmp/phase11i-backup.sql",
    ),
  );
});

test("GitHub backup workflow uploads both verified files and no weaker subset", () => {
  assertWorkflowRejected(
    githubBackupWorkflow.replace(
      "            ${{ steps.verify.outputs.manifest_path }}\n",
      "",
    ),
  );
});

test("GitHub backup workflow requires exactly 30-day retention", () => {
  assertWorkflowRejected(githubBackupWorkflow.replace("retention-days: 30", "retention-days: 29"));
});

test("GitHub backup workflow fails when selected artifact files are missing", () => {
  assertWorkflowRejected(
    githubBackupWorkflow.replace("if-no-files-found: error", "if-no-files-found: warn"),
  );
});

test("GitHub backup workflow accepts credentials only from Actions secrets", () => {
  assertWorkflowRejected(
    githubBackupWorkflow.replace(
      "secrets.SUPABASE_ACCESS_TOKEN",
      "vars.SUPABASE_ACCESS_TOKEN",
    ),
  );
});

test("GitHub backup workflow isolates runtime state from retained artifacts", () => {
  assertWorkflowRejected(
    githubBackupWorkflow.replace(
      "TMPDIR: ${{ steps.destination.outputs.runtime_root }}",
      "TMPDIR: ${{ steps.destination.outputs.backup_root }}",
    ),
  );
});

test("GitHub backup workflow removes runtime state before artifact verification", () => {
  const cleanupStart = githubBackupWorkflow.indexOf(
    "      - name: Remove plaintext runtime state before verification\n",
  );
  const verifyStart = githubBackupWorkflow.indexOf(
    "      - name: Verify ciphertext-only artifact pair\n",
  );
  assert.ok(cleanupStart >= 0 && verifyStart > cleanupStart);
  assertWorkflowRejected(
    githubBackupWorkflow.slice(0, cleanupStart) + githubBackupWorkflow.slice(verifyStart),
  );
});

test("GitHub backup workflow queues rather than cancels overlapping runs", () => {
  assertWorkflowRejected(
    githubBackupWorkflow.replace("cancel-in-progress: false", "cancel-in-progress: true"),
  );
});

test("GitHub backup workflow forbids Production mutation", () => {
  assertWorkflowRejected(`${githubBackupWorkflow}\n# npx supabase db push\n`);
});

test("GitHub backup workflow forbids Vercel deployment", () => {
  assertWorkflowRejected(`${githubBackupWorkflow}\n# vercel deploy\n`);
});

test("GitHub backup workflow forbids restore execution", () => {
  assertWorkflowRejected(`${githubBackupWorkflow}\n# npm run recovery:restore\n`);
});

test("GitHub backup runbook records the public-artifact risk", () => {
  assertWorkflowRejected(
    githubBackupWorkflow,
    githubBackupRunbook.replace("PUBLIC_REPOSITORY_CIPHERTEXT_ASSUMED_DOWNLOADABLE", "REMOVED"),
  );
});

test("GitHub backup runbook records the 60-day inactivity risk", () => {
  assertWorkflowRejected(
    githubBackupWorkflow,
    githubBackupRunbook.replace(
      "PUBLIC_REPOSITORY_SCHEDULE_INACTIVITY_MONITORING_REQUIRED",
      "REMOVED",
    ),
  );
});

test("GitHub backup runbook preserves all pre-Phase-11K findings", () => {
  assertWorkflowRejected(
    githubBackupWorkflow,
    githubBackupRunbook.replace("ALL_18_FINDINGS=OPEN", "ALL_18_FINDINGS=CLOSED"),
  );
});
