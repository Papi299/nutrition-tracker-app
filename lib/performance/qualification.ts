export const performanceMetricIds = [
  "PERF-001",
  "PERF-002",
  "PERF-003",
  "PERF-004",
  "PERF-005",
  "PERF-006",
] as const;

export const performanceProfiles = ["desktop", "mobile"] as const;
export const performanceTemperatures = ["cold", "warm"] as const;
export const performanceOutcomes = [
  "success",
  "expected",
  "failure",
] as const;
export const performanceClassifications = [
  "succeeded",
  "validation_rejection",
  "authorization_denial",
  "business_conflict",
  "provider_disabled",
  "user_cancellation",
  "timeout",
  "unexpected_5xx",
  "framework_failure",
  "partial_mutation",
  "duplicate_mutation",
  "indeterminate_mutation",
  "incorrect_redirect",
  "incorrect_visibility",
  "integrity_failure",
  "tenant_isolation_failure",
  "unhandled_error",
] as const;

export type PerformanceMetricId = (typeof performanceMetricIds)[number];
export type PerformanceProfile = (typeof performanceProfiles)[number];
export type PerformanceTemperature =
  (typeof performanceTemperatures)[number];
export type PerformanceOutcome = (typeof performanceOutcomes)[number];
export type PerformanceClassification =
  (typeof performanceClassifications)[number];

export type PerformanceSample = Readonly<{
  schemaVersion: "1";
  metricId: PerformanceMetricId;
  operationId: string;
  journeyIds: readonly string[];
  profile: PerformanceProfile;
  concurrency: 1 | 10;
  temperature: PerformanceTemperature;
  sampleIndex: number;
  waveId?: string;
  startedAtMs: number;
  endedAtMs: number;
  durationMs: number;
  outcome: PerformanceOutcome;
  classification: PerformanceClassification;
  correlationId: string;
  integrityPassed: boolean;
}>;

export type FixtureManifest = Readonly<{
  schemaVersion: "1";
  fixtureVersion: string;
  invitedIdentityCount: number;
  activeIdentityCount: number;
  invitedIncompleteIdentityCount: number;
  activationReadyIdentityCount: number;
  approvedConcurrency: number;
  cardinalities: Readonly<Record<string, number>>;
  accountShapes: Readonly<{
    smallDiaryEntries: number;
    medianDiaryEntries: number;
    maximumDiaryEntries: number;
  }>;
  syntheticDomain: "example.test";
}>;

export type QualificationGroup = Readonly<{
  metricId: PerformanceMetricId;
  operationId: string;
  profile: PerformanceProfile;
  concurrency: 1 | 10;
  thresholdMs: number;
  warmSampleCount: number;
  warmRelevantSampleCount: number;
  expectedClassificationCount: number;
  unexpectedFailureCount: number;
  coldSampleCount: number;
  coldDurationMs: number | null;
  p50Ms: number | null;
  p95Ms: number | null;
  minimumSamplesPassed: boolean;
  coldPassed: boolean;
  overlapPassed: boolean;
  thresholdPassed: boolean;
  integrityPassed: boolean;
  passed: boolean;
}>;

const expectedClassifications = new Set<PerformanceClassification>([
  "validation_rejection",
  "authorization_denial",
  "business_conflict",
  "provider_disabled",
  "user_cancellation",
]);

const sensitiveKeyPattern =
  /(^|_)(authorization|body|camera|capability|cookie|email|food|jwt|note|nutrition|password|payload|provider|query|reauth|recipe|refresh|request|response|secret|session|target|token|user)(_|$)/i;
const emailValuePattern = /\b[^\s@]+@[^\s@]+\.[^\s@]+\b/;
const jwtValuePattern = /\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/;
const bearerValuePattern = /\bBearer\s+[A-Za-z0-9._~-]+/i;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requireFiniteNumber(value: unknown) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new TypeError("Performance evidence contains an invalid number.");
  }

  return value;
}

function requireInteger(value: unknown, minimum: number) {
  const number = requireFiniteNumber(value);

  if (!Number.isSafeInteger(number) || number < minimum) {
    throw new TypeError("Performance evidence contains an invalid integer.");
  }

  return number;
}

function requireEnum<T extends string | number>(
  value: unknown,
  values: readonly T[],
) {
  if (!values.includes(value as T)) {
    throw new TypeError("Performance evidence contains an invalid enum value.");
  }

  return value as T;
}

