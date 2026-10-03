"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { surfaceStyles } from "@/components/ui/card";
import type { DiaryEntryActionState } from "@/app/[locale]/(app)/today/action-state";
import { DiaryEntryDeleteButton } from "@/components/diary/diary-entry-delete-button";
import { DiaryEntryEditForm } from "@/components/diary/diary-entry-edit-form";
import { formatLocalizedNumber } from "@/lib/i18n/format";
import type { Locale } from "@/lib/i18n/routing";
import type { Tables } from "@/lib/supabase/database.types";

type DiaryEntry = Tables<"diary_entries">;
type MealTypeLabels = Record<DiaryEntry["meal_type"], string>;
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
  mealTypeLabels,
  mealTypeOptions,
  notSetLabel,
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
  mealTypeLabels: MealTypeLabels;
  mealTypeOptions: { label: string; value: DiaryEntry["meal_type"] }[];
  notSetLabel: string;
  updateAction: DiaryEntryAction;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const serving = formatServing(entry, locale, labels.recipeServingUnits);
  const calories = formatValue(entry.calories, locale);
  const macros = [
    formatValue(entry.protein_g, locale, labels.unitGrams),
    formatValue(entry.carbohydrates_g, locale, labels.unitGrams),
    formatValue(entry.fat_g, locale, labels.unitGrams),
  ];

  return (
    <li className={surfaceStyles({ variant: "subtle", className: "p-4 text-start" })} data-diary-entry-id={entry.id}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="ui-eyebrow">
            {labels.meal}: {mealTypeLabels[entry.meal_type]}
          </p>
          <Badge
            className="mt-2"
            data-testid={`diary-source-${entry.source}`}
          >
            {labels.source}: {labels.sourceTypes[entry.source as keyof typeof labels.sourceTypes]}
          </Badge>
          <h3 className="mt-2 ui-card-title" dir="auto">
            {entry.food_name}
          </h3>
          {entry.brand_name && (
            <p className="mt-1 text-sm text-muted-foreground" dir="auto">
              {labels.brand}: {entry.brand_name}
            </p>
          )}
        </div>

        <div className="grid gap-3 text-sm leading-6 tabular-nums text-muted-foreground sm:justify-items-end sm:text-end">
          <div>
            <p>
              {labels.serving}: <bdi>{serving ?? notSetLabel}</bdi>
            </p>
            <p>
              {labels.calories}: <bdi>{calories ?? notSetLabel}</bdi>
            </p>
            <p>
              {labels.macros}:{" "}
              <bdi>
                {macros.some((value) => value !== null)
                  ? macros.map((value) => value ?? notSetLabel).join(" / ")
                  : notSetLabel}
              </bdi>
            </p>
          </div>
          <div className="flex flex-wrap gap-2 sm:justify-end">
            <Button
              size="sm"
              variant="outline"
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
