import { fingerprintJson, isPlainObject, type JsonValue } from "../usda/foundation/canonical-json.ts";

export const foundationLifecycleRehearsalContractVersion =
  "foundation-lifecycle-production-shaped-rehearsal/v1" as const;
export const foundationLifecycleOverlayPolicyVersion =
  "foundation-lifecycle-synthetic-overlay/v1" as const;
export const foundationLifecycleOverlaySeed =
  "phase-10e4-foundation-production-shaped-rehearsal-seed-v1" as const;

export type FoundationLifecycleRehearsalSummary = {
  contract_version: typeof foundationLifecycleRehearsalContractVersion;
  repository_sha: string;
  baseline_manifest_fingerprint: string;
  baseline_report_fingerprint: string;
  overlay_policy_version: typeof foundationLifecycleOverlayPolicyVersion;
  synthetic_rehearsal_only: true;
  baseline: Record<string, JsonValue>;
  release_b: Record<string, JsonValue>;
  release_c: Record<string, JsonValue>;
  application: Record<string, JsonValue>;
  failure_and_concurrency: Record<string, JsonValue>;
  performance_ms: Record<string, JsonValue>;
  backup: Record<string, JsonValue>;
  summary_fingerprint: string;
};

export function createFoundationLifecycleRehearsalSummary(
  body: Omit<FoundationLifecycleRehearsalSummary, "summary_fingerprint">,
): FoundationLifecycleRehearsalSummary {
  return { ...body, summary_fingerprint: fingerprintJson(body as JsonValue) };
}

export function parseFoundationLifecycleRehearsalSummary(
  input: unknown,
): FoundationLifecycleRehearsalSummary {
  if (!isPlainObject(input)) throw new Error("Rehearsal summary must be an object.");
  const expected = [
    "application", "backup", "baseline", "baseline_manifest_fingerprint",
    "baseline_report_fingerprint", "contract_version", "failure_and_concurrency",
    "overlay_policy_version", "performance_ms", "release_b", "release_c",
    "repository_sha", "summary_fingerprint", "synthetic_rehearsal_only",
  ];
  if (JSON.stringify(Object.keys(input).sort()) !== JSON.stringify(expected)) {
    throw new Error("Rehearsal summary fields must be exact.");
  }
  if (
    input.contract_version !== foundationLifecycleRehearsalContractVersion ||
    input.overlay_policy_version !== foundationLifecycleOverlayPolicyVersion ||
    input.synthetic_rehearsal_only !== true ||
    typeof input.repository_sha !== "string" ||
    !/^[a-f0-9]{40}$/.test(input.repository_sha) ||
    typeof input.baseline_manifest_fingerprint !== "string" ||
    typeof input.baseline_report_fingerprint !== "string" ||
    typeof input.summary_fingerprint !== "string"
  ) throw new Error("Rehearsal summary identity is invalid.");
  for (const key of ["baseline", "release_b", "release_c", "application", "failure_and_concurrency", "performance_ms", "backup"] as const) {
    if (!isPlainObject(input[key])) throw new Error(`${key} must be an object.`);
  }
  const body = Object.fromEntries(
    Object.entries(input).filter(([key]) => key !== "summary_fingerprint"),
  ) as JsonValue;
  if (fingerprintJson(body) !== input.summary_fingerprint) {
    throw new Error("Rehearsal summary fingerprint mismatch.");
  }
  return input as FoundationLifecycleRehearsalSummary;
}
