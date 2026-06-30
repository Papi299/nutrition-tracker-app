import Link from "next/link";
import { SignOutButton } from "@/components/auth/sign-out-button";
import type { Locale } from "@/lib/i18n/routing";

export function AppShell({
  appName,
  children,
  locale,
  navProfileTargets,
  navToday,
  protectedLabel,
  signOutLabel,
}: {
  appName: string;
  children: React.ReactNode;
  locale: Locale;
  navProfileTargets: string;
  navToday: string;
  protectedLabel: string;
  signOutLabel: string;
}) {
  return (
    <main className="min-h-screen bg-stone-50 text-slate-950">
      <section className="mx-auto flex min-h-screen w-full max-w-5xl flex-col gap-8 px-6 py-8 sm:px-10 sm:py-10">
        <header className="flex flex-col gap-4 border-b border-slate-200 pb-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-start">
            <p className="text-lg font-semibold text-slate-950">{appName}</p>
            <p className="mt-1 text-sm text-slate-600">{protectedLabel}</p>
          </div>

          <nav
            aria-label={protectedLabel}
            className="flex flex-wrap items-center gap-3"
          >
            <Link
              className="min-h-10 bg-teal-700 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-teal-800"
              href={`/${locale}/today`}
            >
              {navToday}
            </Link>
            <Link
              className="min-h-10 border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-800 transition-colors hover:border-teal-700 hover:text-teal-800"
              href={`/${locale}/setup`}
            >
              {navProfileTargets}
            </Link>
            <SignOutButton label={signOutLabel} locale={locale} />
          </nav>
        </header>

        {children}
      </section>
    </main>
  );
}
