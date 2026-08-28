import Link from "next/link";
import { useTranslations } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { LanguageSwitcher } from "@/components/language-switcher/language-switcher";
import { recoveryRequestPath } from "@/lib/auth/password-recovery";
import { routing, type Locale } from "@/lib/i18n/routing";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type RecoveryErrorPageProps = Readonly<{
  params: Promise<{ locale: Locale }>;
}>;

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export default async function RecoveryErrorPage({
  params,
}: RecoveryErrorPageProps) {
  const { locale } = await params;

  setRequestLocale(locale);

  return <LocalizedRecoveryError locale={locale} />;
}

function LocalizedRecoveryError({ locale }: { locale: Locale }) {
  const t = useTranslations("Auth.recoveryError");
  const homeT = useTranslations("HomePage");

  return (
    <main className="min-h-screen bg-stone-50 px-6 py-8 text-slate-950 sm:px-10 sm:py-12">
      <a className="skip-link" href="#main-content">
        {homeT("skipContent")}
      </a>
      <section
        className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-md flex-col justify-center gap-8"
        id="main-content"
        tabIndex={-1}
      >
        <LanguageSwitcher
          currentLabel={homeT("language.current")}
          currentLocale={locale}
          label={homeT("language.label")}
        />
        <div className="border border-red-200 bg-white p-6 shadow-sm sm:p-8">
          <h1 className="text-start text-3xl font-semibold text-slate-950">
            {t("title")}
          </h1>
          <p className="mt-4 text-start text-base leading-7 text-slate-700">
            {t("description")}
          </p>
          <Link
            className="mt-6 inline-block font-medium text-teal-700 hover:text-teal-900"
            href={recoveryRequestPath(locale)}
          >
            {t("restartLink")}
          </Link>
        </div>
      </section>
    </main>
  );
}
