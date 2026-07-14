import { validationError, type DataResult } from "@/lib/data/result";
import { normalizeFoodSearchQuery } from "@/lib/food-search/query";
import { isUuid } from "@/lib/food-selection/query";

export const customFoodLocales = ["en", "he", "und"] as const;
export const customFoodNutrientBases = [
  "per_serving",
  "per_100g",
  "per_100ml",
] as const;
export const customFoodNutrientCodes = [
  "energy_kcal",
  "protein_g",
  "carbohydrates_g",
  "fiber_g",
  "sugars_g",
  "added_sugars_g",
  "fat_g",
  "saturated_fat_g",
  "monounsaturated_fat_g",
  "polyunsaturated_fat_g",
  "trans_fat_g",
  "cholesterol_mg",
  "sodium_mg",
  "potassium_mg",
  "calcium_mg",
  "iron_mg",
  "magnesium_mg",
  "phosphorus_mg",
  "zinc_mg",
  "copper_mg",
  "manganese_mg",
  "selenium_ug",
  "vitamin_a_rae_ug",
  "vitamin_c_mg",
  "vitamin_d_ug",
  "vitamin_e_mg",
  "vitamin_k_ug",
  "thiamin_mg",
  "riboflavin_mg",
  "niacin_mg",
  "pantothenic_acid_mg",
  "vitamin_b6_mg",
  "folate_dfe_ug",
  "vitamin_b12_ug",
  "choline_mg",
] as const;

export type CustomFoodLocale = (typeof customFoodLocales)[number];
export type CustomFoodNutrientBasis =
  (typeof customFoodNutrientBases)[number];
export type CustomFoodNutrientCode =
  (typeof customFoodNutrientCodes)[number];

export type CustomFoodInput = Record<string, unknown>;

export type ValidatedCustomFoodInput = {
  aliases: Array<{ alias_text: string; language_code: CustomFoodLocale }>;
  brand_name: string | null;
  food_id: string | null;
  locale: CustomFoodLocale;
  name: string;
  nutrient_basis: CustomFoodNutrientBasis;
  nutrients: Array<{ amount: number; code: CustomFoodNutrientCode }>;
  serving_quantity: number;
  serving_unit: string;
};

export type CustomFoodArchiveInput = Record<string, unknown>;

export type ValidatedCustomFoodArchiveInput = {
  food_id: string;
  is_archived: boolean;
};

const maximumFoodNameLength = 200;
const maximumBrandNameLength = 120;
const maximumServingUnitLength = 40;
const maximumAliasLength = 200;
const maximumAliasCount = 20;
const maximumServingQuantity = 9_999_999.999;
const nutrientCodeSet = new Set<string>(customFoodNutrientCodes);
const localeSet = new Set<string>(customFoodLocales);
const basisSet = new Set<string>(customFoodNutrientBases);
const allowedPersistenceFields = new Set([
  "aliases",
  "brand_name",
  "food_id",
  "locale",
  "name",
  "nutrient_basis",
  "nutrients",
  "serving_quantity",
  "serving_unit",
]);
const allowedArchiveFields = new Set(["food_id", "is_archived"]);

function isObjectRecord(input: unknown): input is Record<string, unknown> {
  return typeof input === "object" && input !== null && !Array.isArray(input);
}

function hasOnlyAllowedFields(
  input: Record<string, unknown>,
  allowedFields: Set<string>,
  fieldErrors: Record<string, string>,
) {
  for (const field of Object.keys(input)) {
    if (!allowedFields.has(field)) {
      fieldErrors[field] = "unsupported_field";
    }
  }
}

function validateFoodId(
  value: unknown,
  fieldErrors: Record<string, string>,
): string | null {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  if (typeof value !== "string" || !isUuid(value)) {
    fieldErrors.food_id = "invalid_uuid";
    return null;
  }

  return value;
}

function validateName(value: unknown, fieldErrors: Record<string, string>) {
  if (typeof value !== "string" || value.trim() === "") {
    fieldErrors.name = "required";
    return "";
  }

  const name = value.trim();

  if (Array.from(name).length > maximumFoodNameLength) {
    fieldErrors.name = "too_long";
  }

  return name;
}

