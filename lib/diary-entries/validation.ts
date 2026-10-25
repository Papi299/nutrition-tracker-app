import type { DataResult } from "@/lib/data/result";
import { validationError } from "@/lib/data/result";
import { isCanonicalCalendarDate } from "@/lib/calendar-date";
import { isUuid } from "@/lib/food-selection/query";
import type { TablesInsert, TablesUpdate } from "@/lib/supabase/database.types";
import {
  normalizeAdditionalNutrientRequest, normalizeNutrientAmount,
  parseExactNonnegativeDecimal, formatExactFraction,
} from "@/lib/nutrition-snapshots";

export const diaryEntryMealTypes = [
  "breakfast",
  "lunch",
  "dinner",
  "snack",
  "other",
] as const;

export const diaryEntrySource = "manual";
export const maxFoodNameLength = 200;
export const maxBrandNameLength = 120;
export const maxServingUnitLength = 40;
export const maxNotesLength = 1000;

export type DiaryEntryMealType = (typeof diaryEntryMealTypes)[number];

export type DiaryMealTypeQueryResult =
  | { status: "missing" }
  | { meal_type: DiaryEntryMealType; status: "valid" }
  | { status: "invalid" }
  | { status: "repeated" };

export function parseDiaryMealTypeQuery(
  value: string | string[] | undefined,
): DiaryMealTypeQueryResult {
  if (value === undefined) return { status: "missing" };
  if (Array.isArray(value)) return { status: "repeated" };
  if (!diaryEntryMealTypes.includes(value as DiaryEntryMealType)) {
    return { status: "invalid" };
  }
  return { meal_type: value as DiaryEntryMealType, status: "valid" };
}

export type DiaryEntryCreateInput = {
  additional_nutrient_snapshot?: unknown;
  brand_name?: null | string;
  calories?: null | number | string;
  carbohydrates_g?: null | number | string;
  entry_date?: null | string;
  fat_g?: null | number | string;
  food_id?: null | string;
  food_name?: null | string;
  meal_type?: null | string;
  notes?: null | string;
  protein_g?: null | number | string;
  serving_quantity?: null | number | string;
  serving_unit?: null | string;
};

export type DiaryEntryUpdateInput = Partial<
  Omit<DiaryEntryCreateInput, "food_id">
>;

export type ValidatedDiaryEntryCreateInput = Omit<
  TablesInsert<"diary_entries">,
  "created_at" | "id" | "updated_at" | "user_id"
>;

export type ValidatedDiaryEntryUpdateInput = Pick<
  TablesUpdate<"diary_entries">,
  | "additional_nutrient_snapshot"
  | "brand_name"
  | "calories"
  | "carbohydrates_g"
  | "entry_date"
  | "fat_g"
  | "food_name"
  | "meal_type"
  | "notes"
  | "protein_g"
  | "serving_quantity"
  | "serving_unit"
>;

const allowedDiaryEntryCreateFields = new Set([
  "additional_nutrient_snapshot",
  "brand_name",
  "calories",
  "carbohydrates_g",
  "entry_date",
  "fat_g",
  "food_id",
  "food_name",
  "meal_type",
  "notes",
  "protein_g",
  "serving_quantity",
  "serving_unit",
]);

const allowedDiaryEntryUpdateFields = new Set(
  [...allowedDiaryEntryCreateFields].filter((field) => field !== "food_id"),
);

function isObjectRecord(input: unknown): input is Record<string, unknown> {
  return typeof input === "object" && input !== null && !Array.isArray(input);
}

function hasOwn(input: Record<string, unknown>, field: string) {
  return Object.prototype.hasOwnProperty.call(input, field);
}

export function isValidDiaryEntryDate(value: string) {
  return isCanonicalCalendarDate(value);
}

export function validateDiaryEntryDate(
  value: unknown,
): DataResult<string> {
  if (typeof value !== "string" || value === "") {
    return validationError({ entry_date: "required" });
  }

  if (!isValidDiaryEntryDate(value)) {
    return validationError({ entry_date: "invalid_date" });
  }

  return { data: value, ok: true };
}

