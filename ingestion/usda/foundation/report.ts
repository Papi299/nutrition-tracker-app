import { fingerprintJson, type JsonValue } from "./canonical-json.ts";
import {
  foundationImporterContractVersion,
  foundationRejectPolicyVersion,
  foundationReportContractVersion,
} from "./contract.ts";
import {
  foundationNutrientMappingHash,
  foundationNutrientMappingVersion,
} from "./nutrient-mapping.ts";
import type { ParsedFoundationArchive } from "./parser.ts";
import type {
  FoundationRecordReject,
  NormalizedFoundationRecord,
} from "./normalization.ts";

export type FoundationAcceptedRecordSetEntry = {
  source_row_key: string;
  raw_content_sha256: string;
  normalized_candidate_content_fingerprint: string;
  concept_key: string | null;
  upstream_version_key: string;
};

export type FoundationRejectedRecordSetEntry = {
  source_row_key: string;
  raw_content_sha256: string;
  reject_category: string;
};

export type FoundationWarningRecordSetEntry = {
  source_row_key: string;
  warning_categories: readonly string[];
};

function increment(counts: Map<string, number>, category: string, by = 1) {
  counts.set(category, (counts.get(category) ?? 0) + by);
}

function sortedCounts(counts: Map<string, number>) {
  return Object.fromEntries(
    [...counts].sort(([left], [right]) => Buffer.compare(
      Buffer.from(left, "utf8"),
      Buffer.from(right, "utf8"),
    )),
  );
}

function compareUtf8(left: string, right: string) {
  return Buffer.compare(Buffer.from(left, "utf8"), Buffer.from(right, "utf8"));
}

function rawSourceRowKey(raw: ParsedFoundationArchive["records"][number]) {
  const fdcId = raw.raw.fdcId;
  return typeof fdcId === "number" && Number.isSafeInteger(fdcId)
    ? `fdc:${fdcId}`
    : `record:${raw.index + 1}`;
}

export function createFoundationRecordSetEvidence(input: {
  archive: ParsedFoundationArchive;
  accepted: readonly NormalizedFoundationRecord[];
  rejected: readonly FoundationRecordReject[];
}) {
  const rawHashes = new Map(
    input.archive.records.map((raw) => [rawSourceRowKey(raw), raw.rawContentSha256]),
  );
  const accepted = input.accepted
    .map(({ raw, candidate }) => ({
      source_row_key: candidate.source_row_key,
      raw_content_sha256: raw.rawContentSha256,
      normalized_candidate_content_fingerprint: candidate.content_fingerprint,
      concept_key: candidate.concept_key,
      upstream_version_key: candidate.upstream_version_key,
    }))
    .sort((left, right) => compareUtf8(left.source_row_key, right.source_row_key));
  const rejected = input.rejected
    .map((reject) => ({
      source_row_key: reject.source_row_key,
      raw_content_sha256:
        rawHashes.get(reject.source_row_key) ??
        (() => {
          throw new Error("Rejected Foundation row is missing raw hash evidence.");
        })(),
      reject_category: reject.category,
    }))
    .sort((left, right) => compareUtf8(left.source_row_key, right.source_row_key));
  const warningRows: FoundationWarningRecordSetEntry[] = input.accepted
    .filter(({ candidate }) => candidate.warning_categories.length > 0)
    .map(({ candidate }) => ({
      source_row_key: candidate.source_row_key,
      warning_categories: [...candidate.warning_categories].sort(),
    }));
  for (let index = 0; index < input.archive.trailingNullPaddingCount; index += 1) {
    warningRows.push({
      source_row_key: `collection:trailing-null:${index + 1}`,
      warning_categories: ["known_trailing_null_collection_entry"],
    });
  }
  const warning = warningRows.sort((left, right) =>
    compareUtf8(left.source_row_key, right.source_row_key),
  );

  return {
    accepted,
    rejected,
    warning,
    acceptedRecordSetFingerprint: fingerprintJson(accepted as JsonValue),
    rejectedRecordSetFingerprint: fingerprintJson(rejected as JsonValue),
    warningRecordSetFingerprint: fingerprintJson(warning as JsonValue),
  };
}

