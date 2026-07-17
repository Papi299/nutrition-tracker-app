import { headers } from "next/headers";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { redirect } from "next/navigation";
import {
  saveBarcodeCustomFoodAction,
  saveCustomFoodAction,
} from "@/app/[locale]/(app)/foods/custom/actions";
import {
  newCustomFoodFormValues,
  type CustomFoodActionState,
} from "@/app/[locale]/(app)/foods/custom/action-state";
import { CustomFoodForm } from "@/components/custom-foods/custom-food-form";
import {
  CustomFoodEditorPageHeader,
  CustomFoodRetrievalError,
} from "@/components/custom-foods/custom-food-page";
import { RetrievalError } from "@/components/data/retrieval-error";
import { resolveAuthLocale, signInPath } from "@/lib/auth/require-user";
import {
  barcodeCustomHandoffCanonicalQuery,
  lookupReadableFoodByGtinForCurrentUser,
  parseBarcodeCustomHandoffQuery,
  type BarcodeCustomHandoffQuery,
  type BarcodeLookupState,
} from "@/lib/barcodes";
import { getCustomFoodNutrientDictionary } from "@/lib/custom-foods";
import type { Locale } from "@/lib/i18n/routing";

type NewCustomFoodPageProps = Readonly<{
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}>;

export default async function NewCustomFoodPage({
  params,
  searchParams,
}: NewCustomFoodPageProps) {
  const { locale: localeInput } = await params;
  const locale = resolveAuthLocale(localeInput);
  const query = parseBarcodeCustomHandoffQuery(await searchParams);

  setRequestLocale(locale);

  if (query.status === "invalid") {
    return <InvalidBarcodeHandoff locale={locale} query={query} />;
  }

  if (query.status === "ordinary") {
    return <CustomFoodCreateForm locale={locale} />;
  }

  const requestHeaders = await headers();
  const localFault =
    process.env.DATE_E2E_LOCAL_SUPABASE === "1"
      ? requestHeaders.get("x-phase9c-handoff-fault")
      : null;
  const lookup: BarcodeLookupState = localFault === "database_error"
    ? { status: "database_error" }
    : localFault === "ambiguous"
      ? { canonical_gtin: query.barcode, status: "ambiguous" }
      : await lookupReadableFoodByGtinForCurrentUser(query.barcode);

  if (lookup.status === "unauthenticated") redirect(signInPath(locale));

  if (lookup.status !== "not_found_local") {
    return <BarcodeHandoffConflict locale={locale} lookup={lookup} query={query} />;
  }

  return <CustomFoodCreateForm locale={locale} query={query} />;
}

async function CustomFoodCreateForm({
  locale,
  query,
}: {
  locale: Locale;
  query?: Extract<BarcodeCustomHandoffQuery, { status: "valid" }>;
}) {
  const dictionary = await getCustomFoodNutrientDictionary();
  const retryHref = query
    ? `/${locale}/foods/custom/new?${barcodeCustomHandoffCanonicalQuery({
        barcode: query.barcode,
        date: query.date,
        mealType: query.meal_type,
      })}`
    : `/${locale}/foods/custom/new`;

  if (!dictionary.ok) {
    if (dictionary.code === "unauthenticated") redirect(signInPath(locale));
    return <CustomFoodRetrievalError locale={locale} retryHref={retryHref} />;
  }

  const action = query
    ? saveBarcodeCustomFoodAction.bind(null, locale, query)
    : saveCustomFoodAction.bind(null, locale, null);
  const initialState: CustomFoodActionState = {
    barcode_omitted: query ? false : undefined,
    status: "idle",
    values: newCustomFoodFormValues(locale),
  };

  return (
    <CustomFoodEditorPageHeader mode="create">
      <CustomFoodForm
        action={action}
        archived={false}
        barcodeContext={
          query
            ? {
                canonicalGtin: query.barcode,
                date: query.date,
                mealType: query.meal_type,
              }
            : undefined
        }
        dictionary={dictionary.data}
        initialState={initialState}
        locale={locale}
        mode="create"
        saved={null}
      />
    </CustomFoodEditorPageHeader>
  );
}

