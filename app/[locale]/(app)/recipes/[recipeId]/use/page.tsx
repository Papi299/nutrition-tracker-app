import { randomUUID } from "node:crypto";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { redirect } from "next/navigation";
import { BrowserDateBootstrap } from "@/components/calendar-date/browser-date-bootstrap";
import { RetrievalError } from "@/components/data/retrieval-error";
import {
  RecipeUseContextForm,
  RecipeUsePreview,
} from "@/components/recipes/recipe-use-preview";
import { logRecipeAction } from "@/app/[locale]/(app)/recipes/use-actions";
import { resolveAuthLocale, signInPath } from "@/lib/auth/require-user";
import { isUuid } from "@/lib/food-selection/query";
import {
  getOwnedRecipeUseContract,
  parseRecipeUseQuery,
  recipeUseCanonicalQuery,
  type RecipeUseQueryInvalidField,
} from "@/lib/recipes";
import type { Locale } from "@/lib/i18n/routing";

type PageProps = Readonly<{
  params: Promise<{ locale: string; recipeId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}>;

export default async function RecipeUsePage({ params, searchParams }: PageProps) {
  const { locale: localeInput, recipeId } = await params;
  const query = await searchParams;
  const locale = resolveAuthLocale(localeInput);
  setRequestLocale(locale);
  const routePath = `/${locale}/recipes/${recipeId}/use`;

  if (!isUuid(recipeId)) {
    return <Unavailable locale={locale} recipeId={recipeId} state="invalid_link" />;
  }

  const parsed = parseRecipeUseQuery(recipeId, query);
  if (parsed.status === "invalid") {
    return <QueryError field={parsed.field} locale={locale} routePath={routePath} />;
  }

  if (parsed.status === "date_missing") {
    return (
      <DateBootstrap
        canonicalServings={parsed.normalized_servings}
        mealType={parsed.meal_type}
        routePath={routePath}
      />
    );
  }

  if (parsed.needs_canonical_redirect) {
    redirect(
      `${routePath}?${recipeUseCanonicalQuery({
        date: parsed.date,
        mealType: parsed.meal_type,
        servings: parsed.normalized_servings,
      })}`,
    );
  }

  const contract = await getOwnedRecipeUseContract({
    recipe_id: recipeId,
    requested_servings: parsed.requested_servings,
  });

  if (contract.status === "unauthenticated") redirect(signInPath(locale));
  if (contract.status === "validation_error") {
    return <QueryError field="servings" locale={locale} routePath={routePath} />;
  }
  if (contract.status === "database_error") {
    return (
      <LoadFailure
        locale={locale}
        retryHref={`${routePath}?${recipeUseCanonicalQuery({
          date: parsed.date,
          mealType: parsed.meal_type,
          servings: parsed.normalized_servings,
        })}`}
      />
    );
  }
  if (contract.status === "unavailable") {
    return <Unavailable locale={locale} recipeId={recipeId} state="unavailable" />;
  }
  if (contract.status === "archived") {
    return <Unavailable locale={locale} recipeId={recipeId} state="archived" />;
  }
  if (contract.status === "invalid_recipe") {
    return <Unavailable locale={locale} recipeId={recipeId} state="invalid_recipe" />;
  }
  if (contract.status === "not_loggable") {
    return (
      <NotLoggable
        date={parsed.date}
        locale={locale}
        mealType={parsed.meal_type}
        recipeId={recipeId}
        recipeName={contract.data.recipe_name}
        routePath={routePath}
        servings={parsed.normalized_servings}
      />
    );
  }
  if (contract.status !== "ready" || !("data" in contract)) {
    return <LoadFailure locale={locale} retryHref={routePath} />;
  }

  const confirmationAction = parsed.meal_type === null
    ? null
    : logRecipeAction.bind(null, locale, {
        entry_date: parsed.date,
        expected_source_updated_at: contract.data.source_updated_at,
        idempotency_key: randomUUID(),
        meal_type: parsed.meal_type,
        recipe_id: contract.data.recipe_id,
        requested_servings: contract.data.requested_servings,
      });

  return (
    <RecipeUsePreview
      canonicalServings={parsed.normalized_servings}
      confirmationAction={confirmationAction}
      contract={contract.data}
      date={parsed.date}
      locale={locale}
      mealType={parsed.meal_type}
      routePath={routePath}
    />
  );
}

function DateBootstrap({
  canonicalServings,
  mealType,
  routePath,
}: {
  canonicalServings: string;
  mealType: "breakfast" | "dinner" | "lunch" | "other" | "snack" | null;
  routePath: string;
}) {
  const t = useTranslations("RecipeUse");
  const dateT = useTranslations("CalendarDate");
  return (
    <section className="flex flex-1 flex-col justify-center py-8 text-start">
      <BrowserDateBootstrap
        canonicalQueryValues={{
          ...(mealType === null ? {} : { mealType }),
          servings: canonicalServings,
        }}
        formDescription={dateT("manual.description")}
        formLabel={dateT("manual.label")}
        formSubmitLabel={dateT("manual.submit")}
        inputId="recipe-use-bootstrap-date"
        queryName="date"
        routePath={routePath}
        status={dateT("bootstrap.status")}
        title={t("bootstrapTitle")}
      />
    </section>
  );
}

function QueryError({
  field,
  locale,
  routePath,
}: {
  field: RecipeUseQueryInvalidField;
  locale: Locale;
  routePath: string;
}) {
  const t = useTranslations("RecipeUse.queryError");
  return (
    <section className="flex flex-1 flex-col justify-center py-8 text-start">
      <div className="max-w-3xl border border-amber-300 bg-amber-50 p-5" data-testid="recipe-use-query-error">
        <h1 className="text-2xl font-semibold text-slate-950">{t("title")}</h1>
        <p className="mt-3 text-sm leading-6 text-amber-950" role="alert">
          {t(`fields.${field}`)}
        </p>
        <div className="mt-4 flex flex-wrap gap-4">
          <Link className="font-semibold text-teal-800 underline" href={routePath}>{t("recover")}</Link>
          <Link className="font-semibold text-teal-800 underline" href={`/${locale}/recipes`}>{t("back")}</Link>
        </div>
      </div>
    </section>
  );
}

function Unavailable({
  locale,
  recipeId,
  state,
}: {
  locale: Locale;
  recipeId: string;
  state: "archived" | "invalid_link" | "invalid_recipe" | "unavailable";
}) {
  const t = useTranslations("RecipeUse.states");
  return (
    <section className="flex flex-1 flex-col justify-center py-8 text-start">
      <div className="max-w-3xl border border-amber-300 bg-amber-50 p-5" data-testid={`recipe-use-${state}`}>
        <h1 className="text-2xl font-semibold text-slate-950">{t(`${state}.title`)}</h1>
        <p className="mt-3 text-sm leading-6 text-amber-950" role="alert">{t(`${state}.body`)}</p>
        <div className="mt-4 flex flex-wrap gap-4">
          {(state === "archived" || state === "invalid_recipe") && (
            <Link className="font-semibold text-teal-800 underline" href={`/${locale}/recipes/${recipeId}/edit`}>{t(`${state}.edit`)}</Link>
          )}
          <Link className="font-semibold text-teal-800 underline" href={`/${locale}/recipes?status=${state === "archived" ? "archived" : "active"}&page=1`}>{t("back")}</Link>
        </div>
      </div>
    </section>
  );
}

function NotLoggable({
  date,
  locale,
  mealType,
  recipeId,
  recipeName,
  routePath,
  servings,
}: {
  date: string;
  locale: Locale;
  mealType: "breakfast" | "dinner" | "lunch" | "other" | "snack" | null;
  recipeId: string;
  recipeName: string;
  routePath: string;
  servings: string;
}) {
  const t = useTranslations("RecipeUse.states.not_loggable");
  return (
    <section className="flex flex-1 flex-col gap-8 py-8 text-start">
      <header className="max-w-3xl">
        <p className="text-sm font-semibold uppercase tracking-[0.16em] text-teal-700">{t("label")}</p>
        <h1 className="mt-4 break-words text-3xl font-semibold text-slate-950" dir="auto">{recipeName}</h1>
      </header>
      <div className="max-w-4xl border border-amber-300 bg-amber-50 p-5" data-testid="recipe-use-not-loggable">
        <h2 className="text-xl font-semibold text-slate-950">{t("title")}</h2>
        <p className="mt-3 text-sm leading-6 text-amber-950" role="alert">{t("body")}</p>
      </div>
      <RecipeUseContextForm action={routePath} date={date} mealType={mealType} servings={servings} />
      <div className="flex flex-wrap gap-4">
        <Link className="font-semibold text-teal-800 underline" href={`/${locale}/recipes/${recipeId}/edit`}>{t("edit")}</Link>
        <Link className="font-semibold text-teal-800 underline" href={`/${locale}/recipes`}>{t("back")}</Link>
      </div>
    </section>
  );
}

function LoadFailure({ locale, retryHref }: { locale: Locale; retryHref: string }) {
  const t = useTranslations("RecipeUse.states.failure");
  return (
    <section className="flex flex-1 flex-col justify-center py-8 text-start">
      <RetrievalError body={t("body")} retryHref={retryHref} retryLabel={t("retry")} testId="recipe-use-retrieval-error" title={t("title")} />
      <Link className="mt-4 text-sm font-semibold text-teal-800 underline" href={`/${locale}/recipes`}>{t("back")}</Link>
    </section>
  );
}
