"use client";

import Link from "next/link";
import { useActionState } from "react";
import { useTranslations } from "next-intl";
import type { SavedMealUseActionState } from "@/app/[locale]/(app)/saved-meals/use-action-state";
import type { OwnedSavedMealEditor } from "@/lib/saved-meals";
import type { Locale } from "@/lib/i18n/routing";

function value(value: null | number | string, notSet: string, suffix = "") {
  return value === null ? notSet : `${String(value)}${suffix}`;
}

function servingValue(
  quantity: null | number,
  unit: null | string,
  notSet: string,
) {
  if (quantity === null && unit === null) return notSet;
  return [quantity === null ? null : String(quantity), unit]
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
  const [state, formAction, isPending] = useActionState(action, {
    status: "idle",
    values: { entry_date: date, meal_type: "breakfast" },
  } satisfies SavedMealUseActionState);
  const status = state.status === "idle" ? null : t(`status.${state.status}`);
  const dateInvalid = Boolean(state.fieldErrors?.entry_date);
  const mealTypeInvalid = Boolean(state.fieldErrors?.meal_type);

  return (
    <section className="flex flex-1 flex-col gap-8 py-8 text-start">
      <header className="max-w-3xl">
        <p className="text-sm font-semibold uppercase tracking-[0.16em] text-teal-700">
          {t("label")}
        </p>
        <h1 className="mt-4 break-words text-3xl font-semibold leading-tight text-slate-950 sm:text-5xl" dir="auto">
          {t("title", { name: meal.name })}
        </h1>
        <p className="mt-5 max-w-2xl text-base leading-7 text-slate-700 sm:text-lg">
          {t("description")}
        </p>
      </header>

      <section className="max-w-4xl border border-teal-200 bg-teal-50 p-5 sm:p-6">
        <h2 className="text-xl font-semibold text-slate-950">{t("explanation.title")}</h2>
        <ul className="mt-3 list-disc space-y-2 ps-5 text-sm leading-6 text-slate-700">
          <li>{t("explanation.exact")}</li>
          <li>{t("explanation.live")}</li>
          <li>{t("explanation.atomic")}</li>
          <li>{t("explanation.edit")}</li>
          <li>{t("explanation.retry")}</li>
        </ul>
      </section>

      <section className="max-w-4xl" aria-labelledby="saved-meal-review-items">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-2xl font-semibold text-slate-950" id="saved-meal-review-items">
              {t("items.title")}
            </h2>
            <p className="mt-2 text-sm text-slate-600">
              {t("items.count", { count: meal.items.length })}
            </p>
          </div>
          <Link className="text-sm font-semibold text-teal-800 underline" href={`/${locale}/saved-meals/${meal.saved_meal_id}/edit?date=${date}`}>
            {t("editMeal")}
          </Link>
        </div>
        <ol className="mt-5 grid gap-4">
          {meal.items.map((item) => (
            <li className="border border-slate-200 bg-white p-5 shadow-sm" data-saved-meal-position={item.position} key={item.item_id}>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-teal-700">
                {t("items.position", { position: item.position })}
              </p>
              <h3 className="mt-2 break-words text-lg font-semibold text-slate-950" dir="auto">{item.food_name}</h3>
              {item.brand_name && <p className="mt-1 text-sm text-slate-600" dir="auto">{item.brand_name}</p>}
              <dl className="mt-4 grid gap-x-5 gap-y-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
                <Detail label={t("fields.serving")} value={servingValue(item.serving_quantity, item.serving_unit, t("notSet"))} />
                <Detail label={t("fields.calories")} value={value(item.calories, t("notSet"))} />
                <Detail label={t("fields.protein")} value={value(item.protein_g, t("notSet"), "g")} />
                <Detail label={t("fields.carbohydrates")} value={value(item.carbohydrates_g, t("notSet"), "g")} />
                <Detail label={t("fields.fat")} value={value(item.fat_g, t("notSet"), "g")} />
              </dl>
              {item.notes && <p className="mt-4 text-sm leading-6 text-slate-700" dir="auto">{item.notes}</p>}
            </li>
          ))}
        </ol>
      </section>

      <form action={formAction} className="grid max-w-4xl gap-5 border border-slate-200 bg-white p-5 shadow-sm sm:p-6" noValidate>
        <h2 className="text-xl font-semibold text-slate-950">{t("destination.title")}</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="grid gap-2 text-sm font-medium text-slate-900">
            <span>{t("destination.date")}</span>
            <input aria-describedby={dateInvalid ? "saved-meal-use-status" : undefined} aria-invalid={dateInvalid} className="min-h-11 border border-slate-300 bg-white px-3 text-base" defaultValue={state.values.entry_date} name="entry_date" required type="date" />
          </label>
          <label className="grid gap-2 text-sm font-medium text-slate-900">
            <span>{t("destination.mealType")}</span>
            <select aria-describedby={mealTypeInvalid ? "saved-meal-use-status" : undefined} aria-invalid={mealTypeInvalid} className="min-h-11 border border-slate-300 bg-white px-3 text-base" defaultValue={state.values.meal_type} name="meal_type" required>
              {(["breakfast", "lunch", "dinner", "snack", "other"] as const).map((mealType) => (
                <option key={mealType} value={mealType}>{diaryT(`mealTypes.${mealType}`)}</option>
              ))}
            </select>
          </label>
        </div>
        {status && (
          <div className="border-s-4 border-red-500 bg-red-50 px-4 py-3 text-sm text-red-900" data-testid={`saved-meal-use-${state.status}`} id="saved-meal-use-status" role="alert">
            <p>{status}</p>
            {state.status === "stale_review" && (
              <Link className="mt-2 inline-flex font-semibold text-teal-800 underline" href={`/${locale}/saved-meals/${meal.saved_meal_id}/use?date=${state.values.entry_date}`}>
                {t("reload")}
              </Link>
            )}
          </div>
        )}
        <button className="min-h-12 bg-teal-700 px-5 text-base font-semibold text-white disabled:bg-slate-300" disabled={isPending} type="submit">
          {isPending ? t("submitPending") : t("submit")}
        </button>
      </form>
    </section>
  );
}

function Detail({ label, value: detailValue }: { label: string; value: string }) {
  return <div><dt className="font-medium text-slate-600">{label}</dt><dd className="mt-1 text-slate-950" dir="auto">{detailValue}</dd></div>;
}