export function createFoundationDryRunReport(input: {
  manifestFingerprint: string;
  archive: ParsedFoundationArchive;
  accepted: readonly NormalizedFoundationRecord[];
  rejected: readonly FoundationRecordReject[];
}) {
  const recordSets = createFoundationRecordSetEvidence(input);
  const warnings = new Map<string, number>();
  const rejects = new Map<string, number>();
  const identities = new Map<string, number>();
  const energyMethods = new Map<string, number>();
  const coverage = new Map<string, number>();
  const explicitZeros = new Map<string, number>();
  const traces = new Map<string, number>();
  let unsupportedNutrientCount = 0;
  let portionCount = 0;
  let recordsWithPortions = 0;
  let maximumNormalizedCandidateBytes = 0;

  if (input.archive.trailingNullPaddingCount > 0) {
    increment(
      warnings,
      "known_trailing_null_collection_entry",
      input.archive.trailingNullPaddingCount,
    );
  }
  for (const reject of input.rejected) increment(rejects, reject.category);
  for (const normalized of input.accepted) {
    const candidate = normalized.candidate;
    increment(identities, candidate.concept_identity_status);
    increment(
      energyMethods,
      candidate.selected_energy_method ?? "unknown",
    );
    for (const warning of candidate.warning_categories) increment(warnings, warning);
    for (const [code, nutrient] of Object.entries(candidate.nutrients)) {
      if (nutrient.semantic !== "missing") increment(coverage, code);
      if (nutrient.semantic === "explicit_zero") increment(explicitZeros, code);
      if (nutrient.semantic === "trace") increment(traces, code);
    }
    unsupportedNutrientCount += candidate.unsupported_nutrient_count;
    portionCount += candidate.portion_candidates.length;
    if (candidate.portion_candidates.length > 0) recordsWithPortions += 1;
    maximumNormalizedCandidateBytes = Math.max(
      maximumNormalizedCandidateBytes,
      normalized.normalizedBytes,
    );
  }

  const deterministic = {
    report_contract_version: foundationReportContractVersion,
    manifest_fingerprint: input.manifestFingerprint,
    schema_contract_version: input.archive.schemaContractVersion,
    schema_contract_hash: input.archive.schemaContractHash,
    importer_contract_version: foundationImporterContractVersion,
    nutrient_mapping_version: foundationNutrientMappingVersion,
    nutrient_mapping_hash: foundationNutrientMappingHash,
    reject_policy_version: foundationRejectPolicyVersion,
    accepted_record_set_fingerprint:
      recordSets.acceptedRecordSetFingerprint,
    rejected_record_set_fingerprint:
      recordSets.rejectedRecordSetFingerprint,
    warning_record_set_fingerprint:
      recordSets.warningRecordSetFingerprint,
    source_count: input.archive.records.length,
    accepted_count: input.accepted.length,
    rejected_count: input.rejected.length,
    warning_count:
      [...warnings.values()].reduce((sum, value) => sum + value, 0),
    reject_category_counts: sortedCounts(rejects),
    warning_category_counts: sortedCounts(warnings),
    concept_identity_status_counts: sortedCounts(identities),
    nutrient_coverage_counts: sortedCounts(coverage),
    energy_method_counts: sortedCounts(energyMethods),
    explicit_zero_counts: sortedCounts(explicitZeros),
    trace_loq_counts: sortedCounts(traces),
    portion_counts: {
      records_with_portions: recordsWithPortions,
      total_portions: portionCount,
    },
    unsupported_nutrient_count: unsupportedNutrientCount,
    duplicate_identity_counts: {
      concept: 0,
      version: 0,
    },
    trailing_null_collection_entry_count:
      input.archive.trailingNullPaddingCount,
    maximum_raw_record_bytes: input.archive.maximumRawRecordBytes,
    maximum_normalized_candidate_bytes: maximumNormalizedCandidateBytes,
    observed_schema_fingerprint: input.archive.observedSchemaFingerprint,
  } as const;

  return {
    ...deterministic,
    report_fingerprint: fingerprintJson(deterministic as JsonValue),
  };
}

export type FoundationDryRunReport = ReturnType<
  typeof createFoundationDryRunReport
>;

export function serializeFoundationDryRunReport(report: FoundationDryRunReport) {
  return `${JSON.stringify(report, null, 2)}\n`;
}
