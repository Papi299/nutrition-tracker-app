import "server-only";

import type { SupabaseClient, User } from "@supabase/supabase-js";
import {
  buildAccountExportPayload,
  type AccountExportSourceData,
} from "@/lib/account-export/schema";
import type { Database } from "@/lib/supabase/database.types";

export const accountExportPageSize = 500;
const relatedIdBatchSize = 100;

type TableName = keyof Database["public"]["Tables"];
type Row<Table extends TableName> =
  Database["public"]["Tables"][Table]["Row"];

type PageResult<T> = PromiseLike<{
  data: T[] | null;
  error: { message: string } | null;
}>;

export type AccountExportFailureInjection = "after-diary";

export class AccountExportCollectionError extends Error {
  constructor() {
    super("Account export collection failed.");
    this.name = "AccountExportCollectionError";
  }
}

async function readAllPages<T>(
  readPage: (from: number, to: number) => PageResult<T>,
) {
  const rows: T[] = [];

  for (let from = 0; ; from += accountExportPageSize) {
    const { data, error } = await readPage(
      from,
      from + accountExportPageSize - 1,
    );

    if (error || !data) {
      throw new AccountExportCollectionError();
    }

    rows.push(...data);

    if (data.length < accountExportPageSize) {
      return rows;
    }
  }
}

function batches<T>(values: T[]) {
  const result: T[][] = [];

  for (let index = 0; index < values.length; index += relatedIdBatchSize) {
    result.push(values.slice(index, index + relatedIdBatchSize));
  }

  return result;
}

async function readAllRelatedRows<T>(
  ids: string[],
  readBatchPage: (
    ids: string[],
    from: number,
    to: number,
  ) => PageResult<T>,
) {
  const rows: T[] = [];

  for (const batch of batches([...new Set(ids)].sort())) {
    rows.push(
      ...(await readAllPages((from, to) =>
        readBatchPage(batch, from, to),
      )),
    );
  }

  return rows;
}

function requireOne<T>(rows: T[]) {
  if (rows.length !== 1) {
    throw new AccountExportCollectionError();
  }

  return rows[0];
}

function maybeInjectFailure(
  expected: AccountExportFailureInjection,
  actual?: AccountExportFailureInjection,
) {
  if (expected === actual) {
    throw new AccountExportCollectionError();
  }
}

