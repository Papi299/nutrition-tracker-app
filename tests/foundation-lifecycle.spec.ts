import { expect, test } from "@playwright/test";
import {
  attachContractFingerprint,
  canonicalizeContract,
  fingerprintContractBody,
  fingerprintFoundationDatasetProjection,
  fingerprintFoundationFoodProjection,
  foundationDiffClassifications,
  foundationLifecycleAllowanceContractVersion,
  foundationLifecyclePolicyVersion,
  foundationLifecycleRunPurposes,
  foundationLifecycleUpdateApprovalContractVersion,
  foundationLifecycleUpdateReceiptContractVersion,
  foundationLifecycleValidationReceiptContractVersion,
  foundationReconciliationDecisionContractVersion,
  foundationReleaseDiffContractVersion,
  parseFoundationBaselineBootstrapResult,
  parseFoundationDatasetProjection,
  parseFoundationFoodProjection,
  parseFoundationLifecycleAllowance,
  parseFoundationLifecycleUpdateApproval,
  parseFoundationLifecycleUpdateReceipt,
  parseFoundationLifecycleValidationReceipt,
  parseFoundationNutrientProjection,
  parseFoundationReconciliationDecision,
  parseFoundationReleaseDiffItem,
  parseFoundationReleaseDiffReport,
  parseFoundationReleaseScopeEvidence,
} from "@/ingestion/contracts/foundation-lifecycle";
import {
  syntheticBaselineFoodProjection,
  syntheticBootstrapResult,
  syntheticDatasetProjection,
  syntheticLifecycleCases,
  syntheticLifecycleCaseSetFingerprint,
  syntheticLifecycleIds,
  syntheticNoNdbFoodProjection,
  syntheticReleaseScopeEvidence,
} from "@/ingestion/fixtures/foundation-lifecycle-synthetic";
import { fingerprintJson, type JsonValue } from "@/ingestion/usda/foundation/canonical-json";

const hashA = "a".repeat(64);
const hashB = "b".repeat(64);

function refingerprint(
  record: Record<string, JsonValue>,
  overrides: Record<string, JsonValue>,
) {
  const body = Object.fromEntries(
    Object.entries(record).filter(([key]) => key !== "contract_fingerprint"),
  ) as Record<string, JsonValue>;
  return attachContractFingerprint({ ...body, ...overrides });
}

function reconciliationItem(overrides: Record<string, JsonValue> = {}) {
  const body = {
    source_record_id: syntheticLifecycleIds.baselineRecord,
    source_record_version_id: syntheticLifecycleIds.baselineVersion,
    related_source_record_id: null,
    food_id: syntheticLifecycleIds.baselineFood,
    diff_item_fingerprint: hashA,
    ...overrides,
  };
  return { ...body, item_fingerprint: fingerprintJson(body as JsonValue) };
}

function reconciliation(overrides: Record<string, JsonValue> = {}) {
  return attachContractFingerprint({
    contract_version: foundationReconciliationDecisionContractVersion,
    dataset_id: syntheticLifecycleIds.dataset,
    source_release_id: syntheticLifecycleIds.updateRelease,
    environment: "local",
    decision_type: "archive",
    relationship_direction: "none",
    reason: "Synthetic missing-concept review.",
    evidence_references: ["synthetic-fixture:missing-review"],
    reviewer_identity: "Synthetic reviewer",
    approval_reference: "synthetic-reconciliation",
    approval_timestamp: "2026-07-19T00:00:00Z",
    expires_at: "2026-08-19T00:00:00Z",
    supersedes_decision_id: null,
    items: [reconciliationItem()],
    ...overrides,
  });
}

