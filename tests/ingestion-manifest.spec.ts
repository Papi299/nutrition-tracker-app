import { expect, test } from "@playwright/test";
import {
  canonicalizeSourceReleaseManifest,
  fingerprintSourceReleaseManifest,
  parseSourceReleaseManifest,
  SourceReleaseManifestError,
  sourceReleaseManifestContractVersion,
  type SourceReleaseManifestV1,
} from "@/ingestion/contracts/source-release-manifest";

function syntheticFoundationManifest(): SourceReleaseManifestV1 {
  return {
    contract_version: sourceReleaseManifestContractVersion,
    source_code: "usda",
    dataset_code: "usda_fdc_foundation",
    distributor_code: "usda_fdc_direct",
    transformation_code: null,
    original_release_identifier: "synthetic-foundation-release-v1",
    transformation_release_identifier: null,
    publication_date: "2026-01-15",
    acquisition_method: "official_bulk_download",
    official_url: "https://fdc.nal.usda.gov/synthetic-release",
    authorized_delivery_url:
      "https://fdc.nal.usda.gov/synthetic-foundation.json.zip",
    license_identifier: "CC0-1.0",
    attribution: "Synthetic fixture; cite USDA FoodData Central.",
    file_format: "json",
    schema_contract_version: "synthetic-foundation-json-v1",
    archive_name: "synthetic-foundation.json.zip",
    sha256: "a".repeat(64),
    compressed_size: 1_024,
    uncompressed_size: 4_096,
    approval_reference: "synthetic-test-approval",
    reject_policy_version: "synthetic-zero-unreviewed-v1",
  };
}

function expectInvalid(mutator: (manifest: Record<string, unknown>) => void) {
  const manifest: Record<string, unknown> = {
    ...syntheticFoundationManifest(),
  };
  mutator(manifest);
  expect(() => parseSourceReleaseManifest(manifest)).toThrow(
    SourceReleaseManifestError,
  );
}

