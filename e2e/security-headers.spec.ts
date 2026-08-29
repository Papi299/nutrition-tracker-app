import { expect, test } from "@playwright/test";
import { browserSecurityHeaders } from "@/lib/security/browser-headers";

const representativeRoutes = [
  { classification: "public", path: "/en" },
  { classification: "authentication", path: "/en/auth/sign-in" },
  { classification: "protected application", path: "/en/today" },
  { classification: "account export", path: "/en/account/export" },
  { classification: "account closure", path: "/en/account/closure" },
  { classification: "barcode camera", path: "/en/foods/barcode" },
] as const;

const expectedHeaders = browserSecurityHeaders({
  appOrigin: process.env.APP_ORIGIN,
  environment: "production",
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
});

for (const route of representativeRoutes) {
  test(`${route.classification} response carries the enforced browser policy`, async ({
    request,
  }) => {
    const response = await request.get(route.path, { maxRedirects: 0 });
    const actual = response.headers();

    for (const header of expectedHeaders) {
      expect(actual[header.key.toLowerCase()]).toBe(header.value);
    }
  });
}

test("production pages load framework assets without CSP violations", async ({
  page,
}) => {
  const violations: string[] = [];
  page.on("console", (message) => {
    if (/content security policy|refused to (?:load|execute|apply|connect)/i.test(message.text())) {
      violations.push(message.text());
    }
  });

  await page.goto("/en");
  await expect(
    page.getByRole("heading", {
      level: 1,
      name: "Manual nutrition tracking in English and Hebrew.",
    }),
  ).toBeVisible();
  await page.goto("/en/auth/sign-in");
  await expect(page.getByRole("heading", { level: 1, name: "Sign in" })).toBeVisible();

  expect(violations).toEqual([]);
});

test("public and Auth entry remain usable without JavaScript", async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();

  try {
    await page.goto("/he");
    await expect(
      page.getByRole("heading", {
        level: 1,
        name: "מעקב תזונתי ידני בעברית ובאנגלית.",
      }),
    ).toBeVisible();
    await page.getByRole("link", { exact: true, name: "כניסה" }).click();
    await expect(
      page.getByRole("heading", { level: 1, name: "כניסה לחשבון" }),
    ).toBeVisible();
  } finally {
    await context.close();
  }
});