export function validateDiaryEntryIdempotencyKey(
  value: unknown,
): DataResult<string> {
  if (typeof value !== "string" || !isUuid(value)) {
    return validationError({ idempotency_key: "invalid_uuid" });
  }

  return { data: value, ok: true };
}

export function validateDiaryEntryVersion(
  value: unknown,
): DataResult<number> {
  const parsed =
    typeof value === "number"
      ? value
      : typeof value === "string" && value.trim() !== ""
        ? Number(value)
        : Number.NaN;

  if (!Number.isSafeInteger(parsed) || parsed < 1) {
    return validationError({ expected_version: "invalid_version" });
  }

  return { data: parsed, ok: true };
}

function normalizeRequiredDate(
  input: Record<string, unknown>,
  fieldErrors: Record<string, string>,
) {
  const result = validateDiaryEntryDate(input.entry_date);

  if (!result.ok) {
    Object.assign(fieldErrors, result.fieldErrors);
    return "";
  }

  return result.data;
}

function normalizeOptionalDate(
  input: Record<string, unknown>,
  fieldErrors: Record<string, string>,
) {
  if (!hasOwn(input, "entry_date")) {
    return undefined;
  }

  const result = validateDiaryEntryDate(input.entry_date);

  if (!result.ok) {
    Object.assign(fieldErrors, result.fieldErrors);
    return undefined;
  }

  return result.data;
}

function isMealType(value: unknown): value is DiaryEntryMealType {
  return (
    typeof value === "string" &&
    diaryEntryMealTypes.includes(value as DiaryEntryMealType)
  );
}

function normalizeRequiredMealType(
  value: unknown,
  fieldErrors: Record<string, string>,
) {
  if (!isMealType(value)) {
    fieldErrors.meal_type = "unsupported_meal_type";
    return diaryEntryMealTypes[4];
  }

  return value;
}

function normalizeOptionalMealType(
  input: Record<string, unknown>,
  fieldErrors: Record<string, string>,
) {
  if (!hasOwn(input, "meal_type")) {
    return undefined;
  }

  return normalizeRequiredMealType(input.meal_type, fieldErrors);
}

function normalizeRequiredText(
  value: unknown,
  field: string,
  maxLength: number,
  fieldErrors: Record<string, string>,
) {
  if (typeof value !== "string") {
    fieldErrors[field] = "required";
    return "";
  }

  const trimmed = value.trim();

  if (trimmed.length === 0) {
    fieldErrors[field] = "required";
    return "";
  }

  if (trimmed.length > maxLength) {
    fieldErrors[field] = "too_long";
    return "";
  }

  return trimmed;
}

function normalizeOptionalRequiredText(
  input: Record<string, unknown>,
  field: string,
  maxLength: number,
  fieldErrors: Record<string, string>,
) {
  if (!hasOwn(input, field)) {
    return undefined;
  }

  return normalizeRequiredText(input[field], field, maxLength, fieldErrors);
}

function normalizeNullableText(
  value: unknown,
  field: string,
  maxLength: number,
  fieldErrors: Record<string, string>,
) {
  if (value === undefined || value === null) {
    return null;
  }

  if (typeof value !== "string") {
    fieldErrors[field] = "invalid_type";
    return null;
  }

  const trimmed = value.trim();

  if (trimmed.length === 0) {
    return null;
  }

  if (trimmed.length > maxLength) {
    fieldErrors[field] = "too_long";
    return null;
  }

  return trimmed;
}

function normalizeOptionalNullableText(
  input: Record<string, unknown>,
  field: string,
  maxLength: number,
  fieldErrors: Record<string, string>,
) {
  if (!hasOwn(input, field)) {
    return undefined;
  }

  return normalizeNullableText(input[field], field, maxLength, fieldErrors);
}

