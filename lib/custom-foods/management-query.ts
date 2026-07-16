export const customFoodManagementStatuses = ["active", "archived"] as const;
export const customFoodManagementPageSize = 20;

export type CustomFoodManagementStatus =
  (typeof customFoodManagementStatuses)[number];

export type CustomFoodManagementQuery =
  | {
      page: number;
      status: CustomFoodManagementStatus;
      type: "valid";
    }
  | {
      field: "page" | "status";
      reason: "invalid" | "repeated";
      type: "invalid";
    };

function readSingleQueryValue(
  value: string | string[] | undefined,
): { type: "missing" } | { type: "repeated" } | { type: "value"; value: string } {
  if (value === undefined) {
    return { type: "missing" };
  }

  if (Array.isArray(value)) {
    return { type: "repeated" };
  }

  return { type: "value", value };
}

export function parseCustomFoodManagementQuery(
  searchParams: Record<string, string | string[] | undefined>,
): CustomFoodManagementQuery {
  const statusValue = readSingleQueryValue(searchParams.status);

  if (statusValue.type === "repeated") {
    return { field: "status", reason: "repeated", type: "invalid" };
  }

  const status = statusValue.type === "missing" ? "active" : statusValue.value;

  if (!customFoodManagementStatuses.includes(status as CustomFoodManagementStatus)) {
    return { field: "status", reason: "invalid", type: "invalid" };
  }

  const pageValue = readSingleQueryValue(searchParams.page);

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
    !Number.isSafeInteger((page - 1) * customFoodManagementPageSize)
  ) {
    return { field: "page", reason: "invalid", type: "invalid" };
  }

  return {
    page,
    status: status as CustomFoodManagementStatus,
    type: "valid",
  };
}
