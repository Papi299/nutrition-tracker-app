import Link from "next/link";
import { useTranslations } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { redirect } from "next/navigation";
import {
  editorRecipeFormValues,
  type RecipeActionState,
  type RecipeFoodLinkBinding,
} from "@/app/[locale]/(app)/recipes/action-state";
import { saveRecipeAction } from "@/app/[locale]/(app)/recipes/actions";
import { RecipeForm } from "@/components/recipes/recipe-form";
import { RecipeNutritionSummary } from "@/components/recipes/recipe-nutrition-summary";
import { RecipeEditorPageHeader, RecipeRetrievalError } from "@/components/recipes/recipe-page";
import { resolveAuthLocale, signInPath } from "@/lib/auth/require-user";
import { isUuid } from "@/lib/food-selection/query";
import {
  getOwnedRecipeEditor,
  getOwnedRecipeUseContract,
  recipeRowKey,
} from "@/lib/recipes";
import type { Locale } from "@/lib/i18n/routing";

type EditRecipePageProps = Readonly<{
  params: Promise<{ locale: string; recipeId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}>;

export default async function EditRecipePage({ params, searchParams }: EditRecipePageProps) {
  const { locale: localeInput, recipeId } = await params;
  const resolvedSearchParams = await searchParams;
  const locale = resolveAuthLocale(localeInput);
  setRequestLocale(locale);

  if (!isUuid(recipeId)) return <RecipeUnavailable locale={locale} state="invalid" />;
  const editor = await getOwnedRecipeEditor(recipeId);
  if (!editor.ok) {
    if (editor.code === "unauthenticated") redirect(signInPath(locale));
    if (editor.code === "not_found") return <RecipeUnavailable locale={locale} state="unavailable" />;
    return <RecipeRetrievalError locale={locale} retryHref={`/${locale}/recipes/${recipeId}/edit`} />;
  }

  const bindings: RecipeFoodLinkBinding[] = editor.data.ingredients.map((ingredient) => ({
    food_id: ingredient.food_id,
    row_key: recipeRowKey("ingredient", ingredient.ingredient_id),
  }));
  const action = saveRecipeAction.bind(null, locale, recipeId, bindings);
  const initialState: RecipeActionState = { status: "idle", values: editorRecipeFormValues(editor.data) };
  const savedValue = resolvedSearchParams.saved;
  const saved = savedValue === "created" || savedValue === "updated" ? savedValue : null;
  const nutrition = editor.data.is_archived
    ? null
    : await getOwnedRecipeUseContract({
        recipe_id: recipeId,
        requested_servings: 1,
      });
  if (nutrition?.status === "unauthenticated") redirect(signInPath(locale));

  return (
    <RecipeEditorPageHeader mode="edit">
      {nutrition && (
        <RecipeNutritionSummary
          locale={locale}
          recipeId={recipeId}
          state={nutrition}
        />
      )}
      <RecipeForm action={action} archived={editor.data.is_archived} initialState={initialState} linkedRowKeys={bindings.filter((binding) => binding.food_id !== null).map((binding) => binding.row_key)} locale={locale} mode="edit" saved={saved} />
    </RecipeEditorPageHeader>
  );
}

function RecipeUnavailable({ locale, state }: { locale: Locale; state: "invalid" | "unavailable" }) {
  const t = useTranslations("RecipeEditor.retrieval");
  return (
    <section className="flex flex-1 flex-col justify-center py-8 text-start">
      <div className="max-w-3xl border border-amber-300 bg-amber-50 p-5" data-testid={state === "invalid" ? "recipe-invalid-link" : "recipe-unavailable"}>
        <h1 className="text-2xl font-semibold text-slate-950">{t(state === "invalid" ? "invalidTitle" : "unavailableTitle")}</h1>
        <p className="mt-3 text-sm leading-6 text-amber-950" role="alert">{t(state === "invalid" ? "invalidBody" : "unavailableBody")}</p>
        <Link className="mt-4 inline-flex text-sm font-semibold text-teal-800 underline" href={`/${locale}/recipes`}>{t("back")}</Link>
      </div>
    </section>
  );
}
