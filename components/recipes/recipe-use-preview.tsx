import Link from "next/link";
import { useTranslations } from "next-intl";
import type { DiaryEntryMealType } from "@/lib/diary-entries/validation";
import type {
  RecipeUseContract,
  RecipeUseNutrientContract,
} from "@/lib/recipes";
import type { Locale } from "@/lib/i18n/routing";

const nutrients = [
  ["calories", "calories"],
  ["protein", "protein_g"],
  ["carbohydrates", "carbohydrates_g"],
  ["fat", "fat_g"],
] as const;

type Perspective =
  | "diary_value"
  | "per_serving_value"
  | "requested_value"
  | "whole_recipe_value";

type RecipeReviewModel = {
  date: string;
  diary: {
    calories: number | null;
    carbohydrates_g: number | null;
    fat_g: number | null;
    protein_g: number | null;
  };
  meal_type: DiaryEntryMealType;
  recipe_id: string;
  requested_servings: number;
  source_updated_at: string;
};

function formatter(locale: Locale) {
  return new Intl.NumberFormat(locale === "he" ? "he-IL" : "en-US", {
    maximumFractionDigits: 12,
  });
}

function formatNutritionValue(
  value: number | null,
  locale: Locale,
  unknown: string,
  grams: boolean,
) {
  if (value === null) return unknown;
  const formatted = formatter(locale).format(value);
  return grams ? `${formatted} g` : formatted;
}

function NutritionValue({
  contract,
  field,
  grams,
  locale,
}: {
  contract: RecipeUseNutrientContract;
  field: Perspective;
  grams: boolean;
  locale: Locale;
}) {
  const t = useTranslations("RecipeNutrition");
  const value = contract[field];
  return (
    <span data-contract-value={value === null ? "unknown" : String(value)}>
      {formatNutritionValue(value, locale, t("unknown"), grams)}
    </span>
  );
}

