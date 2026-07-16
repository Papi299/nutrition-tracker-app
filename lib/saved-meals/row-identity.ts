import { isUuid } from "@/lib/food-selection/query";

export type SavedMealRowKeyKind = "client" | "diary" | "item";

export function savedMealRowKey(kind: SavedMealRowKeyKind, id: string) {
  return `${kind}:${id}`;
}

export function parseSavedMealRowKey(value: unknown): {
  id: string;
  kind: SavedMealRowKeyKind;
} | null {
  if (typeof value !== "string") return null;

  const separator = value.indexOf(":");

  if (separator < 1 || value.indexOf(":", separator + 1) !== -1) return null;

  const kind = value.slice(0, separator);
  const id = value.slice(separator + 1);

  if (
    (kind !== "client" && kind !== "diary" && kind !== "item") ||
    !isUuid(id)
  ) {
    return null;
  }

  return { id, kind };
}
