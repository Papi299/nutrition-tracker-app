import { fingerprintJson, type JsonValue } from "./canonical-json.ts";
import { foundationImporterContractVersion } from "./contract.ts";
import type { FoundationDryRunResult } from "./dry-run.ts";
import { foundationNutrientMappingVersion } from "./nutrient-mapping.ts";

export function createFoundationStagingPlan(result: FoundationDryRunResult) {
  const logicalRunFingerprint = fingerprintJson({
    manifest_fingerprint: result.manifestFingerprint,
    importer_contract_version: foundationImporterContractVersion,
    nutrient_mapping_version: foundationNutrientMappingVersion,
    report_fingerprint: result.report.report_fingerprint,
  });

  return {
    logicalRunFingerprint,
    importerContractVersion: foundationImporterContractVersion,
    nutrientMappingVersion: foundationNutrientMappingVersion,
    terminalState: result.rejected.length === 0 ? "validated" : "failed",
    rawRecords: result.archive.records.map((raw) => ({
      sourceRowKey:
        typeof raw.raw.fdcId === "number" && Number.isSafeInteger(raw.raw.fdcId)
          ? `fdc:${raw.raw.fdcId}`
          : `record:${raw.index + 1}`,
      payloadSha256: raw.rawContentSha256,
      rawPayload: raw.raw,
    })),
    candidates: result.accepted.map(({ candidate }) => ({
      sourceRowKey: candidate.source_row_key,
      conceptKey: candidate.concept_key,
      upstreamVersionKey: candidate.upstream_version_key,
      normalizedContentSha256: candidate.content_fingerprint,
      normalizedCandidate: candidate,
      validationStatus: "accepted" as const,
      warningCount: candidate.warning_categories.length,
    })),
    items: [
      ...result.accepted.map(({ candidate }) => ({
        sourceRowKey: candidate.source_row_key,
        action: "accept" as const,
        outcome: "accepted" as const,
        category: null,
      })),
      ...result.rejected.map((reject) => ({
        sourceRowKey: reject.source_row_key,
        action: "reject" as const,
        outcome: "rejected" as const,
        category: reject.category,
      })),
      ...result.accepted.flatMap(({ candidate }) =>
        candidate.warning_categories.map((category) => ({
          sourceRowKey: candidate.source_row_key,
          action: "warning" as const,
          outcome: "warning" as const,
          category,
        })),
      ),
      ...Array.from(
        { length: result.archive.trailingNullPaddingCount },
        (_, index) => ({
          sourceRowKey: `collection:trailing-null:${index + 1}`,
          action: "warning" as const,
          outcome: "warning" as const,
          category: "known_trailing_null_collection_entry",
        }),
      ),
    ],
    counts: {
      source: result.report.source_count,
      accepted: result.report.accepted_count,
      rejected: result.report.rejected_count,
      inserted: 0,
      updated: 0,
      archived: 0,
      unchanged: 0,
      warnings: result.report.warning_count,
    },
  } as const satisfies JsonValue;
}
