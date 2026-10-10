import type { NavigationCopy } from "@/components/layout/primary-navigation";
import { NavigationIcon } from "@/components/layout/navigation-icons";
import { AppNavigation } from "@/components/layout/app-navigation";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { LanguageSwitcher } from "@/components/language-switcher/language-switcher";
import type { Locale } from "@/lib/i18n/routing";

export function AppShell({
  appName,
  navigationCopy,
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
  navigationCopy: NavigationCopy;
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
  const labels = {
    today: navToday,
    foodSearch: navFoodSearch,
    barcodeLookup: navBarcodeLookup,
    reusableFoods: navReusableFoods,
    myFoods: navMyFoods,
    savedMeals: navSavedMeals,
    recipes: navRecipes,
    profileTargets: navProfileTargets,
    account: navAccount,
  };
  const systemActions = (
    <div className="shell-system-actions">
      <div>
        <p className="shell-language-label ui-caption"><NavigationIcon id="language" />{languageLabel}</p>
        <LanguageSwitcher currentLabel={currentLanguageLabel} currentLocale={locale} label={languageLabel} />
      </div>
      <SignOutButton label={signOutLabel} locale={locale} navigation />
    </div>
  );

  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">{skipContent}</a>
      <aside className="desktop-sidebar" data-testid="desktop-sidebar">
        <header className="sidebar-brand">
          <p className="ui-card-title">{appName}</p>
          <p className="mt-1 ui-caption">{protectedLabel}</p>
        </header>
        <AppNavigation copy={navigationCopy} labels={labels} locale={locale} />
        {systemActions}
      </aside>
      <div className="app-workspace">
        <header className="mobile-app-header"><p>{appName}</p></header>
        <main className="app-content" id="main-content" tabIndex={-1}>{children}</main>
      </div>
      <AppNavigation copy={navigationCopy} labels={labels} locale={locale} mobile secondaryActions={systemActions} />
    </div>
  );
}
