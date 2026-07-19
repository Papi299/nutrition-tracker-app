import {
  attachContractFingerprint,
  foundationDatasetProjectionContractVersion,
  foundationFoodProjectionContractVersion,
  foundationNutrientProjectionContractVersion,
  foundationReleaseScopeContractVersion,
  fingerprintFoundationFoodProjection,
  type FoundationBaselineBootstrapResult,
} from "../contracts/foundation-lifecycle.ts";
import { fingerprintJson, type JsonValue } from "../usda/foundation/canonical-json.ts";

export const syntheticLifecycleIds = {
  dataset: "10000000-0000-4000-8000-000000000001",
  baselineRelease: "10000000-0000-4000-8000-000000000002",
  updateRelease: "10000000-0000-4000-8000-000000000003",
  datasetHead: "10000000-0000-4000-8000-000000000004",
  baselineFood: "10000000-0000-4000-8000-000000000005",
  baselineRecord: "10000000-0000-4000-8000-000000000006",
  baselineVersion: "10000000-0000-4000-8000-000000000007",
  noNdbFood: "10000000-0000-4000-8000-000000000008",
  noNdbRecord: "10000000-0000-4000-8000-000000000009",
  noNdbVersion: "10000000-0000-4000-8000-00000000000a",
} as const;

function nutrient(
  nutrientCode: "energy_kcal" | "protein_g" | "carbohydrates_g" | "fat_g",
  amount: number | null,
) {
  return amount === null
    ? {
        contract_version: foundationNutrientProjectionContractVersion,
        nutrient_code: nutrientCode,
        projection_state: "missing",
        basis: null,
        amount: null,
        source_semantic: null,
        source_nutrient_id: null,
        source_unit: null,
        derivation_code: null,
        derivation_description: null,
      }
    : {
        contract_version: foundationNutrientProjectionContractVersion,
        nutrient_code: nutrientCode,
        projection_state: "present",
        basis: "per_100g",
        amount,
        source_semantic: amount === 0 ? "explicit_zero" : "source_reported",
        source_nutrient_id: `synthetic-${nutrientCode}`,
        source_unit: nutrientCode === "energy_kcal" ? "kcal" : "g",
        derivation_code: null,
        derivation_description: null,
      };
}

export const syntheticBaselineFoodProjection = {
  contract_version: foundationFoodProjectionContractVersion,
  food_id: syntheticLifecycleIds.baselineFood,
  source_record_id: syntheticLifecycleIds.baselineRecord,
  source_record_version_id: syntheticLifecycleIds.baselineVersion,
  name: "Synthetic Alpha Food",
  brand_name: null,
  locale: "en",
  food_type: "generic",
  data_quality: "imported",
  is_public: true,
  is_archived: false,
  serving_size: null,
  serving_unit: null,
  nutrients: [
    nutrient("energy_kcal", 120),
    nutrient("protein_g", 0),
    nutrient("carbohydrates_g", 18),
    nutrient("fat_g", null),
  ],
} as const;

export const syntheticNoNdbFoodProjection = {
  ...syntheticBaselineFoodProjection,
  food_id: syntheticLifecycleIds.noNdbFood,
  source_record_id: syntheticLifecycleIds.noNdbRecord,
  source_record_version_id: syntheticLifecycleIds.noNdbVersion,
  name: "Synthetic Beta Food",
} as const;

export const syntheticDatasetProjection = {
  contract_version: foundationDatasetProjectionContractVersion,
  dataset_id: syntheticLifecycleIds.dataset,
  environment: "local",
  source_release_id: syntheticLifecycleIds.baselineRelease,
  foods: [
    {
      food_id: syntheticLifecycleIds.noNdbFood,
      projection_hash: fingerprintFoundationFoodProjection(
        syntheticNoNdbFoodProjection,
      ),
    },
    {
      food_id: syntheticLifecycleIds.baselineFood,
      projection_hash: fingerprintFoundationFoodProjection(
        syntheticBaselineFoodProjection,
      ),
    },
  ],
} as const;

export const syntheticReleaseScopeEvidence = attachContractFingerprint({
  contract_version: foundationReleaseScopeContractVersion,
  source_release_id: syntheticLifecycleIds.updateRelease,
  dataset_id: syntheticLifecycleIds.dataset,
  artifact_kind: "official_bulk_archive",
  scope_classification: "unknown",
  manifest_fingerprint: "1".repeat(64),
  archive_sha256: "2".repeat(64),
  evidence_references: ["synthetic-fixture:scope-review"],
  environment: "local",
  reviewer_identity: "Synthetic lifecycle reviewer",
  approval_reference: "synthetic-lifecycle-scope-approval",
  approval_timestamp: "2026-07-19T00:00:00Z",
  expires_at: "2026-08-19T00:00:00Z",
  supersedes_scope_evidence_id: null,
} as const);

export const syntheticLifecycleCases = [
  "ndb_backed_baseline_concept",
  "no_ndb_baseline_concept",
  "exact_unchanged_version",
  "new_version_unchanged_projection",
  "projection_changing_nutrient",
  "added_nutrient",
  "removed_nutrient",
  "explicit_zero",
  "missing_nutrient",
  "new_concept",
  "missing_prior_concept",
  "archive_decision",
  "deferred_missing_decision",
  "reactivation",
  "no_ndb_manual_reconciliation",
  "duplicate_ndb_conflict",
  "fdc_hash_collision",
  "negative_selected_target",
  "trace_blocked_target",
  "unsupported_unit",
  "warning_only_record",
] as const;

export const syntheticLifecycleCaseSetFingerprint = fingerprintJson(
  [...syntheticLifecycleCases].sort() as JsonValue,
);

export const syntheticBootstrapResult: FoundationBaselineBootstrapResult = {
  dataset_projection_head_id: syntheticLifecycleIds.datasetHead,
  dataset_projection_fingerprint: fingerprintJson(
    syntheticDatasetProjection as JsonValue,
  ),
  food_count: 2,
  present_nutrient_count: 6,
  missing_nutrient_count: 2,
  evidence_link_count: 6,
  exact_retry: false,
};
