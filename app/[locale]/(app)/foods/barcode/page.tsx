import { headers } from "next/headers";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { redirect } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { BarcodeLookupForm } from "@/components/barcodes/barcode-lookup-form";
import { BrowserDateBootstrap } from "@/components/calendar-date/browser-date-bootstrap";
import { RetrievalError } from "@/components/data/retrieval-error";
import { resolveAuthLocale, signInPath } from "@/lib/auth/require-user";
import {
  barcodeLookupCapabilities,
  barcodeRouteCanonicalQuery,
  lookupReadableFoodByGtinForCurrentUser,
  resolveBarcodeRoute,
  type BarcodeLookupFood,
  type BarcodeLookupState,
  type BarcodeRouteQueryResult,
} from "@/lib/barcodes";
import {
  diaryEntryMealTypes,
} from "@/lib/diary-entries";
import { routing, type Locale } from "@/lib/i18n/routing";

type PageProps = Readonly<{
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}>;

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export default async function BarcodeLookupPage({ params, searchParams }: PageProps) {
  const { locale: localeInput } = await params;
  const locale = resolveAuthLocale(localeInput);
  const queryValues = await searchParams;

  setRequestLocale(locale);

  const resolution = await resolveBarcodeRoute(queryValues, async (canonicalGtin) => {
    const requestHeaders = await headers();
    if (
      process.env.DATE_E2E_LOCAL_SUPABASE === "1" &&
      requestHeaders.get("x-phase9b-barcode-fault") === "database_error"
    ) {
      return { status: "database_error" };
    }
    return lookupReadableFoodByGtinForCurrentUser(canonicalGtin);
  });

  if (resolution.query.status === "date_missing") {
    return <LocalizedBarcodeDateBootstrap locale={locale} query={resolution.query} />;
  }

  if (
    resolution.query.status === "valid" &&
    resolution.query.needs_canonical_redirect
  ) {
    redirect(
      `/${locale}/foods/barcode?${barcodeRouteCanonicalQuery({
        code: resolution.query.canonical_gtin,
        date: resolution.query.date,
        mealType: resolution.query.meal_type,
      })}`,
    );
  }

  const lookup = resolution.lookup;
  if (lookup?.status === "unauthenticated") {
    redirect(signInPath(locale));
  }

  return (
    <LocalizedBarcodeLookupPage
      locale={locale}
      lookup={lookup}
      query={resolution.query}
    />
  );
}

function LocalizedBarcodeDateBootstrap({
  locale,
  query,
}: {
  locale: Locale;
  query: Extract<BarcodeRouteQueryResult, { status: "date_missing" }>;
}) {
  const t = useTranslations("BarcodeLookup");
  const dateT = useTranslations("CalendarDate");
  const canonicalQueryValues: Record<string, string> = {};
  if (query.canonical_gtin) canonicalQueryValues.code = query.canonical_gtin;
  if (query.meal_type) canonicalQueryValues.mealType = query.meal_type;

  return (
    <section className="flex flex-1 flex-col justify-center py-8 text-start">
      <BrowserDateBootstrap
        canonicalQueryValues={canonicalQueryValues}
        formDescription={dateT("manual.description")}
        formLabel={dateT("manual.label")}
        formSubmitLabel={dateT("manual.submit")}
        inputId="barcode-bootstrap-date"
        queryName="date"
        routePath={`/${locale}/foods/barcode`}
        status={dateT("bootstrap.status")}
        title={t("dateBootstrapTitle")}
      />
    </section>
  );
}