export async function collectAccountExport({
  account,
  exportedAt = new Date(),
  failureInjection,
  supabase,
}: {
  account: Pick<User, "created_at" | "email" | "id">;
  exportedAt?: Date;
  failureInjection?: AccountExportFailureInjection;
  supabase: SupabaseClient<Database>;
}) {
  const userId = account.id;

  const activation = requireOne(
    await readAllPages<Row<"account_activations">>((from, to) =>
      supabase
        .from("account_activations")
        .select(
          "activation_completed_at,eligibility_accepted_at,eligibility_statement_version,user_id",
        )
        .eq("user_id", userId)
        .order("user_id", { ascending: true })
        .range(from, to) as unknown as PageResult<Row<"account_activations">>,
    ),
  );

  if (activation.user_id !== userId) {
    throw new AccountExportCollectionError();
  }

  const profiles = await readAllPages<Row<"profiles">>((from, to) =>
    supabase
      .from("profiles")
      .select(
        "created_at,display_name,id,preferred_language,unit_system,updated_at",
      )
      .eq("id", userId)
      .order("id", { ascending: true })
      .range(from, to) as unknown as PageResult<Row<"profiles">>,
  );

  if (profiles.length > 1 || profiles.some((row) => row.id !== userId)) {
    throw new AccountExportCollectionError();
  }

  const nutritionTargets = await readAllPages<Row<"nutrition_targets">>(
    (from, to) =>
      supabase
        .from("nutrition_targets")
        .select(
          "calories,carbohydrates_g,created_at,effective_from,fat_g,id,protein_g,updated_at,user_id",
        )
        .eq("user_id", userId)
        .order("effective_from", { ascending: true })
        .order("id", { ascending: true })
        .range(from, to) as unknown as PageResult<Row<"nutrition_targets">>,
  );

  const diaryEntries = await readAllPages<Row<"diary_entries">>((from, to) =>
    supabase
      .from("diary_entries")
      .select(
        "brand_name,calories,carbohydrates_g,created_at,entry_date,fat_g,food_id,food_name,id,meal_type,notes,protein_g,recipe_diary_run_id,saved_meal_diary_run_id,saved_meal_item_position,serving_quantity,serving_unit,source,updated_at,user_id,version",
      )
      .eq("user_id", userId)
      .order("entry_date", { ascending: true })
      .order("created_at", { ascending: true })
      .order("id", { ascending: true })
      .range(from, to) as unknown as PageResult<Row<"diary_entries">>,
  );

  maybeInjectFailure("after-diary", failureInjection);

  const customFoods = await readAllPages<Row<"foods">>((from, to) =>
    supabase
      .from("foods")
      .select(
        "brand_name,created_at,custom_nutrient_basis,data_quality,food_type,id,is_archived,is_public,locale,name,owner_user_id,serving_size,serving_unit,source_food_id,source_id,updated_at",
      )
      .eq("owner_user_id", userId)
      .order("created_at", { ascending: true })
      .order("id", { ascending: true })
      .range(from, to) as unknown as PageResult<Row<"foods">>,
  );
  const customFoodIds = customFoods.map((row) => row.id);

  const customFoodAliases = await readAllRelatedRows<Row<"food_aliases">>(
    customFoodIds,
    (ids, from, to) =>
      supabase
        .from("food_aliases")
        .select(
          "alias_text,created_at,food_id,id,language_code,updated_at",
        )
        .in("food_id", ids)
        .order("food_id", { ascending: true })
        .order("language_code", { ascending: true })
        .order("alias_text", { ascending: true })
        .order("id", { ascending: true })
        .range(from, to) as unknown as PageResult<Row<"food_aliases">>,
  );
  const customFoodBarcodes = await readAllRelatedRows<Row<"food_barcodes">>(
    customFoodIds,
    (ids, from, to) =>
      supabase
        .from("food_barcodes")
        .select(
          "canonical_gtin,food_id,provenance_source_food_id,provenance_source_id,verification_status",
        )
        .in("food_id", ids)
        .order("food_id", { ascending: true })
        .order("canonical_gtin", { ascending: true })
        .order("provenance_source_id", { ascending: true })
        .range(from, to) as unknown as PageResult<Row<"food_barcodes">>,
  );
  const customFoodNutrients = await readAllRelatedRows<Row<"food_nutrients">>(
    customFoodIds,
    (ids, from, to) =>
      supabase
        .from("food_nutrients")
        .select(
          "amount,basis,created_at,food_id,id,nutrient_id,updated_at",
        )
        .in("food_id", ids)
        .order("food_id", { ascending: true })
        .order("nutrient_id", { ascending: true })
        .order("id", { ascending: true })
        .range(from, to) as unknown as PageResult<Row<"food_nutrients">>,
  );

  const favorites = await readAllPages<Row<"food_favorites">>((from, to) =>
    supabase
      .from("food_favorites")
      .select("created_at,food_id,user_id")
      .eq("user_id", userId)
      .order("created_at", { ascending: true })
      .order("food_id", { ascending: true })
      .range(from, to) as unknown as PageResult<Row<"food_favorites">>,
  );

  const savedMeals = await readAllPages<Row<"saved_meals">>((from, to) =>
    supabase
      .from("saved_meals")
      .select("created_at,id,is_archived,locale,name,updated_at,user_id")
      .eq("user_id", userId)
      .order("created_at", { ascending: true })
      .order("id", { ascending: true })
      .range(from, to) as unknown as PageResult<Row<"saved_meals">>,
  );
  const savedMealItems = await readAllRelatedRows<Row<"saved_meal_items">>(
    savedMeals.map((row) => row.id),
    (ids, from, to) =>
      supabase
        .from("saved_meal_items")
        .select(
          "brand_name,calories,carbohydrates_g,created_at,fat_g,food_id,food_name,id,notes,position,protein_g,saved_meal_id,serving_quantity,serving_unit",
        )
        .in("saved_meal_id", ids)
        .order("saved_meal_id", { ascending: true })
        .order("position", { ascending: true })
        .order("id", { ascending: true })
        .range(from, to) as unknown as PageResult<Row<"saved_meal_items">>,
  );
  const savedMealDiaryRuns = await readAllPages<
    Row<"saved_meal_diary_runs">
  >((from, to) =>
    supabase
      .from("saved_meal_diary_runs")
      .select(
        "created_at,entry_date,id,item_count,meal_type,saved_meal_id,source_updated_at,user_id",
      )
      .eq("user_id", userId)
      .order("created_at", { ascending: true })
      .order("id", { ascending: true })
      .range(from, to) as unknown as PageResult<Row<"saved_meal_diary_runs">>,
  );

  const recipes = await readAllPages<Row<"recipes">>((from, to) =>
    supabase
      .from("recipes")
      .select(
        "created_at,id,is_archived,locale,name,updated_at,user_id,yield_servings",
      )
      .eq("user_id", userId)
      .order("created_at", { ascending: true })
      .order("id", { ascending: true })
      .range(from, to) as unknown as PageResult<Row<"recipes">>,
  );
  const recipeIngredients = await readAllRelatedRows<
    Row<"recipe_ingredients">
  >(
    recipes.map((row) => row.id),
    (ids, from, to) =>
      supabase
        .from("recipe_ingredients")
        .select(
          "brand_name,calories,carbohydrates_g,created_at,fat_g,food_id,id,ingredient_name,notes,position,protein_g,quantity,recipe_id,unit",
        )
        .in("recipe_id", ids)
        .order("recipe_id", { ascending: true })
        .order("position", { ascending: true })
        .order("id", { ascending: true })
        .range(from, to) as unknown as PageResult<Row<"recipe_ingredients">>,
  );
  const recipeDiaryRuns = await readAllPages<Row<"recipe_diary_runs">>(
    (from, to) =>
      supabase
        .from("recipe_diary_runs")
        .select(
          "created_at,entry_date,id,meal_type,recipe_id,requested_servings,source_updated_at,user_id",
        )
        .eq("user_id", userId)
        .order("created_at", { ascending: true })
        .order("id", { ascending: true })
        .range(from, to) as unknown as PageResult<Row<"recipe_diary_runs">>,
  );

  const customFoodCreationRequests = await readAllPages<
    Row<"custom_food_creation_requests">
  >((from, to) =>
    supabase
      .from("custom_food_creation_requests")
      .select("completed_at,completed_food_id,id,live_food_id,user_id")
      .eq("user_id", userId)
      .order("completed_at", { ascending: true })
      .order("id", { ascending: true })
      .range(from, to) as unknown as PageResult<
      Row<"custom_food_creation_requests">
    >,
  );
  const manualDiaryEntryRequests = await readAllPages<
    Row<"manual_diary_entry_requests">
  >((from, to) =>
    supabase
      .from("manual_diary_entry_requests")
      .select(
        "completed_at,completed_diary_entry_id,id,live_diary_entry_id,user_id",
      )
      .eq("user_id", userId)
      .order("completed_at", { ascending: true })
      .order("id", { ascending: true })
      .range(from, to) as unknown as PageResult<
      Row<"manual_diary_entry_requests">
    >,
  );

  const referencedFoods = await readAllRelatedRows<Row<"foods">>(
    favorites.map((row) => row.food_id),
    (ids, from, to) =>
      supabase
        .from("foods")
        .select(
          "brand_name,data_quality,food_type,id,locale,name,serving_size,serving_unit,source_id",
        )
        .in("id", ids)
        .order("name", { ascending: true })
        .order("id", { ascending: true })
        .range(from, to) as unknown as PageResult<Row<"foods">>,
  );
  const foodSources = await readAllRelatedRows<Row<"food_sources">>(
    [
      ...customFoods.map((row) => row.source_id),
      ...customFoodBarcodes.map((row) => row.provenance_source_id),
      ...referencedFoods.map((row) => row.source_id),
    ].filter((id): id is string => Boolean(id)),
    (ids, from, to) =>
      supabase
        .from("food_sources")
        .select(
          "code,description,id,is_external,name,source_type,trust_level",
        )
        .in("id", ids)
        .order("code", { ascending: true })
        .order("id", { ascending: true })
        .range(from, to) as unknown as PageResult<Row<"food_sources">>,
  );
  const nutrients = await readAllRelatedRows<Row<"nutrients">>(
    customFoodNutrients.map((row) => row.nutrient_id),
    (ids, from, to) =>
      supabase
        .from("nutrients")
        .select(
          "code,display_order,id,name_en,name_he,nutrient_group,unit",
        )
        .in("id", ids)
        .order("display_order", { ascending: true })
        .order("code", { ascending: true })
        .order("id", { ascending: true })
        .range(from, to) as unknown as PageResult<Row<"nutrients">>,
  );

  const source: AccountExportSourceData = {
    account,
    activation,
    customFoodCreationRequests,
    customFoodAliases,
    customFoodBarcodes,
    customFoodNutrients,
    customFoods,
    diaryEntries,
    favorites,
    foodSources,
    manualDiaryEntryRequests,
    nutrients,
    nutritionTargets,
    profile: profiles[0] ?? null,
    recipeDiaryRuns,
    recipeIngredients,
    recipes,
    referencedFoods,
    savedMealDiaryRuns,
    savedMealItems,
    savedMeals,
  };

  return buildAccountExportPayload(source, exportedAt.toISOString());
}
