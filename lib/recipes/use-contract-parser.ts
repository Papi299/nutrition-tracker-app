import { isUuid } from "@/lib/food-selection/query";
import { recipeLocales, type RecipeLocale } from "./validation";

export const recipeUseContractStatuses = [
  "ready",
  "archived",
  "invalid_recipe",
  "not_loggable",
  "unavailable",
] as const;

export type RecipeUseContractStatus =
  (typeof recipeUseContractStatuses)[number];

export type RecipeUseNutrientContract = {
  complete: boolean | null;
  diary_value: number | null;
  known_ingredient_count: number | null;
  per_serving_value: number | null;
  requested_value: number | null;
  whole_recipe_value: number | null;
};

export type RecipeUseContract = {
  ingredient_count: number;
  is_archived: boolean;
  nutrients: {
    calories: RecipeUseNutrientContract;
    carbohydrates_g: RecipeUseNutrientContract;
    fat_g: RecipeUseNutrientContract;
    protein_g: RecipeUseNutrientContract;
  };
  recipe_id: string;
  recipe_locale: RecipeLocale;
  recipe_name: string;
  requested_servings: number;
  source_updated_at: string;
  yield_servings: number;
};

export type ParsedRecipeUseContract =
  | { status: "unavailable" }
  | {
      data: RecipeUseContract;
      status: Exclude<RecipeUseContractStatus, "unavailable">;
    };

