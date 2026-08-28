import type { User } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";

export const accountExportSchema = "nutrition-tracker-account-export";
export const accountExportVersion = 1;

type TableName = keyof Database["public"]["Tables"];
type Row<Table extends TableName> =
  Database["public"]["Tables"][Table]["Row"];

export type AccountExportIdentity = Pick<User, "created_at" | "email" | "id">;

export type AccountExportSourceData = Readonly<{
  account: AccountExportIdentity;
  activation: Row<"account_activations">;
  customFoodCreationRequests: Row<"custom_food_creation_requests">[];
  customFoodAliases: Row<"food_aliases">[];
  customFoodBarcodes: Row<"food_barcodes">[];
  customFoodNutrients: Row<"food_nutrients">[];
  customFoods: Row<"foods">[];
  diaryEntries: Row<"diary_entries">[];
  favorites: Row<"food_favorites">[];
  foodSources: Row<"food_sources">[];
  manualDiaryEntryRequests: Row<"manual_diary_entry_requests">[];
  nutrients: Row<"nutrients">[];
  nutritionTargets: Row<"nutrition_targets">[];
  profile: Row<"profiles"> | null;
  recipeDiaryRuns: Row<"recipe_diary_runs">[];
  recipeIngredients: Row<"recipe_ingredients">[];
  recipes: Row<"recipes">[];
  referencedFoods: Row<"foods">[];
  savedMealDiaryRuns: Row<"saved_meal_diary_runs">[];
  savedMealItems: Row<"saved_meal_items">[];
  savedMeals: Row<"saved_meals">[];
}>;

