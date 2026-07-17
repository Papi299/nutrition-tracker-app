import { validationError, type DataResult } from "@/lib/data/result";
import { isUuid } from "@/lib/food-selection/query";

export type RecipeUseContractInput = Record<string, unknown>;

export type ValidatedRecipeUseContractInput = {
  recipe_id: string;
  requested_servings: number;
};

const allowedFields = new Set(["recipe_id", "requested_servings"]);

function decimalPlaces(value: string) {
  const match = /^[-+]?(?:\d+(?:\.(\d*))?|\.(\d+))(?:[eE]([-+]?\d+))?$/.exec(
    value,
  );
  if (!match) return null;
  const fractionLength = (match[1] ?? match[2] ?? "").length;
  const exponent = Number(match[3] ?? 0);
  return Math.max(0, fractionLength - exponent);
}

export function validateRecipeUseContractInput(
  input: RecipeUseContractInput,
): DataResult<ValidatedRecipeUseContractInput> {
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    return validationError({ form: "invalid_input" });
  }

  const fieldErrors: Record<string, string> = {};
  for (const field of Object.keys(input)) {
    if (!allowedFields.has(field)) fieldErrors[field] = "unsupported_field";
  }

  const recipeId = input.recipe_id;
  if (typeof recipeId !== "string" || !isUuid(recipeId)) {
    fieldErrors.recipe_id = "invalid_uuid";
  }

  const rawRequested = input.requested_servings;
  let requestedServings = Number.NaN;
  let requestedText = "";
  if (typeof rawRequested === "number") {
    requestedServings = rawRequested;
    requestedText = rawRequested.toString();
  } else if (typeof rawRequested === "string" && rawRequested.trim() !== "") {
    requestedText = rawRequested.trim();
    requestedServings = Number(requestedText);
  } else {
    fieldErrors.requested_servings = "required";
  }

  const places = requestedText === "" ? null : decimalPlaces(requestedText);
  if (
    requestedText !== "" &&
    (places === null || !Number.isFinite(requestedServings))
  ) {
    fieldErrors.requested_servings = "invalid_number";
  } else if (
    requestedText !== "" &&
    (requestedServings < 0.001 || requestedServings > 10_000)
  ) {
    fieldErrors.requested_servings = "number_out_of_range";
  } else if (places !== null && places > 3) {
    fieldErrors.requested_servings = "too_many_decimal_places";
  }

  if (Object.keys(fieldErrors).length > 0 || typeof recipeId !== "string") {
    return validationError(fieldErrors);
  }

  return {
    data: {
      recipe_id: recipeId,
      requested_servings: requestedServings,
    },
    ok: true,
  };
}