function normalizeNullableNumber(
  value: unknown,
  field: string,
  fieldErrors: Record<string, string>,
) {
  if (value === undefined || value === null) {
    return null;
  }

  if (typeof value === "string" && value.trim() === "") {
    return null;
  }

  if (typeof value !== "number" && typeof value !== "string") {
    fieldErrors[field] = "invalid_number";
    return null;
  }

  const parsed = typeof value === "number" ? value : Number(value);

  if (!Number.isFinite(parsed)) {
    fieldErrors[field] = "invalid_number";
    return null;
  }

  if (parsed < 0) {
    fieldErrors[field] = "negative_value";
    return null;
  }

  if (field === "calories") {
    if (parsed > 2_147_483_647) fieldErrors[field] = "out_of_range";
    return parsed;
  }
  if (field === "serving_quantity") {
    const exact = parseExactNonnegativeDecimal(value);
    const rounded = exact ? formatExactFraction(exact, 3) : null;
    if (rounded === null || Number(rounded) > 9_999_999.999) {
      fieldErrors[field] = "out_of_range";
      return null;
    }
    return Number(rounded);
  }
  if (field === "protein_g" || field === "carbohydrates_g" || field === "fat_g") {
    const result = normalizeNutrientAmount(field, value);
    if (!result.ok) {
      fieldErrors[field] = result.code === "amount_out_of_range" ? "out_of_range" : "invalid_number";
      return null;
    }
    return result.data;
  }
  return parsed;
}

function normalizeOptionalNullableNumber(
  input: Record<string, unknown>,
  field: string,
  fieldErrors: Record<string, string>,
) {
  if (!hasOwn(input, field)) {
    return undefined;
  }

  return normalizeNullableNumber(input[field], field, fieldErrors);
}

function normalizeNullableInteger(
  value: unknown,
  field: string,
  fieldErrors: Record<string, string>,
) {
  const parsed = normalizeNullableNumber(value, field, fieldErrors);

  if (parsed !== null && !Number.isInteger(parsed)) {
    fieldErrors[field] = "invalid_integer";
    return null;
  }

  return parsed;
}

function normalizeOptionalNullableInteger(
  input: Record<string, unknown>,
  field: string,
  fieldErrors: Record<string, string>,
) {
  if (!hasOwn(input, field)) {
    return undefined;
  }

  return normalizeNullableInteger(input[field], field, fieldErrors);
}

function normalizeNullableUuid(
  value: unknown,
  field: string,
  fieldErrors: Record<string, string>,
) {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  if (typeof value !== "string" || !isUuid(value)) {
    fieldErrors[field] = "invalid_uuid";
    return null;
  }

  return value;
}

function collectUnsupportedFields(
  input: Record<string, unknown>,
  fieldErrors: Record<string, string>,
  allowedFields: Set<string>,
) {
  for (const key of Object.keys(input)) {
    if (!allowedFields.has(key)) {
      fieldErrors[key] = "unsupported_field";
    }
  }
}

export function validateDiaryEntryCreateInput(
  input: unknown,
): DataResult<ValidatedDiaryEntryCreateInput> {
  const fieldErrors: Record<string, string> = {};

  if (!isObjectRecord(input)) {
    return validationError({ form: "invalid_input" });
  }

  collectUnsupportedFields(input, fieldErrors, allowedDiaryEntryCreateFields);

  const entryDate = normalizeRequiredDate(input, fieldErrors);
  const mealType = normalizeRequiredMealType(input.meal_type, fieldErrors);
  const foodName = normalizeRequiredText(
    input.food_name,
    "food_name",
    maxFoodNameLength,
    fieldErrors,
  );
  const brandName = normalizeNullableText(
    input.brand_name,
    "brand_name",
    maxBrandNameLength,
    fieldErrors,
  );
  const servingQuantity = normalizeNullableNumber(
    input.serving_quantity,
    "serving_quantity",
    fieldErrors,
  );
  const servingUnit = normalizeNullableText(
    input.serving_unit,
    "serving_unit",
    maxServingUnitLength,
    fieldErrors,
  );
  const calories = normalizeNullableInteger(
    input.calories,
    "calories",
    fieldErrors,
  );
  const protein = normalizeNullableNumber(
    input.protein_g,
    "protein_g",
    fieldErrors,
  );
  const carbohydrates = normalizeNullableNumber(
    input.carbohydrates_g,
    "carbohydrates_g",
    fieldErrors,
  );
  const fat = normalizeNullableNumber(input.fat_g, "fat_g", fieldErrors);
  const foodId = normalizeNullableUuid(input.food_id, "food_id", fieldErrors);
  const notes = normalizeNullableText(
    input.notes,
    "notes",
    maxNotesLength,
    fieldErrors,
  );
  const additional = hasOwn(input, "additional_nutrient_snapshot")
    ? normalizeAdditionalNutrientRequest(input.additional_nutrient_snapshot) : undefined;
  if (additional && !additional.ok) fieldErrors.additional_nutrient_snapshot = additional.code;

  if (Object.keys(fieldErrors).length > 0) {
    return validationError(fieldErrors);
  }

  return {
    data: {
      ...(additional?.ok ? { additional_nutrient_snapshot: additional.data } : {}),
      brand_name: brandName,
      calories,
      carbohydrates_g: carbohydrates,
      entry_date: entryDate,
      fat_g: fat,
      food_id: foodId,
      food_name: foodName,
      meal_type: mealType,
      notes,
      protein_g: protein,
      serving_quantity: servingQuantity,
      serving_unit: servingUnit,
      source: diaryEntrySource,
    },
    ok: true,
  };
}

