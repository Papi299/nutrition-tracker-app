import { expect, test } from "@playwright/test";
import { parseSavedMealEditorItems } from "@/lib/saved-meals/editor-parser";
import { parseSavedMealManagementQuery } from "@/lib/saved-meals/management-query";
import {
  parseSavedMealRowKey,
  savedMealRowKey,
} from "@/lib/saved-meals/row-identity";
import { parseSavedMealSourceQuery } from "@/lib/saved-meals/source-query";
import {
  validateSavedMealArchiveInput,
  validateSavedMealInput,
} from "@/lib/saved-meals/validation";

const savedMealId = "123e4567-e89b-12d3-a456-426614174000";
const foodId = "123e4567-e89b-12d3-a456-426614174001";

function validItem(overrides: Record<string, unknown> = {}) {
  return {
    position: 1,
    food_id: foodId,
    food_name: "Snapshot food",
    brand_name: "Snapshot brand",
    serving_quantity: 100,
    serving_unit: "g",
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
    name: "Saved breakfast",
    locale: "en",
    items: [validItem()],
    ...overrides,
  };
}

test.describe("saved-meal payload validation", () => {
  test("normalizes identity and optional snapshot text while preserving zero", () => {
    expect(
      validateSavedMealInput(
        validInput({
          saved_meal_id: savedMealId,
          name: "  ארוחת בוקר  ",
          locale: "he",
          items: [
            validItem({
              food_id: "",
              food_name: "  יוגורט  ",
              brand_name: "   ",
              serving_quantity: 0,
              serving_unit: "  cup  ",
              calories: 0,
              protein_g: 0,
              carbohydrates_g: "0",
              fat_g: 0,
              notes: "   ",
            }),
          ],
        }),
      ),
    ).toEqual({
      data: {
        saved_meal_id: savedMealId,
        name: "ארוחת בוקר",
        locale: "he",
        items: [
          {
            position: 1,
            food_id: null,
            food_name: "יוגורט",
            brand_name: null,
            serving_quantity: 0,
            serving_unit: "cup",
            calories: 0,
            protein_g: 0,
            carbohydrates_g: 0,
            fat_g: 0,
            notes: null,
          },
        ],
      },
      ok: true,
    });
  });

  test("accepts English, Hebrew, and und locales", () => {
    for (const locale of ["en", "he", "und"]) {
      expect(validateSavedMealInput(validInput({ locale }))).toMatchObject({
        data: { locale },
        ok: true,
      });
    }
  });

  test("requires one to fifty complete items", () => {
    expect(validateSavedMealInput(validInput({ items: [] }))).toMatchObject({
      fieldErrors: { items: "item_count_out_of_range" },
      ok: false,
    });

    expect(
      validateSavedMealInput(
        validInput({
          items: Array.from({ length: 50 }, (_, index) =>
            validItem({ position: index + 1 }),
          ),
        }),
      ),
    ).toMatchObject({ ok: true });

    expect(
      validateSavedMealInput(
        validInput({
          items: Array.from({ length: 51 }, (_, index) =>
            validItem({ position: index + 1 }),
          ),
        }),
      ),
    ).toMatchObject({
      fieldErrors: { items: "item_count_out_of_range" },
      ok: false,
    });

    const missingField = validItem();
    delete (missingField as Partial<typeof missingField>).notes;
    expect(validateSavedMealInput(validInput({ items: [missingField] }))).toMatchObject({
      fieldErrors: { "items.0.notes": "required_field" },
      ok: false,
    });
  });

  test("rejects duplicate, gapped, noninteger, zero, and out-of-range positions", () => {
    const cases = [
      [validItem({ position: 1 }), validItem({ position: 1 })],
      [validItem({ position: 1 }), validItem({ position: 3 })],
      [validItem({ position: -1 })],
      [validItem({ position: 0 })],
      [validItem({ position: 1.5 })],
      [validItem({ position: 51 })],
    ];

    for (const items of cases) {
      expect(validateSavedMealInput(validInput({ items }))).toMatchObject({
        ok: false,
      });
    }

    const missingPosition = validItem();
    delete (missingPosition as Partial<typeof missingPosition>).position;
    expect(
      validateSavedMealInput(validInput({ items: [missingPosition] })),
    ).toMatchObject({
      fieldErrors: { "items.0.position": expect.any(String) },
      ok: false,
    });
  });

  test("rejects malformed ids, blank required text, unsupported locale, and oversized text", () => {
    expect(
      validateSavedMealInput(
        validInput({
          saved_meal_id: "not-a-uuid",
          name: " ",
          locale: "fr",
          items: [
            validItem({
              food_id: "not-a-uuid",
              food_name: " ",
              brand_name: "b".repeat(121),
              serving_unit: "u".repeat(41),
              notes: "n".repeat(1001),
            }),
          ],
        }),
      ),
    ).toMatchObject({
      code: "validation_error",
      fieldErrors: {
        saved_meal_id: "invalid_uuid",
        name: "required",
        locale: "unsupported_locale",
        "items.0.food_id": "invalid_uuid",
        "items.0.food_name": "required",
        "items.0.brand_name": "too_long",
        "items.0.serving_unit": "too_long",
        "items.0.notes": "too_long",
      },
      ok: false,
    });
  });

  test("rejects negative, nonfinite, over-limit, and decimal calorie values", () => {
    for (const [field, value] of [
      ["serving_quantity", -1],
      ["protein_g", Number.NaN],
      ["carbohydrates_g", Number.POSITIVE_INFINITY],
      ["fat_g", 1_000_000],
      ["calories", -1],
      ["calories", 1.5],
    ] as const) {
      expect(
        validateSavedMealInput(
          validInput({ items: [validItem({ [field]: value })] }),
        ),
      ).toMatchObject({ ok: false });
    }
  });

  test("rejects unsupported top-level and item fields", () => {
    expect(
      validateSavedMealInput(
        validInput({
          user_id: savedMealId,
          items: [validItem({ total_calories: 999 })],
        }),
      ),
    ).toMatchObject({
      fieldErrors: {
        user_id: "unsupported_field",
        "items.0.total_calories": "unsupported_field",
      },
      ok: false,
    });
  });

  test("validates archive input without accepting ownership or timestamp fields", () => {
    expect(
      validateSavedMealArchiveInput({
        saved_meal_id: savedMealId,
        is_archived: true,
      }),
    ).toEqual({
      data: { saved_meal_id: savedMealId, is_archived: true },
      ok: true,
    });

    expect(
      validateSavedMealArchiveInput({
        saved_meal_id: "bad",
        is_archived: "true",
        user_id: savedMealId,
      }),
    ).toMatchObject({
      fieldErrors: {
        saved_meal_id: "invalid_uuid",
        is_archived: "boolean_required",
        user_id: "unsupported_field",
      },
      ok: false,
    });
  });
});

