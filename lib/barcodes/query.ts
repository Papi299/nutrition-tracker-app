import {
  parseCalendarDateQueryValue,
} from "@/lib/calendar-date";
import {
  parseDiaryMealTypeQuery,
  type DiaryEntryMealType,
} from "@/lib/diary-entries/validation";
import type { BarcodeLookupState } from "./lookup-core";
import {
  BARCODE_RAW_INPUT_MAX_LENGTH,
  validateGtinInput,
  type GtinValidationErrorCode,
} from "./validation";

const allowedBarcodeRouteFields = new Set(["code", "date", "mealType"]);

export type BarcodeRouteInvalidField = "code" | "date" | "mealType" | "query";
export type BarcodeRouteInvalidReason =
  | GtinValidationErrorCode
  | "invalid"
  | "repeated"
  | "unknown";

export type BarcodeRouteQueryResult =
  | {
      canonical_gtin: string | null;
      meal_type: DiaryEntryMealType | null;
      status: "date_missing";
    }
  | {
      canonical_gtin: string | null;
      date: string;
      meal_type: DiaryEntryMealType | null;
      needs_canonical_redirect: boolean;
      status: "valid";
    }
  | {
      date: string | null;
      field: BarcodeRouteInvalidField;
      meal_type: DiaryEntryMealType | null;
      reason: BarcodeRouteInvalidReason;
      status: "invalid";
      submitted_code: string;
    };

export type BarcodeRouteResolution = {
  lookup?: BarcodeLookupState;
  query: BarcodeRouteQueryResult;
};

function boundedCode(value: string | string[] | undefined) {
  return typeof value === "string"
    ? value.slice(0, BARCODE_RAW_INPUT_MAX_LENGTH)
    : "";
}

function validDateOrNull(value: string | string[] | undefined) {
  const result = parseCalendarDateQueryValue(value);
  return result.status === "valid" ? result.date : null;
}

function invalidQuery(
  searchParams: Record<string, string | string[] | undefined>,
  field: BarcodeRouteInvalidField,
  reason: BarcodeRouteInvalidReason,
  mealType: DiaryEntryMealType | null = null,
  canonicalGtin: string | null = null,
): BarcodeRouteQueryResult {
  return {
    date: validDateOrNull(searchParams.date),
    field,
    meal_type: mealType,
    reason,
    status: "invalid",
    submitted_code: canonicalGtin ?? boundedCode(searchParams.code),
  };
}

export function barcodeRouteCanonicalQuery({
  code,
  date,
  mealType,
}: {
  code: string | null;
  date: string;
  mealType: DiaryEntryMealType | null;
}) {
  const query = new URLSearchParams();
  if (code !== null) query.set("code", code);
  query.set("date", date);
  if (mealType !== null) query.set("mealType", mealType);
  return query.toString();
}

export function parseBarcodeRouteQuery(
  searchParams: Record<string, string | string[] | undefined>,
): BarcodeRouteQueryResult {
  if (Object.keys(searchParams).some((field) => !allowedBarcodeRouteFields.has(field))) {
    return invalidQuery(searchParams, "query", "unknown");
  }

  for (const field of ["code", "date", "mealType"] as const) {
    if (Array.isArray(searchParams[field])) {
      return invalidQuery(searchParams, field, "repeated");
    }
  }

  const mealType = parseDiaryMealTypeQuery(
    searchParams.mealType === "" ? undefined : searchParams.mealType,
  );
  if (mealType.status === "invalid") {
    return invalidQuery(searchParams, "mealType", "invalid");
  }
  if (mealType.status === "repeated") {
    return invalidQuery(searchParams, "mealType", "repeated");
  }
  const parsedMealType =
    mealType.status === "valid" ? mealType.meal_type : null;

  let canonicalGtin: string | null = null;
  let needsCanonicalRedirect = false;

  if (searchParams.code !== undefined) {
    const validation = validateGtinInput(searchParams.code);
    if (!validation.ok) {
      return invalidQuery(
        searchParams,
        "code",
        validation.code,
        parsedMealType,
      );
    }
    canonicalGtin = validation.data.canonical_gtin;
    needsCanonicalRedirect = searchParams.code !== canonicalGtin;
  }

  const date = parseCalendarDateQueryValue(searchParams.date);
  if (date.status === "invalid") {
    return invalidQuery(
      searchParams,
      "date",
      "invalid",
      parsedMealType,
      canonicalGtin,
    );
  }
  if (date.status === "repeated") {
    return invalidQuery(
      searchParams,
      "date",
      "repeated",
      parsedMealType,
      canonicalGtin,
    );
  }
  if (date.status === "missing") {
    return {
      canonical_gtin: canonicalGtin,
      meal_type: parsedMealType,
      status: "date_missing",
    };
  }

  return {
    canonical_gtin: canonicalGtin,
    date: date.date,
    meal_type: parsedMealType,
    needs_canonical_redirect:
      needsCanonicalRedirect || searchParams.mealType === "",
    status: "valid",
  };
}

export async function resolveBarcodeRoute(
  searchParams: Record<string, string | string[] | undefined>,
  lookup: (canonicalGtin: string) => Promise<BarcodeLookupState>,
): Promise<BarcodeRouteResolution> {
  const query = parseBarcodeRouteQuery(searchParams);

  if (
    query.status !== "valid" ||
    query.canonical_gtin === null ||
    query.needs_canonical_redirect
  ) {
    return { query };
  }

  return { lookup: await lookup(query.canonical_gtin), query };
}

export function barcodeLookupCapabilities(status: BarcodeLookupState["status"]) {
  return {
    canCreateOrdinaryCustomFood: status === "not_found_local",
    canEditCustomFood: status === "found_owned",
    canReviewForDiary: status === "found_owned" || status === "found_public",
  };
}
