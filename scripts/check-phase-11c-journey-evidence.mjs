import { createHash } from "node:crypto";
import { access, readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";

export const EXPECTED_IDS = Array.from(
  { length: 35 },
  (_, index) => `CJ-${String(index + 1).padStart(3, "0")}`,
);
export const AXIS_FIELDS = [
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

const CONTRACT_PATH = "docs/phase-11b-launch-contract-and-acceptance-baseline.md";
const CONTRACT_VERSION = "1.4-phase-11b-remaining-implemented-nojs-amended";
const EVIDENCE_PATH = "docs/phase-11c-critical-journey-evidence.json";
const EXPLORATORY_EVIDENCE_PATH =
  "docs/phase-11c-browser-exploratory-evidence.md";
const SCHEMA_VERSION = "1.3";
const TESTED_BASELINE_SHA = "b09ca42873d5114130f7dd9656ae8df185affabb";
const FINAL_STATUS = "PHASE_11C_ACCEPTED";
const REQUIRED_FIELDS = [
  "id",
  "journeyName",
  "controllingSlice",
  "phase11cDisposition",
  ...AXIS_FIELDS,
  "normativeContract",
  "automatedEvidence",
  "manualEvidence",
  "laterSliceDependencies",
  "externalEvidence",
  "currentLimitations",
];
const DISPOSITIONS = new Set([
  "CURRENT_EVIDENCE_LINKED",
  "GAP_TO_IMPLEMENT_IN_11C",
  "BLOCKED_BY_LATER_SLICE",
  "MANUAL_EVIDENCE_REQUIRED",
  "EXTERNAL_EVIDENCE_REQUIRED",
  "NOT_APPLICABLE_WITH_RATIONALE",
]);
const AXIS_VALUES = new Set([
  "AUTOMATED",
  "AUTOMATED_PARTIAL",
  "MANUAL_REQUIRED",
  "LATER_SLICE",
  "EXTERNAL_REQUIRED",
  "NOT_APPLICABLE",
  "NOT_VERIFIED",
]);
const AUTOMATED_VALUES = new Set(["AUTOMATED", "AUTOMATED_PARTIAL"]);
const NO_JAVASCRIPT_VALUES = new Set([
  "REQUIRED",
  "REQUIRED_FALLBACK_ONLY",
  "NOT_APPLICABLE",
  "NOT_VERIFIED",
]);
const PHASE_11E_JOURNEYS = new Set([
  "CJ-002",
  "CJ-003",
  "CJ-007",
  "CJ-008",
  "CJ-034",
  "CJ-035",
]);
const LATER_SLICE_MANUAL_JOURNEYS = new Set([
  "CJ-002",
  "CJ-003",
  "CJ-007",
  "CJ-008",
  "CJ-031",
  "CJ-033",
  "CJ-034",
  "CJ-035",
]);
const MANUAL_EVIDENCE_VALUES = new Set([
  "NOT_COLLECTED",
  "COLLECTED_ACCEPTED",
]);
const EXPLORATORY_SESSIONS = new Set(["M1", "M2", "M3", "M4", "M5", "M6"]);

const SECTION_DEFINITIONS = {
  section7_1: {
    heading: "### 7.1 Journey behavior and integrity",
    nextHeading: "### 7.2 Journey validation and ownership",
    headers: [
      "ID",
      "Journey",
      "Launch requirement",
      "Positive path",
      "Negative / failure states",
      "Stale / conflict / retry",
      "Data-integrity assertion",
      "Tenant-isolation assertion",
    ],
  },
  section7_2: {
    heading: "### 7.2 Journey validation and ownership",
    nextHeading: "### 7.3 Authoritative no-JavaScript journey classifications",
    headers: [
      "ID",
      "en",
      "he / RTL",
      "Viewport",
      "Browser",
      "Accessibility",
      "No-JavaScript classification",
      "Manual evidence",
      "Physical device",
      "Implementation slice",
      "External-validation slice",
      "Final gate",
      "Current evidence",
      "Missing evidence",
      "Current status",
    ],
  },
  section7_3: {
    heading: "### 7.3 Authoritative no-JavaScript journey classifications",
    nextHeading: "## 8. Phase 11 finding register",
    headers: [
      "Journey",
      "Classification",
      "Exact rationale",
      "Owner slice",
      "Validation method",
    ],
  },
};

export function fail(message) {
  throw new Error(`Phase 11C journey-evidence validation failed: ${message}`);
}

export function normalizeCell(value) {
  return value.trim().replace(/\s+/g, " ");
}

function splitTableRow(line) {
  if (!line.startsWith("|") || !line.endsWith("|")) {
    fail(`malformed Markdown table row: ${line}`);
  }
  return line.slice(1, -1).split("|").map(normalizeCell);
}

function extractSection(contract, heading, nextHeading) {
  const start = contract.indexOf(heading);
  const end = contract.indexOf(nextHeading, start + heading.length);
  if (start === -1 || end === -1) {
    fail(`could not locate contract section ${heading}`);
  }
  return contract.slice(start, end);
}

function parseNormativeTable(contract, definition, label) {
  const lines = extractSection(
    contract,
    definition.heading,
    definition.nextHeading,
  ).split(/\r?\n/);
  const headerIndex = lines.findIndex((line) => line.startsWith("| "));
  if (headerIndex === -1 || headerIndex + 1 >= lines.length) {
    fail(`${label} is missing its Markdown table`);
  }

  const headers = splitTableRow(lines[headerIndex]);
  if (JSON.stringify(headers) !== JSON.stringify(definition.headers)) {
    fail(`${label} has an unexpected table header`);
  }

  const separator = splitTableRow(lines[headerIndex + 1]);
  if (
    separator.length !== headers.length ||
    separator.some((cell) => !/^:?-{3,}:?$/.test(cell))
  ) {
    fail(`${label} has a malformed table separator`);
  }

  const rows = [];
  for (const line of lines.slice(headerIndex + 2)) {
    if (!line.startsWith("|")) {
      if (rows.length > 0) break;
      continue;
    }
    const cells = splitTableRow(line);
    if (cells.length !== headers.length) {
      fail(`${label} contains a malformed row with ${cells.length} cells`);
    }
    rows.push(Object.fromEntries(headers.map((header, index) => [header, cells[index]])));
  }

  if (rows.length !== 35) {
    fail(`${label} must contain exactly 35 rows, found ${rows.length}`);
  }

  const idHeader = label === "Section 7.3" ? "Journey" : "ID";
  const ids = rows.map((row) => row[idHeader].replaceAll("`", ""));
  if (new Set(ids).size !== ids.length) fail(`${label} contains a duplicated journey`);
  if (JSON.stringify(ids) !== JSON.stringify(EXPECTED_IDS)) {
    fail(`${label} journey ordering must be exactly CJ-001 through CJ-035`);
  }

  return { headers, rows };
}

export function fingerprintTable(table) {
  return createHash("sha256")
    .update(JSON.stringify({ headers: table.headers, rows: table.rows }))
    .digest("hex");
}

export function parseNormativeContract(contract) {
  const versionMatch = contract.match(/^\| Version \| `([^`]+)` \|$/m);
  if (!versionMatch) fail("accepted contract version is missing or malformed");

  const section7_1 = parseNormativeTable(
    contract,
    SECTION_DEFINITIONS.section7_1,
    "Section 7.1",
  );
  const section7_2 = parseNormativeTable(
    contract,
    SECTION_DEFINITIONS.section7_2,
    "Section 7.2",
  );
  const section7_3 = parseNormativeTable(
    contract,
    SECTION_DEFINITIONS.section7_3,
    "Section 7.3",
  );

  const byId7_1 = new Map(
    section7_1.rows.map((row) => [row.ID.replaceAll("`", ""), row]),
  );
  const byId7_2 = new Map(
    section7_2.rows.map((row) => [row.ID.replaceAll("`", ""), row]),
  );
  const byId7_3 = new Map(
    section7_3.rows.map((row) => [row.Journey.replaceAll("`", ""), row]),
  );

  const journeys = EXPECTED_IDS.map((id) => {
    const behavior = byId7_1.get(id);
    const ownership = byId7_2.get(id);
    const noJavaScript = byId7_3.get(id);
    const section7_2Classification = ownership["No-JavaScript classification"].replaceAll("`", "");
    const section7_3Classification = noJavaScript.Classification.replaceAll("`", "");
    if (section7_2Classification !== section7_3Classification) {
      fail(`${id} Section 7.2 and 7.3 no-JavaScript classifications differ`);
    }

    return {
      id,
      journeyName: behavior.Journey,
      normativeContract: {
        launchStatus: behavior["Launch requirement"],
        positiveRequirement: behavior["Positive path"],
        negativeRequirement: behavior["Negative / failure states"],
        staleConflictRetryRequirement: behavior["Stale / conflict / retry"],
        dataIntegrityRequirement: behavior["Data-integrity assertion"],
        tenantIsolationRequirement: behavior["Tenant-isolation assertion"],
        englishRequirement: ownership.en,
        hebrewRtlRequirement: ownership["he / RTL"],
        viewportRequirement: ownership.Viewport,
        browserRequirement: ownership.Browser,
        accessibilityRequirement: ownership.Accessibility,
        noJavaScriptRequirement: ownership["No-JavaScript classification"],
        manualRequirement: ownership["Manual evidence"],
        physicalDeviceRequirement: ownership["Physical device"],
        implementationSlice: ownership["Implementation slice"],
        externalValidationSlice: ownership["External-validation slice"],
        finalGate: ownership["Final gate"],
        currentEvidence: ownership["Current evidence"],
        missingEvidence: ownership["Missing evidence"],
        currentStatus: ownership["Current status"],
        noJavaScriptClassification: section7_3Classification,
        noJavaScriptRationale: noJavaScript["Exact rationale"],
        noJavaScriptOwnerSlice: noJavaScript["Owner slice"],
        noJavaScriptValidationMethod: noJavaScript["Validation method"],
      },
    };
  });

  return {
    version: versionMatch[1],
    tables: { section7_1, section7_2, section7_3 },
    fingerprints: {
      section7_1: fingerprintTable(section7_1),
      section7_2: fingerprintTable(section7_2),
      section7_3: fingerprintTable(section7_3),
    },
    journeys,
  };
}

