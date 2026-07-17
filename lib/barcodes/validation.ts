export const BARCODE_RAW_INPUT_MAX_LENGTH = 64;

export const gtinInputKinds = [
  "gtin_8",
  "gtin_12",
  "gtin_13",
  "gtin_14",
] as const;

export type GtinInputKind = (typeof gtinInputKinds)[number];

export type GtinValidationErrorCode =
  | "invalid_characters"
  | "invalid_check_digit"
  | "invalid_length"
  | "invalid_type"
  | "too_long"
  | "unsupported_format";

export type GtinValidationResult =
  | {
      data: {
        canonical_gtin: string;
        input_kind: GtinInputKind;
        normalized_input: string;
      };
      ok: true;
    }
  | { code: GtinValidationErrorCode; ok: false };

const inputKindByLength = new Map<number, GtinInputKind>([
  [8, "gtin_8"],
  [12, "gtin_12"],
  [13, "gtin_13"],
  [14, "gtin_14"],
]);

function hasValidCheckDigit(value: string) {
  let sum = 0;

  for (let index = value.length - 2, weight = 3; index >= 0; index -= 1) {
    sum += (value.charCodeAt(index) - 48) * weight;
    weight = weight === 3 ? 1 : 3;
  }

  const expectedCheckDigit = (10 - (sum % 10)) % 10;
  return expectedCheckDigit === value.charCodeAt(value.length - 1) - 48;
}

export function isValidCanonicalGtin(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^[0-9]{14}$/.test(value) &&
    hasValidCheckDigit(value)
  );
}

export function isSupportedFoodCanonicalGtin(
  value: unknown,
): value is string {
  return (
    isValidCanonicalGtin(value) &&
    !value.startsWith("0978") &&
    !value.startsWith("0979")
  );
}

export function validateGtinInput(value: unknown): GtinValidationResult {
  if (typeof value !== "string") {
    return { code: "invalid_type", ok: false };
  }

  if (value.length > BARCODE_RAW_INPUT_MAX_LENGTH) {
    return { code: "too_long", ok: false };
  }

  const normalizedInput = value.trim();

  if (!/^[0-9]*$/.test(normalizedInput)) {
    return { code: "invalid_characters", ok: false };
  }

  const inputKind = inputKindByLength.get(normalizedInput.length);

  if (!inputKind) {
    return { code: "invalid_length", ok: false };
  }

  if (!hasValidCheckDigit(normalizedInput)) {
    return { code: "invalid_check_digit", ok: false };
  }

  const canonicalGtin = normalizedInput.padStart(14, "0");

  if (!isSupportedFoodCanonicalGtin(canonicalGtin)) {
    return { code: "unsupported_format", ok: false };
  }

  return {
    data: {
      canonical_gtin: canonicalGtin,
      input_kind: inputKind,
      normalized_input: normalizedInput,
    },
    ok: true,
  };
}
