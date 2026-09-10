import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import {
  PHASE11G2_FINAL_NORMATIVE_EVIDENCE_TYPE,
  isAllowedPhase11g2PostMeasurementPath,
  readGitProvenance,
} from "./phase-11g2-git-provenance.mjs";

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

test("allows only the exact final normative package and status documents after measurement", () => {
  const allowedPaths = [
    "docs/decision-log.md",
    "docs/phase-11g2-performance-capacity-qualification.md",
    ...[
      "normative-browser-trace-map.json",
      "normative-performance-report.json",
      "normative-performance-samples.json",
      "operation-boundaries.json",
      "raw-evidence-manifest.json",
      "runtime-manifest.json",
    ].map((fileName) => `performance/evidence/normative/${fileName}`),
    ...["desktop", "mobile"].flatMap((profile) =>
      Array.from(
        { length: 10 },
        (_, index) =>
          `performance/evidence/normative/traces/trace_${profile}_ctx${String(index + 1).padStart(2, "0")}.zip`,
      ),
    ),
  ];
  for (const filePath of allowedPaths) {
    assert.equal(
      isAllowedPhase11g2PostMeasurementPath(
        filePath,
        PHASE11G2_FINAL_NORMATIVE_EVIDENCE_TYPE,
      ),
      true,
      filePath,
    );
  }

  for (const filePath of [
    "README.md",
    "app/page.tsx",
    "components/example.tsx",
    "lib/example.ts",
    "scripts/check-phase-11g2-normative-evidence.mjs",
    "supabase/migrations/20990101000000_forbidden.sql",
    "package.json",
    "performance/fixture.sql",
    "performance/evidence/normative/run.js",
    "performance/evidence/normative/traces/trace_desktop_ctx11.zip",
    "performance/evidence/normative/nested/normative-performance-report.json",
    "performance/evidence/correction-03/normative-performance-report.json",
    "performance/evidence/focused-normative/run.js",
    "performance/evidence/focused-normative/normative-performance-report.json",
    "performance/evidence/correction-03-resume/new-report.json",
    "performance/evidence/focused-normative/traces/trace_desktop_ctx11.zip",
  ]) {
    assert.equal(
      isAllowedPhase11g2PostMeasurementPath(
        filePath,
        PHASE11G2_FINAL_NORMATIVE_EVIDENCE_TYPE,
      ),
      false,
      filePath,
    );
  }

  for (const evidenceType of [
    undefined,
    "phase-11g2-focused-normative-diagnostic",
    "unknown",
  ]) {
    assert.equal(
      isAllowedPhase11g2PostMeasurementPath(
        "performance/evidence/normative/normative-performance-report.json",
        evidenceType,
      ),
      false,
      String(evidenceType),
    );
  }
});