function validateBrand(value: unknown, fieldErrors: Record<string, string>) {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  if (typeof value !== "string") {
    fieldErrors.brand_name = "invalid_type";
    return null;
  }

  const brandName = value.trim();

  if (brandName === "") {
    return null;
  }

  if (Array.from(brandName).length > maximumBrandNameLength) {
    fieldErrors.brand_name = "too_long";
  }

  return brandName;
}

function validateLocale(
  value: unknown,
  fieldErrors: Record<string, string>,
): CustomFoodLocale {
  if (typeof value !== "string" || !localeSet.has(value)) {
    fieldErrors.locale = "unsupported_locale";
    return "und";
  }

  return value as CustomFoodLocale;
}

function validateBasis(
  value: unknown,
  fieldErrors: Record<string, string>,
): CustomFoodNutrientBasis {
  if (typeof value !== "string" || !basisSet.has(value)) {
    fieldErrors.nutrient_basis = "unsupported_basis";
    return "per_serving";
  }

  return value as CustomFoodNutrientBasis;
}

function parseFiniteNumber(value: unknown) {
  if (typeof value !== "number" && typeof value !== "string") {
    return null;
  }

  if (typeof value === "string" && value.trim() === "") {
    return null;
  }

  const number = typeof value === "number" ? value : Number(value);
  return Number.isFinite(number) ? number : null;
}

function validateServing(
  basis: CustomFoodNutrientBasis,
  quantityValue: unknown,
  unitValue: unknown,
  fieldErrors: Record<string, string>,
) {
  if (basis === "per_100g") {
    return { quantity: 100, unit: "g" };
  }

  if (basis === "per_100ml") {
    return { quantity: 100, unit: "ml" };
  }

  const quantity = parseFiniteNumber(quantityValue);

  if (
    quantity === null ||
    quantity <= 0 ||
    quantity > maximumServingQuantity
  ) {
    fieldErrors.serving_quantity = "positive_finite_required";
  }

  const unit = typeof unitValue === "string" ? unitValue.trim() : "";

  if (unit === "") {
    fieldErrors.serving_unit = "required";
  } else if (Array.from(unit).length > maximumServingUnitLength) {
    fieldErrors.serving_unit = "too_long";
  }

  return { quantity: quantity ?? 0, unit };
}

function validateNutrients(
  value: unknown,
  fieldErrors: Record<string, string>,
): ValidatedCustomFoodInput["nutrients"] {
  if (value === undefined || value === null) {
    return [];
  }

  if (!Array.isArray(value)) {
    fieldErrors.nutrients = "invalid_collection";
    return [];
  }

  const nutrients: ValidatedCustomFoodInput["nutrients"] = [];
  const seenCodes = new Set<string>();

  for (const item of value) {
    if (!isObjectRecord(item)) {
      fieldErrors.nutrients = "invalid_item";
      continue;
    }

    const itemFields = Object.keys(item);

    if (itemFields.some((field) => field !== "code" && field !== "amount")) {
      fieldErrors.nutrients = "unsupported_field";
    }

    const code = typeof item.code === "string" ? item.code.trim() : "";

    if (!nutrientCodeSet.has(code)) {
      fieldErrors.nutrients = "unknown_code";
      continue;
    }

    if (seenCodes.has(code)) {
      fieldErrors.nutrients = "duplicate_code";
      continue;
    }

    seenCodes.add(code);

    if (
      item.amount === undefined ||
      item.amount === null ||
      (typeof item.amount === "string" && item.amount.trim() === "")
    ) {
      continue;
    }

    const amount = parseFiniteNumber(item.amount);

    if (amount === null) {
      fieldErrors.nutrients = "non_finite_amount";
      continue;
    }

    if (amount < 0) {
      fieldErrors.nutrients = "negative_amount";
      continue;
    }

    nutrients.push({
      amount,
      code: code as CustomFoodNutrientCode,
    });
  }

  return nutrients;
}

