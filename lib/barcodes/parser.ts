import { isValidCanonicalGtin } from "./validation";

const lookupStatuses = [
  "ambiguous",
  "archived_or_unavailable",
  "found_owned",
  "found_public",
  "not_found_local",
] as const;
const foodTypes = ["branded", "generic", "user_custom"] as const;
const dataQualities = [
  "curated",
  "estimated",
  "imported",
  "unknown",
  "user_provided",
  "verified",
] as const;
const sourceTypes = [
  "database",
  "external_api",
  "imported",
  "manual",
  "user_custom",
] as const;
const sourceTrustLevels = [
  "curated",
  "estimated",
  "unknown",
  "user_provided",
  "verified",
] as const;
const verificationStatuses = [
  "curated_verified",
  "provider_reported",
  "user_asserted",
] as const;

type LookupStatus = (typeof lookupStatuses)[number];
type FoodType = (typeof foodTypes)[number];
type DataQuality = (typeof dataQualities)[number];
type SourceType = (typeof sourceTypes)[number];
type SourceTrustLevel = (typeof sourceTrustLevels)[number];
type VerificationStatus = (typeof verificationStatuses)[number];

const rowKeys = [
  "brand_name",
  "canonical_gtin",
  "food_data_quality",
  "food_id",
  "food_locale",
  "food_name",
  "food_source_code",
  "food_source_name",
  "food_source_trust_level",
  "food_source_type",
  "food_type",
  "mapping_provenance_source_code",
  "mapping_provenance_source_food_id",
  "mapping_provenance_source_name",
  "mapping_provenance_source_trust_level",
  "mapping_provenance_source_type",
  "mapping_verification_status",
  "ownership_kind",
  "result_status",
  "serving_size",
  "serving_unit",
] as const;
const sortedRowKeys = [...rowKeys].sort();

const foodSpecificKeys = rowKeys.filter(
  (key) => key !== "canonical_gtin" && key !== "result_status",
);

export type BarcodeLookupFood = {
  brand_name: string | null;
  canonical_gtin: string;
  food_data_quality: DataQuality;
  food_id: string;
  food_locale: string | null;
  food_name: string;
  food_source_code: string | null;
  food_source_name: string | null;
  food_source_trust_level: SourceTrustLevel | null;
  food_source_type: SourceType | null;
  food_type: FoodType;
  mapping_provenance_source_code: string;
  mapping_provenance_source_food_id: string | null;
  mapping_provenance_source_name: string;
  mapping_provenance_source_trust_level: SourceTrustLevel;
  mapping_provenance_source_type: SourceType;
  mapping_verification_status: VerificationStatus;
  ownership_kind: "owned_custom" | "public";
  serving_size: number | null;
  serving_unit: string | null;
};

export type ParsedBarcodeLookupState =
  | { canonical_gtin: string; data: BarcodeLookupFood; status: "found_owned" }
  | { canonical_gtin: string; data: BarcodeLookupFood; status: "found_public" }
  | {
      canonical_gtin: string;
      status: "ambiguous" | "archived_or_unavailable" | "not_found_local";
    };

function isExactObject(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const keys = Object.keys(value).sort();
  return (
    keys.length === sortedRowKeys.length &&
    keys.every((key, index) => key === sortedRowKeys[index])
  );
}

function isOneOf<T extends string>(
  value: unknown,
  options: readonly T[],
): value is T {
  return typeof value === "string" && options.includes(value as T);
}

function isUuid(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)
  );
}

function isRequiredText(value: unknown, maximum: number) {
  return (
    typeof value === "string" &&
    value.trim().length > 0 &&
    Array.from(value).length <= maximum
  );
}

function isNullableText(value: unknown, maximum: number) {
  return (
    value === null ||
    (typeof value === "string" && Array.from(value).length <= maximum)
  );
}

function isNullableTrimmedText(value: unknown, maximum: number) {
  return (
    value === null ||
    (typeof value === "string" &&
      value === value.trim() &&
      value.length > 0 &&
      Array.from(value).length <= maximum)
  );
}

function isSourceCode(value: unknown) {
  return (
    typeof value === "string" &&
    value.length <= 120 &&
    /^[a-z0-9][a-z0-9_:-]*$/.test(value)
  );
}