function requireBoundedIdentifier(value: unknown, pattern: RegExp) {
  if (typeof value !== "string" || !pattern.test(value)) {
    throw new TypeError("Performance evidence contains an invalid identifier.");
  }

  return value;
}

function assertSafeEvidenceValue(value: unknown, path: readonly string[] = []) {
  if (typeof value === "string") {
    if (
      emailValuePattern.test(value) ||
      jwtValuePattern.test(value) ||
      bearerValuePattern.test(value)
    ) {
      throw new TypeError("Performance evidence contains a sensitive value.");
    }
    return;
  }

  if (
    value === null ||
    value === undefined ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return;
  }

  if (Array.isArray(value)) {
    value.forEach((entry, index) =>
      assertSafeEvidenceValue(entry, [...path, String(index)]),
    );
    return;
  }

  if (!isRecord(value)) {
    throw new TypeError("Performance evidence contains an unsupported value.");
  }

  for (const [key, child] of Object.entries(value)) {
    if (sensitiveKeyPattern.test(key)) {
      throw new TypeError("Performance evidence contains a sensitive field.");
    }
    assertSafeEvidenceValue(child, [...path, key]);
  }
}

export function serializePrivacySafeEvidence(value: unknown) {
  assertSafeEvidenceValue(value);
  return `${JSON.stringify(value, null, 2)}\n`;
}

export function validateFixtureManifest(value: unknown): FixtureManifest {
  if (!isRecord(value)) {
    throw new TypeError("Fixture manifest must be an object.");
  }

  const allowed = new Set([
    "schemaVersion",
    "fixtureVersion",
    "invitedIdentityCount",
    "activeIdentityCount",
    "invitedIncompleteIdentityCount",
    "activationReadyIdentityCount",
    "approvedConcurrency",
    "cardinalities",
    "accountShapes",
    "syntheticDomain",
  ]);

  if (Object.keys(value).some((key) => !allowed.has(key))) {
    throw new TypeError("Fixture manifest contains an unsupported field.");
  }

  const invitedIdentityCount = requireInteger(value.invitedIdentityCount, 1);
  const activeIdentityCount = requireInteger(value.activeIdentityCount, 1);
  const invitedIncompleteIdentityCount = requireInteger(
    value.invitedIncompleteIdentityCount,
    0,
  );
  const activationReadyIdentityCount = requireInteger(
    value.activationReadyIdentityCount,
    0,
  );

  if (
    invitedIdentityCount !== 100 ||
    value.approvedConcurrency !== 10 ||
    activeIdentityCount +
      invitedIncompleteIdentityCount +
      activationReadyIdentityCount !==
      invitedIdentityCount
  ) {
    throw new TypeError("Fixture manifest does not match the approved beta shape.");
  }

  if (!isRecord(value.cardinalities) || !isRecord(value.accountShapes)) {
    throw new TypeError("Fixture manifest cardinalities are missing.");
  }

  const cardinalities = Object.fromEntries(
    Object.entries(value.cardinalities).map(([key, count]) => [
      requireBoundedIdentifier(key, /^[a-z][a-z0-9_]{0,63}$/),
      requireInteger(count, 0),
    ]),
  );

  const accountShapes = {
    smallDiaryEntries: requireInteger(
      value.accountShapes.smallDiaryEntries,
      0,
    ),
    medianDiaryEntries: requireInteger(
      value.accountShapes.medianDiaryEntries,
      0,
    ),
    maximumDiaryEntries: requireInteger(
      value.accountShapes.maximumDiaryEntries,
      0,
    ),
  };

  if (
    accountShapes.smallDiaryEntries > accountShapes.medianDiaryEntries ||
    accountShapes.medianDiaryEntries > accountShapes.maximumDiaryEntries
  ) {
    throw new TypeError("Fixture account shapes are not ordered.");
  }

  return Object.freeze({
    schemaVersion: requireEnum(value.schemaVersion, ["1"] as const),
    fixtureVersion: requireBoundedIdentifier(
      value.fixtureVersion,
      /^[a-z0-9][a-z0-9._-]{0,63}$/,
    ),
    invitedIdentityCount,
    activeIdentityCount,
    invitedIncompleteIdentityCount,
    activationReadyIdentityCount,
    approvedConcurrency: 10,
    cardinalities: Object.freeze(cardinalities),
    accountShapes: Object.freeze(accountShapes),
    syntheticDomain: requireEnum(value.syntheticDomain, ["example.test"] as const),
  });
}

