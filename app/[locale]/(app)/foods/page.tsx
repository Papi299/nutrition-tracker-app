import Link from "next/link";
import { useTranslations } from "next-intl";
import { redirect } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { RetrievalError } from "@/components/data/retrieval-error";
import { resolveAuthLocale, signInPath } from "@/lib/auth/require-user";
import {
  parseCalendarDateQueryValue,
  type CalendarDateQueryResult,
} from "@/lib/calendar-date";
import {
  searchReadableFoods,
  type FoodSearchResult,
  type FoodSearchState,
} from "@/lib/food-search";
import { routing, type Locale } from "@/lib/i18n/routing";

type FoodsPageProps = Readonly<{
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}>;

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export default async function FoodsPage({ params, searchParams }: FoodsPageProps) {
  const { locale: localeInput } = await params;
  const resolvedSearchParams = await searchParams;
  const locale = resolveAuthLocale(localeInput);

  setRequestLocale(locale);

  const dateQuery = parseCalendarDateQueryValue(resolvedSearchParams.date);
  const state = await searchReadableFoods(resolvedSearchParams.q);

  if (state.status === "unauthenticated") {
    redirect(signInPath(locale));
  }

  return (
    <LocalizedFoodsPage dateQuery={dateQuery} locale={locale} state={state} />
  );
}

function LocalizedFoodsPage({
  dateQuery,
  locale,
  state,
}: {
  dateQuery: CalendarDateQueryResult;
  locale: Locale;
  state: Exclude<FoodSearchState, { status: "unauthenticated" }>;
}) {
  const t = useTranslations("FoodSearch");
  const selectedDate = dateQuery.status === "valid" ? dateQuery.date : null;
  const retryParameters = new URLSearchParams({ q: state.value });

  if (selectedDate) {
    retryParameters.set("date", selectedDate);
  }

  const retryHref = `/${locale}/foods?${retryParameters.toString()}`;

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

      {(dateQuery.status === "invalid" || dateQuery.status === "repeated") && (
        <SearchState
          alert
          body={
            dateQuery.status === "repeated"
              ? t("selection.invalidDateRepeated")
              : t("selection.invalidDate")
          }
          testId="food-search-date-context-invalid"
          title={t("selection.invalidDateTitle")}
        />
      )}

      <form
        action={`/${locale}/foods`}
        className="max-w-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6"
        method="get"
        role="search"
      >
        {selectedDate && <input name="date" type="hidden" value={selectedDate} />}
        <label className="block text-sm font-semibold text-slate-900" htmlFor="food-search-query">
          {t("form.label")}
        </label>
        <p className="mt-2 text-sm leading-6 text-slate-600" id="food-search-help">
          {t("form.help")}
        </p>
        <div className="mt-4 flex flex-col gap-3 sm:flex-row">
          <input
            aria-describedby="food-search-help"
            className="min-h-11 flex-1 border border-slate-300 bg-white px-3 py-2 text-base text-slate-950 outline-none transition-colors focus:border-teal-700 focus:ring-2 focus:ring-teal-100"
            defaultValue={state.value}
            id="food-search-query"
            maxLength={100}
            name="q"
            type="search"
          />
          <button
            className="min-h-11 bg-teal-700 px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-teal-800"
            type="submit"
          >
            {t("form.submit")}
          </button>
        </div>
      </form>

      {state.status === "initial" && (
        <SearchState
          body={t("states.initial.body")}
          testId="food-search-initial"
          title={t("states.initial.title")}
        />
      )}

      {state.status === "too_short" && (
        <SearchState
          body={t("states.tooShort.body")}
          testId="food-search-too-short"
          title={t("states.tooShort.title")}
        />
      )}

      {state.status === "validation_error" && (
        <SearchState
          alert
          body={
            state.reason === "repeated"
              ? t("states.invalid.repeated")
              : t("states.invalid.tooLong")
          }
          testId="food-search-invalid"
          title={t("states.invalid.title")}
        />
      )}

      {state.status === "database_error" && (
        <div className="max-w-3xl">
          <RetrievalError
            body={t("states.failure.body")}
            retryHref={retryHref}
            retryLabel={t("states.failure.retry")}
            testId="food-search-error"
            title={t("states.failure.title")}
          />
        </div>
      )}

      {state.status === "ready" && state.data.length === 0 && (
        <SearchState
          body={t("states.empty.body")}
          testId="food-search-empty"
          title={t("states.empty.title")}
        />
      )}

      {state.status === "ready" && state.data.length > 0 && (
        <SearchResults
          locale={locale}
          results={state.data}
          selectedDate={selectedDate}
        />
      )}
    </section>
  );
}

function SearchState({
  alert = false,
  body,
  testId,
  title,
}: {
  alert?: boolean;
  body: string;
  testId: string;
  title: string;
}) {
  return (
    <section
      aria-labelledby={`${testId}-title`}
      className="max-w-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6"
      data-testid={testId}
    >
      <h2 className="text-lg font-semibold text-slate-950" id={`${testId}-title`}>
        {title}
      </h2>
      <p className="mt-3 text-sm leading-6 text-slate-700" role={alert ? "alert" : undefined}>
        {body}
      </p>
    </section>
  );
}

