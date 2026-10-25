import { formatExactFraction, normalizeNutrientAmount, parseExactNonnegativeDecimal } from "./decimal";
import { additionalNutrientCodesV1, nutrientCodesV1, type AdditionalNutrientCode, type NutrientCode } from "./manifest";

export const maxAdditionalSnapshotBytes = 16_384;

export type AdditionalNutrientSnapshotV1 = {
  version: 1;
  values: Record<AdditionalNutrientCode, number | null>;
};
export type AdditionalNutrientRequestV1 = {
  version: 1;
  values: Array<{ code: AdditionalNutrientCode; amount: number | null }>;
};
export type NutrientReferenceValuesV1 = Record<NutrientCode, string | null>;
export type SnapshotContractError =
  | "invalid_snapshot" | "unsupported_version" | "invalid_code_count"
  | "unsupported_code" | "duplicate_code" | "invalid_amount"
  | "amount_precision" | "amount_out_of_range" | "snapshot_too_large";
export type SnapshotContractResult<T> =
  | { ok: true; data: T }
  | { ok: false; code: SnapshotContractError; field?: string };

const codeSet = new Set<string>(additionalNutrientCodesV1);

function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function exactKeys(value: Record<string, unknown>, expected: readonly string[]) {
  const keys = Object.keys(value);
  return keys.length === expected.length && expected.every((key) => Object.hasOwn(value, key));
}

function validateEnvelope(value: unknown): SnapshotContractResult<Record<string, unknown>> {
  if (!record(value) || !exactKeys(value, ["version", "values"])) {
    return { ok: false, code: "invalid_snapshot" };
  }
  if (value.version !== 1) return { ok: false, code: "unsupported_version" };
  try {
    if (new TextEncoder().encode(JSON.stringify(value)).byteLength > maxAdditionalSnapshotBytes) {
      return { ok: false, code: "snapshot_too_large" };
    }
  } catch {
    return { ok: false, code: "invalid_snapshot" };
  }
  return { ok: true, data: value };
}

export function parseAdditionalNutrientSnapshot(
  value: unknown,
): SnapshotContractResult<AdditionalNutrientSnapshotV1 | null> {
  if (value === null) return { ok: true, data: null };
  const envelope = validateEnvelope(value);
  if (!envelope.ok) return envelope;
  const rawValues = envelope.data.values;
  if (!record(rawValues) || !exactKeys(rawValues, additionalNutrientCodesV1)) {
    return { ok: false, code: "invalid_code_count" };
  }
  const values = {} as AdditionalNutrientSnapshotV1["values"];
  for (const code of additionalNutrientCodesV1) {
    const raw = rawValues[code];
    if (raw !== null && typeof raw !== "number") return { ok: false, code: "invalid_amount", field: code };
    const amount = normalizeNutrientAmount(code, raw, true);
    if (!amount.ok) return { ...amount, field: code };
    values[code] = amount.data;
  }
  return { ok: true, data: { version: 1, values } };
}

export function normalizeAdditionalNutrientRequest(
  value: unknown,
): SnapshotContractResult<AdditionalNutrientSnapshotV1 | null> {
  if (value === null) return { ok: true, data: null };
  const envelope = validateEnvelope(value);
  if (!envelope.ok) return envelope;
  const items = envelope.data.values;
  if (!Array.isArray(items) || items.length !== additionalNutrientCodesV1.length) {
    return { ok: false, code: "invalid_code_count" };
  }
  const seen = new Set<string>();
  const byCode = new Map<AdditionalNutrientCode, number | null>();
  for (const item of items) {
    if (!record(item) || !exactKeys(item, ["code", "amount"])) {
      return { ok: false, code: "invalid_snapshot" };
    }
    if (typeof item.code !== "string" || !codeSet.has(item.code)) {
      return { ok: false, code: "unsupported_code" };
    }
    if (seen.has(item.code)) return { ok: false, code: "duplicate_code", field: item.code };
    seen.add(item.code);
    if (item.amount !== null && typeof item.amount !== "number") {
      return { ok: false, code: "invalid_amount", field: item.code };
    }
    const code = item.code as AdditionalNutrientCode;
    const amount = normalizeNutrientAmount(code, item.amount);
    if (!amount.ok) return { ...amount, field: code };
    byCode.set(code, amount.data);
  }
  const values = Object.fromEntries(additionalNutrientCodesV1.map((code) => [code, byCode.get(code)!])) as AdditionalNutrientSnapshotV1["values"];
  return { ok: true, data: { version: 1, values } };
}

export function additionalSnapshotToRequest(snapshot: AdditionalNutrientSnapshotV1): AdditionalNutrientRequestV1;
export function additionalSnapshotToRequest(snapshot: null): null;
export function additionalSnapshotToRequest(snapshot: AdditionalNutrientSnapshotV1 | null): AdditionalNutrientRequestV1 | null;
export function additionalSnapshotToRequest(snapshot: AdditionalNutrientSnapshotV1 | null): AdditionalNutrientRequestV1 | null {
  return snapshot === null ? null : {
    version: 1,
    values: additionalNutrientCodesV1.map((code) => ({ code, amount: snapshot.values[code] })),
  };
}

export function emptyAdditionalNutrientSnapshot(): AdditionalNutrientSnapshotV1 {
  return {
    version: 1,
    values: Object.fromEntries(additionalNutrientCodesV1.map((code) => [code, null])) as AdditionalNutrientSnapshotV1["values"],
  };
}

// Reference nutrients have the catalog's four-decimal precision/range, including
// energy and core macros. Their consumed snapshot limits apply only after scale.
export function parseNutrientReferenceValues(
  value: unknown,
): SnapshotContractResult<NutrientReferenceValuesV1> {
  if (!record(value) || !exactKeys(value, nutrientCodesV1)) {
    return { ok: false, code: "invalid_code_count" };
  }
  const values = {} as NutrientReferenceValuesV1;
  for (const code of nutrientCodesV1) {
    const raw = value[code];
    if (raw === null) { values[code] = null; continue; }
    if (typeof raw !== "string") return { ok: false, code: "invalid_amount", field: code };
    const amount = parseExactNonnegativeDecimal(raw);
    if (!amount) return { ok: false, code: "invalid_amount", field: code };
    const scaled = amount.numerator * BigInt(10000);
    if (scaled % amount.denominator !== BigInt(0)) return { ok: false, code: "amount_precision", field: code };
    if (scaled / amount.denominator > BigInt("99999999999999")) {
      return { ok: false, code: "amount_out_of_range", field: code };
    }
    values[code] = formatExactFraction(amount, 4)!;
  }
  return { ok: true, data: values };
}
