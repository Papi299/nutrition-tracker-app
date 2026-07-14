import Link from "next/link";
import { useTranslations } from "next-intl";
import { redirect } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import {
  createDiaryEntryAction,
  deleteDiaryEntryAction,
  updateDiaryEntryAction,
} from "@/app/[locale]/(app)/today/actions";
import type { DiaryEntryActionState } from "@/app/[locale]/(app)/today/action-state";
import { BrowserDateBootstrap } from "@/components/calendar-date/browser-date-bootstrap";
import { CalendarDateError } from "@/components/calendar-date/calendar-date-error";
import { RetrievalError } from "@/components/data/retrieval-error";
import { DiaryDailyTotals } from "@/components/diary/diary-daily-totals";
import { DiaryEntryForm } from "@/components/diary/diary-entry-form";
import { DiaryEntryList } from "@/components/diary/diary-entry-list";
import { DiaryTargetProgress } from "@/components/diary/diary-target-progress";
import { resolveAuthLocale, signInPath } from "@/lib/auth/require-user";
import {
  parseCalendarDateQueryValue,
  type CalendarDateQueryResult,
} from "@/lib/calendar-date";
import {
  listCurrentDiaryEntriesForDate,
  type DiaryEntry,
} from "@/lib/diary-entries";
import {
  isRetrievalFailure,
  resolveNullableRetrieval,
  resolveRetrieval,
  type RetrievalState,
} from "@/lib/data/retrieval-state";
import {
  getReadableFoodDiaryPrefill,
  type FoodDiaryPrefillState,
} from "@/lib/food-selection";
import { routing } from "@/lib/i18n/routing";
import {
  getEffectiveTargetForDate,
  type NutritionTarget,
} from "@/lib/nutrition-targets";
import { getCurrentProfile, type Profile } from "@/lib/profile";

type TodayPageProps = Readonly<{
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}>;

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export default async function TodayPage({ params, searchParams }: TodayPageProps) {
  const { locale: localeInput } = await params;
  const resolvedSearchParams = await searchParams;
  const locale = resolveAuthLocale(localeInput);
  const dateQuery = parseCalendarDateQueryValue(resolvedSearchParams.date);

  setRequestLocale(locale);

  if (dateQuery.status === "missing") {
    return <LocalizedTodayDateBootstrap locale={locale} />;
  }

  if (dateQuery.status === "invalid" || dateQuery.status === "repeated") {
    return <LocalizedTodayDateError dateQuery={dateQuery} locale={locale} />;
  }

  const selectedDate = dateQuery.date;
  const [profileResult, targetResult, diaryResult, foodSelectionState] =
    await Promise.all([
      getCurrentProfile(),
      getEffectiveTargetForDate(selectedDate),
      listCurrentDiaryEntriesForDate(selectedDate),
      getReadableFoodDiaryPrefill(resolvedSearchParams.foodId),
    ]);
  const profileState = resolveNullableRetrieval(profileResult);
  const targetState = resolveNullableRetrieval(targetResult);
  const diaryState = resolveRetrieval(diaryResult);

  if (
    profileState.status === "unauthenticated" ||
    targetState.status === "unauthenticated" ||
    diaryState.status === "unauthenticated" ||
    foodSelectionState.status === "unauthenticated"
  ) {
    redirect(signInPath(locale));
  }

  return (
    <LocalizedTodayPage
      diaryState={diaryState}
      foodSelectionState={foodSelectionState}
      locale={locale}
      profileState={profileState}
      selectedDate={selectedDate}
      targetState={targetState}
    />
  );
}

function LocalizedTodayDateBootstrap({ locale }: { locale: string }) {
  const dateT = useTranslations("CalendarDate");
  const routePath = `/${locale}/today`;

  return (
    <section className="flex flex-1 flex-col justify-center py-8 text-start">
      <BrowserDateBootstrap
        formDescription={dateT("manual.description")}
        formLabel={dateT("manual.label")}
        formSubmitLabel={dateT("manual.submit")}
        inputId="today-bootstrap-date"
        queryName="date"
        routePath={routePath}
        status={dateT("bootstrap.status")}
        title={dateT("bootstrap.todayTitle")}
      />
    </section>
  );
}

