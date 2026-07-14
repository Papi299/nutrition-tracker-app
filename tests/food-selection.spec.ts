import { expect, test } from "@playwright/test";
import {
  parseFoodSelectionQuery,
  isUuid,
} from "@/lib/food-selection/query";
import {
  validateDiaryEntryCreateInput,
  validateDiaryEntryUpdateInput,
} from "@/lib/diary-entries/validation";

const foodId = "123e4567-e89b-12d3-a456-426614174000";
const requiredDiaryValues = {
  entry_date: "2026-07-14",
  food_name: "Selected food snapshot",
  meal_type: "lunch",
};

test.describe("food selection boundaries", () => {
  test("classifies missing, invalid, repeated, and valid food ids", () => {
    expect(parseFoodSelectionQuery(undefined)).toEqual({ status: "missing" });
    expect(parseFoodSelectionQuery("not-a-uuid")).toEqual({ status: "invalid" });
    expect(parseFoodSelectionQuery([foodId, foodId])).toEqual({
      status: "repeated",
    });
    expect(parseFoodSelectionQuery(foodId)).toEqual({
      foodId,
      status: "valid",
    });
    expect(isUuid(foodId.toUpperCase())).toBe(true);
  });

  test("stores a valid selected-food link and keeps manual links null", () => {
    expect(
      validateDiaryEntryCreateInput({
        ...requiredDiaryValues,
        food_id: foodId,
      }),
    ).toMatchObject({ data: { food_id: foodId }, ok: true });
    expect(validateDiaryEntryCreateInput(requiredDiaryValues)).toMatchObject({
      data: { food_id: null },
      ok: true,
    });
  });

  test("rejects malformed create links and all relinking through updates", () => {
    expect(
      validateDiaryEntryCreateInput({
        ...requiredDiaryValues,
        food_id: "tampered",
      }),
    ).toMatchObject({
      code: "validation_error",
      fieldErrors: { food_id: "invalid_uuid" },
      ok: false,
    });
    expect(
      validateDiaryEntryUpdateInput({ food_id: foodId }),
    ).toMatchObject({
      code: "validation_error",
      fieldErrors: { food_id: "unsupported_field" },
      ok: false,
    });
  });
});
