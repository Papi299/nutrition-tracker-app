/** @jsxImportSource react */
import { expect, test } from "@playwright/test";
import { NextIntlClientProvider } from "next-intl";
import { renderToStaticMarkup } from "react-dom/server";
import { NutritionDailySummary } from "@/components/diary/nutrition-daily-summary";
import type { DiaryEntry } from "@/lib/diary-entries";
import type { NutrientKey } from "@/lib/diary-presentation";
import type { Locale } from "@/lib/i18n/routing";
import type { NutritionTarget } from "@/lib/nutrition-targets";
import en from "@/messages/en.json";
import he from "@/messages/he.json";

const nutrientKeys = ["calories", "protein_g", "carbohydrates_g", "fat_g"] as const;
const copy = {
  en: { known: "Known subtotal", incomplete: "Incomplete data", consumed: "Consumed", target: "Daily target", unavailable: "Unavailable", grams: "g", calories: "kcal", names: ["Calories", "Protein", "Carbs", "Fat"] },
  he: { known: "סכום ביניים ידוע", incomplete: "נתונים חלקיים", consumed: "נצרך", target: "יעד יומי", unavailable: "לא זמין", grams: "גרם", calories: "קק״ל", names: ["קלוריות", "חלבון", "פחמימות", "שומן"] },
} as const;

function snapshot(values: Partial<DiaryEntry> = {}): DiaryEntry {
  return {
    id: "00000000-0000-4000-8000-000000000001", user_id: "00000000-0000-4000-8000-000000000002",
    entry_date: "2026-10-10", meal_type: "breakfast", source: "manual", food_name: "Synthetic snapshot",
    brand_name: null, food_id: null, notes: null, serving_quantity: 1, serving_unit: "portion",
    calories: 100, protein_g: 10, carbohydrates_g: 20, fat_g: 5,
    created_at: "2026-10-10T08:00:00Z", updated_at: "2026-10-10T08:00:00Z", version: 1,
    recipe_diary_run_id: null, saved_meal_diary_run_id: null, saved_meal_item_position: null,
    ...values,
  };
}

function target(values: Partial<NutritionTarget> = {}): NutritionTarget {
  return {
    id: "00000000-0000-4000-8000-000000000003", user_id: "00000000-0000-4000-8000-000000000002",
    effective_from: "2026-10-01", created_at: "2026-10-01T08:00:00Z", updated_at: "2026-10-01T08:00:00Z",
    calories: 200, protein_g: 20, carbohydrates_g: 40, fat_g: 10,
    ...values,
  };
}

function renderSummary(locale: Locale, entries: DiaryEntry[], configuredTarget: NutritionTarget | null = target(), targetUnavailable = false) {
  return renderToStaticMarkup(
    <NextIntlClientProvider locale={locale} messages={locale === "he" ? he : en} timeZone="Asia/Jerusalem">
      <NutritionDailySummary entries={entries} locale={locale} selectedDate="2026-10-10" target={configuredTarget} targetUnavailable={targetUnavailable} />
    </NextIntlClientProvider>,
  );
}

function metric(markup: string, key: NutrientKey) {
  const match = markup.match(new RegExp(`<article\\b[^>]*data-nutrition-metric="${key}"[^>]*>([\\s\\S]*?)<\\/article>`));
  expect(match, `Rendered metric ${key}`).not.toBeNull();
  return match![1];
}

function definition(markup: string, className: "nutrition-consumed" | "nutrition-target") {
  const element = markup.match(new RegExp(`<dd class="${className}">[\\s\\S]*?<\\/dd>`));
  expect(element, `Rendered ${className} definition`).not.toBeNull();
  if (className === "nutrition-consumed") {
    const value = element![0].match(/^<dd class="nutrition-consumed"><bdi>([^<]+)<span class="(?:sr-only|nutrition-unit)"> ([^<]+)<\/span><\/bdi><\/dd>$/);
    expect(value, "Consumed definition has the expected value and isolated unit structure").not.toBeNull();
    return `${value![1]} ${value![2]}`;
  }
  const value = element![0].match(/^<dd class="nutrition-target">(<span aria-hidden="true">\/ <\/span>)?<bdi>([^<]+)<\/bdi><\/dd>$/);
  expect(value, "Target definition has the expected optional ratio and isolated value structure").not.toBeNull();
  return `${value![1] ? "/ " : ""}${value![2]}`;
}