function SearchResults({
  locale,
  results,
  selectedDate,
}: {
  locale: Locale;
  results: FoodSearchResult[];
  selectedDate: string | null;
}) {
  const t = useTranslations("FoodSearch");
  const foodTypeLabels: Record<string, string> = {
    branded: t("foodTypes.branded"),
    generic: t("foodTypes.generic"),
    user_custom: t("foodTypes.userCustom"),
  };
  const localeLabels: Record<string, string> = {
    en: t("languages.en"),
    he: t("languages.he"),
    und: t("languages.und"),
  };
  const qualityLabels: Record<string, string> = {
    curated: t("quality.curated"),
    estimated: t("quality.estimated"),
    imported: t("quality.imported"),
    unknown: t("quality.unknown"),
    user_provided: t("quality.userProvided"),
    verified: t("quality.verified"),
  };
  const sourceTypeLabels: Record<string, string> = {
    database: t("sourceTypes.database"),
    external_api: t("sourceTypes.externalApi"),
    imported: t("sourceTypes.imported"),
    manual: t("sourceTypes.manual"),
    user_custom: t("sourceTypes.userCustom"),
  };
  const trustLabels: Record<string, string> = {
    curated: t("trust.curated"),
    estimated: t("trust.estimated"),
    unknown: t("trust.unknown"),
    user_provided: t("trust.userProvided"),
    verified: t("trust.verified"),
  };
  const sourceCodeLabels: Record<string, string> = {
    foodsdictionary: t("sources.foodsDictionary"),
    manual: t("sources.manual"),
    usda: t("sources.usda"),
    user_custom: t("sources.userCustom"),
  };

  return (
    <section aria-labelledby="food-search-results-title" className="max-w-4xl">
      <h2 className="text-2xl font-semibold text-slate-950" id="food-search-results-title">
        {t("results.title", { count: results.length })}
      </h2>
      <ol className="mt-5 grid gap-4" data-testid="food-search-results">
        {results.map((food) => {
          const sourceLabel = food.source_code
            ? (sourceCodeLabels[food.source_code] ?? food.source_name)
            : null;
          const serving = [food.serving_size, food.serving_unit]
            .filter((value) => value !== null && value !== "")
            .join(" ");
          const diaryParameters = new URLSearchParams();

          if (selectedDate) {
            diaryParameters.set("date", selectedDate);
          }

          diaryParameters.set("foodId", food.food_id);

          return (
            <li
              className="border border-slate-200 bg-white p-5 shadow-sm sm:p-6"
              data-food-id={food.food_id}
              key={food.food_id}
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h3 className="text-xl font-semibold text-slate-950" dir="auto">
                    {food.name}
                  </h3>
                  {food.brand_name && (
                    <p className="mt-1 text-sm text-slate-700" dir="auto">
                      {t("results.brand", { brand: food.brand_name })}
                    </p>
                  )}
                </div>
                <span className="w-fit bg-teal-50 px-3 py-1 text-xs font-semibold text-teal-800">
                  {food.is_owned ? t("visibility.own") : t("visibility.public")}
                </span>
              </div>

              {food.matched_alias && (
                <p className="mt-4 text-sm text-slate-700" dir="auto">
                  <span className="font-semibold">{t("results.matchedAlias")}: </span>
                  {food.matched_alias}
                </p>
              )}

              <dl className="mt-4 grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
                <Metadata label={t("results.foodType")} value={foodTypeLabels[food.food_type] ?? food.food_type} />
                <Metadata label={t("results.language")} value={localeLabels[food.locale] ?? food.locale} />
                {serving && <Metadata label={t("results.serving")} value={serving} />}
                <Metadata label={t("results.quality")} value={qualityLabels[food.data_quality] ?? food.data_quality} />
                {sourceLabel && <Metadata label={t("results.source")} value={sourceLabel} />}
                {food.source_type && (
                  <Metadata
                    label={t("results.sourceType")}
                    value={sourceTypeLabels[food.source_type] ?? food.source_type}
                  />
                )}
                {food.source_trust_level && (
                  <Metadata
                    label={t("results.trust")}
                    value={trustLabels[food.source_trust_level] ?? food.source_trust_level}
                  />
                )}
              </dl>
              <p className="mt-4 text-xs leading-5 text-slate-500">
                {t("results.readOnly")}
              </p>
              <Link
                className="mt-4 inline-flex min-h-10 items-center bg-teal-700 px-4 text-sm font-semibold text-white transition-colors hover:bg-teal-800"
                href={`/${locale}/today?${diaryParameters.toString()}`}
              >
                {t("results.useInDiary")}
              </Link>
            </li>
          );
        })}
      </ol>
      <p className="mt-4 text-sm text-slate-600">
        {t("results.limit")}
      </p>
    </section>
  );
}

function Metadata({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="font-semibold text-slate-700">{label}</dt>
      <dd className="mt-1 text-slate-950" dir="auto">
        {value}
      </dd>
    </div>
  );
}
