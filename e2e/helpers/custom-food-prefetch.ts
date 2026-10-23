export type ReceiptRequest = {
  url: string;
  method: string;
  action: boolean;
  prefetch: boolean;
  navigation: boolean;
  resourceType: string;
  rsc: boolean;
  routerPrefetch: boolean;
};

// Exempt only passive RSC prefetches for this editor's two updated locale links.
// Action submissions, document navigation and every other request still fail.
export function isExpectedCustomFoodEditPrefetch(
  request: ReceiptRequest,
  expected: { origin: string; foodId: string },
) {
  if (
    request.method !== "GET" || request.action || !request.prefetch ||
    request.navigation || request.resourceType !== "fetch" ||
    !request.rsc || !request.routerPrefetch
  ) return false;

  try {
    const origin = new URL(expected.origin).origin;
    const url = new URL(request.url, origin);
    if (
      url.origin !== origin || url.username || url.password || url.hash ||
      !["en", "he"].some(locale =>
        url.pathname === "/" + locale + "/foods/custom/" + expected.foodId + "/edit") ||
      url.searchParams.getAll("saved").length !== 1 ||
      url.searchParams.get("saved") !== "updated" ||
      [...url.searchParams.keys()].some(key => key !== "saved" && key !== "_rsc") ||
      url.searchParams.getAll("_rsc").length > 1
    ) return false;
    const cacheKey = url.searchParams.get("_rsc");
    return cacheKey === null || /^[A-Za-z0-9_-]{1,128}$/.test(cacheKey);
  } catch {
    return false;
  }
}
