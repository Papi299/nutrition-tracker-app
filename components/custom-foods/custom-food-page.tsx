import { useTranslations } from "next-intl";
import { RetrievalError } from "@/components/data/retrieval-error";
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
        <p className="text-sm font-semibold uppercase tracking-[0.16em] text-teal-700">
          {t("label")}
        </p>
        <h1 className="mt-4 text-3xl font-semibold leading-tight text-slate-950 sm:text-5xl">
          {t(mode === "create" ? "titleCreate" : "titleEdit")}
        </h1>
        <p className="mt-5 max-w-2xl text-base leading-7 text-slate-700 sm:text-lg">
          {t(mode === "create" ? "descriptionCreate" : "descriptionEdit")}
        </p>
      </header>
      <div className="max-w-4xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        {children}
      </div>
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
        <a className="mt-4 inline-flex text-sm font-semibold text-teal-800 underline" href={`/${locale}/foods`}>
          {t("back")}
        </a>
      </div>
    </section>
  );
}
