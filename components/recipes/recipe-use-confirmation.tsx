"use client";

import Link from "next/link";
import { useActionState } from "react";
import { useTranslations } from "next-intl";
import type { RecipeUseActionState } from "@/app/[locale]/(app)/recipes/use-action-state";
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
      className="mt-6 border-t border-teal-300 pt-5"
      data-testid="recipe-use-confirmation"
    >
      <h3
        className="text-lg font-semibold text-slate-950"
        id="recipe-use-confirmation-title"
      >
        {t("title")}
      </h3>
      <p className="mt-2 text-sm leading-6 text-teal-950">{t("body")}</p>

      {state.status !== "idle" && (
        <div
          className="mt-4 border-s-4 border-red-500 bg-red-50 px-4 py-3 text-sm text-red-900"
          data-testid={`recipe-use-action-${state.status}`}
          role="alert"
        >
          <p>{t(`status.${state.status}`)}</p>
          {!showSubmit && (
            <div className="mt-3 flex flex-wrap gap-4">
              <Link className="font-semibold text-teal-800 underline" href={reloadHref}>
                {t("reload")}
              </Link>
              {(state.status === "archived" || state.status === "invalid_recipe") && (
                <Link
                  className="font-semibold text-teal-800 underline"
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
        <form action={formAction} className="mt-5">
          <button
            className="min-h-12 bg-teal-700 px-5 text-base font-semibold text-white disabled:cursor-wait disabled:bg-slate-300 disabled:text-slate-600"
            disabled={isPending}
            type="submit"
          >
            {isPending ? t("submitPending") : t("submit")}
          </button>
        </form>
      )}
    </section>
  );
}
