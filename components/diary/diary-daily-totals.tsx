import type { DiaryEntry } from "@/lib/diary-entries";

type DailyTotalKey = "calories" | "carbohydrates_g" | "fat_g" | "protein_g";

type TotalItem = {
  key: DailyTotalKey;
  label: string;
  value: number;
};

function numericValue(value: DiaryEntry[DailyTotalKey]) {
  return value ?? 0;
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

function formatWholeNumber(value: number) {
  return String(Math.round(value));
}

function formatGramValue(value: number) {
  const rounded = Math.round(value * 100) / 100;

  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(2);
}

export function DiaryDailyTotals({
  entries,
  labels,
}: {
  entries: DiaryEntry[];
  labels: {
    calories: string;
    carbohydrates: string;
    description: string;
    fat: string;
    protein: string;
    title: string;
    unitGrams: string;
  };
}) {
  const totals = calculateTotals(entries);
  const items: TotalItem[] = [
    {
      key: "calories",
      label: labels.calories,
      value: totals.calories,
    },
    {
      key: "protein_g",
      label: labels.protein,
      value: totals.protein_g,
    },
    {
      key: "carbohydrates_g",
      label: labels.carbohydrates,
      value: totals.carbohydrates_g,
    },
    {
      key: "fat_g",
      label: labels.fat,
      value: totals.fat_g,
    },
  ];

  return (
    <section className="border border-slate-200 bg-stone-50 p-4 text-start">
      <div>
        <h3 className="text-base font-semibold text-slate-950">
          {labels.title}
        </h3>
        <p className="mt-2 text-sm leading-6 text-slate-700">
          {labels.description}
        </p>
      </div>

      <dl className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {items.map((item) => {
          const isCalories = item.key === "calories";
          const value = isCalories
            ? formatWholeNumber(item.value)
            : `${formatGramValue(item.value)}${labels.unitGrams}`;

          return (
            <div className="border border-slate-200 bg-white p-3" key={item.key}>
              <dt className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-600">
                {item.label}
              </dt>
              <dd className="mt-2 text-2xl font-semibold text-slate-950">
                {value}
              </dd>
            </div>
          );
        })}
      </dl>
    </section>
  );
}
