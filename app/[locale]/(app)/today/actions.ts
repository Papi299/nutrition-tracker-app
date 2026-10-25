"use server";

import { revalidatePath } from "next/cache";
import {
  deleteCurrentDiaryEntry,
  updateCurrentDiaryEntry,
  validateDiaryEntryUpdateInput,
  type DiaryEntryMutationError,
  type DiaryEntryUpdateInput,
} from "@/lib/diary-entries";
import {
  defaultLocale,
  locales,
  type Locale,
} from "@/lib/i18n/routing";
import { additionalNutrientCodesV1, normalizeNutrientAmount } from "@/lib/nutrition-snapshots";
import type { DataError } from "@/lib/data/result";
import type {
  DiaryEntryActionState,
  DiaryEntryFieldErrors,
  DiaryEntryFieldName,
  DiaryEntryFieldValues,
} from "./action-state";
import { createDiaryEntryFromReference } from "./create-action";
import {
  diaryEntryCreateInputFields,
  readInputField,
  readTextField,
  sameDisplayedAmount,
} from "./create-submission";

const diaryEntryUpdateInputFields = diaryEntryCreateInputFields.filter(
  (field) => field !== "food_id",
);

function resolveLocale(locale: string): Locale {
  return (locales as readonly string[]).includes(locale)
    ? (locale as Locale)
    : defaultLocale;
}

function readUpdateInput(formData: FormData, values: DiaryEntryFieldValues) {
  const input: DiaryEntryUpdateInput = {};
  const errors: DiaryEntryFieldErrors = {};
  let reviewRequired = false;
  for (const field of [...diaryEntryUpdateInputFields, ...additionalNutrientCodesV1,
    "id", "expected_version", "additional_nutrients_captured"] as const) {
    const entries = formData.getAll(field);
    if (entries.length > 1 || entries.some(value => typeof value !== "string")) errors.form = "invalid_input";
  }
  for (const field of diaryEntryUpdateInputFields) {
    if (formData.has(field)) input[field] = values[field] = readInputField(formData, field);
  }
  values.additional_nutrients_captured = formData.get("additional_nutrients_captured") === "1" ? "1" : "";
  for (const code of additionalNutrientCodesV1) values[code] = readInputField(formData, code);
  if (values.additional_nutrients_captured === "1") {
    const items = [];
    for (const code of additionalNutrientCodesV1) {
      if (!formData.has(code)) { errors.form = "invalid_input"; continue; }
      const raw = values[code] ?? "";
      const amount = normalizeNutrientAmount(code, raw === "" ? null : raw);
      if (!amount.ok) { errors[code] = "invalid_number"; continue; }
      const normalized = amount.data === null ? "" : String(amount.data);
      reviewRequired ||= !sameDisplayedAmount(raw, normalized);
      values[code] = normalized;
      items.push({ code, amount: amount.data });
    }
    input.additional_nutrient_snapshot = { version: 1, values: items };
  } else if (additionalNutrientCodesV1.some(code => values[code] !== "")) {
    errors.form = "capture_required";
  }
  return { input, errors, reviewRequired };
}

function mapFieldErrors(
  fieldErrors: Record<string, string> | undefined,
): DiaryEntryFieldErrors {
  const mapped: DiaryEntryFieldErrors = {};
  const allowedFields = new Set<string>([
    "form",
    "id",
    "idempotency_key",
    "expected_version", "additional_nutrient_snapshot", "additional_nutrients_captured",
    ...additionalNutrientCodesV1,
    ...diaryEntryCreateInputFields,
  ]);

  for (const [field, errorCode] of Object.entries(fieldErrors ?? {})) {
    if (allowedFields.has(field)) {
      mapped[field as DiaryEntryFieldName | "form"] = errorCode;
    }
  }

  return mapped;
}

function validationFailure(
  values: DiaryEntryFieldValues,
  fieldErrors: DiaryEntryFieldErrors,
): DiaryEntryActionState {
  return {
    fieldErrors,
    status: "validation_error",
    values,
  };
}

function actionStateFromError(
  error: DataError | DiaryEntryMutationError,
  values: DiaryEntryFieldValues,
): DiaryEntryActionState {
  if (error.code === "validation_error") {
    return validationFailure(values, mapFieldErrors(error.fieldErrors));
  }

  if (error.code === "already_exists") {
    return {
      status: "database_error",
      values,
    };
  }

  return {
    status: error.code,
    values,
  };
}

function revalidateToday(locale: Locale) {
  revalidatePath(`/${locale}/today`);
}

export async function createDiaryEntryAction(
  localeInput: string, previousState: DiaryEntryActionState, formData: FormData,
): Promise<DiaryEntryActionState> {
  return createDiaryEntryFromReference(localeInput, previousState, formData);
}

export async function updateDiaryEntryAction(
  localeInput: string,
  _previousState: DiaryEntryActionState,
  formData: FormData,
): Promise<DiaryEntryActionState> {
  const locale = resolveLocale(localeInput);
  const id = readTextField(formData, "id");
  const expectedVersion = readTextField(formData, "expected_version");
  const values: DiaryEntryFieldValues = {
    expected_version: expectedVersion,
    id,
  };

  if (id === "") {
    return validationFailure(values, { id: "required" });
  }

  const parsed = readUpdateInput(formData, values);
  if (Object.keys(parsed.errors).length) return validationFailure(values, parsed.errors);
  const validation = validateDiaryEntryUpdateInput(parsed.input);
  if (!validation.ok) return actionStateFromError(validation, values);
  let reviewRequired = parsed.reviewRequired;
  for (const field of ["calories", "protein_g", "carbohydrates_g", "fat_g", "serving_quantity"] as const) {
    if (formData.has(field)) {
      const normalized = validation.data[field] == null ? "" : String(validation.data[field]);
      reviewRequired ||= !sameDisplayedAmount(values[field], normalized);
      values[field] = normalized;
    }
  }
  if (reviewRequired) return validationFailure(values, { form: "nutrition_review_required" });
  const result = await updateCurrentDiaryEntry(id, expectedVersion, parsed.input);

  if (!result.ok) {
    return actionStateFromError(result, values);
  }

  values.expected_version = String(result.data.version);
  revalidateToday(locale);

  return {
    status: "success",
    values,
  };
}

export async function deleteDiaryEntryAction(
  localeInput: string,
  _previousState: DiaryEntryActionState,
  formData: FormData,
): Promise<DiaryEntryActionState> {
  const locale = resolveLocale(localeInput);
  const id = readTextField(formData, "id");
  const values: DiaryEntryFieldValues = { id };

  if (id === "") {
    return validationFailure(values, { id: "required" });
  }

  const result = await deleteCurrentDiaryEntry(id);

  if (!result.ok) {
    return actionStateFromError(result, values);
  }

  revalidateToday(locale);

  return {
    status: "success",
    values,
  };
}
