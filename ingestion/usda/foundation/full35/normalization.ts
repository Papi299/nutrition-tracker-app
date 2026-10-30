import {
  canonicalizeJson, deepFreezeJson, fingerprintJson, isPlainObject, type JsonValue,
} from "../canonical-json.ts";
import { foundationSafetyBounds, foundationSchemaContractVersion } from "../contract.ts";
import {
  boundedOptionalString, canonicalPublicationDate, parsePortions, positiveSafeIdentifier,
  type FoundationPortionCandidate,
} from "../normalization.ts";
import { canonicalDecimal, parseFoundationArchive, type ParsedFoundationRecord } from "../parser.ts";
import {
  assertCandidateSize, canonicalValidationJson, exactObject, full35CandidateVersion, full35Fail,
  full35ImporterVersion, validateRecordIdentity, validateSourceIdentity,
  type Full35RecordIdentity, type Full35SourceIdentity,
} from "./contract.ts";
import { full35Mapping, full35MappingHash, type Full35Code, type Full35Unit } from "./mapping.ts";

type Semantic = "source_reported" | "source_calculated" | "explicit_zero";
export type Full35NutrientEvidence = {
  application_nutrient_code: Full35Code;
  source_nutrient_id: string;
  source_nutrient_name: string;
  source_unit: string;
  source_value: string;
  application_unit: Full35Unit;
  basis: "per_100g";
  semantic: Semantic;
  derivation_code: string | null;
  derivation_description: string | null;
  footnote: string | null;
  loq: string | null;
  raw_field_path: string;
  exact_conversion_factor: null;
  evidence_hash: string;
};
export type Full35State = {
  application_nutrient_code: Full35Code;
  application_unit: Full35Unit;
  basis: "per_100g";
  semantic: Semantic | "missing";
  value: string | null;
  missing_reason: "source_absent" | "unavailable_in_approved_source" | "semantic_hold" | null;
  evidence_hash: string | null;
};
export type Full35Candidate = {
  candidate_contract_version: typeof full35CandidateVersion;
  importer_contract_version: typeof full35ImporterVersion;
  dataset_code: "usda_fdc_foundation";
  schema_contract_version: typeof foundationSchemaContractVersion;
  mapping_version: typeof full35Mapping.version_code;
  mapping_hash: string;
  source_identity: Full35SourceIdentity;
  record_identity: Full35RecordIdentity;
  raw_record_path: string;
  fdc_id: string;
  ndb_number: string | null;
  source_row_key: string;
  concept_key: string | null;
  upstream_version_key: string;
  name: string;
  publication_date: string;
  nutrient_basis: "per_100g";
  nutrients: Record<Full35Code, Full35State>;
  nutrient_evidence: readonly Full35NutrientEvidence[];
  evidence_set_hash: string;
  selected_energy_method: "atwater_specific_2048" | "atwater_general_2047" | null;
  portion_candidates: readonly FoundationPortionCandidate[];
  source_metadata: {
    scientific_name: string | null;
    category: string | null;
    is_historical_reference: boolean | null;
    input_food_count: number;
    nutrient_conversion_factor_count: number;
  };
  unsupported_nutrient_count: number;
  warning_categories: readonly string[];
  content_fingerprint: string;
};

function optionalEvidenceText(value: unknown, maximum: number) {
  if (value === undefined) return null;
  if (typeof value !== "string" || value.length > maximum) full35Fail("malformed_target_nutrient");
  return value;
}

function referenceDecimal(value: unknown) {
  if (typeof value !== "number" || !Number.isFinite(value)) full35Fail("malformed_target_nutrient");
  if (value < 0) full35Fail("negative_target_value");
  const decimal = canonicalDecimal(value);
  const [integer, fraction = ""] = decimal.split(".");
  if (integer.length > 10) full35Fail("target_range_exceeded");
  if (fraction.length > 4) full35Fail("target_precision_exceeded");
  return decimal;
}

