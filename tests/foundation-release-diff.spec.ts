import { expect, test } from "@playwright/test";
import {
  syntheticAcceptedCandidate,
  syntheticNormalizedCandidate,
  syntheticReleaseDiffIds,
  syntheticReleaseDiffInput,
  syntheticReleaseDiffScenarioFingerprint,
  syntheticReleaseDiffScenarioNames,
} from "@/ingestion/fixtures/foundation-release-diff-synthetic";
import {
  createFoundationReleaseDiff,
  serializeFoundationReleaseDiff,
} from "@/ingestion/usda/foundation/lifecycle/diff";
import {
  candidateProjection,
  candidateSourceMetadataFingerprint,
} from "@/ingestion/usda/foundation/lifecycle/projection";
import type {
  FoundationLifecycleDiffInput,
  FoundationLifecycleDiffReport,
} from "@/ingestion/usda/foundation/lifecycle/types";
import { fingerprintJson, type JsonValue } from "@/ingestion/usda/foundation/canonical-json";

const changedRawHash = "9".repeat(64);

function classifications(report: FoundationLifecycleDiffReport, row?: string) {
  return report.items.filter((item) => !row || item.source_row_key === row)
    .map((item) => item.classification);
}

function withCandidate(
  candidate: ReturnType<typeof syntheticNormalizedCandidate>,
  overrides: Partial<FoundationLifecycleDiffInput> = {},
) {
  return syntheticReleaseDiffInput({
    candidates: [syntheticAcceptedCandidate(candidate, {
      source_row_key: candidate.source_row_key,
    })],
    ...overrides,
  });
}

