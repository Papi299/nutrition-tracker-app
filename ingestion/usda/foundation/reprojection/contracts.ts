import { fingerprintJson, canonicalizeJson, type JsonValue } from "../canonical-json.ts";
import { parseNormalizedFoundationFull35Candidate, type Full35Candidate } from "../full35/normalization.ts";
import { full35Mapping, full35MappingHash } from "../full35/mapping.ts";
import type { ParsedFoundationRecord } from "../parser.ts";

export const reprojectionContracts = Object.freeze({
  projection: "foundation-lifecycle-projection/v2",
  diff: "foundation-mapping-reprojection-diff/v1",
  plan: "foundation-mapping-reprojection-plan/v1",
  approval: "foundation-mapping-reprojection-approval/v1",
  receipt: "foundation-mapping-reprojection-receipt/v1",
  compensation: "foundation-mapping-compensation/v1",
} as const);
type ObjectValue = { [key: string]: JsonValue };
export type MappingScopeFood = ObjectValue & {
  food_id: string; source_record_id: string; source_version_id: string; raw_hash: string;
  fdc_id: string; concept_key: string; prior_projection_id: string;
  prior_projection_contract: string; prior_projection_hash: string; prior_lifecycle_hash: string;
  food_head_version: number; metadata: ObjectValue; food_row: ObjectValue;
  prior_states: ObjectValue[]; public_rows: ObjectValue[];
};
export type MappingScopeSnapshot = {head: {id: string; version: number; fingerprint: string; source_release_id: string}; foods: MappingScopeFood[]};
export type MappingPresentState = ObjectValue & {
  nutrient_code: string; application_unit: string; projection_state: "present"; basis: "per_100g";
  amount: string; source_semantic: string; source_nutrient_id: string; source_unit: string;
  derivation_code: string | null; derivation_description: string | null; evidence_hash: string;
};
export type MappingMissingState = {nutrient_code: string; application_unit: string; projection_state: "missing"; missing_reason: string};
export type MappingState = MappingPresentState | MappingMissingState;
export type MappingPlanItem = {
  before: MappingScopeFood; candidate: Full35Candidate; raw_record: string;
  projection_body: ObjectValue; projection_hash: string; lifecycle_hash: string;
  additions: {food_id: string; state: MappingPresentState}[];
};
export type MappingPlan = {
  contract_version: string; operation_kind: "reprojection" | "compensation";
  dataset_id: string; environment: "local" | "production"; source_release_id: string;
  mapping_version_id: string; before_snapshot: MappingScopeSnapshot;
  operator_oid: number; operator_login: string;
  approval_requirements: {approver_oid: number; not_before: string; expires_at: string};
  implementation: {commit: string; tree: string; database_contract_hash: string; migrations: {filename: string; version: string; sha256: string}[]; contract_versions: ObjectValue};
  qualification: ObjectValue; recovery_requirements: ObjectValue;
  compensation_policy: "exact_inserted_rows_current_head_only/v1";
  rejected_receipt_id: string | null; items: MappingPlanItem[];
  counts: ObjectValue; diff: ObjectValue;
};
const compare = (a: string, b: string) => Buffer.compare(Buffer.from(a), Buffer.from(b));
export function mappingStates(candidate: Full35Candidate, compensate = false): MappingState[] {
  return full35Mapping.mappings.map<MappingState>((target): MappingState => {
    const code = target.application_nutrient_code;
    const source = candidate.nutrients[code];
    if (compensate && !["energy_kcal", "protein_g", "carbohydrates_g", "fat_g"].includes(code)) {
      return {nutrient_code: code, application_unit: source.application_unit, projection_state: "missing" as const,
        missing_reason: "compensated_to_before_image"};
    }
    if (source.semantic === "missing") return {nutrient_code: code, application_unit: source.application_unit,
      projection_state: "missing" as const, missing_reason: source.missing_reason!};
    const evidence = candidate.nutrient_evidence.find(e => e.evidence_hash === source.evidence_hash);
    if (!evidence || source.value === null) throw new Error("Unlinked present nutrient.");
    return {nutrient_code: code, application_unit: source.application_unit, projection_state: "present" as const,
      basis: "per_100g" as const, amount: source.value, source_semantic: source.semantic,
      source_nutrient_id: evidence.source_nutrient_id, source_unit: evidence.source_unit,
      derivation_code: evidence.derivation_code, derivation_description: evidence.derivation_description,
      evidence_hash: evidence.evidence_hash};
  }).sort((a, b) => compare(a.nutrient_code, b.nutrient_code));
}
export function mappingLifecycleHash(body: ObjectValue) {
  return fingerprintJson({contract_version: "foundation-mapping-lifecycle-envelope/v2",
    projection_hash: fingerprintJson(body), prior_projection: body.prior_projection});
}
export function proposedMappingProjection(food: MappingScopeFood, candidate: Full35Candidate,
  dataset: string, environment: string, mapping: string, compensate = false): ObjectValue {
  return {contract_version: reprojectionContracts.projection, dataset_id: dataset, environment,
    food_id: food.food_id, source_record_id: food.source_record_id, source_record_version_id: food.source_version_id,
    source_release_id: candidate.source_identity.source_release_id, mapping_version_id: mapping,
    mapping_hash: full35MappingHash, raw_record_hash: food.raw_hash, candidate_hash: candidate.content_fingerprint,
    evidence_set_hash: candidate.evidence_set_hash,
    prior_projection: {id: food.prior_projection_id, contract_version: food.prior_projection_contract,
      projection_hash: food.prior_projection_hash, lifecycle_projection_hash: food.prior_lifecycle_hash},
    food_metadata: food.metadata, operation_kind: compensate ? "compensation" : "reprojection",
    nutrient_states: mappingStates(candidate, compensate)};
}
export function buildMappingPlan(input: Omit<MappingPlan, "contract_version" | "items" | "counts" | "diff" | "compensation_policy"> & {
  records: readonly {candidate: Full35Candidate; record: ParsedFoundationRecord}[];
}): MappingPlan {
  const {records, ...bindings} = input;
  const compensate = input.operation_kind === "compensation";
  if (input.before_snapshot.foods.length !== 353 || records.length !== 353) throw new Error("Exact 353-food scope required.");
  const indexed = new Map(records.map(r => [r.candidate.record_identity.source_version_id, r]));
  if (indexed.size !== 353) throw new Error("Duplicate source version.");
  const foods = [...input.before_snapshot.foods].sort((a, b) => compare(a.food_id, b.food_id));
  if (new Set(foods.map(f => f.food_id)).size !== 353) throw new Error("Duplicate public food.");
  if (canonicalizeJson(foods) !== canonicalizeJson(input.before_snapshot.foods)) throw new Error("Food snapshot must use C UUID ordering.");
  let coreCount = 0, addedCount = 0, presentCount = 0;
  const items = foods.map(before => {
    const source = indexed.get(before.source_version_id);
    if (!source) throw new Error("Missing original source version.");
    const candidate = parseNormalizedFoundationFull35Candidate(source.candidate, source.record,
      source.candidate.source_identity, source.candidate.record_identity);
    if (candidate.record_identity.source_record_id !== before.source_record_id || candidate.record_identity.raw_content_sha256 !== before.raw_hash ||
      candidate.concept_key !== before.concept_key || candidate.fdc_id !== before.fdc_id || candidate.name !== before.metadata.name ||
      candidate.source_identity.source_release_id !== input.source_release_id || before.food_row.owner_user_id !== null ||
      before.food_row.is_public !== true || before.food_row.is_archived !== false) throw new Error("Original public/source identity mismatch.");
    const states = mappingStates(candidate, compensate);
    const additions: MappingPlanItem["additions"] = [];
    for (const state of states) {
      const row = before.public_rows.find(r => r.code === state.nutrient_code);
      const core = ["energy_kcal", "protein_g", "carbohydrates_g", "fat_g"].includes(state.nutrient_code);
      if (core) {
        const prior = before.prior_states.find(s => s.nutrient_code === state.nutrient_code);
        if (!prior || prior.projection_state !== state.projection_state || (state.projection_state === "present" &&
          ["amount", "source_semantic", "source_nutrient_id", "source_unit", "derivation_code", "derivation_description"].some(k => prior[k] !== state[k]))) {
          throw new Error("Core enrichment or replacement is forbidden.");
        }
        if ((row === undefined) !== (state.projection_state === "missing") || (row && state.projection_state === "present" &&
          (row.amount !== state.amount || row.basis !== "per_100g"))) throw new Error("Core public before-image mismatch.");
        if (row) coreCount++;
      } else if (!compensate && row) throw new Error("Additional public nutrient already exists.");
      if (state.projection_state === "present") {
        presentCount++;
        if (!compensate && !row) {additions.push({food_id: before.food_id, state}); addedCount++;}
      }
    }
    const projection_body = proposedMappingProjection(before, candidate, input.dataset_id, input.environment, input.mapping_version_id, compensate);
    return {before, candidate, raw_record: canonicalizeJson(source.record.raw as JsonValue), projection_body,
      projection_hash: fingerprintJson(projection_body), lifecycle_hash: mappingLifecycleHash(projection_body), additions};
  });
  if (coreCount !== 1199 || addedCount !== (compensate ? 0 : 5062) || presentCount !== (compensate ? 1199 : 6261)) {
    throw new Error("Exact 1199/5062/6261 value-level scope required.");
  }
  const additions = items.flatMap(i => i.additions);
  const publicRows = foods.flatMap(f => f.public_rows);
  const diff = {contract_version: reprojectionContracts.diff, before_hash: fingerprintJson(input.before_snapshot),
    public_tuple_set_hash: fingerprintJson(publicRows),
    core_tuple_set_hash: fingerprintJson(publicRows.filter(r => ["energy_kcal", "protein_g", "carbohydrates_g", "fat_g"].includes(String(r.code)))),
    metadata_preservation_hash: fingerprintJson(foods.map(f => Object.fromEntries(["food_id", "food_row", "metadata", "source_version_row", "source_record_row", "source_links", "portions", "aliases", "barcodes"].map(k => [k, f[k]])))),
    prior_evidence_set_hash: fingerprintJson(foods.map(f => ({food_id: f.food_id, prior_evidence_hash: f.prior_evidence_hash}))),
    proposed_projection_set_hash: fingerprintJson(items.map(i => ({food_id: i.before.food_id, projection_hash: i.projection_hash, lifecycle_hash: i.lifecycle_hash}))),
    proposed_evidence_set_hash: fingerprintJson(items.map(i => ({food_id: i.before.food_id, candidate_hash: i.candidate.content_fingerprint, evidence_set_hash: i.candidate.evidence_set_hash}))),
    accepted_record_set_hash: fingerprintJson([...items].sort((a,b) => Number(a.candidate.fdc_id)-Number(b.candidate.fdc_id)).map(i => ({record_identity: i.candidate.record_identity, candidate_hash: i.candidate.content_fingerprint, evidence_set_hash: i.candidate.evidence_set_hash}))),
    proposed_dataset_fingerprint: fingerprintJson({contract_version: "foundation-mapping-dataset-projection/v2", dataset_id: input.dataset_id,
      environment: input.environment, source_release_id: input.source_release_id, mapping_version_id: input.mapping_version_id, mapping_hash: full35MappingHash,
      foods: items.map(i => ({food_id: i.before.food_id, projection_contract_version: reprojectionContracts.projection, lifecycle_projection_hash: i.lifecycle_hash, lifecycle_state: "active"}))}),
    additions, additions_hash: fingerprintJson(additions)};
  return {...bindings, contract_version: compensate ? reprojectionContracts.compensation : reprojectionContracts.plan,
    compensation_policy: "exact_inserted_rows_current_head_only/v1", items,
    counts: {foods:353,source_versions_inserted:0,core_rows_preserved:1199,inserted_rows:compensate?0:5062,
      deleted_rows:compensate?5062:0,present_states:compensate?1199:6261,missing_states:compensate?11156:6094,states:12355},
    diff};
}
export const fingerprintMappingPlan = (plan: MappingPlan) => fingerprintJson(plan as unknown as JsonValue);

