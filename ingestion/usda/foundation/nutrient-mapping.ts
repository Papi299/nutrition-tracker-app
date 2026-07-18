import { fingerprintJson, type JsonValue } from "./canonical-json.ts";

export const foundationNutrientMappingVersion =
  "usda-foundation-mvp-v1" as const;

export const foundationNutrientMapping = {
  version_code: foundationNutrientMappingVersion,
  dataset_code: "usda_fdc_foundation",
  basis: "per_100g",
  energy_precedence: ["2048", "2047"],
  excluded_energy_source_ids: ["1008"],
  mappings: [
    {
      source_nutrient_id: "1003",
      source_name: "Protein",
      source_unit: "g",
      application_nutrient_code: "protein_g",
      application_unit: "g",
      policy: "retain_source_derivation",
    },
    {
      source_nutrient_id: "1004",
      source_name: "Total lipid (fat)",
      source_unit: "g",
      application_nutrient_code: "fat_g",
      application_unit: "g",
      policy: "retain_source_derivation",
    },
    {
      source_nutrient_id: "1005",
      source_name: "Carbohydrate, by difference",
      source_unit: "g",
      application_nutrient_code: "carbohydrates_g",
      application_unit: "g",
      policy: "preserve_by_difference_semantics",
    },
    {
      source_nutrient_id: "2048",
      source_name: "Energy (Atwater Specific Factors)",
      source_unit: "kcal",
      application_nutrient_code: "energy_kcal",
      application_unit: "kcal",
      policy: "preferred_energy_method",
    },
    {
      source_nutrient_id: "2047",
      source_name: "Energy (Atwater General Factors)",
      source_unit: "kcal",
      application_nutrient_code: "energy_kcal",
      application_unit: "kcal",
      policy: "fallback_energy_method",
    },
  ],
  missing_value_policy: "preserve_unknown",
  explicit_zero_policy: "preserve_unless_loq_or_trace",
  conversion_policy: "none",
} as const satisfies JsonValue;

export const foundationNutrientMappingHash = fingerprintJson(
  foundationNutrientMapping,
);

export const mappedSourceNutrientIds = new Set(
  foundationNutrientMapping.mappings.map((mapping) =>
    Number(mapping.source_nutrient_id),
  ),
);

export const recognizedEnergyNutrientIds = new Set([1008, 2047, 2048]);
