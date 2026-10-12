import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { copyFileSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { basename, join, resolve } from "node:path";
import { gzipSync, gunzipSync } from "node:zlib";

const approvedHead = "a8e75cdb9e3412807e18c10b9ce1a2c3e4fe35d1";
const approvedTree = "f39aafa8f56f1651a45218058667f9c6f30d5bf5";
const sourceFiles = [
  "components/saved-meals/saved-meal-form.tsx",
  "components/saved-meals/saved-meal-page.tsx",
  "components/saved-meals/saved-meal-use-review.tsx",
];
const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
const encode = (value) => Buffer.from(`${JSON.stringify(value, null, 2)}\n`);
const assert = (condition, message) => { if (!condition) throw new Error(message); };
const git = (repository, ...args) => execFileSync("git", args, { cwd: repository, encoding: "utf8" }).trim();
const args = Object.fromEntries(process.argv.slice(2).reduce((entries, argument, index, all) => {
  if (argument.startsWith("--")) entries.push([argument.slice(2), all[index + 1]?.startsWith("--") ? true : all[index + 1] ?? true]);
  return entries;
}, []));

function pngDimensions(bytes) {
  assert(bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])), "Invalid PNG signature.");
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
}

function bounds(element) {
  return Object.fromEntries(["x", "y", "right", "bottom", "width", "height"].filter((field) => element[field] !== undefined).map((field) => [field, element[field]]));
}

function boundsEnvelope(elements) {
  if (!elements.length) return null;
  const values = (field) => elements.map((element) => element[field]);
  return {
    count: elements.length,
    minimumX: Math.min(...values("x")), maximumRight: Math.max(...values("right")),
    minimumY: Math.min(...values("y")), maximumBottom: Math.max(...values("bottom")),
    minimumWidth: Math.min(...values("width")), maximumWidth: Math.max(...values("width")),
    minimumHeight: Math.min(...values("height")), maximumHeight: Math.max(...values("height")),
  };
}

function controlColor(control) {
  return { border: control.border, background: control.background, borderRgb: control.borderRgb, backgroundRgb: control.backgroundRgb, boundaryContrast: control.boundaryContrast };
}

function controlFamilies(controls, colorLookup) {
  const groups = new Map();
  for (const control of controls) {
    const field = control.name?.replace(/_\d+$/, "") ?? null;
    const label = control.tag === "BUTTON" || control.tag === "SELECT" ? control.text : null;
    const key = JSON.stringify([control.tag, field, label, control.disabled]);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(control);
  }
  return [...groups.values()].map((group) => ({
    tag: group[0].tag, field: group[0].name?.replace(/_\d+$/, "") ?? null,
    ...(group[0].tag === "BUTTON" || group[0].tag === "SELECT" ? { label: group[0].text } : {}),
    disabled: group[0].disabled, bounds: boundsEnvelope(group),
    colorIds: [...new Set(group.map((control) => colorLookup.get(JSON.stringify(controlColor(control)))))],
  }));
}

function compactMeasurement(record, colorLookup) {
  if (!record.document) return record;
  const buttons = record.controls.filter((control) => control.tag === "BUTTON" && !control.disabled);
  const inputs = record.controls.filter((control) => control.name && !control.disabled);
  const minimum = (items, property) => items.length ? Math.min(...items.map((item) => item[property])) : null;
  return {
    mode: record.mode, state: record.state, route: record.route, viewport: record.viewport,
    locale: record.locale, direction: record.direction, document: record.document, body: record.body,
    cards: record.cards.map(({ rowKey, position, scrollWidth, clientWidth, ...rectangle }) => ({
      rowKey, position, ...bounds(rectangle), scrollWidth, clientWidth,
    })),
    controlSummary: {
      count: record.controls.length, enabledButtonCount: buttons.length,
      minimumEnabledButtonWidth: minimum(buttons, "width"), minimumEnabledButtonHeight: minimum(buttons, "height"),
      minimumEnabledInputBoundaryContrast: minimum(inputs, "boundaryContrast"),
    },
    controlFamilies: controlFamilies(record.controls, colorLookup),
    linkActions: record.actions.filter((action) => action.href !== null),
    textSummary: {
      bounds: boundsEnvelope(record.text),
      originalTextsSha256: sha256(JSON.stringify(record.text.map((entry) => entry.text))),
      renderedOverflowValues: [...new Set(record.text.map((entry) => entry.overflow))],
      renderedTextOverflowValues: [...new Set(record.text.map((entry) => entry.textOverflow))],
    },
    firstHeadingAndItemTextBounds: record.text.slice(0, 2).map(({ text, overflow, textOverflow, ...rectangle }) => ({
      ...bounds(rectangle), characters: Array.from(text ?? "").length,
      textSha256: sha256(text ?? ""), overflow, textOverflow,
    })),
  };
}

