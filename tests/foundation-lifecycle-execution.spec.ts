import { expect, test } from "@playwright/test";
import {
  attachContractFingerprint,
  foundationApplicationFoodIdentityReservationContractVersion,
  foundationLifecycleExecutionActions,
  foundationLifecycleExecutionPlanContractVersion,
  foundationLifecycleExecutionPlanItemContractVersion,
  foundationLifecycleUpdateApprovalV2ContractVersion,
  foundationLifecycleUpdateReceiptV2ContractVersion,
  parseFoundationApplicationFoodIdentityReservation,
  parseFoundationLifecycleExecutionPlan,
  parseFoundationLifecycleExecutionPlanItem,
  parseFoundationLifecycleExecutionResult,
  parseFoundationLifecycleReceiptLookupResult,
  parseFoundationLifecycleUpdateApprovalV2,
  parseFoundationLifecycleUpdateReceiptV2,
} from "@/ingestion/contracts/foundation-lifecycle";
import { fingerprintJson, type JsonValue } from "@/ingestion/usda/foundation/canonical-json";
import {
  deriveFoundationLifecycleAction,
  fingerprintFoundationFinalProjection,
} from "@/ingestion/usda/foundation/lifecycle/execution";

const ids = Array.from({ length: 20 }, (_, index) =>
  `40000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
);
const hashA = "a".repeat(64);
const hashB = "b".repeat(64);

function item(overrides: Record<string, JsonValue> = {}) {
  const body = {
    contract_version: foundationLifecycleExecutionPlanItemContractVersion,
    action_ordinal: 1,
    release_diff_item_fingerprint: hashA,
    source_row_key: "synthetic-row-1",
    concept_key: "foundation:synthetic-1",
    upstream_version_key: "synthetic-version-1",
    current_food_id: ids[0],
    reserved_food_id: null,
    current_source_record_id: ids[1],
    current_source_record_version_id: ids[2],
    current_food_projection_version_id: ids[3],
    proposed_lifecycle_projection_hash: hashB,
    proposed_source_record_version_hash: hashA,
    reconciliation_decision_fingerprint: null,
    allowance_fingerprint: null,
    lifecycle_action: "replace_current_projection",
    proposed_food_state: { name: "Synthetic food", is_archived: false },
    nutrient_states: ["energy_kcal", "protein_g", "carbohydrates_g", "fat_g"].map(
      (nutrient_code) => ({ nutrient_code, projection_state: "missing" }),
    ),
    portion_set_fingerprint: hashA,
    evidence_set_fingerprint: hashB,
    ...overrides,
  } as Record<string, JsonValue>;
  return { ...body, item_fingerprint: fingerprintJson(body) };
}

function plan() {
  const body = {
    contract_version: foundationLifecycleExecutionPlanContractVersion,
    import_run_id: ids[4],
    release_diff_report_id: ids[5],
    release_diff_report_fingerprint: hashA,
    validation_receipt_id: ids[6],
    validation_fingerprint: hashB,
    prior_source_release_id: ids[7],
    prior_source_release_fingerprint: hashA,
    new_source_release_id: ids[8],
    new_source_release_fingerprint: hashB,
    current_dataset_head_id: ids[9],
    current_dataset_head_version: 1,
    current_dataset_head_fingerprint: hashA,
    current_scope_evidence_id: ids[10],
    current_scope_evidence_fingerprint: hashB,
    decision_fingerprints: [],
    allowance_fingerprints: [],
    identity_reservation_fingerprints: [],
    action_item_fingerprints: [item().item_fingerprint],
    action_set_fingerprints: { replace_current_projection: hashA },
    action_counts: { replace_current_projection: 1 },
    diff_set_fingerprints: { projection_changing: hashB },
    diff_set_counts: { projection_changing: 1 },
    category_counts: { public_projection_changed: 1 },
    before_projection_fingerprint: hashA,
    after_projection_fingerprint: hashB,
    contract_versions: { execution_policy_version: "synthetic/v1" },
    environment: "local",
  } as Record<string, JsonValue>;
  return { ...body, plan_fingerprint: fingerprintJson(body) };
}

test.describe("Foundation lifecycle execution contracts", () => {
  test("derives every supported primary action and rejects unresolved evidence", () => {
    expect(deriveFoundationLifecycleAction({ classification: "new_concept" }))
      .toBe("insert_new_concept");
    expect(deriveFoundationLifecycleAction({ classification: "source_only_metadata" }))
      .toBe("append_source_metadata_reuse_projection");
    expect(deriveFoundationLifecycleAction({
      classification: "missing_prior_concept", missingDecision: "archive",
    })).toBe("archive");
    expect(deriveFoundationLifecycleAction({
      classification: "rejected", hasExactAllowance: true,
    })).toBe("exclude_rejected");
    expect(() => deriveFoundationLifecycleAction({ classification: "identity_conflict" }))
      .toThrow(/Blocked/);
    expect(() => deriveFoundationLifecycleAction({ classification: "warning" }))
      .toThrow(/not a lifecycle action/);
    expect(foundationLifecycleExecutionActions).toHaveLength(13);
  });

  test("fingerprints the final state by stable application UUID", () => {
    const input = {
      dataset_id: ids[11], environment: "local" as const,
      source_release_id: ids[12],
      foods: [
        { food_id: ids[1], lifecycle_projection_hash: hashB, lifecycle_state: "archived" as const },
        { food_id: ids[0], lifecycle_projection_hash: hashA, lifecycle_state: "active" as const },
      ],
    };
    expect(fingerprintFoundationFinalProjection(input)).toBe(
      fingerprintFoundationFinalProjection({ ...input, foods: [...input.foods].reverse() }),
    );
    expect(() => fingerprintFoundationFinalProjection({
      ...input, foods: [input.foods[0], input.foods[0]],
    })).toThrow(/duplicate/);
  });

  test("validates immutable reservation and execution-plan items", () => {
    const reservationBody = {
      contract_version: foundationApplicationFoodIdentityReservationContractVersion,
      dataset_id: ids[0], environment: "local", concept_key: "foundation:synthetic-new",
      source_release_id: ids[1], origin_import_run_id: ids[2], reserved_food_id: ids[3],
      created_at: "2026-07-19T12:00:00Z",
    } as const;
    const reservation = {
      ...reservationBody,
      reservation_fingerprint: fingerprintJson(reservationBody as JsonValue),
    };
    expect(parseFoundationApplicationFoodIdentityReservation(reservation))
      .toMatchObject({ reserved_food_id: ids[3], environment: "local" });
    expect(parseFoundationLifecycleExecutionPlanItem(item())).toMatchObject({
      lifecycle_action: "replace_current_projection", action_ordinal: 1,
    });
    expect(() => parseFoundationLifecycleExecutionPlanItem({ ...item(), unsafe: true }))
      .toThrow(/fields must be exact/);
  });

  test("validates plan, approval V2, receipt V2, and bounded results", () => {
    const parsedPlan = parseFoundationLifecycleExecutionPlan(plan());
    expect(parsedPlan).toMatchObject({ environment: "local", current_dataset_head_version: 1 });
    const approval = attachContractFingerprint({
      contract_version: foundationLifecycleUpdateApprovalV2ContractVersion,
      validation_receipt_id: ids[6], validation_fingerprint: hashB,
      execution_plan_id: ids[13], execution_plan_fingerprint: plan().plan_fingerprint,
      release_diff_report_fingerprint: hashA, prior_dataset_head_id: ids[9],
      prior_dataset_head_version: 1, prior_dataset_head_fingerprint: hashA,
      current_scope_evidence_fingerprint: hashB,
      decision_set_fingerprint: hashA, allowance_set_fingerprint: hashB,
      before_projection_fingerprint: hashA, after_projection_fingerprint: hashB,
      environment: "local", approver_identity: "Synthetic approver",
      approval_reference: "synthetic-v2", approval_timestamp: "2026-07-19T12:00:00Z",
      expires_at: "2026-07-20T12:00:00Z",
    });
    expect(parseFoundationLifecycleUpdateApprovalV2(approval))
      .toMatchObject({ execution_plan_id: ids[13] });

    const receiptBody = {
      contract_version: foundationLifecycleUpdateReceiptV2ContractVersion,
      approval_id: ids[0], approval_fingerprint: hashA,
      execution_plan_id: ids[1], execution_plan_fingerprint: hashB,
      validation_receipt_id: ids[2], validation_fingerprint: hashA,
      release_diff_report_id: ids[3], release_diff_report_fingerprint: hashB,
      import_run_id: ids[4], run_purpose: "release_update",
      prior_source_release_id: ids[5], prior_source_release_fingerprint: hashA,
      new_source_release_id: ids[6], new_source_release_fingerprint: hashB,
      prior_dataset_head_id: ids[7], prior_dataset_head_version: 1,
      prior_dataset_head_fingerprint: hashA, resulting_dataset_head_id: ids[8],
      resulting_dataset_head_version: 2, resulting_dataset_head_fingerprint: hashB,
      scope_evidence_fingerprint: hashA, decision_fingerprints: [],
      allowance_fingerprints: [], identity_reservation_fingerprints: [],
      diff_set_fingerprints: { projection_changing: hashA },
      action_set_fingerprints: { replace_current_projection: hashB },
      before_projection_fingerprint: hashA, after_projection_fingerprint: hashB,
      public_mutation_counts: { foods_inserted: 0, current_nutrients_updated: 1 },
      history_insertion_counts: { food_projection_versions_inserted: 1 },
      excluded_counts: { rejected: 0, trace_blocked: 0, unsupported: 0 },
      warning_count: 0, completion_timestamp: "2026-07-19T12:01:00Z",
      environment: "local",
    } as Record<string, JsonValue>;
    const receipt = { ...receiptBody, receipt_fingerprint: fingerprintJson(receiptBody) };
    expect(parseFoundationLifecycleUpdateReceiptV2(receipt))
      .toMatchObject({ resulting_dataset_head_version: 2 });
    const result = {
      status: "completed", receipt_id: ids[9], receipt_fingerprint: hashA,
      completion_timestamp: "2026-07-19T12:01:00Z",
      resulting_dataset_head_id: ids[8], resulting_dataset_head_version: 2,
      exact_retry: false,
    };
    expect(parseFoundationLifecycleExecutionResult(result)).toEqual(result);
    expect(parseFoundationLifecycleReceiptLookupResult({
      approval_id: ids[0], receipt_id: ids[9], receipt_fingerprint: hashA,
      completion_timestamp: "2026-07-19T12:01:00Z",
      resulting_dataset_head_id: ids[8], resulting_dataset_head_version: 2,
    })).toMatchObject({ approval_id: ids[0] });
    expect(parseFoundationLifecycleReceiptLookupResult(null)).toBeNull();
  });

  test("rejects V1 execution evidence and unsafe or changed V2 bodies", () => {
    expect(() => parseFoundationLifecycleUpdateApprovalV2({
      ...attachContractFingerprint({ contract_version: "foundation-lifecycle-update-approval/v1" }),
    })).toThrow(/fields must be exact|Unsupported/);
    expect(() => parseFoundationLifecycleExecutionPlan({
      ...plan(), after_projection_fingerprint: "changed",
    })).toThrow(/fingerprint|SHA-256/);
  });
});
