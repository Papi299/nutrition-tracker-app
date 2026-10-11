import Link from "next/link";
import Form from "next/form";
import { Search } from "lucide-react";
import { useTranslations } from "next-intl";
import { redirect } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { RetrievalError } from "@/components/data/retrieval-error";
import { FoodFavoriteControl } from "@/components/foods/food-favorite-control";
import { FoodDiscoveryHeader } from "@/components/foods/food-discovery-header";
import { FoodDiscoveryNavigation } from "@/components/foods/food-discovery-navigation";
import { FoodDiscoveryOptions } from "@/components/foods/food-discovery-options";
import { FoodResultCard } from "@/components/foods/food-result-card";
import { FoodMetadata, FoodResultMetadata } from "@/components/foods/food-result-metadata";
import { Badge } from "@/components/ui/badge";
import { Button, buttonStyles } from "@/components/ui/button";
import { surfaceStyles } from "@/components/ui/card";
import { FieldLabel, Input } from "@/components/ui/form-controls";
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
import { formatLocalizedNumber } from "@/lib/i18n/format";
import { setFoodFavoriteAction } from "./favorite-actions";

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
    <section className="flex min-w-0 flex-1 flex-col gap-4 py-2 text-start">
      <FoodDiscoveryHeader
        description={t("description")}
        eyebrow={t("label")}
        locale={locale}
        selectedDate={selectedDate}
        title={t("title")}
      />

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

      <Form
        action={`/${locale}/foods`}
        className={surfaceStyles({ className: "min-w-0 p-4 sm:p-5" })}
        role="search"
      >
        {selectedDate && <input name="date" type="hidden" value={selectedDate} />}
        <FieldLabel className="block" htmlFor="food-search-query">
          {t("form.label")}
        </FieldLabel>
        <div className="mt-2 flex min-w-0 flex-col gap-2 sm:flex-row">
          <div className="relative min-w-0 flex-1">
            <Search aria-hidden="true" className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
            <Input
              aria-describedby="food-search-help"
              autoComplete="off"
              className="px-10"
              defaultValue={state.value}
              dir="auto"
              enterKeyHint="search"
              id="food-search-query"
              inputMode="search"
              maxLength={100}
              name="q"
              type="search"
            />
          </div>
          <Button type="submit">{t("form.submit")}</Button>
        </div>
        <p className="ui-caption mt-2" id="food-search-help">
          {t("form.help")}
        </p>
      </Form>

      <FoodDiscoveryNavigation current="search" locale={locale} selectedDate={selectedDate} />
      <FoodDiscoveryOptions locale={locale} selectedDate={selectedDate} />

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
        <div className="min-w-0">
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
      className={surfaceStyles({ variant: "subtle" })}
      data-testid={testId}
    >
      <h2 className="ui-card-title" id={`${testId}-title`}>
        {title}
      </h2>
      <p className="ui-body-secondary mt-2" role={alert ? "alert" : undefined}>
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
    <section aria-labelledby="food-search-results-title" className="min-w-0">
      <h2 className="ui-section-title" id="food-search-results-title">
        {t("results.title", { count: results.length })}
      </h2>
      <ol className="mt-3 grid items-start gap-3 md:grid-cols-2" data-testid="food-search-results">
        {results.map((food) => {
          const sourceLabel = food.source_code
            ? (sourceCodeLabels[food.source_code] ?? food.source_name)
            : null;
          const serving = [
            food.serving_size === null
              ? null
              : formatLocalizedNumber(locale, food.serving_size),
            food.serving_unit,
          ]
            .filter((value) => value !== null && value !== "")
            .join(" ");
          const diaryParameters = new URLSearchParams();

          if (selectedDate) {
            diaryParameters.set("date", selectedDate);
          }

          diaryParameters.set("foodId", food.food_id);
          const favoriteAction = setFoodFavoriteAction.bind(
            null,
            locale,
            food.food_id,
            !food.is_favorite,
          );

          return (
            <FoodResultCard
              actions={
                <>
                  <Link
                    className={buttonStyles()}
                    href={`/${locale}/today?${diaryParameters.toString()}`}
                  >
                    {t("results.useInDiary")}
                  </Link>
                  <FoodFavoriteControl
                    action={favoriteAction}
                    foodName={food.name}
                    isFavorite={food.is_favorite}
                  />
                </>
              }
              brand={food.brand_name ? t("results.brand", { brand: food.brand_name }) : null}
              foodId={food.food_id}
              key={food.food_id}
              name={food.name}
              serving={serving}
              servingLabel={t("results.serving")}
            >
              <FoodResultMetadata>
                <Badge>{food.is_owned ? t("visibility.own") : t("visibility.public")}</Badge>
                <dl className="mt-3 grid gap-x-5 gap-y-3 sm:grid-cols-2">
                  {food.matched_alias && (
                    <FoodMetadata label={t("results.matchedAlias")} value={food.matched_alias} />
                  )}
                  <FoodMetadata label={t("results.foodType")} value={foodTypeLabels[food.food_type] ?? food.food_type} />
                  <FoodMetadata label={t("results.language")} value={localeLabels[food.locale] ?? food.locale} />
                  <FoodMetadata label={t("results.quality")} value={qualityLabels[food.data_quality] ?? food.data_quality} />
                  {sourceLabel && <FoodMetadata label={t("results.source")} value={sourceLabel} />}
                  {food.source_type && (
                    <FoodMetadata
                      label={t("results.sourceType")}
                      value={sourceTypeLabels[food.source_type] ?? food.source_type}
                    />
                  )}
                  {food.source_trust_level && (
                    <FoodMetadata
                      label={t("results.trust")}
                      value={trustLabels[food.source_trust_level] ?? food.source_trust_level}
                    />
                  )}
                </dl>
                <p className="ui-caption mt-3">{t("results.readOnly")}</p>
                {food.is_owned && (
                  <Link
                    className={buttonStyles({ variant: "ghost", size: "sm", className: "mt-2" })}
                    href={`/${locale}/foods/custom/${food.food_id}/edit`}
                  >
                    {t("results.editCustom")}
                  </Link>
                )}
              </FoodResultMetadata>
            </FoodResultCard>
          );
        })}
      </ol>
      <p className="ui-caption mt-3">
        {t("results.limit")}
      </p>
    </section>
  );
}
