import { createHash } from "node:crypto";
import {
  fingerprintSourceReleaseManifest,
  parseSourceReleaseManifest,
  type SourceReleaseManifestV1,
} from "../../contracts/source-release-manifest.ts";
import {
  foundationRejectPolicyVersion,
  foundationSchemaContractVersion,
  foundationSafetyBounds,
} from "./contract.ts";
import {
  normalizeFoundationArchive,
  type NormalizedFoundationRecord,
} from "./normalization.ts";
import {
  FoundationValidationError,
  parseFoundationArchive,
} from "./parser.ts";
import {
  createFoundationDryRunReport,
  type FoundationDryRunReport,
} from "./report.ts";

export type FoundationDryRunResult = {
  manifest: SourceReleaseManifestV1;
  manifestFingerprint: string;
  archive: ReturnType<typeof parseFoundationArchive>;
  accepted: readonly NormalizedFoundationRecord[];
  rejected: ReturnType<typeof normalizeFoundationArchive>["rejected"];
  report: FoundationDryRunReport;
};

function verifyManifestScope(manifest: SourceReleaseManifestV1) {
  if (
    manifest.source_code !== "usda" ||
    manifest.dataset_code !== "usda_fdc_foundation" ||
    manifest.distributor_code !== "usda_fdc_direct" ||
    manifest.transformation_code !== null ||
    manifest.transformation_release_identifier !== null ||
    manifest.acquisition_method !== "official_bulk_download" ||
    manifest.file_format !== "json" ||
    manifest.schema_contract_version !== foundationSchemaContractVersion ||
    manifest.reject_policy_version !== foundationRejectPolicyVersion ||
    !manifest.official_url.startsWith("https://fdc.nal.usda.gov/") ||
    !manifest.authorized_delivery_url.startsWith("https://fdc.nal.usda.gov/")
  ) {
    throw new FoundationValidationError(
      "invalid_manifest_scope",
      "Manifest is not an approved USDA Foundation JSON declaration.",
    );
  }
  if (
    manifest.compressed_size > foundationSafetyBounds.maximumArchiveBytes ||
    manifest.uncompressed_size > foundationSafetyBounds.maximumJsonBytes
  ) {
    throw new FoundationValidationError(
      "source_file_size_mismatch",
      "Manifest sizes exceed the local Foundation safety bounds.",
    );
  }
}

export function sha256Bytes(value: Uint8Array) {
  return createHash("sha256").update(value).digest("hex");
}

export function runFoundationDryRun(input: {
  manifest: unknown;
  archiveBytes: Uint8Array;
  jsonText: string;
}): FoundationDryRunResult {
  const manifest = parseSourceReleaseManifest(input.manifest);
  verifyManifestScope(manifest);
  if (input.archiveBytes.byteLength !== manifest.compressed_size) {
    throw new FoundationValidationError(
      "archive_size_mismatch",
      "Archive byte size does not match the manifest.",
    );
  }
  if (sha256Bytes(input.archiveBytes) !== manifest.sha256) {
    throw new FoundationValidationError(
      "archive_checksum_mismatch",
      "Archive SHA-256 does not match the manifest.",
    );
  }
  if (Buffer.byteLength(input.jsonText, "utf8") !== manifest.uncompressed_size) {
    throw new FoundationValidationError(
      "source_file_size_mismatch",
      "Extracted JSON byte size does not match the manifest.",
    );
  }

  const manifestFingerprint = fingerprintSourceReleaseManifest(manifest);
  const archive = parseFoundationArchive(input.jsonText, {
    maximumInputBytes: manifest.uncompressed_size,
  });
  const normalized = normalizeFoundationArchive(archive);
  const report = createFoundationDryRunReport({
    manifestFingerprint,
    archive,
    accepted: normalized.accepted,
    rejected: normalized.rejected,
  });

  return {
    manifest,
    manifestFingerprint,
    archive,
    accepted: normalized.accepted,
    rejected: normalized.rejected,
    report,
  };
}
