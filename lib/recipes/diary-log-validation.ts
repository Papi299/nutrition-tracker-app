import { isCanonicalCalendarDate } from "@/lib/calendar-date";
import {
  diaryEntryMealTypes,
  type DiaryEntryMealType,
} from "@/lib/diary-entries/validation";
import { isUuid } from "@/lib/food-selection/query";
import { validateRecipeUseContractInput } from "./use-contract-validation";

export type RecipeDiaryLogInput = Record<string, unknown>;

export type ValidatedRecipeDiaryLogInput = {
  entry_date: string;
  expected_source_updated_at: string;
  idempotency_key: string;
  meal_type: DiaryEntryMealType;
  recipe_id: string;
  requested_servings: number;
};

export type RecipeDiaryLogValidation =
  | { data: ValidatedRecipeDiaryLogInput; ok: true }
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
  "recipe_id",
  "requested_servings",
]);

const timestampPattern =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/;

export function validateRecipeDiaryLogInput(
  input: RecipeDiaryLogInput,
): RecipeDiaryLogValidation {
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

  const recipeId = input.recipe_id;
  const idempotencyKey = input.idempotency_key;
  const expectedVersion = input.expected_source_updated_at;
  const entryDate = input.entry_date;
  const mealType = input.meal_type;

  if (typeof recipeId !== "string" || !isUuid(recipeId)) {
    errors.recipe_id = "invalid_uuid";
  }

  if (typeof idempotencyKey !== "string" || !isUuid(idempotencyKey)) {
    errors.idempotency_key = "invalid_uuid";
  }

  if (
    typeof expectedVersion !== "string" ||
    !timestampPattern.test(expectedVersion) ||
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

  const servings =
    typeof recipeId === "string"
      ? validateRecipeUseContractInput({
          recipe_id: recipeId,
          requested_servings: input.requested_servings,
        })
      : null;
  if (!servings?.ok) errors.requested_servings = "invalid_servings";

  if (Object.keys(errors).length > 0 || !servings?.ok) {
    return { code: "validation_error", fieldErrors: errors, ok: false };
  }

  return {
    data: {
      entry_date: entryDate as string,
      expected_source_updated_at: expectedVersion as string,
      idempotency_key: idempotencyKey as string,
      meal_type: mealType as DiaryEntryMealType,
      recipe_id: recipeId as string,
      requested_servings: servings.data.requested_servings,
    },
    ok: true,
  };
}