export function validatePerformanceSample(value: unknown): PerformanceSample {
  if (!isRecord(value)) {
    throw new TypeError("Performance sample must be an object.");
  }

  const allowed = new Set([
    "schemaVersion",
    "metricId",
    "operationId",
    "journeyIds",
    "profile",
    "concurrency",
    "temperature",
    "sampleIndex",
    "waveId",
    "startedAtMs",
    "endedAtMs",
    "durationMs",
    "outcome",
    "classification",
    "correlationId",
    "integrityPassed",
  ]);

  if (Object.keys(value).some((key) => !allowed.has(key))) {
    throw new TypeError("Performance sample contains an unsupported field.");
  }

  if (!Array.isArray(value.journeyIds) || value.journeyIds.length === 0) {
    throw new TypeError("Performance sample requires journey mapping.");
  }

  const startedAtMs = requireFiniteNumber(value.startedAtMs);
  const endedAtMs = requireFiniteNumber(value.endedAtMs);
  const durationMs = requireFiniteNumber(value.durationMs);

  if (
    startedAtMs < 0 ||
    endedAtMs < startedAtMs ||
    durationMs < 0 ||
    Math.abs(endedAtMs - startedAtMs - durationMs) > 1
  ) {
    throw new TypeError("Performance sample timing is inconsistent.");
  }

  const outcome = requireEnum(value.outcome, performanceOutcomes);
  const classification = requireEnum(
    value.classification,
    performanceClassifications,
  );

  if (
    (outcome === "success" && classification !== "succeeded") ||
    (outcome === "expected" && !expectedClassifications.has(classification)) ||
    (outcome === "failure" &&
      (classification === "succeeded" || expectedClassifications.has(classification)))
  ) {
    throw new TypeError("Performance outcome and classification disagree.");
  }

  if (classification === "timeout" && durationMs !== 10_000) {
    throw new TypeError("Timeout samples must retain the ten-second duration.");
  }

  const concurrency = requireEnum(value.concurrency, [1, 10] as const);
  const waveId =
    value.waveId === undefined
      ? undefined
      : requireBoundedIdentifier(value.waveId, /^[a-z0-9][a-z0-9._-]{0,63}$/);

  if ((concurrency === 10) !== Boolean(waveId)) {
    throw new TypeError("Concurrency-ten samples require an overlap wave.");
  }

  if (typeof value.integrityPassed !== "boolean") {
    throw new TypeError("Performance sample requires an integrity disposition.");
  }

  return Object.freeze({
    schemaVersion: requireEnum(value.schemaVersion, ["1"] as const),
    metricId: requireEnum(value.metricId, performanceMetricIds),
    operationId: requireBoundedIdentifier(
      value.operationId,
      /^[a-z][a-z0-9_.-]{0,63}$/,
    ),
    journeyIds: Object.freeze(
      value.journeyIds.map((journeyId) =>
        requireBoundedIdentifier(journeyId, /^CJ-\d{3}$/),
      ),
    ),
    profile: requireEnum(value.profile, performanceProfiles),
    concurrency,
    temperature: requireEnum(value.temperature, performanceTemperatures),
    sampleIndex: requireInteger(value.sampleIndex, 0),
    waveId,
    startedAtMs,
    endedAtMs,
    durationMs,
    outcome,
    classification,
    correlationId: requireBoundedIdentifier(
      value.correlationId,
      /^perf_[a-f0-9]{32}$/,
    ),
    integrityPassed: value.integrityPassed,
  });
}

export function nearestRankPercentile(values: readonly number[], percentile: number) {
  if (
    values.length === 0 ||
    !Number.isFinite(percentile) ||
    percentile <= 0 ||
    percentile > 1 ||
    values.some((value) => !Number.isFinite(value) || value < 0)
  ) {
    throw new TypeError("Invalid nearest-rank percentile input.");
  }

  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.ceil(percentile * sorted.length) - 1];
}

