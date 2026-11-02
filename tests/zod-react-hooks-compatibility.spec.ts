import { test, expect } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

test("patched Zod preserves React Hooks diagnostics and compiler configuration validation", () => {
  const baseline = JSON.parse(readFileSync(resolve(
    "docs/evidence/nutrition-dependabot-zod-security-001/react-hooks-baseline.json",
  ), "utf8"));
  const result = JSON.parse(execFileSync(process.execPath, [
    "scripts/check-zod-react-hooks-compatibility.mjs",
  ], { encoding: "utf8", timeout: 30_000 }));

  expect(result.result).toBe("PASS");
  expect(result.zod).toBe("4.6.7");
  expect(result.hooks).toBe(baseline.hooks);
  expect(result.configuredRules).toEqual(baseline.configuredRules);
  expect(result.cases).toEqual(baseline.cases);
  for (const count of Object.values(result.exercisedFunctions)) {
    expect(count).toBeGreaterThan(0);
  }
  expect(result.zodErrorFormatterCalls).toBeGreaterThan(0);
});
