import { expect, test } from "@playwright/test";
import { localeNavigationQuery } from "@/lib/i18n/locale-query";

const uuid = "11111111-1111-4111-8111-111111111111";
const date = "2026-09-20";

function navigate(path: string, query = "", locale = "en") {
  return localeNavigationQuery(`/${locale}${path}`, new URLSearchParams(query));
}

const supportedCases = [
  ["/foods/barcode", `date=${date}&mealType=lunch`, `date=${date}&mealType=lunch`],
  ["/foods/barcode", `code=036000291452&date=${date}&mealType=dinner`, `code=00036000291452&date=${date}&mealType=dinner`],
  ["/foods/barcode", "code=036000291452&mealType=lunch", "code=00036000291452&mealType=lunch"],
  ["/foods", `q=%20APPLE%20%20JUICE%20&date=${date}`, `date=${date}&q=+APPLE++JUICE+`],
  ["/foods", `date=${date}&q=a`, `date=${date}&q=a`],
  ["/foods", `date=${date}&q=`, `date=${date}&q=`],
  ["/foods/reuse", `date=${date}`, `date=${date}`],
  ["/today", `date=${date}&foodId=${uuid}&mealType=snack`, `date=${date}&foodId=${uuid}&mealType=snack`],
  ["/setup", `effectiveDate=${date}`, `effectiveDate=${date}`],
  ["/foods/custom", `date=${date}&status=archived&page=2&saved=archived`, "status=archived&page=2&saved=archived"],
  ["/saved-meals", `date=${date}&status=archived&page=2`, `date=${date}&status=archived&page=2`],
  ["/recipes", `date=${date}&status=active&page=3&saved=restored`, `date=${date}&status=active&page=3&saved=restored`],
  ["/saved-meals/new", `date=${date}&mealType=lunch`, `date=${date}&mealType=lunch`],
  [`/saved-meals/${uuid}/edit`, `date=${date}&saved=updated`, `date=${date}&saved=updated`],
  [`/saved-meals/${uuid}/use`, `date=${date}&mealType=dinner`, `date=${date}`],
  [`/recipes/${uuid}/use`, `date=${date}&mealType=lunch&servings=02.500`, `date=${date}&mealType=lunch&servings=2.5`],
  [`/recipes/${uuid}/use`, "mealType=lunch&servings=2.500", "mealType=lunch&servings=2.5"],
  ["/foods/custom/new", `barcode=00036000291452&date=${date}&mealType=lunch`, `barcode=00036000291452&date=${date}&mealType=lunch`],
  ["/auth/reauthenticate", "intent=account-export", "intent=account-export"],
  ["/auth/reauthenticate", "intent=account-closure", "intent=account-closure"],
  ["/auth/sign-in", "recovery=complete", "recovery=complete"],
] as const;

for (const locale of ["en", "he"]) {
  test(`${locale} preserves only route-supported context with canonical values`, () => {
    for (const [path, source, expected] of supportedCases) {
      expect(navigate(path, source, locale), `${path}?${source}`).toBe(expected);
    }
  });
}

test("an absent query stays absent, including routes with parser defaults", () => {
  for (const path of ["", "/today", "/setup", "/foods", "/foods/barcode", "/foods/custom", "/saved-meals", "/recipes", `/recipes/${uuid}/use`, "/auth/sign-in", "/auth/account-closed"]) {
    expect(navigate(path)).toBe("");
  }
});

test("rejects repeated values without accepting an identical first value", () => {
  for (const path of ["/foods/custom", "/saved-meals", "/recipes"]) {
    expect(navigate(path, "status=archived&status=archived&page=2")).toBe("");
    expect(navigate(path, "status=archived&page=2&page=2")).toBe("");
  }
  expect(navigate("/foods/barcode", `date=${date}&date=${date}&mealType=lunch`)).toBe("");
  expect(navigate("/foods", `date=${date}&q=apple&q=apple`)).toBe(`date=${date}`);
  expect(navigate("/today", `date=${date}&foodId=${uuid}&mealType=lunch&mealType=lunch`)).toBe(`date=${date}`);
  expect(navigate("/auth/reauthenticate", "intent=account-export&intent=account-export")).toBe("");
  expect(navigate("/auth/sign-in", "recovery=complete&recovery=complete")).toBe("");
});

test("rejects invalid canonical dates and keeps independently valid context", () => {
  for (const invalid of ["2026-02-29", "2026-9-20", "2026-09-20T00:00:00Z", ""]) {
    expect(navigate("/setup", `effectiveDate=${invalid}`)).toBe("");
    expect(navigate("/today", `date=${invalid}&mealType=lunch`)).toBe("mealType=lunch");
  }
  expect(navigate("/recipes", `date=${date}&status=all&page=2`)).toBe(`date=${date}`);
});

