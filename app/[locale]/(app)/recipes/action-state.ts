import type { AllFoodNutrientReference, AllNutrientField } from "@/lib/food-selection/nutrient-scaling";
import { additionalSnapshotFormState, type AdditionalNutrientFormState } from "@/lib/nutrition-snapshots/form-state";
import { emptyAdditionalNutrientSnapshot } from "@/lib/nutrition-snapshots";
import type { OwnedRecipeEditor } from "@/lib/recipes";
import { recipeRowKey } from "@/lib/recipes/row-identity";
import type { Locale } from "@/lib/i18n/routing";

export type RecipeFormIngredientValues = AdditionalNutrientFormState & {
  reference: AllFoodNutrientReference | null;
  reference_fingerprint: string;
  automatic_values: Partial<Record<AllNutrientField, string>>;
  brand_name: string;
  calories: string;
  carbohydrates_g: string;
  fat_g: string;
  ingredient_name: string;
  notes: string;
  protein_g: string;
  quantity: string;
  remove_food_link: boolean;
  row_key: string;
  selected_food_id: string;
  unit: string;
};

export type RecipeFormValues = {
  ingredients: RecipeFormIngredientValues[];
  name: string;
  recipe_id: string;
  recipe_locale: string;
  yield_servings: string;
};

export type RecipeActionState = {
  fieldErrors?: Record<string, string>;
  status:
    | "conflict"
    | "database_error"
    | "idle"
    | "not_found"
    | "unauthenticated"
    | "validation_error";
  values: RecipeFormValues;
};

export type RecipeFoodLinkBinding = {
  food_id: string | null;
  row_key: string;
};

function inputValue(value: null | number | string) {
  return value === null ? "" : String(value);
}

export function blankRecipeIngredient(rowKey: string): RecipeFormIngredientValues {
  return {
    ...additionalSnapshotFormState(emptyAdditionalNutrientSnapshot()),
    reference: null, reference_fingerprint: "", automatic_values: {},
    brand_name: "",
    calories: "",
    carbohydrates_g: "",
    fat_g: "",
    ingredient_name: "",
    notes: "",
    protein_g: "",
    quantity: "",
    remove_food_link: false,
    row_key: rowKey,
    selected_food_id: "",
    unit: "",
  };
}

export function newRecipeFormValues(
  locale: Locale,
  rowKey: string,
): RecipeFormValues {
  return {
    ingredients: [blankRecipeIngredient(rowKey)],
    name: "",
    recipe_id: "",
    recipe_locale: locale,
    yield_servings: "1",
  };
}

export function editorRecipeFormValues(editor: OwnedRecipeEditor): RecipeFormValues {
  return {
    ingredients: editor.ingredients.map((ingredient) => ({
      ...additionalSnapshotFormState(ingredient.additional_nutrient_snapshot),
      reference: null, reference_fingerprint: "", automatic_values: {},
      brand_name: inputValue(ingredient.brand_name),
      calories: inputValue(ingredient.calories),
      carbohydrates_g: inputValue(ingredient.carbohydrates_g),
      fat_g: inputValue(ingredient.fat_g),
      ingredient_name: ingredient.ingredient_name,
      notes: inputValue(ingredient.notes),
      protein_g: inputValue(ingredient.protein_g),
      quantity: inputValue(ingredient.quantity),
      remove_food_link: false,
      row_key: recipeRowKey("ingredient", ingredient.ingredient_id),
      selected_food_id: "",
      unit: inputValue(ingredient.unit),
    })),
    name: editor.name,
    recipe_id: editor.recipe_id,
    recipe_locale: editor.locale,
    yield_servings: String(editor.yield_servings),
  };
}
