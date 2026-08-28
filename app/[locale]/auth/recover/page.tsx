import Link from "next/link";
import { useTranslations } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { requestPasswordRecoveryAction } from "./actions";
import { RecoveryRequestForm } from "@/components/auth/recovery-request-form";
import { LanguageSwitcher } from "@/components/language-switcher/language-switcher";
import { redirectAuthenticatedUser } from "@/lib/auth/require-user";
import { routing, type Locale } from "@/lib/i18n/routing";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type RecoveryRequestPageProps = Readonly<{
  params: Promise<{ locale: Locale }>;
}>;

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export default async function RecoveryRequestPage({
  params,
}: RecoveryRequestPageProps) {
  const { locale } = await params;

  setRequestLocale(locale);
  await redirectAuthenticatedUser(locale);

  return <LocalizedRecoveryRequest locale={locale} />;
}

function LocalizedRecoveryRequest({ locale }: { locale: Locale }) {
  const t = useTranslations("Auth.recoveryRequest");
  const commonT = useTranslations("Auth.common");
  const homeT = useTranslations("HomePage");
  const action = requestPasswordRecoveryAction.bind(null, locale);

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
        <Link
          className="w-fit text-start text-sm font-medium text-teal-700 hover:text-teal-900"
          href={`/${locale}/auth/sign-in`}
        >
          {t("signInLink")}
        </Link>
        <div className="border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <h1 className="text-start text-3xl font-semibold text-slate-950">
            {t("title")}
          </h1>
          <p className="mt-4 text-start text-base leading-7 text-slate-700">
            {t("description")}
          </p>
          <div className="mt-8">
            <RecoveryRequestForm
              action={action}
              emailLabel={t("emailLabel")}
              emailPlaceholder={commonT("emailPlaceholder")}
              invalidEmailMessage={t("invalidEmail")}
              pendingLabel={t("pending")}
              statusIdle={t("statusIdle")}
              statusSuccess={t("statusSuccess")}
              submitLabel={t("submit")}
            />
          </div>
        </div>
      </section>
    </main>
  );
}
