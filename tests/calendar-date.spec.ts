import { expect, test } from "@playwright/test";
import {
  classifyCalendarDate,
  formatBrowserLocalCalendarDate,
  isCanonicalCalendarDate,
  maximumCalendarYear,
  minimumCalendarYear,
  parseCalendarDateQueryValue,
} from "@/lib/calendar-date";
import { validateDiaryEntryDate } from "@/lib/diary-entries/validation";
import { validateTargetDate } from "@/lib/nutrition-targets/validation";

test.describe("calendar-date validation", () => {
  const validDates = [
    "2026-01-01",
    "2024-02-29",
    "0001-01-01",
    "9999-12-31",
  ];

  for (const date of validDates) {
    test(`accepts and preserves ${date}`, () => {
      expect(isCanonicalCalendarDate(date)).toBe(true);
      expect(parseCalendarDateQueryValue(date)).toEqual({
        date,
        status: "valid",
      });
    });
  }

  const impossibleDates = [
    "0000-01-01",
    "2026-00-01",
    "2026-13-01",
    "2026-01-00",
    "2026-02-29",
    "2026-02-30",
  ];

  for (const date of impossibleDates) {
    test(`rejects impossible date ${date}`, () => {
      expect(classifyCalendarDate(date)).toBe("invalid_date");
      expect(parseCalendarDateQueryValue(date)).toEqual({
        reason: "invalid_date",
        status: "invalid",
      });
    });
  }

  const unsupportedDates = [
    "2026-1-01",
    "26-01-01",
    "2026/01/01",
    "2026-01-01T00:00:00Z",
    " 2026-01-01",
    "2026-01-01 ",
    "",
  ];

  for (const date of unsupportedDates) {
    test(`rejects unsupported format ${JSON.stringify(date)}`, () => {
      expect(classifyCalendarDate(date)).toBe("unsupported_format");
    });
  }

  test("documents the supported year range", () => {
    expect(minimumCalendarYear).toBe(1);
    expect(maximumCalendarYear).toBe(9999);
  });

  test("classifies a missing query value", () => {
    expect(parseCalendarDateQueryValue(undefined)).toEqual({ status: "missing" });
  });

  test("rejects repeated query values", () => {
    expect(parseCalendarDateQueryValue(["2026-01-01", "2026-01-02"])).toEqual({
      status: "repeated",
    });
  });

  test("requires explicit canonical dates at diary and target boundaries", () => {
    expect(validateDiaryEntryDate(" 2026-01-01")).toMatchObject({
      code: "validation_error",
      ok: false,
    });
    expect(validateTargetDate("2026-01-01 ")).toMatchObject({
      code: "validation_error",
      ok: false,
    });
    expect(validateTargetDate(undefined)).toMatchObject({
      code: "validation_error",
      ok: false,
    });
    expect(validateDiaryEntryDate("2026-01-01")).toEqual({
      data: "2026-01-01",
      ok: true,
    });
  });

  test("formats browser-local components when UTC is on the previous date", () => {
    const previousTimezone = process.env.TZ;

    try {
      process.env.TZ = "Asia/Jerusalem";
      const instant = new Date("2026-01-15T22:30:00.000Z");

      expect(instant.getDate()).toBe(16);
      expect(formatBrowserLocalCalendarDate(instant)).toBe("2026-01-16");
    } finally {
      process.env.TZ = previousTimezone;
    }
  });
});
