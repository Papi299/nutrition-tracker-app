import Link from "next/link";
import { AuthFormShell } from "@/components/auth/auth-form-shell";
import { AuthStatusNote } from "@/components/auth/auth-status-note";

export function AuthCard({
  alternateHref,
  alternateLabel,
  alternateText,
  description,
  emailLabel,
  emailPlaceholder,
  homeHref,
  homeLabel,
  passwordLabel,
  passwordPlaceholder,
  statusNote,
  submitLabel,
  title,
}: {
  alternateHref: string;
  alternateLabel: string;
  alternateText: string;
  description: string;
  emailLabel: string;
  emailPlaceholder: string;
  homeHref: string;
  homeLabel: string;
  passwordLabel: string;
  passwordPlaceholder: string;
  statusNote: string;
  submitLabel: string;
  title: string;
}) {
  return (
    <main className="min-h-screen bg-stone-50 px-6 py-8 text-slate-950 sm:px-10 sm:py-12">
      <section className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-md flex-col justify-center gap-8">
        <Link
          className="w-fit text-start text-sm font-medium text-teal-700 hover:text-teal-900"
          href={homeHref}
        >
          {homeLabel}
        </Link>

        <div className="border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <div className="text-start">
            <h1 className="text-3xl font-semibold text-slate-950">{title}</h1>
            <p className="mt-3 text-base leading-7 text-slate-700">
              {description}
            </p>
          </div>

          <div className="mt-8">
            <AuthFormShell
              emailLabel={emailLabel}
              emailPlaceholder={emailPlaceholder}
              passwordLabel={passwordLabel}
              passwordPlaceholder={passwordPlaceholder}
              submitLabel={submitLabel}
            />
          </div>

          <p className="mt-6 text-start text-sm text-slate-700">
            {alternateText}{" "}
            <Link
              className="font-medium text-teal-700 hover:text-teal-900"
              href={alternateHref}
            >
              {alternateLabel}
            </Link>
          </p>
        </div>

        <AuthStatusNote>{statusNote}</AuthStatusNote>
      </section>
    </main>
  );
}
