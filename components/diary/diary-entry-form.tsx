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
import { AdditionalNutrientFields } from "@/components/nutrition/additional-nutrient-fields";
import { additionalNutrientCodesV1, type AdditionalNutrientCode } from "@/lib/nutrition-snapshots";
import { AuthStatusNote } from "@/components/auth/auth-status-note";
import { Button } from "@/components/ui/button";
import { allNutrientFields, convertFoodQuantity, verifiedCatalogServing, nutrientFields, scaleAllFoodNutrients, type AllFoodNutrientReference } from "@/lib/food-selection/nutrient-scaling";
import {
  FieldDescription,
  FieldError as UIFieldError,
  FieldLabel as UIFieldLabel,
  Input,
  Select,
  Textarea,
} from "@/components/ui/form-controls";
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
  "quantity_unit" | "serving_intent" | "expected_version" | "food_id" | "id" | "idempotency_key" | `automatic_${string}` | AdditionalNutrientCode | "reference_fingerprint" | "additional_nutrients_captured" | "additional_nutrient_snapshot"
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
  ...additionalNutrientCodesV1,
  ...allNutrientFields.map(field => `automatic_${field}` as const),
  "reference_fingerprint",
  "quantity_unit",
  "additional_nutrients_captured",
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
  referenceKey?: string;
  referenceReviewRequired?: boolean;
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
      } else if (field.startsWith("automatic_")) {
        values[field] = "";
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

    const values = pickPersistedValues(parsed.values);
    values.quantity_unit ??= values.serving_unit ?? "";
    // Older drafts have intentional snapshot values but no mode provenance.
    // Preserve them as manual rather than guessing from numerical equality.
    for (const field of allNutrientFields) {
      values[`automatic_${field}`] ??= "";
      values[field] ??= "";
    }
    return {
      idempotencyKey: parsed.idempotencyKey,
      referenceReviewRequired: parsed.referenceReviewRequired === true,
      referenceKey: typeof parsed.referenceKey === "string" ? parsed.referenceKey : undefined,
      values,
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
    <span className="ui-caption font-semibold uppercase tracking-[0.12em]">
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
    <UIFieldError>
      {messages[code] ?? messages.invalid_input}
    </UIFieldError>
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
    <fieldset className="grid gap-4 border-t border-border pt-5 first:border-t-0 first:pt-0">
      <legend className="ui-card-title mb-1">
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
    <UIFieldLabel className="grid gap-2">
      <FieldLabel
        label={label}
        optionalLabel={optionalLabel}
        required={required}
        requiredLabel={requiredLabel}
      />
      <Input
        aria-invalid={Boolean(error)}
        className="min-h-12"
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
        <FieldDescription className="font-normal">
          {helpText}
        </FieldDescription>
      )}
      <FieldError code={error} messages={messages} />
    </UIFieldLabel>
  );
}

