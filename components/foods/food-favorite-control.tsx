"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import type { FoodFavoriteActionState } from "@/app/[locale]/(app)/foods/favorite-actions";

const initialState: FoodFavoriteActionState = { status: "idle" };

export function FoodFavoriteControl({
  action,
  foodName,
  isFavorite,
}: {
  action: (
    state: FoodFavoriteActionState,
    formData: FormData,
  ) => Promise<FoodFavoriteActionState>;
  foodName: string;
  isFavorite: boolean;
}) {
  const t = useTranslations("ReusableFoods.favorite");
  const [state, formAction, isPending] = useActionState(action, initialState);
  const currentFavorite =
    state.status === "success" && state.isFavorite !== undefined
      ? state.isFavorite
      : isFavorite;
  const errorMessage =
    state.status === "unauthenticated"
      ? t("errors.unauthenticated")
      : state.status === "database_error"
        ? t("errors.database")
        : state.status === "not_found" || state.status === "validation_error"
          ? t("errors.unavailable")
          : null;

  return (
    <div className="grid gap-2">
      <form action={formAction}>
        <button
          aria-label={
            currentFavorite
              ? t("removeLabel", { name: foodName })
              : t("addLabel", { name: foodName })
          }
          aria-pressed={currentFavorite}
          className="min-h-10 border border-amber-500 bg-white px-4 text-sm font-semibold text-amber-900 transition-colors hover:bg-amber-50 disabled:cursor-wait disabled:border-slate-300 disabled:text-slate-500"
          disabled={isPending}
          type="submit"
        >
          {isPending
            ? t("pending")
            : currentFavorite
              ? t("remove")
              : t("add")}
        </button>
      </form>
      {state.status === "success" && (
        <p className="text-xs leading-5 text-teal-800" role="status">
          {currentFavorite ? t("added") : t("removed")}
        </p>
      )}
      {errorMessage && (
        <p className="text-xs leading-5 text-red-800" role="alert">
          {errorMessage}
        </p>
      )}
    </div>
  );
}
