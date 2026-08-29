import "server-only";

import type { AccountExportFailureInjection } from "@/lib/account-export/collector";
import {
  applicationUrl,
  requestIsSameOrigin,
} from "@/lib/security/same-origin";

export { applicationUrl };

export function accountExportRequestIsSameOrigin(request: Request) {
  return requestIsSameOrigin(request);
}

export function accountExportFailureInjection(
  request: Request,
): AccountExportFailureInjection | undefined {
  if (
    process.env.DATE_E2E_LOCAL_SUPABASE === "1" &&
    request.headers.get("x-phase11e4-export-fault") === "after-diary"
  ) {
    return "after-diary";
  }

  return undefined;
}
