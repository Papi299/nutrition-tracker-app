"use client";

import { useEffect, useState } from "react";
import { RecoveryPanel } from "@/components/reliability/recovery-panel";
import {
  classifyObservabilityEnvironment,
  createCorrelationId,
  emitObservabilityEvent,
} from "@/lib/observability";

export default function GlobalError({ reset }: { reset: () => void }) {
  const [correlationId] = useState(createCorrelationId);

  useEffect(() => {
    emitObservabilityEvent({
      correlationId,
      environment: classifyObservabilityEnvironment(),
      errorCode: "framework_failure",
      name: "application.error",
      operation: "render",
      outcome: "failed",
      routeTemplate: "global",
      runtime: "browser",
      severity: "critical",
      surface: "global_boundary",
    });
  }, [correlationId]);

  function reloadCurrentState() {
    reset();
    window.location.reload();
  }

  return (
    <html lang="en" dir="ltr">
      <body>
        <main>
          <RecoveryPanel
            copy={{
              body:
                "The application could not load safely. No submission was repeated. Reload the latest state before deciding whether to submit again.",
              home: "English home / דף הבית באנגלית",
              reference: "Reference / סימוכין",
              retry: "Reload latest state / טעינת המצב העדכני",
              title: "Application recovery / שחזור היישום",
            }}
            correlationId={correlationId}
            direction="ltr"
            homeHref="/en"
            locale="en"
            onRetry={reloadCurrentState}
            testId="global-reliability-recovery"
          />
          <p className="mx-auto mb-8 max-w-2xl px-5 text-end" dir="rtl" lang="he">
            {/* A catastrophic root fallback intentionally uses a full navigation. */}
            {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
            <a className="font-semibold text-teal-800 underline" href="/he">
              מעבר לדף הבית בעברית
            </a>
          </p>
        </main>
      </body>
    </html>
  );
}
