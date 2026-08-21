import { defineConfig, devices } from "@playwright/test";

const port = process.env.PLAYWRIGHT_PORT ?? "3100";
const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? `http://127.0.0.1:${port}`;

export default defineConfig({
  testDir: "./e2e",
  testMatch: "phase-11d-ui.spec.ts",
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  use: {
    baseURL,
    trace: "on-first-retry",
  },
  webServer: {
    command: `npm run start -- -p ${port} -H 127.0.0.1`,
    reuseExistingServer: !process.env.CI,
    url: baseURL,
  },
  projects: [
    {
      name: "engine-chromium",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { height: 900, width: 1280 },
      },
    },
    {
      name: "engine-firefox",
      use: {
        ...devices["Desktop Firefox"],
        viewport: { height: 900, width: 1280 },
      },
    },
    {
      name: "engine-webkit",
      use: {
        ...devices["Desktop Safari"],
        viewport: { height: 900, width: 1280 },
      },
    },
    {
      name: "mobile-chromium-390",
      use: {
        ...devices["Desktop Chrome"],
        deviceScaleFactor: 2,
        hasTouch: true,
        isMobile: true,
        viewport: { height: 844, width: 390 },
      },
    },
  ],
});
