import {
  canonicalizeJson,
  fingerprintJson,
  isPlainObject,
  type JsonValue,
} from "../usda/foundation/canonical-json.ts";

export const foundationLifecyclePolicyVersion =
  "foundation-lifecycle-policy/v1" as const;
export const foundationReleaseScopeContractVersion =
  "foundation-release-scope/v1" as const;
export const foundationReleaseDiffContractVersion =
  "foundation-release-diff/v1" as const;
export const foundationReconciliationDecisionContractVersion =
  "foundation-reconciliation-decision/v1" as const;
export const foundationLifecycleAllowanceContractVersion =
  "foundation-lifecycle-allowance/v1" as const;
export const foundationFoodProjectionContractVersion =
  "foundation-food-projection/v1" as const;
export const foundationNutrientProjectionContractVersion =
  "foundation-nutrient-projection/v1" as const;
export const foundationDatasetProjectionContractVersion =
  "foundation-dataset-projection/v1" as const;
export const foundationLifecycleValidationReceiptContractVersion =
  "foundation-lifecycle-validation-receipt/v1" as const;
export const foundationLifecycleUpdateApprovalContractVersion =
  "foundation-lifecycle-update-approval/v1" as const;
export const foundationLifecycleUpdateReceiptContractVersion =
  "foundation-lifecycle-update-receipt/v1" as const;
export const foundationApplicationFoodIdentityReservationContractVersion =
  "foundation-application-food-identity-reservation/v1" as const;
export const foundationLifecycleExecutionPlanContractVersion =
  "foundation-lifecycle-execution-plan/v1" as const;
export const foundationLifecycleExecutionPlanItemContractVersion =
  "foundation-lifecycle-execution-plan-item/v1" as const;
export const foundationLifecycleUpdateApprovalV2ContractVersion =
  "foundation-lifecycle-update-approval/v2" as const;
export const foundationLifecycleUpdateReceiptV2ContractVersion =
  "foundation-lifecycle-update-receipt/v2" as const;
export const foundationLifecycleExecutionPolicyVersion =
  "foundation-lifecycle-execution-policy/v1" as const;

export const foundationLifecycleExecutionActions = [
  "insert_new_concept", "no_op_byte_identical",
  "advance_source_version_reuse_projection",
  "append_source_metadata_reuse_projection", "replace_current_projection",
  "keep_active_pending_investigation", "mark_missing_pending", "archive",
  "supersede", "reactivate", "exclude_rejected",
  "exclude_trace_blocked", "exclude_unsupported",
] as const;

export const foundationLifecycleRunPurposes = [
  "initial_promotion",
  "release_update",
  "mapping_reprojection",
  "parser_revalidation",
  "manual_reconciliation",
  "corrective_release",
] as const;

export const foundationDiffClassifications = [
  "new_concept",
  "new_version",
  "byte_identical_unchanged",
  "semantically_unchanged_new_version",
  "projection_changing",
  "source_only_metadata",
  "missing_prior_concept",
  "reactivation",
  "rejected",
  "warning",
  "identity_conflict",
  "manual_reconciliation_required",
  "trace_blocked",
  "unsupported",
] as const;

const hashPattern = /^[a-f0-9]{64}$/;
const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const timestampPattern =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?Z$/;

export class FoundationLifecycleContractError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FoundationLifecycleContractError";
  }
}

function fail(message: string): never {
  throw new FoundationLifecycleContractError(message);
}

function exactObject(
  value: unknown,
  fields: readonly string[],
  label: string,
  maximumBytes = 32_768,
) {
  if (!isPlainObject(value)) fail(`${label} must be a plain object.`);
  if (Buffer.byteLength(JSON.stringify(value), "utf8") > maximumBytes) {
    fail(`${label} exceeds its size bound.`);
  }
  if (
    JSON.stringify(Object.keys(value).sort()) !==
    JSON.stringify([...fields].sort())
  ) {
    fail(`${label} fields must be exact.`);
  }
  return value;
}

function text(value: unknown, label: string, maximum: number) {
  if (
    typeof value !== "string" ||
    value !== value.trim() ||
    value.length === 0 ||
    value.length > maximum
  ) {
    fail(`${label} must be bounded nonblank text.`);
  }
  return value;
}

function hash(value: unknown, label: string) {
  const parsed = text(value, label, 64);
  if (!hashPattern.test(parsed)) fail(`${label} must be a lowercase SHA-256.`);
  return parsed;
}

function uuid(value: unknown, label: string): string;
function uuid(value: unknown, label: string, nullable: true): string | null;
function uuid(value: unknown, label: string, nullable = false): string | null {
  if (nullable && value === null) return null;
  const parsed = text(value, label, 36);
  if (!uuidPattern.test(parsed)) fail(`${label} must be a lowercase UUID.`);
  return parsed;
}

function timestamp(value: unknown, label: string): string;
function timestamp(value: unknown, label: string, nullable: true): string | null;
function timestamp(value: unknown, label: string, nullable = false): string | null {
  if (nullable && value === null) return null;
  const parsed = text(value, label, 40);
  if (!timestampPattern.test(parsed) || Number.isNaN(Date.parse(parsed))) {
    fail(`${label} must be a valid UTC timestamp.`);
  }
  return parsed;
}

function count(value: unknown, label: string) {
  if (!Number.isSafeInteger(value) || (value as number) < 0) {
    fail(`${label} must be a nonnegative safe integer.`);
  }
  return value as number;
}

function enumValue<const T extends readonly string[]>(
  value: unknown,
  allowed: T,
  label: string,
): T[number] {
  if (typeof value !== "string" || !allowed.includes(value)) {
    fail(`${label} is unsupported.`);
  }
  return value as T[number];
}

function environment(value: unknown) {
  return enumValue(value, ["local", "production"] as const, "environment");
}

function exactStringArray(
  value: unknown,
  label: string,
  minimum: number,
  maximum: number,
  validator: (item: string) => boolean,
) {
  if (!Array.isArray(value) || value.length < minimum || value.length > maximum) {
    fail(`${label} must be a bounded array.`);
  }
  const result = value.map((item, index) => {
    const parsed = text(item, `${label}[${index}]`, 300);
    if (!validator(parsed)) fail(`${label}[${index}] is invalid.`);
    return parsed;
  });
  if (new Set(result).size !== result.length) fail(`${label} contains duplicates.`);
  return result;
}

