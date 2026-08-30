import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";
import type { Database } from "@/lib/supabase/database.types";
import { getOptionalSupabasePublicEnv } from "@/lib/supabase/env";
import {
  classifyObservabilityEnvironment,
  emitObservabilityEvent,
} from "@/lib/observability";

export async function updateSession(
  request: NextRequest,
  response = NextResponse.next({ request }),
) {
  const supabaseEnv = getOptionalSupabasePublicEnv();

  if (!supabaseEnv) {
    return response;
  }

  const supabase = createServerClient<Database>(
    supabaseEnv.url,
    supabaseEnv.publishableKey,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => {
            request.cookies.set(name, value);
          });

          cookiesToSet.forEach(({ name, options, value }) => {
            response.cookies.set(name, value, options);
          });
        },
      },
    },
  );

  try {
    await supabase.auth.getClaims();
  } catch {
    emitObservabilityEvent({
      environment: classifyObservabilityEnvironment(),
      errorCode: "auth_dependency_unavailable",
      name: "auth.failure",
      operation: "session",
      outcome: "unavailable",
      routeTemplate: "/[locale]",
      runtime: "node",
      severity: "warning",
      surface: "authentication",
    });
    return response;
  }

  return response;
}
