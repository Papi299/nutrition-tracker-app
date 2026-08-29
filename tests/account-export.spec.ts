import { expect, test } from "@playwright/test";
import {
  accountExportFilename,
  accountExportSchema,
  accountExportVersion,
  buildAccountExportPayload,
  serializeAccountExport,
  type AccountExportSourceData,
} from "@/lib/account-export/schema";
import {
  accountClosureReauthenticationIntent,
  accountExportReauthenticationIntent,
  reauthenticationDestination,
  resolveReauthenticationIntent,
} from "@/lib/auth/reauthentication-intent";

const userId = "11111111-1111-4111-8111-111111111111";

function source(
  overrides: Partial<AccountExportSourceData> = {},
): AccountExportSourceData {
  return {
    account: {
      created_at: "2026-01-02T03:04:05.000Z",
      email: "export-owner@example.test",
      id: userId,
    },
    activation: {
      activation_completed_at: "2026-01-03T03:04:05.000Z",
      eligibility_accepted_at: "2026-01-03T03:04:05.000Z",
      eligibility_statement_version: "eligibility-v1",
      user_id: userId,
    },
    customFoodCreationRequests: [],
    customFoodAliases: [],
    customFoodBarcodes: [],
    customFoodNutrients: [],
    customFoods: [],
    diaryEntries: [],
    favorites: [],
    foodSources: [],
    manualDiaryEntryRequests: [],
    nutrients: [],
    nutritionTargets: [],
    profile: null,
    recipeDiaryRuns: [],
    recipeIngredients: [],
    recipes: [],
    referencedFoods: [],
    savedMealDiaryRuns: [],
    savedMealItems: [],
    savedMeals: [],
    ...overrides,
  };
}

function diaryEntry({
  createdAt,
  entryDate,
  id,
  name,
}: {
  createdAt: string;
  entryDate: string;
  id: string;
  name: string;
}) {
  return {
    brand_name: null,
    calories: 0,
    carbohydrates_g: null,
    created_at: createdAt,
    entry_date: entryDate,
    fat_g: 0,
    food_id: null,
    food_name: name,
    id,
    meal_type: "breakfast",
    notes: "הערת בדיקה",
    protein_g: null,
    recipe_diary_run_id: null,
    saved_meal_diary_run_id: null,
    saved_meal_item_position: null,
    serving_quantity: 0,
    serving_unit: null,
    source: "manual",
    updated_at: createdAt,
    user_id: userId,
    version: 1,
  };
}