function assertFingerprint(record: Record<string, unknown>) {
  const expected = fingerprintJson(
    Object.fromEntries(
      Object.entries(record).filter(([key]) => key !== "contract_fingerprint"),
    ) as JsonValue,
  );
  if (hash(record.contract_fingerprint, "contract_fingerprint") !== expected) {
    fail("Contract fingerprint does not match its canonical body.");
  }
  return expected;
}

export function fingerprintContractBody(
  body: Record<string, JsonValue>,
) {
  return fingerprintJson(body);
}

export function attachContractFingerprint<T extends Record<string, JsonValue>>(
  body: T,
): T & { contract_fingerprint: string } {
  return { ...body, contract_fingerprint: fingerprintContractBody(body) };
}

export function canonicalizeContract(input: Record<string, JsonValue>) {
  return canonicalizeJson(input);
}

const scopeFields = [
  "contract_version", "source_release_id", "dataset_id", "artifact_kind",
  "scope_classification", "manifest_fingerprint", "archive_sha256",
  "evidence_references", "environment", "reviewer_identity",
  "approval_reference", "approval_timestamp", "expires_at",
  "supersedes_scope_evidence_id", "contract_fingerprint",
] as const;

export function parseFoundationReleaseScopeEvidence(input: unknown) {
  const value = exactObject(input, scopeFields, "Release scope evidence", 8192);
  if (value.contract_version !== foundationReleaseScopeContractVersion) {
    fail("Unsupported release-scope contract version.");
  }
  const approvalTimestamp = timestamp(value.approval_timestamp, "approval_timestamp");
  const expiresAt = timestamp(value.expires_at, "expires_at", true);
  if (expiresAt && expiresAt <= approvalTimestamp) fail("Scope evidence is expired.");
  const evidenceReferences = exactStringArray(
    value.evidence_references,
    "evidence_references",
    1,
    16,
    (item) =>
      !/(password|secret|token|credential)/i.test(item) &&
      !/^https:\/\/[^/]*@/.test(item),
  );
  assertFingerprint(value);
  return {
    contract_version: foundationReleaseScopeContractVersion,
    source_release_id: uuid(value.source_release_id, "source_release_id"),
    dataset_id: uuid(value.dataset_id, "dataset_id"),
    artifact_kind: enumValue(
      value.artifact_kind,
      ["official_bulk_archive", "approved_transformed_archive"] as const,
      "artifact_kind",
    ),
    scope_classification: enumValue(
      value.scope_classification,
      ["complete_snapshot", "partial", "unknown"] as const,
      "scope_classification",
    ),
    manifest_fingerprint: hash(value.manifest_fingerprint, "manifest_fingerprint"),
    archive_sha256: hash(value.archive_sha256, "archive_sha256"),
    evidence_references: evidenceReferences,
    environment: environment(value.environment),
    reviewer_identity: text(value.reviewer_identity, "reviewer_identity", 160),
    approval_reference: text(value.approval_reference, "approval_reference", 200),
    approval_timestamp: approvalTimestamp,
    expires_at: expiresAt,
    supersedes_scope_evidence_id: uuid(
      value.supersedes_scope_evidence_id,
      "supersedes_scope_evidence_id",
      true,
    ),
    contract_fingerprint: value.contract_fingerprint as string,
  };
}

const diffItemFields = [
  "source_row_key", "concept_key", "upstream_version_key", "raw_payload_hash",
  "normalized_candidate_hash", "prior_source_version_hash",
  "prior_public_projection_hash", "proposed_public_projection_hash",
  "classification", "reason_category", "reconciliation_decision_fingerprint",
  "set_ordinal", "item_fingerprint",
] as const;

export function parseFoundationReleaseDiffItem(input: unknown) {
  const value = exactObject(input, diffItemFields, "Release diff item", 4096);
  const body = Object.fromEntries(
    Object.entries(value).filter(([key]) => key !== "item_fingerprint"),
  ) as JsonValue;
  if (hash(value.item_fingerprint, "item_fingerprint") !== fingerprintJson(body)) {
    fail("Diff-item fingerprint mismatch.");
  }
  const nullableText = (key: string, maximum: number) =>
    value[key] === null ? null : text(value[key], key, maximum);
  const nullableHash = (key: string) =>
    value[key] === null ? null : hash(value[key], key);
  const ordinal = count(value.set_ordinal, "set_ordinal");
  if (ordinal === 0) fail("set_ordinal must be positive.");
  return {
    source_row_key: nullableText("source_row_key", 200),
    concept_key: nullableText("concept_key", 200),
    upstream_version_key: nullableText("upstream_version_key", 200),
    raw_payload_hash: nullableHash("raw_payload_hash"),
    normalized_candidate_hash: nullableHash("normalized_candidate_hash"),
    prior_source_version_hash: nullableHash("prior_source_version_hash"),
    prior_public_projection_hash: nullableHash("prior_public_projection_hash"),
    proposed_public_projection_hash: nullableHash("proposed_public_projection_hash"),
    classification: enumValue(
      value.classification,
      foundationDiffClassifications,
      "classification",
    ),
    reason_category: nullableText("reason_category", 120),
    reconciliation_decision_fingerprint: nullableHash(
      "reconciliation_decision_fingerprint",
    ),
    set_ordinal: ordinal,
    item_fingerprint: value.item_fingerprint as string,
  };
}

const diffReportFields = [
  "contract_version", "import_run_id", "prior_source_release_id",
  "prior_source_release_fingerprint", "new_source_release_id",
  "new_source_release_fingerprint", "prior_dataset_projection_head_id",
  "prior_dataset_projection_head_version", "prior_dataset_projection_fingerprint",
  "release_scope_evidence_id", "release_scope_evidence_fingerprint",
  "environment", "items",
  "exact_set_fingerprints", "exact_set_counts", "category_counts",
  "before_projection_fingerprint", "proposed_projection_fingerprint",
  "contract_versions", "report_fingerprint",
] as const;