function compactManifest(manifest) {
  const colorLookup = new Map();
  const palette = [];
  for (const record of manifest.measurements.filter((entry) => entry.document)) for (const control of record.controls) {
    const color = controlColor(control), key = JSON.stringify(color);
    if (!colorLookup.has(key)) {
      const id = `color-${palette.length + 1}`;
      colorLookup.set(key, id); palette.push({ id, ...color });
    }
  }
  return {
    ...manifest,
    evidenceRepresentation: {
      geometry: "Exact per-card bounds, per-control-family measured bounds/ranges/colors, touch sizes, representative text bounds and all error navigation; no geometry values are rounded.",
      completeOriginal: `${manifest.mode}-measurements.json.gz`,
      originalText: "Full rendered text and every original measurement remain in the lossless gzip document.",
    },
    renderedControlColorPalette: palette,
    measurements: manifest.measurements.map((record) => compactMeasurement(record, colorLookup)),
  };
}

function verifyGeometry(manifest) {
  if (manifest.mode !== "after") return;
  for (const record of manifest.measurements.filter((entry) => entry.document)) {
    const context = `${record.state}/${record.locale}/${record.viewport.width}`;
    assert(record.document.scrollWidth <= record.document.clientWidth, `${context}: document overflow.`);
    assert(record.body.scrollWidth <= record.document.clientWidth, `${context}: body overflow.`);
    for (const element of [...record.cards, ...record.controls, ...record.actions, ...record.text]) {
      assert(element.x >= -0.5 && element.right <= record.document.clientWidth + 0.5, `${context}: offscreen bounds.`);
    }
    for (const card of record.cards) {
      assert(card.scrollWidth <= card.clientWidth + 1, `${context}: internal card overflow.`);
      for (let i = 0; i < card.actions.length; i += 1) for (let j = i + 1; j < card.actions.length; j += 1) {
        const a = card.actions[i], b = card.actions[j];
        assert(Math.max(0, Math.min(a.right, b.right) - Math.max(a.x, b.x)) * Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.y, b.y)) === 0, `${context}: overlapping item actions.`);
      }
    }
    for (const control of record.controls.filter((entry) => entry.tag === "BUTTON" && !entry.disabled)) {
      assert(control.width >= 44 && control.height >= 44, `${context}: undersized enabled button.`);
    }
    for (const element of record.text) assert(element.overflow !== "hidden" && element.textOverflow !== "ellipsis", `${context}: hidden or truncated text.`);
  }
  for (const check of manifest.accessibility) if (Array.isArray(check.violations)) assert(check.violations.length === 0, `${check.state}: axe violations.`);
}

