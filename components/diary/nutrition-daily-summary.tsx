/** @jsxImportSource react */
import Link from "next/link";
import { useTranslations } from "next-intl";
import { buttonStyles } from "@/components/ui/button";
import {
  calculateDiaryTotals,
  countUnknownDiaryNutrients,
  compareNutritionTarget,
  roundDiaryValue,
  type NutrientKey,
} from "@/lib/diary-presentation";
import type { DiaryEntry } from "@/lib/diary-entries";
import { formatLocalizedDate, formatLocalizedNumber } from "@/lib/i18n/format";
import type { Locale } from "@/lib/i18n/routing";
import type { NutritionTarget } from "@/lib/nutrition-targets";

const keys = ["calories", "protein_g", "carbohydrates_g", "fat_g"] as const;

export function NutritionDailySummary({ entries, locale, selectedDate, target, targetUnavailable }: {
  entries: DiaryEntry[];
  locale: Locale;
  selectedDate: string;
  target: NutritionTarget | null;
  targetUnavailable: boolean;
}) {
  const t = useTranslations("Diary.dashboard");
  const todayT = useTranslations("AppShell.today");
  const totalsT = useTranslations("Diary.totals");
  const totals = calculateDiaryTotals(entries);
  const unknownCounts = countUnknownDiaryNutrients(entries);
  const hasUnknownValues = keys.some((key) => unknownCounts[key] > 0);
  const hasConfiguredTargets = !targetUnavailable && keys.some((key) => target?.[key] != null);
  const names = { calories: t("calories"), protein_g: totalsT("protein"), carbohydrates_g: totalsT("carbohydrates"), fat_g: totalsT("fat") };
  const units = { calories: t("unitCalories"), protein_g: totalsT("unitGrams"), carbohydrates_g: totalsT("unitGrams"), fat_g: totalsT("unitGrams") };
  const valueText = (value: number, key: NutrientKey) =>
    `${formatLocalizedNumber(locale, roundDiaryValue(value, key), { maximumFractionDigits: key === "calories" ? 0 : 2 })} ${units[key]}`;

  return (
    <section className="nutrition-daily-summary" aria-labelledby="daily-totals-title" data-testid={target ? "target-summary" : undefined}>
      <h2 className="sr-only" id="daily-totals-title">{totalsT("title")}</h2>
      <div className="nutrition-summary" data-testid={targetUnavailable ? undefined : "target-progress"}>
        {keys.map((key) => {
          const targetValue = targetUnavailable ? null : target?.[key] ?? null;
          const incomplete = unknownCounts[key] > 0;
          const comparison = incomplete ? null : compareNutritionTarget(totals[key], targetValue);
          const targetText = targetUnavailable ? t("unavailable") : targetValue === null ? todayT("targetSummary.notSet") : valueText(targetValue, key);
          const remainingText = comparison === null || comparison.remaining === null ? null : comparison.remaining < 0
            ? t("overTarget", { value: valueText(Math.abs(comparison.remaining), key) })
            : t("remaining", { value: valueText(comparison.remaining, key) });
          const percentText = comparison === null || comparison.percent === null ? null : t("percent", { percent: formatLocalizedNumber(locale, comparison.percent, { maximumFractionDigits: 0 }) });

          return (
            <article className={`nutrition-metric nutrition-${key}`} data-nutrition-metric={key} data-unknown-count={unknownCounts[key]} data-testid={key === "calories" ? "calorie-summary" : undefined} key={key}>
              <h3 className="ui-label">{names[key]}</h3>
              <dl className="nutrition-values">
                <div>
                  <dt className="sr-only">{incomplete ? t("knownSubtotal") : t("consumed")}</dt>
                  <dd className="nutrition-consumed"><bdi>{formatLocalizedNumber(locale, roundDiaryValue(totals[key], key), { maximumFractionDigits: key === "calories" ? 0 : 2 })}<span className={targetValue === null ? "nutrition-unit" : "sr-only"}> {units[key]}</span></bdi></dd>
                </div>
                {(hasConfiguredTargets || targetUnavailable) && (
                  <div>
                    <dt className="sr-only">{t("target")}</dt>
                    <dd className="nutrition-target">{targetValue !== null && <span aria-hidden="true">/ </span>}<bdi>{targetText}</bdi></dd>
                  </div>
                )}
              </dl>
              {incomplete && <p className="nutrition-known-subtotal ui-caption">{t("knownSubtotal")} <span aria-hidden="true">·</span> {t("incompleteNutrition")}</p>}
              {comparison !== null && targetValue !== null && targetValue > 0 && (
                <div className="macro-track" aria-hidden="true"><span style={{ width: `${comparison.fill}%` }} /></div>
              )}
              {remainingText && (
                <p className="nutrition-comparison">
                  <span>{remainingText}</span>
                  {percentText && <span>{percentText}</span>}
                </p>
              )}
            </article>
          );
        })}
      </div>
      {hasUnknownValues && <p className="nutrition-unknown-note ui-caption">{t("unknownValues")}</p>}
      <div className={`nutrition-target-note${hasConfiguredTargets ? "" : " nutrition-target-note-missing"}`}>
        {!targetUnavailable && (hasConfiguredTargets ? (
          <details className="nutrition-target-details">
            <summary>{todayT("targetSummary.title")}</summary>
            <p className="ui-caption">{todayT("targetSummary.body", { date: formatLocalizedDate(locale, selectedDate, { dateStyle: "long" }) })}</p>
          </details>
        ) : (
          <div className="min-w-0 flex-1">
            <h3 className="ui-label">{todayT("targetEmptyTitle")}</h3>
            <p className="ui-caption">{t("missingTarget")}</p>
          </div>
        ))}
        <Link className={buttonStyles({ variant: "ghost", size: "sm" })} href={`/${locale}/setup`}>{todayT("targetSummary.editLink")}</Link>
      </div>
    </section>
  );
}
