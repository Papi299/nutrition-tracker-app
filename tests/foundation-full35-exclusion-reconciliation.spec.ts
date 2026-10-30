import { expect, test } from "@playwright/test";
import { fingerprintSourceReleaseManifest } from "@/ingestion/contracts/source-release-manifest";
import { fingerprintFoundationRejectAllowance, verifyFoundationRejectAllowance } from "@/ingestion/contracts/foundation-reject-allowance";
import { fingerprintJson } from "@/ingestion/usda/foundation/canonical-json";
import { foundationRejectPolicyVersion, foundationSchemaContractVersion } from "@/ingestion/usda/foundation/contract";
import { runFoundationDryRun, sha256Bytes } from "@/ingestion/usda/foundation/dry-run";
import { runFoundationFull35DryRun } from "@/ingestion/usda/foundation/full35/dry-run";
import {
  full35HistoricalExclusionBaseline, parseFoundationFull35ExclusionReconciliation,
  reconcileFoundationFull35Exclusions,
} from "@/ingestion/usda/foundation/full35/exclusion-reconciliation";
import { createFoundationStagingPlan } from "@/ingestion/usda/foundation/staging";
import { syntheticFull35Context, syntheticFull35Record, syntheticNutrient, syntheticZip } from "./fixtures/foundation-full35";

// Independent MAP-06 ID inventory; all amounts, raw hashes, UUIDs, manifest and
// allowance below are SYNTHETIC. No fixture claims actual historical evidence.
const excludedIds = [2727566, 2727567, 2727568, 2727569, 2727570, 2727571, 2727575, 2727576, 2747656, 2747673];
function food(id: number, negative = false) {
  return { ...syntheticFull35Record(id), foodNutrients: [
    syntheticNutrient(2048, "Energy (Atwater Specific Factors)", "kcal", 100),
    syntheticNutrient(1003, "Protein", "g", 1),
    syntheticNutrient(1005, "Carbohydrate, by difference", "g", negative ? -1 : 2),
    syntheticNutrient(1004, "Total lipid (fat)", "g", 3),
  ] };
}

function offline(records: ReturnType<typeof food>[], nulls = 0) {
  const jsonText = JSON.stringify({ FoundationFoods: [...records, ...Array.from({ length: nulls }, () => null)] });
  const archiveBytes = syntheticZip(jsonText, "synthetic.json", true);
  const context = syntheticFull35Context(records);
  return {
    archiveBytes, expectedJsonSha256: sha256Bytes(Buffer.from(jsonText)),
    sourceReleaseId: context.source.source_release_id,
    identities: context.identities.filter(id => Number(id.fdc_id) >= 9000000),
    manifest: {
      contract_version: "source-release-manifest/v1", source_code: "usda", dataset_code: "usda_fdc_foundation",
      distributor_code: "usda_fdc_direct", transformation_code: null,
      original_release_identifier: "synthetic-exclusion-comparison", transformation_release_identifier: null,
      publication_date: "2026-04-30", acquisition_method: "official_bulk_download",
      official_url: "https://fdc.nal.usda.gov/download-datasets/", authorized_delivery_url: "https://fdc.nal.usda.gov/synthetic.zip",
      license_identifier: "CC0-1.0", attribution: "Synthetic exclusion fixture; not official USDA source or approval evidence.",
      file_format: "json", schema_contract_version: foundationSchemaContractVersion,
      archive_name: "synthetic.zip", sha256: sha256Bytes(archiveBytes), compressed_size: archiveBytes.length,
      uncompressed_size: Buffer.byteLength(jsonText), approval_reference: "synthetic-unapproved",
      reject_policy_version: foundationRejectPolicyVersion,
    },
  };
}

