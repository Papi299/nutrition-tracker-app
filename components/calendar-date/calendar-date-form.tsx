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
      <p className="text-sm leading-6 text-slate-700" id={descriptionId}>
        {description}
      </p>
      <label
        className="grid gap-2 text-sm font-medium text-slate-900"
        htmlFor={inputId}
      >
        {label}
      </label>
      <input
        aria-describedby={describedBy}
        className="min-h-11 border border-slate-300 bg-white px-3 text-base text-slate-950 outline-none transition-colors focus:border-teal-700"
        id={inputId}
        name={queryName}
        required
        type="date"
      />
      {Object.entries(canonicalQueryValues ?? {}).map(([name, value]) => (
        <input key={name} name={name} type="hidden" value={value} />
      ))}
      <button
        className="min-h-11 bg-teal-700 px-4 text-sm font-semibold text-white transition-colors hover:bg-teal-800"
        type="submit"
      >
        {submitLabel}
      </button>
    </form>
  );
}
