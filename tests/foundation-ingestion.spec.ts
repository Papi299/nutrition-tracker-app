import { expect, test } from "@playwright/test";
import {
  foundationCandidateContractVersion,
  foundationRejectPolicyVersion,
  foundationSafetyBounds,
  foundationSchemaContractVersion,
} from "@/ingestion/usda/foundation/contract";
import {
  runFoundationDryRun,
  sha256Bytes,
} from "@/ingestion/usda/foundation/dry-run";
import {
  normalizeFoundationArchive,
  normalizeFoundationRecord,
  parseNormalizedFoundationCandidate,
} from "@/ingestion/usda/foundation/normalization";
import {
  foundationNutrientMappingHash,
  foundationNutrientMappingVersion,
} from "@/ingestion/usda/foundation/nutrient-mapping";
import {
  canonicalDecimal,
  FoundationValidationError,
  parseFoundationArchive,
} from "@/ingestion/usda/foundation/parser";
import { serializeFoundationDryRunReport } from "@/ingestion/usda/foundation/report";
import { createFoundationStagingPlan } from "@/ingestion/usda/foundation/staging";
import {
  sourceReleaseManifestContractVersion,
  type SourceReleaseManifestV1,
} from "@/ingestion/contracts/source-release-manifest";

type SyntheticRecord = Record<string, unknown>;

function nutrient(
  id: number,
  unitName: string,
  amount: number,
  extras: Record<string, unknown> = {},
) {
  return {
    type: "FoodNutrient",
    id: id + 50_000,
    nutrient: {
      id,
      number: String(id),
      name: `Synthetic nutrient ${id}`,
      rank: id,
      unitName,
    },
    foodNutrientDerivation: {
      code: id === 1004 ? "A" : "NC",
      description: id === 1004 ? "Analytical" : "Calculated",
      foodNutrientSource: {
        id: 1,
        code: "1",
        description: "Synthetic source",
      },
    },
    amount,
    ...extras,
  };
}

function portion(
  id: number,
  sequenceNumber: number,
  extras: Record<string, unknown> = {},
) {
  return {
    id,
    value: 1,
    measureUnit: { id: 1000, name: "cup", abbreviation: "cup" },
    modifier: "synthetic",
    gramWeight: 120,
    sequenceNumber,
    amount: 1,
    ...extras,
  };
}

function foundationRecord(
  fdcId = 1_000_001,
  overrides: Record<string, unknown> = {},
): SyntheticRecord {
  return {
    foodClass: "FinalFood",
    description: `Synthetic Foundation food ${fdcId}`,
    foodNutrients: [
      nutrient(1003, "g", 10),
      nutrient(1004, "g", 4),
      nutrient(1005, "g", 20),
      nutrient(2047, "kcal", 150),
      nutrient(2048, "kcal", 140),
      nutrient(1008, "kcal", 160),
      nutrient(2000, "mg", 5),
    ],
    foodPortions: [portion(fdcId + 10, 1)],
    foodCategory: { description: "Synthetic category" },
    fdcId,
    dataType: "Foundation",
    publicationDate: "4/30/2026",
    ndbNumber: fdcId + 20,
    ...overrides,
  };
}

function archiveText(records: unknown[], trailingNulls = 0) {
  return JSON.stringify({
    FoundationFoods: [...records, ...Array.from({ length: trailingNulls }, () => null)],
  });
}

function parseAndNormalize(records: SyntheticRecord[], trailingNulls = 0) {
  const archive = parseFoundationArchive(archiveText(records, trailingNulls));
  return { archive, ...normalizeFoundationArchive(archive) };
}

function syntheticDryRun(records = [foundationRecord()]) {
  const jsonText = archiveText(records);
  const archiveBytes = Buffer.from("synthetic Foundation archive", "utf8");
  const manifest: SourceReleaseManifestV1 = {
    contract_version: sourceReleaseManifestContractVersion,
    source_code: "usda",
    dataset_code: "usda_fdc_foundation",
    distributor_code: "usda_fdc_direct",
    transformation_code: null,
    original_release_identifier: "synthetic-phase-10c-v1",
    transformation_release_identifier: null,
    publication_date: "2026-04-30",
    acquisition_method: "official_bulk_download",
    official_url: "https://fdc.nal.usda.gov/download-datasets/",
    authorized_delivery_url: "https://fdc.nal.usda.gov/synthetic.zip",
    license_identifier: "CC0-1.0",
    attribution: "Cite USDA FoodData Central and retain the applicable release citation.",
    file_format: "json",
    schema_contract_version: foundationSchemaContractVersion,
    archive_name: "synthetic.zip",
    sha256: sha256Bytes(archiveBytes),
    compressed_size: archiveBytes.byteLength,
    uncompressed_size: Buffer.byteLength(jsonText),
    approval_reference: "synthetic-phase-10c-approval",
    reject_policy_version: foundationRejectPolicyVersion,
  };
  return runFoundationDryRun({ manifest, archiveBytes, jsonText });
}

