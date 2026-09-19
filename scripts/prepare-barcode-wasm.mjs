import { createHash } from "node:crypto";
import { copyFile, mkdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const source = path.join(root, "node_modules/zxing-wasm/dist/reader/zxing_reader.wasm");
const destination = path.join(root, "public/barcode/zxing_reader.wasm");
const expected = {
  detector: "3.2.2",
  wasm: "3.1.3",
  sha256: "2ebda08a93eea3efcd8399cda6b276e6a0b1de4fec60b4d8988a047de4c6d1ba",
};

const lock = JSON.parse(await readFile(path.join(root, "package-lock.json"), "utf8"));
for (const [name, version] of [["barcode-detector", expected.detector], ["zxing-wasm", expected.wasm]]) {
  const entry = lock.packages[`node_modules/${name}`];
  if (entry?.version !== version || !entry.integrity?.startsWith("sha512-")) {
    throw new Error(`Locked ${name} version or registry integrity differs from the approved scanner asset.`);
  }
}
if (lock.packages["node_modules/barcode-detector"].dependencies?.["zxing-wasm"] !== expected.wasm) {
  throw new Error("The detector no longer pins the approved ZXing version.");
}

const contents = await readFile(source);
const digest = createHash("sha256").update(contents).digest("hex");
if (digest !== expected.sha256) {
  throw new Error("The locked ZXing reader WASM digest differs from the approved asset.");
}
await mkdir(path.dirname(destination), { recursive: true });
await copyFile(source, destination);
console.log(`Prepared same-origin barcode WASM: zxing-wasm ${expected.wasm}, SHA-256 ${digest}.`);
