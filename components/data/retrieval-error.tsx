import { buttonStyles } from "@/components/ui/button";
import { surfaceStyles } from "@/components/ui/card";

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
      className={surfaceStyles({ className: "border-danger/30 bg-danger-surface text-start" })}
      data-testid={testId}
    >
      <h2 className="ui-card-title" id={titleId}>
        {title}
      </h2>
      <p className="mt-3 text-sm leading-6 text-danger-foreground" role="alert">
        {body}
      </p>
      <a
        className={buttonStyles({ className: "mt-4" })}
        href={retryHref}
      >
        {retryLabel}
      </a>
    </section>
  );
}
