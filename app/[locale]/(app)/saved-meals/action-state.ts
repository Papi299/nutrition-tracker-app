import type {
  OwnedSavedMealEditor,
  SavedMealDiarySourceItem,
} from "@/lib/saved-meals";
import { savedMealRowKey } from "@/lib/saved-meals/row-identity";
import type { Locale } from "@/lib/i18n/routing";

export type SavedMealFormItemValues = {
  brand_name: string;
  calories: string;
  carbohydrates_g: string;
  fat_g: string;
  food_name: string;
  notes: string;
  protein_g: string;
  remove_food_link: boolean;
  row_key: string;
  serving_quantity: string;
  serving_unit: string;
};

export type SavedMealFormValues = {
  items: SavedMealFormItemValues[];
  meal_locale: string;
  name: string;
  saved_meal_id: string;
};

export type SavedMealActionState = {
  fieldErrors?: Record<string, string>;
  status:
    | "database_error"
    | "idle"
    | "not_found"
    | "unauthenticated"
    | "validation_error";
  values: SavedMealFormValues;
};

export type SavedMealFoodLinkBinding = {
  food_id: string | null;
  row_key: string;
};

function inputValue(value: null | number | string) {
  return value === null ? "" : String(value);
}

export function blankSavedMealItem(rowKey: string): SavedMealFormItemValues {
  return {
    brand_name: "",
    calories: "",
    carbohydrates_g: "",
    fat_g: "",
    food_name: "",
    notes: "",
    protein_g: "",
    remove_food_link: false,
    row_key: rowKey,
    serving_quantity: "",
    serving_unit: "",
  };
}

export function newSavedMealFormValues(
  locale: Locale,
  rowKey: string,
): SavedMealFormValues {
  return {
    items: [blankSavedMealItem(rowKey)],
    meal_locale: locale,
    name: "",
    saved_meal_id: "",
  };
}

export function diarySourceSavedMealFormValues(
  locale: Locale,
  source: SavedMealDiarySourceItem[],
): SavedMealFormValues {
  return {
    items: source.map((item) => ({
      brand_name: inputValue(item.brand_name),
      calories: inputValue(item.calories),
      carbohydrates_g: inputValue(item.carbohydrates_g),
      fat_g: inputValue(item.fat_g),
      food_name: item.food_name,
      notes: inputValue(item.notes),
      protein_g: inputValue(item.protein_g),
      remove_food_link: false,
      row_key: savedMealRowKey("diary", item.diary_entry_id),
      serving_quantity: inputValue(item.serving_quantity),
      serving_unit: inputValue(item.serving_unit),
    })),
    meal_locale: locale,
    name: "",
    saved_meal_id: "",
  };
}

export function editorSavedMealFormValues(
  editor: OwnedSavedMealEditor,
): SavedMealFormValues {
  return {
    items: editor.items.map((item) => ({
      brand_name: inputValue(item.brand_name),
      calories: inputValue(item.calories),
      carbohydrates_g: inputValue(item.carbohydrates_g),
      fat_g: inputValue(item.fat_g),
      food_name: item.food_name,
      notes: inputValue(item.notes),
      protein_g: inputValue(item.protein_g),
      remove_food_link: false,
      row_key: savedMealRowKey("item", item.item_id),
      serving_quantity: inputValue(item.serving_quantity),
      serving_unit: inputValue(item.serving_unit),
    })),
    meal_locale: editor.locale,
    name: editor.name,
    saved_meal_id: editor.saved_meal_id,
  };
}