function legacyFor(input: ReturnType<typeof offline>, records: ReturnType<typeof food>[]) {
  return runFoundationDryRun({ ...input, jsonText: JSON.stringify({ FoundationFoods: records }) });
}
function syntheticAllowance(legacy: ReturnType<typeof runFoundationDryRun>) {
  const r = legacy.report;
  return {
    contract_version: "foundation-reject-allowance/v1", manifest_fingerprint: legacy.manifestFingerprint,
    source_release_identity: `${legacy.manifest.dataset_code}:${legacy.manifest.original_release_identifier}:${legacy.manifest.publication_date}`,
    schema_contract_version: r.schema_contract_version, schema_contract_hash: r.schema_contract_hash,
    importer_contract_version: r.importer_contract_version, nutrient_mapping_version: r.nutrient_mapping_version,
    nutrient_mapping_hash: r.nutrient_mapping_hash, reject_policy_version: r.reject_policy_version,
    dry_run_report_fingerprint: r.report_fingerprint, accepted_record_set_fingerprint: r.accepted_record_set_fingerprint,
    rejected_record_set_fingerprint: r.rejected_record_set_fingerprint, source_count: r.source_count,
    accepted_count: r.accepted_count, rejected_count: r.rejected_count, reject_category_counts: r.reject_category_counts,
    decision_rationale: "Synthetic comparison only; no historical or new execution approval.",
    data_governance_approver: "Synthetic fixture", approval_reference: "synthetic-only",
    approval_date: "2026-10-30", expires_on: null, target_environment: "local",
  };
}
function fixture(ids = excludedIds) {
  const records = [...Array.from({ length: 353 }, (_, n) => food(9000001 + n)), ...ids.map(id => food(id, true))];
  const input = offline(records), current = runFoundationFull35DryRun(input), legacy = legacyFor(input, records);
  return { records, legacy, input: { offline: input, report: current.report, historicalAllowance: syntheticAllowance(legacy) }, current };
}
const baseline = fixture();
function changedRecords(edit: (records: ReturnType<typeof food>[]) => void) {
  const records = structuredClone(baseline.records); edit(records);
  const next = offline(records);
  return { ...baseline.input, offline: next, report: runFoundationFull35DryRun(next).report };
}
function rehash<T extends Record<string, unknown>>(value: T, field: string) {
  const copy = structuredClone(value); delete copy[field];
  return { ...copy, [field]: fingerprintJson(copy as Parameters<typeof fingerprintJson>[0]) };
}

test("zero rejections stay offline/unapproved in v3 and cannot reconcile the historical ten", () => {
  const f = fixture([]), result = reconcileFoundationFull35Exclusions(f.input);
  expect(f.current.report).toMatchObject({ qualification_status: "offline_unapproved", rejected_count: 0 });
  expect(result.qualification_status).toBe("blocked_unexpected_exclusions");
  expect(result.missing_expected_exclusion_ids).toEqual(excludedIds.map(String));
  expect(result.rejected_record_set).toEqual([]);
});

test("exact ten compare by identity and legacy reason; synthetic evidence never qualifies as the pinned source", () => {
  const result = reconcileFoundationFull35Exclusions(baseline.input);
  expect(baseline.current.report).toMatchObject({ qualification_status: "blocked", source_count: 363, accepted_count: 353, rejected_count: 10 });
  expect(result).toMatchObject({ exclusion_comparison: "exact_historical_pattern", qualification_status: "blocked_unqualified_evidence",
    allowance_matches_legacy: true, accepted_membership_matches: true, accepted_raw_matches_legacy: true, historical_evidence_qualified: false });
  expect(result.matched_exclusion_record_set.map(row => row.fdc_id)).toEqual(excludedIds.map(String));
  expect(result.unexpected_rejection_record_set).toEqual([]);
  expect(result.missing_expected_exclusion_ids).toEqual([]);
  expect(result.original_allowance_fingerprint).not.toBe(full35HistoricalExclusionBaseline.allowance_fingerprint);
});

for (const [label, ids, missingCount, unexpectedCount] of [
  ["nine approved IDs", excludedIds.slice(0, 9), 1, 0],
  ["eleven with an unexpected record", [...excludedIds, 2800000], 0, 1],
  ["ten with a replacement FDC ID", [...excludedIds.slice(0, 9), 2800000], 1, 1],
] as const) {
  test(`${label} block exact-set comparison even with a matching synthetic allowance`, () => {
    const f = fixture([...ids]), result = reconcileFoundationFull35Exclusions(f.input);
    expect(f.current.report.qualification_status).toBe("blocked");
    expect(result.qualification_status).toBe("blocked_unexpected_exclusions");
    expect(result.missing_expected_exclusion_ids).toHaveLength(missingCount);
    expect(result.unexpected_rejection_record_set).toHaveLength(unexpectedCount);
  });
}

test("changed rejection category cannot replace an approved negative-carbohydrate exclusion", () => {
  const input = changedRecords(records => {
    const row = records[353]; row.foodNutrients[2].amount = 2;
    row.foodNutrients.push(syntheticNutrient(1079, "Fiber, total dietary", "mg"));
  });
  const result = reconcileFoundationFull35Exclusions(input);
  expect(result.rejected_count).toBe(10);
  expect(result.unexpected_rejection_record_set[0]).toMatchObject({ fdc_id: String(excludedIds[0]), category: "unsupported_target_unit" });
  expect(result.qualification_status).toBe("blocked_unexpected_exclusions");
  expect(result.allowance_matches_legacy).toBe(false);
});

