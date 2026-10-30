import { canonicalizeJson, deepFreezeJson, fingerprintJson } from "../canonical-json.ts";
import { foundationSafetyBounds, foundationSchemaContractHash, foundationSchemaContractVersion } from "../contract.ts";
import { FoundationValidationError, parseFoundationArchive, type ParsedFoundationArchive } from "../parser.ts";
import {
  canonicalValidationJson, full35CandidateVersion, full35Fail, full35ImporterVersion, full35ReportVersion,
  validateRecordIdentity, validateSourceIdentity, type Full35RecordIdentity, type Full35SourceIdentity,
} from "./contract.ts";
import { full35Mapping, full35MappingHash } from "./mapping.ts";
import { normalizeFoundationFull35Record, type Full35Candidate } from "./normalization.ts";

export function fingerprintFull35IdentitySet(identities: readonly Full35RecordIdentity[]) {
  return fingerprintJson([...identities].sort((a, b) => Number(a.fdc_id) - Number(b.fdc_id)));
}

export function createFoundationFull35Report(input: {
  archive: ParsedFoundationArchive;
  source: Full35SourceIdentity;
  identities: readonly Full35RecordIdentity[];
}) {
  validateSourceIdentity(input.source);
  const { archive } = input;
  if (archive.schemaContractVersion !== foundationSchemaContractVersion || archive.schemaContractHash !== foundationSchemaContractHash) full35Fail("source_identity_mismatch");
  if (archive.records.length < 1 || archive.records.length > foundationSafetyBounds.maximumRecords ||
    input.identities.length > foundationSafetyBounds.maximumRecords) full35Fail("source_identity_mismatch");
  if (!Number.isSafeInteger(archive.trailingNullPaddingCount) || archive.trailingNullPaddingCount < 0 ||
    archive.trailingNullPaddingCount > foundationSafetyBounds.maximumTrailingNullPadding ||
    archive.collectionEntryCount !== archive.records.length + archive.trailingNullPaddingCount) full35Fail("source_identity_mismatch");
  const physicalOrder = [...archive.records].sort((a, b) => a.index - b.index);
  if (physicalOrder.some((record, index) => record.index !== index)) full35Fail("source_identity_mismatch");
  const verifiedArchive = parseFoundationArchive(JSON.stringify({
    FoundationFoods: [...physicalOrder.map(record => record.raw), ...Array.from({ length: archive.trailingNullPaddingCount }, () => null)],
  }));
  if (verifiedArchive.observedSchemaFingerprint !== archive.observedSchemaFingerprint ||
    verifiedArchive.maximumRawRecordBytes !== archive.maximumRawRecordBytes ||
    canonicalizeJson(verifiedArchive.observedSchema) !== canonicalizeJson(archive.observedSchema)) full35Fail("source_identity_mismatch");
  const identities = new Map<string, Full35RecordIdentity>();
  const versions = new Set<string>(), sourceRecords = new Set<string>();
  for (const identity of input.identities) {
    validateRecordIdentity(identity);
    if (identities.has(identity.fdc_id) || versions.has(identity.source_version_id) || sourceRecords.has(identity.source_record_id)) full35Fail("accepted_set_mismatch");
    identities.set(identity.fdc_id, identity);
    versions.add(identity.source_version_id); sourceRecords.add(identity.source_record_id);
  }
  if (fingerprintFull35IdentitySet(input.identities) !== input.source.accepted_identity_set_hash) full35Fail("accepted_set_mismatch");
  const rawIds = new Set<string>(), concepts = new Set<string>(), indexes = new Set<number>();
  for (const record of archive.records) {
    const id = String(record.raw.fdcId), concept = record.raw.ndbNumber;
    if (rawIds.has(id) || indexes.has(record.index) || (concept !== undefined && concepts.has(String(concept)))) {
      throw new FoundationValidationError("duplicate_version_identity", "Duplicate source or concept identity.");
    }
    rawIds.add(id); indexes.add(record.index);
    if (concept !== undefined) concepts.add(String(concept));
  }
  if ([...identities.keys()].some(id => !rawIds.has(id))) full35Fail("accepted_set_mismatch");
  const accepted: Full35Candidate[] = [];
  const rejected: { fdc_id: string; raw_content_sha256: string; category: string }[] = [];
  for (const record of [...archive.records].sort((a, b) => Number(a.raw.fdcId) - Number(b.raw.fdcId))) {
    try {
      accepted.push(normalizeFoundationFull35Record(record, input.source, identities.get(String(record.raw.fdcId))));
    } catch (error) {
      if (!(error instanceof FoundationValidationError) || error.scope !== "record") throw error;
      rejected.push({ fdc_id: String(record.raw.fdcId), raw_content_sha256: record.rawContentSha256, category: error.category });
    }
  }
  const coverage = full35Mapping.mappings.map(target => {
    const states = accepted.map(candidate => candidate.nutrients[target.application_nutrient_code]);
    const count = (semantic: string) => states.filter(state => state.semantic === semantic).length;
    const present = states.filter(state => state.semantic !== "missing");
    return {
      application_nutrient_code: target.application_nutrient_code, classification: target.classification,
      present: present.length, missing: count("missing"),
      rejected_unqualified: rejected.length,
      held: states.filter(state => state.missing_reason === "semantic_hold").length,
      unavailable: states.filter(state => state.missing_reason === "unavailable_in_approved_source").length,
      explicit_zero: count("explicit_zero"), source_reported: count("source_reported"), source_calculated: count("source_calculated"),
      evidence: accepted.filter(c => c.nutrients[target.application_nutrient_code].semantic !== "missing").map(c => ({
        fdc_id: c.fdc_id, value: c.nutrients[target.application_nutrient_code].value,
        evidence_hash: c.nutrients[target.application_nutrient_code].evidence_hash,
        candidate_hash: c.content_fingerprint, raw_hash: c.record_identity.raw_content_sha256,
      })),
    };
  });
  const warnings = accepted.filter(c => c.warning_categories.length > 0).map(c => ({ fdc_id: c.fdc_id, categories: c.warning_categories }));
  const body = {
    report_contract_version: full35ReportVersion, importer_contract_version: full35ImporterVersion,
    candidate_contract_version: full35CandidateVersion, dataset_code: "usda_fdc_foundation",
    mapping_version: full35Mapping.version_code, mapping_hash: full35MappingHash,
    source_identity: { ...input.source }, schema_contract_version: archive.schemaContractVersion,
    schema_contract_hash: archive.schemaContractHash, observed_schema_fingerprint: archive.observedSchemaFingerprint,
    executable: false, qualification_status: rejected.length > 0 ? "blocked" : "offline_unapproved",
    source_count: archive.records.length, accepted_count: accepted.length, rejected_count: rejected.length,
    accepted_record_set: accepted.map(c => ({ ...c.record_identity, candidate_hash: c.content_fingerprint, evidence_set_hash: c.evidence_set_hash })),
    rejected_record_set: rejected, warning_record_set: warnings,
    trailing_null_collection_entry_count: archive.trailingNullPaddingCount,
    coverage,
  };
  const report = deepFreezeJson({ ...body, report_fingerprint: fingerprintJson(body) });
  return { report, accepted, rejected };
}

export type Full35Report = ReturnType<typeof createFoundationFull35Report>["report"];

export function parseFoundationFull35Report(value: unknown, input: Parameters<typeof createFoundationFull35Report>[0]): Full35Report {
  const expected = createFoundationFull35Report(input).report;
  if (canonicalValidationJson(value) !== canonicalizeJson(expected)) full35Fail("evidence_mismatch");
  return expected;
}

export function serializeFoundationFull35Report(report: Full35Report) {
  return `${canonicalizeJson(report)}\n`;
}
