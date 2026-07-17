import { isUuid } from "@/lib/food-selection/query";
import type { Json } from "@/lib/supabase/database.types";

export type RecipeEditorIngredient = {
  brand_name: string | null;
  calories: number | null;
  carbohydrates_g: number | null;
  fat_g: number | null;
  food_id: string | null;
  ingredient_id: string;
  ingredient_name: string;
  notes: string | null;
  position: number;
  protein_g: number | null;
  quantity: number | null;
  unit: string | null;
};

const ingredientFields = new Set([
  "id",
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function nullableText(value: unknown, maximum: number) {
  return (
    value === null ||
    (typeof value === "string" &&
      value.length >= 1 &&
      value.length <= maximum &&
      value.trim() === value)
  );
}

function nullableNumber(value: unknown, maximum: number, integer = false) {
  return (
    value === null ||
    (typeof value === "number" &&
      Number.isFinite(value) &&
      value >= 0 &&
      value <= maximum &&
      (!integer || Number.isInteger(value)))
  );
}

export function parseRecipeEditorIngredients(
  value: Json,
): RecipeEditorIngredient[] | null {
  if (!Array.isArray(value) || value.length < 1 || value.length > 50) return null;

  const ingredients: RecipeEditorIngredient[] = [];
  const ingredientIds = new Set<string>();
  for (const [index, ingredient] of value.entries()) {
    if (
      !isRecord(ingredient) ||
      Object.keys(ingredient).length !== ingredientFields.size ||
      Object.keys(ingredient).some((field) => !ingredientFields.has(field)) ||
      typeof ingredient.id !== "string" ||
      !isUuid(ingredient.id) ||
      ingredientIds.has(ingredient.id) ||
      ingredient.position !== index + 1 ||
      (ingredient.food_id !== null &&
        (typeof ingredient.food_id !== "string" || !isUuid(ingredient.food_id))) ||
      typeof ingredient.ingredient_name !== "string" ||
      ingredient.ingredient_name.trim() === "" ||
      ingredient.ingredient_name.trim() !== ingredient.ingredient_name ||
      ingredient.ingredient_name.length > 200 ||
      !nullableText(ingredient.brand_name, 120) ||
      !nullableNumber(ingredient.quantity, 9_999_999.999) ||
      !nullableText(ingredient.unit, 40) ||
      ((ingredient.quantity === null) !== (ingredient.unit === null)) ||
      (typeof ingredient.quantity === "number" && ingredient.quantity < 0.001) ||
      !nullableNumber(ingredient.calories, 2_147_483_647, true) ||
      !nullableNumber(ingredient.protein_g, 999_999.99) ||
      !nullableNumber(ingredient.carbohydrates_g, 999_999.99) ||
      !nullableNumber(ingredient.fat_g, 999_999.99) ||
      !nullableText(ingredient.notes, 1000)
    ) {
      return null;
    }

    ingredientIds.add(ingredient.id);

    ingredients.push({
      brand_name: ingredient.brand_name as string | null,
      calories: ingredient.calories as number | null,
      carbohydrates_g: ingredient.carbohydrates_g as number | null,
      fat_g: ingredient.fat_g as number | null,
      food_id: ingredient.food_id as string | null,
      ingredient_id: ingredient.id,
      ingredient_name: ingredient.ingredient_name,
      notes: ingredient.notes as string | null,
      position: ingredient.position,
      protein_g: ingredient.protein_g as number | null,
      quantity: ingredient.quantity as number | null,
      unit: ingredient.unit as string | null,
    });
  }

  return ingredients;
}
