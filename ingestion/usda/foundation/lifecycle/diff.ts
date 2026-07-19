import {
  canonicalizeJson,
  fingerprintJson,
  isPlainObject,
  type JsonValue,
} from "../canonical-json.ts";
import {
  foundationDiffClassifications,
  foundationLifecyclePolicyVersion,
  foundationReconciliationDecisionContractVersion,
  foundationReleaseDiffContractVersion,
  foundationReleaseScopeContractVersion,
} from "../../../contracts/foundation-lifecycle.ts";
import {
  candidateProjection,
  candidateSourceMetadataFingerprint,
  fingerprintLifecycleProjection,
  projectionBlockCategory,
} from "./projection.ts";
import {
  foundationPrimaryDiffClassifications,
  type FoundationCurrentConcept,
  type FoundationLifecycleCandidate,
  type FoundationLifecycleDiffClassification,
  type FoundationLifecycleDiffInput,
  type FoundationLifecycleDiffItem,
  type FoundationLifecycleDiffReport,
  type FoundationPrimaryDiffClassification,
} from "./types.ts";

const hashPattern = /^[a-f0-9]{64}$/;
const acceptedPrimary = new Set<FoundationPrimaryDiffClassification>([
  "new_concept",
  "byte_identical_unchanged",
  "semantically_unchanged_new_version",
  "source_only_metadata",
  "projection_changing",
  "reactivation",
]);

function exactKeys(value: unknown, keys: readonly string[], label: string) {
  if (
    !isPlainObject(value) ||
    JSON.stringify(Object.keys(value).sort()) !== JSON.stringify([...keys].sort())
  ) throw new Error(`${label} fields must be exact.`);
}

function assertHash(value: string, label: string) {
  if (!hashPattern.test(value)) throw new Error(`${label} must be a SHA-256.`);
}

function validateInput(input: FoundationLifecycleDiffInput) {
  exactKeys(input, [
    "prior_release", "new_release", "prior_head", "scope_evidence",
    "import_run_id", "environment", "current_concepts", "candidates",
    "reconciliation_decisions", "allowances", "contract_versions",
  ], "Lifecycle diff input");
  if (input.candidates.length + input.current_concepts.length > 10_000) {
    throw new Error("Lifecycle diff input exceeds 10,000 bounded items.");
  }
  if (!Number.isSafeInteger(input.prior_head.version) || input.prior_head.version < 1) {
    throw new Error("Prior head version is invalid.");
  }
  if (!new Set(["local", "production"]).has(input.environment)) {
    throw new Error("Lifecycle environment is invalid.");
  }
  if (input.contract_versions.diff_contract_version !== foundationReleaseDiffContractVersion ||
    input.contract_versions.lifecycle_policy_version !== foundationLifecyclePolicyVersion ||
    input.contract_versions.scope_contract_version !== foundationReleaseScopeContractVersion ||
    input.contract_versions.reconciliation_contract_version !==
      foundationReconciliationDecisionContractVersion) {
    throw new Error("Lifecycle contract versions are invalid.");
  }
  for (const [label, value] of [
    ["prior release fingerprint", input.prior_release.fingerprint],
    ["new release fingerprint", input.new_release.fingerprint],
    ["prior head fingerprint", input.prior_head.fingerprint],
    ["scope fingerprint", input.scope_evidence.fingerprint],
    ["mapping hash", input.contract_versions.mapping_hash],
  ] as const) assertHash(value, label);
  const candidateKeys = new Set<string>();
  for (const candidate of input.candidates) {
    exactKeys(candidate, [
      "source_row_key", "raw_payload_hash", "validation_status",
      "reject_category", "normalized_candidate",
      "possible_prior_source_record_ids",
    ], "Lifecycle candidate");
    assertHash(candidate.raw_payload_hash, "candidate raw hash");
    if (candidateKeys.has(candidate.source_row_key)) {
      throw new Error("Lifecycle candidates contain duplicate source rows.");
    }
    candidateKeys.add(candidate.source_row_key);
    if ((candidate.validation_status === "accepted") !==
      (candidate.normalized_candidate !== null)) {
      throw new Error("Accepted lifecycle candidates require normalized input.");
    }
    if ((candidate.validation_status === "rejected") !==
      (candidate.reject_category !== null)) {
      throw new Error("Rejected lifecycle candidates require a category.");
    }
  }
}

type ItemBody = Omit<FoundationLifecycleDiffItem, "set_ordinal" | "item_fingerprint">;

