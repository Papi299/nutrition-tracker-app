import {
  canonicalizeJson,
  fingerprintJson,
  isPlainObject,
  type JsonValue,
} from "./canonical-json.ts";
import {
  foundationCandidateContractVersion,
  foundationSafetyBounds,
} from "./contract.ts";
import {
  foundationNutrientMappingHash,
  foundationNutrientMappingVersion,
  mappedSourceNutrientIds,
  recognizedEnergyNutrientIds,
} from "./nutrient-mapping.ts";
import {
  canonicalDecimal,
  FoundationValidationError,
  type ParsedFoundationArchive,
  type ParsedFoundationRecord,
} from "./parser.ts";

type WarningCategory =
  | "alternative_energy_method_present"
  | "concept_identity_pending_generation"
  | "missing_energy_kcal"
  | "missing_fat_g"
  | "missing_portions"
  | "missing_protein_g"
  | "missing_carbohydrates_g"
  | "source_portion_sequence_rebased"
  | "unsupported_nutrients_present";

type NutrientSemantic =
  | "explicit_zero"
  | "missing"
  | "source_calculated"
  | "source_reported"
  | "trace";

export type FoundationNutrientProjection = {
  application_nutrient_code: string;
  source_nutrient_id: string | null;
  source_unit: string | null;
  value: string | null;
  semantic: NutrientSemantic;
  loq: string | null;
  derivation_code: string | null;
  derivation_description: string | null;
};

export type FoundationPortionCandidate = {
  ordinal: number;
  source_sequence_number: number;
  source_portion_id: string;
  amount: string;
  measure_unit_id: string;
  measure_unit_name: string;
  measure_unit_abbreviation: string;
  portion_description: string | null;
  modifier: string | null;
  gram_weight: string;
  source_value: string | null;
  minimum_year_acquired: number | null;
};

export type FoundationNormalizedCandidate = {
  candidate_contract_version: typeof foundationCandidateContractVersion;
  dataset_code: "usda_fdc_foundation";
  schema_contract_version: "usda-fdc-foundation-json/v1";
  mapping_version: typeof foundationNutrientMappingVersion;
  mapping_hash: string;
  source_row_key: string;
  concept_key: string | null;
  concept_identity_status: "source_supplied" | "generate_on_first_promotion";
  upstream_version_key: string;
  fdc_id: string;
  ndb_number: string | null;
  publication_date: string;
  data_type: "Foundation";
  food_class: "FinalFood";
  name: string;
  locale: "en";
  food_type: "generic";
  brand: null;
  nutrient_basis: "per_100g";
  nutrients: {
    energy_kcal: FoundationNutrientProjection;
    protein_g: FoundationNutrientProjection;
    carbohydrates_g: FoundationNutrientProjection;
    fat_g: FoundationNutrientProjection;
  };
  energy_evidence: readonly FoundationNutrientProjection[];
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
  warning_categories: readonly WarningCategory[];
  content_fingerprint: string;
};

export type NormalizedFoundationRecord = {
  raw: ParsedFoundationRecord;
  candidate: FoundationNormalizedCandidate;
  normalizedBytes: number;
};

export type FoundationRecordReject = {
  source_row_key: string;
  category: string;
};

function recordFail(category: string, message: string): never {
  throw new FoundationValidationError(category, message, "record");
}

function positiveSafeIdentifier(value: unknown, category: string) {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value <= 0) {
    recordFail(category, "Source identifier must be a positive safe integer.");
  }
  return String(value);
}

function boundedOptionalString(value: unknown, maximum: number) {
  if (value === undefined || value === null) return null;
  if (
    typeof value !== "string" ||
    value.length > maximum
  ) {
    recordFail("schema_contract_mismatch", "Optional source text is invalid.");
  }
  return value.trim().length === 0 ? null : value;
}

