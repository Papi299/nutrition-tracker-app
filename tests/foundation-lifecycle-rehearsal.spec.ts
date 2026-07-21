import { expect, test } from "@playwright/test";
import {
  createFoundationLifecycleRehearsalSummary,
  foundationLifecycleOverlayPolicyVersion,
  foundationLifecycleRehearsalContractVersion,
  parseFoundationLifecycleRehearsalSummary,
} from "@/ingestion/contracts/foundation-lifecycle-rehearsal";
import { syntheticNormalizedCandidate } from "@/ingestion/fixtures/foundation-release-diff-synthetic";
import { fingerprintJson } from "@/ingestion/usda/foundation/canonical-json";
import {
  createReleaseBOverlay,
  createReleaseCOverlay,
} from "@/ingestion/usda/foundation/lifecycle/rehearsal-overlay";
import type { NormalizedFoundationRecord } from "@/ingestion/usda/foundation/normalization";

function baseline(): NormalizedFoundationRecord[] {
  return Array.from({ length: 353 }, (_, index) => {
    const identity = String(800000 + index);
    const candidate = syntheticNormalizedCandidate({
      source_row_key: `fdc:${identity}`,
      concept_key: `foundation:ndb:${identity}`,
      upstream_version_key: `fdc:${identity}`,
      fdc_id: identity,
      ndb_number: identity,
      name: `Synthetic fixture ${index + 1}`,
    });
    return {
      candidate,
      normalizedBytes: JSON.stringify(candidate).length,
      raw: {
        index,
        raw: {},
        rawContentSha256: fingerprintJson({ fixture: index }),
        rawBytes: 2,
      },
    } as NormalizedFoundationRecord;
  });
}

test.describe("production-shaped lifecycle rehearsal contracts", () => {
  test("generates deterministic bounded B and C overlays without display-name selection", () => {
    const records = baseline();
    const firstB = createReleaseBOverlay(records);
    const secondB = createReleaseBOverlay(records);
    expect(JSON.stringify(firstB)).toBe(JSON.stringify(secondB));
    expect(firstB.declaration).toMatchObject({
      synthetic_rehearsal_only: true,
      policy_version: foundationLifecycleOverlayPolicyVersion,
      release_label: "Synthetic Lifecycle Release B",
    });
    expect(firstB.candidates.filter((item) =>
      item.validation_status === "accepted" &&
      records.some((record) =>
        record.candidate.concept_key === item.normalized_candidate?.concept_key &&
        record.raw.rawContentSha256 === item.raw_payload_hash,
      ),
    ).length).toBeGreaterThanOrEqual(300);
    expect(firstB.candidates.filter((item) => item.validation_status === "rejected")).toHaveLength(1);
    expect(Object.keys(firstB.missing).sort()).toEqual([
      "archive", "defer", "keep_active_pending_investigation", "supersede",
    ]);
    const firstC = createReleaseCOverlay(records, firstB);
    const secondC = createReleaseCOverlay(records, secondB);
    expect(JSON.stringify(firstC)).toBe(JSON.stringify(secondC));
    expect(firstC.declaration.release_label).toBe("Synthetic Lifecycle Release C");
    expect(firstC.missing).toHaveProperty("archive");
  });

  test("fingerprints and parses only the sanitized aggregate report contract", () => {
    const body = {
      contract_version: foundationLifecycleRehearsalContractVersion,
      repository_sha: "a".repeat(40),
      baseline_manifest_fingerprint: "b".repeat(64),
      baseline_report_fingerprint: "c".repeat(64),
      overlay_policy_version: foundationLifecycleOverlayPolicyVersion,
      synthetic_rehearsal_only: true as const,
      baseline: { food_count: 353 }, release_b: { head_version: 2 },
      release_c: { head_version: 3 }, application: { snapshots_preserved: true },
      failure_and_concurrency: { failpoints: 8 }, performance_ms: { bootstrap: 1 },
      backup: { status: "tested_local_logical_restore" },
    };
    const summary = createFoundationLifecycleRehearsalSummary(body);
    expect(parseFoundationLifecycleRehearsalSummary(summary)).toEqual(summary);
    expect(() => parseFoundationLifecycleRehearsalSummary({
      ...summary, release_b: { head_version: 4 },
    })).toThrow(/fingerprint/);
  });
});
