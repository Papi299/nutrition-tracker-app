import { useTranslations } from "next-intl";
import { RetrievalError } from "@/components/data/retrieval-error";
import { buttonStyles } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { Locale } from "@/lib/i18n/routing";

export function CustomFoodEditorPageHeader({
  children,
  mode,
}: {
  children: React.ReactNode;
  mode: "create" | "edit";
}) {
  const t = useTranslations("CustomFoodEditor");

  return (
    <section className="flex flex-1 flex-col gap-8 py-8 text-start">
      <header className="max-w-3xl">
        <p className="ui-eyebrow text-primary">
          {t("label")}
        </p>
        <h1 className="ui-page-title mt-4">
          {t(mode === "create" ? "titleCreate" : "titleEdit")}
        </h1>
        <p className="ui-body-secondary mt-5 max-w-2xl sm:text-lg">
          {t(mode === "create" ? "descriptionCreate" : "descriptionEdit")}
        </p>
      </header>
      <Card className="max-w-4xl p-5 sm:p-6" variant="raised">
        {children}
      </Card>
    </section>
  );
}

export function CustomFoodRetrievalError({
  locale,
  retryHref,
}: {
  locale: Locale;
  retryHref: string;
}) {
  const t = useTranslations("CustomFoodEditor.retrieval");

  return (
    <section className="flex flex-1 flex-col justify-center py-8">
      <div className="max-w-3xl">
        <RetrievalError
          body={t("failureBody")}
          retryHref={retryHref}
          retryLabel={t("retry")}
          testId="custom-food-retrieval-error"
          title={t("failureTitle")}
        />
        <a className={buttonStyles({ className: "mt-4", variant: "ghost" })} href={`/${locale}/foods`}>
          {t("back")}
        </a>
      </div>
    </section>
  );
}
