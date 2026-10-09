import { expect, test } from "@playwright/test";

for (const locale of ["en", "he"] as const) {
  test(`${locale} native auth controls retain touch targets and focus in forced colors`, async ({ page }) => {
    await page.emulateMedia({ forcedColors: "active", reducedMotion: "reduce" });
    await page.setViewportSize({ width: 320, height: 800 });
    await page.goto(`/${locale}/auth/sign-in`);
    await expect(page.locator("html")).toHaveAttribute("dir", locale === "he" ? "rtl" : "ltr");

    const email = page.locator('input[name="email"]');
    await expect(email).toHaveAttribute("type", "email");
    await expect(email).toHaveAttribute("autocomplete", "email");
    await email.focus();
    await page.keyboard.press("Shift+Tab");
    await page.keyboard.press("Tab");
    await expect(email).toBeFocused();
    await expect(email).toHaveCSS("outline-style", "solid");
    await expect(email).toHaveCSS("outline-width", "3px");

    const accessibility = await email.evaluate((element) => {
      const style = getComputedStyle(element);
      const colorProbe = document.createElement("span");
      colorProbe.style.color = "Highlight";
      colorProbe.style.forcedColorAdjust = "none";
      document.body.append(colorProbe);
      const systemHighlight = getComputedStyle(colorProbe).color;
      colorProbe.remove();
      return {
        outline: style.outlineColor,
        systemHighlight,
        transition: style.transitionDuration.split(",").map((value) => parseFloat(value)),
      };
    });
    expect(accessibility.outline).toBe(accessibility.systemHighlight);
    expect(accessibility.transition.every((duration) => duration <= 0.00001)).toBe(true);

    for (const control of await page.locator('input:not([type="hidden"]), button, nav a').all()) {
      const bounds = await control.boundingBox();
      expect(bounds?.height).toBeGreaterThanOrEqual(44);
      expect(bounds?.width).toBeGreaterThanOrEqual(44);
    }
    const dimensions = await page.evaluate(() => ({
      viewport: document.documentElement.clientWidth,
      content: document.documentElement.scrollWidth,
    }));
    expect(dimensions.content).toBeLessThanOrEqual(dimensions.viewport);
  });
}
