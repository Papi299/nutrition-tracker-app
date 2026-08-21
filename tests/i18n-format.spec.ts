import { expect, test } from "@playwright/test";
import {
  formatLocalizedDate,
  formatLocalizedNumber,
  localeTags,
} from "@/lib/i18n/format";

test("formats display numbers with the active approved locale without changing zero", () => {
  for (const locale of ["en", "he"] as const) {
    expect(formatLocalizedNumber(locale, 0)).toBe(
      new Intl.NumberFormat(localeTags[locale], {
        maximumFractionDigits: 12,
      }).format(0),
    );
    expect(formatLocalizedNumber(locale, "1234.5", { maximumFractionDigits: 2 })).toBe(
      new Intl.NumberFormat(localeTags[locale], {
        maximumFractionDigits: 2,
      }).format(1234.5),
    );
  }
});

test("formats calendar dates at UTC midnight so date-only semantics cannot shift", () => {
  for (const locale of ["en", "he"] as const) {
    expect(formatLocalizedDate(locale, "2026-08-21", { dateStyle: "long" })).toBe(
      new Intl.DateTimeFormat(localeTags[locale], {
        dateStyle: "long",
        timeZone: "UTC",
      }).format(new Date("2026-08-21T00:00:00.000Z")),
    );
  }
});

test("uses explicit English and Hebrew regional presentation contracts", () => {
  expect(localeTags).toEqual({ en: "en-US", he: "he-IL" });
  expect(formatLocalizedDate("en", "2026-08-21")).not.toBe(
    formatLocalizedDate("he", "2026-08-21"),
  );
});
