import { useTranslations } from "next-intl";
import { CalendarDateError } from "@/components/calendar-date/calendar-date-error";
import type { CalendarDateQueryResult } from "@/lib/calendar-date";

export function discoveryDateHref(href: string, selectedDate?: string | null) {
  return selectedDate ? `${href}${href.includes("?") ? "&" : "?"}date=${selectedDate}` : href;
}

export function FoodDiscoveryDateError({ dateQuery, routePath }: {
  dateQuery: Extract<CalendarDateQueryResult, { status: "invalid" } | { status: "repeated" }>;
  routePath: string;
}) {
  const t = useTranslations("CalendarDate");
  const description = dateQuery.status === "repeated" ? t("errors.repeated")
    : dateQuery.reason === "unsupported_format" ? t("errors.unsupported") : t("errors.invalid");
  return (
    <section className="flex flex-1 flex-col justify-center py-8 text-start" data-testid="food-discovery-date-error">
      <CalendarDateError description={description} formDescription={t("recovery.description")}
        formLabel={t("manual.label")} formSubmitLabel={t("manual.submit")}
        inputId="food-discovery-recovery-date" queryName="date" routePath={routePath} title={t("errors.title")} />
    </section>
  );
}
