"use client";

import { useActionState } from "react";
import { AuthStatusNote } from "@/components/auth/auth-status-note";
import type {
  DiaryEntryActionState,
  DiaryEntryActionStatus,
  DiaryEntryFieldName,
} from "@/app/[locale]/(app)/today/action-state";

type FieldErrorMessages = Partial<Record<string, string>>;

type MealTypeOption = {
  label: string;
  value: string;
};

function getStatusTone(status: DiaryEntryActionStatus) {
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
  error,
  inputMode,
  label,
  messages,
  name,
  placeholder,
  type = "text",
  value,
}: {
  error?: string;
  inputMode?: "decimal" | "numeric";
  label: string;
  messages: FieldErrorMessages;
  name: DiaryEntryFieldName;
  placeholder?: string;
  type?: "date" | "number" | "text";
  value?: string;
}) {
  return (
    <label className="grid gap-2 text-sm font-medium text-slate-900">
      <span>{label}</span>
      <input
        className="min-h-12 border border-slate-300 bg-white px-3 text-base text-slate-950 outline-none transition-colors placeholder:text-slate-400 focus:border-teal-700"
        defaultValue={value}
        inputMode={inputMode}
        min={type === "number" ? "0" : undefined}
        name={name}
        placeholder={placeholder}
        type={type}
      />
      <FieldError code={error} messages={messages} />
    </label>
  );
}

export function DiaryEntryForm({
  action,
  fieldErrorMessages,
  initialState,
  labels,
  mealTypeOptions,
  pendingLabel,
  statusMessages,
  submitLabel,
}: {
  action: (
    state: DiaryEntryActionState,
    formData: FormData,
  ) => Promise<DiaryEntryActionState>;
  fieldErrorMessages: FieldErrorMessages;
  initialState: DiaryEntryActionState;
  labels: Record<Exclude<DiaryEntryFieldName, "id">, string>;
  mealTypeOptions: MealTypeOption[];
  pendingLabel: string;
  statusMessages: Record<DiaryEntryActionStatus, string>;
  submitLabel: string;
}) {
  const [state, formAction, isPending] = useActionState(action, initialState);
  const values = state.values ?? {};
  const statusTone = getStatusTone(state.status);

  return (
    <form action={formAction} className="grid gap-5 text-start" noValidate>
      <div className="grid gap-4 sm:grid-cols-2">
        <TextInput
          error={state.fieldErrors?.entry_date}
          label={labels.entry_date}
          messages={fieldErrorMessages}
          name="entry_date"
          type="date"
          value={values.entry_date}
        />

        <label className="grid gap-2 text-sm font-medium text-slate-900">
          <span>{labels.meal_type}</span>
          <select
            className="min-h-12 border border-slate-300 bg-white px-3 text-base text-slate-950 outline-none transition-colors focus:border-teal-700"
            defaultValue={values.meal_type ?? mealTypeOptions[0]?.value}
            name="meal_type"
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
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <TextInput
          error={state.fieldErrors?.food_name}
          label={labels.food_name}
          messages={fieldErrorMessages}
          name="food_name"
          value={values.food_name}
        />
        <TextInput
          error={state.fieldErrors?.brand_name}
          label={labels.brand_name}
          messages={fieldErrorMessages}
          name="brand_name"
          value={values.brand_name}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <TextInput
          error={state.fieldErrors?.serving_quantity}
          inputMode="decimal"
          label={labels.serving_quantity}
          messages={fieldErrorMessages}
          name="serving_quantity"
          type="number"
          value={values.serving_quantity}
        />
        <TextInput
          error={state.fieldErrors?.serving_unit}
          label={labels.serving_unit}
          messages={fieldErrorMessages}
          name="serving_unit"
          value={values.serving_unit}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <TextInput
          error={state.fieldErrors?.calories}
          inputMode="numeric"
          label={labels.calories}
          messages={fieldErrorMessages}
          name="calories"
          type="number"
          value={values.calories}
        />
        <TextInput
          error={state.fieldErrors?.protein_g}
          inputMode="decimal"
          label={labels.protein_g}
          messages={fieldErrorMessages}
          name="protein_g"
          type="number"
          value={values.protein_g}
        />
        <TextInput
          error={state.fieldErrors?.carbohydrates_g}
          inputMode="decimal"
          label={labels.carbohydrates_g}
          messages={fieldErrorMessages}
          name="carbohydrates_g"
          type="number"
          value={values.carbohydrates_g}
        />
        <TextInput
          error={state.fieldErrors?.fat_g}
          inputMode="decimal"
          label={labels.fat_g}
          messages={fieldErrorMessages}
          name="fat_g"
          type="number"
          value={values.fat_g}
        />
      </div>

      <label className="grid gap-2 text-sm font-medium text-slate-900">
        <span>{labels.notes}</span>
        <textarea
          className="min-h-24 border border-slate-300 bg-white px-3 py-3 text-base text-slate-950 outline-none transition-colors placeholder:text-slate-400 focus:border-teal-700"
          defaultValue={values.notes}
          name="notes"
        />
        <FieldError
          code={state.fieldErrors?.notes}
          messages={fieldErrorMessages}
        />
      </label>

      <button
        className="min-h-12 bg-teal-700 px-4 text-base font-semibold text-white transition-colors hover:bg-teal-800 disabled:cursor-wait disabled:bg-slate-300 disabled:text-slate-600"
        disabled={isPending}
        type="submit"
      >
        {isPending ? pendingLabel : submitLabel}
      </button>

      <AuthStatusNote tone={statusTone}>{statusMessages[state.status]}</AuthStatusNote>
    </form>
  );
}
