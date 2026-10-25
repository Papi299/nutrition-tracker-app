import { defineConfig } from "@playwright/test";

// Database checkpoints run before application integration and do not need a
// browser or a built Next.js application. The existing local runner supplies
// loopback-only service endpoints and disposable authenticated fixtures.
export default defineConfig({
  testDir: "./e2e",
  testMatch: "nutrition-snapshot-database.spec.ts",
  workers: 1,
  retries: 0,
});