function nutrientEvidence(
  item: Record<string, unknown>, path: string,
  target: (typeof full35Mapping.mappings)[number], expected: { id: string; name: string },
): Full35NutrientEvidence {
  const nutrient = item.nutrient as Record<string, unknown>;
  if (nutrient.name !== expected.name) full35Fail("source_definition_mismatch");
  const aliases: readonly string[] = full35Mapping.unit_aliases[target.application_unit];
  if (typeof nutrient.unitName !== "string" || !aliases.includes(nutrient.unitName)) full35Fail("unsupported_target_unit");
  const amount = referenceDecimal(item.amount);
  const derivation = item.foodNutrientDerivation;
  if (derivation !== undefined && !isPlainObject(derivation)) full35Fail("malformed_target_nutrient");
  const code = optionalEvidenceText(derivation?.code, 40);
  const description = optionalEvidenceText(derivation?.description, 200);
  const footnote = optionalEvidenceText(item.footnote, 200);
  const loq = item.loq;
  if (loq !== undefined && (typeof loq !== "number" || !Number.isFinite(loq) || loq < 0)) full35Fail("malformed_target_nutrient");
  if ((typeof loq === "number" && loq > 0) || (footnote !== null && /^\s*</.test(footnote))) {
    full35Fail(amount === "0" ? "trace_target_blocked" : "malformed_target_nutrient");
  }
  const semantic: Semantic = amount === "0" ? "explicit_zero" :
    code === "NC" || code === "AS" ? "source_calculated" : "source_reported";
  const body = {
    application_nutrient_code: target.application_nutrient_code,
    source_nutrient_id: expected.id, source_nutrient_name: expected.name,
    source_unit: nutrient.unitName, source_value: amount,
    application_unit: target.application_unit, basis: "per_100g" as const,
    semantic, derivation_code: code, derivation_description: description, footnote,
    loq: typeof loq === "number" ? canonicalDecimal(loq) : null,
    raw_field_path: path, exact_conversion_factor: null,
  };
  return { ...body, evidence_hash: fingerprintJson(body) };
}

