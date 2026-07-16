import Link from "next/link";
import { useTranslations } from "next-intl";
import { RetrievalError } from "@/components/data/retrieval-error";
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
    <section className="flex flex-1 flex-col gap-8 py-8 text-start">
      <header className="max-w-3xl">
        <p className="text-sm font-semibold uppercase tracking-[0.16em] text-teal-700">
          {t("label")}
        </p>
        <h1 className="mt-4 text-3xl font-semibold leading-tight text-slate-950 sm:text-5xl">
          {t(mode === "create" ? "titleCreate" : "titleEdit")}
        </h1>
        <p className="mt-5 max-w-2xl text-base leading-7 text-slate-700 sm:text-lg">
          {mode === "create" && source === "diary"
            ? t("descriptionDiary")
            : t(mode === "create" ? "descriptionCreate" : "descriptionEdit")}
        </p>
      </header>
      <div className="max-w-4xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
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
    <section className="flex flex-1 flex-col justify-center py-8 text-start">
      <RetrievalError
        body={t("failureBody")}
        retryHref={retryHref}
        retryLabel={t("retry")}
        testId="saved-meal-retrieval-error"
        title={t("failureTitle")}
      />
      <Link
        className="mt-4 text-sm font-semibold text-teal-800 underline"
        href={`/${locale}/saved-meals`}
      >
        {t("back")}
      </Link>
    </section>
  );
}
