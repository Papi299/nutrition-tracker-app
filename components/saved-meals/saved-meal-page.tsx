import Link from "next/link";
import { useTranslations } from "next-intl";
import { RetrievalError } from "@/components/data/retrieval-error";
import { buttonStyles } from "@/components/ui/button";
import { surfaceStyles } from "@/components/ui/card";
import type { Locale } from "@/lib/i18n/routing";

export function SavedMealEditorPageHeader({
  children,
  mode,
  source,
}: {
  children: React.ReactNode;
  mode: "create" | "edit";
  source?: "blank" | "diary";
}) {
  const t = useTranslations("SavedMealEditor");

  return (
    <section className="grid min-w-0 w-full max-w-4xl gap-6 py-4 text-start sm:gap-8">
      <header className="min-w-0 max-w-3xl">
        <p className="ui-eyebrow">{t("label")}</p>
        <h1 className="ui-page-title mt-3 [overflow-wrap:anywhere]">
          {t(mode === "create" ? "titleCreate" : "titleEdit")}
        </h1>
        <p className="ui-body-secondary mt-4 max-w-2xl text-base">
          {mode === "create" && source === "diary"
            ? t("descriptionDiary")
            : t(mode === "create" ? "descriptionCreate" : "descriptionEdit")}
        </p>
      </header>
      <div className={surfaceStyles({ className: "min-w-0" })}>
        {children}
      </div>
    </section>
  );
}

export function SavedMealRetrievalError({
  locale,
  retryHref,
}: {
  locale: Locale;
  retryHref: string;
}) {
  const t = useTranslations("SavedMealEditor.retrieval");

  return (
    <section className="flex min-w-0 flex-1 flex-col justify-center py-4 text-start">
      <RetrievalError
        body={t("failureBody")}
        retryHref={retryHref}
        retryLabel={t("retry")}
        testId="saved-meal-retrieval-error"
        title={t("failureTitle")}
      />
      <Link
        className={buttonStyles({ variant: "outline", className: "mt-4 self-start" })}
        href={`/${locale}/saved-meals`}
      >
        {t("back")}
      </Link>
    </section>
  );
}
