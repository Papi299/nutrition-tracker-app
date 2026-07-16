"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
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
import type { Locale } from "@/lib/i18n/routing";

const coreCodes = new Set<CustomFoodNutrientCode>([
  "energy_kcal",
  "protein_g",
  "carbohydrates_g",
  "fat_g",
]);

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
  dictionary,
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
  dictionary: CustomFoodNutrientDefinition[];
  initialState: CustomFoodActionState;
  locale: Locale;
  mode: "create" | "edit";
  saved: "created" | "updated" | null;
}) {
  const t = useTranslations("CustomFoodEditor");
  const [state, formAction, isPending] = useActionState(action, initialState);
  const [basis, setBasis] = useState<CustomFoodNutrientBasis>(
    state.values.nutrient_basis as CustomFoodNutrientBasis,
  );
  const fieldErrors = state.fieldErrors ?? {};
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
    database_error: t("status.databaseError"),
    idle: t("status.idle"),
    not_found: t("status.notFound"),
    unauthenticated: t("status.unauthenticated"),
    validation_error: t("status.validationError"),
  }[state.status];

  return (
    <form action={formAction} className="grid gap-8 text-start" noValidate>
      <input name="food_id" type="hidden" value={state.values.food_id} />

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
              defaultValue={state.values.name}
              dir="auto"
              maxLength={200}
              name="name"
              key={state.values.name}
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
              defaultValue={state.values.brand_name}
              dir="auto"
              maxLength={120}
              name="brand_name"
              key={state.values.brand_name}
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
              defaultValue={state.values.food_locale}
              key={state.values.food_locale}
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
                defaultValue={state.values.serving_quantity}
                inputMode="decimal"
                min="0"
                name="serving_quantity"
                key={state.values.serving_quantity}
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
                defaultValue={state.values.serving_unit}
                dir="auto"
                maxLength={40}
                name="serving_unit"
                key={state.values.serving_unit}
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
        <NutrientGrid definitions={core} fieldErrors={fieldErrors} locale={locale} values={state.values.nutrients} />
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
                values={state.values.nutrients}
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
        <AliasEditor fieldErrors={fieldErrors} initialAliases={state.values.aliases} />
      </section>

      <div className="grid gap-4 border-t border-slate-200 pt-6 sm:grid-cols-[1fr_auto] sm:items-center">
        <div
          className={state.status === "idle" ? "text-sm text-slate-600" : "text-sm text-red-800"}
          role={state.status === "idle" ? "status" : "alert"}
        >
          {statusMessage}
        </div>
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
