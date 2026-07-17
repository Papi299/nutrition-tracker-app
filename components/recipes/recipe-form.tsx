"use client";

import Link from "next/link";
import { useActionState, useState, useTransition } from "react";
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

function errorId(field: string) {
  return `recipe-${field}-error`;
}

function helpId(field: string) {
  return `recipe-${field}-help`;
}

function describedBy(field: string, error?: string) {
  return error ? `${helpId(field)} ${errorId(field)}` : helpId(field);
}

function FieldError({ code, field }: { code?: string; field: string }) {
  const t = useTranslations("RecipeEditor.errors");
  if (!code) return null;
  const messages: Record<string, string> = {
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
  return <span className="text-sm font-normal text-red-700" id={errorId(field)}>{messages[code] ?? t("validation")}</span>;
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
      <span className="text-sm font-normal leading-5 text-slate-600" id={helpId(field)}>{help}</span>
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
  minimum = 0,
  maximum,
  onChange,
  required = false,
  value,
}: {
  error?: string;
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
    <label className="grid gap-2 text-sm font-medium text-slate-900">
      <span>{label}</span>
      <input
        aria-describedby={describedBy(field, error)}
        aria-invalid={Boolean(error)}
        className="min-h-11 border border-slate-300 bg-white px-3 text-base text-slate-950 outline-none focus:border-teal-700"
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
      <span className="text-sm font-normal leading-5 text-slate-600" id={helpId(field)}>{help}</span>
      <FieldError code={error} field={field} />
    </label>
  );
}

