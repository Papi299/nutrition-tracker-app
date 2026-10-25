import { AdditionalNutrientDetails } from "@/components/nutrition/additional-nutrient-details";
import Link from "next/link";
import Form from "next/form";
import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import { Button, buttonStyles } from "@/components/ui/button";
import { surfaceStyles } from "@/components/ui/card";
import { feedbackStyles } from "@/components/ui/feedback";
import { FieldLabel, Input, Select } from "@/components/ui/form-controls";
import {
  RecipeUseConfirmation,
  type RecipeUseConfirmationAction,
} from "@/components/recipes/recipe-use-confirmation";
import type { DiaryEntryMealType } from "@/lib/diary-entries/validation";
import type {
  RecipeUseContract,
  RecipeUseNutrientContract,
} from "@/lib/recipes";
import type { Locale } from "@/lib/i18n/routing";
import { formatLocalizedDate, formatLocalizedNumber } from "@/lib/i18n/format";

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

function formatNutritionValue(
  value: number | null,
  locale: Locale,
  unknown: string,
  grams: boolean,
) {
  if (value === null) return <span dir="auto">{unknown}</span>;
  const formatted = formatLocalizedNumber(locale, value);
  return (
    <bdi className="tabular-nums" dir="ltr">
      {grams ? `${formatted} g` : formatted}
    </bdi>
  );
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
      className={surfaceStyles({ className: "min-w-0" })}
      data-testid={`recipe-use-${field}`}
    >
      <h3 className="ui-card-title [overflow-wrap:anywhere]" id={`recipe-use-${field}-title`}>
        {title}
      </h3>
      <dl className="mt-4 grid min-w-0 gap-3">
        {nutrients.map(([translation, nutrient], index) => (
          <div className="flex min-w-0 flex-wrap items-start justify-between gap-x-4 gap-y-1 border-t border-border pt-3 first:border-0 first:pt-0" key={nutrient}>
            <dt className="ui-label min-w-0 [overflow-wrap:anywhere]">
              {t(`nutrients.${translation}`)}
            </dt>
            <dd className="min-w-0 max-w-full text-sm font-semibold text-foreground [overflow-wrap:anywhere]">
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
    <Form action={action} aria-describedby="recipe-use-context-help" className={surfaceStyles({ className: "grid min-w-0 grid-cols-[minmax(0,1fr)] gap-5" })}>
      <div className="min-w-0">
        <h2 className="ui-section-title" id="recipe-use-context-title">{t("title")}</h2>
        <p className="ui-body-secondary mt-2" id="recipe-use-context-help">{t("help")}</p>
      </div>
      <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-4 sm:grid-cols-3">
        <FieldLabel className="grid min-w-0 gap-2">
          <span>{t("date")}</span>
          <Input defaultValue={date} name="date" required type="date" />
        </FieldLabel>
        <FieldLabel className="grid min-w-0 gap-2">
          <span>{t("mealType")}</span>
          <Select defaultValue={mealType ?? ""} name="mealType" required>
            <option disabled value="">{t("chooseMeal")}</option>
            {(["breakfast", "lunch", "dinner", "snack", "other"] as const).map((meal) => (
              <option key={meal} value={meal}>{diaryT(`mealTypes.${meal}`)}</option>
            ))}
          </Select>
        </FieldLabel>
        <FieldLabel className="grid min-w-0 gap-2">
          <span>{t("servings")}</span>
          <Input defaultValue={servings} dir="ltr" inputMode="decimal" max="10000" min="0.001" name="servings" pattern="\d+(?:\.\d{1,3})?" required type="text" />
        </FieldLabel>
      </div>
      <Button size="lg" type="submit">
        {t("submit")}
      </Button>
    </Form>
  );
}

function Completeness({ contract }: { contract: RecipeUseContract }) {
  const t = useTranslations("RecipeNutrition");
  return (
    <section aria-labelledby="recipe-use-completeness" className={surfaceStyles({ variant: "subtle", className: "min-w-0" })}>
      <h2 className="ui-section-title" id="recipe-use-completeness">
        {t("completenessTitle")}
      </h2>
      <p className="ui-body-secondary mt-2">{t("completenessHelp")}</p>
      <ul className="mt-4 grid min-w-0 grid-cols-[minmax(0,1fr)] gap-3 sm:grid-cols-2">
        {nutrients.map(([translation, nutrient]) => {
          const value = contract.nutrients[nutrient];
          return (
            <li className={surfaceStyles({ className: "min-w-0 [overflow-wrap:anywhere]" })} key={nutrient}>
              <p className="ui-card-title">{t(`nutrients.${translation}`)}</p>
              <Badge className="mt-2 max-w-full" variant={value.complete ? "success" : "warning"}>
                {value.complete
                  ? t("complete")
                  : t("knownCount", {
                      known: value.known_ingredient_count ?? 0,
                      total: contract.ingredient_count,
                    })}
              </Badge>
              {!value.complete && <p className="ui-body-secondary mt-2">{t("unknownExplanation")}</p>}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function ReviewReady({
  confirmationAction,
  contract,
  dateLabel,
  locale,
  mealLabel,
  model,
  reloadHref,
}: {
  confirmationAction: RecipeUseConfirmationAction;
  contract: RecipeUseContract;
  dateLabel: string;
  locale: Locale;
  mealLabel: string;
  model: RecipeReviewModel;
  reloadHref: string;
}) {
  const t = useTranslations("RecipeUse.review");
  const nutritionT = useTranslations("RecipeNutrition");
  return (
    <section aria-labelledby="recipe-review-ready-title" className={surfaceStyles({ className: "min-w-0 border-primary bg-primary-surface" })} data-testid="recipe-review-ready">
      <h2 className="ui-section-title" id="recipe-review-ready-title">{t("title")}</h2>
      <p className="ui-body-secondary mt-2">{t("body")}</p>
      <dl className="mt-4 grid min-w-0 grid-cols-[minmax(0,1fr)] gap-3 text-sm sm:grid-cols-2">
        <Detail label={t("recipe")} value={contract.recipe_name} />
        <Detail label={t("servings")} value={formatLocalizedNumber(locale, model.requested_servings)}><bdi className="tabular-nums" dir="ltr">{formatLocalizedNumber(locale, model.requested_servings)}</bdi></Detail>
        <Detail label={t("date")} value={dateLabel} />
        <Detail label={t("meal")} value={mealLabel} />
      </dl>
      <dl className="mt-5 grid min-w-0 grid-cols-[minmax(0,1fr)] gap-3 border-t border-border-strong pt-4 text-sm sm:grid-cols-2" data-testid="recipe-review-diary-values">
        {nutrients.map(([translation, nutrient], index) => (
          <div className="min-w-0" key={nutrient}>
            <dt className="font-medium text-muted-foreground">{nutritionT(`nutrients.${translation}`)}</dt>
            <dd className="mt-1 font-semibold text-foreground [overflow-wrap:anywhere]" data-contract-value={model.diary[nutrient] === null ? "unknown" : String(model.diary[nutrient])}>
              {formatNutritionValue(model.diary[nutrient], locale, nutritionT("unknown"), index > 0)}
            </dd>
          </div>
        ))}
      </dl>
      <p className="ui-body-secondary mt-4">{t("unknowns")}</p>
      <p className="ui-body-secondary mt-2">{t("future")}</p>
      <time className="ui-caption mt-3 block" dateTime={model.source_updated_at}>
        {t("versionRetained")}
      </time>
      <RecipeUseConfirmation
        action={confirmationAction}
        key={model.source_updated_at}
        locale={locale}
        recipeId={model.recipe_id}
        reloadHref={reloadHref}
      />
    </section>
  );
}

export function RecipeUsePreview({
  canonicalServings,
  confirmationAction,
  contract,
  date,
  locale,
  mealType,
  routePath,
}: {
  canonicalServings: string;
  confirmationAction: RecipeUseConfirmationAction | null;
  contract: RecipeUseContract;
  date: string;
  locale: Locale;
  mealType: DiaryEntryMealType | null;
  routePath: string;
}) {
  const t = useTranslations("RecipeUse");
  const diaryT = useTranslations("Diary");
  const localizedDate = formatLocalizedDate(locale, date, {
    dateStyle: "long",
  });
  const updated = formatLocalizedDate(locale, contract.source_updated_at, {
    dateStyle: "medium",
    timeStyle: "short",
  });
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
  return (
    <section className="flex min-w-0 w-full max-w-5xl flex-1 flex-col gap-6 py-4 text-start sm:gap-8">
      <header className="min-w-0 max-w-3xl">
        <p className="ui-eyebrow">{t("label")}</p>
        <h1 className="ui-page-title mt-3 [overflow-wrap:anywhere] [unicode-bidi:isolate]" dir="auto">{contract.recipe_name}</h1>
        <p className="ui-body-secondary mt-4 max-w-2xl text-base">{t("description")}</p>
      </header>

      <dl className={surfaceStyles({ className: "grid min-w-0 grid-cols-[minmax(0,1fr)] gap-4 text-sm sm:grid-cols-2 lg:grid-cols-3" })} data-testid="recipe-use-identity">
        <Detail label={t("identity.language")} value={t(`languages.${contract.recipe_locale}`)} />
        <Detail label={t("identity.yield")} value={formatLocalizedNumber(locale, contract.yield_servings)} />
        <Detail label={t("identity.ingredients")} value={formatLocalizedNumber(locale, contract.ingredient_count)} />
        <Detail label={t("identity.updated")} value={updated}>
          <time dateTime={contract.source_updated_at}>{updated}</time>
        </Detail>
        <Detail label={t("identity.date")} value={localizedDate} />
        <Detail label={t("identity.meal")} value={mealType === null ? t("identity.notSelected") : diaryT(`mealTypes.${mealType}`)} />
        <Detail label={t("identity.servings")} value={formatLocalizedNumber(locale, contract.requested_servings)} />
      </dl>

      <RecipeUseContextForm action={routePath} date={date} mealType={mealType} servings={canonicalServings} />

      <section aria-labelledby="recipe-use-nutrition-title" className="min-w-0">
        <h2 className="ui-section-title" id="recipe-use-nutrition-title">{t("nutrition.title")}</h2>
        <p className="ui-body-secondary mt-2 max-w-3xl">{t("nutrition.explanation")}</p>
        <div className="mt-5 grid min-w-0 grid-cols-[minmax(0,1fr)] gap-4 md:grid-cols-2">
          <PerspectiveCard contract={contract} field="whole_recipe_value" locale={locale} title={t("nutrition.whole")} />
          <PerspectiveCard contract={contract} field="per_serving_value" locale={locale} title={t("nutrition.perServing")} />
          <PerspectiveCard contract={contract} field="requested_value" locale={locale} title={t("nutrition.requested", { servings: formatLocalizedNumber(locale, contract.requested_servings) })} />
          <PerspectiveCard contract={contract} field="diary_value" locale={locale} title={t("nutrition.diary")} />
        </div>
      </section>

      <AdditionalNutrientDetails snapshots={[contract.additional_nutrient_snapshot ?? null]} locale={locale} />

      <Completeness contract={contract} />

      {reviewModel && confirmationAction ? (
        <ReviewReady
          confirmationAction={confirmationAction}
          contract={contract}
          dateLabel={localizedDate}
          locale={locale}
          mealLabel={diaryT(`mealTypes.${reviewModel.meal_type}`)}
          model={reviewModel}
          reloadHref={`${routePath}?date=${date}&mealType=${reviewModel.meal_type}&servings=${canonicalServings}`}
        />
      ) : (
        <section className={feedbackStyles("warning", "min-w-0")} data-testid="recipe-review-incomplete">
          <h2 className="ui-section-title">{t("review.incompleteTitle")}</h2>
          <p className="mt-2">{t("review.incompleteBody")}</p>
        </section>
      )}

      <section className={surfaceStyles({ variant: "subtle", className: "min-w-0" })}>
        <h2 className="ui-section-title">{t("explanation.title")}</h2>
        <ul className="ui-body-secondary mt-3 list-disc space-y-2 ps-5">
          <li>{t("explanation.previewOnly")}</li>
          <li>{t("explanation.snapshots")}</li>
          <li>{t("explanation.linkedFoods")}</li>
          <li>{t("explanation.future")}</li>
        </ul>
      </section>

      <div className="flex flex-wrap gap-4">
        <Link className={buttonStyles({ variant: "outline" })} href={`/${locale}/recipes/${contract.recipe_id}/edit`}>{t("links.edit")}</Link>
        <Link className={buttonStyles({ variant: "outline" })} href={`/${locale}/recipes?status=active&page=1`}>{t("links.management")}</Link>
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
    <div className="min-w-0">
      <dt className="font-medium text-muted-foreground">{label}</dt>
      <dd className="mt-1 whitespace-pre-wrap text-foreground [overflow-wrap:anywhere] [unicode-bidi:isolate]" dir="auto">{children ?? value}</dd>
    </div>
  );
}
