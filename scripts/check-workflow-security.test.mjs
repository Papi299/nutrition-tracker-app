import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const ci = readFileSync(join(root, ".github/workflows/ci.yml"), "utf8");
const backup = readFileSync(join(root, ".github/workflows/phase-11i-production-backup.yml"), "utf8");
const checker = join(root, "scripts/check-workflow-security.mjs");

function command(cwd, executable, args, env = {}) {
  const result = spawnSync(executable, args, {
    cwd,
    encoding: "utf8",
    env: { ...process.env, ...env },
  });
  assert.ifError(result.error);
  return result;
}

function policyResult(ciWorkflow) {
  const directory = mkdtempSync(join(tmpdir(), "ci-workflow-policy-"));
  try {
    const workflowDirectory = join(directory, ".github/workflows");
    mkdirSync(workflowDirectory, { recursive: true });
    writeFileSync(join(workflowDirectory, "ci.yml"), ciWorkflow);
    writeFileSync(join(workflowDirectory, "phase-11i-production-backup.yml"), backup);
    return command(directory, process.execPath, [checker]);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

function stepScript(name) {
  const start = ci.indexOf(`      - name: ${name}\n`);
  assert.notEqual(start, -1);
  const next = ci.indexOf("      - name: ", start + 1);
  const body = ci.slice(start, next === -1 ? ci.length : next);
  const run = body.indexOf("        run: |\n");
  assert.notEqual(run, -1);
  return body.slice(run + "        run: |\n".length)
    .split("\n")
    .filter((line) => line.startsWith("          "))
    .map((line) => line.slice(10))
    .join("\n");
}

test("CI workflow security policy accepts the reviewed dispatch contract", () => {
  assert.equal(policyResult(ci).status, 0);
});

test("CI workflow security policy rejects broadened triggers, permissions, and skipped gates", () => {
  const mutations = [
    ci.replace("  workflow_dispatch:\n", ""),
    ci.replace("  workflow_dispatch:\n", "  workflow_dispatch:\n  schedule:\n"),
    ci.replace('"refs/heads/main"', '"refs/heads/feature"'),
    ci.replace("    name: Validate\n", "    name: Validate\n    if: github.event_name != 'workflow_dispatch'\n"),
    ci.replace("      - name: Lint\n", "      - name: Lint\n        if: github.event_name != 'workflow_dispatch'\n"),
    ci.replace("      - name: Type check\n        run: npm run typecheck\n\n", ""),
    ci.replace("  contents: read\n", "  contents: write\n"),
    ci.replace('workflow_dispatch) base="$CI_HEAD_SHA^" ;;', 'workflow_dispatch) base="$CI_HEAD_SHA" ;;'),
    ci.replace('git diff --check "$base..$CI_HEAD_SHA"', 'echo "skipped"'),
  ];
  for (const mutation of mutations) {
    assert.notEqual(mutation, ci);
    assert.notEqual(policyResult(mutation).status, 0);
  }
});

test("manual dispatch guard accepts main and rejects another ref", () => {
  const directory = mkdtempSync(join(tmpdir(), "ci-dispatch-guard-"));
  try {
    const script = stepScript("Require main for manual dispatch");
    assert.equal(command(directory, "bash", ["-e", "-c", script], { GITHUB_REF: "refs/heads/main" }).status, 0);
    assert.notEqual(command(directory, "bash", ["-e", "-c", script], { GITHUB_REF: "refs/heads/feature" }).status, 0);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("hygiene uses PR, push, and dispatch bases and fails when a base is unavailable", () => {
  const directory = mkdtempSync(join(tmpdir(), "ci-hygiene-range-"));
  try {
    const git = (...args) => {
      const result = command(directory, "git", args);
      assert.equal(result.status, 0, result.stderr);
      return result.stdout.trim();
    };
    git("init", "-q");
    git("config", "user.name", "CI Test");
    git("config", "user.email", "ci-test@example.invalid");
    writeFileSync(join(directory, "sample.txt"), "clean\n");
    git("add", "sample.txt");
    git("commit", "-qm", "first");
    const first = git("rev-parse", "HEAD");
    writeFileSync(join(directory, "sample.txt"), "clean\nsecond\n");
    git("commit", "-qam", "second");
    const second = git("rev-parse", "HEAD");
    const script = stepScript("Check repository hygiene");
    const run = (event, head, prBase, pushBefore) =>
      command(directory, "bash", ["-e", "-c", script], {
        CI_EVENT_NAME: event,
        CI_HEAD_SHA: head,
        CI_PR_BASE_SHA: prBase,
        CI_PUSH_BEFORE_SHA: pushBefore,
      });

    assert.equal(run("pull_request", second, first, "invalid").status, 0);
    assert.equal(run("push", second, "invalid", first).status, 0);
    assert.equal(run("workflow_dispatch", second, "invalid", "invalid").status, 0);
    assert.notEqual(run("pull_request", second, "", first).status, 0);
    assert.notEqual(run("push", second, first, "").status, 0);
    assert.notEqual(run("workflow_dispatch", first, first, first).status, 0);
    assert.notEqual(run("schedule", second, first, first).status, 0);

    writeFileSync(join(directory, "sample.txt"), "clean\nsecond\ntrailing space \n");
    git("commit", "-qam", "whitespace");
    const third = git("rev-parse", "HEAD");
    for (const event of ["pull_request", "push", "workflow_dispatch"]) {
      assert.notEqual(run(event, third, second, second).status, 0);
    }
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
