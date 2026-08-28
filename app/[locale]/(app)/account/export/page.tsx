import Link from "next/link";
import { useTranslations } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { inspectRecentPasswordAuthentication } from "@/lib/auth/recent-password-auth";
import {
  accountExportReauthenticationIntent,
  reauthenticationPath,
} from "@/lib/auth/reauthentication-intent";
import type { Locale } from "@/lib/i18n/routing";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function AccountExportPage({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const recentAuthentication = await inspectRecentPasswordAuthentication();

  return (
    <LocalizedAccountExportPage
      canDownload={recentAuthentication.status === "valid"}
      locale={locale}
    />
  );
}

function LocalizedAccountExportPage({
  canDownload,
  locale,
}: {
  canDownload: boolean;
  locale: Locale;
}) {
  const t = useTranslations("Account.export");

  return (
    <section className="mx-auto w-full max-w-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
      <p className="text-start text-sm font-semibold text-teal-800">
        <Link
          className="underline decoration-2 underline-offset-4"
          href={`/${locale}/account`}
        >
          {t("back")}
        </Link>
      </p>
      <h1 className="mt-5 text-start text-3xl font-semibold text-slate-950">
        {t("title")}
      </h1>
      <p className="mt-4 text-start text-base leading-7 text-slate-700">
        {t("description")}
      </p>
      <p className="mt-3 text-start text-base leading-7 text-slate-700">
        {t("security")}
      </p>

      {canDownload ? (
        <form
          action={`/${locale}/account/export/download`}
          className="mt-8"
          method="post"
        >
          <button
            className="min-h-12 bg-teal-700 px-5 py-3 text-base font-semibold text-white transition-colors hover:bg-teal-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-800"
            type="submit"
          >
            {t("download")}
          </button>
        </form>
      ) : (
        <div
          className="mt-8 border-s-4 border-amber-500 bg-amber-50 p-5 text-start"
          role="status"
        >
          <p className="leading-7 text-slate-800">{t("reauthRequired")}</p>
          <Link
            className="mt-4 inline-flex min-h-12 items-center border border-slate-900 bg-white px-5 py-3 text-base font-semibold text-slate-950 transition-colors hover:border-teal-700 hover:text-teal-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-800"
            href={reauthenticationPath(
              locale,
              accountExportReauthenticationIntent,
            )}
          >
            {t("confirmPassword")}
          </Link>
        </div>
      )}
    </section>
  );
}