function expectReleaseFailure(run: () => unknown, category?: string) {
  try {
    run();
    throw new Error("Expected Foundation validation to fail.");
  } catch (error) {
    expect(error).toBeInstanceOf(FoundationValidationError);
    if (category) expect((error as FoundationValidationError).category).toBe(category);
  }
}

test.describe("USDA Foundation parser contract", () => {
  test("accepts the exact Foundation collection and reviewed trailing null padding", () => {
    const archive = parseFoundationArchive(archiveText([foundationRecord()], 2));
    expect(archive.records).toHaveLength(1);
    expect(archive.collectionEntryCount).toBe(3);
    expect(archive.trailingNullPaddingCount).toBe(2);
  });

  test("rejects wrong, missing, nonarray, and duplicated top-level collections", () => {
    for (const text of [
      JSON.stringify({ BrandedFoods: [] }),
      JSON.stringify({}),
      JSON.stringify({ FoundationFoods: {} }),
      '{"FoundationFoods":[],"FoundationFoods":[]}',
    ]) {
      expectReleaseFailure(() => parseFoundationArchive(text), "wrong_collection");
    }
  });

  test("rejects malformed JSON and non-object roots", () => {
    expectReleaseFailure(() => parseFoundationArchive("{"), "malformed_json");
    expectReleaseFailure(() => parseFoundationArchive("[]"), "wrong_collection");
  });

  test("rejects an excessive source file and record count", () => {
    expectReleaseFailure(
      () => parseFoundationArchive(archiveText([foundationRecord()]), { maximumInputBytes: 8 }),
      "source_file_size_mismatch",
    );
    const records = Array.from(
      { length: foundationSafetyBounds.maximumRecords + 1 },
      (_, index) => ({
        foodClass: "FinalFood",
        description: "x",
        foodNutrients: [],
        fdcId: index + 1,
        dataType: "Foundation",
        publicationDate: "4/30/2026",
      }),
    );
    expectReleaseFailure(
      () => parseFoundationArchive(archiveText(records)),
      "record_count_out_of_bounds",
    );
  });

  test("rejects missing required and unknown schema paths", () => {
    const missing = foundationRecord();
    delete missing.description;
    expectReleaseFailure(
      () => parseFoundationArchive(archiveText([missing])),
      "schema_contract_mismatch",
    );
    expectReleaseFailure(
      () =>
        parseFoundationArchive(
          archiveText([foundationRecord(1, { unexpectedSourceField: true })]),
        ),
      "schema_contract_mismatch",
    );
  });

  test("rejects nontrailing null entries and excessive reviewed padding", () => {
    expectReleaseFailure(
      () => parseFoundationArchive(archiveText([foundationRecord(), null, foundationRecord(2)])),
      "schema_contract_mismatch",
    );
    expectReleaseFailure(
      () =>
        parseFoundationArchive(
          archiveText(
            [foundationRecord()],
            foundationSafetyBounds.maximumTrailingNullPadding + 1,
          ),
        ),
      "schema_contract_mismatch",
    );
  });

  test("preserves frozen raw source objects and deterministic hashes", () => {
    const first = parseFoundationArchive(archiveText([foundationRecord()]));
    const second = parseFoundationArchive(archiveText([foundationRecord()]));
    expect(first.records[0].rawContentSha256).toBe(second.records[0].rawContentSha256);
    expect(Object.isFrozen(first.records[0].raw)).toBe(true);
    expect(first.records[0].raw.description).toBe("Synthetic Foundation food 1000001");
  });

  test("expands safe exponent decimals without rounding", () => {
    expect(canonicalDecimal(4.24e3)).toBe("4240");
    expect(canonicalDecimal(1.25e-4)).toBe("0.000125");
  });
});

