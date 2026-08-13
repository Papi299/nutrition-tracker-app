"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  deleteCurrentDiaryEntry,
  updateCurrentDiaryEntry,
  type DiaryEntryMutationError,
  type DiaryEntryUpdateInput,
} from "@/lib/diary-entries";
import {
  defaultLocale,
  locales,
  type Locale,
} from "@/lib/i18n/routing";
import type { DataError } from "@/lib/data/result";
import { hasAuthenticatedUser, signInPath } from "@/lib/auth/require-user";
import type {
  DiaryEntryActionState,
  DiaryEntryFieldErrors,
  DiaryEntryFieldName,
  DiaryEntryFieldValues,
} from "./action-state";
import {
  diaryEntryCreateInputFields,
  readCreateValues,
  readInputField,
  readTextField,
  submitDiaryEntryCreate,
} from "./create-submission";

const diaryEntryUpdateInputFields = diaryEntryCreateInputFields.filter(
  (field) => field !== "food_id",
);

function resolveLocale(locale: string): Locale {
  return (locales as readonly string[]).includes(locale)
    ? (locale as Locale)
    : defaultLocale;
}

function readUpdateInput(
  formData: FormData,
  values: DiaryEntryFieldValues,
): DiaryEntryUpdateInput {
  return diaryEntryUpdateInputFields.reduce<DiaryEntryUpdateInput>(
    (input, field) => {
      if (formData.has(field)) {
        values[field] = readInputField(formData, field);
        input[field] = values[field];
      }

      return input;
    },
    {},
  );
}

function mapFieldErrors(
  fieldErrors: Record<string, string> | undefined,
): DiaryEntryFieldErrors {
  const mapped: DiaryEntryFieldErrors = {};
  const allowedFields = new Set<string>([
    "form",
    "id",
    "idempotency_key",
    "expected_version",
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
  localeInput: string,
  _previousState: DiaryEntryActionState,
  formData: FormData,
): Promise<DiaryEntryActionState> {
  const locale = resolveLocale(localeInput);
  const nativeSubmission = formData.get("native_submission") === "1";
  const submissionIntent = formData.get("submission_intent");

  if (submissionIntent === "start_new") {
    if (nativeSubmission && !(await hasAuthenticatedUser())) {
      redirect(signInPath(locale));
    }

    return {
      status: "idle",
      values: {
        ...readCreateValues(formData),
        idempotency_key: randomUUID(),
      },
    };
  }

  const { result, values } = await submitDiaryEntryCreate(formData);

  if (!result.ok) {
    if (nativeSubmission && result.code === "unauthenticated") {
      redirect(signInPath(locale));
    }

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
  const expectedVersion = readTextField(formData, "expected_version");
  const values: DiaryEntryFieldValues = {
    expected_version: expectedVersion,
    id,
  };

  if (id === "") {
    return validationFailure(values, { id: "required" });
  }

  const result = await updateCurrentDiaryEntry(
    id,
    expectedVersion,
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
