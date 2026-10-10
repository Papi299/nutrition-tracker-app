import Link from "next/link";
import type { DiaryEntryActionState } from "@/app/[locale]/(app)/today/action-state";
import { DiaryEntryListItem } from "@/components/diary/diary-entry-list-item";
import { buttonStyles } from "@/components/ui/button";
import type { DiaryEntry } from "@/lib/diary-entries";
import { formatLocalizedNumber } from "@/lib/i18n/format";
import type { Locale } from "@/lib/i18n/routing";

type MealTypeLabels = Record<DiaryEntry["meal_type"], string>;
const mealTypes = ["breakfast", "lunch", "dinner", "snack", "other"] as const;
const knownMealTypes = new Set<string>(mealTypes);
type DiaryEntryAction = (
  state: DiaryEntryActionState,
  formData: FormData,
) => Promise<DiaryEntryActionState>;

export function DiaryEntryList({
  deleteAction,
  entries,
  emptyMessage,
  emptyMealLabel,
  fieldErrorMessages,
  labels,
  locale,
  mealTypeLabels,
  mealTypeOptions,
  notSetLabel,
  saveLabels,
  selectedDate,
  unitCaloriesLabel,
  updateAction,
}: {
  deleteAction: DiaryEntryAction;
  emptyMessage: string;
  emptyMealLabel: string;
  entries: DiaryEntry[];
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
  saveLabels: MealTypeLabels;
  selectedDate: string;
  unitCaloriesLabel: string;
  updateAction: DiaryEntryAction;
}) {
  return (
    <div className="grid min-w-0 grid-cols-1 gap-6" data-testid="save-diary-meal-links">
      {entries.length === 0 && (
        <p className="ui-body-secondary">{emptyMessage}</p>
      )}
      {mealTypes.map((mealType) => {
        // Filtering preserves the query's original order within each meal.
        // Unexpected meal values remain visible in the Other group.
        const mealEntries = entries.filter((entry) =>
          mealType === "other"
            ? entry.meal_type === "other" || !knownMealTypes.has(entry.meal_type)
            : entry.meal_type === mealType,
        );
        const calories = mealEntries.reduce(
          (total, entry) => total + (entry.calories ?? 0),
          0,
        );
        const hasKnownCalories = mealEntries.some((entry) => entry.calories !== null);
        const canSaveMeal = mealEntries.some((entry) => entry.meal_type === mealType);
        const headingId = `diary-meal-${mealType}`;

        return (
          <section
            aria-labelledby={headingId}
            className={mealEntries.length > 0 ? "grid min-w-0 grid-cols-1 gap-3" : "border-b border-border pb-4"}
            data-meal-type={mealType}
            key={mealType}
          >
            <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
              <div className="flex min-w-0 flex-wrap items-baseline gap-x-3 gap-y-1">
                <h3 className="text-base font-semibold text-foreground" id={headingId}>
                  {mealTypeLabels[mealType]}
                </h3>
                {mealEntries.length > 0 ? (
                  <p className="ui-caption tabular-nums">
                    <bdi>
                      {hasKnownCalories
                        ? `${formatLocalizedNumber(locale, Math.round(calories), {
                            maximumFractionDigits: 0,
                          })} ${unitCaloriesLabel}`
                        : notSetLabel}
                    </bdi>
                  </p>
                ) : (
                  <p className="ui-caption">{emptyMealLabel}</p>
                )}
              </div>
              {canSaveMeal && (
                <Link
                  className={buttonStyles({ variant: "ghost", size: "sm" })}
                  href={`/${locale}/saved-meals/new?date=${selectedDate}&mealType=${mealType}`}
                >
                  {saveLabels[mealType]}
                </Link>
              )}
            </div>
            {mealEntries.length > 0 && (
              <ul className="grid min-w-0 grid-cols-1 gap-2">
                {mealEntries.map((entry) => (
                  <DiaryEntryListItem
                    deleteAction={deleteAction}
                    entry={entry}
                    fieldErrorMessages={fieldErrorMessages}
                    key={entry.id}
                    labels={labels}
                    locale={locale}
                    mealTypeOptions={mealTypeOptions}
                    notSetLabel={notSetLabel}
                    unitCaloriesLabel={unitCaloriesLabel}
                    updateAction={updateAction}
                  />
                ))}
              </ul>
            )}
          </section>
        );
      })}
    </div>
  );
}
