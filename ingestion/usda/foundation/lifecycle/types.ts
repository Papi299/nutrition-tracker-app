import type { FoundationNormalizedCandidate } from "../normalization.ts";

export const foundationPrimaryDiffClassifications = [
  "new_concept",
  "byte_identical_unchanged",
  "semantically_unchanged_new_version",
  "source_only_metadata",
  "projection_changing",
  "reactivation",
  "rejected",
  "identity_conflict",
  "manual_reconciliation_required",
  "trace_blocked",
  "unsupported",
] as const;

export const foundationDerivedDiffClassifications = [
  "new_version",
  "missing_prior_concept",
  "warning",
] as const;

export const foundationLifecycleNutrientCodes = [
  "carbohydrates_g",
  "energy_kcal",
  "fat_g",
  "protein_g",
] as const;

export type FoundationPrimaryDiffClassification =
  (typeof foundationPrimaryDiffClassifications)[number];
export type FoundationDerivedDiffClassification =
  (typeof foundationDerivedDiffClassifications)[number];
export type FoundationLifecycleDiffClassification =
  | FoundationPrimaryDiffClassification
  | FoundationDerivedDiffClassification;
export type FoundationLifecycleEnvironment = "local" | "production";
export type FoundationReleaseScopeClassification =
  | "complete_snapshot"
  | "partial"
  | "unknown";
export type FoundationLifecycleState =
  | "active"
  | "missing_pending"
  | "archived"
  | "superseded";

export type FoundationLifecycleNutrientProjection = {
  nutrient_code: (typeof foundationLifecycleNutrientCodes)[number];
  projection_state: "present" | "missing";
  basis: "per_100g" | null;
  amount: number | null;
  source_semantic:
    | "source_reported"
    | "source_calculated"
    | "explicit_zero"
    | null;
  source_nutrient_id: string | null;
  source_unit: string | null;
  derivation_code: string | null;
  derivation_description: string | null;
};

export type FoundationLifecycleProjection = {
  contract_version: "foundation-lifecycle-projection/v1";
  name: string;
  brand_name: null;
  locale: "en";
  food_type: "generic";
  data_quality: "imported";
  is_public: true;
  is_archived: boolean;
  serving_size: null;
  serving_unit: null;
  nutrients: readonly FoundationLifecycleNutrientProjection[];
};

export type FoundationCurrentConcept = {
  food_id: string;
  source_record_id: string;
  source_record_version_id: string;
  concept_key: string;
  upstream_version_key: string;
  raw_payload_hash: string;
  normalized_candidate_hash: string | null;
  source_metadata_hash: string | null;
  lifecycle_state: FoundationLifecycleState;
  projection: FoundationLifecycleProjection;
};

export type FoundationLifecycleCandidate = {
  source_row_key: string;
  raw_payload_hash: string;
  validation_status: "accepted" | "rejected";
  reject_category: string | null;
  normalized_candidate: FoundationNormalizedCandidate | null;
  possible_prior_source_record_ids: readonly string[];
};

export type FoundationLifecycleReconciliation = {
  source_row_key: string;
  prior_source_record_id: string;
  decision_type: "equivalent_identity_confirmed";
  decision_fingerprint: string;
};

export type FoundationLifecycleAllowance = {
  classification: "rejected" | "trace_blocked" | "unsupported";
  exact_set_fingerprint: string;
  exact_item_fingerprints: readonly string[];
  expires_at: string;
};

export type FoundationLifecycleDiffInput = {
  prior_release: { id: string; fingerprint: string };
  new_release: { id: string; fingerprint: string };
  prior_head: {
    id: string;
    version: number;
    fingerprint: string;
  };
  scope_evidence: {
    id: string;
    fingerprint: string;
    classification: FoundationReleaseScopeClassification;
  };
  import_run_id: string;
  environment: FoundationLifecycleEnvironment;
  current_concepts: readonly FoundationCurrentConcept[];
  candidates: readonly FoundationLifecycleCandidate[];
  reconciliation_decisions: readonly FoundationLifecycleReconciliation[];
  allowances: readonly FoundationLifecycleAllowance[];
  contract_versions: {
    importer_contract_version: string;
    schema_contract_version: string;
    mapping_version: string;
    mapping_hash: string;
    parser_contract_version: string;
    reject_policy_version: string;
    lifecycle_policy_version: "foundation-lifecycle-policy/v1";
    scope_contract_version: "foundation-release-scope/v1";
    reconciliation_contract_version: "foundation-reconciliation-decision/v1";
    diff_contract_version: "foundation-release-diff/v1";
  };
};

export type FoundationLifecycleDiffItem = {
  source_row_key: string | null;
  concept_key: string | null;
  upstream_version_key: string | null;
  raw_payload_hash: string | null;
  normalized_candidate_hash: string | null;
  prior_source_version_hash: string | null;
  prior_public_projection_hash: string | null;
  proposed_public_projection_hash: string | null;
  classification: FoundationLifecycleDiffClassification;
  reason_category: string | null;
  reconciliation_decision_fingerprint: string | null;
  set_ordinal: number;
  item_fingerprint: string;
};

export type FoundationLifecycleDiffReport = {
  contract_version: "foundation-release-diff/v1";
  import_run_id: string;
  prior_source_release_id: string;
  prior_source_release_fingerprint: string;
  new_source_release_id: string;
  new_source_release_fingerprint: string;
  prior_dataset_projection_head_id: string;
  prior_dataset_projection_head_version: number;
  prior_dataset_projection_fingerprint: string;
  release_scope_evidence_id: string;
  release_scope_evidence_fingerprint: string;
  environment: FoundationLifecycleEnvironment;
  items: readonly FoundationLifecycleDiffItem[];
  exact_set_fingerprints: Record<FoundationLifecycleDiffClassification, string>;
  exact_set_counts: Record<FoundationLifecycleDiffClassification, number>;
  category_counts: Record<string, number>;
  before_projection_fingerprint: string;
  proposed_projection_fingerprint: string;
  contract_versions: FoundationLifecycleDiffInput["contract_versions"];
  report_fingerprint: string;
};

export const foundationLifecycleExecutionActions = [
  "insert_new_concept",
  "no_op_byte_identical",
  "advance_source_version_reuse_projection",
  "append_source_metadata_reuse_projection",
  "replace_current_projection",
  "keep_active_pending_investigation",
  "mark_missing_pending",
  "archive",
  "supersede",
  "reactivate",
  "exclude_rejected",
  "exclude_trace_blocked",
  "exclude_unsupported",
] as const;

export type FoundationLifecycleExecutionAction =
  (typeof foundationLifecycleExecutionActions)[number];

export type FoundationMissingDecision =
  | "keep_active_pending_investigation"
  | "defer"
  | "archive"
  | "supersede"
  | "source_anomaly";

export type FoundationFinalProjectionEntry = {
  food_id: string;
  lifecycle_projection_hash: string;
  lifecycle_state: FoundationLifecycleState;
};
