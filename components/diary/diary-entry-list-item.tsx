"use client";

import { useState } from "react";
import type { DiaryEntryActionState } from "@/app/[locale]/(app)/today/action-state";
import { DiaryEntryDeleteButton } from "@/components/diary/diary-entry-delete-button";
import { DiaryEntryEditForm } from "@/components/diary/diary-entry-edit-form";
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

function formatValue(value: null | number | string, suffix = "") {
  return hasValue(value) ? `${String(value)}${suffix}` : null;
}

function formatServing(
  entry: DiaryEntry,
  recipeServingUnits: { plural: string; singular: string },
) {
  const quantity = formatValue(entry.serving_quantity);
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
    saveError: string;
    saveIdle: string;
    savePending: string;
    saveSuccess: string;
    serving: string;
    source: string;
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
  mealTypeLabels: MealTypeLabels;
  mealTypeOptions: { label: string; value: DiaryEntry["meal_type"] }[];
  notSetLabel: string;
  updateAction: DiaryEntryAction;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const serving = formatServing(entry, labels.recipeServingUnits);
  const calories = formatValue(entry.calories);
  const macros = [
    formatValue(entry.protein_g, "g"),
    formatValue(entry.carbohydrates_g, "g"),
    formatValue(entry.fat_g, "g"),
  ];

  return (
    <li className="border border-slate-200 bg-stone-50 p-4 text-start" data-diary-entry-id={entry.id}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-teal-700">
            {labels.meal}: {mealTypeLabels[entry.meal_type]}
          </p>
          <p
            className="mt-2 inline-flex border border-slate-300 bg-white px-2 py-1 text-xs font-semibold text-slate-700"
            data-testid={`diary-source-${entry.source}`}
          >
            {labels.source}: {labels.sourceTypes[entry.source as keyof typeof labels.sourceTypes]}
          </p>
          <h3 className="mt-2 text-lg font-semibold text-slate-950" dir="auto">
            {entry.food_name}
          </h3>
          {entry.brand_name && (
            <p className="mt-1 text-sm text-slate-600" dir="auto">
              {labels.brand}: {entry.brand_name}
            </p>
          )}
        </div>

        <div className="grid gap-3 text-sm leading-6 text-slate-700 sm:justify-items-end sm:text-end">
          <div>
            <p>
              {labels.serving}: {serving ?? notSetLabel}
            </p>
            <p>
              {labels.calories}: {calories ?? notSetLabel}
            </p>
            <p>
              {labels.macros}:{" "}
              {macros.some((value) => value !== null)
                ? macros.map((value) => value ?? notSetLabel).join(" / ")
                : notSetLabel}
            </p>
          </div>
          <div className="flex flex-wrap gap-2 sm:justify-end">
            <button
              className="min-h-10 border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-800 transition-colors hover:border-teal-700 hover:text-teal-800"
              onClick={() => setIsEditing((current) => !current)}
              type="button"
            >
              {labels.edit}
            </button>
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
