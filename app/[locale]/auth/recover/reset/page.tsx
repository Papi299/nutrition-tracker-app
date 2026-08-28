import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { useTranslations } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { completePasswordRecoveryAction } from "./actions";
import { RecoveryResetForm } from "@/components/auth/recovery-reset-form";
import {
  hasOneBoundedRecoveryToken,
  recoveryCookieName,
  recoveryErrorPath,
} from "@/lib/auth/password-recovery";
import { routing, type Locale } from "@/lib/i18n/routing";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type RecoveryResetPageProps = Readonly<{
  params: Promise<{ locale: Locale }>;
}>;

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export default async function RecoveryResetPage({
  params,
}: RecoveryResetPageProps) {
  const { locale } = await params;

  setRequestLocale(locale);
  const cookieStore = await cookies();
  const tokenHash = cookieStore.get(recoveryCookieName(locale))?.value ?? "";

  if (!hasOneBoundedRecoveryToken([tokenHash])) {
    redirect(recoveryErrorPath(locale));
  }

  return <LocalizedRecoveryReset locale={locale} />;
}

function LocalizedRecoveryReset({ locale }: { locale: Locale }) {
  const t = useTranslations("Auth.recoveryReset");
  const action = completePasswordRecoveryAction.bind(null, locale);

  return (
    <main className="min-h-screen bg-stone-50 px-6 py-8 text-slate-950 sm:px-10 sm:py-12">
      <a className="skip-link" href="#main-content">
        {t("skipContent")}
      </a>
      <section
        className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-md flex-col justify-center"
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
          <div className="mt-8">
            <RecoveryResetForm
              action={action}
              errorMessages={{
                passwordMismatch: t("errors.passwordMismatch"),
                passwordRequired: t("errors.passwordRequired"),
                passwordTooShort: t("errors.passwordTooShort"),
              }}
              passwordConfirmationLabel={t("passwordConfirmationLabel")}
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