function canonicalPublicationDate(value: unknown) {
  if (typeof value !== "string") {
    recordFail("invalid_publication_date", "Publication date must be text.");
  }
  const match = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(value);
  if (!match) {
    recordFail("invalid_publication_date", "Publication date is not USDA M/D/YYYY.");
  }
  const month = Number(match[1]);
  const day = Number(match[2]);
  const year = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    recordFail("invalid_publication_date", "Publication date is impossible.");
  }
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function nutrientSemantic(
  amount: number,
  loq: number | undefined,
  footnote: string | undefined,
  derivationCode: string | null,
): NutrientSemantic {
  const hasTraceFootnote = typeof footnote === "string" && /^\s*</.test(footnote);
  if (loq !== undefined && (!Number.isFinite(loq) || loq < 0)) {
    recordFail("malformed_target_nutrient", "LOQ must be finite and nonnegative.");
  }
  if ((loq !== undefined && loq > 0) || hasTraceFootnote) {
    if (amount !== 0) {
      recordFail("malformed_target_nutrient", "Trace evidence requires a zero source amount.");
    }
    return "trace";
  }
  if (amount === 0) return "explicit_zero";
  if (derivationCode === "NC" || derivationCode === "AS") {
    return "source_calculated";
  }
  return "source_reported";
}

function projectionForNutrient(
  foodNutrients: unknown[],
  sourceNutrientId: number,
  sourceUnit: "g" | "kcal",
  applicationCode: string,
): FoundationNutrientProjection | null {
  const matches = foodNutrients.filter(
    (item): item is Record<string, unknown> =>
      isPlainObject(item) &&
      isPlainObject(item.nutrient) &&
      item.nutrient.id === sourceNutrientId,
  );
  if (matches.length > 1) {
    recordFail("duplicate_target_nutrient", `Nutrient ${sourceNutrientId} is duplicated.`);
  }
  if (matches.length === 0) return null;

  const item = matches[0];
  const nutrient = item.nutrient as Record<string, unknown>;
  if (nutrient.unitName !== sourceUnit) {
    recordFail("unsupported_target_unit", `Nutrient ${sourceNutrientId} has an unsupported unit.`);
  }
  if (
    typeof item.amount !== "number" ||
    !Number.isFinite(item.amount)
  ) {
    recordFail("malformed_target_nutrient", `Nutrient ${sourceNutrientId} has an invalid amount.`);
  }
  if (item.amount < 0) {
    recordFail("negative_target_value", `Nutrient ${sourceNutrientId} is negative.`);
  }
  const derivation = isPlainObject(item.foodNutrientDerivation)
    ? item.foodNutrientDerivation
    : null;
  const derivationCode = boundedOptionalString(derivation?.code, 40);
  const derivationDescription = boundedOptionalString(
    derivation?.description,
    200,
  );
  const loq = item.loq;
  if (loq !== undefined && typeof loq !== "number") {
    recordFail("malformed_target_nutrient", "LOQ must be numeric.");
  }
  const semantic = nutrientSemantic(
    item.amount,
    loq as number | undefined,
    typeof item.footnote === "string" ? item.footnote : undefined,
    derivationCode,
  );

  return {
    application_nutrient_code: applicationCode,
    source_nutrient_id: String(sourceNutrientId),
    source_unit: sourceUnit,
    value: semantic === "trace" ? null : canonicalDecimal(item.amount),
    semantic,
    loq: typeof loq === "number" && loq > 0 ? canonicalDecimal(loq) : null,
    derivation_code: derivationCode,
    derivation_description: derivationDescription,
  };
}

function missingProjection(applicationCode: string): FoundationNutrientProjection {
  return {
    application_nutrient_code: applicationCode,
    source_nutrient_id: null,
    source_unit: null,
    value: null,
    semantic: "missing",
    loq: null,
    derivation_code: null,
    derivation_description: null,
  };
}

function validateSourceNutrients(foodNutrients: unknown[]) {
  for (const item of foodNutrients) {
    if (!isPlainObject(item) || !isPlainObject(item.nutrient)) {
      recordFail("malformed_target_nutrient", "A source nutrient is malformed.");
    }
    const nutrient = item.nutrient;
    const sourceId = nutrient.id;
    if (
      typeof sourceId !== "number" ||
      !Number.isSafeInteger(sourceId) ||
      sourceId <= 0 ||
      typeof nutrient.unitName !== "string" ||
      nutrient.unitName.length === 0 ||
      nutrient.unitName.length > 40
    ) {
      recordFail("malformed_target_nutrient", "Source nutrient identity is invalid.");
    }
    if (
      item.amount !== undefined &&
      (typeof item.amount !== "number" || !Number.isFinite(item.amount))
    ) {
      recordFail("malformed_target_nutrient", "Source nutrient amount is invalid.");
    }
    if (typeof item.amount === "number" && item.amount < 0) {
      recordFail("negative_target_value", "Source nutrient amount is negative.");
    }
    if (
      item.loq !== undefined &&
      (typeof item.loq !== "number" || !Number.isFinite(item.loq) || item.loq < 0)
    ) {
      recordFail("malformed_target_nutrient", "Source nutrient LOQ is invalid.");
    }
  }
}

