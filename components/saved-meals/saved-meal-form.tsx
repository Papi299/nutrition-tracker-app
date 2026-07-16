"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { useTranslations } from "next-intl";
import {
  blankSavedMealItem,
  type SavedMealActionState,
  type SavedMealFormItemValues,
} from "@/app/[locale]/(app)/saved-meals/action-state";
import { savedMealRowKey } from "@/lib/saved-meals/row-identity";
import type { Locale } from "@/lib/i18n/routing";

function errorId(field: string) {
  return `saved-meal-${field}-error`;
}

function helpId(field: string) {
  return `saved-meal-${field}-help`;
}

function describedBy(field: string, error?: string) {
  return error ? `${helpId(field)} ${errorId(field)}` : helpId(field);
}

function FieldError({ code, field }: { code?: string; field: string }) {
  const t = useTranslations("SavedMealEditor.errors");

  if (!code) return null;

  const messages: Record<string, string> = {
    boolean_required: t("validation"),
    duplicate_row_key: t("duplicateRowKey"),
    integer_required: t("integer"),
    invalid_link: t("invalidLink"),
    invalid_number: t("number"),
    invalid_row_key: t("invalidRowKey"),
    invalid_type: t("validation"),
    item_count_out_of_range: t("itemCount"),
    nonnegative_finite_required: t("nonnegative"),
    positions_must_be_contiguous: t("positions"),
    required: t("required"),
    required_field: t("validation"),
    too_long: t("tooLong"),
    unsupported_field: t("validation"),
    unsupported_locale: t("language"),
  };

  return (
    <span className="text-sm font-normal text-red-700" id={errorId(field)}>
      {messages[code] ?? t("validation")}
    </span>
  );
}

function TextInput({
  error,
  field,
  help,
  label,
  maxLength,
  onChange,
  required = false,
  value,
}: {
  error?: string;
  field: string;
  help: string;
  label: string;
  maxLength: number;
  onChange: (value: string) => void;
  required?: boolean;
  value: string;
}) {
  return (
    <label className="grid gap-2 text-sm font-medium text-slate-900">
      <span>{label}</span>
      <input
        aria-describedby={describedBy(field, error)}
        aria-invalid={Boolean(error)}
        className="min-h-11 border border-slate-300 bg-white px-3 text-base text-slate-950 outline-none focus:border-teal-700"
        dir="auto"
        maxLength={maxLength}
        name={field}
        onChange={(event) => onChange(event.target.value)}
        required={required}
        type="text"
        value={value}
      />
      <span className="text-sm font-normal leading-5 text-slate-600" id={helpId(field)}>
        {help}
      </span>
      <FieldError code={error} field={field} />
    </label>
  );
}

function NumberInput({
  error,
  field,
  help,
  integer = false,
  label,
  maximum,
  onChange,
  value,
}: {
  error?: string;
  field: string;
  help: string;
  integer?: boolean;
  label: string;
  maximum: number;
  onChange: (value: string) => void;
  value: string;
}) {
  return (
    <label className="grid gap-2 text-sm font-medium text-slate-900">
      <span>{label}</span>
      <input
        aria-describedby={describedBy(field, error)}
        aria-invalid={Boolean(error)}
        className="min-h-11 border border-slate-300 bg-white px-3 text-base text-slate-950 outline-none focus:border-teal-700"
        inputMode={integer ? "numeric" : "decimal"}
        max={maximum}
        min="0"
        name={field}
        onChange={(event) => onChange(event.target.value)}
        step={integer ? "1" : "any"}
        type="number"
        value={value}
      />
      <span className="text-sm font-normal leading-5 text-slate-600" id={helpId(field)}>
        {help}
      </span>
      <FieldError code={error} field={field} />
    </label>
  );
}

