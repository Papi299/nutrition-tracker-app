import Link from "next/link";
import { useTranslations } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { redirect } from "next/navigation";
import { setRecipeArchiveAction } from "./management-actions";
import { RetrievalError } from "@/components/data/retrieval-error";
import { RecipeArchiveControl } from "@/components/recipes/recipe-archive-control";
import { resolveAuthLocale, signInPath } from "@/lib/auth/require-user";
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

  const query = parseRecipeManagementQuery(resolvedSearchParams);
  if (query.type === "invalid") return <InvalidQuery locale={locale} />;

  const result = await listOwnedRecipes(query.status, query.page);
  if (!result.ok) {
    if (result.code === "unauthenticated") redirect(signInPath(locale));
    return <ManagementError locale={locale} />;
  }

  const savedValue = resolvedSearchParams.saved;
  const saved = savedValue === "archived" || savedValue === "restored" ? savedValue : null;
  return <LocalizedManagement locale={locale} page={result.data} saved={saved} />;
}

function Header({ locale }: { locale: Locale }) {
  const t = useTranslations("RecipeManagement");
  return (
    <header className="max-w-3xl">
      <p className="text-sm font-semibold uppercase tracking-[0.16em] text-teal-700">{t("label")}</p>
      <h1 className="mt-4 text-3xl font-semibold leading-tight text-slate-950 sm:text-5xl">{t("title")}</h1>
      <p className="mt-5 max-w-2xl text-base leading-7 text-slate-700 sm:text-lg">{t("description")}</p>
      <div className="mt-5 flex flex-wrap gap-3">
        <Link className="inline-flex min-h-11 items-center bg-teal-700 px-4 text-sm font-semibold text-white" href={`/${locale}/recipes/new`}>{t("create")}</Link>
        <Link className="inline-flex min-h-11 items-center border border-teal-700 bg-white px-4 text-sm font-semibold text-teal-800" href={`/${locale}/today`}>{t("today")}</Link>
        <Link className="inline-flex min-h-11 items-center border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-800" href={`/${locale}/saved-meals`}>{t("savedMeals")}</Link>
      </div>
    </header>
  );
}

function LocalizedManagement({
  locale,
  page,
  saved,
}: {
  locale: Locale;
  page: ManagedRecipePage;
  saved: "archived" | "restored" | null;
}) {
  const t = useTranslations("RecipeManagement");
  return (
    <section className="flex flex-1 flex-col gap-8 py-8 text-start">
      <Header locale={locale} />
      {saved && <div className="border-s-4 border-teal-600 bg-teal-50 px-4 py-3 text-sm text-teal-900" data-testid="recipe-management-success" role="status">{t(`success.${saved}`)}</div>}
      <nav aria-label={t("filters.label")} className="flex flex-wrap gap-3">
        {(["active", "archived"] as const).map((status) => (
          <Link aria-current={page.status === status ? "page" : undefined} className={page.status === status ? "min-h-11 bg-teal-700 px-4 py-3 text-sm font-semibold text-white" : "min-h-11 border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-800"} href={`/${locale}/recipes?status=${status}&page=1`} key={status}>{t(`filters.${status}`)}</Link>
        ))}
      </nav>
      <p className="text-sm text-slate-600">{t("count", { count: page.total_count })}</p>
      {page.recipes.length === 0 ? <EmptyState locale={locale} status={page.status} /> : (
        <ul className="grid gap-5" data-testid="recipe-management-list">
          {page.recipes.map((recipe) => <RecipeCard key={recipe.recipe_id} locale={locale} recipe={recipe} />)}
        </ul>
      )}
      <Pagination locale={locale} page={page} />
    </section>
  );
}

