import "./configure-ci-apt.test.mjs";
import "./full35-integration-source.test.mjs";
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
    writeFileSync(join(workflowDirectory, "nutrition-002g-local.yml"), readFileSync(join(root, ".github/workflows/nutrition-002g-local.yml")));
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
    ci.replace("  atomic_diary:","  atomic_diary_renamed:"),
    ci.replace("order: [writer-first, diary-first]","order: [writer-first]"),
    ci.replace("npm run test:atomic-diary-recovery-local","echo skipped"),
    ci.replace("npm run test:atomic-diary-local","npm run test:atomic-diary-local || true"),
    ci.replace("    name: Atomic diary exact-history encrypted recovery\n","    name: Atomic diary exact-history encrypted recovery\n    if: false\n"),
    ci.replace("  full35_application:", "  other_application_job:"),
    ci.replace("    name: Full35 application qualification\n", "    name: Full35 application qualification\n    if: false\n"),
    ci.replace("node scripts/run-full35-app-local.mjs", "node scripts/run-full35-app-local.mjs || true"),
    ci.replace('test "$(git rev-parse HEAD)" = "$EXPECTED_HEAD"', 'echo skipped'),
    ci.replace("  actor_identity:", "  other_actor_job:"),
    ci.replace("    name: Full35 durable actor identity\n", "    name: Full35 durable actor identity\n    if: false\n"),
    ci.replace("    timeout-minutes: 25\n", "    timeout-minutes: 24\n"),
    ci.replace("    timeout-minutes: 25\n", "    timeout-minutes: 26\n"),
    ci.replace("npm run test:full35-durable-actor-local", "npm run test:full35-durable-actor-local || true"),
    ci.replace("npm run test:full35-durable-actor-local", "echo skipped"),
    ci.replace("  workflow_dispatch:\n", ""),
    ci.replace("  workflow_dispatch:\n", "  workflow_dispatch:\n  schedule:\n"),
    ci.replace('"refs/heads/main"', '"refs/heads/feature"'),
    ci.replace("    name: Validate\n", "    name: Validate\n    if: github.event_name != 'workflow_dispatch'\n"),
    ci.replace("      - name: Lint\n", "      - name: Lint\n        if: github.event_name != 'workflow_dispatch'\n"),
    ci.replace("      - name: Type check\n        run: npm run typecheck\n\n", ""),
    ci.replace("  contents: read\n", "  contents: write\n"),
    ci.replace("    timeout-minutes: 90\n", "    timeout-minutes: 89\n"),
    ci.replace("    timeout-minutes: 90\n", "    timeout-minutes: 91\n"),
    ci.replace("scripts/configure-ci-apt.mjs", "scripts/unreviewed-apt.mjs"),
    ci.replace("runs-on: ubuntu-26.04", "runs-on: ubuntu-latest"),
    ci.replace("    timeout-minutes: 20\n    steps:", "    timeout-minutes: 40\n    steps:"),
    ci.replace("npx playwright install --with-deps chromium firefox webkit", "npx playwright install chromium"),
    ci.replace('workflow_dispatch) base="$CI_HEAD_SHA^" ;;', 'workflow_dispatch) base="$CI_HEAD_SHA" ;;'),
    ci.replace('git diff --check "$base..$CI_HEAD_SHA"', 'echo "skipped"'),
    ...[44, 45, 46].map(count => ci.replace(new RegExp(`^.*phase11i-migration${count}\\.json.*\\n`, "m"), "")),
    ci.replace("--serving-reference", "--nutrition-snapshots"),
    ...["npm run test:full35-recovery-local", "node scripts/run-full35-exact-head-codeql.mjs"].flatMap(command => [ci.replace(command,"echo skipped"),ci.replace(command,command+" || true")]),
    ci.replace("    timeout-minutes: 50", "    timeout-minutes: 51"),
    ci.replace("  full35_recovery:\n", "  full35_recovery:\n    if: false\n"),
    ci.replace("language: [actions, javascript-typescript, python]", "language: [python]"),
    ci.replace("ref: ${{ github.event.pull_request.head.sha || github.sha }}", "ref: main"),
    ci.replace("branches: [main, codex/nutrition-usda-full35-reprojection-001, codex/nutrition-usda-full35-app-qual-001]", "branches: [main]"),
    ci.replace("branches: [main, codex/nutrition-usda-full35-reprojection-001, codex/nutrition-usda-full35-app-qual-001]", "branches: [main, arbitrary]"),
    ci.replace("      - name: Qualify isolated Full35 reprojection database\n        run: npm run test:full35-reprojection-local\n\n", ""),
    ci.replace("run: npm run test:full35-reprojection-local", "run: echo skipped"),
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
