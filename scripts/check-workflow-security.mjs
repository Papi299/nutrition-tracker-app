import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const workflowDirectory = ".github/workflows";
const reviewedPins = new Map([
  ["actions/checkout", "3d3c42e5aac5ba805825da76410c181273ba90b1"],
  ["actions/setup-node", "820762786026740c76f36085b0efc47a31fe5020"],
  ["actions/upload-artifact", "043fb46d1a93c77aae656e7c1c64a875d1fc6a0a"],
]);
const workflowExpectations = new Map([
  [
    "ci.yml",
    {
      timeout: 30,
      node: 22,
      actions: new Map([
        ["actions/checkout", 1],
        ["actions/setup-node", 1],
        ["actions/upload-artifact", 2],
      ]),
    },
  ],
  [
    "phase-11i-production-backup.yml",
    {
      timeout: 20,
      node: 22,
      actions: new Map([
        ["actions/checkout", 1],
        ["actions/setup-node", 1],
        ["actions/upload-artifact", 1],
      ]),
    },
  ],
]);
const ciSteps = [
  "Check out repository",
  "Require main for manual dispatch",
  "Set up Node.js",
  "Install dependencies from lockfile",
  "Verify workflow supply-chain policy",
  "Enforce production dependency advisory policy",
  "Check repository hygiene",
  "Lint",
  "Type check",
  "Verify Phase 11H deployment and environment contract",
  "Verify Phase 11I recovery safety contract",
  "Verify security policy regressions",
  "Verify Phase 11 critical-journey evidence map",
  "Verify Phase 11G2 performance harness and evidence",
  "Run pure unit tests",
  "Build production application and verify client secret boundary",
  "Install Playwright Phase 11D engines",
  "Start local Supabase",
  "Verify hosted migration-role compatibility",
  "Replay migrations and seed locally",
  "Verify internal ingestion types",
  "Run local-only Playwright suite",
  "Run Phase 11D engine, viewport, and accessibility suite",
  "Verify Phase 11D evidence files",
  "Upload Phase 11D evidence",
  "Upload Playwright failure artifacts",
  "Stop local Supabase",
];

function checkCiDispatchContract(workflow) {
  const triggerSection = workflow.match(/^on:\n([\s\S]*?)^permissions:/m)?.[1];
  if (
    triggerSection !==
    "  pull_request:\n    branches: [main]\n  push:\n    branches: [main]\n  workflow_dispatch:\n\n"
  ) {
    fail("ci.yml must retain only main PR, main push, and manual dispatch triggers");
  }
  if (
    !workflow.includes(
      "concurrency:\n  group: ci-${{ github.workflow }}-${{ github.ref }}\n  cancel-in-progress: true",
    )
  ) {
    fail("ci.yml must retain the shared main concurrency boundary");
  }
  const jobHeader = workflow.match(/^jobs:\n  validate:\n([\s\S]*?)^    steps:/m)?.[1];
  if (
    jobHeader !== "    name: Validate\n    runs-on: ubuntu-latest\n    timeout-minutes: 30\n\n" ||
    (workflow.slice(workflow.indexOf("jobs:\n")).match(/^  [a-z][\w-]*:$/gm) ?? [])
      .map((line) => line.trim()).join() !== "validate:"
  ) {
    fail("ci.yml must retain one unconditional Validate job");
  }

  const matches = [...workflow.matchAll(/^      - name: (.+)$/gm)];
  const names = matches.map((match) => match[1]);
  if (JSON.stringify(names) !== JSON.stringify(ciSteps)) {
    fail("ci.yml must retain every reviewed Validate step in order");
  }
  const steps = new Map(
    matches.map((match, index) => [
      match[1],
      workflow.slice(match.index, matches[index + 1]?.index ?? workflow.length),
    ]),
  );
  const guard = steps.get("Require main for manual dispatch");
  if (
    !guard.includes("if: ${{ github.event_name == 'workflow_dispatch' }}") ||
    !guard.includes('if [ "$GITHUB_REF" != "refs/heads/main" ]; then') ||
    !guard.includes("exit 1")
  ) {
    fail("ci.yml manual dispatch must fail early outside refs/heads/main");
  }
  const checkout = steps.get("Check out repository");
  if (/^\s+ref:/m.test(checkout)) {
    fail("ci.yml checkout must use GitHub's workflow context SHA");
  }

  const hygiene = steps.get("Check repository hygiene");
  const hygieneLines = [
    "CI_EVENT_NAME: ${{ github.event_name }}",
    "CI_PR_BASE_SHA: ${{ github.event.pull_request.base.sha }}",
    "CI_PUSH_BEFORE_SHA: ${{ github.event.before }}",
    "CI_HEAD_SHA: ${{ github.sha }}",
    'pull_request) base="$CI_PR_BASE_SHA" ;;',
    'push) base="$CI_PUSH_BEFORE_SHA" ;;',
    'workflow_dispatch) base="$CI_HEAD_SHA^" ;;',
    '[ -z "$base" ] || ! git rev-parse --verify --quiet "${base}^{commit}"',
    'git diff --check "$base..$CI_HEAD_SHA"',
  ];
  if (hygieneLines.some((line) => !hygiene.includes(line))) {
    fail("ci.yml repository hygiene must use resolvable event-specific bases");
  }
  if (!steps.get("Start local Supabase").includes("id: supabase")) {
    fail("ci.yml must identify local Supabase startup for safe teardown");
  }

  const allowedConditions = new Map([
    ["Require main for manual dispatch", "if: ${{ github.event_name == 'workflow_dispatch' }}"],
    ["Verify Phase 11D evidence files", "if: ${{ always() && (steps.phase11d.outcome == 'success' || steps.phase11d.outcome == 'failure') }}"],
    ["Upload Phase 11D evidence", "if: ${{ always() && (steps.phase11d.outcome == 'success' || steps.phase11d.outcome == 'failure') }}"],
    ["Upload Playwright failure artifacts", "if: failure()"],
    ["Stop local Supabase", "if: ${{ always() && (steps.supabase.outcome == 'success' || steps.supabase.outcome == 'failure') }}"],
  ]);
  for (const [name, body] of steps) {
    const conditions = body.match(/^        if: .+$/gm) ?? [];
    const expected = allowedConditions.get(name);
    if (conditions.length !== (expected ? 1 : 0) || (expected && !conditions[0].includes(expected))) {
      fail(`ci.yml step ${name} has an unreviewed condition`);
    }
  }
}

