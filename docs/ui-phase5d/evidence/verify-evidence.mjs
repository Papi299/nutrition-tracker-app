import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { copyFileSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { gzipSync, gunzipSync } from "node:zlib";

const approvedHead = "b6a402ef2b970495fa82a0539531fc43da0e105c";
const approvedTree = "68770f220c4be3b95354aecf8ad9f7fb08ee56fa";
const sourceFiles = ["components/recipes/recipe-form.tsx", "components/recipes/recipe-page.tsx", "components/recipes/recipe-nutrition-summary.tsx", "components/recipes/recipe-use-preview.tsx", "components/recipes/recipe-use-confirmation.tsx", "messages/en.json", "messages/he.json"];
const sha256 = bytes => createHash("sha256").update(bytes).digest("hex");
const assert = (condition, message) => { if (!condition) throw new Error(message); };
const encode = value => Buffer.from(`${JSON.stringify(value, null, 2)}\n`);
const git = (repository, ...args) => execFileSync("git", args, { cwd: repository, encoding: "utf8" }).trim();
const args = Object.fromEntries(process.argv.slice(2).reduce((entries, arg, index, all) => { if (arg.startsWith("--")) entries.push([arg.slice(2), all[index + 1] ?? true]); return entries; }, []));
function dimensions(bytes) { assert(bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])), "Invalid PNG signature."); return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) }; }
function verifySource(manifest, repository, current = false) {
  const identity = manifest.sourceIdentity;
  assert(git(repository, "rev-parse", `${identity.head}^{tree}`) === identity.tree, `${manifest.mode}: tree mismatch.`);
  assert(identity.productionDiffSha256 === sha256(""), `${manifest.mode}: capture must use committed unchanged production source.`);
  assert(Object.keys(identity.sourceFileSha256).sort().join("\n") === [...sourceFiles].sort().join("\n"), "Unexpected production source inventory.");
  if (manifest.mode === "baseline") assert(identity.head === approvedHead && identity.tree === approvedTree, "Approved baseline mismatch.");
  for (const [file, expected] of Object.entries(identity.sourceFileSha256)) { const bytes = execFileSync("git", ["show", `${identity.head}:${file}`], { cwd: repository }); assert(sha256(bytes) === expected, `${manifest.mode}: committed hash mismatch ${file}.`); if (current) assert(sha256(readFileSync(join(repository, file))) === expected, `${manifest.mode}: current source differs ${file}.`); }
  if (current) execFileSync("git", ["merge-base", "--is-ancestor", identity.head, "HEAD"], { cwd: repository });
}
function verifyRendered(manifest) {
  if (manifest.mode !== "after") return;
  for (const record of manifest.measurements.filter(record => record.document)) {
    const state = `${record.state}/${record.locale}/${record.viewport.width}`;
    assert(record.document.scrollWidth <= record.document.clientWidth && record.body.scrollWidth <= record.document.clientWidth, `${state}: page overflow.`);
    for (const element of [...record.pickers, ...record.results, ...record.cards, ...record.controls, ...record.text]) assert(element.x >= -0.5 && element.right <= record.document.clientWidth + 0.5, `${state}: offscreen element.`);
    for (const element of [...record.pickers, ...record.results, ...record.cards]) assert(element.scrollWidth <= element.clientWidth + 1, `${state}: internal overflow.`);
    for (const control of record.controls.filter(control => control.tag === "BUTTON" && !control.disabled)) assert(control.width >= 44 && control.height >= 44, `${state}: undersized enabled control.`);
    for (const element of record.text) assert(element.overflow !== "hidden" && element.textOverflow !== "ellipsis", `${state}: hidden meaningful text.`);
  }
  for (const check of manifest.accessibility) assert(check.violations.length === 0, `${check.state}: axe violations.`);
  assert(manifest.contracts.some(contract => contract.state === "nutrition-fidelity" && contract.allFourPerspectivesCompared), "Missing authoritative nutrition comparison.");
  assert(manifest.contracts.some(contract => contract.state === "native-review-confirmation" && contract.explicitNativePost), "Missing actual native confirmation database assertion.");
}
function compact(raw) {
  return { ...raw, measurements: raw.measurements.map(record => !record.document ? record : { ...record,
    controls: record.controls.filter(control => control.name === "date" || control.name === "servings" || control.name === "mealType" || control.name === "" || control.name?.includes("quantity_0") || control.name?.includes("unit_0")),
    controlSummary: { count: record.controls.length, minimumEnabledButtonWidth: Math.min(...record.controls.filter(control => control.tag === "BUTTON" && !control.disabled).map(control => control.width)), minimumEnabledButtonHeight: Math.min(...record.controls.filter(control => control.tag === "BUTTON" && !control.disabled).map(control => control.height)) },
    text: record.text.map(({ text, ...geometry }) => ({ ...geometry, characters: (text ?? "").length, sha256: sha256(text ?? "") })),
  }), representation: "Exact cards/picker/results, representative controls and all directional/error measurements; lossless gzip retains every original control and rendered text." };
}
function packageCapture(directory, mode, output, repository) {
  const original = readFileSync(join(directory, `${mode}-manifest.json`)), raw = JSON.parse(original); assert(raw.mode === mode, "Wrong capture mode."); verifySource(raw, repository, mode === "after"); verifyRendered(raw);
  const lossless = gzipSync(original, { level: 9 }), compactBytes = encode(compact(raw)); const gzipFile = `${mode}-measurements.json.gz`, compactFile = `${mode}-manifest.json`;
  writeFileSync(join(output, gzipFile), lossless); writeFileSync(join(output, compactFile), compactBytes);
  const screenshots = raw.screenshots.map(screenshot => { const bytes = readFileSync(join(directory, screenshot.filename)); assert(sha256(bytes) === screenshot.sha256, `${screenshot.filename}: screenshot hash mismatch.`); const size = dimensions(bytes); assert(size.width === screenshot.viewport.width && size.height === screenshot.viewport.height, "Screenshot size differs from viewport."); if (resolve(directory) !== resolve(output)) copyFileSync(join(directory, screenshot.filename), join(output, screenshot.filename)); return { ...screenshot, dimensions: size }; });
  return { mode, sourceIdentity: raw.sourceIdentity, browser: raw.browser, compact: { filename: compactFile, sha256: sha256(compactBytes), bytes: compactBytes.length }, original: { filename: gzipFile, sha256: sha256(lossless), bytes: lossless.length, uncompressedSha256: sha256(original), uncompressedBytes: original.length }, measurementRecords: raw.measurements.length, screenshots, axeScans: raw.accessibility.length, contractRecords: raw.contracts.length };
}
if (args["verify-packet"]) {
  const directory = resolve(args["verify-packet"]), repository = resolve(args.repository ?? "."), packet = JSON.parse(readFileSync(join(directory, "manifest.json")));
  assert(sha256(readFileSync(join(directory, packet.verifier.filename))) === packet.verifier.sha256, "Verifier hash mismatch.");
  for (const capture of packet.captures) {
    const compressed = readFileSync(join(directory, capture.original.filename)), rawBytes = gunzipSync(compressed), compactBytes = readFileSync(join(directory, capture.compact.filename)); assert(sha256(compressed) === capture.original.sha256 && sha256(rawBytes) === capture.original.uncompressedSha256 && sha256(compactBytes) === capture.compact.sha256, `${capture.mode}: manifest integrity mismatch.`);
    const raw = JSON.parse(rawBytes); verifySource(raw, repository, capture.mode === "after"); verifyRendered(raw); assert(sha256(encode(compact(raw))) === sha256(compactBytes), "Compact/lossless mismatch.");
    for (const screenshot of capture.screenshots) { const bytes = readFileSync(join(directory, screenshot.filename)); assert(sha256(bytes) === screenshot.sha256, `${screenshot.filename}: integrity mismatch.`); assert(JSON.stringify(dimensions(bytes)) === JSON.stringify(screenshot.dimensions), "PNG dimensions mismatch."); }
  }
  for (const artifact of packet.supportingArtifacts) assert(sha256(readFileSync(join(directory, artifact.filename))) === artifact.sha256, `${artifact.filename}: supporting artifact mismatch.`);
  console.log(JSON.stringify({ status: "PASS", captures: packet.captures.length, screenshots: packet.captures.reduce((sum, capture) => sum + capture.screenshots.length, 0), measurementRecords: packet.captures.reduce((sum, capture) => sum + capture.measurementRecords, 0) }));
} else {
  assert(args.baseline && args.after && args.output && args.repository, "Use --baseline DIR --after DIR --output DIR --repository DIR or --verify-packet DIR --repository DIR."); const output = resolve(args.output), repository = resolve(args.repository); mkdirSync(output, { recursive: true });
  const captures = [packageCapture(resolve(args.baseline), "baseline", output, repository), packageCapture(resolve(args.after), "after", output, repository)];
  const supportingArtifacts = readdirSync(output).filter(file => file.endsWith(".json") && !["manifest.json", "baseline-manifest.json", "after-manifest.json"].includes(file)).map(filename => { const bytes = readFileSync(join(output, filename)); return { filename, sha256: sha256(bytes), bytes: bytes.length }; });
  writeFileSync(join(output, "manifest.json"), encode({ task: "UI_PHASE_5D_RECIPE_FORMS_REVIEW_001", description: "Synthetic isolated local evidence; exact baseline and committed changed source. Compact measurements and lossless originals are independently verified.", verification: "node docs/ui-phase5d/evidence/verify-evidence.mjs --verify-packet docs/ui-phase5d/evidence --repository .", verifier: { filename: "verify-evidence.mjs", sha256: sha256(readFileSync(join(output, "verify-evidence.mjs"))) }, supportingArtifacts, captures })); console.log(JSON.stringify({ status: "PACKAGED", captures: captures.length }));
}
