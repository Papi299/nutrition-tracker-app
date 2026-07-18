import { foundationPromotionPolicyVersion } from "./foundation-promotion-approval.ts";
import {
  canonicalizeJson,
  fingerprintJson,
  isPlainObject,
  type JsonValue,
} from "../usda/foundation/canonical-json.ts";
import type { FoundationDryRunResult } from "../usda/foundation/dry-run.ts";

export const foundationProductionApprovalPacketContractVersion =
  "foundation-production-approval-packet/v1" as const;

const fields = [
  "approval_reference",
  "archive_sha256",
  "backup_confirmation",
  "compressed_size",
  "contract_version",
  "counts",
  "expected_public_food_count",
  "expected_public_nutrient_count",
  "expected_source_portion_count",
  "importer_contract_version",
  "manifest_fingerprint",
  "nutrient_mapping_hash",
  "nutrient_mapping_version",
  "official_release_date",
  "official_release_label",
  "packet_status",
  "promotion_policy_version",
  "proposed_operator_identity",
  "proposed_target_environment",
  "reject_allowance_fingerprint",
  "reject_category_counts",
  "reject_policy_version",
  "rejected_record_statement",
  "report_fingerprint",
  "required_approver_identity",
  "rollback_confirmation",
  "schema_contract_hash",
  "schema_contract_version",
  "set_fingerprints",
  "uncompressed_size",
  "value_correction_statement",
] as const;

export type FoundationProductionApprovalPacket = {
  contract_version: typeof foundationProductionApprovalPacketContractVersion;
  packet_status: "unapproved";
  official_release_label: string;
  official_release_date: string;
  manifest_fingerprint: string;
  archive_sha256: string;
  compressed_size: number;
  uncompressed_size: number;
  schema_contract_version: string;
  schema_contract_hash: string;
  importer_contract_version: string;
  nutrient_mapping_version: string;
  nutrient_mapping_hash: string;
  reject_policy_version: string;
  report_fingerprint: string;
  set_fingerprints: {
    accepted: string;
    rejected: string;
    warning: string;
  };
  counts: { source: number; accepted: number; rejected: number; warnings: number };
  reject_category_counts: Readonly<Record<string, number>>;
  reject_allowance_fingerprint: null;
  promotion_policy_version: typeof foundationPromotionPolicyVersion;
  expected_public_food_count: number;
  expected_public_nutrient_count: number;
  expected_source_portion_count: number;
  proposed_target_environment: "production";
  proposed_operator_identity: string;
  required_approver_identity: string;
  backup_confirmation: null;
  rollback_confirmation: null;
  approval_reference: null;
  rejected_record_statement: string;
  value_correction_statement: string;
};

export class FoundationProductionApprovalPacketError extends Error {}

function fail(message: string): never {
  throw new FoundationProductionApprovalPacketError(message);
}

function exactHash(value: unknown, label: string) {
  if (typeof value !== "string" || !/^[a-f0-9]{64}$/.test(value)) {
    fail(`${label} must be a lowercase SHA-256.`);
  }
  return value;
}

function bounded(value: unknown, label: string, maximum = 300) {
  if (
    typeof value !== "string" || value !== value.trim() ||
    value.length === 0 || value.length > maximum
  ) fail(`${label} must be bounded nonblank text.`);
  return value;
}

function safeCount(value: unknown, label: string) {
  if (!Number.isSafeInteger(value) || (value as number) < 0) {
    fail(`${label} must be a nonnegative safe integer.`);
  }
  return value as number;
}

