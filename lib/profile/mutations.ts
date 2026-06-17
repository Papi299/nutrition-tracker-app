import "server-only";

import { getAuthenticatedUserId } from "@/lib/data/auth";
import type { DataResult } from "@/lib/data/result";
import { createServerClient } from "@/lib/supabase";
import type { Tables } from "@/lib/supabase/database.types";
import {
  supportedUnitSystem,
  validateProfileInput,
  type ProfileInput,
} from "./validation";

export type Profile = Tables<"profiles">;

export async function createProfileForCurrentUser(
  input: ProfileInput,
): Promise<DataResult<Profile>> {
  const userIdResult = await getAuthenticatedUserId();

  if (!userIdResult.ok) {
    return userIdResult;
  }

  const validationResult = validateProfileInput(input);

  if (!validationResult.ok) {
    return validationResult;
  }

  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("profiles")
    .insert({
      display_name: validationResult.data.display_name,
      id: userIdResult.data,
      preferred_language: validationResult.data.preferred_language,
      unit_system: supportedUnitSystem,
    })
    .select("*")
    .single();

  if (error) {
    if (error.code === "23505") {
      return { code: "already_exists", ok: false };
    }

    return { code: "database_error", ok: false };
  }

  return { data, ok: true };
}

export async function updateCurrentProfile(
  input: ProfileInput,
): Promise<DataResult<Profile>> {
  const userIdResult = await getAuthenticatedUserId();

  if (!userIdResult.ok) {
    return userIdResult;
  }

  const validationResult = validateProfileInput(input);

  if (!validationResult.ok) {
    return validationResult;
  }

  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("profiles")
    .update({
      display_name: validationResult.data.display_name,
      preferred_language: validationResult.data.preferred_language,
    })
    .eq("id", userIdResult.data)
    .select("*")
    .maybeSingle();

  if (error) {
    return { code: "database_error", ok: false };
  }

  if (!data) {
    return { code: "not_found", ok: false };
  }

  return { data, ok: true };
}
