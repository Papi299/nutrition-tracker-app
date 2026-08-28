import type { Locale } from "@/lib/i18n/routing";

export const accountExportReauthenticationIntent = "account-export";

export type ReauthenticationIntent =
  typeof accountExportReauthenticationIntent;

export function resolveReauthenticationIntent(
  value: unknown,
): ReauthenticationIntent | null {
  return value === accountExportReauthenticationIntent
    ? accountExportReauthenticationIntent
    : null;
}

export function reauthenticationDestination(
  locale: Locale,
  intent: ReauthenticationIntent | null,
) {
  if (intent === accountExportReauthenticationIntent) {
    return `/${locale}/account/export`;
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
