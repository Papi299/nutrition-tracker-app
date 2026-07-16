import { isUuid } from "@/lib/food-selection/query";
import type { Json } from "@/lib/supabase/database.types";

export type SavedMealEditorItem = {
  brand_name: string | null;
  calories: number | null;
  carbohydrates_g: number | null;
  fat_g: number | null;
  food_id: string | null;
  food_name: string;
  item_id: string;
  notes: string | null;
  position: number;
  protein_g: number | null;
  serving_quantity: number | null;
  serving_unit: string | null;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNullableText(value: unknown) {
  return value === null || typeof value === "string";
}

function isNullableNumber(value: unknown, integer = false) {
  return (
    value === null ||
    (typeof value === "number" &&
      Number.isFinite(value) &&
      value >= 0 &&
      (!integer || Number.isInteger(value)))
  );
}

export function parseSavedMealEditorItems(
  value: Json,
): SavedMealEditorItem[] | null {
  if (!Array.isArray(value) || value.length < 1 || value.length > 50) {
    return null;
  }

  const items: SavedMealEditorItem[] = [];

  for (const [index, item] of value.entries()) {
    if (
      !isRecord(item) ||
      typeof item.id !== "string" ||
      !isUuid(item.id) ||
      item.position !== index + 1 ||
      (item.food_id !== null &&
        (typeof item.food_id !== "string" || !isUuid(item.food_id))) ||
      typeof item.food_name !== "string" ||
      item.food_name.trim() === "" ||
      !isNullableText(item.brand_name) ||
      !isNullableNumber(item.serving_quantity) ||
      !isNullableText(item.serving_unit) ||
      !isNullableNumber(item.calories, true) ||
      !isNullableNumber(item.protein_g) ||
      !isNullableNumber(item.carbohydrates_g) ||
      !isNullableNumber(item.fat_g) ||
      !isNullableText(item.notes)
    ) {
      return null;
    }

    items.push({
      brand_name: item.brand_name as string | null,
      calories: item.calories as number | null,
      carbohydrates_g: item.carbohydrates_g as number | null,
      fat_g: item.fat_g as number | null,
      food_id: item.food_id as string | null,
      food_name: item.food_name,
      item_id: item.id,
      notes: item.notes as string | null,
      position: item.position,
      protein_g: item.protein_g as number | null,
      serving_quantity: item.serving_quantity as number | null,
      serving_unit: item.serving_unit as string | null,
    });
  }

  return items;
}
