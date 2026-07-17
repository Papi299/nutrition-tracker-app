import {
  parseDiaryMealTypeQuery,
  type DiaryEntryMealType,
} from "@/lib/diary-entries/validation";
import { parseFoodSelectionQuery } from "./query";

export type FoodDiarySelectionContext =
  | {
      food_id: string | null;
      meal_type: DiaryEntryMealType | null;
      status: "valid";
    }
  | {
      field: "foodId" | "mealType";
      reason: "invalid" | "repeated";
      status: "invalid";
    };

export function parseFoodDiarySelectionContext(
  searchParams: Record<string, string | string[] | undefined>,
): FoodDiarySelectionContext {
  const food = parseFoodSelectionQuery(searchParams.foodId);
  if (food.status === "invalid" || food.status === "repeated") {
    return { field: "foodId", reason: food.status, status: "invalid" };
  }

  const meal = parseDiaryMealTypeQuery(searchParams.mealType);
  if (meal.status === "invalid" || meal.status === "repeated") {
    return { field: "mealType", reason: meal.status, status: "invalid" };
  }

  return {
    food_id: food.status === "valid" ? food.foodId : null,
    meal_type: meal.status === "valid" ? meal.meal_type : null,
    status: "valid",
  };
}
