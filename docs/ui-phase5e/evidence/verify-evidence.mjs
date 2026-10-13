import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { gzipSync, gunzipSync } from "node:zlib";

const approvedHead = "1ffd19dc90f8dc442160d3b2bbaea0c0a4ce07b7";
const approvedTree = "65dfa021dc38ce2feb0d0a1dc73d63ac39d02739";
const suites = ["setup", "custom-food", "account-secondary"];
const directory = resolve(process.argv[3] ?? "docs/ui-phase5e/evidence");
const repository = resolve(process.argv[4] ?? ".");
const digest = bytes => createHash("sha256").update(bytes).digest("hex");
const assert = (condition, message) => { if (!condition) throw new Error(message); };
const git = (...args) => execFileSync("git", args, { cwd: repository, encoding: "utf8" }).trim();
const encode = value => `${JSON.stringify(value, null, 2)}\n`;

function verifySource(raw) {
  const identity = raw.sourceIdentity;
  assert(git("rev-parse", `${identity.head}^{tree}`) === identity.tree, "Capture tree mismatch.");
  assert(identity.productionDiffSha256 === digest(""), "Capture uses uncommitted production source.");
  if (raw.mode === "baseline") assert(identity.head === approvedHead && identity.tree === approvedTree, "Baseline drift.");
  for (const [file, hash] of Object.entries(identity.sourceFileSha256)) {
    assert(digest(execFileSync("git", ["show", `${identity.head}:${file}`], { cwd: repository })) === hash, `Committed source mismatch: ${file}`);
    if (raw.mode === "after") assert(digest(readFileSync(join(repository, file))) === hash, `Current source mismatch: ${file}`);
  }
  for (const [file, hash] of Object.entries(identity.protectedFileSha256 ?? {})) {
    assert(digest(execFileSync("git", ["show", `${approvedHead}:${file}`], { cwd: repository })) === hash, `Protected baseline mismatch: ${file}`);
    assert(digest(readFileSync(join(repository, file))) === hash, `Protected source changed: ${file}`);
  }
  if (raw.mode === "after") execFileSync("git", ["merge-base", "--is-ancestor", identity.head, "HEAD"], { cwd: repository });
}

function verifyRendered(raw) {
  if (raw.mode !== "after") return;
  for (const record of raw.measurements.filter(record => record.document)) {
    const label = `${record.state}/${record.locale}/${record.viewport.width}`;
    assert(record.document.scrollWidth <= record.document.clientWidth && record.body.scrollWidth <= record.document.clientWidth, `${label}: document overflow.`);
    const elements = [...(record.controls ?? []), ...(record.cards ?? []), ...(record.sections ?? []), ...(record.text ?? []), ...(record.labelsAndErrors ?? [])];
    for (const element of elements) {
      assert(element.x >= -0.5 && element.right <= record.document.clientWidth + 0.5, `${label}: offscreen content.`);
      if (element.content) assert(element.content.x >= -0.5 && element.content.right <= record.document.clientWidth + 0.5, `${label}: clipped text.`);
      assert(element.overflow !== "hidden" && element.textOverflow !== "ellipsis", `${label}: obscured text.`);
    }
    for (const control of (record.controls ?? []).filter(control => !control.disabled)) {
      const target = control.target ?? control;
      assert(target.width >= 44 && target.height >= 44, `${label}: undersized control.`);
    }
    const actions = (record.controls ?? []).filter(control => ["A", "BUTTON", "SUMMARY"].includes(control.tag) && !control.disabled);
    for (let i = 0; i < actions.length; i += 1) for (let j = i + 1; j < actions.length; j += 1) {
      const a = actions[i], b = actions[j];
      assert(Math.max(0, Math.min(a.right, b.right) - Math.max(a.x, b.x)) * Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.y, b.y)) < 0.5, `${label}: overlapping actions.`);
    }
  }
  for (const scan of raw.accessibility.filter(scan => scan.violations)) assert(scan.violations.length === 0, `${scan.state}: axe violations.`);
  assert(raw.contracts.length > 0, "Missing behavioral contracts.");
}

