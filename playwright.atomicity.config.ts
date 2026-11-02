import { defineConfig } from "@playwright/test";
import application from "./playwright.config";
export default defineConfig({ ...application, testMatch: ["full35-atomicity.app.ts"], use: { ...application.use, trace: "off" } });
