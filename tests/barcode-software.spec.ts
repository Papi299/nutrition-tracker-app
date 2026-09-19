import { expect, test } from "@playwright/test";
import { normalizeSoftwareDetections } from "@/lib/barcodes/scanner-software";
import { reduceScannerDetections } from "@/lib/barcodes/scanner-detection";

test("software results converge on the canonical GTIN rules, including ITF-14", () => {
  for (const [format, rawValue, canonical] of [
    ["ean_8", "96385074", "00000096385074"],
    ["ean_13", "4006381333931", "04006381333931"],
    ["upc_a", "036000291452", "00036000291452"],
    ["itf_14", "10012345000017", "10012345000017"],
  ] as const) {
    expect(reduceScannerDetections(normalizeSoftwareDetections([{ format, rawValue }]))).toEqual({
      canonical_gtin: canonical,
      status: "accepted",
    });
  }
});

test("software results preserve rejection, leading zeroes, and ambiguity", () => {
  for (const format of ["upc_e", "qr_code", "data_matrix", "pdf417", "aztec"]) {
    expect(reduceScannerDetections(normalizeSoftwareDetections([{ format, rawValue: "96385074" }]))).toEqual({ status: "unsupported" });
  }
  expect(reduceScannerDetections(normalizeSoftwareDetections([{ format: "ean_8", rawValue: "96385075" }]))).toEqual({ status: "invalid" });
  expect(reduceScannerDetections(normalizeSoftwareDetections([
    { format: "upc_a", rawValue: "036000291452" },
    { format: "ean_13", rawValue: "0036000291452" },
  ]))).toEqual({ canonical_gtin: "00036000291452", status: "accepted" });
  expect(reduceScannerDetections(normalizeSoftwareDetections([
    { format: "ean_8", rawValue: "96385074" },
    { format: "ean_13", rawValue: "4006381333931" },
  ]))).toEqual({ status: "multiple" });
});