function LocalizedTodayDateError({
  dateQuery,
  locale,
}: {
  dateQuery: Extract<
    CalendarDateQueryResult,
    { status: "invalid" } | { status: "repeated" }
  >;
  locale: string;
}) {
  const dateT = useTranslations("CalendarDate");
  const description =
    dateQuery.status === "repeated"
      ? dateT("errors.repeated")
      : dateQuery.reason === "unsupported_format"
        ? dateT("errors.unsupported")
        : dateT("errors.invalid");

  return (
    <section className="flex flex-1 flex-col justify-center py-8 text-start">
      <CalendarDateError
        description={description}
        formDescription={dateT("recovery.description")}
        formLabel={dateT("manual.label")}
        formSubmitLabel={dateT("manual.submit")}
        inputId="today-recovery-date"
        queryName="date"
        routePath={`/${locale}/today`}
        title={dateT("errors.title")}
      />
    </section>
  );
}

function LocalizedTodayPage({
  diaryState,
  foodSelectionState,
  locale,
  profileState,
  selectedDate,
  targetState,
}: {
  diaryState: RetrievalState<DiaryEntry[]>;
  foodSelectionState: Exclude<
    FoodDiaryPrefillState,
    { status: "unauthenticated" }
  >;
  locale: string;
  profileState: RetrievalState<Profile>;
  selectedDate: string;
  targetState: RetrievalState<NutritionTarget>;
}) {
  const t = useTranslations("AppShell.today");
  const diaryT = useTranslations("Diary");
  const createAction = createDiaryEntryAction.bind(null, locale);
  const deleteAction = deleteDiaryEntryAction.bind(null, locale);
  const updateAction = updateDiaryEntryAction.bind(null, locale);
  const initialDiaryEntryState: DiaryEntryActionState = {
    status: "idle",
    values: {
      entry_date: selectedDate,
      meal_type: "breakfast",
      ...(foodSelectionState.status === "ready"
        ? diaryValuesFromPrefill(foodSelectionState.data)
        : {}),
    },
  };
  const target = targetState.status === "ready" ? targetState.data : null;
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

      {isRetrievalFailure(profileState) && (
        <div className="max-w-3xl">
          <RetrievalError
            body={t("profileRetrievalError.body")}
            retryHref={`/${locale}/today?date=${selectedDate}`}
            retryLabel={t("profileRetrievalError.retry")}
            testId="profile-retrieval-error"
            title={t("profileRetrievalError.title")}
          />
        </div>
      )}

      {profileState.status === "missing" && (
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

      {isRetrievalFailure(targetState) && (
        <div className="max-w-3xl">
          <RetrievalError
            body={t("targetRetrievalError.body")}
            retryHref={`/${locale}/today?date=${selectedDate}`}
            retryLabel={t("targetRetrievalError.retry")}
            testId="target-retrieval-error"
            title={t("targetRetrievalError.title")}
          />
        </div>
      )}

      {profileState.status === "ready" && targetState.status === "missing" && (
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

      {targetState.status === "ready" && (
        <div
          className="max-w-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6"
          data-testid="target-summary"
        >
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-950">
                {t("targetSummary.title")}
              </h2>
              <p className="mt-3 text-sm leading-6 text-slate-700">
                {t("targetSummary.body", { date: selectedDate })}
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
            {diaryState.status !== "ready" ? (
              <div className="border border-red-200 bg-red-50 p-4 text-sm leading-6 text-red-800">
                {diaryT(`errors.${retrievalErrorKey(diaryState)}`)}
              </div>
            ) : (
              <div className="grid gap-5">
                <DiaryDailyTotals
                  entries={diaryState.data}
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
                {!isRetrievalFailure(targetState) && (
                  <DiaryTargetProgress
                    entries={diaryState.data}
                    labels={{
                      body: diaryT("targetProgress.body", {
                        date: selectedDate,
                      }),
                      consumed: diaryT("targetProgress.consumed"),
                      emptyBody: diaryT("targetProgress.emptyBody"),
                      emptyLink: diaryT("targetProgress.emptyLink"),
                      emptyTitle: diaryT("targetProgress.emptyTitle"),
                      metrics: {
                        calories: diaryT("targetProgress.metrics.calories"),
                        carbohydrates_g: diaryT(
                          "targetProgress.metrics.carbohydrates",
                        ),
                        fat_g: diaryT("targetProgress.metrics.fat"),
                        protein_g: diaryT("targetProgress.metrics.protein"),
                      },
                      notSet: diaryT("targetProgress.notSet"),
                      overTarget: diaryT("targetProgress.overTarget"),
                      percentComplete: diaryT(
                        "targetProgress.percentComplete",
                      ),
                      remaining: diaryT("targetProgress.remaining"),
                      target: diaryT("targetProgress.target"),
                      title: diaryT("targetProgress.title"),
                      unitGrams: diaryT("targetProgress.unitGrams"),
                    }}
                    setupHref={`/${locale}/setup`}
                    target={target}
                  />
                )}
                <DiaryEntryList
                  deleteAction={deleteAction}
                  emptyMessage={diaryT("list.empty")}
                  entries={diaryState.data}
                  fieldErrorMessages={{
                    empty_update: diaryT("errors.validation"),
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
                  labels={{
                    brand: diaryT("list.brand"),
                    calories: diaryT("list.calories"),
                    cancel: diaryT("list.cancel"),
                    delete: diaryT("list.delete"),
                    deleteError: diaryT("list.deleteError"),
                    deletePending: diaryT("list.deletePending"),
                    edit: diaryT("list.edit"),
                    editTitle: diaryT("list.editTitle"),
                    fields: {
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
                    },
                    macros: diaryT("list.macros"),
                    meal: diaryT("list.meal"),
                    save: diaryT("list.save"),
                    saveError: diaryT("list.saveError"),
                    saveIdle: diaryT("list.saveIdle"),
                    savePending: diaryT("list.savePending"),
                    saveSuccess: diaryT("list.saveSuccess"),
                    serving: diaryT("list.serving"),
                  }}
                  mealTypeLabels={{
                    breakfast: diaryT("mealTypes.breakfast"),
                    dinner: diaryT("mealTypes.dinner"),
                    lunch: diaryT("mealTypes.lunch"),
                    other: diaryT("mealTypes.other"),
                    snack: diaryT("mealTypes.snack"),
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
                  notSetLabel={diaryT("list.notSet")}
                  updateAction={updateAction}
                />
              </div>
            )}
          </div>
        </div>

        <div className="border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-950">
                {diaryT("form.title")}
              </h2>
              <p className="mt-3 text-sm leading-6 text-slate-700">
                {diaryT("form.description")}
              </p>
            </div>
            <Link
              className="inline-flex min-h-10 items-center justify-center border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-800 transition-colors hover:border-teal-700 hover:text-teal-800"
              href={`/${locale}/foods?date=${selectedDate}`}
            >
              {diaryT("selection.findFood")}
            </Link>
          </div>

          {(foodSelectionState.status === "invalid" ||
            foodSelectionState.status === "repeated") && (
            <FoodSelectionMessage
              body={
                foodSelectionState.status === "repeated"
                  ? diaryT("selection.invalidRepeated")
                  : diaryT("selection.invalid")
              }
              testId="food-selection-invalid"
              title={diaryT("selection.invalidTitle")}
            />
          )}

          {foodSelectionState.status === "unavailable" && (
            <FoodSelectionMessage
              body={diaryT("selection.unavailableBody")}
              testId="food-selection-unavailable"
              title={diaryT("selection.unavailableTitle")}
            />
          )}

          {foodSelectionState.status === "database_error" && (
            <FoodSelectionMessage
              alert
              body={diaryT("selection.failureBody")}
              testId="food-selection-error"
              title={diaryT("selection.failureTitle")}
            />
          )}

          {foodSelectionState.status === "ready" && (
            <section
              aria-labelledby="selected-food-title"
              className="mt-6 border border-teal-200 bg-teal-50 p-4"
              data-testid="selected-food-summary"
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h3
                    className="text-base font-semibold text-slate-950"
                    dir="auto"
                    id="selected-food-title"
                  >
                    {diaryT("selection.selectedTitle", {
                      name: foodSelectionState.data.name,
                    })}
                  </h3>
                  {foodSelectionState.data.brand_name && (
                    <p className="mt-1 text-sm text-slate-700" dir="auto">
                      {diaryT("selection.brand", {
                        brand: foodSelectionState.data.brand_name,
                      })}
                    </p>
                  )}
                </div>
                <Link
                  className="text-sm font-semibold text-teal-800 underline underline-offset-4"
                  href={`/${locale}/today?date=${selectedDate}`}
                >
                  {diaryT("selection.remove")}
                </Link>
              </div>
              <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-3">
                <Metadata
                  label={diaryT("selection.visibilityLabel")}
                  value={
                    foodSelectionState.data.is_owned
                      ? diaryT("selection.visibilityOwn")
                      : diaryT("selection.visibilityPublic")
                  }
                />
                <Metadata
                  label={diaryT("selection.basisLabel")}
                  value={diaryT(
                    `selection.bases.${foodSelectionState.data.nutrient_basis ?? "none"}`,
                  )}
                />
                <Metadata
                  label={diaryT("selection.sourceLabel")}
                  value={
                    foodSelectionState.data.source_name ??
                    diaryT("selection.sourceUnknown")
                  }
                />
              </dl>
              <p className="mt-4 text-sm leading-6 text-slate-700">
                {diaryT("selection.editableSnapshot")}
              </p>
            </section>
          )}
          <div className="mt-6">
            <DiaryEntryForm
              action={createAction}
              fieldHelpText={{
                brand_name: diaryT("form.help.brandName"),
                calories: diaryT("form.help.calories"),
                carbohydrates_g: diaryT("form.help.carbohydrates"),
                entry_date: diaryT("form.help.entryDate"),
                fat_g: diaryT("form.help.fat"),
                food_name: diaryT("form.help.foodName"),
                meal_type: diaryT("form.help.mealType"),
                notes: diaryT("form.help.notes"),
                protein_g: diaryT("form.help.protein"),
                serving_quantity: diaryT("form.help.servingQuantity"),
                serving_unit: diaryT("form.help.servingUnit"),
              }}
              fieldErrorMessages={{
                invalid_date: diaryT("errors.invalidDate"),
                invalid_input: diaryT("errors.validation"),
                invalid_integer: diaryT("errors.invalidInteger"),
                invalid_number: diaryT("errors.invalidNumber"),
                invalid_type: diaryT("errors.validation"),
                invalid_uuid: diaryT("errors.invalidFoodSelection"),
                negative_value: diaryT("errors.negativeValue"),
                required: diaryT("errors.required"),
                too_long: diaryT("errors.tooLong"),
                unsupported_field: diaryT("errors.validation"),
                unsupported_meal_type: diaryT("errors.unsupportedMealType"),
              }}
              initialState={initialDiaryEntryState}
              key={
                foodSelectionState.status === "ready"
                  ? foodSelectionState.data.food_id
                  : "manual"
              }
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
              optionalLabel={diaryT("form.optional")}
              pendingLabel={diaryT("form.pending")}
              requiredLabel={diaryT("form.required")}
              sectionLabels={{
                foodDetails: diaryT("form.sections.foodDetails"),
                mealDate: diaryT("form.sections.mealDate"),
                notes: diaryT("form.sections.notes"),
                nutrition: diaryT("form.sections.nutrition"),
                serving: diaryT("form.sections.serving"),
                submit: diaryT("form.sections.submit"),
              }}
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

function FoodSelectionMessage({
  alert = false,
  body,
  testId,
  title,
}: {
  alert?: boolean;
  body: string;
  testId: string;
  title: string;
}) {
  return (
    <section
      aria-labelledby={`${testId}-title`}
      className="mt-6 border border-amber-200 bg-amber-50 p-4"
      data-testid={testId}
    >
      <h3 className="font-semibold text-slate-950" id={`${testId}-title`}>
        {title}
      </h3>
      <p
        className="mt-2 text-sm leading-6 text-slate-700"
        role={alert ? "alert" : undefined}
      >
        {body}
      </p>
    </section>
  );
}

function Metadata({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="font-semibold text-slate-700">{label}</dt>
      <dd className="mt-1 text-slate-950" dir="auto">
        {value}
      </dd>
    </div>
  );
}

function diaryValuesFromPrefill(
  prefill: Extract<FoodDiaryPrefillState, { status: "ready" }>["data"],
): NonNullable<DiaryEntryActionState["values"]> {
  return {
    brand_name: inputValue(prefill.brand_name),
    calories: inputValue(prefill.calories),
    carbohydrates_g: inputValue(prefill.carbohydrates_g),
    fat_g: inputValue(prefill.fat_g),
    food_id: prefill.food_id,
    food_name: prefill.name,
    protein_g: inputValue(prefill.protein_g),
    serving_quantity: inputValue(prefill.serving_quantity),
    serving_unit: inputValue(prefill.serving_unit),
  };
}

function inputValue(value: null | number | string) {
  return value === null ? "" : String(value);
}

function formatTargetValue(value: null | number | string, notSetLabel: string) {
  return value === null ? notSetLabel : String(value);
}

function retrievalErrorKey<T>(
  state: RetrievalState<T>,
): "database_error" | "unauthenticated" | "validation_error" {
  if (
    state.status === "unauthenticated" ||
    state.status === "validation_error"
  ) {
    return state.status;
  }

  return "database_error";
}
