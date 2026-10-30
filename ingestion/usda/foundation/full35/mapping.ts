import { deepFreezeJson, fingerprintJson, type JsonValue } from "../canonical-json.ts";

// Immutable MAP-01–05 body; changes require a new mapping identity and review.
export const full35Mapping = deepFreezeJson({
  "contract_version": "foundation-nutrient-mapping/v2",
  "version_code": "usda-foundation-full35-direct-v2",
  "specification_revision": "NUTRITION-USDA-FULL35-SPEC-001/1.0-draft",
  "dataset_code": "usda_fdc_foundation",
  "basis": "per_100g",
  "predecessor_mapping_hash": "a5dc96bfcb2bd8d499b0a11eac8f252e7aa63d4ae13d8a78ee9047477c2a0fb5",
  "importer_contract_version": "usda-foundation-importer/v3",
  "candidate_contract_version": "foundation-normalized-candidate/v2",
  "report_contract_version": "foundation-dry-run-report/v3",
  "energy_precedence": [
    "2048",
    "2047"
  ],
  "unit_aliases": {
    "g": [
      "G",
      "g"
    ],
    "mg": [
      "MG",
      "mg"
    ],
    "ug": [
      "UG",
      "ug",
      "µg"
    ],
    "kcal": [
      "KCAL",
      "kcal"
    ]
  },
  "conversion_policy": {
    "factor": "1",
    "stored_exact_conversion_factor": null,
    "policy": "identity_only_no_synthesis"
  },
  "numeric_policy": {
    "canonical_nonnegative_decimal": true,
    "public_precision": 14,
    "public_scale": 4,
    "maximum": "9999999999.9999",
    "evidence_precision": 24,
    "evidence_scale": 10,
    "exact_json_lexeme_round_trip": true,
    "round_to_fit": false,
    "snapshot_rounding": "outside_importer_final_consumed_boundary_only"
  },
  "qualifier_policy": {
    "trace": "positive_loq_or_leading_less_than_on_zero_blocks",
    "nonzero_trace": "malformed_target_nutrient",
    "negative_or_malformed_loq": "malformed_target_nutrient",
    "explicit_zero": "preserve_derivation_unless_qualified",
    "missing": "absent_eligible_id_only",
    "present_without_amount": "malformed_target_nutrient",
    "duplicates": "reject_even_identical",
    "energy": "validate_both_before_selection"
  },
  "derivation_policy": {
    "positive_NC_AS": "source_calculated",
    "other_positive": "source_reported",
    "zero": "explicit_zero",
    "application_calculation": "forbidden"
  },
  "excluded_source_ids": [
    "1008",
    "1062",
    "1050",
    "1085",
    "2033",
    "2000",
    "1329",
    "1330",
    "1331",
    "1105",
    "1104",
    "2066",
    "1110",
    "1111",
    "1112",
    "1113",
    "1183",
    "1184",
    "1185",
    "1177",
    "1186",
    "1187",
    "1190",
    "1235"
  ],
  "evidence_requirements": [
    "mapping_version_and_hash",
    "candidate_contract_and_hash",
    "release_manifest_archive_json_hashes",
    "frozen_identity_set_hash",
    "fdc_ndb_source_record_version_identity",
    "original_raw_hash_and_field_path",
    "both_energy_method_records",
    "source_nutrient_id_exact_name_original_unit",
    "exact_source_amount",
    "normalized_unit_and_per_100g_basis",
    "source_semantic_derivation_code_description",
    "original_footnote_and_loq",
    "identity_conversion_factor_null",
    "missing_policy_reason",
    "complete_evidence_set_hash"
  ],
  "mappings": [
    {
      "application_nutrient_code": "energy_kcal",
      "application_unit": "kcal",
      "classification": "direct",
      "sources": [
        {
          "id": "2048",
          "name": "Energy (Atwater Specific Factors)"
        },
        {
          "id": "2047",
          "name": "Energy (Atwater General Factors)"
        }
      ],
      "definition": "Source-provided metabolizable energy; specific Atwater factors preferred, general factors fallback. Calories: metabolizable kcal; retain current approved precedence.",
      "excluded_alternatives": "Do not use 1008, kJ 1062, or application macro-energy synthesis.",
      "missing_reason": "source_absent"
    },
    {
      "application_nutrient_code": "protein_g",
      "application_unit": "g",
      "classification": "direct",
      "sources": [
        {
          "id": "1003",
          "name": "Protein"
        }
      ],
      "definition": "USDA protein, including nitrogen-based source calculations. Protein mass in g.",
      "excluded_alternatives": "Retain NC/AS derivation; do not recalculate nitrogen.",
      "missing_reason": "source_absent"
    },
    {
      "application_nutrient_code": "carbohydrates_g",
      "application_unit": "g",
      "classification": "direct",
      "sources": [
        {
          "id": "1005",
          "name": "Carbohydrate, by difference"
        }
      ],
      "definition": "Carbohydrate by difference; includes dietary fiber. Total carbohydrates under existing approved by-difference interpretation.",
      "excluded_alternatives": "1050 carbohydrate by summation is excluded; negative values are not clamped.",
      "missing_reason": "source_absent"
    },
    {
      "application_nutrient_code": "fat_g",
      "application_unit": "g",
      "classification": "direct",
      "sources": [
        {
          "id": "1004",
          "name": "Total lipid (fat)"
        }
      ],
      "definition": "USDA total lipid (fat). Total fat mass in g.",
      "excluded_alternatives": "1085 total fat (NLEA) is a distinct alternative and is excluded.",
      "missing_reason": "source_absent"
    },
    {
      "application_nutrient_code": "fiber_g",
      "application_unit": "g",
      "classification": "direct",
      "sources": [
        {
          "id": "1079",
          "name": "Fiber, total dietary"
        }
      ],
      "definition": "USDA reported total dietary fiber aggregate (1079). Dietary fiber mass; initial conservative mapping uses 1079 only.",
      "excluded_alternatives": "2033 AOAC 2011.25 is a method-distinct alternative; review method policy before adding it. Never sum overlapping fiber fields.",
      "missing_reason": "source_absent"
    },
    {
      "application_nutrient_code": "sugars_g",
      "application_unit": "g",
      "classification": "direct",
      "sources": [
        {
          "id": "1063",
          "name": "Sugars, Total"
        }
      ],
      "definition": "USDA Sugars, Total aggregate, retaining source analytical or summed derivation. Total sugars mass, excluding a claim about added sugars.",
      "excluded_alternatives": "2000 Total Sugars is a separate dictionary entry; exclude until an explicit equivalence/precedence policy is approved. No application sum of components.",
      "missing_reason": "source_absent"
    },
    {
      "application_nutrient_code": "added_sugars_g",
      "application_unit": "g",
      "classification": "unavailable",
      "sources": [],
      "definition": "USDA Sugars, added. Added sugars mass.",
      "excluded_alternatives": "No 1235 records; never infer zero or subtract other sugars.",
      "missing_reason": "unavailable_in_approved_source"
    },
    {
      "application_nutrient_code": "saturated_fat_g",
      "application_unit": "g",
      "classification": "direct",
      "sources": [
        {
          "id": "1258",
          "name": "Fatty acids, total saturated"
        }
      ],
      "definition": "Source-reported total saturated fatty acids aggregate. Saturated fatty acid mass.",
      "excluded_alternatives": "Do not sum individual fatty acids in the application.",
      "missing_reason": "source_absent"
    },
    {
      "application_nutrient_code": "monounsaturated_fat_g",
      "application_unit": "g",
      "classification": "direct",
      "sources": [
        {
          "id": "1292",
          "name": "Fatty acids, total monounsaturated"
        }
      ],
      "definition": "Source-reported total monounsaturated fatty acids aggregate. Monounsaturated fatty acid mass.",
      "excluded_alternatives": "Do not manufacture an aggregate from individual isomers.",
      "missing_reason": "source_absent"
    },
    {
      "application_nutrient_code": "polyunsaturated_fat_g",
      "application_unit": "g",
      "classification": "direct",
      "sources": [
        {
          "id": "1293",
          "name": "Fatty acids, total polyunsaturated"
        }
      ],
      "definition": "Source-reported total polyunsaturated fatty acids aggregate. Polyunsaturated fatty acid mass.",
      "excluded_alternatives": "Do not manufacture an aggregate from individual isomers.",
      "missing_reason": "source_absent"
    },
    {
      "application_nutrient_code": "trans_fat_g",
      "application_unit": "g",
      "classification": "direct",
      "sources": [
        {
          "id": "1257",
          "name": "Fatty acids, total trans"
        }
      ],
      "definition": "Source-reported total trans fatty acids aggregate. Total trans fatty acid mass.",
      "excluded_alternatives": "1329/1330/1331 are partial aggregates; exclude as substitutes.",
      "missing_reason": "source_absent"
    },
    {
      "application_nutrient_code": "cholesterol_mg",
      "application_unit": "mg",
      "classification": "direct",
      "sources": [
        {
          "id": "1253",
          "name": "Cholesterol"
        }
      ],
      "definition": "Source-reported cholesterol mass. Cholesterol mass.",
      "excluded_alternatives": "Missing plant-food cholesterol remains unknown; no physiological zero fill.",
      "missing_reason": "source_absent"
    },
    {
      "application_nutrient_code": "sodium_mg",
      "application_unit": "mg",
      "classification": "direct",
      "sources": [
        {
          "id": "1093",
          "name": "Sodium, Na"
        }
      ],
      "definition": "Elemental sodium (Na) mass. Sodium mass, not salt mass.",
      "excluded_alternatives": "No NaCl conversion.",
      "missing_reason": "source_absent"
    },
    {
      "application_nutrient_code": "potassium_mg",
      "application_unit": "mg",
      "classification": "direct",
      "sources": [
        {
          "id": "1092",
          "name": "Potassium, K"
        }
      ],
      "definition": "Elemental potassium (K) mass. Potassium mass.",
      "excluded_alternatives": "Do not use compound mass.",
      "missing_reason": "source_absent"
    },
    {
      "application_nutrient_code": "calcium_mg",
      "application_unit": "mg",
      "classification": "direct",
      "sources": [
        {
          "id": "1087",
          "name": "Calcium, Ca"
        }
      ],
      "definition": "Elemental calcium (Ca) mass. Calcium mass.",
      "excluded_alternatives": "Do not use compound mass.",
      "missing_reason": "source_absent"
    },
    {
      "application_nutrient_code": "iron_mg",
      "application_unit": "mg",
      "classification": "direct",
      "sources": [
        {
          "id": "1089",
          "name": "Iron, Fe"
        }
      ],
      "definition": "Elemental iron (Fe) mass. Iron mass.",
      "excluded_alternatives": "No bioavailability or compound conversion.",
      "missing_reason": "source_absent"
    },
    {
      "application_nutrient_code": "magnesium_mg",
      "application_unit": "mg",
      "classification": "direct",
      "sources": [
        {
          "id": "1090",
          "name": "Magnesium, Mg"
        }
      ],
      "definition": "Elemental magnesium (Mg) mass. Magnesium mass.",
      "excluded_alternatives": "Do not use compound mass.",
      "missing_reason": "source_absent"
    },
    {
      "application_nutrient_code": "phosphorus_mg",
      "application_unit": "mg",
      "classification": "direct",
      "sources": [
        {
          "id": "1091",
          "name": "Phosphorus, P"
        }
      ],
      "definition": "Elemental phosphorus (P) mass. Phosphorus mass.",
      "excluded_alternatives": "Do not use phosphate mass.",
      "missing_reason": "source_absent"
    },
    {
      "application_nutrient_code": "zinc_mg",
      "application_unit": "mg",
      "classification": "direct",
      "sources": [
        {
          "id": "1095",
          "name": "Zinc, Zn"
        }
      ],
      "definition": "Elemental zinc (Zn) mass. Zinc mass.",
      "excluded_alternatives": "Do not use compound mass.",
      "missing_reason": "source_absent"
    },
    {
      "application_nutrient_code": "copper_mg",
      "application_unit": "mg",
      "classification": "direct",
      "sources": [
        {
          "id": "1098",
          "name": "Copper, Cu"
        }
      ],
      "definition": "Elemental copper (Cu) mass. Copper mass.",
      "excluded_alternatives": "Preserve low-concentration decimals.",
      "missing_reason": "source_absent"
    },
    {
      "application_nutrient_code": "manganese_mg",
      "application_unit": "mg",
      "classification": "direct",
      "sources": [
        {
          "id": "1101",
          "name": "Manganese, Mn"
        }
      ],
      "definition": "Elemental manganese (Mn) mass. Manganese mass.",
      "excluded_alternatives": "Preserve low-concentration decimals.",
      "missing_reason": "source_absent"
    },
    {
      "application_nutrient_code": "selenium_ug",
      "application_unit": "ug",
      "classification": "direct",
      "sources": [
        {
          "id": "1103",
          "name": "Selenium, Se"
        }
      ],
      "definition": "Elemental selenium (Se) mass. Selenium mass in micrograms.",
      "excluded_alternatives": "JSON µg, CSV UG, app ug denote the same unit; label normalization has factor 1, never 1000.",
      "missing_reason": "source_absent"
    },
    {
      "application_nutrient_code": "vitamin_a_rae_ug",
      "application_unit": "ug",
      "classification": "direct",
      "sources": [
        {
          "id": "1106",
          "name": "Vitamin A, RAE"
        }
      ],
      "definition": "Vitamin A expressed as retinol activity equivalents. Vitamin A in micrograms RAE.",
      "excluded_alternatives": "Exclude retinol-only, carotenoids, IU and amountless 2066 Vitamin A records. Do not infer RAE from a mass label.",
      "missing_reason": "source_absent"
    },
    {
      "application_nutrient_code": "vitamin_c_mg",
      "application_unit": "mg",
      "classification": "direct",
      "sources": [
        {
          "id": "1162",
          "name": "Vitamin C, total ascorbic acid"
        }
      ],
      "definition": "Vitamin C, total ascorbic acid aggregate. Vitamin C mass in mg under the USDA total-ascorbic-acid definition.",
      "excluded_alternatives": "Retain source definition and derivation.",
      "missing_reason": "source_absent"
    },
    {
      "application_nutrient_code": "vitamin_d_ug",
      "application_unit": "ug",
      "classification": "direct",
      "sources": [
        {
          "id": "1114",
          "name": "Vitamin D (D2 + D3)"
        }
      ],
      "definition": "Reported vitamin D2 plus D3 mass aggregate. Vitamin D interpreted as D2+D3 mass in micrograms.",
      "excluded_alternatives": "Exclude D4 and 25-hydroxy forms; 1110 IU is unnecessary where 1114 exists.",
      "missing_reason": "source_absent"
    },
    {
      "application_nutrient_code": "vitamin_e_mg",
      "application_unit": "mg",
      "classification": "direct",
      "sources": [
        {
          "id": "1109",
          "name": "Vitamin E (alpha-tocopherol)"
        }
      ],
      "definition": "Vitamin E as alpha-tocopherol. Vitamin E interpreted as alpha-tocopherol, not summed tocopherols.",
      "excluded_alternatives": "Document interpretation; do not add beta/gamma/delta tocopherols or use an untyped IU conversion.",
      "missing_reason": "source_absent"
    },
    {
      "application_nutrient_code": "vitamin_k_ug",
      "application_unit": "ug",
      "classification": "held",
      "sources": [],
      "definition": "Vitamin K1 (phylloquinone); K2 menaquinone-4 and dihydrophylloquinone are separate entries. Current application says Vitamin K without a form-qualified definition.",
      "excluded_alternatives": "No exact total-K equivalence established. Hold import until K1-only use with explicit semantics is approved; never sum incompatible forms.",
      "missing_reason": "semantic_hold"
    },
    {
      "application_nutrient_code": "thiamin_mg",
      "application_unit": "mg",
      "classification": "direct",
      "sources": [
        {
          "id": "1165",
          "name": "Thiamin"
        }
      ],
      "definition": "USDA thiamin mass. Thiamin mass in mg.",
      "excluded_alternatives": "No alternative-form synthesis.",
      "missing_reason": "source_absent"
    },
    {
      "application_nutrient_code": "riboflavin_mg",
      "application_unit": "mg",
      "classification": "direct",
      "sources": [
        {
          "id": "1166",
          "name": "Riboflavin"
        }
      ],
      "definition": "USDA riboflavin mass. Riboflavin mass in mg.",
      "excluded_alternatives": "No alternative-form synthesis.",
      "missing_reason": "source_absent"
    },
    {
      "application_nutrient_code": "niacin_mg",
      "application_unit": "mg",
      "classification": "direct",
      "sources": [
        {
          "id": "1167",
          "name": "Niacin"
        }
      ],
      "definition": "USDA niacin mass. Niacin mass, excluding tryptophan-derived niacin equivalents.",
      "excluded_alternatives": "Document niacin rather than NE; no tryptophan conversion.",
      "missing_reason": "source_absent"
    },
    {
      "application_nutrient_code": "pantothenic_acid_mg",
      "application_unit": "mg",
      "classification": "direct",
      "sources": [
        {
          "id": "1170",
          "name": "Pantothenic acid"
        }
      ],
      "definition": "USDA pantothenic acid mass. Pantothenic acid mass in mg.",
      "excluded_alternatives": "No salt-mass substitution.",
      "missing_reason": "source_absent"
    },
    {
      "application_nutrient_code": "vitamin_b6_mg",
      "application_unit": "mg",
      "classification": "direct",
      "sources": [
        {
          "id": "1175",
          "name": "Vitamin B-6"
        }
      ],
      "definition": "USDA Vitamin B-6 aggregate. Vitamin B6 under the USDA reported aggregate definition.",
      "excluded_alternatives": "Do not add individual vitamers or infer equivalence.",
      "missing_reason": "source_absent"
    },
    {
      "application_nutrient_code": "folate_dfe_ug",
      "application_unit": "ug",
      "classification": "unavailable",
      "sources": [],
      "definition": "Folate expressed as dietary folate equivalents. Folate in micrograms DFE.",
      "excluded_alternatives": "1190 absent; 1177 total folate is not DFE. Separate 1186 folic acid and 1187 food folate inputs are absent.",
      "missing_reason": "unavailable_in_approved_source"
    },
    {
      "application_nutrient_code": "vitamin_b12_ug",
      "application_unit": "ug",
      "classification": "direct",
      "sources": [
        {
          "id": "1178",
          "name": "Vitamin B-12"
        }
      ],
      "definition": "USDA Vitamin B-12 aggregate. Vitamin B12 mass in micrograms.",
      "excluded_alternatives": "Do not substitute unrelated cobalamin activity measures.",
      "missing_reason": "source_absent"
    },
    {
      "application_nutrient_code": "choline_mg",
      "application_unit": "mg",
      "classification": "direct",
      "sources": [
        {
          "id": "1180",
          "name": "Choline, total"
        }
      ],
      "definition": "USDA total choline aggregate. Total choline mass in mg.",
      "excluded_alternatives": "Exclude betaine; do not recompute from choline metabolites.",
      "missing_reason": "source_absent"
    }
  ]
} as const satisfies JsonValue);

export const full35MappingHash = fingerprintJson(full35Mapping);
export type Full35Code = (typeof full35Mapping.mappings)[number]["application_nutrient_code"];
export type Full35Unit = (typeof full35Mapping.mappings)[number]["application_unit"];