const localeSet = new Set<string>(recipeLocales);
const statusSet = new Set<string>(recipeUseContractStatuses);
const fields = new Set([
  "result_status",
  "recipe_id",
  "recipe_name",
  "recipe_locale",
  "is_archived",
  "source_updated_at",
  "yield_servings",
  "requested_servings",
  "ingredient_count",
  "calories_known_ingredient_count",
  "calories_complete",
  "calories_whole_recipe",
  "calories_per_serving",
  "calories_requested",
  "protein_known_ingredient_count",
  "protein_complete",
  "protein_whole_recipe",
  "protein_per_serving",
  "protein_requested",
  "carbohydrates_known_ingredient_count",
  "carbohydrates_complete",
  "carbohydrates_whole_recipe",
  "carbohydrates_per_serving",
  "carbohydrates_requested",
  "fat_known_ingredient_count",
  "fat_complete",
  "fat_whole_recipe",
  "fat_per_serving",
  "fat_requested",
  "diary_calories",
  "diary_protein_g",
  "diary_carbohydrates_g",
  "diary_fat_g",
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isFiniteNonnegative(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

function isIntegerInRange(
  value: unknown,
  minimum: number,
  maximum: number,
): value is number {
  return (
    typeof value === "number" &&
    Number.isInteger(value) &&
    value >= minimum &&
    value <= maximum
  );
}

function hasAtMostTwoDecimalPlaces(value: number) {
  const scaled = value * 100;
  return Math.abs(scaled - Math.round(scaled)) < 1e-7;
}

function nutrientFrom(
  value: Record<string, unknown>,
  prefix: "calories" | "carbohydrates" | "fat" | "protein",
  diaryField: string,
): RecipeUseNutrientContract {
  return {
    complete: value[`${prefix}_complete`] as boolean | null,
    diary_value: value[diaryField] as number | null,
    known_ingredient_count: value[
      `${prefix}_known_ingredient_count`
    ] as number | null,
    per_serving_value: value[`${prefix}_per_serving`] as number | null,
    requested_value: value[`${prefix}_requested`] as number | null,
    whole_recipe_value: value[`${prefix}_whole_recipe`] as number | null,
  };
}

function nutrientIsValid(
  nutrient: RecipeUseNutrientContract,
  status: RecipeUseContractStatus,
  ingredientCount: number,
  diaryMaximum: number,
  diaryInteger: boolean,
) {
  if (status === "invalid_recipe") {
    return Object.values(nutrient).every((value) => value === null);
  }

  if (
    !isIntegerInRange(
      nutrient.known_ingredient_count,
      0,
      ingredientCount,
    ) ||
    typeof nutrient.complete !== "boolean" ||
    nutrient.complete !==
      (nutrient.known_ingredient_count === ingredientCount)
  ) {
    return false;
  }

  const exactValues = [
    nutrient.whole_recipe_value,
    nutrient.per_serving_value,
    nutrient.requested_value,
  ];
  if (status !== "ready") {
    return exactValues.every((value) => value === null) && nutrient.diary_value === null;
  }

  if (!nutrient.complete) {
    return exactValues.every((value) => value === null) && nutrient.diary_value === null;
  }

  if (
    !exactValues.every(isFiniteNonnegative) ||
    !isFiniteNonnegative(nutrient.diary_value) ||
    nutrient.diary_value > diaryMaximum
  ) {
    return false;
  }

  return diaryInteger
    ? Number.isInteger(nutrient.diary_value)
    : hasAtMostTwoDecimalPlaces(nutrient.diary_value);
}

export function parseRecipeUseContractPayload(
  value: unknown,
  expectedRequestedServings: number,
): ParsedRecipeUseContract | null {
  if (
    !isRecord(value) ||
    Object.keys(value).length !== fields.size ||
    Object.keys(value).some((field) => !fields.has(field)) ||
    typeof value.result_status !== "string" ||
    !statusSet.has(value.result_status)
  ) {
    return null;
  }

  const status = value.result_status as RecipeUseContractStatus;
  if (status === "unavailable") {
    return Object.entries(value).every(
      ([field, fieldValue]) => field === "result_status" || fieldValue === null,
    )
      ? { status }
      : null;
  }

  if (
    typeof value.recipe_id !== "string" ||
    !isUuid(value.recipe_id) ||
    typeof value.recipe_name !== "string" ||
    value.recipe_name.trim() !== value.recipe_name ||
    value.recipe_name.length < 1 ||
    value.recipe_name.length > 200 ||
    typeof value.recipe_locale !== "string" ||
    !localeSet.has(value.recipe_locale) ||
    typeof value.is_archived !== "boolean" ||
    typeof value.source_updated_at !== "string" ||
    Number.isNaN(Date.parse(value.source_updated_at)) ||
    !isFiniteNonnegative(value.yield_servings) ||
    value.yield_servings < 0.001 ||
    value.yield_servings > 10_000 ||
    value.requested_servings !== expectedRequestedServings ||
    !isFiniteNonnegative(value.requested_servings) ||
    value.requested_servings < 0.001 ||
    value.requested_servings > 10_000 ||
    !isIntegerInRange(value.ingredient_count, status === "invalid_recipe" ? 0 : 1, 50) ||
    (status === "archived" && !value.is_archived) ||
    ((status === "ready" || status === "not_loggable") && value.is_archived)
  ) {
    return null;
  }

  const nutrients = {
    calories: nutrientFrom(value, "calories", "diary_calories"),
    carbohydrates_g: nutrientFrom(
      value,
      "carbohydrates",
      "diary_carbohydrates_g",
    ),
    fat_g: nutrientFrom(value, "fat", "diary_fat_g"),
    protein_g: nutrientFrom(value, "protein", "diary_protein_g"),
  };

  if (
    !nutrientIsValid(
      nutrients.calories,
      status,
      value.ingredient_count,
      2_147_483_647,
      true,
    ) ||
    !nutrientIsValid(
      nutrients.protein_g,
      status,
      value.ingredient_count,
      999_999.99,
      false,
    ) ||
    !nutrientIsValid(
      nutrients.carbohydrates_g,
      status,
      value.ingredient_count,
      999_999.99,
      false,
    ) ||
    !nutrientIsValid(
      nutrients.fat_g,
      status,
      value.ingredient_count,
      999_999.99,
      false,
    )
  ) {
    return null;
  }

  return {
    data: {
      ingredient_count: value.ingredient_count,
      is_archived: value.is_archived,
      nutrients,
      recipe_id: value.recipe_id,
      recipe_locale: value.recipe_locale as RecipeLocale,
      recipe_name: value.recipe_name,
      requested_servings: value.requested_servings,
      source_updated_at: value.source_updated_at,
      yield_servings: value.yield_servings,
    },
    status,
  };
}
