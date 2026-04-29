import { signOutAction } from "@/app/[locale]/auth/actions";
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
      <button
        className="min-h-10 border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-800 transition-colors hover:border-teal-700 hover:text-teal-800"
        type="submit"
      >
        {label}
      </button>
    </form>
  );
}
