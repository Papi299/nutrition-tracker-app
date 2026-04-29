import { useTranslations } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { resolveAuthLocale } from "@/lib/auth/require-user";
import { routing } from "@/lib/i18n/routing";

type TodayPageProps = Readonly<{
  params: Promise<{ locale: string }>;
}>;

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export default async function TodayPage({ params }: TodayPageProps) {
  const { locale: localeInput } = await params;
  const locale = resolveAuthLocale(localeInput);

  setRequestLocale(locale);

  return <LocalizedTodayPage />;
}

function LocalizedTodayPage() {
  const t = useTranslations("AppShell.today");

  return (
    <section className="flex flex-1 flex-col justify-center gap-8 py-8 text-start">
      <div className="max-w-3xl">
        <p className="text-sm font-semibold uppercase tracking-[0.16em] text-teal-700">
          {t("label")}
        </p>
        <h1 className="mt-4 text-3xl font-semibold leading-tight text-slate-950 sm:text-5xl">
          {t("title")}
        </h1>
        <p className="mt-5 max-w-2xl text-base leading-7 text-slate-700 sm:text-lg">
          {t("description")}
        </p>
      </div>

      <div className="max-w-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <h2 className="text-lg font-semibold text-slate-950">
          {t("placeholderTitle")}
        </h2>
        <p className="mt-3 text-sm leading-6 text-slate-700">
          {t("placeholderBody")}
        </p>
      </div>
    </section>
  );
}
