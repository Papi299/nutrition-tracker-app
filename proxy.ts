import createMiddleware from "next-intl/middleware";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { routing } from "./lib/i18n/routing";
import { updateSession } from "./lib/supabase/proxy";

const handleI18nRouting = createMiddleware(routing);
const localePreferenceCookie = "nutrition_tracker_locale";

export default async function proxy(request: NextRequest) {
  if (request.nextUrl.pathname === "/") {
    const explicitPreference = request.cookies.get(localePreferenceCookie)?.value;

    if (routing.locales.includes(explicitPreference as "en" | "he")) {
      const destination = request.nextUrl.clone();
      destination.pathname = `/${explicitPreference}`;
      return updateSession(request, NextResponse.redirect(destination));
    }
  }

  const response = handleI18nRouting(request);

  return updateSession(request, response);
}

export const config = {
  matcher: ["/((?!api|_next|_vercel|.*\\..*).*)"],
};