test.describe("saved-meal UI query boundaries", () => {
  test("parses complete contiguous editor snapshots and rejects malformed order", () => {
    const editorItem = {
      id: savedMealId,
      position: 1,
      food_id: foodId,
      food_name: "Snapshot food",
      brand_name: null,
      serving_quantity: 0,
      serving_unit: null,
      calories: 0,
      protein_g: null,
      carbohydrates_g: 0,
      fat_g: null,
      notes: null,
    };

    expect(parseSavedMealEditorItems([editorItem])).toEqual([
      {
        brand_name: null,
        calories: 0,
        carbohydrates_g: 0,
        fat_g: null,
        food_id: foodId,
        food_name: "Snapshot food",
        item_id: savedMealId,
        notes: null,
        position: 1,
        protein_g: null,
        serving_quantity: 0,
        serving_unit: null,
      },
    ]);
    expect(
      parseSavedMealEditorItems([
        editorItem,
        { ...editorItem, id: foodId, position: 3 },
      ]),
    ).toBeNull();
    expect(parseSavedMealEditorItems([])).toBeNull();
  });

  test("defaults management to active page one and accepts strict filters", () => {
    expect(parseSavedMealManagementQuery({})).toEqual({
      page: 1,
      status: "active",
      type: "valid",
    });
    expect(
      parseSavedMealManagementQuery({ page: "2", status: "archived" }),
    ).toEqual({ page: 2, status: "archived", type: "valid" });
  });

  test("rejects invalid and repeated management filters before querying", () => {
    for (const query of [
      { status: "all" },
      { status: ["active", "archived"] },
      { page: "0" },
      { page: "01" },
      { page: "1.5" },
      { page: ["1", "2"] },
      { page: "999999999999999999999999999" },
    ]) {
      expect(parseSavedMealManagementQuery(query)).toMatchObject({
        type: "invalid",
      });
    }
  });

  test("requires an exact diary date and meal-type pair", () => {
    expect(parseSavedMealSourceQuery({})).toEqual({ type: "blank" });

    for (const mealType of [
      "breakfast",
      "lunch",
      "dinner",
      "snack",
      "other",
    ]) {
      expect(
        parseSavedMealSourceQuery({ date: "2026-07-16", mealType }),
      ).toEqual({
        date: "2026-07-16",
        meal_type: mealType,
        type: "diary",
      });
    }

    for (const query of [
      { date: "2026-07-16" },
      { mealType: "lunch" },
      { date: "2026-02-30", mealType: "lunch" },
      { date: "2026-07-16", mealType: "brunch" },
      { date: ["2026-07-16", "2026-07-17"], mealType: "lunch" },
      { date: "2026-07-16", mealType: ["lunch", "dinner"] },
    ]) {
      expect(parseSavedMealSourceQuery(query)).toMatchObject({ type: "invalid" });
    }
  });

  test("uses typed opaque row identities and rejects malformed values", () => {
    for (const kind of ["client", "diary", "item"] as const) {
      const value = savedMealRowKey(kind, savedMealId);
      expect(parseSavedMealRowKey(value)).toEqual({ id: savedMealId, kind });
    }

    for (const value of [
      null,
      "",
      savedMealId,
      `food:${savedMealId}`,
      "client:not-a-uuid",
      `client:${savedMealId}:extra`,
    ]) {
      expect(parseSavedMealRowKey(value)).toBeNull();
    }
  });
});
