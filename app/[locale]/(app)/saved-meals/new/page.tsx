import { randomUUID } from "node:crypto";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { redirect } from "next/navigation";
import {
  diarySourceSavedMealFormValues,
  newSavedMealFormValues,
  type SavedMealActionState,
  type SavedMealFoodLinkBinding,
} from "@/app/[locale]/(app)/saved-meals/action-state";
import { saveSavedMealAction } from "@/app/[locale]/(app)/saved-meals/actions";
import { SavedMealForm } from "@/components/saved-meals/saved-meal-form";
import {
  SavedMealEditorPageHeader,
  SavedMealRetrievalError,
} from "@/components/saved-meals/saved-meal-page";
import { resolveAuthLocale, signInPath } from "@/lib/auth/require-user";
import {
  getSavedMealDiarySource,
  parseSavedMealSourceQuery,
  savedMealRowKey,
} from "@/lib/saved-meals";
import type { Locale } from "@/lib/i18n/routing";

type NewSavedMealPageProps = Readonly<{
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}>;

export default async function NewSavedMealPage({
  params,
  searchParams,
}: NewSavedMealPageProps) {
  const { locale: localeInput } = await params;
  const resolvedSearchParams = await searchParams;
  const locale = resolveAuthLocale(localeInput);
  const sourceQuery = parseSavedMealSourceQuery(resolvedSearchParams);

  setRequestLocale(locale);

  if (sourceQuery.type === "invalid") {
    return <InvalidSourceContext locale={locale} />;
  }

  if (sourceQuery.type === "blank") {
    const rowKey = savedMealRowKey("client", randomUUID());
    const initialState: SavedMealActionState = {
      status: "idle",
      values: newSavedMealFormValues(locale, rowKey),
    };
    const action = saveSavedMealAction.bind(null, locale, null, []);

    return (
      <SavedMealEditorPageHeader mode="create" source="blank">
        <SavedMealForm
          action={action}
          archived={false}
          initialState={initialState}
          linkedRowKeys={[]}
          locale={locale}
          mode="create"
          saved={null}
        />
      </SavedMealEditorPageHeader>
    );
  }

  const source = await getSavedMealDiarySource(
    sourceQuery.date,
    sourceQuery.meal_type,
  );

  if (!source.ok) {
    if (source.code === "unauthenticated") redirect(signInPath(locale));

    return (
      <SavedMealRetrievalError
        locale={locale}
        retryHref={`/${locale}/saved-meals/new?date=${sourceQuery.date}&mealType=${sourceQuery.meal_type}`}
      />
    );
  }

  if (source.data.length === 0 || source.data.length > 50) {
    return (
      <EmptyDiarySource
        date={sourceQuery.date}
        locale={locale}
        tooMany={source.data.length > 50}
      />
    );
  }

  const bindings: SavedMealFoodLinkBinding[] = source.data.map((item) => ({
    food_id: item.food_id,
    row_key: savedMealRowKey("diary", item.diary_entry_id),
  }));
  const action = saveSavedMealAction.bind(null, locale, null, bindings);
  const initialState: SavedMealActionState = {
    status: "idle",
    values: diarySourceSavedMealFormValues(locale, source.data),
  };

  return (
    <SavedMealEditorPageHeader mode="create" source="diary">
      <SavedMealForm
        action={action}
        archived={false}
        initialState={initialState}
        linkedRowKeys={bindings
          .filter((binding) => binding.food_id !== null)
          .map((binding) => binding.row_key)}
        locale={locale}
        mode="create"
        saved={null}
      />
    </SavedMealEditorPageHeader>
  );
}

function InvalidSourceContext({ locale }: { locale: Locale }) {
  const t = useTranslations("SavedMealEditor.source");

  return (
    <section className="flex flex-1 flex-col justify-center py-8 text-start">
      <div className="max-w-3xl border border-amber-300 bg-amber-50 p-5" data-testid="saved-meal-source-invalid">
        <h1 className="text-2xl font-semibold text-slate-950">{t("invalidTitle")}</h1>
        <p className="mt-3 text-sm leading-6 text-amber-950" role="alert">{t("invalidBody")}</p>
        <Link className="mt-4 inline-flex text-sm font-semibold text-teal-800 underline" href={`/${locale}/saved-meals/new`}>
          {t("blank")}
        </Link>
      </div>
    </section>
  );
}

function EmptyDiarySource({
  date,
  locale,
  tooMany,
}: {
  date: string;
  locale: Locale;
  tooMany: boolean;
}) {
  const t = useTranslations("SavedMealEditor.source");

  return (
    <section className="flex flex-1 flex-col justify-center py-8 text-start">
      <div className="max-w-3xl border border-slate-200 bg-white p-5" data-testid="saved-meal-source-empty">
        <h1 className="text-2xl font-semibold text-slate-950">
          {t(tooMany ? "tooManyTitle" : "emptyTitle")}
        </h1>
        <p className="mt-3 text-sm leading-6 text-slate-700">
          {t(tooMany ? "tooManyBody" : "emptyBody")}
        </p>
        <div className="mt-4 flex flex-wrap gap-4">
          <Link className="text-sm font-semibold text-teal-800 underline" href={`/${locale}/today?date=${date}`}>
            {t("today")}
          </Link>
          <Link className="text-sm font-semibold text-teal-800 underline" href={`/${locale}/saved-meals/new`}>
            {t("blank")}
          </Link>
        </div>
      </div>
    </section>
  );
}
