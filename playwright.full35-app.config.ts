import { defineConfig } from "@playwright/test";
import application from "./playwright.config";

// A separate fresh project keeps governed dataset fixtures independent of the
// general application's ingestion and catalog mutation acceptance tests.
export default defineConfig({
  ...application,
  testMatch: ["full35-app-qualification.spec.ts", "full35-governed.app.ts"],
});
