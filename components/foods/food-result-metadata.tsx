import type { ReactNode } from "react";
import { useTranslations } from "next-intl";

export function FoodResultMetadata({
  children,
  className = "",
  summary,
}: {
  children: ReactNode;
  className?: string;
  summary?: string;
}) {
  const t = useTranslations("FoodDiscovery");

  return (
    <details className={`min-w-0 border-t border-border [overflow-wrap:anywhere] ${className}`.trim()}>
      <summary className="min-h-11 cursor-pointer py-2.5 text-sm font-semibold text-muted-foreground">
        {summary ?? t("details")}
      </summary>
      <div className="min-w-0 pb-1 pt-1">{children}</div>
    </details>
  );
}

export function FoodMetadata({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
      <dd className="mt-1 text-sm text-foreground [overflow-wrap:anywhere]">
        <bdi>{value}</bdi>
      </dd>
    </div>
  );
}
