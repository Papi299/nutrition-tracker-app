export type ActivationActionCode =
  | "activationFailed"
  | "ageRequired"
  | "israelRequired"
  | "missingConfig"
  | "passwordMismatch"
  | "passwordRequired"
  | "passwordTooShort";

export type ActivationActionState = Readonly<{
  code?: ActivationActionCode;
  status: "error" | "idle";
}>;

export const initialActivationActionState: ActivationActionState = {
  status: "idle",
};
