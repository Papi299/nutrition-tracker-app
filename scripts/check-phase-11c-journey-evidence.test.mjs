import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import {
  APPROVED_PHASE_11E_NOJS_AMENDMENTS,
  CURRENT_CONTRACT_NO_JAVASCRIPT_TOTALS,
  CURRENT_CONTRACT_VERSION,
  HISTORICAL_PHASE_11C_CONTRACT_VERSION,
  HISTORICAL_PHASE_11C_NO_JAVASCRIPT_TOTALS,
  HISTORICAL_PHASE_11C_NORMATIVE_DIGEST,
  parseNormativeContract,
  validateEvidence,
} from "./check-phase-11c-journey-evidence.mjs";

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

function mutateSectionRow(source, heading, nextHeading, id, transform) {
  const start = source.indexOf(heading);
  const end = source.indexOf(nextHeading, start + heading.length);
  assert.notEqual(start, -1, `missing ${heading}`);
  assert.notEqual(end, -1, `missing ${nextHeading}`);
  const section = source.slice(start, end);
  const lines = section.split(/\r?\n/);
  const rowIndex = lines.findIndex((line) => line.startsWith(`| \`${id}\` |`));
  assert.notEqual(rowIndex, -1, `missing ${id} in ${heading}`);
  const changed = transform(lines[rowIndex]);
  assert.notEqual(changed, lines[rowIndex], `${id} mutation must change the row`);
  lines[rowIndex] = changed;
  return source.slice(0, start) + lines.join("\n") + source.slice(end);
}

function mutateSection7_2Row(source, id, transform) {
  return mutateSectionRow(
    source,
    "### 7.2 Journey validation and ownership",
    "### 7.3 Authoritative no-JavaScript journey classifications",
    id,
    transform,
  );
}

function mutateSection7_3Row(source, id, transform) {
  return mutateSectionRow(
    source,
    "### 7.3 Authoritative no-JavaScript journey classifications",
    "## 8. Phase 11 finding register",
    id,
    transform,
  );
}

test("accepts the exact Contract 1.6 candidate with immutable historical evidence", async () => {
  const result = await validate(evidenceFixture());
  assert.equal(baselineEvidence.acceptedContract.version, HISTORICAL_PHASE_11C_CONTRACT_VERSION);
  assert.equal(result.normative.version, CURRENT_CONTRACT_VERSION);
  assert.equal(result.historicalNormativeDigest, HISTORICAL_PHASE_11C_NORMATIVE_DIGEST);
});

test("reports independent historical and current no-JavaScript totals", async () => {
  const result = await validate(evidenceFixture());
  assert.deepEqual(
    result.historicalEvidenceNoJavaScriptTotals,
    HISTORICAL_PHASE_11C_NO_JAVASCRIPT_TOTALS,
  );
  assert.deepEqual(
    result.currentContractNoJavaScriptTotals,
    CURRENT_CONTRACT_NO_JAVASCRIPT_TOTALS,
  );
});

test("contains exactly the six approved current no-JavaScript amendments", () => {
  const parsed = parseNormativeContract(contract);
  const byId = new Map(parsed.journeys.map((journey) => [journey.id, journey]));
  assert.equal(APPROVED_PHASE_11E_NOJS_AMENDMENTS.size, 6);
  for (const [id, amendment] of APPROVED_PHASE_11E_NOJS_AMENDMENTS) {
    const normativeContract = byId.get(id).normativeContract;
    assert.equal(normativeContract.noJavaScriptRequirement, `\`${amendment.to}\``);
    assert.equal(normativeContract.noJavaScriptClassification, amendment.to);
    assert.equal(normativeContract.noJavaScriptRationale, amendment.rationale);
    assert.equal(
      normativeContract.noJavaScriptValidationMethod,
      amendment.validationMethod,
    );
    assert.equal(normativeContract.noJavaScriptOwnerSlice, amendment.ownerSlice);
    assert.equal(normativeContract.currentStatus, "`NOT_VERIFIED`");
  }
});

