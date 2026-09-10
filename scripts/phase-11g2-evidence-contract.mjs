import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

export const PHASE11G2_SOURCE_PATHS = Object.freeze([
  "scripts/run-phase-11g2-playwright-qualification.mjs",
  "scripts/phase-11g2-playwright-operations.mjs",
  "scripts/phase-11g2-evidence-preservation.mjs",
  "scripts/phase-11g2-evidence-contract.mjs",
  "scripts/phase-11g2-git-provenance.mjs",
  "lib/performance/qualification.ts",
  "app/[locale]/(app)/foods/page.tsx",
  "performance/fixture-manifest.json",
  "performance/fixture.sql",
]);

export const NORMATIVE_MEASUREMENT_BOUNDARY =
  "The outer normative duration starts immediately before the triggering Playwright user action and ends at the later of deterministic stable-UI satisfaction and completion of the matching correlated application response; both must complete within the same 10,000 ms deadline.";

export const NORMATIVE_TIMER_START =
  "immediately before the triggering Playwright user action";

export const NORMATIVE_TIMER_END =
  "at the later of deterministic stable-UI satisfaction and completion of the matching correlated application response; both within the same 10,000 ms deadline";

export const SERVER_TIMING_DIAGNOSTIC_BOUNDARY =
  "Diagnostic only: the correlated server interval runs from proxy request receipt through the complete Next response body; Server-Timing records response-start latency for that request and does not replace or shorten the outer normative duration.";

export function phase11g2SourceIdentitySha256() {
  const hasher = createHash("sha256");
  for (const sourcePath of PHASE11G2_SOURCE_PATHS) {
    hasher.update(sourcePath);
    hasher.update("\0");
    hasher.update(readFileSync(sourcePath));
    hasher.update("\0");
  }
  return hasher.digest("hex");
}
