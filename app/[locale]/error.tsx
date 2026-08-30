"use client";

import { LocalizedErrorBoundary } from "@/components/reliability/localized-error-boundary";

export default function LocaleError({ reset }: { reset: () => void }) {
  return (
    <LocalizedErrorBoundary reset={reset} surface="localized_boundary" />
  );
}
