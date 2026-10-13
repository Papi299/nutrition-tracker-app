import { useTranslations } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { Card } from "@/components/ui/card";
import { feedbackStyles } from "@/components/ui/feedback";
import { resolveAuthLocale } from "@/lib/auth/require-user";

type SignOutFailedPageProps = Readonly<{
  params: Promise<{ locale: string }>;
}>;

export default async function SignOutFailedPage({
  params,
}: SignOutFailedPageProps) {
  const { locale: localeInput } = await params;
  const locale = resolveAuthLocale(localeInput);

  setRequestLocale(locale);

  return <LocalizedSignOutFailure locale={locale} />;
}

function LocalizedSignOutFailure({
  locale,
}: {
  locale: "en" | "he";
}) {
  const t = useTranslations("AppShell.signOutFailure");

  return (
    <section className="flex min-w-0 flex-1 flex-col justify-center py-8 text-start [overflow-wrap:anywhere]">
      <Card className="w-full min-w-0 max-w-xl border-danger/30">
        <h1 className="ui-page-title">{t("title")}</h1>
        <p className={feedbackStyles("danger", "mt-4")} role="alert">
          {t("body")}
        </p>
        <div className="mt-5">
          <SignOutButton label={t("retry")} locale={locale} />
        </div>
      </Card>
    </section>
  );
}
