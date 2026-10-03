import { Button } from "@/components/ui/button";
import { Input, FieldLabel } from "@/components/ui/form-controls";

export function CalendarDateForm({
  action,
  additionalDescriptionId,
  canonicalQueryValues,
  description,
  inputId,
  label,
  queryName,
  submitLabel,
}: {
  action: string;
  additionalDescriptionId?: string;
  canonicalQueryValues?: Record<string, string>;
  description: string;
  inputId: string;
  label: string;
  queryName: string;
  submitLabel: string;
}) {
  const descriptionId = `${inputId}-description`;
  const describedBy = additionalDescriptionId
    ? `${additionalDescriptionId} ${descriptionId}`
    : descriptionId;

  return (
    <form action={action} className="mt-5 grid max-w-sm gap-3" method="get">
      <p className="text-sm leading-6 text-muted-foreground" id={descriptionId}>
        {description}
      </p>
      <FieldLabel
        className="grid gap-2"
        htmlFor={inputId}
      >
        {label}
      </FieldLabel>
      <Input
        aria-describedby={describedBy}
        id={inputId}
        name={queryName}
        required
        type="date"
      />
      {Object.entries(canonicalQueryValues ?? {}).map(([name, value]) => (
        <input key={name} name={name} type="hidden" value={value} />
      ))}
      <Button
        type="submit"
      >
        {submitLabel}
      </Button>
    </form>
  );
}
