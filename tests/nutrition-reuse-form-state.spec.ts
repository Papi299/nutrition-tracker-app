import { expect, test } from "@playwright/test";
import { additionalNutrientCodesV1, emptyAdditionalNutrientSnapshot, additionalSnapshotToRequest } from "@/lib/nutrition-snapshots";
import { additionalSnapshotFormState, mergeReviewedRows, normalizeAdditionalFormState } from "@/lib/nutrition-snapshots/form-state";
import { validateSavedMealInput } from "@/lib/saved-meals/validation";
import { validateRecipeInput } from "@/lib/recipes/validation";
import { parseSavedMealEditorItems } from "@/lib/saved-meals/editor-parser";
import { parseRecipeEditorIngredients } from "@/lib/recipes/editor-parser";

const id = "22222222-2222-4222-8222-222222222222";
const item = { position: 1, food_id: null, food_name: "Consumed", brand_name: null, serving_quantity: 200,
  serving_unit: "g", calories: 400, protein_g: 40, carbohydrates_g: 40, fat_g: 10, notes: null };

test("retains every consumed extension and physical identity in reusable validation and readers", () => {
  const snapshot = emptyAdditionalNutrientSnapshot();
  for (const [index, code] of additionalNutrientCodesV1.entries()) snapshot.values[code] = Number(`${index + 1}.2345`);
  snapshot.values.fiber_g = 0; snapshot.values.vitamin_d_ug = null;
  const additional_nutrient_snapshot = additionalSnapshotToRequest(snapshot);
  const meal = validateSavedMealInput({ saved_meal_id: id, expected_edit_revision: 1, locale: "en", name: "Meal",
    items: [{ ...item, item_id: id, additional_nutrient_snapshot }] });
  expect(meal).toMatchObject({ ok: true, data: { items: [{ item_id: id, additional_nutrient_snapshot: snapshot }] } });
  const { food_name, serving_quantity, serving_unit, ...rest } = item;
  const ingredient = { ...rest, ingredient_name: food_name, quantity: serving_quantity, unit: serving_unit };
  const recipe = validateRecipeInput({ recipe_id: id, expected_edit_revision: 1, locale: "en", name: "Recipe", yield_servings: 2,
    ingredients: [{ ...ingredient, ingredient_id: id, additional_nutrient_snapshot }] });
  expect(recipe).toMatchObject({ ok: true, data: { ingredients: [{ ingredient_id: id, additional_nutrient_snapshot: snapshot }] } });
  expect(parseSavedMealEditorItems([{ ...item, id, additional_nutrient_snapshot: snapshot }]))
    .toMatchObject([{ item_id: id, additional_nutrient_snapshot: snapshot }]);
  expect(parseRecipeEditorIngredients([{ ...ingredient, id, additional_nutrient_snapshot: snapshot }]))
    .toMatchObject([{ ingredient_id: id, additional_nutrient_snapshot: snapshot }]);
  expect(parseSavedMealEditorItems([{ ...item, id, additional_nutrient_snapshot: { version: 2, values: snapshot.values } }])).toBeNull();
  expect(parseRecipeEditorIngredients([{ ...ingredient, id, additional_nutrient_snapshot: { version: 2, values: snapshot.values } }])).toBeNull();
});

test("keeps uncaptured history separate from captured unknown and explicit zero in forms", () => {
  const legacy = additionalSnapshotFormState(null);
  expect(normalizeAdditionalFormState(legacy)).toEqual({ request: null, reviewRequired: false, errors: {} });
  legacy.additional_values.sodium_mg = "0";
  expect(normalizeAdditionalFormState(legacy).errors).toEqual({ additional_nutrients_captured: "capture_required" });
  const captured = additionalSnapshotFormState(emptyAdditionalNutrientSnapshot());
  captured.additional_values.sodium_mg = "0";
  const result = normalizeAdditionalFormState(captured);
  expect(result.errors).toEqual({});
  expect(result.request?.values).toHaveLength(31);
  expect(result.request?.values.find(value => value.code === "sodium_mg")?.amount).toBe(0);
  expect(result.request?.values.find(value => value.code === "vitamin_d_ug")?.amount).toBeNull();
});

test("normalizes only at final form review and rejects invalid or overflowing additional amounts", () => {
  const state = additionalSnapshotFormState(emptyAdditionalNutrientSnapshot());
  state.additional_values.vitamin_b12_ug = "0.00015";
  expect(normalizeAdditionalFormState(state)).toMatchObject({ reviewRequired: true, errors: {} });
  expect(state.additional_values.vitamin_b12_ug).toBe("0.0002");
  expect(normalizeAdditionalFormState(state).reviewRequired).toBe(false);
  state.additional_values.sodium_mg = "9999999999.99995";
  expect(normalizeAdditionalFormState(state).errors.sodium_mg).toBe("amount_out_of_range");
  state.additional_values.sodium_mg = "-0.00001";
  expect(normalizeAdditionalFormState(state).errors.sodium_mg).toBe("invalid_amount");
});

test("review responses follow stable rows and preserve edits made after submission", () => {
  const submitted = [{ row_key: "a", value: "1.23445", notes: "old" }, { row_key: "b", value: "0", notes: "" }];
  const current = [{ ...submitted[1] }, { ...submitted[0], notes: "typed while pending" }, { row_key: "new", value: "5", notes: "new" }];
  const response = [{ ...submitted[0], value: "1.2345" }, { ...submitted[1] }];
  expect(mergeReviewedRows(current, submitted, response)).toEqual([
    submitted[1], { row_key: "a", value: "1.2345", notes: "typed while pending" }, current[2],
  ]);
  expect(current[1].value).toBe("1.23445");
});

test("reference drift disables all automatic fields while preserving later manual input", () => {
  const original = { row_key: "a", value: "200", notes: "old", reference_fingerprint: "old",
    automatic_values: { calories: "1", sodium_mg: "1" }, reference: { calories: 200 } };
  const current = { ...original, notes: "new", value: "225", automatic_values: { calories: "", sodium_mg: "1" } };
  const reviewed = { ...original, reference_fingerprint: "new", automatic_values: { calories: "", sodium_mg: "" }, reference: { calories: 300 } };
  expect(mergeReviewedRows([current], [original], [reviewed])[0]).toEqual({ ...reviewed, value: "225", notes: "new" });
});
