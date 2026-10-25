"use client";

import Link from "next/link";
import { AdditionalNutrientFields } from "@/components/nutrition/additional-nutrient-fields";
import { additionalNutrientCodesV1 } from "@/lib/nutrition-snapshots";
import { mergeReviewedRows } from "@/lib/nutrition-snapshots/form-state";
import { allNutrientFields, nutrientFields, scaleAllFoodNutrients } from "@/lib/food-selection/nutrient-scaling";
import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import {
  searchRecipeIngredientFoodsAction,
  selectRecipeIngredientFoodAction,
  type RecipeFoodPickerResult,
} from "@/app/[locale]/(app)/recipes/actions";
import {
  blankRecipeIngredient,
  type RecipeActionState,
  type RecipeFormIngredientValues,
} from "@/app/[locale]/(app)/recipes/action-state";
import { recipeRowKey } from "@/lib/recipes/row-identity";
import type { Locale } from "@/lib/i18n/routing";
import { Button, buttonStyles } from "@/components/ui/button";
import { surfaceStyles } from "@/components/ui/card";
import { feedbackStyles } from "@/components/ui/feedback";
import { Input, Select, Textarea } from "@/components/ui/form-controls";

function controlId(field: string) {
  return `recipe-${field}`;
}

const ingredientFieldLabels: Record<string, string> = {
  ingredient_name: "ingredientName",
  brand_name: "brand",
  quantity: "quantity",
  unit: "unit",
  calories: "calories",
  protein_g: "protein",
  carbohydrates_g: "carbohydrates",
  fat_g: "fat",
  notes: "notes",
};

function ingredientField(field: string) {
  const match = /^ingredient_(.+)_(\d+)$/.exec(field);
  return match ? { name: match[1], index: Number(match[2]) } : null;
}

function errorId(field: string) {
  return `recipe-${field}-error`;
}

function helpId(field: string) {
  return `recipe-${field}-help`;
}

function describedBy(field: string, error?: string, sharedErrorField?: string) {
  return [helpId(field), error ? errorId(field) : null, sharedErrorField ? errorId(sharedErrorField) : null].filter(Boolean).join(" ");
}

function FieldError({ code, field }: { code?: string; field: string }) {
  const t = useTranslations("RecipeEditor.errors");
  if (!code) return null;
  const messages: Record<string, string> = {
    nutrition_review_required: t("nutritionReviewRequired"),
    reference_changed: t("referenceChanged"),
    missing_reference: t("automaticUnavailable"),
    incompatible_unit: t("automaticUnavailable"),
    invalid_reference: t("automaticUnavailable"),
    quantity_precision: t("automaticUnavailable"),
    nutrient_out_of_range: t("automaticUnavailable"),
    capture_required: t("captureRequired"),
    both_or_neither_required: t("quantityUnit"),
    duplicate_row_key: t("duplicateRowKey"),
    ingredient_count_out_of_range: t("ingredientCount"),
    integer_required: t("integer"),
    invalid_link: t("invalidLink"),
    invalid_number: t("number"),
    invalid_row_key: t("invalidRowKey"),
    invalid_type: t("validation"),
    number_out_of_range: t("range"),
    positions_must_be_contiguous: t("positions"),
    required: t("required"),
    required_field: t("validation"),
    too_long: t("tooLong"),
    unsupported_field: t("validation"),
    unsupported_locale: t("language"),
  };
  return <span className="ui-field-error" id={errorId(field)}>{messages[code] ?? t("validation")}</span>;
}

function TextInput({
  error,
  sharedErrorField,
  field,
  help,
  label,
  maxLength,
  onChange,
  required = false,
  value,
}: {
  error?: string;
  sharedErrorField?: string;
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
        aria-describedby={describedBy(field, error, sharedErrorField)}
        aria-invalid={Boolean(error || sharedErrorField)}
        id={controlId(field)}
        dir="auto"
        maxLength={maxLength}
        name={field}
        onChange={(event) => onChange(event.target.value)}
        required={required}
        type="text"
        value={value}
      />
      <span className="ui-body-secondary font-normal" id={helpId(field)}>{help}</span>
      <FieldError code={error} field={field} />
    </label>
  );
}

