"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { resolveAuthLocale } from "@/lib/auth/require-user";
import { logSavedMealToDiaryForCurrentUser } from "@/lib/saved-meals";
import type { SavedMealUseActionState } from "./use-action-state";

function readText(formData: FormData, field: string) {
  const values = formData.getAll(field);
  const value = values[0];
  return {
    repeated: values.length !== 1,
    value: typeof value === "string" ? value : "",
  };
}

export async function logSavedMealAction(
  localeInput: string,
  savedMealId: string,
  expectedSourceUpdatedAt: string,
  idempotencyKey: string,
  _previousState: SavedMealUseActionState,
  formData: FormData,
): Promise<SavedMealUseActionState> {
  void _previousState;
  const locale = resolveAuthLocale(localeInput);
  const entryDate = readText(formData, "entry_date");
  const mealType = readText(formData, "meal_type");
  const values = {
    entry_date: entryDate.value,
    meal_type: mealType.value,
  };

  if (entryDate.repeated || mealType.repeated) {
    return {
      fieldErrors: {
        ...(entryDate.repeated ? { entry_date: "repeated_field" } : {}),
        ...(mealType.repeated ? { meal_type: "repeated_field" } : {}),
      },
      status: "validation_error",
      values,
    };
  }
  const result = await logSavedMealToDiaryForCurrentUser({
    entry_date: values.entry_date,
    expected_source_updated_at: expectedSourceUpdatedAt,
    idempotency_key: idempotencyKey,
    meal_type: values.meal_type,
    saved_meal_id: savedMealId,
  });

  if (!result.ok) {
    return {
      fieldErrors: result.fieldErrors,
      status: result.code,
      values,
    };
  }

  revalidatePath(`/${locale}/today`);
  revalidatePath(`/${locale}/foods/reuse`);
  revalidatePath(`/${locale}/saved-meals`);
  revalidatePath(`/${locale}/saved-meals/${savedMealId}/edit`);
  revalidatePath(`/${locale}/saved-meals/${savedMealId}/use`);

  redirect(`/${locale}/today?date=${values.entry_date}&savedMeal=logged`);
}
