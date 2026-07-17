"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { resolveAuthLocale } from "@/lib/auth/require-user";
import { getReadableFoodDiaryPrefill } from "@/lib/food-selection";
import { isUuid } from "@/lib/food-selection/query";
import { searchReadableFoods } from "@/lib/food-search";
import {
  parseRecipeRowKey,
  persistRecipeForCurrentUser,
  validateRecipeInput,
} from "@/lib/recipes";
import type {
  RecipeActionState,
  RecipeFoodLinkBinding,
  RecipeFormIngredientValues,
  RecipeFormValues,
} from "./action-state";

const maximumReadIngredientCount = 51;

export type RecipeFoodPickerResult = {
  brand_name: string | null;
  food_id: string;
  is_owned: boolean;
  name: string;
  source_name: string | null;
};

export type RecipeFoodSearchResult =
  | { status: "database_error" | "too_short" | "validation_error" }
  | { results: RecipeFoodPickerResult[]; status: "ready" }
  | { status: "unauthenticated" };

export type RecipeFoodSelectionResult =
  | { status: "database_error" | "unavailable" | "unauthenticated" }
  | {
      status: "ready";
      value: {
        brand_name: string;
        calories: string;
        carbohydrates_g: string;
        fat_g: string;
        food_id: string;
        ingredient_name: string;
        protein_g: string;
        quantity: string;
        unit: string;
      };
    };

