import { expect, test } from "@playwright/test";
import {
  approvedNativeBarcodeFormats,
  createNativeBarcodeDetector,
  resolveNativeScannerCapability,
  type NativeBarcodeDetection,
} from "@/lib/barcodes/scanner-capabilities";
import {
  classifyCameraError,
  reduceScannerDetections,
} from "@/lib/barcodes/scanner-detection";
import { createScannerLifecycle } from "@/lib/barcodes/scanner-lifecycle";

function detectorConstructor(
  supportedFormats: string[] | Error,
  receivedOptions?: Array<{ formats: string[] }>,
) {
  return class TestBarcodeDetector {
    static async getSupportedFormats() {
      if (supportedFormats instanceof Error) throw supportedFormats;
      return supportedFormats;
    }

    constructor(options: { formats: string[] }) {
      receivedOptions?.push(options);
    }

    async detect() {
      return [];
    }
  };
}

function capabilityEnvironment(overrides: Record<string, unknown> = {}) {
  return {
    barcodeDetector: detectorConstructor(["ean_13"]),
    isSecureContext: true,
    mediaDevices: { getUserMedia: async () => ({}) },
    ...overrides,
  };
}

function detection(
  format: string,
  rawValue: string,
): NativeBarcodeDetection {
  return { format, rawValue };
}

test.describe("native scanner capability resolution", () => {
  test("requires a secure context, media API, detector, and supported-format API", async () => {
    const cases = [
      { isSecureContext: false },
      { mediaDevices: undefined },
      { mediaDevices: {} },
      { barcodeDetector: undefined },
      { barcodeDetector: class MissingStatic {} },
    ];

    for (const overrides of cases) {
      await expect(
        resolveNativeScannerCapability(capabilityEnvironment(overrides)),
      ).resolves.toEqual({ status: "unavailable" });
    }
  });

  test("fails closed for rejected, empty, and non-approved format results", async () => {
    for (const supportedFormats of [
      new Error("unsupported"),
      [],
      ["qr_code", "upc_e", "data_matrix"],
    ]) {
      await expect(
        resolveNativeScannerCapability(
          capabilityEnvironment({
            barcodeDetector: detectorConstructor(supportedFormats),
          }),
        ),
      ).resolves.toEqual({ status: "unavailable" });
    }
  });

  test("keeps only the exact approved runtime intersection", async () => {
    const one = await resolveNativeScannerCapability(
      capabilityEnvironment({
        barcodeDetector: detectorConstructor(["ean_8"]),
      }),
    );
    expect(one).toMatchObject({ formats: ["ean_8"], status: "available" });

    const several = await resolveNativeScannerCapability(
      capabilityEnvironment({
        barcodeDetector: detectorConstructor([
          "unknown_future_format",
          "itf",
          "upc_e",
          "ean_13",
          "upc_a",
          "ean_8",
          "qr_code",
        ]),
      }),
    );
    expect(several).toMatchObject({
      formats: [...approvedNativeBarcodeFormats],
      status: "available",
    });
  });

  test("constructs the detector with only the approved intersection", async () => {
    const received: Array<{ formats: string[] }> = [];
    const capability = await resolveNativeScannerCapability(
      capabilityEnvironment({
        barcodeDetector: detectorConstructor(
          ["qr_code", "upc_a", "itf", "upc_e"],
          received,
        ),
      }),
    );
    expect(capability.status).toBe("available");
    if (capability.status !== "available") return;

    createNativeBarcodeDetector(capability);
    expect(received).toEqual([{ formats: ["upc_a", "itf"] }]);
  });
});