function InvalidBarcodeHandoff({
  locale,
  query,
}: {
  locale: Locale;
  query: Extract<BarcodeCustomHandoffQuery, { status: "invalid" }>;
}) {
  const t = useTranslations("CustomFoodEditor.barcode.handoff");
  return (
    <CustomFoodEditorPageHeader mode="create">
      <section
        className="grid gap-4 border border-red-200 bg-red-50 p-5 text-start"
        data-testid="barcode-handoff-invalid"
      >
        <h2 className="text-xl font-semibold text-slate-950">{t("invalidTitle")}</h2>
        <p className="text-sm leading-6 text-slate-700" role="alert">
          {t(`invalid.${query.field}`)}
        </p>
        <div className="flex flex-wrap gap-3">
          <Link className={primaryLinkClass} href={`/${locale}/foods/barcode`}>
            {t("backToLookup")}
          </Link>
          <Link className={secondaryLinkClass} href={`/${locale}/foods/custom/new`}>
            {t("createOrdinary")}
          </Link>
        </div>
      </section>
    </CustomFoodEditorPageHeader>
  );
}

function BarcodeHandoffConflict({
  locale,
  lookup,
  query,
}: {
  locale: Locale;
  lookup: Exclude<BarcodeLookupState, { status: "not_found_local" | "unauthenticated" }>;
  query: Extract<BarcodeCustomHandoffQuery, { status: "valid" }>;
}) {
  const t = useTranslations("CustomFoodEditor.barcode.handoff");
  const canonicalQuery = barcodeCustomHandoffCanonicalQuery({
    barcode: query.barcode,
    date: query.date,
    mealType: query.meal_type,
  });
  const lookupQuery = new URLSearchParams({ code: query.barcode, date: query.date });
  if (query.meal_type) lookupQuery.set("mealType", query.meal_type);

  if (lookup.status === "database_error") {
    return (
      <CustomFoodEditorPageHeader mode="create">
        <RetrievalError
          body={t("databaseBody")}
          retryHref={`/${locale}/foods/custom/new?${canonicalQuery}`}
          retryLabel={t("retry")}
          testId="barcode-handoff-database-error"
          title={t("databaseTitle")}
        />
      </CustomFoodEditorPageHeader>
    );
  }

  if (lookup.status === "validation_error") {
    return <InvalidBarcodeHandoff locale={locale} query={{ field: "barcode", reason: "invalid", status: "invalid" }} />;
  }

  const found = lookup.status === "found_owned" || lookup.status === "found_public";
  const todayQuery = found
    ? new URLSearchParams({ date: query.date, foodId: lookup.data.food_id })
    : null;
  if (todayQuery && query.meal_type) todayQuery.set("mealType", query.meal_type);
  const stateKey = found
    ? lookup.status
    : lookup.status === "ambiguous"
      ? "ambiguous"
      : "unavailable";

  return (
    <CustomFoodEditorPageHeader mode="create">
      <section
        className="grid gap-4 border border-amber-200 bg-amber-50 p-5 text-start"
        data-testid={`barcode-handoff-${stateKey}`}
      >
        <h2 className="text-xl font-semibold text-slate-950">
          {t(`states.${stateKey}.title`)}
        </h2>
        <p className="text-sm leading-6 text-slate-700" role="alert">
          {t(`states.${stateKey}.body`)}
        </p>
        <div className="flex flex-wrap gap-3">
          {todayQuery && (
            <Link className={primaryLinkClass} href={`/${locale}/today?${todayQuery.toString()}`}>
              {t("review")}
            </Link>
          )}
          {lookup.status === "found_owned" && (
            <Link className={secondaryLinkClass} href={`/${locale}/foods/custom/${lookup.data.food_id}/edit`}>
              {t("editOwned")}
            </Link>
          )}
          <Link className={secondaryLinkClass} href={`/${locale}/foods/barcode?${lookupQuery.toString()}`}>
            {t("backToLookup")}
          </Link>
        </div>
      </section>
    </CustomFoodEditorPageHeader>
  );
}

const primaryLinkClass =
  "inline-flex min-h-11 items-center bg-teal-700 px-4 text-sm font-semibold text-white";
const secondaryLinkClass =
  "inline-flex min-h-11 items-center border border-teal-700 bg-white px-4 text-sm font-semibold text-teal-800";