function parsePortions(value: unknown): {
  portions: FoundationPortionCandidate[];
  sourceSequenceRebased: boolean;
} {
  if (value === undefined) return { portions: [], sourceSequenceRebased: false };
  if (!Array.isArray(value) || value.length > foundationSafetyBounds.maximumPortionsPerRecord) {
    recordFail("malformed_portion", "Food portions must be a bounded array.");
  }
  const sourcePortionIds = new Set<string>();
  const sourceSequences = new Set<number>();
  let sourceSequenceRebased = false;
  const parsed = value.map((item) => {
    if (!isPlainObject(item) || !isPlainObject(item.measureUnit)) {
      recordFail("malformed_portion", "A supplied portion is malformed.");
    }
    const sourceSequenceNumber = item.sequenceNumber;
    if (
      typeof sourceSequenceNumber !== "number" ||
      !Number.isSafeInteger(sourceSequenceNumber) ||
      sourceSequenceNumber <= 0
    ) {
      recordFail("malformed_portion", "Portion source sequences must be positive integers.");
    }
    if (sourceSequences.has(sourceSequenceNumber)) sourceSequenceRebased = true;
    sourceSequences.add(sourceSequenceNumber);
    if (
      typeof item.amount !== "number" ||
      !Number.isFinite(item.amount) ||
      item.amount <= 0 ||
      typeof item.gramWeight !== "number" ||
      !Number.isFinite(item.gramWeight) ||
      item.gramWeight <= 0
    ) {
      recordFail("malformed_portion", "Portion amount and gram weight must be positive.");
    }
    const measure = item.measureUnit;
    const sourcePortionId = positiveSafeIdentifier(item.id, "malformed_portion");
    if (sourcePortionIds.has(sourcePortionId)) {
      recordFail("malformed_portion", "Source portion identifiers must be unique.");
    }
    sourcePortionIds.add(sourcePortionId);
    return {
      ordinal: 0,
      source_sequence_number: sourceSequenceNumber,
      source_portion_id: sourcePortionId,
      amount: canonicalDecimal(item.amount),
      measure_unit_id: positiveSafeIdentifier(measure.id, "malformed_portion"),
      measure_unit_name:
        boundedOptionalString(measure.name, 40) ??
        recordFail("malformed_portion", "Portion unit name is required."),
      measure_unit_abbreviation:
        boundedOptionalString(measure.abbreviation, 40) ??
        recordFail("malformed_portion", "Portion unit abbreviation is required."),
      portion_description: boundedOptionalString(item.portionDescription, 200),
      modifier: boundedOptionalString(item.modifier, 200),
      gram_weight: canonicalDecimal(item.gramWeight),
      source_value:
        typeof item.value === "number" && Number.isFinite(item.value)
          ? canonicalDecimal(item.value)
          : item.value === undefined
            ? null
            : recordFail("malformed_portion", "Portion source value is invalid."),
      minimum_year_acquired:
        typeof item.minYearAcquired === "number" &&
        Number.isSafeInteger(item.minYearAcquired) &&
        item.minYearAcquired > 0
          ? item.minYearAcquired
          : item.minYearAcquired === undefined
            ? null
            : recordFail("malformed_portion", "Portion acquisition year is invalid."),
    };
  });
  parsed.sort(
    (left, right) =>
      left.source_sequence_number - right.source_sequence_number ||
      Number(left.source_portion_id) - Number(right.source_portion_id),
  );
  return {
    portions: parsed.map((portion, index) => ({ ...portion, ordinal: index + 1 })),
    sourceSequenceRebased,
  };
}

