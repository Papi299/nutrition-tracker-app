import Link from "next/link";
import { useTranslations } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { resolveAuthLocale } from "@/lib/auth/require-user";
import { routing } from "@/lib/i18n/routing";
import {
  getCurrentEffectiveTarget,
  type NutritionTarget,
} from "@/lib/nutrition-targets";
import { getCurrentProfile } from "@/lib/profile";

type TodayPageProps = Readonly<{
  params: Promise<{ locale: string }>;
}>;

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export default async function TodayPage({ params }: TodayPageProps) {
  const { locale: localeInput } = await params;
  const locale = resolveAuthLocale(localeInput);
  const [profileResult, targetResult] = await Promise.all([
    getCurrentProfile(),
    getCurrentEffectiveTarget(),
  ]);
  const hasProfile = profileResult.ok && profileResult.data !== null;
  const target = targetResult.ok ? targetResult.data : null;

  setRequestLocale(locale);

  return (
    <LocalizedTodayPage
      hasProfile={hasProfile}
      locale={locale}
      target={target}
    />
  );
}

function LocalizedTodayPage({
  hasProfile,
  locale,
  target,
}: {
  hasProfile: boolean;
  locale: string;
  target: NutritionTarget | null;
}) {
  const t = useTranslations("AppShell.today");
  const targetItems = [
    {
      label: t("targetSummary.calories"),
      value: formatTargetValue(target?.calories ?? null, t("targetSummary.notSet")),
    },
    {
      label: t("targetSummary.protein"),
      value: formatTargetValue(target?.protein_g ?? null, t("targetSummary.notSet")),
    },
    {
      label: t("targetSummary.carbohydrates"),
      value: formatTargetValue(
        target?.carbohydrates_g ?? null,
        t("targetSummary.notSet"),
      ),
    },
    {
      label: t("targetSummary.fat"),
      value: formatTargetValue(target?.fat_g ?? null, t("targetSummary.notSet")),
    },
  ];

  return (
    <section className="flex flex-1 flex-col justify-center gap-8 py-8 text-start">
      <div className="max-w-3xl">
        <p className="text-sm font-semibold uppercase tracking-[0.16em] text-teal-700">
          {t("label")}
        </p>
        <h1 className="mt-4 text-3xl font-semibold leading-tight text-slate-950 sm:text-5xl">
          {t("title")}
        </h1>
        <p className="mt-5 max-w-2xl text-base leading-7 text-slate-700 sm:text-lg">
          {t("description")}
        </p>
      </div>

      <div className="max-w-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <h2 className="text-lg font-semibold text-slate-950">
          {t("placeholderTitle")}
        </h2>
        <p className="mt-3 text-sm leading-6 text-slate-700">
          {t("placeholderBody")}
        </p>
      </div>

      {!hasProfile && (
        <div className="max-w-2xl border border-teal-200 bg-teal-50 p-5 shadow-sm sm:p-6">
          <h2 className="text-lg font-semibold text-slate-950">
            {t("setupCalloutTitle")}
          </h2>
          <p className="mt-3 text-sm leading-6 text-slate-700">
            {t("setupCalloutBody")}
          </p>
          <Link
            className="mt-5 inline-flex min-h-10 items-center bg-teal-700 px-4 text-sm font-semibold text-white transition-colors hover:bg-teal-800"
            href={`/${locale}/setup`}
          >
            {t("setupCalloutLink")}
          </Link>
        </div>
      )}

      {hasProfile && target === null && (
        <div className="max-w-2xl border border-amber-200 bg-amber-50 p-5 shadow-sm sm:p-6">
          <h2 className="text-lg font-semibold text-slate-950">
            {t("targetEmptyTitle")}
          </h2>
          <p className="mt-3 text-sm leading-6 text-slate-700">
            {t("targetEmptyBody")}
          </p>
          <Link
            className="mt-5 inline-flex min-h-10 items-center bg-teal-700 px-4 text-sm font-semibold text-white transition-colors hover:bg-teal-800"
            href={`/${locale}/setup`}
          >
            {t("targetEmptyLink")}
          </Link>
        </div>
      )}

      {hasProfile && target !== null && (
        <div className="max-w-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-950">
                {t("targetSummary.title")}
              </h2>
              <p className="mt-3 text-sm leading-6 text-slate-700">
                {t("targetSummary.body")}
              </p>
            </div>
            <Link
              className="inline-flex min-h-10 items-center justify-center border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-800 transition-colors hover:border-teal-700 hover:text-teal-800"
              href={`/${locale}/setup`}
            >
              {t("targetSummary.editLink")}
            </Link>
          </div>

          <dl className="mt-6 grid gap-3 sm:grid-cols-2">
            {targetItems.map((item) => (
              <div
                className="border border-slate-200 bg-stone-50 p-4"
                key={item.label}
              >
                <dt className="text-sm font-medium text-slate-600">
                  {item.label}
                </dt>
                <dd className="mt-2 text-2xl font-semibold text-slate-950">
                  {item.value}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      )}
    </section>
  );
}

function formatTargetValue(value: null | number | string, notSetLabel: string) {
  return value === null ? notSetLabel : String(value);
}
