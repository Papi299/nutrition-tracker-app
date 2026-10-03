import { surfaceStyles } from "@/components/ui/card";
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
      className={surfaceStyles({ className: "max-w-2xl border-danger/30 bg-danger-surface" })}
    >
      <h1
        className="ui-section-title"
        id={`${inputId}-error-title`}
      >
        {title}
      </h1>
      <p
        className="mt-3 text-sm leading-6 text-danger-foreground"
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