test("rejects historical accepted-contract version drift", async () => {
  const evidence = evidenceFixture();
  evidence.acceptedContract.version = CURRENT_CONTRACT_VERSION;
  await assert.rejects(validate(evidence), /historical Phase 11C accepted contract version/);
});

test("rejects historical accepted-contract fingerprint drift", async () => {
  const evidence = evidenceFixture();
  evidence.acceptedContract.fingerprints.section7_1 = "0".repeat(64);
  await assert.rejects(validate(evidence), /historical Phase 11C normalized.*fingerprints/);
});

for (const id of APPROVED_PHASE_11E_NOJS_AMENDMENTS.keys()) {
  test(`rejects ${id} historical no-JavaScript rationale tampering`, async () => {
    const evidence = evidenceFixture();
    const journey = evidence.journeys.find((candidate) => candidate.id === id);
    journey.normativeContract.noJavaScriptRationale += " Changed.";
    await assert.rejects(validate(evidence), /canonical normative projection digest/);
  });

  test(`rejects ${id} historical evidence-classification tampering`, async () => {
    const evidence = evidenceFixture();
    const journey = evidence.journeys.find((candidate) => candidate.id === id);
    journey.noJavaScript.classification = "REQUIRED";
    await assert.rejects(validate(evidence), /canonical normative projection digest/);
  });
}

test("rejects historical non-no-JavaScript normative-field tampering", async () => {
  const evidence = evidenceFixture();
  evidence.journeys[1].normativeContract.positiveRequirement += " Changed.";
  await assert.rejects(validate(evidence), /canonical normative projection digest/);
});

test("rejects current contract version 1.5", async () => {
  const changed = contract.replace(
    `| Version | \`${CURRENT_CONTRACT_VERSION}\` |`,
    "| Version | `1.5-phase-11b-ui-dependent-manual-acceptance-timing-amended` |",
  );
  await assert.rejects(validate(evidenceFixture(), changed), /current contract version must be/);
});

test("rejects an unapproved current contract version 1.7", async () => {
  const changed = contract.replace(
    CURRENT_CONTRACT_VERSION,
    "1.7-unapproved-contract-version",
  );
  await assert.rejects(validate(evidenceFixture(), changed), /current contract version must be/);
});

test("rejects a nonapproved Section 7.2 cell change", async () => {
  const changed = mutateSection7_2Row(contract, "CJ-005", (row) =>
    row.replace("Auth exploratory", "Changed auth exploratory"),
  );
  await assert.rejects(validate(evidenceFixture(), changed), /non-allowlisted.*normativeContract/);
});

test("rejects a nonapproved Section 7.3 row change", async () => {
  const changed = mutateSection7_3Row(contract, "CJ-005", (row) =>
    row.replace("Sign-out is a server-action form", "Changed sign-out rationale"),
  );
  await assert.rejects(validate(evidenceFixture(), changed), /non-allowlisted.*normativeContract/);
});

test("rejects a seventh no-JavaScript amendment", async () => {
  let changed = mutateSection7_2Row(contract, "CJ-033", (row) =>
    row.replace("`NOT_VERIFIED`", "`REQUIRED`"),
  );
  changed = mutateSection7_3Row(changed, "CJ-033", (row) =>
    row.replace("`NOT_VERIFIED`", "`REQUIRED`"),
  );
  await assert.rejects(validate(evidenceFixture(), changed), /non-allowlisted.*normativeContract/);
});

test("rejects reverting an approved amendment", async () => {
  let changed = mutateSection7_2Row(contract, "CJ-003", (row) =>
    row.replace("`REQUIRED`", "`NOT_VERIFIED`"),
  );
  changed = mutateSection7_3Row(changed, "CJ-003", (row) =>
    row.replace("`REQUIRED`", "`NOT_VERIFIED`"),
  );
  await assert.rejects(validate(evidenceFixture(), changed), /current noJavaScriptRequirement/);
});