function validateAliases(
  value: unknown,
  fieldErrors: Record<string, string>,
): ValidatedCustomFoodInput["aliases"] {
  if (value === undefined || value === null) {
    return [];
  }

  if (!Array.isArray(value)) {
    fieldErrors.aliases = "invalid_collection";
    return [];
  }

  if (value.length > maximumAliasCount) {
    fieldErrors.aliases = "too_many";
  }

  const aliases: ValidatedCustomFoodInput["aliases"] = [];
  const normalizedAliases = new Set<string>();

  for (const item of value) {
    if (!isObjectRecord(item)) {
      fieldErrors.aliases = "invalid_item";
      continue;
    }

    const itemFields = Object.keys(item);

    if (
      itemFields.some(
        (field) => field !== "alias_text" && field !== "language_code",
      )
    ) {
      fieldErrors.aliases = "unsupported_field";
    }

    if (
      typeof item.alias_text !== "string" ||
      typeof item.language_code !== "string"
    ) {
      fieldErrors.aliases = "invalid_item";
      continue;
    }

    if (!localeSet.has(item.language_code)) {
      fieldErrors.aliases = "unsupported_language";
      continue;
    }

    const normalizedAlias = normalizeFoodSearchQuery(item.alias_text);

    if (normalizedAlias === "") {
      fieldErrors.aliases = "blank_alias";
      continue;
    }

    if (Array.from(item.alias_text).length > maximumAliasLength) {
      fieldErrors.aliases = "too_long";
      continue;
    }

    const uniquenessKey = `${item.language_code}\u0000${normalizedAlias}`;

    if (normalizedAliases.has(uniquenessKey)) {
      fieldErrors.aliases = "duplicate_alias";
      continue;
    }

    normalizedAliases.add(uniquenessKey);
    aliases.push({
      alias_text: item.alias_text,
      language_code: item.language_code as CustomFoodLocale,
    });
  }

  return aliases;
}

export function validateCustomFoodInput(
  input: unknown,
): DataResult<ValidatedCustomFoodInput> {
  const fieldErrors: Record<string, string> = {};

  if (!isObjectRecord(input)) {
    return validationError({ form: "invalid_input" });
  }

  hasOnlyAllowedFields(input, allowedPersistenceFields, fieldErrors);
  const foodId = validateFoodId(input.food_id, fieldErrors);
  const name = validateName(input.name, fieldErrors);
  const brandName = validateBrand(input.brand_name, fieldErrors);
  const locale = validateLocale(input.locale, fieldErrors);
  const nutrientBasis = validateBasis(input.nutrient_basis, fieldErrors);
  const serving = validateServing(
    nutrientBasis,
    input.serving_quantity,
    input.serving_unit,
    fieldErrors,
  );
  const nutrients = validateNutrients(input.nutrients, fieldErrors);
  const aliases = validateAliases(input.aliases, fieldErrors);

  if (Object.keys(fieldErrors).length > 0) {
    return validationError(fieldErrors);
  }

  return {
    data: {
      aliases,
      brand_name: brandName,
      food_id: foodId,
      locale,
      name,
      nutrient_basis: nutrientBasis,
      nutrients,
      serving_quantity: serving.quantity,
      serving_unit: serving.unit,
    },
    ok: true,
  };
}

export function validateCustomFoodArchiveInput(
  input: unknown,
): DataResult<ValidatedCustomFoodArchiveInput> {
  const fieldErrors: Record<string, string> = {};

  if (!isObjectRecord(input)) {
    return validationError({ form: "invalid_input" });
  }

  hasOnlyAllowedFields(input, allowedArchiveFields, fieldErrors);
  const foodId = validateFoodId(input.food_id, fieldErrors);

  if (!foodId) {
    fieldErrors.food_id ??= "required";
  }

  if (typeof input.is_archived !== "boolean") {
    fieldErrors.is_archived = "boolean_required";
  }

  if (Object.keys(fieldErrors).length > 0 || !foodId) {
    return validationError(fieldErrors);
  }

  return {
    data: { food_id: foodId, is_archived: input.is_archived as boolean },
    ok: true,
  };
}