export function validateDiaryEntryUpdateInput(
  input: unknown,
): DataResult<ValidatedDiaryEntryUpdateInput> {
  const fieldErrors: Record<string, string> = {};

  if (!isObjectRecord(input)) {
    return validationError({ form: "invalid_input" });
  }

  collectUnsupportedFields(input, fieldErrors, allowedDiaryEntryUpdateFields);

  const update: ValidatedDiaryEntryUpdateInput = {};
  const entryDate = normalizeOptionalDate(input, fieldErrors);
  const mealType = normalizeOptionalMealType(input, fieldErrors);
  const foodName = normalizeOptionalRequiredText(
    input,
    "food_name",
    maxFoodNameLength,
    fieldErrors,
  );
  const brandName = normalizeOptionalNullableText(
    input,
    "brand_name",
    maxBrandNameLength,
    fieldErrors,
  );
  const servingQuantity = normalizeOptionalNullableNumber(
    input,
    "serving_quantity",
    fieldErrors,
  );
  const servingUnit = normalizeOptionalNullableText(
    input,
    "serving_unit",
    maxServingUnitLength,
    fieldErrors,
  );
  const calories = normalizeOptionalNullableInteger(
    input,
    "calories",
    fieldErrors,
  );
  const protein = normalizeOptionalNullableNumber(
    input,
    "protein_g",
    fieldErrors,
  );
  const carbohydrates = normalizeOptionalNullableNumber(
    input,
    "carbohydrates_g",
    fieldErrors,
  );
  const fat = normalizeOptionalNullableNumber(input, "fat_g", fieldErrors);
  const notes = normalizeOptionalNullableText(
    input,
    "notes",
    maxNotesLength,
    fieldErrors,
  );

  if (entryDate !== undefined) update.entry_date = entryDate;
  if (mealType !== undefined) update.meal_type = mealType;
  if (foodName !== undefined) update.food_name = foodName;
  if (brandName !== undefined) update.brand_name = brandName;
  if (servingQuantity !== undefined) update.serving_quantity = servingQuantity;
  if (servingUnit !== undefined) update.serving_unit = servingUnit;
  if (calories !== undefined) update.calories = calories;
  if (protein !== undefined) update.protein_g = protein;
  if (carbohydrates !== undefined) update.carbohydrates_g = carbohydrates;
  if (fat !== undefined) update.fat_g = fat;
  if (notes !== undefined) update.notes = notes;
  if (hasOwn(input, "additional_nutrient_snapshot")) {
    const additional = normalizeAdditionalNutrientRequest(input.additional_nutrient_snapshot);
    if (additional.ok) update.additional_nutrient_snapshot = additional.data;
    else fieldErrors.additional_nutrient_snapshot = additional.code;
  }

  if (Object.keys(update).length === 0) {
    fieldErrors.form = "empty_update";
  }

  if (Object.keys(fieldErrors).length > 0) {
    return validationError(fieldErrors);
  }

  return { data: update, ok: true };
}
