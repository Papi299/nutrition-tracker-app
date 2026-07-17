import { isSupportedFoodCanonicalGtin } from "@/lib/barcodes/validation";
import { isUuid } from "@/lib/food-selection/query";

const statuses = [
  "ambiguous",
  "archived_or_unavailable",
  "created",
  "owned_archived",
  "owned_existing",
  "public_existing",
] as const;

type BarcodePersistenceStatus = (typeof statuses)[number];

export type CustomFoodBarcodePersistenceState =
  | {
      data: {
        canonical_gtin: string;
        food_id: string;
        is_archived: false;
      };
      ok: true;
      status: "created";
    }
  | {
      canonical_gtin: string;
      food_id: string;
      is_archived: false;
      ok: false;
      status: "owned_existing" | "public_existing";
    }
  | {
      canonical_gtin: string;
      food_id: string;
      is_archived: true;
      ok: false;
      status: "owned_archived";
    }
  | {
      canonical_gtin: string;
      ok: false;
      status: "ambiguous" | "archived_or_unavailable";
    }
  | { code: "validation_error"; fieldErrors: Record<string, string>; ok: false }
  | { code: "unauthenticated" | "database_error"; ok: false };

const rowKeys = [
  "canonical_gtin",
  "food_id",
  "is_archived",
  "result_status",
] as const;
const sortedRowKeys = [...rowKeys].sort();

function isExactRow(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const keys = Object.keys(value).sort();
  return (
    keys.length === sortedRowKeys.length &&
    keys.every((key, index) => key === sortedRowKeys[index])
  );
}

export function parseCustomFoodBarcodePersistenceRows(
  value: unknown,
  expectedCanonicalGtin: string,
): Exclude<
  CustomFoodBarcodePersistenceState,
  { code: "database_error" | "unauthenticated" | "validation_error" }
> | null {
  if (!Array.isArray(value) || value.length !== 1 || !isExactRow(value[0])) {
    return null;
  }

  const row = value[0];
  if (
    typeof row.result_status !== "string" ||
    !statuses.includes(row.result_status as BarcodePersistenceStatus) ||
    !isSupportedFoodCanonicalGtin(row.canonical_gtin) ||
    row.canonical_gtin !== expectedCanonicalGtin
  ) {
    return null;
  }

  const status = row.result_status as BarcodePersistenceStatus;
  const canonicalGtin = row.canonical_gtin as string;

  if (status === "ambiguous" || status === "archived_or_unavailable") {
    return row.food_id === null && row.is_archived === null
      ? { canonical_gtin: canonicalGtin, ok: false, status }
      : null;
  }

  if (
    typeof row.food_id !== "string" ||
    !isUuid(row.food_id) ||
    typeof row.is_archived !== "boolean"
  ) {
    return null;
  }

  if (status === "owned_archived") {
    return row.is_archived
      ? {
          canonical_gtin: canonicalGtin,
          food_id: row.food_id,
          is_archived: true,
          ok: false,
          status,
        }
      : null;
  }

  if (row.is_archived) return null;

  if (status === "created") {
    return {
      data: {
        canonical_gtin: canonicalGtin,
        food_id: row.food_id,
        is_archived: false,
      },
      ok: true,
      status,
    };
  }

  return {
    canonical_gtin: canonicalGtin,
    food_id: row.food_id,
    is_archived: false,
    ok: false,
    status,
  };
}