export function parseFoundationProductionApprovalPacket(
  input: unknown,
): FoundationProductionApprovalPacket {
  if (!isPlainObject(input)) fail("Approval packet must be an object.");
  if (JSON.stringify(Object.keys(input).sort()) !== JSON.stringify([...fields].sort())) {
    fail("Approval packet fields must be exact.");
  }
  if (
    input.contract_version !== foundationProductionApprovalPacketContractVersion ||
    input.packet_status !== "unapproved" ||
    input.proposed_target_environment !== "production" ||
    input.promotion_policy_version !== foundationPromotionPolicyVersion ||
    input.backup_confirmation !== null ||
    input.rollback_confirmation !== null ||
    input.approval_reference !== null ||
    input.reject_allowance_fingerprint !== null
  ) fail("Approval packet control fields are invalid.");
  if (!isPlainObject(input.set_fingerprints) ||
    JSON.stringify(Object.keys(input.set_fingerprints).sort()) !==
      JSON.stringify(["accepted", "rejected", "warning"])) {
    fail("Approval packet set fingerprints are invalid.");
  }
  if (!isPlainObject(input.counts) ||
    JSON.stringify(Object.keys(input.counts).sort()) !==
      JSON.stringify(["accepted", "rejected", "source", "warnings"])) {
    fail("Approval packet counts are invalid.");
  }
  if (!isPlainObject(input.reject_category_counts)) {
    fail("Approval packet reject counts are invalid.");
  }
  const rejectCounts: Record<string, number> = {};
  for (const [key, value] of Object.entries(input.reject_category_counts)) {
    if (!/^[a-z0-9][a-z0-9_:-]{0,119}$/.test(key)) fail("Invalid reject category.");
    rejectCounts[key] = safeCount(value, key);
  }
  return {
    contract_version: foundationProductionApprovalPacketContractVersion,
    packet_status: "unapproved",
    official_release_label: bounded(input.official_release_label, "release label", 200),
    official_release_date: bounded(input.official_release_date, "release date", 10),
    manifest_fingerprint: exactHash(input.manifest_fingerprint, "manifest fingerprint"),
    archive_sha256: exactHash(input.archive_sha256, "archive checksum"),
    compressed_size: safeCount(input.compressed_size, "compressed size"),
    uncompressed_size: safeCount(input.uncompressed_size, "uncompressed size"),
    schema_contract_version: bounded(input.schema_contract_version, "schema version", 80),
    schema_contract_hash: exactHash(input.schema_contract_hash, "schema hash"),
    importer_contract_version: bounded(input.importer_contract_version, "importer version", 80),
    nutrient_mapping_version: bounded(input.nutrient_mapping_version, "mapping version", 80),
    nutrient_mapping_hash: exactHash(input.nutrient_mapping_hash, "mapping hash"),
    reject_policy_version: bounded(input.reject_policy_version, "reject policy", 80),
    report_fingerprint: exactHash(input.report_fingerprint, "report fingerprint"),
    set_fingerprints: {
      accepted: exactHash(input.set_fingerprints.accepted, "accepted set"),
      rejected: exactHash(input.set_fingerprints.rejected, "rejected set"),
      warning: exactHash(input.set_fingerprints.warning, "warning set"),
    },
    counts: {
      source: safeCount(input.counts.source, "source count"),
      accepted: safeCount(input.counts.accepted, "accepted count"),
      rejected: safeCount(input.counts.rejected, "rejected count"),
      warnings: safeCount(input.counts.warnings, "warning count"),
    },
    reject_category_counts: Object.fromEntries(Object.entries(rejectCounts).sort()),
    reject_allowance_fingerprint: null,
    promotion_policy_version: foundationPromotionPolicyVersion,
    expected_public_food_count: safeCount(input.expected_public_food_count, "food count"),
    expected_public_nutrient_count: safeCount(input.expected_public_nutrient_count, "nutrient count"),
    expected_source_portion_count: safeCount(input.expected_source_portion_count, "portion count"),
    proposed_target_environment: "production",
    proposed_operator_identity: bounded(input.proposed_operator_identity, "operator", 160),
    required_approver_identity: bounded(input.required_approver_identity, "approver", 160),
    backup_confirmation: null,
    rollback_confirmation: null,
    approval_reference: null,
    rejected_record_statement: bounded(input.rejected_record_statement, "reject statement", 500),
    value_correction_statement: bounded(input.value_correction_statement, "correction statement", 500),
  };
}

