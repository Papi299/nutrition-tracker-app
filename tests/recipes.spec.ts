import { expect, test } from "@playwright/test";
import {
  validateRecipeArchiveInput,
  validateRecipeInput,
} from "@/lib/recipes/validation";
import { parseRecipeEditorIngredients } from "@/lib/recipes/editor-parser";
import { parseRecipeManagementQuery } from "@/lib/recipes/management-query";
import { parseRecipeRowKey, recipeRowKey } from "@/lib/recipes/row-identity";
import {
  parseRecipeUseQuery,
  recipeUseCanonicalQuery,
} from "@/lib/recipes/use-query";

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

test.describe("recipe UI contracts", () => {
  test("parses and canonicalizes strict recipe-use context", () => {
    expect(parseRecipeUseQuery(recipeId, { date: "2024-02-29" })).toEqual({
      date: "2024-02-29",
      meal_type: null,
      needs_canonical_redirect: true,
      normalized_servings: "1",
      requested_servings: 1,
      status: "valid",
    });
    expect(
      parseRecipeUseQuery(recipeId, {
        date: "9999-12-31",
        mealType: "dinner",
        servings: "01.500",
      }),
    ).toEqual({
      date: "9999-12-31",
      meal_type: "dinner",
      needs_canonical_redirect: true,
      normalized_servings: "1.5",
      requested_servings: 1.5,
      status: "valid",
    });
    expect(
      recipeUseCanonicalQuery({
        date: "9999-12-31",
        mealType: "dinner",
        servings: "1.5",
      }),
    ).toBe("date=9999-12-31&mealType=dinner&servings=1.5");
  });

  test("accepts browser-date bootstrap and every serving and meal boundary", () => {
    for (const mealType of ["breakfast", "lunch", "dinner", "snack", "other"]) {
      expect(
        parseRecipeUseQuery(recipeId, {
          mealType,
          servings: "0.001",
        }),
      ).toMatchObject({
        meal_type: mealType,
        normalized_servings: "0.001",
        status: "date_missing",
      });
    }
    for (const servings of ["0.001", "1", "1.5", "10000"]) {
      expect(
        parseRecipeUseQuery(recipeId, { date: "2026-07-17", servings }),
      ).toMatchObject({ requested_servings: Number(servings), status: "valid" });
    }
  });

  test("rejects repeated, unknown, malformed, signed, exponent, and out-of-range query values", () => {
    const invalidQueries = [
      { date: ["2026-07-17", "2026-07-18"] },
      { date: "2026-02-29" },
      { date: "2026-07-17", mealType: ["lunch", "dinner"] },
      { date: "2026-07-17", mealType: "brunch" },
      { date: "2026-07-17", servings: ["1", "2"] },
      { date: "2026-07-17", servings: "" },
      { date: "2026-07-17", servings: " 1" },
      { date: "2026-07-17", servings: "+1" },
      { date: "2026-07-17", servings: "-1" },
      { date: "2026-07-17", servings: "1e2" },
      { date: "2026-07-17", servings: "0" },
      { date: "2026-07-17", servings: "0.0001" },
      { date: "2026-07-17", servings: "10000.001" },
      { date: "2026-07-17", servings: "words" },
      { date: "2026-07-17", unexpected: "value" },
    ];
    for (const query of invalidQueries) {
      expect(parseRecipeUseQuery(recipeId, query)).toMatchObject({
        status: "invalid",
      });
    }
  });

  test("parses strict management filters and rejects repeated or malformed values", () => {
    expect(parseRecipeManagementQuery({})).toEqual({
      page: 1,
      status: "active",
      type: "valid",
    });
    expect(
      parseRecipeManagementQuery({ page: "2", status: "archived" }),
    ).toEqual({ page: 2, status: "archived", type: "valid" });

    expect(parseRecipeManagementQuery({ status: ["active", "archived"] })).toEqual({
      field: "status",
      reason: "repeated",
      type: "invalid",
    });
    for (const page of ["0", "01", "1.5", "-1", "words", "9007199254740992"]) {
      expect(parseRecipeManagementQuery({ page })).toMatchObject({
        field: "page",
        reason: "invalid",
        type: "invalid",
      });
    }
  });

  test("round-trips only typed recipe row identities", () => {
    expect(recipeRowKey("client", recipeId)).toBe(`client:${recipeId}`);
    expect(recipeRowKey("ingredient", foodId)).toBe(`ingredient:${foodId}`);
    expect(parseRecipeRowKey(`ingredient:${foodId}`)).toEqual({
      id: foodId,
      kind: "ingredient",
    });
    for (const value of ["", foodId, `other:${foodId}`, "client:not-a-uuid"]) {
      expect(parseRecipeRowKey(value)).toBeNull();
    }
  });

  test("parses ordered editor snapshots while preserving zero and nullable values", () => {
    expect(
      parseRecipeEditorIngredients([
        {
          brand_name: null,
          calories: 0,
          carbohydrates_g: null,
          fat_g: 0,
          food_id: foodId,
          id: recipeId,
          ingredient_name: "מלח",
          notes: null,
          position: 1,
          protein_g: 0,
          quantity: 100,
          unit: "g",
        },
      ]),
    ).toEqual([
      {
        brand_name: null,
        calories: 0,
        carbohydrates_g: null,
        fat_g: 0,
        food_id: foodId,
        ingredient_id: recipeId,
        ingredient_name: "מלח",
        notes: null,
        position: 1,
        protein_g: 0,
        quantity: 100,
        unit: "g",
      },
    ]);
  });

  test("fails closed on malformed editor snapshot payloads", () => {
    const valid = {
      brand_name: null,
      calories: null,
      carbohydrates_g: null,
      fat_g: null,
      food_id: null,
      id: recipeId,
      ingredient_name: "Ingredient",
      notes: null,
      position: 1,
      protein_g: null,
      quantity: null,
      unit: null,
    };

    for (const payload of [
      [],
      [{ ...valid, extra: true }],
      [{ ...valid, position: 2 }],
      [{ ...valid, quantity: 1 }],
      [{ ...valid, unit: "g" }],
      [{ ...valid, food_id: "bad" }],
      [{ ...valid, ingredient_name: " " }],
      [{ ...valid, ingredient_name: " padded " }],
      [{ ...valid, notes: "" }],
      [valid, { ...valid, position: 2 }],
    ]) {
      expect(parseRecipeEditorIngredients(payload)).toBeNull();
    }
  });
});
