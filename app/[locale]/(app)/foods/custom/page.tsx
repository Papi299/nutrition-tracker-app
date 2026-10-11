import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { buttonStyles } from "@/components/ui/button";
import { surfaceStyles } from "@/components/ui/card";
import { feedbackStyles } from "@/components/ui/feedback";
import { useTranslations } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { redirect } from "next/navigation";
import { setCustomFoodArchiveAction } from "./management-actions";
import { CustomFoodArchiveControl } from "@/components/custom-foods/custom-food-archive-control";
import { RetrievalError } from "@/components/data/retrieval-error";
import { resolveAuthLocale, signInPath } from "@/lib/auth/require-user";
import { formatLocalizedDate } from "@/lib/i18n/format";
import {
  listOwnedCustomFoods,
  parseCustomFoodManagementQuery,
  type ManagedCustomFood,
  type ManagedCustomFoodPage,
  type CustomFoodManagementStatus,
} from "@/lib/custom-foods";
import type { Locale } from "@/lib/i18n/routing";

type CustomFoodManagementPageProps = Readonly<{
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}>;

export default async function CustomFoodManagementPage({
  params,
  searchParams,
}: CustomFoodManagementPageProps) {
  const { locale: localeInput } = await params;
  const resolvedSearchParams = await searchParams;
  const locale = resolveAuthLocale(localeInput);

  setRequestLocale(locale);

  const query = parseCustomFoodManagementQuery(resolvedSearchParams);

  if (query.type === "invalid") {
    return <InvalidManagementQuery locale={locale} />;
  }

  const result = await listOwnedCustomFoods(query.status, query.page);

  if (!result.ok) {
    if (result.code === "unauthenticated") {
      redirect(signInPath(locale));
    }

    return <ManagementRetrievalError locale={locale} />;
  }

  const savedValue = resolvedSearchParams.saved;
  const saved =
    savedValue === "archived" || savedValue === "restored" ? savedValue : null;

  return <LocalizedManagementPage locale={locale} page={result.data} saved={saved} />;
}

function ManagementHeader({ locale }: { locale: Locale }) {
  const t = useTranslations("CustomFoodManagement");

  return (
    <header className="min-w-0 max-w-3xl">
      <p className="ui-eyebrow">
        {t("label")}
      </p>
      <h1 className="ui-page-title mt-1">
        {t("title")}
      </h1>
      <p className="ui-body-secondary mt-2 max-w-2xl">
        {t("description")}
      </p>
      <div className="mt-4 flex min-w-0 flex-wrap gap-2">
        <Link
          className={buttonStyles()}
          href={`/${locale}/foods/custom/new`}
        >
          {t("create")}
        </Link>
        <Link
          className={buttonStyles({ variant: "outline", className: "border-primary text-primary hover:bg-primary-surface" })}
          href={`/${locale}/foods`}
        >
          {t("foodSearch")}
        </Link>
      </div>
    </header>
  );
}

function LocalizedManagementPage({
  locale,
  page,
  saved,
}: {
  locale: Locale;
  page: ManagedCustomFoodPage;
  saved: "archived" | "restored" | null;
}) {
  const t = useTranslations("CustomFoodManagement");

  return (
    <section className="flex min-w-0 flex-1 flex-col gap-6 py-4 text-start sm:py-6">
      <ManagementHeader locale={locale} />

      {saved && (
        <div
          className={feedbackStyles("success")}
          data-testid="custom-food-management-success"
          role="status"
        >
          {saved === "archived" ? t("success.archived") : t("success.restored")}
        </div>
      )}

      <nav aria-label={t("filters.label")} className="flex min-w-0 max-w-full flex-wrap gap-1 self-start rounded-xl border border-border bg-surface-subtle p-1">
        {(["active", "archived"] as const).map((status) => (
          <Link
            aria-current={page.status === status ? "page" : undefined}
            className={buttonStyles({
              variant: "ghost",
              className: page.status === status ? "ui-current" : "",
            })}
            href={`/${locale}/foods/custom?status=${status}&page=1`}
            key={status}
          >
            {t(`filters.${status}`)}
          </Link>
        ))}
      </nav>

      <p className="ui-body-secondary">
        {t("count", { count: page.total_count })}
      </p>

      {page.foods.length === 0 ? (
        <ManagementEmptyState locale={locale} status={page.status} />
      ) : (
        <ul className="grid min-w-0 grid-cols-1 gap-4" data-testid="custom-food-management-list">
          {page.foods.map((food) => (
            <ManagedFoodCard food={food} key={food.food_id} locale={locale} />
          ))}
        </ul>
      )}

      <ManagementPagination locale={locale} page={page} />
    </section>
  );
}

