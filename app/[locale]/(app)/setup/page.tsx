import { useTranslations } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { saveSetupAction } from "@/app/[locale]/(app)/setup/actions";
import type {
  SetupActionState,
  SetupFieldValues,
} from "@/app/[locale]/(app)/setup/action-state";
import { SetupForm } from "@/components/setup/setup-form";
import { resolveAuthLocale } from "@/lib/auth/require-user";
import { routing, type Locale } from "@/lib/i18n/routing";
import { getCurrentEffectiveTarget } from "@/lib/nutrition-targets";
import { getCurrentProfile } from "@/lib/profile";

type SetupPageProps = Readonly<{
  params: Promise<{ locale: string }>;
}>;

type SetupPageState = {
  hasProfile: boolean;
  values: SetupFieldValues;
};

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

function formatOptionalTargetValue(value: null | number) {
  return value === null ? "" : String(value);
}

async function getSetupPageState(locale: Locale): Promise<SetupPageState> {
  const [profileResult, targetResult] = await Promise.all([
    getCurrentProfile(),
    getCurrentEffectiveTarget(),
  ]);
  const profile = profileResult.ok ? profileResult.data : null;
  const target = targetResult.ok ? targetResult.data : null;

  return {
    hasProfile: profile !== null,
    values: {
      calories: formatOptionalTargetValue(target?.calories ?? null),
      carbohydrates_g: formatOptionalTargetValue(target?.carbohydrates_g ?? null),
      display_name: profile?.display_name ?? "",
      fat_g: formatOptionalTargetValue(target?.fat_g ?? null),
      preferred_language:
        profile?.preferred_language === "en" || profile?.preferred_language === "he"
          ? profile.preferred_language
          : locale,
      protein_g: formatOptionalTargetValue(target?.protein_g ?? null),
    },
  };
}

export default async function SetupPage({ params }: SetupPageProps) {
  const { locale: localeInput } = await params;
  const locale = resolveAuthLocale(localeInput);
  const pageState = await getSetupPageState(locale);

  setRequestLocale(locale);

  return <LocalizedSetupPage locale={locale} pageState={pageState} />;
}

function LocalizedSetupPage({
  locale,
  pageState,
}: {
  locale: Locale;
  pageState: SetupPageState;
}) {
  const t = useTranslations("Setup");
  const action = saveSetupAction.bind(null, locale);
  const initialState: SetupActionState = {
    status: "idle",
    values: pageState.values,
  };
  const title = pageState.hasProfile ? t("titleEdit") : t("titleInitial");
  const subtitle = pageState.hasProfile
    ? t("subtitleEdit")
    : t("subtitleInitial");
  const submitLabel = pageState.hasProfile ? t("submitEdit") : t("submitInitial");

  return (
    <section className="flex flex-1 flex-col justify-center gap-8 py-8 text-start">
      <div className="max-w-3xl">
        <p className="text-sm font-semibold uppercase tracking-[0.16em] text-teal-700">
          {t("label")}
        </p>
        <h1 className="mt-4 text-3xl font-semibold leading-tight text-slate-950 sm:text-5xl">
          {title}
        </h1>
        <p className="mt-5 max-w-2xl text-base leading-7 text-slate-700 sm:text-lg">
          {subtitle}
        </p>
      </div>

      <div className="max-w-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <SetupForm
          action={action}
          blankHelper={t("targets.blankHelper")}
          fieldErrorMessages={{
            invalid_integer: t("errors.invalidInteger"),
            invalid_input: t("errors.validation"),
            invalid_number: t("errors.invalidNumber"),
            invalid_type: t("errors.validation"),
            negative_value: t("errors.negativeValue"),
            too_long: t("errors.displayNameTooLong"),
            unsupported_field: t("errors.validation"),
            unsupported_language: t("errors.invalidLanguage"),
          }}
          initialState={initialState}
          labels={{
            calories: t("targets.caloriesLabel"),
            carbohydrates_g: t("targets.carbohydratesLabel"),
            display_name: t("profile.displayNameLabel"),
            fat_g: t("targets.fatLabel"),
            preferred_language: t("profile.preferredLanguageLabel"),
            protein_g: t("targets.proteinLabel"),
          }}
          languageOptions={[
            { label: t("profile.languageEnglish"), value: "en" },
            { label: t("profile.languageHebrew"), value: "he" },
          ]}
          pendingLabel={t("pending")}
          sectionCopy={{
            profileHelp: t("profile.displayNameHelp"),
            targetDescription: t("targets.description"),
            targetTitle: t("targets.title"),
          }}
          statusMessages={{
            database_error: t("errors.generic"),
            idle: t("status.idle"),
            profile_error: t("errors.profile"),
            success: t("status.success"),
            target_error: t("errors.target"),
            unauthenticated: t("errors.unauthenticated"),
            validation_error: t("errors.validation"),
          }}
          submitLabel={submitLabel}
        />
      </div>
    </section>
  );
}
