import {
  additionalNutrientCodesV1,
  normalizeNutrientFraction,
  parseExactNonnegativeDecimal,
  type AdditionalNutrientCode,
  type ExactFraction,
  type NutrientCode,
  type NutrientReferenceValuesV1,
} from "@/lib/nutrition-snapshots";

export const nutrientFields = ["calories", "protein_g", "carbohydrates_g", "fat_g"] as const;
export type NutrientField = (typeof nutrientFields)[number];
export type AllNutrientField = NutrientField | AdditionalNutrientCode;
export const allNutrientFields: readonly AllNutrientField[] = Object.freeze([
  ...nutrientFields, ...additionalNutrientCodesV1,
]);

export type FoodNutrientReference = Record<NutrientField, number | null> & {
  food_id: string;
  nutrient_basis: string | null;
  serving_quantity: number | null;
  serving_unit: string | null;
};
export type AllFoodNutrientReference = FoodNutrientReference & {
  nutrients: NutrientReferenceValuesV1;
  reference_fingerprint: string;
};

type ScalingFailure = {
  ok: false;
  field: "serving_quantity" | "serving_unit" | "form";
  code: string;
};
export type FoodNutrientScalingResult<Field extends AllNutrientField> =
  | { ok: true; values: Record<Field, string> }
  | ScalingFailure;

const zero = BigInt(0);
const one = BigInt(1);
const thousand = BigInt(1000);

export function nutrientCodeForField(field: AllNutrientField): NutrientCode {
  return field === "calories" ? "energy_kcal" : field;
}

function knownUnit(unit: string) {
  switch (unit.toLowerCase()) {
    case "g": return { dimension: "mass", numerator: one, denominator: one };
    case "kg": return { dimension: "mass", numerator: thousand, denominator: one };
    case "mg": return { dimension: "mass", numerator: one, denominator: thousand };
    case "ml": return { dimension: "volume", numerator: one, denominator: one };
    case "l": return { dimension: "volume", numerator: thousand, denominator: one };
    default: return null;
  }
}

function consumedRatio(
  reference: FoodNutrientReference,
  quantity: string | number | null | undefined,
  unit: string | null | undefined,
): { ok: true; ratio: ExactFraction } | ScalingFailure {
  const amount = parseExactNonnegativeDecimal(quantity);
  if (!amount) return { ok: false, field: "serving_quantity", code: "invalid_quantity" };
  const thousandths = amount.numerator * thousand;
  if (thousandths % amount.denominator !== zero) {
    return { ok: false, field: "serving_quantity", code: "quantity_precision" };
  }
  if (thousandths / amount.denominator > BigInt("9999999999")) {
    return { ok: false, field: "serving_quantity", code: "quantity_out_of_range" };
  }

  const referenceAmount = parseExactNonnegativeDecimal(reference.serving_quantity);
  const referenceUnit = reference.serving_unit?.trim();
  if (!referenceAmount || referenceAmount.numerator === zero || !referenceUnit ||
    !["per_100g", "per_100ml", "per_serving"].includes(reference.nutrient_basis ?? "")) {
    return { ok: false, field: "form", code: "missing_reference" };
  }
  if ((reference.nutrient_basis === "per_100g" &&
      (reference.serving_quantity !== 100 || referenceUnit.toLowerCase() !== "g")) ||
    (reference.nutrient_basis === "per_100ml" &&
      (reference.serving_quantity !== 100 || referenceUnit.toLowerCase() !== "ml"))) {
    return { ok: false, field: "form", code: "invalid_reference" };
  }

  const loggedUnit = unit?.trim();
  if (!loggedUnit) return { ok: false, field: "serving_unit", code: "incompatible_unit" };
  const from = knownUnit(loggedUnit);
  const to = knownUnit(referenceUnit);
  let conversion: ExactFraction;
  if (from && to && from.dimension === to.dimension) {
    conversion = { numerator: from.numerator * to.denominator, denominator: from.denominator * to.numerator };
  } else if (!from && !to && loggedUnit === referenceUnit && reference.nutrient_basis === "per_serving") {
    conversion = { numerator: one, denominator: one };
  } else {
    return { ok: false, field: "serving_unit", code: "incompatible_unit" };
  }
  return {
    ok: true,
    ratio: {
      numerator: amount.numerator * referenceAmount.denominator * conversion.numerator,
      denominator: amount.denominator * referenceAmount.numerator * conversion.denominator,
    },
  };
}

function calculateFields<Field extends AllNutrientField>(
  reference: FoodNutrientReference,
  quantity: string | number | null | undefined,
  unit: string | null | undefined,
  fields: readonly Field[],
  resultFields: readonly Field[],
  rawValue: (field: Field) => string | number | null,
): FoodNutrientScalingResult<Field> {
  const values = Object.fromEntries(resultFields.map((field) => [field, ""])) as Record<Field, string>;
  if (fields.length === 0) return { ok: true, values };
  const multiplier = consumedRatio(reference, quantity, unit);
  if (!multiplier.ok) return multiplier;
  for (const field of fields) {
    if (!allNutrientFields.includes(field)) return { ok: false, field: "form", code: "invalid_reference" };
    const raw = rawValue(field);
    if (raw === null) continue;
    const nutrient = parseExactNonnegativeDecimal(raw);
    if (!nutrient) return { ok: false, field: "form", code: "invalid_reference" };
    const output = normalizeNutrientFraction(nutrientCodeForField(field), {
      numerator: nutrient.numerator * multiplier.ratio.numerator,
      denominator: nutrient.denominator * multiplier.ratio.denominator,
    });
    if (!output.ok) return {
      ok: false, field: "form",
      code: output.code === "amount_out_of_range" ? "nutrient_out_of_range" : "invalid_reference",
    };
    values[field] = output.data === null ? "" : String(output.data);
  }
  return { ok: true, values };
}

export function scaleAllFoodNutrients(
  reference: AllFoodNutrientReference,
  quantity: string | number | null | undefined,
  unit: string | null | undefined,
  fields: readonly AllNutrientField[] = allNutrientFields,
): FoodNutrientScalingResult<AllNutrientField> {
  return calculateFields(reference, quantity, unit, fields, allNutrientFields,
    (field) => reference.nutrients[nutrientCodeForField(field)]);
}

// Retain the original four-field API while sharing the complete manifest's
// arithmetic. Coherent references use their raw map, never display snapshots.
export function scaleFoodNutrients(
  reference: FoodNutrientReference,
  quantity: string | number | null | undefined,
  unit: string | null | undefined,
  fields: readonly NutrientField[] = nutrientFields,
): FoodNutrientScalingResult<NutrientField> {
  const complete = reference as Partial<AllFoodNutrientReference>;
  return calculateFields(reference, quantity, unit, fields, nutrientFields,
    (field) => complete.nutrients ? complete.nutrients[nutrientCodeForField(field)] : reference[field]);
}