function LocalizedBarcodeLookupPage({
  locale,
  lookup,
  query,
}: {
  locale: Locale;
  lookup?: Exclude<BarcodeLookupState, { status: "unauthenticated" }>;
  query: Exclude<BarcodeRouteQueryResult, { status: "date_missing" }>;
}) {
  const t = useTranslations("BarcodeLookup");
  const diaryT = useTranslations("Diary");
  const routePath = `/${locale}/foods/barcode`;
  const formValues = barcodeFormValues(query);
  const formError =
    query.status === "invalid" && query.field !== "query"
      ? { field: query.field, message: queryErrorMessage(query, t) }
      : undefined;
  const mealTypeOptions = diaryEntryMealTypes.map((mealType) => ({
    label: diaryT(`mealTypes.${mealType}`),
    value: mealType,
  }));

  return (
    <section className="flex flex-1 flex-col gap-8 py-8 text-start">
      <header className="max-w-3xl">
        <p className="text-sm font-semibold uppercase tracking-[0.16em] text-teal-700">
          {t("label")}
        </p>
        <h1 className="mt-4 text-3xl font-semibold leading-tight text-slate-950 sm:text-5xl">
          {t("title")}
        </h1>
        <p className="mt-5 max-w-2xl text-base leading-7 text-slate-700 sm:text-lg">
          {t("description")}
        </p>
      </header>

      <BarcodeLookupForm
        action={routePath}
        code={formValues.code}
        date={formValues.date}
        error={formError}
        labels={{
          code: t("form.code"),
          codeHelp: t("form.codeHelp"),
          date: t("form.date"),
          dateHelp: t("form.dateHelp"),
          mealType: t("form.mealType"),
          mealTypeHelp: t("form.mealTypeHelp"),
          mealTypeNone: t("form.mealTypeNone"),
          submit: t("form.submit"),
        }}
        mealType={formValues.mealType}
        mealTypeOptions={mealTypeOptions}
      />

      {query.status === "invalid" && (
        <BarcodeState
          alert
          body={queryErrorMessage(query, t)}
          testId="barcode-invalid"
          title={t("states.invalid.title")}
        />
      )}

      {query.status === "valid" && query.canonical_gtin === null && (
        <BarcodeState
          body={t("states.initial.body")}
          testId="barcode-initial"
          title={t("states.initial.title")}
        />
      )}

      {query.status === "valid" && query.canonical_gtin !== null && lookup && (
        <BarcodeLookupResult locale={locale} lookup={lookup} query={query} />
      )}
    </section>
  );
}

function BarcodeLookupResult({
  locale,
  lookup,
  query,
}: {
  locale: Locale;
  lookup: Exclude<BarcodeLookupState, { status: "unauthenticated" }>;
  query: Extract<BarcodeRouteQueryResult, { status: "valid" }>;
}) {
  const t = useTranslations("BarcodeLookup");
  const capabilities = barcodeLookupCapabilities(lookup.status);
  const canonicalQuery = barcodeRouteCanonicalQuery({
    code: query.canonical_gtin,
    date: query.date,
    mealType: query.meal_type,
  });

  if (lookup.status === "found_owned" || lookup.status === "found_public") {
    const diaryQuery = new URLSearchParams({
      date: query.date,
      foodId: lookup.data.food_id,
    });
    if (query.meal_type) diaryQuery.set("mealType", query.meal_type);

    return (
      <BarcodeFoundReview
        diaryHref={`/${locale}/today?${diaryQuery.toString()}`}
        editHref={
          capabilities.canEditCustomFood
            ? `/${locale}/foods/custom/${lookup.data.food_id}/edit`
            : null
        }
        food={lookup.data}
        status={lookup.status}
      />
    );
  }

  if (lookup.status === "database_error") {
    return (
      <div className="grid max-w-3xl gap-4">
        <RetrievalError
          body={t("states.failure.body")}
          retryHref={`/${locale}/foods/barcode?${canonicalQuery}`}
          retryLabel={t("states.failure.retry")}
          testId="barcode-database-error"
          title={t("states.failure.title")}
        />
        <BackToFoodSearch locale={locale} />
      </div>
    );
  }

  if (lookup.status === "validation_error") {
    return (
      <BarcodeState
        alert
        body={t("states.invalid.generic")}
        testId="barcode-invalid"
        title={t("states.invalid.title")}
      />
    );
  }

  if (lookup.status === "not_found_local") {
    return (
      <BarcodeState
        body={t("states.notFound.body")}
        testId="barcode-not-found"
        title={t("states.notFound.title")}
      >
        <Link className={secondaryLinkClass} href={`/${locale}/foods/custom/new`}>
          {t("states.notFound.createCustom")}
        </Link>
        <BackToFoodSearch locale={locale} />
      </BarcodeState>
    );
  }

  const stateKey = lookup.status === "ambiguous" ? "ambiguous" : "unavailable";
  return (
    <BarcodeState
      body={t(`states.${stateKey}.body`)}
      testId={`barcode-${stateKey}`}
      title={t(`states.${stateKey}.title`)}
    >
      <BackToFoodSearch locale={locale} />
    </BarcodeState>
  );
}

