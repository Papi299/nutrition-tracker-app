import { useTranslations } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { InvitationOnlyCard } from "@/components/auth/invitation-only-card";
import { redirectAuthenticatedUser } from "@/lib/auth/require-user";
import { routing, type Locale } from "@/lib/i18n/routing";

export const dynamic = "force-dynamic";

type SignUpPageProps = Readonly<{
  params: Promise<{ locale: Locale }>;
}>;

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export default async function SignUpPage({ params }: SignUpPageProps) {
  const { locale } = await params;

  setRequestLocale(locale);
  await redirectAuthenticatedUser(locale);

  return <LocalizedSignUp locale={locale} />;
}

function LocalizedSignUp({ locale }: { locale: Locale }) {
  const t = useTranslations("Auth");
  const homeT = useTranslations("HomePage");

  return (
    <InvitationOnlyCard
      activatedLinkLabel={t("signUp.haveAccountLink")}
      activatedText={t("signUp.haveAccountText")}
      currentLanguageLabel={homeT("language.current")}
      description={t("signUp.description")}
      homeLabel={t("common.homeLink")}
      invitationInstruction={t("signUp.invitationInstruction")}
      languageLabel={homeT("language.label")}
      locale={locale}
      skipContent={homeT("skipContent")}
      title={t("signUp.title")}
    />
  );
}
