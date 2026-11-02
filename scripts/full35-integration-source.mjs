import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";

export const FULL35_INTEGRATION_SOURCE = Object.freeze({
  acceptedMain: "cd61608d1c8668cd27128b1ef2710becd2057283",
  acceptedStage4a: "86c419509ece24f309d7188e6de2d9e38d3d2f50",
  acceptedStage4aTree: "c0dab813688ff9005ccc3940641c7f88c91dedfa",
  bundlePath: "docs/evidence/nutrition-usda-full35-combined-integration-001/accepted-stage4a.bundle",
  bundleSha256: "fa07eeff31a40f4935c97b4809c8a877d09ff0d8a25032316b1a20239c8ab6f2",
  historicalSqlPath: "docs/evidence/nutrition-usda-full35-combined-integration-001/defective-migration47.sql.historical",
  historicalSqlSha256: "907f2b14e3baa485f1b9e92e6c3f601cc0f434945c48fbef9b0c823b781b1703",
});

// A squash preserves the reviewed tree, but discards feature ancestry. Import
// the exact accepted source from committed evidence with accepted main as its
// only prerequisite. No network, branch update or baseline forgiveness occurs.
export function resolveReviewedCodeqlBaseline(repositoryRoot = process.cwd(), bundlePath = join(repositoryRoot, FULL35_INTEGRATION_SOURCE.bundlePath)) {
  const pin = FULL35_INTEGRATION_SOURCE;
  const git = (...args) => execFileSync("git", args, { cwd: repositoryRoot, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
  const bundle = readFileSync(bundlePath);
  assert.equal(createHash("sha256").update(bundle).digest("hex"), pin.bundleSha256, "Exact accepted Stage4A source bundle required.");
  const header = bundle.subarray(0, bundle.indexOf("\n\n")).toString("utf8").split("\n");
  assert.equal(header[0], "# v2 git bundle");
  assert.equal(header.length, 3);
  assert.ok(header[1].startsWith(`-${pin.acceptedMain} `), "Only accepted main may be a bundle prerequisite.");
  assert.equal(header[2], `${pin.acceptedStage4a} refs/heads/full35-accepted-stage4a`);
  git("merge-base", "--is-ancestor", pin.acceptedMain, "HEAD");
  git("bundle", "verify", bundlePath);
  git("fetch", "--no-tags", "--no-write-fetch-head", bundlePath, "refs/heads/full35-accepted-stage4a");
  assert.equal(git("rev-parse", `${pin.acceptedStage4a}^{commit}`), pin.acceptedStage4a);
  assert.equal(git("rev-parse", `${pin.acceptedStage4a}^{tree}`), pin.acceptedStage4aTree, "Exact accepted CodeQL baseline tree required.");
  return { commit: pin.acceptedStage4a, tree: pin.acceptedStage4aTree, bundleSha256: pin.bundleSha256 };
}