test.describe("USDA Foundation identity and normalization", () => {
  test("uses FDC as version identity and NDB as the stable concept", () => {
    const { accepted } = parseAndNormalize([foundationRecord(123)]);
    expect(accepted[0].candidate.fdc_id).toBe("123");
    expect(accepted[0].candidate.source_row_key).toBe("fdc:123");
    expect(accepted[0].candidate.upstream_version_key).toBe("fdc:123");
    expect(accepted[0].candidate.concept_key).toBe("foundation:ndb:143");
  });

  test("rejects zero, negative, fractional, and unsafe FDC IDs", () => {
    for (const value of [0, -1, 1.5, Number.MAX_SAFE_INTEGER + 1]) {
      const { rejected } = parseAndNormalize([foundationRecord(1, { fdcId: value })]);
      expect(rejected[0].category).toBe("invalid_fdc_id");
    }
  });

  test("defers stable concept generation when NDB is absent", () => {
    const record = foundationRecord();
    delete record.ndbNumber;
    const { accepted } = parseAndNormalize([record]);
    expect(accepted[0].candidate.concept_key).toBeNull();
    expect(accepted[0].candidate.concept_identity_status).toBe(
      "generate_on_first_promotion",
    );
    expect(accepted[0].candidate.warning_categories).toContain(
      "concept_identity_pending_generation",
    );
  });

  test("hard-fails duplicate FDC and NDB identities without fuzzy merging", () => {
    expectReleaseFailure(
      () => parseAndNormalize([foundationRecord(1), foundationRecord(1)]),
      "duplicate_version_identity",
    );
    expectReleaseFailure(
      () =>
        parseAndNormalize([
          foundationRecord(1, { ndbNumber: 90 }),
          foundationRecord(2, { ndbNumber: 90, description: "Unrelated description" }),
        ]),
      "duplicate_concept_identity",
    );
  });

  test("preserves the bounded full USDA description and source-neutral authority", () => {
    const name = "  Synthetic source spacing  ";
    const { accepted } = parseAndNormalize([
      foundationRecord(1, { description: name }),
    ]);
    const candidate = accepted[0].candidate as unknown as Record<string, unknown>;
    expect(candidate.name).toBe(name);
    expect(candidate.locale).toBe("en");
    expect(candidate.food_type).toBe("generic");
    expect(candidate.brand).toBeNull();
    expect(candidate).not.toHaveProperty("owner_id");
    expect(candidate).not.toHaveProperty("is_public");
    expect(candidate).not.toHaveProperty("barcode");
    expect(candidate).not.toHaveProperty("food_id");
  });
});

