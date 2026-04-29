import { useTranslations } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { signUpAction } from "@/app/[locale]/auth/actions";
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
  const action = signUpAction.bind(null, locale);

  return (
    <AuthCard
      action={action}
      alternateHref={`/${locale}/auth/sign-in`}
      alternateLabel={t("signUp.haveAccountLink")}
      alternateText={t("signUp.haveAccountText")}
      autoComplete="new-password"
      description={t("signUp.description")}
      emailLabel={t("signUp.emailLabel")}
      emailPlaceholder={t("common.emailPlaceholder")}
      errorMessages={{
        authFailed: t("errors.authFailed"),
        invalidEmail: t("errors.invalidEmail"),
        missingConfig: t("errors.missingConfig"),
        passwordRequired: t("errors.passwordRequired"),
        passwordTooShort: t("errors.passwordTooShort"),
      }}
      homeHref={`/${locale}`}
      homeLabel={t("common.homeLink")}
      passwordLabel={t("signUp.passwordLabel")}
      passwordPlaceholder={t("common.passwordPlaceholder")}
      pendingLabel={t("signUp.pending")}
      statusIdle={t("status.ready")}
      successMessages={{
        checkEmail: t("status.checkEmail"),
      }}
      submitLabel={t("signUp.submit")}
      title={t("signUp.title")}
    />
  );
}
