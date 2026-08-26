import { expect, test } from "@playwright/test";

test.describe("localized public and signed-out route smoke checks", () => {
  test("English public home renders with LTR document attributes", async ({
    page,
  }) => {
    await page.goto("/en");

    await expect(page.locator("html")).toHaveAttribute("lang", "en");
    await expect(page.locator("html")).toHaveAttribute("dir", "ltr");
    await expect(
      page.getByText(
        /recipes—including creation, editing, management, nutrition calculation, and diary use—are implemented/i,
      ),
    ).toBeVisible();
    await expect(
      page.getByText(/recipe nutrition and diary use.*remain unavailable/i),
    ).toHaveCount(0);
  });

  test("Hebrew public home renders with RTL document attributes", async ({
    page,
  }) => {
    await page.goto("/he");

    await expect(page.locator("html")).toHaveAttribute("lang", "he");
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    await expect(
      page.getByText(
        /ומתכונים — כולל יצירה, עריכה, ניהול, חישוב ערכים תזונתיים ושימוש ביומן/,
      ),
    ).toBeVisible();
    await expect(
      page.getByText(/תזונת מתכונים ושימוש בהם ביומן.*אינם זמינים/),
    ).toHaveCount(0);
  });

  test("signed-out English today route redirects to localized sign-in", async ({
    page,
  }) => {
    await page.goto("/en/today");

    await expect(page).toHaveURL(/\/en\/auth\/sign-in$/);
  });

  test("signed-out Hebrew today route redirects to localized sign-in", async ({
    page,
  }) => {
    await page.goto("/he/today");

    await expect(page).toHaveURL(/\/he\/auth\/sign-in$/);
  });
});
