"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { CalendarDateForm } from "@/components/calendar-date/calendar-date-form";
import { formatBrowserLocalCalendarDate } from "@/lib/calendar-date";

export function BrowserDateBootstrap({
  canonicalQueryValues,
  formDescription,
  formLabel,
  formSubmitLabel,
  inputId,
  queryName,
  routePath,
  status,
  title,
}: {
  canonicalQueryValues?: Record<string, string>;
  formDescription: string;
  formLabel: string;
  formSubmitLabel: string;
  inputId: string;
  queryName: string;
  routePath: string;
  status: string;
  title: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (searchParams.has(queryName)) {
      return;
    }

    const nextSearchParams = new URLSearchParams(searchParams.toString());
    for (const name of Object.keys(canonicalQueryValues ?? {})) {
      nextSearchParams.delete(name);
    }
    nextSearchParams.set(queryName, formatBrowserLocalCalendarDate());
    for (const [name, value] of Object.entries(canonicalQueryValues ?? {})) {
      nextSearchParams.set(name, value);
    }
    router.replace(`${routePath}?${nextSearchParams.toString()}`);
  }, [canonicalQueryValues, queryName, routePath, router, searchParams]);

  return (
    <section
      aria-labelledby={`${inputId}-title`}
      className="max-w-2xl border border-teal-200 bg-teal-50 p-5 shadow-sm sm:p-6"
    >
      <h1
        className="text-2xl font-semibold text-slate-950"
        id={`${inputId}-title`}
      >
        {title}
      </h1>
      <p
        aria-live="polite"
        className="mt-3 text-sm leading-6 text-slate-700"
        role="status"
      >
        {status}
      </p>
      <noscript>
        <CalendarDateForm
          action={routePath}
          canonicalQueryValues={canonicalQueryValues}
          description={formDescription}
          inputId={inputId}
          label={formLabel}
          queryName={queryName}
          submitLabel={formSubmitLabel}
        />
      </noscript>
    </section>
  );
}