test("rejects the wrong approved classification type", async () => {
  let changed = mutateSection7_2Row(contract, "CJ-002", (row) =>
    row.replace("`REQUIRED_FALLBACK_ONLY`", "`REQUIRED`"),
  );
  changed = mutateSection7_3Row(changed, "CJ-002", (row) =>
    row.replace("`REQUIRED_FALLBACK_ONLY`", "`REQUIRED`"),
  );
  await assert.rejects(validate(evidenceFixture(), changed), /current noJavaScriptRequirement/);
});

test("rejects a Section 7.2/7.3 classification mismatch", async () => {
  const changed = mutateSection7_2Row(contract, "CJ-007", (row) =>
    row.replace("`REQUIRED`", "`NOT_VERIFIED`"),
  );
  await assert.rejects(validate(evidenceFixture(), changed), /classifications differ/);
});

test("rejects an approved journey owner-slice change", async () => {
  const changed = mutateSection7_3Row(contract, "CJ-007", (row) =>
    row.replace("| 11E |", "| 11F |"),
  );
  await assert.rejects(validate(evidenceFixture(), changed), /owner slice must remain 11E/);
});

test("rejects an approved journey implementation-slice change", async () => {
  const changed = mutateSection7_2Row(contract, "CJ-007", (row) =>
    row.replace("| 11E | 11J | 11K |", "| 11F | 11J | 11K |"),
  );
  await assert.rejects(validate(evidenceFixture(), changed), /non-no-JavaScript normative fields/);
});

test("rejects an approved journey current-status change", async () => {
  const changed = mutateSection7_2Row(contract, "CJ-007", (row) =>
    row.replace(/\| `NOT_VERIFIED` \|$/, "| `IMPLEMENTED` |"),
  );
  await assert.rejects(validate(evidenceFixture(), changed), /non-no-JavaScript normative fields/);
});

test("rejects an approved journey rationale change", async () => {
  const expected = APPROVED_PHASE_11E_NOJS_AMENDMENTS.get("CJ-007");
  const changed = mutateSection7_3Row(contract, "CJ-007", (row) =>
    row.replace(expected.rationale, "Changed approved rationale."),
  );
  await assert.rejects(validate(evidenceFixture(), changed), /current noJavaScriptRationale/);
});

test("rejects an approved journey validation-method change", async () => {
  const expected = APPROVED_PHASE_11E_NOJS_AMENDMENTS.get("CJ-007");
  const changed = mutateSection7_3Row(contract, "CJ-007", (row) =>
    row.replace(expected.validationMethod, "Changed validation method."),
  );
  await assert.rejects(validate(evidenceFixture(), changed), /current noJavaScriptValidationMethod/);
});

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

test("rejects the candidate Phase 11C status after finalization", async () => {
  const evidence = evidenceFixture();
  evidence.status = "PHASE_11C_ACCEPTANCE_CANDIDATE_PENDING_INDEPENDENT_REVIEW";
  await assert.rejects(validate(evidence), /must be in the accepted final state/);
});

test("rejects the old pending manual evidence status", async () => {
  const evidence = evidenceFixture();
  evidence.journeys[0].manualEvidence[0].status =
    "COLLECTED_PENDING_INDEPENDENT_REVIEW";
  await assert.rejects(validate(evidence), /unsupported manual evidence status/);
});

test("rejects an unsupported manual evidence status", async () => {
  const evidence = evidenceFixture();
  evidence.journeys[0].manualEvidence[0].status = "COLLECTED_PASS";
  await assert.rejects(validate(evidence), /unsupported manual evidence status/);
});

test("rejects accepted manual evidence without evidence metadata", async () => {
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
  evidence.journeys[0].externalEvidence[0].status = "COLLECTED_ACCEPTED";
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
