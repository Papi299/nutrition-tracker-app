export type ReauthenticationActionCode =
  | "passwordRequired"
  | "unavailable"
  | "verificationFailed";

export type ReauthenticationActionState = Readonly<{
  code?: ReauthenticationActionCode;
  status: "error" | "idle";
}>;

export const initialReauthenticationActionState: ReauthenticationActionState = {
  status: "idle",
};
