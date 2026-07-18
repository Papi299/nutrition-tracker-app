import { expect, test } from "@playwright/test";
import {
  fingerprintFoundationRejectAllowance,
  parseFoundationRejectAllowance,
  verifyFoundationRejectAllowance,
} from "@/ingestion/contracts/foundation-reject-allowance";
import {
  fingerprintFoundationPromotionApproval,
  foundationPromotionApprovalContractVersion,
  foundationPromotionPolicyVersion,
  parseFoundationPromotionApproval,
} from "@/ingestion/contracts/foundation-promotion-approval";
import {
  createFoundationProductionApprovalPacket,
  fingerprintFoundationProductionApprovalPacket,
  verifyFoundationProductionApprovalPacket,
} from "@/ingestion/contracts/foundation-production-approval-packet";
import {
  foundationRejectPolicyVersion,
  foundationSchemaContractVersion,
} from "@/ingestion/usda/foundation/contract";
import { runFoundationDryRun, sha256Bytes } from "@/ingestion/usda/foundation/dry-run";
import { prepareFoundationProjection } from "@/ingestion/usda/foundation/projection";
import { sourceReleaseManifestContractVersion } from "@/ingestion/contracts/source-release-manifest";

function nutrient(id: number, amount: number, extras: Record<string, unknown> = {}) {
  return {
    id: 50_000 + id,
    type: "FoodNutrient",
    nutrient: {
      id,
      number: String(id),
      name: `Synthetic ${id}`,
      rank: id,
      unitName: id === 1008 || id === 2047 || id === 2048 ? "kcal" : "g",
    },
    foodNutrientDerivation: {
      code: id === 1004 ? "A" : "NC",
      description: id === 1004 ? "Analytical" : "Calculated",
      foodNutrientSource: { id: 1, code: "1", description: "Synthetic" },
    },
    amount,
    ...extras,
  };
}

function record(fdcId: number, overrides: Record<string, unknown> = {}) {
  return {
    foodClass: "FinalFood",
    description: `Promotion fixture ${fdcId}`,
    foodNutrients: [
      nutrient(1003, 10), nutrient(1004, 4), nutrient(1005, 20),
      nutrient(2048, 140), nutrient(2047, 150), nutrient(1008, 160),
    ],
    foodPortions: [{
      id: fdcId + 1,
      value: 1,
      measureUnit: { id: 1000, name: "cup", abbreviation: "cup" },
      modifier: "prepared",
      gramWeight: 120,
      sequenceNumber: 1,
      amount: 1,
    }],
    foodCategory: { description: "Synthetic" },
    fdcId,
    dataType: "Foundation",
    publicationDate: "4/30/2026",
    ndbNumber: fdcId + 100,
    ...overrides,
  };
}

function dryRun(records: unknown[]) {
  const jsonText = JSON.stringify({ FoundationFoods: records });
  const archiveBytes = Buffer.from("synthetic promotion archive");
  const manifest = {
    contract_version: sourceReleaseManifestContractVersion,
    source_code: "usda",
    dataset_code: "usda_fdc_foundation",
    distributor_code: "usda_fdc_direct",
    transformation_code: null,
    original_release_identifier: "synthetic-promotion-release",
    transformation_release_identifier: null,
    publication_date: "2026-04-30",
    acquisition_method: "official_bulk_download" as const,
    official_url: "https://fdc.nal.usda.gov/download-datasets/",
    authorized_delivery_url: "https://fdc.nal.usda.gov/synthetic.zip",
    license_identifier: "CC0-1.0",
    attribution: "Cite USDA FoodData Central and retain the applicable release citation.",
    file_format: "json" as const,
    schema_contract_version: foundationSchemaContractVersion,
    archive_name: "synthetic.zip",
    sha256: sha256Bytes(archiveBytes),
    compressed_size: archiveBytes.byteLength,
    uncompressed_size: Buffer.byteLength(jsonText),
    approval_reference: "synthetic-promotion-review",
    reject_policy_version: foundationRejectPolicyVersion,
  };
  return runFoundationDryRun({ manifest, archiveBytes, jsonText });
}