export function DiaryEntryForm({
  action,
  automaticNutrition,
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
  reference,
  requiredLabel,
  sectionLabels,
  statusMessages,
  submitLabel,
}: {
  action: (
    state: DiaryEntryActionState,
    formData: FormData,
  ) => Promise<DiaryEntryActionState>;
  automaticNutrition: { description: string; label: string; unavailable: string; referenceChanged: string; reviewRequired: string; servingEquivalence: string; resetServing: string; incompatibleDraft: string };
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
  reference?: AllFoodNutrientReference;
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
  const referenceKey = reference?.reference_fingerprint ?? "manual";
  const [draft, setDraft] = useState(() => ({
    idempotencyKey:
      state.status === "success"
        ? initialIdempotencyKey
        : (state.values?.idempotency_key ?? initialIdempotencyKey),
    revision: 0,
    values: initialValues,
  }));
  const [hydrated, setHydrated] = useState(false);
  const [scalingUnavailable, setScalingUnavailable] = useState(() => Boolean(reference && !scaleAllFoodNutrients(reference, reference.serving_quantity, reference.serving_unit).ok));
  const [referenceChanged, setReferenceChanged] = useState(false);
  const serving = reference ? verifiedCatalogServing(reference) : null;
  const [incompatibleDraft, setIncompatibleDraft] = useState(false);
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

    const changedReference = Boolean(storedDraft !== null && (storedDraft.referenceReviewRequired === true ||
      (storedDraft.referenceKey !== undefined && storedDraft.referenceKey !== referenceKey) ||
      (storedDraft.referenceKey === undefined && (allNutrientFields.some((field) => storedDraft?.values[`automatic_${field}`] === "1") ||
        (reference && verifiedCatalogServing(reference) && storedDraft.values.serving_unit?.trim().toLowerCase() === "serving")))));
    const incompatible = Boolean(storedDraft && reference &&
      (!scaleAllFoodNutrients(reference, storedDraft.values.serving_quantity, storedDraft.values.serving_unit).ok ||
        (changedReference && storedDraft.values.serving_unit?.trim().toLowerCase() === "serving")));
    if (storedDraft && changedReference) {
      for (const field of allNutrientFields) storedDraft.values[`automatic_${field}`] = "";
      storedDraft.values.reference_fingerprint = reference?.reference_fingerprint ?? "";
    }

    if (!storedDraft) {
      persistDraft(storageKey, {
        idempotencyKey: initialIdempotencyKey,
        referenceKey,
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

      setReferenceChanged(changedReference);
      setIncompatibleDraft(incompatible);
      if (storedDraft && (changedReference || incompatible)) {
        persistDraft(storageKey, { ...storedDraft, referenceKey, referenceReviewRequired: changedReference });
      }
      setHydrated(true);
    });

    return () => {
      cancelled = true;
    };
  }, [initialIdempotencyKey, initialValues, referenceKey, reference, storageKey]);

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
        referenceKey,
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
      referenceKey,
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
  }, [draft.idempotencyKey, hydrated, initialValues, referenceKey, state, storageKey]);

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
      referenceKey,
      referenceReviewRequired: referenceChanged,
      values: readFormValues(form),
      version: 1,
    });

    if (statusOverride === "success") {
      setStatusOverride("idle");
    }
  }

  function recalculate(form: HTMLFormElement) {
    if (!reference) return;
    const currentValues = readFormValues(form);
    const automaticFields = allNutrientFields.filter((field) => currentValues[`automatic_${field}`] === "1");
    const scaled = scaleAllFoodNutrients(reference, currentValues.serving_quantity, currentValues.serving_unit, automaticFields);
    setScalingUnavailable(automaticFields.length > 0 && !scaled.ok);
    if (scaled.ok) for (const field of automaticFields) {
      const input = form.elements.namedItem(field);
      if (input instanceof HTMLInputElement) input.value = scaled.values[field];
    }
  }

  function handleFormEvent(event: FormEvent<HTMLFormElement>) {
    const form = event.currentTarget;
    const target = event.target;
    if (reference && target instanceof HTMLInputElement) {
      if ((allNutrientFields as readonly string[]).includes(target.name)) {
        const mode = form.elements.namedItem(`automatic_${target.name}`);
        if (mode instanceof HTMLInputElement) mode.checked = false;
      }
      if (target.name.startsWith("automatic_") && target.checked) {
        const fingerprint = form.elements.namedItem("reference_fingerprint");
        if (fingerprint instanceof HTMLInputElement) fingerprint.value = reference.reference_fingerprint;
        setReferenceChanged(false);
      }
      if (target.name === "serving_unit") {
        if (referenceChanged) {
          setScalingUnavailable(true);
          persistCurrentForm(form);
          return;
        }
        const quantity = form.elements.namedItem("serving_quantity");
        const previous = form.elements.namedItem("quantity_unit");
        if (quantity instanceof HTMLInputElement && previous instanceof HTMLInputElement) {
          const converted = convertFoodQuantity(reference, quantity.value, previous.value, target.value);
          if (converted.ok) {
            quantity.value = converted.quantity;
            previous.value = target.value;
          } else {
            const currentValues = readFormValues(form);
            const automatic = allNutrientFields.some(field => currentValues[`automatic_${field}`] === "1");
            if (!automatic && converted.code === "incompatible_unit") previous.value = target.value;
            setScalingUnavailable(automatic || converted.code !== "incompatible_unit");
            persistCurrentForm(form);
            return;
          }
        }
      }
      if (target.name === "serving_quantity") {
        const currentUnit = form.elements.namedItem("serving_unit");
        const previous = form.elements.namedItem("quantity_unit");
        if (currentUnit instanceof HTMLInputElement && previous instanceof HTMLInputElement) previous.value = currentUnit.value;
      }
      if (target.name === "serving_quantity" || target.name === "serving_unit" || target.name.startsWith("automatic_")) {
        setIncompatibleDraft(false);
        recalculate(form);
      }
    }
    persistCurrentForm(form);
    // State updates apply after this event; persist explicit review immediately.
    if (target instanceof HTMLInputElement && target.name.startsWith("automatic_") && target.checked) {
      persistDraft(storageKey, { idempotencyKey: draft.idempotencyKey, referenceKey,
        referenceReviewRequired: false, values: readFormValues(form), version: 1 });
    }
  }

  function resetCatalogServing(event: MouseEvent<HTMLButtonElement>) {
    if (!reference || !serving || !formRef.current) return;
    event.preventDefault();
    const form = formRef.current;
    for (const [name, value] of Object.entries({ serving_quantity: "1", serving_unit: "serving", quantity_unit: "serving",
      reference_fingerprint: reference.reference_fingerprint })) {
      const input = form.elements.namedItem(name);
      if (input instanceof HTMLInputElement) input.value = value;
    }
    // Reset only the amount. Manual values (including former automatic values
    // retained after reference drift) stay manual until individually selected.
    setIncompatibleDraft(false);
    setReferenceChanged(false);
    recalculate(form);
    persistDraft(storageKey, { idempotencyKey: draft.idempotencyKey, referenceKey,
      values: readFormValues(form), version: 1 });
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    persistCurrentForm(event.currentTarget);
    setStatusOverride(null);
  }

  function startNewDraft(event: MouseEvent<HTMLButtonElement>) {
    event.preventDefault();
    const nextDraft: PersistedDiaryEntryDraft = {
      idempotencyKey: crypto.randomUUID(),
      referenceKey,
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
      {/* Enter saves/reviews the entry; it must not invoke the earlier reset control. */}
      <button aria-hidden="true" disabled={isPending} hidden tabIndex={-1} type="submit" />
      <input name="quantity_unit" type="hidden" defaultValue={values.quantity_unit ?? values.serving_unit ?? ""} />
      <input name="additional_nutrients_captured" type="hidden" value="1" />
      <input name="reference_fingerprint" type="hidden" defaultValue={values.reference_fingerprint ?? reference?.reference_fingerprint ?? ""} />
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

          <UIFieldLabel className="grid gap-2">
            <FieldLabel
              label={labels.meal_type}
              optionalLabel={optionalLabel}
              required
              requiredLabel={requiredLabel}
            />
            <Select
              aria-invalid={Boolean(fieldErrors?.meal_type)}
              className="min-h-12"
              defaultValue={values.meal_type ?? mealTypeOptions[0]?.value}
              name="meal_type"
              required
            >
              {mealTypeOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
            {fieldHelpText.meal_type && (
              <FieldDescription className="font-normal">
                {fieldHelpText.meal_type}
              </FieldDescription>
            )}
            <FieldError
              code={fieldErrors?.meal_type}
              messages={fieldErrorMessages}
            />
          </UIFieldLabel>
        </div>
      </FormSection>

      <FormSection title={sectionLabels.serving}>
        {serving && <p className="text-sm" data-testid="catalog-serving-equivalence">
          {automaticNutrition.servingEquivalence} <bdi>1 serving = {serving.quantity} {serving.unit}</bdi>
        </p>}
        {incompatibleDraft && <p className="text-sm text-danger" role="status" data-testid="incompatible-serving-draft">{automaticNutrition.incompatibleDraft}</p>}
        {serving && <Button name="serving_intent" value="reset_catalog_serving" type="submit" variant="secondary"
          disabled={isPending} onClick={resetCatalogServing}>{automaticNutrition.resetServing}</Button>}
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
        {(referenceChanged || fieldErrors?.form === "reference_changed") && <p className="text-sm text-muted-foreground" data-testid="nutrition-reference-changed" role="status">{automaticNutrition.referenceChanged}</p>}
        {fieldErrors?.form === "nutrition_review_required" && <p className="text-sm text-muted-foreground" data-testid="nutrition-review-required" role="status">{automaticNutrition.reviewRequired}</p>}
        {fieldErrors?.form !== "nutrition_review_required" && fieldErrors?.form !== "reference_changed" && <FieldError code={fieldErrors?.form} messages={fieldErrorMessages} />}
        {reference && <p className="text-sm text-muted-foreground">{automaticNutrition.description}</p>}
        {reference && scalingUnavailable && <p className="text-sm text-danger" role="status">{automaticNutrition.unavailable}</p>}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {nutrientFields.map((field) => <div className="grid content-start gap-2" key={field}>
            <TextInput error={fieldErrors?.[field]} helpText={fieldHelpText[field]}
              inputMode={field === "calories" ? "numeric" : "decimal"} label={labels[field]}
              messages={fieldErrorMessages} name={field} optionalLabel={optionalLabel}
              requiredLabel={requiredLabel} step={field === "calories" ? "1" : "any"}
              type="number" value={values[field]} />
            {reference && <label className="flex min-h-11 items-center gap-2 text-sm">
              <input defaultChecked={values[`automatic_${field}`] === "1"}
                name={`automatic_${field}`} type="checkbox" value="1" />
              <span>{automaticNutrition.label}: {labels[field]}</span>
            </label>}
          </div>)}
        </div>
        <AdditionalNutrientFields values={values} errors={fieldErrors} controlPrefix="diary-create"
          automaticValues={reference ? Object.fromEntries(additionalNutrientCodesV1.map(code => [code, values[`automatic_${code}`]])) : undefined}
          expandAll={fieldErrors?.form === "nutrition_review_required"} />
      </FormSection>

      <FormSection title={sectionLabels.notes}>
        <UIFieldLabel className="grid gap-2">
          <FieldLabel
            label={labels.notes}
            optionalLabel={optionalLabel}
            required={false}
            requiredLabel={requiredLabel}
          />
          <Textarea
            aria-invalid={Boolean(fieldErrors?.notes)}
            className="min-h-24 py-3"
            defaultValue={values.notes}
            name="notes"
          />
          {fieldHelpText.notes && (
            <FieldDescription className="font-normal">
              {fieldHelpText.notes}
            </FieldDescription>
          )}
          <FieldError
            code={fieldErrors?.notes}
            messages={fieldErrorMessages}
          />
        </UIFieldLabel>
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
              <Button
                disabled={isPending}
                name="submission_intent"
                onClick={startNewDraft}
                size="lg"
                type="submit"
                value="start_new"
                variant="outline"
              >
                {newDraftLabel}
              </Button>
            )}
            <Button
              disabled={isPending}
              pending={isPending}
              size="lg"
              type="submit"
            >
              {isPending ? pendingLabel : submitLabel}
            </Button>
          </div>
        </div>
      </FormSection>
    </form>
  );
}
