import type { AdditionalNutrientCode } from "@/lib/nutrition-snapshots";

export type DiaryEntryActionStatus =
  | "conflict"
  | "database_error"
  | "idle"
  | "not_found"
  | "success"
  | "unauthenticated"
  | "validation_error";

export type DiaryNutrientField = "calories" | "protein_g" | "carbohydrates_g" | "fat_g" | AdditionalNutrientCode;

export type DiaryEntryFieldName =
  | DiaryNutrientField
  | `automatic_${DiaryNutrientField}`
  | "additional_nutrients_captured"
  | "additional_nutrient_snapshot"
  | "reference_fingerprint"
  | "quantity_unit"
  | "serving_intent"
  | "automatic_calories"
  | "automatic_carbohydrates_g"
  | "automatic_fat_g"
  | "automatic_protein_g"
  | "brand_name"
  | "calories"
  | "carbohydrates_g"
  | "entry_date"
  | "expected_version"
  | "fat_g"
  | "food_id"
  | "food_name"
  | "id"
  | "idempotency_key"
  | "meal_type"
  | "notes"
  | "protein_g"
  | "serving_quantity"
  | "serving_unit";

export type DiaryEntryFieldErrors = Partial<
  Record<DiaryEntryFieldName | "form", string>
>;

export type DiaryEntryFieldValues = Partial<Record<DiaryEntryFieldName, string>>;

export type DiaryEntryActionState = {
  fieldErrors?: DiaryEntryFieldErrors;
  status: DiaryEntryActionStatus;
  values?: DiaryEntryFieldValues;
};

export const initialDiaryEntryActionState: DiaryEntryActionState = {
  status: "idle",
  values: {},
};
