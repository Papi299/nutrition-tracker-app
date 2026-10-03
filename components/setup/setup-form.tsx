"use client";

import { useActionState } from "react";
import { AuthStatusNote } from "@/components/auth/auth-status-note";
import { Button } from "@/components/ui/button";
import {
  FieldError as FieldErrorMessage,
  FieldLabel,
  Input,
  Select,
} from "@/components/ui/form-controls";
import type {
  SetupActionState,
  SetupActionStatus,
  SetupFieldValues,
  SetupVisibleFieldName,
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
    <FieldErrorMessage>
      {messages[code] ?? messages.invalid_input}
    </FieldErrorMessage>
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
  permalink,
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
  labels: Record<SetupVisibleFieldName, string>;
  languageOptions: LanguageOption[];
  pendingLabel: string;
  permalink: string;
  sectionCopy: {
    profileHelp: string;
    targetDescription: string;
    targetTitle: string;
  };
  statusMessages: Record<SetupActionStatus, string>;
  submitLabel: string;
}) {
  const [state, formAction, isPending] = useActionState(
    action,
    initialState,
    permalink,
  );
  const values: SetupFieldValues = state.values;
  const statusTone = getStatusTone(state.status);
  const statusMessage = getStatusMessage(state.status, statusMessages);

  return (
    <form action={formAction} className="grid gap-8 text-start" noValidate>
      <input name="effectiveDate" type="hidden" value={values.effectiveDate} />
      <section className="grid gap-5">
        <div>
          <h2 className="ui-section-title">
            {labels.display_name}
          </h2>
          <p className="ui-body-secondary mt-2">
            {sectionCopy.profileHelp}
          </p>
        </div>

        <FieldLabel className="grid gap-2">
          <span>{labels.display_name}</span>
          <Input
            className="min-h-12"
            defaultValue={values.display_name}
            name="display_name"
            type="text"
          />
          <FieldError
            code={state.fieldErrors?.display_name}
            messages={fieldErrorMessages}
          />
        </FieldLabel>

        <FieldLabel className="grid gap-2">
          <span>{labels.preferred_language}</span>
          <Select
            className="min-h-12"
            defaultValue={values.preferred_language}
            name="preferred_language"
          >
            {languageOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
          <FieldError
            code={state.fieldErrors?.preferred_language}
            messages={fieldErrorMessages}
          />
        </FieldLabel>
      </section>

      <section className="grid gap-5 border-t border-border pt-6">
        <div>
          <h2 className="ui-section-title">
            {sectionCopy.targetTitle}
          </h2>
          <p className="ui-body-secondary mt-2">
            {sectionCopy.targetDescription}
          </p>
          <p className="ui-body-secondary mt-2">
            {blankHelper}
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          {(["calories", "protein_g", "carbohydrates_g", "fat_g"] as const).map(
            (field) => (
              <FieldLabel className="grid gap-2" key={field}>
                <span>{labels[field]}</span>
                <Input
                  className="min-h-12 tabular-nums"
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
              </FieldLabel>
            ),
          )}
        </div>
      </section>

      <Button
        disabled={isPending}
        pending={isPending}
        size="lg"
        type="submit"
      >
        {isPending ? pendingLabel : submitLabel}
      </Button>

      <AuthStatusNote tone={statusTone}>{statusMessage}</AuthStatusNote>
    </form>
  );
}
