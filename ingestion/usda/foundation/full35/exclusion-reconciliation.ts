import {
  fingerprintFoundationRejectAllowance, FoundationRejectAllowanceError,
  parseFoundationRejectAllowance, verifyFoundationRejectAllowance,
} from "../../../contracts/foundation-reject-allowance.ts";
import { canonicalizeJson, deepFreezeJson, fingerprintJson, sha256Text } from "../canonical-json.ts";
import { normalizeFoundationArchive } from "../normalization.ts";
import { createFoundationDryRunReport } from "../report.ts";
import { canonicalValidationJson, full35Fail } from "./contract.ts";
import { runFoundationFull35DryRun } from "./dry-run.ts";
import { fingerprintFull35IdentitySet } from "./report.ts";

export const full35ExclusionReconciliationVersion = "foundation-full35-exclusion-reconciliation/v1" as const;

// MAP-06 / custody pins, not caller-selected policy or fresh approval authority.
export const full35HistoricalExclusionBaseline = deepFreezeJson({
  source_release_id: "a2e1699b-6f72-4153-b2f1-5cbf30c53281",
  manifest_fingerprint: "ad3a51cbb0b3c6bbafd98d8bd59d996e10ac8cc4d82f22d8695d3a2838a8c2b0",
  archive_sha256: "186e988ec542e913f51ef62b86a47758e8cdd0d1dc3889e7b055581f3c09c77a",
  json_sha256: "27d1fe3fd89edfbe528ed915da5619320e1d004d4594603a1b19bdb1511590cc",
  full_raw_set_hash: "c53100dd52fa09df408b4e9e7682f43192616689d0afaed7029e8c1b4344cf12",
  accepted_raw_set_hash: "95749cc4e604e3a94c6d07bf0bcf0c640f1688abadebcbfd5d157cf2c3b262d4",
  allowance_fingerprint: "bdfc95e5009a8d5c5a5bbf82b24dff1a4e8c3decd7bee4406286c543e661ad4a",
  source_count: 363, accepted_count: 353, rejected_count: 10,
  rejected_fdc_ids: ["2727566", "2727567", "2727568", "2727569", "2727570", "2727571", "2727575", "2727576", "2747656", "2747673"],
  reject_category: "negative_target_value",
});

type ReconciliationInput = {
  offline: Parameters<typeof runFoundationFull35DryRun>[0];
  report: unknown;
  historicalAllowance: unknown;
};

function rawSetHash(rows: readonly { fdc_id: string; raw_content_sha256: string }[]) {
  return sha256Text([...rows].sort((a, b) => Number(a.fdc_id) - Number(b.fdc_id))
    .map(row => `${row.fdc_id}:${row.raw_content_sha256}`).join("\n"));
}

