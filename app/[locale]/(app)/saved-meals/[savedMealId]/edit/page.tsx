import Link from "next/link";
import { useTranslations } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { redirect } from "next/navigation";
import {
  editorSavedMealFormValues,
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
import { isUuid } from "@/lib/food-selection/query";
import {
  getOwnedSavedMealEditor,
  savedMealRowKey,
} from "@/lib/saved-meals";
import type { Locale } from "@/lib/i18n/routing";

type EditSavedMealPageProps = Readonly<{
  params: Promise<{ locale: string; savedMealId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}>;

export default async function EditSavedMealPage({
  params,
  searchParams,
}: EditSavedMealPageProps) {
  const { locale: localeInput, savedMealId } = await params;
  const resolvedSearchParams = await searchParams;
  const locale = resolveAuthLocale(localeInput);

  setRequestLocale(locale);

  if (!isUuid(savedMealId)) {
    return <SavedMealUnavailable locale={locale} state="invalid" />;
  }

  const editor = await getOwnedSavedMealEditor(savedMealId);

  if (!editor.ok) {
    if (editor.code === "unauthenticated") redirect(signInPath(locale));
    if (editor.code === "not_found") {
      return <SavedMealUnavailable locale={locale} state="unavailable" />;
    }

    return (
      <SavedMealRetrievalError
        locale={locale}
        retryHref={`/${locale}/saved-meals/${savedMealId}/edit`}
      />
    );
  }

  const bindings: SavedMealFoodLinkBinding[] = editor.data.items.map((item) => ({
    food_id: item.food_id,
    row_key: savedMealRowKey("item", item.item_id),
  }));
  const action = saveSavedMealAction.bind(
    null,
    locale,
    savedMealId,
    bindings,
  );
  const initialState: SavedMealActionState = {
    status: "idle",
    values: editorSavedMealFormValues(editor.data),
  };
  const savedValue = resolvedSearchParams.saved;
  const saved =
    savedValue === "created" || savedValue === "updated" ? savedValue : null;

  return (
    <SavedMealEditorPageHeader mode="edit">
      <SavedMealForm
        action={action}
        archived={editor.data.is_archived}
        initialState={initialState}
        linkedRowKeys={bindings
          .filter((binding) => binding.food_id !== null)
          .map((binding) => binding.row_key)}
        locale={locale}
        mode="edit"
        saved={saved}
      />
    </SavedMealEditorPageHeader>
  );
}

function SavedMealUnavailable({
  locale,
  state,
}: {
  locale: Locale;
  state: "invalid" | "unavailable";
}) {
  const t = useTranslations("SavedMealEditor.retrieval");

  return (
    <section className="flex flex-1 flex-col justify-center py-8 text-start">
      <div
        className="max-w-3xl border border-amber-300 bg-amber-50 p-5"
        data-testid={state === "invalid" ? "saved-meal-invalid-link" : "saved-meal-unavailable"}
      >
        <h1 className="text-2xl font-semibold text-slate-950">
          {t(state === "invalid" ? "invalidTitle" : "unavailableTitle")}
        </h1>
        <p className="mt-3 text-sm leading-6 text-amber-950" role="alert">
          {t(state === "invalid" ? "invalidBody" : "unavailableBody")}
        </p>
        <Link className="mt-4 inline-flex text-sm font-semibold text-teal-800 underline" href={`/${locale}/saved-meals`}>
          {t("back")}
        </Link>
      </div>
    </section>
  );
}
