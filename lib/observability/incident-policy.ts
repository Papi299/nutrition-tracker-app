import type { ObservabilityEvent } from "./contracts";

export const incidentResponsePolicy = Object.freeze({
  applicationErrorCountThreshold: 5,
  applicationErrorCountWindowMinutes: 5,
  applicationErrorMinimumOperationVolume: 100,
  applicationErrorRatePercentThreshold: 1,
  applicationErrorRateWindowMinutes: 15,
  authorizationOrIntegrityErrorAlertsImmediately: true,
  authCanonicalDigestFailures: 10,
  authCanonicalDigestWindowMinutes: 10,
  backupEscalationMinutes: 15,
  databaseUnexpectedErrors: 3,
  databaseUnexpectedWindowMinutes: 5,
  incidentPrimary: "Maor Pichhadze",
  incidentProductAuthorityMinutes: 30,
  incidentPrimaryAcknowledgementMinutes: 15,
  incidentEscalationBackup: "Jimmy Peachy",
  inviteReplayAttempts: 5,
  inviteReplayWindowMinutes: 15,
  latencyAlertMinimumSamples: 20,
  latencyAlertWindowMinutes: 15,
  observabilityOwner: "Maor Pichhadze",
  performanceReliabilityOwner: "Maor Pichhadze",
  repeatedRootCauseRequiresReview: true,
  telemetryRetentionDays: 30,
  unhandledCriticalOperationErrorAlertsImmediatelyAtLowVolume: true,
  uptimeConsecutiveFailures: 2,
  uptimeProbeIntervalMinutes: 5,
  uptimeWindowMinutes: 10,
});

export type SyntheticIncidentRoute = Readonly<{
  backup: "Jimmy Peachy";
  backupEscalationMinutes: 15;
  delivery: "NOT_CONFIGURED_SYNTHETIC_ONLY";
  evidenceCorrelationId: string;
  primary: "Maor Pichhadze";
  primaryAcknowledgementMinutes: 15;
  productAuthorityEscalationMinutes: 30;
  signal: ObservabilityEvent["name"];
}>;

export function routeSyntheticCriticalIncident(
  event: ObservabilityEvent,
): SyntheticIncidentRoute | null {
  if (event.severity !== "critical") {
    return null;
  }

  return Object.freeze({
    backup: incidentResponsePolicy.incidentEscalationBackup,
    backupEscalationMinutes: incidentResponsePolicy.backupEscalationMinutes,
    delivery: "NOT_CONFIGURED_SYNTHETIC_ONLY",
    evidenceCorrelationId: event.correlationId,
    primary: incidentResponsePolicy.incidentPrimary,
    primaryAcknowledgementMinutes:
      incidentResponsePolicy.incidentPrimaryAcknowledgementMinutes,
    productAuthorityEscalationMinutes:
      incidentResponsePolicy.incidentProductAuthorityMinutes,
    signal: event.name,
  });
}
