import { createHash } from "node:crypto";

export const sourceReleaseManifestContractVersion =
  "source-release-manifest/v1" as const;

const manifestKeys = [
  "contract_version",
  "source_code",
  "dataset_code",
  "distributor_code",
  "transformation_code",
  "original_release_identifier",
  "transformation_release_identifier",
  "publication_date",
  "acquisition_method",
  "official_url",
  "authorized_delivery_url",
  "license_identifier",
  "attribution",
  "file_format",
  "schema_contract_version",
  "archive_name",
  "sha256",
  "compressed_size",
  "uncompressed_size",
  "approval_reference",
  "reject_policy_version",
] as const;

const manifestKeySet = new Set<string>(manifestKeys);
const codePattern = /^[a-z0-9][a-z0-9_:-]*$/;
const hashPattern = /^[a-f0-9]{64}$/;
const datePattern = /^\d{4}-\d{2}-\d{2}$/;
const acquisitionMethods = new Set([
  "official_bulk_download",
  "licensed_file",
  "approved_api",
]);
const fileFormats = new Set(["json", "csv"]);

export type SourceReleaseManifestV1 = {
  contract_version: typeof sourceReleaseManifestContractVersion;
  source_code: string;
  dataset_code: string;
  distributor_code: string;
  transformation_code: string | null;
  original_release_identifier: string;
  transformation_release_identifier: string | null;
  publication_date: string;
  acquisition_method:
    | "official_bulk_download"
    | "licensed_file"
    | "approved_api";
  official_url: string;
  authorized_delivery_url: string;
  license_identifier: string;
  attribution: string;
  file_format: "json" | "csv";
  schema_contract_version: string;
  archive_name: string;
  sha256: string;
  compressed_size: number;
  uncompressed_size: number;
  approval_reference: string;
  reject_policy_version: string | null;
};

export class SourceReleaseManifestError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SourceReleaseManifestError";
  }
}

function fail(message: string): never {
  throw new SourceReleaseManifestError(message);
}

function requireRecord(value: unknown): Record<string, unknown> {
  if (
    typeof value !== "object" ||
    value === null ||
    Array.isArray(value) ||
    Object.getPrototypeOf(value) !== Object.prototype
  ) {
    fail("Manifest must be a plain object.");
  }

  return value as Record<string, unknown>;
}

function requireBoundedString(
  record: Record<string, unknown>,
  key: string,
  maximumLength: number,
) {
  const value = record[key];

  if (typeof value !== "string") {
    fail(`${key} must be a string.`);
  }

  if (value.length === 0 || value.trim().length === 0) {
    fail(`${key} must not be blank.`);
  }

  if (value !== value.trim()) {
    fail(`${key} must not contain outer whitespace.`);
  }

  if (value.length > maximumLength) {
    fail(`${key} is too long.`);
  }

  return value;
}

function requireNullableBoundedString(
  record: Record<string, unknown>,
  key: string,
  maximumLength: number,
) {
  if (record[key] === null) {
    return null;
  }

  return requireBoundedString(record, key, maximumLength);
}

function requireCode(record: Record<string, unknown>, key: string) {
  const value = requireBoundedString(record, key, 64);

  if (!codePattern.test(value)) {
    fail(`${key} must be a canonical code.`);
  }

  return value;
}

function requireNullableCode(record: Record<string, unknown>, key: string) {
  if (record[key] === null) {
    return null;
  }

  return requireCode(record, key);
}

function requireCalendarDate(record: Record<string, unknown>, key: string) {
  const value = requireBoundedString(record, key, 10);

  if (!datePattern.test(value)) {
    fail(`${key} must be a calendar date.`);
  }

  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));

  if (
    year < 1 ||
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    fail(`${key} must be a valid calendar date.`);
  }

  return value;
}

function requireHttpsUrl(record: Record<string, unknown>, key: string) {
  const value = requireBoundedString(record, key, 500);
  let url: URL;

  try {
    url = new URL(value);
  } catch {
    fail(`${key} must be a valid HTTPS URL.`);
  }

  if (
    url.protocol !== "https:" ||
    url.username !== "" ||
    url.password !== "" ||
    url.hostname === ""
  ) {
    fail(`${key} must be an HTTPS URL without credentials.`);
  }

  return value;
}

function requirePositiveSafeInteger(
  record: Record<string, unknown>,
  key: string,
) {
  const value = record[key];

  if (
    typeof value !== "number" ||
    !Number.isSafeInteger(value) ||
    value <= 0
  ) {
    fail(`${key} must be a positive safe integer.`);
  }

  return value;
}

