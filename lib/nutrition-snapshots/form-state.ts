import { additionalNutrientCodesV1, type AdditionalNutrientCode } from "./manifest";
import { normalizeNutrientAmount, parseExactNonnegativeDecimal } from "./decimal";
import type { AdditionalNutrientRequestV1, AdditionalNutrientSnapshotV1 } from "./contracts";

export type AdditionalNutrientFormState = {
  additional_values: Record<AdditionalNutrientCode, string>;
  additional_captured: boolean;
};

export function additionalSnapshotFormState(snapshot: AdditionalNutrientSnapshotV1 | null | undefined): AdditionalNutrientFormState {
  return {
    additional_captured: snapshot != null,
    additional_values: Object.fromEntries(additionalNutrientCodesV1.map(code => [code,
      snapshot?.values[code] == null ? "" : String(snapshot.values[code]),
    ])) as Record<AdditionalNutrientCode, string>,
  };
}

export function sameDecimalFormValue(left: string | undefined, right: string | undefined) {
  if (!left?.trim() || !right?.trim()) return !left?.trim() && !right?.trim();
  const a = parseExactNonnegativeDecimal(left);
  const b = parseExactNonnegativeDecimal(right);
  return Boolean(a && b && a.numerator * b.denominator === b.numerator * a.denominator);
}

export function normalizeAdditionalFormState(state: AdditionalNutrientFormState): {
  request: AdditionalNutrientRequestV1 | null; reviewRequired: boolean; errors: Record<string, string>;
} {
  const errors: Record<string, string> = {};
  if (!state.additional_captured) {
    if (additionalNutrientCodesV1.some(code => Boolean(state.additional_values[code]?.trim()))) errors.additional_nutrients_captured = "capture_required";
    return { request: null, reviewRequired: false, errors };
  }
  const values: AdditionalNutrientRequestV1["values"] = [];
  let reviewRequired = false;
  for (const code of additionalNutrientCodesV1) {
    const raw = state.additional_values[code]?.trim() ?? "";
    const normalized = normalizeNutrientAmount(code, raw === "" ? null : raw);
    if (!normalized.ok) { errors[code] = normalized.code; continue; }
    const text = normalized.data === null ? "" : String(normalized.data);
    reviewRequired ||= !sameDecimalFormValue(raw, text);
    state.additional_values[code] = text;
    values.push({ code, amount: normalized.data });
  }
  return { request: { version: 1, values }, reviewRequired, errors };
}

// Apply server reviews only to fields that have not been edited since submit;
// a row can move without losing either its review or newer user input.
export function mergeReviewedRows<Row extends { row_key: string }>(current: Row[], submitted: Row[], reviewed: Row[]): Row[] {
  const before = new Map(submitted.map(row => [row.row_key, row]));
  const after = new Map(reviewed.map(row => [row.row_key, row]));
  return current.map(row => {
    const original = before.get(row.row_key);
    const response = after.get(row.row_key);
    if (!original || !response) return row;
    const merged = { ...row };
    for (const key of Object.keys(response) as Array<keyof Row>) {
      if (JSON.stringify(row[key]) === JSON.stringify(original[key])) merged[key] = response[key];
    }
    type ReferenceReview = { reference_fingerprint?: string; automatic_values?: Record<string, string | undefined>; reference?: unknown };
    const oldReference = original as Row & ReferenceReview;
    const newReference = response as Row & ReferenceReview;
    if (newReference.reference_fingerprint && newReference.reference_fingerprint !== oldReference.reference_fingerprint &&
      newReference.automatic_values && Object.values(newReference.automatic_values).every(value => value !== "1")) {
      // A newly observed reference change requires a decision after the notice,
      // even if an unrelated field was edited while the request was pending.
      return { ...merged, automatic_values: newReference.automatic_values,
        reference_fingerprint: newReference.reference_fingerprint, reference: newReference.reference } as Row;
    }
    return merged;
  });
}
