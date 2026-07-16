import Link from "next/link";
import { useTranslations } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { redirect } from "next/navigation";
import { setCustomFoodArchiveAction } from "./management-actions";
import { CustomFoodArchiveControl } from "@/components/custom-foods/custom-food-archive-control";
import { RetrievalError } from "@/components/data/retrieval-error";
import { resolveAuthLocale, signInPath } from "@/lib/auth/require-user";
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
          className="inline-flex min-h-11 items-center bg-teal-700 px-4 text-sm font-semibold text-white transition-colors hover:bg-teal-800"
          href={`/${locale}/foods/custom/new`}
        >
          {t("create")}
        </Link>
        <Link
          className="inline-flex min-h-11 items-center border border-teal-700 bg-white px-4 text-sm font-semibold text-teal-800 transition-colors hover:bg-teal-50"
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
    <section className="flex flex-1 flex-col gap-8 py-8 text-start">
      <ManagementHeader locale={locale} />

      {saved && (
        <div
          className="border-s-4 border-teal-600 bg-teal-50 px-4 py-3 text-sm text-teal-900"
          data-testid="custom-food-management-success"
          role="status"
        >
          {saved === "archived" ? t("success.archived") : t("success.restored")}
        </div>
      )}

      <nav aria-label={t("filters.label")} className="flex flex-wrap gap-3">
        {(["active", "archived"] as const).map((status) => (
          <Link
            aria-current={page.status === status ? "page" : undefined}
            className={
              page.status === status
                ? "min-h-11 bg-teal-700 px-4 py-3 text-sm font-semibold text-white"
                : "min-h-11 border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-800"
            }
            href={`/${locale}/foods/custom?status=${status}&page=1`}
            key={status}
          >
            {t(`filters.${status}`)}
          </Link>
        ))}
      </nav>

      <p className="text-sm text-slate-600">
        {t("count", { count: page.total_count })}
      </p>

      {page.foods.length === 0 ? (
        <ManagementEmptyState locale={locale} status={page.status} />
      ) : (
        <ul className="grid gap-5" data-testid="custom-food-management-list">
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
  const updatedDate = new Intl.DateTimeFormat(locale === "he" ? "he-IL" : "en-US", {
    dateStyle: "medium",
    timeZone: "UTC",
  }).format(new Date(food.updated_at));

  return (
    <li
      className="grid gap-5 border border-slate-200 bg-white p-5 shadow-sm sm:grid-cols-[1fr_auto] sm:items-start sm:p-6"
      data-food-id={food.food_id}
    >
      <div className="min-w-0">
        <h2 className="break-words text-xl font-semibold text-slate-950" dir="auto">
          {food.name}
        </h2>
        {food.brand_name && (
          <p className="mt-2 break-words text-sm text-slate-700" dir="auto">
            {food.brand_name}
          </p>
        )}
        <dl className="mt-4 grid gap-x-5 gap-y-3 text-sm sm:grid-cols-2">
          <CardDetail label={t("card.language")} value={t(`languages.${food.locale}`)} />
          <CardDetail label={t("card.basis")} value={t(`basis.${food.nutrient_basis}`)} />
          <CardDetail
            label={t("card.serving")}
            value={`${food.serving_quantity} ${food.serving_unit}`}
          />
          <CardDetail
            label={t("card.status")}
            value={t(food.is_archived ? "filters.archived" : "filters.active")}
          />
          <CardDetail label={t("card.updated")} value={updatedDate} />
        </dl>
      </div>
      <div className="grid gap-3 sm:min-w-40">
        <Link
          className="inline-flex min-h-11 items-center justify-center bg-teal-700 px-4 text-sm font-semibold text-white transition-colors hover:bg-teal-800"
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

function CardDetail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="font-medium text-slate-600">{label}</dt>
      <dd className="mt-1 break-words text-slate-950" dir="auto">
        {value}
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
      className="border border-slate-200 bg-white p-5 shadow-sm sm:p-6"
      data-testid={`custom-food-management-empty-${status}`}
    >
      <h2 className="text-xl font-semibold text-slate-950">
        {t(`${status}.title`)}
      </h2>
      <p className="mt-3 text-sm leading-6 text-slate-700">
        {t(`${status}.body`)}
      </p>
      {status === "active" && (
        <Link
          className="mt-4 inline-flex min-h-11 items-center bg-teal-700 px-4 text-sm font-semibold text-white"
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
    <nav aria-label={t("label")} className="flex flex-wrap items-center gap-4">
      {page.has_previous ? (
        <Link
          className="inline-flex min-h-11 items-center border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-800"
          href={`/${locale}/foods/custom?status=${page.status}&page=${page.page - 1}`}
          rel="prev"
        >
          {t("previous")}
        </Link>
      ) : (
        <span className="min-h-11 border border-slate-200 bg-slate-100 px-4 py-3 text-sm text-slate-500">
          {t("previous")}
        </span>
      )}
      <span className="text-sm text-slate-700">{t("current", { page: page.page })}</span>
      {page.has_next ? (
        <Link
          className="inline-flex min-h-11 items-center border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-800"
          href={`/${locale}/foods/custom?status=${page.status}&page=${page.page + 1}`}
          rel="next"
        >
          {t("next")}
        </Link>
      ) : (
        <span className="min-h-11 border border-slate-200 bg-slate-100 px-4 py-3 text-sm text-slate-500">
          {t("next")}
        </span>
      )}
    </nav>
  );
}

function InvalidManagementQuery({ locale }: { locale: Locale }) {
  const t = useTranslations("CustomFoodManagement.invalid");

  return (
    <section className="flex flex-1 flex-col gap-8 py-8 text-start">
      <ManagementHeader locale={locale} />
      <section
        className="border border-amber-200 bg-amber-50 p-5 shadow-sm sm:p-6"
        data-testid="custom-food-management-invalid-query"
      >
        <h2 className="text-xl font-semibold text-slate-950">{t("title")}</h2>
        <p className="mt-3 text-sm leading-6 text-amber-950" role="alert">
          {t("body")}
        </p>
        <Link
          className="mt-4 inline-flex min-h-11 items-center bg-teal-700 px-4 text-sm font-semibold text-white"
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
    <section className="flex flex-1 flex-col gap-8 py-8 text-start">
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
