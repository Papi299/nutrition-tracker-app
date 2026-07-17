export const recipeManagementStatuses = ["active", "archived"] as const;
export const recipeManagementPageSize = 20;

export type RecipeManagementStatus = (typeof recipeManagementStatuses)[number];

export type RecipeManagementQuery =
  | { page: number; status: RecipeManagementStatus; type: "valid" }
  | {
      field: "page" | "status";
      reason: "invalid" | "repeated";
      type: "invalid";
    };

function readSingle(value: string | string[] | undefined) {
  if (value === undefined) return { type: "missing" } as const;
  if (Array.isArray(value)) return { type: "repeated" } as const;
  return { type: "value", value } as const;
}

export function parseRecipeManagementQuery(
  searchParams: Record<string, string | string[] | undefined>,
): RecipeManagementQuery {
  const statusValue = readSingle(searchParams.status);
  if (statusValue.type === "repeated") {
    return { field: "status", reason: "repeated", type: "invalid" };
  }

  const status = statusValue.type === "missing" ? "active" : statusValue.value;
  if (!recipeManagementStatuses.includes(status as RecipeManagementStatus)) {
    return { field: "status", reason: "invalid", type: "invalid" };
  }

  const pageValue = readSingle(searchParams.page);
  if (pageValue.type === "repeated") {
    return { field: "page", reason: "repeated", type: "invalid" };
  }

  const rawPage = pageValue.type === "missing" ? "1" : pageValue.value;
  if (!/^[1-9]\d*$/.test(rawPage)) {
    return { field: "page", reason: "invalid", type: "invalid" };
  }

  const page = Number(rawPage);
  if (
    !Number.isSafeInteger(page) ||
    !Number.isSafeInteger((page - 1) * recipeManagementPageSize)
  ) {
    return { field: "page", reason: "invalid", type: "invalid" };
  }

  return { page, status: status as RecipeManagementStatus, type: "valid" };
}
