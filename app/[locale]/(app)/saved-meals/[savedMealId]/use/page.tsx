import { randomUUID } from "node:crypto";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { redirect } from "next/navigation";
import { logSavedMealAction } from "@/app/[locale]/(app)/saved-meals/use-actions";
import { BrowserDateBootstrap } from "@/components/calendar-date/browser-date-bootstrap";
import { CalendarDateError } from "@/components/calendar-date/calendar-date-error";
import { RetrievalError } from "@/components/data/retrieval-error";
import { SavedMealUseReview } from "@/components/saved-meals/saved-meal-use-review";
import { resolveAuthLocale, signInPath } from "@/lib/auth/require-user";
import { parseCalendarDateQueryValue } from "@/lib/calendar-date";
import { isUuid } from "@/lib/food-selection/query";
import { getOwnedSavedMealEditor } from "@/lib/saved-meals";
import type { Locale } from "@/lib/i18n/routing";

type PageProps = Readonly<{
  params: Promise<{ locale: string; savedMealId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}>;

export default async function SavedMealUsePage({ params, searchParams }: PageProps) {
  const { locale: localeInput, savedMealId } = await params;
  const query = await searchParams;
  const locale = resolveAuthLocale(localeInput);
  setRequestLocale(locale);

  if (!isUuid(savedMealId)) return <Unavailable locale={locale} state="invalid" />;

  const date = parseCalendarDateQueryValue(query.date);
  const routePath = `/${locale}/saved-meals/${savedMealId}/use`;

  if (date.status === "missing") {
    return <DateBootstrap routePath={routePath} />;
  }

  if (date.status === "invalid" || date.status === "repeated") {
    return <DateError dateQuery={date} routePath={routePath} />;
  }

  const editor = await getOwnedSavedMealEditor(savedMealId);

  if (!editor.ok) {
    if (editor.code === "unauthenticated") redirect(signInPath(locale));
    if (editor.code === "not_found") return <Unavailable locale={locale} state="unavailable" />;
    return <LoadFailure locale={locale} retryHref={`${routePath}?date=${date.date}`} />;
  }

  if (editor.data.is_archived) return <Unavailable locale={locale} state="archived" />;

  const action = logSavedMealAction.bind(
    null,
    locale,
    savedMealId,
    editor.data.updated_at,
    randomUUID(),
  );

  return <SavedMealUseReview action={action} date={date.date} locale={locale} meal={editor.data} />;
}

function DateBootstrap({ routePath }: { routePath: string }) {
  const t = useTranslations("SavedMealUse");
  const dateT = useTranslations("CalendarDate");
  return <section className="flex flex-1 flex-col justify-center py-8 text-start"><BrowserDateBootstrap formDescription={dateT("manual.description")} formLabel={dateT("manual.label")} formSubmitLabel={dateT("manual.submit")} inputId="saved-meal-use-bootstrap-date" queryName="date" routePath={routePath} status={dateT("bootstrap.status")} title={t("bootstrapTitle")} /></section>;
}

function DateError({ dateQuery, routePath }: { dateQuery: Extract<ReturnType<typeof parseCalendarDateQueryValue>, { status: "invalid" } | { status: "repeated" }>; routePath: string }) {
  const dateT = useTranslations("CalendarDate");
  const description = dateQuery.status === "repeated"
    ? dateT("errors.repeated")
    : dateQuery.reason === "unsupported_format"
      ? dateT("errors.unsupported")
      : dateT("errors.invalid");
  return <section className="flex flex-1 flex-col justify-center py-8 text-start"><CalendarDateError description={description} formDescription={dateT("recovery.description")} formLabel={dateT("manual.label")} formSubmitLabel={dateT("manual.submit")} inputId="saved-meal-use-date-error" queryName="date" routePath={routePath} title={dateT("errors.title")} /></section>;
}

function Unavailable({ locale, state }: { locale: Locale; state: "archived" | "invalid" | "unavailable" }) {
  const t = useTranslations("SavedMealUse.states");
  return <section className="flex flex-1 flex-col justify-center py-8 text-start"><div className="max-w-3xl border border-amber-300 bg-amber-50 p-5" data-testid={`saved-meal-use-${state}`}><h1 className="text-2xl font-semibold text-slate-950">{t(`${state}.title`)}</h1><p className="mt-3 text-sm leading-6 text-amber-950" role="alert">{t(`${state}.body`)}</p><Link className="mt-4 inline-flex text-sm font-semibold text-teal-800 underline" href={`/${locale}/saved-meals`}>{t("back")}</Link></div></section>;
}

function LoadFailure({ locale, retryHref }: { locale: Locale; retryHref: string }) {
  const t = useTranslations("SavedMealUse.states.failure");
  return <section className="flex flex-1 flex-col justify-center py-8 text-start"><RetrievalError body={t("body")} retryHref={retryHref} retryLabel={t("retry")} testId="saved-meal-use-retrieval-error" title={t("title")} /><Link className="mt-4 text-sm font-semibold text-teal-800 underline" href={`/${locale}/saved-meals`}>{t("back")}</Link></section>;
}
