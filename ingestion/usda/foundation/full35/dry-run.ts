import { fingerprintSourceReleaseManifest, parseSourceReleaseManifest } from "../../../contracts/source-release-manifest.ts";
import { foundationRejectPolicyVersion, foundationSafetyBounds, foundationSchemaContractVersion } from "../contract.ts";
import { sha256Bytes } from "../dry-run.ts";
import { parseFoundationArchive } from "../parser.ts";
import { extractFoundationFull35Json } from "./archive.ts";
import { assertHash, assertUuid, full35Fail, type Full35RecordIdentity } from "./contract.ts";
import { createFoundationFull35Report, fingerprintFull35IdentitySet } from "./report.ts";

// Explicitly separate offline API; no filesystem/network/database/staging or
// approval interface. The caller supplies already frozen identity evidence.
export function runFoundationFull35DryRun(input: {
  manifest: unknown;
  archiveBytes: Uint8Array;
  expectedJsonSha256: string;
  sourceReleaseId: string;
  identities: readonly Full35RecordIdentity[];
}) {
  const manifest = parseSourceReleaseManifest(input.manifest);
  assertUuid(input.sourceReleaseId);
  assertHash(input.expectedJsonSha256, "source_identity_mismatch");
  const official = (value: string) => new URL(value).origin === "https://fdc.nal.usda.gov";
  if (manifest.source_code !== "usda" || manifest.dataset_code !== "usda_fdc_foundation" ||
    manifest.distributor_code !== "usda_fdc_direct" || manifest.transformation_code !== null ||
    manifest.transformation_release_identifier !== null || manifest.acquisition_method !== "official_bulk_download" ||
    manifest.file_format !== "json" || manifest.schema_contract_version !== foundationSchemaContractVersion ||
    manifest.reject_policy_version !== foundationRejectPolicyVersion || manifest.publication_date !== "2026-04-30" ||
    manifest.license_identifier !== "CC0-1.0" || !/^[A-Za-z0-9_-]+\.zip$/.test(manifest.archive_name) ||
    !official(manifest.official_url) || !official(manifest.authorized_delivery_url) ||
    manifest.compressed_size > foundationSafetyBounds.maximumArchiveBytes ||
    manifest.uncompressed_size > foundationSafetyBounds.maximumJsonBytes) full35Fail("source_identity_mismatch");
  if (input.archiveBytes.byteLength !== manifest.compressed_size || sha256Bytes(input.archiveBytes) !== manifest.sha256) full35Fail("source_identity_mismatch");
  const member = manifest.archive_name.replace(/\.zip$/, ".json");
  const jsonText = extractFoundationFull35Json(input.archiveBytes, member);
  const jsonHash = sha256Bytes(Buffer.from(jsonText, "utf8"));
  if (jsonHash !== input.expectedJsonSha256 || Buffer.byteLength(jsonText, "utf8") !== manifest.uncompressed_size) full35Fail("source_identity_mismatch");
  const source = {
    source_release_id: input.sourceReleaseId,
    manifest_fingerprint: fingerprintSourceReleaseManifest(manifest), archive_sha256: manifest.sha256,
    json_sha256: jsonHash, accepted_identity_set_hash: fingerprintFull35IdentitySet(input.identities),
  };
  const archive = parseFoundationArchive(jsonText, { maximumInputBytes: manifest.uncompressed_size });
  return { manifest, source, archive, ...createFoundationFull35Report({ archive, source, identities: input.identities }) };
}
