import { parseExactNonnegativeDecimal, parseNutrientReferenceValues } from "@/lib/nutrition-snapshots";
import { isUuid } from "./query";
import type { AllFoodNutrientReference } from "./nutrient-scaling";

export type FoodDiaryPrefill = AllFoodNutrientReference & {
  name: string;
  brand_name: string | null;
  food_type: "generic" | "branded" | "user_custom";
  data_quality: "user_provided" | "curated" | "verified" | "imported" | "estimated" | "unknown";
  is_owned: boolean;
  source_id: string | null;
  source_code: string | null;
  source_name: string | null;
  source_food_id: string | null;
  source_updated_at: string;
};

const expectedKeys = [
  "food_id", "name", "brand_name", "nutrient_basis", "serving_quantity", "serving_unit",
  "food_type", "data_quality", "is_owned", "source_id", "source_code", "source_name",
  "source_food_id", "source_updated_at", "reference_fingerprint", "nutrients",
] as const;
const foodTypes = new Set(["generic", "branded", "user_custom"]);
const qualities = new Set(["user_provided", "curated", "verified", "imported", "estimated", "unknown"]);
const bases = new Set(["per_100g", "per_100ml", "per_serving"]);

function nullableText(value: unknown, maximum?: number): value is string | null {
  return value === null || (typeof value === "string" &&
    (maximum === undefined || Array.from(value).length <= maximum));
}

function quantityIsValid(value: unknown): value is number | null {
  if (value === null) return true;
  if (typeof value !== "number") return false;
  const amount = parseExactNonnegativeDecimal(value);
  if (!amount) return false;
  const thousandths = amount.numerator * BigInt(1000);
  return thousandths % amount.denominator === BigInt(0) &&
    thousandths / amount.denominator <= BigInt("9999999999");
}

// This parser is independent of server-only clients so client/server acceptance
// can exercise the complete v1 wire contract, including unsupported versions.
export function parseFoodNutritionReference(value: unknown, expectedFoodId?: string): FoodDiaryPrefill | null {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return null;
  const row = value as Record<string, unknown>;
  if (Object.keys(row).length !== expectedKeys.length || !expectedKeys.every(key => Object.hasOwn(row, key)) ||
    typeof row.food_id !== "string" || !isUuid(row.food_id) ||
    (expectedFoodId !== undefined && row.food_id.toLowerCase() !== expectedFoodId.toLowerCase()) ||
    typeof row.name !== "string" || row.name.trim() === "" || Array.from(row.name).length > 200 ||
    !nullableText(row.brand_name, 120) || !quantityIsValid(row.serving_quantity) ||
    !nullableText(row.serving_unit, 40) || (typeof row.serving_unit === "string" && row.serving_unit.trim() === "") ||
    (row.nutrient_basis !== null && (typeof row.nutrient_basis !== "string" || !bases.has(row.nutrient_basis))) ||
    typeof row.food_type !== "string" || !foodTypes.has(row.food_type) ||
    typeof row.data_quality !== "string" || !qualities.has(row.data_quality) ||
    typeof row.is_owned !== "boolean" ||
    (row.source_id !== null && (typeof row.source_id !== "string" || !isUuid(row.source_id))) ||
    !nullableText(row.source_code) || !nullableText(row.source_name, 120) || !nullableText(row.source_food_id, 160) ||
    typeof row.source_updated_at !== "string" || row.source_updated_at.length > 80 || !Number.isFinite(Date.parse(row.source_updated_at)) ||
    typeof row.reference_fingerprint !== "string" || !/^[a-f0-9]{64}$/.test(row.reference_fingerprint)) return null;

  if ((row.nutrient_basis === "per_100g" && (row.serving_quantity !== 100 || row.serving_unit !== "g")) ||
    (row.nutrient_basis === "per_100ml" && (row.serving_quantity !== 100 || row.serving_unit !== "ml"))) return null;
  const nutrients = parseNutrientReferenceValues(row.nutrients);
  if (!nutrients.ok || (row.nutrient_basis === null && Object.values(nutrients.data).some(amount => amount !== null))) return null;
  const number = (amount: string | null) => amount === null ? null : Number(amount);
  return {
    ...row,
    nutrients: nutrients.data,
    calories: number(nutrients.data.energy_kcal),
    protein_g: number(nutrients.data.protein_g),
    carbohydrates_g: number(nutrients.data.carbohydrates_g),
    fat_g: number(nutrients.data.fat_g),
  } as FoodDiaryPrefill;
}

// v1 stays strict and unchanged for existing consumers. v2 adds catalog serving
// metadata from the same database snapshot as the nutrient reference.
export function parseFoodNutritionReferenceV2(value: unknown, expectedFoodId?: string): FoodDiaryPrefill | null {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return null;
  const row = value as Record<string, unknown>;
  if (Object.keys(row).length !== expectedKeys.length + 2 ||
    !Object.hasOwn(row, "catalog_serving_quantity") || !Object.hasOwn(row, "catalog_serving_unit") ||
    !quantityIsValid(row.catalog_serving_quantity) || !nullableText(row.catalog_serving_unit, 40) ||
    (typeof row.catalog_serving_unit === "string" && row.catalog_serving_unit.trim() === "")) return null;
  const { catalog_serving_quantity, catalog_serving_unit, ...v1 } = row;
  const reference = parseFoodNutritionReference(v1, expectedFoodId);
  return reference ? { ...reference, catalog_serving_quantity, catalog_serving_unit } as FoodDiaryPrefill : null;
}
