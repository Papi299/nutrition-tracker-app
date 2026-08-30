"use client";

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
      className="mx-auto my-8 w-full max-w-2xl border border-red-300 bg-red-50 p-5 text-start shadow-sm sm:p-6"
      data-testid={testId}
      dir={model.direction}
      lang={model.locale}
      role={model.role}
    >
      <h1 className="text-2xl font-semibold text-slate-950" id={model.titleId}>
        {model.copy.title}
      </h1>
      <p className="mt-3 text-sm leading-6 text-red-900" id={model.bodyId}>
        {model.copy.body}
      </p>
      <p className="mt-3 break-all text-xs leading-5 text-slate-700">
        {model.copy.reference}: <code>{model.correlationId}</code>
      </p>
      <div className="mt-5 flex flex-wrap gap-3">
        <button
          className="min-h-11 bg-teal-700 px-4 text-sm font-semibold text-white transition-colors hover:bg-teal-800"
          onClick={onRetry}
          type="button"
        >
          {model.copy.retry}
        </button>
        <a
          className="inline-flex min-h-11 items-center border border-slate-400 bg-white px-4 text-sm font-semibold text-slate-950 hover:bg-slate-100"
          href={model.homeHref}
        >
          {model.copy.home}
        </a>
      </div>
    </section>
  );
}
