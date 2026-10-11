import Link from "next/link";
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
import { buttonStyles } from "@/components/ui/button";
import { surfaceStyles } from "@/components/ui/card";
import { feedbackStyles } from "@/components/ui/feedback";
import { resolveAuthLocale, signInPath } from "@/lib/auth/require-user";
import { formatLocalizedDate, formatLocalizedNumber } from "@/lib/i18n/format";
import {
  parseCalendarDateQueryValue,
  type CalendarDateQueryResult,
} from "@/lib/calendar-date";
import {
  getReusableFoodsForCurrentUser,
  type ReusableFood,
  type ReusableFoodCollections,
} from "@/lib/reusable-foods";
import { routing, type Locale } from "@/lib/i18n/routing";
import { setFoodFavoriteAction } from "../favorite-actions";

type ReusableFoodsPageProps = Readonly<{
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}>;

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export default async function ReusableFoodsPage({
  params,
  searchParams,
}: ReusableFoodsPageProps) {
  const { locale: localeInput } = await params;
  const resolvedSearchParams = await searchParams;
  const locale = resolveAuthLocale(localeInput);

  setRequestLocale(locale);

  const dateQuery = parseCalendarDateQueryValue(resolvedSearchParams.date);
  const result = await getReusableFoodsForCurrentUser();

  if (!result.ok && result.code === "unauthenticated") {
    redirect(signInPath(locale));
  }

  return (
    <LocalizedReusableFoodsPage
      collections={result.ok ? result.data : null}
      dateQuery={dateQuery}
      locale={locale}
    />
  );
}

function LocalizedReusableFoodsPage({
  collections,
  dateQuery,
  locale,
}: {
  collections: ReusableFoodCollections | null;
  dateQuery: CalendarDateQueryResult;
  locale: Locale;
}) {
  const t = useTranslations("ReusableFoods");
  const selectedDate = dateQuery.status === "valid" ? dateQuery.date : null;
  const searchParameters = new URLSearchParams();

  if (selectedDate) {
    searchParameters.set("date", selectedDate);
  }

  const searchHref = `/${locale}/foods${searchParameters.size ? `?${searchParameters.toString()}` : ""}`;
  const retryHref = selectedDate
    ? `/${locale}/foods/reuse?date=${selectedDate}`
    : `/${locale}/foods/reuse`;

  return (
    <section className="flex min-w-0 flex-1 flex-col gap-4 py-2 text-start">
      <FoodDiscoveryHeader
        description={t("description")}
        eyebrow={t("label")}
        locale={locale}
        selectedDate={selectedDate}
        title={t("title")}
      />
      <FoodDiscoveryNavigation current="reuse" locale={locale} selectedDate={selectedDate} />
      <FoodDiscoveryOptions locale={locale} selectedDate={selectedDate} />

      {(dateQuery.status === "invalid" || dateQuery.status === "repeated") && (
        <section
          aria-labelledby="reusable-foods-date-error-title"
          className={feedbackStyles("warning")}
          data-testid="reusable-foods-date-invalid"
        >
          <h2
            className="ui-card-title"
            id="reusable-foods-date-error-title"
          >
            {t("date.invalidTitle")}
          </h2>
          <p className="mt-2 text-sm leading-6" role="alert">
            {dateQuery.status === "repeated"
              ? t("date.repeated")
              : t("date.invalid")}
          </p>
        </section>
      )}

      {!collections ? (
        <div className="min-w-0">
          <RetrievalError
            body={t("error.body")}
            retryHref={retryHref}
            retryLabel={t("error.retry")}
            testId="reusable-foods-error"
            title={t("error.title")}
          />
        </div>
      ) : (
        <>
          <ReusableCollection
            empty={t("favorites.empty")}
            foods={collections.favorites}
            locale={locale}
            searchHref={searchHref}
            selectedDate={selectedDate}
            title={t("favorites.title")}
            type="favorites"
          />
          <ReusableCollection
            empty={t("recent.empty")}
            foods={collections.recent}
            locale={locale}
            searchHref={searchHref}
            selectedDate={selectedDate}
            title={t("recent.title")}
            type="recent"
          />
        </>
      )}
    </section>
  );
}

