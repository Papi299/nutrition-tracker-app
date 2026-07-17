import { expect, test } from "@playwright/test";
import {
  BARCODE_RAW_INPUT_MAX_LENGTH,
  isValidCanonicalGtin,
  validateGtinInput,
} from "@/lib/barcodes/validation";
import { parseBarcodeLookupRows } from "@/lib/barcodes/parser";
import { lookupReadableFoodByGtinWithDependencies } from "@/lib/barcodes/lookup-core";

const validInputs = [
  ["96385074", "00000096385074", "gtin_8"],
  ["036000291452", "00036000291452", "gtin_12"],
  ["4006381333931", "04006381333931", "gtin_13"],
  ["10012345000017", "10012345000017", "gtin_14"],
] as const;

function lookupRow(overrides: Record<string, unknown> = {}) {
  return {
    brand_name: "Example Brand",
    canonical_gtin: "00036000291452",
    food_data_quality: "curated",
    food_id: "11111111-1111-4111-8111-111111111111",
    food_locale: "en",
    food_name: "Example food",
    food_source_code: "manual",
    food_source_name: "Manual entry",
    food_source_trust_level: "user_provided",
    food_source_type: "manual",
    food_type: "branded",
    mapping_provenance_source_code: "usda",
    mapping_provenance_source_food_id: "provider-123",
    mapping_provenance_source_name: "USDA FoodData Central",
    mapping_provenance_source_trust_level: "verified",
    mapping_provenance_source_type: "external_api",
    mapping_verification_status: "curated_verified",
    ownership_kind: "public",
    result_status: "found_public",
    serving_size: 100,
    serving_unit: "g",
    ...overrides,
  };
}

function nonFoundRow(status = "not_found_local") {
  return lookupRow({
    brand_name: null,
    food_data_quality: null,
    food_id: null,
    food_locale: null,
    food_name: null,
    food_source_code: null,
    food_source_name: null,
    food_source_trust_level: null,
    food_source_type: null,
    food_type: null,
    mapping_provenance_source_code: null,
    mapping_provenance_source_food_id: null,
    mapping_provenance_source_name: null,
    mapping_provenance_source_trust_level: null,
    mapping_provenance_source_type: null,
    mapping_verification_status: null,
    ownership_kind: null,
    result_status: status,
    serving_size: null,
    serving_unit: null,
  });
}

test.describe("GTIN validation", () => {
  for (const [input, canonicalGtin, inputKind] of validInputs) {
    test(`validates and identifies ${inputKind}`, () => {
      expect(validateGtinInput(input)).toEqual({
        data: {
          canonical_gtin: canonicalGtin,
          input_kind: inputKind,
          normalized_input: input,
        },
        ok: true,
      });
      expect(isValidCanonicalGtin(canonicalGtin)).toBe(true);
    });
  }

  test("preserves leading zeroes and canonicalization is idempotent", () => {
    const first = validateGtinInput("036000291452");
    expect(first.ok).toBe(true);
    if (!first.ok) return;

    expect(first.data.normalized_input.startsWith("0")).toBe(true);
    expect(first.data.canonical_gtin).toBe("00036000291452");
    expect(String(Number(first.data.canonical_gtin))).not.toBe(
      first.data.canonical_gtin,
    );
    expect(validateGtinInput(first.data.canonical_gtin)).toEqual({
      data: {
        canonical_gtin: first.data.canonical_gtin,
        input_kind: "gtin_14",
        normalized_input: first.data.canonical_gtin,
      },
      ok: true,
    });
  });

  test("accepts check digit zero and rejects an invalid check digit", () => {
    expect(validateGtinInput("12345670")).toMatchObject({ ok: true });
    expect(validateGtinInput("12345671")).toEqual({
      code: "invalid_check_digit",
      ok: false,
    });
  });

  test("accepts outer Unicode whitespace but rejects internal formatting", () => {
    expect(validateGtinInput("\u2003 036000291452 \u00a0")).toMatchObject({
      data: { normalized_input: "036000291452" },
      ok: true,
    });

    for (const input of [
      "036 000291452",
      "036000-291452",
      "036000.291452",
      "+036000291452",
      "-036000291452",
      "3.6000291452e10",
      "٠٣٦٠٠٠٢٩١٤٥٢",
      "036000\u0000291452",
    ]) {
      expect(validateGtinInput(input)).toEqual({
        code: "invalid_characters",
        ok: false,
      });
    }
  });

  test("rejects every unsupported bounded raw length including UPC-E shorthand", () => {
    for (let length = 0; length <= 15; length += 1) {
      if ([8, 12, 13, 14].includes(length)) continue;
      expect(validateGtinInput("0".repeat(length))).toEqual({
        code: "invalid_length",
        ok: false,
      });
    }

    expect(validateGtinInput("      ")).toEqual({
      code: "invalid_length",
      ok: false,
    });
    expect(validateGtinInput("123456")).toMatchObject({
      code: "invalid_length",
    });
    expect(validateGtinInput("1234567")).toMatchObject({
      code: "invalid_length",
    });
  });

  test("bounds input before trimming and rejects non-string values", () => {
    expect(
      validateGtinInput(`036000291452${" ".repeat(BARCODE_RAW_INPUT_MAX_LENGTH)}`),
    ).toEqual({ code: "too_long", ok: false });

    for (const input of [null, undefined, 36000291452, false, {}, []]) {
      expect(validateGtinInput(input)).toEqual({
        code: "invalid_type",
        ok: false,
      });
    }
  });

  test("rejects ISBN-prefix GTIN-13 without adding UPC-E or 2D behavior", () => {
    expect(validateGtinInput("9780306406157")).toEqual({
      code: "unsupported_format",
      ok: false,
    });
    expect(validateGtinInput("9791090636071")).toEqual({
      code: "unsupported_format",
      ok: false,
    });
    expect(validateGtinInput("https://id.gs1.org/01/09506000134352")).toEqual({
      code: "invalid_characters",
      ok: false,
    });
  });
});

