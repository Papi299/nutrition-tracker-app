import type {
  CustomFoodEditorAlias,
  CustomFoodNutrientCode,
  OwnedCustomFoodEditor,
} from "@/lib/custom-foods";
import type { Locale } from "@/lib/i18n/routing";

export type CustomFoodActionStatus =
  | "ambiguous"
  | "archived_or_unavailable"
  | "database_error"
  | "idle"
  | "not_found"
  | "owned_archived"
  | "owned_existing"
  | "public_existing"
  | "unauthenticated"
  | "validation_error";

export type CustomFoodFormValues = {
  aliases: CustomFoodEditorAlias[];
  brand_name: string;
  food_id: string;
  food_locale: string;
  name: string;
  nutrient_basis: string;
  nutrients: Record<CustomFoodNutrientCode, string>;
  serving_quantity: string;
  serving_unit: string;
};

export type CustomFoodActionState = {
  barcode_omitted?: boolean;
  conflict_food_id?: string;
  fieldErrors?: Record<string, string>;
  status: CustomFoodActionStatus;
  values: CustomFoodFormValues;
};

export function emptyNutrientValues(): Record<
  CustomFoodNutrientCode,
  string
> {
  return {
    added_sugars_g: "",
    calcium_mg: "",
    carbohydrates_g: "",
    choline_mg: "",
    cholesterol_mg: "",
    copper_mg: "",
    energy_kcal: "",
    fat_g: "",
    fiber_g: "",
    folate_dfe_ug: "",
    iron_mg: "",
    magnesium_mg: "",
    manganese_mg: "",
    monounsaturated_fat_g: "",
    niacin_mg: "",
    pantothenic_acid_mg: "",
    phosphorus_mg: "",
    polyunsaturated_fat_g: "",
    potassium_mg: "",
    protein_g: "",
    riboflavin_mg: "",
    saturated_fat_g: "",
    selenium_ug: "",
    sodium_mg: "",
    sugars_g: "",
    thiamin_mg: "",
    trans_fat_g: "",
    vitamin_a_rae_ug: "",
    vitamin_b12_ug: "",
    vitamin_b6_mg: "",
    vitamin_c_mg: "",
    vitamin_d_ug: "",
    vitamin_e_mg: "",
    vitamin_k_ug: "",
    zinc_mg: "",
  };
}

export function newCustomFoodFormValues(locale: Locale): CustomFoodFormValues {
  return {
    aliases: [],
    brand_name: "",
    food_id: "",
    food_locale: locale,
    name: "",
    nutrient_basis: "per_serving",
    nutrients: emptyNutrientValues(),
    serving_quantity: "",
    serving_unit: "",
  };
}

export function editorCustomFoodFormValues(
  editor: OwnedCustomFoodEditor,
): CustomFoodFormValues {
  const nutrients = emptyNutrientValues();

  for (const nutrient of editor.nutrients) {
    nutrients[nutrient.code] = String(nutrient.amount);
  }

  return {
    aliases: editor.aliases,
    brand_name: editor.brand_name ?? "",
    food_id: editor.food_id,
    food_locale: editor.locale,
    name: editor.name,
    nutrient_basis: editor.nutrient_basis,
    nutrients,
    serving_quantity: String(editor.serving_quantity),
    serving_unit: editor.serving_unit,
  };
}
