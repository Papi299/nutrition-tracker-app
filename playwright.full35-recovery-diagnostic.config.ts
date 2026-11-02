import { defineConfig } from "@playwright/test";
import { tmpdir } from "node:os";
import { join } from "node:path";

export default defineConfig({
  testDir: "./e2e",
  testMatch: "foundation-full35-recovery-identity.db.ts",
  workers: 1,
  retries: 0,
  timeout: 660_000,
  outputDir: process.env.FULL35_TEST_OUTPUT_DIR ?? join(tmpdir(), "full35-recovery-diagnostic-results"),
});
