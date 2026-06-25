"use client";

import { useActionState } from "react";
import { AuthStatusNote } from "@/components/auth/auth-status-note";
import type {
  SetupActionState,
  SetupActionStatus,
  SetupFieldName,
  SetupFieldValues,
} from "@/app/[locale]/(app)/setup/action-state";

type LanguageOption = {
  label: string;
  value: string;
};

type FieldErrorMessages = Partial<Record<string, string>>;

function getStatusTone(status: SetupActionStatus) {
  return status === "idle" ? "info" : status === "success" ? "success" : "error";
}

function getStatusMessage(
  status: SetupActionStatus,
  messages: Record<SetupActionStatus, string>,
) {
  return messages[status];
}

function FieldError({
  code,
  messages,
}: {
  code?: string;
  messages: FieldErrorMessages;
}) {
  if (!code) {
    return null;
  }

  return (
    <span className="text-sm font-normal text-red-700">
      {messages[code] ?? messages.invalid_input}
    </span>
  );
}

export function SetupForm({
  action,
  blankHelper,
  fieldErrorMessages,
  initialState,
  labels,
  languageOptions,
  pendingLabel,
  sectionCopy,
  statusMessages,
  submitLabel,
}: {
  action: (
    state: SetupActionState,
    formData: FormData,
  ) => Promise<SetupActionState>;
  blankHelper: string;
  fieldErrorMessages: FieldErrorMessages;
  initialState: SetupActionState;
  labels: Record<SetupFieldName, string>;
  languageOptions: LanguageOption[];
  pendingLabel: string;
  sectionCopy: {
    profileHelp: string;
    targetDescription: string;
    targetTitle: string;
  };
  statusMessages: Record<SetupActionStatus, string>;
  submitLabel: string;
}) {
  const [state, formAction, isPending] = useActionState(action, initialState);
  const values: SetupFieldValues = state.values;
  const statusTone = getStatusTone(state.status);
  const statusMessage = getStatusMessage(state.status, statusMessages);

  return (
    <form action={formAction} className="grid gap-8 text-start" noValidate>
      <section className="grid gap-5">
        <div>
          <h2 className="text-lg font-semibold text-slate-950">
            {labels.display_name}
          </h2>
          <p className="mt-2 text-sm leading-6 text-slate-700">
            {sectionCopy.profileHelp}
          </p>
        </div>

        <label className="grid gap-2 text-sm font-medium text-slate-900">
          <span>{labels.display_name}</span>
          <input
            className="min-h-12 border border-slate-300 bg-white px-3 text-base text-slate-950 outline-none transition-colors placeholder:text-slate-400 focus:border-teal-700"
            defaultValue={values.display_name}
            name="display_name"
            type="text"
          />
          <FieldError
            code={state.fieldErrors?.display_name}
            messages={fieldErrorMessages}
          />
        </label>

        <label className="grid gap-2 text-sm font-medium text-slate-900">
          <span>{labels.preferred_language}</span>
          <select
            className="min-h-12 border border-slate-300 bg-white px-3 text-base text-slate-950 outline-none transition-colors focus:border-teal-700"
            defaultValue={values.preferred_language}
            name="preferred_language"
          >
            {languageOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <FieldError
            code={state.fieldErrors?.preferred_language}
            messages={fieldErrorMessages}
          />
        </label>
      </section>

      <section className="grid gap-5 border-t border-slate-200 pt-6">
        <div>
          <h2 className="text-lg font-semibold text-slate-950">
            {sectionCopy.targetTitle}
          </h2>
          <p className="mt-2 text-sm leading-6 text-slate-700">
            {sectionCopy.targetDescription}
          </p>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            {blankHelper}
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          {(["calories", "protein_g", "carbohydrates_g", "fat_g"] as const).map(
            (field) => (
              <label
                className="grid gap-2 text-sm font-medium text-slate-900"
                key={field}
              >
                <span>{labels[field]}</span>
                <input
                  className="min-h-12 border border-slate-300 bg-white px-3 text-base text-slate-950 outline-none transition-colors placeholder:text-slate-400 focus:border-teal-700"
                  defaultValue={values[field]}
                  inputMode="decimal"
                  min="0"
                  name={field}
                  type="number"
                />
                <FieldError
                  code={state.fieldErrors?.[field]}
                  messages={fieldErrorMessages}
                />
              </label>
            ),
          )}
        </div>
      </section>

      <button
        className="min-h-12 bg-teal-700 px-4 text-base font-semibold text-white transition-colors hover:bg-teal-800 disabled:cursor-wait disabled:bg-slate-300 disabled:text-slate-600"
        disabled={isPending}
        type="submit"
      >
        {isPending ? pendingLabel : submitLabel}
      </button>

      <AuthStatusNote tone={statusTone}>{statusMessage}</AuthStatusNote>
    </form>
  );
}
