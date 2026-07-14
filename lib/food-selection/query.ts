export type FoodSelectionQuery =
  | { status: "missing" }
  | { foodId: string; status: "valid" }
  | { status: "invalid" }
  | { status: "repeated" };

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: string) {
  return uuidPattern.test(value);
}

export function parseFoodSelectionQuery(
  value: string | string[] | undefined,
): FoodSelectionQuery {
  if (value === undefined) {
    return { status: "missing" };
  }

  if (Array.isArray(value)) {
    return { status: "repeated" };
  }

  if (!isUuid(value)) {
    return { status: "invalid" };
  }

  return { foodId: value, status: "valid" };
}
