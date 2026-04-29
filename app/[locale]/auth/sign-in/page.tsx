import { useTranslations } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { AuthCard } from "@/components/auth/auth-card";
import { routing, type Locale } from "@/lib/i18n/routing";

type SignInPageProps = Readonly<{
  params: Promise<{ locale: Locale }>;
}>;

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export default async function SignInPage({ params }: SignInPageProps) {
  const { locale } = await params;

  setRequestLocale(locale);

  return <LocalizedSignIn locale={locale} />;
}

function LocalizedSignIn({ locale }: { locale: Locale }) {
  const t = useTranslations("Auth");

  return (
    <AuthCard
      alternateHref={`/${locale}/auth/sign-up`}
      alternateLabel={t("signIn.createAccountLink")}
      alternateText={t("signIn.createAccountText")}
      description={t("signIn.description")}
      emailLabel={t("signIn.emailLabel")}
      emailPlaceholder={t("common.emailPlaceholder")}
      homeHref={`/${locale}`}
      homeLabel={t("common.homeLink")}
      passwordLabel={t("signIn.passwordLabel")}
      passwordPlaceholder={t("common.passwordPlaceholder")}
      statusNote={t("status.notConnectedYet")}
      submitLabel={t("signIn.submit")}
      title={t("signIn.title")}
    />
  );
}
