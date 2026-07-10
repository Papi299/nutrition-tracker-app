export const minimumCalendarYear = 1;
export const maximumCalendarYear = 9999;

export type CalendarDateInvalidReason =
  | "invalid_date"
  | "unsupported_format";

export type CalendarDateQueryResult =
  | { status: "missing" }
  | { date: string; status: "valid" }
  | { reason: CalendarDateInvalidReason; status: "invalid" }
  | { status: "repeated" };

const canonicalCalendarDatePattern = /^(\d{4})-(\d{2})-(\d{2})$/;

export function isLeapYear(year: number) {
  return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
}

export function daysInMonth(year: number, month: number) {
  if (month === 2) {
    return isLeapYear(year) ? 29 : 28;
  }

  if (month === 4 || month === 6 || month === 9 || month === 11) {
    return 30;
  }

  return month >= 1 && month <= 12 ? 31 : 0;
}

export function classifyCalendarDate(
  value: string,
): "valid" | CalendarDateInvalidReason {
  const match = canonicalCalendarDatePattern.exec(value);

  if (!match) {
    return "unsupported_format";
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);

  if (year < minimumCalendarYear || year > maximumCalendarYear) {
    return "invalid_date";
  }

  if (month < 1 || month > 12) {
    return "invalid_date";
  }

  if (day < 1 || day > daysInMonth(year, month)) {
    return "invalid_date";
  }

  return "valid";
}

export function isCanonicalCalendarDate(value: string) {
  return classifyCalendarDate(value) === "valid";
}

function padDatePart(value: number, length = 2) {
  return String(value).padStart(length, "0");
}

export function formatBrowserLocalCalendarDate(date = new Date()) {
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const day = date.getDate();

  if (year < minimumCalendarYear || year > maximumCalendarYear) {
    throw new RangeError(
      "Browser-local calendar year is outside the supported range.",
    );
  }

  return `${padDatePart(year, 4)}-${padDatePart(month)}-${padDatePart(day)}`;
}

export function parseCalendarDateQueryValue(
  value: string | string[] | undefined,
): CalendarDateQueryResult {
  if (value === undefined) {
    return { status: "missing" };
  }

  if (Array.isArray(value)) {
    return { status: "repeated" };
  }

  const classification = classifyCalendarDate(value);

  if (classification !== "valid") {
    return { reason: classification, status: "invalid" };
  }

  return { date: value, status: "valid" };
}
