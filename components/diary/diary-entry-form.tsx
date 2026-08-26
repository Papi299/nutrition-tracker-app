"use client";

import {
  useActionState,
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type MouseEvent,
  type ReactNode,
} from "react";
import { AuthStatusNote } from "@/components/auth/auth-status-note";
import type {
  DiaryEntryActionState,
  DiaryEntryActionStatus,
  DiaryEntryFieldName,
  DiaryEntryFieldValues,
} from "@/app/[locale]/(app)/today/action-state";

type FieldErrorMessages = Partial<Record<string, string>>;

type MealTypeOption = {
  label: string;
  value: string;
};

type VisibleFieldName = Exclude<
  DiaryEntryFieldName,
  "expected_version" | "food_id" | "id" | "idempotency_key"
>;

type FieldLabels = Record<VisibleFieldName, string>;

type FieldHelpText = Partial<Record<VisibleFieldName, string>>;

type SectionLabels = {
  foodDetails: string;
  mealDate: string;
  notes: string;
  nutrition: string;
  serving: string;
  submit: string;
};

const persistedDraftFieldNames = [
  "brand_name",
  "calories",
  "carbohydrates_g",
  "entry_date",
  "fat_g",
  "food_id",
  "food_name",
  "meal_type",
  "notes",
  "protein_g",
  "serving_quantity",
  "serving_unit",
] as const satisfies readonly DiaryEntryFieldName[];

type PersistedDiaryEntryDraft = {
  idempotencyKey: string;
  values: DiaryEntryFieldValues;
  version: 1;
};

const draftStoragePrefix = "nutrition-tracker:manual-diary-draft:v1:";
const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function pickPersistedValues(values: DiaryEntryFieldValues) {
  return persistedDraftFieldNames.reduce<DiaryEntryFieldValues>(
    (picked, field) => {
      const value = values[field];

      if (typeof value === "string") {
        picked[field] = value;
      }

      return picked;
    },
    {},
  );
}

function readFormValues(form: HTMLFormElement) {
  const formData = new FormData(form);

  return persistedDraftFieldNames.reduce<DiaryEntryFieldValues>(
    (values, field) => {
      const value = formData.get(field);

      if (typeof value === "string") {
        values[field] = value;
      }

      return values;
    },
    {},
  );
}

function parsePersistedDraft(rawValue: string | null) {
  if (!rawValue) {
    return null;
  }

  try {
    const parsed = JSON.parse(rawValue) as Partial<PersistedDiaryEntryDraft>;

    if (
      parsed.version !== 1 ||
      typeof parsed.idempotencyKey !== "string" ||
      !uuidPattern.test(parsed.idempotencyKey) ||
      !parsed.values ||
      typeof parsed.values !== "object"
    ) {
      return null;
    }

    return {
      idempotencyKey: parsed.idempotencyKey,
      values: pickPersistedValues(parsed.values),
      version: 1,
    } satisfies PersistedDiaryEntryDraft;
  } catch {
    return null;
  }
}

