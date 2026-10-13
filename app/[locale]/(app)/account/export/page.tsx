import Link from "next/link";
import { useTranslations } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { Button, buttonStyles } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { feedbackStyles } from "@/components/ui/feedback";
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
    <section className="mx-auto grid w-full min-w-0 max-w-3xl gap-5 py-8 text-start">
      <Link
        className={buttonStyles({ variant: "ghost", className: "w-fit underline" })}
        href={`/${locale}/account`}
      >
        {t("back")}
      </Link>
      <Card className="min-w-0 sm:p-7">
        <h1 className="ui-page-title">{t("title")}</h1>
        <p className="ui-body-secondary mt-4 sm:text-base">
          {t("description")}
        </p>
        <p className="ui-body-secondary mt-3 sm:text-base">
          {t("security")}
        </p>

        {canDownload ? (
          <form
            action={`/${locale}/account/export/download`}
            className="mt-8"
            method="post"
          >
            <Button type="submit">{t("download")}</Button>
          </form>
        ) : (
          <div className={feedbackStyles("warning", "mt-6")} role="status">
            <p>{t("reauthRequired")}</p>
            <Link
              className={buttonStyles({ variant: "outline", className: "mt-4" })}
              href={reauthenticationPath(
                locale,
                accountExportReauthenticationIntent,
              )}
            >
              {t("confirmPassword")}
            </Link>
          </div>
        )}
      </Card>
    </section>
  );
}