function allowance(
  result: ReturnType<typeof dryRun>,
  target: "local" | "production" = "local",
) {
  return {
    contract_version: "foundation-reject-allowance/v1",
    manifest_fingerprint: result.manifestFingerprint,
    source_release_identity: `${result.manifest.dataset_code}:${result.manifest.original_release_identifier}:${result.manifest.publication_date}`,
    schema_contract_version: result.report.schema_contract_version,
    schema_contract_hash: result.report.schema_contract_hash,
    importer_contract_version: result.report.importer_contract_version,
    nutrient_mapping_version: result.report.nutrient_mapping_version,
    nutrient_mapping_hash: result.report.nutrient_mapping_hash,
    reject_policy_version: result.report.reject_policy_version,
    dry_run_report_fingerprint: result.report.report_fingerprint,
    accepted_record_set_fingerprint: result.report.accepted_record_set_fingerprint,
    rejected_record_set_fingerprint: result.report.rejected_record_set_fingerprint,
    source_count: result.report.source_count,
    accepted_count: result.report.accepted_count,
    rejected_count: result.report.rejected_count,
    reject_category_counts: result.report.reject_category_counts,
    decision_rationale: "Exclude this exact reviewed synthetic rejected set.",
    data_governance_approver: "Synthetic data approver",
    approval_reference: "synthetic-allowance",
    approval_date: "2026-07-18",
    expires_on: "2026-07-20",
    target_environment: target,
  };
}

function rejectedResult(rejectedFdcId = 2) {
  return dryRun([
    record(1),
    record(rejectedFdcId, {
      foodNutrients: [nutrient(1005, -1)],
    }),
  ]);
}

test.describe("Foundation exact record-set fingerprints", () => {
  test("is independent of accepted source order", () => {
    const first = dryRun([record(1), record(2)]).report;
    const second = dryRun([record(2), record(1)]).report;
    expect(second.accepted_record_set_fingerprint).toBe(
      first.accepted_record_set_fingerprint,
    );
    expect(second.warning_record_set_fingerprint).toBe(
      first.warning_record_set_fingerprint,
    );
  });

  test("changes accepted and report fingerprints for one candidate change", () => {
    const first = dryRun([record(1)]).report;
    const second = dryRun([record(1, { description: "Changed candidate" })]).report;
    expect(second.accepted_count).toBe(first.accepted_count);
    expect(second.accepted_record_set_fingerprint).not.toBe(
      first.accepted_record_set_fingerprint,
    );
    expect(second.report_fingerprint).not.toBe(first.report_fingerprint);
  });

  test("is independent of rejected order and binds source keys/categories", () => {
    const a = record(2, { foodNutrients: [nutrient(1005, -1)] });
    const b = record(3, { foodNutrients: [nutrient(1003, -1)] });
    const first = dryRun([record(1), a, b]).report;
    const reordered = dryRun([b, record(1), a]).report;
    const changed = rejectedResult(4).report;
    expect(reordered.rejected_record_set_fingerprint).toBe(
      first.rejected_record_set_fingerprint,
    );
    expect(changed.rejected_count).toBe(1);
    expect(changed.reject_category_counts).toEqual({ negative_target_value: 1 });
    expect(changed.rejected_record_set_fingerprint).not.toBe(
      rejectedResult(2).report.rejected_record_set_fingerprint,
    );
  });

  test("binds warning assignments rather than aggregate equality alone", () => {
    const missingPortion = record(1, {
      foodNutrients: [
        nutrient(1003, 10), nutrient(1004, 4), nutrient(1005, 20),
        nutrient(2048, 140),
      ],
    });
    delete (missingPortion as { foodPortions?: unknown }).foodPortions;
    const alternativeEnergy = record(1);
    const first = dryRun([missingPortion]).report;
    const second = dryRun([alternativeEnergy]).report;
    expect(first.warning_count).toBe(second.warning_count);
    expect(first.warning_record_set_fingerprint).not.toBe(
      second.warning_record_set_fingerprint,
    );
  });
});