function persistDraft(storageKey: string, draft: PersistedDiaryEntryDraft) {
  try {
    window.sessionStorage.setItem(storageKey, JSON.stringify(draft));
  } catch {
    // The form remains usable when browser storage is unavailable.
  }
}

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
  draftScope,
  fieldHelpText,
  fieldErrorMessages,
  initialState,
  initialIdempotencyKey,
  labels,
  mealTypeOptions,
  newDraftLabel,
  optionalLabel,
  permalink,
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
  draftScope: string;
  fieldHelpText: FieldHelpText;
  fieldErrorMessages: FieldErrorMessages;
  initialState: DiaryEntryActionState;
  initialIdempotencyKey: string;
  labels: FieldLabels;
  mealTypeOptions: MealTypeOption[];
  newDraftLabel: string;
  optionalLabel: string;
  permalink: string;
  pendingLabel: string;
  requiredLabel: string;
  sectionLabels: SectionLabels;
  statusMessages: Record<DiaryEntryActionStatus, string>;
  submitLabel: string;
}) {
  const [state, formAction, isPending] = useActionState(
    action,
    {
      ...initialState,
      values: {
        ...initialState.values,
        idempotency_key: initialIdempotencyKey,
      },
    },
    permalink,
  );
  const [initialValues] = useState(() =>
    pickPersistedValues(
      state.status === "success"
        ? (initialState.values ?? {})
        : (state.values ?? initialState.values ?? {}),
    ),
  );
  const storageKey = `${draftStoragePrefix}${encodeURIComponent(draftScope)}`;
  const [draft, setDraft] = useState(() => ({
    idempotencyKey:
      state.status === "success"
        ? initialIdempotencyKey
        : (state.values?.idempotency_key ?? initialIdempotencyKey),
    revision: 0,
    values: initialValues,
  }));
  const [hydrated, setHydrated] = useState(false);
  const [statusOverride, setStatusOverride] = useState<
    "idle" | "success" | null
  >(() => (state.status === "success" ? "success" : null));
  const formRef = useRef<HTMLFormElement>(null);
  const handledStateRef = useRef<DiaryEntryActionState | null>(null);

  useEffect(() => {
    let cancelled = false;
    let storedDraft: PersistedDiaryEntryDraft | null = null;

    try {
      storedDraft = parsePersistedDraft(window.sessionStorage.getItem(storageKey));
    } catch {
      storedDraft = null;
    }

    if (!storedDraft) {
      persistDraft(storageKey, {
        idempotencyKey: initialIdempotencyKey,
        values: initialValues,
        version: 1,
      });
    }

    queueMicrotask(() => {
      if (cancelled) {
        return;
      }

      if (storedDraft) {
        setDraft((current) => ({
          idempotencyKey: storedDraft.idempotencyKey,
          revision: current.revision + 1,
          values: {
            ...initialValues,
            ...storedDraft.values,
          },
        }));
      }

      setHydrated(true);
    });

    return () => {
      cancelled = true;
    };
  }, [initialIdempotencyKey, initialValues, storageKey]);

  useEffect(() => {
    const submissionKey = state.values?.idempotency_key;

    if (
      !hydrated ||
      handledStateRef.current === state ||
      typeof submissionKey !== "string" ||
      submissionKey !== draft.idempotencyKey ||
      state.status === "idle"
    ) {
      return;
    }

    handledStateRef.current = state;

    if (state.status === "success") {
      const nextDraft: PersistedDiaryEntryDraft = {
        idempotencyKey: crypto.randomUUID(),
        values: initialValues,
        version: 1,
      };
      persistDraft(storageKey, nextDraft);
      queueMicrotask(() => {
        setDraft((current) => ({
          ...nextDraft,
          revision: current.revision + 1,
        }));
        setStatusOverride("success");
      });
      return;
    }

    const retainedDraft: PersistedDiaryEntryDraft = {
      idempotencyKey: submissionKey,
      values: pickPersistedValues(state.values ?? {}),
      version: 1,
    };
    persistDraft(storageKey, retainedDraft);
    queueMicrotask(() => {
      setDraft((current) => ({
        ...retainedDraft,
        revision: current.revision + 1,
      }));
      setStatusOverride(null);
    });
  }, [draft.idempotencyKey, hydrated, initialValues, state, storageKey]);

  const stateMatchesDraft =
    state.values?.idempotency_key === draft.idempotencyKey;
  const displayStatus =
    statusOverride ?? (stateMatchesDraft ? state.status : "idle");
  const fieldErrors = stateMatchesDraft ? state.fieldErrors : undefined;
  const values = draft.values;
  const statusTone = getStatusTone(displayStatus);
  function persistCurrentForm(form: HTMLFormElement) {
    persistDraft(storageKey, {
      idempotencyKey: draft.idempotencyKey,
      values: readFormValues(form),
      version: 1,
    });

    if (statusOverride === "success") {
      setStatusOverride("idle");
    }
  }

  function handleFormEvent(event: FormEvent<HTMLFormElement>) {
    persistCurrentForm(event.currentTarget);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    persistCurrentForm(event.currentTarget);
    setStatusOverride(null);
  }

  function startNewDraft(event: MouseEvent<HTMLButtonElement>) {
    event.preventDefault();
    const nextDraft: PersistedDiaryEntryDraft = {
      idempotencyKey: crypto.randomUUID(),
      values: formRef.current
        ? readFormValues(formRef.current)
        : draft.values,
      version: 1,
    };
    persistDraft(storageKey, nextDraft);
    setDraft((current) => ({
      ...nextDraft,
      revision: current.revision + 1,
    }));
    setStatusOverride("idle");
  }

  return (
    <form
      action={formAction}
      className="grid gap-5 text-start"
      data-draft-storage-key={storageKey}
      data-testid="manual-diary-entry-form"
      key={`${draft.idempotencyKey}:${draft.revision}`}
      noValidate
      onChange={handleFormEvent}
      onInput={handleFormEvent}
      onSubmit={handleSubmit}
      ref={formRef}
    >
      <input
        data-testid="manual-diary-idempotency-key"
        name="idempotency_key"
        type="hidden"
        value={draft.idempotencyKey}
      />
      <input
        disabled={hydrated}
        name="native_submission"
        type="hidden"
        value="1"
      />
      {values.food_id && (
        <input name="food_id" type="hidden" value={values.food_id} />
      )}
      <FormSection title={sectionLabels.mealDate}>
        <div className="grid gap-4 sm:grid-cols-2">
          <TextInput
            error={fieldErrors?.entry_date}
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
              aria-invalid={Boolean(fieldErrors?.meal_type)}
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
              code={fieldErrors?.meal_type}
              messages={fieldErrorMessages}
            />
          </label>
        </div>
      </FormSection>

      <FormSection title={sectionLabels.foodDetails}>
        <div className="grid gap-4 sm:grid-cols-2">
          <TextInput
            error={fieldErrors?.food_name}
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
            error={fieldErrors?.brand_name}
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
            error={fieldErrors?.serving_quantity}
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
            error={fieldErrors?.serving_unit}
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
            error={fieldErrors?.calories}
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
            error={fieldErrors?.protein_g}
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
            error={fieldErrors?.carbohydrates_g}
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
            error={fieldErrors?.fat_g}
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
            aria-invalid={Boolean(fieldErrors?.notes)}
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
            code={fieldErrors?.notes}
            messages={fieldErrorMessages}
          />
        </label>
      </FormSection>

      <FormSection title={sectionLabels.submit}>
        <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
          <div>
            <AuthStatusNote tone={statusTone}>
              {statusMessages[displayStatus]}
            </AuthStatusNote>
          </div>

          <div className="flex flex-wrap gap-3 sm:justify-end">
            {displayStatus === "conflict" && (
              <button
                className="min-h-12 border border-teal-700 bg-white px-4 text-base font-semibold text-teal-800 transition-colors hover:bg-teal-50"
                disabled={isPending}
                name="submission_intent"
                onClick={startNewDraft}
                type="submit"
                value="start_new"
              >
                {newDraftLabel}
              </button>
            )}
            <button
              className="min-h-12 bg-teal-700 px-4 text-base font-semibold text-white transition-colors hover:bg-teal-800 disabled:cursor-wait disabled:bg-slate-300 disabled:text-slate-600"
              disabled={isPending}
              type="submit"
            >
              {isPending ? pendingLabel : submitLabel}
            </button>
          </div>
        </div>
      </FormSection>
    </form>
  );
}
