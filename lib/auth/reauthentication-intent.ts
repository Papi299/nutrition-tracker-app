import type { Locale } from "@/lib/i18n/routing";

export const accountExportReauthenticationIntent = "account-export";
export const accountClosureReauthenticationIntent = "account-closure";

export type ReauthenticationIntent =
  | typeof accountExportReauthenticationIntent
  | typeof accountClosureReauthenticationIntent;

export function resolveReauthenticationIntent(
  value: unknown,
): ReauthenticationIntent | null {
  if (value === accountExportReauthenticationIntent) {
    return accountExportReauthenticationIntent;
  }

  if (value === accountClosureReauthenticationIntent) {
    return accountClosureReauthenticationIntent;
  }

  return null;
}

export function reauthenticationDestination(
  locale: Locale,
  intent: ReauthenticationIntent | null,
) {
  if (intent === accountExportReauthenticationIntent) {
    return `/${locale}/account/export`;
  }

  if (intent === accountClosureReauthenticationIntent) {
    return `/${locale}/account/closure`;
  }

  return `/${locale}/today`;
}

export function reauthenticationPath(
  locale: Locale,
  intent: ReauthenticationIntent | null = null,
) {
  const path = `/${locale}/auth/reauthenticate`;

  return intent ? `${path}?intent=${intent}` : path;
}
