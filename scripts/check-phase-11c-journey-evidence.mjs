import { access, readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const evidencePath = path.join(
  root,
  "docs/phase-11c-critical-journey-evidence.json",
);
const contractPath = path.join(
  root,
  "docs/phase-11b-launch-contract-and-acceptance-baseline.md",
);
const expectedIds = Array.from(
  { length: 35 },
  (_, index) => `CJ-${String(index + 1).padStart(3, "0")}`,
);
const requiredFields = [
  "id",
  "journeyName",
  "controllingSlice",
  "phase11cDisposition",
  "positivePath",
  "failureStates",
  "staleConflictRetry",
  "dataIntegrity",
  "tenantIsolation",
  "locale",
  "viewport",
  "browser",
  "noJavaScript",
  "automatedEvidence",
  "manualEvidence",
  "laterSliceDependencies",
  "externalEvidence",
  "currentLimitations",
];
const axisFields = [
  "positivePath",
  "failureStates",
  "staleConflictRetry",
  "dataIntegrity",
  "tenantIsolation",
  "locale",
  "viewport",
  "browser",
  "noJavaScript",
];
const dispositions = new Set([
  "CURRENT_EVIDENCE_LINKED",
  "GAP_TO_IMPLEMENT_IN_11C",
  "BLOCKED_BY_LATER_SLICE",
  "MANUAL_EVIDENCE_REQUIRED",
  "EXTERNAL_EVIDENCE_REQUIRED",
  "NOT_APPLICABLE_WITH_RATIONALE",
]);
const axisValues = new Set([
  "AUTOMATED",
  "AUTOMATED_PARTIAL",
  "MANUAL_REQUIRED",
  "LATER_SLICE",
  "EXTERNAL_REQUIRED",
  "NOT_APPLICABLE",
  "NOT_VERIFIED",
]);
const noJavaScriptValues = new Set([
  "REQUIRED",
  "REQUIRED_FALLBACK_ONLY",
  "NOT_APPLICABLE",
  "NOT_VERIFIED",
]);
const phase11EJourneys = new Set([
  "CJ-002",
  "CJ-003",
  "CJ-007",
  "CJ-008",
  "CJ-034",
  "CJ-035",
]);

function fail(message) {
  throw new Error(`Phase 11C journey-evidence validation failed: ${message}`);
}

function parseContractRows(contract, heading, nextHeading, rowPattern) {
  const start = contract.indexOf(heading);
  const end = contract.indexOf(nextHeading, start + heading.length);

  if (start === -1 || end === -1) {
    fail(`could not locate contract section ${heading}`);
  }

  return contract
    .slice(start, end)
    .split(/\r?\n/)
    .map((line) => rowPattern.exec(line))
    .filter(Boolean);
}

function requireNonemptyString(value, context) {
  if (typeof value !== "string" || value.trim() === "") {
    fail(`${context} must be a nonempty string`);
  }
}

const [rawEvidence, contract] = await Promise.all([
  readFile(evidencePath, "utf8"),
  readFile(contractPath, "utf8"),
]);
const evidence = JSON.parse(rawEvidence);

if (!Array.isArray(evidence.journeys)) {
  fail("top-level journeys must be an array");
}

if (evidence.journeys.length !== expectedIds.length) {
  fail(`expected 35 journeys, found ${evidence.journeys.length}`);
}

const ids = evidence.journeys.map(({ id }) => id);
if (new Set(ids).size !== ids.length) {
  fail("journey IDs contain a duplicate");
}

if (ids.some((id) => !expectedIds.includes(id))) {
  fail("journey IDs contain a value outside CJ-001 through CJ-035");
}

if (JSON.stringify(ids) !== JSON.stringify(expectedIds)) {
  fail("journey ordering must be exactly CJ-001 through CJ-035");
}

const behaviorRows = parseContractRows(
  contract,
  "### 7.1 Journey behavior and integrity",
  "### 7.2 Journey validation and ownership",
  /^\| `(?<id>CJ-\d{3})` \| (?<name>[^|]+?) \|/,
);
const noJavaScriptRows = parseContractRows(
  contract,
  "### 7.3 Authoritative no-JavaScript journey classifications",
  "## 8. Phase 11 finding register",
  /^\| `(?<id>CJ-\d{3})` \| `(?<classification>[A-Z_]+)` \|/,
);

if (behaviorRows.length !== 35 || noJavaScriptRows.length !== 35) {
  fail("accepted contract must contain exactly 35 normative journey rows");
}

const contractNames = new Map(
  behaviorRows.map((match) => [match.groups.id, match.groups.name.trim()]),
);
const contractNoJavaScript = new Map(
  noJavaScriptRows.map((match) => [
    match.groups.id,
    match.groups.classification,
  ]),
);

if (
  JSON.stringify([...contractNames.keys()]) !== JSON.stringify(expectedIds) ||
  JSON.stringify([...contractNoJavaScript.keys()]) !== JSON.stringify(expectedIds)
) {
  fail("accepted contract journey matrices differ from CJ-001 through CJ-035");
}

let automatedLinkCount = 0;

for (const journey of evidence.journeys) {
  for (const field of requiredFields) {
    if (!(field in journey)) {
      fail(`${journey.id ?? "unknown journey"} is missing ${field}`);
    }
  }

  requireNonemptyString(journey.journeyName, `${journey.id}.journeyName`);
  requireNonemptyString(journey.controllingSlice, `${journey.id}.controllingSlice`);

  if (journey.journeyName !== contractNames.get(journey.id)) {
    fail(`${journey.id} journeyName differs from accepted contract Section 7.1`);
  }

  if (!dispositions.has(journey.phase11cDisposition)) {
    fail(`${journey.id} has unsupported Phase 11C disposition`);
  }

  if (
    journey.phase11cDisposition === "NOT_APPLICABLE_WITH_RATIONALE" &&
    (typeof journey.rationale !== "string" || journey.rationale.trim() === "")
  ) {
    fail(`${journey.id} NOT_APPLICABLE disposition lacks a rationale`);
  }

  if (
    phase11EJourneys.has(journey.id) &&
    (journey.controllingSlice !== "11E" ||
      journey.phase11cDisposition !== "BLOCKED_BY_LATER_SLICE")
  ) {
    fail(`${journey.id} must remain blocked by Phase 11E`);
  }

  if (
    journey.id === "CJ-031" &&
    (journey.controllingSlice !== "11D" ||
      journey.phase11cDisposition === "CURRENT_EVIDENCE_LINKED")
  ) {
    fail("CJ-031 must retain its Phase 11D implementation/evidence boundary");
  }

  if (
    ["11D", "11E", "11J"].includes(journey.controllingSlice) &&
    ["CURRENT_EVIDENCE_LINKED", "GAP_TO_IMPLEMENT_IN_11C"].includes(
      journey.phase11cDisposition,
    )
  ) {
    fail(`${journey.id} is falsely represented as implemented by Phase 11C1`);
  }

  if (!Array.isArray(journey.automatedEvidence)) {
    fail(`${journey.id}.automatedEvidence must be an array`);
  }

  for (const axisName of axisFields) {
    const axis = journey[axisName];
    if (!axis || typeof axis !== "object" || !axisValues.has(axis.status)) {
      fail(`${journey.id}.${axisName} has an unsupported controlled value`);
    }

    if (axis.status === "NOT_APPLICABLE") {
      requireNonemptyString(axis.rationale, `${journey.id}.${axisName}.rationale`);
    }

    if (axis.status === "LATER_SLICE") {
      requireNonemptyString(axis.slice, `${journey.id}.${axisName}.slice`);
    }

    if (["AUTOMATED", "AUTOMATED_PARTIAL"].includes(axis.status)) {
      const linked = journey.automatedEvidence.some(({ evidenceAxes }) =>
        Array.isArray(evidenceAxes) && evidenceAxes.includes(axisName),
      );
      if (!linked) {
        fail(`${journey.id}.${axisName} claims automation without a linked test`);
      }
    }
  }

  const acceptedNoJavaScript = contractNoJavaScript.get(journey.id);
  if (
    !noJavaScriptValues.has(journey.noJavaScript.classification) ||
    journey.noJavaScript.classification !== acceptedNoJavaScript
  ) {
    fail(`${journey.id} no-JavaScript classification differs from the accepted contract`);
  }

  for (const reference of journey.automatedEvidence) {
    requireNonemptyString(reference.path, `${journey.id} automated path`);
    requireNonemptyString(reference.testTitle, `${journey.id} automated testTitle`);
    if (!Array.isArray(reference.evidenceAxes) || reference.evidenceAxes.length === 0) {
      fail(`${journey.id} automated evidence must name evidenceAxes`);
    }
    if (reference.evidenceAxes.some((axis) => !axisFields.includes(axis))) {
      fail(`${journey.id} automated evidence names an unsupported axis`);
    }

    const referencePath = path.resolve(root, reference.path);
    if (!referencePath.startsWith(`${root}${path.sep}`)) {
      fail(`${journey.id} automated path escapes the repository`);
    }
    await access(referencePath);
    const source = await readFile(referencePath, "utf8");
    if (!source.includes(reference.testTitle)) {
      fail(`${journey.id} test title is absent from ${reference.path}`);
    }
    automatedLinkCount += 1;
  }

  for (const collection of [
    "manualEvidence",
    "laterSliceDependencies",
    "externalEvidence",
    "currentLimitations",
  ]) {
    if (!Array.isArray(journey[collection])) {
      fail(`${journey.id}.${collection} must be an array`);
    }
  }

  for (const dependency of journey.laterSliceDependencies) {
    requireNonemptyString(dependency.slice, `${journey.id} dependency slice`);
    requireNonemptyString(dependency.reason, `${journey.id} dependency reason`);
  }

  for (const manual of journey.manualEvidence) {
    if (manual.status !== "NOT_COLLECTED") {
      fail(`${journey.id} falsely represents manual evidence as collected`);
    }
    requireNonemptyString(manual.requirement, `${journey.id} manual requirement`);
  }

  for (const external of journey.externalEvidence) {
    if (external.status !== "NOT_COLLECTED") {
      fail(`${journey.id} falsely represents external evidence as collected`);
    }
    requireNonemptyString(external.slice, `${journey.id} external slice`);
    requireNonemptyString(
      external.requirement,
      `${journey.id} external requirement`,
    );
  }

  for (const limitation of journey.currentLimitations) {
    requireNonemptyString(limitation, `${journey.id} current limitation`);
  }

  if (
    journey.automatedEvidence.length === 0 &&
    journey.manualEvidence.length === 0 &&
    journey.laterSliceDependencies.length === 0 &&
    journey.externalEvidence.length === 0
  ) {
    fail(`${journey.id} lacks evidence and an explicit blocker`);
  }
}

const noJavaScriptTotals = evidence.journeys.reduce((totals, journey) => {
  totals[journey.noJavaScript.classification] += 1;
  return totals;
}, {
  REQUIRED: 0,
  REQUIRED_FALLBACK_ONLY: 0,
  NOT_APPLICABLE: 0,
  NOT_VERIFIED: 0,
});

if (
  JSON.stringify(noJavaScriptTotals) !==
  JSON.stringify({
    REQUIRED: 6,
    REQUIRED_FALLBACK_ONLY: 1,
    NOT_APPLICABLE: 10,
    NOT_VERIFIED: 18,
  })
) {
  fail("no-JavaScript totals differ from 6/1/10/18");
}

for (const [id, classification] of [
  ["CJ-028", "REQUIRED"],
  ["CJ-029", "REQUIRED"],
  ["CJ-031", "REQUIRED_FALLBACK_ONLY"],
]) {
  const journey = evidence.journeys.find((candidate) => candidate.id === id);
  if (journey.noJavaScript.classification !== classification) {
    fail(`${id} has the wrong no-JavaScript classification`);
  }
}

console.log(
  `Verified ${evidence.journeys.length} ordered journeys, ${automatedLinkCount} automated evidence links, and no-JavaScript totals 6/1/10/18.`,
);
