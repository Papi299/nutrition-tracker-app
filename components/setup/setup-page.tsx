import { useTranslations } from "next-intl";
import { redirect } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { saveSetupAction } from "@/app/[locale]/(app)/setup/actions";
import type {
  SetupActionState,
  SetupFieldValues,
} from "@/app/[locale]/(app)/setup/action-state";
import { BrowserDateBootstrap } from "@/components/calendar-date/browser-date-bootstrap";
import { CalendarDateError } from "@/components/calendar-date/calendar-date-error";
import { RetrievalError } from "@/components/data/retrieval-error";
import { SetupForm } from "@/components/setup/setup-form";
import { resolveAuthLocale, signInPath } from "@/lib/auth/require-user";
import {
  parseCalendarDateQueryValue,
  type CalendarDateQueryResult,
} from "@/lib/calendar-date";
import type { Locale } from "@/lib/i18n/routing";
import {
  isRetrievalFailure,
  resolveNullableRetrieval,
} from "@/lib/data/retrieval-state";
import { getEffectiveTargetForDate } from "@/lib/nutrition-targets";
import { getCurrentProfile } from "@/lib/profile";

export type SetupPageProps = Readonly<{
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}>;

type SetupPageState =
  | { status: "database_error" }
  | { status: "unauthenticated" }
  | {
      hasProfile: boolean;
      status: "ready";
      values: SetupFieldValues;
    };

type ReadySetupPageState = Extract<SetupPageState, { status: "ready" }>;

function formatOptionalTargetValue(value: null | number) {
  return value === null ? "" : String(value);
}

async function getSetupPageState(
  effectiveDate: string,
  locale: Locale,
): Promise<SetupPageState> {
  const [profileResult, targetResult] = await Promise.all([
    getCurrentProfile(),
    getEffectiveTargetForDate(effectiveDate),
  ]);
  const profileState = resolveNullableRetrieval(profileResult);
  const targetState = resolveNullableRetrieval(targetResult);

  if (
    profileState.status === "unauthenticated" ||
    targetState.status === "unauthenticated"
  ) {
    return { status: "unauthenticated" };
  }

  if (isRetrievalFailure(profileState) || isRetrievalFailure(targetState)) {
    return { status: "database_error" };
  }

  const profile = profileState.status === "ready" ? profileState.data : null;
  const target = targetState.status === "ready" ? targetState.data : null;

  return {
    hasProfile: profile !== null,
    status: "ready",
    values: {
      calories: formatOptionalTargetValue(target?.calories ?? null),
      carbohydrates_g: formatOptionalTargetValue(target?.carbohydrates_g ?? null),
      display_name: profile?.display_name ?? "",
      effectiveDate,
      fat_g: formatOptionalTargetValue(target?.fat_g ?? null),
      preferred_language:
        profile?.preferred_language === "en" || profile?.preferred_language === "he"
          ? profile.preferred_language
          : locale,
      protein_g: formatOptionalTargetValue(target?.protein_g ?? null),
    },
  };
}

export async function SetupPage({
  params,
  progressive = false,
  searchParams,
}: SetupPageProps & { progressive?: boolean }) {
  const { locale: localeInput } = await params;
  const resolvedSearchParams = await searchParams;
  const locale = resolveAuthLocale(localeInput);
  const dateQuery = parseCalendarDateQueryValue(
    resolvedSearchParams.effectiveDate,
  );

  setRequestLocale(locale);

  if (dateQuery.status === "missing") {
    return (
      <LocalizedSetupDateBootstrap
        locale={locale}
        progressive={progressive}
      />
    );
  }

  if (dateQuery.status === "invalid" || dateQuery.status === "repeated") {
    return (
      <LocalizedSetupDateError
        dateQuery={dateQuery}
        locale={locale}
        progressive={progressive}
      />
    );
  }

  const pageState = await getSetupPageState(dateQuery.date, locale);

  if (pageState.status === "unauthenticated") {
    if (progressive) {
      return <LocalizedSetupSessionRequired locale={locale} />;
    }

    redirect(signInPath(locale));
  }

  if (pageState.status === "database_error") {
    return (
      <LocalizedSetupRetrievalError
        effectiveDate={dateQuery.date}
        locale={locale}
        progressive={progressive}
      />
    );
  }

  return (
    <LocalizedSetupPage
      locale={locale}
      pageState={pageState}
      progressivePermalink={`/${locale}/setup/nojs?effectiveDate=${pageState.values.effectiveDate}`}
    />
  );
}

function LocalizedSetupSessionRequired({ locale }: { locale: Locale }) {
  const authT = useTranslations("Auth");
  const setupT = useTranslations("Setup");

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-3xl items-center px-5 py-12 text-start sm:px-8">
      <section className="w-full border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <h1 className="text-3xl font-semibold text-slate-950">
          {authT("signIn.title")}
        </h1>
        <p className="mt-4 text-base leading-7 text-slate-700">
          {setupT("errors.unauthenticated")}
        </p>
        <a
          className="mt-6 inline-flex min-h-12 items-center bg-teal-700 px-4 text-base font-semibold text-white"
          href={signInPath(locale)}
        >
          {authT("signIn.submit")}
        </a>
      </section>
    </main>
  );
}

