import type { Metadata } from "next";
import { hasLocale, NextIntlClientProvider } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { localeDirections, routing, type Locale } from "@/lib/i18n/routing";
import "../globals.css";

const metadataByLocale: Record<Locale, Metadata> = {
  en: {
    title: "Nutrition Tracker Foundation",
    description:
      "Initial foundation for a bilingual Hebrew/English nutrition tracker.",
  },
  he: {
    title: "יסודות למעקב תזונה",
    description: "תשתית ראשונית לאפליקציית מעקב תזונה בעברית ובאנגלית.",
  },
};

type LocaleLayoutProps = Readonly<{
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}>;

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({
  params,
}: Pick<LocaleLayoutProps, "params">): Promise<Metadata> {
  const { locale } = await params;

  if (!hasLocale(routing.locales, locale)) {
    return metadataByLocale[routing.defaultLocale];
  }

  return metadataByLocale[locale];
}

export default async function LocaleLayout({
  children,
  params,
}: LocaleLayoutProps) {
  const { locale } = await params;

  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  setRequestLocale(locale);

  return (
    <html lang={locale} dir={localeDirections[locale]} className="h-full">
      <body className="min-h-full">
        <NextIntlClientProvider>{children}</NextIntlClientProvider>
      </body>
    </html>
  );
}
