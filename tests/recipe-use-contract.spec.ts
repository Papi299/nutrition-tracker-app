import { expect, test } from "@playwright/test";
import { parseRecipeUseContractPayload } from "@/lib/recipes/use-contract-parser";
import { validateRecipeUseContractInput } from "@/lib/recipes/use-contract-validation";

const recipeId = "123e4567-e89b-12d3-a456-426614174000";

function readyPayload(overrides: Record<string, unknown> = {}) {
  return {
    result_status: "ready",
    recipe_id: recipeId,
    recipe_name: "Snapshot recipe",
    recipe_locale: "en",
    is_archived: false,
    source_updated_at: "2026-07-17T12:00:00.000Z",
    yield_servings: 3,
    requested_servings: 1.5,
    ingredient_count: 2,
    calories_known_ingredient_count: 2,
    calories_complete: true,
    calories_whole_recipe: 301,
    calories_per_serving: 100.333333333333,
    calories_requested: 150.5,
    protein_known_ingredient_count: 2,
    protein_complete: true,
    protein_whole_recipe: 12.34,
    protein_per_serving: 4.113333333333,
    protein_requested: 6.17,
    carbohydrates_known_ingredient_count: 1,
    carbohydrates_complete: false,
    carbohydrates_whole_recipe: null,
    carbohydrates_per_serving: null,
    carbohydrates_requested: null,
    fat_known_ingredient_count: 2,
    fat_complete: true,
    fat_whole_recipe: 0,
    fat_per_serving: 0,
    fat_requested: 0,
    diary_calories: 151,
    diary_protein_g: 6.17,
    diary_carbohydrates_g: null,
    diary_fat_g: 0,
    ...overrides,
  };
}

test.describe("recipe use-contract input validation", () => {
  test("accepts the full request range, three decimals, and numeric strings", () => {
    for (const requested_servings of [0.001, ".5", 1, "2.125", 10_000]) {
      expect(
        validateRecipeUseContractInput({ recipe_id: recipeId, requested_servings }),
      ).toMatchObject({ ok: true });
    }
  });

  test("rejects absent, non-finite, out-of-range, over-precise, and extra input", () => {
    for (const requested_servings of [
      "",
      0,
      -1,
      0.0009,
      "1.0000",
      10_000.001,
      Number.NaN,
      Infinity,
      "not-a-number",
    ]) {
      expect(
        validateRecipeUseContractInput({ recipe_id: recipeId, requested_servings }),
      ).toMatchObject({ ok: false });
    }
    expect(
      validateRecipeUseContractInput({
        recipe_id: recipeId,
        requested_servings: 1,
        user_id: recipeId,
      }),
    ).toMatchObject({
      fieldErrors: { user_id: "unsupported_field" },
      ok: false,
    });
    expect(
      validateRecipeUseContractInput({ recipe_id: "not-a-uuid", requested_servings: 1 }),
    ).toMatchObject({ fieldErrors: { recipe_id: "invalid_uuid" }, ok: false });
  });
});

test.describe("recipe use-contract defensive parsing", () => {
  test("accepts independent completeness and preserves explicit zero", () => {
    expect(parseRecipeUseContractPayload(readyPayload(), 1.5)).toMatchObject({
      data: {
        ingredient_count: 2,
        nutrients: {
          calories: { complete: true, diary_value: 151 },
          carbohydrates_g: {
            complete: false,
            diary_value: null,
            requested_value: null,
          },
          fat_g: {
            complete: true,
            diary_value: 0,
            requested_value: 0,
          },
        },
      },
      status: "ready",
    });
  });

  test("accepts unavailable, archived, invalid, and overflow-safe statuses", () => {
    const unavailable = Object.fromEntries(
      Object.keys(readyPayload()).map((field) => [
        field,
        field === "result_status" ? "unavailable" : null,
      ]),
    );
    expect(parseRecipeUseContractPayload(unavailable, 1.5)).toEqual({
      status: "unavailable",
    });

    const archived = readyPayload({
      result_status: "archived",
      is_archived: true,
      calories_whole_recipe: null,
      calories_per_serving: null,
      calories_requested: null,
      protein_whole_recipe: null,
      protein_per_serving: null,
      protein_requested: null,
      fat_whole_recipe: null,
      fat_per_serving: null,
      fat_requested: null,
      diary_calories: null,
      diary_protein_g: null,
      diary_fat_g: null,
    });
    expect(parseRecipeUseContractPayload(archived, 1.5)).toMatchObject({
      data: { is_archived: true },
      status: "archived",
    });

    const invalid = readyPayload({
      result_status: "invalid_recipe",
      ingredient_count: 0,
      calories_known_ingredient_count: null,
      calories_complete: null,
      calories_whole_recipe: null,
      calories_per_serving: null,
      calories_requested: null,
      protein_known_ingredient_count: null,
      protein_complete: null,
      protein_whole_recipe: null,
      protein_per_serving: null,
      protein_requested: null,
      carbohydrates_known_ingredient_count: null,
      carbohydrates_complete: null,
      fat_known_ingredient_count: null,
      fat_complete: null,
      fat_whole_recipe: null,
      fat_per_serving: null,
      fat_requested: null,
      diary_calories: null,
      diary_protein_g: null,
      diary_carbohydrates_g: null,
      diary_fat_g: null,
    });
    expect(parseRecipeUseContractPayload(invalid, 1.5)).toMatchObject({
      status: "invalid_recipe",
    });

    const notLoggable = readyPayload({
      result_status: "not_loggable",
      calories_whole_recipe: null,
      calories_per_serving: null,
      calories_requested: null,
      protein_whole_recipe: null,
      protein_per_serving: null,
      protein_requested: null,
      fat_whole_recipe: null,
      fat_per_serving: null,
      fat_requested: null,
      diary_calories: null,
      diary_protein_g: null,
      diary_fat_g: null,
    });
    expect(parseRecipeUseContractPayload(notLoggable, 1.5)).toMatchObject({
      status: "not_loggable",
    });
  });

  test("fails closed on malformed shape, metadata, completeness, and rounded values", () => {
    const malformed = [
      { ...readyPayload(), unexpected: true },
      readyPayload({ requested_servings: 2 }),
      readyPayload({ ingredient_count: 51 }),
      readyPayload({ source_updated_at: "not-a-timestamp" }),
      readyPayload({ calories_known_ingredient_count: 1, calories_complete: true }),
      readyPayload({ calories_complete: false, calories_requested: 150.5 }),
      readyPayload({ diary_calories: 150.5 }),
      readyPayload({ diary_protein_g: 6.171 }),
      readyPayload({ diary_protein_g: 1_000_000 }),
      readyPayload({ result_status: "archived", is_archived: false }),
      readyPayload({ result_status: "not_loggable", calories_requested: 150.5 }),
    ];
    for (const payload of malformed) {
      expect(parseRecipeUseContractPayload(payload, 1.5)).toBeNull();
    }
  });
});
