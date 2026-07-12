import "server-only";

import { validationError, type DataResult } from "@/lib/data/result";
import {
  validateNutritionTargetInput,
  type NutritionTargetInput,
} from "@/lib/nutrition-targets";
import {
  validateProfileInput,
  type ProfileInput,
  type ProfileLanguage,
} from "@/lib/profile";
import { createServerClient } from "@/lib/supabase";
import type { Database } from "@/lib/supabase/database.types";

export type PersistedSetup = {
  preferred_language: ProfileLanguage;
};

type PersistSetupRpcArgs = {
  p_calories: null | number;
  p_carbohydrates_g: null | number;
  p_display_name: null | string;
  p_effective_from: string;
  p_fat_g: null | number;
  p_preferred_language: ProfileLanguage;
  p_protein_g: null | number;
};

export async function persistSetupForCurrentUser(
  profileInput: ProfileInput,
  targetInput: NutritionTargetInput,
): Promise<DataResult<PersistedSetup>> {
  const profileValidation = validateProfileInput(profileInput);
  const targetValidation = validateNutritionTargetInput(targetInput);
  const fieldErrors = {
    ...(!profileValidation.ok ? profileValidation.fieldErrors : {}),
    ...(!targetValidation.ok ? targetValidation.fieldErrors : {}),
  };

  if (!profileValidation.ok || !targetValidation.ok) {
    return validationError(fieldErrors);
  }

  const preferredLanguage = profileValidation.data.preferred_language;

  if (!preferredLanguage) {
    return validationError({ preferred_language: "unsupported_language" });
  }

  const supabase = await createServerClient();
  const rpcArgs: PersistSetupRpcArgs = {
    p_calories: targetValidation.data.calories,
    p_carbohydrates_g: targetValidation.data.carbohydrates_g,
    p_display_name: profileValidation.data.display_name,
    p_effective_from: targetValidation.data.effective_from,
    p_fat_g: targetValidation.data.fat_g,
    p_preferred_language: preferredLanguage,
    p_protein_g: targetValidation.data.protein_g,
  };
  const { data, error } = await supabase
    // Generated function arguments omit PostgreSQL's runtime null acceptance.
    .rpc(
      "persist_setup",
      rpcArgs as Database["public"]["Functions"]["persist_setup"]["Args"],
    )
    .single();

  if (error || !data) {
    return {
      code: error?.code === "42501" ? "unauthenticated" : "database_error",
      ok: false,
    };
  }

  return {
    data: { preferred_language: preferredLanguage },
    ok: true,
  };
}
