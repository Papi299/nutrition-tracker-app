import { normalizeAdditionalNutrientRequest, type AdditionalNutrientSnapshotV1 } from "./contracts";
import { isUuid } from "@/lib/food-selection/query";

export function validateReusableSnapshotFields(
  input: Record<string, unknown>, identityField: "item_id" | "ingredient_id",
  prefix: string, errors: Record<string, string>,
): { identity?: string | null; snapshot?: AdditionalNutrientSnapshotV1 | null } {
  const result: { identity?: string | null; snapshot?: AdditionalNutrientSnapshotV1 | null } = {};
  if (Object.hasOwn(input, identityField)) {
    const identity = input[identityField];
    if (identity !== null && (typeof identity !== "string" || !isUuid(identity))) errors[`${prefix}${identityField}`] = "invalid_uuid";
    else result.identity = identity as string | null;
  }
  if (Object.hasOwn(input, "additional_nutrient_snapshot")) {
    const snapshot = normalizeAdditionalNutrientRequest(input.additional_nutrient_snapshot);
    if (!snapshot.ok) errors[`${prefix}additional_nutrient_snapshot`] = snapshot.code;
    else result.snapshot = snapshot.data;
  }
  return result;
}