function compareText(left: string, right: string) {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

function byFields<T>(...readers: Array<(value: T) => string | number>) {
  return (left: T, right: T) => {
    for (const read of readers) {
      const leftValue = read(left);
      const rightValue = read(right);
      const result =
        typeof leftValue === "number" && typeof rightValue === "number"
          ? leftValue - rightValue
          : compareText(String(leftValue), String(rightValue));

      if (result !== 0) return result;
    }

    return 0;
  };
}

function groupedBy<Parent extends string, Value>(
  values: Value[],
  parent: (value: Value) => Parent,
) {
  const grouped = new Map<Parent, Value[]>();

  for (const value of values) {
    const key = parent(value);
    const group = grouped.get(key);

    if (group) group.push(value);
    else grouped.set(key, [value]);
  }

  return grouped;
}

export function accountExportFilename(exportedAt: Date) {
  if (!Number.isFinite(exportedAt.getTime())) {
    throw new Error("Account export time is invalid.");
  }

  return `nutrition-tracker-account-export-v${accountExportVersion}-${exportedAt
    .toISOString()
    .slice(0, 10)}.json`;
}

export function buildAccountExportPayload(
  source: AccountExportSourceData,
  exportedAt: string,
) {
  const aliasesByFood = groupedBy(
    source.customFoodAliases,
    (row) => row.food_id,
  );
  const barcodesByFood = groupedBy(
    source.customFoodBarcodes,
    (row) => row.food_id,
  );
  const nutrientsByFood = groupedBy(
    source.customFoodNutrients,
    (row) => row.food_id,
  );
  const itemsByMeal = groupedBy(
    source.savedMealItems,
    (row) => row.saved_meal_id,
  );
  const ingredientsByRecipe = groupedBy(
    source.recipeIngredients,
    (row) => row.recipe_id,
  );
  const nutrientCodes = new Map(
    source.nutrients.map((row) => [row.id, row.code]),
  );

  return {
    schema: accountExportSchema,
    version: accountExportVersion,
    exportedAt,
    account: {
      id: source.account.id,
      email: source.account.email ?? null,
      createdAt: source.account.created_at,
      activation: {
        completedAt: source.activation.activation_completed_at,
        eligibilityAcceptedAt: source.activation.eligibility_accepted_at,
        eligibilityStatementVersion:
          source.activation.eligibility_statement_version,
      },
    },
    profile: source.profile
      ? {
          displayName: source.profile.display_name,
          preferredLanguage: source.profile.preferred_language,
          unitSystem: source.profile.unit_system,
          createdAt: source.profile.created_at,
          updatedAt: source.profile.updated_at,
        }
      : null,
    nutritionTargets: [...source.nutritionTargets]
      .sort(byFields((row) => row.effective_from, (row) => row.id))
      .map((row) => ({
        id: row.id,
        effectiveFrom: row.effective_from,
        calories: row.calories,
        proteinG: row.protein_g,
        carbohydratesG: row.carbohydrates_g,
        fatG: row.fat_g,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      })),
    diaryEntries: [...source.diaryEntries]
      .sort(
        byFields(
          (row) => row.entry_date,
          (row) => row.created_at,
          (row) => row.id,
        ),
      )
      .map((row) => ({
        id: row.id,
        entryDate: row.entry_date,
        mealType: row.meal_type,
        foodId: row.food_id,
        foodName: row.food_name,
        brandName: row.brand_name,
        servingQuantity: row.serving_quantity,
        servingUnit: row.serving_unit,
        calories: row.calories,
        proteinG: row.protein_g,
        carbohydratesG: row.carbohydrates_g,
        fatG: row.fat_g,
        notes: row.notes,
        source: row.source,
        savedMealDiaryRunId: row.saved_meal_diary_run_id,
        savedMealItemPosition: row.saved_meal_item_position,
        recipeDiaryRunId: row.recipe_diary_run_id,
        version: row.version,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      })),
    customFoods: [...source.customFoods]
      .sort(byFields((row) => row.created_at, (row) => row.id))
      .map((food) => ({
        id: food.id,
        name: food.name,
        brandName: food.brand_name,
        foodType: food.food_type,
        locale: food.locale,
        servingSize: food.serving_size,
        servingUnit: food.serving_unit,
        nutrientBasis: food.custom_nutrient_basis,
        dataQuality: food.data_quality,
        sourceId: food.source_id,
        sourceFoodId: food.source_food_id,
        isPublic: food.is_public,
        isArchived: food.is_archived,
        createdAt: food.created_at,
        updatedAt: food.updated_at,
        aliases: [...(aliasesByFood.get(food.id) ?? [])]
          .sort(
            byFields(
              (row) => row.language_code,
              (row) => row.alias_text,
              (row) => row.id,
            ),
          )
          .map((row) => ({
            id: row.id,
            text: row.alias_text,
            language: row.language_code,
            createdAt: row.created_at,
            updatedAt: row.updated_at,
          })),
        barcodes: [...(barcodesByFood.get(food.id) ?? [])]
          .sort(
            byFields(
              (row) => row.canonical_gtin,
              (row) => row.provenance_source_id,
            ),
          )
          .map((row) => ({
            canonicalGtin: row.canonical_gtin,
            provenanceSourceId: row.provenance_source_id,
            provenanceSourceFoodId: row.provenance_source_food_id,
            verificationStatus: row.verification_status,
          })),
        nutrients: [...(nutrientsByFood.get(food.id) ?? [])]
          .sort(
            byFields(
              (row) => nutrientCodes.get(row.nutrient_id) ?? "",
              (row) => row.id,
            ),
          )
          .map((row) => ({
            id: row.id,
            nutrientId: row.nutrient_id,
            amount: row.amount,
            basis: row.basis,
            createdAt: row.created_at,
            updatedAt: row.updated_at,
          })),
      })),
    favorites: [...source.favorites]
      .sort(byFields((row) => row.created_at, (row) => row.food_id))
      .map((row) => ({
        foodId: row.food_id,
        favoritedAt: row.created_at,
      })),
    savedMeals: [...source.savedMeals]
      .sort(byFields((row) => row.created_at, (row) => row.id))
      .map((meal) => ({
        id: meal.id,
        name: meal.name,
        locale: meal.locale,
        isArchived: meal.is_archived,
        createdAt: meal.created_at,
        updatedAt: meal.updated_at,
        items: [...(itemsByMeal.get(meal.id) ?? [])]
          .sort(byFields((row) => row.position, (row) => row.id))
          .map((row) => ({
            id: row.id,
            position: row.position,
            foodId: row.food_id,
            foodName: row.food_name,
            brandName: row.brand_name,
            servingQuantity: row.serving_quantity,
            servingUnit: row.serving_unit,
            calories: row.calories,
            proteinG: row.protein_g,
            carbohydratesG: row.carbohydrates_g,
            fatG: row.fat_g,
            notes: row.notes,
            createdAt: row.created_at,
          })),
      })),
    recipes: [...source.recipes]
      .sort(byFields((row) => row.created_at, (row) => row.id))
      .map((recipe) => ({
        id: recipe.id,
        name: recipe.name,
        locale: recipe.locale,
        yieldServings: recipe.yield_servings,
        isArchived: recipe.is_archived,
        createdAt: recipe.created_at,
        updatedAt: recipe.updated_at,
        ingredients: [...(ingredientsByRecipe.get(recipe.id) ?? [])]
          .sort(byFields((row) => row.position, (row) => row.id))
          .map((row) => ({
            id: row.id,
            position: row.position,
            foodId: row.food_id,
            ingredientName: row.ingredient_name,
            brandName: row.brand_name,
            quantity: row.quantity,
            unit: row.unit,
            calories: row.calories,
            proteinG: row.protein_g,
            carbohydratesG: row.carbohydrates_g,
            fatG: row.fat_g,
            notes: row.notes,
            createdAt: row.created_at,
          })),
      })),
    activityRecords: {
      customFoodCreations: [...source.customFoodCreationRequests]
        .sort(byFields((row) => row.completed_at, (row) => row.id))
        .map((row) => ({
          id: row.id,
          completedFoodId: row.completed_food_id,
          liveFoodId: row.live_food_id,
          status: "completed" as const,
          completedAt: row.completed_at,
        })),
      manualDiaryEntries: [...source.manualDiaryEntryRequests]
        .sort(byFields((row) => row.completed_at, (row) => row.id))
        .map((row) => ({
          id: row.id,
          completedDiaryEntryId: row.completed_diary_entry_id,
          liveDiaryEntryId: row.live_diary_entry_id,
          status: "completed" as const,
          completedAt: row.completed_at,
        })),
      savedMealDiaryRuns: [...source.savedMealDiaryRuns]
        .sort(byFields((row) => row.created_at, (row) => row.id))
        .map((row) => ({
          id: row.id,
          savedMealId: row.saved_meal_id,
          entryDate: row.entry_date,
          mealType: row.meal_type,
          itemCount: row.item_count,
          sourceUpdatedAt: row.source_updated_at,
          createdAt: row.created_at,
        })),
      recipeDiaryRuns: [...source.recipeDiaryRuns]
        .sort(byFields((row) => row.created_at, (row) => row.id))
        .map((row) => ({
          id: row.id,
          recipeId: row.recipe_id,
          entryDate: row.entry_date,
          mealType: row.meal_type,
          requestedServings: row.requested_servings,
          sourceUpdatedAt: row.source_updated_at,
          createdAt: row.created_at,
        })),
    },
    references: {
      foodSources: [...source.foodSources]
        .sort(byFields((row) => row.code, (row) => row.id))
        .map((row) => ({
          id: row.id,
          code: row.code,
          name: row.name,
          description: row.description,
          sourceType: row.source_type,
          trustLevel: row.trust_level,
          isExternal: row.is_external,
        })),
      nutrients: [...source.nutrients]
        .sort(
          byFields(
            (row) => row.display_order,
            (row) => row.code,
            (row) => row.id,
          ),
        )
        .map((row) => ({
          id: row.id,
          code: row.code,
          nameEn: row.name_en,
          nameHe: row.name_he,
          unit: row.unit,
          group: row.nutrient_group,
          displayOrder: row.display_order,
        })),
      foods: [...source.referencedFoods]
        .sort(byFields((row) => row.name, (row) => row.id))
        .map((row) => ({
          id: row.id,
          name: row.name,
          brandName: row.brand_name,
          foodType: row.food_type,
          locale: row.locale,
          servingSize: row.serving_size,
          servingUnit: row.serving_unit,
          dataQuality: row.data_quality,
          sourceId: row.source_id,
        })),
    },
  };
}

export type AccountExportPayload = ReturnType<
  typeof buildAccountExportPayload
>;

export function serializeAccountExport(payload: AccountExportPayload) {
  return `${JSON.stringify(payload, null, 2)}\n`;
}
