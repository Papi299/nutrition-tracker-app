"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
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
      <Button
        disabled={isPending}
        pending={isPending}
        size="sm"
        type="submit"
        variant="destructive"
      >
        {isPending ? labels.pending : labels.submit}
      </Button>
      {isErrorStatus(state.status) && (
        <p className="text-start text-sm leading-6 text-danger-foreground">
          {labels.error}
        </p>
      )}
    </form>
  );
}
