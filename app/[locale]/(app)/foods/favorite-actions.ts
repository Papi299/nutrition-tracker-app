"use server";

import { revalidatePath } from "next/cache";
import { resolveAuthLocale } from "@/lib/auth/require-user";
import { setFoodFavoriteForCurrentUser } from "@/lib/reusable-foods";

export type FoodFavoriteActionState = {
  isFavorite?: boolean;
  status:
    | "database_error"
    | "idle"
    | "not_found"
    | "success"
    | "unauthenticated"
    | "validation_error";
};

export async function setFoodFavoriteAction(
  localeInput: string,
  foodId: string,
  isFavorite: boolean,
  previousState: FoodFavoriteActionState,
  formData: FormData,
): Promise<FoodFavoriteActionState> {
  void previousState;
  void formData;

  const locale = resolveAuthLocale(localeInput);
  const result = await setFoodFavoriteForCurrentUser(foodId, isFavorite);

  if (!result.ok) {
    return {
      status: result.code === "already_exists" ? "database_error" : result.code,
    };
  }

  revalidatePath(`/${locale}/foods`);
  revalidatePath(`/${locale}/foods/reuse`);
  revalidatePath(`/${locale}/today`);

  return { isFavorite: result.data.is_favorite, status: "success" };
}
