"use client";

import { useActionState, useState } from "react";
import { useTranslations } from "next-intl";
import { buttonStyles } from "@/components/ui/button";
import { surfaceStyles } from "@/components/ui/card";
import { feedbackStyles } from "@/components/ui/feedback";
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
      <div className="grid min-w-0 gap-3">
        <form action={formAction} className="min-w-0">
          <button
            aria-busy={isPending}
            className={buttonStyles({ variant: "outline", className: "w-full border-primary text-primary" })}
            disabled={isPending}
            type="submit"
          >
            {isPending ? t("restorePending") : t("restore")}
          </button>
        </form>
        {error && <p className={feedbackStyles("danger", "[overflow-wrap:anywhere]")} role="alert">{error}</p>}
      </div>
    );
  }

  return (
    <div className="grid min-w-0 gap-3">
      {!confirming ? (
        <button
          className={buttonStyles({ variant: "outline", className: "w-full border-danger/30 text-danger-foreground hover:border-danger" })}
          onClick={() => setConfirming(true)}
          type="button"
        >
          {t("archive")}
        </button>
      ) : (
        <div
          aria-label={t("confirmationLabel", { name: recipeName })}
          className={surfaceStyles({ className: "grid min-w-0 gap-3 border-warning/40 bg-warning-surface p-3 text-warning-foreground [overflow-wrap:anywhere]" })}
          data-testid="recipe-archive-confirmation"
          role="group"
        >
          <p className="text-sm font-semibold">{t("confirmationTitle")}</p>
          <p className="text-sm leading-6">{t("confirmationBody")}</p>
          <div className="grid min-w-0 gap-2">
            <form action={formAction} className="min-w-0">
              <button
                aria-busy={isPending}
                className={buttonStyles({ variant: "destructive", className: "w-full" })}
                disabled={isPending}
                type="submit"
              >
                {isPending ? t("archivePending") : t("confirmArchive")}
              </button>
            </form>
            <button
              className={buttonStyles({ variant: "outline", className: "w-full" })}
              disabled={isPending}
              onClick={() => setConfirming(false)}
              type="button"
            >
              {t("cancel")}
            </button>
          </div>
        </div>
      )}
      {error && <p className={feedbackStyles("danger", "[overflow-wrap:anywhere]")} role="alert">{error}</p>}
    </div>
  );
}
