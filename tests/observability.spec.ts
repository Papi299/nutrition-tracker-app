import { expect, test } from "@playwright/test";
import {
  createCorrelationId,
  createObservabilityEvent,
  emitObservabilityEvent,
  incidentResponsePolicy,
  InMemoryObservabilitySink,
  isCorrelationId,
  routeSyntheticCriticalIncident,
  type ObservabilityEventInput,
} from "@/lib/observability";

const applicationError: ObservabilityEventInput = {
  environment: "test",
  errorCode: "render_unhandled",
  name: "application.error",
  operation: "render",
  outcome: "failed",
  routeTemplate: "/[locale]",
  runtime: "node",
  severity: "critical",
  surface: "localized_boundary",
  timestamp: "2026-08-30T10:00:00.000Z",
};

test.describe("provider-neutral observability contract", () => {
  test("accepts strict structured events for every Phase 11G signal family", () => {
    const inputs: ObservabilityEventInput[] = [
      applicationError,
      {
        environment: "test",
        errorCode: "dependency_unavailable",
        name: "dependency.failure",
        operation: "read",
        outcome: "unavailable",
        runtime: "node",
        severity: "error",
        surface: "database",
      },
      {
        environment: "test",
        errorCode: "session_invalid",
        name: "auth.failure",
        operation: "session",
        outcome: "denied",
        runtime: "node",
        severity: "warning",
        surface: "authentication",
      },
      {
        environment: "test",
        name: "health.liveness",
        operation: "liveness",
        outcome: "healthy",
        routeTemplate: "/api/health",
        runtime: "node",
        severity: "info",
        surface: "health_endpoint",
      },
      {
        durationMs: 125.5,
        environment: "test",
        name: "performance.duration",
        operation: "duration",
        outcome: "succeeded",
        runtime: "node",
        severity: "info",
        surface: "server_operation",
      },
      {
        candidateRelease: "candidate-abc123",
        environment: "non_production",
        errorCode: "version_mismatch",
        name: "deployment.version",
        operation: "version_check",
        outcome: "version_mismatch",
        runtime: "node",
        severity: "error",
        surface: "deployment",
      },
    ];

    const events = inputs.map((input) => createObservabilityEvent(input));

    expect(events.map(({ name }) => name)).toEqual([
      "application.error",
      "dependency.failure",
      "auth.failure",
      "health.liveness",
      "performance.duration",
      "deployment.version",
    ]);
    expect(events.every((event) => event.schemaVersion === "1")).toBe(true);
    expect(events.every((event) => Object.isFrozen(event))).toBe(true);
  });

  test("rejects prohibited, arbitrary, raw-error, provider-payload, and unbounded fields", () => {
    const prohibitedFields = [
      "password",
      "recoveryToken",
      "invitationToken",
      "cookie",
      "sessionToken",
      "authorization",
      "serviceRoleKey",
      "apiKey",
      "privateKey",
      "cameraFrame",
      "image",
      "email",
      "freeText",
      "foodName",
      "nutrients",
      "bodyWeight",
      "targets",
      "recipe",
      "requestBody",
      "responseBody",
      "providerPayload",
      "sql",
      "error",
    ];

    for (const field of prohibitedFields) {
      const value =
        field === "error"
          ? new Error("raw provider stack containing a bearer token")
          : "sensitive-user-value";
      const attempt = { ...applicationError, [field]: value };

      expect(() =>
        createObservabilityEvent(attempt as ObservabilityEventInput),
      ).toThrow("Invalid observability event.");
    }

    expect(() =>
      createObservabilityEvent({
        ...applicationError,
        candidateRelease: "x".repeat(65),
      }),
    ).toThrow("Invalid observability event.");
    expect(() =>
      createObservabilityEvent({
        ...applicationError,
        durationMs: Number.POSITIVE_INFINITY,
      }),
    ).toThrow("Invalid observability event.");
  });

  test("creates opaque one-use correlation identifiers without durable identity input", () => {
    const first = createCorrelationId();
    const second = createCorrelationId();

    expect(isCorrelationId(first)).toBe(true);
    expect(isCorrelationId(second)).toBe(true);
    expect(first).not.toBe(second);
    expect(first).not.toContain("@");
    expect(first).not.toContain("user");
  });

  test("isolates contract and sink failures from the application operation", () => {
    const throwingSink = {
      emit() {
        throw new Error("synthetic sink unavailable");
      },
    };

    expect(() => emitObservabilityEvent(applicationError, throwingSink)).not.toThrow();
    expect(emitObservabilityEvent(applicationError, throwingSink)).toEqual({
      accepted: false,
    });
    expect(
      emitObservabilityEvent(
        { ...applicationError, password: "not-accepted" } as ObservabilityEventInput,
        new InMemoryObservabilitySink(),
      ),
    ).toEqual({ accepted: false });
  });

  test("uses a bounded deterministic memory sink and preserves classification", () => {
    const sink = new InMemoryObservabilitySink(1);
    const first = emitObservabilityEvent(applicationError, sink);
    const second = emitObservabilityEvent(applicationError, sink);

    expect(first.accepted).toBe(true);
    expect(second).toEqual({ accepted: false });
    expect(sink.read()).toHaveLength(1);
    expect(sink.read()[0]).toMatchObject({
      errorCode: "render_unhandled",
      name: "application.error",
      severity: "critical",
    });
  });

  test("routes a critical synthetic event through approved tabletop ownership only", () => {
    const event = createObservabilityEvent(applicationError);
    const route = routeSyntheticCriticalIncident(event);

    expect(route).toEqual({
      backup: "Jimmy Peachy",
      backupEscalationMinutes: 15,
      delivery: "NOT_CONFIGURED_SYNTHETIC_ONLY",
      evidenceCorrelationId: event.correlationId,
      primary: "Maor Pichhadze",
      primaryAcknowledgementMinutes: 15,
      productAuthorityEscalationMinutes: 30,
      signal: "application.error",
    });
    expect(incidentResponsePolicy.applicationErrorCountThreshold).toBe(5);
    expect(incidentResponsePolicy.applicationErrorCountWindowMinutes).toBe(5);
    expect(incidentResponsePolicy.applicationErrorMinimumOperationVolume).toBe(
      100,
    );
    expect(incidentResponsePolicy.applicationErrorRatePercentThreshold).toBe(1);
    expect(incidentResponsePolicy.applicationErrorRateWindowMinutes).toBe(15);
    expect(
      incidentResponsePolicy.unhandledCriticalOperationErrorAlertsImmediatelyAtLowVolume,
    ).toBe(true);
    expect(incidentResponsePolicy.repeatedRootCauseRequiresReview).toBe(true);
    expect(
      incidentResponsePolicy.authorizationOrIntegrityErrorAlertsImmediately,
    ).toBe(true);
    expect(incidentResponsePolicy.telemetryRetentionDays).toBe(30);
    expect(incidentResponsePolicy.uptimeProbeIntervalMinutes).toBe(5);
    expect(incidentResponsePolicy.uptimeConsecutiveFailures).toBe(2);
  });
});
