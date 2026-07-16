import { expect, test } from "@playwright/test";
import {
  validateRecipeArchiveInput,
  validateRecipeInput,
} from "@/lib/recipes/validation";

const recipeId = "123e4567-e89b-12d3-a456-426614174000";
const foodId = "123e4567-e89b-12d3-a456-426614174001";

function validIngredient(overrides: Record<string, unknown> = {}) {
  return {
    position: 1,
    food_id: foodId,
    ingredient_name: "Snapshot ingredient",
    brand_name: "Snapshot brand",
    quantity: 100,
    unit: "g",
    calories: 125,
    protein_g: 4.5,
    carbohydrates_g: 20,
    fat_g: 3,
    notes: "Snapshot note",
    ...overrides,
  };
}

function validInput(overrides: Record<string, unknown> = {}) {
  return {
    name: "Recipe",
    locale: "en",
    yield_servings: 4,
    ingredients: [validIngredient()],
    ...overrides,
  };
}

test.describe("recipe payload validation", () => {
  test("normalizes snapshot text and preserves explicit nutrient zero", () => {
    expect(
      validateRecipeInput(
        validInput({
          recipe_id: recipeId,
          name: "  מרק  ",
          locale: "he",
          yield_servings: "2.5",
          ingredients: [
            validIngredient({
              food_id: "",
              ingredient_name: "  מלח  ",
              brand_name: "   ",
              quantity: "   ",
              unit: "   ",
              calories: 0,
              protein_g: "0",
              carbohydrates_g: 0,
              fat_g: "   ",
              notes: "   ",
            }),
          ],
        }),
      ),
    ).toEqual({
      data: {
        recipe_id: recipeId,
        name: "מרק",
        locale: "he",
        yield_servings: 2.5,
        ingredients: [
          {
            position: 1,
            food_id: null,
            ingredient_name: "מלח",
            brand_name: null,
            quantity: null,
            unit: null,
            calories: 0,
            protein_g: 0,
            carbohydrates_g: 0,
            fat_g: null,
            notes: null,
          },
        ],
      },
      ok: true,
    });
  });

  test("accepts supported locales, positive yields, and one to fifty ingredients", () => {
    for (const locale of ["en", "he", "und"]) {
      expect(validateRecipeInput(validInput({ locale }))).toMatchObject({
        data: { locale },
        ok: true,
      });
    }
    for (const yield_servings of [0.001, 1, 10_000]) {
      expect(validateRecipeInput(validInput({ yield_servings }))).toMatchObject({ ok: true });
    }
    expect(
      validateRecipeInput(
        validInput({
          ingredients: Array.from({ length: 50 }, (_, index) =>
            validIngredient({ position: index + 1 }),
          ),
        }),
      ),
    ).toMatchObject({ ok: true });
  });

  test("rejects invalid yields and ingredient collection sizes", () => {
    for (const yield_servings of [
      "",
      0,
      0.0004,
      -1,
      10_000.001,
      Number.NaN,
      Infinity,
    ]) {
      expect(validateRecipeInput(validInput({ yield_servings }))).toMatchObject({ ok: false });
    }
    for (const ingredients of [
      [],
      Array.from({ length: 51 }, (_, index) => validIngredient({ position: index + 1 })),
      null,
    ]) {
      expect(validateRecipeInput(validInput({ ingredients }))).toMatchObject({ ok: false });
    }
  });

  test("requires contiguous unique positions and exact ingredient fields", () => {
    for (const ingredients of [
      [validIngredient({ position: 0 })],
      [validIngredient({ position: 1.5 })],
      [validIngredient({ position: 51 })],
      [validIngredient({ position: 1 }), validIngredient({ position: 1 })],
      [validIngredient({ position: 1 }), validIngredient({ position: 3 })],
    ]) {
      expect(validateRecipeInput(validInput({ ingredients }))).toMatchObject({ ok: false });
    }

    const missing = validIngredient();
    delete (missing as Partial<typeof missing>).notes;
    expect(validateRecipeInput(validInput({ ingredients: [missing] }))).toMatchObject({
      fieldErrors: { "ingredients.0.notes": "required_field" },
      ok: false,
    });
    expect(
      validateRecipeInput(
        validInput({ ingredients: [validIngredient({ total_calories: 1 })] }),
      ),
    ).toMatchObject({
      fieldErrors: { "ingredients.0.total_calories": "unsupported_field" },
      ok: false,
    });
  });

  test("enforces quantity-unit pairing and positive finite quantity", () => {
    for (const ingredient of [
      validIngredient({ quantity: null, unit: "g" }),
      validIngredient({ quantity: 1, unit: null }),
      validIngredient({ quantity: 0, unit: "g" }),
      validIngredient({ quantity: 0.0004, unit: "g" }),
      validIngredient({ quantity: -1, unit: "g" }),
      validIngredient({ quantity: Infinity, unit: "g" }),
      validIngredient({ quantity: 1, unit: "   " }),
    ]) {
      expect(validateRecipeInput(validInput({ ingredients: [ingredient] }))).toMatchObject({
        ok: false,
      });
    }
    expect(
      validateRecipeInput(
        validInput({ ingredients: [validIngredient({ quantity: null, unit: null })] }),
      ),
    ).toMatchObject({ ok: true });
  });

  test("rejects invalid identity, locale, text, nutrient, and calories values", () => {
    expect(
      validateRecipeInput(
        validInput({
          recipe_id: "bad",
          name: " ",
          locale: "fr",
          ingredients: [
            validIngredient({
              food_id: "bad",
              ingredient_name: " ",
              brand_name: "b".repeat(121),
              unit: "u".repeat(41),
              calories: 1.5,
              protein_g: -1,
              carbohydrates_g: Infinity,
              fat_g: 1_000_000,
              notes: "n".repeat(1001),
            }),
          ],
        }),
      ),
    ).toMatchObject({ code: "validation_error", ok: false });
  });

  test("rejects caller-controlled top-level and archive fields", () => {
    expect(validateRecipeInput(validInput({ user_id: foodId, is_archived: true }))).toMatchObject({
      fieldErrors: {
        user_id: "unsupported_field",
        is_archived: "unsupported_field",
      },
      ok: false,
    });

    expect(
      validateRecipeArchiveInput({ recipe_id: recipeId, is_archived: true }),
    ).toEqual({ data: { recipe_id: recipeId, is_archived: true }, ok: true });
    expect(
      validateRecipeArchiveInput({
        recipe_id: "bad",
        is_archived: "true",
        user_id: foodId,
      }),
    ).toMatchObject({
      fieldErrors: {
        recipe_id: "invalid_uuid",
        is_archived: "boolean_required",
        user_id: "unsupported_field",
      },
      ok: false,
    });
  });
});
