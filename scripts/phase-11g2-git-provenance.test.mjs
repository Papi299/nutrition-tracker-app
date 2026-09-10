import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { readGitProvenance } from "./phase-11g2-git-provenance.mjs";

function git(cwd, args) {
  return execFileSync("git", args, { cwd, encoding: "utf8" }).trim();
}

test("derives HEAD and its complete tree and distinguishes tracked dirt from untracked output", () => {
  const directory = mkdtempSync(path.join(tmpdir(), "phase11g2-git-provenance-"));
  try {
    git(directory, ["init", "--quiet"]);
    git(directory, ["config", "user.email", "phase11g2@example.test"]);
    git(directory, ["config", "user.name", "Phase 11G2 Test"]);
    writeFileSync(path.join(directory, "tracked.txt"), "original\n");
    git(directory, ["add", "tracked.txt"]);
    git(directory, ["commit", "--quiet", "-m", "test fixture"]);

    const clean = readGitProvenance({
      cwd: directory,
      requireTrackedWorktreeClean: true,
    });
    assert.equal(clean.commitSha, git(directory, ["rev-parse", "HEAD"]));
    assert.equal(clean.treeSha, git(directory, ["rev-parse", "HEAD^{tree}"]));
    assert.equal(clean.trackedWorktreeCleanAtStart, true);

    writeFileSync(path.join(directory, "untracked.txt"), "ignored by tracked guard\n");
    assert.equal(
      readGitProvenance({ cwd: directory }).trackedWorktreeCleanAtStart,
      true,
    );

    writeFileSync(path.join(directory, "tracked.txt"), "dirty\n");
    assert.equal(
      readGitProvenance({ cwd: directory }).trackedWorktreeCleanAtStart,
      false,
    );
    assert.throws(
      () =>
        readGitProvenance({
          cwd: directory,
          requireTrackedWorktreeClean: true,
        }),
      /clean tracked worktree/,
    );
  } finally {
    rmSync(directory, { force: true, recursive: true });
  }
});