test("changed raw bytes with the same ID/category invalidate original allowance evidence", () => {
  const input = changedRecords(records => { records[353].description = "Changed synthetic raw identity"; });
  const result = reconcileFoundationFull35Exclusions(input);
  expect(result.exclusion_comparison).toBe("exact_historical_pattern");
  expect(result.qualification_status).toBe("blocked_unqualified_evidence");
  expect(result.allowance_matches_legacy).toBe(false);
  expect(result.rejected_record_set[0].raw_content_sha256).not.toBe(baseline.current.report.rejected_record_set[0].raw_content_sha256);
});

test("forged rejected raw hash, category, count, ID, or mapping fails even after rehashing v3", () => {
  for (const edit of [
    (r: typeof baseline.current.report) => { r.rejected_record_set[0].raw_content_sha256 = "f".repeat(64); },
    (r: typeof baseline.current.report) => { r.rejected_record_set[0].category = "trace_target_blocked"; },
    (r: typeof baseline.current.report) => { r.rejected_record_set[0].fdc_id = "2800000"; },
    (r: typeof baseline.current.report) => { r.source_count = 353; },
    (r: typeof baseline.current.report) => { r.mapping_hash = "f".repeat(64); },
  ]) {
    const report = structuredClone(baseline.current.report); edit(report);
    expect(() => reconcileFoundationFull35Exclusions({ ...baseline.input, report: rehash(report, "report_fingerprint") })).toThrow("evidence_mismatch");
  }
});

test("changed release UUID is explicitly unqualified even when report is consistently regenerated", () => {
  const next = { ...baseline.input.offline, sourceReleaseId: "00000000-0000-4000-8000-000000000998" };
  const result = reconcileFoundationFull35Exclusions({ ...baseline.input, offline: next, report: runFoundationFull35DryRun(next).report });
  expect(result.qualification_status).toBe("blocked_unqualified_evidence");
  expect(result.source_matches_baseline).toBe(false);
  expect(result.source_identity.source_release_id).toBe(next.sourceReleaseId);
});

test("changed archive digest or manifest evidence fails closed", () => {
  for (const edit of [
    { manifest: { ...baseline.input.offline.manifest, sha256: "f".repeat(64) } },
    { expectedJsonSha256: "f".repeat(64) },
    { archiveBytes: Buffer.from("substituted archive") },
  ]) expect(() => reconcileFoundationFull35Exclusions({ ...baseline.input, offline: { ...baseline.input.offline, ...edit } })).toThrow();
  const next = offline(baseline.records, 1);
  const result = reconcileFoundationFull35Exclusions({ ...baseline.input, offline: next, report: runFoundationFull35DryRun(next).report });
  expect(result.qualification_status).toBe("blocked_unqualified_evidence");
  expect(result.source_identity.archive_sha256).not.toBe(baseline.current.source.archive_sha256);
  expect(result.allowance_matches_legacy).toBe(false);
});

test("duplicate exclusion source records or frozen identities fail before qualification", () => {
  const duplicate = offline([...baseline.records, baseline.records[353]]);
  expect(() => reconcileFoundationFull35Exclusions({ ...baseline.input, offline: duplicate })).toThrow();
  const identities = [...baseline.input.offline.identities, baseline.input.offline.identities[0]];
  expect(() => reconcileFoundationFull35Exclusions({ ...baseline.input, offline: { ...baseline.input.offline, identities } })).toThrow();
});

test("wrong accepted membership cannot be compensated by the ten expected rejections", () => {
  const next = { ...baseline.input.offline, identities: baseline.input.offline.identities.slice(1) };
  const result = reconcileFoundationFull35Exclusions({ ...baseline.input, offline: next, report: runFoundationFull35DryRun(next).report });
  expect(result).toMatchObject({ source_count: 363, accepted_count: 352, rejected_count: 11,
    qualification_status: "blocked_unexpected_exclusions", accepted_raw_matches_legacy: false });
  expect(result.unexpected_rejection_record_set).toContainEqual(expect.objectContaining({ fdc_id: "9000001", category: "accepted_set_mismatch" }));
});

test("extra rejected identity in frozen accepted set fails exact membership", () => {
  const all = syntheticFull35Context(baseline.records).identities;
  const next = { ...baseline.input.offline, identities: all };
  const result = reconcileFoundationFull35Exclusions({ ...baseline.input, offline: next, report: runFoundationFull35DryRun(next).report });
  expect(result.rejected_count).toBe(10);
  expect(result.accepted_membership_matches).toBe(false);
  expect(result.qualification_status).toBe("blocked_unexpected_exclusions");
});

