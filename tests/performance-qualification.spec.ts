import { expect, test } from "@playwright/test";
import {
  aggregateNormativeQualificationGroup,
  aggregateQualificationGroup,
  classifyTimedResult,
  nearestRankPercentile,
  serializePrivacySafeEvidence,
  validateConcurrencyOverlap,
  validateFixtureManifest,
  validateNormativeConcurrencyOverlap,
  validateNormativePerformanceSample,
  validatePerformanceSample,
  type NormativePerformanceSample,
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

function normativeSample(
  overrides: Partial<NormativePerformanceSample> = {},
): NormativePerformanceSample {
  const base = sample(overrides);
  const startedAtMs = base.startedAtMs;
  const endedAtMs = base.endedAtMs;
  const serverStartedAtMs = startedAtMs + 10;
  const serverEndedAtMs = endedAtMs - 10;
  const serverDurationMs = serverEndedAtMs - serverStartedAtMs;

  return {
    ...base,
    browserEvidence: {
      sourceBoundary: "playwright_application",
      browserAction: {
        kind: "click",
        triggerId: "diary.create.submit",
        startedAtMs,
      },
      profileConfig: base.profile === "desktop"
        ? {
            engine: "chromium",
            engineVersion: "140.0.7339.16",
            deviceScaleFactor: 1,
            hasTouch: false,
            isMobile: false,
            javaScriptEnabled: true,
            profileId: "desktop-chromium-1280x900",
            viewportHeight: 900,
            viewportWidth: 1280,
          }
        : {
            engine: "chromium",
            engineVersion: "140.0.7339.16",
            deviceScaleFactor: 2,
            hasTouch: true,
            isMobile: true,
            javaScriptEnabled: true,
            profileId: "mobile-chromium-390x844",
            viewportHeight: 844,
            viewportWidth: 390,
          },
      serverBoundary: {
        correlationId: base.correlationId,
        durationMs: serverDurationMs,
        endedAtMs: serverEndedAtMs,
        matched: true,
        method: "POST",
        routeTemplate: "/[locale]/today",
        serverTimingMs: serverDurationMs,
        startedAtMs: serverStartedAtMs,
        status: 200,
      },
      stableUi: {
        conditionId: "diary.create.visible",
        endedAtMs,
        routeTemplate: "/[locale]/today",
        satisfied: true,
      },
      traceEvidence: {
        actionPresent: true,
        archiveId: "trace_desktop_ctx01",
        contextId: "ctx_0123456789abcdef",
        serverBoundaryPresent: true,
        stableUiPresent: true,
      },
    },
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

test("requires the real Playwright application boundary for normative credit", () => {
  expect(validateNormativePerformanceSample(normativeSample())).toMatchObject({
    browserEvidence: { sourceBoundary: "playwright_application" },
  });
  expect(() => validateNormativePerformanceSample(sample())).toThrow(
    /requires Playwright browser evidence/,
  );
  expect(() =>
    validateNormativePerformanceSample({
      ...normativeSample(),
      browserEvidence: {
        ...normativeSample().browserEvidence,
        sourceBoundary: "supabase_rpc_diagnostic",
      },
    }),
  ).toThrow(/Lower-level diagnostics/);
});

test("requires exact action, stable UI, server timing, correlation, and trace evidence", () => {
  const valid = normativeSample();
  expect(() =>
    validateNormativePerformanceSample({
      ...valid,
      browserEvidence: {
        ...valid.browserEvidence,
        stableUi: { ...valid.browserEvidence.stableUi, satisfied: false },
      },
    }),
  ).toThrow(/application boundary|timing is invalid/);
  expect(() =>
    validateNormativePerformanceSample({
      ...valid,
      browserEvidence: {
        ...valid.browserEvidence,
        serverBoundary: {
          ...valid.browserEvidence.serverBoundary,
          correlationId: "perf_ffffffffffffffffffffffffffffffff",
        },
      },
    }),
  ).toThrow(/timing is invalid/);
  expect(() =>
    validateNormativePerformanceSample({
      ...valid,
      browserEvidence: {
        ...valid.browserEvidence,
        traceEvidence: {
          ...valid.browserEvidence.traceEvidence,
          stableUiPresent: false,
        },
      },
    }),
  ).toThrow(/trace evidence is incomplete/);
  expect(() =>
    validateNormativePerformanceSample({
      ...valid,
      browserEvidence: {
        ...valid.browserEvidence,
        serverBoundary: {
          ...valid.browserEvidence.serverBoundary,
          serverTimingMs: valid.browserEvidence.serverBoundary.durationMs + 2,
        },
      },
    }),
  ).toThrow(/timing is invalid/);
});

test("retains a failed browser attempt without crediting a missing stable UI", () => {
  const valid = normativeSample();
  const failed = {
    ...valid,
    classification: "incorrect_visibility" as const,
    integrityPassed: false,
    outcome: "failure" as const,
    browserEvidence: {
      ...valid.browserEvidence,
      stableUi: { ...valid.browserEvidence.stableUi, satisfied: false },
      traceEvidence: {
        ...valid.browserEvidence.traceEvidence,
        stableUiPresent: false,
      },
    },
  };

  expect(validateNormativePerformanceSample(failed)).toMatchObject({
    classification: "incorrect_visibility",
    outcome: "failure",
    browserEvidence: {
      stableUi: { satisfied: false },
      traceEvidence: { stableUiPresent: false },
    },
  });
});

test("records accepted desktop and mobile browser characteristics", () => {
  expect(validateNormativePerformanceSample(normativeSample()).browserEvidence.profileConfig)
    .toMatchObject({ profileId: "desktop-chromium-1280x900" });
  expect(
    validateNormativePerformanceSample(normativeSample({ profile: "mobile" }))
      .browserEvidence.profileConfig,
  ).toMatchObject({
    deviceScaleFactor: 2,
    hasTouch: true,
    isMobile: true,
    profileId: "mobile-chromium-390x844",
  });
  const invalid = normativeSample();
  expect(() =>
    validateNormativePerformanceSample({
      ...invalid,
      browserEvidence: {
        ...invalid.browserEvidence,
        profileConfig: {
          ...invalid.browserEvidence.profileConfig,
          viewportWidth: 1024,
        },
      },
    }),
  ).toThrow(/accepted profile/);
});

test("enforces overlap on the correlated real application requests", () => {
  const overlapping = Array.from({ length: 10 }, (_, index) => {
    const evidence = normativeSample().browserEvidence;
    return normativeSample({
      concurrency: 10,
      waveId: "normative-wave-1",
      sampleIndex: index,
      startedAtMs: 100,
      endedAtMs: 300,
      durationMs: 200,
      browserEvidence: {
        ...evidence,
        browserAction: { ...evidence.browserAction, startedAtMs: 100 },
        serverBoundary: {
          ...evidence.serverBoundary,
          durationMs: 100,
          endedAtMs: 250 + index,
          serverTimingMs: 100,
          startedAtMs: 150 + index,
        },
        stableUi: { ...evidence.stableUi, endedAtMs: 300 },
      },
    });
  });
  const serial = overlapping.map((entry, index) => ({
    ...entry,
    browserEvidence: {
      ...entry.browserEvidence,
      serverBoundary: {
        ...entry.browserEvidence.serverBoundary,
        durationMs: 5,
        endedAtMs: 110 + index * 10,
        serverTimingMs: 5,
        startedAtMs: 105 + index * 10,
      },
    },
  }));

  expect(validateNormativeConcurrencyOverlap(overlapping)).toBe(true);
  expect(validateNormativeConcurrencyOverlap(serial)).toBe(false);
  const incompleteBoundary = overlapping.map((entry, index) =>
    index === 0
      ? {
          ...entry,
          endedAtMs: 10_100,
          durationMs: 10_000,
          outcome: "failure" as const,
          classification: "timeout" as const,
          integrityPassed: false,
          browserEvidence: {
            ...entry.browserEvidence,
            serverBoundary: {
              ...entry.browserEvidence.serverBoundary,
              matched: false,
              status: 500,
            },
            stableUi: {
              ...entry.browserEvidence.stableUi,
              endedAtMs: 10_100,
              satisfied: false,
            },
            traceEvidence: {
              ...entry.browserEvidence.traceEvidence,
              serverBoundaryPresent: false,
              stableUiPresent: false,
            },
          },
        }
      : entry,
  );
  expect(validateNormativeConcurrencyOverlap(incompleteBoundary)).toBe(false);
  expect(
    aggregateNormativeQualificationGroup({
      samples: [
        normativeSample({
          concurrency: 10,
          temperature: "cold",
          waveId: "normative-cold",
        }),
        ...overlapping,
      ],
      minimumWarmSamples: 10,
      thresholdMs: 1_000,
    }).passed,
  ).toBe(true);
});

test("rejects sensitive normative metadata values", () => {
  expect(() =>
    serializePrivacySafeEvidence({
      routeTemplate: "/[locale]/today",
      traceId: "123e4567-e89b-42d3-a456-426614174000",
    }),
  ).toThrow(/sensitive value/);
  expect(() =>
    serializePrivacySafeEvidence({ material: "sb-local-auth-token" }),
  ).toThrow(/sensitive value/);
});
