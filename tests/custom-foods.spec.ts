import { expect, test } from "@playwright/test";
import {
  customFoodNutrientCodes,
  validateCustomFoodArchiveInput,
  validateCustomFoodInput,
} from "@/lib/custom-foods/validation";
import { parseCustomFoodNutrientFormValue } from "@/lib/custom-foods/form-validation";
import { parseCustomFoodManagementQuery } from "@/lib/custom-foods/management-query";
import { parseCustomFoodBarcodePersistenceRows } from "@/lib/custom-foods/barcode-persistence-parser";

const foodId = "123e4567-e89b-12d3-a456-426614174000";

function validInput(overrides: Record<string, unknown> = {}) {
  return {
    aliases: [],
    brand_name: "Example Brand",
    locale: "en",
    name: "Example custom food",
    nutrient_basis: "per_serving",
    nutrients: [],
    serving_quantity: 1,
    serving_unit: "serving",
    ...overrides,
  };
}

test.describe("custom-food payload validation", () => {
  test("defines the complete 35-code V1 nutrient set", () => {
    expect(customFoodNutrientCodes).toHaveLength(35);
    expect(new Set(customFoodNutrientCodes).size).toBe(35);
    expect(customFoodNutrientCodes).toEqual(
      expect.arrayContaining([
        "energy_kcal",
        "protein_g",
        "carbohydrates_g",
        "fat_g",
        "fiber_g",
        "selenium_ug",
        "vitamin_a_rae_ug",
        "folate_dfe_ug",
        "choline_mg",
      ]),
    );
  });

  test("trims identity fields and preserves valid per-serving metadata", () => {
    expect(
      validateCustomFoodInput(
        validInput({
          brand_name: "  Brand  ",
          food_id: foodId,
          name: "  Custom food  ",
          serving_quantity: "2.5",
          serving_unit: "  slices  ",
        }),
      ),
    ).toEqual({
      data: {
        aliases: [],
        brand_name: "Brand",
        food_id: foodId,
        locale: "en",
        name: "Custom food",
        nutrient_basis: "per_serving",
        nutrients: [],
        serving_quantity: 2.5,
        serving_unit: "slices",
      },
      ok: true,
    });
  });

  test("requires positive finite per-serving metadata", () => {
    for (const servingQuantity of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(
        validateCustomFoodInput(
          validInput({ serving_quantity: servingQuantity }),
        ),
      ).toMatchObject({
        code: "validation_error",
        fieldErrors: { serving_quantity: "positive_finite_required" },
        ok: false,
      });
    }

    expect(
      validateCustomFoodInput(validInput({ serving_unit: "   " })),
    ).toMatchObject({
      code: "validation_error",
      fieldErrors: { serving_unit: "required" },
      ok: false,
    });
  });

  test("forces canonical 100 g and 100 ml serving metadata", () => {
    expect(
      validateCustomFoodInput(
        validInput({
          nutrient_basis: "per_100g",
          serving_quantity: 7,
          serving_unit: "cups",
        }),
      ),
    ).toMatchObject({
      data: { serving_quantity: 100, serving_unit: "g" },
      ok: true,
    });
    expect(
      validateCustomFoodInput(
        validInput({
          nutrient_basis: "per_100ml",
          serving_quantity: null,
          serving_unit: null,
        }),
      ),
    ).toMatchObject({
      data: { serving_quantity: 100, serving_unit: "ml" },
      ok: true,
    });
  });

  test("omits blank nutrients and preserves explicit zero", () => {
    expect(
      validateCustomFoodInput(
        validInput({
          nutrients: [
            { amount: "", code: "energy_kcal" },
            { amount: null, code: "protein_g" },
            { amount: 0, code: "fat_g" },
          ],
        }),
      ),
    ).toMatchObject({
      data: { nutrients: [{ amount: 0, code: "fat_g" }] },
      ok: true,
    });
  });

  test("accepts expanded vitamin and mineral nutrients", () => {
    expect(
      validateCustomFoodInput(
        validInput({
          nutrients: [
            { amount: 12.5, code: "iron_mg" },
            { amount: 55, code: "selenium_ug" },
            { amount: 80, code: "vitamin_c_mg" },
            { amount: 2.4, code: "vitamin_b12_ug" },
            { amount: 150, code: "choline_mg" },
          ],
        }),
      ),
    ).toMatchObject({ ok: true });
  });

  test("rejects unknown, duplicate, negative, and non-finite nutrients", () => {
    const cases = [
      {
        error: "unknown_code",
        nutrients: [{ amount: 1, code: "mystery_nutrient" }],
      },
      {
        error: "duplicate_code",
        nutrients: [
          { amount: 1, code: "protein_g" },
          { amount: 2, code: "protein_g" },
        ],
      },
      {
        error: "negative_amount",
        nutrients: [{ amount: -1, code: "protein_g" }],
      },
      {
        error: "non_finite_amount",
        nutrients: [{ amount: Number.POSITIVE_INFINITY, code: "protein_g" }],
      },
    ];

    for (const { error, nutrients } of cases) {
      expect(
        validateCustomFoodInput(validInput({ nutrients })),
      ).toMatchObject({
        code: "validation_error",
        fieldErrors: { nutrients: error },
        ok: false,
      });
    }
  });

  test("parses optional nutrient form values without losing zero", () => {
    expect(parseCustomFoodNutrientFormValue("")).toEqual({ status: "blank" });
    expect(parseCustomFoodNutrientFormValue("  ")).toEqual({ status: "blank" });
    expect(parseCustomFoodNutrientFormValue("0")).toEqual({
      amount: 0,
      status: "valid",
    });
    expect(parseCustomFoodNutrientFormValue("2.75")).toEqual({
      amount: 2.75,
      status: "valid",
    });
    expect(parseCustomFoodNutrientFormValue("-1")).toEqual({
      code: "negative_amount",
      status: "invalid",
    });

    for (const value of ["not-a-number", "Infinity", "-Infinity", "1e309"]) {
      expect(parseCustomFoodNutrientFormValue(value)).toEqual({
        code: "invalid_number",
        status: "invalid",
      });
    }
  });

  test("parses strict custom-food management status and page values", () => {
    expect(parseCustomFoodManagementQuery({})).toEqual({
      page: 1,
      status: "active",
      type: "valid",
    });
    expect(
      parseCustomFoodManagementQuery({ page: "2", status: "archived" }),
    ).toEqual({ page: 2, status: "archived", type: "valid" });

    for (const page of [
      "0",
      "-1",
      "1.5",
      "01",
      "not-a-page",
      "9007199254740991",
      "999999999999999999999",
    ]) {
      expect(parseCustomFoodManagementQuery({ page })).toEqual({
        field: "page",
        reason: "invalid",
        type: "invalid",
      });
    }

    expect(parseCustomFoodManagementQuery({ page: ["1", "2"] })).toEqual({
      field: "page",
      reason: "repeated",
      type: "invalid",
    });
    expect(parseCustomFoodManagementQuery({ status: "all" })).toEqual({
      field: "status",
      reason: "invalid",
      type: "invalid",
    });
    expect(
      parseCustomFoodManagementQuery({ status: ["active", "archived"] }),
    ).toEqual({
      field: "status",
      reason: "repeated",
      type: "invalid",
    });
  });

  test("preserves raw aliases across en, he, and und", () => {
    const aliases = [
      { alias_text: "  PEANUT   Butter  ", language_code: "en" },
      { alias_text: "  חמאת   בוטנים  ", language_code: "he" },
      { alias_text: "חמאת Peanut", language_code: "und" },
    ];
    expect(
      validateCustomFoodInput(validInput({ aliases, locale: "und" })),
    ).toMatchObject({ data: { aliases, locale: "und" }, ok: true });
  });

  test("rejects blank, normalized duplicate, and excessive aliases", () => {
    expect(
      validateCustomFoodInput(
        validInput({
          aliases: [
            { alias_text: "Label", language_code: "en" },
            { alias_text: " label ", language_code: "en" },
          ],
        }),
      ),
    ).toMatchObject({
      code: "validation_error",
      fieldErrors: { aliases: "duplicate_alias" },
      ok: false,
    });
    expect(
      validateCustomFoodInput(
        validInput({
          aliases: [{ alias_text: "   ", language_code: "he" }],
        }),
      ),
    ).toMatchObject({
      code: "validation_error",
      fieldErrors: { aliases: "blank_alias" },
      ok: false,
    });
    expect(
      validateCustomFoodInput(
        validInput({
          aliases: Array.from({ length: 21 }, (_, index) => ({
            alias_text: `Alias ${index}`,
            language_code: "en",
          })),
        }),
      ),
    ).toMatchObject({
      code: "validation_error",
      fieldErrors: { aliases: "too_many" },
      ok: false,
    });
  });

  test("rejects caller-controlled ownership and catalog fields", () => {
    for (const field of [
      "owner_user_id",
      "source_id",
      "food_type",
      "data_quality",
      "is_public",
      "is_archived",
      "custom_nutrient_basis",
    ]) {
      expect(
        validateCustomFoodInput(validInput({ [field]: "tampered" })),
      ).toMatchObject({
        code: "validation_error",
        fieldErrors: { [field]: "unsupported_field" },
        ok: false,
      });
    }
  });

  test("validates the narrow archive contract", () => {
    expect(
      validateCustomFoodArchiveInput({ food_id: foodId, is_archived: true }),
    ).toEqual({
      data: { food_id: foodId, is_archived: true },
      ok: true,
    });
    expect(
      validateCustomFoodArchiveInput({
        food_id: "invalid",
        is_archived: "true",
        owner_user_id: foodId,
      }),
    ).toMatchObject({
      code: "validation_error",
      fieldErrors: {
        food_id: "invalid_uuid",
        is_archived: "boolean_required",
        owner_user_id: "unsupported_field",
      },
      ok: false,
    });
  });
});

