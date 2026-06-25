export type SetupActionStatus =
  | "database_error"
  | "idle"
  | "profile_error"
  | "success"
  | "target_error"
  | "unauthenticated"
  | "validation_error";

export type SetupFieldName =
  | "calories"
  | "carbohydrates_g"
  | "display_name"
  | "fat_g"
  | "preferred_language"
  | "protein_g";

export type SetupFieldValues = Record<SetupFieldName, string>;

export type SetupActionState = {
  fieldErrors?: Partial<Record<SetupFieldName, string>>;
  status: SetupActionStatus;
  values: SetupFieldValues;
};

export const emptySetupFieldValues: SetupFieldValues = {
  calories: "",
  carbohydrates_g: "",
  display_name: "",
  fat_g: "",
  preferred_language: "en",
  protein_g: "",
};

export const initialSetupActionState: SetupActionState = {
  status: "idle",
  values: emptySetupFieldValues,
};
