import { randomUUID } from "node:crypto";
import Link from "next/link";
import { surfaceStyles } from "@/components/ui/card";
import { buttonStyles } from "@/components/ui/button";
import { feedbackStyles } from "@/components/ui/feedback";
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
import { CustomFoodCreationDraftRetirement } from "@/components/custom-foods/custom-food-form";
import { CalendarDateError } from "@/components/calendar-date/calendar-date-error";
import { RetrievalError } from "@/components/data/retrieval-error";
import { Plus, Search, ScanBarcode, BookOpen } from "lucide-react";
import { NutritionDailySummary } from "@/components/diary/nutrition-daily-summary";
import { DiaryEntryForm } from "@/components/diary/diary-entry-form";
import { DiaryEntryList } from "@/components/diary/diary-entry-list";
import { resolveAuthLocale, signInPath } from "@/lib/auth/require-user";
import {
  parseCalendarDateQueryValue,
  type CalendarDateQueryResult,
} from "@/lib/calendar-date";
import {
  listCurrentDiaryEntriesForDate,
  type DiaryEntry,
} from "@/lib/diary-entries";
import { getAuthenticatedUserId } from "@/lib/data/auth";
import {
  isRetrievalFailure,
  resolveNullableRetrieval,
  resolveRetrieval,
  type RetrievalState,
} from "@/lib/data/retrieval-state";
import {
  getReadableFoodDiaryPrefill,
  parseFoodDiarySelectionContext,
  type FoodDiarySelectionContext,
  type FoodDiaryPrefillState,
} from "@/lib/food-selection";
import { isUuid } from "@/lib/food-selection/query";
import { formatLocalizedDate } from "@/lib/i18n/format";
import { routing, type Locale } from "@/lib/i18n/routing";
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
  const selectionContext = parseFoodDiarySelectionContext(resolvedSearchParams);
  const customFoodCreated = resolvedSearchParams.customFood === "created";
  const creationRequestValue = resolvedSearchParams.creationRequest;
  const creationRequest =
    customFoodCreated &&
    typeof creationRequestValue === "string" &&
    isUuid(creationRequestValue)
      ? creationRequestValue
      : null;
  const savedMealLogged = resolvedSearchParams.savedMeal === "logged";
  const recipeLogged = resolvedSearchParams.recipe === "logged";

  setRequestLocale(locale);

  if (dateQuery.status === "missing") {
    return <LocalizedTodayDateBootstrap locale={locale} />;
  }

  if (dateQuery.status === "invalid" || dateQuery.status === "repeated") {
    return <LocalizedTodayDateError dateQuery={dateQuery} locale={locale} />;
  }

  const selectedDate = dateQuery.date;
  const foodSelectionPromise =
    selectionContext.status === "valid"
      ? getReadableFoodDiaryPrefill(selectionContext.food_id ?? undefined)
      : Promise.resolve({ status: "missing" } as const);
  const [
    userIdResult,
    profileResult,
    targetResult,
    diaryResult,
    foodSelectionState,
  ] = await Promise.all([
      getAuthenticatedUserId(),
      getCurrentProfile(),
      getEffectiveTargetForDate(selectedDate),
      listCurrentDiaryEntriesForDate(selectedDate),
      foodSelectionPromise,
    ]);
  const profileState = resolveNullableRetrieval(profileResult);
  const targetState = resolveNullableRetrieval(targetResult);
  const diaryState = resolveRetrieval(diaryResult);

  if (
    !userIdResult.ok ||
    profileState.status === "unauthenticated" ||
    targetState.status === "unauthenticated" ||
    diaryState.status === "unauthenticated" ||
    foodSelectionState.status === "unauthenticated"
  ) {
    redirect(signInPath(locale));
  }

  return (
    <LocalizedTodayPage
      creationRequest={creationRequest}
      currentUserId={userIdResult.data}
      customFoodCreated={customFoodCreated}
      diaryState={diaryState}
      foodSelectionState={foodSelectionState}
      locale={locale}
      profileState={profileState}
      recipeLogged={recipeLogged}
      savedMealLogged={savedMealLogged}
      selectionContext={selectionContext}
      selectedDate={selectedDate}
      targetState={targetState}
    />
  );
}