export function reconcileFoundationFull35Exclusions(input: ReconciliationInput) {
  // Reverify bytes, parser, raw hashes, mapping interpretation and the complete
  // immutable report. A report fingerprint alone is never source evidence.
  const current = runFoundationFull35DryRun(input.offline);
  const report = current.report;
  if (canonicalValidationJson(input.report) !== canonicalizeJson(report)) full35Fail("evidence_mismatch");
  const baseline = full35HistoricalExclusionBaseline;
  const legacyNormalized = normalizeFoundationArchive(current.archive);
  const legacyReport = createFoundationDryRunReport({
    manifestFingerprint: current.source.manifest_fingerprint,
    archive: current.archive, ...legacyNormalized,
  });
  const legacy = {
    manifest: current.manifest, manifestFingerprint: current.source.manifest_fingerprint,
    archive: current.archive, ...legacyNormalized, report: legacyReport,
  };
  let allowanceFingerprint: string | null = null;
  let allowanceMatchesLegacy = false;
  try {
    const allowance = parseFoundationRejectAllowance(input.historicalAllowance);
    allowanceFingerprint = fingerprintFoundationRejectAllowance(allowance);
    // No "today"/expiry decision: this verifies the original historical decision,
    // not its authority for a new execution or a new environment.
    verifyFoundationRejectAllowance({ allowance, dryRun: legacy, targetEnvironment: allowance.target_environment });
    allowanceMatchesLegacy = true;
  } catch (error) {
    if (!(error instanceof FoundationRejectAllowanceError)) throw error;
  }
  const legacyRejected = new Map(legacyNormalized.rejected.map(row => [row.source_row_key, row.category]));
  const expectedIds = new Set<string>(baseline.rejected_fdc_ids);
  const matching = report.rejected_record_set.filter(row => expectedIds.has(row.fdc_id) &&
    row.category === baseline.reject_category && legacyRejected.get(`fdc:${row.fdc_id}`) === row.category);
  const matchingIds = new Set(matching.map(row => row.fdc_id));
  const missing = baseline.rejected_fdc_ids.filter(id => !matchingIds.has(id));
  const unexpected = report.rejected_record_set.filter(row => !matchingIds.has(row.fdc_id));
  const acceptedIdentities = report.accepted_record_set.map(({ fdc_id, source_record_id, source_version_id, raw_content_sha256 }) =>
    ({ fdc_id, source_record_id, source_version_id, raw_content_sha256 }));
  const acceptedMembershipMatches = fingerprintFull35IdentitySet(acceptedIdentities) === current.source.accepted_identity_set_hash;
  const legacyAcceptedRaw = legacyNormalized.accepted.map(row => ({ fdc_id: row.candidate.fdc_id, raw_content_sha256: row.raw.rawContentSha256 }));
  const acceptedRawMatchesLegacy = canonicalizeJson([...acceptedIdentities].map(({ fdc_id, raw_content_sha256 }) => ({ fdc_id, raw_content_sha256 }))) ===
    canonicalizeJson(legacyAcceptedRaw.sort((a, b) => Number(a.fdc_id) - Number(b.fdc_id)));
  const exactSet = missing.length === 0 && unexpected.length === 0 &&
    legacyReport.rejected_count === baseline.rejected_count && acceptedMembershipMatches && acceptedRawMatchesLegacy &&
    report.source_count === baseline.source_count && report.accepted_count === baseline.accepted_count;
  const releaseIdentity = `${current.manifest.dataset_code}:${current.manifest.original_release_identifier}:${current.manifest.publication_date}`;
  const fullRawHash = rawSetHash(current.archive.records.map(row => ({ fdc_id: String(row.raw.fdcId), raw_content_sha256: row.rawContentSha256 })));
  const acceptedRawHash = rawSetHash(acceptedIdentities);
  const sourceMatchesBaseline = current.source.source_release_id === baseline.source_release_id &&
    current.source.manifest_fingerprint === baseline.manifest_fingerprint &&
    current.source.archive_sha256 === baseline.archive_sha256 && current.source.json_sha256 === baseline.json_sha256 &&
    fullRawHash === baseline.full_raw_set_hash && acceptedRawHash === baseline.accepted_raw_set_hash;
  const historicalEvidenceQualified = sourceMatchesBaseline && allowanceMatchesLegacy && allowanceFingerprint === baseline.allowance_fingerprint;
  const body = {
    reconciliation_contract_version: full35ExclusionReconciliationVersion,
    executable: false,
    qualification_status: !exactSet ? "blocked_unexpected_exclusions" :
      historicalEvidenceQualified ? "exact_historical_exclusions_offline_unapproved" : "blocked_unqualified_evidence",
    // Matching a synthetic pattern is deliberately distinct from qualifying the
    // pinned original evidence. Synthetic tests cannot invent that evidence.
    exclusion_comparison: exactSet ? "exact_historical_pattern" : "unexpected_or_changed",
    historical_evidence_qualified: historicalEvidenceQualified,
    source_matches_baseline: sourceMatchesBaseline, allowance_matches_legacy: allowanceMatchesLegacy,
    accepted_membership_matches: acceptedMembershipMatches, accepted_raw_matches_legacy: acceptedRawMatchesLegacy,
    source_identity: report.source_identity, source_release_identity: releaseIdentity,
    mapping_version: report.mapping_version, mapping_hash: report.mapping_hash,
    importer_contract_version: report.importer_contract_version, candidate_contract_version: report.candidate_contract_version,
    report_contract_version: report.report_contract_version, report_fingerprint: report.report_fingerprint,
    historical_baseline_fingerprint: fingerprintJson(baseline),
    original_allowance_fingerprint: allowanceFingerprint, legacy_report_fingerprint: legacyReport.report_fingerprint,
    legacy_accepted_record_set_fingerprint: legacyReport.accepted_record_set_fingerprint,
    legacy_rejected_record_set_fingerprint: legacyReport.rejected_record_set_fingerprint,
    full_raw_set_hash: fullRawHash, accepted_raw_set_hash: acceptedRawHash,
    source_count: report.source_count, accepted_count: report.accepted_count, rejected_count: report.rejected_count,
    accepted_record_set: report.accepted_record_set, rejected_record_set: report.rejected_record_set,
    matched_exclusion_record_set: matching, unexpected_rejection_record_set: unexpected,
    missing_expected_exclusion_ids: missing,
  };
  return deepFreezeJson({ ...body, reconciliation_fingerprint: fingerprintJson(body) });
}

export type Full35ExclusionReconciliation = ReturnType<typeof reconcileFoundationFull35Exclusions>;

export function parseFoundationFull35ExclusionReconciliation(value: unknown, input: ReconciliationInput): Full35ExclusionReconciliation {
  const expected = reconcileFoundationFull35Exclusions(input);
  if (canonicalValidationJson(value) !== canonicalizeJson(expected)) full35Fail("evidence_mismatch");
  return expected;
}