export function parseFoundationReleaseDiffReport(input: unknown) {
  const value = exactObject(input, diffReportFields, "Release diff report", 262_144);
  if (value.contract_version !== foundationReleaseDiffContractVersion) {
    fail("Unsupported release-diff contract version.");
  }
  if (!Array.isArray(value.items) || value.items.length > 10_000) {
    fail("Diff items must be a bounded array.");
  }
  const items = value.items.map(parseFoundationReleaseDiffItem);
  const ordinals = new Set(items.map((item) => `${item.classification}:${item.set_ordinal}`));
  if (ordinals.size !== items.length) fail("Diff ordinals must be unique per set.");
  const exactSetFingerprints = exactObject(
    value.exact_set_fingerprints,
    foundationDiffClassifications,
    "exact_set_fingerprints",
    8192,
  );
  const exactSetCounts = exactObject(
    value.exact_set_counts,
    foundationDiffClassifications,
    "exact_set_counts",
    8192,
  );
  for (const classification of foundationDiffClassifications) {
    hash(exactSetFingerprints[classification], classification);
    const expectedCount = items.filter(
      (item) => item.classification === classification,
    ).length;
    if (count(exactSetCounts[classification], classification) !== expectedCount) {
      fail(`Exact count mismatch for ${classification}.`);
    }
  }
  if (!isPlainObject(value.category_counts)) fail("category_counts must be an object.");
  for (const [key, item] of Object.entries(value.category_counts)) {
    if (!/^[a-z0-9][a-z0-9_:-]{0,119}$/.test(key)) {
      fail("category_counts contains an invalid category.");
    }
    count(item, key);
  }
  const contractVersions = exactObject(value.contract_versions, [
    "importer_contract_version", "schema_contract_version", "mapping_version",
    "mapping_hash", "parser_contract_version", "reject_policy_version",
    "diff_contract_version", "lifecycle_policy_version",
    "scope_contract_version", "reconciliation_contract_version",
  ], "contract_versions", 8192);
  for (const key of [
    "importer_contract_version", "schema_contract_version", "mapping_version",
    "parser_contract_version", "reject_policy_version",
    "diff_contract_version", "lifecycle_policy_version",
    "scope_contract_version", "reconciliation_contract_version",
  ] as const) text(contractVersions[key], key, 80);
  if (
    contractVersions.diff_contract_version !== foundationReleaseDiffContractVersion ||
    contractVersions.lifecycle_policy_version !== foundationLifecyclePolicyVersion ||
    contractVersions.scope_contract_version !== foundationReleaseScopeContractVersion ||
    contractVersions.reconciliation_contract_version !==
      foundationReconciliationDecisionContractVersion
  ) fail("Release-diff contract versions are inconsistent.");
  const primary = new Set([
    "new_concept", "byte_identical_unchanged",
    "semantically_unchanged_new_version", "source_only_metadata",
    "projection_changing", "reactivation", "rejected", "identity_conflict",
    "manual_reconciliation_required", "trace_blocked", "unsupported",
  ]);
  const acceptedPrimary = new Set([
    "new_concept", "byte_identical_unchanged",
    "semantically_unchanged_new_version", "source_only_metadata",
    "projection_changing", "reactivation",
  ]);
  const primaryByRow = new Map<string, string>();
  for (const item of items.filter((entry) => primary.has(entry.classification))) {
    if (item.source_row_key === null || primaryByRow.has(item.source_row_key)) {
      fail("Every source row requires exactly one primary classification.");
    }
    primaryByRow.set(item.source_row_key, item.classification);
  }
  for (const item of items) {
    if (item.classification === "warning" && (
      item.source_row_key === null ||
      !acceptedPrimary.has(primaryByRow.get(item.source_row_key) ?? "")
    )) fail("Warnings may overlap only accepted primary outcomes.");
    if (item.classification === "new_version" && (
      item.source_row_key === null ||
      !new Set([
        "semantically_unchanged_new_version", "source_only_metadata",
        "projection_changing",
      ]).has(primaryByRow.get(item.source_row_key) ?? "")
    )) fail("new_version has an invalid overlap.");
  }
  hash(contractVersions.mapping_hash, "mapping_hash");
  const reportBody = Object.fromEntries(
    Object.entries(value).filter(([key]) => key !== "report_fingerprint"),
  ) as JsonValue;
  if (hash(value.report_fingerprint, "report_fingerprint") !== fingerprintJson(reportBody)) {
    fail("Release-diff report fingerprint mismatch.");
  }
  return {
    ...value,
    import_run_id: uuid(value.import_run_id, "import_run_id"),
    prior_source_release_id: uuid(value.prior_source_release_id, "prior_source_release_id"),
    prior_source_release_fingerprint: hash(
      value.prior_source_release_fingerprint,
      "prior_source_release_fingerprint",
    ),
    new_source_release_id: uuid(value.new_source_release_id, "new_source_release_id"),
    new_source_release_fingerprint: hash(
      value.new_source_release_fingerprint,
      "new_source_release_fingerprint",
    ),
    prior_dataset_projection_head_id: uuid(
      value.prior_dataset_projection_head_id,
      "prior_dataset_projection_head_id",
    ),
    prior_dataset_projection_head_version: count(
      value.prior_dataset_projection_head_version,
      "prior_dataset_projection_head_version",
    ),
    release_scope_evidence_id: uuid(
      value.release_scope_evidence_id,
      "release_scope_evidence_id",
    ),
    release_scope_evidence_fingerprint: hash(
      value.release_scope_evidence_fingerprint,
      "release_scope_evidence_fingerprint",
    ),
    prior_dataset_projection_fingerprint: hash(
      value.prior_dataset_projection_fingerprint,
      "prior_dataset_projection_fingerprint",
    ),
    environment: environment(value.environment),
    before_projection_fingerprint: hash(
      value.before_projection_fingerprint,
      "before_projection_fingerprint",
    ),
    proposed_projection_fingerprint: hash(
      value.proposed_projection_fingerprint,
      "proposed_projection_fingerprint",
    ),
    items,
  };
}

const reconciliationItemFields = [
  "source_record_id", "source_record_version_id", "related_source_record_id",
  "food_id", "diff_item_fingerprint", "item_fingerprint",
] as const;

