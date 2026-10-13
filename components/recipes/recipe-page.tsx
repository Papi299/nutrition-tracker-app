import Link from "next/link";
import { useTranslations } from "next-intl";
import { RetrievalError } from "@/components/data/retrieval-error";
import type { Locale } from "@/lib/i18n/routing";
import { buttonStyles } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export function RecipeEditorPageHeader({
  children,
  mode,
}: {
  children: React.ReactNode;
  mode: "create" | "edit";
}) {
  const t = useTranslations("RecipeEditor");
  return (
    <section className="flex min-w-0 flex-1 flex-col gap-8 py-8 text-start [overflow-wrap:anywhere]">
      <header className="min-w-0 max-w-3xl">
        <p className="ui-eyebrow">
          {t("label")}
        </p>
        <h1 className="ui-page-title mt-3">
          {t(mode === "create" ? "titleCreate" : "titleEdit")}
        </h1>
        <p className="ui-body-secondary mt-4 max-w-2xl sm:text-base">
          {t(mode === "create" ? "descriptionCreate" : "descriptionEdit")}
        </p>
      </header>
      <Card className="w-full min-w-0 max-w-4xl sm:p-7">
        {children}
      </Card>
    </section>
  );
}

export function RecipeRetrievalError({
  locale,
  retryHref,
}: {
  locale: Locale;
  retryHref: string;
}) {
  const t = useTranslations("RecipeEditor.retrieval");
  return (
    <section className="flex min-w-0 flex-1 flex-col justify-center py-8 text-start [overflow-wrap:anywhere]">
      <RetrievalError
        body={t("failureBody")}
        retryHref={retryHref}
        retryLabel={t("retry")}
        testId="recipe-retrieval-error"
        title={t("failureTitle")}
      />
      <Link className={buttonStyles({ variant: "ghost", className: "mt-4 w-fit underline" })} href={`/${locale}/recipes`}>
        {t("back")}
      </Link>
    </section>
  );
}
