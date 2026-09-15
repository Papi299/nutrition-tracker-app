import { createHash } from "node:crypto";
import {
  existsSync,
  readFileSync,
  readdirSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { resolve, sep } from "node:path";

const REQUIRED_ROOT_ARTIFACTS = [
  "normative-browser-trace-map.json",
  "normative-performance-report.json",
  "normative-performance-samples.json",
  "operation-boundaries.json",
  "runtime-manifest.json",
];

const REQUIRED_TRACE_ARCHIVES = ["desktop", "mobile"].flatMap((profile) =>
  Array.from(
    { length: 10 },
    (_, index) =>
      `traces/trace_${profile}_ctx${String(index + 1).padStart(2, "0")}.zip`,
  ),
);

const REQUIRED_ARTIFACTS = [
  ...REQUIRED_ROOT_ARTIFACTS,
  ...REQUIRED_TRACE_ARCHIVES,
];

function sha256(path) {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

function assertExactTraceSet(evidenceDirectory) {
  const observed = readdirSync(`${evidenceDirectory}/traces`)
    .map((entry) => `traces/${entry}`)
    .sort();
  const expected = [...REQUIRED_TRACE_ARCHIVES].sort();
  if (JSON.stringify(observed) !== JSON.stringify(expected)) {
    throw new Error("The bounded raw trace set is incomplete or unexpected.");
  }
}

export function resolveQualificationOutputDirectory({
  allowedRoot = "performance/evidence/correction-03-resume",
  defaultDirectory,
  requestedDirectory,
}) {
  if (!requestedDirectory) {
    return { directory: defaultDirectory, runSpecific: false };
  }

  const absoluteAllowedRoot = resolve(allowedRoot);
  const absoluteDirectory = resolve(requestedDirectory);
  if (!absoluteDirectory.startsWith(`${absoluteAllowedRoot}${sep}`)) {
    throw new Error(
      "The run-specific evidence directory must be inside correction-03-resume.",
    );
  }
  if (existsSync(absoluteDirectory)) {
    throw new Error("The run-specific evidence directory already exists.");
  }

  return { directory: absoluteDirectory, runSpecific: true };
}

export function writeAndVerifyEvidenceManifest(evidenceDirectory) {
  assertExactTraceSet(evidenceDirectory);

  const artifacts = REQUIRED_ARTIFACTS.map((relativePath) => {
    const absolutePath = `${evidenceDirectory}/${relativePath}`;
    if (!existsSync(absolutePath) || !statSync(absolutePath).isFile()) {
      throw new Error(`Required raw evidence is missing: ${relativePath}`);
    }
    const sizeBytes = statSync(absolutePath).size;
    if (sizeBytes === 0) {
      throw new Error(`Required raw evidence is empty: ${relativePath}`);
    }
    return { path: relativePath, sha256: sha256(absolutePath), sizeBytes };
  });

  const manifest = {
    schemaVersion: "1",
    evidenceType: "phase-11g2-raw-evidence-checksum-manifest",
    artifactCount: artifacts.length,
    artifacts,
  };
  const manifestPath = `${evidenceDirectory}/raw-evidence-manifest.json`;
  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

  return verifyEvidenceManifest(evidenceDirectory);
}

export function verifyEvidenceManifest(evidenceDirectory) {
  assertExactTraceSet(evidenceDirectory);
  const manifestPath = `${evidenceDirectory}/raw-evidence-manifest.json`;
  if (!existsSync(manifestPath) || !statSync(manifestPath).isFile()) {
    throw new Error("The raw evidence manifest is missing.");
  }
  const persisted = JSON.parse(readFileSync(manifestPath, "utf8"));
  if (
    persisted.artifactCount !== REQUIRED_ARTIFACTS.length ||
    !Array.isArray(persisted.artifacts) ||
    persisted.artifacts.length !== REQUIRED_ARTIFACTS.length ||
    JSON.stringify(persisted.artifacts.map((artifact) => artifact.path)) !==
      JSON.stringify(REQUIRED_ARTIFACTS)
  ) {
    throw new Error("The raw evidence manifest is incomplete.");
  }
  for (const artifact of persisted.artifacts) {
    const absolutePath = `${evidenceDirectory}/${artifact.path}`;
    if (
      !existsSync(absolutePath) ||
      statSync(absolutePath).size !== artifact.sizeBytes ||
      sha256(absolutePath) !== artifact.sha256
    ) {
      throw new Error(`Raw evidence verification failed: ${artifact.path}`);
    }
  }

  return {
    artifactCount: persisted.artifacts.length,
    manifestPath,
    manifestSha256: sha256(manifestPath),
  };
}
