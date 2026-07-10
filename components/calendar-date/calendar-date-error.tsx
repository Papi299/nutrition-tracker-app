import { CalendarDateForm } from "@/components/calendar-date/calendar-date-form";

export function CalendarDateError({
  description,
  formDescription,
  formLabel,
  formSubmitLabel,
  inputId,
  queryName,
  routePath,
  title,
}: {
  description: string;
  formDescription: string;
  formLabel: string;
  formSubmitLabel: string;
  inputId: string;
  queryName: string;
  routePath: string;
  title: string;
}) {
  const errorId = `${inputId}-error-description`;

  return (
    <section
      aria-labelledby={`${inputId}-error-title`}
      className="max-w-2xl border border-red-200 bg-red-50 p-5 shadow-sm sm:p-6"
    >
      <h1
        className="text-2xl font-semibold text-slate-950"
        id={`${inputId}-error-title`}
      >
        {title}
      </h1>
      <p
        className="mt-3 text-sm leading-6 text-red-800"
        id={errorId}
        role="alert"
      >
        {description}
      </p>
      <CalendarDateForm
        action={routePath}
        additionalDescriptionId={errorId}
        description={formDescription}
        inputId={inputId}
        label={formLabel}
        queryName={queryName}
        submitLabel={formSubmitLabel}
      />
    </section>
  );
}
