"use client";

import Link from "next/link";
import { useActionState, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import {
  blankSavedMealItem,
  type SavedMealActionState,
  type SavedMealFormItemValues,
} from "@/app/[locale]/(app)/saved-meals/action-state";
import { savedMealRowKey } from "@/lib/saved-meals/row-identity";
import type { Locale } from "@/lib/i18n/routing";
import { Button, buttonStyles } from "@/components/ui/button";
import { surfaceStyles } from "@/components/ui/card";
import { feedbackStyles } from "@/components/ui/feedback";
import { Input, Select, Textarea } from "@/components/ui/form-controls";

function controlId(field: string) {
  return `saved-meal-${field}`;
}

function errorId(field: string) {
  return `saved-meal-${field}-error`;
}

function helpId(field: string) {
  return `saved-meal-${field}-help`;
}

function describedBy(field: string, error?: string) {
  return error ? `${helpId(field)} ${errorId(field)}` : helpId(field);
}

const itemFieldLabels: Record<string, string> = {
  food_name: "foodName",
  brand_name: "brand",
  serving_quantity: "servingQuantity",
  serving_unit: "servingUnit",
  calories: "calories",
  protein_g: "protein",
  carbohydrates_g: "carbohydrates",
  fat_g: "fat",
  notes: "notes",
};

function itemField(field: string) {
  const match = /^item_(.+)_(\d+)$/.exec(field);
  return match ? { name: match[1], index: Number(match[2]) } : null;
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
    <span className="ui-field-error" id={errorId(field)}>
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
    <label className="ui-label grid min-w-0 gap-2">
      <span>{label}</span>
      <Input
        aria-describedby={describedBy(field, error)}
        aria-invalid={Boolean(error)}
        id={controlId(field)}
        dir="auto"
        maxLength={maxLength}
        name={field}
        onChange={(event) => onChange(event.target.value)}
        required={required}
        type="text"
        value={value}
      />
      <span className="ui-body-secondary font-normal" id={helpId(field)}>
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
    <label className="ui-label grid min-w-0 gap-2">
      <span>{label}</span>
      <Input
        aria-describedby={describedBy(field, error)}
        aria-invalid={Boolean(error)}
        id={controlId(field)}
        inputMode={integer ? "numeric" : "decimal"}
        max={maximum}
        min="0"
        name={field}
        onChange={(event) => onChange(event.target.value)}
        step={integer ? "1" : "any"}
        type="number"
        value={value}
      />
      <span className="ui-body-secondary font-normal" id={helpId(field)}>
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
  const rowErrors = Object.entries(fieldErrors).filter(([name]) => {
    const parsed = itemField(name);
    return parsed?.index === index && !itemFieldLabels[parsed.name];
  });

  return (
    <fieldset
      aria-describedby={rowErrors.map(([name]) => errorId(name)).join(" ") || undefined}
      className={surfaceStyles({ variant: "subtle", className: "grid min-w-0 grid-cols-[minmax(0,1fr)] gap-5 [min-inline-size:0]" })}
      id={`saved-meal-row-${index}`}
      tabIndex={-1}
      data-row-key={item.row_key}
      data-testid="saved-meal-item"
    >
      <legend className="ui-card-title max-w-full px-2 [overflow-wrap:anywhere]">
        {t("items.itemNumber", { number: index + 1 })}
      </legend>
      <input name={field("row_key")} type="hidden" value={item.row_key} />
      <input
        name={field("remove_food_link")}
        type="hidden"
        value={item.remove_food_link ? "1" : "0"}
      />

      <div className="flex min-w-0 flex-wrap items-center justify-between gap-3">
        <div>
          {isLinked ? (
            <span className="ui-badge ui-badge-primary">
              {t("items.linked")}
            </span>
          ) : (
            <span className="ui-badge ui-badge-neutral">
              {t("items.unlinked")}
            </span>
          )}
          {item.remove_food_link && (
            <p className="ui-body-secondary mt-2" role="status">
              {t("items.linkRemoved")}
            </p>
          )}
        </div>
        <div className="flex min-w-0 flex-wrap gap-2">
          <Button
            aria-label={t("items.moveUpLabel", { number: index + 1 })}
            size="sm"
            variant="outline"
            disabled={isPending || index === 0}
            onClick={() => move(-1)}
            type="button"
          >
            {t("items.moveUp")}
          </Button>
          <Button
            aria-label={t("items.moveDownLabel", { number: index + 1 })}
            size="sm"
            variant="outline"
            disabled={isPending || index === itemCount - 1}
            onClick={() => move(1)}
            type="button"
          >
            {t("items.moveDown")}
          </Button>
          {isLinked && (
            <Button
              size="sm"
              variant="outline"
              disabled={isPending}
              onClick={() => update({ remove_food_link: true })}
              type="button"
            >
              {t("items.removeLink")}
            </Button>
          )}
          <Button
            size="sm"
            variant="destructive"
            disabled={isPending || itemCount === 1}
            onClick={remove}
            type="button"
          >
            {t("items.remove")}
          </Button>
        </div>
      </div>

      {rowErrors.map(([name, code]) => (
        <FieldError code={code} field={name} key={name} />
      ))}

      <div className="grid min-w-0 gap-4 sm:grid-cols-[repeat(2,minmax(0,1fr))]">
        <div className="min-w-0 sm:col-span-2">
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
        <label className="ui-label grid min-w-0 gap-2 sm:col-span-2">
          <span>{t("fields.notes")}</span>
          <Textarea
            aria-describedby={describedBy(
              field("notes"),
              fieldErrors[field("notes")],
            )}
            aria-invalid={Boolean(fieldErrors[field("notes")])}
            id={controlId(field("notes"))}
            dir="auto"
            maxLength={1000}
            name={field("notes")}
            onChange={(event) => update({ notes: event.target.value })}
            value={item.notes}
          />
          <span
            className="ui-body-secondary font-normal"
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
  const [submittedRowKeys, setSubmittedRowKeys] = useState(() =>
    initialState.values.items.map((item) => item.row_key),
  );
  const summaryRef = useRef<HTMLDivElement>(null);
  const linkedRows = new Set(linkedRowKeys);
  const fieldErrors: Record<string, string> = {};

  // Returned fields use submission indexes; errors follow the same row after a move.
  for (const [field, code] of Object.entries(isPending ? {} : state.fieldErrors ?? {})) {
    const parsed = itemField(field);
    if (!parsed) {
      fieldErrors[field] = code;
      continue;
    }
    // The submitted UI identity also locates a row whose hidden value was rejected.
    const index = items.findIndex((item) => item.row_key === submittedRowKeys[parsed.index]);
    if (index >= 0) fieldErrors[`item_${parsed.name}_${index}`] = code;
  }
  const statusMessage = {
    conflict: t("status.conflict"),
    database_error: t("status.databaseError"),
    idle: t("status.idle"),
    not_found: t("status.notFound"),
    unauthenticated: t("status.unauthenticated"),
    validation_error: t("status.validationError"),
  }[state.status];

  useEffect(() => {
    if (state.status !== "validation_error" || isPending) return;
    summaryRef.current?.focus({ preventScroll: true });
    summaryRef.current?.scrollIntoView({ block: "start", behavior: "instant" });
  }, [state, isPending]);

  const errorLinks = Object.keys(fieldErrors).map((field) => {
    const parsed = itemField(field);
    if (parsed) {
      const labelKey = itemFieldLabels[parsed.name];
      return {
        field,
        label: `${t("items.itemNumber", { number: parsed.index + 1 })}${labelKey ? `: ${t(`fields.${labelKey}`)}` : ""}`,
        target: labelKey ? controlId(field) : `saved-meal-row-${parsed.index}`,
      };
    }
    return {
      field,
      label: t(field === "name" ? "identity.name" : field === "meal_locale" ? "identity.language" : field === "items" ? "items.title" : "identity.title"),
      target: field === "name" || field === "meal_locale" ? controlId(field) : field === "items" ? "saved-meal-items" : "saved-meal-form-status",
    };
  });

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
    <form
      action={formAction}
      className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-8 text-start [overflow-wrap:anywhere]"
      noValidate
      onSubmit={() => setSubmittedRowKeys(items.map((item) => item.row_key))}
    >
      <input
        name="saved_meal_id"
        type="hidden"
        value={state.values.saved_meal_id}
      />
      <input name="item_count" type="hidden" value={items.length} />

      {state.status === "validation_error" && !isPending && (
        <div
          aria-labelledby="saved-meal-validation-title"
          className={feedbackStyles("danger", "scroll-mt-4")}
          data-testid="saved-meal-validation-summary"
          ref={summaryRef}
          role="alert"
          tabIndex={-1}
        >
          <h2 className="font-semibold" id="saved-meal-validation-title">
            {t("status.validationError")}
          </h2>
          <ul className="mt-2 grid gap-2">
            {errorLinks.map(({ field, label, target }) => (
              <li className="grid min-w-0 gap-1" key={field}>
                <a
                  className="ui-text-link inline-flex min-h-11 items-center"
                  href={`#${target}`}
                  onClick={(event) => {
                    const control = document.getElementById(target);
                    if (!control) return;
                    event.preventDefault();
                    control.focus({ preventScroll: true });
                    control.scrollIntoView({
                      block: control.matches("input, select, textarea") ? "center" : "start",
                      behavior: "instant",
                    });
                  }}
                >
                  {label}
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}

      {saved && (
        <div
          className={feedbackStyles("success")}
          data-testid="saved-meal-success"
          role="status"
        >
          {saved === "created" ? t("status.created") : t("status.updated")}
        </div>
      )}

      {archived && (
        <div
          className={feedbackStyles("warning")}
          data-testid="saved-meal-archived-notice"
          role="status"
        >
          {t("archivedNotice")}
        </div>
      )}

      {mode === "edit" && state.status === "conflict" && (
        <section
          className={feedbackStyles("warning", "grid min-w-0 gap-3")}
          data-testid="saved-meal-edit-conflict"
        >
          <p role="alert">{t("status.conflict")}</p>
          <a
            className={buttonStyles({ variant: "outline", className: "w-fit" })}
            href={`/${locale}/saved-meals/${state.values.saved_meal_id}/edit`}
          >
            {t("status.reloadCurrent")}
          </a>
        </section>
      )}

      <section className="grid min-w-0 gap-5" aria-labelledby="saved-meal-identity-title">
        <div>
          <h2 className="ui-section-title" id="saved-meal-identity-title">
            {t("identity.title")}
          </h2>
          <p className="ui-body-secondary mt-2">{t("identity.help")}</p>
        </div>
        <div className="grid min-w-0 gap-4 sm:grid-cols-[repeat(2,minmax(0,1fr))]">
          <label className="ui-label grid min-w-0 gap-2 sm:col-span-2">
            <span>{t("identity.name")}</span>
            <Input
              aria-describedby={describedBy("name", fieldErrors.name)}
              aria-invalid={Boolean(fieldErrors.name)}
              id={controlId("name")}
              defaultValue={state.values.name}
              dir="auto"
              key={state.values.name}
              maxLength={200}
              name="name"
              required
              type="text"
            />
            <span
              className="ui-body-secondary font-normal"
              id={helpId("name")}
            >
              {t("help.name")}
            </span>
            <FieldError code={fieldErrors.name} field="name" />
          </label>
          <label className="ui-label grid min-w-0 gap-2">
            <span>{t("identity.language")}</span>
            <Select
              aria-describedby={describedBy(
                "meal_locale",
                fieldErrors.meal_locale,
              )}
              aria-invalid={Boolean(fieldErrors.meal_locale)}
              id={controlId("meal_locale")}
              defaultValue={state.values.meal_locale}
              key={state.values.meal_locale}
              name="meal_locale"
            >
              <option value="en">{t("languages.en")}</option>
              <option value="he">{t("languages.he")}</option>
              <option value="und">{t("languages.und")}</option>
            </Select>
            <span
              className="ui-body-secondary font-normal"
              id={helpId("meal_locale")}
            >
              {t("help.language")}
            </span>
            <FieldError code={fieldErrors.meal_locale} field="meal_locale" />
          </label>
        </div>
      </section>

      <section className="grid min-w-0 gap-5 border-t border-border pt-6" aria-labelledby="saved-meal-items-title" aria-describedby={fieldErrors.items ? errorId("items") : undefined} id="saved-meal-items" tabIndex={-1}>
        <div>
          <h2 className="ui-section-title" id="saved-meal-items-title">
            {t("items.title")}
          </h2>
          <p className="ui-body-secondary mt-2">{t("items.help")}</p>
        </div>
        <FieldError code={fieldErrors.items} field="items" />
        <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-5">
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
        <div className="flex min-w-0 flex-wrap items-center gap-4">
          <Button
            variant="outline"
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
          </Button>
          <span className="ui-body-secondary">
            {t("items.count", { count: items.length })}
          </span>
        </div>
      </section>

      <div className="grid min-w-0 gap-4 border-t border-border pt-6 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
        <div
          className={state.status === "idle" || state.status === "validation_error" ? "ui-body-secondary" : feedbackStyles(state.status === "conflict" ? "warning" : "danger")}
          id="saved-meal-form-status"
          tabIndex={-1}
          role={state.status === "idle" || state.status === "validation_error" ? "status" : "alert"}
        >
          {statusMessage}
          {Object.entries(fieldErrors).filter(([field]) => !itemField(field) && !["name", "meal_locale", "items"].includes(field)).map(([field, code]) => (
            <FieldError code={code} field={field} key={field} />
          ))}
        </div>
        <Button
          size="lg"
          pending={isPending}
          disabled={isPending}
          type="submit"
        >
          {isPending
            ? t(mode === "create" ? "submit.createPending" : "submit.updatePending")
            : t(mode === "create" ? "submit.create" : "submit.update")}
        </Button>
      </div>

      <div className="flex min-w-0 flex-wrap gap-4">
        <Link className={buttonStyles({ variant: "ghost", className: "underline" })} href={`/${locale}/saved-meals`}>
          {t("backToManagement")}
        </Link>
        <Link className={buttonStyles({ variant: "ghost", className: "underline" })} href={`/${locale}/today`}>
          {t("backToToday")}
        </Link>
      </div>
    </form>
  );
}