function verifyImages(raw) {
  return raw.screenshots.map(screenshot => {
    const bytes = readFileSync(join(directory, screenshot.filename));
    assert(digest(bytes) === screenshot.sha256, `${screenshot.filename}: hash mismatch.`);
    assert(bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])), "Invalid PNG.");
    const dimensions = { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
    assert(dimensions.width === screenshot.viewport.width && dimensions.height >= screenshot.viewport.height, `${screenshot.filename}: dimensions mismatch.`);
    return { ...screenshot, dimensions };
  });
}

if (process.argv[2] === "--package") {
  const captures = [];
  for (const suite of suites) for (const mode of ["baseline", "after"]) {
    const filename = `${suite}-${mode}-manifest.json`, bytes = readFileSync(join(directory, filename)), raw = JSON.parse(bytes);
    assert(raw.mode === mode, "Wrong capture mode."); verifySource(raw); verifyRendered(raw);
    const compressed = gzipSync(bytes, { level: 9 }), losslessFilename = `${suite}-${mode}-measurements.json.gz`;
    writeFileSync(join(directory, losslessFilename), compressed);
    captures.push({ suite, mode, sourceIdentity: raw.sourceIdentity, browser: raw.browser ?? { name: "Chromium", version: raw.browserVersion }, fixture: raw.fixture, filename: losslessFilename, sha256: digest(compressed), uncompressedSha256: digest(bytes), bytes: compressed.length, measurements: raw.measurements.length, geometryStates: raw.measurements.filter(record => record.document).length, axeScans: raw.accessibility.filter(record => record.violations).length, contracts: raw.contracts, screenshots: verifyImages(raw), limitations: raw.limitations ?? [], responsiveStates: raw.measurements.filter(record => record.document).map(({ state, locale, viewport, document }) => ({ state, locale, viewport, document })) });
  }
  const supportingArtifacts = readdirSync(directory).filter(file => /^(environment|cleanup|execution|baseline-failed)/.test(file) && file.endsWith(".json")).map(filename => ({ filename, sha256: digest(readFileSync(join(directory, filename))) }));
  writeFileSync(join(directory, "manifest.json"), encode({ task: "UI_PHASE_5E_PROFILE_CUSTOM_FOOD_SECONDARY_UX_001", approvedHead, approvedTree, verification: "node docs/ui-phase5e/evidence/verify-evidence.mjs --verify docs/ui-phase5e/evidence .", verifierSha256: digest(readFileSync(join(directory, "verify-evidence.mjs"))), captures, supportingArtifacts }));
} else if (process.argv[2] === "--verify") {
  const packet = JSON.parse(readFileSync(join(directory, "manifest.json")));
  assert(packet.verifierSha256 === digest(readFileSync(join(directory, "verify-evidence.mjs"))), "Verifier integrity mismatch.");
  assert(packet.captures.length === 6, "Expected all six captures.");
  for (const capture of packet.captures) {
    const bytes = readFileSync(join(directory, capture.filename)), original = gunzipSync(bytes), raw = JSON.parse(original);
    assert(digest(bytes) === capture.sha256 && digest(original) === capture.uncompressedSha256, `${capture.filename}: integrity mismatch.`);
    verifySource(raw); verifyRendered(raw); verifyImages(raw);
  }
  for (const artifact of packet.supportingArtifacts) assert(digest(readFileSync(join(directory, artifact.filename))) === artifact.sha256, `${artifact.filename}: integrity mismatch.`);
  console.log(JSON.stringify({ status: "PASS", captures: packet.captures.length, screenshots: packet.captures.reduce((sum, capture) => sum + capture.screenshots.length, 0), geometryStates: packet.captures.reduce((sum, capture) => sum + capture.geometryStates, 0), axeScans: packet.captures.reduce((sum, capture) => sum + capture.axeScans, 0) }));
} else throw new Error("Use --package or --verify followed by evidence directory and repository.");
