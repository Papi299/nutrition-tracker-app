import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";
import { getOptionalSupabasePublicEnv } from "@/lib/supabase/env";

export async function updateSession(
  request: NextRequest,
  response = NextResponse.next({ request }),
) {
  const supabaseEnv = getOptionalSupabasePublicEnv();

  if (!supabaseEnv) {
    return response;
  }

  const supabase = createServerClient(
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
    return response;
  }

  return response;
}
