import Link from "next/link";
import type { DiaryEntry } from "@/lib/diary-entries";
import type { NutritionTarget } from "@/lib/nutrition-targets";

type MetricKey = "calories" | "carbohydrates_g" | "fat_g" | "protein_g";

type ProgressMetric = {
  key: MetricKey;
  consumed: number;
  label: string;
  target: null | number;
  unit: string;
};

function numericValue(value: null | number | string) {
  return value === null ? 0 : Number(value);
}

function targetValue(value: null | number | string | undefined) {
  return value === null || value === undefined ? null : Number(value);
}

function calculateTotals(entries: DiaryEntry[]) {
  return entries.reduce(
    (totals, entry) => ({
      calories: totals.calories + numericValue(entry.calories),
      carbohydrates_g:
        totals.carbohydrates_g + numericValue(entry.carbohydrates_g),
      fat_g: totals.fat_g + numericValue(entry.fat_g),
      protein_g: totals.protein_g + numericValue(entry.protein_g),
    }),
    {
      calories: 0,
      carbohydrates_g: 0,
      fat_g: 0,
      protein_g: 0,
    },
  );
}

function formatNumber(value: number) {
  const rounded = Math.round(value * 100) / 100;

  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(2);
}

function formatValue(value: number, unit: string) {
  return unit === ""
    ? formatNumber(Math.round(value))
    : `${formatNumber(value)}${unit}`;
}

function progressPercent(consumed: number, target: null | number) {
  if (target === null || target <= 0) {
    return null;
  }

  return Math.round((consumed / target) * 100);
}

function progressBarWidth(percent: null | number) {
  if (percent === null) {
    return "0%";
  }

  return `${Math.min(Math.max(percent, 0), 100)}%`;
}

function remainingText({
  consumed,
  labels,
  target,
  unit,
}: {
  consumed: number;
  labels: DiaryTargetProgressLabels;
  target: null | number;
  unit: string;
}) {
  if (target === null) {
    return labels.notSet;
  }

  const remaining = target - consumed;

  if (remaining < 0) {
    return labels.overTarget.replace(
      "{value}",
      formatValue(Math.abs(remaining), unit),
    );
  }

  return formatValue(remaining, unit);
}

export type DiaryTargetProgressLabels = {
  body: string;
  consumed: string;
  emptyBody: string;
  emptyLink: string;
  emptyTitle: string;
  notSet: string;
  overTarget: string;
  percentComplete: string;
  remaining: string;
  target: string;
  title: string;
  unitGrams: string;
  metrics: Record<MetricKey, string>;
};

export function DiaryTargetProgress({
  entries,
  labels,
  setupHref,
  target,
}: {
  entries: DiaryEntry[];
  labels: DiaryTargetProgressLabels;
  setupHref: string;
  target: NutritionTarget | null;
}) {
  const totals = calculateTotals(entries);

  if (target === null) {
    return (
      <section
        className="border border-amber-200 bg-amber-50 p-4 text-start"
        data-testid="target-progress"
      >
        <h3 className="text-base font-semibold text-slate-950">
          {labels.emptyTitle}
        </h3>
        <p className="mt-2 text-sm leading-6 text-slate-700">
          {labels.emptyBody}
        </p>
        <Link
          className="mt-4 inline-flex min-h-10 items-center bg-teal-700 px-4 text-sm font-semibold text-white transition-colors hover:bg-teal-800"
          href={setupHref}
        >
          {labels.emptyLink}
        </Link>
      </section>
    );
  }

  const metrics: ProgressMetric[] = [
    {
      consumed: totals.calories,
      key: "calories",
      label: labels.metrics.calories,
      target: targetValue(target.calories),
      unit: "",
    },
    {
      consumed: totals.protein_g,
      key: "protein_g",
      label: labels.metrics.protein_g,
      target: targetValue(target.protein_g),
      unit: labels.unitGrams,
    },
    {
      consumed: totals.carbohydrates_g,
      key: "carbohydrates_g",
      label: labels.metrics.carbohydrates_g,
      target: targetValue(target.carbohydrates_g),
      unit: labels.unitGrams,
    },
    {
      consumed: totals.fat_g,
      key: "fat_g",
      label: labels.metrics.fat_g,
      target: targetValue(target.fat_g),
      unit: labels.unitGrams,
    },
  ];

  return (
    <section
      className="border border-slate-200 bg-stone-50 p-4 text-start"
      data-testid="target-progress"
    >
      <div>
        <h3 className="text-base font-semibold text-slate-950">
          {labels.title}
        </h3>
        <p className="mt-2 text-sm leading-6 text-slate-700">
          {labels.body}
        </p>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {metrics.map((metric) => {
          const percent = progressPercent(metric.consumed, metric.target);
          const targetDisplay =
            metric.target === null
              ? labels.notSet
              : formatValue(metric.target, metric.unit);

          return (
            <article
              className="border border-slate-200 bg-white p-4"
              key={metric.key}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <h4 className="text-sm font-semibold text-slate-950">
                  {metric.label}
                </h4>
                <span className="text-sm font-medium text-teal-700">
                  {percent === null
                    ? labels.notSet
                    : labels.percentComplete.replace(
                        "{percent}",
                        String(percent),
                      )}
                </span>
              </div>

              <div
                aria-hidden="true"
                className="mt-4 h-2 overflow-hidden bg-slate-200"
              >
                <div
                  className="h-full bg-teal-700"
                  style={{ width: progressBarWidth(percent) }}
                />
              </div>

              <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-3">
                <div>
                  <dt className="text-slate-600">{labels.consumed}</dt>
                  <dd className="mt-1 font-semibold text-slate-950">
                    {formatValue(metric.consumed, metric.unit)}
                  </dd>
                </div>
                <div>
                  <dt className="text-slate-600">{labels.target}</dt>
                  <dd className="mt-1 font-semibold text-slate-950">
                    {targetDisplay}
                  </dd>
                </div>
                <div>
                  <dt className="text-slate-600">{labels.remaining}</dt>
                  <dd className="mt-1 font-semibold text-slate-950">
                    {remainingText({
                      consumed: metric.consumed,
                      labels,
                      target: metric.target,
                      unit: metric.unit,
                    })}
                  </dd>
                </div>
              </dl>
            </article>
          );
        })}
      </div>
    </section>
  );
}
