import Link from "next/link";
import { useTranslations } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import {
  createDiaryEntryAction,
  deleteDiaryEntryAction,
} from "@/app/[locale]/(app)/today/actions";
import type { DiaryEntryActionState } from "@/app/[locale]/(app)/today/action-state";
import { DiaryDailyTotals } from "@/components/diary/diary-daily-totals";
import { DiaryEntryForm } from "@/components/diary/diary-entry-form";
import { DiaryEntryList } from "@/components/diary/diary-entry-list";
import { resolveAuthLocale } from "@/lib/auth/require-user";
import {
  isValidDiaryEntryDate,
  listCurrentDiaryEntriesForDate,
  type DiaryEntry,
} from "@/lib/diary-entries";
import { routing } from "@/lib/i18n/routing";
import {
  getCurrentEffectiveTarget,
  type NutritionTarget,
} from "@/lib/nutrition-targets";
import { getCurrentProfile } from "@/lib/profile";

type TodayPageProps = Readonly<{
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}>;

type DiaryEntriesState = {
  entries: DiaryEntry[];
  error: null | "database_error" | "unauthenticated" | "validation_error";
};

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

function getTodayDate() {
  return new Date().toISOString().slice(0, 10);
}

function getSearchParamValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function resolveSelectedDate(
  searchParams: Record<string, string | string[] | undefined>,
) {
  const date = getSearchParamValue(searchParams.date);

  return date && isValidDiaryEntryDate(date) ? date : getTodayDate();
}

async function getDiaryEntriesState(
  selectedDate: string,
): Promise<DiaryEntriesState> {
  const result = await listCurrentDiaryEntriesForDate(selectedDate);

  if (result.ok) {
    return { entries: result.data, error: null };
  }

  if (
    result.code === "database_error" ||
    result.code === "unauthenticated" ||
    result.code === "validation_error"
  ) {
    return { entries: [], error: result.code };
  }

  return { entries: [], error: "database_error" };
}

export default async function TodayPage({ params, searchParams }: TodayPageProps) {
  const { locale: localeInput } = await params;
  const resolvedSearchParams = await searchParams;
  const locale = resolveAuthLocale(localeInput);
  const selectedDate = resolveSelectedDate(resolvedSearchParams);
  const [profileResult, targetResult, diaryEntriesState] = await Promise.all([
    getCurrentProfile(),
    getCurrentEffectiveTarget(),
    getDiaryEntriesState(selectedDate),
  ]);
  const hasProfile = profileResult.ok && profileResult.data !== null;
  const target = targetResult.ok ? targetResult.data : null;

  setRequestLocale(locale);

  return (
    <LocalizedTodayPage
      hasProfile={hasProfile}
      diaryEntriesState={diaryEntriesState}
      locale={locale}
      selectedDate={selectedDate}
      target={target}
    />
  );
}