function assertIncomplete(markup: string, locale: Locale, consumed: string, configuredTarget?: string) {
  expect(definition(markup, "nutrition-consumed")).toBe(consumed);
  expect(markup).toContain(`<dt class="sr-only">${copy[locale].known}</dt>`);
  expect(markup).toContain(`<p class="nutrition-known-subtotal ui-caption">${copy[locale].known} <span aria-hidden="true">·</span> ${copy[locale].incomplete}</p>`);
  expect(markup).not.toContain('class="nutrition-comparison"');
  expect(markup).not.toContain('class="macro-track"');
  if (configuredTarget !== undefined) {
    expect(definition(markup, "nutrition-target")).toBe(configuredTarget);
    expect(markup).toContain(`<dt class="sr-only">${copy[locale].target}</dt>`);
  }
}

for (const locale of ["en", "he"] as const) {
  test.describe(`${locale} nutrition summary completeness`, () => {
    const unit = (key: NutrientKey) => key === "calories" ? copy[locale].calories : copy[locale].grams;

    test("fully known snapshots retain named values, target progress and remaining amounts", () => {
      const markup = renderSummary(locale, [snapshot()]);
      for (const [index, key] of nutrientKeys.entries()) {
        const rendered = metric(markup, key);
        expect(rendered).toContain(`<h3 class="ui-label">${copy[locale].names[index]}</h3>`);
        expect(rendered).toContain(`<dt class="sr-only">${copy[locale].consumed}</dt>`);
        expect(definition(rendered, "nutrition-consumed")).toBe(`${[100, 10, 20, 5][index]} ${unit(key)}`);
        expect(definition(rendered, "nutrition-target")).toBe(`/ ${[200, 20, 40, 10][index]} ${unit(key)}`);
        expect(rendered).toContain('class="macro-track"');
        expect(rendered).toContain('style="width:50%"');
        expect(rendered).toContain('class="nutrition-comparison"');
        expect(rendered).toContain(locale === "en" ? "50% of target" : "50% מהיעד");
        expect(rendered).toContain(locale === "en" ? `${[100, 10, 20, 5][index]} ${unit(key)} remaining` : `נותרו ${[100, 10, 20, 5][index]} ${unit(key)}`);
        expect(rendered).not.toContain(copy[locale].incomplete);
      }
    });

    test("a null protein snapshot suppresses only protein comparison and retains calorie progress", () => {
      const markup = renderSummary(locale, [snapshot({ protein_g: null })]);
      assertIncomplete(metric(markup, "protein_g"), locale, `0 ${copy[locale].grams}`, `/ 20 ${copy[locale].grams}`);
      for (const key of ["calories", "carbohydrates_g", "fat_g"] as const) {
        const rendered = metric(markup, key);
        expect(rendered).toContain('style="width:50%"');
        expect(rendered).toContain('class="nutrition-comparison"');
        expect(rendered).not.toContain(copy[locale].incomplete);
      }
      expect(definition(metric(markup, "calories"), "nutrition-consumed")).toBe(`100 ${copy[locale].calories}`);
    });

    test("all-null snapshots expose known-zero subtotals and configured targets without determinate comparisons", () => {
      const markup = renderSummary(locale, [snapshot({ calories: null, protein_g: null, carbohydrates_g: null, fat_g: null })]);
      for (const [index, key] of nutrientKeys.entries()) {
        assertIncomplete(metric(markup, key), locale, `0 ${unit(key)}`, `/ ${[200, 20, 40, 10][index]} ${unit(key)}`);
      }
      expect(markup).not.toContain('class="nutrition-comparison"');
      expect(markup).not.toContain('class="macro-track"');
    });

    test("explicit stored zeros remain complete and retain zero-percent positive-target progress", () => {
      const markup = renderSummary(locale, [snapshot({ calories: 0, protein_g: 0, carbohydrates_g: 0, fat_g: 0 })]);
      for (const key of nutrientKeys) {
        const rendered = metric(markup, key);
        expect(definition(rendered, "nutrition-consumed")).toBe(`0 ${unit(key)}`);
        expect(rendered).toContain('style="width:0%"');
        expect(rendered).toContain(locale === "en" ? "0% of target" : "0% מהיעד");
        expect(rendered).not.toContain(copy[locale].incomplete);
      }
    });

    test("mixed snapshots suppress each incomplete nutrient while complete zero fat remains comparable", () => {
      const markup = renderSummary(locale, [
        snapshot({ calories: 100, protein_g: 10, carbohydrates_g: null, fat_g: 0 }),
        snapshot({ calories: null, protein_g: 5, carbohydrates_g: 8, fat_g: 0 }),
        snapshot({ calories: 50, protein_g: null, carbohydrates_g: 2, fat_g: 0 }),
      ]);
      assertIncomplete(metric(markup, "calories"), locale, `150 ${copy[locale].calories}`, `/ 200 ${copy[locale].calories}`);
      assertIncomplete(metric(markup, "protein_g"), locale, `15 ${copy[locale].grams}`, `/ 20 ${copy[locale].grams}`);
      assertIncomplete(metric(markup, "carbohydrates_g"), locale, `10 ${copy[locale].grams}`, `/ 40 ${copy[locale].grams}`);
      const fat = metric(markup, "fat_g");
      expect(definition(fat, "nutrition-consumed")).toBe(`0 ${copy[locale].grams}`);
      expect(fat).toContain('style="width:0%"');
      expect(fat).toContain(locale === "en" ? "10 g remaining" : "נותרו 10 גרם");
      expect(fat).not.toContain(copy[locale].incomplete);
    });

    test("zero targets retain complete comparisons without ratios and suppress incomplete zero-target comparisons", () => {
      const configuredTarget = target({ calories: 0, protein_g: 0, carbohydrates_g: 0, fat_g: 0 });
      const markup = renderSummary(locale, [snapshot({ protein_g: null })], configuredTarget);
      assertIncomplete(metric(markup, "protein_g"), locale, `0 ${copy[locale].grams}`, `/ 0 ${copy[locale].grams}`);
      const calories = metric(markup, "calories");
      expect(definition(calories, "nutrition-target")).toBe(`/ 0 ${copy[locale].calories}`);
      expect(calories).toContain('class="nutrition-comparison"');
      expect(calories).toContain(locale === "en" ? "Over target by 100 kcal" : "חריגה מהיעד ב־100 קק״ל");
      expect(markup).not.toContain('class="macro-track"');
      expect(markup).not.toMatch(/\d+%|Infinity|NaN/);
      const zeroMarkup = renderSummary(locale, [snapshot({ calories: 0, protein_g: 0, carbohydrates_g: 0, fat_g: 0 })], configuredTarget);
      for (const key of nutrientKeys) {
        const rendered = metric(zeroMarkup, key);
        expect(rendered).toContain(locale === "en" ? `0 ${unit(key)} remaining` : `נותרו 0 ${unit(key)}`);
        expect(rendered).not.toContain(copy[locale].incomplete);
      }
    });

    test("known over-target values preserve actual percentages and bounded bars", () => {
      const markup = renderSummary(locale, [snapshot({ calories: 250, protein_g: 25, carbohydrates_g: 50, fat_g: 12.5 })]);
      for (const [index, key] of nutrientKeys.entries()) {
        const rendered = metric(markup, key);
        expect(rendered).toContain('style="width:100%"');
        expect(rendered).toContain(locale === "en" ? "125% of target" : "125% מהיעד");
        expect(rendered).toContain(locale === "en" ? `Over target by ${[50, 5, 10, 2.5][index]} ${unit(key)}` : `חריגה מהיעד ב־${[50, 5, 10, 2.5][index]} ${unit(key)}`);
        expect(rendered).not.toContain(copy[locale].incomplete);
      }
    });

    test("missing and unavailable targets preserve incomplete subtotal cues without fabricating progress", () => {
      const entries = [snapshot({ protein_g: null })];
      for (const configuredTarget of [null, target({ calories: null, protein_g: null, carbohydrates_g: null, fat_g: null })]) {
        const markup = renderSummary(locale, entries, configuredTarget);
        assertIncomplete(metric(markup, "protein_g"), locale, `0 ${copy[locale].grams}`);
        expect(markup).not.toContain('class="nutrition-target"');
        expect(markup).not.toContain('class="macro-track"');
        expect(markup).not.toContain('class="nutrition-comparison"');
        expect(markup).toContain(`href="/${locale}/setup"`);
      }
      const unavailable = renderSummary(locale, entries, target(), true);
      assertIncomplete(metric(unavailable, "protein_g"), locale, `0 ${copy[locale].grams}`, copy[locale].unavailable);
      for (const key of nutrientKeys) expect(definition(metric(unavailable, key), "nutrition-target")).toBe(copy[locale].unavailable);
      expect(unavailable).not.toContain('class="macro-track"');
      expect(unavailable).not.toContain('class="nutrition-comparison"');
      expect(unavailable).not.toContain('data-testid="target-progress"');
    });
  });
}