function fail(message) {
  console.error(`Workflow security validation FAILED: ${message}`);
  process.exit(1);
}

const workflowFiles = readdirSync(workflowDirectory)
  .filter((name) => /\.ya?ml$/.test(name))
  .sort();
const expectedFiles = [...workflowExpectations.keys()].sort();
if (JSON.stringify(workflowFiles) !== JSON.stringify(expectedFiles)) {
  fail("workflow inventory contains an unreviewed or missing workflow");
}

for (const [workflowName, expectation] of workflowExpectations) {
  const workflow = readFileSync(join(workflowDirectory, workflowName), "utf8");
  const observedCounts = new Map();

  if (workflowName === "ci.yml") checkCiDispatchContract(workflow);

  if (!/^permissions:\n  contents: read$/m.test(workflow)) {
    fail(`${workflowName} top-level permissions must be exactly contents: read`);
  }
  if ((workflow.match(/^\s*permissions:/gm) ?? []).length !== 1) {
    fail(`${workflowName} must not add job- or step-level permission overrides`);
  }
  if (!new RegExp(`^    timeout-minutes: ${expectation.timeout}$`, "m").test(workflow)) {
    fail(`${workflowName} must retain its reviewed timeout`);
  }
  if (!new RegExp(`^          node-version: ${expectation.node}$`, "m").test(workflow)) {
    fail(`${workflowName} must retain Node.js ${expectation.node}`);
  }

  for (const [index, line] of workflow.split("\n").entries()) {
    if (!/^\s*uses:/.test(line)) continue;
    const match = line.match(
      /^\s*uses:\s*([^@\s]+)@([0-9a-f]{40})\s+#\s+(v\d+(?:\.\d+(?:\.\d+)?)?)\s*$/,
    );
    if (!match) {
      fail(`${workflowName} line ${index + 1} must use a full commit SHA and version comment`);
    }

    const [, action, sha, version] = match;
    const reviewed = reviewedPins.get(action);
    if (!reviewed) fail(`${workflowName} line ${index + 1} uses unreviewed action ${action}`);
    if (sha !== reviewed) {
      fail(`${workflowName} line ${index + 1} does not use the reviewed ${action} commit`);
    }
    if (version !== "v7") {
      fail(`${workflowName} line ${index + 1} must retain the reviewed v7 generation`);
    }
    observedCounts.set(action, (observedCounts.get(action) ?? 0) + 1);
  }

  for (const [action, expected] of expectation.actions) {
    if (observedCounts.get(action) !== expected) {
      fail(`${workflowName} must use ${action} exactly ${expected} time(s)`);
    }
  }
  for (const action of observedCounts.keys()) {
    if (!expectation.actions.has(action)) {
      fail(`${workflowName} contains unexpected action ${action}`);
    }
  }
}

console.log(
  "Workflow security validation PASSED: workflow inventory, least privilege, and reviewed immutable Action pins are exact.",
);
