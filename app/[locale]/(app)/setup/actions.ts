"use server";

import { redirect } from "next/navigation";
import { persistSetupForCurrentUser } from "@/lib/setup";
import {
  defaultLocale,
  locales,
  type Locale,
} from "@/lib/i18n/routing";
import type {
  SetupActionState,
  SetupFieldName,
  SetupFieldValues,
} from "./action-state";

function resolveLocale(locale: string): Locale {
  return (locales as readonly string[]).includes(locale)
    ? (locale as Locale)
    : defaultLocale;
}

function readTextField(formData: FormData, field: SetupFieldName) {
  return String(formData.get(field) ?? "").trim();
}

function readCalendarDateField(formData: FormData, field: SetupFieldName) {
  const value = formData.get(field);
  return typeof value === "string" ? value : "";
}

function readSetupValues(formData: FormData): SetupFieldValues {
  return {
    calories: readTextField(formData, "calories"),
    carbohydrates_g: readTextField(formData, "carbohydrates_g"),
    display_name: readTextField(formData, "display_name"),
    effectiveDate: readCalendarDateField(formData, "effectiveDate"),
    fat_g: readTextField(formData, "fat_g"),
    preferred_language: readTextField(formData, "preferred_language"),
    protein_g: readTextField(formData, "protein_g"),
  };
}

function parseOptionalNumber(
  values: SetupFieldValues,
  field: Extract<
    SetupFieldName,
    "calories" | "carbohydrates_g" | "fat_g" | "protein_g"
  >,
  fieldErrors: Partial<Record<SetupFieldName, string>>,
) {
  const value = values[field];

  if (value === "") {
    return null;
  }

  const parsed = Number(value);

  if (!Number.isFinite(parsed)) {
    fieldErrors[field] = "invalid_number";
    return null;
  }

  return parsed;
}

function validationFailure(
  values: SetupFieldValues,
  fieldErrors: Partial<Record<SetupFieldName, string>>,
): SetupActionState {
  return {
    fieldErrors,
    status: "validation_error",
    values,
  };
}

function mapProfileFieldErrors(
  fieldErrors: Record<string, string> | undefined,
) {
  const mapped: Partial<Record<SetupFieldName, string>> = {};

  if (fieldErrors?.display_name) {
    mapped.display_name = fieldErrors.display_name;
  }

  if (fieldErrors?.preferred_language) {
    mapped.preferred_language = fieldErrors.preferred_language;
  }

  return mapped;
}

function mapTargetFieldErrors(fieldErrors: Record<string, string> | undefined) {
  const mapped: Partial<Record<SetupFieldName, string>> = {};
  const targetFields = [
    "calories",
    "carbohydrates_g",
    "fat_g",
    "protein_g",
  ] as const;

  for (const field of targetFields) {
    if (fieldErrors?.[field]) {
      mapped[field] = fieldErrors[field];
    }
  }

  if (fieldErrors?.effective_from) {
    mapped.effectiveDate = fieldErrors.effective_from;
  }

  return mapped;
}

export async function saveSetupAction(
  localeInput: string,
  _previousState: SetupActionState,
  formData: FormData,
): Promise<SetupActionState> {
  const locale = resolveLocale(localeInput);
  const values = readSetupValues(formData);
  const fieldErrors: Partial<Record<SetupFieldName, string>> = {};

  const calories = parseOptionalNumber(values, "calories", fieldErrors);
  const carbohydrates = parseOptionalNumber(
    values,
    "carbohydrates_g",
    fieldErrors,
  );
  const fat = parseOptionalNumber(values, "fat_g", fieldErrors);
  const protein = parseOptionalNumber(values, "protein_g", fieldErrors);

  if (Object.keys(fieldErrors).length > 0) {
    return validationFailure(values, fieldErrors);
  }

  const profileInput = {
    display_name: values.display_name,
    preferred_language: values.preferred_language,
  };
  const targetInput = {
    calories,
    carbohydrates_g: carbohydrates,
    effective_from: values.effectiveDate,
    fat_g: fat,
    protein_g: protein,
  };
  const setupResult = await persistSetupForCurrentUser(
    profileInput,
    targetInput,
  );

  if (!setupResult.ok) {
    if (setupResult.code === "validation_error") {
      return validationFailure(
        values,
        {
          ...mapProfileFieldErrors(setupResult.fieldErrors),
          ...mapTargetFieldErrors(setupResult.fieldErrors),
        },
      );
    }

    return {
      status:
        setupResult.code === "unauthenticated"
          ? "unauthenticated"
          : "database_error",
      values,
    };
  }

  redirect(
    `/${setupResult.data.preferred_language || locale}/today?date=${values.effectiveDate}`,
  );
}
