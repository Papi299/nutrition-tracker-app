"use client";

import Link from "next/link";
import { useActionState } from "react";
import { useTranslations } from "next-intl";
import type { RecipeUseActionState } from "@/app/[locale]/(app)/recipes/use-action-state";
import { Button, buttonStyles } from "@/components/ui/button";
import { feedbackStyles } from "@/components/ui/feedback";
import type { Locale } from "@/lib/i18n/routing";

export type RecipeUseConfirmationAction = (
  state: RecipeUseActionState,
  formData: FormData,
) => Promise<RecipeUseActionState>;

const retryableStatuses = new Set([
  "database_error",
  "idle",
  "unauthenticated",
  "validation_error",
]);

export function RecipeUseConfirmation({
  action,
  locale,
  recipeId,
  reloadHref,
}: {
  action: RecipeUseConfirmationAction;
  locale: Locale;
  recipeId: string;
  reloadHref: string;
}) {
  const t = useTranslations("RecipeUse.confirmation");
  const [state, formAction, isPending] = useActionState(action, {
    status: "idle",
  } satisfies RecipeUseActionState);
  const showSubmit = retryableStatuses.has(state.status);

  return (
    <section
      aria-labelledby="recipe-use-confirmation-title"
      className="mt-6 min-w-0 border-t border-border-strong pt-5"
      data-testid="recipe-use-confirmation"
    >
      <h3
        className="ui-card-title"
        id="recipe-use-confirmation-title"
      >
        {t("title")}
      </h3>
      <p className="ui-body-secondary mt-2" id="recipe-use-confirmation-help">{t("body")}</p>

      {state.status !== "idle" && (
        <div
          className={feedbackStyles("danger", "mt-4 min-w-0 [overflow-wrap:anywhere]")}
          data-testid={`recipe-use-action-${state.status}`}
          id="recipe-use-confirmation-status"
          role="alert"
        >
          <p>{t(`status.${state.status}`)}</p>
          {!showSubmit && (
            <div className="mt-3 flex flex-wrap gap-4">
              <Link className={buttonStyles({ variant: "outline" })} href={reloadHref}>
                {t("reload")}
              </Link>
              {(state.status === "archived" || state.status === "invalid_recipe") && (
                <Link
                  className={buttonStyles({ variant: "outline" })}
                  href={`/${locale}/recipes/${recipeId}/edit`}
                >
                  {t("edit")}
                </Link>
              )}
            </div>
          )}
        </div>
      )}

      {showSubmit && (
        <form action={formAction} aria-labelledby="recipe-use-confirmation-title" className="mt-5 min-w-0">
          <Button
            aria-describedby={state.status === "idle" ? "recipe-use-confirmation-help" : "recipe-use-confirmation-help recipe-use-confirmation-status"}
            className="w-full sm:w-auto"
            pending={isPending}
            size="lg"
            type="submit"
          >
            {isPending ? t("submitPending") : t("submit")}
          </Button>
        </form>
      )}
    </section>
  );
}
