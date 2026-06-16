import type { DataResult } from "@/lib/data/result";
import { validationError } from "@/lib/data/result";

export const maxDisplayNameLength = 80;
export const supportedProfileLanguages = ["en", "he"] as const;
export const supportedUnitSystem = "metric";

export type ProfileLanguage = (typeof supportedProfileLanguages)[number];

export type ProfileInput = {
  display_name?: null | string;
  preferred_language?: null | string;
};

export type ValidatedProfileInput = {
  display_name: null | string;
  preferred_language?: ProfileLanguage;
};

const allowedProfileFields = new Set(["display_name", "preferred_language"]);

function isObjectRecord(input: unknown): input is Record<string, unknown> {
  return typeof input === "object" && input !== null && !Array.isArray(input);
}

function isProfileLanguage(value: unknown): value is ProfileLanguage {
  return (
    typeof value === "string" &&
    supportedProfileLanguages.includes(value as ProfileLanguage)
  );
}

export function validateProfileInput(
  input: unknown,
): DataResult<ValidatedProfileInput> {
  const fieldErrors: Record<string, string> = {};

  if (!isObjectRecord(input)) {
    return validationError({ form: "invalid_input" });
  }

  for (const key of Object.keys(input)) {
    if (!allowedProfileFields.has(key)) {
      fieldErrors[key] = "unsupported_field";
    }
  }

  const displayNameValue = input.display_name;
  let displayName: null | string = null;

  if (displayNameValue !== undefined && displayNameValue !== null) {
    if (typeof displayNameValue !== "string") {
      fieldErrors.display_name = "invalid_type";
    } else {
      const trimmed = displayNameValue.trim();
      displayName = trimmed.length > 0 ? trimmed : null;

      if (trimmed.length > maxDisplayNameLength) {
        fieldErrors.display_name = "too_long";
      }
    }
  }

  const preferredLanguageValue = input.preferred_language;
  let preferredLanguage: ProfileLanguage | undefined;

  if (preferredLanguageValue !== undefined && preferredLanguageValue !== null) {
    if (!isProfileLanguage(preferredLanguageValue)) {
      fieldErrors.preferred_language = "unsupported_language";
    } else {
      preferredLanguage = preferredLanguageValue;
    }
  }

  if (Object.keys(fieldErrors).length > 0) {
    return validationError(fieldErrors);
  }

  return {
    data: {
      display_name: displayName,
      preferred_language: preferredLanguage,
    },
    ok: true,
  };
}
