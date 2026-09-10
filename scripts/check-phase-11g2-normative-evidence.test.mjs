import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { chmodSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import {
  NORMATIVE_MEASUREMENT_BOUNDARY,
  NORMATIVE_TIMER_END,
  NORMATIVE_TIMER_START,
  PHASE11G2_SOURCE_PATHS,
  SERVER_TIMING_DIAGNOSTIC_BOUNDARY,
  phase11g2SourceIdentitySha256,
  phase11g2SourceIdentitySha256AtGitCommit,
} from "./phase-11g2-evidence-contract.mjs";
import { readGitProvenance } from "./phase-11g2-git-provenance.mjs";
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

function git(cwd, args) {
  return execFileSync("git", args, { cwd, encoding: "utf8" }).trim();
}

function writeRepositoryFile(cwd, filePath, contents) {
  const absolutePath = path.join(cwd, filePath);
  mkdirSync(path.dirname(absolutePath), { recursive: true });
  writeFileSync(absolutePath, contents);
}

function commitAll(cwd, message) {
  git(cwd, ["add", "--all"]);
  git(cwd, ["commit", "--quiet", "-m", message]);
  return readGitProvenance({ cwd });
}

function createMeasuredRepository(t) {
  const directory = mkdtempSync(path.join(tmpdir(), "phase11g2-evidence-provenance-"));
  t.after(() => rmSync(directory, { force: true, recursive: true }));
  git(directory, ["init", "--quiet"]);
  git(directory, ["config", "user.email", "phase11g2@example.test"]);
  git(directory, ["config", "user.name", "Phase 11G2 Test"]);
  for (const sourcePath of PHASE11G2_SOURCE_PATHS) {
    writeRepositoryFile(directory, sourcePath, `measured:${sourcePath}\n`);
  }
  const measuredRepository = commitAll(directory, "measured implementation");
  const measuredSourceIdentitySha256 =
    phase11g2SourceIdentitySha256AtGitCommit({
      commitSha: measuredRepository.commitSha,
      cwd: directory,
    });
  return {
    directory,
    measuredRepository,
    measuredSourceIdentitySha256,
  };
}

function measuredAncestorEvidence(fixture, passed = true) {
  const repository = { ...fixture.measuredRepository };
  return {
    report: {
      passed,
      repository: { ...repository },
      sourceIdentitySha256: fixture.measuredSourceIdentitySha256,
    },
    runtimeManifest: { repository: { ...repository } },
  };
}

function validateMeasuredAncestor(fixture, evidence = measuredAncestorEvidence(fixture)) {
  return validateEvidenceProvenance({
    currentRepository: readGitProvenance({ cwd: fixture.directory }),
    measuredImplementationAncestor: { cwd: fixture.directory },
    ...evidence,
  });
}

function commitEvidenceOnlyDescendant(fixture) {
  writeRepositoryFile(
    fixture.directory,
    "performance/evidence/focused-normative/normative-performance-report.json",
    "{}\n",
  );
  return commitAll(fixture.directory, "commit evidence");
}

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

test("accepts passing evidence measured at an exact implementation ancestor", (t) => {
  const fixture = createMeasuredRepository(t);
  commitEvidenceOnlyDescendant(fixture);
  assert.equal(
    validateMeasuredAncestor(fixture),
    "measured_implementation_ancestor",
  );
});

test("requires explicit ancestor mode after evidence is committed", (t) => {
  const fixture = createMeasuredRepository(t);
  commitEvidenceOnlyDescendant(fixture);
  const evidence = measuredAncestorEvidence(fixture);
  assert.throws(
    () =>
      validateEvidenceProvenance({
        currentRepository: readGitProvenance({ cwd: fixture.directory }),
        currentSourceIdentitySha256: phase11g2SourceIdentitySha256({
          cwd: fixture.directory,
        }),
        ...evidence,
      }),
    /current source identity|current Git candidate/,
  );
});

test("rejects ancestor mode at the measured commit instead of replacing current mode", (t) => {
  const fixture = createMeasuredRepository(t);
  assert.throws(
    () => validateMeasuredAncestor(fixture),
    /strict evidence descendant/,
  );
});

test("rejects a wrong measured tree or source identity", async (t) => {
  await t.test("wrong tree", (t) => {
    const fixture = createMeasuredRepository(t);
    commitEvidenceOnlyDescendant(fixture);
    const evidence = measuredAncestorEvidence(fixture);
    evidence.report.repository.treeSha = "d".repeat(40);
    evidence.runtimeManifest.repository.treeSha = "d".repeat(40);
    assert.throws(
      () => validateMeasuredAncestor(fixture, evidence),
      /does not match the commit's exact Git tree/,
    );
  });

  await t.test("wrong source identity", (t) => {
    const fixture = createMeasuredRepository(t);
    commitEvidenceOnlyDescendant(fixture);
    const evidence = measuredAncestorEvidence(fixture);
    evidence.report.sourceIdentitySha256 = "d".repeat(64);
    assert.throws(
      () => validateMeasuredAncestor(fixture, evidence),
      /must match the measured implementation commit/,
    );
  });
});

test("reads source identity from the measured Git blobs, not working files", (t) => {
  const fixture = createMeasuredRepository(t);
  const sourcePath = PHASE11G2_SOURCE_PATHS[0];
  writeRepositoryFile(fixture.directory, sourcePath, "dirty working source\n");
  assert.notEqual(
    phase11g2SourceIdentitySha256({ cwd: fixture.directory }),
    fixture.measuredSourceIdentitySha256,
  );
  assert.equal(
    phase11g2SourceIdentitySha256AtGitCommit({
      commitSha: fixture.measuredRepository.commitSha,
      cwd: fixture.directory,
    }),
    fixture.measuredSourceIdentitySha256,
  );
});

test("rejects non-ancestor and nonexistent measured commits", async (t) => {
  await t.test("non-ancestor", (t) => {
    const fixture = createMeasuredRepository(t);
    const evidenceCommitSha = commitEvidenceOnlyDescendant(fixture).commitSha;
    git(fixture.directory, [
      "switch",
      "--quiet",
      "--detach",
      fixture.measuredRepository.commitSha,
    ]);
    writeRepositoryFile(fixture.directory, "docs/decision-log.md", "sibling\n");
    const siblingRepository = commitAll(fixture.directory, "sibling implementation");
    const siblingSourceIdentitySha256 =
      phase11g2SourceIdentitySha256AtGitCommit({
        commitSha: siblingRepository.commitSha,
        cwd: fixture.directory,
      });
    git(fixture.directory, ["switch", "--quiet", "--detach", evidenceCommitSha]);
    const evidence = measuredAncestorEvidence({
      ...fixture,
      measuredRepository: siblingRepository,
      measuredSourceIdentitySha256: siblingSourceIdentitySha256,
    });
    assert.throws(
      () => validateMeasuredAncestor(fixture, evidence),
      /not an ancestor/,
    );
  });

  await t.test("nonexistent", (t) => {
    const fixture = createMeasuredRepository(t);
    commitEvidenceOnlyDescendant(fixture);
    const evidence = measuredAncestorEvidence(fixture);
    evidence.report.repository.commitSha = "f".repeat(40);
    evidence.runtimeManifest.repository.commitSha = "f".repeat(40);
    assert.throws(
      () => validateMeasuredAncestor(fixture, evidence),
      /does not exist in this repository/,
    );
  });
});

test("rejects report/runtime disagreement and dirty-at-start metadata in ancestor mode", async (t) => {
  await t.test("repository disagreement", (t) => {
    const fixture = createMeasuredRepository(t);
    commitEvidenceOnlyDescendant(fixture);
    const evidence = measuredAncestorEvidence(fixture);
    evidence.runtimeManifest.repository.commitSha = "d".repeat(40);
    assert.throws(
      () => validateMeasuredAncestor(fixture, evidence),
      /must agree on measured commitSha/,
    );
  });

  await t.test("dirty-at-start runtime metadata", (t) => {
    const fixture = createMeasuredRepository(t);
    commitEvidenceOnlyDescendant(fixture);
    const evidence = measuredAncestorEvidence(fixture);
    evidence.runtimeManifest.repository.trackedWorktreeCleanAtStart = false;
    assert.throws(
      () => validateMeasuredAncestor(fixture, evidence),
      /clean tracked worktree at start/,
    );
  });
});

test("rejects non-passing evidence in measured-ancestor mode", (t) => {
  const fixture = createMeasuredRepository(t);
  commitEvidenceOnlyDescendant(fixture);
  assert.throws(
    () => validateMeasuredAncestor(fixture, measuredAncestorEvidence(fixture, false)),
    /only for passing evidence/,
  );
});

test("historical non-passing evidence does not automatically enter ancestor mode", () => {
  const historicalSource = "d".repeat(64);
  assert.throws(
    () =>
      validateEvidenceProvenance({
        currentRepository,
        currentSourceIdentitySha256,
        report: { passed: false, sourceIdentitySha256: historicalSource },
        runtimeManifest: {},
      }),
    /Report repository is required/,
  );
});

test("keeps legacy and measured-ancestor modes mutually exclusive", () => {
  assert.throws(
    () =>
      validateEvidenceProvenance({
        currentRepository,
        legacyHistoricalNonPassing: {
          expectedSourceIdentitySha256: "d".repeat(64),
        },
        measuredImplementationAncestor: { cwd: process.cwd() },
        report: { passed: false, sourceIdentitySha256: "d".repeat(64) },
        runtimeManifest: {},
      }),
    /mutually exclusive/,
  );
});

test("rejects every forbidden post-measurement change category", async (t) => {
  const cases = [
    ["product", "app/new-runtime.ts"],
    ["harness", "scripts/run-phase-11g2-playwright-qualification.mjs"],
    ["test semantics", "tests/performance-qualification.spec.ts"],
    ["fixture", "performance/fixture.sql"],
    ["migration", "supabase/migrations/20990101000000_forbidden.sql"],
    ["package", "package.json"],
    ["dependency lock", "package-lock.json"],
    ["config", "next.config.ts"],
  ];
  for (const [label, filePath] of cases) {
    await t.test(label, (t) => {
      const fixture = createMeasuredRepository(t);
      writeRepositoryFile(fixture.directory, filePath, `${label} change\n`);
      commitAll(fixture.directory, `${label} change`);
      assert.throws(
        () => validateMeasuredAncestor(fixture),
        /Post-measurement diff contains forbidden paths/,
      );
    });
  }
});

test("rejects a mixed allowed and forbidden descendant diff", (t) => {
  const fixture = createMeasuredRepository(t);
  writeRepositoryFile(
    fixture.directory,
    "performance/evidence/focused-normative/runtime-manifest.json",
    "{}\n",
  );
  writeRepositoryFile(fixture.directory, "next.config.ts", "export default {};\n");
  commitAll(fixture.directory, "mixed evidence and config");
  assert.throws(
    () => validateMeasuredAncestor(fixture),
    /next\.config\.ts/,
  );
});

test("rejects executable content even at an allowed evidence path", (t) => {
  const fixture = createMeasuredRepository(t);
  const evidencePath =
    "performance/evidence/focused-normative/runtime-manifest.json";
  writeRepositoryFile(fixture.directory, evidencePath, "{}\n");
  chmodSync(path.join(fixture.directory, evidencePath), 0o755);
  commitAll(fixture.directory, "executable evidence");
  assert.throws(
    () => validateMeasuredAncestor(fixture),
    /normal non-executable tracked file/,
  );
});
