"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { resolveAuthLocale } from "@/lib/auth/require-user";
import { setSavedMealArchivedForCurrentUser } from "@/lib/saved-meals";

export type SavedMealArchiveActionState = {
  status:
    | "database_error"
    | "idle"
    | "not_found"
    | "unauthenticated"
    | "validation_error";
};

export async function setSavedMealArchiveAction(
  localeInput: string,
  savedMealId: string,
  isArchived: boolean,
  _previousState: SavedMealArchiveActionState,
  _formData: FormData,
): Promise<SavedMealArchiveActionState> {
  void _previousState;
  void _formData;
  const locale = resolveAuthLocale(localeInput);
  const result = await setSavedMealArchivedForCurrentUser({
    is_archived: isArchived,
    saved_meal_id: savedMealId,
  });

  if (!result.ok) {
    return {
      status: result.code === "already_exists" ? "database_error" : result.code,
    };
  }

  revalidatePath(`/${locale}/saved-meals`);
  revalidatePath(`/${locale}/saved-meals/${savedMealId}/edit`);

  redirect(
    `/${locale}/saved-meals?status=${isArchived ? "archived" : "active"}&saved=${isArchived ? "archived" : "restored"}`,
  );
}
