import { signOutAction } from "@/app/[locale]/auth/actions";
import { Button } from "@/components/ui/button";
import type { Locale } from "@/lib/i18n/routing";

export function SignOutButton({
  label,
  locale,
}: {
  label: string;
  locale: Locale;
}) {
  const action = signOutAction.bind(null, locale);

  return (
    <form action={action}>
      <Button size="sm" type="submit" variant="outline">
        {label}
      </Button>
    </form>
  );
}