function readCapture(directory, mode, repository, requireCurrentSource) {
  const raw = readFileSync(join(directory, `${mode}-manifest.json`));
  const manifest = JSON.parse(raw);
  assert(manifest.mode === mode, `Wrong capture mode in ${directory}.`);
  if (mode === "baseline") {
    assert(manifest.sourceIdentity.head === approvedHead && manifest.sourceIdentity.tree === approvedTree, "Baseline commit/tree mismatch.");
    assert(manifest.sourceIdentity.productionDiffSha256 === sha256(""), "Baseline production source was modified.");
  }
  assert(git(repository, "rev-parse", `${manifest.sourceIdentity.head}^{tree}`) === manifest.sourceIdentity.tree, `${mode}: source tree mismatch.`);
  assert(Object.keys(manifest.sourceIdentity.sourceFileSha256).sort().join("\n") === [...sourceFiles].sort().join("\n"), `${mode}: unexpected production inventory.`);
  for (const [file, expected] of Object.entries(manifest.sourceIdentity.sourceFileSha256)) {
    const bytes = requireCurrentSource ? readFileSync(join(repository, file)) : execFileSync("git", ["show", `${manifest.sourceIdentity.head}:${file}`], { cwd: repository });
    assert(sha256(bytes) === expected, `${mode}: source hash mismatch for ${file}.`);
  }
  if (requireCurrentSource) {
    assert(manifest.sourceIdentity.head === git(repository, "rev-parse", "HEAD"), "After capture is not from current HEAD.");
    assert(manifest.sourceIdentity.productionDiffSha256 === sha256(git(repository, "diff", "HEAD", "--", ...sourceFiles)), "After production diff hash mismatch.");
    assert(manifest.sourceIdentity.productionDiffSha256 === sha256(""), "Final after capture requires committed clean production source.");
  }
  const filenames = new Set();
  for (const screenshot of manifest.screenshots) {
    assert(basename(screenshot.filename) === screenshot.filename, "Screenshot path must be a local filename.");
    assert(!filenames.has(screenshot.filename), `${mode}: duplicate screenshot filename ${screenshot.filename}.`);
    filenames.add(screenshot.filename);
    const bytes = readFileSync(join(directory, screenshot.filename));
    assert(sha256(bytes) === screenshot.sha256, `${mode}: screenshot hash mismatch for ${screenshot.filename}.`);
    const dimensions = pngDimensions(bytes);
    assert(dimensions.width === screenshot.viewport.width && dimensions.height === screenshot.viewport.height, `${mode}: screenshot dimension mismatch.`);
  }
  verifyGeometry(manifest);
  return { mode, directory, raw, manifest };
}

function verifyPacket(directory, repository) {
  const index = JSON.parse(readFileSync(join(directory, "manifest.json")));
  assert(JSON.stringify(readdirSync(directory).sort()) === JSON.stringify(index.inventory), "Evidence inventory does not match delivered files.");
  const verifier = readFileSync(join(directory, index.verifier.filename));
  assert(sha256(verifier) === index.verifier.sha256, "Evidence verifier hash mismatch.");
  for (const artifact of index.supportingArtifacts) {
    const bytes = readFileSync(join(directory, artifact.filename));
    assert(sha256(bytes) === artifact.sha256 && bytes.length === artifact.bytes, `${artifact.filename}: supporting artifact mismatch.`);
  }
  for (const capture of index.captures) {
    const compactBytes = readFileSync(join(directory, capture.compact.filename));
    const compressed = readFileSync(join(directory, capture.original.filename));
    assert(sha256(compactBytes) === capture.compact.sha256, `${capture.mode}: compact artifact hash mismatch.`);
    assert(sha256(compressed) === capture.original.sha256, `${capture.mode}: compressed artifact hash mismatch.`);
    const raw = gunzipSync(compressed);
    assert(sha256(raw) === capture.original.uncompressedSha256, `${capture.mode}: original artifact hash mismatch.`);
    const manifest = JSON.parse(raw);
    assert(JSON.stringify(capture.sourceIdentity) === JSON.stringify(manifest.sourceIdentity), `${capture.mode}: index source identity mismatch.`);
    assert(encode(compactManifest(manifest)).equals(compactBytes), `${capture.mode}: compact data does not match original.`);
    assert(git(repository, "rev-parse", `${manifest.sourceIdentity.head}^{tree}`) === manifest.sourceIdentity.tree, `${capture.mode}: source tree mismatch.`);
    execFileSync("git", ["merge-base", "--is-ancestor", manifest.sourceIdentity.head, "HEAD"], { cwd: repository });
    for (const [file, hash] of Object.entries(manifest.sourceIdentity.sourceFileSha256)) {
      assert(sha256(execFileSync("git", ["show", `${manifest.sourceIdentity.head}:${file}`], { cwd: repository })) === hash, `${capture.mode}: committed production source mismatch.`);
      if (capture.mode === "after") assert(sha256(readFileSync(join(repository, file))) === hash, `Current production source differs from the after capture: ${file}.`);
    }
    if (capture.mode === "after") assert(git(repository, "diff", "HEAD", "--", ...sourceFiles) === "", "Current production source has uncommitted changes.");
    const filenames = new Set();
    for (const shot of manifest.screenshots) {
      assert(!filenames.has(shot.filename), `${capture.mode}: duplicate screenshot.`); filenames.add(shot.filename);
      const bytes = readFileSync(join(directory, shot.filename));
      assert(sha256(bytes) === shot.sha256, `${capture.mode}: screenshot hash mismatch.`);
      const size = pngDimensions(bytes);
      assert(size.width === shot.viewport.width && size.height === shot.viewport.height, `${capture.mode}: screenshot dimension mismatch.`);
    }
    assert(JSON.stringify(capture.screenshots) === JSON.stringify(manifest.screenshots.map((shot) => ({ ...shot, dimensions: shot.viewport }))), `${capture.mode}: screenshot index mismatch.`);
    verifyGeometry(manifest);
  }
  console.log(JSON.stringify({ verified: true, captures: index.captures.length, screenshots: index.captures.reduce((count, capture) => count + capture.screenshots.length, 0) }));
}