test.describe("versioned account export contract", () => {
  test("uses exact root and account allowlists", () => {
    const accountWithForbiddenProviderFields = {
      ...source().account,
      app_metadata: { provider: "email" },
      aud: "authenticated",
      identities: [{ provider: "email" }],
      role: "authenticated",
      user_metadata: { private: "not-exported" },
    };
    const payload = buildAccountExportPayload(
      source({ account: accountWithForbiddenProviderFields }),
      "2026-08-28T12:34:56.000Z",
    );

    expect(Object.keys(payload)).toEqual([
      "schema",
      "version",
      "exportedAt",
      "account",
      "profile",
      "nutritionTargets",
      "diaryEntries",
      "customFoods",
      "favorites",
      "savedMeals",
      "recipes",
      "activityRecords",
      "references",
    ]);
    expect(payload.schema).toBe(accountExportSchema);
    expect(payload.version).toBe(accountExportVersion);
    expect(payload.exportedAt).toBe("2026-08-28T12:34:56.000Z");
    expect(payload.account).toEqual({
      id: userId,
      email: "export-owner@example.test",
      createdAt: "2026-01-02T03:04:05.000Z",
      activation: {
        completedAt: "2026-01-03T03:04:05.000Z",
        eligibilityAcceptedAt: "2026-01-03T03:04:05.000Z",
        eligibilityStatementVersion: "eligibility-v1",
      },
    });
    expect(JSON.stringify(payload.account)).not.toMatch(
      /app_metadata|identities|user_metadata|aud|role/i,
    );
  });

  test("orders rows deterministically and preserves null, explicit zero, and Hebrew", () => {
    const firstId = "11111111-1111-4111-8111-111111111101";
    const secondId = "11111111-1111-4111-8111-111111111102";
    const payload = buildAccountExportPayload(
      source({
        diaryEntries: [
          diaryEntry({
            createdAt: "2026-02-02T09:00:00.000Z",
            entryDate: "2026-02-02",
            id: secondId,
            name: "תפוח מאוחר",
          }),
          diaryEntry({
            createdAt: "2026-02-01T09:00:00.000Z",
            entryDate: "2026-02-01",
            id: firstId,
            name: "תפוח מוקדם",
          }),
        ],
        nutritionTargets: [
          {
            calories: 0,
            carbohydrates_g: null,
            created_at: "2026-02-01T00:00:00.000Z",
            effective_from: "2026-02-01",
            fat_g: 0,
            id: secondId,
            protein_g: null,
            updated_at: "2026-02-01T00:00:00.000Z",
            user_id: userId,
          },
        ],
      }),
      "2026-08-28T12:34:56.000Z",
    );

    expect(payload.diaryEntries.map((entry) => entry.id)).toEqual([
      firstId,
      secondId,
    ]);
    expect(payload.diaryEntries[0]).toMatchObject({
      calories: 0,
      carbohydratesG: null,
      fatG: 0,
      foodName: "תפוח מוקדם",
      notes: "הערת בדיקה",
      proteinG: null,
      servingQuantity: 0,
    });
    expect(payload.nutritionTargets[0]).toMatchObject({
      calories: 0,
      carbohydratesG: null,
      fatG: 0,
      proteinG: null,
    });
    const serialized = serializeAccountExport(payload);
    expect(serialized.endsWith("\n")).toBe(true);
    expect(serialized).toContain("תפוח מוקדם");
    expect(JSON.parse(serialized)).toEqual(payload);
  });

  test("maps representative rows without leaking internal ownership, search, revision, or idempotency fields", () => {
    const foodId = "22222222-2222-4222-8222-222222222222";
    const aliasId = "33333333-3333-4333-8333-333333333333";
    const requestId = "44444444-4444-4444-8444-444444444444";
    const payload = buildAccountExportPayload(
      source({
        customFoodAliases: [
          {
            alias_text: "בדיקת כינוי",
            created_at: "2026-03-01T00:00:00.000Z",
            food_id: foodId,
            id: aliasId,
            language_code: "he",
            normalized_alias: "internal-search-value",
            updated_at: "2026-03-01T00:00:00.000Z",
          },
        ],
        customFoodCreationRequests: [
          {
            completed_at: "2026-03-01T00:00:00.000Z",
            completed_food_id: foodId,
            id: requestId,
            idempotency_key: "55555555-5555-4555-8555-555555555555",
            live_food_id: foodId,
            request_payload: { privateImplementationPayload: true },
            user_id: userId,
            write_transaction_id: "internal-transaction",
          },
        ],
        customFoods: [
          {
            brand_name: null,
            created_at: "2026-03-01T00:00:00.000Z",
            custom_food_edit_revision: 99,
            custom_nutrient_basis: "per_serving",
            data_quality: "user_entered",
            food_type: "user_custom",
            id: foodId,
            is_archived: false,
            is_public: false,
            locale: "he",
            name: "מזון אישי",
            owner_user_id: userId,
            serving_size: 0,
            serving_unit: null,
            source_food_id: null,
            source_id: null,
            updated_at: "2026-03-01T00:00:00.000Z",
          },
        ],
      }),
      "2026-08-28T12:34:56.000Z",
    );
    const serialized = JSON.stringify(payload);

    expect(payload.customFoods[0].aliases[0]).toEqual({
      id: aliasId,
      text: "בדיקת כינוי",
      language: "he",
      createdAt: "2026-03-01T00:00:00.000Z",
      updatedAt: "2026-03-01T00:00:00.000Z",
    });
    expect(payload.activityRecords.customFoodCreations[0]).toEqual({
      id: requestId,
      completedFoodId: foodId,
      liveFoodId: foodId,
      status: "completed",
      completedAt: "2026-03-01T00:00:00.000Z",
    });
    expect(serialized).not.toMatch(
      /owner_user_id|user_id|normalized_alias|edit_revision|idempotency|write_transaction|privateImplementationPayload/i,
    );
  });

  test("creates a stable PII-free filename", () => {
    const filename = accountExportFilename(
      new Date("2026-08-28T23:59:59.999Z"),
    );

    expect(filename).toBe(
      "nutrition-tracker-account-export-v1-2026-08-28.json",
    );
    expect(filename).not.toMatch(/@|example|11111111|export-owner/i);
    expect(() => accountExportFilename(new Date("invalid"))).toThrow();
  });

  test("accepts only the two fixed account-action reauthentication intents", () => {
    expect(
      resolveReauthenticationIntent(accountExportReauthenticationIntent),
    ).toBe(accountExportReauthenticationIntent);
    expect(reauthenticationDestination("he", "account-export")).toBe(
      "/he/account/export",
    );
    expect(
      resolveReauthenticationIntent(accountClosureReauthenticationIntent),
    ).toBe(accountClosureReauthenticationIntent);
    expect(reauthenticationDestination("en", "account-closure")).toBe(
      "/en/account/closure",
    );
    expect(resolveReauthenticationIntent("https://evil.example")).toBeNull();
    expect(resolveReauthenticationIntent(["account-export"])).toBeNull();
    expect(reauthenticationDestination("en", null)).toBe("/en/today");
  });
});
