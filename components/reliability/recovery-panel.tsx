"use client";

import { Button, buttonStyles } from "@/components/ui/button";
import { surfaceStyles } from "@/components/ui/card";
import {
  createRecoveryPanelModel,
  type RecoveryPanelCopy,
} from "./recovery-model";

export type { RecoveryPanelCopy } from "./recovery-model";

export function RecoveryPanel({
  copy,
  correlationId,
  direction,
  homeHref,
  locale,
  onRetry,
  testId = "reliability-recovery",
}: {
  copy: RecoveryPanelCopy;
  correlationId: string;
  direction: "ltr" | "rtl";
  homeHref: string;
  locale: "en" | "he";
  onRetry: () => void;
  testId?: string;
}) {
  const model = createRecoveryPanelModel({
    copy,
    correlationId,
    direction,
    homeHref,
    locale,
    testId,
  });

  return (
    <section
      aria-describedby={model.bodyId}
      aria-labelledby={model.titleId}
      className={surfaceStyles({ className: "mx-auto my-8 w-full max-w-2xl border-danger/30 bg-danger-surface text-start" })}
      data-testid={testId}
      dir={model.direction}
      lang={model.locale}
      role={model.role}
    >
      <h1 className="ui-section-title" id={model.titleId}>
        {model.copy.title}
      </h1>
      <p className="mt-3 text-sm leading-6 text-danger-foreground" id={model.bodyId}>
        {model.copy.body}
      </p>
      <p className="mt-3 break-all text-xs leading-5 text-muted-foreground">
        {model.copy.reference}: <code>{model.correlationId}</code>
      </p>
      <div className="mt-5 flex flex-wrap gap-3">
        <Button
          onClick={onRetry}
          type="button"
        >
          {model.copy.retry}
        </Button>
        <a
          className={buttonStyles({ variant: "outline" })}
          href={model.homeHref}
        >
          {model.copy.home}
        </a>
      </div>
    </section>
  );
}