test.describe("Foundation reviewed reject allowance", () => {
  test("accepts an exact allowance deterministically", () => {
    const result = rejectedResult();
    const input = allowance(result);
    expect(verifyFoundationRejectAllowance({
      allowance: input,
      dryRun: result,
      targetEnvironment: "local",
      today: "2026-07-18",
    })).toEqual(parseFoundationRejectAllowance(input));
    expect(fingerprintFoundationRejectAllowance(input)).toBe(
      fingerprintFoundationRejectAllowance({ ...input }),
    );
  });

  test("rejects unknown and missing fields", () => {
    const input = allowance(rejectedResult()) as Record<string, unknown>;
    expect(() => parseFoundationRejectAllowance({ ...input, secret: "x" })).toThrow();
    const missing = { ...input };
    delete missing.approval_reference;
    expect(() => parseFoundationRejectAllowance(missing)).toThrow();
  });

  test("rejects malformed hashes, counts, and category totals", () => {
    const input = allowance(rejectedResult());
    expect(() => parseFoundationRejectAllowance({ ...input, manifest_fingerprint: "bad" })).toThrow();
    expect(() => parseFoundationRejectAllowance({ ...input, rejected_count: -1 })).toThrow();
    expect(() => parseFoundationRejectAllowance({
      ...input,
      reject_category_counts: { negative_target_value: 2 },
    })).toThrow();
  });

  test("rejects wrong manifest, report, sets, counts, categories, and environment", () => {
    const result = rejectedResult();
    const input = allowance(result);
    for (const override of [
      { manifest_fingerprint: "a".repeat(64) },
      { dry_run_report_fingerprint: "b".repeat(64) },
      { accepted_record_set_fingerprint: "c".repeat(64) },
      { rejected_record_set_fingerprint: "d".repeat(64) },
      { source_count: 3 },
      { reject_category_counts: { different_category: 1 } },
      { target_environment: "production" },
    ]) {
      expect(() => verifyFoundationRejectAllowance({
        allowance: { ...input, ...override },
        dryRun: result,
        targetEnvironment: "local",
      })).toThrow();
    }
  });

  test("rejects blank governance text, unsupported environments, and expiry", () => {
    const input = allowance(rejectedResult());
    expect(() => parseFoundationRejectAllowance({ ...input, decision_rationale: " " })).toThrow();
    expect(() => parseFoundationRejectAllowance({ ...input, data_governance_approver: "" })).toThrow();
    expect(() => parseFoundationRejectAllowance({ ...input, target_environment: "preview" })).toThrow();
    expect(() => parseFoundationRejectAllowance(input, { today: "2026-07-21" })).toThrow();
  });

  test("performs no network access", () => {
    const originalFetch = globalThis.fetch;
    let calls = 0;
    globalThis.fetch = (() => { calls += 1; throw new Error("network"); }) as typeof fetch;
    try {
      parseFoundationRejectAllowance(allowance(rejectedResult()));
      expect(calls).toBe(0);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});

test.describe("Foundation promotion approval and production packet", () => {
  const approval = {
    contract_version: foundationPromotionApprovalContractVersion,
    validation_receipt_fingerprint: "a".repeat(64),
    reject_allowance_fingerprint: "b".repeat(64),
    target_environment: "local" as const,
    approver_identity: "Synthetic approver",
    approval_reference: "synthetic-approval",
    approval_timestamp: "2026-07-18T10:00:00Z",
    expires_at: "2026-07-19T10:00:00Z",
    promotion_policy_version: foundationPromotionPolicyVersion,
  };

  test("parses and fingerprints exact approval deterministically", () => {
    expect(parseFoundationPromotionApproval(approval)).toEqual(approval);
    expect(fingerprintFoundationPromotionApproval(approval)).toBe(
      fingerprintFoundationPromotionApproval({ ...approval }),
    );
  });

  test("rejects wrong environment, unknown fields, missing fields, and expiry", () => {
    expect(() => parseFoundationPromotionApproval({ ...approval, target_environment: "preview" })).toThrow();
    expect(() => parseFoundationPromotionApproval({ ...approval, credential: "x" })).toThrow();
    const missing = { ...approval } as Record<string, unknown>;
    delete missing.approval_reference;
    expect(() => parseFoundationPromotionApproval(missing)).toThrow();
    expect(() => parseFoundationPromotionApproval(approval, { now: "2026-07-20T00:00:00Z" })).toThrow();
  });

  test("creates an unapproved deterministic production packet with placeholders", () => {
    const result = rejectedResult();
    const packet = createFoundationProductionApprovalPacket({
      dryRun: result,
      expectedNutrientCount: 4,
      proposedOperatorIdentity: "Proposed production operator",
      requiredApproverIdentity: "Required production approver",
    });
    expect(packet.packet_status).toBe("unapproved");
    expect(packet.backup_confirmation).toBeNull();
    expect(packet.rollback_confirmation).toBeNull();
    expect(packet.approval_reference).toBeNull();
    expect(verifyFoundationProductionApprovalPacket({
      packet,
      dryRun: result,
    })).toEqual(packet);
    expect(fingerprintFoundationProductionApprovalPacket(packet)).toBe(
      fingerprintFoundationProductionApprovalPacket({ ...packet }),
    );
  });

  test("rejects wrong release, mapping, allowance, environment, and credential fields", () => {
    const result = rejectedResult();
    const packet = createFoundationProductionApprovalPacket({
      dryRun: result,
      expectedNutrientCount: 4,
      proposedOperatorIdentity: "Operator",
      requiredApproverIdentity: "Approver",
    });
    for (const changed of [
      { ...packet, official_release_label: "wrong" },
      { ...packet, nutrient_mapping_hash: "c".repeat(64) },
      { ...packet, reject_allowance_fingerprint: "d".repeat(64) },
      { ...packet, proposed_target_environment: "preview" },
      { ...packet, api_key: "forbidden" },
    ]) {
      expect(() => verifyFoundationProductionApprovalPacket({
        packet: changed,
        dryRun: result,
      })).toThrow();
    }
  });
});

test.describe("Foundation projection preparation", () => {
  test("preserves NDB concept, FDC version, selected nutrients, calculated evidence, and portions", () => {
    const candidate = dryRun([record(1)]).accepted[0].candidate;
    const projection = prepareFoundationProjection(candidate);
    expect(projection.concept_key).toBe("foundation:ndb:101");
    expect(projection.upstream_version_key).toBe("fdc:1");
    expect(projection.nutrients.find((value) => value.application_nutrient_code === "energy_kcal")?.source_nutrient_id).toBe("2048");
    expect(projection.nutrients.find((value) => value.application_nutrient_code === "protein_g")?.semantic).toBe("source_calculated");
    expect(projection.aliases).toEqual([]);
    expect(projection.barcodes).toEqual([]);
    expect(projection.public_food.serving_size).toBeNull();
  });

  test("uses a durable generated-concept placeholder without using FDC as concept", () => {
    const input = record(2);
    delete (input as { ndbNumber?: unknown }).ndbNumber;
    const projection = prepareFoundationProjection(dryRun([input]).accepted[0].candidate);
    expect(projection.concept_key).toBe("foundation:generated:<database-uuid>");
    expect(projection.concept_key).not.toBe("fdc:2");
  });

  test("omits missing, retains explicit zero, and blocks trace", () => {
    const missing = record(1, { foodNutrients: [nutrient(1003, 0)] });
    const projection = prepareFoundationProjection(dryRun([missing]).accepted[0].candidate);
    expect(projection.nutrients).toEqual([
      expect.objectContaining({
        application_nutrient_code: "protein_g",
        amount: "0",
        semantic: "explicit_zero",
      }),
    ]);
    const trace = record(2, { foodNutrients: [nutrient(1003, 0, { loq: 0.1 })] });
    expect(() => prepareFoundationProjection(dryRun([trace]).accepted[0].candidate)).toThrow(/Trace/);
  });

  test("uses 2047 fallback, excludes 1008, and preflights exact decimal storage", () => {
    const fallback = record(1, { foodNutrients: [nutrient(2047, 99.123), nutrient(1008, 111)] });
    const projection = prepareFoundationProjection(dryRun([fallback]).accepted[0].candidate);
    expect(projection.nutrients[0]).toMatchObject({
      application_nutrient_code: "energy_kcal",
      amount: "99.123",
      source_nutrient_id: "2047",
      exact_conversion_factor: null,
    });
    expect(projection.nutrients).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ source_nutrient_id: "1008" })]),
    );
  });
});
