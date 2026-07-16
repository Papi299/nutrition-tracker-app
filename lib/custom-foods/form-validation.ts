export type CustomFoodNutrientFormValue =
  | { status: "blank" }
  | { code: "invalid_number" | "negative_amount"; status: "invalid" }
  | { amount: number; status: "valid" };

export function parseCustomFoodNutrientFormValue(
  rawValue: string,
): CustomFoodNutrientFormValue {
  if (rawValue.trim() === "") {
    return { status: "blank" };
  }

  const amount = Number(rawValue);

  if (!Number.isFinite(amount)) {
    return { code: "invalid_number", status: "invalid" };
  }

  if (amount < 0) {
    return { code: "negative_amount", status: "invalid" };
  }

  return { amount, status: "valid" };
}
