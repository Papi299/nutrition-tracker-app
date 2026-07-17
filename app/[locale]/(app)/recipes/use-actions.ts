"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { resolveAuthLocale } from "@/lib/auth/require-user";
import {
  logRecipeToDiaryForCurrentUser,
  type ValidatedRecipeDiaryLogInput,
} from "@/lib/recipes";
import type { RecipeUseActionState } from "./use-action-state";

export async function logRecipeAction(
  localeInput: string,
  reviewedContext: ValidatedRecipeDiaryLogInput,
  _previousState: RecipeUseActionState,
  _formData: FormData,
): Promise<RecipeUseActionState> {
  void _previousState;
  void _formData;
  const locale = resolveAuthLocale(localeInput);
  const result = await logRecipeToDiaryForCurrentUser(reviewedContext);

  if (!result.ok) return { status: result.code };

  revalidatePath(`/${locale}/today`);
  revalidatePath(`/${locale}/foods/reuse`);
  revalidatePath(`/${locale}/recipes`);
  revalidatePath(`/${locale}/recipes/${reviewedContext.recipe_id}/edit`);
  revalidatePath(`/${locale}/recipes/${reviewedContext.recipe_id}/use`);

  redirect(
    `/${locale}/today?date=${reviewedContext.entry_date}&recipe=logged`,
  );
}
