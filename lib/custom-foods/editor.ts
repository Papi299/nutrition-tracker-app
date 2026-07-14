import "server-only";

import { getAuthenticatedUserId } from "@/lib/data/auth";
import type { DataResult } from "@/lib/data/result";
import { isUuid } from "@/lib/food-selection/query";
import { createServerClient } from "@/lib/supabase";
import type { Database, Json } from "@/lib/supabase/database.types";
import {
  customFoodLocales,
  customFoodNutrientBases,
  customFoodNutrientCodes,
  type CustomFoodLocale,
  type CustomFoodNutrientBasis,
  type CustomFoodNutrientCode,
} from "./validation";

export type CustomFoodEditorNutrient = {
  amount: number;
  code: CustomFoodNutrientCode;
};

export type CustomFoodEditorAlias = {
  alias_text: string;
  language_code: CustomFoodLocale;
};

export type OwnedCustomFoodEditor = {
  aliases: CustomFoodEditorAlias[];
  brand_name: string | null;
  food_id: string;
  is_archived: boolean;
  locale: CustomFoodLocale;
  name: string;
  nutrient_basis: CustomFoodNutrientBasis;
  nutrients: CustomFoodEditorNutrient[];
  serving_quantity: number;
  serving_unit: string;
};

export type CustomFoodNutrientDefinition = Pick<
  Database["public"]["Tables"]["nutrients"]["Row"],
  | "code"
  | "display_order"
  | "name_en"
  | "name_he"
  | "nutrient_group"
  | "unit"
> & { code: CustomFoodNutrientCode };

const localeSet = new Set<string>(customFoodLocales);
const basisSet = new Set<string>(customFoodNutrientBases);
const nutrientCodeSet = new Set<string>(customFoodNutrientCodes);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseNutrients(value: Json): CustomFoodEditorNutrient[] | null {
  if (!Array.isArray(value)) {
    return null;
  }

  const parsed: CustomFoodEditorNutrient[] = [];

  for (const item of value) {
    if (
      !isRecord(item) ||
      typeof item.code !== "string" ||
      !nutrientCodeSet.has(item.code) ||
      typeof item.amount !== "number" ||
      !Number.isFinite(item.amount) ||
      item.amount < 0
    ) {
      return null;
    }

    parsed.push({
      amount: item.amount,
      code: item.code as CustomFoodNutrientCode,
    });
  }

  return parsed;
}

function parseAliases(value: Json): CustomFoodEditorAlias[] | null {
  if (!Array.isArray(value)) {
    return null;
  }

  const parsed: CustomFoodEditorAlias[] = [];

  for (const item of value) {
    if (
      !isRecord(item) ||
      typeof item.alias_text !== "string" ||
      typeof item.language_code !== "string" ||
      !localeSet.has(item.language_code)
    ) {
      return null;
    }

    parsed.push({
      alias_text: item.alias_text,
      language_code: item.language_code as CustomFoodLocale,
    });
  }

  return parsed;
}

export async function getOwnedCustomFoodEditor(
  foodId: string,
): Promise<DataResult<OwnedCustomFoodEditor>> {
  if (!isUuid(foodId)) {
    return {
      code: "validation_error",
      fieldErrors: { food_id: "invalid_uuid" },
      ok: false,
    };
  }

  const auth = await getAuthenticatedUserId();

  if (!auth.ok) {
    return auth;
  }

  const supabase = await createServerClient();
  const { data, error } = await supabase
    .rpc("get_owned_custom_food_editor", { p_food_id: foodId })
    .maybeSingle();

  if (error) {
    return { code: "database_error", ok: false };
  }

  if (!data) {
    return { code: "not_found", ok: false };
  }

  const nutrients = parseNutrients(data.nutrients);
  const aliases = parseAliases(data.aliases);

  if (
    !nutrients ||
    !aliases ||
    !localeSet.has(data.locale) ||
    !basisSet.has(data.nutrient_basis) ||
    typeof data.serving_quantity !== "number" ||
    typeof data.serving_unit !== "string"
  ) {
    return { code: "database_error", ok: false };
  }

  return {
    data: {
      aliases,
      brand_name: data.brand_name,
      food_id: data.food_id,
      is_archived: data.is_archived,
      locale: data.locale as CustomFoodLocale,
      name: data.name,
      nutrient_basis: data.nutrient_basis as CustomFoodNutrientBasis,
      nutrients,
      serving_quantity: data.serving_quantity,
      serving_unit: data.serving_unit,
    },
    ok: true,
  };
}

export async function getCustomFoodNutrientDictionary(): Promise<
  DataResult<CustomFoodNutrientDefinition[]>
> {
  const auth = await getAuthenticatedUserId();

  if (!auth.ok) {
    return auth;
  }

  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("nutrients")
    .select("code,name_en,name_he,unit,nutrient_group,display_order")
    .order("display_order")
    .order("code");

  if (error || !data || data.length !== customFoodNutrientCodes.length) {
    return { code: "database_error", ok: false };
  }

  const definitions: CustomFoodNutrientDefinition[] = [];
  const seenCodes = new Set<string>();

  for (const definition of data) {
    if (
      !nutrientCodeSet.has(definition.code) ||
      seenCodes.has(definition.code)
    ) {
      return { code: "database_error", ok: false };
    }

    seenCodes.add(definition.code);
    definitions.push({
      ...definition,
      code: definition.code as CustomFoodNutrientCode,
    });
  }

  return { data: definitions, ok: true };
}