function FoodPicker({
  disabled,
  onSelect,
}: {
  disabled: boolean;
  onSelect: (value: Awaited<ReturnType<typeof selectRecipeIngredientFoodAction>> extends infer R ? R : never) => void;
}) {
  const t = useTranslations("RecipeEditor.picker");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<RecipeFoodPickerResult[]>([]);
  const [status, setStatus] = useState<"idle" | "too_short" | "error" | "ready">("idle");
  const [pending, startTransition] = useTransition();

  function search() {
    startTransition(async () => {
      const result = await searchRecipeIngredientFoodsAction(query);
      if (result.status === "ready") {
        setResults(result.results);
        setStatus("ready");
      } else {
        setResults([]);
        setStatus(result.status === "too_short" ? "too_short" : "error");
      }
    });
  }

  function select(foodId: string) {
    startTransition(async () => {
      const result = await selectRecipeIngredientFoodAction(foodId);
      if (result.status !== "ready") setStatus("error");
      onSelect(result);
    });
  }

  return (
    <div className="grid gap-3 border border-teal-200 bg-teal-50 p-4" data-testid="recipe-food-picker">
      <p className="text-sm font-semibold text-teal-950">{t("title")}</p>
      <p className="text-sm leading-6 text-teal-950">{t("help")}</p>
      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          aria-label={t("label")}
          className="min-h-11 flex-1 border border-slate-300 bg-white px-3 text-base"
          dir="auto"
          disabled={disabled || pending}
          maxLength={100}
          onChange={(event) => setQuery(event.target.value)}
          type="search"
          value={query}
        />
        <button className="min-h-11 bg-teal-700 px-4 text-sm font-semibold text-white disabled:bg-slate-300" disabled={disabled || pending} onClick={search} type="button">
          {pending ? t("pending") : t("search")}
        </button>
      </div>
      {status === "too_short" && <p className="text-sm text-amber-900" role="alert">{t("tooShort")}</p>}
      {status === "error" && <p className="text-sm text-red-800" role="alert">{t("error")}</p>}
      {status === "ready" && results.length === 0 && <p className="text-sm text-slate-700">{t("empty")}</p>}
      {results.length > 0 && (
        <ul className="grid gap-2">
          {results.map((result) => (
            <li className="flex flex-col gap-2 border border-slate-200 bg-white p-3 sm:flex-row sm:items-center sm:justify-between" key={result.food_id}>
              <div>
                <p className="font-semibold text-slate-950" dir="auto">{result.name}</p>
                {result.brand_name && <p className="text-sm text-slate-600" dir="auto">{result.brand_name}</p>}
                <p className="text-xs text-slate-500">{result.is_owned ? t("owned") : t("public")} · {result.source_name ?? t("unknownSource")}</p>
              </div>
              <button className="min-h-10 border border-teal-700 px-3 text-sm font-semibold text-teal-800" disabled={pending} onClick={() => select(result.food_id)} type="button">{t("select")}</button>
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
  ingredient,
  ingredientCount,
  move,
  remove,
  update,
}: {
  fieldErrors: Record<string, string>;
  index: number;
  isLinked: boolean;
  isPending: boolean;
  ingredient: RecipeFormIngredientValues;
  ingredientCount: number;
  move: (direction: -1 | 1) => void;
  remove: () => void;
  update: (value: Partial<RecipeFormIngredientValues>) => void;
}) {
  const t = useTranslations("RecipeEditor");
  const field = (name: string) => `ingredient_${name}_${index}`;

  return (
    <fieldset className="grid gap-5 border border-slate-200 bg-stone-50 p-4 sm:p-5" data-row-key={ingredient.row_key} data-testid="recipe-ingredient">
      <legend className="px-2 text-base font-semibold text-slate-950">{t("ingredients.number", { number: index + 1 })}</legend>
      <input name={field("row_key")} type="hidden" value={ingredient.row_key} />
      <input name={field("selected_food_id")} type="hidden" value={ingredient.selected_food_id} />
      <input name={field("remove_food_link")} type="hidden" value={ingredient.remove_food_link ? "1" : "0"} />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <span className={isLinked ? "inline-flex bg-teal-100 px-3 py-1 text-xs font-semibold text-teal-900" : "inline-flex bg-slate-200 px-3 py-1 text-xs font-semibold text-slate-700"}>
            {t(isLinked ? "ingredients.linked" : "ingredients.unlinked")}
          </span>
          {ingredient.remove_food_link && <p className="mt-2 text-sm text-amber-800" role="status">{t("ingredients.linkRemoved")}</p>}
        </div>
        <div className="flex flex-wrap gap-2">
          <button aria-label={t("ingredients.moveUpLabel", { number: index + 1 })} className="min-h-10 border border-slate-300 bg-white px-3 text-sm font-semibold disabled:text-slate-400" disabled={isPending || index === 0} onClick={() => move(-1)} type="button">{t("ingredients.moveUp")}</button>
          <button aria-label={t("ingredients.moveDownLabel", { number: index + 1 })} className="min-h-10 border border-slate-300 bg-white px-3 text-sm font-semibold disabled:text-slate-400" disabled={isPending || index === ingredientCount - 1} onClick={() => move(1)} type="button">{t("ingredients.moveDown")}</button>
          {isLinked && <button className="min-h-10 border border-amber-400 bg-white px-3 text-sm font-semibold text-amber-900" disabled={isPending} onClick={() => update({ remove_food_link: true, selected_food_id: "" })} type="button">{t("ingredients.removeLink")}</button>}
          <button className="min-h-10 border border-red-300 bg-white px-3 text-sm font-semibold text-red-800 disabled:text-slate-400" disabled={isPending || ingredientCount === 1} onClick={remove} type="button">{t("ingredients.remove")}</button>
        </div>
      </div>

      <FieldError code={fieldErrors[field("row_key")]} field={field("row_key")} />
      <FoodPicker
        disabled={isPending}
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

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2"><TextInput error={fieldErrors[field("ingredient_name")]} field={field("ingredient_name")} help={t("help.ingredientName")} label={t("fields.ingredientName")} maxLength={200} onChange={(ingredient_name) => update({ ingredient_name })} required value={ingredient.ingredient_name} /></div>
        <TextInput error={fieldErrors[field("brand_name")]} field={field("brand_name")} help={t("help.brand")} label={t("fields.brand")} maxLength={120} onChange={(brand_name) => update({ brand_name })} value={ingredient.brand_name} />
        <div />
        <NumberInput error={fieldErrors[field("quantity")]} field={field("quantity")} help={t("help.quantity")} label={t("fields.quantity")} maximum={9_999_999.999} minimum={0.001} onChange={(quantity) => update({ quantity })} value={ingredient.quantity} />
        <TextInput error={fieldErrors[field("unit")]} field={field("unit")} help={t("help.unit")} label={t("fields.unit")} maxLength={40} onChange={(unit) => update({ unit })} value={ingredient.unit} />
        <div className="sm:col-span-2"><FieldError code={fieldErrors[field("quantity_unit")]} field={field("quantity_unit")} /></div>
        <NumberInput error={fieldErrors[field("calories")]} field={field("calories")} help={t("help.calories")} integer label={t("fields.calories")} maximum={2_147_483_647} onChange={(calories) => update({ calories })} value={ingredient.calories} />
        <NumberInput error={fieldErrors[field("protein_g")]} field={field("protein_g")} help={t("help.protein")} label={t("fields.protein")} maximum={999_999.99} onChange={(protein_g) => update({ protein_g })} value={ingredient.protein_g} />
        <NumberInput error={fieldErrors[field("carbohydrates_g")]} field={field("carbohydrates_g")} help={t("help.carbohydrates")} label={t("fields.carbohydrates")} maximum={999_999.99} onChange={(carbohydrates_g) => update({ carbohydrates_g })} value={ingredient.carbohydrates_g} />
        <NumberInput error={fieldErrors[field("fat_g")]} field={field("fat_g")} help={t("help.fat")} label={t("fields.fat")} maximum={999_999.99} onChange={(fat_g) => update({ fat_g })} value={ingredient.fat_g} />
        <label className="grid gap-2 text-sm font-medium text-slate-900 sm:col-span-2">
          <span>{t("fields.notes")}</span>
          <textarea aria-describedby={describedBy(field("notes"), fieldErrors[field("notes")])} aria-invalid={Boolean(fieldErrors[field("notes")])} className="min-h-24 border border-slate-300 bg-white px-3 py-2 text-base" dir="auto" maxLength={1000} name={field("notes")} onChange={(event) => update({ notes: event.target.value })} value={ingredient.notes} />
          <span className="text-sm font-normal leading-5 text-slate-600" id={helpId(field("notes"))}>{t("help.notes")}</span>
          <FieldError code={fieldErrors[field("notes")]} field={field("notes")} />
        </label>
      </div>
      <p className="text-sm leading-6 text-slate-600">{t("ingredients.snapshotHelp")}</p>
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
  const [state, formAction, isPending] = useActionState(action, initialState);
  const [ingredients, setIngredients] = useState(state.values.ingredients);
  const [yieldServings, setYieldServings] = useState(state.values.yield_servings);
  const linkedRows = new Set(linkedRowKeys);
  const fieldErrors = state.fieldErrors ?? {};
  const statusMessage = {
    database_error: t("status.databaseError"),
    idle: t("status.idle"),
    not_found: t("status.notFound"),
    unauthenticated: t("status.unauthenticated"),
    validation_error: t("status.validationError"),
  }[state.status];

  function updateIngredient(index: number, update: Partial<RecipeFormIngredientValues>) {
    setIngredients((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, ...update } : item));
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
    <form action={formAction} className="grid gap-8 text-start" noValidate>
      <input name="recipe_id" type="hidden" value={state.values.recipe_id} />
      <input name="ingredient_count" type="hidden" value={ingredients.length} />

      {saved && <div className="border-s-4 border-teal-600 bg-teal-50 px-4 py-3 text-sm text-teal-900" data-testid="recipe-success" role="status">{t(saved === "created" ? "status.created" : "status.updated")}</div>}
      {archived && <div className="border-s-4 border-amber-500 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-950" data-testid="recipe-archived-notice" role="status">{t("archivedNotice")}</div>}

      <section className="grid gap-5" aria-labelledby="recipe-identity-title">
        <div><h2 className="text-xl font-semibold text-slate-950" id="recipe-identity-title">{t("identity.title")}</h2><p className="mt-2 text-sm leading-6 text-slate-600">{t("identity.help")}</p></div>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="grid gap-2 text-sm font-medium text-slate-900 sm:col-span-2">
            <span>{t("identity.name")}</span>
            <input aria-describedby={describedBy("name", fieldErrors.name)} aria-invalid={Boolean(fieldErrors.name)} className="min-h-12 border border-slate-300 bg-white px-3 text-base" defaultValue={state.values.name} dir="auto" key={state.values.name} maxLength={200} name="name" required type="text" />
            <span className="text-sm font-normal text-slate-600" id={helpId("name")}>{t("help.name")}</span><FieldError code={fieldErrors.name} field="name" />
          </label>
          <label className="grid gap-2 text-sm font-medium text-slate-900">
            <span>{t("identity.language")}</span>
            <select aria-describedby={describedBy("recipe_locale", fieldErrors.recipe_locale)} aria-invalid={Boolean(fieldErrors.recipe_locale)} className="min-h-12 border border-slate-300 bg-white px-3 text-base" defaultValue={state.values.recipe_locale} key={state.values.recipe_locale} name="recipe_locale"><option value="en">{t("languages.en")}</option><option value="he">{t("languages.he")}</option><option value="und">{t("languages.und")}</option></select>
            <span className="text-sm font-normal text-slate-600" id={helpId("recipe_locale")}>{t("help.language")}</span><FieldError code={fieldErrors.recipe_locale} field="recipe_locale" />
          </label>
          <NumberInput error={fieldErrors.yield_servings} field="yield_servings" help={t("help.yield")} label={t("identity.yield")} maximum={10_000} minimum={0.001} onChange={setYieldServings} required value={yieldServings} />
        </div>
      </section>

      <section className="grid gap-5 border-t border-slate-200 pt-6" aria-labelledby="recipe-ingredients-title">
        <div><h2 className="text-xl font-semibold text-slate-950" id="recipe-ingredients-title">{t("ingredients.title")}</h2><p className="mt-2 text-sm leading-6 text-slate-600">{t("ingredients.help")}</p></div>
        <FieldError code={fieldErrors.ingredients} field="ingredients" />
        <div className="grid gap-5">
          {ingredients.map((ingredient, index) => (
            <RecipeIngredientCard fieldErrors={fieldErrors} index={index} ingredient={ingredient} ingredientCount={ingredients.length} isLinked={(linkedRows.has(ingredient.row_key) || ingredient.selected_food_id !== "") && !ingredient.remove_food_link} isPending={isPending} key={ingredient.row_key} move={(direction) => moveIngredient(index, direction)} remove={() => setIngredients((current) => current.filter((_, itemIndex) => itemIndex !== index))} update={(update) => updateIngredient(index, update)} />
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <button className="min-h-11 border border-teal-700 bg-white px-4 text-sm font-semibold text-teal-800 disabled:text-slate-400" disabled={isPending || ingredients.length >= 50} onClick={() => setIngredients((current) => [...current, blankRecipeIngredient(recipeRowKey("client", crypto.randomUUID()))])} type="button">{t("ingredients.add")}</button>
          <span className="text-sm text-slate-600">{t("ingredients.count", { count: ingredients.length })}</span>
        </div>
      </section>

      <div className="grid gap-4 border-t border-slate-200 pt-6 sm:grid-cols-[1fr_auto] sm:items-center">
        <div className={state.status === "idle" ? "text-sm text-slate-600" : "text-sm text-red-800"} role={state.status === "idle" ? "status" : "alert"}>{statusMessage}</div>
        <button className="min-h-12 bg-teal-700 px-5 text-base font-semibold text-white disabled:bg-slate-300" disabled={isPending} type="submit">{isPending ? t(mode === "create" ? "submit.createPending" : "submit.updatePending") : t(mode === "create" ? "submit.create" : "submit.update")}</button>
      </div>
      <div className="flex flex-wrap gap-4"><Link className="text-sm font-semibold text-teal-800 underline" href={`/${locale}/recipes`}>{t("backToManagement")}</Link><Link className="text-sm font-semibold text-teal-800 underline" href={`/${locale}/today`}>{t("backToToday")}</Link></div>
    </form>
  );
}
