import { useTranslations } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { AuthCard } from "@/components/auth/auth-card";
import { routing, type Locale } from "@/lib/i18n/routing";

type SignUpPageProps = Readonly<{
  params: Promise<{ locale: Locale }>;
}>;

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export default async function SignUpPage({ params }: SignUpPageProps) {
  const { locale } = await params;

  setRequestLocale(locale);

  return <LocalizedSignUp locale={locale} />;
}

function LocalizedSignUp({ locale }: { locale: Locale }) {
  const t = useTranslations("Auth");

  return (
    <AuthCard
      alternateHref={`/${locale}/auth/sign-in`}
      alternateLabel={t("signUp.haveAccountLink")}
      alternateText={t("signUp.haveAccountText")}
      description={t("signUp.description")}
      emailLabel={t("signUp.emailLabel")}
      emailPlaceholder={t("common.emailPlaceholder")}
      homeHref={`/${locale}`}
      homeLabel={t("common.homeLink")}
      passwordLabel={t("signUp.passwordLabel")}
      passwordPlaceholder={t("common.passwordPlaceholder")}
      statusNote={t("status.notConnectedYet")}
      submitLabel={t("signUp.submit")}
      title={t("signUp.title")}
    />
  );
}
