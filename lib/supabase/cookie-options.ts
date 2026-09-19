export function supabaseSessionCookieOptions(appEnvironment: string | undefined) {
  return appEnvironment === "device-test" ? { secure: true } : undefined;
}