export function normalizeFoundationFull35Record(
  record: ParsedFoundationRecord,
  source: Full35SourceIdentity,
  identity: Full35RecordIdentity | undefined,
): Full35Candidate {
  validateSourceIdentity(source);
  if (!Number.isSafeInteger(record.index) || record.index < 0 || record.index >= foundationSafetyBounds.maximumRecords) full35Fail("source_identity_mismatch");
  // Reapply the unchanged strict schema to caller-supplied parsed records too.
  const verified = parseFoundationArchive(JSON.stringify({ FoundationFoods: [record.raw] })).records[0];
  if (verified.rawContentSha256 !== record.rawContentSha256 || verified.rawBytes !== record.rawBytes) full35Fail("source_identity_mismatch");
  const raw = record.raw;
  const fdc = positiveSafeIdentifier(raw.fdcId, "invalid_fdc_id");
  if (typeof raw.description !== "string" || raw.description.trim().length === 0 || raw.description.length > foundationSafetyBounds.maximumDescriptionLength) full35Fail("malformed_target_nutrient");
  const ndb = raw.ndbNumber === undefined ? null : positiveSafeIdentifier(raw.ndbNumber, "ambiguous_source_identity");
  const items = raw.foodNutrients as Record<string, unknown>[];
  const index = new Map<string, { item: Record<string, unknown>; offset: number }[]>();
  items.forEach((item, offset) => {
    if (!isPlainObject(item) || !isPlainObject(item.nutrient) || !Number.isSafeInteger(item.nutrient.id) || (item.nutrient.id as number) <= 0) full35Fail("malformed_target_nutrient");
    const id = String(item.nutrient.id);
    index.set(id, [...(index.get(id) ?? []), { item, offset }]);
  });
  const nutrients = {} as Record<Full35Code, Full35State>;
  const evidence: Full35NutrientEvidence[] = [];
  let eligibleCount = 0;
  for (const target of full35Mapping.mappings) {
    const methods: Full35NutrientEvidence[] = [];
    for (const definition of target.sources) {
      const entries = index.get(definition.id) ?? [];
      if (entries.length > 1) full35Fail("duplicate_target_nutrient");
      if (entries.length === 0) continue;
      eligibleCount += 1;
      methods.push(nutrientEvidence(entries[0].item,
        `FoundationFoods[${record.index}].foodNutrients[${entries[0].offset}]`, target, definition));
    }
    evidence.push(...methods);
    const selected = methods[0]; // Ordered mapping validates both energy methods before selection.
    nutrients[target.application_nutrient_code] = {
      application_nutrient_code: target.application_nutrient_code,
      application_unit: target.application_unit, basis: "per_100g",
      semantic: selected?.semantic ?? "missing", value: selected?.source_value ?? null,
      missing_reason: selected ? null : target.missing_reason,
      evidence_hash: selected?.evidence_hash ?? null,
    };
  }
  // An identity must come from the caller's frozen set, never a generated substitute.
  if (!identity) full35Fail("accepted_set_mismatch");
  validateRecordIdentity(identity);
  if (identity.fdc_id !== fdc || identity.raw_content_sha256 !== record.rawContentSha256) full35Fail("source_identity_mismatch");
  evidence.sort((a, b) => a.application_nutrient_code < b.application_nutrient_code ? -1 :
    a.application_nutrient_code > b.application_nutrient_code ? 1 : Number(a.source_nutrient_id) - Number(b.source_nutrient_id));
  const portions = parsePortions(raw.foodPortions);
  const selectedId = evidence.find(e => e.evidence_hash === nutrients.energy_kcal.evidence_hash)?.source_nutrient_id;
  const warnings = [
    ...(Object.values(nutrients).some(n => n.semantic === "missing" && n.missing_reason === "source_absent") ? ["missing_direct_nutrients"] : []),
    "policy_withheld_nutrients",
    ...(evidence.filter(e => e.application_nutrient_code === "energy_kcal").length > 1 ? ["alternative_energy_methods_retained"] : []),
    ...(items.length > eligibleCount ? ["unsupported_nutrients_retained_in_raw"] : []),
    ...(portions.sourceSequenceRebased ? ["source_portion_sequence_rebased"] : []),
  ].sort();
  if (warnings.length > foundationSafetyBounds.maximumWarningCategories) full35Fail("normalized_candidate_too_large");
  const body = {
    candidate_contract_version: full35CandidateVersion, importer_contract_version: full35ImporterVersion,
    dataset_code: "usda_fdc_foundation" as const, schema_contract_version: foundationSchemaContractVersion,
    mapping_version: full35Mapping.version_code, mapping_hash: full35MappingHash,
    source_identity: { ...source }, record_identity: { ...identity }, raw_record_path: `FoundationFoods[${record.index}]`,
    fdc_id: fdc, ndb_number: ndb, source_row_key: `fdc:${fdc}`,
    concept_key: ndb === null ? null : `foundation:ndb:${ndb}`, upstream_version_key: `fdc:${fdc}`,
    name: raw.description, publication_date: canonicalPublicationDate(raw.publicationDate), nutrient_basis: "per_100g" as const,
    nutrients, nutrient_evidence: evidence, evidence_set_hash: fingerprintJson(evidence),
    selected_energy_method: selectedId === "2048" ? "atwater_specific_2048" as const : selectedId === "2047" ? "atwater_general_2047" as const : null,
    portion_candidates: portions.portions,
    source_metadata: {
      scientific_name: boundedOptionalString(raw.scientificName, 200),
      category: isPlainObject(raw.foodCategory) ? boundedOptionalString(raw.foodCategory.description, 200) : null,
      is_historical_reference: typeof raw.isHistoricalReference === "boolean" ? raw.isHistoricalReference : null,
      input_food_count: Array.isArray(raw.inputFoods) ? raw.inputFoods.length : 0,
      nutrient_conversion_factor_count: Array.isArray(raw.nutrientConversionFactors) ? raw.nutrientConversionFactors.length : 0,
    },
    unsupported_nutrient_count: items.length - eligibleCount, warning_categories: warnings,
  };
  const candidate = { ...body, content_fingerprint: fingerprintJson(body) };
  assertCandidateSize(candidate);
  return deepFreezeJson(candidate);
}

// Validation needs the independently supplied raw record and identity; a freshly
// rehashed candidate alone cannot authorize its own evidence or missing decisions.
export function parseNormalizedFoundationFull35Candidate(
  value: unknown, record: ParsedFoundationRecord, source: Full35SourceIdentity,
  identity: Full35RecordIdentity,
): Full35Candidate {
  if (!isPlainObject(value) || value.candidate_contract_version !== full35CandidateVersion ||
    value.importer_contract_version !== full35ImporterVersion ||
    value.mapping_version !== full35Mapping.version_code || value.mapping_hash !== full35MappingHash) full35Fail("mapping_contract_mismatch");
  assertCandidateSize(value as JsonValue);
  const expected = normalizeFoundationFull35Record(record, source, identity);
  exactObject(value, Object.keys(expected), "evidence_mismatch");
  if (canonicalValidationJson(value) !== canonicalizeJson(expected)) full35Fail("evidence_mismatch");
  return expected;
}
