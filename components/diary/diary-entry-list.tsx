import type { DiaryEntryActionState } from "@/app/[locale]/(app)/today/action-state";
import { DiaryEntryListItem } from "@/components/diary/diary-entry-list-item";
import type { DiaryEntry } from "@/lib/diary-entries";

type MealTypeLabels = Record<DiaryEntry["meal_type"], string>;
type DiaryEntryAction = (
  state: DiaryEntryActionState,
  formData: FormData,
) => Promise<DiaryEntryActionState>;

export function DiaryEntryList({
  deleteAction,
  entries,
  emptyMessage,
  fieldErrorMessages,
  labels,
  mealTypeLabels,
  mealTypeOptions,
  notSetLabel,
  updateAction,
}: {
  deleteAction: DiaryEntryAction;
  emptyMessage: string;
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
    saveError: string;
    saveIdle: string;
    savePending: string;
    saveSuccess: string;
    serving: string;
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
  if (entries.length === 0) {
    return (
      <div className="border border-dashed border-slate-300 bg-stone-50 p-5 text-sm leading-6 text-slate-700">
        {emptyMessage}
      </div>
    );
  }

  return (
    <ul className="grid gap-3">
      {entries.map((entry) => (
        <DiaryEntryListItem
          deleteAction={deleteAction}
          entry={entry}
          fieldErrorMessages={fieldErrorMessages}
          key={entry.id}
          labels={labels}
          mealTypeLabels={mealTypeLabels}
          mealTypeOptions={mealTypeOptions}
          notSetLabel={notSetLabel}
          updateAction={updateAction}
        />
      ))}
    </ul>
  );
}
