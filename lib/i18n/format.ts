import type { Locale } from "@/lib/i18n/routing";

export const localeTags: Record<Locale, "en-US" | "he-IL"> = {
  en: "en-US",
  he: "he-IL",
};

export function formatLocalizedNumber(
  locale: Locale,
  value: number | string,
  options: Intl.NumberFormatOptions = {},
) {
  const numericValue = typeof value === "number" ? value : Number(value);

  if (!Number.isFinite(numericValue)) return String(value);

  return new Intl.NumberFormat(localeTags[locale], {
    maximumFractionDigits: 12,
    ...options,
  }).format(numericValue);
}

export function formatLocalizedDate(
  locale: Locale,
  value: Date | string,
  options: Intl.DateTimeFormatOptions = {},
) {
  const date =
    typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)
      ? new Date(`${value}T00:00:00.000Z`)
      : new Date(value);

  return new Intl.DateTimeFormat(localeTags[locale], {
    dateStyle: "medium",
    timeZone: "UTC",
    ...options,
  }).format(date);
}
