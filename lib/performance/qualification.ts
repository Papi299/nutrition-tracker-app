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

export type NormativeProfileConfig = Readonly<{
  engine: "chromium";
  engineVersion: string;
  deviceScaleFactor: 1 | 2;
  hasTouch: boolean;
  isMobile: boolean;
  javaScriptEnabled: true;
  profileId: "desktop-chromium-1280x900" | "mobile-chromium-390x844";
  viewportHeight: 844 | 900;
  viewportWidth: 390 | 1280;
}>;

export type NormativeBrowserEvidence = Readonly<{
  sourceBoundary: "playwright_application";
  browserAction: Readonly<{
    kind: "click" | "press" | "submit";
    triggerId: string;
    startedAtMs: number;
  }>;
  profileConfig: NormativeProfileConfig;
  serverBoundary: Readonly<{
    correlationId: string;
    durationMs: number;
    endedAtMs: number;
    matched: boolean;
    method: "GET" | "POST";
    routeTemplate: string;
    serverTimingMs: number;
    startedAtMs: number;
    status: number;
  }>;
  stableUi: Readonly<{
    conditionId: string;
    endedAtMs: number;
    routeTemplate: string;
    satisfied: boolean;
  }>;
  traceEvidence: Readonly<{
    actionPresent: boolean;
    archiveId: string;
    contextId: string;
    serverBoundaryPresent: boolean;
    stableUiPresent: boolean;
  }>;
}>;

export type NormativePerformanceSample = PerformanceSample &
  Readonly<{ browserEvidence: NormativeBrowserEvidence }>;

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

export type NormativeQualificationGroup = QualificationGroup &
  Readonly<{
    browserBoundaryPassed: boolean;
    serverOverlapPassed: boolean;
  }>;

export type ProxyStreamRelevance =
  | "measured"
  | "correlated_background"
  | "uncorrelated_background";

export type ProxyStreamInventoryEntry = Readonly<{
  routeTemplate: string;
  method: "GET" | "POST" | "HEAD" | "OTHER";
  ageMs: number;
  headersArrived: boolean;
  contentCompleted: boolean;
  relevance: ProxyStreamRelevance;
  trafficKind: "navigation" | "rsc" | "prefetch" | "framework_asset" | "other";
}>;