test.describe("format-aware native barcode detection", () => {
  test("accepts exact EAN-8, UPC-A, EAN-13, and ITF-14 values", () => {
    const cases = [
      ["ean_8", "96385074", "00000096385074"],
      ["upc_a", "036000291452", "00036000291452"],
      ["ean_13", "4006381333931", "04006381333931"],
      ["itf", "10012345000017", "10012345000017"],
    ] as const;

    for (const [format, rawValue, canonicalGtin] of cases) {
      expect(reduceScannerDetections([detection(format, rawValue)])).toEqual({
        canonical_gtin: canonicalGtin,
        status: "accepted",
      });
    }
  });

  test("treats leading-zero EAN-13 and UPC-A as one canonical identity", () => {
    expect(
      reduceScannerDetections([
        detection("ean_13", "0036000291452"),
        detection("upc_a", "036000291452"),
      ]),
    ).toEqual({ canonical_gtin: "00036000291452", status: "accepted" });
  });

  test("rejects invalid, ISBN, mismatched, non-ASCII, empty, and overlong values", () => {
    const invalid = [
      detection("ean_8", "96385075"),
      detection("ean_13", "9780306406157"),
      detection("ean_13", "9791090636071"),
      detection("itf", "036000291452"),
      detection("ean_8", "036000291452"),
      detection("ean_8", "٩٦٣٨٥٠٧٤"),
      detection("ean_8", ""),
      detection("ean_13", "400638133393100000"),
    ];

    for (const value of invalid) {
      expect(reduceScannerDetections([value])).toEqual({ status: "invalid" });
    }
  });

  test("never interprets UPC-E or another unsupported symbol as a GTIN", () => {
    for (const value of [
      detection("upc_e", "96385074"),
      detection("qr_code", "036000291452"),
      detection("data_matrix", "036000291452"),
      detection("unknown", "036000291452"),
      detection("code_128", "036000291452"),
    ]) {
      expect(reduceScannerDetections([value])).toEqual({
        status: "unsupported",
      });
    }
  });

  test("reduces empty, duplicate, mixed, and multiple result sets safely", () => {
    expect(reduceScannerDetections([])).toEqual({ status: "none" });
    expect(
      reduceScannerDetections([
        detection("upc_a", "036000291452"),
        detection("upc_a", "036000291452"),
      ]),
    ).toEqual({ canonical_gtin: "00036000291452", status: "accepted" });
    expect(
      reduceScannerDetections([
        detection("qr_code", "ignored"),
        detection("upc_a", "036000291452"),
      ]),
    ).toEqual({ canonical_gtin: "00036000291452", status: "accepted" });
    expect(
      reduceScannerDetections([
        detection("ean_8", "bad"),
        detection("upc_a", "036000291452"),
      ]),
    ).toEqual({ canonical_gtin: "00036000291452", status: "accepted" });
    expect(
      reduceScannerDetections([
        detection("upc_a", "036000291452"),
        detection("ean_13", "4006381333931"),
      ]),
    ).toEqual({ status: "multiple" });
  });
});

test.describe("scanner camera-error classification", () => {
  test("maps stable browser failure names without exposing raw content", () => {
    const cases = {
      AbortError: "camera_aborted",
      NotAllowedError: "permission_denied",
      NotFoundError: "camera_unavailable",
      NotReadableError: "camera_busy",
      OverconstrainedError: "constraint_failure",
      SecurityError: "security_error",
      UnknownError: "camera_error",
    } as const;

    for (const [name, expected] of Object.entries(cases)) {
      expect(classifyCameraError({ message: "private details", name })).toBe(
        expected,
      );
    }
    expect(classifyCameraError(null)).toBe("camera_error");
  });
});

test.describe("scanner lifecycle ownership", () => {
  function resources() {
    let scheduleCancellations = 0;
    let trackStops = 0;
    const video = { srcObject: {} as unknown };
    const stream = {
      getTracks: () => [
        {
          stop: () => {
            trackStops += 1;
          },
        },
      ],
    };
    return {
      cancelSchedule: () => {
        scheduleCancellations += 1;
      },
      counts: () => ({ scheduleCancellations, trackStops }),
      stream,
      video,
    };
  }

  test("cancels owned work idempotently and ignores stale sessions", () => {
    const lifecycle = createScannerLifecycle();
    const first = lifecycle.begin();
    const firstResources = resources();
    expect(
      lifecycle.ownStream(first, firstResources.stream, firstResources.video),
    ).toBe(true);
    expect(
      lifecycle.ownSchedule(first, firstResources.cancelSchedule),
    ).toBe(true);

    lifecycle.cancel();
    lifecycle.cancel();
    expect(firstResources.counts()).toEqual({
      scheduleCancellations: 1,
      trackStops: 1,
    });
    expect(firstResources.video.srcObject).toBeNull();
    expect(lifecycle.isCurrent(first)).toBe(false);

    const staleResources = resources();
    expect(
      lifecycle.ownStream(first, staleResources.stream, staleResources.video),
    ).toBe(false);
    expect(staleResources.counts().trackStops).toBe(1);
  });

  test("new starts release prior resources and only current success navigates once", () => {
    const lifecycle = createScannerLifecycle();
    const first = lifecycle.begin();
    const firstResources = resources();
    lifecycle.ownStream(first, firstResources.stream, firstResources.video);
    lifecycle.ownSchedule(first, firstResources.cancelSchedule);

    const second = lifecycle.begin();
    expect(firstResources.counts()).toEqual({
      scheduleCancellations: 1,
      trackStops: 1,
    });
    expect(lifecycle.navigateOnce(first)).toBe(false);
    expect(lifecycle.navigateOnce(second)).toBe(true);
    expect(lifecycle.navigateOnce(second)).toBe(false);

    const secondResources = resources();
    lifecycle.ownStream(second, secondResources.stream, secondResources.video);
    expect(lifecycle.release(second)).toBe(true);
    expect(lifecycle.release(second)).toBe(true);
    expect(secondResources.counts().trackStops).toBe(1);
    expect(secondResources.video.srcObject).toBeNull();
  });
});
