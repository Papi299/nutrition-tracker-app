import "server-only";

import { getAuthenticatedUserId } from "@/lib/data/auth";
import { createServerClient } from "@/lib/supabase";
import { lookupReadableFoodByGtinWithDependencies } from "./lookup-core";

export async function lookupReadableFoodByGtinForCurrentUser(rawInput: unknown) {
  return lookupReadableFoodByGtinWithDependencies(rawInput, {
    getAuthenticatedUserId,
    lookupCanonicalGtin: async (canonicalGtin) => {
      const supabase = await createServerClient();
      return supabase.rpc("lookup_readable_food_by_gtin", {
        p_gtin: canonicalGtin,
      });
    },
  });
}
