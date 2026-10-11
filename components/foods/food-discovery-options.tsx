import Link from "next/link";
import { BookOpen, CookingPot, List, Plus } from "lucide-react";
import { useTranslations } from "next-intl";
import { buttonStyles } from "@/components/ui/button";
import type { Locale } from "@/lib/i18n/routing";

export function FoodDiscoveryOptions({
  locale,
  selectedDate,
}: {
  locale: Locale;
  selectedDate?: string | null;
}) {
  const t = useTranslations("FoodDiscovery");
  const dateQuery = selectedDate ? `?date=${selectedDate}` : "";
  const destinations = [
    { id: "savedMeals", path: `/saved-meals${dateQuery}`, Icon: CookingPot },
    { id: "recipes", path: `/recipes${dateQuery}`, Icon: BookOpen },
    { id: "createCustom", path: "/foods/custom/new", Icon: Plus },
    { id: "manageCustom", path: "/foods/custom", Icon: List },
  ] as const;

  return (
    <details className="min-w-0" data-testid="food-discovery-options">
      <summary className="min-h-11 cursor-pointer py-2.5 text-sm font-semibold text-muted-foreground">
        {t("moreOptions")}
      </summary>
      <div className="flex flex-wrap gap-2 pb-2 pt-1">
        {destinations.map(({ id, path, Icon }) => (
          <Link
            className={buttonStyles({ variant: "outline", size: "sm" })}
            href={`/${locale}${path}`}
            key={id}
          >
            <Icon aria-hidden="true" size={16} />
            {t(id)}
          </Link>
        ))}
      </div>
    </details>
  );
}
