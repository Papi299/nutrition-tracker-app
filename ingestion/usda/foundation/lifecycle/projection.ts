import { fingerprintJson, type JsonValue } from "../canonical-json.ts";
import {
  parseNormalizedFoundationCandidate,
  type FoundationNormalizedCandidate,
} from "../normalization.ts";
import {
  foundationLifecycleNutrientCodes,
  type FoundationLifecycleNutrientProjection,
  type FoundationLifecycleProjection,
} from "./types.ts";

const supportedSourceUnits = {
  carbohydrates_g: "g",
  energy_kcal: "kcal",
  fat_g: "g",
  protein_g: "g",
} as const;

export function projectionBlockCategory(
  input: FoundationNormalizedCandidate,
): "trace_blocked" | "unsupported" | null {
  for (const code of foundationLifecycleNutrientCodes) {
    const nutrient = input.nutrients[code];
    if (nutrient.semantic === "trace") return "trace_blocked";
    if (
      nutrient.semantic !== "missing" &&
      nutrient.source_unit !== supportedSourceUnits[code]
    ) return "unsupported";
  }
  return null;
}

export function candidateProjection(
  input: unknown,
  isArchived = false,
): FoundationLifecycleProjection {
  const candidate = parseNormalizedFoundationCandidate(input);
  const nutrients = foundationLifecycleNutrientCodes.map((code) => {
    const nutrient = candidate.nutrients[code];
    if (nutrient.semantic === "missing") {
      return {
        nutrient_code: code,
        projection_state: "missing",
        basis: null,
        amount: null,
        source_semantic: null,
        source_nutrient_id: null,
        source_unit: null,
        derivation_code: null,
        derivation_description: null,
      } satisfies FoundationLifecycleNutrientProjection;
    }
    if (
      nutrient.semantic === "trace" ||
      nutrient.value === null ||
      !["source_reported", "source_calculated", "explicit_zero"].includes(
        nutrient.semantic,
      )
    ) {
      throw new Error("Blocked nutrient cannot form a lifecycle projection.");
    }
    const amount = Number(nutrient.value);
    if (!Number.isFinite(amount) || amount < 0) {
      throw new Error("Lifecycle nutrient amount is invalid.");
    }
    return {
      nutrient_code: code,
      projection_state: "present",
      basis: "per_100g",
      amount,
      source_semantic: nutrient.semantic,
      source_nutrient_id: nutrient.source_nutrient_id,
      source_unit: nutrient.source_unit,
      derivation_code: nutrient.derivation_code,
      derivation_description: nutrient.derivation_description,
    } satisfies FoundationLifecycleNutrientProjection;
  });
  return {
    contract_version: "foundation-lifecycle-projection/v1",
    name: candidate.name,
    brand_name: null,
    locale: "en",
    food_type: "generic",
    data_quality: "imported",
    is_public: true,
    is_archived: isArchived,
    serving_size: null,
    serving_unit: null,
    nutrients,
  };
}

export function fingerprintLifecycleProjection(
  projection: FoundationLifecycleProjection,
) {
  return fingerprintJson(projection as JsonValue);
}

export function candidateSourceMetadataFingerprint(input: unknown) {
  const candidate = parseNormalizedFoundationCandidate(input);
  return fingerprintJson(candidate.source_metadata as JsonValue);
}