test.describe("USDA Foundation MVP nutrient mapping", () => {
  test("maps protein, fat, and carbohydrate by exact source IDs and units", () => {
    const { accepted } = parseAndNormalize([foundationRecord()]);
    const nutrients = accepted[0].candidate.nutrients;
    expect(nutrients.protein_g.source_nutrient_id).toBe("1003");
    expect(nutrients.fat_g.source_nutrient_id).toBe("1004");
    expect(nutrients.carbohydrates_g.source_nutrient_id).toBe("1005");
    expect(nutrients.carbohydrates_g.semantic).toBe("source_calculated");
    expect(accepted[0].candidate.nutrient_basis).toBe("per_100g");
  });

  test("prefers 2048, retains 2047 and 1008 evidence, and never combines energy", () => {
    const { accepted } = parseAndNormalize([foundationRecord()]);
    const candidate = accepted[0].candidate;
    expect(candidate.nutrients.energy_kcal.source_nutrient_id).toBe("2048");
    expect(candidate.nutrients.energy_kcal.value).toBe("140");
    expect(candidate.energy_evidence.map((value) => value.source_nutrient_id)).toEqual([
      "2048",
      "2047",
      "1008",
    ]);
    expect(candidate.selected_energy_method).toBe("atwater_specific_2048");
  });

  test("falls back to 2047 and never selects legacy 1008", () => {
    const record = foundationRecord();
    record.foodNutrients = (record.foodNutrients as unknown[]).filter(
      (value) => (value as { nutrient: { id: number } }).nutrient.id !== 2048,
    );
    const fallback = parseAndNormalize([record]).accepted[0].candidate;
    expect(fallback.nutrients.energy_kcal.source_nutrient_id).toBe("2047");

    record.foodNutrients = (record.foodNutrients as unknown[]).filter(
      (value) => (value as { nutrient: { id: number } }).nutrient.id !== 2047,
    );
    const legacyOnly = parseAndNormalize([record]).accepted[0].candidate;
    expect(legacyOnly.nutrients.energy_kcal.semantic).toBe("missing");
    expect(legacyOnly.nutrients.energy_kcal.value).toBeNull();
  });

  test("preserves missing, explicit zero, and positive-LOQ trace distinctly", () => {
    const missing = foundationRecord();
    missing.foodNutrients = (missing.foodNutrients as unknown[]).filter(
      (value) => (value as { nutrient: { id: number } }).nutrient.id !== 1003,
    );
    expect(
      parseAndNormalize([missing]).accepted[0].candidate.nutrients.protein_g.semantic,
    ).toBe("missing");

    const zero = foundationRecord();
    zero.foodNutrients = [
      ...(zero.foodNutrients as unknown[]).filter(
        (value) => (value as { nutrient: { id: number } }).nutrient.id !== 1003,
      ),
      nutrient(1003, "g", 0),
    ];
    const explicitZero = parseAndNormalize([zero]).accepted[0].candidate.nutrients.protein_g;
    expect(explicitZero.semantic).toBe("explicit_zero");
    expect(explicitZero.value).toBe("0");

    const trace = foundationRecord();
    trace.foodNutrients = [
      ...(trace.foodNutrients as unknown[]).filter(
        (value) => (value as { nutrient: { id: number } }).nutrient.id !== 1003,
      ),
      nutrient(1003, "g", 0, { loq: 0.03 }),
    ];
    const traceValue = parseAndNormalize([trace]).accepted[0].candidate.nutrients.protein_g;
    expect(traceValue.semantic).toBe("trace");
    expect(traceValue.value).toBeNull();
    expect(traceValue.loq).toBe("0.03");
  });

  test("rejects negative, nonfinite, wrong-unit, and duplicate target values", () => {
    const cases = [
      [nutrient(1003, "g", -1), "negative_target_value"],
      [nutrient(1003, "kJ", 1), "unsupported_target_unit"],
      [nutrient(1003, "g", Number.POSITIVE_INFINITY), "malformed_target_nutrient"],
    ] as const;
    for (const [bad, category] of cases) {
      const record = foundationRecord();
      record.foodNutrients = [bad];
      const parsedRecord = parseFoundationArchive(
        archiveText([
          Number.isFinite((bad as { amount: number }).amount)
            ? record
            : foundationRecord(),
        ]),
      ).records[0];
      if (!Number.isFinite((bad as { amount: number }).amount)) {
        const mutable = {
          ...parsedRecord,
          raw: { ...parsedRecord.raw, foodNutrients: [bad] },
        };
        expect(() => normalizeFoundationRecord(mutable)).toThrow(
          FoundationValidationError,
        );
      } else {
        expect(parseAndNormalize([record]).rejected[0].category).toBe(category);
      }
    }

    const duplicate = foundationRecord();
    duplicate.foodNutrients = [nutrient(1003, "g", 1), nutrient(1003, "g", 2)];
    expect(parseAndNormalize([duplicate]).rejected[0].category).toBe(
      "duplicate_target_nutrient",
    );
  });

  test("counts unsupported nutrients without projection, kJ conversion, or macro energy", () => {
    const record = foundationRecord();
    record.foodNutrients = [
      nutrient(1003, "g", 10),
      nutrient(1004, "g", 5),
      nutrient(1005, "g", 20),
      nutrient(2001, "kJ", 999),
    ];
    const candidate = parseAndNormalize([record]).accepted[0].candidate;
    expect(candidate.unsupported_nutrient_count).toBe(1);
    expect(candidate.nutrients.energy_kcal.value).toBeNull();
    expect(candidate.selected_energy_method).toBeNull();
  });

  test("pins the version-controlled mapping hash", () => {
    expect(foundationNutrientMappingVersion).toBe("usda-foundation-mvp-v1");
    expect(foundationNutrientMappingHash).toMatch(/^[a-f0-9]{64}$/);
  });
});

