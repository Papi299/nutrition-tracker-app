import { resolveReauthenticationIntent } from "@/lib/auth/reauthentication-intent";
import {
  barcodeCustomHandoffCanonicalQuery,
  parseBarcodeCustomHandoffQuery,
} from "@/lib/barcodes/custom-handoff";
import {
  barcodeRouteCanonicalQuery,
  parseBarcodeRouteQuery,
} from "@/lib/barcodes/query";
import { parseCalendarDateQueryValue } from "@/lib/calendar-date/calendar-date";
import { parseCustomFoodManagementQuery } from "@/lib/custom-foods/management-query";
import { parseFoodSearchQuery } from "@/lib/food-search/query";
import { parseFoodDiarySelectionContext } from "@/lib/food-selection/context";
import { isUuid } from "@/lib/food-selection/query";
import { parseRecipeManagementQuery } from "@/lib/recipes/management-query";
import { parseRecipeUseQuery, recipeUseCanonicalQuery } from "@/lib/recipes/use-query";
import { parseSavedMealManagementQuery } from "@/lib/saved-meals/management-query";
import { parseSavedMealSourceQuery } from "@/lib/saved-meals/source-query";

type QueryValues = Record<string, string | string[] | undefined>;
type ManagementQuery =
  | { page: number; status: "active" | "archived"; type: "valid" }
  | { type: "invalid" };

function queryValues(search: Pick<URLSearchParams, "entries">): QueryValues {
  const values: QueryValues = Object.create(null);
  for (const [key, value] of search.entries()) {
    const previous = values[key];
    values[key] = previous === undefined
      ? value
      : Array.isArray(previous) ? [...previous, value] : [previous, value];
  }
  return values;
}

function addDate(query: URLSearchParams, values: QueryValues, key = "date") {
  const parsed = parseCalendarDateQueryValue(values[key]);
  if (parsed.status === "valid") query.set(key, parsed.date);
}

function addNotice(query: URLSearchParams, values: QueryValues, key: string, allowed: readonly string[]) {
  const value = values[key];
  if (typeof value === "string" && allowed.includes(value)) query.set(key, value);
}

function addCreationReceipt(query: URLSearchParams, values: QueryValues, notice: string) {
  const receipt = values.creationRequest;
  if (query.get(notice) === "created" && typeof receipt === "string" && isUuid(receipt)) {
    query.set("creationRequest", receipt);
  }
}

function addManagement(query: URLSearchParams, values: QueryValues, parsed: ManagementQuery) {
  if (parsed.type === "invalid") return;
  // Keep an absent query absent instead of manufacturing default filter values.
  if (values.status !== undefined) query.set("status", parsed.status);
  if (values.page !== undefined) query.set("page", String(parsed.page));
  addNotice(query, values, "saved", ["archived", "restored"]);
}

/** Build only context accepted by the current route; page/action validation stays authoritative. */
export function localeNavigationQuery(pathname: string, search: Pick<URLSearchParams, "entries">): string {
  const segments = pathname.split("/");
  if (segments[0] !== "" || (segments[1] !== "en" && segments[1] !== "he")) return "";
  const route = `/${segments.slice(2).join("/")}`;
  const values = queryValues(search);
  if (Object.keys(values).length === 0) return "";
  const query = new URLSearchParams();

  switch (route) {
    case "/today": {
      addDate(query, values);
      const selection = parseFoodDiarySelectionContext(values);
      if (selection.status === "valid") {
        if (selection.food_id !== null) query.set("foodId", selection.food_id);
        if (selection.meal_type !== null) query.set("mealType", selection.meal_type);
      }
      addNotice(query, values, "customFood", ["created"]);
      addNotice(query, values, "savedMeal", ["logged"]);
      addNotice(query, values, "recipe", ["logged"]);
      addCreationReceipt(query, values, "customFood");
      break;
    }
    case "/setup":
      addDate(query, values, "effectiveDate");
      break;
    case "/foods": {
      addDate(query, values);
      const searchQuery = parseFoodSearchQuery(values.q);
      if (values.q !== undefined && searchQuery.status !== "invalid") query.set("q", searchQuery.value);
      break;
    }
    case "/foods/reuse":
      addDate(query, values);
      break;
    case "/foods/barcode": {
      const barcode = parseBarcodeRouteQuery(values);
      if (barcode.status === "valid") {
        return barcodeRouteCanonicalQuery({ code: barcode.canonical_gtin, date: barcode.date, mealType: barcode.meal_type });
      }
      if (barcode.status === "date_missing") {
        if (barcode.canonical_gtin !== null) query.set("code", barcode.canonical_gtin);
        if (barcode.meal_type !== null) query.set("mealType", barcode.meal_type);
      }
      break;
    }
    case "/foods/custom/new": {
      const handoff = parseBarcodeCustomHandoffQuery(values);
      if (handoff.status === "valid") {
        return barcodeCustomHandoffCanonicalQuery({ barcode: handoff.barcode, date: handoff.date, mealType: handoff.meal_type });
      }
      break;
    }
    case "/foods/custom":
      // This route does not consume a diary date; lifecycle redirects stay unchanged.
      addManagement(query, values, parseCustomFoodManagementQuery(values));
      break;
    case "/saved-meals":
      addDate(query, values);
      addManagement(query, values, parseSavedMealManagementQuery(values));
      break;
    case "/recipes":
      addDate(query, values);
      addManagement(query, values, parseRecipeManagementQuery(values));
      break;
    case "/saved-meals/new": {
      const source = parseSavedMealSourceQuery(values);
      if (source.type === "diary") {
        query.set("date", source.date);
        query.set("mealType", source.meal_type);
      }
      break;
    }
    case "/auth/reauthenticate": {
      const intent = resolveReauthenticationIntent(values.intent);
      if (intent !== null) query.set("intent", intent);
      break;
    }
    case "/auth/sign-in":
      addNotice(query, values, "recovery", ["complete"]);
      break;
    default: {
      const savedMeal = /^\/saved-meals\/([^/]+)\/(edit|use)$/.exec(route);
      if (savedMeal && isUuid(savedMeal[1])) {
        addDate(query, values);
        if (savedMeal[2] === "edit") addNotice(query, values, "saved", ["created", "updated"]);
        break;
      }
      const recipe = /^\/recipes\/([^/]+)\/(edit|use)$/.exec(route);
      if (recipe && isUuid(recipe[1])) {
        if (recipe[2] === "edit") {
          addNotice(query, values, "saved", ["created", "updated"]);
          break;
        }
        const use = parseRecipeUseQuery(recipe[1], values);
        if (use.status === "valid") {
          return recipeUseCanonicalQuery({ date: use.date, mealType: use.meal_type, servings: use.normalized_servings });
        }
        if (use.status === "date_missing") {
          if (use.meal_type !== null) query.set("mealType", use.meal_type);
          if (values.servings !== undefined) query.set("servings", use.normalized_servings);
        }
        break;
      }
      const customFood = /^\/foods\/custom\/([^/]+)\/edit$/.exec(route);
      if (customFood && isUuid(customFood[1])) {
        addNotice(query, values, "saved", ["created", "updated"]);
        addCreationReceipt(query, values, "saved");
      }
    }
  }

  return query.toString();
}
