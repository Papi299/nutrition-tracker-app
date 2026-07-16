import { isCanonicalCalendarDate } from "@/lib/calendar-date";
import {
  diaryEntryMealTypes,
  type DiaryEntryMealType,
} from "@/lib/diary-entries/validation";
import { isUuid } from "@/lib/food-selection/query";

export type SavedMealDiaryLogInput = Record<string, unknown>;

export type ValidatedSavedMealDiaryLogInput = {
  entry_date: string;
  expected_source_updated_at: string;
  idempotency_key: string;
  meal_type: DiaryEntryMealType;
  saved_meal_id: string;
};

export type SavedMealDiaryLogValidation =
  | { data: ValidatedSavedMealDiaryLogInput; ok: true }
  | {
      code: "validation_error";
      fieldErrors: Record<string, string>;
      ok: false;
    };

const fields = new Set([
  "entry_date",
  "expected_source_updated_at",
  "idempotency_key",
  "meal_type",
  "saved_meal_id",
]);

export function validateSavedMealDiaryLogInput(
  input: SavedMealDiaryLogInput,
): SavedMealDiaryLogValidation {
  const errors: Record<string, string> = {};

  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    return {
      code: "validation_error",
      fieldErrors: { form: "invalid_input" },
      ok: false,
    };
  }

  for (const field of Object.keys(input)) {
    if (!fields.has(field)) errors[field] = "unsupported_field";
  }

  const savedMealId = input.saved_meal_id;
  const idempotencyKey = input.idempotency_key;
  const expectedVersion = input.expected_source_updated_at;
  const entryDate = input.entry_date;
  const mealType = input.meal_type;

  if (typeof savedMealId !== "string" || !isUuid(savedMealId)) {
    errors.saved_meal_id = "invalid_uuid";
  }

  if (typeof idempotencyKey !== "string" || !isUuid(idempotencyKey)) {
    errors.idempotency_key = "invalid_uuid";
  }

  if (
    typeof expectedVersion !== "string" ||
    expectedVersion.trim() !== expectedVersion ||
    !Number.isFinite(Date.parse(expectedVersion))
  ) {
    errors.expected_source_updated_at = "invalid_timestamp";
  }

  if (typeof entryDate !== "string" || !isCanonicalCalendarDate(entryDate)) {
    errors.entry_date = "invalid_date";
  }

  if (
    typeof mealType !== "string" ||
    !diaryEntryMealTypes.includes(mealType as DiaryEntryMealType)
  ) {
    errors.meal_type = "unsupported_meal_type";
  }

  if (Object.keys(errors).length > 0) {
    return { code: "validation_error", fieldErrors: errors, ok: false };
  }

  return {
    data: {
      entry_date: entryDate as string,
      expected_source_updated_at: expectedVersion as string,
      idempotency_key: idempotencyKey as string,
      meal_type: mealType as DiaryEntryMealType,
      saved_meal_id: savedMealId as string,
    },
    ok: true,
  };
}
