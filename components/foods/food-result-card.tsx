import type { ReactNode } from "react";
import { surfaceStyles } from "@/components/ui/card";

export function FoodResultCard({
  actions,
  brand,
  children,
  foodId,
  name,
  serving,
  servingLabel,
}: {
  actions: ReactNode;
  brand?: string | null;
  children: ReactNode;
  foodId: string;
  name: string;
  serving?: string | null;
  servingLabel: string;
}) {
  return (
    <li
      className={surfaceStyles({ className: "flex min-w-0 flex-col gap-3 p-4 sm:p-5" })}
      data-food-id={foodId}
    >
      <div className="min-w-0">
        <h3 className="ui-card-title [overflow-wrap:anywhere]" dir="auto">
          <bdi>{name}</bdi>
        </h3>
        {brand && (
          <p className="ui-body-secondary mt-1 [overflow-wrap:anywhere]" dir="auto">
            <bdi>{brand}</bdi>
          </p>
        )}
        {serving && (
          <p className="mt-2 text-sm text-muted-foreground">
            <span>{servingLabel}: </span>
            <bdi className="font-medium text-foreground [overflow-wrap:anywhere]">{serving}</bdi>
          </p>
        )}
      </div>
      <div className="flex flex-wrap items-start gap-2">{actions}</div>
      {children}
    </li>
  );
}