export function createProxyActivityTracker() {
  let nextStreamId = 0;
  const activeStreams = new Map<
    number,
    ProxyStreamInventoryEntry & Readonly<{ startedAtMs: number }>
  >();

  return {
    activeCount() {
      return activeStreams.size;
    },
    start({
      method,
      relevance,
      routeTemplate,
      startedAtMs,
      trafficKind,
    }: Readonly<{
      method: ProxyStreamInventoryEntry["method"];
      relevance: ProxyStreamRelevance;
      routeTemplate: string;
      startedAtMs: number;
      trafficKind: ProxyStreamInventoryEntry["trafficKind"];
    }>) {
      const streamId = (nextStreamId += 1);
      activeStreams.set(streamId, {
        ageMs: 0,
        contentCompleted: false,
        headersArrived: false,
        method,
        relevance,
        routeTemplate,
        startedAtMs,
        trafficKind,
      });
      let finished = false;

      function update(values: Partial<ProxyStreamInventoryEntry>) {
        const current = activeStreams.get(streamId);
        if (current) activeStreams.set(streamId, { ...current, ...values });
      }

      return {
        finish() {
          if (finished) return;
          finished = true;
          activeStreams.delete(streamId);
        },
        markContentCompleted() {
          update({ contentCompleted: true });
        },
        markHeadersArrived() {
          update({ headersArrived: true });
        },
      };
    },
    inventory(observedAtMs: number): readonly ProxyStreamInventoryEntry[] {
      return [...activeStreams.values()]
        .map(({ startedAtMs, ...entry }) => ({
          ...entry,
          ageMs: Number(Math.max(0, observedAtMs - startedAtMs).toFixed(3)),
        }))
        .sort((left, right) => right.ageMs - left.ageMs);
    },
  };
}

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
const uuidValuePattern =
  /\b[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/i;
const authMaterialValuePattern =
  /(?:^|[^a-z])(access_token|refresh_token|auth-token|code-verifier|set-cookie)(?:[^a-z]|$)/i;

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
      bearerValuePattern.test(value) ||
      uuidValuePattern.test(value) ||
      authMaterialValuePattern.test(value)
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

function performanceSampleFields(value: Record<string, unknown>) {
  return Object.fromEntries(
    Object.entries(value).filter(([key]) => key !== "browserEvidence"),
  );
}

function requireExactFields(value: Record<string, unknown>, fields: readonly string[]) {
  const allowed = new Set(fields);
  if (
    Object.keys(value).length !== fields.length ||
    Object.keys(value).some((key) => !allowed.has(key))
  ) {
    throw new TypeError("Normative browser evidence contains unsupported fields.");
  }
}

function validateProfileConfig(
  value: unknown,
  profile: PerformanceProfile,
): NormativeProfileConfig {
  if (!isRecord(value)) {
    throw new TypeError("Normative browser profile evidence is missing.");
  }
  requireExactFields(value, [
    "engine",
    "engineVersion",
    "deviceScaleFactor",
    "hasTouch",
    "isMobile",
    "javaScriptEnabled",
    "profileId",
    "viewportHeight",
    "viewportWidth",
  ]);

  const expected = profile === "desktop"
    ? {
        deviceScaleFactor: 1 as const,
        hasTouch: false,
        isMobile: false,
        profileId: "desktop-chromium-1280x900" as const,
        viewportHeight: 900 as const,
        viewportWidth: 1280 as const,
      }
    : {
        deviceScaleFactor: 2 as const,
        hasTouch: true,
        isMobile: true,
        profileId: "mobile-chromium-390x844" as const,
        viewportHeight: 844 as const,
        viewportWidth: 390 as const,
      };

  if (
    value.engine !== "chromium" ||
    typeof value.engineVersion !== "string" ||
    !/^\d+\.\d+\.\d+\.\d+$/.test(value.engineVersion) ||
    value.javaScriptEnabled !== true ||
    value.deviceScaleFactor !== expected.deviceScaleFactor ||
    value.hasTouch !== expected.hasTouch ||
    value.isMobile !== expected.isMobile ||
    value.profileId !== expected.profileId ||
    value.viewportHeight !== expected.viewportHeight ||
    value.viewportWidth !== expected.viewportWidth
  ) {
    throw new TypeError("Normative browser profile does not match the accepted profile.");
  }

  return Object.freeze({
    engine: "chromium",
    engineVersion: value.engineVersion,
    javaScriptEnabled: true,
    ...expected,
  });
}

export function validateNormativePerformanceSample(
  value: unknown,
): NormativePerformanceSample {
  if (!isRecord(value)) {
    throw new TypeError("Normative performance sample must be an object.");
  }

  const sample = validatePerformanceSample(performanceSampleFields(value));
  const evidence = value.browserEvidence;
  if (!isRecord(evidence)) {
    throw new TypeError("Normative sample requires Playwright browser evidence.");
  }
  requireExactFields(evidence, [
    "sourceBoundary",
    "browserAction",
    "profileConfig",
    "serverBoundary",
    "stableUi",
    "traceEvidence",
  ]);
  if (evidence.sourceBoundary !== "playwright_application") {
    throw new TypeError("Lower-level diagnostics cannot qualify as browser samples.");
  }

  const browserAction = evidence.browserAction;
  const stableUi = evidence.stableUi;
  const serverBoundary = evidence.serverBoundary;
  const traceEvidence = evidence.traceEvidence;
  if (
    !isRecord(browserAction) ||
    !isRecord(stableUi) ||
    !isRecord(serverBoundary) ||
    !isRecord(traceEvidence)
  ) {
    throw new TypeError("Normative browser boundary evidence is incomplete.");
  }
  requireExactFields(browserAction, ["kind", "triggerId", "startedAtMs"]);
  requireExactFields(stableUi, [
    "conditionId",
    "endedAtMs",
    "routeTemplate",
    "satisfied",
  ]);
  requireExactFields(serverBoundary, [
    "correlationId",
    "durationMs",
    "endedAtMs",
    "matched",
    "method",
    "routeTemplate",
    "serverTimingMs",
    "startedAtMs",
    "status",
  ]);
  requireExactFields(traceEvidence, [
    "actionPresent",
    "archiveId",
    "contextId",
    "serverBoundaryPresent",
    "stableUiPresent",
  ]);

  const actionStartedAtMs = requireFiniteNumber(browserAction.startedAtMs);
  const stableEndedAtMs = requireFiniteNumber(stableUi.endedAtMs);
  const serverStartedAtMs = requireFiniteNumber(serverBoundary.startedAtMs);
  const serverEndedAtMs = requireFiniteNumber(serverBoundary.endedAtMs);
  const serverDurationMs = requireFiniteNumber(serverBoundary.durationMs);
  const serverTimingMs = requireFiniteNumber(serverBoundary.serverTimingMs);
  const serverStatus = requireInteger(serverBoundary.status, 100);
  const routeTemplatePattern = /^\/\[locale\](?:\/[A-Za-z0-9_.\-[\]]+)*$/;
  if (
    !["click", "press", "submit"].includes(String(browserAction.kind)) ||
    typeof browserAction.triggerId !== "string" ||
    !/^[a-z][a-z0-9_.-]{0,95}$/.test(browserAction.triggerId) ||
    typeof stableUi.conditionId !== "string" ||
    !/^[a-z][a-z0-9_.-]{0,95}$/.test(stableUi.conditionId) ||
    typeof stableUi.routeTemplate !== "string" ||
    !routeTemplatePattern.test(stableUi.routeTemplate) ||
    typeof stableUi.satisfied !== "boolean" ||
    actionStartedAtMs !== sample.startedAtMs ||
    stableEndedAtMs !== sample.endedAtMs ||
    typeof serverBoundary.routeTemplate !== "string" ||
    !routeTemplatePattern.test(serverBoundary.routeTemplate) ||
    !["GET", "POST"].includes(String(serverBoundary.method)) ||
    typeof serverBoundary.matched !== "boolean" ||
    serverBoundary.correlationId !== sample.correlationId ||
    serverStatus < 200 ||
    serverStatus >= 600 ||
    serverStartedAtMs < actionStartedAtMs ||
    serverEndedAtMs < serverStartedAtMs ||
    serverEndedAtMs > stableEndedAtMs + 1 ||
    Math.abs(serverEndedAtMs - serverStartedAtMs - serverDurationMs) > 1 ||
    serverTimingMs < 0 ||
    serverTimingMs > serverDurationMs + 1
  ) {
    throw new TypeError("Normative action, server, or stable-UI timing is invalid.");
  }
  const succeeded = sample.outcome === "success";
  if (
    succeeded &&
    (
      stableUi.satisfied !== true ||
      serverBoundary.matched !== true ||
      serverStatus >= 500
    )
  ) {
    throw new TypeError("Successful normative samples require a complete application boundary.");
  }
  if (
    typeof traceEvidence.actionPresent !== "boolean" ||
    typeof traceEvidence.serverBoundaryPresent !== "boolean" ||
    typeof traceEvidence.stableUiPresent !== "boolean" ||
    traceEvidence.actionPresent !== true ||
    (succeeded && traceEvidence.serverBoundaryPresent !== true) ||
    (succeeded && traceEvidence.stableUiPresent !== true) ||
    typeof traceEvidence.archiveId !== "string" ||
    !/^trace_[a-z0-9][a-z0-9_.-]{0,95}$/.test(traceEvidence.archiveId) ||
    typeof traceEvidence.contextId !== "string" ||
    !/^ctx_[a-f0-9]{16}$/.test(traceEvidence.contextId)
  ) {
    throw new TypeError("Normative Playwright trace evidence is incomplete.");
  }

  return Object.freeze({
    ...sample,
    browserEvidence: Object.freeze({
      sourceBoundary: "playwright_application",
      browserAction: Object.freeze({
        kind: browserAction.kind as "click" | "press" | "submit",
        triggerId: browserAction.triggerId,
        startedAtMs: actionStartedAtMs,
      }),
      profileConfig: validateProfileConfig(evidence.profileConfig, sample.profile),
      serverBoundary: Object.freeze({
        correlationId: sample.correlationId,
        durationMs: serverDurationMs,
        endedAtMs: serverEndedAtMs,
        matched: serverBoundary.matched,
        method: serverBoundary.method as "GET" | "POST",
        routeTemplate: serverBoundary.routeTemplate,
        serverTimingMs,
        startedAtMs: serverStartedAtMs,
        status: serverStatus,
      }),
      stableUi: Object.freeze({
        conditionId: stableUi.conditionId,
        endedAtMs: stableEndedAtMs,
        routeTemplate: stableUi.routeTemplate,
        satisfied: stableUi.satisfied,
      }),
      traceEvidence: Object.freeze({
        actionPresent: traceEvidence.actionPresent,
        archiveId: traceEvidence.archiveId,
        contextId: traceEvidence.contextId,
        serverBoundaryPresent: traceEvidence.serverBoundaryPresent,
        stableUiPresent: traceEvidence.stableUiPresent,
      }),
    }),
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

export function validateNormativeConcurrencyOverlap(
  samples: readonly NormativePerformanceSample[],
) {
  if (samples.length === 0) return false;
  const validated = samples.map(validateNormativePerformanceSample);
  const waves = Map.groupBy(validated, (sample) => sample.waveId ?? "");

  for (const [waveId, waveSamples] of waves) {
    if (!waveId || waveSamples.length !== 10) return false;
    if (
      waveSamples.some(
        (sample) =>
          sample.browserEvidence.serverBoundary.matched !== true ||
          sample.browserEvidence.serverBoundary.status >= 500 ||
          sample.browserEvidence.traceEvidence.serverBoundaryPresent !== true,
      )
    ) return false;
    const points = waveSamples
      .flatMap((sample) => [
        { at: sample.browserEvidence.serverBoundary.startedAtMs, delta: 1 },
        { at: sample.browserEvidence.serverBoundary.endedAtMs, delta: -1 },
      ])
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

export function aggregateNormativeQualificationGroup({
  samples,
  thresholdMs,
  minimumWarmSamples = 30,
}: {
  samples: readonly NormativePerformanceSample[];
  thresholdMs: number;
  minimumWarmSamples?: number;
}): NormativeQualificationGroup {
  const validated = samples.map(validateNormativePerformanceSample);
  const baseSamples = validated.map(({ browserEvidence, ...sample }) => {
    void browserEvidence;
    return sample;
  });
  const base = aggregateQualificationGroup({
    samples: baseSamples,
    thresholdMs,
    minimumWarmSamples,
  });
  const warm = validated.filter((sample) => sample.temperature === "warm");
  const browserBoundaryPassed = validated.length === samples.length;
  const serverOverlapPassed =
    base.concurrency === 1 || validateNormativeConcurrencyOverlap(warm);

  return Object.freeze({
    ...base,
    overlapPassed: base.overlapPassed && serverOverlapPassed,
    browserBoundaryPassed,
    serverOverlapPassed,
    passed: base.passed && browserBoundaryPassed && serverOverlapPassed,
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
