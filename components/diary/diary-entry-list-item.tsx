"use client";

import { AdditionalNutrientDetails } from "@/components/nutrition/additional-nutrient-details";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
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
  const totalsT = useTranslations("Diary.totals");
  const serving = formatServing(entry, locale, labels.recipeServingUnits);
  const calories = formatValue(entry.calories, locale, unitCaloriesLabel);
  const macros = [
    { label: totalsT("protein"), value: formatValue(entry.protein_g, locale, labels.unitGrams) },
    { label: totalsT("carbohydrates"), value: formatValue(entry.carbohydrates_g, locale, labels.unitGrams) },
    { label: totalsT("fat"), value: formatValue(entry.fat_g, locale, labels.unitGrams) },
  ];
  const source = labels.sourceTypes[entry.source as keyof typeof labels.sourceTypes] ?? entry.source;

  return (
    <li
      className="diary-entry"
      data-diary-entry-id={entry.id}
      data-entry-meal-type={entry.meal_type}
    >
      <div className="diary-row-heading">
        <div className="min-w-0 flex-1">
          <h4 className="diary-food-name" dir="auto">
            {entry.food_name}
          </h4>
        </div>
        <p className="diary-row-calories">
          <span className="sr-only">{labels.calories}: </span>
          <bdi>{calories ?? notSetLabel}</bdi>
        </p>
      </div>

      <p className="diary-row-metadata">
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
        <span aria-hidden="true">·</span>
        <span data-testid={`diary-source-${entry.source}`}>{labels.source}: <bdi>{source}</bdi></span>
      </p>

      <div className="diary-row-bottom">
        <dl
          aria-label={labels.macros}
          className="diary-row-macros"
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

        <div className="diary-row-actions">
          <Button
            size="sm"
            variant="ghost"
            aria-expanded={isEditing}
            aria-controls={`diary-edit-${entry.id}`}
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

      <AdditionalNutrientDetails snapshots={[entry.additional_nutrient_snapshot]} locale={locale} />

      <div id={`diary-edit-${entry.id}`}>
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
      </div>
    </li>
  );
}