function itemBody(
  candidate: FoundationLifecycleCandidate,
  current: FoundationCurrentConcept | null,
  classification: FoundationLifecycleDiffClassification,
  reason: string,
  proposedProjectionHash: string | null,
  reconciliationFingerprint: string | null,
): ItemBody {
  return {
    source_row_key: candidate.source_row_key,
    concept_key: candidate.normalized_candidate?.concept_key ?? current?.concept_key ?? null,
    upstream_version_key:
      candidate.normalized_candidate?.upstream_version_key ?? null,
    raw_payload_hash: candidate.raw_payload_hash,
    normalized_candidate_hash:
      candidate.normalized_candidate?.content_fingerprint ?? null,
    prior_source_version_hash: current?.raw_payload_hash ?? null,
    prior_public_projection_hash:
      current ? fingerprintLifecycleProjection(current.projection) : null,
    proposed_public_projection_hash: proposedProjectionHash,
    classification,
    reason_category: reason,
    reconciliation_decision_fingerprint: reconciliationFingerprint,
  };
}

function classifyCandidate(input: {
  candidate: FoundationLifecycleCandidate;
  current: FoundationCurrentConcept | null;
  duplicateConcept: boolean;
  duplicateVersion: boolean;
  upstreamOwner: FoundationCurrentConcept | null;
  reconciliationFingerprint: string | null;
}) {
  const { candidate, current, duplicateConcept, duplicateVersion, upstreamOwner } = input;
  if (candidate.validation_status === "rejected") {
    return { classification: "rejected", reason: candidate.reject_category!, projection: null } as const;
  }
  const normalized = candidate.normalized_candidate!;
  if (duplicateConcept || duplicateVersion) {
    return { classification: "identity_conflict", reason: "duplicate_release_identity", projection: null } as const;
  }
  if (
    upstreamOwner && normalized.concept_key !== null &&
    upstreamOwner.concept_key !== normalized.concept_key
  ) {
    return { classification: "identity_conflict", reason: "fdc_identity_conflict", projection: null } as const;
  }
  if (upstreamOwner && upstreamOwner.raw_payload_hash !== candidate.raw_payload_hash) {
    return { classification: "identity_conflict", reason: "fdc_raw_hash_conflict", projection: null } as const;
  }
  const blocked = projectionBlockCategory(normalized);
  if (blocked) {
    return { classification: blocked, reason: blocked === "trace_blocked" ?
      "trace_selected_target" : "unsupported_target_unit", projection: null } as const;
  }
  const projection = candidateProjection(normalized);
  if (!current) {
    if (
      normalized.concept_key === null &&
      candidate.possible_prior_source_record_ids.length > 0 &&
      input.reconciliationFingerprint === null
    ) {
      return {
        classification: "manual_reconciliation_required",
        reason: "no_ndb_changed_fdc",
        projection: null,
      } as const;
    }
    return { classification: "new_concept", reason: "new_source_concept", projection } as const;
  }
  if (current.lifecycle_state === "archived") {
    return { classification: "reactivation", reason: "archived_identity_reappeared", projection } as const;
  }
  const priorProjectionHash = fingerprintLifecycleProjection(current.projection);
  const proposedProjectionHash = fingerprintLifecycleProjection(projection);
  if (priorProjectionHash !== proposedProjectionHash) {
    return { classification: "projection_changing", reason: "public_projection_changed", projection } as const;
  }
  const sameVersion = normalized.upstream_version_key === current.upstream_version_key;
  if (sameVersion && candidate.raw_payload_hash === current.raw_payload_hash &&
    (current.normalized_candidate_hash === null ||
      normalized.content_fingerprint === current.normalized_candidate_hash)) {
    return { classification: "byte_identical_unchanged", reason: "byte_identical", projection } as const;
  }
  const metadataHash = candidateSourceMetadataFingerprint(normalized);
  if (current.source_metadata_hash !== null && metadataHash !== current.source_metadata_hash) {
    return { classification: "source_only_metadata", reason: "source_metadata_changed", projection } as const;
  }
  return {
    classification: sameVersion ? "source_only_metadata" :
      "semantically_unchanged_new_version",
    reason: sameVersion ? "normalized_metadata_changed" : "projection_unchanged",
    projection,
  } as const;
}

function stableBodyOrder(left: ItemBody, right: ItemBody) {
  const leftKey = [
    left.source_row_key ?? "", left.concept_key ?? "",
    left.upstream_version_key ?? "", left.reason_category ?? "",
  ].join("\u0000");
  const rightKey = [
    right.source_row_key ?? "", right.concept_key ?? "",
    right.upstream_version_key ?? "", right.reason_category ?? "",
  ].join("\u0000");
  return Buffer.compare(Buffer.from(leftKey, "utf8"), Buffer.from(rightKey, "utf8"));
}