test.describe("barcode lookup defensive parsing", () => {
  test("parses exact public and owned found metadata", () => {
    expect(parseBarcodeLookupRows([lookupRow()])).toEqual({
      canonical_gtin: "00036000291452",
      data: expect.objectContaining({
        food_id: "11111111-1111-4111-8111-111111111111",
        mapping_provenance_source_code: "usda",
        ownership_kind: "public",
      }),
      status: "found_public",
    });

    expect(
      parseBarcodeLookupRows([
        lookupRow({
          food_type: "user_custom",
          mapping_verification_status: "user_asserted",
          ownership_kind: "owned_custom",
          result_status: "found_owned",
        }),
      ]),
    ).toMatchObject({ status: "found_owned" });
  });

  test("parses defensive ambiguity, archive, and local-miss states", () => {
    for (const status of [
      "ambiguous",
      "archived_or_unavailable",
      "not_found_local",
    ]) {
      expect(parseBarcodeLookupRows([nonFoundRow(status)])).toEqual({
        canonical_gtin: "00036000291452",
        status,
      });
    }
  });

  test("fails closed on malformed shape, state, identity, and metadata", () => {
    const malformed = [
      [],
      [lookupRow(), lookupRow()],
      [{ ...lookupRow(), extra: true }],
      [{ ...lookupRow(), food_id: "not-a-uuid" }],
      [{ ...lookupRow(), canonical_gtin: "00036000291453" }],
      [{ ...lookupRow(), result_status: "provider_found" }],
      [{ ...lookupRow(), ownership_kind: "owned_custom" }],
      [{ ...lookupRow(), serving_size: -1 }],
      [{ ...lookupRow(), mapping_verification_status: "trusted" }],
      [{ ...lookupRow(), mapping_provenance_source_type: "partner" }],
      [{ ...lookupRow(), food_name: "x".repeat(201) }],
      [{ ...lookupRow(), mapping_provenance_source_food_id: " value " }],
      [{ ...nonFoundRow(), food_name: "leaked" }],
    ];

    for (const value of malformed) {
      expect(parseBarcodeLookupRows(value)).toBeNull();
    }
  });
});

test.describe("barcode lookup orchestration", () => {
  test("does not authenticate or query when pure validation fails", async () => {
    let authCalls = 0;
    let lookupCalls = 0;
    const result = await lookupReadableFoodByGtinWithDependencies("invalid", {
      getAuthenticatedUserId: async () => {
        authCalls += 1;
        return { ok: true };
      },
      lookupCanonicalGtin: async () => {
        lookupCalls += 1;
        return { data: [], error: null };
      },
    });

    expect(result).toEqual({
      code: "invalid_characters",
      status: "validation_error",
    });
    expect(authCalls).toBe(0);
    expect(lookupCalls).toBe(0);
  });

  test("maps session expiry, RPC validation, database failure, and malformed data", async () => {
    const base = {
      getAuthenticatedUserId: async () => ({ ok: true }),
      lookupCanonicalGtin: async () => ({ data: [nonFoundRow()], error: null }),
    };

    await expect(
      lookupReadableFoodByGtinWithDependencies("036000291452", {
        ...base,
        getAuthenticatedUserId: async () => ({ ok: false }),
      }),
    ).resolves.toEqual({ status: "unauthenticated" });

    await expect(
      lookupReadableFoodByGtinWithDependencies("036000291452", {
        ...base,
        lookupCanonicalGtin: async () => ({
          data: null,
          error: { code: "22023" },
        }),
      }),
    ).resolves.toEqual({
      code: "invalid_canonical_gtin",
      status: "validation_error",
    });

    await expect(
      lookupReadableFoodByGtinWithDependencies("036000291452", {
        ...base,
        lookupCanonicalGtin: async () => ({
          data: null,
          error: { code: "XX000" },
        }),
      }),
    ).resolves.toEqual({ status: "database_error" });

    await expect(
      lookupReadableFoodByGtinWithDependencies("036000291452", {
        ...base,
        lookupCanonicalGtin: async () => ({ data: [{ bad: true }], error: null }),
      }),
    ).resolves.toEqual({ status: "database_error" });
  });

  test("passes only the canonical string and returns a parsed state", async () => {
    let received = "";
    const result = await lookupReadableFoodByGtinWithDependencies(
      " 036000291452 ",
      {
        getAuthenticatedUserId: async () => ({ ok: true }),
        lookupCanonicalGtin: async (canonicalGtin) => {
          received = canonicalGtin;
          return { data: [nonFoundRow()], error: null };
        },
      },
    );

    expect(received).toBe("00036000291452");
    expect(typeof received).toBe("string");
    expect(result).toEqual({
      canonical_gtin: "00036000291452",
      status: "not_found_local",
    });
  });
});
