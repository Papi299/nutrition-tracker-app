"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { resolveAuthLocale } from "@/lib/auth/require-user";
import {
  parseSavedMealRowKey,
  persistSavedMealForCurrentUser,
  validateSavedMealInput,
} from "@/lib/saved-meals";
import type {
  SavedMealActionState,
  SavedMealFoodLinkBinding,
  SavedMealFormItemValues,
  SavedMealFormValues,
} from "./action-state";

const maximumReadItemCount = 51;

function readText(formData: FormData, name: string) {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

function readItems(formData: FormData) {
  const rawCount = readText(formData, "item_count");
  const parsedCount = Number(rawCount);
  const count = Number.isInteger(parsedCount)
    ? Math.max(0, Math.min(parsedCount, maximumReadItemCount))
    : 0;
  const items: SavedMealFormItemValues[] = [];

  for (let index = 0; index < count; index += 1) {
    items.push({
      brand_name: readText(formData, `item_brand_name_${index}`),
      calories: readText(formData, `item_calories_${index}`),
      carbohydrates_g: readText(formData, `item_carbohydrates_g_${index}`),
      fat_g: readText(formData, `item_fat_g_${index}`),
      food_name: readText(formData, `item_food_name_${index}`),
      notes: readText(formData, `item_notes_${index}`),
      protein_g: readText(formData, `item_protein_g_${index}`),
      remove_food_link:
        readText(formData, `item_remove_food_link_${index}`) === "1",
      row_key: readText(formData, `item_row_key_${index}`),
      serving_quantity: readText(formData, `item_serving_quantity_${index}`),
      serving_unit: readText(formData, `item_serving_unit_${index}`),
    });
  }

  return {
    countIsValid: parsedCount === count && count >= 1 && count <= 50,
    items,
  };
}

function readValues(formData: FormData): {
  countIsValid: boolean;
  values: SavedMealFormValues;
} {
  const itemRead = readItems(formData);

  return {
    countIsValid: itemRead.countIsValid,
    values: {
      items: itemRead.items,
      meal_locale: readText(formData, "meal_locale"),
      name: readText(formData, "name"),
      saved_meal_id: readText(formData, "saved_meal_id"),
    },
  };
}

function formField(field: string) {
  const match = /^items\.(\d+)\.(.+)$/.exec(field);
  return match ? `item_${match[2]}_${match[1]}` : field === "locale" ? "meal_locale" : field;
}

function mapValidationErrors(fieldErrors?: Record<string, string>) {
  return Object.fromEntries(
    Object.entries(fieldErrors ?? {}).map(([field, code]) => [formField(field), code]),
  );
}

export async function saveSavedMealAction(
  localeInput: string,
  expectedSavedMealId: string | null,
  bindings: SavedMealFoodLinkBinding[],
  _previousState: SavedMealActionState,
  formData: FormData,
): Promise<SavedMealActionState> {
  const locale = resolveAuthLocale(localeInput);
  const read = readValues(formData);
  const values = read.values;
  const fieldErrors: Record<string, string> = {};
  const bindingMap = new Map(bindings.map((binding) => [binding.row_key, binding.food_id]));
  const seenRowKeys = new Set<string>();

  if (values.saved_meal_id !== (expectedSavedMealId ?? "")) {
    fieldErrors.saved_meal_id = "invalid_link";
  }

  if (!read.countIsValid) {
    fieldErrors.items = "item_count_out_of_range";
  }

  const items = values.items.map((item, index) => {
    const rowKey = parseSavedMealRowKey(item.row_key);

    if (!rowKey) {
      fieldErrors[`item_row_key_${index}`] = "invalid_row_key";
    } else if (seenRowKeys.has(item.row_key)) {
      fieldErrors[`item_row_key_${index}`] = "duplicate_row_key";
    }

    seenRowKeys.add(item.row_key);

    return {
      position: index + 1,
      food_id: item.remove_food_link ? null : (bindingMap.get(item.row_key) ?? null),
      food_name: item.food_name,
      brand_name: item.brand_name,
      serving_quantity: item.serving_quantity,
      serving_unit: item.serving_unit,
      calories: item.calories,
      protein_g: item.protein_g,
      carbohydrates_g: item.carbohydrates_g,
      fat_g: item.fat_g,
      notes: item.notes,
    };
  });
  const input = {
    items,
    locale: values.meal_locale,
    name: values.name,
    saved_meal_id: expectedSavedMealId,
  };
  const validation = validateSavedMealInput(input);

  if (!validation.ok) {
    Object.assign(fieldErrors, mapValidationErrors(validation.fieldErrors));
  }

  if (Object.keys(fieldErrors).length > 0) {
    return { fieldErrors, status: "validation_error", values };
  }

  const result = await persistSavedMealForCurrentUser(input);

  if (!result.ok) {
    if (result.code === "validation_error") {
      return {
        fieldErrors: mapValidationErrors(result.fieldErrors),
        status: "validation_error",
        values,
      };
    }

    return {
      status: result.code === "already_exists" ? "database_error" : result.code,
      values,
    };
  }

  revalidatePath(`/${locale}/saved-meals`);
  revalidatePath(`/${locale}/saved-meals/${result.data.saved_meal_id}/edit`);

  redirect(
    `/${locale}/saved-meals/${result.data.saved_meal_id}/edit?saved=${expectedSavedMealId ? "updated" : "created"}`,
  );
}
