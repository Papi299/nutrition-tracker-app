import { validationError, type DataResult } from "@/lib/data/result";
import { isUuid } from "@/lib/food-selection/query";

export const recipeLocales = ["en", "he", "und"] as const;
export type RecipeLocale = (typeof recipeLocales)[number];

export type RecipeInput = Record<string, unknown>;
export type RecipeArchiveInput = Record<string, unknown>;

export type ValidatedRecipeIngredient = {
  position: number;
  food_id: string | null;
  ingredient_name: string;
  brand_name: string | null;
  quantity: number | null;
  unit: string | null;
  calories: number | null;
  protein_g: number | null;
  carbohydrates_g: number | null;
  fat_g: number | null;
  notes: string | null;
};

export type ValidatedRecipeInput = {
  recipe_id: string | null;
  name: string;
  locale: RecipeLocale;
  yield_servings: number;
  ingredients: ValidatedRecipeIngredient[];
};

export type ValidatedRecipeArchiveInput = {
  recipe_id: string;
  is_archived: boolean;
};

const localeSet = new Set<string>(recipeLocales);
const persistenceFields = new Set([
  "recipe_id",
  "name",
  "locale",
  "yield_servings",
  "ingredients",
]);
const archiveFields = new Set(["recipe_id", "is_archived"]);
const ingredientFields = new Set([
  "position",
  "food_id",
  "ingredient_name",
  "brand_name",
  "quantity",
  "unit",
  "calories",
  "protein_g",
  "carbohydrates_g",
  "fat_g",
  "notes",
]);

function isObjectRecord(input: unknown): input is Record<string, unknown> {
  return typeof input === "object" && input !== null && !Array.isArray(input);
}

function rejectUnsupportedFields(
  input: Record<string, unknown>,
  allowed: Set<string>,
  fieldErrors: Record<string, string>,
  prefix = "",
) {
  for (const field of Object.keys(input)) {
    if (!allowed.has(field)) fieldErrors[`${prefix}${field}`] = "unsupported_field";
  }
}

function parseRequiredText(
  value: unknown,
  maximumLength: number,
  field: string,
  fieldErrors: Record<string, string>,
) {
  if (typeof value !== "string" || value.trim() === "") {
    fieldErrors[field] = "required";
    return "";
  }

  const normalized = value.trim();
  if (Array.from(normalized).length > maximumLength) fieldErrors[field] = "too_long";
  return normalized;
}

function parseOptionalText(
  value: unknown,
  maximumLength: number,
  field: string,
  fieldErrors: Record<string, string>,
) {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string") {
    fieldErrors[field] = "invalid_type";
    return null;
  }

  const normalized = value.trim();
  if (normalized === "") return null;
  if (Array.from(normalized).length > maximumLength) fieldErrors[field] = "too_long";
  return normalized;
}

function parseNumber(
  value: unknown,
  options: {
    allowBlank: boolean;
    maximum: number;
    minimum: number;
    integer?: boolean;
  },
  field: string,
  fieldErrors: Record<string, string>,
) {
  if (
    options.allowBlank &&
    (value === undefined ||
      value === null ||
      (typeof value === "string" && value.trim() === ""))
  ) {
    return null;
  }

  if (typeof value !== "number" && typeof value !== "string") {
    fieldErrors[field] = "invalid_number";
    return null;
  }

  const parsed = typeof value === "number" ? value : Number(value);
  if (
    !Number.isFinite(parsed) ||
    parsed < options.minimum ||
    parsed > options.maximum
  ) {
    fieldErrors[field] = "number_out_of_range";
    return null;
  }

  if (options.integer && !Number.isInteger(parsed)) {
    fieldErrors[field] = "integer_required";
  }

  return parsed;
}

