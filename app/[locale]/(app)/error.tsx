"use client";

import { LocalizedErrorBoundary } from "@/components/reliability/localized-error-boundary";

export default function ProtectedAppError({ reset }: { reset: () => void }) {
  return <LocalizedErrorBoundary reset={reset} surface="protected_boundary" />;
}
