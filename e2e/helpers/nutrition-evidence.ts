import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { Page } from "@playwright/test";

export async function captureNutritionEvidence(page: Page, name: string, fixture: string) {
  const directory = process.env.NUTRITION_EVIDENCE_DIR;
  if (!directory) return;
  const origin = new URL(page.url()).hostname;
  if (!["127.0.0.1", "localhost"].includes(origin)) throw new Error("Nutrition evidence requires the local application.");
  mkdirSync(directory, { recursive: true });
  await page.evaluate(() => document.fonts.ready);
  await page.evaluate(() => window.scrollTo(0, 0));
  const bytes = await page.screenshot({ path: join(directory, `${name}.png`), animations: "disabled", fullPage: false });
  const paths = ["app/[locale]/(app)/today/page.tsx", "app/globals.css", "components/diary/diary-entry-list-item.tsx",
    "components/diary/nutrition-daily-summary.tsx", "components/nutrition/additional-nutrient-details.tsx",
    "lib/nutrition-snapshots/presentation.ts", "lib/nutrition-snapshots/manifest.ts", "messages/en.json", "messages/he.json"];
  writeFileSync(join(directory, `${name}.json`), JSON.stringify({
    task: "NUTRITION-DIARY-CORRECTNESS-001A", capturedAt: new Date().toISOString(),
    sourceHead: execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(),
    sourceState: "Candidate working tree; exact rendered file hashes below",
    renderedFiles: paths.map(path => ({ path, sha256: createHash("sha256").update(readFileSync(path)).digest("hex") })),
    route: new URL(page.url()).pathname + new URL(page.url()).search,
    viewport: page.viewportSize(), browser: "Chromium", browserVersion: page.context().browser()!.version(),
    fixture: { synthetic: true, localOnly: true, provisioner: "provisionActivatedLocalUser", description: fixture },
    sha256: createHash("sha256").update(bytes).digest("hex"),
  }, null, 2) + "\n");
}
