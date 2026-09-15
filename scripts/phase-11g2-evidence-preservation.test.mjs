import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import test from "node:test";
import {
  resolveQualificationOutputDirectory,
  verifyEvidenceManifest,
  writeAndVerifyEvidenceManifest,
} from "./phase-11g2-evidence-preservation.mjs";

function createCompleteEvidenceDirectory() {
  const directory = mkdtempSync(`${tmpdir()}/phase11g2-evidence-check-`);
  mkdirSync(`${directory}/traces`);
  for (const name of [
    "normative-browser-trace-map.json",
    "normative-performance-report.json",
    "normative-performance-samples.json",
    "operation-boundaries.json",
    "runtime-manifest.json",
  ]) {
    writeFileSync(`${directory}/${name}`, "{}\n");
  }
  for (const profile of ["desktop", "mobile"]) {
    for (let index = 1; index <= 10; index += 1) {
      writeFileSync(
        `${directory}/traces/trace_${profile}_ctx${String(index).padStart(2, "0")}.zip`,
        "bounded-trace",
      );
    }
  }
  return directory;
}

test("requires a new run-specific evidence destination inside the correction root", () => {
  const root = mkdtempSync(`${tmpdir()}/phase11g2-evidence-root-`);
  const requested = `${root}/preflight-1`;
  assert.deepEqual(
    resolveQualificationOutputDirectory({
      allowedRoot: root,
      defaultDirectory: "unused",
      requestedDirectory: requested,
    }),
    { directory: requested, runSpecific: true },
  );
  mkdirSync(requested);
  assert.throws(
    () =>
      resolveQualificationOutputDirectory({
        allowedRoot: root,
        defaultDirectory: "unused",
        requestedDirectory: requested,
      }),
    /already exists/,
  );
  assert.throws(
    () =>
      resolveQualificationOutputDirectory({
        allowedRoot: root,
        defaultDirectory: "unused",
        requestedDirectory: `${root}-outside/run`,
      }),
    /inside correction-03-resume/,
  );
  rmSync(root, { force: true, recursive: true });
});

test("writes and re-verifies a checksum manifest for every required raw artifact", () => {
  const directory = createCompleteEvidenceDirectory();
  try {
    const result = writeAndVerifyEvidenceManifest(directory);
    assert.equal(result.artifactCount, 25);
    assert.match(result.manifestSha256, /^[0-9a-f]{64}$/);
  } finally {
    rmSync(directory, { force: true, recursive: true });
  }
});

test("refuses to manifest incomplete raw evidence", () => {
  const directory = createCompleteEvidenceDirectory();
  try {
    rmSync(`${directory}/runtime-manifest.json`);
    assert.throws(
      () => writeAndVerifyEvidenceManifest(directory),
      /Required raw evidence is missing/,
    );
  } finally {
    rmSync(directory, { force: true, recursive: true });
  }
});

test("rejects a persisted manifest after an artifact checksum changes", () => {
  const directory = createCompleteEvidenceDirectory();
  try {
    writeAndVerifyEvidenceManifest(directory);
    writeFileSync(`${directory}/runtime-manifest.json`, "{\"changed\":true}\n");
    assert.throws(
      () => verifyEvidenceManifest(directory),
      /Raw evidence verification failed/,
    );
  } finally {
    rmSync(directory, { force: true, recursive: true });
  }
});

test("rejects an unexpected trace artifact", () => {
  const directory = createCompleteEvidenceDirectory();
  try {
    writeFileSync(`${directory}/traces/trace_desktop_ctx11.zip`, "extra");
    assert.throws(
      () => writeAndVerifyEvidenceManifest(directory),
      /trace set is incomplete or unexpected/,
    );
  } finally {
    rmSync(directory, { force: true, recursive: true });
  }
});
