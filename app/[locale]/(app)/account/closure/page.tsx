import Link from "next/link";
import { useTranslations } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { inspectRecentPasswordAuthentication } from "@/lib/auth/recent-password-auth";
import {
  accountClosureReauthenticationIntent,
  reauthenticationPath,
} from "@/lib/auth/reauthentication-intent";
import type { Locale } from "@/lib/i18n/routing";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function AccountClosurePage({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const recentAuthentication = await inspectRecentPasswordAuthentication();

  return (
    <LocalizedAccountClosurePage
      canClose={recentAuthentication.status === "valid"}
      locale={locale}
    />
  );
}

function LocalizedAccountClosurePage({
  canClose,
  locale,
}: {
  canClose: boolean;
  locale: Locale;
}) {
  const t = useTranslations("Account.closure");

  return (
    <section className="mx-auto w-full max-w-3xl border border-red-300 bg-white p-6 shadow-sm sm:p-8">
      <p className="text-start text-sm font-semibold text-teal-800">
        <Link
          className="underline decoration-2 underline-offset-4"
          href={`/${locale}/account`}
        >
          {t("back")}
        </Link>
      </p>
      <h1 className="mt-5 text-start text-3xl font-semibold text-red-950">
        {t("title")}
      </h1>
      <p className="mt-4 text-start text-base leading-7 text-slate-800">
        {t("description")}
      </p>
      <ul className="mt-5 list-disc space-y-3 ps-6 text-start leading-7 text-slate-800">
        <li>{t("consequences.immediate")}</li>
        <li>{t("consequences.irreversible")}</li>
        <li>{t("consequences.data")}</li>
      </ul>
      <p className="mt-6 text-start leading-7 text-slate-700">
        {t("exportOffer")} {" "}
        <Link
          className="font-semibold text-teal-800 underline decoration-2 underline-offset-4"
          href={`/${locale}/account/export`}
        >
          {t("exportLink")}
        </Link>
      </p>

      {canClose ? (
        <form
          action={`/${locale}/account/closure/submit`}
          className="mt-8 grid gap-6 border-t border-red-200 pt-6"
          method="post"
        >
          <label className="flex min-h-12 items-start gap-3 text-start font-medium text-slate-950">
            <input
              className="mt-1 size-5 shrink-0 accent-red-800"
              name="confirmClosure"
              type="checkbox"
              value="confirm-account-closure-v1"
            />
            <span>{t("confirmation")}</span>
          </label>
          <div className="flex flex-wrap gap-4">
            <button
              className="min-h-12 bg-red-800 px-5 py-3 text-base font-semibold text-white transition-colors hover:bg-red-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-900"
              type="submit"
            >
              {t("submit")}
            </button>
            <Link
              className="inline-flex min-h-12 items-center border border-slate-900 bg-white px-5 py-3 text-base font-semibold text-slate-950 transition-colors hover:border-teal-700 hover:text-teal-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-800"
              href={`/${locale}/account`}
            >
              {t("cancel")}
            </Link>
          </div>
        </form>
      ) : (
        <div
          className="mt-8 border-s-4 border-amber-500 bg-amber-50 p-5 text-start"
          role="status"
        >
          <p className="leading-7 text-slate-800">{t("reauthRequired")}</p>
          <div className="mt-4 flex flex-wrap gap-4">
            <Link
              className="inline-flex min-h-12 items-center border border-slate-900 bg-white px-5 py-3 text-base font-semibold text-slate-950 transition-colors hover:border-teal-700 hover:text-teal-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-800"
              href={reauthenticationPath(
                locale,
                accountClosureReauthenticationIntent,
              )}
            >
              {t("confirmPassword")}
            </Link>
            <Link
              className="inline-flex min-h-12 items-center px-5 py-3 text-base font-semibold text-teal-800 underline decoration-2 underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-800"
              href={`/${locale}/account`}
            >
              {t("cancel")}
            </Link>
          </div>
        </div>
      )}
    </section>
  );
}
