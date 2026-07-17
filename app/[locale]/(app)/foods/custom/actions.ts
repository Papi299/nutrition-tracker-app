"use server";

import { redirect } from "next/navigation";
import {
  parseBarcodeCustomHandoffQuery,
  type BarcodeCustomHandoffQuery,
} from "@/lib/barcodes";
import {
  customFoodLocales,
  customFoodNutrientCodes,
  parseCustomFoodNutrientFormValue,
  persistCustomFoodForCurrentUser,
  persistCustomFoodWithBarcodeForCurrentUser,
  validateCustomFoodInput,
  type CustomFoodEditorAlias,
  type CustomFoodNutrientCode,
} from "@/lib/custom-foods";
import { normalizeFoodSearchQuery } from "@/lib/food-search/query";
import {
  defaultLocale,
  locales,
  type Locale,
} from "@/lib/i18n/routing";
import type {
  CustomFoodActionState,
  CustomFoodFormValues,
} from "./action-state";

const maximumAliasCount = 20;
const maximumAliasLength = 200;
const localeSet = new Set<string>(customFoodLocales);

function resolveLocale(locale: string): Locale {
  return (locales as readonly string[]).includes(locale)
    ? (locale as Locale)
    : defaultLocale;
}

function readText(formData: FormData, name: string) {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

function readAliasValues(formData: FormData) {
  const countValue = Number(readText(formData, "alias_count"));
  const count = Number.isInteger(countValue)
    ? Math.max(0, Math.min(countValue, maximumAliasCount + 1))
    : 0;
  const aliases: CustomFoodEditorAlias[] = [];

  for (let index = 0; index < count; index += 1) {
    aliases.push({
      alias_text: readText(formData, `alias_text_${index}`),
      language_code: readText(
        formData,
        `alias_language_${index}`,
      ) as CustomFoodEditorAlias["language_code"],
    });
  }

  return { aliases, countIsValid: countValue === count && count <= 20 };
}

function readValues(formData: FormData): CustomFoodFormValues {
  const nutrients = {} as Record<CustomFoodNutrientCode, string>;

  for (const code of customFoodNutrientCodes) {
    nutrients[code] = readText(formData, `nutrient_${code}`);
  }

  return {
    aliases: readAliasValues(formData).aliases,
    brand_name: readText(formData, "brand_name"),
    food_id: readText(formData, "food_id"),
    food_locale: readText(formData, "food_locale"),
    name: readText(formData, "name"),
    nutrient_basis: readText(formData, "nutrient_basis"),
    nutrients,
    serving_quantity: readText(formData, "serving_quantity"),
    serving_unit: readText(formData, "serving_unit"),
  };
}

function validationFailure(
  values: CustomFoodFormValues,
  fieldErrors: Record<string, string>,
  barcodeOmitted?: boolean,
): CustomFoodActionState {
  return {
    barcode_omitted: barcodeOmitted,
    fieldErrors,
    status: "validation_error",
    values,
  };
}

function validateNutrientValues(
  values: CustomFoodFormValues,
  fieldErrors: Record<string, string>,
) {
  const nutrients: Array<{ amount: number; code: CustomFoodNutrientCode }> = [];

  for (const code of customFoodNutrientCodes) {
    const rawAmount = values.nutrients[code];

    const parsed = parseCustomFoodNutrientFormValue(rawAmount);

    if (parsed.status === "blank") {
      continue;
    }

    if (parsed.status === "invalid") {
      fieldErrors[`nutrient_${code}`] = parsed.code;
      continue;
    }

    nutrients.push({ amount: parsed.amount, code });
  }

  return nutrients;
}

function validateAliasValues(
  formData: FormData,
  values: CustomFoodFormValues,
  fieldErrors: Record<string, string>,
) {
  const aliasRead = readAliasValues(formData);
  const aliases: CustomFoodEditorAlias[] = [];
  const normalizedAliases = new Set<string>();

  if (!aliasRead.countIsValid) {
    fieldErrors.aliases = "too_many";
  }

  values.aliases.forEach((alias, index) => {
    if (alias.alias_text === "") {
      return;
    }

    if (!localeSet.has(alias.language_code)) {
      fieldErrors[`alias_language_${index}`] = "unsupported_language";
    }

    const normalized = normalizeFoodSearchQuery(alias.alias_text);

    if (normalized === "") {
      fieldErrors[`alias_text_${index}`] = "blank_alias";
    } else if (Array.from(alias.alias_text).length > maximumAliasLength) {
      fieldErrors[`alias_text_${index}`] = "too_long";
    }

    const key = `${alias.language_code}\u0000${normalized}`;

    if (normalizedAliases.has(key)) {
      fieldErrors[`alias_text_${index}`] = "duplicate_alias";
    }

    normalizedAliases.add(key);
    aliases.push(alias);
  });

  return aliases;
}

function mapPersistenceErrors(fieldErrors?: Record<string, string>) {
  const mapped: Record<string, string> = {};

  for (const [field, code] of Object.entries(fieldErrors ?? {})) {
    if (field === "locale") {
      mapped.food_locale = code;
    } else if (field === "nutrients" || field === "aliases") {
      mapped[field] = code;
    } else {
      mapped[field] = code;
    }
  }

  return mapped;
}

function prepareCustomFoodSubmission(
  formData: FormData,
  expectedFoodId: string | null,
) {
  const values = readValues(formData);
  const fieldErrors: Record<string, string> = {};

  if (values.food_id !== (expectedFoodId ?? "")) {
    fieldErrors.food_id = "invalid_link";
  }

  const nutrients = validateNutrientValues(values, fieldErrors);
  const aliases = validateAliasValues(formData, values, fieldErrors);
  const persistenceInput = {
    aliases,
    brand_name: values.brand_name,
    food_id: expectedFoodId,
    locale: values.food_locale,
    name: values.name,
    nutrient_basis: values.nutrient_basis,
    nutrients,
    serving_quantity: values.serving_quantity,
    serving_unit: values.serving_unit,
  };
  const validation = validateCustomFoodInput(persistenceInput);

  if (!validation.ok) {
    Object.assign(fieldErrors, mapPersistenceErrors(validation.fieldErrors));
  }

  if (
    customFoodNutrientCodes.some(
      (code) => fieldErrors[`nutrient_${code}`] !== undefined,
    )
  ) {
    delete fieldErrors.nutrients;
  }

  if (
    Object.keys(fieldErrors).some(
      (field) =>
        field.startsWith("alias_text_") ||
        field.startsWith("alias_language_"),
    )
  ) {
    delete fieldErrors.aliases;
  }

  return { fieldErrors, persistenceInput, values };
}

function customFoodTodayRedirect({
  date,
  foodId,
  locale,
  mealType,
}: {
  date: string;
  foodId: string;
  locale: Locale;
  mealType: string | null;
}) {
  const query = new URLSearchParams({ date, foodId });
  if (mealType !== null) query.set("mealType", mealType);
  query.set("customFood", "created");
  return `/${locale}/today?${query.toString()}`;
}

export async function saveCustomFoodAction(
  localeInput: string,
  expectedFoodId: string | null,
  _previousState: CustomFoodActionState,
  formData: FormData,
): Promise<CustomFoodActionState> {
  const locale = resolveLocale(localeInput);
  const { fieldErrors, persistenceInput, values } =
    prepareCustomFoodSubmission(formData, expectedFoodId);

  if (Object.keys(fieldErrors).length > 0) {
    return validationFailure(values, fieldErrors);
  }

  const result = await persistCustomFoodForCurrentUser(persistenceInput);

  if (!result.ok) {
    if (result.code === "validation_error") {
      return validationFailure(
        values,
        mapPersistenceErrors(result.fieldErrors),
      );
    }

    return {
      status:
        result.code === "already_exists" ? "database_error" : result.code,
      values,
    };
  }

  const savedState = expectedFoodId ? "updated" : "created";
  redirect(
    `/${locale}/foods/custom/${result.data.food_id}/edit?saved=${savedState}`,
  );
}

export async function saveBarcodeCustomFoodAction(
  localeInput: string,
  context: Extract<BarcodeCustomHandoffQuery, { status: "valid" }>,
  _previousState: CustomFoodActionState,
  formData: FormData,
): Promise<CustomFoodActionState> {
  const locale = resolveLocale(localeInput);
  const handoff = parseBarcodeCustomHandoffQuery({
    barcode: context.barcode,
    date: context.date,
    mealType: context.meal_type ?? undefined,
  });
  const omissionValues = formData.getAll("omit_barcode");
  const barcodeOmitted =
    omissionValues.length === 1 && omissionValues[0] === "omit";
  const { fieldErrors, persistenceInput, values } =
    prepareCustomFoodSubmission(formData, null);

  if (handoff.status !== "valid") {
    fieldErrors.form = "invalid_link";
  }

  if (
    omissionValues.length > 1 ||
    (omissionValues.length === 1 && omissionValues[0] !== "omit")
  ) {
    fieldErrors.barcode_omission = "invalid_input";
  }

  if (Object.keys(fieldErrors).length > 0) {
    return validationFailure(values, fieldErrors, barcodeOmitted);
  }

  if (barcodeOmitted) {
    const result = await persistCustomFoodForCurrentUser(persistenceInput);

    if (!result.ok) {
      if (result.code === "validation_error") {
        return validationFailure(
          values,
          mapPersistenceErrors(result.fieldErrors),
          true,
        );
      }

      return {
        barcode_omitted: true,
        status:
          result.code === "already_exists" ? "database_error" : result.code,
        values,
      };
    }

    redirect(
      customFoodTodayRedirect({
        date: context.date,
        foodId: result.data.food_id,
        locale,
        mealType: context.meal_type,
      }),
    );
  }

  const result = await persistCustomFoodWithBarcodeForCurrentUser({
    canonical_gtin: context.barcode,
    custom_food: persistenceInput,
  });

  if (!result.ok) {
    if ("code" in result && result.code === "validation_error") {
      return validationFailure(
        values,
        mapPersistenceErrors(result.fieldErrors),
        false,
      );
    }

    if ("status" in result) {
      return {
        barcode_omitted: false,
        conflict_food_id: "food_id" in result ? result.food_id : undefined,
        status: result.status,
        values,
      };
    }

    return {
      barcode_omitted: false,
      status: "code" in result ? result.code : "database_error",
      values,
    };
  }

  redirect(
    customFoodTodayRedirect({
      date: context.date,
      foodId: result.data.food_id,
      locale,
      mealType: context.meal_type,
    }),
  );
}
