import {
  canonicalizeJson,
  fingerprintJson,
  isPlainObject,
  type JsonValue,
} from "../usda/foundation/canonical-json.ts";

export const foundationPromotionApprovalContractVersion =
  "foundation-promotion-approval/v1" as const;
export const foundationPromotionPolicyVersion =
  "foundation-initial-promotion/v1" as const;

const fields = [
  "approval_reference",
  "approval_timestamp",
  "approver_identity",
  "contract_version",
  "expires_at",
  "promotion_policy_version",
  "reject_allowance_fingerprint",
  "target_environment",
  "validation_receipt_fingerprint",
] as const;

export type FoundationPromotionApproval = {
  contract_version: typeof foundationPromotionApprovalContractVersion;
  validation_receipt_fingerprint: string;
  reject_allowance_fingerprint: string | null;
  target_environment: "local" | "production";
  approver_identity: string;
  approval_reference: string;
  approval_timestamp: string;
  expires_at: string | null;
  promotion_policy_version: typeof foundationPromotionPolicyVersion;
};

export class FoundationPromotionApprovalError extends Error {}

function fail(message: string): never {
  throw new FoundationPromotionApprovalError(message);
}

function text(value: unknown, label: string, maximum: number) {
  if (
    typeof value !== "string" ||
    value !== value.trim() ||
    value.length === 0 ||
    value.length > maximum
  ) fail(`${label} must be bounded nonblank text.`);
  return value;
}

function hash(value: unknown, label: string) {
  const parsed = text(value, label, 64);
  if (!/^[a-f0-9]{64}$/.test(parsed)) fail(`${label} must be a lowercase SHA-256.`);
  return parsed;
}

function timestamp(value: unknown, label: string, nullable = false) {
  if (nullable && value === null) return null;
  const parsed = text(value, label, 40);
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?Z$/.test(parsed)) {
    fail(`${label} must be a UTC timestamp.`);
  }
  return parsed;
}

export function parseFoundationPromotionApproval(
  input: unknown,
  options: { now?: string } = {},
): FoundationPromotionApproval {
  if (!isPlainObject(input)) fail("Promotion approval must be a plain object.");
  if (JSON.stringify(Object.keys(input).sort()) !== JSON.stringify([...fields].sort())) {
    fail("Promotion approval fields must be exact.");
  }
  if (input.contract_version !== foundationPromotionApprovalContractVersion) {
    fail("Unsupported promotion-approval contract version.");
  }
  if (input.promotion_policy_version !== foundationPromotionPolicyVersion) {
    fail("Unsupported promotion policy.");
  }
  if (input.target_environment !== "local" && input.target_environment !== "production") {
    fail("Unsupported promotion environment.");
  }
  const expiresAt = timestamp(input.expires_at, "expires_at", true);
  if (options.now && expiresAt && expiresAt <= options.now) {
    fail("Promotion approval is expired.");
  }
  return {
    contract_version: foundationPromotionApprovalContractVersion,
    validation_receipt_fingerprint: hash(
      input.validation_receipt_fingerprint,
      "validation_receipt_fingerprint",
    ),
    reject_allowance_fingerprint:
      input.reject_allowance_fingerprint === null
        ? null
        : hash(input.reject_allowance_fingerprint, "reject_allowance_fingerprint"),
    target_environment: input.target_environment,
    approver_identity: text(input.approver_identity, "approver_identity", 160),
    approval_reference: text(input.approval_reference, "approval_reference", 200),
    approval_timestamp: timestamp(
      input.approval_timestamp,
      "approval_timestamp",
    ) as string,
    expires_at: expiresAt,
    promotion_policy_version: foundationPromotionPolicyVersion,
  };
}

export function canonicalizeFoundationPromotionApproval(input: unknown) {
  return canonicalizeJson(parseFoundationPromotionApproval(input) as JsonValue);
}

export function fingerprintFoundationPromotionApproval(input: unknown) {
  return fingerprintJson(parseFoundationPromotionApproval(input) as JsonValue);
}
