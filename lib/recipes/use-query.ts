import {
  parseCalendarDateQueryValue,
  type CalendarDateQueryResult,
} from "@/lib/calendar-date";
import {
  diaryEntryMealTypes,
  type DiaryEntryMealType,
} from "@/lib/diary-entries/validation";
import { validateRecipeUseContractInput } from "./use-contract-validation";

const allowedFields = new Set(["date", "mealType", "servings"]);
const plainDecimalPattern = /^\d+(?:\.\d+)?$/;

export type RecipeUseQueryInvalidField =
  | "date"
  | "mealType"
  | "query"
  | "servings";

export type RecipeUseQueryResult =
  | {
      date: Extract<CalendarDateQueryResult, { status: "missing" }>;
      meal_type: DiaryEntryMealType | null;
      normalized_servings: string;
      requested_servings: number;
      status: "date_missing";
    }
  | {
      field: RecipeUseQueryInvalidField;
      reason: "invalid" | "repeated" | "unknown";
      status: "invalid";
    }
  | {
      date: string;
      meal_type: DiaryEntryMealType | null;
      needs_canonical_redirect: boolean;
      normalized_servings: string;
      requested_servings: number;
      status: "valid";
    };

function readSingle(value: string | string[] | undefined) {
  if (value === undefined) return { status: "missing" } as const;
  if (Array.isArray(value)) return { status: "repeated" } as const;
  return { status: "value", value } as const;
}

function parseMealType(value: string | string[] | undefined) {
  const read = readSingle(value);
  if (read.status !== "value") return read;
  if (!diaryEntryMealTypes.includes(read.value as DiaryEntryMealType)) {
    return { status: "invalid" } as const;
  }
  return { meal_type: read.value as DiaryEntryMealType, status: "valid" } as const;
}

function parseServings(
  recipeId: string,
  value: string | string[] | undefined,
) {
  const read = readSingle(value);
  if (read.status === "repeated") return read;
  const raw = read.status === "missing" ? "1" : read.value;

  if (!plainDecimalPattern.test(raw)) return { status: "invalid" } as const;
  const validation = validateRecipeUseContractInput({
    recipe_id: recipeId,
    requested_servings: raw,
  });
  if (!validation.ok) return { status: "invalid" } as const;

  const normalized = String(validation.data.requested_servings);
  return {
    needs_canonical_redirect: read.status === "missing" || normalized !== raw,
    normalized,
    requested: validation.data.requested_servings,
    status: "valid",
  } as const;
}

export function recipeUseCanonicalQuery({
  date,
  mealType,
  servings,
}: {
  date: string;
  mealType: DiaryEntryMealType | null;
  servings: string;
}) {
  const query = new URLSearchParams();
  query.set("date", date);
  if (mealType !== null) query.set("mealType", mealType);
  query.set("servings", servings);
  return query.toString();
}

export function parseRecipeUseQuery(
  recipeId: string,
  searchParams: Record<string, string | string[] | undefined>,
): RecipeUseQueryResult {
  if (Object.keys(searchParams).some((field) => !allowedFields.has(field))) {
    return { field: "query", reason: "unknown", status: "invalid" };
  }

  const mealType = parseMealType(searchParams.mealType);
  if (mealType.status === "repeated") {
    return { field: "mealType", reason: "repeated", status: "invalid" };
  }
  if (mealType.status === "invalid") {
    return { field: "mealType", reason: "invalid", status: "invalid" };
  }

  const servings = parseServings(recipeId, searchParams.servings);
  if (servings.status === "repeated") {
    return { field: "servings", reason: "repeated", status: "invalid" };
  }
  if (servings.status === "invalid") {
    return { field: "servings", reason: "invalid", status: "invalid" };
  }

  const date = parseCalendarDateQueryValue(searchParams.date);
  if (date.status === "repeated") {
    return { field: "date", reason: "repeated", status: "invalid" };
  }
  if (date.status === "invalid") {
    return { field: "date", reason: "invalid", status: "invalid" };
  }

  const parsedMealType =
    mealType.status === "valid" ? mealType.meal_type : null;
  if (date.status === "missing") {
    return {
      date,
      meal_type: parsedMealType,
      normalized_servings: servings.normalized,
      requested_servings: servings.requested,
      status: "date_missing",
    };
  }

  return {
    date: date.date,
    meal_type: parsedMealType,
    needs_canonical_redirect: servings.needs_canonical_redirect,
    normalized_servings: servings.normalized,
    requested_servings: servings.requested,
    status: "valid",
  };
}
