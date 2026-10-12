"use client";

import Link from "next/link";
import { useActionState, useEffect, useRef } from "react";
import { useTranslations } from "next-intl";
import type { SavedMealUseActionState } from "@/app/[locale]/(app)/saved-meals/use-action-state";
import { Button, buttonStyles } from "@/components/ui/button";
import { surfaceStyles } from "@/components/ui/card";
import { feedbackStyles } from "@/components/ui/feedback";
import { FieldLabel, Input, Select } from "@/components/ui/form-controls";
import type { OwnedSavedMealEditor } from "@/lib/saved-meals";
import { formatLocalizedNumber } from "@/lib/i18n/format";
import type { Locale } from "@/lib/i18n/routing";

function value(
  value: null | number | string,
  locale: Locale,
  notSet: string,
  suffix = "",
) {
  return value === null
    ? notSet
    : `${formatLocalizedNumber(locale, value)}${suffix ? ` ${suffix}` : ""}`;
}

function servingValue(
  quantity: null | number,
  locale: Locale,
  unit: null | string,
  notSet: string,
) {
  if (quantity === null && unit === null) return notSet;
  return [
    quantity === null ? null : formatLocalizedNumber(locale, quantity),
    unit,
  ]
    .filter((part): part is string => part !== null)
    .join(" ");
}