function LocalizedTodayPage({
  diaryEntriesState,
  hasProfile,
  locale,
  selectedDate,
  target,
}: {
  diaryEntriesState: DiaryEntriesState;
  hasProfile: boolean;
  locale: string;
  selectedDate: string;
  target: NutritionTarget | null;
}) {
  const t = useTranslations("AppShell.today");
  const diaryT = useTranslations("Diary");
  const createAction = createDiaryEntryAction.bind(null, locale);
  const deleteAction = deleteDiaryEntryAction.bind(null, locale);
  const initialDiaryEntryState: DiaryEntryActionState = {
    status: "idle",
    values: {
      entry_date: selectedDate,
      meal_type: "breakfast",
    },
  };
  const targetItems = [
    {
      label: t("targetSummary.calories"),
      value: formatTargetValue(target?.calories ?? null, t("targetSummary.notSet")),
    },
    {
      label: t("targetSummary.protein"),
      value: formatTargetValue(target?.protein_g ?? null, t("targetSummary.notSet")),
    },
    {
      label: t("targetSummary.carbohydrates"),
      value: formatTargetValue(
        target?.carbohydrates_g ?? null,
        t("targetSummary.notSet"),
      ),
    },
    {
      label: t("targetSummary.fat"),
      value: formatTargetValue(target?.fat_g ?? null, t("targetSummary.notSet")),
    },
  ];

  return (
    <section className="flex flex-1 flex-col justify-center gap-8 py-8 text-start">
      <div className="max-w-3xl">
        <p className="text-sm font-semibold uppercase tracking-[0.16em] text-teal-700">
          {t("label")}
        </p>
        <h1 className="mt-4 text-3xl font-semibold leading-tight text-slate-950 sm:text-5xl">
          {t("title")}
        </h1>
        <p className="mt-5 max-w-2xl text-base leading-7 text-slate-700 sm:text-lg">
          {t("description")}
        </p>
      </div>

      <div className="max-w-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <h2 className="text-lg font-semibold text-slate-950">
          {t("placeholderTitle")}
        </h2>
        <p className="mt-3 text-sm leading-6 text-slate-700">
          {t("placeholderBody")}
        </p>
      </div>

      {!hasProfile && (
        <div className="max-w-2xl border border-teal-200 bg-teal-50 p-5 shadow-sm sm:p-6">
          <h2 className="text-lg font-semibold text-slate-950">
            {t("setupCalloutTitle")}
          </h2>
          <p className="mt-3 text-sm leading-6 text-slate-700">
            {t("setupCalloutBody")}
          </p>
          <Link
            className="mt-5 inline-flex min-h-10 items-center bg-teal-700 px-4 text-sm font-semibold text-white transition-colors hover:bg-teal-800"
            href={`/${locale}/setup`}
          >
            {t("setupCalloutLink")}
          </Link>
        </div>
      )}

      {hasProfile && target === null && (
        <div className="max-w-2xl border border-amber-200 bg-amber-50 p-5 shadow-sm sm:p-6">
          <h2 className="text-lg font-semibold text-slate-950">
            {t("targetEmptyTitle")}
          </h2>
          <p className="mt-3 text-sm leading-6 text-slate-700">
            {t("targetEmptyBody")}
          </p>
          <Link
            className="mt-5 inline-flex min-h-10 items-center bg-teal-700 px-4 text-sm font-semibold text-white transition-colors hover:bg-teal-800"
            href={`/${locale}/setup`}
          >
            {t("targetEmptyLink")}
          </Link>
        </div>
      )}

      {hasProfile && target !== null && (
        <div className="max-w-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-950">
                {t("targetSummary.title")}
              </h2>
              <p className="mt-3 text-sm leading-6 text-slate-700">
                {t("targetSummary.body")}
              </p>
            </div>
            <Link
              className="inline-flex min-h-10 items-center justify-center border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-800 transition-colors hover:border-teal-700 hover:text-teal-800"
              href={`/${locale}/setup`}
            >
              {t("targetSummary.editLink")}
            </Link>
          </div>

          <dl className="mt-6 grid gap-3 sm:grid-cols-2">
            {targetItems.map((item) => (
              <div
                className="border border-slate-200 bg-stone-50 p-4"
                key={item.label}
              >
                <dt className="text-sm font-medium text-slate-600">
                  {item.label}
                </dt>
                <dd className="mt-2 text-2xl font-semibold text-slate-950">
                  {item.value}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      )}

      <div className="grid max-w-4xl gap-6">
        <div className="border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-950">
                {diaryT("list.title")}
              </h2>
              <p className="mt-3 text-sm leading-6 text-slate-700">
                {diaryT("list.description")}
              </p>
            </div>
            <form action={`/${locale}/today`} className="grid gap-2 text-sm">
              <label
                className="font-medium text-slate-900"
                htmlFor="diary-date"
              >
                {diaryT("fields.entryDate")}
              </label>
              <input
                className="min-h-10 border border-slate-300 bg-white px-3 text-base text-slate-950 outline-none transition-colors focus:border-teal-700"
                defaultValue={selectedDate}
                id="diary-date"
                name="date"
                type="date"
              />
              <button
                className="min-h-10 border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-800 transition-colors hover:border-teal-700 hover:text-teal-800"
                type="submit"
              >
                {diaryT("date.submit")}
              </button>
            </form>
          </div>

          <div className="mt-6">
            {diaryEntriesState.error ? (
              <div className="border border-red-200 bg-red-50 p-4 text-sm leading-6 text-red-800">
                {diaryT(`errors.${diaryEntriesState.error}`)}
              </div>
            ) : (
              <div className="grid gap-5">
                <DiaryDailyTotals
                  entries={diaryEntriesState.entries}
                  labels={{
                    calories: diaryT("totals.calories"),
                    carbohydrates: diaryT("totals.carbohydrates"),
                    description: diaryT("totals.description"),
                    fat: diaryT("totals.fat"),
                    protein: diaryT("totals.protein"),
                    title: diaryT("totals.title"),
                    unitGrams: diaryT("totals.unitGrams"),
                  }}
                />
                <DiaryEntryList
                  deleteAction={deleteAction}
                  emptyMessage={diaryT("list.empty")}
                  entries={diaryEntriesState.entries}
                  labels={{
                    brand: diaryT("list.brand"),
                    calories: diaryT("list.calories"),
                    delete: diaryT("list.delete"),
                    deleteError: diaryT("list.deleteError"),
                    deletePending: diaryT("list.deletePending"),
                    macros: diaryT("list.macros"),
                    meal: diaryT("list.meal"),
                    serving: diaryT("list.serving"),
                  }}
                  mealTypeLabels={{
                    breakfast: diaryT("mealTypes.breakfast"),
                    dinner: diaryT("mealTypes.dinner"),
                    lunch: diaryT("mealTypes.lunch"),
                    other: diaryT("mealTypes.other"),
                    snack: diaryT("mealTypes.snack"),
                  }}
                  notSetLabel={diaryT("list.notSet")}
                />
              </div>
            )}
          </div>
        </div>

        <div className="border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <h2 className="text-lg font-semibold text-slate-950">
            {diaryT("form.title")}
          </h2>
          <p className="mt-3 text-sm leading-6 text-slate-700">
            {diaryT("form.description")}
          </p>
          <div className="mt-6">
            <DiaryEntryForm
              action={createAction}
              fieldErrorMessages={{
                invalid_date: diaryT("errors.invalidDate"),
                invalid_input: diaryT("errors.validation"),
                invalid_integer: diaryT("errors.invalidInteger"),
                invalid_number: diaryT("errors.invalidNumber"),
                invalid_type: diaryT("errors.validation"),
                negative_value: diaryT("errors.negativeValue"),
                required: diaryT("errors.required"),
                too_long: diaryT("errors.tooLong"),
                unsupported_field: diaryT("errors.validation"),
                unsupported_meal_type: diaryT("errors.unsupportedMealType"),
              }}
              initialState={initialDiaryEntryState}
              labels={{
                brand_name: diaryT("fields.brandName"),
                calories: diaryT("fields.calories"),
                carbohydrates_g: diaryT("fields.carbohydrates"),
                entry_date: diaryT("fields.entryDate"),
                fat_g: diaryT("fields.fat"),
                food_name: diaryT("fields.foodName"),
                meal_type: diaryT("fields.mealType"),
                notes: diaryT("fields.notes"),
                protein_g: diaryT("fields.protein"),
                serving_quantity: diaryT("fields.servingQuantity"),
                serving_unit: diaryT("fields.servingUnit"),
              }}
              mealTypeOptions={[
                {
                  label: diaryT("mealTypes.breakfast"),
                  value: "breakfast",
                },
                { label: diaryT("mealTypes.lunch"), value: "lunch" },
                { label: diaryT("mealTypes.dinner"), value: "dinner" },
                { label: diaryT("mealTypes.snack"), value: "snack" },
                { label: diaryT("mealTypes.other"), value: "other" },
              ]}
              pendingLabel={diaryT("form.pending")}
              statusMessages={{
                database_error: diaryT("errors.database_error"),
                idle: diaryT("status.idle"),
                not_found: diaryT("errors.database_error"),
                success: diaryT("status.success"),
                unauthenticated: diaryT("errors.unauthenticated"),
                validation_error: diaryT("errors.validation"),
              }}
              submitLabel={diaryT("form.submit")}
            />
          </div>
        </div>
      </div>
    </section>
  );
}

function formatTargetValue(value: null | number | string, notSetLabel: string) {
  return value === null ? notSetLabel : String(value);
}
