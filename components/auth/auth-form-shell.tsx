export function AuthFormShell({
  emailLabel,
  emailPlaceholder,
  passwordLabel,
  passwordPlaceholder,
  submitLabel,
}: {
  emailLabel: string;
  emailPlaceholder: string;
  passwordLabel: string;
  passwordPlaceholder: string;
  submitLabel: string;
}) {
  return (
    <div className="grid gap-5" aria-label={submitLabel}>
      <label className="grid gap-2 text-start text-sm font-medium text-slate-900">
        <span>{emailLabel}</span>
        <input
          autoComplete="email"
          className="min-h-12 border border-slate-300 bg-white px-3 text-base text-slate-950 outline-none transition-colors placeholder:text-slate-400 focus:border-teal-700"
          placeholder={emailPlaceholder}
          type="email"
        />
      </label>

      <label className="grid gap-2 text-start text-sm font-medium text-slate-900">
        <span>{passwordLabel}</span>
        <input
          autoComplete="current-password"
          className="min-h-12 border border-slate-300 bg-white px-3 text-base text-slate-950 outline-none transition-colors placeholder:text-slate-400 focus:border-teal-700"
          placeholder={passwordPlaceholder}
          type="password"
        />
      </label>

      <button
        aria-disabled="true"
        className="min-h-12 cursor-not-allowed bg-slate-300 px-4 text-base font-semibold text-slate-600"
        disabled
        type="button"
      >
        {submitLabel}
      </button>
    </div>
  );
}
