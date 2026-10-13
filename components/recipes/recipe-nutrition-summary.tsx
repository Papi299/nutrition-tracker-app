import Link from "next/link";
import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import { buttonStyles } from "@/components/ui/button";
import { surfaceStyles } from "@/components/ui/card";
import { feedbackStyles } from "@/components/ui/feedback";
import type {
  RecipeUseContract,
  RecipeUseContractState,
  RecipeUseNutrientContract,
} from "@/lib/recipes";
import { formatLocalizedNumber } from "@/lib/i18n/format";
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
  if (value === null) return <span dir="auto">{unknown}</span>;
  const formatted = formatLocalizedNumber(locale, value, {
    maximumFractionDigits: 12,
  });
  return (
    <bdi className="tabular-nums" dir="ltr">
      {unit === "grams" ? `${formatted} g` : formatted}
    </bdi>
  );
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
    <div className={surfaceStyles({ className: "min-w-0" })}>
      <dt className="ui-card-title">{label}</dt>
      <dd className="mt-3 grid min-w-0 gap-2 text-sm text-foreground [overflow-wrap:anywhere]">
        <span>
          {t("summary.whole")}: <span data-contract-value={contract.whole_recipe_value === null ? "unknown" : String(contract.whole_recipe_value)}>{formatValue(contract.whole_recipe_value, locale, t("unknown"), grams ? "grams" : "calories")}</span>
        </span>
        <span>
          {t("summary.perServing")}: <span data-contract-value={contract.per_serving_value === null ? "unknown" : String(contract.per_serving_value)}>{formatValue(contract.per_serving_value, locale, t("unknown"), grams ? "grams" : "calories")}</span>
        </span>
        <Badge className="mt-1 w-fit max-w-full [overflow-wrap:anywhere]" variant={complete ? "success" : "warning"}>
          {complete
            ? t("complete")
            : t("knownCount", {
                known: contract.known_ingredient_count ?? 0,
                total: ingredientCount,
              })}
        </Badge>
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
  return (
    <>
      <dl className="mt-4 grid min-w-0 grid-cols-[minmax(0,1fr)] gap-3 sm:grid-cols-2">
        <div className="min-w-0">
          <dt className="ui-label text-muted-foreground">{t("identity.yield")}</dt>
          <dd className="mt-1 text-foreground"><bdi className="tabular-nums" dir="ltr">{formatLocalizedNumber(locale, contract.yield_servings)}</bdi></dd>
        </div>
        <div className="min-w-0">
          <dt className="ui-label text-muted-foreground">{t("identity.ingredients")}</dt>
          <dd className="mt-1 text-foreground"><bdi className="tabular-nums" dir="ltr">{formatLocalizedNumber(locale, contract.ingredient_count)}</bdi></dd>
        </div>
      </dl>
      <dl className="mt-5 grid min-w-0 grid-cols-[minmax(0,1fr)] gap-3 sm:grid-cols-2" data-testid="recipe-editor-nutrition-values">
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
      className={surfaceStyles({ variant: "subtle", className: "mb-6 min-w-0" })}
      data-testid="recipe-editor-nutrition-summary"
    >
      <h2 className="ui-section-title" id="recipe-editor-nutrition-title">
        {t("title")}
      </h2>
      <p className="ui-body-secondary mt-2">{t("savedOnly")}</p>
      {state.status === "ready" ? (
        <ReadySummary contract={state.data} locale={locale} />
      ) : (
        <p className={feedbackStyles("warning", "mt-4")} role="status">
          {t("unavailable")}
        </p>
      )}
      <Link
        className={buttonStyles({ variant: "outline", className: "mt-5" })}
        href={`/${locale}/recipes/${recipeId}/use`}
      >
        {t("openPreview")}
      </Link>
    </section>
  );
}
