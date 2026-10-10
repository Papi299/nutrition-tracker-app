import { signOutAction } from "@/app/[locale]/auth/actions";
import { NavigationIcon } from "@/components/layout/navigation-icons";
import { Button } from "@/components/ui/button";
import type { Locale } from "@/lib/i18n/routing";

export function SignOutButton({
  label,
  locale,
  navigation = false,
}: {
  label: string;
  locale: Locale;
  navigation?: boolean;
}) {
  const action = signOutAction.bind(null, locale);

  return (
    <form action={action}>
      <Button className={navigation ? "ui-navigation-row" : undefined} size="sm" type="submit" variant={navigation ? "ghost" : "outline"}>
        {navigation ? <NavigationIcon id="signOut" /> : null}
        {label}
      </Button>
    </form>
  );
}
