import "server-only";

import {
  createDiaryEntryForCurrentUser,
  type DiaryEntryCreateInput,
} from "@/lib/diary-entries";
import type {
  DiaryEntryFieldName,
  DiaryEntryFieldValues,
} from "./action-state";

export const diaryEntryCreateInputFields = [
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
] as const satisfies readonly Exclude<
  DiaryEntryFieldName,
  "expected_version" | "id" | "idempotency_key"
>[];

export function readTextField(formData: FormData, field: DiaryEntryFieldName) {
  const value = formData.get(field);

  return typeof value === "string" ? value.trim() : "";
}

export function readInputField(
  formData: FormData,
  field: DiaryEntryFieldName,
) {
  if (field === "entry_date") {
    const value = formData.get(field);
    return typeof value === "string" ? value : "";
  }

  return readTextField(formData, field);
}

function readCreateValues(formData: FormData): DiaryEntryFieldValues {
  return diaryEntryCreateInputFields.reduce<DiaryEntryFieldValues>(
    (values, field) => {
      values[field] = readInputField(formData, field);
      return values;
    },
    {},
  );
}

function readCreateInput(values: DiaryEntryFieldValues): DiaryEntryCreateInput {
  return {
    brand_name: values.brand_name,
    calories: values.calories,
    carbohydrates_g: values.carbohydrates_g,
    entry_date: values.entry_date,
    fat_g: values.fat_g,
    food_id: values.food_id,
    food_name: values.food_name,
    meal_type: values.meal_type,
    notes: values.notes,
    protein_g: values.protein_g,
    serving_quantity: values.serving_quantity,
    serving_unit: values.serving_unit,
  };
}

export async function submitDiaryEntryCreate(formData: FormData) {
  const idempotencyKey = readTextField(formData, "idempotency_key");
  const values: DiaryEntryFieldValues = {
    ...readCreateValues(formData),
    idempotency_key: idempotencyKey,
  };
  const result = await createDiaryEntryForCurrentUser(
    readCreateInput(values),
    idempotencyKey,
  );

  return { result, values };
}
