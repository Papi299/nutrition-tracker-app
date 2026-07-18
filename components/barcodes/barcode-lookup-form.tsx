import { BARCODE_RAW_INPUT_MAX_LENGTH } from "@/lib/barcodes";
import type { DiaryEntryMealType } from "@/lib/diary-entries";

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
    <form
      action={action}
      className="grid max-w-3xl gap-5 border border-slate-200 bg-white p-5 shadow-sm sm:p-6"
      method="get"
      id={formId}
    >
      <label className="grid gap-2 text-sm font-semibold text-slate-900">
        {labels.code}
        <input
          aria-describedby={[codeHelpId, codeErrorId].filter(Boolean).join(" ")}
          aria-invalid={error?.field === "code"}
          autoCapitalize="none"
          autoComplete="off"
          autoCorrect="off"
          className="min-h-12 border border-slate-300 bg-white px-3 text-base text-slate-950 outline-none transition-colors focus:border-teal-700 focus:ring-2 focus:ring-teal-100"
          defaultValue={code}
          inputMode="numeric"
          maxLength={BARCODE_RAW_INPUT_MAX_LENGTH}
          name="code"
          required
          spellCheck={false}
          type="text"
        />
        <span className="text-sm font-normal leading-6 text-slate-600" id={codeHelpId}>
          {labels.codeHelp}
        </span>
        {error?.field === "code" && (
          <span className="text-sm font-normal leading-6 text-red-800" id={codeErrorId} role="alert">
            {error.message}
          </span>
        )}
      </label>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="grid gap-2 text-sm font-semibold text-slate-900">
          {labels.date}
          <input
            aria-describedby={[dateHelpId, dateErrorId].filter(Boolean).join(" ")}
            aria-invalid={error?.field === "date"}
            className="min-h-12 border border-slate-300 bg-white px-3 text-base text-slate-950 outline-none transition-colors focus:border-teal-700"
            defaultValue={date ?? ""}
            name="date"
            required
            type="date"
          />
          <span className="text-sm font-normal leading-6 text-slate-600" id={dateHelpId}>
            {labels.dateHelp}
          </span>
          {error?.field === "date" && (
            <span className="text-sm font-normal leading-6 text-red-800" id={dateErrorId} role="alert">
              {error.message}
            </span>
          )}
        </label>

        <label className="grid gap-2 text-sm font-semibold text-slate-900">
          {labels.mealType}
          <select
            aria-describedby={[mealHelpId, mealErrorId].filter(Boolean).join(" ")}
            aria-invalid={error?.field === "mealType"}
            className="min-h-12 border border-slate-300 bg-white px-3 text-base text-slate-950 outline-none transition-colors focus:border-teal-700"
            defaultValue={mealType ?? ""}
            name="mealType"
          >
            <option value="">{labels.mealTypeNone}</option>
            {mealTypeOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <span className="text-sm font-normal leading-6 text-slate-600" id={mealHelpId}>
            {labels.mealTypeHelp}
          </span>
          {error?.field === "mealType" && (
            <span className="text-sm font-normal leading-6 text-red-800" id={mealErrorId} role="alert">
              {error.message}
            </span>
          )}
        </label>
      </div>

      <button
        className="min-h-12 w-fit bg-teal-700 px-5 text-sm font-semibold text-white transition-colors hover:bg-teal-800"
        type="submit"
      >
        {labels.submit}
      </button>
    </form>
  );
}