function RecipeCard({ locale, recipe }: { locale: Locale; recipe: ManagedRecipe }) {
  const t = useTranslations("RecipeManagement");
  const action = setRecipeArchiveAction.bind(null, locale, recipe.recipe_id, !recipe.is_archived);
  const updated = new Intl.DateTimeFormat(locale === "he" ? "he-IL" : "en-US", { dateStyle: "medium", timeZone: "UTC" }).format(new Date(recipe.updated_at));
  return (
    <li className="grid gap-5 border border-slate-200 bg-white p-5 shadow-sm sm:grid-cols-[1fr_auto] sm:items-start sm:p-6" data-recipe-id={recipe.recipe_id}>
      <div>
        <h2 className="break-words text-xl font-semibold text-slate-950" dir="auto">{recipe.name}</h2>
        <dl className="mt-4 grid gap-x-5 gap-y-3 text-sm sm:grid-cols-2">
          <Detail label={t("card.language")} value={t(`languages.${recipe.locale}`)} />
          <Detail label={t("card.yield")} value={String(recipe.yield_servings)} />
          <Detail label={t("card.ingredients")} value={t("card.ingredientCount", { count: recipe.ingredient_count })} />
          <Detail label={t("card.status")} value={t(`filters.${recipe.is_archived ? "archived" : "active"}`)} />
          <Detail label={t("card.updated")} value={updated} />
        </dl>
      </div>
      <div className="grid gap-3 sm:min-w-40">
        <Link className="inline-flex min-h-11 items-center justify-center bg-teal-700 px-4 text-sm font-semibold text-white" href={`/${locale}/recipes/${recipe.recipe_id}/edit`}>{t("card.edit")}</Link>
        {!recipe.is_archived && <Link className="inline-flex min-h-11 items-center justify-center border border-teal-700 bg-white px-4 text-center text-sm font-semibold text-teal-800" href={`/${locale}/recipes/${recipe.recipe_id}/use`}>{t("card.preview")}</Link>}
        <RecipeArchiveControl action={action} archived={recipe.is_archived} recipeName={recipe.name} />
      </div>
    </li>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return <div><dt className="font-medium text-slate-600">{label}</dt><dd className="mt-1 break-words text-slate-950" dir="auto">{value}</dd></div>;
}

function EmptyState({ locale, status }: { locale: Locale; status: RecipeManagementStatus }) {
  const t = useTranslations("RecipeManagement.empty");
  return (
    <section className="border border-slate-200 bg-white p-5" data-testid={`recipe-management-empty-${status}`}>
      <h2 className="text-xl font-semibold text-slate-950">{t(`${status}.title`)}</h2>
      <p className="mt-3 text-sm leading-6 text-slate-700">{t(`${status}.body`)}</p>
      {status === "active" && <Link className="mt-4 inline-flex min-h-11 items-center bg-teal-700 px-4 text-sm font-semibold text-white" href={`/${locale}/recipes/new`}>{t("active.create")}</Link>}
    </section>
  );
}

function Pagination({ locale, page }: { locale: Locale; page: ManagedRecipePage }) {
  const t = useTranslations("RecipeManagement.pagination");
  return (
    <nav aria-label={t("label")} className="flex flex-wrap items-center gap-4">
      {page.has_previous ? <Link className="inline-flex min-h-11 items-center border border-slate-300 bg-white px-4 text-sm font-semibold" href={`/${locale}/recipes?status=${page.status}&page=${page.page - 1}`} rel="prev">{t("previous")}</Link> : <span className="min-h-11 border border-slate-200 bg-slate-100 px-4 py-3 text-sm text-slate-500">{t("previous")}</span>}
      <span className="text-sm text-slate-700">{t("current", { page: page.page })}</span>
      {page.has_next ? <Link className="inline-flex min-h-11 items-center border border-slate-300 bg-white px-4 text-sm font-semibold" href={`/${locale}/recipes?status=${page.status}&page=${page.page + 1}`} rel="next">{t("next")}</Link> : <span className="min-h-11 border border-slate-200 bg-slate-100 px-4 py-3 text-sm text-slate-500">{t("next")}</span>}
    </nav>
  );
}

function InvalidQuery({ locale }: { locale: Locale }) {
  const t = useTranslations("RecipeManagement.invalid");
  return <section className="flex flex-1 flex-col gap-8 py-8 text-start"><Header locale={locale} /><section className="border border-amber-300 bg-amber-50 p-5" data-testid="recipe-management-invalid-query"><h2 className="text-xl font-semibold text-slate-950">{t("title")}</h2><p className="mt-3 text-sm leading-6 text-amber-950" role="alert">{t("body")}</p><Link className="mt-4 inline-flex min-h-11 items-center bg-teal-700 px-4 text-sm font-semibold text-white" href={`/${locale}/recipes?status=active&page=1`}>{t("recover")}</Link></section></section>;
}

function ManagementError({ locale }: { locale: Locale }) {
  const t = useTranslations("RecipeManagement.retrieval");
  return <section className="flex flex-1 flex-col gap-8 py-8 text-start"><Header locale={locale} /><RetrievalError body={t("body")} retryHref={`/${locale}/recipes?status=active&page=1`} retryLabel={t("retry")} testId="recipe-management-retrieval-error" title={t("title")} /></section>;
}
