import { parseCalendarDateQueryValue } from "@/lib/calendar-date";
import {
  parseDiaryMealTypeQuery,
  type DiaryEntryMealType,
} from "@/lib/diary-entries/validation";
import { isSupportedFoodCanonicalGtin } from "./validation";

const allowedFields = new Set(["barcode", "date", "mealType"]);

export type BarcodeCustomHandoffQuery =
  | { status: "ordinary" }
  | {
      barcode: string;
      date: string;
      meal_type: DiaryEntryMealType | null;
      status: "valid";
    }
  | {
      field: "barcode" | "date" | "mealType" | "query";
      reason:
        | "context_without_barcode"
        | "invalid"
        | "missing"
        | "repeated"
        | "unknown";
      status: "invalid";
    };

export function barcodeCustomHandoffCanonicalQuery({
  barcode,
  date,
  mealType,
}: {
  barcode: string;
  date: string;
  mealType: DiaryEntryMealType | null;
}) {
  const query = new URLSearchParams({ barcode, date });
  if (mealType !== null) query.set("mealType", mealType);
  return query.toString();
}

export function parseBarcodeCustomHandoffQuery(
  searchParams: Record<string, string | string[] | undefined>,
): BarcodeCustomHandoffQuery {
  const presentFields = Object.keys(searchParams);

  if (presentFields.length === 0) return { status: "ordinary" };

  if (presentFields.some((field) => !allowedFields.has(field))) {
    return { field: "query", reason: "unknown", status: "invalid" };
  }

  for (const field of ["barcode", "date", "mealType"] as const) {
    if (Array.isArray(searchParams[field])) {
      return { field, reason: "repeated", status: "invalid" };
    }
  }

  if (searchParams.barcode === undefined) {
    return {
      field: "barcode",
      reason: "context_without_barcode",
      status: "invalid",
    };
  }

  if (!isSupportedFoodCanonicalGtin(searchParams.barcode)) {
    return { field: "barcode", reason: "invalid", status: "invalid" };
  }

  if (searchParams.date === undefined || searchParams.date === "") {
    return { field: "date", reason: "missing", status: "invalid" };
  }

  const date = parseCalendarDateQueryValue(searchParams.date);
  if (date.status !== "valid") {
    return {
      field: "date",
      reason: date.status === "repeated" ? "repeated" : "invalid",
      status: "invalid",
    };
  }

  if (searchParams.mealType === "") {
    return { field: "mealType", reason: "invalid", status: "invalid" };
  }

  const mealType = parseDiaryMealTypeQuery(searchParams.mealType);
  if (mealType.status === "invalid" || mealType.status === "repeated") {
    return {
      field: "mealType",
      reason: mealType.status,
      status: "invalid",
    };
  }

  return {
    barcode: searchParams.barcode,
    date: date.date,
    meal_type: mealType.status === "valid" ? mealType.meal_type : null,
    status: "valid",
  };
}
