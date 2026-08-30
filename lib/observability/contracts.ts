import { createCorrelationId, isCorrelationId } from "./correlation";

const eventNames = [
  "application.error",
  "dependency.failure",
  "auth.failure",
  "health.liveness",
  "performance.duration",
  "deployment.version",
] as const;
const severities = ["info", "warning", "error", "critical"] as const;
const surfaces = [
  "global_boundary",
  "localized_boundary",
  "protected_boundary",
  "authentication",
  "database",
  "health_endpoint",
  "server_operation",
  "deployment",
] as const;
const operations = [
  "render",
  "read",
  "mutation",
  "session",
  "liveness",
  "duration",
  "version_check",
  "deployment",
] as const;
const outcomes = [
  "failed",
  "healthy",
  "succeeded",
  "unavailable",
  "denied",
  "indeterminate",
  "maintenance",
  "version_match",
  "version_mismatch",
  "version_unknown",
] as const;
const errorCodes = [
  "render_unhandled",
  "framework_failure",
  "dependency_unavailable",
  "database_unexpected",
  "integrity_violation",
  "auth_failed",
  "session_invalid",
  "auth_dependency_unavailable",
  "performance_timeout",
  "deploy_failed",
  "version_mismatch",
  "version_unknown",
] as const;
const environments = ["local", "test", "non_production", "production", "unknown"] as const;
const runtimes = ["browser", "node", "edge", "unknown"] as const;
const routeTemplates = [
  "global",
  "/[locale]",
  "/[locale]/(app)",
  "/api/health",
  "server_operation",
] as const;

export type ObservabilityEventName = (typeof eventNames)[number];
export type ObservabilitySeverity = (typeof severities)[number];
export type ObservabilitySurface = (typeof surfaces)[number];
export type ObservabilityOperation = (typeof operations)[number];
export type ObservabilityOutcome = (typeof outcomes)[number];
export type ObservabilityErrorCode = (typeof errorCodes)[number];
export type ObservabilityEnvironment = (typeof environments)[number];
export type ObservabilityRuntime = (typeof runtimes)[number];
export type ObservabilityRouteTemplate = (typeof routeTemplates)[number];

export type ObservabilityEventInput = {
  candidateRelease?: string;
  correlationId?: string;
  durationMs?: number;
  environment?: ObservabilityEnvironment;
  errorCode?: ObservabilityErrorCode;
  name: ObservabilityEventName;
  operation: ObservabilityOperation;
  outcome: ObservabilityOutcome;
  routeTemplate?: ObservabilityRouteTemplate;
  runtime: ObservabilityRuntime;
  severity: ObservabilitySeverity;
  surface: ObservabilitySurface;
  timestamp?: string;
};

export type ObservabilityEvent = Readonly<{
  candidateRelease?: string;
  correlationId: string;
  durationMs?: number;
  environment: ObservabilityEnvironment;
  errorCode?: ObservabilityErrorCode;
  name: ObservabilityEventName;
  operation: ObservabilityOperation;
  outcome: ObservabilityOutcome;
  routeTemplate?: ObservabilityRouteTemplate;
  runtime: ObservabilityRuntime;
  schemaVersion: "1";
  severity: ObservabilitySeverity;
  surface: ObservabilitySurface;
  timestamp: string;
}>;

const allowedInputFields = new Set([
  "candidateRelease",
  "correlationId",
  "durationMs",
  "environment",
  "errorCode",
  "name",
  "operation",
  "outcome",
  "routeTemplate",
  "runtime",
  "severity",
  "surface",
  "timestamp",
]);

type EventRule = Readonly<{
  duration: "forbidden" | "optional" | "required";
  errorCode: "forbidden" | "optional" | "required";
  errorCodes: readonly ObservabilityErrorCode[];
  operations: readonly ObservabilityOperation[];
  outcomes: readonly ObservabilityOutcome[];
  severities: readonly ObservabilitySeverity[];
  surfaces: readonly ObservabilitySurface[];
}>;

const eventRules: Record<ObservabilityEventName, EventRule> = {
  "application.error": {
    duration: "forbidden",
    errorCode: "required",
    errorCodes: ["render_unhandled", "framework_failure"],
    operations: ["render"],
    outcomes: ["failed"],
    severities: ["error", "critical"],
    surfaces: ["global_boundary", "localized_boundary", "protected_boundary"],
  },
  "dependency.failure": {
    duration: "optional",
    errorCode: "required",
    errorCodes: [
      "dependency_unavailable",
      "database_unexpected",
      "integrity_violation",
    ],
    operations: ["read", "mutation"],
    outcomes: ["unavailable", "failed", "indeterminate"],
    severities: ["warning", "error", "critical"],
    surfaces: ["database", "server_operation"],
  },
  "auth.failure": {
    duration: "optional",
    errorCode: "required",
    errorCodes: [
      "auth_failed",
      "session_invalid",
      "auth_dependency_unavailable",
    ],
    operations: ["session"],
    outcomes: ["denied", "unavailable", "failed"],
    severities: ["warning", "error", "critical"],
    surfaces: ["authentication"],
  },
  "health.liveness": {
    duration: "optional",
    errorCode: "forbidden",
    errorCodes: [],
    operations: ["liveness"],
    outcomes: ["healthy"],
    severities: ["info"],
    surfaces: ["health_endpoint"],
  },
  "performance.duration": {
    duration: "required",
    errorCode: "optional",
    errorCodes: ["performance_timeout"],
    operations: ["duration"],
    outcomes: ["succeeded", "failed"],
    severities: ["info", "warning", "error"],
    surfaces: [
      "authentication",
      "database",
      "health_endpoint",
      "server_operation",
    ],
  },
  "deployment.version": {
    duration: "optional",
    errorCode: "optional",
    errorCodes: ["deploy_failed", "version_mismatch", "version_unknown"],
    operations: ["version_check", "deployment"],
    outcomes: [
      "failed",
      "maintenance",
      "version_match",
      "version_mismatch",
      "version_unknown",
    ],
    severities: ["info", "warning", "error", "critical"],
    surfaces: ["deployment"],
  },
};

