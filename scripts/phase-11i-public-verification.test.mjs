import assert from "node:assert/strict";
import test from "node:test";
import { readdirSync } from "node:fs";
import {
  assertNewBackupPublicVerification, assertPublicVerificationSummary,
  buildPublicVerificationSummary,
} from "./phase-11i-public-verification.mjs";
import { validateCompletedOwnerActivation } from "./phase-11i-owner-validation.mjs";

const migrations = readdirSync("supabase/migrations").filter((name) => /^\d{14}_.+\.sql$/.test(name)).sort().map((name) => name.slice(0, 14));
const validated = {
  migrations, storage: { buckets: 0, objects: 0 },
  ownerValidation: { authCounts: { users: 1, sessions: 9, refreshTokens: 10 },
    ownershipIntegrity: { profile: "PERSONAL_USE_ONE_NON_DELETED_OWNER", result: "PASS" } },
  accountActivationCount: 1, sourceCaptureConsistency: "PASS",
};
const expected = {
  schemaVersion: "phase-11i-public-verification-summary/v1",
  migration: { count: 44, head: "20260927170418" },
  storage: { buckets: 0, objects: 0 },
  ownerState: { profile: "PERSONAL_USE_ONE_NON_DELETED_OWNER", authUserCount: 1,
    accountActivationCount: 1, ownershipValidation: "PASS" },
  sourceCaptureConsistency: "PASS",
};
test("public summary selects exactly approved fields from validated source", () => {
  const summary = buildPublicVerificationSummary({ ...validated,
    tableCounts: { "public.diary_entries": 999 }, userId: "opaque-synthetic-owner" });
  assert.deepEqual(summary, expected);
  assertPublicVerificationSummary(summary);
  assertNewBackupPublicVerification({ migrationHead: "20260927170418", publicVerificationSummary: summary });
});
for (const [label, change] of [
  ["schema", (s) => { s.schemaVersion = "wrong"; }],
  ["migration count", (s) => { s.migration.count = 43; }],
  ["migration head", (s) => { s.migration.head = "20260830143000"; }],
  ["Storage buckets", (s) => { s.storage.buckets = 1; }],
  ["Storage objects", (s) => { s.storage.objects = 1; }],
  ["owner profile", (s) => { s.ownerState.profile = "BOOTSTRAP"; }],
  ["owner count", (s) => { s.ownerState.authUserCount = 2; }],
  ["activation count", (s) => { s.ownerState.accountActivationCount = 0; }],
  ["ownership result", (s) => { s.ownerState.ownershipValidation = "FAIL"; }],
  ["source consistency", (s) => { s.sourceCaptureConsistency = "FAIL"; }],
  ["scalar type", (s) => { s.ownerState.authUserCount = "1"; }],
]) test(`public summary rejects wrong ${label}`, () => {
  const summary = structuredClone(expected); change(summary);
  assert.throws(() => assertPublicVerificationSummary(summary));
});
for (const value of [undefined, null, [], "PASS", {}]) {
  test(`public summary rejects malformed ${JSON.stringify(value)}`, () => assert.throws(() => assertPublicVerificationSummary(value)));
}
// Exact keys at every level reject metadata that the generic secret scanner may miss.
for (const [level, objectKeys] of [
  ["summary", ["tableCounts", "authCounts", "email", "userId", "sessions", "diaryEntries", "nutritionTargets"]],
  ["migration", ["ownerUuid"]], ["storage", ["objectNames"]],
  ["ownerState", ["ownerUuid", "diaryEntries", "nutritionTargets", "sessionCount", "activationCompletedAt"]],
]) {
  for (const key of objectKeys) test(`privacy allow-list rejects ${level}.${key}`, () => {
    const summary = structuredClone(expected);
    (level === "summary" ? summary : summary[level])[key] = "synthetic-metadata";
    assert.throws(() => assertPublicVerificationSummary(summary), /unexpected or missing fields/);
  });
}
test("privacy allow-list requires approved keys at every level", () => {
  for (const level of [null, "migration", "storage", "ownerState"]) {
    const object = level ? expected[level] : expected;
    for (const key of Object.keys(object)) {
      const summary = structuredClone(expected); delete (level ? summary[level] : summary)[key];
      assert.throws(() => assertPublicVerificationSummary(summary));
    }
  }
});
test("new artifact requires summary and consistent outer migration head", () => {
  assert.throws(() => assertNewBackupPublicVerification({ migrationHead: "20260927170418" }));
  assert.throws(() => assertNewBackupPublicVerification({ migrationHead: "wrong", publicVerificationSummary: expected }));
});
for (const key of ["tableCounts", "authCounts", "sourceSnapshot", "sourceSafeCounts", "ownerUuid", "diaryEntries", "nutritionTargets"]) {
  test(`outer manifest prohibits ${key} beside public summary`, () => {
    assert.throws(() => assertNewBackupPublicVerification({ migrationHead: "20260927170418", publicVerificationSummary: expected, [key]: {} }));
  });
}
test("summary builder fails before publication on unvalidated prerequisites", () => {
  for (const bad of [
    { migrations: migrations.slice(1) }, { storage: { buckets: 1, objects: 0 } },
    { ownerValidation: undefined }, { accountActivationCount: 0 }, { sourceCaptureConsistency: undefined },
  ]) assert.throws(() => buildPublicVerificationSummary({ ...validated, ...bad }));
});
test("completed activation aggregate accepts only one total and completed row", () => {
  assert.equal(validateCompletedOwnerActivation(() => [["1", "1"]]), 1);
  for (const rows of [[], [["0", "0"]], [["2", "1"]], [["1", "0"]], [["1"]], [["1", "NaN"]]]) {
    assert.throws(() => validateCompletedOwnerActivation(() => rows));
  }
});
