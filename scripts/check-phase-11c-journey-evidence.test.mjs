import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { validateEvidence } from "./check-phase-11c-journey-evidence.mjs";

const rootDir = process.cwd();
const [contract, rawEvidence] = await Promise.all([
  readFile(
    path.join(rootDir, "docs/phase-11b-launch-contract-and-acceptance-baseline.md"),
    "utf8",
  ),
  readFile(
    path.join(rootDir, "docs/phase-11c-critical-journey-evidence.json"),
    "utf8",
  ),
]);
const baselineEvidence = JSON.parse(rawEvidence);

function evidenceFixture() {
  return structuredClone(baselineEvidence);
}

function validate(evidence, acceptedContract = contract) {
  return validateEvidence({ evidence, contract: acceptedContract, rootDir });
}

test("rejects Section 7.1 substantive-cell drift while IDs and names remain unchanged", async () => {
  const changed = contract.replace(
    "Valid credentials establish session and safe redirect.",
    "Valid credentials establish a changed session contract.",
  );
  await assert.rejects(validate(evidenceFixture(), changed), /fingerprints|normativeContract/);
});

test("rejects Section 7.2 controlling implementation-slice drift", async () => {
  const changed = contract.replace(
    "| 11C/11E | 11J | 11K | Sign-in action; redirects |",
    "| 11G | 11J | 11K | Sign-in action; redirects |",
  );
  await assert.rejects(validate(evidenceFixture(), changed), /fingerprints|normativeContract/);
});

test("rejects Section 7.2 final-gate drift", async () => {
  const changed = contract.replace(
    "| 11C/11E | 11J | 11K | Sign-in action; redirects |",
    "| 11C/11E | 11J | 11I | Sign-in action; redirects |",
  );
  await assert.rejects(validate(evidenceFixture(), changed), /fingerprints|normativeContract/);
});

test("rejects Section 7.3 no-JavaScript drift", async () => {
  const changed = contract.replace(
    "| `CJ-005` | `REQUIRED` | Sign-out is a server-action form",
    "| `CJ-005` | `NOT_VERIFIED` | Sign-out is a server-action form",
  );
  await assert.rejects(validate(evidenceFixture(), changed), /classifications differ|fingerprints/);
});

test("rejects an unsupported manual evidence status", async () => {
  const evidence = evidenceFixture();
  evidence.journeys[0].manualEvidence[0].status = "COLLECTED_PASS";
  await assert.rejects(validate(evidence), /unsupported manual evidence status/);
});

test("rejects fake manual collection without evidence metadata", async () => {
  const evidence = evidenceFixture();
  const manual = evidence.journeys[0].manualEvidence[0];
  delete manual.sessions;
  delete manual.evidencePath;
  delete manual.executor;
  delete manual.executedAt;
  await assert.rejects(validate(evidence), /requires sessions/);
});

test("rejects an invalid exploratory session", async () => {
  const evidence = evidenceFixture();
  evidence.journeys[0].manualEvidence[0].sessions = ["M7"];
  await assert.rejects(validate(evidence), /invalid session/);
});

test("rejects a missing manual evidence path", async () => {
  const evidence = evidenceFixture();
  delete evidence.journeys[0].manualEvidence[0].evidencePath;
  await assert.rejects(validate(evidence), /manual evidence path must be a nonempty string/);
});

test("rejects later-slice manual evidence falsely marked collected", async () => {
  const evidence = evidenceFixture();
  evidence.journeys[1].manualEvidence[0] = structuredClone(
    evidence.journeys[0].manualEvidence[0],
  );
  await assert.rejects(validate(evidence), /later-slice manual evidence must remain/);
});

test("rejects external evidence falsely marked collected", async () => {
  const evidence = evidenceFixture();
  evidence.journeys[0].externalEvidence[0].status =
    "COLLECTED_PENDING_INDEPENDENT_REVIEW";
  await assert.rejects(validate(evidence), /falsely represents external evidence as collected/);
});

test("rejects automated evidence count or attribution drift", async () => {
  const evidence = evidenceFixture();
  evidence.journeys[0].automatedEvidence.shift();
  await assert.rejects(validate(evidence), /automated evidence totals must remain/);
});

test("rejects automated evidence claiming an axis marked LATER_SLICE", async () => {
  const evidence = evidenceFixture();
  evidence.journeys[0].locale = { status: "LATER_SLICE", slice: "11D" };
  await assert.rejects(validate(evidence), /claims locale while its status is LATER_SLICE/);
});

test("rejects automated evidence claiming an axis marked EXTERNAL_REQUIRED", async () => {
  const evidence = evidenceFixture();
  evidence.journeys[0].locale = { status: "EXTERNAL_REQUIRED" };
  await assert.rejects(
    validate(evidence),
    /claims locale while its status is EXTERNAL_REQUIRED/,
  );
});

test("rejects an automated axis with no linked evidence", async () => {
  const evidence = evidenceFixture();
  evidence.journeys[0].automatedEvidence = evidence.journeys[0].automatedEvidence.map(
    (reference) => ({
      ...reference,
      evidenceAxes: reference.evidenceAxes.filter((axis) => axis !== "locale"),
    }),
  );
  await assert.rejects(validate(evidence), /claims automation without a linked test/);
});

test("rejects a missing evidence path", async () => {
  const evidence = evidenceFixture();
  evidence.journeys[0].automatedEvidence[0].path = "e2e/does-not-exist.spec.ts";
  await assert.rejects(validate(evidence), /automated evidence path does not exist/);
});

test("rejects a mistyped exact test title", async () => {
  const evidence = evidenceFixture();
  evidence.journeys[0].automatedEvidence[0].testTitle = "nonexistent exact title";
  await assert.rejects(validate(evidence), /test title is absent/);
});

test("rejects an omitted journey", async () => {
  const evidence = evidenceFixture();
  evidence.journeys.pop();
  await assert.rejects(validate(evidence), /expected 35 journeys/);
});

test("rejects a duplicated journey", async () => {
  const evidence = evidenceFixture();
  evidence.journeys[1] = structuredClone(evidence.journeys[0]);
  await assert.rejects(validate(evidence), /journey IDs contain a duplicate/);
});

test("rejects an out-of-order journey", async () => {
  const evidence = evidenceFixture();
  [evidence.journeys[0], evidence.journeys[1]] = [
    evidence.journeys[1],
    evidence.journeys[0],
  ];
  await assert.rejects(validate(evidence), /journey ordering must be exactly/);
});