export const serializeMappingPlan = (plan: MappingPlan) => canonicalizeJson(plan as unknown as JsonValue);


// Database-generated immutable result shapes. Actor/retry metadata is also
// constrained by typed plan/approval/receipt foreign keys in the database.
export type MappingApproval = ObjectValue & {
  contract_version: typeof reprojectionContracts.approval | typeof reprojectionContracts.compensation;
  plan_hash: string; dataset_id: string; environment: "local" | "production";
  source_release_id: string; mapping_version_id: string; prior_head_id: string;
  operator_oid: number; approver_oid: number; expires_at: string;
  evidence: {independent_review_hash: string; recovery_evidence_hash: string; approval_reference: string};
};
export type MappingReceipt = ObjectValue & {
  contract_version: typeof reprojectionContracts.receipt | typeof reprojectionContracts.compensation;
  receipt_id: string; operation_kind: "reprojection" | "compensation";
  plan_id: string; plan_hash: string; approval_id: string; approval_hash: string;
  operator_oid: number; retry_token: string; dataset_id: string; environment: "local" | "production";
  source_release_id: string; prior_head_id: string; resulting_head_id: string;
  resulting_head_version: number; resulting_head_fingerprint: string; counts: ObjectValue;
  rejected_receipt_id: string | null; public_row_identity_set_hash: string; completed_at: string;
};
