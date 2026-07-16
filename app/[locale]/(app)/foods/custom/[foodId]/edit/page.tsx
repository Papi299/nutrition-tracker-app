import Link from "next/link";
import { useTranslations } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { redirect } from "next/navigation";
import { saveCustomFoodAction } from "@/app/[locale]/(app)/foods/custom/actions";
import {
  editorCustomFoodFormValues,
  type CustomFoodActionState,
} from "@/app/[locale]/(app)/foods/custom/action-state";
import { CustomFoodForm } from "@/components/custom-foods/custom-food-form";
import {
  CustomFoodEditorPageHeader,
  CustomFoodRetrievalError,
} from "@/components/custom-foods/custom-food-page";
import { resolveAuthLocale, signInPath } from "@/lib/auth/require-user";
import {
  getCustomFoodNutrientDictionary,
  getOwnedCustomFoodEditor,
} from "@/lib/custom-foods";
import { isUuid } from "@/lib/food-selection/query";
import type { Locale } from "@/lib/i18n/routing";

type EditCustomFoodPageProps = Readonly<{
  params: Promise<{ foodId: string; locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}>;

export default async function EditCustomFoodPage({
  params,
  searchParams,
}: EditCustomFoodPageProps) {
  const { foodId, locale: localeInput } = await params;
  const resolvedSearchParams = await searchParams;
  const locale = resolveAuthLocale(localeInput);

  setRequestLocale(locale);

  if (!isUuid(foodId)) {
    return <CustomFoodUnavailable locale={locale} state="invalid" />;
  }

  const [editor, dictionary] = await Promise.all([
    getOwnedCustomFoodEditor(foodId),
    getCustomFoodNutrientDictionary(),
  ]);

  if (
    (!editor.ok && editor.code === "unauthenticated") ||
    (!dictionary.ok && dictionary.code === "unauthenticated")
  ) {
    redirect(signInPath(locale));
  }

  if (!editor.ok) {
    if (editor.code === "not_found") {
      return <CustomFoodUnavailable locale={locale} state="unavailable" />;
    }

    return (
      <CustomFoodRetrievalError
        locale={locale}
        retryHref={`/${locale}/foods/custom/${foodId}/edit`}
      />
    );
  }

  if (!dictionary.ok) {
    return (
      <CustomFoodRetrievalError
        locale={locale}
        retryHref={`/${locale}/foods/custom/${foodId}/edit`}
      />
    );
  }

  const action = saveCustomFoodAction.bind(null, locale, foodId);
  const initialState: CustomFoodActionState = {
    status: "idle",
    values: editorCustomFoodFormValues(editor.data),
  };
  const savedValue = resolvedSearchParams.saved;
  const saved =
    savedValue === "created" || savedValue === "updated" ? savedValue : null;

  return (
    <CustomFoodEditorPageHeader mode="edit">
      <CustomFoodForm
        action={action}
        archived={editor.data.is_archived}
        dictionary={dictionary.data}
        initialState={initialState}
        locale={locale}
        mode="edit"
        saved={saved}
      />
    </CustomFoodEditorPageHeader>
  );
}

function CustomFoodUnavailable({
  locale,
  state,
}: {
  locale: Locale;
  state: "invalid" | "unavailable";
}) {
  const t = useTranslations("CustomFoodEditor.retrieval");

  return (
    <section className="flex flex-1 flex-col justify-center py-8 text-start">
      <div
        className="max-w-3xl border border-amber-200 bg-amber-50 p-5 shadow-sm sm:p-6"
        data-testid={state === "invalid" ? "custom-food-invalid-link" : "custom-food-unavailable"}
      >
        <h1 className="text-2xl font-semibold text-slate-950">
          {t(state === "invalid" ? "invalidTitle" : "unavailableTitle")}
        </h1>
        <p className="mt-3 text-sm leading-6 text-amber-950" role="alert">
          {t(state === "invalid" ? "invalidBody" : "unavailableBody")}
        </p>
        <Link className="mt-4 inline-flex text-sm font-semibold text-teal-800 underline" href={`/${locale}/foods`}>
          {t("back")}
        </Link>
      </div>
    </section>
  );
}
