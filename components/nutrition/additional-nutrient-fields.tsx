"use client";

import { useTranslations } from "next-intl";
import { FieldError, FieldLabel, Input } from "@/components/ui/form-controls";
import { nutrientManifestV1, type AdditionalNutrientCode } from "@/lib/nutrition-snapshots";

export function AdditionalNutrientFields({
  values, errors = {}, automaticValues, controlPrefix, fieldPrefix = "", fieldSuffix = "", disabled = false, expandAll = false, onValueChange, onAutomaticChange,
}: {
  values: Partial<Record<AdditionalNutrientCode, string>>;
  errors?: Partial<Record<string, string>>;
  automaticValues?: Partial<Record<AdditionalNutrientCode, string>>;
  controlPrefix: string;
  fieldPrefix?: string;
  fieldSuffix?: string;
  onValueChange?: (code: AdditionalNutrientCode, value: string) => void;
  onAutomaticChange?: (code: AdditionalNutrientCode, enabled: boolean) => void;
  disabled?: boolean;
  expandAll?: boolean;
}) {
  const t = useTranslations("Diary.additionalNutrients");
  const formT = useTranslations("Diary.form");
  return <div className="grid gap-3" data-additional-nutrient-fields>
    {(["additional", "minerals", "vitamins"] as const).map((group) => {
      const definitions = nutrientManifestV1.filter((definition) => definition.group === group);
      return <details className="rounded-xl border border-border p-4" key={group}
        open={expandAll || definitions.some(({ code }) => Boolean(errors[`${fieldPrefix}${code}${fieldSuffix}`])) || undefined}>
        <summary className="cursor-pointer font-semibold">{t(`groups.${group}`)}</summary>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          {definitions.map(({ code, unit }) => {
            const nutrient = code as AdditionalNutrientCode;
            const field = `${fieldPrefix}${code}${fieldSuffix}`;
            const id = `${controlPrefix}-${field}`;
            const error = errors[field];
            const label = `${t(`labels.${code}`)} (${unit})`;
            return <div className="grid content-start gap-2" key={code}>
              <FieldLabel className="grid gap-2" htmlFor={id}>
                <span>{label}</span>
                <Input aria-describedby={error ? `${id}-error` : undefined} aria-invalid={Boolean(error)}
                  data-nutrient-code={code} disabled={disabled}
                  {...(onValueChange ? { value: values[nutrient] ?? "", onChange: (event) => onValueChange(nutrient, event.target.value) } : { defaultValue: values[nutrient] ?? "" })}
                  id={id} inputMode="decimal" min="0" name={field} step="0.0001" type="number" />
              </FieldLabel>
              {error && <FieldError id={`${id}-error`}>{t("invalidAmount")}</FieldError>}
              {automaticValues && <label className="flex min-h-11 items-center gap-2 text-sm">
                <input disabled={disabled}
                  {...(onAutomaticChange ? { checked: automaticValues[nutrient] === "1", onChange: (event) => onAutomaticChange(nutrient, event.target.checked) } : { defaultChecked: automaticValues[nutrient] === "1" })}
                  name={`${fieldPrefix}automatic_${code}${fieldSuffix}`} type="checkbox" value="1" />
                <span>{formT("automaticLabel")}: {label}</span>
              </label>}
            </div>;
          })}
        </div>
      </details>;
    })}
  </div>;
}
