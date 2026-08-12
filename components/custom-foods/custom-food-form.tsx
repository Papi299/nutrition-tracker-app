"use client";

import Link from "next/link";
import {
  useActionState,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";
import { useTranslations } from "next-intl";
import type {
  CustomFoodActionState,
  CustomFoodFormValues,
} from "@/app/[locale]/(app)/foods/custom/action-state";
import type {
  CustomFoodEditorAlias,
  CustomFoodNutrientBasis,
  CustomFoodNutrientCode,
  CustomFoodNutrientDefinition,
} from "@/lib/custom-foods";
import { customFoodNutrientCodes } from "@/lib/custom-foods/validation";
import type { Locale } from "@/lib/i18n/routing";
import type { DiaryEntryMealType } from "@/lib/diary-entries";

const coreCodes = new Set<CustomFoodNutrientCode>([
  "energy_kcal",
  "protein_g",
  "carbohydrates_g",
  "fat_g",
]);

type PersistedCustomFoodCreationDraft = {
  barcodeOmitted: boolean;
  idempotencyKey: string;
  values: CustomFoodFormValues;
  version: 1;
};

const customFoodDraftStoragePrefix =
  "nutrition-tracker:custom-food-creation-draft:v1:";
const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const localeValues = new Set(["en", "he", "und"]);
const basisValues = new Set(["per_serving", "per_100g", "per_100ml"]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function boundedString(value: unknown, maximumLength: number) {
  return typeof value === "string" && value.length <= maximumLength
    ? value
    : null;
}

function parseDraftValues(value: unknown): CustomFoodFormValues | null {
  if (!isRecord(value)) return null;

  const name = boundedString(value.name, 200);
  const brandName = boundedString(value.brand_name, 120);
  const foodLocale = boundedString(value.food_locale, 3);
  const nutrientBasis = boundedString(value.nutrient_basis, 20);
  const servingQuantity = boundedString(value.serving_quantity, 64);
  const servingUnit = boundedString(value.serving_unit, 40);

  if (
    name === null ||
    brandName === null ||
    foodLocale === null ||
    !localeValues.has(foodLocale) ||
    nutrientBasis === null ||
    !basisValues.has(nutrientBasis) ||
    servingQuantity === null ||
    servingUnit === null ||
    !isRecord(value.nutrients) ||
    !Array.isArray(value.aliases) ||
    value.aliases.length > 20
  ) {
    return null;
  }

  const nutrients = {} as Record<CustomFoodNutrientCode, string>;
  for (const code of Object.keys(value.nutrients)) {
    if (!customFoodNutrientCodes.includes(code as CustomFoodNutrientCode)) {
      return null;
    }
  }
  for (const code of customFoodNutrientCodes) {
    const amount = boundedString(value.nutrients[code], 64);
    if (amount === null) return null;
    nutrients[code] = amount;
  }

  const aliases: CustomFoodEditorAlias[] = [];
  for (const alias of value.aliases) {
    if (!isRecord(alias)) return null;
    const aliasText = boundedString(alias.alias_text, 200);
    const languageCode = boundedString(alias.language_code, 3);
    if (
      aliasText === null ||
      languageCode === null ||
      !localeValues.has(languageCode)
    ) {
      return null;
    }
    aliases.push({
      alias_text: aliasText,
      language_code: languageCode as CustomFoodEditorAlias["language_code"],
    });
  }

  return {
    aliases,
    brand_name: brandName,
    food_id: "",
    food_locale: foodLocale,
    name,
    nutrient_basis: nutrientBasis,
    nutrients,
    serving_quantity: servingQuantity,
    serving_unit: servingUnit,
  };
}

function parsePersistedDraft(rawValue: string | null) {
  if (!rawValue) return null;

  try {
    const parsed = JSON.parse(
      rawValue,
    ) as Partial<PersistedCustomFoodCreationDraft>;
    const values = parseDraftValues(parsed.values);

    if (
      parsed.version !== 1 ||
      typeof parsed.idempotencyKey !== "string" ||
      !uuidPattern.test(parsed.idempotencyKey) ||
      typeof parsed.barcodeOmitted !== "boolean" ||
      !values
    ) {
      return null;
    }

    return {
      barcodeOmitted: parsed.barcodeOmitted,
      idempotencyKey: parsed.idempotencyKey,
      values,
      version: 1,
    } satisfies PersistedCustomFoodCreationDraft;
  } catch {
    return null;
  }
}

function persistDraft(
  storageKey: string,
  draft: PersistedCustomFoodCreationDraft,
) {
  try {
    window.sessionStorage.setItem(storageKey, JSON.stringify(draft));
  } catch {
    // Creation remains usable when tab-scoped browser storage is unavailable.
  }
}

function readDraftValues(form: HTMLFormElement) {
  const data = new FormData(form);
  const nutrients = {} as Record<CustomFoodNutrientCode, string>;
  for (const code of customFoodNutrientCodes) {
    const value = data.get(`nutrient_${code}`);
    nutrients[code] = typeof value === "string" ? value.slice(0, 64) : "";
  }

  const countValue = Number(data.get("alias_count"));
  const aliasCount = Number.isSafeInteger(countValue)
    ? Math.max(0, Math.min(countValue, 20))
    : 0;
  const aliases: CustomFoodEditorAlias[] = [];
  for (let index = 0; index < aliasCount; index += 1) {
    const aliasText = data.get(`alias_text_${index}`);
    const languageCode = data.get(`alias_language_${index}`);
    aliases.push({
      alias_text:
        typeof aliasText === "string" ? aliasText.slice(0, 200) : "",
      language_code: localeValues.has(String(languageCode))
        ? (languageCode as CustomFoodEditorAlias["language_code"])
        : "und",
    });
  }

  const read = (name: string, maximumLength: number) => {
    const value = data.get(name);
    return typeof value === "string" ? value.slice(0, maximumLength) : "";
  };

  return {
    aliases,
    brand_name: read("brand_name", 120),
    food_id: "",
    food_locale: read("food_locale", 3),
    name: read("name", 200),
    nutrient_basis: read("nutrient_basis", 20),
    nutrients,
    serving_quantity: read("serving_quantity", 64),
    serving_unit: read("serving_unit", 40),
  } satisfies CustomFoodFormValues;
}

export function CustomFoodCreationDraftRetirement({
  creationRequest,
}: {
  creationRequest: string;
}) {
  useEffect(() => {
    if (!uuidPattern.test(creationRequest)) return;

    try {
      for (
        let index = window.sessionStorage.length - 1;
        index >= 0;
        index -= 1
      ) {
        const key = window.sessionStorage.key(index);
        if (!key?.startsWith(customFoodDraftStoragePrefix)) continue;
        const draft = parsePersistedDraft(window.sessionStorage.getItem(key));
        if (draft?.idempotencyKey === creationRequest) {
          window.sessionStorage.removeItem(key);
        }
      }
    } catch {
      // Successful persistence does not depend on browser storage cleanup.
    }

    const currentUrl = new URL(window.location.href);
    if (currentUrl.searchParams.get("creationRequest") === creationRequest) {
      currentUrl.searchParams.delete("creationRequest");
      window.history.replaceState(
        window.history.state,
        "",
        `${currentUrl.pathname}${currentUrl.search}${currentUrl.hash}`,
      );
    }
  }, [creationRequest]);

  return null;
}

function fieldErrorId(field: string) {
  return `custom-food-${field}-error`;
}

function FieldError({ code, field }: { code?: string; field: string }) {
  const t = useTranslations("CustomFoodEditor.errors");

  if (!code) {
    return null;
  }

  const messages: Record<string, string> = {
    blank_alias: t("aliasBlank"),
    duplicate_alias: t("aliasDuplicate"),
    invalid_input: t("validation"),
    invalid_link: t("invalidLink"),
    invalid_number: t("invalidNumber"),
    invalid_type: t("validation"),
    negative_amount: t("negativeNumber"),
    positive_finite_required: t("servingQuantity"),
    required: t("required"),
    too_long: t("tooLong"),
    too_many: t("aliasTooMany"),
    unsupported_basis: t("invalidBasis"),
    unsupported_field: t("validation"),
    unsupported_language: t("invalidLanguage"),
    unsupported_locale: t("invalidLanguage"),
  };

  return (
    <span className="text-sm font-normal text-red-700" id={fieldErrorId(field)}>
      {messages[code] ?? t("validation")}
    </span>
  );
}

function NutrientInput({
  definition,
  error,
  locale,
  value,
}: {
  definition: CustomFoodNutrientDefinition;
  error?: string;
  locale: Locale;
  value: string;
}) {
  const name = locale === "he" ? definition.name_he || definition.name_en : definition.name_en;
  const field = `nutrient_${definition.code}`;

  return (
    <label className="grid gap-2 text-sm font-medium text-slate-900">
      <span>
        {name} <span className="font-normal text-slate-600">({definition.unit})</span>
      </span>
      <input
        aria-describedby={error ? fieldErrorId(field) : undefined}
        aria-invalid={Boolean(error)}
        className="min-h-11 border border-slate-300 bg-white px-3 text-base text-slate-950 outline-none transition-colors focus:border-teal-700"
        data-nutrient-code={definition.code}
        defaultValue={value}
        inputMode="decimal"
        min="0"
        name={field}
        key={value}
        step="any"
        type="number"
      />
      <FieldError code={error} field={field} />
    </label>
  );
}

function NutrientGrid({
  definitions,
  fieldErrors,
  locale,
  values,
}: {
  definitions: CustomFoodNutrientDefinition[];
  fieldErrors: Record<string, string>;
  locale: Locale;
  values: CustomFoodFormValues["nutrients"];
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {definitions.map((definition) => (
        <NutrientInput
          definition={definition}
          error={fieldErrors[`nutrient_${definition.code}`]}
          key={definition.code}
          locale={locale}
          value={values[definition.code]}
        />
      ))}
    </div>
  );
}

function AliasEditor({
  fieldErrors,
  initialAliases,
}: {
  fieldErrors: Record<string, string>;
  initialAliases: CustomFoodEditorAlias[];
}) {
  const t = useTranslations("CustomFoodEditor");
  const [aliases, setAliases] = useState(initialAliases);

  function updateAlias(index: number, update: Partial<CustomFoodEditorAlias>) {
    setAliases((current) =>
      current.map((alias, aliasIndex) =>
        aliasIndex === index ? { ...alias, ...update } : alias,
      ),
    );
  }

  return (
    <div className="grid gap-4">
      <input name="alias_count" type="hidden" value={aliases.length} />
      {aliases.map((alias, index) => {
        const textField = `alias_text_${index}`;
        const languageField = `alias_language_${index}`;

        return (
          <fieldset
            className="grid gap-4 border border-slate-200 p-4 sm:grid-cols-[1fr_13rem_auto] sm:items-end"
            data-testid="custom-food-alias-row"
            key={index}
          >
            <legend className="sr-only">{t("aliases.row", { number: index + 1 })}</legend>
            <label className="grid gap-2 text-sm font-medium text-slate-900">
              <span>{t("aliases.textLabel")}</span>
              <input
                aria-describedby={fieldErrors[textField] ? fieldErrorId(textField) : undefined}
                aria-invalid={Boolean(fieldErrors[textField])}
                className="min-h-11 border border-slate-300 bg-white px-3 text-base text-slate-950 outline-none transition-colors focus:border-teal-700"
                dir="auto"
                maxLength={200}
                name={textField}
                onChange={(event) => updateAlias(index, { alias_text: event.target.value })}
                type="text"
                value={alias.alias_text}
              />
              <FieldError code={fieldErrors[textField]} field={textField} />
            </label>
            <label className="grid gap-2 text-sm font-medium text-slate-900">
              <span>{t("aliases.languageLabel")}</span>
              <select
                aria-describedby={fieldErrors[languageField] ? fieldErrorId(languageField) : undefined}
                aria-invalid={Boolean(fieldErrors[languageField])}
                className="min-h-11 border border-slate-300 bg-white px-3 text-base text-slate-950 outline-none transition-colors focus:border-teal-700"
                name={languageField}
                onChange={(event) =>
                  updateAlias(index, {
                    language_code: event.target.value as CustomFoodEditorAlias["language_code"],
                  })
                }
                value={alias.language_code}
              >
                <option value="en">{t("languages.en")}</option>
                <option value="he">{t("languages.he")}</option>
                <option value="und">{t("languages.und")}</option>
              </select>
              <FieldError code={fieldErrors[languageField]} field={languageField} />
            </label>
            <button
              className="min-h-11 border border-red-300 bg-white px-4 text-sm font-semibold text-red-800 hover:border-red-600"
              onClick={() => setAliases((current) => current.filter((_, aliasIndex) => aliasIndex !== index))}
              type="button"
            >
              {t("aliases.remove")}
            </button>
          </fieldset>
        );
      })}
      <button
        className="min-h-11 w-fit border border-teal-700 bg-white px-4 text-sm font-semibold text-teal-800 disabled:cursor-not-allowed disabled:border-slate-300 disabled:text-slate-500"
        disabled={aliases.length >= 20}
        onClick={() =>
          setAliases((current) => [
            ...current,
            { alias_text: "", language_code: "und" },
          ])
        }
        type="button"
      >
        {t("aliases.add")}
      </button>
      <FieldError code={fieldErrors.aliases} field="aliases" />
      <p className="text-sm leading-6 text-slate-600">
        {t("aliases.count", { count: aliases.length })}
      </p>
    </div>
  );
}

export function CustomFoodForm({
  action,
  archived,
  barcodeContext,
  dictionary,
  draftScope,
  initialCreationKey,
  initialState,
  locale,
  mode,
  saved,
}: {
  action: (
    state: CustomFoodActionState,
    formData: FormData,
  ) => Promise<CustomFoodActionState>;
  archived: boolean;
  barcodeContext?: {
    canonicalGtin: string;
    date: string;
    mealType: DiaryEntryMealType | null;
  };
  dictionary: CustomFoodNutrientDefinition[];
  draftScope?: string;
  initialCreationKey?: string;
  initialState: CustomFoodActionState;
  locale: Locale;
  mode: "create" | "edit";
  saved: "created" | "updated" | null;
}) {
  const t = useTranslations("CustomFoodEditor");
  const creationDraftEnabled =
    mode === "create" &&
    typeof draftScope === "string" &&
    typeof initialCreationKey === "string";
  const [initialValues] = useState(initialState.values);
  const storageKey = creationDraftEnabled
    ? `${customFoodDraftStoragePrefix}${encodeURIComponent(draftScope)}`
    : null;
  const [draft, setDraft] = useState(() => ({
    barcodeOmitted: initialState.barcode_omitted ?? false,
    idempotencyKey: initialCreationKey ?? "",
    revision: 0,
    values: initialValues,
  }));
  const [state, formAction, isPending] = useActionState(action, {
    ...initialState,
    values: creationDraftEnabled
      ? { ...initialState.values, creation_key: initialCreationKey }
      : initialState.values,
  });
  const [hydrated, setHydrated] = useState(!creationDraftEnabled);
  const [basis, setBasis] = useState<CustomFoodNutrientBasis>(
    initialValues.nutrient_basis as CustomFoodNutrientBasis,
  );
  const formRef = useRef<HTMLFormElement>(null);
  const handledStateRef = useRef<CustomFoodActionState | null>(null);

  useEffect(() => {
    if (!creationDraftEnabled || !storageKey || !initialCreationKey) return;

    let storedDraft: PersistedCustomFoodCreationDraft | null = null;
    try {
      storedDraft = parsePersistedDraft(
        window.sessionStorage.getItem(storageKey),
      );
    } catch {
      storedDraft = null;
    }

    if (!storedDraft) {
      persistDraft(storageKey, {
        barcodeOmitted: initialState.barcode_omitted ?? false,
        idempotencyKey: initialCreationKey,
        values: initialValues,
        version: 1,
      });
    }

    queueMicrotask(() => {
      if (storedDraft) {
        setDraft((current) => ({
          ...storedDraft,
          revision: current.revision + 1,
        }));
        setBasis(
          storedDraft.values.nutrient_basis as CustomFoodNutrientBasis,
        );
      }
      setHydrated(true);
    });
  }, [
    creationDraftEnabled,
    initialCreationKey,
    initialState.barcode_omitted,
    initialValues,
    storageKey,
  ]);

  useEffect(() => {
    const submissionKey = state.values.creation_key;
    if (
      !creationDraftEnabled ||
      !hydrated ||
      !storageKey ||
      handledStateRef.current === state ||
      typeof submissionKey !== "string" ||
      submissionKey !== draft.idempotencyKey ||
      state.status === "idle"
    ) {
      return;
    }

    const retainedValues = parseDraftValues(state.values);
    if (!retainedValues) return;

    handledStateRef.current = state;
    const retainedDraft: PersistedCustomFoodCreationDraft = {
      barcodeOmitted: state.barcode_omitted ?? draft.barcodeOmitted,
      idempotencyKey: submissionKey,
      values: retainedValues,
      version: 1,
    };
    persistDraft(storageKey, retainedDraft);
    queueMicrotask(() => {
      setDraft((current) => ({
        ...retainedDraft,
        revision: current.revision + 1,
      }));
      setBasis(
        retainedValues.nutrient_basis as CustomFoodNutrientBasis,
      );
    });
  }, [
    creationDraftEnabled,
    draft.barcodeOmitted,
    draft.idempotencyKey,
    hydrated,
    state,
    storageKey,
  ]);

  const stateMatchesDraft =
    !creationDraftEnabled ||
    state.values.creation_key === draft.idempotencyKey;
  const displayStatus = stateMatchesDraft ? state.status : "idle";
  const fieldErrors = stateMatchesDraft ? (state.fieldErrors ?? {}) : {};
  const values = creationDraftEnabled ? draft.values : state.values;
  const core = dictionary.filter((definition) => coreCodes.has(definition.code));
  const additional = dictionary.filter(
    (definition) =>
      !coreCodes.has(definition.code) &&
      (definition.nutrient_group === "macro" || definition.nutrient_group === "other"),
  );
  const minerals = dictionary.filter(
    (definition) => definition.nutrient_group === "mineral",
  );
  const vitamins = dictionary.filter(
    (definition) => definition.nutrient_group === "vitamin",
  );
  const statusMessage = {
    ambiguous: t("barcode.status.ambiguous"),
    archived_or_unavailable: t("barcode.status.unavailable"),
    conflict: t("status.conflict"),
    creation_idempotency_conflict: t("status.creationConflict"),
    database_error: t("status.databaseError"),
    idle: t("status.idle"),
    not_found: t("status.notFound"),
    owned_archived: t("barcode.status.ownedArchived"),
    owned_existing: t("barcode.status.ownedExisting"),
    public_existing: t("barcode.status.publicExisting"),
    unauthenticated: t("status.unauthenticated"),
    validation_error: t("status.validationError"),
  }[displayStatus];
  const conflictFoodId = state.conflict_food_id;
  const reviewQuery = barcodeContext && conflictFoodId
    ? new URLSearchParams({
        date: barcodeContext.date,
        foodId: conflictFoodId,
        ...(barcodeContext.mealType
          ? { mealType: barcodeContext.mealType }
          : {}),
      })
    : null;

  function persistCurrentDraft(form: HTMLFormElement) {
    if (!creationDraftEnabled || !storageKey) return;

    persistDraft(storageKey, {
      barcodeOmitted: new FormData(form).get("omit_barcode") === "omit",
      idempotencyKey: draft.idempotencyKey,
      values: readDraftValues(form),
      version: 1,
    });
  }

  function handleFormEvent(event: FormEvent<HTMLFormElement>) {
    if (
      event.type === "submit" &&
      creationDraftEnabled &&
      !hydrated
    ) {
      event.preventDefault();
      return;
    }

    persistCurrentDraft(event.currentTarget);
  }

  function startNewCreationIntent() {
    if (!creationDraftEnabled || !storageKey) return;

    const nextValues = formRef.current
      ? readDraftValues(formRef.current)
      : draft.values;
    const nextDraft: PersistedCustomFoodCreationDraft = {
      barcodeOmitted: formRef.current
        ? new FormData(formRef.current).get("omit_barcode") === "omit"
        : draft.barcodeOmitted,
      idempotencyKey: crypto.randomUUID(),
      values: nextValues,
      version: 1,
    };
    persistDraft(storageKey, nextDraft);
    setDraft((current) => ({
      ...nextDraft,
      revision: current.revision + 1,
    }));
    setBasis(nextValues.nutrient_basis as CustomFoodNutrientBasis);
  }

  return (
    <form
      action={formAction}
      className="grid gap-8 text-start"
      data-draft-storage-key={storageKey ?? undefined}
      data-testid="custom-food-form"
      key={
        creationDraftEnabled
          ? `${draft.idempotencyKey}:${draft.revision}`
          : undefined
      }
      noValidate
      onChange={handleFormEvent}
      onInput={handleFormEvent}
      onSubmit={handleFormEvent}
      ref={formRef}
    >
      <input name="food_id" type="hidden" value={values.food_id} />
      {creationDraftEnabled && (
        <input
          data-testid="custom-food-creation-key"
          name="creation_key"
          type="hidden"
          value={draft.idempotencyKey}
        />
      )}

      {barcodeContext && (
        <section
          aria-labelledby="custom-food-barcode-context-title"
          className="grid gap-4 border border-teal-200 bg-teal-50 p-5"
          data-testid="custom-food-barcode-context"
        >
          <div>
            <h2
              className="text-xl font-semibold text-slate-950"
              id="custom-food-barcode-context-title"
            >
              {t("barcode.title")}
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-700">
              {t("barcode.description")}
            </p>
            <p className="mt-2 text-sm leading-6 text-slate-700">
              {t("barcode.privacy")}
            </p>
          </div>
          <dl className="grid gap-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="font-medium text-slate-600">{t("barcode.gtin")}</dt>
              <dd
                className="mt-1 font-mono text-slate-950"
                data-testid="custom-food-canonical-gtin"
                dir="ltr"
              >
                {barcodeContext.canonicalGtin}
              </dd>
            </div>
            <div>
              <dt className="font-medium text-slate-600">{t("barcode.date")}</dt>
              <dd className="mt-1 text-slate-950">{barcodeContext.date}</dd>
            </div>
            {barcodeContext.mealType && (
              <div>
                <dt className="font-medium text-slate-600">
                  {t("barcode.meal")}
                </dt>
                <dd className="mt-1 text-slate-950">
                  {t(`barcode.mealTypes.${barcodeContext.mealType}`)}
                </dd>
              </div>
            )}
          </dl>
          <label className="flex min-h-11 items-start gap-3 border border-teal-300 bg-white p-4 text-sm leading-6 text-slate-900">
            <input
              defaultChecked={
                creationDraftEnabled
                  ? draft.barcodeOmitted
                  : (state.barcode_omitted ?? false)
              }
              key={String(
                creationDraftEnabled
                  ? draft.barcodeOmitted
                  : (state.barcode_omitted ?? false),
              )}
              className="mt-1"
              name="omit_barcode"
              type="checkbox"
              value="omit"
            />
            <span>{t("barcode.omit")}</span>
          </label>
          <FieldError
            code={fieldErrors.barcode_omission}
            field="barcode_omission"
          />
        </section>
      )}

      {saved && (
        <div
          className="border-s-4 border-teal-600 bg-teal-50 px-4 py-3 text-sm text-teal-900"
          data-testid="custom-food-success"
          role="status"
        >
          {saved === "created" ? t("status.created") : t("status.updated")}
        </div>
      )}

      {archived && (
        <div
          className="border-s-4 border-amber-500 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-950"
          data-testid="custom-food-archived-notice"
          role="status"
        >
          {t("archivedNotice")}
        </div>
      )}

      {mode === "edit" && displayStatus === "conflict" && (
        <section
          className="grid gap-3 border-s-4 border-amber-500 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-950"
          data-testid="custom-food-edit-conflict"
        >
          <p role="alert">{t("status.conflict")}</p>
          <a
            className="w-fit font-semibold text-teal-800 underline"
            href={`/${locale}/foods/custom/${values.food_id}/edit`}
          >
            {t("status.reloadCurrent")}
          </a>
        </section>
      )}

      {mode === "create" &&
        displayStatus === "creation_idempotency_conflict" && (
          <section
            className="grid gap-3 border-s-4 border-amber-500 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-950"
            data-testid="custom-food-creation-conflict"
          >
            <p role="alert">{t("status.creationConflict")}</p>
            <button
              className="min-h-11 w-fit border border-teal-700 bg-white px-4 text-sm font-semibold text-teal-800"
              onClick={startNewCreationIntent}
              type="button"
            >
              {t("status.startNewCreation")}
            </button>
          </section>
        )}

      {barcodeContext && displayStatus === "owned_existing" && conflictFoodId && (
        <div className="flex flex-wrap gap-3" data-testid="barcode-save-owned-conflict">
          <Link
            className="min-h-11 bg-teal-700 px-4 py-3 text-sm font-semibold text-white"
            href={`/${locale}/foods/custom/${conflictFoodId}/edit`}
          >
            {t("barcode.actions.editOwned")}
          </Link>
          {reviewQuery && (
            <Link
              className="min-h-11 border border-teal-700 bg-white px-4 py-3 text-sm font-semibold text-teal-800"
              href={`/${locale}/today?${reviewQuery.toString()}`}
            >
              {t("barcode.actions.review")}
            </Link>
          )}
        </div>
      )}

      {barcodeContext && displayStatus === "owned_archived" && conflictFoodId && (
        <div className="flex flex-wrap gap-3" data-testid="barcode-save-archived-conflict">
          <Link
            className="min-h-11 bg-teal-700 px-4 py-3 text-sm font-semibold text-white"
            href={`/${locale}/foods/custom/${conflictFoodId}/edit`}
          >
            {t("barcode.actions.openArchived")}
          </Link>
        </div>
      )}

      {barcodeContext && displayStatus === "public_existing" && conflictFoodId && (
        <div className="flex flex-wrap gap-3" data-testid="barcode-save-public-conflict">
          {reviewQuery && (
            <Link
              className="min-h-11 bg-teal-700 px-4 py-3 text-sm font-semibold text-white"
              href={`/${locale}/today?${reviewQuery.toString()}`}
            >
              {t("barcode.actions.review")}
            </Link>
          )}
          <Link
            className="min-h-11 border border-teal-700 bg-white px-4 py-3 text-sm font-semibold text-teal-800"
            href={`/${locale}/foods/barcode?${new URLSearchParams({
              code: barcodeContext.canonicalGtin,
              date: barcodeContext.date,
              ...(barcodeContext.mealType
                ? { mealType: barcodeContext.mealType }
                : {}),
            }).toString()}`}
          >
            {t("barcode.actions.backToLookup")}
          </Link>
        </div>
      )}

      <section className="grid gap-5" aria-labelledby="custom-food-identity-title">
        <div>
          <h2 className="text-xl font-semibold text-slate-950" id="custom-food-identity-title">
            {t("identity.title")}
          </h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">{t("identity.help")}</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="grid gap-2 text-sm font-medium text-slate-900 sm:col-span-2">
            <span>{t("identity.name")}</span>
            <input
              aria-describedby={fieldErrors.name ? fieldErrorId("name") : undefined}
              aria-invalid={Boolean(fieldErrors.name)}
              className="min-h-12 border border-slate-300 bg-white px-3 text-base text-slate-950 outline-none focus:border-teal-700"
              defaultValue={values.name}
              dir="auto"
              maxLength={200}
              name="name"
              key={values.name}
              required
              type="text"
            />
            <FieldError code={fieldErrors.name} field="name" />
          </label>
          <label className="grid gap-2 text-sm font-medium text-slate-900">
            <span>{t("identity.brand")}</span>
            <input
              aria-describedby={fieldErrors.brand_name ? fieldErrorId("brand_name") : undefined}
              aria-invalid={Boolean(fieldErrors.brand_name)}
              className="min-h-12 border border-slate-300 bg-white px-3 text-base text-slate-950 outline-none focus:border-teal-700"
              defaultValue={values.brand_name}
              dir="auto"
              maxLength={120}
              name="brand_name"
              key={values.brand_name}
              type="text"
            />
            <FieldError code={fieldErrors.brand_name} field="brand_name" />
          </label>
          <label className="grid gap-2 text-sm font-medium text-slate-900">
            <span>{t("identity.language")}</span>
            <select
              aria-describedby={fieldErrors.food_locale ? fieldErrorId("food_locale") : undefined}
              aria-invalid={Boolean(fieldErrors.food_locale)}
              className="min-h-12 border border-slate-300 bg-white px-3 text-base text-slate-950 outline-none focus:border-teal-700"
              defaultValue={values.food_locale}
              key={values.food_locale}
              name="food_locale"
            >
              <option value="en">{t("languages.en")}</option>
              <option value="he">{t("languages.he")}</option>
              <option value="und">{t("languages.und")}</option>
            </select>
            <FieldError code={fieldErrors.food_locale} field="food_locale" />
          </label>
        </div>
      </section>

      <fieldset className="grid gap-5 border-t border-slate-200 pt-6">
        <legend className="text-xl font-semibold text-slate-950">{t("basis.title")}</legend>
        <p className="text-sm leading-6 text-slate-600">{t("basis.help")}</p>
        <div className="grid gap-3 sm:grid-cols-3">
          {(["per_serving", "per_100g", "per_100ml"] as const).map((value) => (
            <label className="flex min-h-12 items-center gap-3 border border-slate-300 bg-white px-4 text-sm font-medium" key={value}>
              <input
                checked={basis === value}
                name="nutrient_basis"
                onChange={() => setBasis(value)}
                type="radio"
                value={value}
              />
              {t(`basis.options.${value}`)}
            </label>
          ))}
        </div>
        <FieldError code={fieldErrors.nutrient_basis} field="nutrient_basis" />
        <p className="border-s-4 border-amber-500 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-950">
          {t("basis.warning")}
        </p>
        {basis === "per_serving" ? (
          <div className="grid gap-4 sm:grid-cols-2" data-testid="custom-food-serving-fields">
            <label className="grid gap-2 text-sm font-medium text-slate-900">
              <span>{t("basis.servingQuantity")}</span>
              <input
                aria-describedby={fieldErrors.serving_quantity ? fieldErrorId("serving_quantity") : undefined}
                aria-invalid={Boolean(fieldErrors.serving_quantity)}
                className="min-h-12 border border-slate-300 bg-white px-3 text-base text-slate-950 outline-none focus:border-teal-700"
                defaultValue={values.serving_quantity}
                inputMode="decimal"
                min="0"
                name="serving_quantity"
                key={values.serving_quantity}
                required
                step="any"
                type="number"
              />
              <FieldError code={fieldErrors.serving_quantity} field="serving_quantity" />
            </label>
            <label className="grid gap-2 text-sm font-medium text-slate-900">
              <span>{t("basis.servingUnit")}</span>
              <input
                aria-describedby={fieldErrors.serving_unit ? fieldErrorId("serving_unit") : undefined}
                aria-invalid={Boolean(fieldErrors.serving_unit)}
                className="min-h-12 border border-slate-300 bg-white px-3 text-base text-slate-950 outline-none focus:border-teal-700"
                defaultValue={values.serving_unit}
                dir="auto"
                maxLength={40}
                name="serving_unit"
                key={values.serving_unit}
                required
                type="text"
              />
              <FieldError code={fieldErrors.serving_unit} field="serving_unit" />
            </label>
          </div>
        ) : (
          <div className="border border-teal-200 bg-teal-50 p-4 text-sm text-teal-950" data-testid="custom-food-fixed-basis">
            {basis === "per_100g" ? t("basis.fixed100g") : t("basis.fixed100ml")}
          </div>
        )}
      </fieldset>

      <section className="grid gap-5 border-t border-slate-200 pt-6" aria-labelledby="custom-food-nutrients-title">
        <div>
          <h2 className="text-xl font-semibold text-slate-950" id="custom-food-nutrients-title">{t("nutrients.title")}</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600" id="custom-food-nutrients-help">{t("nutrients.help")}</p>
        </div>
        <NutrientGrid definitions={core} fieldErrors={fieldErrors} locale={locale} values={values.nutrients} />
        {[
          ["additional", additional],
          ["minerals", minerals],
          ["vitamins", vitamins],
        ].map(([group, definitions]) => (
          <details className="border border-slate-200 bg-white p-4" key={group as string}>
            <summary className="cursor-pointer text-base font-semibold text-slate-950">
              {t(`nutrients.groups.${group as string}`)}
            </summary>
            <div className="mt-5">
              <NutrientGrid
                definitions={definitions as CustomFoodNutrientDefinition[]}
                fieldErrors={fieldErrors}
                locale={locale}
                values={values.nutrients}
              />
            </div>
          </details>
        ))}
        <FieldError code={fieldErrors.nutrients} field="nutrients" />
      </section>

      <section className="grid gap-5 border-t border-slate-200 pt-6" aria-labelledby="custom-food-aliases-title">
        <div>
          <h2 className="text-xl font-semibold text-slate-950" id="custom-food-aliases-title">{t("aliases.title")}</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">{t("aliases.help")}</p>
        </div>
        <AliasEditor fieldErrors={fieldErrors} initialAliases={values.aliases} />
      </section>

      <div className="grid gap-4 border-t border-slate-200 pt-6 sm:grid-cols-[1fr_auto] sm:items-center">
        {displayStatus !== "conflict" &&
          displayStatus !== "creation_idempotency_conflict" && (
          <div
            className={
              displayStatus === "idle"
                ? "text-sm text-slate-600"
                : "text-sm text-red-800"
            }
            role={displayStatus === "idle" ? "status" : "alert"}
          >
            {statusMessage}
          </div>
        )}
        <button
          className="min-h-12 bg-teal-700 px-5 text-base font-semibold text-white hover:bg-teal-800 disabled:cursor-wait disabled:bg-slate-300 disabled:text-slate-600"
          disabled={isPending}
          type="submit"
        >
          {isPending
            ? t(mode === "create" ? "submit.createPending" : "submit.updatePending")
            : t(mode === "create" ? "submit.create" : "submit.update")}
        </button>
      </div>
      <div className="flex flex-wrap gap-4">
        <Link className="w-fit text-sm font-semibold text-teal-800 underline" href={`/${locale}/foods`}>
          {t("backToFoods")}
        </Link>
        <Link
          className="w-fit text-sm font-semibold text-teal-800 underline"
          href={`/${locale}/foods/custom?status=${archived ? "archived" : "active"}&page=1`}
        >
          {t("backToManagement")}
        </Link>
      </div>
    </form>
  );
}
