export type SavedMealUseValues = {
  entry_date: string;
  meal_type: string;
};

export type SavedMealUseActionState = {
  fieldErrors?: Record<string, string>;
  status:
    | "archived"
    | "database_error"
    | "idempotency_conflict"
    | "idle"
    | "not_found"
    | "stale_review"
    | "unauthenticated"
    | "validation_error";
  values: SavedMealUseValues;
};
