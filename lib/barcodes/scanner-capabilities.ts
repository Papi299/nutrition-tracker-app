export const approvedNativeBarcodeFormats = [
  "ean_8",
  "ean_13",
  "upc_a",
  "itf",
] as const;

export const approvedSoftwareBarcodeFormats = [
  ...approvedNativeBarcodeFormats,
  "itf_14",
] as const;

export type ApprovedNativeBarcodeFormat =
  (typeof approvedNativeBarcodeFormats)[number];

export type NativeBarcodeDetection = {
  format: string;
  rawValue: string;
};

export type NativeBarcodeDetector = {
  detect(source: HTMLVideoElement): Promise<NativeBarcodeDetection[]>;
};

export type NativeBarcodeDetectorConstructor = {
  new (options: {
    formats: ApprovedNativeBarcodeFormat[];
  }): NativeBarcodeDetector;
  getSupportedFormats(): Promise<string[]>;
};

type ScannerCapabilityEnvironment = {
  barcodeDetector: unknown;
  isSecureContext: boolean;
  mediaDevices: unknown;
};

export type NativeScannerCapability =
  | { status: "unavailable" }
  | {
      detector: NativeBarcodeDetectorConstructor;
      formats: ApprovedNativeBarcodeFormat[];
      status: "available";
    };

export type ScannerCapability =
  | { status: "unavailable" }
  | ({ backend: "native" } & Extract<NativeScannerCapability, { status: "available" }>)
  | { backend: "software"; status: "available" };

function hasGetUserMedia(
  value: unknown,
): value is { getUserMedia: (...args: unknown[]) => Promise<unknown> } {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as { getUserMedia?: unknown }).getUserMedia === "function"
  );
}

function isDetectorConstructor(
  value: unknown,
): value is NativeBarcodeDetectorConstructor {
  return (
    typeof value === "function" &&
    typeof (value as unknown as { getSupportedFormats?: unknown })
      .getSupportedFormats === "function"
  );
}

export async function resolveNativeScannerCapability({
  barcodeDetector,
  isSecureContext,
  mediaDevices,
}: ScannerCapabilityEnvironment): Promise<NativeScannerCapability> {
  if (
    !isSecureContext ||
    !hasGetUserMedia(mediaDevices) ||
    !isDetectorConstructor(barcodeDetector)
  ) {
    return { status: "unavailable" };
  }

  let supportedFormats: string[];
  try {
    supportedFormats = await barcodeDetector.getSupportedFormats();
  } catch {
    return { status: "unavailable" };
  }

  if (!Array.isArray(supportedFormats)) {
    return { status: "unavailable" };
  }

  const supported = new Set(supportedFormats);
  const formats = approvedNativeBarcodeFormats.filter((format) =>
    supported.has(format),
  );

  return formats.length === 0
    ? { status: "unavailable" }
    : { detector: barcodeDetector, formats, status: "available" };
}

export function createNativeBarcodeDetector(
  capability: Extract<NativeScannerCapability, { status: "available" }>,
) {
  return new capability.detector({ formats: [...capability.formats] });
}

export async function resolveScannerCapability(
  environment: ScannerCapabilityEnvironment,
): Promise<ScannerCapability> {
  if (!environment.isSecureContext || !hasGetUserMedia(environment.mediaDevices)) {
    return { status: "unavailable" };
  }

  const native = await resolveNativeScannerCapability(environment);
  return native.status === "available"
    ? { ...native, backend: "native" }
    : { backend: "software", status: "available" };
}

export function createScannerBackendDetector(
  capability: Extract<ScannerCapability, { status: "available" }>,
  loadSoftware: () => Promise<NativeBarcodeDetector>,
): NativeBarcodeDetector | Promise<NativeBarcodeDetector> {
  if (capability.backend === "native") {
    try {
      return createNativeBarcodeDetector(capability);
    } catch {
      // A broken native constructor can fall back before camera permission.
    }
  }
  return loadSoftware();
}
