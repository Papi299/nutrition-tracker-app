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
