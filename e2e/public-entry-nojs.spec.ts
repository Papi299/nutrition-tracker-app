import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import {
  expect,
  test,
  type BrowserContext,
  type Page,
} from "@playwright/test";

const localOnly = process.env.DATE_E2E_LOCAL_SUPABASE === "1";
const configuredAppOrigin = new URL(
  process.env.PLAYWRIGHT_BASE_URL ??
    `http://127.0.0.1:${process.env.PLAYWRIGHT_PORT ?? "3100"}`,
).origin;
const supabaseProjectId = readFileSync("supabase/config.toml", "utf8").match(
  /^project_id\s*=\s*"([^"]+)"/m,
)?.[1];

if (!supabaseProjectId) {
  throw new Error("Could not read the local Supabase project id.");
}

const databaseContainer = `supabase_db_${supabaseProjectId}`;

test.skip(!localOnly, "CJ-001 acceptance requires the local-only test runner.");

type Locale = "en" | "he";

function queryDatabase(statement: string) {
  return execFileSync(
    "docker",
    [
      "exec",
      databaseContainer,
      "psql",
      "-U",
      "postgres",
      "-d",
      "postgres",
      "-v",
      "ON_ERROR_STOP=1",
      "-At",
      "-c",
      statement,
    ],
    { encoding: "utf8" },
  ).trim();
}

function applicationDataSnapshot() {
  const tableNames = queryDatabase(
    "select tablename from pg_tables where schemaname = 'public' order by tablename;",
  )
    .split(/\r?\n/)
    .filter(Boolean);

  return {
    authUsers: Number(queryDatabase("select count(*) from auth.users;")),
    publicTables: Object.fromEntries(
      tableNames.map((tableName) => [
        tableName,
        Number(
          queryDatabase(`select count(*) from public."${tableName}";`),
        ),
      ]),
    ),
  };
}

async function expectDocumentLocale(page: Page, locale: Locale) {
  await expect(page.locator("html")).toHaveAttribute("lang", locale);
  await expect(page.locator("html")).toHaveAttribute(
    "dir",
    locale === "en" ? "ltr" : "rtl",
  );
}

async function expectRealAnchor(page: Page, name: string, href: string) {
  const link = page.getByRole("link", { name, exact: true });

  await expect(link).toHaveAttribute("href", href);
  await expect(link).toHaveJSProperty("tagName", "A");
}

async function expectLanding(page: Page, locale: Locale) {
  const labels =
    locale === "en"
      ? {
          heading: "Manual nutrition tracking in English and Hebrew.",
          home: "Home",
          signIn: "Sign in",
          signUp: "Sign up",
          switchLanguage: "עברית",
          switchHref: "/he",
        }
      : {
          heading: "מעקב תזונתי ידני בעברית ובאנגלית.",
          home: "בית",
          signIn: "כניסה",
          signUp: "הרשמה",
          switchLanguage: "English",
          switchHref: "/en",
        };

  await expectDocumentLocale(page, locale);
  await expect(
    page.getByRole("heading", { level: 1, name: labels.heading }),
  ).toBeVisible();
  await expectRealAnchor(page, labels.home, `/${locale}`);
  await expectRealAnchor(page, labels.signIn, `/${locale}/auth/sign-in`);
  await expectRealAnchor(page, labels.signUp, `/${locale}/auth/sign-up`);
  await expectRealAnchor(page, labels.switchLanguage, labels.switchHref);
}

async function expectAuthPage(
  page: Page,
  locale: Locale,
  path: "sign-in" | "sign-up",
) {
  const heading =
    locale === "en"
      ? path === "sign-in"
        ? "Sign in"
        : "Create account"
      : path === "sign-in"
        ? "כניסה לחשבון"
        : "יצירת חשבון";

  await expect(page).toHaveURL(new RegExp(`/${locale}/auth/${path}$`));
  await expectDocumentLocale(page, locale);
  await expect(
    page.getByRole("heading", { level: 1, name: heading }),
  ).toBeVisible();
}

test.describe.serial("CJ-001 disabled-JavaScript public locale entry", () => {
  test("CJ-001 traverses localized public and auth entry with native history and no application mutation", async ({
    browser,
  }) => {
    const before = applicationDataSnapshot();
    const context: BrowserContext = await browser.newContext({
      javaScriptEnabled: false,
    });
    const page = await context.newPage();

    try {
      await page.goto("/en");
      await expectLanding(page, "en");

      await page.getByRole("link", { name: "Sign in", exact: true }).click();
      await expectAuthPage(page, "en", "sign-in");
      await page.goBack();
      await expectLanding(page, "en");

      await page.getByRole("link", { name: "Sign up", exact: true }).click();
      await expectAuthPage(page, "en", "sign-up");
      await page.goBack();
      await expectLanding(page, "en");

      await page.getByRole("link", { name: "עברית", exact: true }).click();
      await expect(page).toHaveURL(/\/he$/);
      await expectLanding(page, "he");

      await page.getByRole("link", { name: "כניסה", exact: true }).click();
      await expectAuthPage(page, "he", "sign-in");
      await page.goBack();
      await expectLanding(page, "he");

      await page.getByRole("link", { name: "הרשמה", exact: true }).click();
      await expectAuthPage(page, "he", "sign-up");
      await page.goBack();
      await expectLanding(page, "he");

      await page.getByRole("link", { name: "כניסה", exact: true }).click();
      await expectAuthPage(page, "he", "sign-in");
      await page.goBack();
      await expectLanding(page, "he");
      await page.goBack();
      await expectLanding(page, "en");
      await page.goForward();
      await expectLanding(page, "he");

      await page.goto("/en");
      await expectLanding(page, "en");
      expect(applicationDataSnapshot()).toEqual(before);
    } finally {
      await context.close();
    }
  });

  test("CJ-001 rejects an unsupported locale safely without disclosure or application mutation", async ({
    browser,
  }) => {
    const before = applicationDataSnapshot();
    const context = await browser.newContext({ javaScriptEnabled: false });
    const page = await context.newPage();

    try {
      const response = await page.goto("/fr");
      const finalUrl = new URL(page.url());
      const redirectedFrom = response?.request().redirectedFrom();

      expect(response?.status()).toBe(404);
      expect(finalUrl.origin).toBe(configuredAppOrigin);
      expect(finalUrl.pathname).toBe("/en/fr");
      expect(new URL(redirectedFrom?.url() ?? configuredAppOrigin).pathname).toBe(
        "/fr",
      );
      expect(response?.request().redirectedTo()).toBeNull();
      await expect(page.getByText("This page could not be found.")).toBeVisible();

      const body = await page.locator("body").innerText();
      expect(body).not.toMatch(
        /\/today|diary entries|nutrition targets|saved meals|recipes/i,
      );
      expect(finalUrl.pathname).not.toMatch(/auth|account/i);
      expect(applicationDataSnapshot()).toEqual(before);
    } finally {
      await context.close();
    }
  });
});
