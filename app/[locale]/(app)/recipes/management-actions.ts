"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { resolveAuthLocale } from "@/lib/auth/require-user";
import { setRecipeArchivedForCurrentUser } from "@/lib/recipes";

export type RecipeArchiveActionState = {
  status:
    | "database_error"
    | "idle"
    | "not_found"
    | "unauthenticated"
    | "validation_error";
};

export async function setRecipeArchiveAction(
  localeInput: string,
  recipeId: string,
  isArchived: boolean,
  _previousState: RecipeArchiveActionState,
  _formData: FormData,
): Promise<RecipeArchiveActionState> {
  void _previousState;
  void _formData;
  const locale = resolveAuthLocale(localeInput);
  const result = await setRecipeArchivedForCurrentUser({
    is_archived: isArchived,
    recipe_id: recipeId,
  });

  if (!result.ok) {
    return {
      status: result.code === "already_exists" ? "database_error" : result.code,
    };
  }

  revalidatePath(`/${locale}/recipes`);
  revalidatePath(`/${locale}/recipes/${recipeId}/edit`);
  redirect(
    `/${locale}/recipes?status=${isArchived ? "archived" : "active"}&saved=${isArchived ? "archived" : "restored"}`,
  );
}