function BarcodeFoundReview({
  diaryHref,
  editHref,
  food,
  status,
}: {
  diaryHref: string;
  editHref: string | null;
  food: BarcodeLookupFood;
  status: "found_owned" | "found_public";
}) {
  const t = useTranslations("BarcodeLookup");
  const foodT = useTranslations("FoodSearch");
  const serving = [food.serving_size, food.serving_unit]
    .filter((value) => value !== null && value !== "")
    .join(" ");
  const foodType = {
    branded: foodT("foodTypes.branded"),
    generic: foodT("foodTypes.generic"),
    user_custom: foodT("foodTypes.userCustom"),
  }[food.food_type];
  const language = food.food_locale
    ? foodT(`languages.${food.food_locale as "en" | "he" | "und"}`)
    : t("metadata.unknown");

  return (
    <section
      aria-labelledby="barcode-found-title"
      className="max-w-4xl border border-teal-200 bg-teal-50 p-5 shadow-sm sm:p-6"
      data-testid={`barcode-${status}`}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-slate-950" dir="auto" id="barcode-found-title">
            {food.food_name}
          </h2>
          {food.brand_name && <p className="mt-1 text-sm text-slate-700" dir="auto">{food.brand_name}</p>}
        </div>
        <span className="w-fit bg-white px-3 py-1 text-xs font-semibold text-teal-900">
          {status === "found_owned" ? t("ownership.owned") : t("ownership.public")}
        </span>
      </div>

      <p className="mt-4 text-sm text-slate-700">
        <span className="font-semibold">{t("metadata.canonicalGtin")}: </span>
        <code className="font-mono" dir="ltr" data-testid="canonical-gtin">{food.canonical_gtin}</code>
      </p>

      <dl className="mt-5 grid gap-3 text-sm sm:grid-cols-2">
        <Metadata label={t("metadata.foodType")} value={foodType} />
        <Metadata label={t("metadata.language")} value={language} />
        {serving && <Metadata label={t("metadata.serving")} value={serving} />}
        <Metadata label={t("metadata.quality")} value={foodT(`quality.${qualityKey(food.food_data_quality)}`)} />
        <Metadata label={t("metadata.foodSource")} value={food.food_source_name ?? t("metadata.unknown")} />
        <Metadata label={t("metadata.sourceType")} value={food.food_source_type ? foodT(`sourceTypes.${sourceTypeKey(food.food_source_type)}`) : t("metadata.unknown")} />
        <Metadata label={t("metadata.trust")} value={food.food_source_trust_level ? foodT(`trust.${trustKey(food.food_source_trust_level)}`) : t("metadata.unknown")} />
        <Metadata label={t("metadata.mappingVerification")} value={t(`verification.${food.mapping_verification_status}`)} />
        <Metadata label={t("metadata.mappingSource")} value={food.mapping_provenance_source_name} />
        <Metadata label={t("metadata.mappingSourceType")} value={foodT(`sourceTypes.${sourceTypeKey(food.mapping_provenance_source_type)}`)} />
        <Metadata label={t("metadata.mappingTrust")} value={foodT(`trust.${trustKey(food.mapping_provenance_source_trust_level)}`)} />
      </dl>

      <p className="mt-5 text-sm leading-6 text-slate-700">{t("review.explanation")}</p>
      <div className="mt-5 flex flex-wrap gap-3">
        <Link className={primaryLinkClass} href={diaryHref}>{t("review.diary")}</Link>
        {editHref && <Link className={secondaryLinkClass} href={editHref}>{t("review.edit")}</Link>}
      </div>
    </section>
  );
}

