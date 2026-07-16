import "server-only";

import { getAuthenticatedUserId } from "@/lib/data/auth";
import type { DataResult } from "@/lib/data/result";
import type { Database } from "@/lib/supabase/database.types";
import { createServerClient } from "@/lib/supabase";

export type ReusableFood =
  Database["public"]["Functions"]["get_reusable_foods"]["Returns"][number];

export type ReusableFoodCollections = {
  favorites: ReusableFood[];
  recent: ReusableFood[];
};

export async function getReusableFoodsForCurrentUser(): Promise<
  DataResult<ReusableFoodCollections>
> {
  const auth = await getAuthenticatedUserId();

  if (!auth.ok) {
    return auth;
  }

  const supabase = await createServerClient();
  const { data, error } = await supabase.rpc("get_reusable_foods");

  if (error) {
    return { code: "database_error", ok: false };
  }

  const favorites: ReusableFood[] = [];
  const recent: ReusableFood[] = [];

  for (const food of data) {
    if (food.collection_type === "favorite") {
      favorites.push(food);
    } else if (food.collection_type === "recent") {
      recent.push(food);
    } else {
      return { code: "database_error", ok: false };
    }
  }

  return { data: { favorites, recent }, ok: true };
}
