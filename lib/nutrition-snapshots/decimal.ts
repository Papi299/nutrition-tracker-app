import { getNutrientDefinitionV1, type NutrientCode } from "./manifest";

export type ExactFraction = Readonly<{ numerator: bigint; denominator: bigint }>;
export type NutrientAmountResult =
  | { ok: true; data: number | null }
  | { ok: false; code: "invalid_amount" | "amount_precision" | "amount_out_of_range" };

const zero = BigInt(0);
const one = BigInt(1);
const two = BigInt(2);
const ten = BigInt(10);

export function parseExactNonnegativeDecimal(value: unknown): ExactFraction | null {
  if (typeof value !== "number" && typeof value !== "string") return null;
  if (typeof value === "number" && !Number.isFinite(value)) return null;
  const text = String(value).trim();
  if (!text || text.length > 400) return null;
  const match = /^([+-]?)(?:(\d+)(?:\.(\d*))?|\.(\d+))(?:e([+-]?\d+))?$/i.exec(text);
  if (!match) return null;
  const fraction = match[3] ?? match[4] ?? "";
  const exponent = Number(match[5] ?? 0) - fraction.length;
  if (!Number.isSafeInteger(exponent) || Math.abs(exponent) > 400) return null;
  const digits = BigInt(`${match[2] ?? "0"}${fraction}`);
  if (match[1] === "-" && digits !== zero) return null;
  return exponent >= 0
    ? { numerator: digits * ten ** BigInt(exponent), denominator: one }
    : { numerator: digits, denominator: ten ** BigInt(-exponent) };
}

export function formatExactFraction(value: ExactFraction, precision: number): string | null {
  if (!Number.isInteger(precision) || precision < 0 || precision > 4 ||
    value.numerator < zero || value.denominator <= zero) return null;
  const scale = ten ** BigInt(precision);
  const scaled = value.numerator * scale;
  const rounded = scaled / value.denominator +
    (scaled % value.denominator * two >= value.denominator ? one : zero);
  const whole = rounded / scale;
  const fractional = (rounded % scale).toString().padStart(precision, "0").replace(/0+$/, "");
  return fractional ? `${whole}.${fractional}` : whole.toString();
}

export function normalizeNutrientFraction(
  code: NutrientCode,
  value: ExactFraction,
  requireNormalized = false,
): NutrientAmountResult {
  const definition = getNutrientDefinitionV1(code);
  if (!definition) return { ok: false, code: "invalid_amount" };
  const roundedText = formatExactFraction(value, definition.precision);
  if (roundedText === null) return { ok: false, code: "invalid_amount" };
  const rounded = parseExactNonnegativeDecimal(roundedText)!;
  if (requireNormalized && rounded.numerator * value.denominator !== value.numerator * rounded.denominator) {
    return { ok: false, code: "amount_precision" };
  }
  const maximum = parseExactNonnegativeDecimal(definition.maximum)!;
  if (rounded.numerator * maximum.denominator > maximum.numerator * rounded.denominator) {
    return { ok: false, code: "amount_out_of_range" };
  }
  return { ok: true, data: Number(roundedText) };
}

// Parsing persisted snapshots is strict. Mutation normalization rounds at the
// final boundary, using the original decimal rather than a rounded preview.
export function normalizeNutrientAmount(
  code: NutrientCode,
  value: unknown,
  requireNormalized = false,
): NutrientAmountResult {
  if (value === null) return { ok: true, data: null };
  const parsed = parseExactNonnegativeDecimal(value);
  return parsed ? normalizeNutrientFraction(code, parsed, requireNormalized) : { ok: false, code: "invalid_amount" };
}

export function scaleNutrientAmount(
  code: NutrientCode,
  amount: unknown,
  quantity: unknown,
  referenceQuantity: unknown,
): NutrientAmountResult {
  if (amount === null) return { ok: true, data: null };
  const nutrient = parseExactNonnegativeDecimal(amount);
  const consumed = parseExactNonnegativeDecimal(quantity);
  const reference = parseExactNonnegativeDecimal(referenceQuantity);
  if (!nutrient || !consumed || !reference || reference.numerator === zero) {
    return { ok: false, code: "invalid_amount" };
  }
  return normalizeNutrientFraction(code, {
    numerator: nutrient.numerator * consumed.numerator * reference.denominator,
    denominator: nutrient.denominator * consumed.denominator * reference.numerator,
  }, false);
}
