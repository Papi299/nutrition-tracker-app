export type RecoveryRequestActionState = Readonly<{
  code?: "invalidEmail";
  status: "error" | "idle" | "success";
}>;

export const initialRecoveryRequestActionState: RecoveryRequestActionState = {
  status: "idle",
};
