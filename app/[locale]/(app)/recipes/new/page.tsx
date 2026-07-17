import { randomUUID } from "node:crypto";
import { setRequestLocale } from "next-intl/server";
import {
  newRecipeFormValues,
  type RecipeActionState,
} from "@/app/[locale]/(app)/recipes/action-state";
import { saveRecipeAction } from "@/app/[locale]/(app)/recipes/actions";
import { RecipeForm } from "@/components/recipes/recipe-form";
import { RecipeEditorPageHeader } from "@/components/recipes/recipe-page";
import { resolveAuthLocale } from "@/lib/auth/require-user";
import { recipeRowKey } from "@/lib/recipes";

type NewRecipePageProps = Readonly<{ params: Promise<{ locale: string }> }>;

export default async function NewRecipePage({ params }: NewRecipePageProps) {
  const { locale: localeInput } = await params;
  const locale = resolveAuthLocale(localeInput);
  setRequestLocale(locale);

  const rowKey = recipeRowKey("client", randomUUID());
  const initialState: RecipeActionState = {
    status: "idle",
    values: newRecipeFormValues(locale, rowKey),
  };
  const action = saveRecipeAction.bind(null, locale, null, []);
  return (
    <RecipeEditorPageHeader mode="create">
      <RecipeForm action={action} archived={false} initialState={initialState} linkedRowKeys={[]} locale={locale} mode="create" saved={null} />
    </RecipeEditorPageHeader>
  );
}