export function validateConcurrencyOverlap(samples: readonly PerformanceSample[]) {
  if (samples.length === 0) return false;

  const waves = Map.groupBy(samples, (sample) => sample.waveId ?? "");

  for (const [waveId, waveSamples] of waves) {
    if (!waveId || waveSamples.length !== 10) return false;

    const points = waveSamples
      .flatMap((sample) => [
        { at: sample.startedAtMs, delta: 1 },
        { at: sample.endedAtMs, delta: -1 },
      ])
      // Treat intervals as half-open: an operation ending exactly when another
      // starts is not overlap, so end points sort before start points.
      .sort((left, right) => left.at - right.at || left.delta - right.delta);
    let active = 0;
    let maximum = 0;

    for (const point of points) {
      active += point.delta;
      maximum = Math.max(maximum, active);
    }

    if (maximum !== 10) return false;
  }

  return true;
}

export function aggregateQualificationGroup({
  samples,
  thresholdMs,
  minimumWarmSamples = 30,
}: {
  samples: readonly PerformanceSample[];
  thresholdMs: number;
  minimumWarmSamples?: number;
}): QualificationGroup {
  if (samples.length === 0 || !Number.isFinite(thresholdMs) || thresholdMs <= 0) {
    throw new TypeError("Qualification group input is invalid.");
  }

  const validated = samples.map(validatePerformanceSample);
  const identity = validated[0];

  if (
    validated.some(
      (sample) =>
        sample.metricId !== identity.metricId ||
        sample.operationId !== identity.operationId ||
        sample.profile !== identity.profile ||
        sample.concurrency !== identity.concurrency,
    )
  ) {
    throw new TypeError("Qualification groups must not mix operations or profiles.");
  }

  const cold = validated.filter((sample) => sample.temperature === "cold");
  const warm = validated.filter((sample) => sample.temperature === "warm");
  const expected = warm.filter((sample) => sample.outcome === "expected");
  const relevant = warm.filter((sample) => sample.outcome !== "expected");
  const failures = relevant.filter((sample) => sample.outcome === "failure");
  const durations = relevant.map((sample) => sample.durationMs);
  const minimumSamplesPassed = relevant.length >= minimumWarmSamples;
  const coldPassed =
    cold.length === 1 &&
    cold[0].outcome === "success" &&
    cold[0].integrityPassed;
  const overlapPassed =
    identity.concurrency === 1 || validateConcurrencyOverlap(warm);
  const p50Ms = durations.length ? nearestRankPercentile(durations, 0.5) : null;
  const p95Ms = durations.length ? nearestRankPercentile(durations, 0.95) : null;
  const thresholdPassed = p95Ms !== null && p95Ms <= thresholdMs;
  const integrityPassed = relevant.every((sample) => sample.integrityPassed);
  const passed =
    minimumSamplesPassed &&
    coldPassed &&
    overlapPassed &&
    thresholdPassed &&
    integrityPassed &&
    failures.length === 0;

  return Object.freeze({
    metricId: identity.metricId,
    operationId: identity.operationId,
    profile: identity.profile,
    concurrency: identity.concurrency,
    thresholdMs,
    warmSampleCount: warm.length,
    warmRelevantSampleCount: relevant.length,
    expectedClassificationCount: expected.length,
    unexpectedFailureCount: failures.length,
    coldSampleCount: cold.length,
    coldDurationMs: cold[0]?.durationMs ?? null,
    p50Ms,
    p95Ms,
    minimumSamplesPassed,
    coldPassed,
    overlapPassed,
    thresholdPassed,
    integrityPassed,
    passed,
  });
}

export function classifyTimedResult({
  durationMs,
  errorKind,
  integrityPassed,
}: {
  durationMs: number;
  errorKind?: Exclude<PerformanceClassification, "succeeded">;
  integrityPassed: boolean;
}): Pick<
  PerformanceSample,
  "classification" | "durationMs" | "integrityPassed" | "outcome"
> {
  if (durationMs >= 10_000 || errorKind === "timeout") {
    return {
      classification: "timeout",
      durationMs: 10_000,
      integrityPassed,
      outcome: "failure",
    };
  }

  if (errorKind && expectedClassifications.has(errorKind)) {
    return {
      classification: errorKind,
      durationMs,
      integrityPassed,
      outcome: "expected",
    };
  }

  if (errorKind || !integrityPassed) {
    return {
      classification: errorKind ?? "integrity_failure",
      durationMs,
      integrityPassed,
      outcome: "failure",
    };
  }

  return {
    classification: "succeeded",
    durationMs,
    integrityPassed: true,
    outcome: "success",
  };
}