export function parseFoundationReconciliationItem(input: unknown) {
  const value = exactObject(input, reconciliationItemFields, "Reconciliation item", 2048);
  const expected = fingerprintJson(Object.fromEntries(
    Object.entries(value).filter(([key]) => key !== "item_fingerprint"),
  ) as JsonValue);
  if (hash(value.item_fingerprint, "item_fingerprint") !== expected) {
    fail("Reconciliation-item fingerprint mismatch.");
  }
  const sourceRecordId = uuid(value.source_record_id, "source_record_id", true);
  const relatedSourceRecordId = uuid(
    value.related_source_record_id,
    "related_source_record_id",
    true,
  );
  const foodId = uuid(value.food_id, "food_id", true);
  if (!sourceRecordId && !foodId) fail("A reconciliation item needs an identity.");
  if (sourceRecordId && sourceRecordId === relatedSourceRecordId) {
    fail("A reconciliation relationship cannot target itself.");
  }
  return {
    source_record_id: sourceRecordId,
    source_record_version_id: uuid(
      value.source_record_version_id,
      "source_record_version_id",
      true,
    ),
    related_source_record_id: relatedSourceRecordId,
    food_id: foodId,
    diff_item_fingerprint:
      value.diff_item_fingerprint === null
        ? null
        : hash(value.diff_item_fingerprint, "diff_item_fingerprint"),
    item_fingerprint: value.item_fingerprint as string,
  };
}

const reconciliationFields = [
  "contract_version", "dataset_id", "source_release_id", "environment",
  "decision_type", "relationship_direction", "reason", "evidence_references",
  "reviewer_identity", "approval_reference", "approval_timestamp", "expires_at",
  "supersedes_decision_id", "items", "contract_fingerprint",
] as const;

export function parseFoundationReconciliationDecision(input: unknown) {
  const value = exactObject(input, reconciliationFields, "Reconciliation decision", 16_384);
  if (value.contract_version !== foundationReconciliationDecisionContractVersion) {
    fail("Unsupported reconciliation contract version.");
  }
  const direction = enumValue(
    value.relationship_direction,
    ["none", "directed", "symmetric"] as const,
    "relationship_direction",
  );
  if (!Array.isArray(value.items) || value.items.length < 1 || value.items.length > 128) {
    fail("Reconciliation items must be bounded.");
  }
  const items = value.items.map(parseFoundationReconciliationItem);
  if (direction === "none" && items.some((item) => item.related_source_record_id)) {
    fail("A none relationship cannot contain a related identity.");
  }
  const approvalTimestamp = timestamp(value.approval_timestamp, "approval_timestamp");
  const expiresAt = timestamp(value.expires_at, "expires_at", true);
  if (expiresAt && expiresAt <= approvalTimestamp) fail("Decision is expired.");
  assertFingerprint(value);
  return {
    ...value,
    dataset_id: uuid(value.dataset_id, "dataset_id"),
    source_release_id: uuid(value.source_release_id, "source_release_id"),
    environment: environment(value.environment),
    decision_type: enumValue(value.decision_type, [
      "keep_active_pending_investigation", "archive", "supersede",
      "merge_prohibited_manual_reconciliation", "source_anomaly", "defer",
      "equivalent_identity_confirmed", "split",
      "replaces_erroneous_source_concept", "no_relationship",
      "deferred_relationship",
    ] as const, "decision_type"),
    relationship_direction: direction,
    reason: text(value.reason, "reason", 1000),
    evidence_references: exactStringArray(
      value.evidence_references,
      "evidence_references",
      1,
      16,
      () => true,
    ),
    reviewer_identity: text(value.reviewer_identity, "reviewer_identity", 160),
    approval_reference: text(value.approval_reference, "approval_reference", 200),
    approval_timestamp: approvalTimestamp,
    expires_at: expiresAt,
    supersedes_decision_id: uuid(
      value.supersedes_decision_id,
      "supersedes_decision_id",
      true,
    ),
    items,
  };
}

const allowanceFields = [
  "contract_version", "dataset_id", "source_release_id",
  "prior_dataset_projection_head_id", "environment", "allowance_type",
  "exact_set_fingerprint", "exact_item_fingerprints",
  "allowed_lifecycle_action", "approver_identity", "approval_reference",
  "approval_timestamp", "expires_at", "contract_fingerprint",
] as const;

export function parseFoundationLifecycleAllowance(input: unknown) {
  const value = exactObject(input, allowanceFields, "Lifecycle allowance", 280_000);
  if (value.contract_version !== foundationLifecycleAllowanceContractVersion) {
    fail("Unsupported lifecycle-allowance contract version.");
  }
  const approvalTimestamp = timestamp(value.approval_timestamp, "approval_timestamp");
  const expiresAt = timestamp(value.expires_at, "expires_at");
  if (expiresAt <= approvalTimestamp) fail("Allowance is expired.");
  const fingerprints = exactStringArray(
    value.exact_item_fingerprints,
    "exact_item_fingerprints",
    1,
    4096,
    (item) => hashPattern.test(item),
  );
  assertFingerprint(value);
  return {
    ...value,
    dataset_id: uuid(value.dataset_id, "dataset_id"),
    source_release_id: uuid(value.source_release_id, "source_release_id"),
    prior_dataset_projection_head_id: uuid(
      value.prior_dataset_projection_head_id,
      "prior_dataset_projection_head_id",
    ),
    environment: environment(value.environment),
    allowance_type: enumValue(value.allowance_type, [
      "missing_set", "rejected_set", "unsupported_set",
      "trace_blocked_set", "corrective_action",
    ] as const, "allowance_type"),
    exact_set_fingerprint: hash(value.exact_set_fingerprint, "exact_set_fingerprint"),
    exact_item_fingerprints: fingerprints,
    allowed_lifecycle_action: enumValue(value.allowed_lifecycle_action, [
      "keep_active", "archive", "supersede", "reactivate", "exclude",
      "correct_projection",
    ] as const, "allowed_lifecycle_action"),
    approver_identity: text(value.approver_identity, "approver_identity", 160),
    approval_reference: text(value.approval_reference, "approval_reference", 200),
    approval_timestamp: approvalTimestamp,
    expires_at: expiresAt,
  };
}

const nutrientProjectionFields = [
  "contract_version", "nutrient_code", "projection_state", "basis", "amount",
  "source_semantic", "source_nutrient_id", "source_unit", "derivation_code",
  "derivation_description",
] as const;

