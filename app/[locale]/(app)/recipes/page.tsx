import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { buttonStyles } from "@/components/ui/button";
import { surfaceStyles } from "@/components/ui/card";
import { feedbackStyles } from "@/components/ui/feedback";
import { parseCalendarDateQueryValue } from "@/lib/calendar-date";
import { discoveryDateHref, FoodDiscoveryDateError } from "@/components/foods/food-discovery-date-context";
import { useTranslations } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { redirect } from "next/navigation";
import { setRecipeArchiveAction } from "./management-actions";
import { RetrievalError } from "@/components/data/retrieval-error";
import { RecipeArchiveControl } from "@/components/recipes/recipe-archive-control";
import { resolveAuthLocale, signInPath } from "@/lib/auth/require-user";
import { formatLocalizedDate, formatLocalizedNumber } from "@/lib/i18n/format";
import {
  listOwnedRecipes,
  parseRecipeManagementQuery,
  type ManagedRecipe,
  type ManagedRecipePage,
  type RecipeManagementStatus,
} from "@/lib/recipes";
import type { Locale } from "@/lib/i18n/routing";

type RecipeManagementPageProps = Readonly<{
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}>;

export default async function RecipeManagementPage({
  params,
  searchParams,
}: RecipeManagementPageProps) {
  const { locale: localeInput } = await params;
  const resolvedSearchParams = await searchParams;
  const locale = resolveAuthLocale(localeInput);
  setRequestLocale(locale);

  const dateQuery = parseCalendarDateQueryValue(resolvedSearchParams.date);
  if (dateQuery.status === "invalid" || dateQuery.status === "repeated") {
    return <FoodDiscoveryDateError dateQuery={dateQuery} routePath={`/${locale}/recipes`} />;
  }
  const selectedDate = dateQuery.status === "valid" ? dateQuery.date : undefined;

  const query = parseRecipeManagementQuery(resolvedSearchParams);
  if (query.type === "invalid") return <InvalidQuery locale={locale} selectedDate={selectedDate} />;

  const result = await listOwnedRecipes(query.status, query.page);
  if (!result.ok) {
    if (result.code === "unauthenticated") redirect(signInPath(locale));
    return <ManagementError locale={locale} selectedDate={selectedDate} />;
  }

  const savedValue = resolvedSearchParams.saved;
  const saved = savedValue === "archived" || savedValue === "restored" ? savedValue : null;
  return <LocalizedManagement locale={locale} page={result.data} saved={saved} selectedDate={selectedDate} />;
}

function Header({ locale, selectedDate }: { locale: Locale; selectedDate?: string }) {
  const t = useTranslations("RecipeManagement");
  return (
    <header className="min-w-0 max-w-3xl">
      <p className="ui-eyebrow">{t("label")}</p>
      <h1 className="ui-page-title mt-1">{t("title")}</h1>
      <p className="ui-body-secondary mt-2 max-w-2xl">{t("description")}</p>
      <div className="mt-4 flex min-w-0 flex-wrap gap-2">
        <Link className={buttonStyles()} href={`/${locale}/recipes/new`}>{t("create")}</Link>
        <Link className={buttonStyles({ variant: "outline", className: "border-primary text-primary hover:bg-primary-surface" })} href={discoveryDateHref(`/${locale}/today`, selectedDate)}>{t("today")}</Link>
        <Link className={buttonStyles({ variant: "outline" })} href={discoveryDateHref(`/${locale}/saved-meals`, selectedDate)}>{t("savedMeals")}</Link>
      </div>
    </header>
  );
}

function LocalizedManagement({
  locale,
  page,
  saved,
  selectedDate,
}: {
  locale: Locale;
  page: ManagedRecipePage;
  saved: "archived" | "restored" | null;
  selectedDate?: string;
}) {
  const t = useTranslations("RecipeManagement");
  return (
    <section className="flex min-w-0 flex-1 flex-col gap-6 py-4 text-start sm:py-6">
      <Header locale={locale} selectedDate={selectedDate} />
      {saved && <div className={feedbackStyles("success")} data-testid="recipe-management-success" role="status">{t(`success.${saved}`)}</div>}
      <nav aria-label={t("filters.label")} className="flex min-w-0 max-w-full flex-wrap gap-1 self-start rounded-xl border border-border bg-surface-subtle p-1">
        {(["active", "archived"] as const).map((status) => (
          <Link aria-current={page.status === status ? "page" : undefined} className={buttonStyles({ variant: "ghost", className: page.status === status ? "ui-current" : "" })} href={discoveryDateHref(`/${locale}/recipes?status=${status}&page=1`, selectedDate)} key={status}>{t(`filters.${status}`)}</Link>
        ))}
      </nav>
      <p className="ui-body-secondary">{t("count", { count: page.total_count })}</p>
      {page.recipes.length === 0 ? <EmptyState locale={locale} status={page.status} /> : (
        <ul className="grid min-w-0 grid-cols-1 gap-4" data-testid="recipe-management-list">
          {page.recipes.map((recipe) => <RecipeCard key={recipe.recipe_id} locale={locale} recipe={recipe} selectedDate={selectedDate} />)}
        </ul>
      )}
      <Pagination locale={locale} page={page} selectedDate={selectedDate} />
    </section>
  );
}

