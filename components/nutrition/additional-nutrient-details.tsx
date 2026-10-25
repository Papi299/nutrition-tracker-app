import { useTranslations } from "next-intl";
import { nutrientManifestV1, type AdditionalNutrientCode } from "@/lib/nutrition-snapshots/manifest";
import { formatExactNutrientTotal, summarizeAdditionalSnapshots } from "@/lib/nutrition-snapshots/presentation";
import type { Locale } from "@/lib/i18n/routing";

export function AdditionalNutrientDetails({ snapshots, locale, daily = false }: {
  snapshots: readonly unknown[];
  locale: Locale;
  daily?: boolean;
}) {
  const t = useTranslations("Diary.additionalNutrients");
  if (!snapshots.length) return null;
  const summary = summarizeAdditionalSnapshots(snapshots);
  return <details className="mt-4 min-w-0 rounded-xl border border-border p-3 text-sm" data-testid={daily ? "daily-additional-nutrients" : "snapshot-additional-nutrients"}>
    <summary className="min-h-11 cursor-pointer content-center font-semibold [overflow-wrap:anywhere]">{t(daily ? "dailyTitle" : "detailsTitle")}</summary>
    {!summary.ok ? <p className="ui-body-secondary mt-3" role="status">{t("detailsUnavailable")}</p> : <>
      <p className="ui-body-secondary mt-3">{t("snapshotExplanation")}</p>
      {summary.uncapturedCount > 0 && <p className="ui-body-secondary mt-2">{daily ? t("uncapturedCount", { count: summary.uncapturedCount }) : t("uncaptured")}</p>}
      {summary.capturedCount > 0 && <div className="mt-3 grid min-w-0 gap-3">
        {(["additional", "minerals", "vitamins"] as const).map(group => <details className="min-w-0 rounded-lg border border-border p-3" key={group}>
          <summary className="min-h-11 cursor-pointer content-center font-semibold [overflow-wrap:anywhere]">{t(`groups.${group}`)}</summary>
          <dl className="mt-3 grid min-w-0 gap-3 sm:grid-cols-2">
            {nutrientManifestV1.filter(definition => definition.group === group).map(({ code, unit }) => {
              const total = summary.values[code as AdditionalNutrientCode];
              const amount = total.knownSubtotal === null ? null : `${formatExactNutrientTotal(total.knownSubtotal, locale)} ${unit}`;
              return <div className="min-w-0 [overflow-wrap:anywhere]" data-additional-nutrient-code={code} key={code}>
                <dt className="font-medium">{t(`labels.${code}`)}</dt>
                <dd className="mt-1 tabular-nums">
                  {total.complete ? <bdi>{amount}</bdi> : <>
                    <span>{t("unknown")}</span>
                    {amount !== null && <span className="block text-muted-foreground">{t("knownSubtotal")}: <bdi>{amount}</bdi></span>}
                  </>}
                </dd>
              </div>;
            })}
          </dl>
        </details>)}
      </div>}
    </>}
  </details>;
}
