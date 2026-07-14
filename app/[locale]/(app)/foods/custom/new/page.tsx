import { setRequestLocale } from "next-intl/server";
import { redirect } from "next/navigation";
import { saveCustomFoodAction } from "@/app/[locale]/(app)/foods/custom/actions";
import {
  newCustomFoodFormValues,
  type CustomFoodActionState,
} from "@/app/[locale]/(app)/foods/custom/action-state";
import { CustomFoodForm } from "@/components/custom-foods/custom-food-form";
import {
  CustomFoodEditorPageHeader,
  CustomFoodRetrievalError,
} from "@/components/custom-foods/custom-food-page";
import { resolveAuthLocale, signInPath } from "@/lib/auth/require-user";
import { getCustomFoodNutrientDictionary } from "@/lib/custom-foods";

type NewCustomFoodPageProps = Readonly<{
  params: Promise<{ locale: string }>;
}>;

export default async function NewCustomFoodPage({ params }: NewCustomFoodPageProps) {
  const { locale: localeInput } = await params;
  const locale = resolveAuthLocale(localeInput);

  setRequestLocale(locale);

  const dictionary = await getCustomFoodNutrientDictionary();

  if (!dictionary.ok) {
    if (dictionary.code === "unauthenticated") {
      redirect(signInPath(locale));
    }

    return <CustomFoodRetrievalError locale={locale} retryHref={`/${locale}/foods/custom/new`} />;
  }

  const action = saveCustomFoodAction.bind(null, locale, null);
  const initialState: CustomFoodActionState = {
    status: "idle",
    values: newCustomFoodFormValues(locale),
  };

  return (
    <CustomFoodEditorPageHeader mode="create">
      <CustomFoodForm
        action={action}
        archived={false}
        dictionary={dictionary.data}
        initialState={initialState}
        locale={locale}
        mode="create"
        saved={null}
      />
    </CustomFoodEditorPageHeader>
  );
}