export function parseFoundationNutrientProjection(input: unknown) {
  const value = exactObject(input, nutrientProjectionFields, "Nutrient projection", 2048);
  if (value.contract_version !== foundationNutrientProjectionContractVersion) {
    fail("Unsupported nutrient-projection contract version.");
  }
  const nutrientCode = enumValue(value.nutrient_code, [
    "energy_kcal", "protein_g", "carbohydrates_g", "fat_g",
  ] as const, "nutrient_code");
  const state = enumValue(value.projection_state, ["present", "missing"] as const, "projection_state");
  if (state === "missing") {
    for (const key of ["basis", "amount", "source_semantic", "source_nutrient_id", "source_unit", "derivation_code", "derivation_description"] as const) {
      if (value[key] !== null) fail("Missing nutrient state cannot contain a value.");
    }
  } else {
    if (value.basis !== "per_100g") fail("Foundation nutrients use per_100g.");
    if (typeof value.amount !== "number" || !Number.isFinite(value.amount) || value.amount < 0) {
      fail("Present nutrient amount must be nonnegative.");
    }
    const semantic = enumValue(value.source_semantic, [
      "source_reported", "source_calculated", "explicit_zero",
    ] as const, "source_semantic");
    if ((value.amount === 0) !== (semantic === "explicit_zero")) {
      fail("Explicit zero semantics must match the amount.");
    }
    text(value.source_nutrient_id, "source_nutrient_id", 120);
    text(value.source_unit, "source_unit", 40);
  }
  return { ...value, nutrient_code: nutrientCode, projection_state: state };
}

const foodProjectionFields = [
  "contract_version", "food_id", "source_record_id", "source_record_version_id",
  "name", "brand_name", "locale", "food_type", "data_quality", "is_public",
  "is_archived", "serving_size", "serving_unit", "nutrients",
] as const;

export function parseFoundationFoodProjection(input: unknown) {
  const value = exactObject(input, foodProjectionFields, "Food projection", 16_384);
  if (value.contract_version !== foundationFoodProjectionContractVersion) {
    fail("Unsupported food-projection contract version.");
  }
  if (!Array.isArray(value.nutrients) || value.nutrients.length !== 4) {
    fail("A food projection requires exactly four nutrient states.");
  }
  const nutrients = value.nutrients.map(parseFoundationNutrientProjection)
    .sort((left, right) => String(left.nutrient_code).localeCompare(String(right.nutrient_code), "en"));
  if (new Set(nutrients.map((item) => item.nutrient_code)).size !== 4) {
    fail("A food projection requires four distinct target nutrients.");
  }
  if (value.brand_name !== null || value.locale !== "en" || value.food_type !== "generic" || value.data_quality !== "imported" || value.is_public !== true || typeof value.is_archived !== "boolean" || value.serving_size !== null || value.serving_unit !== null) {
    fail("Foundation food projection fields violate the approved policy.");
  }
  return {
    ...value,
    food_id: uuid(value.food_id, "food_id"),
    source_record_id: uuid(value.source_record_id, "source_record_id"),
    source_record_version_id: uuid(value.source_record_version_id, "source_record_version_id"),
    name: text(value.name, "name", 200),
    nutrients,
  };
}

export function fingerprintFoundationFoodProjection(input: unknown) {
  return fingerprintJson(parseFoundationFoodProjection(input) as JsonValue);
}

const datasetProjectionFields = [
  "contract_version", "dataset_id", "environment", "source_release_id", "foods",
] as const;

export function parseFoundationDatasetProjection(input: unknown) {
  const value = exactObject(input, datasetProjectionFields, "Dataset projection", 270_000);
  if (value.contract_version !== foundationDatasetProjectionContractVersion) {
    fail("Unsupported dataset-projection contract version.");
  }
  if (!Array.isArray(value.foods) || value.foods.length > 10_000) {
    fail("Dataset foods must be bounded.");
  }
  const foods = value.foods.map((item, index) => {
    const entry = exactObject(item, ["food_id", "projection_hash"], `foods[${index}]`, 256);
    return {
      food_id: uuid(entry.food_id, `foods[${index}].food_id`),
      projection_hash: hash(entry.projection_hash, `foods[${index}].projection_hash`),
    };
  }).sort((left, right) => left.food_id.localeCompare(right.food_id, "en"));
  if (new Set(foods.map((item) => item.food_id)).size !== foods.length) {
    fail("Dataset projection contains duplicate foods.");
  }
  return {
    contract_version: foundationDatasetProjectionContractVersion,
    dataset_id: uuid(value.dataset_id, "dataset_id"),
    environment: environment(value.environment),
    source_release_id: uuid(value.source_release_id, "source_release_id"),
    foods,
  };
}

export function fingerprintFoundationDatasetProjection(input: unknown) {
  return fingerprintJson(parseFoundationDatasetProjection(input) as JsonValue);
}

export type FoundationBaselineBootstrapResult = {
  dataset_projection_head_id: string;
  dataset_projection_fingerprint: string;
  food_count: number;
  present_nutrient_count: number;
  missing_nutrient_count: number;
  evidence_link_count: number;
  exact_retry: boolean;
};

export function parseFoundationBaselineBootstrapResult(input: unknown): FoundationBaselineBootstrapResult {
  const value = exactObject(input, [
    "dataset_projection_head_id", "dataset_projection_fingerprint", "food_count",
    "present_nutrient_count", "missing_nutrient_count", "evidence_link_count",
    "exact_retry",
  ], "Baseline bootstrap result", 1024);
  if (typeof value.exact_retry !== "boolean") fail("exact_retry must be boolean.");
  const foodCount = count(value.food_count, "food_count");
  const present = count(value.present_nutrient_count, "present_nutrient_count");
  const missing = count(value.missing_nutrient_count, "missing_nutrient_count");
  const evidence = count(value.evidence_link_count, "evidence_link_count");
  if (present + missing !== foodCount * 4 || evidence !== present) {
    fail("Baseline bootstrap counts are inconsistent.");
  }
  return {
    dataset_projection_head_id: uuid(value.dataset_projection_head_id, "dataset_projection_head_id") as string,
    dataset_projection_fingerprint: hash(value.dataset_projection_fingerprint, "dataset_projection_fingerprint"),
    food_count: foodCount,
    present_nutrient_count: present,
    missing_nutrient_count: missing,
    evidence_link_count: evidence,
    exact_retry: value.exact_retry,
  };
}