function readText(formData: FormData, name: string) {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

function readIngredients(formData: FormData) {
  const rawCount = readText(formData, "ingredient_count");
  const parsedCount = Number(rawCount);
  const count = Number.isInteger(parsedCount)
    ? Math.max(0, Math.min(parsedCount, maximumReadIngredientCount))
    : 0;
  const ingredients: RecipeFormIngredientValues[] = [];

  for (let index = 0; index < count; index += 1) {
    ingredients.push({
      brand_name: readText(formData, `ingredient_brand_name_${index}`),
      calories: readText(formData, `ingredient_calories_${index}`),
      carbohydrates_g: readText(formData, `ingredient_carbohydrates_g_${index}`),
      fat_g: readText(formData, `ingredient_fat_g_${index}`),
      ingredient_name: readText(formData, `ingredient_ingredient_name_${index}`),
      notes: readText(formData, `ingredient_notes_${index}`),
      protein_g: readText(formData, `ingredient_protein_g_${index}`),
      quantity: readText(formData, `ingredient_quantity_${index}`),
      remove_food_link:
        readText(formData, `ingredient_remove_food_link_${index}`) === "1",
      row_key: readText(formData, `ingredient_row_key_${index}`),
      selected_food_id: readText(
        formData,
        `ingredient_selected_food_id_${index}`,
      ),
      unit: readText(formData, `ingredient_unit_${index}`),
    });
  }

  return {
    countIsValid: parsedCount === count && count >= 1 && count <= 50,
    ingredients,
  };
}

function readValues(formData: FormData): {
  countIsValid: boolean;
  values: RecipeFormValues;
} {
  const ingredientRead = readIngredients(formData);
  return {
    countIsValid: ingredientRead.countIsValid,
    values: {
      ingredients: ingredientRead.ingredients,
      name: readText(formData, "name"),
      recipe_id: readText(formData, "recipe_id"),
      recipe_locale: readText(formData, "recipe_locale"),
      yield_servings: readText(formData, "yield_servings"),
    },
  };
}

function formField(field: string) {
  const match = /^ingredients\.(\d+)\.(.+)$/.exec(field);
  if (match) return `ingredient_${match[2]}_${match[1]}`;
  if (field === "locale") return "recipe_locale";
  return field;
}

function mapValidationErrors(fieldErrors?: Record<string, string>) {
  return Object.fromEntries(
    Object.entries(fieldErrors ?? {}).map(([field, code]) => [formField(field), code]),
  );
}

export async function searchRecipeIngredientFoodsAction(
  query: string,
): Promise<RecipeFoodSearchResult> {
  const result = await searchReadableFoods(query);
  if (result.status === "ready") {
    return {
      results: result.data.map((food) => ({
        brand_name: food.brand_name,
        food_id: food.food_id,
        is_owned: food.is_owned,
        name: food.name,
        source_name: food.source_name,
      })),
      status: "ready",
    };
  }
  if (result.status === "initial" || result.status === "too_short") {
    return { status: "too_short" };
  }
  if (result.status === "validation_error") return { status: "validation_error" };
  return { status: result.status };
}

export async function selectRecipeIngredientFoodAction(
  foodId: string,
): Promise<RecipeFoodSelectionResult> {
  const result = await getReadableFoodDiaryPrefill(foodId);
  if (result.status !== "ready") {
    if (result.status === "invalid" || result.status === "repeated" || result.status === "missing") {
      return { status: "unavailable" };
    }
    return { status: result.status };
  }

  const completeQuantity =
    result.data.serving_quantity !== null && result.data.serving_unit !== null;
  const text = (value: number | null) => (value === null ? "" : String(value));
  return {
    status: "ready",
    value: {
      brand_name: result.data.brand_name ?? "",
      calories: text(result.data.calories),
      carbohydrates_g: text(result.data.carbohydrates_g),
      fat_g: text(result.data.fat_g),
      food_id: result.data.food_id,
      ingredient_name: result.data.name,
      protein_g: text(result.data.protein_g),
      quantity: completeQuantity ? String(result.data.serving_quantity) : "",
      unit: completeQuantity ? (result.data.serving_unit ?? "") : "",
    },
  };
}

export async function saveRecipeAction(
  localeInput: string,
  expectedRecipeId: string | null,
  bindings: RecipeFoodLinkBinding[],
  _previousState: RecipeActionState,
  formData: FormData,
): Promise<RecipeActionState> {
  const locale = resolveAuthLocale(localeInput);
  const read = readValues(formData);
  const values = read.values;
  const fieldErrors: Record<string, string> = {};
  const bindingMap = new Map(bindings.map((binding) => [binding.row_key, binding.food_id]));
  const seenRowKeys = new Set<string>();

  if (values.recipe_id !== (expectedRecipeId ?? "")) {
    fieldErrors.recipe_id = "invalid_link";
  }
  if (!read.countIsValid) fieldErrors.ingredients = "ingredient_count_out_of_range";

  const ingredients = await Promise.all(
    values.ingredients.map(async (ingredient, index) => {
      const rowKey = parseRecipeRowKey(ingredient.row_key);
      if (!rowKey) {
        fieldErrors[`ingredient_row_key_${index}`] = "invalid_row_key";
      } else if (
        rowKey.kind === "ingredient" &&
        !bindingMap.has(ingredient.row_key)
      ) {
        fieldErrors[`ingredient_row_key_${index}`] = "invalid_row_key";
      } else if (seenRowKeys.has(ingredient.row_key)) {
        fieldErrors[`ingredient_row_key_${index}`] = "duplicate_row_key";
      }
      seenRowKeys.add(ingredient.row_key);

      let foodId = bindingMap.get(ingredient.row_key) ?? null;
      if (ingredient.remove_food_link) {
        foodId = null;
      } else if (ingredient.selected_food_id !== "") {
        if (!isUuid(ingredient.selected_food_id)) {
          fieldErrors[`ingredient_row_key_${index}`] = "invalid_link";
        } else {
          const selection = await getReadableFoodDiaryPrefill(
            ingredient.selected_food_id,
          );
          if (selection.status === "ready") {
            foodId = selection.data.food_id;
          } else {
            fieldErrors[`ingredient_row_key_${index}`] = "invalid_link";
          }
        }
      }

      return {
        brand_name: ingredient.brand_name,
        calories: ingredient.calories,
        carbohydrates_g: ingredient.carbohydrates_g,
        fat_g: ingredient.fat_g,
        food_id: foodId,
        ingredient_name: ingredient.ingredient_name,
        notes: ingredient.notes,
        position: index + 1,
        protein_g: ingredient.protein_g,
        quantity: ingredient.quantity,
        unit: ingredient.unit,
      };
    }),
  );
  const input = {
    ingredients,
    locale: values.recipe_locale,
    name: values.name,
    recipe_id: expectedRecipeId,
    yield_servings: values.yield_servings,
  };
  const validation = validateRecipeInput(input);
  if (!validation.ok) {
    Object.assign(fieldErrors, mapValidationErrors(validation.fieldErrors));
  }

  if (Object.keys(fieldErrors).length > 0) {
    return { fieldErrors, status: "validation_error", values };
  }

  const result = await persistRecipeForCurrentUser(input);
  if (!result.ok) {
    if (result.code === "validation_error") {
      return {
        fieldErrors: mapValidationErrors(result.fieldErrors),
        status: "validation_error",
        values,
      };
    }
    return {
      status: result.code === "already_exists" ? "database_error" : result.code,
      values,
    };
  }

  revalidatePath(`/${locale}/recipes`);
  revalidatePath(`/${locale}/recipes/${result.data.recipe_id}/edit`);
  redirect(
    `/${locale}/recipes/${result.data.recipe_id}/edit?saved=${expectedRecipeId ? "updated" : "created"}`,
  );
}
