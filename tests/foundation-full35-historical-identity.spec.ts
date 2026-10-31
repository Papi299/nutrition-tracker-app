import { execFileSync } from "node:child_process";
import { expect, test } from "@playwright/test";

test("historical identity comparator refuses substitutions, stale heads and ambiguous links on synthetic metadata", () => {
  const result = execFileSync("python3", ["scripts/nutrition-usda-full35-historical-identity-001/test_identity.py"], { encoding:"utf8", stdio:"pipe" });
  expect(result).toBe("");
});
