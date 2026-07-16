import { validationError, type DataResult } from "@/lib/data/result";
import { isUuid } from "@/lib/food-selection/query";

export const savedMealLocales = ["en", "he", "und"] as const;
export type SavedMealLocale = (typeof savedMealLocales)[number];

export type SavedMealInput = Record<string, unknown>;
export type SavedMealArchiveInput = Record<string, unknown>;

export type ValidatedSavedMealItem = {
  position: number;
  food_id: string | null;
  food_name: string;
  brand_name: string | null;
  serving_quantity: number | null;
  serving_unit: string | null;
  calories: number | null;
  protein_g: number | null;
  carbohydrates_g: number | null;
  fat_g: number | null;
  notes: string | null;
};

export type ValidatedSavedMealInput = {
  saved_meal_id: string | null;
  name: string;
  locale: SavedMealLocale;
  items: ValidatedSavedMealItem[];
};

export type ValidatedSavedMealArchiveInput = {
  saved_meal_id: string;
  is_archived: boolean;
};

const localeSet = new Set<string>(savedMealLocales);
const persistenceFields = new Set(["saved_meal_id", "name", "locale", "items"]);
const archiveFields = new Set(["saved_meal_id", "is_archived"]);
const itemFields = new Set([
  "position",
  "food_id",
  "food_name",
  "brand_name",
  "serving_quantity",
  "serving_unit",
  "calories",
  "protein_g",
  "carbohydrates_g",
  "fat_g",
  "notes",
]);

function isObjectRecord(input: unknown): input is Record<string, unknown> {
  return typeof input === "object" && input !== null && !Array.isArray(input);
}

function rejectUnsupportedFields(
  input: Record<string, unknown>,
  allowed: Set<string>,
  fieldErrors: Record<string, string>,
  prefix = "",
) {
  for (const field of Object.keys(input)) {
    if (!allowed.has(field)) {
      fieldErrors[`${prefix}${field}`] = "unsupported_field";
    }
  }
}

function parseRequiredText(
  value: unknown,
  maximumLength: number,
  field: string,
  fieldErrors: Record<string, string>,
) {
  if (typeof value !== "string" || value.trim() === "") {
    fieldErrors[field] = "required";
    return "";
  }

  const normalized = value.trim();

  if (Array.from(normalized).length > maximumLength) {
    fieldErrors[field] = "too_long";
  }

  return normalized;
}

function parseOptionalText(
  value: unknown,
  maximumLength: number,
  field: string,
  fieldErrors: Record<string, string>,
) {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  if (typeof value !== "string") {
    fieldErrors[field] = "invalid_type";
    return null;
  }

  const normalized = value.trim();

  if (normalized === "") {
    return null;
  }

  if (Array.from(normalized).length > maximumLength) {
    fieldErrors[field] = "too_long";
  }

  return normalized;
}

function parseOptionalNumber(
  value: unknown,
  maximum: number,
  field: string,
  fieldErrors: Record<string, string>,
  integer = false,
) {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  if (typeof value !== "number" && typeof value !== "string") {
    fieldErrors[field] = "invalid_number";
    return null;
  }

  const parsed = typeof value === "number" ? value : Number(value);

  if (!Number.isFinite(parsed) || parsed < 0 || parsed > maximum) {
    fieldErrors[field] = "nonnegative_finite_required";
    return null;
  }

  if (integer && !Number.isInteger(parsed)) {
    fieldErrors[field] = "integer_required";
  }

  return parsed;
}

