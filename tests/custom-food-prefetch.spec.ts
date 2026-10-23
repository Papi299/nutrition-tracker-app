import { expect, test } from "@playwright/test";
import { isExpectedCustomFoodEditPrefetch, type ReceiptRequest } from "@/e2e/helpers/custom-food-prefetch";

const foodId = "11111111-1111-4111-8111-111111111111";
const expected = { origin: "http://127.0.0.1:3100/en/foods/custom/" + foodId + "/edit?saved=updated", foodId };
const path = "/en/foods/custom/" + foodId + "/edit";
const request: ReceiptRequest = {
  url: path + "?saved=updated&_rsc=fixture-cache-key",
  method: "GET", action: false, prefetch: true, navigation: false,
  resourceType: "fetch", rsc: true, routerPrefetch: true,
};

for (const locale of ["en", "he"]) {
  for (const cache of ["", "&_rsc=fixture-cache-key"]) {
    test("accepts only the expected " + locale + " editor RSC prefetch " + (cache ? "with" : "without") + " cache key", () => {
      expect(isExpectedCustomFoodEditPrefetch({
        ...request, url: "/" + locale + "/foods/custom/" + foodId + "/edit?saved=updated" + cache,
      }, expected)).toBe(true);
    });
  }
}

const regressions: [string, Partial<ReceiptRequest>][] = [
  ["Server Action POST, even with prefetch flags", { method: "POST", action: true }],
  ["non-action POST", { method: "POST" }],
  ["action header on a GET", { action: true }],
  ["document navigation, even with prefetch flags", { navigation: true }],
  ["document resource", { resourceType: "document" }],
  ["unmarked fetch", { prefetch: false }],
  ["missing RSC header", { rsc: false }],
  ["purpose-only prefetch", { routerPrefetch: false }],
  ["foreign origin", { url: "https://example.test" + path + "?saved=updated" }],
  ["URL credentials", { url: "http://name:password@127.0.0.1:3100" + path + "?saved=updated" }],
  ["different food identity", { url: path.replace(foodId, "22222222-2222-4222-8222-222222222222") + "?saved=updated" }],
  ["unsupported locale", { url: path.replace("/en/", "/fr/") + "?saved=updated" }],
  ["creation route", { url: "/en/foods/custom/new?saved=updated" }],
  ["stale saved state", { url: path + "?saved=created" }],
  ["receipt-bearing request", { url: path + "?saved=updated&creationRequest=" + foodId }],
  ["unexpected meaningful query", { url: path + "?saved=updated&date=2026-10-23" }],
  ["repeated saved parameter", { url: path + "?saved=updated&saved=created" }],
  ["repeated cache key", { url: path + "?saved=updated&_rsc=a&_rsc=b" }],
  ["empty cache key", { url: path + "?saved=updated&_rsc=" }],
  ["unexpected fragment", { url: path + "?saved=updated#receipt" }],
];
for (const [name, mutation] of regressions) {
  test("rejects " + name, () => {
    expect(isExpectedCustomFoodEditPrefetch({ ...request, ...mutation }, expected)).toBe(false);
  });
}
