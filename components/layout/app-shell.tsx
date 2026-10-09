import { AppNavigation } from "@/components/layout/app-navigation";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { LanguageSwitcher } from "@/components/language-switcher/language-switcher";
import type { Locale } from "@/lib/i18n/routing";

export function AppShell({
  appName,
  children,
  locale,
  languageLabel,
  currentLanguageLabel,
  navAccount,
  navBarcodeLookup,
  navFoodSearch,
  navMyFoods,
  navProfileTargets,
  navReusableFoods,
  navRecipes,
  navSavedMeals,
  navToday,
  protectedLabel,
  signOutLabel,
  skipContent,
}: {
  appName: string;
  children: React.ReactNode;
  locale: Locale;
  languageLabel: string;
  currentLanguageLabel: string;
  navAccount: string;
  navBarcodeLookup: string;
  navFoodSearch: string;
  navMyFoods: string;
  navProfileTargets: string;
  navReusableFoods: string;
  navRecipes: string;
  navSavedMeals: string;
  navToday: string;
  protectedLabel: string;
  signOutLabel: string;
  skipContent: string;
}) {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <a className="skip-link" href="#main-content">
        {skipContent}
      </a>
      <section className="mx-auto flex min-h-screen w-full max-w-5xl flex-col gap-8 px-4 py-5 sm:px-8 sm:py-8">
        <header className="flex flex-col gap-5 rounded-xl border border-border bg-surface p-5 shadow-xs sm:flex-row sm:items-center sm:justify-between sm:p-6">
          <div className="min-w-0 shrink-0 text-start">
            <p className="ui-card-title">{appName}</p>
            <p className="mt-1 ui-body-secondary">{protectedLabel}</p>
            <div className="mt-3">
              <LanguageSwitcher
                currentLabel={currentLanguageLabel}
                currentLocale={locale}
                label={languageLabel}
              />
            </div>
          </div>

          <nav
            aria-label={protectedLabel}
            className="flex min-w-0 flex-wrap items-center gap-2"
          >
            <AppNavigation
              labels={{
                today: navToday,
                foodSearch: navFoodSearch,
                barcodeLookup: navBarcodeLookup,
                reusableFoods: navReusableFoods,
                myFoods: navMyFoods,
                savedMeals: navSavedMeals,
                recipes: navRecipes,
                profileTargets: navProfileTargets,
                account: navAccount,
              }}
              locale={locale}
            />
            <SignOutButton label={signOutLabel} locale={locale} />
          </nav>
        </header>

        <div id="main-content" tabIndex={-1}>
          {children}
        </div>
      </section>
    </main>
  );
}
