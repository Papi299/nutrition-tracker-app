import { useTranslations } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { PublicShell } from "@/components/layout/public-shell";
import { routing, type Locale } from "@/lib/i18n/routing";

const pillarKeys = [
  "foodLogging",
  "manualTargets",
  "bilingualSupport",
  "customFoods",
  "dataTransparency",
] as const;

type HomePageProps = Readonly<{
  params: Promise<{ locale: Locale }>;
}>;

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export default async function HomePage({ params }: HomePageProps) {
  const { locale } = await params;

  setRequestLocale(locale);

  return <LocalizedHome locale={locale} />;
}

function LocalizedHome({ locale }: { locale: Locale }) {
  const t = useTranslations("HomePage");

  return (
    <PublicShell
      locale={locale}
      appName={t("appName")}
      navHome={t("nav.home")}
      languageLabel={t("language.label")}
      currentLanguageLabel={t("language.current")}
      foundationLabel={t("foundationLabel")}
      title={t("title")}
      description={t("description")}
      pillarsTitle={t("pillarsTitle")}
      pillars={pillarKeys.map((key) => t(`pillars.${key}`))}
      statusTitle={t("status.title")}
      statusBody={t("status.body")}
      mixedSampleLabel={t("mixedSample.label")}
      mixedSampleText={t("mixedSample.text")}
    />
  );
}