function requireNonemptyString(value, context) {
  if (typeof value !== "string" || value.trim() === "") {
    fail(`${context} must be a nonempty string`);
  }
}

function requireExactObject(actual, expected, context) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    fail(`${context} differs from the accepted contract`);
  }
}

export async function validateEvidence({ evidence, contract, rootDir = process.cwd() }) {
  const normative = parseNormativeContract(contract);
  if (evidence.schemaVersion !== SCHEMA_VERSION) {
    fail(`schemaVersion must be ${SCHEMA_VERSION}`);
  }
  if (evidence.baselineSha !== TESTED_BASELINE_SHA) {
    fail("baselineSha differs from the exact browser-tested baseline");
  }
  if (evidence.phase !== "11C" || evidence.status !== FINAL_STATUS) {
    fail("Phase 11C evidence must be in the accepted final state");
  }
  requireExactObject(
    evidence.manualEvidenceStatusValues,
    ["NOT_COLLECTED", "COLLECTED_ACCEPTED"],
    "manual evidence status vocabulary",
  );
  if (evidence.acceptedContract?.path !== CONTRACT_PATH) {
    fail("accepted contract path differs from the approved path");
  }
  if (
    evidence.acceptedContract?.version !== CONTRACT_VERSION ||
    normative.version !== CONTRACT_VERSION
  ) {
    fail("accepted contract version differs from the approved version");
  }
  requireExactObject(
    evidence.acceptedContract.fingerprints,
    normative.fingerprints,
    "normalized Section 7.1-7.3 fingerprints",
  );

  if (!Array.isArray(evidence.journeys)) fail("top-level journeys must be an array");
  if (evidence.journeys.length !== EXPECTED_IDS.length) {
    fail(`expected 35 journeys, found ${evidence.journeys.length}`);
  }
  const ids = evidence.journeys.map(({ id }) => id);
  if (new Set(ids).size !== ids.length) fail("journey IDs contain a duplicate");
  if (ids.some((id) => !EXPECTED_IDS.includes(id))) {
    fail("journey IDs contain a value outside CJ-001 through CJ-035");
  }
  if (JSON.stringify(ids) !== JSON.stringify(EXPECTED_IDS)) {
    fail("journey ordering must be exactly CJ-001 through CJ-035");
  }

  const normativeById = new Map(normative.journeys.map((journey) => [journey.id, journey]));
  let automatedLinkCount = 0;
  let evidenceAxisClaimCount = 0;
  let collectedAcceptedManualCount = 0;
  let notCollectedManualCount = 0;
  let notCollectedExternalCount = 0;

  for (const journey of evidence.journeys) {
    for (const field of REQUIRED_FIELDS) {
      if (!(field in journey)) fail(`${journey.id ?? "unknown journey"} is missing ${field}`);
    }
    requireNonemptyString(journey.journeyName, `${journey.id}.journeyName`);
    requireNonemptyString(journey.controllingSlice, `${journey.id}.controllingSlice`);

    const accepted = normativeById.get(journey.id);
    if (journey.journeyName !== accepted.journeyName) {
      fail(`${journey.id} journeyName differs from accepted contract Section 7.1`);
    }
    requireExactObject(
      journey.normativeContract,
      accepted.normativeContract,
      `${journey.id}.normativeContract`,
    );
    if (!DISPOSITIONS.has(journey.phase11cDisposition)) {
      fail(`${journey.id} has unsupported Phase 11C disposition`);
    }
    if (
      journey.phase11cDisposition === "NOT_APPLICABLE_WITH_RATIONALE" &&
      (typeof journey.rationale !== "string" || journey.rationale.trim() === "")
    ) {
      fail(`${journey.id} NOT_APPLICABLE disposition lacks a rationale`);
    }

    if (
      PHASE_11E_JOURNEYS.has(journey.id) &&
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
      journey.id === "CJ-033" &&
      (journey.controllingSlice !== "11G" ||
        journey.phase11cDisposition !== "BLOCKED_BY_LATER_SLICE")
    ) {
      fail("CJ-033 must retain its Phase 11G implementation boundary");
    }
    if (
      ["11D", "11E", "11J"].includes(journey.controllingSlice) &&
      ["CURRENT_EVIDENCE_LINKED", "GAP_TO_IMPLEMENT_IN_11C"].includes(journey.phase11cDisposition)
    ) {
      fail(`${journey.id} is falsely represented as implemented by Phase 11C1`);
    }
    if (!Array.isArray(journey.automatedEvidence)) {
      fail(`${journey.id}.automatedEvidence must be an array`);
    }

    for (const axisName of AXIS_FIELDS) {
      const axis = journey[axisName];
      if (!axis || typeof axis !== "object" || !AXIS_VALUES.has(axis.status)) {
        fail(`${journey.id}.${axisName} has an unsupported controlled value`);
      }
      if (axis.status === "NOT_APPLICABLE") {
        requireNonemptyString(axis.rationale, `${journey.id}.${axisName}.rationale`);
        if (
          axisName === "noJavaScript" &&
          axis.rationale !== accepted.normativeContract.noJavaScriptRationale
        ) {
          fail(`${journey.id}.noJavaScript rationale differs from Section 7.3`);
        }
      }
      if (axis.status === "LATER_SLICE") {
        requireNonemptyString(axis.slice, `${journey.id}.${axisName}.slice`);
      }
      if (AUTOMATED_VALUES.has(axis.status)) {
        const linked = journey.automatedEvidence.some(
          ({ evidenceAxes }) => Array.isArray(evidenceAxes) && evidenceAxes.includes(axisName),
        );
        if (!linked) fail(`${journey.id}.${axisName} claims automation without a linked test`);
      }
    }

    const acceptedNoJavaScript = accepted.normativeContract.noJavaScriptClassification;
    if (
      !NO_JAVASCRIPT_VALUES.has(journey.noJavaScript.classification) ||
      journey.noJavaScript.classification !== acceptedNoJavaScript
    ) {
      fail(`${journey.id} no-JavaScript classification differs from the accepted contract`);
    }

    const seenReferences = new Set();
    for (const reference of journey.automatedEvidence) {
      requireNonemptyString(reference.path, `${journey.id} automated path`);
      requireNonemptyString(reference.testTitle, `${journey.id} automated testTitle`);
      if (!Array.isArray(reference.evidenceAxes) || reference.evidenceAxes.length === 0) {
        fail(`${journey.id} automated evidence must name evidenceAxes`);
      }
      if (new Set(reference.evidenceAxes).size !== reference.evidenceAxes.length) {
        fail(`${journey.id} automated evidence contains a duplicate axis claim`);
      }
      if (reference.evidenceAxes.some((axis) => !AXIS_FIELDS.includes(axis))) {
        fail(`${journey.id} automated evidence names an unsupported axis`);
      }
      const referenceKey = `${reference.path}\n${reference.testTitle}`;
      if (seenReferences.has(referenceKey)) {
        fail(`${journey.id} contains a duplicate exact path/title reference`);
      }
      seenReferences.add(referenceKey);

      for (const axisName of reference.evidenceAxes) {
        const status = journey[axisName].status;
        if (!AUTOMATED_VALUES.has(status)) {
          fail(`${journey.id} automated evidence claims ${axisName} while its status is ${status}`);
        }
        if (
          journey.phase11cDisposition === "BLOCKED_BY_LATER_SLICE" &&
          status === "AUTOMATED"
        ) {
          fail(`${journey.id} later-slice journey cannot claim complete automated evidence`);
        }
      }

      const referencePath = path.resolve(rootDir, reference.path);
      if (!referencePath.startsWith(`${path.resolve(rootDir)}${path.sep}`)) {
        fail(`${journey.id} automated path escapes the repository`);
      }
      try {
        await access(referencePath);
      } catch {
        fail(`${journey.id} automated evidence path does not exist: ${reference.path}`);
      }
      const source = await readFile(referencePath, "utf8");
      if (!source.includes(reference.testTitle)) {
        fail(`${journey.id} test title is absent from ${reference.path}`);
      }
      automatedLinkCount += 1;
      evidenceAxisClaimCount += reference.evidenceAxes.length;
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
    if (journey.manualEvidence.length !== 1) {
      fail(`${journey.id} must contain exactly one manual evidence record`);
    }
    for (const manual of journey.manualEvidence) {
      if (!MANUAL_EVIDENCE_VALUES.has(manual.status)) {
        fail(`${journey.id} has unsupported manual evidence status`);
      }
      requireNonemptyString(manual.requirement, `${journey.id} manual requirement`);
      if (manual.status === "COLLECTED_ACCEPTED") {
        if (!Array.isArray(manual.sessions) || manual.sessions.length === 0) {
          fail(`${journey.id} collected manual evidence requires sessions`);
        }
        if (
          new Set(manual.sessions).size !== manual.sessions.length ||
          manual.sessions.some((session) => !EXPLORATORY_SESSIONS.has(session))
        ) {
          fail(`${journey.id} collected manual evidence has an invalid session`);
        }
        requireNonemptyString(
          manual.evidencePath,
          `${journey.id} manual evidence path`,
        );
        if (manual.evidencePath !== EXPLORATORY_EVIDENCE_PATH) {
          fail(`${journey.id} manual evidence path must use the consolidated evidence file`);
        }
        const manualEvidencePath = path.resolve(rootDir, manual.evidencePath);
        if (!manualEvidencePath.startsWith(`${path.resolve(rootDir)}${path.sep}`)) {
          fail(`${journey.id} manual evidence path escapes the repository`);
        }
        try {
          await access(manualEvidencePath);
        } catch {
          fail(`${journey.id} manual evidence file does not exist`);
        }
        requireNonemptyString(manual.executor, `${journey.id} manual executor`);
        requireNonemptyString(manual.executedAt, `${journey.id} manual executedAt`);
        collectedAcceptedManualCount += 1;
      } else {
        notCollectedManualCount += 1;
      }
      if (
        LATER_SLICE_MANUAL_JOURNEYS.has(journey.id) &&
        manual.status !== "NOT_COLLECTED"
      ) {
        fail(`${journey.id} later-slice manual evidence must remain NOT_COLLECTED`);
      }
      if (
        !LATER_SLICE_MANUAL_JOURNEYS.has(journey.id) &&
        manual.status !== "COLLECTED_ACCEPTED"
      ) {
        fail(`${journey.id} controlling Phase 11C manual evidence must be accepted`);
      }
    }
    for (const external of journey.externalEvidence) {
      if (external.status !== "NOT_COLLECTED") {
        fail(`${journey.id} falsely represents external evidence as collected`);
      }
      requireNonemptyString(external.slice, `${journey.id} external slice`);
      requireNonemptyString(external.requirement, `${journey.id} external requirement`);
      notCollectedExternalCount += 1;
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

  if (automatedLinkCount !== 249 || evidenceAxisClaimCount !== 854) {
    fail(
      `automated evidence totals must remain 249 links / 854 claims, found ${automatedLinkCount} / ${evidenceAxisClaimCount}`,
    );
  }
  requireExactObject(
    {
      collectedAccepted: collectedAcceptedManualCount,
      notCollectedLaterSlice: notCollectedManualCount,
      notCollectedExternal: notCollectedExternalCount,
    },
    {
      collectedAccepted: 27,
      notCollectedLaterSlice: 8,
      notCollectedExternal: 35,
    },
    "manual and external evidence totals",
  );

  const noJavaScriptTotals = evidence.journeys.reduce(
    (totals, journey) => {
      totals[journey.noJavaScript.classification] += 1;
      return totals;
    },
    { REQUIRED: 0, REQUIRED_FALLBACK_ONLY: 0, NOT_APPLICABLE: 0, NOT_VERIFIED: 0 },
  );
  requireExactObject(
    noJavaScriptTotals,
    { REQUIRED: 11, REQUIRED_FALLBACK_ONLY: 4, NOT_APPLICABLE: 13, NOT_VERIFIED: 7 },
    "no-JavaScript totals",
  );
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

  return {
    journeyCount: evidence.journeys.length,
    automatedLinkCount,
    evidenceAxisClaimCount,
    collectedAcceptedManualCount,
    notCollectedManualCount,
    notCollectedExternalCount,
    noJavaScriptTotals,
    normative,
  };
}

export async function validateRepository(rootDir = process.cwd()) {
  const [rawEvidence, contract] = await Promise.all([
    readFile(path.join(rootDir, EVIDENCE_PATH), "utf8"),
    readFile(path.join(rootDir, CONTRACT_PATH), "utf8"),
  ]);
  return validateEvidence({ evidence: JSON.parse(rawEvidence), contract, rootDir });
}

async function main() {
  const result = await validateRepository();
  console.log(
    `Verified ${result.journeyCount} ordered journeys, complete Section 7.1-7.3 binding, ${result.automatedLinkCount} automated evidence links, ${result.evidenceAxisClaimCount} evidence-axis claims, manual evidence 27 accepted / 8 later-slice not-collected, 35 external not-collected, and no-JavaScript totals 11/4/13/7.`,
  );
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
