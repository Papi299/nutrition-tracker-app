import Link from "next/link";
import { useTranslations } from "next-intl";
import type {
  RecipeUseContract,
  RecipeUseContractState,
  RecipeUseNutrientContract,
} from "@/lib/recipes";
import type { Locale } from "@/lib/i18n/routing";

const nutrients = [
  ["calories", "calories", false],
  ["protein", "protein_g", true],
  ["carbohydrates", "carbohydrates_g", true],
  ["fat", "fat_g", true],
] as const;

function formatValue(
  value: number | null,
  locale: Locale,
  unknown: string,
  unit: "calories" | "grams",
) {
  if (value === null) return unknown;
  const formatted = new Intl.NumberFormat(locale === "he" ? "he-IL" : "en-US", {
    maximumFractionDigits: 12,
  }).format(value);
  return unit === "grams" ? `${formatted} g` : formatted;
}

function SummaryNutrient({
  contract,
  ingredientCount,
  label,
  locale,
  grams,
}: {
  contract: RecipeUseNutrientContract;
  ingredientCount: number;
  label: string;
  locale: Locale;
  grams: boolean;
}) {
  const t = useTranslations("RecipeNutrition");
  const complete = contract.complete === true;
  return (
    <div className="border border-slate-200 bg-stone-50 p-4">
      <dt className="font-semibold text-slate-950">{label}</dt>
      <dd className="mt-3 grid gap-2 text-sm text-slate-700">
        <span>
          {t("summary.whole")}: {formatValue(contract.whole_recipe_value, locale, t("unknown"), grams ? "grams" : "calories")}
        </span>
        <span>
          {t("summary.perServing")}: {formatValue(contract.per_serving_value, locale, t("unknown"), grams ? "grams" : "calories")}
        </span>
        <span className={complete ? "text-teal-800" : "text-amber-900"}>
          {complete
            ? t("complete")
            : t("knownCount", {
                known: contract.known_ingredient_count ?? 0,
                total: ingredientCount,
              })}
        </span>
      </dd>
    </div>
  );
}

function ReadySummary({
  contract,
  locale,
}: {
  contract: RecipeUseContract;
  locale: Locale;
}) {
  const t = useTranslations("RecipeNutrition");
  const numberFormatter = new Intl.NumberFormat(
    locale === "he" ? "he-IL" : "en-US",
    { maximumFractionDigits: 12 },
  );
  return (
    <>
      <dl className="mt-4 grid gap-3 sm:grid-cols-2">
        <div>
          <dt className="text-sm font-medium text-slate-600">{t("identity.yield")}</dt>
          <dd className="mt-1 text-slate-950">{numberFormatter.format(contract.yield_servings)}</dd>
        </div>
        <div>
          <dt className="text-sm font-medium text-slate-600">{t("identity.ingredients")}</dt>
          <dd className="mt-1 text-slate-950">{numberFormatter.format(contract.ingredient_count)}</dd>
        </div>
      </dl>
      <dl className="mt-5 grid gap-3 sm:grid-cols-2" data-testid="recipe-editor-nutrition-values">
        {nutrients.map(([translation, field, grams]) => (
          <SummaryNutrient
            contract={contract.nutrients[field]}
            grams={grams}
            ingredientCount={contract.ingredient_count}
            key={field}
            label={t(`nutrients.${translation}`)}
            locale={locale}
          />
        ))}
      </dl>
    </>
  );
}

export function RecipeNutritionSummary({
  locale,
  recipeId,
  state,
}: {
  locale: Locale;
  recipeId: string;
  state: RecipeUseContractState;
}) {
  const t = useTranslations("RecipeNutrition.summary");
  return (
    <section
      aria-labelledby="recipe-editor-nutrition-title"
      className="mb-8 border border-teal-200 bg-teal-50 p-5"
      data-testid="recipe-editor-nutrition-summary"
    >
      <h2 className="text-xl font-semibold text-slate-950" id="recipe-editor-nutrition-title">
        {t("title")}
      </h2>
      <p className="mt-2 text-sm leading-6 text-slate-700">{t("savedOnly")}</p>
      {state.status === "ready" ? (
        <ReadySummary contract={state.data} locale={locale} />
      ) : (
        <p className="mt-4 text-sm leading-6 text-amber-950" role="status">
          {t("unavailable")}
        </p>
      )}
      <Link
        className="mt-5 inline-flex min-h-11 items-center bg-teal-700 px-4 text-sm font-semibold text-white"
        href={`/${locale}/recipes/${recipeId}/use`}
      >
        {t("openPreview")}
      </Link>
    </section>
  );
}