function finalizeItems(bodies: readonly ItemBody[]) {
  const result: FoundationLifecycleDiffItem[] = [];
  for (const classification of foundationDiffClassifications) {
    const setBodies = bodies.filter((item) => item.classification === classification)
      .sort(stableBodyOrder);
    setBodies.forEach((body, index) => {
      const withOrdinal = { ...body, set_ordinal: index + 1 };
      result.push({
        ...withOrdinal,
        item_fingerprint: fingerprintJson(withOrdinal as JsonValue),
      });
    });
  }
  return result;
}

function projectionFingerprint(
  input: FoundationLifecycleDiffInput,
  proposed: ReadonlyMap<string, string>,
) {
  const foods = input.current_concepts
    .filter((item) => item.lifecycle_state !== "superseded")
    .map((item) => ({
      identity: item.food_id,
      projection_hash: proposed.get(item.source_record_id) ??
        fingerprintLifecycleProjection(item.projection),
    }));
  for (const [identity, projectionHash] of proposed) {
    if (!input.current_concepts.some((item) => item.source_record_id === identity)) {
      foods.push({ identity, projection_hash: projectionHash });
    }
  }
  foods.sort((left, right) => left.identity.localeCompare(right.identity, "en"));
  return fingerprintJson({
    contract_version: "foundation-lifecycle-projection-set/v1",
    dataset_head_version: input.prior_head.version,
    foods,
  });
}

