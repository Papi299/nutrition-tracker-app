"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { Star } from "lucide-react";
import { Button } from "@/components/ui/button";
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
    <div className="grid min-w-0 gap-2">
      <form action={formAction}>
        <Button
          aria-label={
            currentFavorite
              ? t("removeLabel", { name: foodName })
              : t("addLabel", { name: foodName })
          }
          aria-pressed={currentFavorite}
          pending={isPending}
          size="sm"
          type="submit"
          variant={currentFavorite ? "secondary" : "outline"}
        >
          <Star aria-hidden="true" className={currentFavorite ? "shrink-0 fill-current" : "shrink-0"} size={16} />
          {isPending
            ? t("pending")
            : currentFavorite
              ? t("remove")
              : t("add")}
        </Button>
      </form>
      {state.status === "success" && (
        <p className="text-xs leading-5 text-success-foreground [overflow-wrap:anywhere]" role="status">
          {currentFavorite ? t("added") : t("removed")}
        </p>
      )}
      {errorMessage && (
        <p className="text-xs leading-5 text-danger-foreground [overflow-wrap:anywhere]" role="alert">
          {errorMessage}
        </p>
      )}
    </div>
  );
}
