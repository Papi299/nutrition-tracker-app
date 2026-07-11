import type { DataResult } from "@/lib/data/result";
import { validationError } from "@/lib/data/result";
import { isCanonicalCalendarDate } from "@/lib/calendar-date";

export type NutritionTargetInput = {
  calories?: null | number;
  carbohydrates_g?: null | number;
  effective_from: null | string;
  fat_g?: null | number;
  protein_g?: null | number;
};

export type ValidatedNutritionTargetInput = {
  calories: null | number;
  carbohydrates_g: null | number;
  effective_from: string;
  fat_g: null | number;
  protein_g: null | number;
};

const allowedTargetFields = new Set([
  "calories",
  "carbohydrates_g",
  "effective_from",
  "fat_g",
  "protein_g",
]);

function isObjectRecord(input: unknown): input is Record<string, unknown> {
  return typeof input === "object" && input !== null && !Array.isArray(input);
}

export function isValidDateString(value: string) {
  return isCanonicalCalendarDate(value);
}

export function validateTargetDate(date: unknown): DataResult<string> {
  if (typeof date !== "string" || date === "") {
    return validationError({ effective_from: "required" });
  }

  if (!isValidDateString(date)) {
    return validationError({ effective_from: "invalid_date" });
  }

  return { data: date, ok: true };
}

function normalizeNullableNumber(
  value: unknown,
  field: string,
  fieldErrors: Record<string, string>,
): null | number {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  if (typeof value !== "number" || !Number.isFinite(value)) {
    fieldErrors[field] = "invalid_number";
    return null;
  }

  if (value < 0) {
    fieldErrors[field] = "negative_value";
    return null;
  }

  return value;
}

function normalizeCalories(
  value: unknown,
  fieldErrors: Record<string, string>,
): null | number {
  const calories = normalizeNullableNumber(value, "calories", fieldErrors);

  if (calories !== null && !Number.isInteger(calories)) {
    fieldErrors.calories = "invalid_integer";
    return null;
  }

  return calories;
}

export function validateNutritionTargetInput(
  input: unknown,
): DataResult<ValidatedNutritionTargetInput> {
  const fieldErrors: Record<string, string> = {};

  if (!isObjectRecord(input)) {
    return validationError({ form: "invalid_input" });
  }

  for (const key of Object.keys(input)) {
    if (!allowedTargetFields.has(key)) {
      fieldErrors[key] = "unsupported_field";
    }
  }

  const dateResult = validateTargetDate(input.effective_from);

  if (!dateResult.ok) {
    Object.assign(fieldErrors, dateResult.fieldErrors);
  }

  const calories = normalizeCalories(input.calories, fieldErrors);
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

  if (Object.keys(fieldErrors).length > 0) {
    return validationError(fieldErrors);
  }

  return {
    data: {
      calories,
      carbohydrates_g: carbohydrates,
      effective_from: dateResult.ok ? dateResult.data : "",
      fat_g: fat,
      protein_g: protein,
    },
    ok: true,
  };
}
