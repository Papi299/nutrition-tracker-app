export function RetrievalError({
  body,
  retryHref,
  retryLabel,
  testId,
  title,
}: {
  body: string;
  retryHref: string;
  retryLabel: string;
  testId: string;
  title: string;
}) {
  const titleId = `${testId}-title`;

  return (
    <section
      aria-labelledby={titleId}
      className="border border-red-200 bg-red-50 p-5 text-start shadow-sm sm:p-6"
      data-testid={testId}
    >
      <h2 className="text-lg font-semibold text-slate-950" id={titleId}>
        {title}
      </h2>
      <p className="mt-3 text-sm leading-6 text-red-800" role="alert">
        {body}
      </p>
      <a
        className="mt-4 inline-flex min-h-10 items-center bg-teal-700 px-4 text-sm font-semibold text-white transition-colors hover:bg-teal-800"
        href={retryHref}
      >
        {retryLabel}
      </a>
    </section>
  );
}
