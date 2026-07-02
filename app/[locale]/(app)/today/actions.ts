"use server";

import { revalidatePath } from "next/cache";
import {
  createDiaryEntryForCurrentUser,
  deleteCurrentDiaryEntry,
  updateCurrentDiaryEntry,
  type DiaryEntryCreateInput,
  type DiaryEntryUpdateInput,
} from "@/lib/diary-entries";
import {
  defaultLocale,
  locales,
  type Locale,
} from "@/lib/i18n/routing";
import type { DataError } from "@/lib/data/result";
import type {
  DiaryEntryActionState,
  DiaryEntryFieldErrors,
  DiaryEntryFieldName,
  DiaryEntryFieldValues,
} from "./action-state";

const diaryEntryInputFields = [
  "brand_name",
  "calories",
  "carbohydrates_g",
  "entry_date",
  "fat_g",
  "food_name",
  "meal_type",
  "notes",
  "protein_g",
  "serving_quantity",
  "serving_unit",
] as const satisfies readonly Exclude<DiaryEntryFieldName, "id">[];

function resolveLocale(locale: string): Locale {
  return (locales as readonly string[]).includes(locale)
    ? (locale as Locale)
    : defaultLocale;
}

function readTextField(formData: FormData, field: DiaryEntryFieldName) {
  const value = formData.get(field);

  return typeof value === "string" ? value.trim() : "";
}

function readCreateValues(formData: FormData): DiaryEntryFieldValues {
  return diaryEntryInputFields.reduce<DiaryEntryFieldValues>((values, field) => {
    values[field] = readTextField(formData, field);
    return values;
  }, {});
}

function readCreateInput(
  values: DiaryEntryFieldValues,
): DiaryEntryCreateInput {
  return {
    brand_name: values.brand_name,
    calories: values.calories,
    carbohydrates_g: values.carbohydrates_g,
    entry_date: values.entry_date,
    fat_g: values.fat_g,
    food_name: values.food_name,
    meal_type: values.meal_type,
    notes: values.notes,
    protein_g: values.protein_g,
    serving_quantity: values.serving_quantity,
    serving_unit: values.serving_unit,
  };
}

function readUpdateInput(
  formData: FormData,
  values: DiaryEntryFieldValues,
): DiaryEntryUpdateInput {
  return diaryEntryInputFields.reduce<DiaryEntryUpdateInput>((input, field) => {
    if (formData.has(field)) {
      values[field] = readTextField(formData, field);
      input[field] = values[field];
    }

    return input;
  }, {});
}

function mapFieldErrors(
  fieldErrors: Record<string, string> | undefined,
): DiaryEntryFieldErrors {
  const mapped: DiaryEntryFieldErrors = {};
  const allowedFields = new Set<string>(["form", "id", ...diaryEntryInputFields]);

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
  error: DataError,
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
  localeInput: string,
  _previousState: DiaryEntryActionState,
  formData: FormData,
): Promise<DiaryEntryActionState> {
  const locale = resolveLocale(localeInput);
  const values = readCreateValues(formData);
  const result = await createDiaryEntryForCurrentUser(readCreateInput(values));

  if (!result.ok) {
    return actionStateFromError(result, values);
  }

  revalidateToday(locale);

  return {
    status: "success",
    values,
  };
}

export async function updateDiaryEntryAction(
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

  const result = await updateCurrentDiaryEntry(
    id,
    readUpdateInput(formData, values),
  );

  if (!result.ok) {
    return actionStateFromError(result, values);
  }

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
