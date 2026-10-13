import Link from "next/link";
import { useTranslations } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { Button, buttonStyles } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { feedbackStyles } from "@/components/ui/feedback";
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
    <section className="mx-auto grid w-full min-w-0 max-w-3xl gap-5 py-8 text-start">
      <Link
        className={buttonStyles({ variant: "ghost", className: "w-fit underline" })}
        href={`/${locale}/account`}
      >
        {t("back")}
      </Link>
      <Card className="min-w-0 border-danger/40 sm:p-7">
        <h1 className="ui-page-title text-danger-foreground">{t("title")}</h1>
        <p className="ui-body-secondary mt-4 sm:text-base">
          {t("description")}
        </p>
        <div className={feedbackStyles("danger", "mt-5")}>
          <ul className="list-disc space-y-3 ps-5">
            <li>{t("consequences.immediate")}</li>
            <li>{t("consequences.irreversible")}</li>
            <li>{t("consequences.data")}</li>
          </ul>
        </div>
        <p className="ui-body-secondary mt-5">{t("exportOffer")}</p>
        <Link
          className={buttonStyles({ variant: "outline", className: "mt-3" })}
          href={`/${locale}/account/export`}
        >
          {t("exportLink")}
        </Link>

        {canClose ? (
          <form
            action={`/${locale}/account/closure/submit`}
            className="mt-6 grid min-w-0 gap-5 border-t border-danger/30 pt-6"
            method="post"
          >
            <label className="flex min-h-12 min-w-0 items-start gap-3 rounded-lg border border-danger/30 bg-danger-surface p-3 text-sm font-medium leading-6 text-foreground">
              <input
                className="mt-0.5 size-5 shrink-0 accent-danger"
                name="confirmClosure"
                type="checkbox"
                value="confirm-account-closure-v1"
              />
              <span className="min-w-0">{t("confirmation")}</span>
            </label>
            <div className="flex min-w-0 flex-wrap gap-3">
              <Button type="submit" variant="destructive">
                {t("submit")}
              </Button>
              <Link
                className={buttonStyles({ variant: "outline" })}
                href={`/${locale}/account`}
              >
                {t("cancel")}
              </Link>
            </div>
          </form>
        ) : (
          <div className={feedbackStyles("warning", "mt-6")} role="status">
            <p>{t("reauthRequired")}</p>
            <div className="mt-4 flex min-w-0 flex-wrap gap-3">
              <Link
                className={buttonStyles({ variant: "outline" })}
                href={reauthenticationPath(
                  locale,
                  accountClosureReauthenticationIntent,
                )}
              >
                {t("confirmPassword")}
              </Link>
              <Link
                className={buttonStyles({ variant: "ghost", className: "underline" })}
                href={`/${locale}/account`}
              >
                {t("cancel")}
              </Link>
            </div>
          </div>
        )}
      </Card>
    </section>
  );
}
