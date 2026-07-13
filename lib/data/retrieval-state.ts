import type { DataErrorCode, DataResult } from "./result";

export type RetrievalFailureStatus =
  | "database_error"
  | "unauthenticated"
  | "validation_error";

export type RetrievalState<T> =
  | { data: T; status: "ready" }
  | { status: "missing" }
  | { status: RetrievalFailureStatus };

function resolveFailureStatus(code: DataErrorCode): RetrievalFailureStatus {
  if (code === "unauthenticated" || code === "validation_error") {
    return code;
  }

  return "database_error";
}

export function resolveRetrieval<T>(result: DataResult<T>): RetrievalState<T> {
  return result.ok
    ? { data: result.data, status: "ready" }
    : { status: resolveFailureStatus(result.code) };
}

export function resolveNullableRetrieval<T>(
  result: DataResult<T | null>,
): RetrievalState<T> {
  if (!result.ok) {
    return { status: resolveFailureStatus(result.code) };
  }

  return result.data === null
    ? { status: "missing" }
    : { data: result.data, status: "ready" };
}

export function isRetrievalFailure<T>(state: RetrievalState<T>) {
  return (
    state.status === "database_error" || state.status === "validation_error"
  );
}
