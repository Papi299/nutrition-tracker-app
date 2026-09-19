import { expect, test } from "@playwright/test";
import { supabaseSessionCookieOptions } from "@/lib/supabase/cookie-options";

test("device-test Supabase session cookies are Secure", () => {
  expect(supabaseSessionCookieOptions("device-test")).toEqual({ secure: true });
});

test("existing environment cookie policy is unchanged", () => {
  for (const environment of ["local", "test", "preview", "staging", "production"]) {
    expect(supabaseSessionCookieOptions(environment)).toBeUndefined();
  }
});