function BarcodeState({ alert = false, body, children, testId, title }: {
  alert?: boolean;
  body: string;
  children?: React.ReactNode;
  testId: string;
  title: string;
}) {
  return (
    <section aria-labelledby={`${testId}-title`} className="max-w-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6" data-testid={testId}>
      <h2 className="text-lg font-semibold text-slate-950" id={`${testId}-title`}>{title}</h2>
      <p className="mt-3 text-sm leading-6 text-slate-700" role={alert ? "alert" : undefined}>{body}</p>
      {children && <div className="mt-5 flex flex-wrap gap-3">{children}</div>}
    </section>
  );
}

function Metadata({ label, value }: { label: string; value: string }) {
  return <div className="border border-teal-100 bg-white p-3"><dt className="font-medium text-slate-600">{label}</dt><dd className="mt-1 text-slate-950" dir="auto">{value}</dd></div>;
}

function BackToFoodSearch({ locale }: { locale: Locale }) {
  const t = useTranslations("BarcodeLookup");
  return <Link className={secondaryLinkClass} href={`/${locale}/foods`}>{t("backToSearch")}</Link>;
}

function barcodeFormValues(query: Exclude<BarcodeRouteQueryResult, { status: "date_missing" }>) {
  return query.status === "valid"
    ? { code: query.canonical_gtin ?? "", date: query.date, mealType: query.meal_type }
    : { code: query.submitted_code, date: query.date, mealType: query.meal_type };
}

function queryErrorMessage(
  query: Extract<BarcodeRouteQueryResult, { status: "invalid" }>,
  t: ReturnType<typeof useTranslations<"BarcodeLookup">>,
) {
  if (query.field === "query") return t("states.invalid.unknownQuery");
  if (query.reason === "repeated") return t(`states.invalid.repeated.${query.field}`);
  if (query.field === "date") return t("states.invalid.date");
  if (query.field === "mealType") return t("states.invalid.mealType");
  switch (query.reason) {
    case "invalid_characters":
      return t("states.invalid.characters");
    case "invalid_check_digit":
      return t("states.invalid.checkDigit");
    case "invalid_length":
      return t("states.invalid.length");
    case "too_long":
      return t("states.invalid.tooLong");
    case "unsupported_format":
      return t("states.invalid.unsupported");
    default:
      return t("states.invalid.generic");
  }
}

function qualityKey(value: BarcodeLookupFood["food_data_quality"]) {
  return ({ user_provided: "userProvided" } as Record<string, string>)[value] ?? value;
}

function sourceTypeKey(value: NonNullable<BarcodeLookupFood["food_source_type"]>) {
  return ({ external_api: "externalApi", user_custom: "userCustom" } as Record<string, string>)[value] ?? value;
}

function trustKey(value: NonNullable<BarcodeLookupFood["food_source_trust_level"]>) {
  return ({ user_provided: "userProvided" } as Record<string, string>)[value] ?? value;
}

const primaryLinkClass = "inline-flex min-h-11 items-center bg-teal-700 px-4 text-sm font-semibold text-white transition-colors hover:bg-teal-800";
const secondaryLinkClass = "inline-flex min-h-11 items-center border border-teal-700 bg-white px-4 text-sm font-semibold text-teal-800 transition-colors hover:bg-teal-50";
