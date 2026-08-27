export type AuthActionCode =
  | "authFailed"
  | "invalidEmail"
  | "missingConfig"
  | "passwordRequired"
  | "passwordTooShort";

export type AuthActionState = {
  code: AuthActionCode | null;
  status: "idle" | "error";
};

export const initialAuthActionState: AuthActionState = {
  code: null,
  status: "idle",
};
