import { useTranslations } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { SignOutButton } from "@/components/auth/sign-out-button";
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
    <section className="flex flex-1 flex-col justify-center py-8 text-start">
      <div className="max-w-xl border border-red-300 bg-red-50 p-5">
        <h1 className="text-2xl font-semibold text-slate-950">{t("title")}</h1>
        <p className="mt-3 text-sm leading-6 text-red-900" role="alert">
          {t("body")}
        </p>
        <div className="mt-5">
          <SignOutButton label={t("retry")} locale={locale} />
        </div>
      </div>
    </section>
  );
}
