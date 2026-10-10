import Link from "next/link";
import { useTranslations } from "next-intl";
import { buttonStyles } from "@/components/ui/button";
import { surfaceStyles } from "@/components/ui/card";
import {
  calculateDiaryTotals,
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
  const names = { calories: t("calories"), protein_g: totalsT("protein"), carbohydrates_g: totalsT("carbohydrates"), fat_g: totalsT("fat") };
  const units = { calories: t("unitCalories"), protein_g: totalsT("unitGrams"), carbohydrates_g: totalsT("unitGrams"), fat_g: totalsT("unitGrams") };
  const valueText = (value: number, key: NutrientKey) =>
    `${formatLocalizedNumber(locale, roundDiaryValue(value, key), { maximumFractionDigits: key === "calories" ? 0 : 2 })} ${units[key]}`;

  return (
    <section aria-labelledby="daily-totals-title" data-testid={target ? "target-summary" : undefined}>
      <h2 className="sr-only" id="daily-totals-title">{totalsT("title")}</h2>
      <div className="nutrition-summary" data-testid={targetUnavailable ? undefined : "target-progress"}>
        {keys.map((key) => {
          const calorie = key === "calories";
          const targetValue = target?.[key] ?? null;
          const comparison = compareNutritionTarget(totals[key], targetValue);
          const targetText = targetUnavailable ? t("unavailable") : targetValue === null ? todayT("targetSummary.notSet") : valueText(targetValue, key);
          const remainingText = comparison.remaining === null ? null : comparison.remaining < 0
            ? t("overTarget", { value: valueText(Math.abs(comparison.remaining), key) })
            : t("remaining", { value: valueText(comparison.remaining, key) });
          const percentText = comparison.percent === null ? null : t("percent", { percent: formatLocalizedNumber(locale, comparison.percent, { maximumFractionDigits: 0 }) });

          return (
            <article className={surfaceStyles({ className: `nutrition-metric nutrition-${key}` })} data-nutrition-metric={key} data-testid={calorie ? "calorie-summary" : undefined} key={key}>
              {calorie && (
                <div className="calorie-ring" aria-hidden="true">
                  <svg viewBox="0 0 120 120" focusable="false">
                    <circle className="calorie-ring-track" cx="60" cy="60" r="52" fill="none" strokeWidth="7" />
                    <circle className="calorie-ring-fill" cx="60" cy="60" r="52" fill="none" strokeWidth="7" pathLength="100" strokeDasharray={`${comparison.fill} 100`} transform="rotate(-90 60 60)" />
                  </svg>
                  <span className="calorie-ring-label">{names[key]}</span>
                </div>
              )}
              <div className="min-w-0 flex-1">
                <h3 className={calorie ? "ui-eyebrow" : "ui-label"}>{names[key]}</h3>
                <dl className="nutrition-values">
                  <div>
                    <dt className="ui-caption">{t("consumed")}</dt>
                    <dd className={calorie ? "calorie-value" : "macro-value"}><bdi>{valueText(totals[key], key)}</bdi></dd>
                  </div>
                  <div>
                    <dt className="ui-caption">{t("target")}</dt>
                    <dd className="nutrition-target"><bdi>{targetText}</bdi></dd>
                  </div>
                </dl>
                {!calorie && (
                  <div className="macro-track" aria-hidden="true"><span style={{ width: `${comparison.fill}%` }} /></div>
                )}
                {remainingText && <p className="nutrition-comparison">{remainingText}</p>}
                {percentText && <p className="ui-caption mt-1">{percentText}</p>}
              </div>
            </article>
          );
        })}
      </div>
      {!targetUnavailable && (
        <div className="nutrition-target-note">
          <div className="min-w-0 flex-1">
          {!target && <h3 className="ui-label">{todayT("targetEmptyTitle")}</h3>}
          <p className="ui-caption">{target
            ? todayT("targetSummary.body", { date: formatLocalizedDate(locale, selectedDate, { dateStyle: "long" }) })
            : t("missingTarget")}</p>
          </div>
          <Link className={buttonStyles({ variant: "ghost", size: "sm" })} href={`/${locale}/setup`}>{todayT("targetSummary.editLink")}</Link>
        </div>
      )}
    </section>
  );
}