function PerspectiveCard({
  contract,
  field,
  locale,
  title,
}: {
  contract: RecipeUseContract;
  field: Perspective;
  locale: Locale;
  title: string;
}) {
  const t = useTranslations("RecipeNutrition");
  return (
    <section
      aria-labelledby={`recipe-use-${field}-title`}
      className="border border-slate-200 bg-white p-5 shadow-sm"
      data-testid={`recipe-use-${field}`}
    >
      <h3 className="text-lg font-semibold text-slate-950" id={`recipe-use-${field}-title`}>
        {title}
      </h3>
      <dl className="mt-4 grid gap-3">
        {nutrients.map(([translation, nutrient], index) => (
          <div className="flex items-start justify-between gap-4 border-t border-slate-100 pt-3 first:border-0 first:pt-0" key={nutrient}>
            <dt className="text-sm font-medium text-slate-700">
              {t(`nutrients.${translation}`)}
            </dt>
            <dd className="text-sm font-semibold text-slate-950" dir="auto">
              <NutritionValue
                contract={contract.nutrients[nutrient]}
                field={field}
                grams={index > 0}
                locale={locale}
              />
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

export function RecipeUseContextForm({
  action,
  date,
  mealType,
  servings,
}: {
  action: string;
  date: string;
  mealType: DiaryEntryMealType | null;
  servings: string;
}) {
  const t = useTranslations("RecipeUse.form");
  const diaryT = useTranslations("Diary");
  return (
    <form action={action} className="grid gap-5 border border-slate-200 bg-white p-5 shadow-sm sm:p-6" method="get">
      <div>
        <h2 className="text-xl font-semibold text-slate-950">{t("title")}</h2>
        <p className="mt-2 text-sm leading-6 text-slate-600">{t("help")}</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <label className="grid gap-2 text-sm font-medium text-slate-900">
          <span>{t("date")}</span>
          <input className="min-h-11 border border-slate-300 bg-white px-3 text-base" defaultValue={date} name="date" required type="date" />
        </label>
        <label className="grid gap-2 text-sm font-medium text-slate-900">
          <span>{t("mealType")}</span>
          <select className="min-h-11 border border-slate-300 bg-white px-3 text-base" defaultValue={mealType ?? ""} name="mealType" required>
            <option disabled value="">{t("chooseMeal")}</option>
            {(["breakfast", "lunch", "dinner", "snack", "other"] as const).map((meal) => (
              <option key={meal} value={meal}>{diaryT(`mealTypes.${meal}`)}</option>
            ))}
          </select>
        </label>
        <label className="grid gap-2 text-sm font-medium text-slate-900">
          <span>{t("servings")}</span>
          <input className="min-h-11 border border-slate-300 bg-white px-3 text-base" defaultValue={servings} inputMode="decimal" max="10000" min="0.001" name="servings" pattern="\d+(?:\.\d{1,3})?" required type="text" />
        </label>
      </div>
      <button className="min-h-12 bg-teal-700 px-5 text-base font-semibold text-white" type="submit">
        {t("submit")}
      </button>
    </form>
  );
}

function Completeness({ contract }: { contract: RecipeUseContract }) {
  const t = useTranslations("RecipeNutrition");
  return (
    <section aria-labelledby="recipe-use-completeness" className="border border-slate-200 bg-stone-50 p-5">
      <h2 className="text-xl font-semibold text-slate-950" id="recipe-use-completeness">
        {t("completenessTitle")}
      </h2>
      <p className="mt-2 text-sm leading-6 text-slate-600">{t("completenessHelp")}</p>
      <ul className="mt-4 grid gap-3 sm:grid-cols-2">
        {nutrients.map(([translation, nutrient]) => {
          const value = contract.nutrients[nutrient];
          return (
            <li className="border border-slate-200 bg-white p-4" key={nutrient}>
              <p className="font-semibold text-slate-950">{t(`nutrients.${translation}`)}</p>
              <p className={value.complete ? "mt-2 text-sm text-teal-800" : "mt-2 text-sm text-amber-900"}>
                {value.complete
                  ? t("complete")
                  : t("knownCount", {
                      known: value.known_ingredient_count ?? 0,
                      total: contract.ingredient_count,
                    })}
              </p>
              {!value.complete && <p className="mt-2 text-sm leading-6 text-slate-600">{t("unknownExplanation")}</p>}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function ReviewReady({
  contract,
  dateLabel,
  locale,
  mealLabel,
  model,
}: {
  contract: RecipeUseContract;
  dateLabel: string;
  locale: Locale;
  mealLabel: string;
  model: RecipeReviewModel;
}) {
  const t = useTranslations("RecipeUse.review");
  const nutritionT = useTranslations("RecipeNutrition");
  return (
    <section aria-labelledby="recipe-review-ready-title" className="border border-teal-300 bg-teal-50 p-5 sm:p-6" data-testid="recipe-review-ready">
      <h2 className="text-xl font-semibold text-slate-950" id="recipe-review-ready-title">{t("title")}</h2>
      <p className="mt-2 text-sm leading-6 text-teal-950">{t("body")}</p>
      <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
        <div><dt className="font-medium text-slate-600">{t("recipe")}</dt><dd className="mt-1 text-slate-950" dir="auto">{contract.recipe_name}</dd></div>
        <div><dt className="font-medium text-slate-600">{t("servings")}</dt><dd className="mt-1 text-slate-950">{formatter(locale).format(model.requested_servings)}</dd></div>
        <div><dt className="font-medium text-slate-600">{t("date")}</dt><dd className="mt-1 text-slate-950">{dateLabel}</dd></div>
        <div><dt className="font-medium text-slate-600">{t("meal")}</dt><dd className="mt-1 text-slate-950">{mealLabel}</dd></div>
      </dl>
      <dl className="mt-5 grid gap-3 border-t border-teal-200 pt-4 text-sm sm:grid-cols-2" data-testid="recipe-review-diary-values">
        {nutrients.map(([translation, nutrient], index) => (
          <div key={nutrient}>
            <dt className="font-medium text-slate-600">{nutritionT(`nutrients.${translation}`)}</dt>
            <dd className="mt-1 font-semibold text-slate-950" data-contract-value={model.diary[nutrient] === null ? "unknown" : String(model.diary[nutrient])}>
              {formatNutritionValue(model.diary[nutrient], locale, nutritionT("unknown"), index > 0)}
            </dd>
          </div>
        ))}
      </dl>
      <p className="mt-4 text-sm leading-6 text-teal-950">{t("unknowns")}</p>
      <p className="mt-2 text-sm leading-6 text-teal-950">{t("future")}</p>
      <time className="mt-3 block text-xs text-slate-600" dateTime={model.source_updated_at}>
        {t("versionRetained")}
      </time>
    </section>
  );
}

export function RecipeUsePreview({
  canonicalServings,
  contract,
  date,
  locale,
  mealType,
  routePath,
}: {
  canonicalServings: string;
  contract: RecipeUseContract;
  date: string;
  locale: Locale;
  mealType: DiaryEntryMealType | null;
  routePath: string;
}) {
  const t = useTranslations("RecipeUse");
  const diaryT = useTranslations("Diary");
  const localizedDate = new Intl.DateTimeFormat(locale === "he" ? "he-IL" : "en-US", {
    dateStyle: "long",
    timeZone: "UTC",
  }).format(new Date(`${date}T00:00:00Z`));
  const updated = new Intl.DateTimeFormat(locale === "he" ? "he-IL" : "en-US", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "UTC",
  }).format(new Date(contract.source_updated_at));
  const reviewModel: RecipeReviewModel | null = mealType === null ? null : {
    date,
    diary: {
      calories: contract.nutrients.calories.diary_value,
      carbohydrates_g: contract.nutrients.carbohydrates_g.diary_value,
      fat_g: contract.nutrients.fat_g.diary_value,
      protein_g: contract.nutrients.protein_g.diary_value,
    },
    meal_type: mealType,
    recipe_id: contract.recipe_id,
    requested_servings: contract.requested_servings,
    source_updated_at: contract.source_updated_at,
  };
  const numberFormatter = formatter(locale);

  return (
    <section className="flex flex-1 flex-col gap-8 py-8 text-start">
      <header className="max-w-3xl">
        <p className="text-sm font-semibold uppercase tracking-[0.16em] text-teal-700">{t("label")}</p>
        <h1 className="mt-4 break-words text-3xl font-semibold leading-tight text-slate-950 sm:text-5xl" dir="auto">{contract.recipe_name}</h1>
        <p className="mt-5 max-w-2xl text-base leading-7 text-slate-700 sm:text-lg">{t("description")}</p>
      </header>

      <dl className="grid max-w-4xl gap-4 border border-slate-200 bg-white p-5 text-sm shadow-sm sm:grid-cols-2 lg:grid-cols-3" data-testid="recipe-use-identity">
        <Detail label={t("identity.language")} value={t(`languages.${contract.recipe_locale}`)} />
        <Detail label={t("identity.yield")} value={numberFormatter.format(contract.yield_servings)} />
        <Detail label={t("identity.ingredients")} value={numberFormatter.format(contract.ingredient_count)} />
        <Detail label={t("identity.updated")} value={updated}>
          <time dateTime={contract.source_updated_at}>{updated}</time>
        </Detail>
        <Detail label={t("identity.date")} value={localizedDate} />
        <Detail label={t("identity.meal")} value={mealType === null ? t("identity.notSelected") : diaryT(`mealTypes.${mealType}`)} />
        <Detail label={t("identity.servings")} value={numberFormatter.format(contract.requested_servings)} />
      </dl>

      <RecipeUseContextForm action={routePath} date={date} mealType={mealType} servings={canonicalServings} />

      <section aria-labelledby="recipe-use-nutrition-title" className="max-w-5xl">
        <h2 className="text-2xl font-semibold text-slate-950" id="recipe-use-nutrition-title">{t("nutrition.title")}</h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">{t("nutrition.explanation")}</p>
        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <PerspectiveCard contract={contract} field="whole_recipe_value" locale={locale} title={t("nutrition.whole")} />
          <PerspectiveCard contract={contract} field="per_serving_value" locale={locale} title={t("nutrition.perServing")} />
          <PerspectiveCard contract={contract} field="requested_value" locale={locale} title={t("nutrition.requested", { servings: numberFormatter.format(contract.requested_servings) })} />
          <PerspectiveCard contract={contract} field="diary_value" locale={locale} title={t("nutrition.diary")} />
        </div>
      </section>

      <Completeness contract={contract} />

      {reviewModel ? (
        <ReviewReady
          contract={contract}
          dateLabel={localizedDate}
          locale={locale}
          mealLabel={diaryT(`mealTypes.${reviewModel.meal_type}`)}
          model={reviewModel}
        />
      ) : (
        <section className="border border-amber-300 bg-amber-50 p-5" data-testid="recipe-review-incomplete">
          <h2 className="text-xl font-semibold text-slate-950">{t("review.incompleteTitle")}</h2>
          <p className="mt-2 text-sm leading-6 text-amber-950">{t("review.incompleteBody")}</p>
        </section>
      )}

      <section className="max-w-4xl border border-slate-200 bg-stone-50 p-5">
        <h2 className="text-lg font-semibold text-slate-950">{t("explanation.title")}</h2>
        <ul className="mt-3 list-disc space-y-2 ps-5 text-sm leading-6 text-slate-700">
          <li>{t("explanation.previewOnly")}</li>
          <li>{t("explanation.snapshots")}</li>
          <li>{t("explanation.linkedFoods")}</li>
          <li>{t("explanation.future")}</li>
        </ul>
      </section>

      <div className="flex flex-wrap gap-4">
        <Link className="text-sm font-semibold text-teal-800 underline" href={`/${locale}/recipes/${contract.recipe_id}/edit`}>{t("links.edit")}</Link>
        <Link className="text-sm font-semibold text-teal-800 underline" href={`/${locale}/recipes?status=active&page=1`}>{t("links.management")}</Link>
      </div>
    </section>
  );
}

function Detail({
  children,
  label,
  value,
}: {
  children?: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div>
      <dt className="font-medium text-slate-600">{label}</dt>
      <dd className="mt-1 break-words text-slate-950" dir="auto">{children ?? value}</dd>
    </div>
  );
}
