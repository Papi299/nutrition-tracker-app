"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { CalendarDateForm } from "@/components/calendar-date/calendar-date-form";
import { formatBrowserLocalCalendarDate } from "@/lib/calendar-date";

export function BrowserDateBootstrap({
  formDescription,
  formLabel,
  formSubmitLabel,
  inputId,
  queryName,
  routePath,
  status,
  title,
}: {
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
    nextSearchParams.set(queryName, formatBrowserLocalCalendarDate());
    router.replace(`${routePath}?${nextSearchParams.toString()}`);
  }, [queryName, routePath, router, searchParams]);

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
