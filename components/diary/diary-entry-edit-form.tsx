"use client";

import { useActionState } from "react";
import { AuthStatusNote } from "@/components/auth/auth-status-note";
import type {
  DiaryEntryActionState,
  DiaryEntryActionStatus,
  DiaryEntryFieldName,
} from "@/app/[locale]/(app)/today/action-state";
import type { Tables } from "@/lib/supabase/database.types";

type DiaryEntry = Tables<"diary_entries">;
type EditAction = (
  state: DiaryEntryActionState,
  formData: FormData,
) => Promise<DiaryEntryActionState>;
type FieldErrorMessages = Partial<Record<string, string>>;
type MealTypeOption = {
  label: string;
  value: DiaryEntry["meal_type"];
};

type EditableFieldName = Exclude<DiaryEntryFieldName, "food_id" | "id">;
type FieldLabels = Record<EditableFieldName, string>;

function stringifyValue(value: null | number | string) {
  return value === null ? "" : String(value);
}

function resolveValue(
  values: DiaryEntryActionState["values"],
  field: EditableFieldName,
  fallback: null | number | string,
) {
  return values && field in values ? values[field] : stringifyValue(fallback);
}

function statusTone(status: DiaryEntryActionStatus) {
  return status === "idle" ? "info" : status === "success" ? "success" : "error";
}

function FieldError({
  code,
  messages,
}: {
  code?: string;
  messages: FieldErrorMessages;
}) {
  if (!code) {
    return null;
  }

  return (
    <span className="text-sm font-normal text-red-700">
      {messages[code] ?? messages.invalid_input}
    </span>
  );
}

function TextInput({
  entry,
  disabled = false,
  error,
  inputMode,
  label,
  messages,
  name,
  required = false,
  step,
  type = "text",
  values,
}: {
  entry: DiaryEntry;
  disabled?: boolean;
  error?: string;
  inputMode?: "decimal" | "numeric";
  label: string;
  messages: FieldErrorMessages;
  name: EditableFieldName;
  required?: boolean;
  step?: "1" | "any";
  type?: "date" | "number" | "text";
  values: DiaryEntryActionState["values"];
}) {
  return (
    <label className="grid gap-2 text-sm font-medium text-slate-900">
      <span>{label}</span>
      <input
        aria-invalid={Boolean(error)}
        className="min-h-11 border border-slate-300 bg-white px-3 text-base text-slate-950 outline-none transition-colors placeholder:text-slate-400 focus:border-teal-700"
        defaultValue={resolveValue(values, name, entry[name])}
        disabled={disabled}
        inputMode={inputMode}
        min={type === "number" ? "0" : undefined}
        name={name}
        required={required}
        step={step}
        type={type}
      />
      <FieldError code={error} messages={messages} />
    </label>
  );
}

