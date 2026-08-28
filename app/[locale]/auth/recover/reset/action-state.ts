export type RecoveryResetActionCode =
  | "passwordMismatch"
  | "passwordRequired"
  | "passwordTooShort";

export type RecoveryResetActionState = Readonly<{
  code?: RecoveryResetActionCode;
  status: "error" | "idle";
}>;

export const initialRecoveryResetActionState: RecoveryResetActionState = {
  status: "idle",
};