function hasValidNullableFoodSource(row: Record<string, unknown>) {
  const values = [
    row.food_source_code,
    row.food_source_name,
    row.food_source_type,
    row.food_source_trust_level,
  ];

  if (values.every((value) => value === null)) return true;
  if (values.some((value) => value === null)) return false;

  return (
    isSourceCode(row.food_source_code) &&
    isRequiredText(row.food_source_name, 120) &&
    isOneOf(row.food_source_type, sourceTypes) &&
    isOneOf(row.food_source_trust_level, sourceTrustLevels)
  );
}

function parseFoundRow(
  row: Record<string, unknown>,
  status: "found_owned" | "found_public",
): BarcodeLookupFood | null {
  const expectedOwnership = status === "found_owned" ? "owned_custom" : "public";

  if (
    !isUuid(row.food_id) ||
    !isRequiredText(row.food_name, 200) ||
    !isNullableText(row.brand_name, 120) ||
    !isNullableTrimmedText(row.food_locale, 10) ||
    !isOneOf(row.food_type, foodTypes) ||
    !isOneOf(row.food_data_quality, dataQualities) ||
    (row.serving_size !== null &&
      (typeof row.serving_size !== "number" ||
        !Number.isFinite(row.serving_size) ||
        row.serving_size < 0)) ||
    !isNullableTrimmedText(row.serving_unit, 40) ||
    !hasValidNullableFoodSource(row) ||
    row.ownership_kind !== expectedOwnership ||
    (status === "found_owned" && row.food_type !== "user_custom") ||
    (status === "found_public" && row.food_type === "user_custom") ||
    !isOneOf(row.mapping_verification_status, verificationStatuses) ||
    !isSourceCode(row.mapping_provenance_source_code) ||
    !isRequiredText(row.mapping_provenance_source_name, 120) ||
    !isOneOf(row.mapping_provenance_source_type, sourceTypes) ||
    !isOneOf(
      row.mapping_provenance_source_trust_level,
      sourceTrustLevels,
    ) ||
    !isNullableTrimmedText(row.mapping_provenance_source_food_id, 160)
  ) {
    return null;
  }

  return {
    brand_name: row.brand_name as string | null,
    canonical_gtin: row.canonical_gtin as string,
    food_data_quality: row.food_data_quality as DataQuality,
    food_id: row.food_id,
    food_locale: row.food_locale as string | null,
    food_name: row.food_name as string,
    food_source_code: row.food_source_code as string | null,
    food_source_name: row.food_source_name as string | null,
    food_source_trust_level: row.food_source_trust_level as SourceTrustLevel | null,
    food_source_type: row.food_source_type as SourceType | null,
    food_type: row.food_type as FoodType,
    mapping_provenance_source_code: row.mapping_provenance_source_code as string,
    mapping_provenance_source_food_id:
      row.mapping_provenance_source_food_id as string | null,
    mapping_provenance_source_name: row.mapping_provenance_source_name as string,
    mapping_provenance_source_trust_level:
      row.mapping_provenance_source_trust_level as SourceTrustLevel,
    mapping_provenance_source_type:
      row.mapping_provenance_source_type as SourceType,
    mapping_verification_status:
      row.mapping_verification_status as VerificationStatus,
    ownership_kind: expectedOwnership,
    serving_size: row.serving_size as number | null,
    serving_unit: row.serving_unit as string | null,
  };
}

export function parseBarcodeLookupRows(
  value: unknown,
): ParsedBarcodeLookupState | null {
  if (!Array.isArray(value) || value.length !== 1 || !isExactObject(value[0])) {
    return null;
  }

  const row = value[0];

  if (
    !isOneOf(row.result_status, lookupStatuses) ||
    !isValidCanonicalGtin(row.canonical_gtin)
  ) {
    return null;
  }

  const status = row.result_status as LookupStatus;

  if (status !== "found_owned" && status !== "found_public") {
    if (foodSpecificKeys.some((key) => row[key] !== null)) return null;
    return { canonical_gtin: row.canonical_gtin as string, status };
  }

  const data = parseFoundRow(row, status);
  return data
    ? { canonical_gtin: row.canonical_gtin as string, data, status }
    : null;
}