function LocalizedTodayDateBootstrap({ locale }: { locale: Locale }) {
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
  locale: Locale;
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
  creationRequest,
  currentUserId,
  customFoodCreated,
  diaryState,
  foodSelectionState,
  locale,
  profileState,
  recipeLogged,
  savedMealLogged,
  selectionContext,
  selectedDate,
  targetState,
}: {
  creationRequest: string | null;
  currentUserId: string;
  customFoodCreated: boolean;
  diaryState: RetrievalState<DiaryEntry[]>;
  foodSelectionState: Exclude<
    FoodDiaryPrefillState,
    { status: "unauthenticated" }
  >;
  locale: Locale;
  profileState: RetrievalState<Profile>;
  recipeLogged: boolean;
  savedMealLogged: boolean;
  selectionContext: FoodDiarySelectionContext;
  selectedDate: string;
  targetState: RetrievalState<NutritionTarget>;
}) {
  const t = useTranslations("AppShell.today");
  const diaryT = useTranslations("Diary");
  const dashboardT = useTranslations("Diary.dashboard");
  const createAction = createDiaryEntryAction.bind(null, locale);
  const deleteAction = deleteDiaryEntryAction.bind(null, locale);
  const updateAction = updateDiaryEntryAction.bind(null, locale);
  const initialDiaryEntryState: DiaryEntryActionState = {
    status: "idle",
    values: {
      entry_date: selectedDate,
      meal_type:
        selectionContext.status === "valid" && selectionContext.meal_type
          ? selectionContext.meal_type
          : "breakfast",
      ...(foodSelectionState.status === "ready"
        ? diaryValuesFromPrefill(foodSelectionState.data)
        : {}),
    },
  };
  const target = targetState.status === "ready" ? targetState.data : null;
  const removeSelectionParameters = new URLSearchParams({ date: selectedDate });
  if (selectionContext.status === "valid" && selectionContext.meal_type) {
    removeSelectionParameters.set("mealType", selectionContext.meal_type);
  }

  return (
    <section className="today-dashboard flex flex-1 flex-col gap-6 py-2 text-start">
      {creationRequest && (
        <CustomFoodCreationDraftRetirement
          creationRequest={creationRequest}
        />
      )}
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h1 className="ui-page-title">{dashboardT("title")}</h1>
          <p className="mt-2 text-base text-muted-foreground">
            <time dateTime={selectedDate}>{formatLocalizedDate(locale, selectedDate, { dateStyle: "full" })}</time>
          </p>
        </div>
        <form action={`/${locale}/today`} className="today-date-form text-sm">
          <div className="min-w-0">
            <label className="ui-label block mb-1" htmlFor="diary-date">{diaryT("fields.entryDate")}</label>
            <input className="ui-control" defaultValue={selectedDate} id="diary-date" name="date" type="date" />
          </div>
          <button className={buttonStyles({ variant: "outline" })} type="submit">{diaryT("date.submit")}</button>
        </form>
      </header>

      {customFoodCreated && (
        <div
          className={feedbackStyles("success", "max-w-3xl")}
          data-testid="custom-food-created-success"
          role="status"
        >
          <p className="font-semibold">{diaryT("customFoodCreated.title")}</p>
          <p className="mt-1 leading-6">{diaryT("customFoodCreated.body")}</p>
        </div>
      )}

      {savedMealLogged && (
        <div
          className={feedbackStyles("success", "max-w-3xl")}
          data-testid="saved-meal-logged-success"
          role="status"
        >
          <p className="font-semibold">{diaryT("savedMealLogged.title")}</p>
          <p className="mt-1 leading-6">{diaryT("savedMealLogged.body")}</p>
        </div>
      )}

      {recipeLogged && (
        <div
          className={feedbackStyles("success", "max-w-3xl")}
          data-testid="recipe-logged-success"
          role="status"
        >
          <p className="font-semibold">{diaryT("recipeLogged.title")}</p>
          <p className="mt-1 leading-6">{diaryT("recipeLogged.body")}</p>
        </div>
      )}

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
        <div className={surfaceStyles({ className: "max-w-2xl bg-info-surface border-info/30" })}>
          <h2 className="ui-card-title">
            {t("setupCalloutTitle")}
          </h2>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            {t("setupCalloutBody")}
          </p>
          <Link
            className={buttonStyles({ className: "mt-5" })}
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

      {diaryState.status === "ready" && (
        <NutritionDailySummary
          entries={diaryState.data}
          locale={locale}
          selectedDate={selectedDate}
          target={target}
          targetUnavailable={isRetrievalFailure(targetState)}
        />
      )}

      <div className="grid min-w-0 grid-cols-1 gap-6">
        <div className={surfaceStyles({ className: "min-w-0" })}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="ui-section-title">{dashboardT("diaryTitle")}</h2>
            <a className={buttonStyles()} href="#manual-entry"><Plus aria-hidden="true" size={18} />{dashboardT("addFood")}</a>
          </div>

          <div className="mt-6">
            {diaryState.status !== "ready" ? (
              <div className={feedbackStyles("danger")} role="alert" data-testid="diary-retrieval-error">
                {diaryT(`errors.${retrievalErrorKey(diaryState)}`)}
                <Link className={buttonStyles({ variant: "outline", className: "mt-3" })} href={`/${locale}/today?date=${selectedDate}`}>{dashboardT("retryDiary")}</Link>
              </div>
            ) : (
              <div className="grid gap-5">
                <DiaryEntryList
                  selectedDate={selectedDate}
                  emptyMealLabel={dashboardT("emptyMeal")}
                  unitCaloriesLabel={dashboardT("unitCalories")}
                  saveLabels={Object.fromEntries(["breakfast", "lunch", "dinner", "snack", "other"].map((meal) => [meal, diaryT("savedMeals.save", { meal: diaryT(`mealTypes.${meal}`) })]))}
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
                    saveConflict: diaryT("list.saveConflict"),
                    saveError: diaryT("list.saveError"),
                    saveIdle: diaryT("list.saveIdle"),
                    savePending: diaryT("list.savePending"),
                    saveSuccess: diaryT("list.saveSuccess"),
                    serving: diaryT("list.serving"),
                    source: diaryT("list.source"),
                    unitGrams: diaryT("totals.unitGrams"),
                    sourceTypes: {
                      manual: diaryT("list.sourceTypes.manual"),
                      recipe: diaryT("list.sourceTypes.recipe"),
                      saved_meal: diaryT("list.sourceTypes.saved_meal"),
                    },
                    recipeServingUnits: {
                      plural: diaryT("list.recipeServingUnits.plural"),
                      singular: diaryT("list.recipeServingUnits.singular"),
                    },
                  }}
                  locale={locale}
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

        <section className={surfaceStyles()} id="manual-entry" aria-labelledby="manual-entry-title" tabIndex={-1}>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h2 className="ui-card-title" id="manual-entry-title">
                {diaryT("form.title")}
              </h2>
              <p className="mt-3 text-sm leading-6 text-muted-foreground">
                {diaryT("form.description")}
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link
                className={buttonStyles({ variant: "outline" })}
                href={`/${locale}/foods?date=${selectedDate}`}
              >
                <Search aria-hidden="true" size={16} />{diaryT("selection.findFood")}
              </Link>
              <Link
                className={buttonStyles({ variant: "outline" })}
                href={`/${locale}/foods/reuse?date=${selectedDate}`}
              >
                {diaryT("selection.reuseFood")}
              </Link>
              <Link className={buttonStyles({ variant: "outline" })} href={`/${locale}/foods/barcode?date=${selectedDate}`}><ScanBarcode aria-hidden="true" size={16} />{dashboardT("scan")}</Link>
              <Link className={buttonStyles({ variant: "outline" })} href={`/${locale}/saved-meals`}>{dashboardT("savedMeals")}</Link>
              <Link
                className={buttonStyles({ variant: "outline" })}
                href={`/${locale}/recipes`}
              >
                <BookOpen aria-hidden="true" size={16} />{diaryT("selection.recipes")}
              </Link>
            </div>
          </div>

          {selectionContext.status === "invalid" && (
            <FoodSelectionMessage
              body={
                selectionContext.field === "mealType"
                  ? selectionContext.reason === "repeated"
                    ? diaryT("selection.invalidMealRepeated")
                    : diaryT("selection.invalidMeal")
                  : selectionContext.reason === "repeated"
                    ? diaryT("selection.invalidRepeated")
                    : diaryT("selection.invalid")
              }
              testId={
                selectionContext.field === "mealType"
                  ? "food-selection-context-invalid"
                  : "food-selection-invalid"
              }
              title={
                selectionContext.field === "mealType"
                  ? diaryT("selection.invalidMealTitle")
                  : diaryT("selection.invalidTitle")
              }
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
              className={surfaceStyles({ variant: "subtle", className: "mt-6 p-4" })}
              data-testid="selected-food-summary"
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h3
                    className="text-base font-semibold text-foreground"
                    dir="auto"
                    id="selected-food-title"
                  >
                    {diaryT("selection.selectedTitle", {
                      name: foodSelectionState.data.name,
                    })}
                  </h3>
                  {foodSelectionState.data.brand_name && (
                    <p className="mt-1 text-sm text-muted-foreground" dir="auto">
                      {diaryT("selection.brand", {
                        brand: foodSelectionState.data.brand_name,
                      })}
                    </p>
                  )}
                </div>
                <Link
                  className="ui-text-link text-sm"
                  href={`/${locale}/today?${removeSelectionParameters.toString()}`}
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
              <p className="mt-4 text-sm leading-6 text-muted-foreground">
                {diaryT("selection.editableSnapshot")}
              </p>
            </section>
          )}
          <div className="mt-6">
            <DiaryEntryForm
              action={createAction}
              draftScope={`${currentUserId}:${locale}:${selectedDate}:${
                foodSelectionState.status === "ready"
                  ? foodSelectionState.data.food_id
                  : "manual"
              }:${
                selectionContext.status === "valid" &&
                selectionContext.meal_type
                  ? selectionContext.meal_type
                  : "breakfast"
              }`}
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
              initialIdempotencyKey={randomUUID()}
              key={
                `${
                  foodSelectionState.status === "ready"
                    ? foodSelectionState.data.food_id
                    : "manual"
                }:${
                  selectionContext.status === "valid" &&
                  selectionContext.meal_type
                    ? selectionContext.meal_type
                    : "breakfast"
                }`
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
              newDraftLabel={diaryT("form.startNewDraft")}
              pendingLabel={diaryT("form.pending")}
              permalink={`/${locale}/today?date=${selectedDate}`}
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
                conflict: diaryT("errors.idempotencyConflict"),
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
        </section>
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
      className={surfaceStyles({ className: "mt-6 p-4 bg-warning-surface border-warning/30" })}
      data-testid={testId}
    >
      <h3 className="font-semibold text-foreground" id={`${testId}-title`}>
        {title}
      </h3>
      <p
        className="mt-2 text-sm leading-6 text-muted-foreground"
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
      <dt className="font-semibold text-muted-foreground">{label}</dt>
      <dd className="mt-1 text-foreground" dir="auto">
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