function parseReceiptContract(
  input: unknown,
  contractVersion: string,
  label: string,
  fingerprintField: string,
) {
  const value = exactObject(input, [
    "contract_version", "import_run_id", "prior_dataset_projection_fingerprint",
    "environment", "set_fingerprints", "counts", fingerprintField,
  ], label, 32_768);
  if (value.contract_version !== contractVersion) fail(`Unsupported ${label} contract version.`);
  uuid(value.import_run_id, "import_run_id");
  hash(value.prior_dataset_projection_fingerprint, "prior_dataset_projection_fingerprint");
  environment(value.environment);
  if (!isPlainObject(value.set_fingerprints) || !isPlainObject(value.counts)) {
    fail(`${label} sets and counts must be objects.`);
  }
  for (const [key, item] of Object.entries(value.set_fingerprints)) hash(item, key);
  for (const [key, item] of Object.entries(value.counts)) count(item, key);
  const expected = fingerprintJson(Object.fromEntries(
    Object.entries(value).filter(([key]) => key !== fingerprintField),
  ) as JsonValue);
  if (hash(value[fingerprintField], fingerprintField) !== expected) {
    fail(`${label} fingerprint mismatch.`);
  }
  return value;
}

export function parseFoundationLifecycleValidationReceipt(input: unknown) {
  return parseReceiptContract(
    input,
    foundationLifecycleValidationReceiptContractVersion,
    "Lifecycle validation receipt",
    "validation_fingerprint",
  );
}

export function parseFoundationLifecycleUpdateReceipt(input: unknown) {
  return parseReceiptContract(
    input,
    foundationLifecycleUpdateReceiptContractVersion,
    "Lifecycle update receipt",
    "receipt_fingerprint",
  );
}

const updateApprovalFields = [
  "contract_version", "validation_receipt_id", "validation_fingerprint",
  "environment", "approver_identity", "approval_reference",
  "approval_timestamp", "expires_at", "contract_fingerprint",
] as const;

export function parseFoundationLifecycleUpdateApproval(input: unknown) {
  const value = exactObject(input, updateApprovalFields, "Lifecycle update approval", 16_384);
  if (value.contract_version !== foundationLifecycleUpdateApprovalContractVersion) {
    fail("Unsupported lifecycle-update approval contract version.");
  }
  const approvedAt = timestamp(value.approval_timestamp, "approval_timestamp");
  const expiresAt = timestamp(value.expires_at, "expires_at");
  if (expiresAt <= approvedAt) fail("Lifecycle update approval is expired.");
  assertFingerprint(value);
  return {
    ...value,
    validation_receipt_id: uuid(value.validation_receipt_id, "validation_receipt_id"),
    validation_fingerprint: hash(value.validation_fingerprint, "validation_fingerprint"),
    environment: environment(value.environment),
    approver_identity: text(value.approver_identity, "approver_identity", 160),
    approval_reference: text(value.approval_reference, "approval_reference", 200),
    approval_timestamp: approvedAt,
    expires_at: expiresAt,
  };
}

const identityReservationFields = [
  "contract_version", "dataset_id", "environment", "concept_key",
  "source_release_id", "origin_import_run_id", "reserved_food_id",
  "created_at", "reservation_fingerprint",
] as const;

export function parseFoundationApplicationFoodIdentityReservation(input: unknown) {
  const value = exactObject(
    input,
    identityReservationFields,
    "Application food identity reservation",
    4096,
  );
  if (value.contract_version !== foundationApplicationFoodIdentityReservationContractVersion) {
    fail("Unsupported application-food reservation contract version.");
  }
  const body = Object.fromEntries(
    Object.entries(value).filter(([key]) => key !== "reservation_fingerprint"),
  ) as JsonValue;
  if (hash(value.reservation_fingerprint, "reservation_fingerprint") !== fingerprintJson(body)) {
    fail("Identity-reservation fingerprint mismatch.");
  }
  return {
    contract_version: foundationApplicationFoodIdentityReservationContractVersion,
    dataset_id: uuid(value.dataset_id, "dataset_id"),
    environment: environment(value.environment),
    concept_key: text(value.concept_key, "concept_key", 200),
    source_release_id: uuid(value.source_release_id, "source_release_id"),
    origin_import_run_id: uuid(value.origin_import_run_id, "origin_import_run_id"),
    reserved_food_id: uuid(value.reserved_food_id, "reserved_food_id"),
    created_at: timestamp(value.created_at, "created_at"),
    reservation_fingerprint: value.reservation_fingerprint as string,
  };
}

const executionPlanItemFields = [
  "contract_version", "action_ordinal", "release_diff_item_fingerprint",
  "source_row_key", "concept_key", "upstream_version_key", "current_food_id",
  "reserved_food_id", "current_source_record_id",
  "current_source_record_version_id", "current_food_projection_version_id",
  "proposed_lifecycle_projection_hash", "proposed_source_record_version_hash",
  "reconciliation_decision_fingerprint", "allowance_fingerprint",
  "lifecycle_action", "proposed_food_state", "nutrient_states",
  "portion_set_fingerprint", "evidence_set_fingerprint", "item_fingerprint",
] as const;