function LocalizedSetupRetrievalError({
  effectiveDate,
  locale,
  progressive,
}: {
  effectiveDate: string;
  locale: Locale;
  progressive: boolean;
}) {
  const t = useTranslations("Setup.retrievalError");

  return (
    <section className="flex flex-1 flex-col justify-center py-8">
      <div className="max-w-3xl">
        <RetrievalError
          body={t("body")}
          retryHref={`/${locale}/setup${progressive ? "/nojs" : ""}?effectiveDate=${effectiveDate}`}
          retryLabel={t("retry")}
          testId="setup-retrieval-error"
          title={t("title")}
        />
      </div>
    </section>
  );
}

function LocalizedSetupDateBootstrap({
  locale,
  progressive,
}: {
  locale: Locale;
  progressive: boolean;
}) {
  const dateT = useTranslations("CalendarDate");

  return (
    <section className="flex flex-1 flex-col justify-center py-8 text-start">
      <BrowserDateBootstrap
        formDescription={dateT("manual.description")}
        formLabel={dateT("manual.label")}
        formSubmitLabel={dateT("manual.submit")}
        inputId="setup-bootstrap-date"
        queryName="effectiveDate"
        routePath={`/${locale}/setup${progressive ? "/nojs" : ""}`}
        status={dateT("bootstrap.status")}
        title={dateT("bootstrap.setupTitle")}
      />
    </section>
  );
}

function LocalizedSetupDateError({
  dateQuery,
  locale,
  progressive,
}: {
  dateQuery: Extract<
    CalendarDateQueryResult,
    { status: "invalid" } | { status: "repeated" }
  >;
  locale: Locale;
  progressive: boolean;
}) {
  const dateT = useTranslations("CalendarDate");
  const description =
    dateQuery.status === "repeated"
      ? dateT("errors.repeated")
      : dateQuery.reason === "unsupported_format"
        ? dateT("errors.unsupported")
        : dateT("errors.invalid");

  return (
    <section className="flex flex-1 flex-col justify-center py-8 text-start">
      <CalendarDateError
        description={description}
        formDescription={dateT("recovery.description")}
        formLabel={dateT("manual.label")}
        formSubmitLabel={dateT("manual.submit")}
        inputId="setup-recovery-date"
        queryName="effectiveDate"
        routePath={`/${locale}/setup${progressive ? "/nojs" : ""}`}
        title={dateT("errors.title")}
      />
    </section>
  );
}

function LocalizedSetupPage({
  locale,
  pageState,
  progressivePermalink,
}: {
  locale: Locale;
  pageState: ReadySetupPageState;
  progressivePermalink: string;
}) {
  const t = useTranslations("Setup");
  const action = saveSetupAction.bind(null, locale);
  const initialState: SetupActionState = {
    status: "idle",
    values: pageState.values,
  };
  const title = pageState.hasProfile ? t("titleEdit") : t("titleInitial");
  const subtitle = pageState.hasProfile
    ? t("subtitleEdit")
    : t("subtitleInitial");
  const submitLabel = pageState.hasProfile ? t("submitEdit") : t("submitInitial");

  return (
    <section className="flex flex-1 flex-col justify-center gap-8 py-8 text-start">
      <div className="max-w-3xl">
        <p className="text-sm font-semibold uppercase tracking-[0.16em] text-teal-700">
          {t("label")}
        </p>
        <h1 className="mt-4 text-3xl font-semibold leading-tight text-slate-950 sm:text-5xl">
          {title}
        </h1>
        <p className="mt-5 max-w-2xl text-base leading-7 text-slate-700 sm:text-lg">
          {subtitle}
        </p>
      </div>

      <div className="max-w-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <SetupForm
          action={action}
          blankHelper={t("targets.blankHelper")}
          fieldErrorMessages={{
            invalid_integer: t("errors.invalidInteger"),
            invalid_input: t("errors.validation"),
            invalid_number: t("errors.invalidNumber"),
            invalid_type: t("errors.validation"),
            negative_value: t("errors.negativeValue"),
            too_long: t("errors.displayNameTooLong"),
            unsupported_field: t("errors.validation"),
            unsupported_language: t("errors.invalidLanguage"),
          }}
          initialState={initialState}
          permalink={progressivePermalink}
          labels={{
            calories: t("targets.caloriesLabel"),
            carbohydrates_g: t("targets.carbohydratesLabel"),
            display_name: t("profile.displayNameLabel"),
            fat_g: t("targets.fatLabel"),
            preferred_language: t("profile.preferredLanguageLabel"),
            protein_g: t("targets.proteinLabel"),
          }}
          languageOptions={[
            { label: t("profile.languageEnglish"), value: "en" },
            { label: t("profile.languageHebrew"), value: "he" },
          ]}
          pendingLabel={t("pending")}
          sectionCopy={{
            profileHelp: t("profile.displayNameHelp"),
            targetDescription: t("targets.description", {
              date: pageState.values.effectiveDate,
            }),
            targetTitle: t("targets.title"),
          }}
          statusMessages={{
            database_error: t("errors.generic"),
            idle: t("status.idle"),
            success: t("status.success"),
            unauthenticated: t("errors.unauthenticated"),
            validation_error: t("errors.validation"),
          }}
          submitLabel={submitLabel}
        />
      </div>
    </section>
  );
}
