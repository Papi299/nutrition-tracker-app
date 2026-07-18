import { fingerprintJson, type JsonValue } from "./canonical-json.ts";

export const foundationSchemaContractVersion =
  "usda-fdc-foundation-json/v1" as const;
export const foundationImporterContractVersion =
  "usda-foundation-importer/v2" as const;
export const foundationCandidateContractVersion =
  "foundation-normalized-candidate/v1" as const;
export const foundationReportContractVersion =
  "foundation-dry-run-report/v2" as const;
export const foundationRejectPolicyVersion =
  "usda-foundation-zero-unreviewed-rejects/v1" as const;

export const foundationSafetyBounds = {
  maximumArchiveBytes: 2 * 1024 * 1024,
  maximumJsonBytes: 10 * 1024 * 1024,
  maximumRecords: 10_000,
  maximumRawRecordBytes: 128 * 1024,
  maximumCandidateBytes: 64 * 1024,
  maximumDescriptionLength: 200,
  maximumWarningCategories: 16,
  maximumPortionsPerRecord: 100,
  maximumTrailingNullPadding: 64,
} as const;

type JsonType = "array" | "boolean" | "null" | "number" | "object" | "string";

// This inventory is pinned to the official USDA April 2026 Foundation JSON
// archive. `loq` is the one explicitly forward-compatible path: USDA's
// Foundation documentation defines it as numeric, although the final-food
// rows in this release do not contain it.
export const foundationSchemaPaths: Readonly<Record<string, readonly JsonType[]>> = {
  "$": ["object"],
  "$.FoundationFoods": ["array"],
  "$.FoundationFoods[]": ["null", "object"],
  "$.FoundationFoods[].dataType": ["string"],
  "$.FoundationFoods[].description": ["string"],
  "$.FoundationFoods[].fdcId": ["number"],
  "$.FoundationFoods[].foodAttributes": ["array"],
  "$.FoundationFoods[].foodCategory": ["object"],
  "$.FoundationFoods[].foodCategory.description": ["string"],
  "$.FoundationFoods[].foodClass": ["string"],
  "$.FoundationFoods[].foodNutrients": ["array"],
  "$.FoundationFoods[].foodNutrients[]": ["object"],
  "$.FoundationFoods[].foodNutrients[].amount": ["number"],
  "$.FoundationFoods[].foodNutrients[].dataPoints": ["number"],
  "$.FoundationFoods[].foodNutrients[].foodNutrientDerivation": ["object"],
  "$.FoundationFoods[].foodNutrients[].foodNutrientDerivation.code": ["string"],
  "$.FoundationFoods[].foodNutrients[].foodNutrientDerivation.description": ["string"],
  "$.FoundationFoods[].foodNutrients[].foodNutrientDerivation.foodNutrientSource": ["object"],
  "$.FoundationFoods[].foodNutrients[].foodNutrientDerivation.foodNutrientSource.code": ["string"],
  "$.FoundationFoods[].foodNutrients[].foodNutrientDerivation.foodNutrientSource.description": ["string"],
  "$.FoundationFoods[].foodNutrients[].foodNutrientDerivation.foodNutrientSource.id": ["number"],
  "$.FoundationFoods[].foodNutrients[].footnote": ["string"],
  "$.FoundationFoods[].foodNutrients[].id": ["number"],
  "$.FoundationFoods[].foodNutrients[].loq": ["number"],
  "$.FoundationFoods[].foodNutrients[].max": ["number"],
  "$.FoundationFoods[].foodNutrients[].median": ["number"],
  "$.FoundationFoods[].foodNutrients[].min": ["number"],
  "$.FoundationFoods[].foodNutrients[].nutrient": ["object"],
  "$.FoundationFoods[].foodNutrients[].nutrient.id": ["number"],
  "$.FoundationFoods[].foodNutrients[].nutrient.name": ["string"],
  "$.FoundationFoods[].foodNutrients[].nutrient.number": ["string"],
  "$.FoundationFoods[].foodNutrients[].nutrient.rank": ["number"],
  "$.FoundationFoods[].foodNutrients[].nutrient.unitName": ["string"],
  "$.FoundationFoods[].foodNutrients[].type": ["string"],
  "$.FoundationFoods[].foodPortions": ["array"],
  "$.FoundationFoods[].foodPortions[]": ["object"],
  "$.FoundationFoods[].foodPortions[].amount": ["number"],
  "$.FoundationFoods[].foodPortions[].gramWeight": ["number"],
  "$.FoundationFoods[].foodPortions[].id": ["number"],
  "$.FoundationFoods[].foodPortions[].measureUnit": ["object"],
  "$.FoundationFoods[].foodPortions[].measureUnit.abbreviation": ["string"],
  "$.FoundationFoods[].foodPortions[].measureUnit.id": ["number"],
  "$.FoundationFoods[].foodPortions[].measureUnit.name": ["string"],
  "$.FoundationFoods[].foodPortions[].minYearAcquired": ["number"],
  "$.FoundationFoods[].foodPortions[].modifier": ["string"],
  "$.FoundationFoods[].foodPortions[].portionDescription": ["string"],
  "$.FoundationFoods[].foodPortions[].sequenceNumber": ["number"],
  "$.FoundationFoods[].foodPortions[].value": ["number"],
  "$.FoundationFoods[].inputFoods": ["array"],
  "$.FoundationFoods[].inputFoods[]": ["object"],
  "$.FoundationFoods[].inputFoods[].foodDescription": ["string"],
  "$.FoundationFoods[].inputFoods[].id": ["number"],
  "$.FoundationFoods[].inputFoods[].inputFood": ["object"],
  "$.FoundationFoods[].inputFoods[].inputFood.dataType": ["string"],
  "$.FoundationFoods[].inputFoods[].inputFood.description": ["string"],
  "$.FoundationFoods[].inputFoods[].inputFood.fdcId": ["number"],
  "$.FoundationFoods[].inputFoods[].inputFood.foodCategory": ["object"],
  "$.FoundationFoods[].inputFoods[].inputFood.foodCategory.code": ["string"],
  "$.FoundationFoods[].inputFoods[].inputFood.foodCategory.description": ["string"],
  "$.FoundationFoods[].inputFoods[].inputFood.foodCategory.id": ["number"],
  "$.FoundationFoods[].inputFoods[].inputFood.foodClass": ["string"],
  "$.FoundationFoods[].inputFoods[].inputFood.publicationDate": ["string"],
  "$.FoundationFoods[].isHistoricalReference": ["boolean"],
  "$.FoundationFoods[].ndbNumber": ["number"],
  "$.FoundationFoods[].nutrientConversionFactors": ["array"],
  "$.FoundationFoods[].nutrientConversionFactors[]": ["object"],
  "$.FoundationFoods[].nutrientConversionFactors[].carbohydrateValue": ["number"],
  "$.FoundationFoods[].nutrientConversionFactors[].fatValue": ["number"],
  "$.FoundationFoods[].nutrientConversionFactors[].nitrogenValue": ["number"],
  "$.FoundationFoods[].nutrientConversionFactors[].proteinValue": ["number"],
  "$.FoundationFoods[].nutrientConversionFactors[].type": ["string"],
  "$.FoundationFoods[].nutrientConversionFactors[].value": ["number"],
  "$.FoundationFoods[].publicationDate": ["string"],
  "$.FoundationFoods[].scientificName": ["string"],
};

