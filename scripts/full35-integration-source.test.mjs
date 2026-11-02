import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { FULL35_INTEGRATION_SOURCE as pin, resolveReviewedCodeqlBaseline } from "./full35-integration-source.mjs";

const repository = resolve(".");
const bundlePath = join(repository, pin.bundlePath);
const git = (cwd, args, options = {}) => execFileSync("git", args, { cwd, stdio: ["pipe", "pipe", "pipe"], ...options });
const text = (cwd, ...args) => git(cwd, args, { encoding: "utf8" }).trim();

test("accepted source survives a main-only squash with no feature objects or remote", () => {
  const isolated = mkdtempSync(join(tmpdir(), "full35-squash-source-"));
  try {
    git(isolated, ["init", "-q"]);
    // Bundle/fetch maintenance can outlive the assertions and race teardown.
    // Keep maintenance inside this disposable fixture synchronous/disabled;
    // every source, ancestry, hash and unchanged-ref assertion still executes.
    git(isolated, ["config", "gc.auto", "0"]);
    git(isolated, ["config", "maintenance.auto", "false"]);
    git(isolated, ["fetch", "--no-tags", repository, pin.acceptedMain]);
    const tree = text(repository, "rev-parse", "HEAD^{tree}");
    const pack = git(repository, ["pack-objects", "--stdout", "--revs"], { input: `${tree}\n^${pin.acceptedMain}^{tree}\n`, maxBuffer: 32 * 1024 * 1024 });
    git(isolated, ["index-pack", "--stdin"], { input: pack });
    const squash = git(isolated, ["-c", "user.name=Full35 Test", "-c", "user.email=full35-test@example.invalid", "commit-tree", tree, "-p", pin.acceptedMain], { input: "Disposable squash test\n", encoding: "utf8" }).trim();
    git(isolated, ["checkout", "--detach", squash]);
    assert.equal(text(isolated, "rev-list", "--parents", "-n", "1", "HEAD"), `${squash} ${pin.acceptedMain}`);
    assert.equal(text(isolated, "rev-parse", "HEAD^{tree}"), tree);
    assert.notEqual(spawnSync("git", ["cat-file", "-e", `${pin.acceptedStage4a}^{commit}`], { cwd: isolated }).status, 0);
    const originalRefs = text(isolated, "show-ref", "--head");
    const baseline = resolveReviewedCodeqlBaseline(isolated, bundlePath);
    assert.deepEqual(baseline, { commit: pin.acceptedStage4a, tree: pin.acceptedStage4aTree, bundleSha256: pin.bundleSha256 });
    assert.equal(text(isolated, "merge-base", "HEAD", baseline.commit), pin.acceptedMain);
    assert.equal(text(isolated, "show-ref", "--head"), originalRefs, "Evidence import must not update any ref.");
    assert.equal(text(isolated, "remote"), "", "No remote is required after main-only setup.");
    const sql = git(isolated, ["show", "2a5e8ea95dccfa59a0122fd9f84456eb72c77e9b:supabase/migrations/20261031104559_foundation_full35_mapping_reprojection_v1.sql"]);
    assert.deepEqual(sql, readFileSync(join(repository, pin.historicalSqlPath)));
    assert.equal(createHash("sha256").update(sql).digest("hex"), pin.historicalSqlSha256);
  } finally {
    rmSync(isolated, { recursive: true, force: true });
  }
});

test("modified baseline bundle fails before importing objects", () => {
  const directory = mkdtempSync(join(tmpdir(), "full35-tampered-source-"));
  try {
    const altered = readFileSync(bundlePath);
    altered[altered.length - 1] ^= 1;
    const path = join(directory, "altered.bundle");
    writeFileSync(path, altered);
    assert.throws(() => resolveReviewedCodeqlBaseline(directory, path), /Exact accepted Stage4A source bundle/);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("durable obsolete SQL stays exact and cannot match the corrected migration", () => {
  const digest = path => createHash("sha256").update(readFileSync(path)).digest("hex");
  assert.equal(digest(pin.historicalSqlPath), pin.historicalSqlSha256);
  assert.equal(digest("supabase/migrations/20261031104559_foundation_full35_mapping_reprojection_v1.sql"), "086f5c27a0270d6452db18b89e89c685c9ed5b677e0e841535d192c5408613af");
});
