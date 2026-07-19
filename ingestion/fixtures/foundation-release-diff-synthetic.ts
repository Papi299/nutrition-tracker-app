import {
  foundationLifecyclePolicyVersion,
  foundationReconciliationDecisionContractVersion,
  foundationReleaseDiffContractVersion,
  foundationReleaseScopeContractVersion,
} from "../contracts/foundation-lifecycle.ts";
import { fingerprintJson, type JsonValue } from "../usda/foundation/canonical-json.ts";
import {
  foundationCandidateContractVersion,
  foundationImporterContractVersion,
  foundationRejectPolicyVersion,
  foundationSchemaContractVersion,
} from "../usda/foundation/contract.ts";
import {
  foundationNutrientMappingHash,
  foundationNutrientMappingVersion,
} from "../usda/foundation/nutrient-mapping.ts";
import {
  candidateProjection,
  candidateSourceMetadataFingerprint,
} from "../usda/foundation/lifecycle/projection.ts";
import type {
  FoundationLifecycleCandidate,
  FoundationLifecycleDiffInput,
  FoundationLifecycleNutrientProjection,
} from "../usda/foundation/lifecycle/types.ts";
import type {
  FoundationNormalizedCandidate,
  FoundationNutrientProjection,
} from "../usda/foundation/normalization.ts";

export const syntheticReleaseDiffIds = {
  dataset: "30000000-0000-4000-8000-000000000001",
  priorRelease: "30000000-0000-4000-8000-000000000002",
  newRelease: "30000000-0000-4000-8000-000000000003",
  priorHead: "30000000-0000-4000-8000-000000000004",
  scopeEvidence: "30000000-0000-4000-8000-000000000005",
  importRun: "30000000-0000-4000-8000-000000000006",
  food: "30000000-0000-4000-8000-000000000007",
  sourceRecord: "30000000-0000-4000-8000-000000000008",
  sourceVersion: "30000000-0000-4000-8000-000000000009",
} as const;

const hashes = {
  priorRelease: "1".repeat(64),
  newRelease: "2".repeat(64),
  priorHead: "3".repeat(64),
  scope: "4".repeat(64),
  raw: "5".repeat(64),
} as const;

function nutrient(
  code: "energy_kcal" | "protein_g" | "carbohydrates_g" | "fat_g",
  value: string | null,
): FoundationNutrientProjection {
  const sourceIds = {
    energy_kcal: "2048",
    protein_g: "1003",
    carbohydrates_g: "1005",
    fat_g: "1004",
  } as const;
  const sourceUnit = code === "energy_kcal" ? "kcal" : "g";
  return value === null ? {
    application_nutrient_code: code,
    source_nutrient_id: null,
    source_unit: null,
    value: null,
    semantic: "missing",
    loq: null,
    derivation_code: null,
    derivation_description: null,
  } : {
    application_nutrient_code: code,
    source_nutrient_id: sourceIds[code],
    source_unit: sourceUnit,
    value,
    semantic: value === "0" ? "explicit_zero" : "source_reported",
    loq: null,
    derivation_code: null,
    derivation_description: null,
  };
}

const baseWithoutFingerprint = {
  candidate_contract_version: foundationCandidateContractVersion,
  dataset_code: "usda_fdc_foundation",
  schema_contract_version: foundationSchemaContractVersion,
  mapping_version: foundationNutrientMappingVersion,
  mapping_hash: foundationNutrientMappingHash,
  source_row_key: "fdc:2001",
  concept_key: "foundation:ndb:3001",
  concept_identity_status: "source_supplied",
  upstream_version_key: "fdc:2001",
  fdc_id: "2001",
  ndb_number: "3001",
  publication_date: "2026-04-01",
  data_type: "Foundation",
  food_class: "FinalFood",
  name: "Synthetic Lifecycle Alpha",
  locale: "en",
  food_type: "generic",
  brand: null,
  nutrient_basis: "per_100g",
  nutrients: {
    energy_kcal: nutrient("energy_kcal", "100"),
    protein_g: nutrient("protein_g", "5"),
    carbohydrates_g: nutrient("carbohydrates_g", "15"),
    fat_g: nutrient("fat_g", null),
  },
  energy_evidence: [nutrient("energy_kcal", "100")],
  selected_energy_method: "atwater_specific_2048",
  portion_candidates: [],
  source_metadata: {
    scientific_name: null,
    category: "Synthetic",
    is_historical_reference: false,
    input_food_count: 0,
    nutrient_conversion_factor_count: 0,
  },
  unsupported_nutrient_count: 0,
  warning_categories: [],
} as const;

function deepClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export function syntheticNormalizedCandidate(overrides: {
  source_row_key?: string;
  concept_key?: string | null;
  upstream_version_key?: string;
  fdc_id?: string;
  ndb_number?: string | null;
  name?: string;
  source_metadata?: FoundationNormalizedCandidate["source_metadata"];
  nutrients?: Partial<FoundationNormalizedCandidate["nutrients"]>;
  warning_categories?: FoundationNormalizedCandidate["warning_categories"];
} = {}): FoundationNormalizedCandidate {
  const body = deepClone(baseWithoutFingerprint) as Omit<
    FoundationNormalizedCandidate,
    "content_fingerprint"
  >;
  Object.assign(body, overrides);
  if (overrides.nutrients) body.nutrients = {
    ...deepClone(baseWithoutFingerprint.nutrients),
    ...overrides.nutrients,
  };
  if (body.concept_key === null) {
    body.concept_identity_status = "generate_on_first_promotion";
  }
  return {
    ...body,
    content_fingerprint: fingerprintJson(body as JsonValue),
  };
}

export function syntheticAcceptedCandidate(
  candidate = syntheticNormalizedCandidate(),
  overrides: Partial<FoundationLifecycleCandidate> = {},
): FoundationLifecycleCandidate {
  return {
    source_row_key: candidate.source_row_key,
    raw_payload_hash: hashes.raw,
    validation_status: "accepted",
    reject_category: null,
    normalized_candidate: candidate,
    possible_prior_source_record_ids: [],
    ...overrides,
  };
}

export function syntheticReleaseDiffInput(
  overrides: Partial<FoundationLifecycleDiffInput> = {},
): FoundationLifecycleDiffInput {
  const candidate = syntheticNormalizedCandidate();
  const projection = candidateProjection(candidate);
  const currentNutrients = projection.nutrients as readonly FoundationLifecycleNutrientProjection[];
  return {
    prior_release: { id: syntheticReleaseDiffIds.priorRelease, fingerprint: hashes.priorRelease },
    new_release: { id: syntheticReleaseDiffIds.newRelease, fingerprint: hashes.newRelease },
    prior_head: { id: syntheticReleaseDiffIds.priorHead, version: 1, fingerprint: hashes.priorHead },
    scope_evidence: {
      id: syntheticReleaseDiffIds.scopeEvidence,
      fingerprint: hashes.scope,
      classification: "unknown",
    },
    import_run_id: syntheticReleaseDiffIds.importRun,
    environment: "local",
    current_concepts: [{
      food_id: syntheticReleaseDiffIds.food,
      source_record_id: syntheticReleaseDiffIds.sourceRecord,
      source_record_version_id: syntheticReleaseDiffIds.sourceVersion,
      concept_key: candidate.concept_key!,
      upstream_version_key: candidate.upstream_version_key,
      raw_payload_hash: hashes.raw,
      normalized_candidate_hash: candidate.content_fingerprint,
      source_metadata_hash: candidateSourceMetadataFingerprint(candidate),
      lifecycle_state: "active",
      projection: { ...projection, nutrients: currentNutrients },
    }],
    candidates: [syntheticAcceptedCandidate(candidate)],
    reconciliation_decisions: [],
    allowances: [],
    contract_versions: {
      importer_contract_version: foundationImporterContractVersion,
      schema_contract_version: foundationSchemaContractVersion,
      mapping_version: foundationNutrientMappingVersion,
      mapping_hash: foundationNutrientMappingHash,
      parser_contract_version: foundationSchemaContractVersion,
      reject_policy_version: foundationRejectPolicyVersion,
      lifecycle_policy_version: foundationLifecyclePolicyVersion,
      scope_contract_version: foundationReleaseScopeContractVersion,
      reconciliation_contract_version:
        foundationReconciliationDecisionContractVersion,
      diff_contract_version: foundationReleaseDiffContractVersion,
    },
    ...overrides,
  };
}

export const syntheticReleaseDiffScenarioNames = [
  "byte_identical_unchanged",
  "semantically_unchanged_new_version",
  "source_only_metadata",
  "name_change",
  "nutrient_value_change",
  "nutrient_added",
  "nutrient_removed",
  "explicit_zero",
  "missing_nutrient",
  "new_concept",
  "complete_snapshot_missing",
  "partial_empty_missing",
  "unknown_empty_missing",
  "reactivation",
  "no_ndb_exact_continuity",
  "no_ndb_changed_fdc_manual",
  "duplicate_ndb_conflict",
  "conflicting_fdc_identity",
  "same_fdc_changed_raw_hash",
  "negative_target_rejected",
  "trace_blocked",
  "unsupported_unit",
  "warning_only",
  "multiple_warnings_one_record",
  "exact_reviewed_rejected_allowance",
  "deferred_missing_decision",
  "archive_decision",
  "scope_evidence_supersession",
  "reused_diff_item_across_reports",
  "reused_reconciliation_item_across_decisions",
  "two_source_versions_one_nutrient_projection",
] as const;

export const syntheticReleaseDiffScenarioFingerprint = fingerprintJson(
  syntheticReleaseDiffScenarioNames as unknown as JsonValue,
);
