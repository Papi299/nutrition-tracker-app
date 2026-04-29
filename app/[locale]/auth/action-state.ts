export type AuthActionCode =
  | "authFailed"
  | "checkEmail"
  | "invalidEmail"
  | "missingConfig"
  | "passwordRequired"
  | "passwordTooShort";

export type AuthActionState = {
  code: AuthActionCode | null;
  status: "idle" | "error" | "success";
};

export const initialAuthActionState: AuthActionState = {
  code: null,
  status: "idle",
};
