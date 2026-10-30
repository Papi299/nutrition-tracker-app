import { canonicalizeJson, isPlainObject, type JsonValue } from "../canonical-json.ts";
import { foundationSafetyBounds } from "../contract.ts";
import { FoundationValidationError } from "../parser.ts";

export const full35ImporterVersion = "usda-foundation-importer/v3" as const;
export const full35CandidateVersion = "foundation-normalized-candidate/v2" as const;
export const full35ReportVersion = "foundation-dry-run-report/v3" as const;

export type Full35Failure =
  | "source_identity_mismatch" | "accepted_set_mismatch" | "mapping_contract_mismatch"
  | "duplicate_target_nutrient" | "unsupported_target_unit" | "source_definition_mismatch"
  | "malformed_target_nutrient" | "negative_target_value" | "trace_target_blocked"
  | "target_precision_exceeded" | "target_range_exceeded" | "evidence_mismatch"
  | "normalized_candidate_too_large";

export function full35Fail(category: Full35Failure): never {
  // Bounded category-only diagnostics never echo source rows or caller input.
  throw new FoundationValidationError(category, `Full35 qualification failed: ${category}.`, "record");
}

export function exactObject(value: unknown, keys: readonly string[], category: Full35Failure) {
  if (!isPlainObject(value) ||
    JSON.stringify(Object.keys(value).sort()) !== JSON.stringify([...keys].sort())) full35Fail(category);
  return value;
}

export function assertHash(value: unknown, category: Full35Failure): asserts value is string {
  if (typeof value !== "string" || !/^[a-f0-9]{64}$/.test(value)) full35Fail(category);
}

export function assertUuid(value: unknown) {
  if (typeof value !== "string" ||
    !/^[a-f0-9]{8}-[a-f0-9]{4}-[1-5][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(value)) {
    full35Fail("source_identity_mismatch");
  }
}

export function assertCandidateSize(value: JsonValue) {
  const bytes = Buffer.byteLength(canonicalValidationJson(value), "utf8");
  if (bytes > foundationSafetyBounds.maximumCandidateBytes) full35Fail("normalized_candidate_too_large");
  return bytes;
}

export function canonicalValidationJson(value: unknown) {
  try { return canonicalizeJson(value as JsonValue); }
  catch { return full35Fail("evidence_mismatch"); }
}

export type Full35SourceIdentity = {
  source_release_id: string;
  manifest_fingerprint: string;
  archive_sha256: string;
  json_sha256: string;
  accepted_identity_set_hash: string;
};

export type Full35RecordIdentity = {
  fdc_id: string;
  source_record_id: string;
  source_version_id: string;
  raw_content_sha256: string;
};

export function validateSourceIdentity(value: Full35SourceIdentity) {
  exactObject(value, ["source_release_id", "manifest_fingerprint", "archive_sha256", "json_sha256", "accepted_identity_set_hash"], "source_identity_mismatch");
  assertUuid(value.source_release_id);
  for (const [key, field] of Object.entries(value)) {
    if (key !== "source_release_id") assertHash(field, "source_identity_mismatch");
  }
}

export function validateRecordIdentity(value: Full35RecordIdentity) {
  exactObject(value, ["fdc_id", "source_record_id", "source_version_id", "raw_content_sha256"], "source_identity_mismatch");
  if (!/^[1-9][0-9]*$/.test(value.fdc_id) || !Number.isSafeInteger(Number(value.fdc_id))) full35Fail("source_identity_mismatch");
  assertUuid(value.source_record_id);
  assertUuid(value.source_version_id);
  assertHash(value.raw_content_sha256, "source_identity_mismatch");
}
