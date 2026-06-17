export type DataErrorCode =
  | "already_exists"
  | "database_error"
  | "not_found"
  | "unauthenticated"
  | "validation_error";

export type DataError = {
  code: DataErrorCode;
  fieldErrors?: Record<string, string>;
  ok: false;
};

export type DataSuccess<T> = {
  data: T;
  ok: true;
};

export type DataResult<T> = DataError | DataSuccess<T>;

export function validationError(
  fieldErrors: Record<string, string>,
): DataError {
  return {
    code: "validation_error",
    fieldErrors,
    ok: false,
  };
}