export function SavedMealUseReview({
  action,
  date,
  locale,
  meal,
}: {
  action: (
    state: SavedMealUseActionState,
    formData: FormData,
  ) => Promise<SavedMealUseActionState>;
  date: string;
  locale: Locale;
  meal: OwnedSavedMealEditor;
}) {
  const t = useTranslations("SavedMealUse");
  const diaryT = useTranslations("Diary");
  const formRef = useRef<HTMLFormElement>(null);
  const [state, formAction, isPending] = useActionState(action, {
    status: "idle",
    values: { entry_date: date, meal_type: "breakfast" },
  } satisfies SavedMealUseActionState);
  const status = state.status === "idle" ? null : t(`status.${state.status}`);
  const dateInvalid = Boolean(state.fieldErrors?.entry_date);
  const mealTypeInvalid = Boolean(state.fieldErrors?.meal_type);

  useEffect(() => {
    if (state.status !== "validation_error") return;
    const field = state.fieldErrors?.entry_date
      ? "entry_date"
      : state.fieldErrors?.meal_type
        ? "meal_type"
        : null;
    const control = field
      ? formRef.current?.querySelector<HTMLInputElement | HTMLSelectElement>(`[name="${field}"]:not([type="hidden"])`)
      : null;
    if (control instanceof HTMLInputElement || control instanceof HTMLSelectElement) {
      control.focus({ preventScroll: true });
      control.scrollIntoView({ block: "center", inline: "nearest", behavior: "instant" });
    }
  }, [state]);

  return (
    <section className="grid min-w-0 w-full max-w-4xl gap-6 py-4 text-start sm:gap-8">
      <header className="min-w-0 max-w-3xl">
        <p className="ui-eyebrow">{t("label")}</p>
        <h1 className="ui-page-title mt-3 [overflow-wrap:anywhere] [unicode-bidi:isolate]" dir="auto">
          {t("title", { name: meal.name })}
        </h1>
        <p className="ui-body-secondary mt-4 max-w-2xl text-base">
          {t("description")}
        </p>
      </header>

      <section className={surfaceStyles({ variant: "subtle", className: "min-w-0" })}>
        <h2 className="ui-section-title">{t("explanation.title")}</h2>
        <ul className="ui-body-secondary mt-3 list-disc space-y-2 ps-5">
          <li>{t("explanation.exact")}</li>
          <li>{t("explanation.live")}</li>
          <li>{t("explanation.atomic")}</li>
          <li>{t("explanation.edit")}</li>
          <li>{t("explanation.retry")}</li>
        </ul>
      </section>

      <section className="min-w-0" aria-labelledby="saved-meal-review-items">
        <div className="flex min-w-0 flex-wrap items-end justify-between gap-3">
          <div className="min-w-0">
            <h2 className="ui-section-title" id="saved-meal-review-items">
              {t("items.title")}
            </h2>
            <p className="ui-body-secondary mt-2">
              {t("items.count", { count: meal.items.length })}
            </p>
          </div>
          <Link className={buttonStyles({ variant: "outline" })} href={`/${locale}/saved-meals/${meal.saved_meal_id}/edit?date=${date}`}>
            {t("editMeal")}
          </Link>
        </div>
        <ol className="mt-5 grid min-w-0 grid-cols-[minmax(0,1fr)] gap-4">
          {meal.items.map((item) => (
            <li className={surfaceStyles({ className: "min-w-0" })} data-saved-meal-position={item.position} key={item.item_id}>
              <p className="ui-eyebrow">
                {t("items.position", { position: item.position })}
              </p>
              <h3 className="ui-card-title mt-2 whitespace-pre-wrap [overflow-wrap:anywhere] [unicode-bidi:isolate]" dir="auto">{item.food_name}</h3>
              {item.brand_name && <p className="ui-body-secondary mt-1 whitespace-pre-wrap [overflow-wrap:anywhere] [unicode-bidi:isolate]" dir="auto">{item.brand_name}</p>}
              <dl className="mt-4 grid min-w-0 grid-cols-[minmax(0,1fr)] gap-x-5 gap-y-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
                <Detail label={t("fields.serving")} value={servingValue(item.serving_quantity, locale, item.serving_unit, t("notSet"))} />
                <Detail label={t("fields.calories")} value={value(item.calories, locale, t("notSet"))} />
                <Detail label={t("fields.protein")} value={value(item.protein_g, locale, t("notSet"), t("unitGrams"))} />
                <Detail label={t("fields.carbohydrates")} value={value(item.carbohydrates_g, locale, t("notSet"), t("unitGrams"))} />
                <Detail label={t("fields.fat")} value={value(item.fat_g, locale, t("notSet"), t("unitGrams"))} />
              </dl>
              {item.notes && <p className="ui-body-secondary mt-4 whitespace-pre-wrap [overflow-wrap:anywhere] [unicode-bidi:isolate]" dir="auto">{item.notes}</p>}
            </li>
          ))}
        </ol>
      </section>

      <form action={formAction} className={surfaceStyles({ className: "grid min-w-0 grid-cols-[minmax(0,1fr)] gap-5" })} noValidate ref={formRef}>
        <h2 className="ui-section-title">{t("destination.title")}</h2>
        <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-4 sm:grid-cols-2">
          <FieldLabel className="grid min-w-0 gap-2">
            <span>{t("destination.date")}</span>
            <Input aria-describedby={dateInvalid ? "saved-meal-use-status" : undefined} aria-invalid={dateInvalid} defaultValue={state.values.entry_date} name="entry_date" required type="date" />
          </FieldLabel>
          <FieldLabel className="grid min-w-0 gap-2">
            <span>{t("destination.mealType")}</span>
            <Select aria-describedby={mealTypeInvalid ? "saved-meal-use-status" : undefined} aria-invalid={mealTypeInvalid} defaultValue={state.values.meal_type} name="meal_type" required>
              {(["breakfast", "lunch", "dinner", "snack", "other"] as const).map((mealType) => (
                <option key={mealType} value={mealType}>{diaryT(`mealTypes.${mealType}`)}</option>
              ))}
            </Select>
          </FieldLabel>
        </div>
        {status && (
          <div className={feedbackStyles("danger", "min-w-0 [overflow-wrap:anywhere]")} data-testid={`saved-meal-use-${state.status}`} id="saved-meal-use-status" role="alert">
            <p>{status}</p>
            {state.status === "stale_review" && (
              <Link className={buttonStyles({ variant: "outline", className: "mt-3" })} href={`/${locale}/saved-meals/${meal.saved_meal_id}/use?date=${state.values.entry_date}`}>
                {t("reload")}
              </Link>
            )}
          </div>
        )}
        <Button pending={isPending} size="lg" type="submit">
          {isPending ? t("submitPending") : t("submit")}
        </Button>
      </form>
    </section>
  );
}

function Detail({ label, value: detailValue }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="font-medium text-muted-foreground">{label}</dt>
      <dd className="mt-1 whitespace-pre-wrap text-foreground [overflow-wrap:anywhere] [unicode-bidi:isolate]" dir="auto">{detailValue}</dd>
    </div>
  );
}