export function parseSourceReleaseManifest(
  input: unknown,
): SourceReleaseManifestV1 {
  const record = requireRecord(input);
  const keys = Object.keys(record);

  for (const key of keys) {
    if (!manifestKeySet.has(key)) {
      fail(`Unknown manifest field: ${key}.`);
    }
  }

  for (const key of manifestKeys) {
    if (!Object.hasOwn(record, key)) {
      fail(`Missing manifest field: ${key}.`);
    }
  }

  const contractVersion = requireBoundedString(
    record,
    "contract_version",
    64,
  );

  if (contractVersion !== sourceReleaseManifestContractVersion) {
    fail("Unsupported manifest contract version.");
  }

  const transformationCode = requireNullableCode(
    record,
    "transformation_code",
  );
  const transformationReleaseIdentifier = requireNullableBoundedString(
    record,
    "transformation_release_identifier",
    120,
  );

  if (
    (transformationCode === null) !==
    (transformationReleaseIdentifier === null)
  ) {
    fail(
      "Transformation code and transformation release identifier must both be null or both be present.",
    );
  }

  const acquisitionMethod = requireBoundedString(
    record,
    "acquisition_method",
    40,
  );

  if (!acquisitionMethods.has(acquisitionMethod)) {
    fail("Unsupported acquisition method.");
  }

  const fileFormat = requireBoundedString(record, "file_format", 16);

  if (!fileFormats.has(fileFormat)) {
    fail("Unsupported file format.");
  }

  const sha256 = requireBoundedString(record, "sha256", 64);

  if (!hashPattern.test(sha256)) {
    fail("sha256 must be exactly 64 lowercase hexadecimal characters.");
  }

  const manifest: SourceReleaseManifestV1 = {
    contract_version: sourceReleaseManifestContractVersion,
    source_code: requireCode(record, "source_code"),
    dataset_code: requireCode(record, "dataset_code"),
    distributor_code: requireCode(record, "distributor_code"),
    transformation_code: transformationCode,
    original_release_identifier: requireBoundedString(
      record,
      "original_release_identifier",
      120,
    ),
    transformation_release_identifier: transformationReleaseIdentifier,
    publication_date: requireCalendarDate(record, "publication_date"),
    acquisition_method:
      acquisitionMethod as SourceReleaseManifestV1["acquisition_method"],
    official_url: requireHttpsUrl(record, "official_url"),
    authorized_delivery_url: requireHttpsUrl(
      record,
      "authorized_delivery_url",
    ),
    license_identifier: requireBoundedString(
      record,
      "license_identifier",
      160,
    ),
    attribution: requireBoundedString(record, "attribution", 1_000),
    file_format: fileFormat as SourceReleaseManifestV1["file_format"],
    schema_contract_version: requireBoundedString(
      record,
      "schema_contract_version",
      80,
    ),
    archive_name: requireBoundedString(record, "archive_name", 200),
    sha256,
    compressed_size: requirePositiveSafeInteger(record, "compressed_size"),
    uncompressed_size: requirePositiveSafeInteger(
      record,
      "uncompressed_size",
    ),
    approval_reference: requireBoundedString(
      record,
      "approval_reference",
      200,
    ),
    reject_policy_version: requireNullableBoundedString(
      record,
      "reject_policy_version",
      80,
    ),
  };

  if (manifest.uncompressed_size < manifest.compressed_size) {
    fail("uncompressed_size must be greater than or equal to compressed_size.");
  }

  return manifest;
}

export function canonicalizeSourceReleaseManifest(input: unknown) {
  const manifest = parseSourceReleaseManifest(input);

  // PostgreSQL jsonb orders object keys by UTF-8 byte length and then by byte
  // value, and emits one space after separators. Manifest V1 is intentionally
  // flat, so this explicit representation is the shared TypeScript/PostgreSQL
  // byte contract. Do not replace it with ordinary JSON.stringify ordering.
  const orderedEntries = Object.entries(manifest).sort(([left], [right]) => {
    const leftBytes = Buffer.from(left, "utf8");
    const rightBytes = Buffer.from(right, "utf8");

    return leftBytes.length - rightBytes.length || Buffer.compare(leftBytes, rightBytes);
  });

  return `{${orderedEntries
    .map(([key, value]) => `${JSON.stringify(key)}: ${JSON.stringify(value)}`)
    .join(", ")}}`;
}

export function fingerprintSourceReleaseManifest(input: unknown) {
  return createHash("sha256")
    .update(canonicalizeSourceReleaseManifest(input), "utf8")
    .digest("hex");
}
