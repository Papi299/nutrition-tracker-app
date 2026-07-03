"use client";

import { useActionState } from "react";
import type { DiaryEntryActionState } from "@/app/[locale]/(app)/today/action-state";

type DeleteAction = (
  state: DiaryEntryActionState,
  formData: FormData,
) => Promise<DiaryEntryActionState>;

function isErrorStatus(status: DiaryEntryActionState["status"]) {
  return status !== "idle" && status !== "success";
}

export function DiaryEntryDeleteButton({
  action,
  entryId,
  labels,
}: {
  action: DeleteAction;
  entryId: string;
  labels: {
    error: string;
    pending: string;
    submit: string;
  };
}) {
  const [state, formAction, isPending] = useActionState(action, {
    status: "idle",
    values: { id: entryId },
  } satisfies DiaryEntryActionState);

  return (
    <form action={formAction} className="grid justify-items-start gap-2">
      <input name="id" type="hidden" value={entryId} />
      <button
        className="min-h-10 border border-red-200 bg-white px-3 text-sm font-semibold text-red-700 transition-colors hover:border-red-400 hover:bg-red-50 disabled:cursor-wait disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-500"
        disabled={isPending}
        type="submit"
      >
        {isPending ? labels.pending : labels.submit}
      </button>
      {isErrorStatus(state.status) && (
        <p className="text-start text-sm leading-6 text-red-700">
          {labels.error}
        </p>
      )}
    </form>
  );
}
