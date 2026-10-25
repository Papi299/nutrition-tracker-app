import "server-only";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { hasAuthenticatedUser, signInPath } from "@/lib/auth/require-user";
import { defaultLocale, locales, type Locale } from "@/lib/i18n/routing";
import type { DiaryEntryActionState } from "./action-state";
import { readCreateValues, submitDiaryEntryCreate, type TrustedDiaryReferenceContext } from "./create-submission";

// This helper is not a Server Action endpoint. Only the page's encrypted inline
// action can supply a trusted reference captured for its authenticated owner.
export async function createDiaryEntryFromReference(
  localeInput: string, _previousState: DiaryEntryActionState, formData: FormData,
  context?: TrustedDiaryReferenceContext,
): Promise<DiaryEntryActionState> {
  const locale = (locales as readonly string[]).includes(localeInput) ? localeInput as Locale : defaultLocale;
  const native = formData.get("native_submission") === "1";
  if (formData.get("submission_intent") === "start_new") {
    if (native && !(await hasAuthenticatedUser())) redirect(signInPath(locale));
    return { status: "idle", values: { ...readCreateValues(formData), idempotency_key: randomUUID() } };
  }
  const { result, values } = await submitDiaryEntryCreate(formData, context);
  if (!result.ok) {
    if (native && result.code === "unauthenticated") redirect(signInPath(locale));
    return {
      status: result.code === "already_exists" ? "database_error" : result.code,
      ...("fieldErrors" in result ? { fieldErrors: result.fieldErrors } : {}),
      values,
    };
  }
  revalidatePath(`/${locale}/today`);
  return { status: "success", values };
}
