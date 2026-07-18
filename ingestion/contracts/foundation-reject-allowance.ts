import {
  canonicalizeJson,
  fingerprintJson,
  isPlainObject,
  type JsonValue,
} from "../usda/foundation/canonical-json.ts";
import type { FoundationDryRunResult } from "../usda/foundation/dry-run.ts";

export const foundationRejectAllowanceContractVersion =
  "foundation-reject-allowance/v1" as const;

const fields = [
  "accepted_count",
  "accepted_record_set_fingerprint",
  "approval_date",
  "approval_reference",
  "contract_version",
  "data_governance_approver",
  "decision_rationale",
  "dry_run_report_fingerprint",
  "expires_on",
  "importer_contract_version",
  "manifest_fingerprint",
  "nutrient_mapping_hash",
  "nutrient_mapping_version",
  "reject_category_counts",
  "reject_policy_version",
  "rejected_count",
  "rejected_record_set_fingerprint",
  "schema_contract_hash",
  "schema_contract_version",
  "source_count",
  "source_release_identity",
  "target_environment",
] as const;

export type FoundationRejectAllowance = {
  contract_version: typeof foundationRejectAllowanceContractVersion;
  manifest_fingerprint: string;
  source_release_identity: string;
  schema_contract_version: string;
  schema_contract_hash: string;
  importer_contract_version: string;
  nutrient_mapping_version: string;
  nutrient_mapping_hash: string;
  reject_policy_version: string;
  dry_run_report_fingerprint: string;
  accepted_record_set_fingerprint: string;
  rejected_record_set_fingerprint: string;
  source_count: number;
  accepted_count: number;
  rejected_count: number;
  reject_category_counts: Readonly<Record<string, number>>;
  decision_rationale: string;
  data_governance_approver: string;
  approval_reference: string;
  approval_date: string;
  expires_on: string | null;
  target_environment: "local" | "production";
};

export class FoundationRejectAllowanceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FoundationRejectAllowanceError";
  }
}

function fail(message: string): never {
  throw new FoundationRejectAllowanceError(message);
}

function text(record: Record<string, unknown>, key: string, maximum: number) {
  const value = record[key];
  if (
    typeof value !== "string" ||
    value !== value.trim() ||
    value.length === 0 ||
    value.length > maximum
  ) {
    fail(`${key} must be bounded nonblank text without outer whitespace.`);
  }
  return value;
}

function hash(record: Record<string, unknown>, key: string) {
  const value = text(record, key, 64);
  if (!/^[a-f0-9]{64}$/.test(value)) fail(`${key} must be a lowercase SHA-256.`);
  return value;
}

function count(record: Record<string, unknown>, key: string) {
  const value = record[key];
  if (!Number.isSafeInteger(value) || (value as number) < 0) {
    fail(`${key} must be a nonnegative safe integer.`);
  }
  return value as number;
}

function calendarDate(record: Record<string, unknown>, key: string, nullable = false) {
  if (nullable && record[key] === null) return null;
  const value = text(record, key, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) fail(`${key} must be a calendar date.`);
  const [year, month, day] = value.split("-").map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  if (
    year < 1 ||
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() !== month - 1 ||
    parsed.getUTCDate() !== day
  ) {
    fail(`${key} must be a valid calendar date.`);
  }
  return value;
}

