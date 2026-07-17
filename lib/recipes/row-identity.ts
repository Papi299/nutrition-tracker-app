import { isUuid } from "@/lib/food-selection/query";

export type RecipeRowKeyKind = "client" | "ingredient";

export function recipeRowKey(kind: RecipeRowKeyKind, id: string) {
  return `${kind}:${id}`;
}

export function parseRecipeRowKey(value: unknown): {
  id: string;
  kind: RecipeRowKeyKind;
} | null {
  if (typeof value !== "string") return null;
  const separator = value.indexOf(":");
  if (separator < 1 || value.indexOf(":", separator + 1) !== -1) return null;

  const kind = value.slice(0, separator);
  const id = value.slice(separator + 1);
  if ((kind !== "client" && kind !== "ingredient") || !isUuid(id)) return null;
  return { id, kind };
}