test.describe("USDA Foundation portions, candidates, reports, and staging", () => {
  test("preserves multiple portions and rebases conflicting source sequences deterministically", () => {
    const record = foundationRecord(1, {
      foodPortions: [portion(20, 1), portion(10, 1, { gramWeight: 60 })],
    });
    const candidate = parseAndNormalize([record]).accepted[0].candidate;
    expect(candidate.portion_candidates.map((value) => value.ordinal)).toEqual([1, 2]);
    expect(candidate.portion_candidates.map((value) => value.source_portion_id)).toEqual([
      "10",
      "20",
    ]);
    expect(candidate.warning_categories).toContain(
      "source_portion_sequence_rebased",
    );
  });

  test("allows missing portions without inventing a serving or density", () => {
    const record = foundationRecord();
    delete record.foodPortions;
    const candidate = parseAndNormalize([record]).accepted[0].candidate;
    expect(candidate.portion_candidates).toEqual([]);
    expect(candidate.warning_categories).toContain("missing_portions");
    expect(candidate).not.toHaveProperty("serving_size");
    expect(candidate).not.toHaveProperty("density");
  });

  test("rejects invalid amount, gram weight, and duplicate source portion identity", () => {
    for (const foodPortions of [
      [portion(1, 1, { amount: 0 })],
      [portion(1, 1, { gramWeight: -1 })],
      [portion(1, 1), portion(1, 2)],
    ]) {
      expect(
        parseAndNormalize([foundationRecord(2, { foodPortions })]).rejected[0]
          .category,
      ).toBe("malformed_portion");
    }
  });

  test("produces an exact candidate shape and deterministic fingerprint", () => {
    const first = parseAndNormalize([foundationRecord()]).accepted[0].candidate;
    const second = parseAndNormalize([foundationRecord()]).accepted[0].candidate;
    expect(first).toEqual(second);
    expect(first.candidate_contract_version).toBe(foundationCandidateContractVersion);
    expect(parseNormalizedFoundationCandidate(first)).toEqual(first);
    expect(() =>
      parseNormalizedFoundationCandidate({ ...first, unexpected: true }),
    ).toThrow(FoundationValidationError);
  });

  test("produces byte-identical deterministic reports without raw rows or paths", () => {
    const first = syntheticDryRun();
    const second = syntheticDryRun();
    const firstBytes = serializeFoundationDryRunReport(first.report);
    const secondBytes = serializeFoundationDryRunReport(second.report);
    expect(firstBytes).toBe(secondBytes);
    expect(first.report.report_fingerprint).toBe(second.report.report_fingerprint);
    expect(firstBytes).not.toContain("Synthetic Foundation food");
    expect(firstBytes).not.toContain(process.cwd());
    expect(firstBytes).not.toContain("rawPayload");
  });

  test("builds a staging-only validated plan with every raw record", () => {
    const result = syntheticDryRun([foundationRecord(1), foundationRecord(2)]);
    const plan = createFoundationStagingPlan(result);
    expect(plan.rawRecords).toHaveLength(2);
    expect(plan.candidates).toHaveLength(2);
    expect(plan.terminalState).toBe("validated");
    expect(plan.items.filter((item) => item.action === "accept")).toHaveLength(2);
    expect(plan).not.toHaveProperty("publicFoods");
    expect(plan).not.toHaveProperty("promotion");
  });

  test("rejects wrong manifest scope, checksum, and extracted size", () => {
    const result = syntheticDryRun();
    expect(result.manifestFingerprint).toMatch(/^[a-f0-9]{64}$/);
    const jsonText = archiveText([foundationRecord()]);
    const archiveBytes = Buffer.from("synthetic Foundation archive", "utf8");
    const baseManifest = result.manifest;
    expect(() =>
      runFoundationDryRun({
        manifest: { ...baseManifest, dataset_code: "usda_fdc_branded" },
        archiveBytes,
        jsonText,
      }),
    ).toThrow();
    expect(() =>
      runFoundationDryRun({
        manifest: { ...baseManifest, sha256: "a".repeat(64) },
        archiveBytes,
        jsonText,
      }),
    ).toThrow();
    expect(() =>
      runFoundationDryRun({
        manifest: { ...baseManifest, uncompressed_size: Buffer.byteLength(jsonText) + 1 },
        archiveBytes,
        jsonText,
      }),
    ).toThrow();
  });

  test("performs no network access", () => {
    const originalFetch = globalThis.fetch;
    let calls = 0;
    globalThis.fetch = (() => {
      calls += 1;
      throw new Error("Network is forbidden.");
    }) as typeof fetch;
    try {
      syntheticDryRun();
      expect(calls).toBe(0);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
