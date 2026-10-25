import "server-only";

import { getAuthenticatedUserId } from "@/lib/data/auth";
import { allNutrientFields, scaleAllFoodNutrients, type AllFoodNutrientReference } from "@/lib/food-selection/nutrient-scaling";
import {
  additionalNutrientCodesV1, normalizeNutrientAmount,
  parseExactNonnegativeDecimal,
} from "@/lib/nutrition-snapshots";
import {
  createDiaryEntryForCurrentUser, validateDiaryEntryCreateInput,
  type DiaryEntryCreateInput,
} from "@/lib/diary-entries";
import type { DiaryEntryFieldName, DiaryEntryFieldValues } from "./action-state";

export const diaryEntryCreateInputFields = [
  "brand_name", "calories", "carbohydrates_g", "entry_date", "fat_g", "food_id",
  "food_name", "meal_type", "notes", "protein_g", "serving_quantity", "serving_unit",
] as const;

export type TrustedDiaryReferenceContext = {
  ownerId: string;
  reference: AllFoodNutrientReference;
};

export function readTextField(formData: FormData, field: DiaryEntryFieldName) {
  const value = formData.get(field);
  return typeof value === "string" ? value.trim() : "";
}

export function readInputField(formData: FormData, field: DiaryEntryFieldName) {
  if (field === "entry_date") {
    const value = formData.get(field);
    return typeof value === "string" ? value : "";
  }
  return readTextField(formData, field);
}

export function readCreateValues(formData: FormData): DiaryEntryFieldValues {
  const values: DiaryEntryFieldValues = {};
  for (const field of [...diaryEntryCreateInputFields, ...additionalNutrientCodesV1,
    "reference_fingerprint", "additional_nutrients_captured"] as const) {
    values[field] = readInputField(formData, field);
  }
  for (const field of allNutrientFields) {
    values[`automatic_${field}`] = formData.get(`automatic_${field}`) === "1" ? "1" : "";
  }
  return values;
}

// Equality is decimal equality, not equality of formatting or binary floats.
export function sameDisplayedAmount(left: string | undefined, right: string | undefined) {
  if (!left?.trim() || !right?.trim()) return !left?.trim() && !right?.trim();
  const a = parseExactNonnegativeDecimal(left);
  const b = parseExactNonnegativeDecimal(right);
  return Boolean(a && b && a.numerator * b.denominator === b.numerator * a.denominator);
}

function readCreateInput(values: DiaryEntryFieldValues): DiaryEntryCreateInput {
  return Object.fromEntries(diaryEntryCreateInputFields.map(field => [field, values[field]]));
}

export async function submitDiaryEntryCreate(formData: FormData, context?: TrustedDiaryReferenceContext) {
  const values: DiaryEntryFieldValues = { ...readCreateValues(formData), idempotency_key: readTextField(formData, "idempotency_key") };
  const fail = (fieldErrors: Record<string, string>) => ({
    result: { ok: false as const, code: "validation_error" as const, fieldErrors }, values,
  });
  const uniqueFields = new Set<DiaryEntryFieldName>([
    ...diaryEntryCreateInputFields, ...allNutrientFields,
    ...allNutrientFields.map(field => `automatic_${field}` as const),
    "idempotency_key", "reference_fingerprint", "additional_nutrients_captured",
  ]);
  for (const field of uniqueFields) {
    const entries = formData.getAll(field);
    if (entries.length > 1 || entries.some(value => typeof value !== "string")) return fail({ form: "invalid_input" });
    if (field.startsWith("automatic_") && entries.length === 1 && entries[0] !== "1") return fail({ form: "invalid_input" });
  }
  const captured = formData.has("additional_nutrients_captured");
  if ((captured && values.additional_nutrients_captured !== "1") || (!captured &&
    additionalNutrientCodesV1.some(code => formData.has(code) || formData.has(`automatic_${code}`)))) {
    return fail({ form: "invalid_input" });
  }
  const auth = await getAuthenticatedUserId();
  if (!auth.ok || (context && auth.data !== context.ownerId)) {
    return { result: { ok: false as const, code: "unauthenticated" as const }, values };
  }
  const automaticFields = allNutrientFields.filter(field => values[`automatic_${field}`] === "1");
  let reviewRequired = false;
  if (automaticFields.length > 0) {
    if (!context || context.reference.food_id !== values.food_id) return fail({ form: "missing_reference" });
    if (values.reference_fingerprint !== context.reference.reference_fingerprint) {
      for (const field of allNutrientFields) values[`automatic_${field}`] = "";
      values.reference_fingerprint = context.reference.reference_fingerprint;
      return fail({ form: "reference_changed" });
    }
    const scaled = scaleAllFoodNutrients(context.reference, values.serving_quantity, values.serving_unit, automaticFields);
    if (!scaled.ok) return fail({ [scaled.field]: scaled.code });
    for (const field of automaticFields) {
      reviewRequired ||= !sameDisplayedAmount(values[field], scaled.values[field]);
      values[field] = scaled.values[field];
    }
  }
  const input = readCreateInput(values);
  if (captured) {
    const items = [];
    const errors: Record<string, string> = {};
    for (const code of additionalNutrientCodesV1) {
      const raw = values[code]?.trim() ?? "";
      const amount = normalizeNutrientAmount(code, raw === "" ? null : raw);
      if (!amount.ok) {
        errors[code] = amount.code === "amount_out_of_range" ? "out_of_range" : "invalid_number";
        continue;
      }
      const normalized = amount.data === null ? "" : String(amount.data);
      reviewRequired ||= !sameDisplayedAmount(raw, normalized);
      values[code] = normalized;
      items.push({ code, amount: amount.data });
    }
    if (Object.keys(errors).length) return fail(errors);
    input.additional_nutrient_snapshot = { version: 1, values: items };
  }
  const validation = validateDiaryEntryCreateInput(input);
  if (!validation.ok) return { result: validation, values };
  for (const field of ["calories", "protein_g", "carbohydrates_g", "fat_g", "serving_quantity"] as const) {
    const normalized = validation.data[field] == null ? "" : String(validation.data[field]);
    reviewRequired ||= !sameDisplayedAmount(values[field], normalized);
    values[field] = normalized;
  }
  // Native and tampered previews must be reviewed before any row or receipt is
  // written. JavaScript's matching previews reach persistence in one request.
  if (reviewRequired) return fail({ form: "nutrition_review_required" });
  const result = await createDiaryEntryForCurrentUser(input, values.idempotency_key!);
  return { result, values };
}
