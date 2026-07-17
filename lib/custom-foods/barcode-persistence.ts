import "server-only";

import { isSupportedFoodCanonicalGtin } from "@/lib/barcodes";
import { getAuthenticatedUserId } from "@/lib/data/auth";
import { createServerClient } from "@/lib/supabase";
import type { Database, Json } from "@/lib/supabase/database.types";
import {
  parseCustomFoodBarcodePersistenceRows,
  type CustomFoodBarcodePersistenceState,
} from "./barcode-persistence-parser";
import {
  validateCustomFoodInput,
  type CustomFoodInput,
  type ValidatedCustomFoodInput,
} from "./validation";

type GeneratedArgs =
  Database["public"]["Functions"]["persist_custom_food_with_barcode"]["Args"];

function rpcArgs(
  canonicalGtin: string,
  input: ValidatedCustomFoodInput,
): GeneratedArgs {
  return {
    p_aliases: input.aliases as Json,
    p_brand_name: input.brand_name as string,
    p_gtin: canonicalGtin,
    p_locale: input.locale,
    p_name: input.name,
    p_nutrient_basis: input.nutrient_basis,
    p_nutrients: input.nutrients as Json,
    p_serving_quantity: input.serving_quantity,
    p_serving_unit: input.serving_unit,
  };
}

export async function persistCustomFoodWithBarcodeForCurrentUser({
  canonical_gtin,
  custom_food,
}: {
  canonical_gtin: unknown;
  custom_food: CustomFoodInput;
}): Promise<CustomFoodBarcodePersistenceState> {
  if (!isSupportedFoodCanonicalGtin(canonical_gtin)) {
    return {
      code: "validation_error",
      fieldErrors: { barcode: "invalid_input" },
      ok: false,
    };
  }

  const validation = validateCustomFoodInput(custom_food);
  if (!validation.ok) {
    return validation.code === "validation_error"
      ? {
          code: "validation_error",
          fieldErrors: validation.fieldErrors ?? {},
          ok: false,
        }
      : { code: "database_error", ok: false };
  }

  if (validation.data.food_id !== null) {
    return {
      code: "validation_error",
      fieldErrors: { food_id: "invalid_link" },
      ok: false,
    };
  }

  const auth = await getAuthenticatedUserId();
  if (!auth.ok) {
    return {
      code: auth.code === "unauthenticated" ? "unauthenticated" : "database_error",
      ok: false,
    };
  }

  const supabase = await createServerClient();
  const { data, error } = await supabase.rpc(
    "persist_custom_food_with_barcode",
    rpcArgs(canonical_gtin, validation.data),
  );

  if (error) {
    if (error.code === "42501") return { code: "unauthenticated", ok: false };
    if (error.code === "22023") {
      return {
        code: "validation_error",
        fieldErrors: { form: "invalid_input" },
        ok: false,
      };
    }
    return { code: "database_error", ok: false };
  }

  return (
    parseCustomFoodBarcodePersistenceRows(data, canonical_gtin) ?? {
      code: "database_error",
      ok: false,
    }
  );
}