export function parseFoundationLifecycleExecutionPlanItem(input: unknown) {
  const value = exactObject(input, executionPlanItemFields, "Execution-plan item", 65_536);
  if (value.contract_version !== foundationLifecycleExecutionPlanItemContractVersion) {
    fail("Unsupported execution-plan item contract version.");
  }
  const ordinal = count(value.action_ordinal, "action_ordinal");
  if (ordinal === 0) fail("action_ordinal must be positive.");
  enumValue(value.lifecycle_action, foundationLifecycleExecutionActions, "lifecycle_action");
  for (const key of ["proposed_food_state", "nutrient_states"] as const) {
    if (key === "proposed_food_state" && value[key] !== null && !isPlainObject(value[key])) {
      fail("proposed_food_state must be an object or null.");
    }
    if (key === "nutrient_states" && (
      !Array.isArray(value[key]) || ![0, 4].includes(value[key].length)
    )) fail("nutrient_states must contain zero or four states.");
  }
  const nullableUuid = (key: string) => value[key] === null ? null : uuid(value[key], key);
  const nullableHash = (key: string) => value[key] === null ? null : hash(value[key], key);
  const nullableText = (key: string) => value[key] === null ? null : text(value[key], key, 200);
  const expected = fingerprintJson(Object.fromEntries(
    Object.entries(value).filter(([key]) => key !== "item_fingerprint"),
  ) as JsonValue);
  if (hash(value.item_fingerprint, "item_fingerprint") !== expected) {
    fail("Execution-plan item fingerprint mismatch.");
  }
  return {
    ...value,
    action_ordinal: ordinal,
    release_diff_item_fingerprint: hash(
      value.release_diff_item_fingerprint,
      "release_diff_item_fingerprint",
    ),
    source_row_key: nullableText("source_row_key"),
    concept_key: nullableText("concept_key"),
    upstream_version_key: nullableText("upstream_version_key"),
    current_food_id: nullableUuid("current_food_id"),
    reserved_food_id: nullableUuid("reserved_food_id"),
    current_source_record_id: nullableUuid("current_source_record_id"),
    current_source_record_version_id: nullableUuid("current_source_record_version_id"),
    current_food_projection_version_id: nullableUuid("current_food_projection_version_id"),
    proposed_lifecycle_projection_hash: nullableHash("proposed_lifecycle_projection_hash"),
    proposed_source_record_version_hash: nullableHash("proposed_source_record_version_hash"),
    reconciliation_decision_fingerprint: nullableHash("reconciliation_decision_fingerprint"),
    allowance_fingerprint: nullableHash("allowance_fingerprint"),
    portion_set_fingerprint: nullableHash("portion_set_fingerprint"),
    evidence_set_fingerprint: nullableHash("evidence_set_fingerprint"),
  };
}

const executionPlanFields = [
  "contract_version", "import_run_id", "release_diff_report_id",
  "release_diff_report_fingerprint", "validation_receipt_id",
  "validation_fingerprint", "prior_source_release_id",
  "prior_source_release_fingerprint", "new_source_release_id",
  "new_source_release_fingerprint", "current_dataset_head_id",
  "current_dataset_head_version", "current_dataset_head_fingerprint",
  "current_scope_evidence_id", "current_scope_evidence_fingerprint",
  "decision_fingerprints", "allowance_fingerprints",
  "identity_reservation_fingerprints", "action_item_fingerprints",
  "action_set_fingerprints", "action_counts", "diff_set_fingerprints",
  "diff_set_counts", "category_counts", "before_projection_fingerprint",
  "after_projection_fingerprint", "contract_versions", "environment",
  "plan_fingerprint",
] as const;

export function parseFoundationLifecycleExecutionPlan(input: unknown) {
  const value = exactObject(input, executionPlanFields, "Lifecycle execution plan", 1_048_576);
  if (value.contract_version !== foundationLifecycleExecutionPlanContractVersion) {
    fail("Unsupported execution-plan contract version.");
  }
  for (const [key, minimum, maximum] of [
    ["decision_fingerprints", 0, 10_000],
    ["allowance_fingerprints", 0, 32],
    ["identity_reservation_fingerprints", 0, 10_000],
    ["action_item_fingerprints", 0, 10_000],
  ] as const) exactStringArray(value[key], key, minimum, maximum, (item) => hashPattern.test(item));
  for (const key of ["action_counts", "diff_set_counts", "category_counts"] as const) {
    if (!isPlainObject(value[key])) fail(`${key} must be an object.`);
    for (const [name, item] of Object.entries(value[key])) count(item, `${key}.${name}`);
  }
  for (const key of ["action_set_fingerprints", "diff_set_fingerprints"] as const) {
    if (!isPlainObject(value[key])) fail(`${key} must be an object.`);
    for (const [name, item] of Object.entries(value[key])) hash(item, `${key}.${name}`);
  }
  const expected = fingerprintJson(Object.fromEntries(
    Object.entries(value).filter(([key]) => key !== "plan_fingerprint"),
  ) as JsonValue);
  if (hash(value.plan_fingerprint, "plan_fingerprint") !== expected) {
    fail("Execution-plan fingerprint mismatch.");
  }
  return {
    ...value,
    import_run_id: uuid(value.import_run_id, "import_run_id"),
    release_diff_report_id: uuid(value.release_diff_report_id, "release_diff_report_id"),
    validation_receipt_id: uuid(value.validation_receipt_id, "validation_receipt_id"),
    prior_source_release_id: uuid(value.prior_source_release_id, "prior_source_release_id"),
    new_source_release_id: uuid(value.new_source_release_id, "new_source_release_id"),
    current_dataset_head_id: uuid(value.current_dataset_head_id, "current_dataset_head_id"),
    current_scope_evidence_id: uuid(value.current_scope_evidence_id, "current_scope_evidence_id"),
    current_dataset_head_version: count(
      value.current_dataset_head_version,
      "current_dataset_head_version",
    ),
    environment: environment(value.environment),
  };
}

const approvalV2Fields = [
  "contract_version", "validation_receipt_id", "validation_fingerprint",
  "execution_plan_id", "execution_plan_fingerprint",
  "release_diff_report_fingerprint", "prior_dataset_head_id",
  "prior_dataset_head_version", "prior_dataset_head_fingerprint",
  "current_scope_evidence_fingerprint", "decision_set_fingerprint",
  "allowance_set_fingerprint", "before_projection_fingerprint",
  "after_projection_fingerprint", "environment", "approver_identity",
  "approval_reference", "approval_timestamp", "expires_at",
  "contract_fingerprint",
] as const;

