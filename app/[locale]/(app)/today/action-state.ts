export type DiaryEntryActionStatus =
  | "database_error"
  | "idle"
  | "not_found"
  | "success"
  | "unauthenticated"
  | "validation_error";

export type DiaryEntryFieldName =
  | "brand_name"
  | "calories"
  | "carbohydrates_g"
  | "entry_date"
  | "fat_g"
  | "food_name"
  | "id"
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
