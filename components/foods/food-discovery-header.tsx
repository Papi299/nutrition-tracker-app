import Link from "next/link";
import { CalendarDays } from "lucide-react";
import { useTranslations } from "next-intl";
import { buttonStyles } from "@/components/ui/button";
import { formatLocalizedDate } from "@/lib/i18n/format";
import type { Locale } from "@/lib/i18n/routing";

export function FoodDiscoveryHeader({
  description,
  eyebrow,
  locale,
  returnHref,
  selectedDate,
  title,
}: {
  description: string;
  eyebrow?: string;
  locale: Locale;
  returnHref?: string;
  selectedDate?: string | null;
  title: string;
}) {
  const t = useTranslations("FoodDiscovery");
  const diaryHref = returnHref ?? `/${locale}/today${selectedDate ? `?date=${selectedDate}` : ""}`;

  return (
    <header className="min-w-0">
      {eyebrow && <p className="ui-eyebrow mb-1">{eyebrow}</p>}
      <h1 className="ui-page-title">{title}</h1>
      <p className="ui-body-secondary mt-2 max-w-2xl">{description}</p>
      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
        <Link
          className={buttonStyles({ variant: "ghost", size: "sm", className: "-ms-3" })}
          href={diaryHref}
        >
          <CalendarDays aria-hidden="true" size={16} />
          {t("backToDiary")}
        </Link>
        {selectedDate && (
          <p className="ui-caption">
            {t("selectedDate")}{" "}
            <time dateTime={selectedDate}>
              <bdi>{formatLocalizedDate(locale, selectedDate)}</bdi>
            </time>
          </p>
        )}
      </div>
    </header>
  );
}
