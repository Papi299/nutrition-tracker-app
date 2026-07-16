import Link from "next/link";
import { useTranslations } from "next-intl";
import { redirect } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { RetrievalError } from "@/components/data/retrieval-error";
import { FoodFavoriteControl } from "@/components/foods/food-favorite-control";
import { resolveAuthLocale, signInPath } from "@/lib/auth/require-user";
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
        <div className="mt-5 flex flex-wrap gap-3">
          <Link
            className="inline-flex min-h-11 items-center border border-teal-700 bg-white px-4 text-sm font-semibold text-teal-800 transition-colors hover:bg-teal-50"
            href={searchHref}
          >
            {t("search")}
          </Link>
        </div>
      </header>

      {(dateQuery.status === "invalid" || dateQuery.status === "repeated") && (
        <section
          aria-labelledby="reusable-foods-date-error-title"
          className="max-w-3xl border border-amber-300 bg-amber-50 p-5"
          data-testid="reusable-foods-date-invalid"
        >
          <h2
            className="font-semibold text-amber-950"
            id="reusable-foods-date-error-title"
          >
            {t("date.invalidTitle")}
          </h2>
          <p className="mt-2 text-sm leading-6 text-amber-950" role="alert">
            {dateQuery.status === "repeated"
              ? t("date.repeated")
              : t("date.invalid")}
          </p>
        </section>
      )}

      {!collections ? (
        <div className="max-w-3xl">
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
            selectedDate={selectedDate}
            title={t("favorites.title")}
            type="favorites"
          />
          <ReusableCollection
            empty={t("recent.empty")}
            foods={collections.recent}
            locale={locale}
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
  selectedDate,
  title,
  type,
}: {
  empty: string;
  foods: ReusableFood[];
  locale: Locale;
  selectedDate: string | null;
  title: string;
  type: "favorites" | "recent";
}) {
  return (
    <section aria-labelledby={`${type}-foods-title`} className="max-w-4xl">
      <h2 className="text-2xl font-semibold text-slate-950" id={`${type}-foods-title`}>
        {title}
      </h2>
      {foods.length === 0 ? (
        <p
          className="mt-4 border border-slate-200 bg-white p-5 text-sm leading-6 text-slate-700"
          data-testid={`${type}-foods-empty`}
        >
          {empty}
        </p>
      ) : (
        <ol className="mt-5 grid gap-4" data-testid={`${type}-foods-list`}>
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
  const serving = [food.serving_size, food.serving_unit]
    .filter((value) => value !== null && value !== "")
    .join(" ");
  const source = food.source_code
    ? (sourceLabels[food.source_code] ?? food.source_name)
    : food.source_name;
  const lastUsed = food.last_used_at
    ? new Intl.DateTimeFormat(locale, {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(new Date(food.last_used_at))
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
    <li
      className="border border-slate-200 bg-white p-5 shadow-sm sm:p-6"
      data-food-id={food.food_id}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="text-xl font-semibold text-slate-950" dir="auto">
            {food.name}
          </h3>
          {food.brand_name && (
            <p className="mt-1 text-sm text-slate-700" dir="auto">
              {t("card.brand", { brand: food.brand_name })}
            </p>
          )}
        </div>
        <span className="w-fit bg-teal-50 px-3 py-1 text-xs font-semibold text-teal-800">
          {food.is_owned ? t("card.own") : t("card.public")}
        </span>
      </div>
      <dl className="mt-4 grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
        {serving && <Metadata label={t("card.serving")} value={serving} />}
        <Metadata
          label={t("card.foodType")}
          value={foodTypeLabels[food.food_type] ?? food.food_type}
        />
        <Metadata
          label={t("card.quality")}
          value={qualityLabels[food.data_quality] ?? food.data_quality}
        />
        {source && <Metadata label={t("card.source")} value={source} />}
        {food.source_trust_level && (
          <Metadata
            label={t("card.trust")}
            value={
              trustLabels[food.source_trust_level] ?? food.source_trust_level
            }
          />
        )}
        {lastUsed && <Metadata label={t("card.lastUsed")} value={lastUsed} />}
      </dl>
      <p className="mt-4 text-xs leading-5 text-slate-500">
        {t("card.currentValues")}
      </p>
      <div className="mt-4 flex flex-wrap items-start gap-3">
        <Link
          className="inline-flex min-h-10 items-center bg-teal-700 px-4 text-sm font-semibold text-white transition-colors hover:bg-teal-800"
          href={`/${locale}/today?${diaryParameters.toString()}`}
        >
          {t("card.useInDiary")}
        </Link>
        <FoodFavoriteControl
          action={favoriteAction}
          foodName={food.name}
          isFavorite={food.is_favorite}
        />
      </div>
    </li>
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
