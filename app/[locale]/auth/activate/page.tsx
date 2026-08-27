import { useTranslations } from "next-intl";
import { redirect } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { activateAccountAction } from "@/app/[locale]/auth/activate/actions";
import { ActivationForm } from "@/components/auth/activation-form";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { getAccountActivationState } from "@/lib/auth/account-activation";
import {
  protectedHomePath,
  signInPath,
} from "@/lib/auth/require-user";
import { routing, type Locale } from "@/lib/i18n/routing";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type ActivationPageProps = Readonly<{
  params: Promise<{ locale: Locale }>;
}>;

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export default async function ActivationPage({ params }: ActivationPageProps) {
  const { locale } = await params;

  setRequestLocale(locale);
  const state = await getAccountActivationState();

  if (state.status === "unauthenticated") {
    redirect(signInPath(locale));
  }

  if (state.status === "complete") {
    redirect(protectedHomePath(locale));
  }

  return <LocalizedActivationPage locale={locale} />;
}

function LocalizedActivationPage({ locale }: { locale: Locale }) {
  const t = useTranslations("Auth.activation");
  const action = activateAccountAction.bind(null, locale);

  return (
    <main className="min-h-screen bg-stone-50 px-6 py-8 text-slate-950 sm:px-10 sm:py-12">
      <a className="skip-link" href="#main-content">
        {t("skipContent")}
      </a>
      <section
        className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-lg flex-col justify-center gap-6"
        id="main-content"
        tabIndex={-1}
      >
        <div className="border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <h1 className="text-start text-3xl font-semibold text-slate-950">
            {t("title")}
          </h1>
          <p className="mt-4 text-start text-base leading-7 text-slate-700">
            {t("description")}
          </p>
          <p className="mt-3 text-start text-sm leading-6 text-slate-600">
            {t("participationStatement")}
          </p>
          <div className="mt-8">
            <ActivationForm
              action={action}
              ageLabel={t("ageLabel")}
              errorMessages={{
                activationFailed: t("errors.activationFailed"),
                ageRequired: t("errors.ageRequired"),
                israelRequired: t("errors.israelRequired"),
                missingConfig: t("errors.missingConfig"),
                passwordMismatch: t("errors.passwordMismatch"),
                passwordRequired: t("errors.passwordRequired"),
                passwordTooShort: t("errors.passwordTooShort"),
              }}
              israelLabel={t("israelLabel")}
              passwordConfirmationLabel={t("passwordConfirmationLabel")}
              passwordLabel={t("passwordLabel")}
              pendingLabel={t("pending")}
              statusIdle={t("statusIdle")}
              submitLabel={t("submit")}
            />
          </div>
        </div>
        <div className="flex justify-end">
          <SignOutButton label={t("signOut")} locale={locale} />
        </div>
      </section>
    </main>
  );
}
