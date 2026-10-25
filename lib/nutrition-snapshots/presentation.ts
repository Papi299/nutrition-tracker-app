import { parseAdditionalNutrientSnapshot } from "./contracts";
import { additionalNutrientCodesV1, type AdditionalNutrientCode } from "./manifest";
import { formatExactFraction, parseExactNonnegativeDecimal } from "./decimal";
import { localeTags } from "@/lib/i18n/format";
import type { Locale } from "@/lib/i18n/routing";

export type AdditionalNutrientTotal = {
  complete: boolean;
  knownSubtotal: string | null;
  unknownCount: number;
};

// Sum persisted consumed amounts only. Daily sums are not constrained by a
// single-entry storage bound, and incomplete totals never become known zeros.
export function summarizeAdditionalSnapshots(snapshots: readonly unknown[]):
  | { ok: false }
  | { ok: true; capturedCount: number; uncapturedCount: number; values: Record<AdditionalNutrientCode, AdditionalNutrientTotal> } {
  const parsed = snapshots.map(parseAdditionalNutrientSnapshot);
  if (parsed.some(result => !result.ok)) return { ok: false };
  const captured = parsed.flatMap(result => result.ok && result.data !== null ? [result.data] : []);
  const values = Object.fromEntries(additionalNutrientCodesV1.map(code => {
    let scaledTotal = BigInt(0);
    let knownCount = 0;
    for (const snapshot of captured) {
      const amount = snapshot.values[code];
      if (amount === null) continue;
      const exact = parseExactNonnegativeDecimal(amount)!;
      scaledTotal += exact.numerator * BigInt(10_000) / exact.denominator;
      knownCount++;
    }
    return [code, {
      complete: snapshots.length > 0 && knownCount === snapshots.length,
      knownSubtotal: knownCount ? formatExactFraction({ numerator: scaledTotal, denominator: BigInt(10_000) }, 4)! : null,
      unknownCount: snapshots.length - knownCount,
    }];
  })) as Record<AdditionalNutrientCode, AdditionalNutrientTotal>;
  return { ok: true, capturedCount: captured.length, uncapturedCount: snapshots.length - captured.length, values };
}

export function formatExactNutrientTotal(value: string, locale: Locale): string {
  const [whole, fraction] = value.split(".");
  const formatter = new Intl.NumberFormat(localeTags[locale]);
  const integer = formatter.format(BigInt(whole));
  const decimal = formatter.formatToParts(1.1).find(part => part.type === "decimal")!.value;
  return fraction ? `${integer}${decimal}${fraction}` : integer;
}
