import { readFileSync } from "node:fs";

const workflowPath = ".github/workflows/ci.yml";
const workflow = readFileSync(workflowPath, "utf8");
const reviewedPins = new Map([
  ["actions/checkout", "3d3c42e5aac5ba805825da76410c181273ba90b1"],
  ["actions/setup-node", "820762786026740c76f36085b0efc47a31fe5020"],
  ["actions/upload-artifact", "043fb46d1a93c77aae656e7c1c64a875d1fc6a0a"],
]);
const expectedCounts = new Map([
  ["actions/checkout", 1],
  ["actions/setup-node", 1],
  ["actions/upload-artifact", 2],
]);
const observedCounts = new Map();

function fail(message) {
  console.error(`Workflow security validation FAILED: ${message}`);
  process.exit(1);
}

if (!/^permissions:\n  contents: read$/m.test(workflow)) {
  fail("top-level permissions must be exactly contents: read");
}

if ((workflow.match(/^\s*permissions:/gm) ?? []).length !== 1) {
  fail("the workflow must not add job- or step-level permission overrides");
}

if (!/^    timeout-minutes: 30$/m.test(workflow)) {
  fail("the Validate job must retain its 30-minute timeout");
}

if (!/^          node-version: 22$/m.test(workflow)) {
  fail("the CI runtime must remain Node.js 22");
}

for (const [index, line] of workflow.split("\n").entries()) {
  if (!/^\s*uses:/.test(line)) continue;

  const match = line.match(
    /^\s*uses:\s*([^@\s]+)@([0-9a-f]{40})\s+#\s+(v\d+(?:\.\d+(?:\.\d+)?)?)\s*$/,
  );

  if (!match) {
    fail(`line ${index + 1} must use a full commit SHA and version comment`);
  }

  const [, action, sha, version] = match;
  const reviewed = reviewedPins.get(action);

  if (!reviewed) fail(`line ${index + 1} uses unreviewed action ${action}`);
  if (sha !== reviewed) fail(`line ${index + 1} does not use the reviewed ${action} commit`);
  if (version !== "v7") fail(`line ${index + 1} must retain the reviewed v7 generation`);

  observedCounts.set(action, (observedCounts.get(action) ?? 0) + 1);
}

for (const [action, expected] of expectedCounts) {
  if (observedCounts.get(action) !== expected) {
    fail(`${action} must appear exactly ${expected} time(s)`);
  }
}

console.log("Workflow security validation PASSED: least privilege and reviewed immutable Action pins are exact.");
