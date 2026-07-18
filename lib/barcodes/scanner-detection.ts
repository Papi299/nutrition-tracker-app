import { validateGtinInput } from "./validation";
import type {
  ApprovedNativeBarcodeFormat,
  NativeBarcodeDetection,
} from "./scanner-capabilities";

const expectedInput = {
  ean_8: { inputKind: "gtin_8", length: 8 },
  ean_13: { inputKind: "gtin_13", length: 13 },
  upc_a: { inputKind: "gtin_12", length: 12 },
  itf: { inputKind: "gtin_14", length: 14 },
} as const satisfies Record<
  ApprovedNativeBarcodeFormat,
  { inputKind: string; length: number }
>;

const approvedFormatSet = new Set<string>(Object.keys(expectedInput));

export type ScannerDetectionResult =
  | { status: "none" }
  | { canonical_gtin: string; status: "accepted" }
  | { status: "invalid" }
  | { status: "unsupported" }
  | { status: "multiple" };

function acceptedCanonicalGtin(detection: NativeBarcodeDetection) {
  if (!approvedFormatSet.has(detection.format)) return null;

  const format = detection.format as ApprovedNativeBarcodeFormat;
  const rule = expectedInput[format];
  if (
    typeof detection.rawValue !== "string" ||
    detection.rawValue.length !== rule.length ||
    !/^[0-9]+$/.test(detection.rawValue)
  ) {
    return null;
  }

  const result = validateGtinInput(detection.rawValue);
  if (!result.ok || result.data.input_kind !== rule.inputKind) return null;
  return result.data.canonical_gtin;
}

export function reduceScannerDetections(
  detections: NativeBarcodeDetection[],
): ScannerDetectionResult {
  if (detections.length === 0) return { status: "none" };

  const accepted = new Set<string>();
  let sawApprovedFormat = false;
  let sawInvalidApprovedDetection = false;
  let sawUnsupportedDetection = false;

  for (const detection of detections) {
    if (!approvedFormatSet.has(detection.format)) {
      sawUnsupportedDetection = true;
      continue;
    }

    sawApprovedFormat = true;
    const canonicalGtin = acceptedCanonicalGtin(detection);
    if (canonicalGtin === null) {
      sawInvalidApprovedDetection = true;
    } else {
      accepted.add(canonicalGtin);
    }
  }

  if (accepted.size > 1) return { status: "multiple" };
  if (accepted.size === 1) {
    return { canonical_gtin: [...accepted][0], status: "accepted" };
  }
  if (sawApprovedFormat || sawInvalidApprovedDetection) {
    return { status: "invalid" };
  }
  return sawUnsupportedDetection ? { status: "unsupported" } : { status: "none" };
}

export type CameraErrorState =
  | "permission_denied"
  | "camera_unavailable"
  | "camera_busy"
  | "constraint_failure"
  | "security_error"
  | "camera_aborted"
  | "camera_error";

export function classifyCameraError(error: unknown): CameraErrorState {
  const name =
    typeof error === "object" && error !== null && "name" in error
      ? (error as { name?: unknown }).name
      : null;

  const states: Record<string, CameraErrorState> = {
    AbortError: "camera_aborted",
    NotAllowedError: "permission_denied",
    NotFoundError: "camera_unavailable",
    NotReadableError: "camera_busy",
    OverconstrainedError: "constraint_failure",
    SecurityError: "security_error",
  };

  return states[typeof name === "string" ? name : ""] ?? "camera_error";
}