export const foundationSchemaContract = {
  contract_version: foundationSchemaContractVersion,
  collection: "FoundationFoods",
  required_record_paths: [
    "dataType",
    "description",
    "fdcId",
    "foodClass",
    "foodNutrients",
    "publicationDate",
  ],
  optional_loq_path: "FoundationFoods[].foodNutrients[].loq",
  optional_loq_type: "number",
  reviewed_trailing_null_padding: {
    position: "trailing_only",
    maximum: foundationSafetyBounds.maximumTrailingNullPadding,
    classification: "warning",
  },
  paths: foundationSchemaPaths,
} as const satisfies JsonValue;

export const foundationSchemaContractHash = fingerprintJson(
  foundationSchemaContract,
);

export const foundationRejectPolicy = {
  contract_version: foundationRejectPolicyVersion,
  maximum_unreviewed_record_rejects: 0,
  hard_release_failures: [
    "archive_checksum_mismatch",
    "archive_size_mismatch",
    "database_staging_receipt_inconsistency",
    "duplicate_concept_identity",
    "duplicate_version_identity",
    "exact_decimal_required",
    "invalid_manifest_scope",
    "malformed_json",
    "manifest_fingerprint_mismatch",
    "mapping_contract_mismatch",
    "record_count_out_of_bounds",
    "record_size_out_of_bounds",
    "schema_contract_mismatch",
    "source_file_size_mismatch",
    "wrong_collection",
  ],
  record_rejects: [
    "ambiguous_source_identity",
    "blank_description",
    "duplicate_target_nutrient",
    "invalid_fdc_id",
    "invalid_publication_date",
    "malformed_portion",
    "malformed_target_nutrient",
    "negative_target_value",
    "normalized_candidate_too_large",
    "unsupported_target_unit",
  ],
} as const satisfies JsonValue;

export const foundationRejectPolicyHash = fingerprintJson(
  foundationRejectPolicy,
);