test("rejects incomplete or invalid atomic Saved Meal and Custom Food origins", () => {
  for (const query of [`date=${date}`, "mealType=lunch", `date=${date}&mealType=brunch`, `date=${date}&mealType=lunch&date=${date}`]) {
    expect(navigate("/saved-meals/new", query)).toBe("");
  }
  for (const query of [`date=${date}&mealType=lunch`, `barcode=036000291452&date=${date}`, `barcode=00036000291452&date=${date}&mealType=`]) {
    expect(navigate("/foods/custom/new", query)).toBe("");
  }
});

test("strict route groups reject unknown and sensitive keys before serialization", () => {
  for (const path of ["/foods/barcode", "/foods/custom/new", `/recipes/${uuid}/use`]) {
    const source = path === "/foods/custom/new" ? `barcode=00036000291452&date=${date}` : `date=${date}`;
    for (const unknown of ["next=https%3A%2F%2Fexample.test", "access_token=secret", "__proto__=tampered", "extra=1"]) {
      expect(navigate(path, `${source}&${unknown}`)).toBe("");
    }
  }
});

test("permissive route groups never forward authentication or redirect inputs", () => {
  const sensitive = "code=auth-code&token_hash=secret&access_token=secret&refresh_token=secret&next=https%3A%2F%2Fexample.test&redirect=%2Faccount&returnTo=%2Faccount";
  expect(navigate("/today", `date=${date}&${sensitive}`)).toBe(`date=${date}`);
  expect(navigate("/foods", `date=${date}&q=apple&${sensitive}`)).toBe(`date=${date}&q=apple`);
  expect(navigate("/auth/reauthenticate", `intent=account-export&${sensitive}`)).toBe("intent=account-export");
  expect(navigate("/auth/sign-in", `recovery=complete&${sensitive}`)).toBe("recovery=complete");
  for (const path of ["", "/auth/account-closed", "/auth/recover", "/auth/confirmation-error", "/auth/confirm", "/account", "/account/export", "/account/closure"]) {
    expect(navigate(path, sensitive)).toBe("");
  }
});

test("rejects invalid pagination and recipe servings using established parsers", () => {
  for (const page of ["0", "-1", "01", "1e2", "9007199254740991", "2.5"]) {
    expect(navigate("/foods/custom", `status=active&page=${page}`)).toBe("");
  }
  for (const servings of ["0", "10001", "1e2", "1.0001", "-1", ""]) {
    expect(navigate(`/recipes/${uuid}/use`, `date=${date}&servings=${servings}`)).toBe("");
  }
  expect(navigate(`/recipes/${uuid}/use`, `date=${date}&servings=2&servings=2`)).toBe("");
});

test("does not promote overlong search or invalid meal fields into accepted context", () => {
  expect(navigate("/foods", `date=${date}&q=${"a".repeat(101)}`)).toBe(`date=${date}`);
  expect(navigate("/today", `date=${date}&foodId=${uuid}&mealType=brunch`)).toBe(`date=${date}`);
  expect(navigate("/foods/barcode", `date=${date}&mealType=brunch`)).toBe("");
});

test("preserves only existing conditional creation cleanup receipts and notification enums", () => {
  expect(navigate("/today", `date=${date}&customFood=created&creationRequest=${uuid}&savedMeal=logged&recipe=logged`)).toBe(`date=${date}&customFood=created&savedMeal=logged&recipe=logged&creationRequest=${uuid}`);
  expect(navigate(`/foods/custom/${uuid}/edit`, `saved=created&creationRequest=${uuid}&date=${date}`)).toBe(`saved=created&creationRequest=${uuid}`);
  for (const query of [`saved=updated&creationRequest=${uuid}`, `saved=created&creationRequest=invalid`, `saved=created&creationRequest=${uuid}&creationRequest=${uuid}`]) {
    expect(new URLSearchParams(navigate(`/foods/custom/${uuid}/edit`, query)).has("creationRequest")).toBe(false);
  }
  expect(navigate("/today", `customFood=updated&savedMeal=created&recipe=created&creationRequest=${uuid}`)).toBe("");
});

test("rejects unsupported auth intent values and unknown or overlapping routes", () => {
  for (const intent of ["https://example.test", "account-delete", "today", ""]) {
    expect(navigate("/auth/reauthenticate", `intent=${encodeURIComponent(intent)}`)).toBe("");
  }
  for (const path of ["/foods/barcode-extra", "/today/extra", "/recipes/new", "/foods/custom/not-a-uuid/edit", "/saved-meals/not-a-uuid/use"]) {
    expect(navigate(path, `date=${date}&mealType=lunch&saved=created`)).toBe("");
  }
  expect(localeNavigationQuery("/today", new URLSearchParams(`date=${date}`))).toBe("");
  expect(localeNavigationQuery("/fr/today", new URLSearchParams(`date=${date}`))).toBe("");
});