function candidateWithoutFingerprint(
  record: ParsedFoundationRecord,
): Omit<FoundationNormalizedCandidate, "content_fingerprint"> {
  const raw = record.raw as Record<string, unknown>;
  const fdcId = positiveSafeIdentifier(raw.fdcId, "invalid_fdc_id");
  if (
    typeof raw.description !== "string" ||
    raw.description.trim().length === 0 ||
    raw.description.length > foundationSafetyBounds.maximumDescriptionLength
  ) {
    recordFail("blank_description", "Foundation description is blank or too long.");
  }
  const ndbNumber =
    raw.ndbNumber === undefined
      ? null
      : positiveSafeIdentifier(raw.ndbNumber, "ambiguous_source_identity");
  const foodNutrients = raw.foodNutrients;
  if (!Array.isArray(foodNutrients)) {
    recordFail("malformed_target_nutrient", "Food nutrients must be an array.");
  }
  validateSourceNutrients(foodNutrients);

  const protein = projectionForNutrient(foodNutrients, 1003, "g", "protein_g");
  const fat = projectionForNutrient(foodNutrients, 1004, "g", "fat_g");
  const carbohydrate = projectionForNutrient(
    foodNutrients,
    1005,
    "g",
    "carbohydrates_g",
  );
  const energySpecific = projectionForNutrient(
    foodNutrients,
    2048,
    "kcal",
    "energy_kcal",
  );
  const energyGeneral = projectionForNutrient(
    foodNutrients,
    2047,
    "kcal",
    "energy_kcal",
  );
  const legacyEnergy = projectionForNutrient(
    foodNutrients,
    1008,
    "kcal",
    "energy_kcal",
  );
  const selectedEnergy = energySpecific ?? energyGeneral;
  const warningSet = new Set<WarningCategory>();
  if (ndbNumber === null) {
    warningSet.add("concept_identity_pending_generation");
  }
  if (!protein) warningSet.add("missing_protein_g");
  if (!fat) warningSet.add("missing_fat_g");
  if (!carbohydrate) warningSet.add("missing_carbohydrates_g");
  if (!selectedEnergy) warningSet.add("missing_energy_kcal");
  const energyEvidence = [energySpecific, energyGeneral, legacyEnergy].filter(
    (value): value is FoundationNutrientProjection => value !== null,
  );
  if (energyEvidence.length > 1 || legacyEnergy !== null) {
    warningSet.add("alternative_energy_method_present");
  }
  const unsupportedNutrientCount = foodNutrients.filter((item) => {
    if (!isPlainObject(item) || !isPlainObject(item.nutrient)) return true;
    const id = item.nutrient.id;
    return (
      typeof id !== "number" ||
      (!mappedSourceNutrientIds.has(id) && !recognizedEnergyNutrientIds.has(id))
    );
  }).length;
  if (unsupportedNutrientCount > 0) {
    warningSet.add("unsupported_nutrients_present");
  }
  const parsedPortions = parsePortions(raw.foodPortions);
  const portions = parsedPortions.portions;
  if (portions.length === 0) warningSet.add("missing_portions");
  if (parsedPortions.sourceSequenceRebased) {
    warningSet.add("source_portion_sequence_rebased");
  }
  const warnings = [...warningSet].sort();
  if (warnings.length > foundationSafetyBounds.maximumWarningCategories) {
    recordFail("normalized_candidate_too_large", "Warning categories exceed their bound.");
  }

  const category = isPlainObject(raw.foodCategory)
    ? boundedOptionalString(raw.foodCategory.description, 200)
    : null;
  return {
    candidate_contract_version: foundationCandidateContractVersion,
    dataset_code: "usda_fdc_foundation",
    schema_contract_version: "usda-fdc-foundation-json/v1",
    mapping_version: foundationNutrientMappingVersion,
    mapping_hash: foundationNutrientMappingHash,
    source_row_key: `fdc:${fdcId}`,
    concept_key: ndbNumber === null ? null : `foundation:ndb:${ndbNumber}`,
    concept_identity_status:
      ndbNumber === null ? "generate_on_first_promotion" : "source_supplied",
    upstream_version_key: `fdc:${fdcId}`,
    fdc_id: fdcId,
    ndb_number: ndbNumber,
    publication_date: canonicalPublicationDate(raw.publicationDate),
    data_type: "Foundation",
    food_class: "FinalFood",
    name: raw.description,
    locale: "en",
    food_type: "generic",
    brand: null,
    nutrient_basis: "per_100g",
    nutrients: {
      energy_kcal: selectedEnergy ?? missingProjection("energy_kcal"),
      protein_g: protein ?? missingProjection("protein_g"),
      carbohydrates_g:
        carbohydrate ?? missingProjection("carbohydrates_g"),
      fat_g: fat ?? missingProjection("fat_g"),
    },
    energy_evidence: energyEvidence,
    selected_energy_method: energySpecific
      ? "atwater_specific_2048"
      : energyGeneral
        ? "atwater_general_2047"
        : null,
    portion_candidates: portions,
    source_metadata: {
      scientific_name: boundedOptionalString(raw.scientificName, 200),
      category,
      is_historical_reference:
        typeof raw.isHistoricalReference === "boolean"
          ? raw.isHistoricalReference
          : null,
      input_food_count: Array.isArray(raw.inputFoods) ? raw.inputFoods.length : 0,
      nutrient_conversion_factor_count: Array.isArray(
        raw.nutrientConversionFactors,
      )
        ? raw.nutrientConversionFactors.length
        : 0,
    },
    unsupported_nutrient_count: unsupportedNutrientCount,
    warning_categories: warnings,
  };
}

