import {
  parseBarcodeLookupRows,
  type ParsedBarcodeLookupState,
} from "./parser";
import {
  validateGtinInput,
  type GtinValidationErrorCode,
} from "./validation";

export type BarcodeLookupState =
  | ParsedBarcodeLookupState
  | {
      code: GtinValidationErrorCode | "invalid_canonical_gtin";
      status: "validation_error";
    }
  | { status: "unauthenticated" }
  | { status: "database_error" };

export type BarcodeLookupDependencies = {
  getAuthenticatedUserId: () => Promise<{ ok: boolean }>;
  lookupCanonicalGtin: (canonicalGtin: string) => Promise<{
    data: unknown;
    error: { code?: string } | null;
  }>;
};

export async function lookupReadableFoodByGtinWithDependencies(
  rawInput: unknown,
  dependencies: BarcodeLookupDependencies,
): Promise<BarcodeLookupState> {
  const validation = validateGtinInput(rawInput);

  if (!validation.ok) {
    return { code: validation.code, status: "validation_error" };
  }

  const auth = await dependencies.getAuthenticatedUserId();

  if (!auth.ok) {
    return { status: "unauthenticated" };
  }

  const result = await dependencies.lookupCanonicalGtin(
    validation.data.canonical_gtin,
  );

  if (result.error) {
    return result.error.code === "22023"
      ? { code: "invalid_canonical_gtin", status: "validation_error" }
      : { status: "database_error" };
  }

  return parseBarcodeLookupRows(result.data) ?? { status: "database_error" };
}
