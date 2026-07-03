import type { DiaryEntryActionState } from "@/app/[locale]/(app)/today/action-state";
import { DiaryEntryDeleteButton } from "@/components/diary/diary-entry-delete-button";
import type { DiaryEntry } from "@/lib/diary-entries";

type MealTypeLabels = Record<DiaryEntry["meal_type"], string>;
type DeleteAction = (
  state: DiaryEntryActionState,
  formData: FormData,
) => Promise<DiaryEntryActionState>;

function hasValue(value: null | number | string) {
  return value !== null && value !== "";
}

function formatValue(value: null | number | string, suffix = "") {
  return hasValue(value) ? `${String(value)}${suffix}` : null;
}

function formatServing(entry: DiaryEntry) {
  const quantity = formatValue(entry.serving_quantity);
  const unit = entry.serving_unit;

  if (quantity && unit) {
    return `${quantity} ${unit}`;
  }

  return quantity ?? unit;
}

export function DiaryEntryList({
  deleteAction,
  entries,
  emptyMessage,
  labels,
  mealTypeLabels,
  notSetLabel,
}: {
  deleteAction: DeleteAction;
  emptyMessage: string;
  entries: DiaryEntry[];
  labels: {
    brand: string;
    calories: string;
    delete: string;
    deleteError: string;
    deletePending: string;
    macros: string;
    meal: string;
    serving: string;
  };
  mealTypeLabels: MealTypeLabels;
  notSetLabel: string;
}) {
  if (entries.length === 0) {
    return (
      <div className="border border-dashed border-slate-300 bg-stone-50 p-5 text-sm leading-6 text-slate-700">
        {emptyMessage}
      </div>
    );
  }

  return (
    <ul className="grid gap-3">
      {entries.map((entry) => {
        const serving = formatServing(entry);
        const calories = formatValue(entry.calories);
        const macros = [
          formatValue(entry.protein_g, "g"),
          formatValue(entry.carbohydrates_g, "g"),
          formatValue(entry.fat_g, "g"),
        ];

        return (
          <li
            className="border border-slate-200 bg-stone-50 p-4 text-start"
            key={entry.id}
          >
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-teal-700">
                  {labels.meal}: {mealTypeLabels[entry.meal_type]}
                </p>
                <h3
                  className="mt-2 text-lg font-semibold text-slate-950"
                  dir="auto"
                >
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
          </li>
        );
      })}
    </ul>
  );
}