test("malformed, substituted or newly rehashed allowance evidence cannot qualify", () => {
  for (const historicalAllowance of [null, {},
    { ...baseline.input.historicalAllowance, rejected_record_set_fingerprint: "f".repeat(64) },
    { ...baseline.input.historicalAllowance, approval_reference: "replacement synthetic decision" },
  ]) {
    const result = reconcileFoundationFull35Exclusions({ ...baseline.input, historicalAllowance });
    expect(result.qualification_status).toBe("blocked_unqualified_evidence");
    expect(result.historical_evidence_qualified).toBe(false);
  }
});

test("reconciliation is immutable, deterministic and revalidated against full independent context", () => {
  const result = reconcileFoundationFull35Exclusions(baseline.input);
  expect(parseFoundationFull35ExclusionReconciliation(JSON.parse(JSON.stringify(result)), baseline.input)).toEqual(result);
  expect(Object.isFrozen(result)).toBe(true);
  expect(Object.isFrozen(result.rejected_record_set)).toBe(true);
  expect(() => parseFoundationFull35ExclusionReconciliation({ ...result, reconciliation_fingerprint: "f".repeat(64) }, baseline.input)).toThrow("evidence_mismatch");
  const forged = { ...result, qualification_status: "exact_historical_exclusions_offline_unapproved", historical_evidence_qualified: true };
  expect(() => parseFoundationFull35ExclusionReconciliation(rehash(forged, "reconciliation_fingerprint"), baseline.input)).toThrow("evidence_mismatch");
  const reversed = { ...baseline.input, offline: { ...baseline.input.offline, identities: [...baseline.input.offline.identities].reverse() } };
  expect(reconcileFoundationFull35Exclusions(reversed)).toEqual(result);
});

test("source denominator and every rejected identity/hash/category are retained byte-equivalently", () => {
  const before = JSON.stringify(baseline.current.report), result = reconcileFoundationFull35Exclusions(baseline.input);
  expect(result).toMatchObject({ source_count: 363, accepted_count: 353, rejected_count: 10, executable: false });
  expect(result.accepted_count + result.rejected_count).toBe(result.source_count);
  expect(result.rejected_record_set).toEqual(baseline.current.report.rejected_record_set);
  expect(result.accepted_record_set).toEqual(baseline.current.report.accepted_record_set);
  expect(JSON.stringify(baseline.current.report)).toBe(before);
  expect(result.report_fingerprint).toBe(baseline.current.report.report_fingerprint);
  for (const row of baseline.current.report.coverage) expect(row.rejected_unqualified).toBe(10);
});

test("legacy rejection, allowance, report and staging contracts retain their original meaning", () => {
  const legacy = baseline.legacy;
  expect(legacy.report).toMatchObject({ report_contract_version: "foundation-dry-run-report/v2", nutrient_mapping_version: "usda-foundation-mvp-v1",
    nutrient_mapping_hash: "a5dc96bfcb2bd8d499b0a11eac8f252e7aa63d4ae13d8a78ee9047477c2a0fb5", reject_category_counts: { negative_target_value: 10 } });
  expect(verifyFoundationRejectAllowance({ allowance: baseline.input.historicalAllowance, dryRun: legacy, targetEnvironment: "local" })).toEqual(baseline.input.historicalAllowance);
  expect(fingerprintFoundationRejectAllowance(baseline.input.historicalAllowance)).not.toBe(full35HistoricalExclusionBaseline.allowance_fingerprint);
  expect(createFoundationStagingPlan(legacy)).toMatchObject({ terminalState: "failed", importerContractVersion: "usda-foundation-importer/v2" });
  expect(fingerprintSourceReleaseManifest(legacy.manifest)).toBe(legacy.manifestFingerprint);
});

test("neither reconciliation nor v3 report gains staging or executable authority", () => {
  const result = reconcileFoundationFull35Exclusions(baseline.input);
  expect(result.executable).toBe(false);
  expect(baseline.current.report.executable).toBe(false);
  for (const report of [result, baseline.current.report]) {
    expect(() => createFoundationStagingPlan({ ...baseline.legacy, report } as unknown as Parameters<typeof createFoundationStagingPlan>[0])).toThrow("original mapping and report only");
  }
  expect(full35HistoricalExclusionBaseline.rejected_fdc_ids).toEqual(excludedIds.map(String));
  expect(Object.isFrozen(full35HistoricalExclusionBaseline)).toBe(true);
  expect(Object.isFrozen(full35HistoricalExclusionBaseline.rejected_fdc_ids)).toBe(true);
});