export class ObservabilityContractError extends Error {
  constructor() {
    super("Invalid observability event.");
    this.name = "ObservabilityContractError";
  }
}

function invalid(): never {
  throw new ObservabilityContractError();
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }

  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function readEnum<T extends string>(
  value: unknown,
  allowed: readonly T[],
): T {
  if (typeof value !== "string" || !allowed.includes(value as T)) {
    invalid();
  }

  return value as T;
}

function readOptionalEnum<T extends string>(
  value: unknown,
  allowed: readonly T[],
): T | undefined {
  return value === undefined ? undefined : readEnum(value, allowed);
}

function readTimestamp(value: unknown) {
  if (value === undefined) {
    return new Date().toISOString();
  }

  if (
    typeof value !== "string" ||
    value.length > 32 ||
    Number.isNaN(Date.parse(value)) ||
    new Date(value).toISOString() !== value
  ) {
    invalid();
  }

  return value;
}

function readCandidateRelease(value: unknown) {
  if (value === undefined) {
    return undefined;
  }

  if (typeof value !== "string" || !/^[a-zA-Z0-9._-]{1,64}$/.test(value)) {
    invalid();
  }

  return value;
}

function readDuration(value: unknown) {
  if (value === undefined) {
    return undefined;
  }

  if (
    typeof value !== "number" ||
    !Number.isFinite(value) ||
    value < 0 ||
    value > 600_000
  ) {
    invalid();
  }

  return value;
}

function enforceRule(
  event: Pick<
    ObservabilityEvent,
    "durationMs" | "errorCode" | "name" | "operation" | "outcome" | "severity" | "surface"
  >,
) {
  const rule = eventRules[event.name];

  if (
    !rule.operations.includes(event.operation) ||
    !rule.outcomes.includes(event.outcome) ||
    !rule.severities.includes(event.severity) ||
    !rule.surfaces.includes(event.surface)
  ) {
    invalid();
  }

  if (
    (rule.duration === "required" && event.durationMs === undefined) ||
    (rule.duration === "forbidden" && event.durationMs !== undefined) ||
    (rule.errorCode === "required" && event.errorCode === undefined) ||
    (rule.errorCode === "forbidden" && event.errorCode !== undefined) ||
    (event.errorCode !== undefined && !rule.errorCodes.includes(event.errorCode))
  ) {
    invalid();
  }
}

export function classifyObservabilityEnvironment(): ObservabilityEnvironment {
  if (process.env.DATE_E2E_LOCAL_SUPABASE === "1") {
    return "local";
  }

  if (process.env.NODE_ENV === "test") {
    return "test";
  }

  if (process.env.NODE_ENV === "development") {
    return "local";
  }

  return "unknown";
}

export function createObservabilityEvent(
  input: ObservabilityEventInput,
): ObservabilityEvent;
export function createObservabilityEvent(input: unknown): ObservabilityEvent {
  if (!isPlainRecord(input)) {
    invalid();
  }

  const fields = Object.keys(input);
  if (fields.length > allowedInputFields.size) {
    invalid();
  }
  if (fields.some((field) => !allowedInputFields.has(field))) {
    invalid();
  }

  const correlationId = input.correlationId ?? createCorrelationId();
  if (!isCorrelationId(correlationId)) {
    invalid();
  }

  const candidateRelease = readCandidateRelease(input.candidateRelease);
  const durationMs = readDuration(input.durationMs);
  const errorCode = readOptionalEnum(input.errorCode, errorCodes);
  const routeTemplate = readOptionalEnum(input.routeTemplate, routeTemplates);
  const event: ObservabilityEvent = Object.freeze({
    ...(candidateRelease === undefined ? {} : { candidateRelease }),
    correlationId,
    ...(durationMs === undefined ? {} : { durationMs }),
    environment: readOptionalEnum(input.environment, environments) ?? "unknown",
    ...(errorCode === undefined ? {} : { errorCode }),
    name: readEnum(input.name, eventNames),
    operation: readEnum(input.operation, operations),
    outcome: readEnum(input.outcome, outcomes),
    ...(routeTemplate === undefined ? {} : { routeTemplate }),
    runtime: readEnum(input.runtime, runtimes),
    schemaVersion: "1",
    severity: readEnum(input.severity, severities),
    surface: readEnum(input.surface, surfaces),
    timestamp: readTimestamp(input.timestamp),
  });

  enforceRule(event);
  return event;
}
