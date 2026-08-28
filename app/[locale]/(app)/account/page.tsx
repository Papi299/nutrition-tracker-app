import Link from "next/link";
import { useTranslations } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import type { Locale } from "@/lib/i18n/routing";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function AccountPage({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <LocalizedAccountPage locale={locale} />;
}

function LocalizedAccountPage({ locale }: { locale: Locale }) {
  const t = useTranslations("Account");

  return (
    <section className="mx-auto grid w-full max-w-3xl gap-6">
      <div className="border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <h1 className="text-start text-3xl font-semibold text-slate-950">
          {t("title")}
        </h1>
        <p className="mt-4 text-start text-base leading-7 text-slate-700">
          {t("description")}
        </p>
      </div>

      <section
        aria-labelledby="account-export-heading"
        className="border border-slate-200 bg-white p-6 shadow-sm sm:p-8"
      >
        <h2
          className="text-start text-2xl font-semibold text-slate-950"
          id="account-export-heading"
        >
          {t("export.title")}
        </h2>
        <p className="mt-3 text-start leading-7 text-slate-700">
          {t("export.summary")}
        </p>
        <Link
          className="mt-6 inline-flex min-h-12 items-center bg-teal-700 px-5 py-3 text-base font-semibold text-white transition-colors hover:bg-teal-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-800"
          href={`/${locale}/account/export`}
        >
          {t("export.open")}
        </Link>
      </section>
    </section>
  );
}