const repository = resolve(args.repository ?? process.cwd());
if (args["verify-packet"]) {
  verifyPacket(resolve(args["verify-packet"]), repository);
} else {
  assert(typeof args.baseline === "string" && typeof args.after === "string" && typeof args.output === "string", "Use --baseline DIR --after DIR --output DIR --repository DIR; or --verify-packet DIR --repository DIR.");
  const captures = [readCapture(resolve(args.baseline), "baseline", repository, false), readCapture(resolve(args.after), "after", repository, true)];
  const output = resolve(args.output);
  const index = {
    task: "UI_PHASE_5C_SAVED_MEAL_FORMS_REVIEW_001",
    description: "Synthetic local evidence. The compact manifests preserve exact geometry and source identity; lossless gzip files preserve the complete original JSON captures.",
    verification: "Run node verify-evidence.mjs --verify-packet . --repository /path/to/checkout from this directory.",
    verifier: { filename: "verify-evidence.mjs", sha256: sha256(readFileSync(new URL(import.meta.url))) },
    supportingArtifacts: ["environment-safety-pre-cleanup.json", "cleanup-safe.json"].map((filename) => {
      const bytes = readFileSync(join(output, filename));
      return { filename, sha256: sha256(bytes), bytes: bytes.length };
    }),
    captures: [],
  };
  // All source, geometry and screenshot checks finish before creating the packet.
  mkdirSync(output, { recursive: true });
  for (const capture of captures) {
    const compact = encode(compactManifest(capture.manifest));
    const original = gzipSync(capture.raw, { level: 9, mtime: 0 });
    const compactName = `${capture.mode}-manifest.json`, originalName = `${capture.mode}-measurements.json.gz`;
    writeFileSync(join(output, compactName), compact); writeFileSync(join(output, originalName), original);
    for (const shot of capture.manifest.screenshots) copyFileSync(join(capture.directory, shot.filename), join(output, shot.filename));
    index.captures.push({
      mode: capture.mode, sourceIdentity: capture.manifest.sourceIdentity, browser: capture.manifest.browser,
      compact: { filename: compactName, sha256: sha256(compact), bytes: compact.length },
      original: { filename: originalName, sha256: sha256(original), bytes: original.length, uncompressedSha256: sha256(capture.raw), uncompressedBytes: capture.raw.length },
      measurementRecords: capture.manifest.measurements.length,
      screenshots: capture.manifest.screenshots.map((shot) => ({ ...shot, dimensions: shot.viewport })),
      axeScans: capture.manifest.accessibility.filter((check) => Array.isArray(check.violations)).length,
    });
  }
  copyFileSync(new URL(import.meta.url), join(output, "verify-evidence.mjs"));
  index.inventory = ["manifest.json", index.verifier.filename, ...index.supportingArtifacts.map((artifact) => artifact.filename), ...index.captures.flatMap((capture) => [capture.compact.filename, capture.original.filename, ...capture.screenshots.map((shot) => shot.filename)])].sort();
  writeFileSync(join(output, "manifest.json"), encode(index));
  verifyPacket(output, repository);
  console.log(JSON.stringify({ output, artifacts: index.captures.map(({ mode, compact, original, measurementRecords, screenshots }) => ({ mode, compactBytes: compact.bytes, originalCompressedBytes: original.bytes, originalBytes: original.uncompressedBytes, measurementRecords, screenshots: screenshots.length })) }));
}
