"use client";

import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { localeDirections, locales, type Locale } from "@/lib/i18n/routing";
import {
  classifyObservabilityEnvironment,
  createCorrelationId,
  emitObservabilityEvent,
} from "@/lib/observability";
import { RecoveryPanel } from "./recovery-panel";

function resolveLocale(locale: string): Locale {
  return (locales as readonly string[]).includes(locale)
    ? (locale as Locale)
    : "en";
}

export function LocalizedErrorBoundary({
  reset,
  surface,
}: {
  reset: () => void;
  surface: "localized_boundary" | "protected_boundary";
}) {
  const locale = resolveLocale(useLocale());
  const t = useTranslations("Reliability.boundary");
  const [correlationId] = useState(createCorrelationId);

  useEffect(() => {
    emitObservabilityEvent({
      correlationId,
      environment: classifyObservabilityEnvironment(),
      errorCode: "render_unhandled",
      name: "application.error",
      operation: "render",
      outcome: "failed",
      routeTemplate:
        surface === "localized_boundary" ? "/[locale]" : "/[locale]/(app)",
      runtime: "browser",
      severity: "critical",
      surface,
    });
  }, [correlationId, surface]);

  function reloadCurrentState() {
    reset();
    window.location.reload();
  }

  return (
    <RecoveryPanel
      copy={{
        body: t("body"),
        home: t("home"),
        reference: t("reference"),
        retry: t("retry"),
        title: t("title"),
      }}
      correlationId={correlationId}
      direction={localeDirections[locale]}
      homeHref={`/${locale}`}
      locale={locale}
      onRetry={reloadCurrentState}
    />
  );
}
