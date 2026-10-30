import { inflateRawSync } from "node:zlib";
import { foundationSafetyBounds } from "../contract.ts";
import { full35Fail } from "./contract.ts";

function crc32(bytes: Uint8Array) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return (crc ^ 0xffffffff) >>> 0;
}

// Pure, bounded reader for the approved single-JSON-member ZIP layout. No disk
// extraction, path resolution, ZIP64, encryption, or external process is used.
export function extractFoundationFull35Json(bytes: Uint8Array, expectedName: string) {
  const fail = () => full35Fail("source_identity_mismatch");
  if (bytes.byteLength > foundationSafetyBounds.maximumArchiveBytes || bytes.byteLength < 22 ||
    !/^[A-Za-z0-9_-]+\.json$/.test(expectedName)) fail();
  const zip = Buffer.from(bytes);
  let end = -1;
  for (let offset = zip.length - 22; offset >= Math.max(0, zip.length - 65557); offset -= 1) {
    if (zip.readUInt32LE(offset) === 0x06054b50 && offset + 22 + zip.readUInt16LE(offset + 20) === zip.length) {
      end = offset; break;
    }
  }
  if (end < 0) fail();
  const centralSize = zip.readUInt32LE(end + 12), central = zip.readUInt32LE(end + 16);
  if (zip.readUInt16LE(end + 4) !== 0 || zip.readUInt16LE(end + 6) !== 0 ||
    zip.readUInt16LE(end + 8) !== 1 || zip.readUInt16LE(end + 10) !== 1 ||
    centralSize < 46 || central + centralSize !== end || central + 46 > end ||
    zip.readUInt32LE(central) !== 0x02014b50) fail();
  const flags = zip.readUInt16LE(central + 8), method = zip.readUInt16LE(central + 10);
  const crc = zip.readUInt32LE(central + 16), compressed = zip.readUInt32LE(central + 20);
  const uncompressed = zip.readUInt32LE(central + 24), nameLength = zip.readUInt16LE(central + 28);
  const extraLength = zip.readUInt16LE(central + 30), commentLength = zip.readUInt16LE(central + 32);
  if ((flags & ~0x0808) !== 0 || ![0, 8].includes(method) ||
    uncompressed > foundationSafetyBounds.maximumJsonBytes || zip.readUInt16LE(central + 34) !== 0 ||
    zip.readUInt32LE(central + 42) !== 0 || 46 + nameLength + extraLength + commentLength !== centralSize) fail();
  const name = zip.subarray(central + 46, central + 46 + nameLength);
  if (!name.equals(Buffer.from(expectedName, "utf8"))) fail();
  if (central < 30 || zip.readUInt32LE(0) !== 0x04034b50 ||
    zip.readUInt16LE(6) !== flags || zip.readUInt16LE(8) !== method ||
    zip.readUInt16LE(26) !== nameLength) fail();
  const dataStart = 30 + nameLength + zip.readUInt16LE(28), dataEnd = dataStart + compressed;
  if (dataStart > central || dataEnd > central || !zip.subarray(30, 30 + nameLength).equals(name)) fail();
  if ((flags & 8) === 0) {
    if (dataEnd !== central || zip.readUInt32LE(14) !== crc ||
      zip.readUInt32LE(18) !== compressed || zip.readUInt32LE(22) !== uncompressed) fail();
  } else {
    const descriptor = central - dataEnd;
    if (![12, 16].includes(descriptor)) fail();
    const start = dataEnd + (descriptor === 16 ? 4 : 0);
    if ((descriptor === 16 && zip.readUInt32LE(dataEnd) !== 0x08074b50) ||
      zip.readUInt32LE(start) !== crc || zip.readUInt32LE(start + 4) !== compressed ||
      zip.readUInt32LE(start + 8) !== uncompressed) fail();
  }
  let result: Buffer;
  try {
    result = method === 0 ? zip.subarray(dataStart, dataEnd) :
      inflateRawSync(zip.subarray(dataStart, dataEnd), { maxOutputLength: foundationSafetyBounds.maximumJsonBytes });
  } catch { return fail(); }
  if (result.length !== uncompressed || crc32(result) !== crc) fail();
  try { return new TextDecoder("utf-8", { fatal: true }).decode(result); }
  catch { return fail(); }
}