function SavedMealItemCard({
  fieldErrors,
  index,
  isLinked,
  isPending,
  item,
  itemCount,
  move,
  remove,
  update,
}: {
  fieldErrors: Record<string, string>;
  index: number;
  isLinked: boolean;
  isPending: boolean;
  item: SavedMealFormItemValues;
  itemCount: number;
  move: (direction: -1 | 1) => void;
  remove: () => void;
  update: (update: Partial<SavedMealFormItemValues>) => void;
}) {
  const t = useTranslations("SavedMealEditor");
  const field = (name: string) => `item_${name}_${index}`;

  return (
    <fieldset
      className="grid gap-5 border border-slate-200 bg-stone-50 p-4 sm:p-5"
      data-row-key={item.row_key}
      data-testid="saved-meal-item"
    >
      <legend className="px-2 text-base font-semibold text-slate-950">
        {t("items.itemNumber", { number: index + 1 })}
      </legend>
      <input name={field("row_key")} type="hidden" value={item.row_key} />
      <input
        name={field("remove_food_link")}
        type="hidden"
        value={item.remove_food_link ? "1" : "0"}
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          {isLinked ? (
            <span className="inline-flex bg-teal-100 px-3 py-1 text-xs font-semibold text-teal-900">
              {t("items.linked")}
            </span>
          ) : (
            <span className="inline-flex bg-slate-200 px-3 py-1 text-xs font-semibold text-slate-700">
              {t("items.unlinked")}
            </span>
          )}
          {item.remove_food_link && (
            <p className="mt-2 text-sm text-amber-800" role="status">
              {t("items.linkRemoved")}
            </p>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            aria-label={t("items.moveUpLabel", { number: index + 1 })}
            className="min-h-10 border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-800 disabled:text-slate-400"
            disabled={isPending || index === 0}
            onClick={() => move(-1)}
            type="button"
          >
            {t("items.moveUp")}
          </button>
          <button
            aria-label={t("items.moveDownLabel", { number: index + 1 })}
            className="min-h-10 border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-800 disabled:text-slate-400"
            disabled={isPending || index === itemCount - 1}
            onClick={() => move(1)}
            type="button"
          >
            {t("items.moveDown")}
          </button>
          {isLinked && (
            <button
              className="min-h-10 border border-amber-400 bg-white px-3 text-sm font-semibold text-amber-900"
              disabled={isPending}
              onClick={() => update({ remove_food_link: true })}
              type="button"
            >
              {t("items.removeLink")}
            </button>
          )}
          <button
            className="min-h-10 border border-red-300 bg-white px-3 text-sm font-semibold text-red-800 disabled:text-slate-400"
            disabled={isPending || itemCount === 1}
            onClick={remove}
            type="button"
          >
            {t("items.remove")}
          </button>
        </div>
      </div>

      <FieldError code={fieldErrors[field("row_key")]} field={field("row_key")} />

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <TextInput
            error={fieldErrors[field("food_name")]}
            field={field("food_name")}
            help={t("help.foodName")}
            label={t("fields.foodName")}
            maxLength={200}
            onChange={(food_name) => update({ food_name })}
            required
            value={item.food_name}
          />
        </div>
        <TextInput
          error={fieldErrors[field("brand_name")]}
          field={field("brand_name")}
          help={t("help.brand")}
          label={t("fields.brand")}
          maxLength={120}
          onChange={(brand_name) => update({ brand_name })}
          value={item.brand_name}
        />
        <div />
        <NumberInput
          error={fieldErrors[field("serving_quantity")]}
          field={field("serving_quantity")}
          help={t("help.servingQuantity")}
          label={t("fields.servingQuantity")}
          maximum={9_999_999.999}
          onChange={(serving_quantity) => update({ serving_quantity })}
          value={item.serving_quantity}
        />
        <TextInput
          error={fieldErrors[field("serving_unit")]}
          field={field("serving_unit")}
          help={t("help.servingUnit")}
          label={t("fields.servingUnit")}
          maxLength={40}
          onChange={(serving_unit) => update({ serving_unit })}
          value={item.serving_unit}
        />
        <NumberInput
          error={fieldErrors[field("calories")]}
          field={field("calories")}
          help={t("help.calories")}
          integer
          label={t("fields.calories")}
          maximum={2_147_483_647}
          onChange={(calories) => update({ calories })}
          value={item.calories}
        />
        <NumberInput
          error={fieldErrors[field("protein_g")]}
          field={field("protein_g")}
          help={t("help.protein")}
          label={t("fields.protein")}
          maximum={999_999.99}
          onChange={(protein_g) => update({ protein_g })}
          value={item.protein_g}
        />
        <NumberInput
          error={fieldErrors[field("carbohydrates_g")]}
          field={field("carbohydrates_g")}
          help={t("help.carbohydrates")}
          label={t("fields.carbohydrates")}
          maximum={999_999.99}
          onChange={(carbohydrates_g) => update({ carbohydrates_g })}
          value={item.carbohydrates_g}
        />
        <NumberInput
          error={fieldErrors[field("fat_g")]}
          field={field("fat_g")}
          help={t("help.fat")}
          label={t("fields.fat")}
          maximum={999_999.99}
          onChange={(fat_g) => update({ fat_g })}
          value={item.fat_g}
        />
        <label className="grid gap-2 text-sm font-medium text-slate-900 sm:col-span-2">
          <span>{t("fields.notes")}</span>
          <textarea
            aria-describedby={describedBy(
              field("notes"),
              fieldErrors[field("notes")],
            )}
            aria-invalid={Boolean(fieldErrors[field("notes")])}
            className="min-h-24 border border-slate-300 bg-white px-3 py-2 text-base text-slate-950 outline-none focus:border-teal-700"
            dir="auto"
            maxLength={1000}
            name={field("notes")}
            onChange={(event) => update({ notes: event.target.value })}
            value={item.notes}
          />
          <span
            className="text-sm font-normal leading-5 text-slate-600"
            id={helpId(field("notes"))}
          >
            {t("help.notes")}
          </span>
          <FieldError code={fieldErrors[field("notes")]} field={field("notes")} />
        </label>
      </div>
    </fieldset>
  );
}

export function SavedMealForm({
  action,
  archived,
  initialState,
  linkedRowKeys,
  locale,
  mode,
  saved,
}: {
  action: (
    state: SavedMealActionState,
    formData: FormData,
  ) => Promise<SavedMealActionState>;
  archived: boolean;
  initialState: SavedMealActionState;
  linkedRowKeys: string[];
  locale: Locale;
  mode: "create" | "edit";
  saved: "created" | "updated" | null;
}) {
  const t = useTranslations("SavedMealEditor");
  const [state, formAction, isPending] = useActionState(action, initialState);
  const [items, setItems] = useState(state.values.items);
  const linkedRows = new Set(linkedRowKeys);
  const fieldErrors = state.fieldErrors ?? {};
  const statusMessage = {
    database_error: t("status.databaseError"),
    idle: t("status.idle"),
    not_found: t("status.notFound"),
    unauthenticated: t("status.unauthenticated"),
    validation_error: t("status.validationError"),
  }[state.status];

  function updateItem(index: number, update: Partial<SavedMealFormItemValues>) {
    setItems((current) =>
      current.map((item, itemIndex) =>
        itemIndex === index ? { ...item, ...update } : item,
      ),
    );
  }

  function moveItem(index: number, direction: -1 | 1) {
    setItems((current) => {
      const target = index + direction;
      if (target < 0 || target >= current.length) return current;
      const next = [...current];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  return (
    <form action={formAction} className="grid gap-8 text-start" noValidate>
      <input
        name="saved_meal_id"
        type="hidden"
        value={state.values.saved_meal_id}
      />
      <input name="item_count" type="hidden" value={items.length} />

      {saved && (
        <div
          className="border-s-4 border-teal-600 bg-teal-50 px-4 py-3 text-sm text-teal-900"
          data-testid="saved-meal-success"
          role="status"
        >
          {saved === "created" ? t("status.created") : t("status.updated")}
        </div>
      )}

      {archived && (
        <div
          className="border-s-4 border-amber-500 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-950"
          data-testid="saved-meal-archived-notice"
          role="status"
        >
          {t("archivedNotice")}
        </div>
      )}

      <section className="grid gap-5" aria-labelledby="saved-meal-identity-title">
        <div>
          <h2 className="text-xl font-semibold text-slate-950" id="saved-meal-identity-title">
            {t("identity.title")}
          </h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">{t("identity.help")}</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="grid gap-2 text-sm font-medium text-slate-900 sm:col-span-2">
            <span>{t("identity.name")}</span>
            <input
              aria-describedby={describedBy("name", fieldErrors.name)}
              aria-invalid={Boolean(fieldErrors.name)}
              className="min-h-12 border border-slate-300 bg-white px-3 text-base text-slate-950 outline-none focus:border-teal-700"
              defaultValue={state.values.name}
              dir="auto"
              key={state.values.name}
              maxLength={200}
              name="name"
              required
              type="text"
            />
            <span
              className="text-sm font-normal leading-5 text-slate-600"
              id={helpId("name")}
            >
              {t("help.name")}
            </span>
            <FieldError code={fieldErrors.name} field="name" />
          </label>
          <label className="grid gap-2 text-sm font-medium text-slate-900">
            <span>{t("identity.language")}</span>
            <select
              aria-describedby={describedBy(
                "meal_locale",
                fieldErrors.meal_locale,
              )}
              aria-invalid={Boolean(fieldErrors.meal_locale)}
              className="min-h-12 border border-slate-300 bg-white px-3 text-base text-slate-950 outline-none focus:border-teal-700"
              defaultValue={state.values.meal_locale}
              key={state.values.meal_locale}
              name="meal_locale"
            >
              <option value="en">{t("languages.en")}</option>
              <option value="he">{t("languages.he")}</option>
              <option value="und">{t("languages.und")}</option>
            </select>
            <span
              className="text-sm font-normal leading-5 text-slate-600"
              id={helpId("meal_locale")}
            >
              {t("help.language")}
            </span>
            <FieldError code={fieldErrors.meal_locale} field="meal_locale" />
          </label>
        </div>
      </section>

      <section className="grid gap-5 border-t border-slate-200 pt-6" aria-labelledby="saved-meal-items-title">
        <div>
          <h2 className="text-xl font-semibold text-slate-950" id="saved-meal-items-title">
            {t("items.title")}
          </h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">{t("items.help")}</p>
        </div>
        <FieldError code={fieldErrors.items} field="items" />
        <div className="grid gap-5">
          {items.map((item, index) => (
            <SavedMealItemCard
              fieldErrors={fieldErrors}
              index={index}
              isLinked={linkedRows.has(item.row_key) && !item.remove_food_link}
              isPending={isPending}
              item={item}
              itemCount={items.length}
              key={item.row_key}
              move={(direction) => moveItem(index, direction)}
              remove={() =>
                setItems((current) => current.filter((_, itemIndex) => itemIndex !== index))
              }
              update={(update) => updateItem(index, update)}
            />
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <button
            className="min-h-11 border border-teal-700 bg-white px-4 text-sm font-semibold text-teal-800 disabled:border-slate-300 disabled:text-slate-400"
            disabled={isPending || items.length >= 50}
            onClick={() =>
              setItems((current) => [
                ...current,
                blankSavedMealItem(savedMealRowKey("client", crypto.randomUUID())),
              ])
            }
            type="button"
          >
            {t("items.add")}
          </button>
          <span className="text-sm text-slate-600">
            {t("items.count", { count: items.length })}
          </span>
        </div>
      </section>

      <div className="grid gap-4 border-t border-slate-200 pt-6 sm:grid-cols-[1fr_auto] sm:items-center">
        <div
          className={state.status === "idle" ? "text-sm text-slate-600" : "text-sm text-red-800"}
          role={state.status === "idle" ? "status" : "alert"}
        >
          {statusMessage}
        </div>
        <button
          className="min-h-12 bg-teal-700 px-5 text-base font-semibold text-white disabled:cursor-wait disabled:bg-slate-300"
          disabled={isPending}
          type="submit"
        >
          {isPending
            ? t(mode === "create" ? "submit.createPending" : "submit.updatePending")
            : t(mode === "create" ? "submit.create" : "submit.update")}
        </button>
      </div>

      <div className="flex flex-wrap gap-4">
        <Link className="text-sm font-semibold text-teal-800 underline" href={`/${locale}/saved-meals`}>
          {t("backToManagement")}
        </Link>
        <Link className="text-sm font-semibold text-teal-800 underline" href={`/${locale}/today`}>
          {t("backToToday")}
        </Link>
      </div>
    </form>
  );
}
