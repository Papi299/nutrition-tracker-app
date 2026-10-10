"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { surfaceStyles } from "@/components/ui/card";
import type { DiaryEntryActionState } from "@/app/[locale]/(app)/today/action-state";
import { DiaryEntryDeleteButton } from "@/components/diary/diary-entry-delete-button";
import { DiaryEntryEditForm } from "@/components/diary/diary-entry-edit-form";
import { formatLocalizedNumber } from "@/lib/i18n/format";
import type { Locale } from "@/lib/i18n/routing";
import type { Tables } from "@/lib/supabase/database.types";

type DiaryEntry = Tables<"diary_entries">;
type DiaryEntryAction = (
  state: DiaryEntryActionState,
  formData: FormData,
) => Promise<DiaryEntryActionState>;

function hasValue(value: null | number | string) {
  return value !== null && value !== "";
}

function formatValue(
  value: null | number | string,
  locale: Locale,
  suffix = "",
) {
  return hasValue(value)
    ? `${formatLocalizedNumber(locale, value as number | string)}${suffix ? ` ${suffix}` : ""}`
    : null;
}

function formatServing(
  entry: DiaryEntry,
  locale: Locale,
  recipeServingUnits: { plural: string; singular: string },
) {
  const quantity = formatValue(entry.serving_quantity, locale);
  const unit = entry.serving_unit;

  if (entry.source === "recipe" && quantity && unit === null) {
    return `${quantity} ${
      entry.serving_quantity === 1
        ? recipeServingUnits.singular
        : recipeServingUnits.plural
    }`;
  }

  if (quantity && unit) {
    return `${quantity} ${unit}`;
  }

  return quantity ?? unit;
}

export function DiaryEntryListItem({
  deleteAction,
  entry,
  fieldErrorMessages,
  labels,
  locale,
  mealTypeOptions,
  notSetLabel,
  unitCaloriesLabel,
  updateAction,
}: {
  deleteAction: DiaryEntryAction;
  entry: DiaryEntry;
  fieldErrorMessages: Partial<Record<string, string>>;
  labels: {
    brand: string;
    calories: string;
    cancel: string;
    delete: string;
    deleteError: string;
    deletePending: string;
    edit: string;
    editTitle: string;
    macros: string;
    meal: string;
    save: string;
    saveConflict: string;
    saveError: string;
    saveIdle: string;
    savePending: string;
    saveSuccess: string;
    serving: string;
    source: string;
    unitGrams: string;
    sourceTypes: Record<"manual" | "recipe" | "saved_meal", string>;
    recipeServingUnits: { plural: string; singular: string };
    fields: {
      brand_name: string;
      calories: string;
      carbohydrates_g: string;
      entry_date: string;
      fat_g: string;
      food_name: string;
      meal_type: string;
      notes: string;
      protein_g: string;
      serving_quantity: string;
      serving_unit: string;
    };
  };
  locale: Locale;
  mealTypeOptions: { label: string; value: DiaryEntry["meal_type"] }[];
  notSetLabel: string;
  unitCaloriesLabel: string;
  updateAction: DiaryEntryAction;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const serving = formatServing(entry, locale, labels.recipeServingUnits);
  const calories = formatValue(entry.calories, locale, unitCaloriesLabel);
  const macros = [
    { label: labels.fields.protein_g, value: formatValue(entry.protein_g, locale) },
    { label: labels.fields.carbohydrates_g, value: formatValue(entry.carbohydrates_g, locale) },
    { label: labels.fields.fat_g, value: formatValue(entry.fat_g, locale) },
  ];
  const source = labels.sourceTypes[entry.source as keyof typeof labels.sourceTypes] ?? entry.source;

  return (
    <li
      className={surfaceStyles({ className: "min-w-0 p-4 text-start wrap-anywhere" })}
      data-diary-entry-id={entry.id}
      data-entry-meal-type={entry.meal_type}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h4 className="ui-card-title break-words" dir="auto">
            {entry.food_name}
          </h4>
        </div>
        <p className="min-w-0 max-w-1/2 break-words text-end text-lg font-semibold leading-7 tabular-nums text-foreground">
          <span className="sr-only">{labels.calories}: </span>
          <bdi>{calories ?? notSetLabel}</bdi>
        </p>
      </div>

      <p className="mt-1 flex flex-wrap gap-x-2 gap-y-1 text-sm leading-6 text-muted-foreground">
        <span className="min-w-0 max-w-full break-words">
          <span className="sr-only">{labels.serving}: </span>
          <bdi>{serving ?? notSetLabel}</bdi>
        </span>
        {entry.brand_name && (
          <>
            <span aria-hidden="true">·</span>
            <span className="min-w-0 max-w-full wrap-anywhere" dir="auto">
              <span className="sr-only">{labels.brand}: </span>
              {entry.brand_name}
            </span>
          </>
        )}
      </p>

      <dl
        aria-label={labels.macros}
        className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs leading-5 text-muted-foreground"
      >
        {macros.map((macro) => (
          <div className="flex min-w-0 flex-wrap gap-x-1" key={macro.label}>
            <dt>{macro.label}: </dt>
            <dd className="break-words font-medium tabular-nums text-foreground">
              <bdi>{macro.value ?? notSetLabel}</bdi>
            </dd>
          </div>
        ))}
      </dl>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
        <p className="ui-caption" data-testid={`diary-source-${entry.source}`}>
          {labels.source}: <bdi>{source}</bdi>
        </p>
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setIsEditing((current) => !current)}
            type="button"
          >
            {labels.edit}
          </Button>
          <DiaryEntryDeleteButton
            action={deleteAction}
            entryId={entry.id}
            labels={{
              error: labels.deleteError,
              pending: labels.deletePending,
              submit: labels.delete,
            }}
          />
        </div>
      </div>

      {isEditing && (
        <DiaryEntryEditForm
          action={updateAction}
          entry={entry}
          fieldErrorMessages={fieldErrorMessages}
          labels={{
            ...labels.fields,
            cancel: labels.cancel,
            save: labels.save,
            title: labels.editTitle,
          }}
          mealTypeOptions={mealTypeOptions}
          onCancel={() => setIsEditing(false)}
          pendingLabel={labels.savePending}
          statusMessages={{
            conflict: labels.saveConflict,
            database_error: labels.saveError,
            idle: labels.saveIdle,
            not_found: labels.saveError,
            success: labels.saveSuccess,
            unauthenticated: labels.saveError,
            validation_error: labels.saveError,
          }}
        />
      )}
    </li>
  );
}