function NumberInput({
  error,
  sharedErrorField,
  field,
  help,
  integer = false,
  label,
  minimum = 0,
  maximum,
  onChange,
  required = false,
  value,
}: {
  error?: string;
  sharedErrorField?: string;
  field: string;
  help: string;
  integer?: boolean;
  label: string;
  minimum?: number;
  maximum: number;
  onChange: (value: string) => void;
  required?: boolean;
  value: string;
}) {
  return (
    <label className="ui-label grid min-w-0 gap-2">
      <span>{label}</span>
      <Input
        aria-describedby={describedBy(field, error, sharedErrorField)}
        aria-invalid={Boolean(error || sharedErrorField)}
        id={controlId(field)}
        inputMode={integer ? "numeric" : "decimal"}
        max={maximum}
        min={minimum}
        name={field}
        onChange={(event) => onChange(event.target.value)}
        required={required}
        step={integer ? "1" : "any"}
        type="number"
        value={value}
      />
      <span className="ui-body-secondary font-normal" id={helpId(field)}>{help}</span>
      <FieldError code={error} field={field} />
    </label>
  );
}

function FoodPicker({
  disabled,
  onCompositionEnter,
  onSelect,
  onSelectionPendingChange,
}: {
  disabled: boolean;
  onSelectionPendingChange: (pending: boolean) => void;
  onCompositionEnter: (input: HTMLInputElement | null) => void;
  onSelect: (value: Awaited<ReturnType<typeof selectRecipeIngredientFoodAction>> extends infer R ? R : never) => void;
}) {
  const t = useTranslations("RecipeEditor.picker");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<RecipeFoodPickerResult[]>([]);
  const [status, setStatus] = useState<"idle" | "too_short" | "error" | "ready">("idle");
  const [pending, startTransition] = useTransition();
  const composing = useRef(false);
  const requestPending = useRef(false);

  function search() {
    if (disabled || pending || requestPending.current) return;
    requestPending.current = true;
    startTransition(async () => {
      try {
        const result = await searchRecipeIngredientFoodsAction(query);
        if (result.status === "ready") {
          setResults(result.results);
          setStatus("ready");
        } else {
          setResults([]);
          setStatus(result.status === "too_short" ? "too_short" : "error");
        }
      } finally {
        requestPending.current = false;
      }
    });
  }

  function select(foodId: string) {
    if (disabled || pending || requestPending.current) return;
    requestPending.current = true;
    onSelectionPendingChange(true);
    startTransition(async () => {
      try {
        const result = await selectRecipeIngredientFoodAction(foodId);
        if (result.status !== "ready") setStatus("error");
        onSelect(result);
      } finally {
        requestPending.current = false;
        onSelectionPendingChange(false);
      }
    });
  }

  return (
    <div className={surfaceStyles({ variant: "subtle", className: "grid min-w-0 grid-cols-[minmax(0,1fr)] gap-3" })} data-testid="recipe-food-picker">
      <p className="ui-label">{t("title")}</p>
      <p className="ui-body-secondary">{t("help")}</p>
      <div className="grid min-w-0 gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
        <Input
          aria-label={t("label")}
          dir="auto"
          disabled={disabled || pending}
          maxLength={100}
          onChange={(event) => setQuery(event.target.value)}
          onBlur={() => {
            composing.current = false;
            onCompositionEnter(null);
          }}
          onCompositionStart={() => { composing.current = true; }}
          onCompositionEnd={() => { composing.current = false; }}
          onKeyDown={(event) => {
            if (event.key !== "Enter") return;
            // Some IMEs end composition before the final keydown, leaving keyCode 229.
            if (composing.current || event.nativeEvent.isComposing || event.nativeEvent.keyCode === 229) {
              // Keep native text acceptance; block only its possible form submission.
              onCompositionEnter(event.currentTarget);
              return;
            }
            onCompositionEnter(null);
            event.preventDefault();
            search();
          }}
          onKeyUp={() => onCompositionEnter(null)}
          type="search"
          value={query}
        />
        <Button pending={pending} disabled={disabled || pending} onClick={search} type="button">
          {pending ? t("pending") : t("search")}
        </Button>
      </div>
      {status === "too_short" && <p className={feedbackStyles("warning")} role="alert">{t("tooShort")}</p>}
      {status === "error" && <p className={feedbackStyles("danger")} role="alert">{t("error")}</p>}
      {status === "ready" && results.length === 0 && <p className="ui-body-secondary">{t("empty")}</p>}
      {results.length > 0 && (
        <ul className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-2">
          {results.map((result) => (
            <li className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-3 rounded-lg border border-border bg-surface p-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center" key={result.food_id}>
              <div className="min-w-0 [overflow-wrap:anywhere]">
                <p className="font-semibold text-foreground" dir="auto">{result.name}</p>
                {result.brand_name && <p className="ui-body-secondary" dir="auto">{result.brand_name}</p>}
                <p className="ui-body-secondary">{result.is_owned ? t("owned") : t("public")} · <bdi dir="auto">{result.source_name ?? t("unknownSource")}</bdi></p>
              </div>
              <Button size="sm" variant="outline" disabled={pending} onClick={() => select(result.food_id)} type="button">{t("select")}</Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function RecipeIngredientCard({
  fieldErrors,
  index,
  isLinked,
  isPending,
  isSelecting,
  onSelectionPendingChange,
  ingredient,
  ingredientCount,
  move,
  onCompositionEnter,
  remove,
  update,
}: {
  fieldErrors: Record<string, string>;
  index: number;
  isLinked: boolean;
  isPending: boolean;
  isSelecting: boolean;
  onSelectionPendingChange: (pending: boolean) => void;
  ingredient: RecipeFormIngredientValues;
  ingredientCount: number;
  move: (direction: -1 | 1) => void;
  onCompositionEnter: (input: HTMLInputElement | null) => void;
  remove: () => void;
  update: (value: Partial<RecipeFormIngredientValues>) => void;
}) {
  const t = useTranslations("RecipeEditor");
  const nutritionT = useTranslations("Diary.form");
  const additionalT = useTranslations("Diary.additionalNutrients");
  const field = (name: string) => `ingredient_${name}_${index}`;
  const sharedErrorField = fieldErrors[field("quantity_unit")] ? field("quantity_unit") : undefined;
  const rowErrors = Object.entries(fieldErrors).filter(([name]) => {
    const parsed = ingredientField(name);
    return parsed?.index === index && !ingredientFieldLabels[parsed.name] && parsed.name !== "quantity_unit" && !(additionalNutrientCodesV1 as readonly string[]).includes(parsed.name);
  });

  return (
    <fieldset disabled={isSelecting} aria-busy={isSelecting || undefined} data-selection-pending={isSelecting ? "true" : undefined} aria-describedby={rowErrors.map(([name]) => errorId(name)).join(" ") || undefined} className={surfaceStyles({ variant: "subtle", className: "grid min-w-0 grid-cols-[minmax(0,1fr)] gap-5 [min-inline-size:0] scroll-mt-4" })} id={`recipe-row-${index}`} tabIndex={-1} data-row-key={ingredient.row_key} data-testid="recipe-ingredient">
      <legend className="ui-card-title max-w-full px-2 [overflow-wrap:anywhere]">{t("ingredients.number", { number: index + 1 })}</legend>
      <input name={field("row_key")} type="hidden" value={ingredient.row_key} />
      <input name={field("selected_food_id")} type="hidden" value={ingredient.selected_food_id} />
      <input name={field("reference_fingerprint")} type="hidden" value={ingredient.reference_fingerprint} />
      <input name={field("remove_food_link")} type="hidden" value={ingredient.remove_food_link ? "1" : "0"} />

      <div className="flex min-w-0 flex-wrap items-center justify-between gap-3">
        <div>
          <span className={isLinked ? "ui-badge ui-badge-primary" : "ui-badge ui-badge-neutral"}>
            {t(isLinked ? "ingredients.linked" : "ingredients.unlinked")}
          </span>
          {ingredient.remove_food_link && <p className="ui-body-secondary mt-2" role="status">{t("ingredients.linkRemoved")}</p>}
        </div>
        <div className="flex min-w-0 flex-wrap gap-2">
          <Button aria-label={t("ingredients.moveUpLabel", { number: index + 1 })} size="sm" variant="outline" disabled={isPending || index === 0} onClick={() => move(-1)} type="button">{t("ingredients.moveUp")}</Button>
          <Button aria-label={t("ingredients.moveDownLabel", { number: index + 1 })} size="sm" variant="outline" disabled={isPending || index === ingredientCount - 1} onClick={() => move(1)} type="button">{t("ingredients.moveDown")}</Button>
          {isLinked && <Button size="sm" variant="outline" disabled={isPending} onClick={() => update({ remove_food_link: true, selected_food_id: "", reference: null, reference_fingerprint: "", automatic_values: {} })} type="button">{t("ingredients.removeLink")}</Button>}
          <Button size="sm" variant="destructive" disabled={isPending || ingredientCount === 1} onClick={remove} type="button">{t("ingredients.remove")}</Button>
        </div>
      </div>

      {rowErrors.map(([name, code]) => <FieldError code={code} field={name} key={name} />)}
      <FoodPicker
        disabled={isPending}
        onSelectionPendingChange={onSelectionPendingChange}
        onCompositionEnter={onCompositionEnter}
        onSelect={(result) => {
          if (result.status === "ready") {
            const { food_id, ...snapshot } = result.value;
            update({
              ...snapshot,
              remove_food_link: false,
              selected_food_id: food_id,
            });
          }
        }}
      />

      <div className="grid min-w-0 gap-4 sm:grid-cols-[repeat(2,minmax(0,1fr))]">
        <div className="min-w-0 sm:col-span-2"><TextInput error={fieldErrors[field("ingredient_name")]} field={field("ingredient_name")} help={t("help.ingredientName")} label={t("fields.ingredientName")} maxLength={200} onChange={(ingredient_name) => update({ ingredient_name })} required value={ingredient.ingredient_name} /></div>
        <TextInput error={fieldErrors[field("brand_name")]} field={field("brand_name")} help={t("help.brand")} label={t("fields.brand")} maxLength={120} onChange={(brand_name) => update({ brand_name })} value={ingredient.brand_name} />
        <div />
        <fieldset className="grid min-w-0 gap-4 [min-inline-size:0] sm:col-span-2 sm:grid-cols-[repeat(2,minmax(0,1fr))]" id={controlId(field("quantity_unit"))} tabIndex={-1} aria-describedby={sharedErrorField ? errorId(sharedErrorField) : undefined}>
          <legend className="ui-label mb-3">{t("fields.quantity")} / {t("fields.unit")}</legend>
          <NumberInput error={fieldErrors[field("quantity")]} sharedErrorField={sharedErrorField} field={field("quantity")} help={t("help.quantity")} label={t("fields.quantity")} maximum={9_999_999.999} minimum={0.001} onChange={(quantity) => update({ quantity })} value={ingredient.quantity} />
          <TextInput error={fieldErrors[field("unit")]} sharedErrorField={sharedErrorField} field={field("unit")} help={t("help.unit")} label={t("fields.unit")} maxLength={40} onChange={(unit) => update({ unit })} value={ingredient.unit} />
          <div className="min-w-0 sm:col-span-2"><FieldError code={fieldErrors[field("quantity_unit")]} field={field("quantity_unit")} /></div>
        </fieldset>
        <NumberInput error={fieldErrors[field("calories")]} field={field("calories")} help={t("help.calories")} integer label={t("fields.calories")} maximum={2_147_483_647} onChange={(calories) => update({ calories, automatic_values: { ...ingredient.automatic_values, calories: "" } })} value={ingredient.calories} />
        <NumberInput error={fieldErrors[field("protein_g")]} field={field("protein_g")} help={t("help.protein")} label={t("fields.protein")} maximum={999_999.99} onChange={(protein_g) => update({ protein_g, automatic_values: { ...ingredient.automatic_values, protein_g: "" } })} value={ingredient.protein_g} />
        <NumberInput error={fieldErrors[field("carbohydrates_g")]} field={field("carbohydrates_g")} help={t("help.carbohydrates")} label={t("fields.carbohydrates")} maximum={999_999.99} onChange={(carbohydrates_g) => update({ carbohydrates_g, automatic_values: { ...ingredient.automatic_values, carbohydrates_g: "" } })} value={ingredient.carbohydrates_g} />
        <NumberInput error={fieldErrors[field("fat_g")]} field={field("fat_g")} help={t("help.fat")} label={t("fields.fat")} maximum={999_999.99} onChange={(fat_g) => update({ fat_g, automatic_values: { ...ingredient.automatic_values, fat_g: "" } })} value={ingredient.fat_g} />
        <label className="ui-label grid min-w-0 gap-2 sm:col-span-2">
          <span>{t("fields.notes")}</span>
          <Textarea id={controlId(field("notes"))} aria-describedby={describedBy(field("notes"), fieldErrors[field("notes")])} aria-invalid={Boolean(fieldErrors[field("notes")])} dir="auto" maxLength={1000} name={field("notes")} onChange={(event) => update({ notes: event.target.value })} value={ingredient.notes} />
          <span className="ui-body-secondary font-normal" id={helpId(field("notes"))}>{t("help.notes")}</span>
          <FieldError code={fieldErrors[field("notes")]} field={field("notes")} />
        </label>
      </div>
      {ingredient.reference && <div className="grid gap-2 sm:grid-cols-2">
        {nutrientFields.map(fieldName => <label className="flex min-h-11 items-center gap-2 text-sm" key={fieldName}>
          <input checked={ingredient.automatic_values[fieldName] === "1"} name={field(`automatic_${fieldName}`)} type="checkbox" value="1"
            onChange={event => update({ automatic_values: { ...ingredient.automatic_values, [fieldName]: event.target.checked ? "1" : "" } })} />
          <span>{nutritionT("automaticLabel")}: {t(`fields.${fieldName === "protein_g" ? "protein" : fieldName === "carbohydrates_g" ? "carbohydrates" : fieldName === "fat_g" ? "fat" : "calories"}`)}</span>
        </label>)}
      </div>}
      {ingredient.additional_captured ? <input name={field("additional_nutrients_captured")} type="hidden" value="1" /> : <label className="flex min-h-11 items-center gap-2 text-sm">
        <input checked={ingredient.additional_captured} name={field("additional_nutrients_captured")} type="checkbox" value="1" onChange={event => update({ additional_captured: event.target.checked })} />
        <span>{additionalT("capture")}</span>
      </label>}
      <AdditionalNutrientFields controlPrefix="recipe" fieldPrefix="ingredient_" fieldSuffix={`_${index}`}
        values={ingredient.additional_values} errors={fieldErrors}
        automaticValues={ingredient.reference ? ingredient.automatic_values : undefined}
        onValueChange={(code, value) => update({ additional_captured: true,
          additional_values: { ...ingredient.additional_values, [code]: value }, automatic_values: { ...ingredient.automatic_values, [code]: "" } })}
        onAutomaticChange={(code, enabled) => update({ automatic_values: { ...ingredient.automatic_values, [code]: enabled ? "1" : "" } })} />
      <p className="ui-body-secondary">{t("ingredients.snapshotHelp")}</p>
    </fieldset>
  );
}

export function RecipeForm({
  action,
  archived,
  initialState,
  linkedRowKeys,
  locale,
  mode,
  saved,
}: {
  action: (state: RecipeActionState, formData: FormData) => Promise<RecipeActionState>;
  archived: boolean;
  initialState: RecipeActionState;
  linkedRowKeys: string[];
  locale: Locale;
  mode: "create" | "edit";
  saved: "created" | "updated" | null;
}) {
  const t = useTranslations("RecipeEditor");
  const additionalLabelsT = useTranslations("Diary.additionalNutrients.labels");
  const [state, formAction, isPending] = useActionState(action, initialState);
  const [ingredients, setIngredients] = useState(state.values.ingredients);
  const [selectingRows, setSelectingRows] = useState<Set<string>>(() => new Set());
  const [yieldServings, setYieldServings] = useState(state.values.yield_servings);
  const submittedYield = useRef(state.values.yield_servings);
  const submittedRows = useRef(state.values.ingredients);
  const reviewedResponse = useRef(initialState);
  const nutritionT = useTranslations("Diary.form");
  useEffect(() => {
    if (isPending || state === reviewedResponse.current) return;
    reviewedResponse.current = state;
    if (state.status === "validation_error") queueMicrotask(() => {
      setIngredients(current => mergeReviewedRows(current, submittedRows.current, state.values.ingredients));
      setYieldServings(current => current === submittedYield.current ? state.values.yield_servings : current);
    });
  }, [state, isPending]);
  const compositionEnterInput = useRef<HTMLInputElement | null>(null);
  const linkedRows = new Set(linkedRowKeys);
  const [submittedRowKeys, setSubmittedRowKeys] = useState(() => initialState.values.ingredients.map((ingredient) => ingredient.row_key));
  const summaryRef = useRef<HTMLDivElement>(null);
  const lastResponse = useRef(initialState);
  const fieldErrors: Record<string, string> = {};
  // Server errors use submission indexes; follow the submitted row after reordering.
  for (const [field, code] of Object.entries(isPending ? {} : state.fieldErrors ?? {})) {
    const parsed = ingredientField(field);
    if (!parsed) {
      fieldErrors[field] = code;
      continue;
    }
    const index = ingredients.findIndex((ingredient) => ingredient.row_key === submittedRowKeys[parsed.index]);
    if (index >= 0) fieldErrors[`ingredient_${parsed.name}_${index}`] = code;
  }

  useEffect(() => {
    if (isPending || state === lastResponse.current) return;
    lastResponse.current = state;
    if (state.status !== "validation_error") return;
    summaryRef.current?.focus({ preventScroll: true });
    summaryRef.current?.scrollIntoView({ block: "start", behavior: "instant" });
  }, [state, isPending]);

  const errorLinks = Object.keys(fieldErrors).map((field) => {
    const parsed = ingredientField(field);
    if (parsed) {
      const labelKey = ingredientFieldLabels[parsed.name];
      return {
        field,
        label: `${t("ingredients.number", { number: parsed.index + 1 })}: ${parsed.name === "quantity_unit" ? `${t("fields.quantity")} / ${t("fields.unit")}` : labelKey ? t(`fields.${labelKey}`) : (additionalNutrientCodesV1 as readonly string[]).includes(parsed.name) ? additionalLabelsT(parsed.name) : t("ingredients.title")}`,
        target: parsed.name === "quantity_unit" || labelKey || (additionalNutrientCodesV1 as readonly string[]).includes(parsed.name) ? controlId(field) : `recipe-row-${parsed.index}`,
      };
    }
    const identityField = ["name", "recipe_locale", "yield_servings"].includes(field);
    return {
      field,
      label: t(field === "name" ? "identity.name" : field === "recipe_locale" ? "identity.language" : field === "yield_servings" ? "identity.yield" : field === "ingredients" ? "ingredients.title" : "identity.title"),
      target: identityField ? controlId(field) : field === "ingredients" ? "recipe-ingredients" : "recipe-form-status",
    };
  });
  const statusMessage = {
    conflict: t("status.conflict"),
    database_error: t("status.databaseError"),
    idle: t("status.idle"),
    not_found: t("status.notFound"),
    unauthenticated: t("status.unauthenticated"),
    validation_error: t("status.validationError"),
  }[state.status];

  function updateIngredient(rowKey: string, update: Partial<RecipeFormIngredientValues>) {
    setIngredients(current => current.map(item => {
      if (item.row_key !== rowKey) return item;
      const next = { ...item, ...update };
      if (next.reference && (update.quantity !== undefined || update.unit !== undefined || update.automatic_values !== undefined)) {
        const automatic = allNutrientFields.filter(field => next.automatic_values[field] === "1");
        const scaled = scaleAllFoodNutrients(next.reference, next.quantity, next.unit, automatic);
        if (scaled.ok) {
          next.additional_values = { ...next.additional_values };
          for (const field of automatic) {
            if ((nutrientFields as readonly string[]).includes(field)) next[field as typeof nutrientFields[number]] = scaled.values[field];
            else next.additional_values[field as typeof additionalNutrientCodesV1[number]] = scaled.values[field];
          }
        }
      }
      return next;
    }));
  }

  function moveIngredient(index: number, direction: -1 | 1) {
    setIngredients((current) => {
      const target = index + direction;
      if (target < 0 || target >= current.length) return current;
      const next = [...current];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  return (
    <form action={formAction} className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-8 text-start [overflow-wrap:anywhere]" noValidate onSubmit={(event) => { if (!event.defaultPrevented) { submittedRows.current = ingredients; submittedYield.current = yieldServings; setSubmittedRowKeys(ingredients.map((ingredient) => ingredient.row_key)); } }} onSubmitCapture={(event) => {
      if (selectingRows.size > 0) { event.preventDefault(); return; }
      if (compositionEnterInput.current && compositionEnterInput.current === event.currentTarget.ownerDocument.activeElement) {
        event.preventDefault();
      }
    }}>
      <input name="recipe_id" type="hidden" value={state.values.recipe_id} />
      <input name="ingredient_count" type="hidden" value={ingredients.length} />
      {state.fieldErrors?.form === "nutrition_review_required" && <p data-testid="nutrition-review-required" role="status">{nutritionT("nutritionReviewRequired")}</p>}
      {Object.values(state.fieldErrors ?? {}).includes("reference_changed") && <p data-testid="nutrition-reference-changed" role="status">{nutritionT("referenceChanged")}</p>}


      {state.status === "validation_error" && !isPending && (
        <div aria-labelledby="recipe-validation-title" className={feedbackStyles("danger", "scroll-mt-4")} data-testid="recipe-validation-summary" ref={summaryRef} role="alert" tabIndex={-1}>
          <h2 className="font-semibold" id="recipe-validation-title">{t("status.validationError")}</h2>
          <ul className="mt-2 grid gap-2">
            {errorLinks.map(({ field, label, target }) => (
              <li className="grid min-w-0 gap-1" key={field}>
                <a className="ui-text-link inline-flex min-h-11 items-center" href={`#${target}`} onClick={(event) => {
                  const control = document.getElementById(target);
                  if (!control) return;
                  event.preventDefault();
                  let disclosure = control.closest("details");
                  while (disclosure) { disclosure.open = true; disclosure = disclosure.parentElement?.closest("details") ?? null; }
                  control.focus({ preventScroll: true });
                  control.scrollIntoView({ block: control.matches("input, select, textarea") ? "center" : "start", behavior: "instant" });
                }}>{label}</a>
              </li>
            ))}
          </ul>
        </div>
      )}

      {saved && <div className={feedbackStyles("success")} data-testid="recipe-success" role="status">{t(saved === "created" ? "status.created" : "status.updated")}</div>}
      {archived && <div className={feedbackStyles("warning")} data-testid="recipe-archived-notice" role="status">{t("archivedNotice")}</div>}

      {mode === "edit" && state.status === "conflict" && (
        <section
          className={feedbackStyles("warning", "grid min-w-0 gap-3")}
          data-testid="recipe-edit-conflict"
        >
          <p role="alert">{t("status.conflict")}</p>
          <a
            className={buttonStyles({ variant: "outline", className: "w-fit" })}
            href={`/${locale}/recipes/${state.values.recipe_id}/edit`}
          >
            {t("status.reloadCurrent")}
          </a>
        </section>
      )}

      <section className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-5" aria-labelledby="recipe-identity-title">
        <div><h2 className="ui-section-title" id="recipe-identity-title">{t("identity.title")}</h2><p className="ui-body-secondary mt-2">{t("identity.help")}</p></div>
        <div className="grid min-w-0 gap-4 sm:grid-cols-[repeat(2,minmax(0,1fr))]">
          <label className="ui-label grid min-w-0 gap-2 sm:col-span-2">
            <span>{t("identity.name")}</span>
            <Input id={controlId("name")} aria-describedby={describedBy("name", fieldErrors.name)} aria-invalid={Boolean(fieldErrors.name)} defaultValue={state.values.name} dir="auto" key={state.values.name} maxLength={200} name="name" required type="text" />
            <span className="ui-body-secondary font-normal" id={helpId("name")}>{t("help.name")}</span><FieldError code={fieldErrors.name} field="name" />
          </label>
          <label className="ui-label grid min-w-0 gap-2">
            <span>{t("identity.language")}</span>
            <Select id={controlId("recipe_locale")} aria-describedby={describedBy("recipe_locale", fieldErrors.recipe_locale)} aria-invalid={Boolean(fieldErrors.recipe_locale)} defaultValue={state.values.recipe_locale} key={state.values.recipe_locale} name="recipe_locale"><option value="en">{t("languages.en")}</option><option value="he">{t("languages.he")}</option><option value="und">{t("languages.und")}</option></Select>
            <span className="ui-body-secondary font-normal" id={helpId("recipe_locale")}>{t("help.language")}</span><FieldError code={fieldErrors.recipe_locale} field="recipe_locale" />
          </label>
          <NumberInput error={fieldErrors.yield_servings} field="yield_servings" help={t("help.yield")} label={t("identity.yield")} maximum={10_000} minimum={0.001} onChange={setYieldServings} required value={yieldServings} />
        </div>
      </section>

      <section className="grid min-w-0 gap-5 border-t border-border pt-6" aria-labelledby="recipe-ingredients-title" aria-describedby={fieldErrors.ingredients ? errorId("ingredients") : undefined} id="recipe-ingredients" tabIndex={-1}>
        <div><h2 className="ui-section-title" id="recipe-ingredients-title">{t("ingredients.title")}</h2><p className="ui-body-secondary mt-2">{t("ingredients.help")}</p></div>
        <FieldError code={fieldErrors.ingredients} field="ingredients" />
        <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-5">
          {ingredients.map((ingredient, index) => (
            <RecipeIngredientCard fieldErrors={fieldErrors} index={index} ingredient={ingredient} ingredientCount={ingredients.length} isLinked={(linkedRows.has(ingredient.row_key) || ingredient.selected_food_id !== "") && !ingredient.remove_food_link} isPending={isPending} isSelecting={selectingRows.has(ingredient.row_key)} onSelectionPendingChange={(pending) => setSelectingRows(current => {
              const next = new Set(current); if (pending) next.add(ingredient.row_key); else next.delete(ingredient.row_key); return next;
            })} key={ingredient.row_key} move={(direction) => moveIngredient(index, direction)} onCompositionEnter={(input) => { compositionEnterInput.current = input; }} remove={() => setIngredients((current) => current.filter((_, itemIndex) => itemIndex !== index))} update={(update) => updateIngredient(ingredient.row_key, update)} />
          ))}
        </div>
        <div className="flex min-w-0 flex-wrap items-center gap-4">
          <Button variant="outline" disabled={isPending || ingredients.length >= 50} onClick={() => setIngredients((current) => [...current, blankRecipeIngredient(recipeRowKey("client", crypto.randomUUID()))])} type="button">{t("ingredients.add")}</Button>
          <span className="ui-body-secondary">{t("ingredients.count", { count: ingredients.length })}</span>
        </div>
      </section>

      <div className="grid min-w-0 gap-4 border-t border-border pt-6 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
        <div className={state.status === "idle" || state.status === "validation_error" ? "ui-body-secondary" : feedbackStyles(state.status === "conflict" ? "warning" : "danger")} id="recipe-form-status" tabIndex={-1} role={state.status === "idle" || state.status === "validation_error" ? "status" : "alert"}>
          {statusMessage}
          {Object.entries(fieldErrors).filter(([field]) => !ingredientField(field) && !["name", "recipe_locale", "yield_servings", "ingredients"].includes(field)).map(([field, code]) => <FieldError code={code} field={field} key={field} />)}
        </div>
        <Button size="lg" pending={isPending} disabled={isPending || selectingRows.size > 0} onPointerDown={() => { compositionEnterInput.current = null; }} type="submit">{isPending ? t(mode === "create" ? "submit.createPending" : "submit.updatePending") : t(mode === "create" ? "submit.create" : "submit.update")}</Button>
      </div>
      <div className="flex min-w-0 flex-wrap gap-4"><Link className={buttonStyles({ variant: "ghost", className: "underline" })} href={`/${locale}/recipes`}>{t("backToManagement")}</Link><Link className={buttonStyles({ variant: "ghost", className: "underline" })} href={`/${locale}/today`}>{t("backToToday")}</Link></div>
    </form>
  );
}