test.describe("source release manifest V1", () => {
  test("accepts a complete synthetic Foundation manifest", () => {
    expect(parseSourceReleaseManifest(syntheticFoundationManifest())).toEqual(
      syntheticFoundationManifest(),
    );
  });

  test("produces a fixed canonical representation and fingerprint", () => {
    const canonical = canonicalizeSourceReleaseManifest(
      syntheticFoundationManifest(),
    );

    expect(canonical).toContain('"sha256": "aaaaaaaa');
    expect(canonical).toMatch(/^\{"sha256": /);
    expect(fingerprintSourceReleaseManifest(syntheticFoundationManifest())).toBe(
      "454983114046bdfc40cd22537e497c1c9496d84154441c69e38be1c9add33a33",
    );
  });

  test("canonicalizes escaped, Unicode, query-string, and safe-integer values", () => {
    const manifest = syntheticFoundationManifest();
    manifest.original_release_identifier = 'quoted "release" \\ אבג';
    manifest.official_url =
      "https://fdc.nal.usda.gov/release?format=json&kind=foundation";
    manifest.compressed_size = Number.MAX_SAFE_INTEGER - 1;
    manifest.uncompressed_size = Number.MAX_SAFE_INTEGER;

    const canonical = canonicalizeSourceReleaseManifest(manifest);
    expect(JSON.parse(canonical)).toEqual(manifest);
    expect(canonical).toContain('quoted \\"release\\" \\\\ אבג');
    expect(canonical).toContain("format=json&kind=foundation");
    expect(canonical).toContain(String(Number.MAX_SAFE_INTEGER));
  });

  test("canonicalizes present transformations and null reject policies", () => {
    const transformed = syntheticFoundationManifest();
    transformed.transformation_code = "synthetic_flattening";
    transformed.transformation_release_identifier = "synthetic-v1";
    transformed.reject_policy_version = null;

    expect(JSON.parse(canonicalizeSourceReleaseManifest(transformed))).toEqual(
      transformed,
    );
  });

  test("rejects unknown and credential-like fields", () => {
    expectInvalid((manifest) => {
      manifest.unexpected = true;
    });
    expectInvalid((manifest) => {
      manifest.api_key = "not-a-real-key";
    });
  });

  test("rejects every missing field", () => {
    for (const key of Object.keys(syntheticFoundationManifest())) {
      expectInvalid((manifest) => {
        delete manifest[key];
      });
    }
  });

  test("rejects blank and outer-whitespace strings", () => {
    expectInvalid((manifest) => {
      manifest.approval_reference = " ";
    });
    expectInvalid((manifest) => {
      manifest.archive_name = " synthetic.json ";
    });
  });

  test("rejects unsupported contract versions", () => {
    expectInvalid((manifest) => {
      manifest.contract_version = "source-release-manifest/v2";
    });
  });

  test("rejects invalid source, dataset, distributor, and transformation codes", () => {
    for (const key of [
      "source_code",
      "dataset_code",
      "distributor_code",
      "transformation_code",
    ]) {
      expectInvalid((manifest) => {
        manifest[key] = "Invalid Code";
      });
    }
  });

  test("requires transformation identity fields together", () => {
    expectInvalid((manifest) => {
      manifest.transformation_code = "synthetic_flattening";
    });
    expectInvalid((manifest) => {
      manifest.transformation_release_identifier = "synthetic-v1";
    });
  });

  test("accepts an explicit null transformation", () => {
    const parsed = parseSourceReleaseManifest(syntheticFoundationManifest());
    expect(parsed.transformation_code).toBeNull();
    expect(parsed.transformation_release_identifier).toBeNull();
  });

  test("accepts a complete synthetic transformation identity", () => {
    const manifest = syntheticFoundationManifest();
    manifest.transformation_code = "synthetic_flattening";
    manifest.transformation_release_identifier = "synthetic-transform-v1";

    expect(parseSourceReleaseManifest(manifest).transformation_code).toBe(
      "synthetic_flattening",
    );
  });

  test("rejects impossible and malformed publication dates", () => {
    for (const value of ["2026-02-29", "2026-1-01", "0000-01-01"]) {
      expectInvalid((manifest) => {
        manifest.publication_date = value;
      });
    }
  });

  test("rejects HTTP URLs and URL credentials", () => {
    expectInvalid((manifest) => {
      manifest.official_url = "http://fdc.nal.usda.gov/release";
    });
    expectInvalid((manifest) => {
      manifest.authorized_delivery_url =
        "https://user:password@fdc.nal.usda.gov/release";
    });
  });

  test("rejects malformed, uppercase, and nonhex checksums", () => {
    for (const value of ["a".repeat(63), "A".repeat(64), "g".repeat(64)]) {
      expectInvalid((manifest) => {
        manifest.sha256 = value;
      });
    }
  });

  test("rejects zero, negative, fractional, and unsafe sizes", () => {
    for (const value of [0, -1, 1.5, Number.MAX_SAFE_INTEGER + 1]) {
      expectInvalid((manifest) => {
        manifest.compressed_size = value;
      });
    }
  });

  test("rejects an uncompressed size below the compressed size", () => {
    expectInvalid((manifest) => {
      manifest.uncompressed_size = 1;
    });
  });

  test("rejects unsupported file formats", () => {
    expectInvalid((manifest) => {
      manifest.file_format = "xlsx";
    });
  });

  test("rejects unsupported acquisition methods", () => {
    expectInvalid((manifest) => {
      manifest.acquisition_method = "web_scrape";
    });
  });

  test("rejects excessive strings", () => {
    expectInvalid((manifest) => {
      manifest.archive_name = "a".repeat(201);
    });
    expectInvalid((manifest) => {
      manifest.attribution = "a".repeat(1_001);
    });
  });

  test("canonicalization is independent of input key order", () => {
    const manifest = syntheticFoundationManifest();
    const reversed = Object.fromEntries(Object.entries(manifest).reverse());

    expect(canonicalizeSourceReleaseManifest(reversed)).toBe(
      canonicalizeSourceReleaseManifest(manifest),
    );
    expect(fingerprintSourceReleaseManifest(reversed)).toBe(
      fingerprintSourceReleaseManifest(manifest),
    );
  });

  test("does not access the network", () => {
    const originalFetch = globalThis.fetch;
    let calls = 0;
    globalThis.fetch = (() => {
      calls += 1;
      throw new Error("Network access is forbidden in manifest validation.");
    }) as typeof fetch;

    try {
      parseSourceReleaseManifest(syntheticFoundationManifest());
      fingerprintSourceReleaseManifest(syntheticFoundationManifest());
      expect(calls).toBe(0);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
