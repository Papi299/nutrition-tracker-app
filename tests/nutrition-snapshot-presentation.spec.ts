import { expect, test } from "@playwright/test";
import { additionalNutrientCodesV1 } from "@/lib/nutrition-snapshots";
import { summarizeAdditionalSnapshots, formatExactNutrientTotal } from "@/lib/nutrition-snapshots/presentation";
const snapshot = (amount: number | null) => ({ version: 1, values: Object.fromEntries(additionalNutrientCodesV1.map(code => [code, amount])) });

test("read-only totals preserve independent unknown, uncaptured, and zero semantics", () => {
  const a = snapshot(0.1234); a.values.fiber_g = 0; a.values.sodium_mg = null;
  const b = snapshot(0.2345); b.values.fiber_g = 0;
  const result = summarizeAdditionalSnapshots([a, b]);
  expect(result.ok).toBe(true); if (!result.ok) return;
  expect(result.values.fiber_g).toEqual({ complete: true, knownSubtotal: "0", unknownCount: 0 });
  expect(result.values.calcium_mg).toEqual({ complete: true, knownSubtotal: "0.3579", unknownCount: 0 });
  expect(result.values.sodium_mg).toEqual({ complete: false, knownSubtotal: "0.2345", unknownCount: 1 });
  const historical = summarizeAdditionalSnapshots([null, snapshot(null)]);
  expect(historical.ok && historical.uncapturedCount).toBe(1);
  expect(historical.ok && historical.values.fiber_g).toEqual({ complete: false, knownSubtotal: null, unknownCount: 2 });
});

test("daily totals retain four decimals beyond a single-entry bound and fail closed on unsupported snapshots", () => {
  const result = summarizeAdditionalSnapshots([snapshot(9999999999.9999), snapshot(9999999999.9999)]);
  expect(result.ok && result.values.fiber_g.knownSubtotal).toBe("19999999999.9998");
  expect(formatExactNutrientTotal("9999999999999999.1234", "en")).toBe("9,999,999,999,999,999.1234");
  expect(formatExactNutrientTotal("9999999999999999.1234", "he")).toBe("9,999,999,999,999,999.1234");
  expect(summarizeAdditionalSnapshots([{ ...snapshot(1), version: 2 }])).toEqual({ ok: false });
  expect(summarizeAdditionalSnapshots([undefined])).toEqual({ ok: false });
});