function ReusableCollection({
  empty,
  foods,
  locale,
  searchHref,
  selectedDate,
  title,
  type,
}: {
  empty: string;
  foods: ReusableFood[];
  locale: Locale;
  searchHref: string;
  selectedDate: string | null;
  title: string;
  type: "favorites" | "recent";
}) {
  const t = useTranslations("ReusableFoods");

  return (
    <section aria-labelledby={`${type}-foods-title`} className="min-w-0">
      <h2 className="ui-section-title" id={`${type}-foods-title`}>
        {title}
      </h2>
      {foods.length === 0 ? (
        <div
          className={surfaceStyles({ variant: "subtle", className: "mt-3" })}
          data-testid={`${type}-foods-empty`}
        >
          <p className="ui-body-secondary">{empty}</p>
          <Link className={buttonStyles({ variant: "outline", size: "sm", className: "mt-3" })} href={searchHref}>
            {t("search")}
          </Link>
        </div>
      ) : (
        <ol className="mt-3 grid items-start gap-3 md:grid-cols-2" data-testid={`${type}-foods-list`}>
          {foods.map((food) => (
            <ReusableFoodCard
              food={food}
              key={`${type}-${food.food_id}`}
              locale={locale}
              selectedDate={selectedDate}
            />
          ))}
        </ol>
      )}
    </section>
  );
}

function ReusableFoodCard({
  food,
  locale,
  selectedDate,
}: {
  food: ReusableFood;
  locale: Locale;
  selectedDate: string | null;
}) {
  const t = useTranslations("ReusableFoods");
  const diaryParameters = new URLSearchParams();
  const foodTypeLabels: Record<string, string> = {
    branded: t("foodTypes.branded"),
    generic: t("foodTypes.generic"),
    user_custom: t("foodTypes.userCustom"),
  };
  const qualityLabels: Record<string, string> = {
    curated: t("quality.curated"),
    estimated: t("quality.estimated"),
    imported: t("quality.imported"),
    unknown: t("quality.unknown"),
    user_provided: t("quality.userProvided"),
    verified: t("quality.verified"),
  };
  const sourceLabels: Record<string, string> = {
    foodsdictionary: t("sources.foodsDictionary"),
    manual: t("sources.manual"),
    usda: t("sources.usda"),
    user_custom: t("sources.userCustom"),
  };
  const trustLabels: Record<string, string> = {
    curated: t("trust.curated"),
    estimated: t("trust.estimated"),
    unknown: t("trust.unknown"),
    user_provided: t("trust.userProvided"),
    verified: t("trust.verified"),
  };
  const serving = [
    food.serving_size === null
      ? null
      : formatLocalizedNumber(locale, food.serving_size),
    food.serving_unit,
  ]
    .filter((value) => value !== null && value !== "")
    .join(" ");
  const source = food.source_code
    ? (sourceLabels[food.source_code] ?? food.source_name)
    : food.source_name;
  const lastUsed = food.last_used_at
    ? formatLocalizedDate(locale, food.last_used_at, {
        dateStyle: "medium",
        timeStyle: "short",
      })
    : null;

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
            {t("card.useInDiary")}
          </Link>
          <FoodFavoriteControl
            action={favoriteAction}
            foodName={food.name}
            isFavorite={food.is_favorite}
          />
        </>
      }
      brand={food.brand_name ? t("card.brand", { brand: food.brand_name }) : null}
      foodId={food.food_id}
      name={food.name}
      serving={serving}
      servingLabel={t("card.serving")}
    >
      <FoodResultMetadata>
        <Badge>{food.is_owned ? t("card.own") : t("card.public")}</Badge>
        <dl className="mt-3 grid gap-x-5 gap-y-3 sm:grid-cols-2">
          <FoodMetadata
            label={t("card.foodType")}
            value={foodTypeLabels[food.food_type] ?? food.food_type}
          />
          <FoodMetadata
            label={t("card.quality")}
            value={qualityLabels[food.data_quality] ?? food.data_quality}
          />
          {source && <FoodMetadata label={t("card.source")} value={source} />}
          {food.source_trust_level && (
            <FoodMetadata
              label={t("card.trust")}
              value={trustLabels[food.source_trust_level] ?? food.source_trust_level}
            />
          )}
          {lastUsed && <FoodMetadata label={t("card.lastUsed")} value={lastUsed} />}
        </dl>
        <p className="ui-caption mt-3">{t("card.currentValues")}</p>
      </FoodResultMetadata>
    </FoodResultCard>
  );
}
