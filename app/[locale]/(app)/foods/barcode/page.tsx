import { headers } from "next/headers";
import Link from "next/link";
import { ClipboardCheck } from "lucide-react";
import { useTranslations } from "next-intl";
import { redirect } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { BarcodeLookupForm } from "@/components/barcodes/barcode-lookup-form";
import { BarcodeCameraScanner } from "@/components/barcodes/barcode-camera-scanner";
import { BrowserDateBootstrap } from "@/components/calendar-date/browser-date-bootstrap";
import { RetrievalError } from "@/components/data/retrieval-error";
import { FoodDiscoveryHeader } from "@/components/foods/food-discovery-header";
import { FoodDiscoveryNavigation } from "@/components/foods/food-discovery-navigation";
import { FoodDiscoveryOptions } from "@/components/foods/food-discovery-options";
import { FoodMetadata, FoodResultMetadata } from "@/components/foods/food-result-metadata";
import { Badge } from "@/components/ui/badge";
import { buttonStyles } from "@/components/ui/button";
import { surfaceStyles } from "@/components/ui/card";
import { resolveAuthLocale, signInPath } from "@/lib/auth/require-user";
import {
  barcodeLookupCapabilities,
  barcodeCustomHandoffCanonicalQuery,
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
import { formatLocalizedNumber } from "@/lib/i18n/format";

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
  const formId = "barcode-lookup-form";
  const formValues = barcodeFormValues(query);
  const formError =
    query.status === "invalid" && query.field !== "query"
      ? { field: query.field, message: queryErrorMessage(query, t) }
      : undefined;
  const mealTypeOptions = diaryEntryMealTypes.map((mealType) => ({
    label: diaryT(`mealTypes.${mealType}`),
    value: mealType,
  }));

  const returnParameters = new URLSearchParams();
  if (formValues.date) returnParameters.set("date", formValues.date);
  if (formValues.mealType) returnParameters.set("mealType", formValues.mealType);
  const returnHref = `/${locale}/today${returnParameters.size ? `?${returnParameters.toString()}` : ""}`;

  return (
    <section className="flex min-w-0 flex-1 flex-col gap-5 py-5 text-start sm:gap-6 sm:py-6">
      <FoodDiscoveryHeader
        description={t("ui.description")}
        eyebrow={t("label")}
        locale={locale}
        returnHref={returnHref}
        selectedDate={formValues.date}
        title={t("title")}
      />
      <FoodDiscoveryNavigation current="barcode" locale={locale} mealType={formValues.mealType} selectedDate={formValues.date} />

      {query.status === "valid" && query.canonical_gtin !== null && lookup && (
        <BarcodeLookupResult locale={locale} lookup={lookup} query={query} />
      )}

      <BarcodeLookupForm
        action={routePath}
        code={formValues.code}
        date={formValues.date}
        error={formError}
        formId={formId}
        labels={{
          title: t("ui.manualTitle"),
          description: t("description"),
          details: t("ui.details"),
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

      {query.status === "valid" && (
        <BarcodeCameraScanner formId={formId} routePath={routePath} />
      )}

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

      <FoodDiscoveryOptions locale={locale} selectedDate={formValues.date} />
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
        locale={locale}
        status={lookup.status}
      />
    );
  }

  if (lookup.status === "database_error") {
    return (
      <div className="grid min-w-0 gap-4">
        <RetrievalError
          body={t("states.failure.body")}
          retryHref={`/${locale}/foods/barcode?${canonicalQuery}`}
          retryLabel={t("states.failure.retry")}
          testId="barcode-database-error"
          title={t("states.failure.title")}
        />
        <BackToFoodSearch locale={locale} selectedDate={query.date} />
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
    const handoffQuery = barcodeCustomHandoffCanonicalQuery({
      barcode: lookup.canonical_gtin,
      date: query.date,
      mealType: query.meal_type,
    });
    return (
      <BarcodeState
        body={t("states.notFound.body")}
        testId="barcode-not-found"
        title={t("states.notFound.title")}
      >
        <Link
          className={primaryLinkClass}
          href={`/${locale}/foods/custom/new?${handoffQuery}`}
        >
          {t("states.notFound.createWithBarcode")}
        </Link>
        <Link className={secondaryLinkClass} href={`/${locale}/foods/custom/new`}>
          {t("states.notFound.createWithoutBarcode")}
        </Link>
        <BackToFoodSearch locale={locale} selectedDate={query.date} />
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
      <BackToFoodSearch locale={locale} selectedDate={query.date} />
    </BarcodeState>
  );
}

function BarcodeFoundReview({
  diaryHref,
  editHref,
  food,
  locale,
  status,
}: {
  diaryHref: string;
  editHref: string | null;
  food: BarcodeLookupFood;
  locale: Locale;
  status: "found_owned" | "found_public";
}) {
  const t = useTranslations("BarcodeLookup");
  const foodT = useTranslations("FoodSearch");
  const serving = [
    food.serving_size === null
      ? null
      : formatLocalizedNumber(locale, food.serving_size),
    food.serving_unit,
  ]
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
      className={surfaceStyles({ className: "min-w-0 border-primary/25" })}
      data-testid={`barcode-${status}`}
    >
      <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h2 className="ui-section-title [overflow-wrap:anywhere]" dir="auto" id="barcode-found-title">
            <bdi>{food.food_name}</bdi>
          </h2>
          {food.brand_name && (
            <p className="ui-body-secondary mt-1 [overflow-wrap:anywhere]" dir="auto">
              <bdi>{food.brand_name}</bdi>
            </p>
          )}
          {serving && (
            <p className="mt-2 text-sm text-muted-foreground">
              <span className="font-medium">{t("metadata.serving")}: </span>
              <bdi>{serving}</bdi>
            </p>
          )}
        </div>
        <Badge className="w-fit shrink-0" variant="primary">
          {status === "found_owned" ? t("ownership.owned") : t("ownership.public")}
        </Badge>
      </div>

      <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        <Link className={primaryLinkClass} href={diaryHref}>
          <ClipboardCheck aria-hidden="true" className="size-4 shrink-0" />
          {t("review.diary")}
        </Link>
        {editHref && <Link className={secondaryLinkClass} href={editHref}>{t("review.edit")}</Link>}
      </div>

      <FoodResultMetadata className="mt-4" summary={t("ui.details")}>
        <p className="ui-body-secondary">{t("review.explanation")}</p>
        <p className="mt-3 text-sm text-muted-foreground">
          <span className="font-medium">{t("metadata.canonicalGtin")}: </span>
          <code className="font-mono text-foreground" dir="ltr" data-testid="canonical-gtin">{food.canonical_gtin}</code>
        </p>
        <dl className="mt-4 grid min-w-0 gap-3 text-sm sm:grid-cols-2">
          <FoodMetadata label={t("metadata.foodType")} value={foodType} />
          <FoodMetadata label={t("metadata.language")} value={language} />
          <FoodMetadata label={t("metadata.quality")} value={foodT(`quality.${qualityKey(food.food_data_quality)}`)} />
          <FoodMetadata label={t("metadata.foodSource")} value={food.food_source_name ?? t("metadata.unknown")} />
          <FoodMetadata label={t("metadata.sourceType")} value={food.food_source_type ? foodT(`sourceTypes.${sourceTypeKey(food.food_source_type)}`) : t("metadata.unknown")} />
          <FoodMetadata label={t("metadata.trust")} value={food.food_source_trust_level ? foodT(`trust.${trustKey(food.food_source_trust_level)}`) : t("metadata.unknown")} />
          <FoodMetadata label={t("metadata.mappingVerification")} value={t(`verification.${food.mapping_verification_status}`)} />
          <FoodMetadata label={t("metadata.mappingSource")} value={food.mapping_provenance_source_name} />
          <FoodMetadata label={t("metadata.mappingSourceType")} value={foodT(`sourceTypes.${sourceTypeKey(food.mapping_provenance_source_type)}`)} />
          <FoodMetadata label={t("metadata.mappingTrust")} value={foodT(`trust.${trustKey(food.mapping_provenance_source_trust_level)}`)} />
        </dl>
      </FoodResultMetadata>
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
    <section aria-labelledby={`${testId}-title`} className={surfaceStyles({ className: `min-w-0 ${alert ? "border-danger/30 bg-danger-surface" : ""}` })} data-testid={testId}>
      <h2 className="ui-card-title" id={`${testId}-title`}>{title}</h2>
      <p className={`mt-2 text-sm leading-6 ${alert ? "text-danger-foreground" : "text-muted-foreground"}`} role={alert ? "alert" : undefined}>{body}</p>
      {children && <div className="mt-4 flex flex-wrap gap-2">{children}</div>}
    </section>
  );
}

function BackToFoodSearch({ locale, selectedDate }: { locale: Locale; selectedDate?: string | null }) {
  const t = useTranslations("BarcodeLookup");
  return <Link className={secondaryLinkClass} href={`/${locale}/foods${selectedDate ? `?date=${selectedDate}` : ""}`}>{t("backToSearch")}</Link>;
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

const primaryLinkClass = buttonStyles();
const secondaryLinkClass = buttonStyles({ variant: "outline" });
