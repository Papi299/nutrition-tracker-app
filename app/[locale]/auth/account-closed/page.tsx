import Link from "next/link";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { LanguageSwitcher } from "@/components/language-switcher/language-switcher";
import { routing, type Locale } from "@/lib/i18n/routing";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export default async function AccountClosedPage({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("Auth.accountClosed");
  const homeT = await getTranslations("HomePage");

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
          <p className="mt-3 text-start text-sm leading-6 text-slate-600">
            {t("dataNotice")}
          </p>
          <Link
            className="mt-6 inline-flex min-h-12 items-center font-semibold text-teal-800 underline decoration-2 underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-800"
            href={`/${locale}`}
          >
            {t("home")}
          </Link>
        </div>
      </section>
    </main>
  );
}
