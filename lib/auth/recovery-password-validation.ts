import type { RecoveryResetActionCode } from "@/app/[locale]/auth/recover/reset/action-state";

// GoTrue v2.197.0 checks UTF-8 byte length and membership of explicit sets,
// not Unicode categories. Additional characters are allowed and never changed.
// This is the accepted B1F policy, not a live provider configuration lookup.
const requiredCharacterSets = [
  "abcdefghijklmnopqrstuvwxyz",
  "ABCDEFGHIJKLMNOPQRSTUVWXYZ",
  "0123456789",
  "!@#$%^&*()_+-=[]{};'\\:\"|<>?,./`~",
] as const;

export function validateRecoveryPassword(
  password: string,
  confirmation: string,
): RecoveryResetActionCode | null {
  if (!password) return "passwordRequired";

  const byteLength = new TextEncoder().encode(password).length;
  if (byteLength < 12) return "passwordTooShort";
  // GoTrue's bcrypt input limit is also known before consuming the credential.
  if (byteLength > 72) return "passwordTooLong";
  if (requiredCharacterSets.some((set) => !Array.from(password).some((character) => set.includes(character)))) {
    return "passwordRequirements";
  }
  if (password !== confirmation) return "passwordMismatch";
  return null;
}