export function parseFoundationLifecycleUpdateApprovalV2(input: unknown) {
  const value = exactObject(input, approvalV2Fields, "Lifecycle update approval V2", 32_768);
  if (value.contract_version !== foundationLifecycleUpdateApprovalV2ContractVersion) {
    fail("Unsupported lifecycle-update approval V2 contract version.");
  }
  const approvedAt = timestamp(value.approval_timestamp, "approval_timestamp");
  const expiresAt = timestamp(value.expires_at, "expires_at");
  if (expiresAt <= approvedAt) fail("Lifecycle update approval is expired.");
  assertFingerprint(value);
  for (const key of [
    "validation_fingerprint", "execution_plan_fingerprint",
    "release_diff_report_fingerprint", "prior_dataset_head_fingerprint",
    "current_scope_evidence_fingerprint", "decision_set_fingerprint",
    "allowance_set_fingerprint", "before_projection_fingerprint",
    "after_projection_fingerprint",
  ] as const) hash(value[key], key);
  return {
    ...value,
    validation_receipt_id: uuid(value.validation_receipt_id, "validation_receipt_id"),
    execution_plan_id: uuid(value.execution_plan_id, "execution_plan_id"),
    prior_dataset_head_id: uuid(value.prior_dataset_head_id, "prior_dataset_head_id"),
    prior_dataset_head_version: count(value.prior_dataset_head_version, "prior_dataset_head_version"),
    environment: environment(value.environment),
    approver_identity: text(value.approver_identity, "approver_identity", 160),
    approval_reference: text(value.approval_reference, "approval_reference", 200),
    approval_timestamp: approvedAt,
    expires_at: expiresAt,
  };
}

const receiptV2Fields = [
  "contract_version", "approval_id", "approval_fingerprint",
  "execution_plan_id", "execution_plan_fingerprint", "validation_receipt_id",
  "validation_fingerprint", "release_diff_report_id",
  "release_diff_report_fingerprint", "import_run_id", "run_purpose",
  "prior_source_release_id", "prior_source_release_fingerprint",
  "new_source_release_id", "new_source_release_fingerprint",
  "prior_dataset_head_id", "prior_dataset_head_version",
  "prior_dataset_head_fingerprint", "resulting_dataset_head_id",
  "resulting_dataset_head_version", "resulting_dataset_head_fingerprint",
  "scope_evidence_fingerprint", "decision_fingerprints",
  "allowance_fingerprints", "identity_reservation_fingerprints",
  "diff_set_fingerprints", "action_set_fingerprints",
  "before_projection_fingerprint", "after_projection_fingerprint",
  "public_mutation_counts", "history_insertion_counts", "excluded_counts",
  "warning_count", "completion_timestamp", "environment",
  "receipt_fingerprint",
] as const;

export function parseFoundationLifecycleUpdateReceiptV2(input: unknown) {
  const value = exactObject(input, receiptV2Fields, "Lifecycle update receipt V2", 262_144);
  if (value.contract_version !== foundationLifecycleUpdateReceiptV2ContractVersion) {
    fail("Unsupported lifecycle-update receipt V2 contract version.");
  }
  for (const key of ["decision_fingerprints", "allowance_fingerprints", "identity_reservation_fingerprints"] as const) {
    exactStringArray(value[key], key, 0, 10_000, (item) => hashPattern.test(item));
  }
  for (const key of ["public_mutation_counts", "history_insertion_counts", "excluded_counts"] as const) {
    if (!isPlainObject(value[key])) fail(`${key} must be an object.`);
    for (const [name, item] of Object.entries(value[key])) count(item, `${key}.${name}`);
  }
  count(value.warning_count, "warning_count");
  timestamp(value.completion_timestamp, "completion_timestamp");
  const expected = fingerprintJson(Object.fromEntries(
    Object.entries(value).filter(([key]) => key !== "receipt_fingerprint"),
  ) as JsonValue);
  if (hash(value.receipt_fingerprint, "receipt_fingerprint") !== expected) {
    fail("Lifecycle update receipt V2 fingerprint mismatch.");
  }
  return {
    ...value,
    approval_id: uuid(value.approval_id, "approval_id"),
    execution_plan_id: uuid(value.execution_plan_id, "execution_plan_id"),
    validation_receipt_id: uuid(value.validation_receipt_id, "validation_receipt_id"),
    release_diff_report_id: uuid(value.release_diff_report_id, "release_diff_report_id"),
    import_run_id: uuid(value.import_run_id, "import_run_id"),
    prior_source_release_id: uuid(value.prior_source_release_id, "prior_source_release_id"),
    new_source_release_id: uuid(value.new_source_release_id, "new_source_release_id"),
    prior_dataset_head_id: uuid(value.prior_dataset_head_id, "prior_dataset_head_id"),
    resulting_dataset_head_id: uuid(value.resulting_dataset_head_id, "resulting_dataset_head_id"),
    environment: environment(value.environment),
  };
}

export function parseFoundationLifecycleExecutionResult(input: unknown) {
  const value = exactObject(input, [
    "status", "receipt_id", "receipt_fingerprint", "completion_timestamp",
    "resulting_dataset_head_id", "resulting_dataset_head_version", "exact_retry",
  ], "Lifecycle execution result", 2048);
  if (value.status !== "completed" || typeof value.exact_retry !== "boolean") {
    fail("Lifecycle execution result is invalid.");
  }
  return {
    status: "completed" as const,
    receipt_id: uuid(value.receipt_id, "receipt_id"),
    receipt_fingerprint: hash(value.receipt_fingerprint, "receipt_fingerprint"),
    completion_timestamp: timestamp(value.completion_timestamp, "completion_timestamp"),
    resulting_dataset_head_id: uuid(
      value.resulting_dataset_head_id,
      "resulting_dataset_head_id",
    ),
    resulting_dataset_head_version: count(
      value.resulting_dataset_head_version,
      "resulting_dataset_head_version",
    ),
    exact_retry: value.exact_retry,
  };
}

export function parseFoundationLifecycleReceiptLookupResult(input: unknown) {
  if (input === null) return null;
  const value = exactObject(input, [
    "approval_id", "receipt_id", "receipt_fingerprint", "completion_timestamp",
    "resulting_dataset_head_id", "resulting_dataset_head_version",
  ], "Lifecycle receipt lookup result", 2048);
  return {
    approval_id: uuid(value.approval_id, "approval_id"),
    receipt_id: uuid(value.receipt_id, "receipt_id"),
    receipt_fingerprint: hash(value.receipt_fingerprint, "receipt_fingerprint"),
    completion_timestamp: timestamp(value.completion_timestamp, "completion_timestamp"),
    resulting_dataset_head_id: uuid(
      value.resulting_dataset_head_id,
      "resulting_dataset_head_id",
    ),
    resulting_dataset_head_version: count(
      value.resulting_dataset_head_version,
      "resulting_dataset_head_version",
    ),
  };
}
