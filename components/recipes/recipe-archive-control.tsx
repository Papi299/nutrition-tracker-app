"use client";

import { useActionState, useState } from "react";
import { useTranslations } from "next-intl";
import type { RecipeArchiveActionState } from "@/app/[locale]/(app)/recipes/management-actions";

const initialState: RecipeArchiveActionState = { status: "idle" };

export function RecipeArchiveControl({
  action,
  archived,
  recipeName,
}: {
  action: (
    state: RecipeArchiveActionState,
    formData: FormData,
  ) => Promise<RecipeArchiveActionState>;
  archived: boolean;
  recipeName: string;
}) {
  const t = useTranslations("RecipeManagement.actions");
  const [confirming, setConfirming] = useState(false);
  const [state, formAction, isPending] = useActionState(action, initialState);
  const error =
    state.status === "unauthenticated"
      ? t("errors.unauthenticated")
      : state.status === "not_found" || state.status === "validation_error"
        ? t("errors.unavailable")
        : state.status === "database_error"
          ? t("errors.database")
          : null;

  if (archived) {
    return (
      <div className="grid gap-3">
        <form action={formAction}>
          <button
            className="min-h-11 border border-teal-700 bg-white px-4 text-sm font-semibold text-teal-800 disabled:text-slate-400"
            disabled={isPending}
            type="submit"
          >
            {isPending ? t("restorePending") : t("restore")}
          </button>
        </form>
        {error && <p className="text-sm text-red-800" role="alert">{error}</p>}
      </div>
    );
  }

  return (
    <div className="grid gap-3">
      {!confirming ? (
        <button
          className="min-h-11 border border-red-300 bg-white px-4 text-sm font-semibold text-red-800"
          onClick={() => setConfirming(true)}
          type="button"
        >
          {t("archive")}
        </button>
      ) : (
        <div
          aria-label={t("confirmationLabel", { name: recipeName })}
          className="grid gap-3 border border-amber-300 bg-amber-50 p-4"
          data-testid="recipe-archive-confirmation"
          role="group"
        >
          <p className="text-sm font-semibold text-amber-950">{t("confirmationTitle")}</p>
          <p className="text-sm leading-6 text-amber-950">{t("confirmationBody")}</p>
          <div className="flex flex-wrap gap-3">
            <form action={formAction}>
              <button
                className="min-h-11 bg-red-700 px-4 text-sm font-semibold text-white disabled:bg-slate-300"
                disabled={isPending}
                type="submit"
              >
                {isPending ? t("archivePending") : t("confirmArchive")}
              </button>
            </form>
            <button
              className="min-h-11 border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-800"
              disabled={isPending}
              onClick={() => setConfirming(false)}
              type="button"
            >
              {t("cancel")}
            </button>
          </div>
        </div>
      )}
      {error && <p className="text-sm text-red-800" role="alert">{error}</p>}
    </div>
  );
}
