import { foundationPromotionPolicyVersion } from "../../contracts/foundation-promotion-approval.ts";
import {
  parseNormalizedFoundationCandidate,
  type FoundationNormalizedCandidate,
} from "./normalization.ts";

const sourceIds = {
  energy_kcal: new Set(["2048", "2047"]),
  protein_g: new Set(["1003"]),
  carbohydrates_g: new Set(["1005"]),
  fat_g: new Set(["1004"]),
};

export function assertCanonicalDecimalFits(
  value: string,
  precision: number,
  scale: number,
) {
  if (!/^(?:0|[1-9][0-9]*)(?:\.[0-9]+)?$/.test(value)) {
    throw new Error("Projection value is not a canonical nonnegative decimal.");
  }
  const [integer, fraction = ""] = value.split(".");
  if (fraction.length > scale || integer.length + fraction.length > precision) {
    throw new Error("Projection value cannot be stored exactly.");
  }
  return value;
}

export function prepareFoundationProjection(input: unknown) {
  const candidate = parseNormalizedFoundationCandidate(
    input,
  ) as FoundationNormalizedCandidate;
  const nutrients = Object.entries(candidate.nutrients).flatMap(
    ([applicationCode, nutrient]) => {
      if (nutrient.semantic === "missing") return [];
      if (nutrient.semantic === "trace") {
        throw new Error("Trace target nutrients cannot be promoted.");
      }
      if (
        nutrient.value === null ||
        nutrient.source_nutrient_id === null ||
        nutrient.source_unit === null ||
        !["source_reported", "source_calculated", "explicit_zero"].includes(
          nutrient.semantic,
        ) ||
        !sourceIds[applicationCode as keyof typeof sourceIds]?.has(
          nutrient.source_nutrient_id,
        )
      ) {
        throw new Error("Target nutrient is not promotion eligible.");
      }
      assertCanonicalDecimalFits(nutrient.value, 14, 4);
      assertCanonicalDecimalFits(nutrient.value, 24, 10);
      return [{
        application_nutrient_code: applicationCode,
        basis: "per_100g" as const,
        amount: nutrient.value,
        source_nutrient_id: nutrient.source_nutrient_id,
        source_unit: nutrient.source_unit,
        semantic: nutrient.semantic,
        derivation_code: nutrient.derivation_code,
        derivation_description: nutrient.derivation_description,
        exact_conversion_factor: null,
      }];
    },
  );
  return {
    promotion_policy_version: foundationPromotionPolicyVersion,
    concept_key:
      candidate.concept_key ?? "foundation:generated:<database-uuid>",
    upstream_version_key: candidate.upstream_version_key,
    public_food: {
      owner_user_id: null,
      source_code: "usda",
      source_food_id:
        candidate.concept_key ?? "foundation:generated:<database-uuid>",
      food_type: "generic",
      name: candidate.name,
      brand_name: null,
      locale: "en",
      serving_size: null,
      serving_unit: null,
      data_quality: "imported",
      is_public: true,
      is_archived: false,
    },
    nutrients,
    portions: candidate.portion_candidates,
    aliases: [] as const,
    barcodes: [] as const,
  };
}