function validateIngredient(
  input: unknown,
  index: number,
  fieldErrors: Record<string, string>,
): ValidatedRecipeIngredient | null {
  const prefix = `ingredients.${index}.`;

  if (!isObjectRecord(input)) {
    fieldErrors[`ingredients.${index}`] = "invalid_ingredient";
    return null;
  }

  rejectUnsupportedFields(input, ingredientFields, fieldErrors, prefix);
  for (const field of ingredientFields) {
    if (!(field in input)) fieldErrors[`${prefix}${field}`] = "required_field";
  }

  const rawPosition = input.position;
  const position =
    typeof rawPosition === "number"
      ? rawPosition
      : typeof rawPosition === "string" && rawPosition.trim() !== ""
        ? Number(rawPosition)
        : Number.NaN;
  if (!Number.isInteger(position) || position < 1 || position > 50) {
    fieldErrors[`${prefix}position`] = "position_out_of_range";
  }

  let foodId: string | null = null;
  if (input.food_id !== undefined && input.food_id !== null && input.food_id !== "") {
    if (typeof input.food_id !== "string" || !isUuid(input.food_id)) {
      fieldErrors[`${prefix}food_id`] = "invalid_uuid";
    } else {
      foodId = input.food_id;
    }
  }

  const quantity = parseNumber(
    input.quantity,
    { allowBlank: true, maximum: 9_999_999.999, minimum: 0.001 },
    `${prefix}quantity`,
    fieldErrors,
  );
  const unit = parseOptionalText(input.unit, 40, `${prefix}unit`, fieldErrors);
  if ((quantity === null) !== (unit === null)) {
    fieldErrors[`${prefix}quantity_unit`] = "both_or_neither_required";
  }

  return {
    position: Number.isFinite(position) ? position : 0,
    food_id: foodId,
    ingredient_name: parseRequiredText(
      input.ingredient_name,
      200,
      `${prefix}ingredient_name`,
      fieldErrors,
    ),
    brand_name: parseOptionalText(input.brand_name, 120, `${prefix}brand_name`, fieldErrors),
    quantity,
    unit,
    calories: parseNumber(
      input.calories,
      { allowBlank: true, integer: true, maximum: 2_147_483_647, minimum: 0 },
      `${prefix}calories`,
      fieldErrors,
    ),
    protein_g: parseNumber(
      input.protein_g,
      { allowBlank: true, maximum: 999_999.99, minimum: 0 },
      `${prefix}protein_g`,
      fieldErrors,
    ),
    carbohydrates_g: parseNumber(
      input.carbohydrates_g,
      { allowBlank: true, maximum: 999_999.99, minimum: 0 },
      `${prefix}carbohydrates_g`,
      fieldErrors,
    ),
    fat_g: parseNumber(
      input.fat_g,
      { allowBlank: true, maximum: 999_999.99, minimum: 0 },
      `${prefix}fat_g`,
      fieldErrors,
    ),
    notes: parseOptionalText(input.notes, 1000, `${prefix}notes`, fieldErrors),
  };
}

export function validateRecipeInput(
  input: RecipeInput,
): DataResult<ValidatedRecipeInput> {
  const fieldErrors: Record<string, string> = {};
  if (!isObjectRecord(input)) return validationError({ form: "invalid_input" });

  rejectUnsupportedFields(input, persistenceFields, fieldErrors);

  let recipeId: string | null = null;
  if (input.recipe_id !== undefined && input.recipe_id !== null && input.recipe_id !== "") {
    if (typeof input.recipe_id !== "string" || !isUuid(input.recipe_id)) {
      fieldErrors.recipe_id = "invalid_uuid";
    } else {
      recipeId = input.recipe_id;
    }
  }

  const name = parseRequiredText(input.name, 200, "name", fieldErrors);
  const locale =
    typeof input.locale === "string" && localeSet.has(input.locale)
      ? (input.locale as RecipeLocale)
      : "und";
  if (locale === "und" && input.locale !== "und") fieldErrors.locale = "unsupported_locale";

  const yieldServings = parseNumber(
    input.yield_servings,
    { allowBlank: false, maximum: 10_000, minimum: 0.001 },
    "yield_servings",
    fieldErrors,
  );

  const ingredients: ValidatedRecipeIngredient[] = [];
  const rawIngredients = input.ingredients;
  if (!Array.isArray(rawIngredients)) {
    fieldErrors.ingredients = "invalid_collection";
  } else if (rawIngredients.length < 1 || rawIngredients.length > 50) {
    fieldErrors.ingredients = "ingredient_count_out_of_range";
  } else {
    rawIngredients.forEach((ingredient, index) => {
      const validated = validateIngredient(ingredient, index, fieldErrors);
      if (validated) ingredients.push(validated);
    });

    const positions = ingredients.map((ingredient) => ingredient.position);
    const uniquePositions = new Set(positions);
    const contiguous =
      uniquePositions.size === rawIngredients.length &&
      Array.from({ length: rawIngredients.length }, (_, index) => index + 1).every(
        (position) => uniquePositions.has(position),
      );
    if (!contiguous) fieldErrors.ingredients = "positions_must_be_contiguous";
  }

  if (Object.keys(fieldErrors).length > 0 || yieldServings === null) {
    return validationError(fieldErrors);
  }

  return {
    data: {
      recipe_id: recipeId,
      name,
      locale,
      yield_servings: yieldServings,
      ingredients,
    },
    ok: true,
  };
}

export function validateRecipeArchiveInput(
  input: RecipeArchiveInput,
): DataResult<ValidatedRecipeArchiveInput> {
  const fieldErrors: Record<string, string> = {};
  if (!isObjectRecord(input)) return validationError({ form: "invalid_input" });

  rejectUnsupportedFields(input, archiveFields, fieldErrors);
  if (typeof input.recipe_id !== "string" || !isUuid(input.recipe_id)) {
    fieldErrors.recipe_id = "invalid_uuid";
  }
  if (typeof input.is_archived !== "boolean") {
    fieldErrors.is_archived = "boolean_required";
  }

  if (Object.keys(fieldErrors).length > 0) return validationError(fieldErrors);
  return {
    data: {
      recipe_id: input.recipe_id as string,
      is_archived: input.is_archived as boolean,
    },
    ok: true,
  };
}
