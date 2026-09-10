import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import {
  aggregateNormativeQualificationGroup,
  serializePrivacySafeEvidence,
  validateNormativePerformanceSample,
} from "../lib/performance/qualification.ts";
import { verifyEvidenceManifest } from "./phase-11g2-evidence-preservation.mjs";
import {
  NORMATIVE_MEASUREMENT_BOUNDARY,
  NORMATIVE_TIMER_END,
  NORMATIVE_TIMER_START,
  SERVER_TIMING_DIAGNOSTIC_BOUNDARY,
  phase11g2SourceIdentitySha256,
  phase11g2SourceIdentitySha256AtGitCommit,
} from "./phase-11g2-evidence-contract.mjs";
import {
  parseGitObjectSha,
  readGitProvenance,
  validateMeasuredImplementationAncestor,
} from "./phase-11g2-git-provenance.mjs";

const FORBIDDEN_TEXT = [
  [/(?:authorization|set-cookie|refresh[_-]?token|access[_-]?token|token_hash)/i, "credential metadata"],
  [/\bbearer\s+[A-Za-z0-9._~-]+/i, "bearer credential"],
  [/\bphase11g2-user-\d{3}@example\.test\b/i, "synthetic email"],
  [/\bPhase11G2SyntheticOnly\b/i, "fixture password"],
  [/\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/, "JWT"],
  [/\b[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/i, "UUID"],
];

export function assertPrivacySafeText(value, label = "evidence") {
  for (const [pattern, description] of FORBIDDEN_TEXT) {
    if (pattern.test(value)) {
      throw new TypeError(`${label} contains forbidden ${description}.`);
    }
  }
}

function readPrivacySafeJson(filePath) {
  const raw = readFileSync(filePath, "utf8");
  assertPrivacySafeText(raw, filePath);
  const parsed = JSON.parse(raw);
  serializePrivacySafeEvidence(parsed);
  return parsed;
}

export function parseExpectedSourceIdentitySha256(value) {
  if (value === undefined) return undefined;
  if (!/^[0-9a-f]{64}$/.test(value)) {
    throw new TypeError(
      "The expected evidence source identity must be a lowercase SHA-256 digest.",
    );
  }
  return value;
}

function requireSourceIdentitySha256(value, label) {
  const parsed = parseExpectedSourceIdentitySha256(value);
  if (parsed === undefined) {
    throw new TypeError(`${label} is required.`);
  }
  return parsed;
}

function requireRepository(value, label) {
  assert(value && typeof value === "object" && !Array.isArray(value), `${label} is required.`);
  return {
    commitSha: parseGitObjectSha(value.commitSha, `${label} commit SHA`),
    trackedWorktreeCleanAtStart: value.trackedWorktreeCleanAtStart,
    treeSha: parseGitObjectSha(value.treeSha, `${label} tree SHA`),
  };
}

export function validateEvidenceProvenance({
  currentRepository,
  currentSourceIdentitySha256,
  legacyHistoricalNonPassing,
  measuredImplementationAncestor,
  report,
  runtimeManifest,
}) {
  assert(
    !(legacyHistoricalNonPassing && measuredImplementationAncestor),
    "Legacy historical and measured-implementation-ancestor modes are mutually exclusive.",
  );

  if (legacyHistoricalNonPassing !== undefined) {
    assert.equal(
      report.passed,
      false,
      "Legacy historical evidence compatibility is allowed only for non-passing evidence.",
    );
    const expectedHistoricalSourceIdentitySha256 = requireSourceIdentitySha256(
      legacyHistoricalNonPassing.expectedSourceIdentitySha256,
      "Legacy historical source identity",
    );
    assert.equal(report.sourceIdentitySha256, expectedHistoricalSourceIdentitySha256);
    return "explicit_historical_nonpassing";
  }

  const expectedRepository = requireRepository(currentRepository, "Current repository");
  const reportRepository = requireRepository(report.repository, "Report repository");
  const runtimeRepository = requireRepository(
    runtimeManifest.repository,
    "Runtime-manifest repository",
  );
  assert.equal(
    reportRepository.trackedWorktreeCleanAtStart,
    true,
    "Current evidence must record a clean tracked worktree at start.",
  );
  assert.equal(
    runtimeRepository.trackedWorktreeCleanAtStart,
    true,
    "Runtime evidence must record a clean tracked worktree at start.",
  );

  if (measuredImplementationAncestor !== undefined) {
    assert.equal(
      report.passed,
      true,
      "Measured-implementation-ancestor mode is allowed only for passing evidence.",
    );
    for (const field of ["commitSha", "treeSha"]) {
      assert.equal(
        runtimeRepository[field],
        reportRepository[field],
        `Report and runtime manifest must agree on measured ${field}.`,
      );
    }

    const proof = validateMeasuredImplementationAncestor({
      cwd: measuredImplementationAncestor.cwd,
      measuredCommitSha: reportRepository.commitSha,
      measuredTreeSha: reportRepository.treeSha,
    });
    assert.equal(
      proof.currentRepository.trackedWorktreeCleanAtStart,
      true,
      "Descendant validation requires a clean tracked evidence-container worktree.",
    );
    for (const field of ["commitSha", "treeSha"]) {
      assert.equal(
        proof.currentRepository[field],
        expectedRepository[field],
        `Validated evidence-container ${field} must match the current repository.`,
      );
    }

    const measuredSourceIdentitySha256 =
      phase11g2SourceIdentitySha256AtGitCommit({
        commitSha: reportRepository.commitSha,
        cwd: measuredImplementationAncestor.cwd,
      });
    assert.equal(
      report.sourceIdentitySha256,
      measuredSourceIdentitySha256,
      "Evidence source identity must match the measured implementation commit.",
    );
    return "measured_implementation_ancestor";
  }

  const currentSource = requireSourceIdentitySha256(
    currentSourceIdentitySha256,
    "Current source identity",
  );
  assert.equal(
    report.sourceIdentitySha256,
    currentSource,
    "Current evidence must match the current source identity.",
  );
  for (const field of ["commitSha", "treeSha"]) {
    assert.equal(
      reportRepository[field],
      expectedRepository[field],
      `Report repository ${field} must match the current Git candidate.`,
    );
    assert.equal(
      runtimeRepository[field],
      expectedRepository[field],
      `Runtime repository ${field} must match the current Git candidate.`,
    );
  }
  return "current";
}

export function validateCurrentMeasurementMetadata(report, boundaries) {
  assert.equal(report.timeoutMs, 10_000);
  assert.equal(report.measurementBoundary, NORMATIVE_MEASUREMENT_BOUNDARY);
  assert.equal(report.serverTimingBoundary, SERVER_TIMING_DIAGNOSTIC_BOUNDARY);
  for (const boundary of boundaries) {
    assert.equal(boundary.timerStart, NORMATIVE_TIMER_START);
    assert.equal(boundary.timerEnd, NORMATIVE_TIMER_END);
  }
}

function groupKey(value) {
  return `${value.metricId}/${value.operationId}/${value.profile}/c${value.concurrency}`;
}

function validateTraceArchives(evidenceDirectory, traceMap) {
  const traceDirectory = path.join(evidenceDirectory, "traces");
  const archives = readdirSync(traceDirectory).sort();
  assert.deepEqual(
    archives,
    ["desktop", "mobile"].flatMap((profile) =>
      Array.from(
        { length: 10 },
        (_, index) => `trace_${profile}_ctx${String(index + 1).padStart(2, "0")}.zip`,
      ),
    ).sort(),
    "The bounded trace set must contain exactly ten archives per profile.",
  );
  const mappedArchives = new Set(traceMap.map((entry) => entry.archiveId));
  assert.deepEqual(
    [...mappedArchives].sort(),
    archives.map((archive) => archive.replace(/\.zip$/, "")).sort(),
    "Every bounded trace archive must map to qualifying samples.",
  );

  for (const archive of archives) {
    const archivePath = path.join(traceDirectory, archive);
    assert(statSync(archivePath).size > 0, `${archive} is empty.`);
    const entries = execFileSync("unzip", ["-Z1", archivePath], {
      encoding: "utf8",
    }).trim().split(/\r?\n/).filter(Boolean).sort();
    assert.deepEqual(
      entries,
      ["trace.network", "trace.trace"],
      `${archive} contains an unsupported trace resource.`,
    );
    const network = execFileSync("unzip", ["-p", archivePath, "trace.network"]);
    assert.equal(network.length, 0, `${archive} retains network payload metadata.`);
    const trace = execFileSync("unzip", ["-p", archivePath, "trace.trace"], {
      encoding: "utf8",
      maxBuffer: 100 * 1024 * 1024,
    });
    assert(trace.length > 0, `${archive} is missing action trace events.`);
    assertPrivacySafeText(trace, archive);
  }
}

export function validateEvidenceDirectory(evidenceDirectory, expectations = {}) {
  const report = readPrivacySafeJson(
    path.join(evidenceDirectory, "normative-performance-report.json"),
  );
  const samples = readPrivacySafeJson(
    path.join(evidenceDirectory, "normative-performance-samples.json"),
  );
  const traceMap = readPrivacySafeJson(
    path.join(evidenceDirectory, "normative-browser-trace-map.json"),
  );
  const boundaries = readPrivacySafeJson(
    path.join(evidenceDirectory, "operation-boundaries.json"),
  );
  const runtimeManifest = readPrivacySafeJson(
    path.join(evidenceDirectory, "runtime-manifest.json"),
  );
  const checksumManifestPath = path.join(
    evidenceDirectory,
    "raw-evidence-manifest.json",
  );
  if (existsSync(checksumManifestPath)) {
    readPrivacySafeJson(checksumManifestPath);
    verifyEvidenceManifest(evidenceDirectory);
  }

  const focused = report.evidenceType === "phase-11g2-focused-normative-diagnostic";
  assert(
    focused ||
      report.evidenceType === "phase-11g2-normative-local-performance-capacity-qualification",
    "Unknown normative evidence type.",
  );
  const expectedGroupCount = expectations.groupCount ?? (focused ? 36 : 108);
  const expectedSampleCount = expectations.sampleCount ?? (focused ? 396 : 3348);
  const expectedOperationCount = expectations.operationCount ?? (focused ? 11 : 29);
  const expectedWarmSamples = expectations.warmSamples ?? (focused ? 10 : 30);

  assert.equal(report.groupCount, expectedGroupCount);
  assert.equal(report.sampleCount, expectedSampleCount);
  assert.equal(report.warmSamplesPerGroup, expectedWarmSamples);
  assert.equal(report.normativePlaywrightBoundarySatisfied, true);
  assert.equal(report.cardinalityPassed, true);
  assert.equal(samples.length, expectedSampleCount);
  assert.equal(traceMap.length, expectedSampleCount);
  assert.equal(boundaries.length, expectedOperationCount);
  const repositoryCwd = expectations.repositoryCwd ?? process.cwd();
  const currentSourceIdentitySha256 =
    expectations.measuredImplementationAncestor ||
    expectations.legacyHistoricalNonPassing
      ? undefined
      : phase11g2SourceIdentitySha256({ cwd: repositoryCwd });
  const provenanceValidationMode = validateEvidenceProvenance({
    currentRepository: readGitProvenance({ cwd: repositoryCwd }),
    currentSourceIdentitySha256,
    legacyHistoricalNonPassing: expectations.legacyHistoricalNonPassing,
    measuredImplementationAncestor: expectations.measuredImplementationAncestor
      ? { cwd: repositoryCwd }
      : undefined,
    report,
    runtimeManifest,
  });
  if (provenanceValidationMode !== "explicit_historical_nonpassing") {
    validateCurrentMeasurementMetadata(report, boundaries);
  }
  assert.deepEqual(report.fixtureCardinalities, report.observedFixtureCardinalities);

  const validated = samples.map(validateNormativePerformanceSample);
  const correlations = new Set(validated.map((sample) => sample.correlationId));
  assert.equal(correlations.size, validated.length, "Sample correlations must be unique.");
  const traceCorrelations = new Set(traceMap.map((entry) => entry.correlationId));
  assert.deepEqual(traceCorrelations, correlations, "Trace mapping must cover every sample exactly once.");

  const boundaryOperations = new Set(boundaries.map((entry) => entry.operationId));
  assert.equal(boundaryOperations.size, expectedOperationCount);
  assert.deepEqual(
    boundaryOperations,
    new Set(validated.map((sample) => sample.operationId)),
    "Operation boundaries must cover exactly the measured catalog.",
  );

  const reportGroups = new Map(report.groups.map((group) => [groupKey(group), group]));
  assert.equal(reportGroups.size, expectedGroupCount);
  for (const [key, expected] of reportGroups) {
    const groupSamples = validated.filter((sample) => groupKey(sample) === key);
    const observed = aggregateNormativeQualificationGroup({
      samples: groupSamples,
      thresholdMs: expected.thresholdMs,
      minimumWarmSamples: expectedWarmSamples,
    });
    assert.deepEqual(observed, expected, `Aggregate mismatch for ${key}.`);
  }

  for (const entry of traceMap) {
    const sample = validated.find((candidate) => candidate.correlationId === entry.correlationId);
    assert(sample, "Trace mapping references an unknown correlation.");
    for (const field of [
      "archiveId",
      "concurrency",
      "metricId",
      "operationId",
      "profile",
      "sampleIndex",
      "temperature",
    ]) {
      const expected = field === "archiveId"
        ? sample.browserEvidence.traceEvidence.archiveId
        : sample[field];
      assert.equal(entry[field], expected, `Trace mapping mismatch for ${field}.`);
    }
    assert.equal(entry.stableConditionId, sample.browserEvidence.stableUi.conditionId);
    assert.equal(entry.waveId, sample.waveId);
  }

  assert(
    !readdirSync(path.join(evidenceDirectory, "traces")).some((entry) => entry.includes(".raw.")),
    "Raw unsanitized trace archives must not remain.",
  );
  validateTraceArchives(evidenceDirectory, traceMap);
  return {
    evidenceType: report.evidenceType,
    groupCount: report.groupCount,
    passed: report.passed,
    sampleCount: report.sampleCount,
    sourceIdentity: provenanceValidationMode,
  };
}

async function main() {
  const historicalSourceIdentityPrefix =
    "--legacy-historical-non-passing-source-identity-sha256=";
  const measuredImplementationAncestorArgument =
    "--measured-implementation-ancestor";
  const measuredImplementationAncestorArguments = process.argv
    .slice(2)
    .filter((argument) => argument === measuredImplementationAncestorArgument);
  assert(
    measuredImplementationAncestorArguments.length <= 1,
    "Measured-implementation-ancestor mode may be provided only once.",
  );
  const historicalSourceIdentityArguments = process.argv
    .slice(2)
    .filter((argument) => argument.startsWith(historicalSourceIdentityPrefix));
  assert(
    historicalSourceIdentityArguments.length <= 1,
    "Only one legacy historical non-passing source identity may be provided.",
  );
  assert(
    !(
      historicalSourceIdentityArguments.length > 0 &&
      measuredImplementationAncestorArguments.length > 0
    ),
    "Legacy historical and measured-implementation-ancestor modes are mutually exclusive.",
  );
  const evidenceDirectoryArguments = process.argv
    .slice(2)
    .filter(
      (argument) =>
        !argument.startsWith(historicalSourceIdentityPrefix) &&
        argument !== measuredImplementationAncestorArgument,
    );
  assert(
    evidenceDirectoryArguments.length <= 1,
    "Only one evidence directory may be provided.",
  );
  const evidenceDirectory = path.resolve(
    evidenceDirectoryArguments[0] ?? "performance/evidence/focused-normative",
  );
  if (!existsSync(evidenceDirectory)) {
    throw new Error(`Evidence directory does not exist: ${evidenceDirectory}`);
  }
  const numberFromEnvironment = (name) => {
    const value = process.env[name];
    if (value === undefined) return undefined;
    const parsed = Number(value);
    if (!Number.isSafeInteger(parsed) || parsed < 1) {
      throw new Error(`${name} must be a positive integer.`);
    }
    return parsed;
  };
  process.stdout.write(
    `${JSON.stringify(
      validateEvidenceDirectory(evidenceDirectory, {
        groupCount: numberFromEnvironment("PHASE11G2_EXPECTED_GROUP_COUNT"),
        operationCount: numberFromEnvironment("PHASE11G2_EXPECTED_OPERATION_COUNT"),
        sampleCount: numberFromEnvironment("PHASE11G2_EXPECTED_SAMPLE_COUNT"),
        legacyHistoricalNonPassing: historicalSourceIdentityArguments[0]
          ? {
              expectedSourceIdentitySha256: historicalSourceIdentityArguments[0].slice(
                historicalSourceIdentityPrefix.length,
              ),
            }
          : undefined,
        measuredImplementationAncestor:
          measuredImplementationAncestorArguments.length === 1,
        warmSamples: numberFromEnvironment("PHASE11G2_EXPECTED_WARM_SAMPLES"),
      }),
    )}\n`,
  );
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