export function parseFoundationRejectAllowance(
  input: unknown,
  options: { today?: string } = {},
): FoundationRejectAllowance {
  if (!isPlainObject(input)) fail("Reject allowance must be a plain object.");
  const keys = Object.keys(input).sort();
  if (JSON.stringify(keys) !== JSON.stringify([...fields].sort())) {
    fail("Reject allowance fields must be exact.");
  }
  if (input.contract_version !== foundationRejectAllowanceContractVersion) {
    fail("Unsupported reject-allowance contract version.");
  }
  const target = input.target_environment;
  if (target !== "local" && target !== "production") {
    fail("Unsupported reject-allowance environment.");
  }
  if (!isPlainObject(input.reject_category_counts)) {
    fail("Reject category counts must be an object.");
  }
  const categoryCounts: Record<string, number> = {};
  for (const [category, value] of Object.entries(input.reject_category_counts)) {
    if (!/^[a-z0-9][a-z0-9_:-]{0,119}$/.test(category)) {
      fail("Reject category is invalid.");
    }
    if (!Number.isSafeInteger(value) || (value as number) <= 0) {
      fail("Reject category counts must be positive safe integers.");
    }
    categoryCounts[category] = value as number;
  }
  const rejectedCount = count(input, "rejected_count");
  if (
    Object.values(categoryCounts).reduce((sum, value) => sum + value, 0) !==
    rejectedCount
  ) {
    fail("Reject category totals must equal rejected_count.");
  }
  const expiresOn = calendarDate(input, "expires_on", true);
  const today = options.today;
  if (today && expiresOn && expiresOn < today) fail("Reject allowance is expired.");

  return {
    contract_version: foundationRejectAllowanceContractVersion,
    manifest_fingerprint: hash(input, "manifest_fingerprint"),
    source_release_identity: text(input, "source_release_identity", 200),
    schema_contract_version: text(input, "schema_contract_version", 80),
    schema_contract_hash: hash(input, "schema_contract_hash"),
    importer_contract_version: text(input, "importer_contract_version", 80),
    nutrient_mapping_version: text(input, "nutrient_mapping_version", 80),
    nutrient_mapping_hash: hash(input, "nutrient_mapping_hash"),
    reject_policy_version: text(input, "reject_policy_version", 80),
    dry_run_report_fingerprint: hash(input, "dry_run_report_fingerprint"),
    accepted_record_set_fingerprint: hash(
      input,
      "accepted_record_set_fingerprint",
    ),
    rejected_record_set_fingerprint: hash(
      input,
      "rejected_record_set_fingerprint",
    ),
    source_count: count(input, "source_count"),
    accepted_count: count(input, "accepted_count"),
    rejected_count: rejectedCount,
    reject_category_counts: Object.fromEntries(
      Object.entries(categoryCounts).sort(([left], [right]) =>
        Buffer.compare(Buffer.from(left, "utf8"), Buffer.from(right, "utf8")),
      ),
    ),
    decision_rationale: text(input, "decision_rationale", 1_000),
    data_governance_approver: text(input, "data_governance_approver", 160),
    approval_reference: text(input, "approval_reference", 200),
    approval_date: calendarDate(input, "approval_date") as string,
    expires_on: expiresOn,
    target_environment: target,
  };
}

export function canonicalizeFoundationRejectAllowance(input: unknown) {
  return canonicalizeJson(parseFoundationRejectAllowance(input) as JsonValue);
}

export function fingerprintFoundationRejectAllowance(input: unknown) {
  return fingerprintJson(parseFoundationRejectAllowance(input) as JsonValue);
}

export function verifyFoundationRejectAllowance(input: {
  allowance: unknown;
  dryRun: FoundationDryRunResult;
  targetEnvironment: "local" | "production";
  today?: string;
}) {
  const allowance = parseFoundationRejectAllowance(input.allowance, {
    today: input.today,
  });
  const report = input.dryRun.report;
  const releaseIdentity = `${input.dryRun.manifest.dataset_code}:${input.dryRun.manifest.original_release_identifier}:${input.dryRun.manifest.publication_date}`;
  const expected = {
    manifest_fingerprint: input.dryRun.manifestFingerprint,
    source_release_identity: releaseIdentity,
    schema_contract_version: report.schema_contract_version,
    schema_contract_hash: report.schema_contract_hash,
    importer_contract_version: report.importer_contract_version,
    nutrient_mapping_version: report.nutrient_mapping_version,
    nutrient_mapping_hash: report.nutrient_mapping_hash,
    reject_policy_version: report.reject_policy_version,
    dry_run_report_fingerprint: report.report_fingerprint,
    accepted_record_set_fingerprint: report.accepted_record_set_fingerprint,
    rejected_record_set_fingerprint: report.rejected_record_set_fingerprint,
    source_count: report.source_count,
    accepted_count: report.accepted_count,
    rejected_count: report.rejected_count,
    reject_category_counts: report.reject_category_counts,
    target_environment: input.targetEnvironment,
  };
  for (const [key, value] of Object.entries(expected)) {
    if (JSON.stringify(allowance[key as keyof FoundationRejectAllowance]) !== JSON.stringify(value)) {
      fail(`Reject allowance does not match ${key}.`);
    }
  }
  return allowance;
}
