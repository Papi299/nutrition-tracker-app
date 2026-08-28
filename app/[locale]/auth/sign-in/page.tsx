import { useTranslations } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { signInAction } from "@/app/[locale]/auth/actions";
import { AuthCard } from "@/components/auth/auth-card";
import { redirectAuthenticatedUser } from "@/lib/auth/require-user";
import { routing, type Locale } from "@/lib/i18n/routing";

export const dynamic = "force-dynamic";

type SignInPageProps = Readonly<{
  params: Promise<{ locale: Locale }>;
  searchParams: Promise<{ recovery?: string | string[] }>;
}>;

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export default async function SignInPage({
  params,
  searchParams,
}: SignInPageProps) {
  const { locale } = await params;
  const query = await searchParams;
  const recoveryCompleted = query.recovery === "complete";

  setRequestLocale(locale);
  await redirectAuthenticatedUser(locale);

  return (
    <LocalizedSignIn
      locale={locale}
      recoveryCompleted={recoveryCompleted}
    />
  );
}

function LocalizedSignIn({
  locale,
  recoveryCompleted,
}: {
  locale: Locale;
  recoveryCompleted: boolean;
}) {
  const t = useTranslations("Auth");
  const homeT = useTranslations("HomePage");
  const action = signInAction.bind(null, locale);

  return (
    <AuthCard
      action={action}
      alternateHref={`/${locale}/auth/sign-up`}
      alternateLabel={t("signIn.createAccountLink")}
      alternateText={t("signIn.createAccountText")}
      description={t("signIn.description")}
      emailLabel={t("signIn.emailLabel")}
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
      locale={locale}
      languageLabel={homeT("language.label")}
      currentLanguageLabel={homeT("language.current")}
      passwordLabel={t("signIn.passwordLabel")}
      passwordPlaceholder={t("common.passwordPlaceholder")}
      pendingLabel={t("signIn.pending")}
      recoveryHref={`/${locale}/auth/recover`}
      recoveryLabel={t("signIn.recoveryLink")}
      successNotice={
        recoveryCompleted ? t("signIn.recoveryComplete") : undefined
      }
      statusIdle={t("status.ready")}
      submitLabel={t("signIn.submit")}
      skipContent={homeT("skipContent")}
      title={t("signIn.title")}
    />
  );
}