export function normalizeFoundationRecord(
  record: ParsedFoundationRecord,
): NormalizedFoundationRecord {
  const withoutFingerprint = candidateWithoutFingerprint(record);
  const before = canonicalizeJson(record.raw as Record<string, JsonValue>);
  const candidate: FoundationNormalizedCandidate = {
    ...withoutFingerprint,
    content_fingerprint: fingerprintJson(withoutFingerprint as JsonValue),
  };
  const serialized = canonicalizeJson(candidate as JsonValue);
  const normalizedBytes = Buffer.byteLength(serialized, "utf8");
  if (normalizedBytes > foundationSafetyBounds.maximumCandidateBytes) {
    recordFail("normalized_candidate_too_large", "Normalized candidate exceeds its bound.");
  }
  if (canonicalizeJson(record.raw as Record<string, JsonValue>) !== before) {
    throw new Error("Foundation normalization mutated the raw source record.");
  }
  return { raw: record, candidate, normalizedBytes };
}

export function normalizeFoundationArchive(archive: ParsedFoundationArchive) {
  const seenFdcIds = new Set<string>();
  const seenConcepts = new Set<string>();
  const accepted: NormalizedFoundationRecord[] = [];
  const rejected: FoundationRecordReject[] = [];

  for (const record of archive.records) {
    try {
      const normalized = normalizeFoundationRecord(record);
      if (seenFdcIds.has(normalized.candidate.fdc_id)) {
        throw new FoundationValidationError(
          "duplicate_version_identity",
          `Duplicate FDC ID: ${normalized.candidate.fdc_id}.`,
        );
      }
      seenFdcIds.add(normalized.candidate.fdc_id);
      if (normalized.candidate.concept_key !== null) {
        if (seenConcepts.has(normalized.candidate.concept_key)) {
          throw new FoundationValidationError(
            "duplicate_concept_identity",
            `Duplicate Foundation concept: ${normalized.candidate.concept_key}.`,
          );
        }
        seenConcepts.add(normalized.candidate.concept_key);
      }
      accepted.push(normalized);
    } catch (error) {
      if (!(error instanceof FoundationValidationError) || error.scope === "release") {
        throw error;
      }
      const rawFdcId = record.raw.fdcId;
      rejected.push({
        source_row_key:
          typeof rawFdcId === "number" && Number.isSafeInteger(rawFdcId)
            ? `fdc:${rawFdcId}`
            : `record:${record.index + 1}`,
        category: error.category,
      });
    }
  }

  return { accepted, rejected };
}

const candidateKeys = [
  "brand",
  "candidate_contract_version",
  "concept_identity_status",
  "concept_key",
  "content_fingerprint",
  "data_type",
  "dataset_code",
  "energy_evidence",
  "fdc_id",
  "food_class",
  "food_type",
  "locale",
  "mapping_hash",
  "mapping_version",
  "name",
  "ndb_number",
  "nutrient_basis",
  "nutrients",
  "portion_candidates",
  "publication_date",
  "schema_contract_version",
  "selected_energy_method",
  "source_metadata",
  "source_row_key",
  "unsupported_nutrient_count",
  "upstream_version_key",
  "warning_categories",
] as const;

const projectionKeys = [
  "application_nutrient_code",
  "derivation_code",
  "derivation_description",
  "loq",
  "semantic",
  "source_nutrient_id",
  "source_unit",
  "value",
] as const;

const portionKeys = [
  "amount",
  "gram_weight",
  "measure_unit_abbreviation",
  "measure_unit_id",
  "measure_unit_name",
  "minimum_year_acquired",
  "modifier",
  "ordinal",
  "portion_description",
  "source_portion_id",
  "source_sequence_number",
  "source_value",
] as const;

const sourceMetadataKeys = [
  "category",
  "input_food_count",
  "is_historical_reference",
  "nutrient_conversion_factor_count",
  "scientific_name",
] as const;

