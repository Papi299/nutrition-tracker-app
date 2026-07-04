"use client";

import { useActionState, type ReactNode } from "react";
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

type FieldLabels = Record<Exclude<DiaryEntryFieldName, "id">, string>;

type FieldHelpText = Partial<Record<Exclude<DiaryEntryFieldName, "id">, string>>;

type SectionLabels = {
  foodDetails: string;
  mealDate: string;
  notes: string;
  nutrition: string;
  serving: string;
  submit: string;
};

function getStatusTone(status: DiaryEntryActionStatus) {
  return status === "idle" ? "info" : status === "success" ? "success" : "error";
}

function FieldRequirement({
  label,
}: {
  label: string;
}) {
  return (
    <span className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
      {label}
    </span>
  );
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

function FormSection({
  children,
  title,
}: {
  children: ReactNode;
  title: string;
}) {
  return (
    <fieldset className="grid gap-4 border-t border-slate-200 pt-5 first:border-t-0 first:pt-0">
      <legend className="mb-1 text-base font-semibold text-slate-950">
        {title}
      </legend>
      {children}
    </fieldset>
  );
}

function FieldLabel({
  label,
  required,
  requiredLabel,
  optionalLabel,
}: {
  label: string;
  required: boolean;
  requiredLabel: string;
  optionalLabel: string;
}) {
  return (
    <span className="flex flex-wrap items-center justify-between gap-2">
      <span>{label}</span>
      <FieldRequirement label={required ? requiredLabel : optionalLabel} />
    </span>
  );
}

function TextInput({
  error,
  helpText,
  inputMode,
  label,
  messages,
  name,
  optionalLabel,
  placeholder,
  required = false,
  requiredLabel,
  step,
  type = "text",
  value,
}: {
  error?: string;
  helpText?: string;
  inputMode?: "decimal" | "numeric";
  label: string;
  messages: FieldErrorMessages;
  name: DiaryEntryFieldName;
  optionalLabel: string;
  placeholder?: string;
  required?: boolean;
  requiredLabel: string;
  step?: "1" | "any";
  type?: "date" | "number" | "text";
  value?: string;
}) {
  return (
    <label className="grid gap-2 text-sm font-medium text-slate-900">
      <FieldLabel
        label={label}
        optionalLabel={optionalLabel}
        required={required}
        requiredLabel={requiredLabel}
      />
      <input
        aria-invalid={Boolean(error)}
        className="min-h-12 border border-slate-300 bg-white px-3 text-base text-slate-950 outline-none transition-colors placeholder:text-slate-400 focus:border-teal-700"
        defaultValue={value}
        inputMode={inputMode}
        min={type === "number" ? "0" : undefined}
        name={name}
        placeholder={placeholder}
        required={required}
        step={step}
        type={type}
      />
      {helpText && (
        <span className="text-sm font-normal leading-6 text-slate-600">
          {helpText}
        </span>
      )}
      <FieldError code={error} messages={messages} />
    </label>
  );
}

export function DiaryEntryForm({
  action,
  fieldHelpText,
  fieldErrorMessages,
  initialState,
  labels,
  mealTypeOptions,
  optionalLabel,
  pendingLabel,
  requiredLabel,
  sectionLabels,
  statusMessages,
  submitLabel,
}: {
  action: (
    state: DiaryEntryActionState,
    formData: FormData,
  ) => Promise<DiaryEntryActionState>;
  fieldHelpText: FieldHelpText;
  fieldErrorMessages: FieldErrorMessages;
  initialState: DiaryEntryActionState;
  labels: FieldLabels;
  mealTypeOptions: MealTypeOption[];
  optionalLabel: string;
  pendingLabel: string;
  requiredLabel: string;
  sectionLabels: SectionLabels;
  statusMessages: Record<DiaryEntryActionStatus, string>;
  submitLabel: string;
}) {
  const [state, formAction, isPending] = useActionState(action, initialState);
  const values = state.values ?? {};
  const statusTone = getStatusTone(state.status);

  return (
    <form action={formAction} className="grid gap-5 text-start" noValidate>
      <FormSection title={sectionLabels.mealDate}>
        <div className="grid gap-4 sm:grid-cols-2">
          <TextInput
            error={state.fieldErrors?.entry_date}
            helpText={fieldHelpText.entry_date}
            label={labels.entry_date}
            messages={fieldErrorMessages}
            name="entry_date"
            optionalLabel={optionalLabel}
            required
            requiredLabel={requiredLabel}
            type="date"
            value={values.entry_date}
          />

          <label className="grid gap-2 text-sm font-medium text-slate-900">
            <FieldLabel
              label={labels.meal_type}
              optionalLabel={optionalLabel}
              required
              requiredLabel={requiredLabel}
            />
            <select
              aria-invalid={Boolean(state.fieldErrors?.meal_type)}
              className="min-h-12 border border-slate-300 bg-white px-3 text-base text-slate-950 outline-none transition-colors focus:border-teal-700"
              defaultValue={values.meal_type ?? mealTypeOptions[0]?.value}
              name="meal_type"
              required
            >
              {mealTypeOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            {fieldHelpText.meal_type && (
              <span className="text-sm font-normal leading-6 text-slate-600">
                {fieldHelpText.meal_type}
              </span>
            )}
            <FieldError
              code={state.fieldErrors?.meal_type}
              messages={fieldErrorMessages}
            />
          </label>
        </div>
      </FormSection>

      <FormSection title={sectionLabels.foodDetails}>
        <div className="grid gap-4 sm:grid-cols-2">
          <TextInput
            error={state.fieldErrors?.food_name}
            helpText={fieldHelpText.food_name}
            label={labels.food_name}
            messages={fieldErrorMessages}
            name="food_name"
            optionalLabel={optionalLabel}
            required
            requiredLabel={requiredLabel}
            value={values.food_name}
          />
          <TextInput
            error={state.fieldErrors?.brand_name}
            helpText={fieldHelpText.brand_name}
            label={labels.brand_name}
            messages={fieldErrorMessages}
            name="brand_name"
            optionalLabel={optionalLabel}
            requiredLabel={requiredLabel}
            value={values.brand_name}
          />
        </div>
      </FormSection>

      <FormSection title={sectionLabels.serving}>
        <div className="grid gap-4 sm:grid-cols-2">
          <TextInput
            error={state.fieldErrors?.serving_quantity}
            helpText={fieldHelpText.serving_quantity}
            inputMode="decimal"
            label={labels.serving_quantity}
            messages={fieldErrorMessages}
            name="serving_quantity"
            optionalLabel={optionalLabel}
            requiredLabel={requiredLabel}
            step="any"
            type="number"
            value={values.serving_quantity}
          />
          <TextInput
            error={state.fieldErrors?.serving_unit}
            helpText={fieldHelpText.serving_unit}
            label={labels.serving_unit}
            messages={fieldErrorMessages}
            name="serving_unit"
            optionalLabel={optionalLabel}
            requiredLabel={requiredLabel}
            value={values.serving_unit}
          />
        </div>
      </FormSection>

      <FormSection title={sectionLabels.nutrition}>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <TextInput
            error={state.fieldErrors?.calories}
            helpText={fieldHelpText.calories}
            inputMode="numeric"
            label={labels.calories}
            messages={fieldErrorMessages}
            name="calories"
            optionalLabel={optionalLabel}
            requiredLabel={requiredLabel}
            step="1"
            type="number"
            value={values.calories}
          />
          <TextInput
            error={state.fieldErrors?.protein_g}
            helpText={fieldHelpText.protein_g}
            inputMode="decimal"
            label={labels.protein_g}
            messages={fieldErrorMessages}
            name="protein_g"
            optionalLabel={optionalLabel}
            requiredLabel={requiredLabel}
            step="any"
            type="number"
            value={values.protein_g}
          />
          <TextInput
            error={state.fieldErrors?.carbohydrates_g}
            helpText={fieldHelpText.carbohydrates_g}
            inputMode="decimal"
            label={labels.carbohydrates_g}
            messages={fieldErrorMessages}
            name="carbohydrates_g"
            optionalLabel={optionalLabel}
            requiredLabel={requiredLabel}
            step="any"
            type="number"
            value={values.carbohydrates_g}
          />
          <TextInput
            error={state.fieldErrors?.fat_g}
            helpText={fieldHelpText.fat_g}
            inputMode="decimal"
            label={labels.fat_g}
            messages={fieldErrorMessages}
            name="fat_g"
            optionalLabel={optionalLabel}
            requiredLabel={requiredLabel}
            step="any"
            type="number"
            value={values.fat_g}
          />
        </div>
      </FormSection>

      <FormSection title={sectionLabels.notes}>
        <label className="grid gap-2 text-sm font-medium text-slate-900">
          <FieldLabel
            label={labels.notes}
            optionalLabel={optionalLabel}
            required={false}
            requiredLabel={requiredLabel}
          />
          <textarea
            aria-invalid={Boolean(state.fieldErrors?.notes)}
            className="min-h-24 border border-slate-300 bg-white px-3 py-3 text-base text-slate-950 outline-none transition-colors placeholder:text-slate-400 focus:border-teal-700"
            defaultValue={values.notes}
            name="notes"
          />
          {fieldHelpText.notes && (
            <span className="text-sm font-normal leading-6 text-slate-600">
              {fieldHelpText.notes}
            </span>
          )}
          <FieldError
            code={state.fieldErrors?.notes}
            messages={fieldErrorMessages}
          />
        </label>
      </FormSection>

      <FormSection title={sectionLabels.submit}>
        <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
          <div aria-live="polite">
            <AuthStatusNote tone={statusTone}>
              {statusMessages[state.status]}
            </AuthStatusNote>
          </div>

          <button
            className="min-h-12 bg-teal-700 px-4 text-base font-semibold text-white transition-colors hover:bg-teal-800 disabled:cursor-wait disabled:bg-slate-300 disabled:text-slate-600"
            disabled={isPending}
            type="submit"
          >
            {isPending ? pendingLabel : submitLabel}
          </button>
        </div>
      </FormSection>
    </form>
  );
}
