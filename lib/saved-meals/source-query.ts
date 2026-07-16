import { parseCalendarDateQueryValue } from "@/lib/calendar-date";
import {
  diaryEntryMealTypes,
  type DiaryEntryMealType,
} from "@/lib/diary-entries/validation";

export type SavedMealSourceQuery =
  | { type: "blank" }
  | { date: string; meal_type: DiaryEntryMealType; type: "diary" }
  | {
      field: "context" | "date" | "meal_type";
      reason: "invalid" | "missing_pair" | "repeated";
      type: "invalid";
    };

function readSingle(value: string | string[] | undefined) {
  if (value === undefined) return { type: "missing" } as const;
  if (Array.isArray(value)) return { type: "repeated" } as const;
  return { type: "value", value } as const;
}

export function parseSavedMealSourceQuery(
  searchParams: Record<string, string | string[] | undefined>,
): SavedMealSourceQuery {
  const dateValue = readSingle(searchParams.date);
  const mealTypeValue = readSingle(searchParams.mealType);

  if (dateValue.type === "repeated") {
    return { field: "date", reason: "repeated", type: "invalid" };
  }

  if (mealTypeValue.type === "repeated") {
    return { field: "meal_type", reason: "repeated", type: "invalid" };
  }

  if (dateValue.type === "missing" && mealTypeValue.type === "missing") {
    return { type: "blank" };
  }

  if (dateValue.type === "missing" || mealTypeValue.type === "missing") {
    return { field: "context", reason: "missing_pair", type: "invalid" };
  }

  const date = parseCalendarDateQueryValue(dateValue.value);

  if (date.status !== "valid") {
    return { field: "date", reason: "invalid", type: "invalid" };
  }

  if (
    !diaryEntryMealTypes.includes(
      mealTypeValue.value as DiaryEntryMealType,
    )
  ) {
    return { field: "meal_type", reason: "invalid", type: "invalid" };
  }

  return {
    date: date.date,
    meal_type: mealTypeValue.value as DiaryEntryMealType,
    type: "diary",
  };
}