const warningCategories = new Set<WarningCategory>([
  "alternative_energy_method_present",
  "concept_identity_pending_generation",
  "missing_carbohydrates_g",
  "missing_energy_kcal",
  "missing_fat_g",
  "missing_portions",
  "missing_protein_g",
  "source_portion_sequence_rebased",
  "unsupported_nutrients_present",
]);

function requireExactObject(
  value: unknown,
  keys: readonly string[],
  label: string,
): Record<string, unknown> {
  if (!isPlainObject(value)) {
    recordFail("normalized_candidate_invalid", `${label} must be an object.`);
  }
  const actualKeys = Object.keys(value).sort();
  if (JSON.stringify(actualKeys) !== JSON.stringify([...keys].sort())) {
    recordFail("normalized_candidate_invalid", `${label} fields are not exact.`);
  }
  return value;
}

function validateProjection(value: unknown) {
  const projection = requireExactObject(value, projectionKeys, "Nutrient projection");
  if (
    typeof projection.application_nutrient_code !== "string" ||
    (projection.source_nutrient_id !== null &&
      typeof projection.source_nutrient_id !== "string") ||
    (projection.source_unit !== null && typeof projection.source_unit !== "string") ||
    (projection.value !== null && typeof projection.value !== "string") ||
    (projection.loq !== null && typeof projection.loq !== "string") ||
    ![
      "explicit_zero",
      "missing",
      "source_calculated",
      "source_reported",
      "trace",
    ].includes(projection.semantic as string)
  ) {
    recordFail("normalized_candidate_invalid", "Nutrient projection values are invalid.");
  }
}

export function parseNormalizedFoundationCandidate(
  value: unknown,
): FoundationNormalizedCandidate {
  const candidate = requireExactObject(value, candidateKeys, "Candidate");
  if (
    candidate.candidate_contract_version !== foundationCandidateContractVersion ||
    candidate.dataset_code !== "usda_fdc_foundation" ||
    candidate.schema_contract_version !== "usda-fdc-foundation-json/v1" ||
    candidate.mapping_version !== foundationNutrientMappingVersion ||
    candidate.mapping_hash !== foundationNutrientMappingHash ||
    candidate.locale !== "en" ||
    candidate.food_type !== "generic" ||
    candidate.brand !== null ||
    candidate.nutrient_basis !== "per_100g" ||
    candidate.data_type !== "Foundation" ||
    candidate.food_class !== "FinalFood"
  ) {
    recordFail("normalized_candidate_invalid", "Candidate contract values are invalid.");
  }
  const nutrients = requireExactObject(
    candidate.nutrients,
    ["carbohydrates_g", "energy_kcal", "fat_g", "protein_g"],
    "Candidate nutrients",
  );
  for (const projection of Object.values(nutrients)) validateProjection(projection);
  if (!Array.isArray(candidate.energy_evidence) || candidate.energy_evidence.length > 3) {
    recordFail("normalized_candidate_invalid", "Energy evidence is invalid.");
  }
  for (const projection of candidate.energy_evidence) validateProjection(projection);
  if (
    !Array.isArray(candidate.portion_candidates) ||
    candidate.portion_candidates.length > foundationSafetyBounds.maximumPortionsPerRecord
  ) {
    recordFail("normalized_candidate_invalid", "Portion candidates are invalid.");
  }
  for (const portion of candidate.portion_candidates) {
    requireExactObject(portion, portionKeys, "Portion candidate");
  }
  requireExactObject(candidate.source_metadata, sourceMetadataKeys, "Source metadata");
  if (
    !Array.isArray(candidate.warning_categories) ||
    candidate.warning_categories.length > foundationSafetyBounds.maximumWarningCategories ||
    candidate.warning_categories.some(
      (warning) => typeof warning !== "string" || !warningCategories.has(warning as WarningCategory),
    ) ||
    JSON.stringify(candidate.warning_categories) !==
      JSON.stringify([...new Set(candidate.warning_categories)].sort())
  ) {
    recordFail("normalized_candidate_invalid", "Warning categories are invalid.");
  }
  const fingerprint = candidate.content_fingerprint;
  const { content_fingerprint: _ignored, ...withoutFingerprint } = candidate;
  void _ignored;
  if (
    typeof fingerprint !== "string" ||
    fingerprint !== fingerprintJson(withoutFingerprint as JsonValue)
  ) {
    recordFail("normalized_candidate_invalid", "Candidate fingerprint is invalid.");
  }
  return candidate as FoundationNormalizedCandidate;
}