test.describe("deterministic Foundation lifecycle release diff", () => {
  test("classifies an exact record as byte-identical unchanged", () => {
    const report = createFoundationReleaseDiff(syntheticReleaseDiffInput());
    expect(classifications(report)).toEqual(["byte_identical_unchanged"]);
    expect(report.exact_set_counts.byte_identical_unchanged).toBe(1);
  });

  test("derives new_version only for accepted continuing changed FDC versions", () => {
    const candidate = syntheticNormalizedCandidate({
      source_row_key: "fdc:2002",
      upstream_version_key: "fdc:2002",
      fdc_id: "2002",
    });
    const report = createFoundationReleaseDiff(withCandidate(candidate));
    expect(classifications(report)).toEqual([
      "new_version",
      "semantically_unchanged_new_version",
    ]);
    expect(report.exact_set_counts.new_version).toBe(1);
  });

  test("separates source-only metadata from projection changes", () => {
    const metadataCandidate = syntheticNormalizedCandidate({
      source_row_key: "fdc:2002",
      upstream_version_key: "fdc:2002",
      fdc_id: "2002",
      source_metadata: {
        scientific_name: "Synthetic metadata only",
        category: "Synthetic",
        is_historical_reference: false,
        input_food_count: 0,
        nutrient_conversion_factor_count: 0,
      },
    });
    expect(classifications(createFoundationReleaseDiff(
      withCandidate(metadataCandidate),
    ))).toEqual(["new_version", "source_only_metadata"]);

    for (const candidate of [
      syntheticNormalizedCandidate({ name: "Synthetic Lifecycle Renamed" }),
      syntheticNormalizedCandidate({ nutrients: {
        protein_g: {
          ...syntheticNormalizedCandidate().nutrients.protein_g,
          value: "6",
        },
      } }),
    ]) {
      expect(classifications(createFoundationReleaseDiff(
        withCandidate(candidate),
      ))).toEqual(["projection_changing"]);
    }
  });

  test("detects added, removed, explicit-zero, and missing nutrient state changes", () => {
    const base = syntheticNormalizedCandidate();
    const added = syntheticNormalizedCandidate({ nutrients: {
      fat_g: {
        application_nutrient_code: "fat_g",
        source_nutrient_id: "1004",
        source_unit: "g",
        value: "2",
        semantic: "source_reported",
        loq: null,
        derivation_code: null,
        derivation_description: null,
      },
    } });
    const zero = syntheticNormalizedCandidate({ nutrients: {
      fat_g: {
        application_nutrient_code: "fat_g",
        source_nutrient_id: "1004",
        source_unit: "g",
        value: "0",
        semantic: "explicit_zero",
        loq: null,
        derivation_code: null,
        derivation_description: null,
      },
    } });
    for (const candidate of [added, zero]) {
      expect(classifications(createFoundationReleaseDiff(withCandidate(candidate))))
        .toEqual(["projection_changing"]);
    }
    const currentWithFat = {
      ...syntheticReleaseDiffInput().current_concepts[0],
      projection: candidateProjection(added),
      normalized_candidate_hash: added.content_fingerprint,
      source_metadata_hash: candidateSourceMetadataFingerprint(added),
    };
    expect(classifications(createFoundationReleaseDiff(withCandidate(base, {
      current_concepts: [currentWithFat],
    })))).toEqual(["projection_changing"]);
  });

  test("classifies a new concept without inventing a public UUID", () => {
    const candidate = syntheticNormalizedCandidate({
      source_row_key: "fdc:4001",
      concept_key: "foundation:ndb:5001",
      upstream_version_key: "fdc:4001",
      fdc_id: "4001",
      ndb_number: "5001",
    });
    const report = createFoundationReleaseDiff(withCandidate(candidate, {
      current_concepts: [],
    }));
    expect(classifications(report)).toEqual(["new_concept"]);
    expect(report.proposed_projection_fingerprint).not.toBe(
      report.before_projection_fingerprint,
    );
  });

  test("infers missing prior concepts only for complete snapshots", () => {
    for (const scope of ["complete_snapshot", "partial", "unknown"] as const) {
      const input = syntheticReleaseDiffInput({
        candidates: [],
        scope_evidence: {
          ...syntheticReleaseDiffInput().scope_evidence,
          classification: scope,
        },
      });
      const report = createFoundationReleaseDiff(input);
      expect(report.exact_set_counts.missing_prior_concept).toBe(
        scope === "complete_snapshot" ? 1 : 0,
      );
    }
  });

  test("treats archived identity reuse as reactivation", () => {
    const input = syntheticReleaseDiffInput();
    const report = createFoundationReleaseDiff({
      ...input,
      current_concepts: [{
        ...input.current_concepts[0],
        lifecycle_state: "archived",
        projection: { ...input.current_concepts[0].projection, is_archived: true },
      }],
    });
    expect(classifications(report)).toEqual(["reactivation"]);
  });

  test("allows exact no-NDB FDC/raw continuity and blocks changed-FDC guessing", () => {
    const exact = syntheticNormalizedCandidate({
      concept_key: null,
      ndb_number: null,
    });
    const baseInput = syntheticReleaseDiffInput();
    const current = {
      ...baseInput.current_concepts[0],
      concept_key: "foundation:generated:synthetic-no-ndb",
      normalized_candidate_hash: exact.content_fingerprint,
      source_metadata_hash: candidateSourceMetadataFingerprint(exact),
      projection: candidateProjection(exact),
    };
    expect(classifications(createFoundationReleaseDiff(withCandidate(exact, {
      current_concepts: [current],
    })))).toEqual(["byte_identical_unchanged"]);

    const changed = syntheticNormalizedCandidate({
      source_row_key: "fdc:2002",
      concept_key: null,
      upstream_version_key: "fdc:2002",
      fdc_id: "2002",
      ndb_number: null,
    });
    const changedCandidate = syntheticAcceptedCandidate(changed, {
      possible_prior_source_record_ids: [syntheticReleaseDiffIds.sourceRecord],
    });
    expect(classifications(createFoundationReleaseDiff(syntheticReleaseDiffInput({
      current_concepts: [current],
      candidates: [changedCandidate],
    })))).toEqual(["manual_reconciliation_required"]);
    const reconciled = createFoundationReleaseDiff(syntheticReleaseDiffInput({
      current_concepts: [current],
      candidates: [changedCandidate],
      reconciliation_decisions: [{
        source_row_key: changed.source_row_key,
        prior_source_record_id: current.source_record_id,
        decision_type: "equivalent_identity_confirmed",
        decision_fingerprint: "8".repeat(64),
      }],
    }));
    expect(classifications(reconciled)).toEqual([
      "new_version",
      "semantically_unchanged_new_version",
    ]);
  });

  test("gives identity conflicts precedence over projection comparison", () => {
    const duplicateOne = syntheticNormalizedCandidate();
    const duplicateTwo = syntheticNormalizedCandidate({
      source_row_key: "fdc:2002",
      upstream_version_key: "fdc:2002",
      fdc_id: "2002",
    });
    const duplicate = createFoundationReleaseDiff(syntheticReleaseDiffInput({
      candidates: [
        syntheticAcceptedCandidate(duplicateOne),
        syntheticAcceptedCandidate(duplicateTwo),
      ],
    }));
    expect(duplicate.exact_set_counts.identity_conflict).toBe(2);

    const conflictingConcept = syntheticNormalizedCandidate({
      concept_key: "foundation:ndb:9999",
      ndb_number: "9999",
    });
    expect(classifications(createFoundationReleaseDiff(
      withCandidate(conflictingConcept),
    ))).toEqual(["identity_conflict"]);

    const changedRaw = syntheticAcceptedCandidate(syntheticNormalizedCandidate(), {
      raw_payload_hash: changedRawHash,
    });
    expect(classifications(createFoundationReleaseDiff(syntheticReleaseDiffInput({
      candidates: [changedRaw],
    })))).toEqual(["identity_conflict"]);
  });

  test("keeps rejected, trace, and unsupported outcomes distinct", () => {
    const rejected = createFoundationReleaseDiff(syntheticReleaseDiffInput({
      candidates: [{
        source_row_key: "fdc:negative",
        raw_payload_hash: changedRawHash,
        validation_status: "rejected",
        reject_category: "negative_target_value",
        normalized_candidate: null,
        possible_prior_source_record_ids: [],
      }],
    }));
    expect(classifications(rejected)).toEqual(["rejected"]);

    const base = syntheticNormalizedCandidate();
    const trace = syntheticNormalizedCandidate({ nutrients: {
      fat_g: {
        ...base.nutrients.fat_g,
        source_nutrient_id: "1004",
        source_unit: "g",
        semantic: "trace",
      },
    } });
    const unsupported = syntheticNormalizedCandidate({ nutrients: {
      protein_g: { ...base.nutrients.protein_g, source_unit: "mg" },
    } });
    expect(classifications(createFoundationReleaseDiff(withCandidate(trace))))
      .toEqual(["trace_blocked"]);
    expect(classifications(createFoundationReleaseDiff(withCandidate(unsupported))))
      .toEqual(["unsupported"]);
  });

  test("permits multiple orthogonal warnings on one accepted primary outcome", () => {
    const candidate = syntheticNormalizedCandidate({
      warning_categories: ["missing_portions", "unsupported_nutrients_present"],
    });
    const report = createFoundationReleaseDiff(withCandidate(candidate));
    expect(classifications(report)).toEqual([
      "source_only_metadata",
      "warning",
      "warning",
    ]);
    expect(report.exact_set_counts.warning).toBe(2);
    expect(report.category_counts.missing_portions).toBe(1);
  });

  test("does not emit warnings for rejected or blocked primary outcomes", () => {
    const base = syntheticNormalizedCandidate();
    const trace = syntheticNormalizedCandidate({
      warning_categories: ["missing_portions"],
      nutrients: { fat_g: {
        ...base.nutrients.fat_g,
        source_nutrient_id: "1004",
        source_unit: "g",
        semantic: "trace",
      } },
    });
    const report = createFoundationReleaseDiff(withCandidate(trace));
    expect(report.exact_set_counts.warning).toBe(0);
  });

  test("sorts deterministically and produces byte-identical reports", () => {
    const first = createFoundationReleaseDiff(syntheticReleaseDiffInput());
    const second = createFoundationReleaseDiff(syntheticReleaseDiffInput());
    expect(serializeFoundationReleaseDiff(first)).toBe(
      serializeFoundationReleaseDiff(second),
    );
    expect(first.report_fingerprint).toBe(second.report_fingerprint);
    expect(fingerprintJson(syntheticReleaseDiffScenarioNames as unknown as JsonValue))
      .toBe(syntheticReleaseDiffScenarioFingerprint);
    expect(syntheticReleaseDiffScenarioNames).toHaveLength(31);
  });

  test("binds set fingerprints to scope, head, releases, and contract versions", () => {
    const baseline = createFoundationReleaseDiff(syntheticReleaseDiffInput());
    const changed = createFoundationReleaseDiff(syntheticReleaseDiffInput({
      scope_evidence: {
        ...syntheticReleaseDiffInput().scope_evidence,
        fingerprint: "7".repeat(64),
      },
    }));
    expect(changed.exact_set_fingerprints.byte_identical_unchanged).not.toBe(
      baseline.exact_set_fingerprints.byte_identical_unchanged,
    );
    expect(changed.report_fingerprint).not.toBe(baseline.report_fingerprint);
  });

  test("rejects unknown fields and bounded-item overflow", () => {
    expect(() => createFoundationReleaseDiff({
      ...syntheticReleaseDiffInput(),
      unsafe_operator_value: true,
    } as FoundationLifecycleDiffInput)).toThrow(/fields must be exact/);
    const input = syntheticReleaseDiffInput();
    expect(() => createFoundationReleaseDiff({
      ...input,
      candidates: Array.from({ length: 10_001 }, () => input.candidates[0]),
      current_concepts: [],
    })).toThrow(/10,000/);
  });
});