function validateItem(
  input: unknown,
  index: number,
  fieldErrors: Record<string, string>,
): ValidatedSavedMealItem | null {
  const prefix = `items.${index}.`;

  if (!isObjectRecord(input)) {
    fieldErrors[`items.${index}`] = "invalid_item";
    return null;
  }

  rejectUnsupportedFields(input, itemFields, fieldErrors, prefix);

  for (const field of itemFields) {
    if (!(field in input)) {
      fieldErrors[`${prefix}${field}`] = "required_field";
    }
  }

  const positionValue = input.position;
  const position =
    typeof positionValue === "number"
      ? positionValue
      : typeof positionValue === "string" && positionValue.trim() !== ""
        ? Number(positionValue)
        : Number.NaN;

  if (!Number.isInteger(position) || position < 1 || position > 50) {
    fieldErrors[`${prefix}position`] = "position_out_of_range";
  }

  let foodId: string | null = null;

  if (input.food_id !== undefined && input.food_id !== null && input.food_id !== "") {
    if (typeof input.food_id !== "string" || !isUuid(input.food_id)) {
      fieldErrors[`${prefix}food_id`] = "invalid_uuid";
    } else {
      foodId = input.food_id;
    }
  }

  return {
    position: Number.isFinite(position) ? position : 0,
    food_id: foodId,
    food_name: parseRequiredText(input.food_name, 200, `${prefix}food_name`, fieldErrors),
    brand_name: parseOptionalText(input.brand_name, 120, `${prefix}brand_name`, fieldErrors),
    serving_quantity: parseOptionalNumber(
      input.serving_quantity,
      9_999_999.999,
      `${prefix}serving_quantity`,
      fieldErrors,
    ),
    serving_unit: parseOptionalText(
      input.serving_unit,
      40,
      `${prefix}serving_unit`,
      fieldErrors,
    ),
    calories: parseOptionalNumber(
      input.calories,
      2_147_483_647,
      `${prefix}calories`,
      fieldErrors,
      true,
    ),
    protein_g: parseOptionalNumber(
      input.protein_g,
      999_999.99,
      `${prefix}protein_g`,
      fieldErrors,
    ),
    carbohydrates_g: parseOptionalNumber(
      input.carbohydrates_g,
      999_999.99,
      `${prefix}carbohydrates_g`,
      fieldErrors,
    ),
    fat_g: parseOptionalNumber(input.fat_g, 999_999.99, `${prefix}fat_g`, fieldErrors),
    notes: parseOptionalText(input.notes, 1000, `${prefix}notes`, fieldErrors),
  };
}

export function validateSavedMealInput(
  input: SavedMealInput,
): DataResult<ValidatedSavedMealInput> {
  const fieldErrors: Record<string, string> = {};

  if (!isObjectRecord(input)) {
    return validationError({ form: "invalid_input" });
  }

  rejectUnsupportedFields(input, persistenceFields, fieldErrors);

  let savedMealId: string | null = null;

  if (
    input.saved_meal_id !== undefined &&
    input.saved_meal_id !== null &&
    input.saved_meal_id !== ""
  ) {
    if (typeof input.saved_meal_id !== "string" || !isUuid(input.saved_meal_id)) {
      fieldErrors.saved_meal_id = "invalid_uuid";
    } else {
      savedMealId = input.saved_meal_id;
    }
  }

  const name = parseRequiredText(input.name, 200, "name", fieldErrors);
  const locale =
    typeof input.locale === "string" && localeSet.has(input.locale)
      ? (input.locale as SavedMealLocale)
      : "und";

  if (locale === "und" && input.locale !== "und") {
    fieldErrors.locale = "unsupported_locale";
  }

  const items: ValidatedSavedMealItem[] = [];

  const rawItems = input.items;

  if (!Array.isArray(rawItems)) {
    fieldErrors.items = "invalid_collection";
  } else if (rawItems.length < 1 || rawItems.length > 50) {
    fieldErrors.items = "item_count_out_of_range";
  } else {
    rawItems.forEach((item, index) => {
      const validated = validateItem(item, index, fieldErrors);
      if (validated) items.push(validated);
    });

    const positions = items.map((item) => item.position);
    const uniquePositions = new Set(positions);
    const contiguous =
      uniquePositions.size === rawItems.length &&
      positions.every((position) => position >= 1 && position <= rawItems.length) &&
      Array.from({ length: rawItems.length }, (_, index) => index + 1).every(
        (position) => uniquePositions.has(position),
      );

    if (!contiguous) {
      fieldErrors.items = "positions_must_be_contiguous";
    }
  }

  if (Object.keys(fieldErrors).length > 0) {
    return validationError(fieldErrors);
  }

  return {
    data: { saved_meal_id: savedMealId, name, locale, items },
    ok: true,
  };
}

export function validateSavedMealArchiveInput(
  input: SavedMealArchiveInput,
): DataResult<ValidatedSavedMealArchiveInput> {
  const fieldErrors: Record<string, string> = {};

  if (!isObjectRecord(input)) {
    return validationError({ form: "invalid_input" });
  }

  rejectUnsupportedFields(input, archiveFields, fieldErrors);

  if (typeof input.saved_meal_id !== "string" || !isUuid(input.saved_meal_id)) {
    fieldErrors.saved_meal_id = "invalid_uuid";
  }

  if (typeof input.is_archived !== "boolean") {
    fieldErrors.is_archived = "boolean_required";
  }

  if (Object.keys(fieldErrors).length > 0) {
    return validationError(fieldErrors);
  }

  return {
    data: {
      saved_meal_id: input.saved_meal_id as string,
      is_archived: input.is_archived as boolean,
    },
    ok: true,
  };
}
