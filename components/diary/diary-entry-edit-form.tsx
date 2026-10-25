"use client";

import { useActionState, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import { AdditionalNutrientFields } from "@/components/nutrition/additional-nutrient-fields";
import { additionalNutrientCodesV1, parseAdditionalNutrientSnapshot } from "@/lib/nutrition-snapshots";
import { AuthStatusNote } from "@/components/auth/auth-status-note";
import { Button } from "@/components/ui/button";
import {
  FieldError as UIFieldError,
  FieldLabel,
  Input,
  Select,
  Textarea,
} from "@/components/ui/form-controls";
import type {
  DiaryEntryActionState,
  DiaryEntryActionStatus,
  DiaryEntryFieldName,
} from "@/app/[locale]/(app)/today/action-state";
import type { AdditionalNutrientCode } from "@/lib/nutrition-snapshots";
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

type EditableFieldName = Exclude<
  DiaryEntryFieldName,
  "expected_version" | "food_id" | "id" | "idempotency_key" | `automatic_${string}` | AdditionalNutrientCode | "reference_fingerprint" | "additional_nutrients_captured" | "additional_nutrient_snapshot"
>;
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
    <UIFieldError>
      {messages[code] ?? messages.invalid_input}
    </UIFieldError>
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
    <FieldLabel className="grid gap-2">
      <span>{label}</span>
      <Input
        aria-invalid={Boolean(error)}
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
    </FieldLabel>
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
    values: { expected_version: String(entry.version), id: entry.id },
  } satisfies DiaryEntryActionState);
  const t = useTranslations("Diary.additionalNutrients");
  const formT = useTranslations("Diary.form");
  const values = state.values;
  const snapshot = parseAdditionalNutrientSnapshot(entry.additional_nutrient_snapshot);
  if (!snapshot.ok) return <AuthStatusNote tone="error">{t("unavailable")}</AuthStatusNote>;
  const additionalValues = Object.fromEntries(additionalNutrientCodesV1.map(code => [code,
    values && code in values ? values[code] : snapshot.data?.values[code] == null ? "" : String(snapshot.data.values[code]),
  ]));
  function captureAdditional(event: FormEvent<HTMLFormElement>) {
    const target = event.target;
    if (target instanceof HTMLInputElement && (additionalNutrientCodesV1 as readonly string[]).includes(target.name)) {
      const capture = event.currentTarget.elements.namedItem("additional_nutrients_captured");
      if (capture instanceof HTMLInputElement && capture.type === "checkbox") capture.checked = true;
    }
  }
  const provenanceContextLocked = entry.source !== "manual";

  return (
    <form
      action={formAction}
      className="mt-4 grid gap-4 border-t border-border pt-4 text-start"
      key={JSON.stringify(state.values ?? {})}
      noValidate
      onInput={captureAdditional}
    >
      <input name="id" type="hidden" value={entry.id} />
      <input
        name="expected_version"
        type="hidden"
        value={values?.expected_version ?? String(entry.version)}
      />
      <h4 className="ui-card-title">
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

        <FieldLabel className="grid gap-2">
          <span>{labels.meal_type}</span>
          <Select
            aria-invalid={Boolean(state.fieldErrors?.meal_type)}
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
          </Select>
          <FieldError
            code={state.fieldErrors?.meal_type}
            messages={fieldErrorMessages}
          />
        </FieldLabel>

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

      {state.fieldErrors?.form === "nutrition_review_required" && <p data-testid="nutrition-review-required" role="status">{formT("nutritionReviewRequired")}</p>}
      {state.fieldErrors?.form === "capture_required" && <p role="alert">{t("captureRequired")}</p>}
      {snapshot.data === null ? <label className="flex min-h-11 items-center gap-2 text-sm">
        <input defaultChecked={values?.additional_nutrients_captured === "1"} name="additional_nutrients_captured" type="checkbox" value="1" />
        <span>{t("capture")}</span>
      </label> : <input name="additional_nutrients_captured" type="hidden" value="1" />}
      <AdditionalNutrientFields values={additionalValues} errors={state.fieldErrors}
        controlPrefix={`diary-edit-${entry.id}`} expandAll={state.fieldErrors?.form === "nutrition_review_required"} />
      <FieldLabel className="grid gap-2">
        <span>{labels.notes}</span>
        <Textarea
          aria-invalid={Boolean(state.fieldErrors?.notes)}
          className="min-h-24 py-3"
          defaultValue={resolveValue(values, "notes", entry.notes)}
          name="notes"
        />
        <FieldError code={state.fieldErrors?.notes} messages={fieldErrorMessages} />
      </FieldLabel>

      <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:items-center">
        <div>
          <AuthStatusNote tone={statusTone(state.status)}>
            {statusMessages[state.status]}
          </AuthStatusNote>
        </div>

        <Button
          disabled={isPending}
          onClick={onCancel}
          type="button"
          variant="outline"
        >
          {labels.cancel}
        </Button>
        <Button
          disabled={isPending}
          pending={isPending}
          type="submit"
        >
          {isPending ? pendingLabel : labels.save}
        </Button>
      </div>
    </form>
  );
}
