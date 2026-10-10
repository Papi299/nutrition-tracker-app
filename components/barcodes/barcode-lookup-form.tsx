import Form from "next/form";
import { ScanLine } from "lucide-react";
import { FoodResultMetadata } from "@/components/foods/food-result-metadata";
import { Button } from "@/components/ui/button";
import { surfaceStyles } from "@/components/ui/card";
import {
  FieldDescription,
  FieldError,
  FieldLabel,
  Input,
  Select,
} from "@/components/ui/form-controls";
import { BARCODE_RAW_INPUT_MAX_LENGTH } from "@/lib/barcodes";
import type { DiaryEntryMealType } from "@/lib/diary-entries";

const barcodeTechnicalTokens = new Set([
  "GTIN-8",
  "UPC-A",
  "GTIN-12",
  "GTIN-13",
  "GTIN-14",
  "UPC-E",
]);
const barcodeTechnicalTokenPattern =
  /(GTIN-8|UPC-A|GTIN-12|GTIN-13|GTIN-14|UPC-E)/g;

function BarcodeCodeHelp({ text }: { text: string }) {
  return text.split(barcodeTechnicalTokenPattern).map((part, index) =>
    barcodeTechnicalTokens.has(part) ? (
      <bdi
        className="inline-block whitespace-nowrap"
        data-barcode-technical-token={part}
        dir="ltr"
        key={`${part}-${index}`}
      >
        {part}
      </bdi>
    ) : (
      part
    ),
  );
}

export function BarcodeLookupForm({
  action,
  code,
  date,
  error,
  formId,
  labels,
  mealType,
  mealTypeOptions,
}: {
  action: string;
  code: string;
  date: string | null;
  error?: {
    field: "code" | "date" | "mealType";
    message: string;
  };
  formId?: string;
  labels: {
    title: string;
    description: string;
    details: string;
    code: string;
    codeHelp: string;
    date: string;
    dateHelp: string;
    mealType: string;
    mealTypeHelp: string;
    mealTypeNone: string;
    submit: string;
  };
  mealType: DiaryEntryMealType | null;
  mealTypeOptions: Array<{ label: string; value: DiaryEntryMealType }>;
}) {
  const codeHelpId = "barcode-code-help";
  const codeErrorId = error?.field === "code" ? "barcode-code-error" : undefined;
  const dateHelpId = "barcode-date-help";
  const dateErrorId = error?.field === "date" ? "barcode-date-error" : undefined;
  const mealHelpId = "barcode-meal-help";
  const mealErrorId = error?.field === "mealType" ? "barcode-meal-error" : undefined;

  return (
    <Form
      action={action}
      aria-labelledby="barcode-manual-title"
      className={surfaceStyles({ className: "grid min-w-0 gap-4" })}
      id={formId}
    >
      <h2 className="ui-card-title" id="barcode-manual-title">{labels.title}</h2>
      <FieldLabel className="grid min-w-0 gap-2">
        {labels.code}
        <span className="relative block min-w-0" dir="ltr">
          <ScanLine aria-hidden="true" className="pointer-events-none absolute start-3 top-1/2 size-5 -translate-y-1/2 text-muted-foreground" />
          <Input
            aria-describedby={[codeHelpId, codeErrorId].filter(Boolean).join(" ")}
            aria-invalid={error?.field === "code"}
            autoCapitalize="none"
            autoComplete="off"
            autoCorrect="off"
            className="min-h-12 ps-10 font-mono tabular-nums"
            dir="ltr"
            defaultValue={code}
            inputMode="numeric"
            maxLength={BARCODE_RAW_INPUT_MAX_LENGTH}
            name="code"
            required
            spellCheck={false}
            type="text"
          />
        </span>
        <FieldDescription className="font-normal" id={codeHelpId}>
          <BarcodeCodeHelp text={labels.codeHelp} />
        </FieldDescription>
        {error?.field === "code" && (
          <FieldError id={codeErrorId} role="alert">
            {error.message}
          </FieldError>
        )}
      </FieldLabel>

      <div className="grid min-w-0 gap-4 sm:grid-cols-2">
        <FieldLabel className="grid min-w-0 content-start gap-2">
          {labels.date}
          <Input
            aria-describedby={[dateHelpId, dateErrorId].filter(Boolean).join(" ")}
            aria-invalid={error?.field === "date"}
            className="min-h-12"
            dir="ltr"
            defaultValue={date ?? ""}
            name="date"
            required
            type="date"
          />
          <FieldDescription className="font-normal" id={dateHelpId}>
            {labels.dateHelp}
          </FieldDescription>
          {error?.field === "date" && (
            <FieldError id={dateErrorId} role="alert">
              {error.message}
            </FieldError>
          )}
        </FieldLabel>

        <FieldLabel className="grid min-w-0 content-start gap-2">
          {labels.mealType}
          <Select
            aria-describedby={[mealHelpId, mealErrorId].filter(Boolean).join(" ")}
            aria-invalid={error?.field === "mealType"}
            className="min-h-12"
            defaultValue={mealType ?? ""}
            name="mealType"
          >
            <option value="">{labels.mealTypeNone}</option>
            {mealTypeOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
          <FieldDescription className="font-normal" id={mealHelpId}>
            {labels.mealTypeHelp}
          </FieldDescription>
          {error?.field === "mealType" && (
            <FieldError id={mealErrorId} role="alert">
              {error.message}
            </FieldError>
          )}
        </FieldLabel>
      </div>

      <Button className="min-h-12 w-full sm:w-fit" type="submit">
        <ScanLine aria-hidden="true" className="size-4 shrink-0" />
        {labels.submit}
      </Button>
      <FoodResultMetadata summary={labels.details}>
        <p className="ui-body-secondary">{labels.description}</p>
      </FoodResultMetadata>
    </Form>
  );
}