test.describe("custom-food barcode persistence result parsing", () => {
  const canonicalGtin = "00036000291452";

  function resultRow(
    overrides: Record<string, unknown> = {},
  ): Record<string, unknown> {
    return {
      canonical_gtin: canonicalGtin,
      food_id: foodId,
      is_archived: false,
      result_status: "created",
      ...overrides,
    };
  }

  test("accepts every exact safe status shape", () => {
    expect(
      parseCustomFoodBarcodePersistenceRows([resultRow()], canonicalGtin),
    ).toEqual({
      data: {
        canonical_gtin: canonicalGtin,
        food_id: foodId,
        is_archived: false,
      },
      ok: true,
      status: "created",
    });

    for (const status of ["owned_existing", "public_existing"] as const) {
      expect(
        parseCustomFoodBarcodePersistenceRows(
          [resultRow({ result_status: status })],
          canonicalGtin,
        ),
      ).toEqual({
        canonical_gtin: canonicalGtin,
        food_id: foodId,
        is_archived: false,
        ok: false,
        status,
      });
    }

    expect(
      parseCustomFoodBarcodePersistenceRows(
        [resultRow({ is_archived: true, result_status: "owned_archived" })],
        canonicalGtin,
      ),
    ).toEqual({
      canonical_gtin: canonicalGtin,
      food_id: foodId,
      is_archived: true,
      ok: false,
      status: "owned_archived",
    });

    for (const status of ["ambiguous", "archived_or_unavailable"] as const) {
      expect(
        parseCustomFoodBarcodePersistenceRows(
          [
            resultRow({
              food_id: null,
              is_archived: null,
              result_status: status,
            }),
          ],
          canonicalGtin,
        ),
      ).toEqual({ canonical_gtin: canonicalGtin, ok: false, status });
    }
  });

  test("rejects malformed, mismatched, or over-disclosing result rows", () => {
    const invalidValues = [
      null,
      [],
      [resultRow(), resultRow()],
      [resultRow({ extra: "field" })],
      [resultRow({ canonical_gtin: "00036000291453" })],
      [resultRow({ canonical_gtin: "09780306406157" })],
      [resultRow({ food_id: "not-a-uuid" })],
      [resultRow({ is_archived: true })],
      [resultRow({ result_status: "unknown" })],
      [resultRow({ food_id: null, result_status: "owned_existing" })],
      [resultRow({ is_archived: false, result_status: "owned_archived" })],
      [resultRow({ result_status: "ambiguous" })],
      [
        resultRow({
          food_id: null,
          is_archived: false,
          result_status: "archived_or_unavailable",
        }),
      ],
    ];

    for (const value of invalidValues) {
      expect(
        parseCustomFoodBarcodePersistenceRows(value, canonicalGtin),
      ).toBeNull();
    }
  });
});
