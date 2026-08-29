import { redirect } from "next/navigation";
import { useTranslations } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { reauthenticateWithPasswordAction } from "./actions";
import { ReauthenticationForm } from "@/components/auth/reauthentication-form";
import { LanguageSwitcher } from "@/components/language-switcher/language-switcher";
import { getAccountAccessState } from "@/lib/auth/account-access";
import { inspectRecentPasswordAuthentication } from "@/lib/auth/recent-password-auth";
import {
  accountClosedPath,
  activationPath,
  signInPath,
} from "@/lib/auth/require-user";
import {
  reauthenticationDestination,
  resolveReauthenticationIntent,
  type ReauthenticationIntent,
} from "@/lib/auth/reauthentication-intent";
import { routing, type Locale } from "@/lib/i18n/routing";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type ReauthenticationPageProps = Readonly<{
  params: Promise<{ locale: Locale }>;
  searchParams: Promise<{ intent?: string | string[] }>;
}>;

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export default async function ReauthenticationPage({
  params,
  searchParams,
}: ReauthenticationPageProps) {
  const { locale } = await params;
  const query = await searchParams;
  const intent = resolveReauthenticationIntent(query.intent);

  setRequestLocale(locale);
  const access = await getAccountAccessState();

  if (access.status === "unauthenticated") {
    redirect(signInPath(locale));
  }

  if (access.status === "closed") {
    redirect(accountClosedPath(locale));
  }

  if (access.status === "activation_required") {
    redirect(activationPath(locale));
  }

  if (access.status !== "active") {
    redirect(signInPath(locale));
  }

  const recentAuthentication = await inspectRecentPasswordAuthentication();

  if (recentAuthentication.status === "valid") {
    redirect(reauthenticationDestination(locale, intent));
  }

  return <LocalizedReauthenticationPage intent={intent} locale={locale} />;
}

function LocalizedReauthenticationPage({
  intent,
  locale,
}: {
  intent: ReauthenticationIntent | null;
  locale: Locale;
}) {
  const t = useTranslations("Auth.reauthentication");
  const homeT = useTranslations("HomePage");
  const action = reauthenticateWithPasswordAction.bind(null, locale, intent);

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
        <div className="border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <h1 className="text-start text-3xl font-semibold text-slate-950">
            {t("title")}
          </h1>
          <p className="mt-4 text-start text-base leading-7 text-slate-700">
            {t("description")}
          </p>
          <div className="mt-8">
            <ReauthenticationForm
              action={action}
              errorMessages={{
                passwordRequired: t("errors.passwordRequired"),
                unavailable: t("errors.unavailable"),
                verificationFailed: t("errors.verificationFailed"),
              }}
              passwordLabel={t("passwordLabel")}
              pendingLabel={t("pending")}
              statusIdle={t("statusIdle")}
              submitLabel={t("submit")}
            />
          </div>
        </div>
      </section>
    </main>
  );
}
