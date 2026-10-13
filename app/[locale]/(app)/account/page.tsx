import Link from "next/link";
import { useTranslations } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { buttonStyles } from "@/components/ui/button";
import { surfaceStyles } from "@/components/ui/card";
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
    <section className="mx-auto grid w-full min-w-0 max-w-3xl gap-6 py-8 text-start">
      <header className="min-w-0">
        <h1 className="ui-page-title">
          {t("title")}
        </h1>
        <p className="ui-body-secondary mt-4 max-w-2xl sm:text-base">
          {t("description")}
        </p>
      </header>

      <section
        aria-labelledby="account-export-heading"
        className={surfaceStyles({ className: "min-w-0 sm:p-7" })}
      >
        <h2
          className="ui-section-title"
          id="account-export-heading"
        >
          {t("export.title")}
        </h2>
        <p className="ui-body-secondary mt-3">
          {t("export.summary")}
        </p>
        <Link
          className={buttonStyles({ className: "mt-5" })}
          href={`/${locale}/account/export`}
        >
          {t("export.open")}
        </Link>
      </section>

      <section
        aria-labelledby="account-closure-heading"
        className={surfaceStyles({ className: "min-w-0 border-danger/40 sm:p-7" })}
      >
        <h2
          className="ui-section-title text-danger-foreground"
          id="account-closure-heading"
        >
          {t("closure.title")}
        </h2>
        <p className="ui-body-secondary mt-3">
          {t("closure.summary")}
        </p>
        <Link
          className={buttonStyles({ variant: "outline", className: "mt-5 border-danger text-danger-foreground hover:bg-danger-surface" })}
          href={`/${locale}/account/closure`}
        >
          {t("closure.open")}
        </Link>
      </section>
    </section>
  );
}
