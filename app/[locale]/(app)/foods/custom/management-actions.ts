"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { resolveAuthLocale } from "@/lib/auth/require-user";
import { setCustomFoodArchivedForCurrentUser } from "@/lib/custom-foods";

export type CustomFoodArchiveActionState = {
  status:
    | "database_error"
    | "idle"
    | "not_found"
    | "unauthenticated"
    | "validation_error";
};

export async function setCustomFoodArchiveAction(
  localeInput: string,
  foodId: string,
  isArchived: boolean,
  previousState: CustomFoodArchiveActionState,
  formData: FormData,
): Promise<CustomFoodArchiveActionState> {
  void previousState;
  void formData;

  const locale = resolveAuthLocale(localeInput);
  const result = await setCustomFoodArchivedForCurrentUser({
    food_id: foodId,
    is_archived: isArchived,
  });

  if (!result.ok) {
    return {
      status: result.code === "already_exists" ? "database_error" : result.code,
    };
  }

  revalidatePath(`/${locale}/foods/custom`);
  revalidatePath(`/${locale}/foods`);
  revalidatePath(`/${locale}/foods/custom/${foodId}/edit`);
  revalidatePath(`/${locale}/today`);

  const status = isArchived ? "archived" : "active";
  const saved = isArchived ? "archived" : "restored";
  redirect(`/${locale}/foods/custom?status=${status}&saved=${saved}`);
}