export function DiaryEntryEditForm({
  action,
  entry,
  fieldErrorMessages,
  labels,
  mealTypeOptions,
  onCancel,
  pendingLabel,
  statusMessages,
}: {
  action: EditAction;
  entry: DiaryEntry;
  fieldErrorMessages: FieldErrorMessages;
  labels: FieldLabels & {
    cancel: string;
    save: string;
    title: string;
  };
  mealTypeOptions: MealTypeOption[];
  onCancel: () => void;
  pendingLabel: string;
  statusMessages: Record<DiaryEntryActionStatus, string>;
}) {
  const [state, formAction, isPending] = useActionState(action, {
    status: "idle",
    values: { id: entry.id },
  } satisfies DiaryEntryActionState);
  const values = state.values;
  const provenanceContextLocked = entry.source !== "manual";

  return (
    <form
      action={formAction}
      className="mt-4 grid gap-4 border-t border-slate-200 pt-4 text-start"
      noValidate
    >
      <input name="id" type="hidden" value={entry.id} />
      <h4 className="text-base font-semibold text-slate-950">
        {labels.title}
      </h4>

      <div className="grid gap-4 sm:grid-cols-2">
        <TextInput
          entry={entry}
          disabled={provenanceContextLocked}
          error={state.fieldErrors?.entry_date}
          label={labels.entry_date}
          messages={fieldErrorMessages}
          name="entry_date"
          required
          type="date"
          values={values}
        />

        <label className="grid gap-2 text-sm font-medium text-slate-900">
          <span>{labels.meal_type}</span>
          <select
            aria-invalid={Boolean(state.fieldErrors?.meal_type)}
            className="min-h-11 border border-slate-300 bg-white px-3 text-base text-slate-950 outline-none transition-colors focus:border-teal-700"
            defaultValue={
              values?.meal_type ?? entry.meal_type ?? mealTypeOptions[0]?.value
            }
            disabled={provenanceContextLocked}
            name="meal_type"
            required
          >
            {mealTypeOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <FieldError
            code={state.fieldErrors?.meal_type}
            messages={fieldErrorMessages}
          />
        </label>

        <TextInput
          entry={entry}
          error={state.fieldErrors?.food_name}
          label={labels.food_name}
          messages={fieldErrorMessages}
          name="food_name"
          required
          values={values}
        />
        <TextInput
          entry={entry}
          error={state.fieldErrors?.brand_name}
          label={labels.brand_name}
          messages={fieldErrorMessages}
          name="brand_name"
          values={values}
        />
        <TextInput
          entry={entry}
          error={state.fieldErrors?.serving_quantity}
          inputMode="decimal"
          label={labels.serving_quantity}
          messages={fieldErrorMessages}
          name="serving_quantity"
          step="any"
          type="number"
          values={values}
        />
        <TextInput
          entry={entry}
          error={state.fieldErrors?.serving_unit}
          label={labels.serving_unit}
          messages={fieldErrorMessages}
          name="serving_unit"
          values={values}
        />
        <TextInput
          entry={entry}
          error={state.fieldErrors?.calories}
          inputMode="numeric"
          label={labels.calories}
          messages={fieldErrorMessages}
          name="calories"
          step="1"
          type="number"
          values={values}
        />
        <TextInput
          entry={entry}
          error={state.fieldErrors?.protein_g}
          inputMode="decimal"
          label={labels.protein_g}
          messages={fieldErrorMessages}
          name="protein_g"
          step="any"
          type="number"
          values={values}
        />
        <TextInput
          entry={entry}
          error={state.fieldErrors?.carbohydrates_g}
          inputMode="decimal"
          label={labels.carbohydrates_g}
          messages={fieldErrorMessages}
          name="carbohydrates_g"
          step="any"
          type="number"
          values={values}
        />
        <TextInput
          entry={entry}
          error={state.fieldErrors?.fat_g}
          inputMode="decimal"
          label={labels.fat_g}
          messages={fieldErrorMessages}
          name="fat_g"
          step="any"
          type="number"
          values={values}
        />
      </div>

      <label className="grid gap-2 text-sm font-medium text-slate-900">
        <span>{labels.notes}</span>
        <textarea
          aria-invalid={Boolean(state.fieldErrors?.notes)}
          className="min-h-24 border border-slate-300 bg-white px-3 py-3 text-base text-slate-950 outline-none transition-colors placeholder:text-slate-400 focus:border-teal-700"
          defaultValue={resolveValue(values, "notes", entry.notes)}
          name="notes"
        />
        <FieldError code={state.fieldErrors?.notes} messages={fieldErrorMessages} />
      </label>

      <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:items-center">
        <div aria-live="polite">
          <AuthStatusNote tone={statusTone(state.status)}>
            {statusMessages[state.status]}
          </AuthStatusNote>
        </div>

        <button
          className="min-h-11 border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-800 transition-colors hover:border-teal-700 hover:text-teal-800"
          disabled={isPending}
          onClick={onCancel}
          type="button"
        >
          {labels.cancel}
        </button>
        <button
          className="min-h-11 bg-teal-700 px-4 text-sm font-semibold text-white transition-colors hover:bg-teal-800 disabled:cursor-wait disabled:bg-slate-300 disabled:text-slate-600"
          disabled={isPending}
          type="submit"
        >
          {isPending ? pendingLabel : labels.save}
        </button>
      </div>
    </form>
  );
}
