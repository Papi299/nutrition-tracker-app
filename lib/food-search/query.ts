export const FOOD_SEARCH_MAX_LENGTH = 100;
export const FOOD_SEARCH_MIN_NORMALIZED_LENGTH = 2;

export type FoodSearchQuery =
  | { status: "initial"; value: string }
  | { status: "invalid"; reason: "repeated" | "too_long"; value: string }
  | { status: "too_short"; value: string }
  | { normalized: string; status: "ready"; value: string };

export function normalizeFoodSearchQuery(value: string) {
  return value.trim().replace(/\s+/gu, " ").toLowerCase();
}

export function parseFoodSearchQuery(
  value: string | string[] | undefined,
): FoodSearchQuery {
  if (Array.isArray(value)) {
    return { reason: "repeated", status: "invalid", value: value[0] ?? "" };
  }

  const rawValue = value ?? "";

  if (rawValue.length === 0) {
    return { status: "initial", value: rawValue };
  }

  if (Array.from(rawValue).length > FOOD_SEARCH_MAX_LENGTH) {
    return { reason: "too_long", status: "invalid", value: rawValue };
  }

  const normalized = normalizeFoodSearchQuery(rawValue);

  if (normalized.length === 0) {
    return { status: "initial", value: rawValue };
  }

  if (Array.from(normalized).length < FOOD_SEARCH_MIN_NORMALIZED_LENGTH) {
    return { status: "too_short", value: rawValue };
  }

  return { normalized, status: "ready", value: rawValue };
}