export function createFoundationProductionApprovalPacket(input: {
  dryRun: FoundationDryRunResult;
  expectedNutrientCount: number;
  proposedOperatorIdentity: string;
  requiredApproverIdentity: string;
}) {
  const { dryRun } = input;
  const packet: FoundationProductionApprovalPacket = {
    contract_version: foundationProductionApprovalPacketContractVersion,
    packet_status: "unapproved",
    official_release_label: dryRun.manifest.original_release_identifier,
    official_release_date: dryRun.manifest.publication_date,
    manifest_fingerprint: dryRun.manifestFingerprint,
    archive_sha256: dryRun.manifest.sha256,
    compressed_size: dryRun.manifest.compressed_size,
    uncompressed_size: dryRun.manifest.uncompressed_size,
    schema_contract_version: dryRun.report.schema_contract_version,
    schema_contract_hash: dryRun.report.schema_contract_hash,
    importer_contract_version: dryRun.report.importer_contract_version,
    nutrient_mapping_version: dryRun.report.nutrient_mapping_version,
    nutrient_mapping_hash: dryRun.report.nutrient_mapping_hash,
    reject_policy_version: dryRun.report.reject_policy_version,
    report_fingerprint: dryRun.report.report_fingerprint,
    set_fingerprints: {
      accepted: dryRun.report.accepted_record_set_fingerprint,
      rejected: dryRun.report.rejected_record_set_fingerprint,
      warning: dryRun.report.warning_record_set_fingerprint,
    },
    counts: {
      source: dryRun.report.source_count,
      accepted: dryRun.report.accepted_count,
      rejected: dryRun.report.rejected_count,
      warnings: dryRun.report.warning_count,
    },
    reject_category_counts: dryRun.report.reject_category_counts,
    reject_allowance_fingerprint: null,
    promotion_policy_version: foundationPromotionPolicyVersion,
    expected_public_food_count: dryRun.report.accepted_count,
    expected_public_nutrient_count: input.expectedNutrientCount,
    expected_source_portion_count: dryRun.report.portion_counts.total_portions,
    proposed_target_environment: "production",
    proposed_operator_identity: input.proposedOperatorIdentity,
    required_approver_identity: input.requiredApproverIdentity,
    backup_confirmation: null,
    rollback_confirmation: null,
    approval_reference: null,
    rejected_record_statement:
      "The exact reviewed rejected record set, including all ten negative_target_value records, will not be promoted.",
    value_correction_statement:
      "No rejected value will be corrected, clamped, converted to null, recalculated, replaced, or partially promoted.",
  };
  return parseFoundationProductionApprovalPacket(packet);
}

export function verifyFoundationProductionApprovalPacket(input: {
  packet: unknown;
  dryRun: FoundationDryRunResult;
}) {
  const packet = parseFoundationProductionApprovalPacket(input.packet);
  if (
    packet.manifest_fingerprint !== input.dryRun.manifestFingerprint ||
    packet.official_release_label !== input.dryRun.manifest.original_release_identifier ||
    packet.official_release_date !== input.dryRun.manifest.publication_date ||
    packet.nutrient_mapping_hash !== input.dryRun.report.nutrient_mapping_hash ||
    packet.report_fingerprint !== input.dryRun.report.report_fingerprint ||
    packet.reject_allowance_fingerprint !== null ||
    packet.set_fingerprints.accepted !==
      input.dryRun.report.accepted_record_set_fingerprint ||
    packet.set_fingerprints.rejected !==
      input.dryRun.report.rejected_record_set_fingerprint
  ) fail("Approval packet does not match the validated release and allowance.");
  return packet;
}

export function canonicalizeFoundationProductionApprovalPacket(input: unknown) {
  return canonicalizeJson(parseFoundationProductionApprovalPacket(input) as JsonValue);
}

export function fingerprintFoundationProductionApprovalPacket(input: unknown) {
  return fingerprintJson(parseFoundationProductionApprovalPacket(input) as JsonValue);
}
