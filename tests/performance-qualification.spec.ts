import { expect, test } from "@playwright/test";
import {
  aggregateQualificationGroup,
  classifyTimedResult,
  nearestRankPercentile,
  serializePrivacySafeEvidence,
  validateConcurrencyOverlap,
  validateFixtureManifest,
  validatePerformanceSample,
  type PerformanceSample,
} from "@/lib/performance";

function sample(
  overrides: Partial<PerformanceSample> = {},
): PerformanceSample {
  const startedAtMs = overrides.startedAtMs ?? 100;
  const durationMs = overrides.durationMs ?? 100;

  return {
    schemaVersion: "1",
    metricId: "PERF-002",
    operationId: "diary.create",
    journeyIds: ["CJ-012"],
    profile: "desktop",
    concurrency: 1,
    temperature: "warm",
    sampleIndex: 0,
    startedAtMs,
    endedAtMs: overrides.endedAtMs ?? startedAtMs + durationMs,
    durationMs,
    outcome: "success",
    classification: "succeeded",
    correlationId: "perf_0123456789abcdef0123456789abcdef",
    integrityPassed: true,
    ...overrides,
  };
}

test("uses deterministic nearest-rank percentiles", () => {
  const values = Array.from({ length: 30 }, (_, index) => index + 1);
  expect(nearestRankPercentile(values, 0.5)).toBe(15);
  expect(nearestRankPercentile(values, 0.95)).toBe(29);
  expect(() => nearestRankPercentile([], 0.95)).toThrow();
});

test("retains unexpected failures and timeouts in qualification", () => {
  const warm = Array.from({ length: 29 }, (_, index) =>
    sample({ sampleIndex: index + 1, durationMs: 100 + index }),
  );
  const timeout = sample({
    sampleIndex: 30,
    durationMs: 10_000,
    endedAtMs: 10_100,
    outcome: "failure",
    classification: "timeout",
    integrityPassed: false,
  });
  const cold = sample({ temperature: "cold", durationMs: 150 });
  const result = aggregateQualificationGroup({
    samples: [cold, ...warm, timeout],
    thresholdMs: 1_000,
  });

  expect(result).toMatchObject({
    minimumSamplesPassed: true,
    p95Ms: 128,
    unexpectedFailureCount: 1,
    passed: false,
  });
  expect(classifyTimedResult({ durationMs: 10_500, integrityPassed: true })).toEqual({
    classification: "timeout",
    durationMs: 10_000,
    integrityPassed: true,
    outcome: "failure",
  });
});

test("enforces minimum samples and keeps cold and warm separate", () => {
  const result = aggregateQualificationGroup({
    samples: [
      sample({ temperature: "cold", durationMs: 900 }),
      ...Array.from({ length: 29 }, (_, index) =>
        sample({ sampleIndex: index + 1, durationMs: 100 }),
      ),
    ],
    thresholdMs: 1_000,
  });

  expect(result.minimumSamplesPassed).toBe(false);
  expect(result.coldDurationMs).toBe(900);
  expect(result.p95Ms).toBe(100);
  expect(result.passed).toBe(false);
});

test("rejects mixed operation and profile groups", () => {
  const cold = sample({ temperature: "cold" });
  expect(() =>
    aggregateQualificationGroup({
      samples: [cold, sample({ profile: "mobile" })],
      thresholdMs: 1_000,
      minimumWarmSamples: 1,
    }),
  ).toThrow(/must not mix/);
});

test("validates real ten-operation overlap by synchronized wave", () => {
  const overlapping = Array.from({ length: 10 }, (_, index) =>
    sample({
      concurrency: 10,
      waveId: "wave-1",
      sampleIndex: index,
      startedAtMs: 100 + index,
      endedAtMs: 200 + index,
      durationMs: 100,
    }),
  );
  const serial = Array.from({ length: 10 }, (_, index) =>
    sample({
      concurrency: 10,
      waveId: "wave-2",
      sampleIndex: index,
      startedAtMs: index * 100,
      endedAtMs: index * 100 + 50,
      durationMs: 50,
    }),
  );
  const touching = Array.from({ length: 10 }, (_, index) =>
    sample({
      concurrency: 10,
      waveId: "wave-3",
      sampleIndex: index,
      startedAtMs: index * 100,
      endedAtMs: (index + 1) * 100,
      durationMs: 100,
    }),
  );

  expect(validateConcurrencyOverlap(overlapping)).toBe(true);
  expect(validateConcurrencyOverlap(serial)).toBe(false);
  expect(validateConcurrencyOverlap(touching)).toBe(false);
});

test("validates the exact launch fixture shape", () => {
  expect(
    validateFixtureManifest({
      schemaVersion: "1",
      fixtureVersion: "phase-11g2-v1",
      invitedIdentityCount: 100,
      activeIdentityCount: 40,
      invitedIncompleteIdentityCount: 0,
      activationReadyIdentityCount: 60,
      approvedConcurrency: 10,
      cardinalities: { foods: 1_480 },
      accountShapes: {
        smallDiaryEntries: 10,
        medianDiaryEntries: 180,
        maximumDiaryEntries: 1_002,
      },
      syntheticDomain: "example.test",
    }),
  ).toMatchObject({ invitedIdentityCount: 100, approvedConcurrency: 10 });

  expect(() =>
    validateFixtureManifest({
      schemaVersion: "1",
      fixtureVersion: "bad",
      invitedIdentityCount: 99,
      activeIdentityCount: 99,
      invitedIncompleteIdentityCount: 0,
      activationReadyIdentityCount: 0,
      approvedConcurrency: 10,
      cardinalities: {},
      accountShapes: {
        smallDiaryEntries: 1,
        medianDiaryEntries: 1,
        maximumDiaryEntries: 1,
      },
      syntheticDomain: "example.test",
    }),
  ).toThrow(/approved beta shape/);
});

test("rejects sensitive fields and values from serialized evidence", () => {
  expect(serializePrivacySafeEvidence({ metricId: "PERF-001", p95Ms: 120 })).toContain(
    '"p95Ms": 120',
  );
  expect(
    serializePrivacySafeEvidence({
      fixtureCardinalities: [{ relation: "recipe_ingredients", count: 1_800 }],
    }),
  ).toContain('"count": 1800');
  expect(() => serializePrivacySafeEvidence({ email: "actor@example.test" })).toThrow(
    /sensitive field/,
  );
  expect(() =>
    serializePrivacySafeEvidence({ identifier: "actor@example.test" }),
  ).toThrow(/sensitive value/);
  expect(() => serializePrivacySafeEvidence({ request_payload: "safe" })).toThrow(
    /sensitive field/,
  );
});

test("rejects invalid sample fields, classifications, and timeout duration", () => {
  expect(validatePerformanceSample(sample())).toMatchObject({
    operationId: "diary.create",
  });
  expect(() =>
    validatePerformanceSample({ ...sample(), password: "not-allowed" }),
  ).toThrow(/unsupported field/);
  expect(() =>
    validatePerformanceSample(
      sample({ outcome: "success", classification: "unexpected_5xx" }),
    ),
  ).toThrow(/disagree/);
  expect(() =>
    validatePerformanceSample(
      sample({
        outcome: "failure",
        classification: "timeout",
        durationMs: 9_999,
        endedAtMs: 10_099,
      }),
    ),
  ).toThrow(/ten-second/);
});