function allowance(overrides: Record<string, JsonValue> = {}) {
  return attachContractFingerprint({
    contract_version: foundationLifecycleAllowanceContractVersion,
    dataset_id: syntheticLifecycleIds.dataset,
    source_release_id: syntheticLifecycleIds.updateRelease,
    prior_dataset_projection_head_id: syntheticLifecycleIds.datasetHead,
    environment: "local",
    allowance_type: "missing_set",
    exact_set_fingerprint: hashA,
    exact_item_fingerprints: [hashB],
    allowed_lifecycle_action: "archive",
    approver_identity: "Synthetic approver",
    approval_reference: "synthetic-allowance",
    approval_timestamp: "2026-07-19T00:00:00Z",
    expires_at: "2026-08-19T00:00:00Z",
    ...overrides,
  });
}

function diffItem(overrides: Record<string, JsonValue> = {}) {
  const body = {
    source_row_key: "synthetic-row-1",
    concept_key: "synthetic:concept-1",
    upstream_version_key: "synthetic-version-1",
    raw_payload_hash: hashA,
    normalized_candidate_hash: hashB,
    prior_source_version_hash: null,
    prior_public_projection_hash: null,
    proposed_public_projection_hash: hashA,
    classification: "new_concept",
    reason_category: "synthetic_new_concept",
    reconciliation_decision_fingerprint: null,
    set_ordinal: 1,
    ...overrides,
  };
  return { ...body, item_fingerprint: fingerprintJson(body as JsonValue) };
}

function diffReport(overrides: Record<string, JsonValue> = {}) {
  const exactSetFingerprints = Object.fromEntries(
    foundationDiffClassifications.map((classification) => [classification, hashA]),
  );
  const exactSetCounts = Object.fromEntries(
    foundationDiffClassifications.map((classification) => [
      classification,
      classification === "new_concept" ? 1 : 0,
    ]),
  );
  const body = {
    contract_version: foundationReleaseDiffContractVersion,
    import_run_id: "20000000-0000-4000-8000-000000000001",
    prior_source_release_id: syntheticLifecycleIds.baselineRelease,
    prior_source_release_fingerprint: hashA,
    new_source_release_id: syntheticLifecycleIds.updateRelease,
    new_source_release_fingerprint: hashB,
    prior_dataset_projection_head_id: syntheticLifecycleIds.datasetHead,
    prior_dataset_projection_head_version: 1,
    release_scope_evidence_id: "10000000-0000-4000-8000-00000000000b",
    release_scope_evidence_fingerprint: hashA,
    prior_dataset_projection_fingerprint: hashB,
    environment: "local",
    items: [diffItem()],
    exact_set_fingerprints: exactSetFingerprints,
    exact_set_counts: exactSetCounts,
    category_counts: { synthetic_new_concept: 1 },
    before_projection_fingerprint: hashA,
    proposed_projection_fingerprint: hashB,
    contract_versions: {
      importer_contract_version: "synthetic-importer/v1",
      schema_contract_version: "synthetic-schema/v1",
      mapping_version: "synthetic-mapping/v1",
      mapping_hash: hashA,
      parser_contract_version: "synthetic-parser/v1",
      reject_policy_version: "synthetic-reject/v1",
      diff_contract_version: foundationReleaseDiffContractVersion,
      lifecycle_policy_version: foundationLifecyclePolicyVersion,
      scope_contract_version: "foundation-release-scope/v1",
      reconciliation_contract_version:
        "foundation-reconciliation-decision/v1",
    },
    ...overrides,
  };
  return { ...body, report_fingerprint: fingerprintJson(body as JsonValue) };
}

function receiptContract(
  contractVersion: string,
  fingerprintField: "validation_fingerprint" | "receipt_fingerprint",
) {
  const body = {
    contract_version: contractVersion,
    import_run_id: "20000000-0000-4000-8000-000000000001",
    prior_dataset_projection_fingerprint: hashA,
    environment: "local",
    set_fingerprints: { projection: hashB },
    counts: { foods: 2, nutrients: 7 },
  };
  return {
    ...body,
    [fingerprintField]: fingerprintJson(body as JsonValue),
  };
}

