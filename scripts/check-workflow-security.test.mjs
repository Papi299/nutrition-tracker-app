import "./configure-ci-apt.test.mjs";
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

function policyResult(ciWorkflow, localWorkflow = readFileSync(join(root, ".github/workflows/nutrition-002c-local.yml"), "utf8"), fidelityWorkflow = readFileSync(join(root, ".github/workflows/nutrition-002c1-local.yml"), "utf8"), historicalWorkflow = readFileSync(join(root, ".github/workflows/nutrition-002c1a-local.yml"), "utf8"), ddlWorkflow = readFileSync(join(root, ".github/workflows/nutrition-002c1b-local.yml"), "utf8")) {
  const directory = mkdtempSync(join(tmpdir(), "ci-workflow-policy-"));
  try {
    const workflowDirectory = join(directory, ".github/workflows");
    mkdirSync(workflowDirectory, { recursive: true });
    writeFileSync(join(workflowDirectory, "ci.yml"), ciWorkflow);
    writeFileSync(join(workflowDirectory, "phase-11i-production-backup.yml"), backup);
    writeFileSync(join(workflowDirectory, "nutrition-002c-local.yml"), localWorkflow);
    writeFileSync(join(workflowDirectory, "nutrition-002c1-local.yml"), fidelityWorkflow);
    writeFileSync(join(workflowDirectory, "nutrition-002c1a-local.yml"), historicalWorkflow);
    writeFileSync(join(workflowDirectory, "nutrition-002c1b-local.yml"), ddlWorkflow);
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

test("stacked local qualification cannot broaden triggers, source or authority", () => {
  const local = readFileSync(join(root, ".github/workflows/nutrition-002c-local.yml"), "utf8");
  for (const mutation of [
    local.replace("branches: [codex/nutrition-002a-recovery]", "branches: [main]"),
    local.replace("contents: read", "contents: write"),
    local.replace("ref: ${{ github.event.pull_request.head.sha }}", "ref: main"),
    local.replace("persist-credentials: false", "persist-credentials: true"),
  ]) assert.notEqual(policyResult(ci, mutation).status, 0);
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
    ci.replace("    timeout-minutes: 40\n", "    timeout-minutes: 30\n"),
    ci.replace("    timeout-minutes: 40\n", "    timeout-minutes: 41\n"),
    ci.replace("scripts/configure-ci-apt.mjs", "scripts/unreviewed-apt.mjs"),
    ci.replace("runs-on: ubuntu-26.04", "runs-on: ubuntu-latest"),
    ci.replace("    timeout-minutes: 20\n    steps:", "    timeout-minutes: 40\n    steps:"),
    ci.replace("npx playwright install --with-deps chromium firefox webkit", "npx playwright install chromium"),
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


test("002C1 exact-head security cannot gain dispatch, hosted authority or code-scanning uploads", () => {
  const workflow = readFileSync(join(root, ".github/workflows/nutrition-002c1-local.yml"), "utf8");
  const local = readFileSync(join(root, ".github/workflows/nutrition-002c-local.yml"), "utf8");
  for (const mutation of [
    workflow.replace("branches: [codex/nutrition-002c-hybrid]", "branches: [main]"),
    workflow.replace("  pull_request:", "  workflow_dispatch:\n  pull_request:"),
    workflow.replace("contents: read", "contents: write"),
    workflow.replaceAll("ref: ${{ github.event.pull_request.head.sha }}", "ref: main"),
    workflow.replace("persist-credentials: false", "persist-credentials: true"),
    workflow.replace("upload: never", "upload: always"),
    workflow.replace("9b3254085494b55a0f7c4c2b3d2d52cc712ce370", "v4"),
  ]) assert.notEqual(policyResult(ci, local, mutation).status, 0);
});


test("002C1A historical workflow is exact-head, read-only and has no dispatch", () => {
  const file = name => readFileSync(join(root, ".github/workflows/" + name), "utf8");
  const workflow=file("nutrition-002c1a-local.yml");
  for(const mutation of [
    workflow.replace("branches: [codex/nutrition-002c1-fidelity]", "branches: [main]"),
    workflow.replace("  pull_request:", "  workflow_dispatch:\n  pull_request:"),
    workflow.replace("contents: read", "contents: write"),
    workflow.replaceAll("ref: ${{ github.event.pull_request.head.sha }}", "ref: main"),
    workflow.replace("persist-credentials: false", "persist-credentials: true"),
    workflow.replace("upload: never", "upload: always"),
    workflow.replace("9b3254085494b55a0f7c4c2b3d2d52cc712ce370", "v4"),
  ]) assert.notEqual(policyResult(ci,file("nutrition-002c-local.yml"),file("nutrition-002c1-local.yml"),mutation).status,0);
});


test("002C1B DDL workflow rejects widened authority and nonexact source", () => {
  const file = name => readFileSync(join(root, ".github/workflows/" + name), "utf8");
  const workflow=file("nutrition-002c1b-local.yml");
  for(const mutation of [
    workflow.replace("branches: [codex/nutrition-002c1a-snapshot-catalog]", "branches: [main]"),
    workflow.replace("  pull_request:", "  workflow_dispatch:\n  pull_request:"),
    workflow.replace("contents: read", "contents: write"),
    workflow.replaceAll("ref: ${{ github.event.pull_request.head.sha }}", "ref: main"),
    workflow.replace("persist-credentials: false", "persist-credentials: true"),
    workflow.replace("upload: never", "upload: always"),
    workflow.replace("9b3254085494b55a0f7c4c2b3d2d52cc712ce370", "v4"),
    workflow.replace("sha256:28f0e16a019e648089fc1a6d333549a55548f6019c15ae4bd7cd58b989027518", "latest"),
  ]) assert.notEqual(policyResult(ci,file("nutrition-002c-local.yml"),file("nutrition-002c1-local.yml"),file("nutrition-002c1a-local.yml"),mutation).status,0);
});