export function createFoundationReleaseDiff(
  input: FoundationLifecycleDiffInput,
): FoundationLifecycleDiffReport {
  validateInput(input);
  const conceptCounts = new Map<string, number>();
  const versionCounts = new Map<string, number>();
  for (const item of input.candidates) {
    if (item.validation_status !== "accepted") continue;
    const normalized = item.normalized_candidate!;
    if (normalized.concept_key) conceptCounts.set(
      normalized.concept_key,
      (conceptCounts.get(normalized.concept_key) ?? 0) + 1,
    );
    versionCounts.set(normalized.upstream_version_key,
      (versionCounts.get(normalized.upstream_version_key) ?? 0) + 1);
  }
  const currentByConcept = new Map(
    input.current_concepts.map((item) => [item.concept_key, item]),
  );
  const currentByVersion = new Map(
    input.current_concepts.map((item) => [item.upstream_version_key, item]),
  );
  const reconciliationByRow = new Map(
    input.reconciliation_decisions.map((item) => [item.source_row_key, item]),
  );
  const currentByRecord = new Map(
    input.current_concepts.map((item) => [item.source_record_id, item]),
  );
  const bodies: ItemBody[] = [];
  const proposed = new Map<string, string>();
  const acceptedConcepts = new Set<string>();
  const primaryByRow = new Map<string, FoundationPrimaryDiffClassification>();

  for (const candidate of input.candidates) {
    const normalized = candidate.normalized_candidate;
    const reconciliation = reconciliationByRow.get(candidate.source_row_key) ?? null;
    let current = normalized?.concept_key ? currentByConcept.get(normalized.concept_key) ?? null :
      normalized ? currentByVersion.get(normalized.upstream_version_key) ?? null : null;
    if (!current && reconciliation) current = currentByRecord.get(
      reconciliation.prior_source_record_id,
    ) ?? null;
    const upstreamOwner = normalized ? currentByVersion.get(
      normalized.upstream_version_key,
    ) ?? null : null;
    const classified = classifyCandidate({
      candidate,
      current,
      duplicateConcept: normalized?.concept_key ?
        (conceptCounts.get(normalized.concept_key) ?? 0) > 1 : false,
      duplicateVersion: normalized ?
        (versionCounts.get(normalized.upstream_version_key) ?? 0) > 1 : false,
      upstreamOwner,
      reconciliationFingerprint: reconciliation?.decision_fingerprint ?? null,
    });
    primaryByRow.set(candidate.source_row_key, classified.classification);
    const proposedHash = classified.projection ?
      fingerprintLifecycleProjection(classified.projection) : null;
    bodies.push(itemBody(
      candidate,
      current,
      classified.classification,
      classified.reason,
      proposedHash,
      reconciliation?.decision_fingerprint ?? null,
    ));
    if (normalized && acceptedPrimary.has(classified.classification)) {
      if (normalized.concept_key) acceptedConcepts.add(normalized.concept_key);
      const identity = current?.source_record_id ?? normalized.concept_key ??
        normalized.upstream_version_key;
      if (proposedHash) proposed.set(identity, proposedHash);
      if (
        current &&
        classified.classification !== "reactivation" &&
        normalized.upstream_version_key !== current.upstream_version_key
      ) {
        bodies.push(itemBody(
          candidate, current, "new_version", "upstream_version_changed",
          proposedHash, reconciliation?.decision_fingerprint ?? null,
        ));
      }
      for (const warning of normalized.warning_categories) {
        bodies.push(itemBody(
          candidate, current, "warning", warning, proposedHash,
          reconciliation?.decision_fingerprint ?? null,
        ));
      }
    }
  }

  if (input.scope_evidence.classification === "complete_snapshot") {
    for (const current of input.current_concepts) {
      if (
        new Set(["active", "missing_pending"]).has(current.lifecycle_state) &&
        !acceptedConcepts.has(current.concept_key)
      ) {
        const syntheticCandidate: FoundationLifecycleCandidate = {
          source_row_key: `missing:${current.concept_key}`,
          raw_payload_hash: current.raw_payload_hash,
          validation_status: "rejected",
          reject_category: "missing_prior_concept",
          normalized_candidate: null,
          possible_prior_source_record_ids: [],
        };
        bodies.push(itemBody(
          syntheticCandidate,
          current,
          "missing_prior_concept",
          "complete_snapshot_absence",
          null,
          null,
        ));
      }
    }
  }

  const items = finalizeItems(bodies);
  if (items.length > 10_000) throw new Error("Release diff exceeds 10,000 items.");
  const primaryCounts = new Map<string, number>();
  for (const [row, classification] of primaryByRow) {
    if (!foundationPrimaryDiffClassifications.includes(classification)) {
      throw new Error(`Candidate ${row} lacks one primary outcome.`);
    }
    primaryCounts.set(row, (primaryCounts.get(row) ?? 0) + 1);
  }
  if ([...primaryCounts.values()].some((count) => count !== 1)) {
    throw new Error("Each candidate requires exactly one primary outcome.");
  }
  for (const item of items.filter((entry) => entry.classification === "warning")) {
    const primary = primaryByRow.get(item.source_row_key!);
    if (!primary || !acceptedPrimary.has(primary)) {
      throw new Error("Warnings may overlap only accepted primary outcomes.");
    }
  }

  const exactSetFingerprints = {} as Record<FoundationLifecycleDiffClassification, string>;
  const exactSetCounts = {} as Record<FoundationLifecycleDiffClassification, number>;
  for (const classification of foundationDiffClassifications) {
    const setItems = items.filter((item) => item.classification === classification);
    exactSetCounts[classification] = setItems.length;
    exactSetFingerprints[classification] = fingerprintJson({
      contract_version: "foundation-release-diff-set/v1",
      set_name: classification,
      items: setItems,
      prior_source_release_fingerprint: input.prior_release.fingerprint,
      new_source_release_fingerprint: input.new_release.fingerprint,
      prior_dataset_projection_fingerprint: input.prior_head.fingerprint,
      release_scope_evidence_fingerprint: input.scope_evidence.fingerprint,
      contract_versions: input.contract_versions,
      environment: input.environment,
    } as JsonValue);
  }
  const categoryCounts: Record<string, number> = {};
  for (const item of items) if (item.reason_category) {
    categoryCounts[item.reason_category] = (categoryCounts[item.reason_category] ?? 0) + 1;
  }
  const beforeProjectionFingerprint = projectionFingerprint(input, new Map());
  const proposedProjectionFingerprint = projectionFingerprint(input, proposed);
  const reportBody = {
    contract_version: foundationReleaseDiffContractVersion,
    import_run_id: input.import_run_id,
    prior_source_release_id: input.prior_release.id,
    prior_source_release_fingerprint: input.prior_release.fingerprint,
    new_source_release_id: input.new_release.id,
    new_source_release_fingerprint: input.new_release.fingerprint,
    prior_dataset_projection_head_id: input.prior_head.id,
    prior_dataset_projection_head_version: input.prior_head.version,
    prior_dataset_projection_fingerprint: input.prior_head.fingerprint,
    release_scope_evidence_id: input.scope_evidence.id,
    release_scope_evidence_fingerprint: input.scope_evidence.fingerprint,
    environment: input.environment,
    items,
    exact_set_fingerprints: exactSetFingerprints,
    exact_set_counts: exactSetCounts,
    category_counts: Object.fromEntries(Object.entries(categoryCounts).sort()),
    before_projection_fingerprint: beforeProjectionFingerprint,
    proposed_projection_fingerprint: proposedProjectionFingerprint,
    contract_versions: input.contract_versions,
  } as const;
  return {
    ...reportBody,
    report_fingerprint: fingerprintJson(reportBody as JsonValue),
  };
}

export function serializeFoundationReleaseDiff(report: FoundationLifecycleDiffReport) {
  return `${canonicalizeJson(report as JsonValue)}\n`;
}
