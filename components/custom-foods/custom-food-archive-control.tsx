"use client";

import { useActionState, useState } from "react";
import { useTranslations } from "next-intl";
import type { CustomFoodArchiveActionState } from "@/app/[locale]/(app)/foods/custom/management-actions";

const initialState: CustomFoodArchiveActionState = { status: "idle" };

export function CustomFoodArchiveControl({
  action,
  archived,
  foodName,
}: {
  action: (
    state: CustomFoodArchiveActionState,
    formData: FormData,
  ) => Promise<CustomFoodArchiveActionState>;
  archived: boolean;
  foodName: string;
}) {
  const t = useTranslations("CustomFoodManagement.actions");
  const [confirmingArchive, setConfirmingArchive] = useState(false);
  const [state, formAction, isPending] = useActionState(action, initialState);
  const errorMessage =
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
            className="min-h-11 border border-teal-700 bg-white px-4 text-sm font-semibold text-teal-800 transition-colors hover:bg-teal-50 disabled:cursor-wait disabled:border-slate-300 disabled:text-slate-500"
            disabled={isPending}
            type="submit"
          >
            {isPending ? t("restorePending") : t("restore")}
          </button>
        </form>
        {errorMessage && (
          <p className="text-sm leading-6 text-red-800" role="alert">
            {errorMessage}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="grid gap-3">
      {!confirmingArchive ? (
        <button
          className="min-h-11 border border-red-300 bg-white px-4 text-sm font-semibold text-red-800 transition-colors hover:border-red-600"
          onClick={() => setConfirmingArchive(true)}
          type="button"
        >
          {t("archive")}
        </button>
      ) : (
        <div
          aria-label={t("confirmationLabel", { name: foodName })}
          className="grid gap-3 border border-amber-300 bg-amber-50 p-4"
          data-testid="custom-food-archive-confirmation"
          role="group"
        >
          <p className="text-sm font-semibold text-amber-950">
            {t("confirmationTitle")}
          </p>
          <p className="text-sm leading-6 text-amber-950">
            {t("confirmationBody")}
          </p>
          <div className="flex flex-wrap gap-3">
            <form action={formAction}>
              <button
                className="min-h-11 bg-red-700 px-4 text-sm font-semibold text-white transition-colors hover:bg-red-800 disabled:cursor-wait disabled:bg-slate-300"
                disabled={isPending}
                type="submit"
              >
                {isPending ? t("archivePending") : t("confirmArchive")}
              </button>
            </form>
            <button
              className="min-h-11 border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-800"
              disabled={isPending}
              onClick={() => setConfirmingArchive(false)}
              type="button"
            >
              {t("cancel")}
            </button>
          </div>
        </div>
      )}
      {errorMessage && (
        <p className="text-sm leading-6 text-red-800" role="alert">
          {errorMessage}
        </p>
      )}
    </div>
  );
}
