import assert from "node:assert/strict";
import test from "node:test";
import {
  NORMATIVE_MEASUREMENT_BOUNDARY,
  NORMATIVE_TIMER_END,
  NORMATIVE_TIMER_START,
  SERVER_TIMING_DIAGNOSTIC_BOUNDARY,
} from "./phase-11g2-evidence-contract.mjs";
import {
  assertPrivacySafeText,
  validateCurrentMeasurementMetadata,
  validateEvidenceProvenance,
} from "./check-phase-11g2-normative-evidence.mjs";

const currentRepository = Object.freeze({
  commitSha: "a".repeat(40),
  trackedWorktreeCleanAtStart: true,
  treeSha: "b".repeat(40),
});
const currentSourceIdentitySha256 = "c".repeat(64);

function currentEvidence(passed = true) {
  return {
    report: {
      passed,
      repository: { ...currentRepository },
      sourceIdentitySha256: currentSourceIdentitySha256,
    },
    runtimeManifest: { repository: { ...currentRepository } },
  };
}

function validateCurrent(overrides = {}) {
  const evidence = currentEvidence();
  return validateEvidenceProvenance({
    currentRepository,
    currentSourceIdentitySha256,
    report: overrides.report ?? evidence.report,
    runtimeManifest: overrides.runtimeManifest ?? evidence.runtimeManifest,
  });
}

test("accepts opaque normative trace metadata", () => {
  assert.doesNotThrow(() =>
    assertPrivacySafeText(
      '{"correlationId":"perf_0123456789abcdef0123456789abcdef","routeTemplate":"/[locale]/foods"}',
    ),
  );
});

test("rejects identities, credentials, JWTs, and UUIDs", () => {
  for (const value of [
    "phase11g2-user-001@example.test",
    "authorization: Bearer secret",
    "refresh_token",
    "Phase11G2SyntheticOnly",
    "eyJabcdefghijk.abcdefghijkl.abcdefghijkl",
    "01234567-89ab-4def-8abc-0123456789ab",
  ]) {
    assert.throws(() => assertPrivacySafeText(value), /forbidden/);
  }
});

test("accepts current source identity and exact current commit and tree", () => {
  assert.equal(validateCurrent(), "current");
});

test("rejects a wrong current report or runtime commit and tree", () => {
  for (const [container, field, value] of [
    ["report", "commitSha", "d".repeat(40)],
    ["report", "treeSha", "e".repeat(40)],
    ["runtimeManifest", "commitSha", "f".repeat(40)],
    ["runtimeManifest", "treeSha", "0".repeat(40)],
  ]) {
    const evidence = currentEvidence();
    evidence[container].repository[field] = value;
    assert.throws(
      () =>
        validateEvidenceProvenance({
          currentRepository,
          currentSourceIdentitySha256,
          ...evidence,
        }),
      /must match the current Git candidate/,
    );
  }
});

test("rejects passing evidence with stale source, commit, or tree identity", () => {
  for (const mutate of [
    (evidence) => { evidence.report.sourceIdentitySha256 = "d".repeat(64); },
    (evidence) => { evidence.report.repository.commitSha = "d".repeat(40); },
    (evidence) => { evidence.report.repository.treeSha = "e".repeat(40); },
  ]) {
    const evidence = currentEvidence(true);
    mutate(evidence);
    assert.throws(() =>
      validateEvidenceProvenance({
        currentRepository,
        currentSourceIdentitySha256,
        ...evidence,
      }),
    );
  }
});

test("accepts only explicitly identified historical non-passing evidence", () => {
  const historicalSource = "d".repeat(64);
  const report = { passed: false, sourceIdentitySha256: historicalSource };
  assert.equal(
    validateEvidenceProvenance({
      currentRepository,
      currentSourceIdentitySha256,
      legacyHistoricalNonPassing: {
        expectedSourceIdentitySha256: historicalSource,
      },
      report,
      runtimeManifest: {},
    }),
    "explicit_historical_nonpassing",
  );
});

test("rejects passing evidence in legacy historical mode", () => {
  assert.throws(
    () =>
      validateEvidenceProvenance({
        currentRepository,
        currentSourceIdentitySha256,
        legacyHistoricalNonPassing: {
          expectedSourceIdentitySha256: "d".repeat(64),
        },
        report: { passed: true, sourceIdentitySha256: "d".repeat(64) },
        runtimeManifest: {},
      }),
    /only for non-passing evidence/,
  );
});

test("rejects malformed historical SHA-256 and current Git object identities", () => {
  assert.throws(
    () =>
      validateEvidenceProvenance({
        currentRepository,
        currentSourceIdentitySha256,
        legacyHistoricalNonPassing: { expectedSourceIdentitySha256: "invalid" },
        report: { passed: false, sourceIdentitySha256: "invalid" },
        runtimeManifest: {},
      }),
    /lowercase SHA-256/,
  );
  for (const field of ["commitSha", "treeSha"]) {
    const evidence = currentEvidence();
    evidence.report.repository[field] = "invalid";
    assert.throws(
      () =>
        validateEvidenceProvenance({
          currentRepository,
          currentSourceIdentitySha256,
          ...evidence,
        }),
      /Git object SHA/,
    );
  }
});

test("requires clean-at-start metadata for current evidence", () => {
  const evidence = currentEvidence();
  evidence.report.repository.trackedWorktreeCleanAtStart = false;
  assert.throws(
    () =>
      validateEvidenceProvenance({
        currentRepository,
        currentSourceIdentitySha256,
        ...evidence,
      }),
    /clean tracked worktree/,
  );
});

test("binds generated metadata to the joint outer normative duration", () => {
  assert.doesNotThrow(() =>
    validateCurrentMeasurementMetadata(
      {
        measurementBoundary: NORMATIVE_MEASUREMENT_BOUNDARY,
        serverTimingBoundary: SERVER_TIMING_DIAGNOSTIC_BOUNDARY,
        timeoutMs: 10_000,
      },
      [{ timerEnd: NORMATIVE_TIMER_END, timerStart: NORMATIVE_TIMER_START }],
    ),
  );
  assert.throws(() =>
    validateCurrentMeasurementMetadata(
      {
        measurementBoundary: "stable UI only",
        serverTimingBoundary: SERVER_TIMING_DIAGNOSTIC_BOUNDARY,
        timeoutMs: 10_000,
      },
      [{ timerEnd: NORMATIVE_TIMER_END, timerStart: NORMATIVE_TIMER_START }],
    ),
  );
});
