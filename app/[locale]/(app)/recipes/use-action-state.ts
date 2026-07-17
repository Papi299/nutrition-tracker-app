export type RecipeUseActionStatus =
  | "archived"
  | "database_error"
  | "idempotency_conflict"
  | "idle"
  | "invalid_recipe"
  | "not_loggable"
  | "stale_review"
  | "unauthenticated"
  | "unavailable"
  | "validation_error";

export type RecipeUseActionState = {
  status: RecipeUseActionStatus;
};