function RecipeCard({ locale, recipe, selectedDate }: { locale: Locale; recipe: ManagedRecipe; selectedDate?: string }) {
  const t = useTranslations("RecipeManagement");
  const action = setRecipeArchiveAction.bind(null, locale, recipe.recipe_id, !recipe.is_archived);
  const updated = formatLocalizedDate(locale, recipe.updated_at);
  return (
    <li className={surfaceStyles({ className: "grid min-w-0 gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,12rem)] sm:items-start" })} data-recipe-id={recipe.recipe_id}>
      <div className="min-w-0">
        <h2 className="ui-card-title [overflow-wrap:anywhere]" dir="auto"><bdi>{recipe.name}</bdi></h2>
        <dl className="mt-4 grid min-w-0 grid-cols-1 gap-x-5 gap-y-3 text-sm sm:grid-cols-2">
          <Detail label={t("card.language")} value={t(`languages.${recipe.locale}`)} />
          <Detail label={t("card.yield")} value={formatLocalizedNumber(locale, recipe.yield_servings)} />
          <Detail label={t("card.ingredients")} value={t("card.ingredientCount", { count: recipe.ingredient_count })} />
          <Detail badge={recipe.is_archived ? "neutral" : "success"} label={t("card.status")} value={t(`filters.${recipe.is_archived ? "archived" : "active"}`)} />
          <Detail label={t("card.updated")} value={updated} />
        </dl>
      </div>
      <div className="grid min-w-0 gap-2">
        <Link className={buttonStyles({ className: "w-full" })} href={`/${locale}/recipes/${recipe.recipe_id}/edit`}>{t("card.edit")}</Link>
        {!recipe.is_archived && <Link className={buttonStyles({ variant: "outline", className: "w-full border-primary text-primary hover:bg-primary-surface" })} href={discoveryDateHref(`/${locale}/recipes/${recipe.recipe_id}/use`, selectedDate)}>{t("card.preview")}</Link>}
        <RecipeArchiveControl action={action} archived={recipe.is_archived} recipeName={recipe.name} />
      </div>
    </li>
  );
}

function Detail({ badge, label, value }: { badge?: "neutral" | "success"; label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="ui-caption font-medium">{label}</dt>
      <dd className="mt-1 text-sm text-foreground [overflow-wrap:anywhere]" dir="auto">
        {badge ? <Badge variant={badge}><bdi>{value}</bdi></Badge> : <bdi>{value}</bdi>}
      </dd>
    </div>
  );
}

function EmptyState({ locale, status }: { locale: Locale; status: RecipeManagementStatus }) {
  const t = useTranslations("RecipeManagement.empty");
  return (
    <section className={surfaceStyles({ className: "min-w-0" })} data-testid={`recipe-management-empty-${status}`}>
      <h2 className="ui-section-title">{t(`${status}.title`)}</h2>
      <p className="ui-body-secondary mt-2">{t(`${status}.body`)}</p>
      {status === "active" && <Link className={buttonStyles({ className: "mt-4" })} href={`/${locale}/recipes/new`}>{t("active.create")}</Link>}
    </section>
  );
}

function Pagination({ locale, page, selectedDate }: { locale: Locale; page: ManagedRecipePage; selectedDate?: string }) {
  const t = useTranslations("RecipeManagement.pagination");
  return (
    <nav aria-label={t("label")} className="flex min-w-0 flex-wrap items-center gap-3">
      {page.has_previous ? <Link className={buttonStyles({ variant: "outline" })} href={discoveryDateHref(`/${locale}/recipes?status=${page.status}&page=${page.page - 1}`, selectedDate)} rel="prev">{t("previous")}</Link> : <span aria-disabled="true" className={buttonStyles({ variant: "outline", className: "cursor-default border-border bg-surface-subtle text-muted-foreground" })}>{t("previous")}</span>}
      <span className="ui-body-secondary">{t("current", { page: page.page })}</span>
      {page.has_next ? <Link className={buttonStyles({ variant: "outline" })} href={discoveryDateHref(`/${locale}/recipes?status=${page.status}&page=${page.page + 1}`, selectedDate)} rel="next">{t("next")}</Link> : <span aria-disabled="true" className={buttonStyles({ variant: "outline", className: "cursor-default border-border bg-surface-subtle text-muted-foreground" })}>{t("next")}</span>}
    </nav>
  );
}

function InvalidQuery({ locale, selectedDate }: { locale: Locale; selectedDate?: string }) {
  const t = useTranslations("RecipeManagement.invalid");
  return <section className="flex min-w-0 flex-1 flex-col gap-6 py-4 text-start sm:py-6"><Header locale={locale} selectedDate={selectedDate} /><section className={surfaceStyles({ className: "min-w-0 border-warning/30 bg-warning-surface" })} data-testid="recipe-management-invalid-query"><h2 className="ui-section-title">{t("title")}</h2><p className="mt-2 text-sm leading-6 text-warning-foreground" role="alert">{t("body")}</p><Link className={buttonStyles({ className: "mt-4" })} href={discoveryDateHref(`/${locale}/recipes?status=active&page=1`, selectedDate)}>{t("recover")}</Link></section></section>;
}

function ManagementError({ locale, selectedDate }: { locale: Locale; selectedDate?: string }) {
  const t = useTranslations("RecipeManagement.retrieval");
  return <section className="flex min-w-0 flex-1 flex-col gap-6 py-4 text-start sm:py-6"><Header locale={locale} selectedDate={selectedDate} /><RetrievalError body={t("body")} retryHref={discoveryDateHref(`/${locale}/recipes?status=active&page=1`, selectedDate)} retryLabel={t("retry")} testId="recipe-management-retrieval-error" title={t("title")} /></section>;
}
