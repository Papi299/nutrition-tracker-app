import { expect, test } from "@playwright/test";
import {
  browserSecurityHeaders,
  contentSecurityPolicy,
} from "@/lib/security/browser-headers";

function directives(policy: string) {
  return new Map(
    policy
      .split(";")
      .map((value) => value.trim())
      .filter(Boolean)
      .map((value) => {
        const [name, ...sources] = value.split(/\s+/);
        return [name, sources] as const;
      }),
  );
}

test("production CSP is restrictive and permits only the configured Supabase origin", () => {
  const policy = contentSecurityPolicy({
    appOrigin: "https://nutrition.example",
    environment: "production",
    supabaseUrl: "https://project-ref.supabase.co",
  });
  const parsed = directives(policy);

  expect(parsed.get("default-src")).toEqual(["'self'"]);
  expect(parsed.get("script-src")).toEqual(["'self'", "'unsafe-inline'"]);
  expect(parsed.get("style-src")).toEqual(["'self'", "'unsafe-inline'"]);
  expect(parsed.get("img-src")).toEqual(["'self'", "blob:", "data:"]);
  expect(parsed.get("font-src")).toEqual(["'self'"]);
  expect(parsed.get("connect-src")).toEqual([
    "'self'",
    "https://project-ref.supabase.co",
    "wss://project-ref.supabase.co",
  ]);
  expect(parsed.get("media-src")).toEqual(["'self'", "blob:"]);
  expect(parsed.get("object-src")).toEqual(["'none'"]);
  expect(parsed.get("base-uri")).toEqual(["'self'"]);
  expect(parsed.get("form-action")).toEqual(["'self'"]);
  expect(parsed.get("frame-ancestors")).toEqual(["'none'"]);
  expect(parsed.get("frame-src")).toEqual(["'none'"]);
  expect(parsed.get("manifest-src")).toEqual(["'self'"]);
  expect(parsed.has("upgrade-insecure-requests")).toBe(true);
  expect(policy).not.toContain("'unsafe-eval'");
  expect(policy).not.toContain("*");
});

test("development adds only the framework-required eval relaxation", () => {
  const production = contentSecurityPolicy({
    appOrigin: "http://127.0.0.1:3100",
    environment: "production",
    supabaseUrl: "http://127.0.0.1:54321",
  });
  const development = contentSecurityPolicy({
    appOrigin: "http://127.0.0.1:3100",
    environment: "development",
    supabaseUrl: "http://127.0.0.1:54321",
  });

  expect(directives(production).get("script-src")).toEqual([
    "'self'",
    "'unsafe-inline'",
  ]);
  expect(directives(development).get("script-src")).toEqual([
    "'self'",
    "'unsafe-inline'",
    "'unsafe-eval'",
  ]);
  expect(directives(production).get("connect-src")).toEqual([
    "'self'",
    "http://127.0.0.1:54321",
    "ws://127.0.0.1:54321",
  ]);
  expect(directives(production).has("upgrade-insecure-requests")).toBe(false);
});

test("required browser headers are exact and avoid premature global policies", () => {
  const headers = new Map(
    browserSecurityHeaders({ environment: "production" }).map(
      ({ key, value }) => [key, value],
    ),
  );

  expect(headers.get("X-Frame-Options")).toBe("DENY");
  expect(headers.get("X-Content-Type-Options")).toBe("nosniff");
  expect(headers.get("Referrer-Policy")).toBe(
    "strict-origin-when-cross-origin",
  );
  expect(headers.get("Permissions-Policy")).toBe(
    "camera=(self), microphone=(), geolocation=(), payment=(), usb=(), serial=(), fullscreen=()",
  );
  expect(headers.has("Strict-Transport-Security")).toBe(false);
  expect(headers.has("Cross-Origin-Embedder-Policy")).toBe(false);
  expect(headers.has("Cross-Origin-Opener-Policy")).toBe(false);
  expect(headers.has("X-XSS-Protection")).toBe(false);
});

test("invalid external origins fail closed instead of widening connect-src", () => {
  expect(() =>
    contentSecurityPolicy({
      environment: "production",
      supabaseUrl: "https://user:password@example.com/path",
    }),
  ).toThrow(/without credentials/);
  expect(() =>
    contentSecurityPolicy({
      appOrigin: "https://example.com/unexpected-path",
      environment: "production",
    }),
  ).toThrow(/only an origin/);
});
