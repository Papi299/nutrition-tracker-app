import { useTranslations } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { AppShell } from "@/components/layout/app-shell";
import {
  requireAuthenticatedUser,
  resolveAuthLocale,
} from "@/lib/auth/require-user";
import type { Locale } from "@/lib/i18n/routing";

export const dynamic = "force-dynamic";

type ProtectedLayoutProps = Readonly<{
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}>;

export default async function ProtectedLayout({
  children,
  params,
}: ProtectedLayoutProps) {
  const { locale: localeInput } = await params;
  const locale = resolveAuthLocale(localeInput);

  setRequestLocale(locale);
  await requireAuthenticatedUser(locale);

  return (
    <LocalizedProtectedLayout locale={locale}>{children}</LocalizedProtectedLayout>
  );
}

function LocalizedProtectedLayout({
  children,
  locale,
}: {
  children: React.ReactNode;
  locale: Locale;
}) {
  const t = useTranslations("AppShell");

  return (
    <AppShell
      appName={t("appName")}
      locale={locale}
      navProfileTargets={t("nav.profileTargets")}
      navToday={t("nav.today")}
      protectedLabel={t("protectedLabel")}
      signOutLabel={t("signOut")}
    >
      {children}
    </AppShell>
  );
}
