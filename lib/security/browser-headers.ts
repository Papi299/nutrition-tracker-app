type BrowserSecurityHeaderEnvironment = Readonly<{
  appOrigin?: string;
  environment?: string;
  supabaseUrl?: string;
}>;

export type BrowserSecurityHeader = Readonly<{
  key: string;
  value: string;
}>;

function validatedHttpOrigin(value: string, name: string) {
  let url: URL;

  try {
    url = new URL(value);
  } catch {
    throw new Error(`${name} must be an absolute HTTP(S) URL.`);
  }

  if (
    !["http:", "https:"].includes(url.protocol) ||
    url.username ||
    url.password
  ) {
    throw new Error(`${name} must be an absolute HTTP(S) URL without credentials.`);
  }

  return url;
}

function supabaseConnectSources(rawUrl?: string) {
  if (!rawUrl) return [];

  const url = validatedHttpOrigin(rawUrl, "NEXT_PUBLIC_SUPABASE_URL");
  const websocketProtocol = url.protocol === "https:" ? "wss:" : "ws:";

  return [url.origin, `${websocketProtocol}//${url.host}`];
}

function applicationUsesHttps(rawOrigin?: string) {
  if (!rawOrigin) return false;

  const url = validatedHttpOrigin(rawOrigin, "APP_ORIGIN");

  if (url.pathname !== "/" || url.search || url.hash) {
    throw new Error("APP_ORIGIN must contain only an origin.");
  }

  return url.protocol === "https:";
}

export function contentSecurityPolicy({
  appOrigin,
  environment,
  supabaseUrl,
}: BrowserSecurityHeaderEnvironment = {}) {
  const development = environment === "development";
  const scriptSources = ["'self'", "'unsafe-inline'"];

  if (development) scriptSources.push("'unsafe-eval'");

  const directives = [
    ["default-src", "'self'"],
    ["script-src", ...scriptSources],
    ["style-src", "'self'", "'unsafe-inline'"],
    ["img-src", "'self'", "blob:", "data:"],
    ["font-src", "'self'"],
    ["connect-src", "'self'", ...supabaseConnectSources(supabaseUrl)],
    ["media-src", "'self'", "blob:"],
    ["object-src", "'none'"],
    ["base-uri", "'self'"],
    ["form-action", "'self'"],
    ["frame-ancestors", "'none'"],
    ["frame-src", "'none'"],
    ["manifest-src", "'self'"],
  ];

  if (!development && applicationUsesHttps(appOrigin)) {
    directives.push(["upgrade-insecure-requests"]);
  }

  return directives.map((directive) => directive.join(" ")).join("; ") + ";";
}

export function browserSecurityHeaders(
  environment: BrowserSecurityHeaderEnvironment = {},
): BrowserSecurityHeader[] {
  return [
    {
      key: "Content-Security-Policy",
      value: contentSecurityPolicy(environment),
    },
    { key: "X-Frame-Options", value: "DENY" },
    { key: "X-Content-Type-Options", value: "nosniff" },
    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    {
      key: "Permissions-Policy",
      value:
        "camera=(self), microphone=(), geolocation=(), payment=(), usb=(), serial=(), fullscreen=()",
    },
  ];
}
