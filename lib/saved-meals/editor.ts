import "server-only";

import { getAuthenticatedUserId } from "@/lib/data/auth";
import type { DataResult } from "@/lib/data/result";
import { isUuid } from "@/lib/food-selection/query";
import { createServerClient } from "@/lib/supabase";
import {
  parseSavedMealEditorItems,
  type SavedMealEditorItem,
} from "./editor-parser";
import { savedMealLocales, type SavedMealLocale } from "./validation";

export { parseSavedMealEditorItems, type SavedMealEditorItem } from "./editor-parser";

export type OwnedSavedMealEditor = {
  created_at: string;
  is_archived: boolean;
  items: SavedMealEditorItem[];
  locale: SavedMealLocale;
  name: string;
  saved_meal_id: string;
  updated_at: string;
};

const localeSet = new Set<string>(savedMealLocales);

export async function getOwnedSavedMealEditor(
  savedMealId: string,
): Promise<DataResult<OwnedSavedMealEditor>> {
  if (!isUuid(savedMealId)) {
    return {
      code: "validation_error",
      fieldErrors: { saved_meal_id: "invalid_uuid" },
      ok: false,
    };
  }

  const auth = await getAuthenticatedUserId();

  if (!auth.ok) return auth;

  const supabase = await createServerClient();
  const { data, error } = await supabase
    .rpc("get_owned_saved_meal_editor", { p_saved_meal_id: savedMealId })
    .maybeSingle();

  if (error) return { code: "database_error", ok: false };
  if (!data) return { code: "not_found", ok: false };

  const items = parseSavedMealEditorItems(data.items);

  if (!items || !localeSet.has(data.locale)) {
    return { code: "database_error", ok: false };
  }

  return {
    data: {
      created_at: data.created_at,
      is_archived: data.is_archived,
      items,
      locale: data.locale as SavedMealLocale,
      name: data.name,
      saved_meal_id: data.saved_meal_id,
      updated_at: data.updated_at,
    },
    ok: true,
  };
}