function updateApproval(overrides: Record<string, JsonValue> = {}) {
  return attachContractFingerprint({
    contract_version: foundationLifecycleUpdateApprovalContractVersion,
    validation_receipt_id: "20000000-0000-4000-8000-000000000002",
    validation_fingerprint: hashA,
    environment: "local",
    approver_identity: "Synthetic lifecycle approver",
    approval_reference: "synthetic-lifecycle-update",
    approval_timestamp: "2026-07-19T00:00:00Z",
    expires_at: "2026-07-20T00:00:00Z",
    ...overrides,
  });
}

test.describe("Foundation lifecycle exact contracts", () => {
  test("accepts reviewed scope evidence and all exact scope classifications", () => {
    expect(parseFoundationReleaseScopeEvidence(syntheticReleaseScopeEvidence))
      .toMatchObject({ scope_classification: "unknown", environment: "local" });
    for (const scope of ["complete_snapshot", "partial", "unknown"] as const) {
      expect(parseFoundationReleaseScopeEvidence(refingerprint(
        syntheticReleaseScopeEvidence,
        { scope_classification: scope },
      ))).toMatchObject({ scope_classification: scope });
    }
  });

  test("rejects unknown and missing scope fields", () => {
    expect(() => parseFoundationReleaseScopeEvidence({
      ...syntheticReleaseScopeEvidence,
      secret: "not allowed",
    })).toThrow(/fields must be exact/);
    const missing = { ...syntheticReleaseScopeEvidence } as Record<string, unknown>;
    delete missing.approval_reference;
    expect(() => parseFoundationReleaseScopeEvidence(missing)).toThrow(/fields must be exact/);
  });

  test("rejects malformed hashes, unsafe evidence, and expired scope evidence", () => {
    expect(() => parseFoundationReleaseScopeEvidence(refingerprint(
      syntheticReleaseScopeEvidence,
      { manifest_fingerprint: "ABC" },
    ))).toThrow(/lowercase SHA-256/);
    expect(() => parseFoundationReleaseScopeEvidence(refingerprint(
      syntheticReleaseScopeEvidence,
      { evidence_references: ["https://user:secret@example.test/evidence"] },
    ))).toThrow(/invalid/);
    expect(() => parseFoundationReleaseScopeEvidence(refingerprint(
      syntheticReleaseScopeEvidence,
      { expires_at: "2026-07-18T00:00:00Z" },
    ))).toThrow(/expired/);
  });

  test("validates every lifecycle run purpose", () => {
    expect(foundationLifecyclePolicyVersion).toBe("foundation-lifecycle-policy/v1");
    expect(foundationLifecycleRunPurposes).toEqual([
      "initial_promotion", "release_update", "mapping_reprojection",
      "parser_revalidation", "manual_reconciliation", "corrective_release",
    ]);
  });

  test("accepts every diff classification with deterministic ordinals", () => {
    const classifications = [
      "new_concept", "new_version", "byte_identical_unchanged",
      "semantically_unchanged_new_version", "projection_changing",
      "source_only_metadata", "missing_prior_concept", "reactivation",
      "rejected", "warning", "identity_conflict",
      "manual_reconciliation_required", "trace_blocked", "unsupported",
    ] as const;
    for (const classification of classifications) {
      expect(parseFoundationReleaseDiffItem(diffItem({ classification })))
        .toMatchObject({ classification, set_ordinal: 1 });
    }
  });

  test("rejects changed diff bodies and duplicate per-set ordinals", () => {
    expect(() => parseFoundationReleaseDiffItem({
      ...diffItem(),
      reason_category: "changed_without_refingerprint",
    })).toThrow(/fingerprint mismatch/);
    expect(() => parseFoundationReleaseDiffReport(diffReport({
      items: [diffItem(), diffItem({ source_row_key: "synthetic-row-2" })],
    }))).toThrow(/ordinals must be unique/);
  });

  test("validates a bounded exact diff report", () => {
    expect(parseFoundationReleaseDiffReport(diffReport())).toMatchObject({
      environment: "local",
      items: [{ classification: "new_concept" }],
    });
  });

  test("requires every exact diff set and safe category counts", () => {
    expect(() => parseFoundationReleaseDiffReport(diffReport({
      exact_set_fingerprints: { new_concept: hashA },
    }))).toThrow(/fields must be exact/);
    expect(() => parseFoundationReleaseDiffReport(diffReport({
      category_counts: { synthetic_new_concept: Number.MAX_SAFE_INTEGER + 1 },
    }))).toThrow(/safe integer/);
  });

  test("enforces reconciliation directionality and self-relation rules", () => {
    expect(parseFoundationReconciliationDecision(reconciliation()))
      .toMatchObject({ relationship_direction: "none", decision_type: "archive" });
    expect(() => parseFoundationReconciliationDecision(reconciliation({
      relationship_direction: "none",
      items: [reconciliationItem({
        related_source_record_id: syntheticLifecycleIds.noNdbRecord,
      })],
    }))).toThrow(/none relationship/);
    expect(() => reconciliationItem({
      related_source_record_id: syntheticLifecycleIds.baselineRecord,
    }) && parseFoundationReconciliationDecision(reconciliation({
      relationship_direction: "directed",
      items: [reconciliationItem({
        related_source_record_id: syntheticLifecycleIds.baselineRecord,
      })],
    }))).toThrow(/cannot target itself/);
  });

  test("rejects expired decisions and invalid enums", () => {
    expect(() => parseFoundationReconciliationDecision(reconciliation({
      expires_at: "2026-07-18T00:00:00Z",
    }))).toThrow(/expired/);
    expect(() => parseFoundationReconciliationDecision(reconciliation({
      decision_type: "merge_public_uuids",
    }))).toThrow(/unsupported/);
  });

  test("requires exact nonempty allowance sets and rejects duplicates", () => {
    expect(parseFoundationLifecycleAllowance(allowance())).toMatchObject({
      allowance_type: "missing_set",
      exact_item_fingerprints: [hashB],
    });
    expect(() => parseFoundationLifecycleAllowance(allowance({
      exact_item_fingerprints: [],
    }))).toThrow(/bounded array/);
    expect(() => parseFoundationLifecycleAllowance(allowance({
      exact_item_fingerprints: [hashA, hashA],
    }))).toThrow(/duplicates/);
  });

  test("preserves explicit zero separately from missing", () => {
    const parsed = parseFoundationFoodProjection(syntheticBaselineFoodProjection);
    expect(parsed.nutrients.find((item) => item.nutrient_code === "protein_g"))
      .toMatchObject({ projection_state: "present", amount: 0, source_semantic: "explicit_zero" });
    expect(parsed.nutrients.find((item) => item.nutrient_code === "fat_g"))
      .toMatchObject({ projection_state: "missing", amount: null });
    expect(() => parseFoundationNutrientProjection({
      ...syntheticBaselineFoodProjection.nutrients[3],
      amount: 0,
    })).toThrow(/cannot contain a value/);
  });

  test("rejects unsafe numeric states and missing nutrient fields", () => {
    expect(() => parseFoundationNutrientProjection({
      ...syntheticBaselineFoodProjection.nutrients[0],
      amount: Number.NaN,
    })).toThrow(/nonnegative/);
    const missing = { ...syntheticBaselineFoodProjection.nutrients[0] } as Record<string, unknown>;
    delete missing.source_unit;
    expect(() => parseFoundationNutrientProjection(missing)).toThrow(/fields must be exact/);
  });

  test("orders food nutrients and dataset foods deterministically", () => {
    const reorderedFood = {
      ...syntheticBaselineFoodProjection,
      nutrients: [...syntheticBaselineFoodProjection.nutrients].reverse(),
    };
    expect(fingerprintFoundationFoodProjection(reorderedFood)).toBe(
      fingerprintFoundationFoodProjection(syntheticBaselineFoodProjection),
    );
    const reorderedDataset = {
      ...syntheticDatasetProjection,
      foods: [...syntheticDatasetProjection.foods].reverse(),
    };
    expect(fingerprintFoundationDatasetProjection(reorderedDataset)).toBe(
      fingerprintFoundationDatasetProjection(syntheticDatasetProjection),
    );
    expect(parseFoundationDatasetProjection(reorderedDataset).foods[0].food_id)
      .toBe(syntheticLifecycleIds.baselineFood);
  });

  test("rejects duplicate food and nutrient identities", () => {
    expect(() => parseFoundationDatasetProjection({
      ...syntheticDatasetProjection,
      foods: [syntheticDatasetProjection.foods[0], syntheticDatasetProjection.foods[0]],
    })).toThrow(/duplicate foods/);
    expect(() => parseFoundationFoodProjection({
      ...syntheticBaselineFoodProjection,
      nutrients: [
        syntheticBaselineFoodProjection.nutrients[0],
        syntheticBaselineFoodProjection.nutrients[0],
        syntheticBaselineFoodProjection.nutrients[1],
        syntheticBaselineFoodProjection.nutrients[2],
      ],
    })).toThrow(/distinct target nutrients/);
  });

  test("validates bootstrap result arithmetic and safe counts", () => {
    expect(parseFoundationBaselineBootstrapResult(syntheticBootstrapResult))
      .toEqual(syntheticBootstrapResult);
    expect(() => parseFoundationBaselineBootstrapResult({
      ...syntheticBootstrapResult,
      food_count: Number.MAX_SAFE_INTEGER + 1,
    })).toThrow(/safe integer/);
    expect(() => parseFoundationBaselineBootstrapResult({
      ...syntheticBootstrapResult,
      missing_nutrient_count: 3,
    })).toThrow(/inconsistent/);
  });

  test("validates exact lifecycle validation, approval, and update receipts", () => {
    expect(parseFoundationLifecycleValidationReceipt(receiptContract(
      foundationLifecycleValidationReceiptContractVersion,
      "validation_fingerprint",
    ))).toMatchObject({ environment: "local" });
    expect(parseFoundationLifecycleUpdateReceipt(receiptContract(
      foundationLifecycleUpdateReceiptContractVersion,
      "receipt_fingerprint",
    ))).toMatchObject({ environment: "local" });
    expect(parseFoundationLifecycleUpdateApproval(updateApproval())).toMatchObject({
      environment: "local",
      approver_identity: "Synthetic lifecycle approver",
    });
    expect(() => parseFoundationLifecycleUpdateApproval({
      ...updateApproval(),
      unexpected: true,
    })).toThrow(/fields must be exact/);
  });

  test("produces stable exact-duplicate fingerprints and detects conflicts", () => {
    const first = allowance();
    const duplicate = allowance();
    const conflict = allowance({ allowed_lifecycle_action: "keep_active" });
    expect(first.contract_fingerprint).toBe(duplicate.contract_fingerprint);
    expect(conflict.contract_fingerprint).not.toBe(first.contract_fingerprint);
  });

  test("matches the canonical golden body and fingerprint", () => {
    const body = {
      contract_version: "foundation-golden/v1",
      explicit_zero: 0,
      missing: null,
      nested: { z: "last", a: "first" },
    } as const;
    expect(canonicalizeContract(body)).toBe(
      '{"contract_version":"foundation-golden/v1","explicit_zero":0,"missing":null,"nested":{"a":"first","z":"last"}}',
    );
    expect(fingerprintContractBody(body)).toBe(
      "0da3f8e059372ef0af67ec3d66a4af87a21c3730790193c82dbe352b67533b90",
    );
  });

  test("keeps fixtures synthetic, bounded, and complete for Phase 10E.3", () => {
    expect(syntheticLifecycleCases).toHaveLength(21);
    expect(syntheticLifecycleCaseSetFingerprint).toMatch(/^[a-f0-9]{64}$/);
    expect(JSON.stringify({
      syntheticBaselineFoodProjection,
      syntheticNoNdbFoodProjection,
      syntheticReleaseScopeEvidence,
    })).not.toMatch(/USDA|FoodData|FoundationFoods|ndbNumber|fdcId/);
  });
});
