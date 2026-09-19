import {
  BarcodeDetector,
  prepareZXingModule,
  ZXING_WASM_SHA256,
  ZXING_WASM_VERSION,
} from "barcode-detector/ponyfill";
import {
  approvedSoftwareBarcodeFormats,
  type NativeBarcodeDetector,
} from "./scanner-capabilities";

const readerPath = "/barcode/zxing_reader.wasm";
const approvedReaderSha256 =
  "2ebda08a93eea3efcd8399cda6b276e6a0b1de4fec60b4d8988a047de4c6d1ba";
const readerOverrides = {
  locateFile(file: string) {
    if (file !== "zxing_reader.wasm") {
      throw new Error("Unexpected software decoder asset.");
    }
    return readerPath;
  },
};

export function normalizeSoftwareDetections(
  detections: readonly { format: string; rawValue: string }[],
) {
  return detections.map(({ format, rawValue }) => ({
    format: format === "itf_14" ? "itf" : format,
    rawValue,
  }));
}

export async function createSoftwareBarcodeDetector(): Promise<NativeBarcodeDetector> {
  if (
    ZXING_WASM_VERSION !== "3.1.3" ||
    ZXING_WASM_SHA256 !== approvedReaderSha256
  ) {
    throw new Error("The software barcode decoder does not match the local WASM asset.");
  }

  const supported = new Set(await BarcodeDetector.getSupportedFormats());
  if (approvedSoftwareBarcodeFormats.some((format) => !supported.has(format))) {
    throw new Error("The software decoder cannot satisfy the approved barcode formats.");
  }

  await prepareZXingModule({
    fireImmediately: true,
    overrides: readerOverrides,
  });

  const detector = new BarcodeDetector({ formats: [...approvedSoftwareBarcodeFormats] });
  return {
    async detect(video) {
      const detections = await detector.detect(video);
      return normalizeSoftwareDetections(detections);
    },
  };
}
