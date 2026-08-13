import { NextResponse, type NextRequest } from "next/server";
import { submitDiaryEntryCreate } from "@/app/[locale]/(app)/today/create-submission";
import { resolveAuthLocale } from "@/lib/auth/require-user";

function redirectSeeOther(location: string) {
  return new NextResponse(null, {
    headers: { location },
    status: 303,
  });
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ locale: string }> },
) {
  const { locale: localeInput } = await context.params;
  const locale = resolveAuthLocale(localeInput);
  const formData = await request.formData();
  const { result } = await submitDiaryEntryCreate(formData);

  if (!result.ok && result.code === "unauthenticated") {
    return redirectSeeOther(`/${locale}/auth/sign-in`);
  }

  const date = String(formData.get("entry_date") ?? "");
  const destination = /^\d{4}-\d{2}-\d{2}$/.test(date)
    ? `/${locale}/today?date=${encodeURIComponent(date)}`
    : `/${locale}/today`;

  return redirectSeeOther(destination);
}
