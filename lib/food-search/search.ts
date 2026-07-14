import "server-only";

import { getAuthenticatedUserId } from "@/lib/data/auth";
import type { Database } from "@/lib/supabase/database.types";
import { createServerClient } from "@/lib/supabase";
import { parseFoodSearchQuery, type FoodSearchQuery } from "./query";

export type FoodSearchResult =
  Database["public"]["Functions"]["search_readable_foods"]["Returns"][number];

export type FoodSearchState =
  | { status: "initial"; value: string }
  | { status: "too_short"; value: string }
  | {
      reason: "repeated" | "too_long";
      status: "validation_error";
      value: string;
    }
  | { status: "unauthenticated"; value: string }
  | { status: "database_error"; value: string }
  | { data: FoodSearchResult[]; status: "ready"; value: string };

function validationState(query: FoodSearchQuery): FoodSearchState | null {
  if (query.status === "invalid") {
    return {
      reason: query.reason,
      status: "validation_error",
      value: query.value,
    };
  }

  if (query.status === "initial" || query.status === "too_short") {
    return query;
  }

  return null;
}

export async function searchReadableFoods(
  value: string | string[] | undefined,
): Promise<FoodSearchState> {
  const query = parseFoodSearchQuery(value);
  const validation = validationState(query);

  if (validation) {
    return validation;
  }

  const authResult = await getAuthenticatedUserId();

  if (!authResult.ok) {
    return { status: "unauthenticated", value: query.value };
  }

  const supabase = await createServerClient();
  const { data, error } = await supabase.rpc("search_readable_foods", {
    p_query: query.value,
  });

  if (error) {
    return { status: "database_error", value: query.value };
  }

  return { data, status: "ready", value: query.value };
}
