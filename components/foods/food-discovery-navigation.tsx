import Link from "next/link";
import { History, ScanBarcode, Search } from "lucide-react";
import { useTranslations } from "next-intl";
import { buttonStyles } from "@/components/ui/button";
import type { Locale } from "@/lib/i18n/routing";
import type { DiaryEntryMealType } from "@/lib/diary-entries/validation";

type DiscoveryDestination = "search" | "reuse" | "barcode";

export function FoodDiscoveryNavigation({
  current,
  locale,
  mealType,
  selectedDate,
}: {
  current: DiscoveryDestination;
  locale: Locale;
  mealType?: DiaryEntryMealType | null;
  selectedDate?: string | null;
}) {
  const t = useTranslations("FoodDiscovery");
  const destinations = [
    { id: "search", path: "/foods", Icon: Search },
    { id: "reuse", path: "/foods/reuse", Icon: History },
    { id: "barcode", path: "/foods/barcode", Icon: ScanBarcode },
  ] as const;

  return (
    <nav
      aria-label={t("navigationLabel")}
      className="min-w-0 rounded-2xl border border-border bg-surface-subtle p-1"
      data-testid="food-discovery-navigation"
    >
      <ul className="grid min-w-0 grid-cols-3 gap-1">
        {destinations.map(({ id, path, Icon }) => {
          const query = new URLSearchParams();
          if (selectedDate) query.set("date", selectedDate);
          if (id === "barcode" && mealType) query.set("mealType", mealType);
          return (
          <li className="min-w-0" key={id}>
            <Link
              aria-current={current === id ? "page" : undefined}
              className={buttonStyles({
                variant: "ghost",
                size: "sm",
                className: `h-full w-full flex-col gap-1 px-2 py-2 text-xs sm:flex-row sm:text-sm${current === id ? " ui-current" : ""}`,
              })}
              href={`/${locale}${path}${query.size ? `?${query.toString()}` : ""}`}
            >
              <Icon aria-hidden="true" className="shrink-0" size={18} />
              <span>{t(id)}</span>
            </Link>
          </li>
          );
        })}
      </ul>
    </nav>
  );
}