function ManagedFoodCard({
  food,
  locale,
}: {
  food: ManagedCustomFood;
  locale: Locale;
}) {
  const t = useTranslations("CustomFoodManagement");
  const action = setCustomFoodArchiveAction.bind(
    null,
    locale,
    food.food_id,
    !food.is_archived,
  );
  const updatedDate = formatLocalizedDate(locale, food.updated_at);

  return (
    <li
      className={surfaceStyles({ className: "grid min-w-0 gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,12rem)] sm:items-start" })}
      data-food-id={food.food_id}
    >
      <div className="min-w-0">
        <h2 className="ui-card-title [overflow-wrap:anywhere]" dir="auto">
          <bdi>{food.name}</bdi>
        </h2>
        {food.brand_name && (
          <p className="ui-body-secondary mt-1 [overflow-wrap:anywhere]" dir="auto">
            <bdi>{food.brand_name}</bdi>
          </p>
        )}
        <dl className="mt-4 grid min-w-0 grid-cols-1 gap-x-5 gap-y-3 text-sm sm:grid-cols-2">
          <CardDetail label={t("card.language")} value={t(`languages.${food.locale}`)} />
          <CardDetail label={t("card.basis")} value={t(`basis.${food.nutrient_basis}`)} />
          <CardDetail
            label={t("card.serving")}
            value={`${food.serving_quantity} ${food.serving_unit}`}
          />
          <CardDetail
            badge={food.is_archived ? "neutral" : "success"}
            label={t("card.status")}
            value={t(food.is_archived ? "filters.archived" : "filters.active")}
          />
          <CardDetail label={t("card.updated")} value={updatedDate} />
        </dl>
      </div>
      <div className="grid min-w-0 gap-2">
        <Link
          className={buttonStyles({ className: "w-full" })}
          href={`/${locale}/foods/custom/${food.food_id}/edit`}
        >
          {t("card.edit")}
        </Link>
        <CustomFoodArchiveControl
          action={action}
          archived={food.is_archived}
          foodName={food.name}
        />
      </div>
    </li>
  );
}

function CardDetail({
  badge,
  label,
  value,
}: {
  badge?: "neutral" | "success";
  label: string;
  value: string;
}) {
  return (
    <div className="min-w-0">
      <dt className="ui-caption font-medium">{label}</dt>
      <dd className="mt-1 text-sm text-foreground [overflow-wrap:anywhere]" dir="auto">
        {badge ? <Badge variant={badge}><bdi>{value}</bdi></Badge> : <bdi>{value}</bdi>}
      </dd>
    </div>
  );
}

function ManagementEmptyState({
  locale,
  status,
}: {
  locale: Locale;
  status: CustomFoodManagementStatus;
}) {
  const t = useTranslations("CustomFoodManagement.empty");

  return (
    <section
      className={surfaceStyles({ className: "min-w-0" })}
      data-testid={`custom-food-management-empty-${status}`}
    >
      <h2 className="ui-section-title">
        {t(`${status}.title`)}
      </h2>
      <p className="ui-body-secondary mt-2">
        {t(`${status}.body`)}
      </p>
      {status === "active" && (
        <Link
          className={buttonStyles({ className: "mt-4" })}
          href={`/${locale}/foods/custom/new`}
        >
          {t("active.create")}
        </Link>
      )}
    </section>
  );
}

function ManagementPagination({
  locale,
  page,
}: {
  locale: Locale;
  page: ManagedCustomFoodPage;
}) {
  const t = useTranslations("CustomFoodManagement.pagination");

  return (
    <nav aria-label={t("label")} className="flex min-w-0 flex-wrap items-center gap-3">
      {page.has_previous ? (
        <Link
          className={buttonStyles({ variant: "outline" })}
          href={`/${locale}/foods/custom?status=${page.status}&page=${page.page - 1}`}
          rel="prev"
        >
          {t("previous")}
        </Link>
      ) : (
        <span aria-disabled="true" className={buttonStyles({ variant: "outline", className: "cursor-default border-border bg-surface-subtle text-muted-foreground" })}>
          {t("previous")}
        </span>
      )}
      <span className="ui-body-secondary">{t("current", { page: page.page })}</span>
      {page.has_next ? (
        <Link
          className={buttonStyles({ variant: "outline" })}
          href={`/${locale}/foods/custom?status=${page.status}&page=${page.page + 1}`}
          rel="next"
        >
          {t("next")}
        </Link>
      ) : (
        <span aria-disabled="true" className={buttonStyles({ variant: "outline", className: "cursor-default border-border bg-surface-subtle text-muted-foreground" })}>
          {t("next")}
        </span>
      )}
    </nav>
  );
}

function InvalidManagementQuery({ locale }: { locale: Locale }) {
  const t = useTranslations("CustomFoodManagement.invalid");

  return (
    <section className="flex min-w-0 flex-1 flex-col gap-6 py-4 text-start sm:py-6">
      <ManagementHeader locale={locale} />
      <section
        className={surfaceStyles({ className: "min-w-0 border-warning/30 bg-warning-surface" })}
        data-testid="custom-food-management-invalid-query"
      >
        <h2 className="ui-section-title">{t("title")}</h2>
        <p className="mt-2 text-sm leading-6 text-warning-foreground" role="alert">
          {t("body")}
        </p>
        <Link
          className={buttonStyles({ className: "mt-4" })}
          href={`/${locale}/foods/custom?status=active&page=1`}
        >
          {t("recover")}
        </Link>
      </section>
    </section>
  );
}

function ManagementRetrievalError({ locale }: { locale: Locale }) {
  const t = useTranslations("CustomFoodManagement.retrieval");

  return (
    <section className="flex min-w-0 flex-1 flex-col gap-6 py-4 text-start sm:py-6">
      <ManagementHeader locale={locale} />
      <RetrievalError
        body={t("body")}
        retryHref={`/${locale}/foods/custom?status=active&page=1`}
        retryLabel={t("retry")}
        testId="custom-food-management-retrieval-error"
        title={t("title")}
      />
    </section>
  );
}
