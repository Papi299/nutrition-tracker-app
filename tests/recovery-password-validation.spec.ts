import { readFileSync } from "node:fs";
import { Script } from "node:vm";
import ts from "typescript";
import { expect, test } from "@playwright/test";
import { validateRecoveryPassword } from "@/lib/auth/recovery-password-validation";
import en from "@/messages/en.json";
import he from "@/messages/he.json";

const valid = "Abcdefghij1!";
const cases = [
  ["empty", "", "", "passwordRequired"],
  ["11-byte boundary", "Abcdefghi1!", "Abcdefghi1!", "passwordTooShort"],
  ["missing lowercase", "ABCDEFGHIJ1!", "ABCDEFGHIJ1!", "passwordRequirements"],
  ["missing uppercase", "abcdefghij1!", "abcdefghij1!", "passwordRequirements"],
  ["missing digit", "Abcdefghijk!", "Abcdefghijk!", "passwordRequirements"],
  ["missing symbol", "Abcdefghijk1", "Abcdefghijk1", "passwordRequirements"],
  ["Unicode symbol is not in provider's required set", "Abcdefghij1🙂", "Abcdefghij1🙂", "passwordRequirements"],
  ["Unicode lowercase is not ASCII lowercase", "ÉABCDEFGHI1!", "ÉABCDEFGHI1!", "passwordRequirements"],
  ["whitespace alone is not the symbol class", "Abcdefghij1 ", "Abcdefghij1 ", "passwordRequirements"],
  ["confirmation mismatch", valid, valid + " ", "passwordMismatch"],
  ["known provider byte maximum", valid + "a".repeat(61), valid + "a".repeat(61), "passwordTooLong"],
  ["multibyte maximum", valid + "🙂".repeat(16), valid + "🙂".repeat(16), "passwordTooLong"],
] as const;

for (const [label, password, confirmation, code] of cases) {
  test(`rejects ${label}`, () => {
    expect(validateRecoveryPassword(password, confirmation)).toBe(code);
  });
}

for (const password of [valid, " " + valid + " ", valid + "עברית🙂é", "Aa1!" + "a".repeat(68), "Aa1!🙂🙂"]) {
  test(`accepts supported input case ${[valid, " " + valid + " ", valid + "עברית🙂é", "Aa1!" + "a".repeat(68), "Aa1!🙂🙂"].indexOf(password)}`, () => {
    expect(validateRecoveryPassword(password, password)).toBeNull();
  });
}

test("accepts every provider symbol without excluding additional characters", () => {
  for (const symbol of "!@#$%^&*()_+-=[]{};'\\:\"|<>?,./`~") {
    const password = "Abcdefghij1" + symbol;
    expect(validateRecoveryPassword(password, password)).toBeNull();
  }
});

test("recovery translation keys and error contract remain symmetric", () => {
  expect(Object.keys(en.Auth.recoveryReset).sort()).toEqual(Object.keys(he.Auth.recoveryReset).sort());
  expect(Object.keys(en.Auth.recoveryReset.errors).sort()).toEqual(Object.keys(he.Auth.recoveryReset.errors).sort());
  for (const catalog of [en, he]) {
    for (const [, , , code] of cases) expect(catalog.Auth.recoveryReset.errors[code]).toBeTruthy();
    expect(catalog.Auth.recoveryReset.statusIdle).toContain("12");
    expect(catalog.Auth.recoveryReset.statusIdle).toContain("a–z");
    expect(catalog.Auth.recoveryReset.statusIdle).toContain("A–Z");
  }
});

test("the real server action returns all policy errors without touching cookies or any Auth operation", async () => {
  // Load the actual action with boundary mocks. Any cookie/session/Auth access
  // throws, so this tests ordering and side effects, not a copied action.
  const source = readFileSync("app/[locale]/auth/recover/reset/actions.ts", "utf8");
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const effects: string[] = [];
  const forbidden = (name: string) => () => { effects.push(name); throw new Error("Unexpected effect"); };
  const mocks: Record<string, unknown> = {
    "next/headers": { cookies: forbidden("cookies") },
    "next/navigation": { redirect: forbidden("redirect") },
    "@/lib/auth/require-user": { resolveAuthLocale: (locale: string) => locale },
    "@/lib/auth/password-recovery": { createPasswordRecoveryClient: forbidden("Auth client") },
    "@/lib/auth/recent-password-auth": { clearRecentPasswordAuthentication: forbidden("proof cleanup") },
    "@/lib/supabase": { createServerClient: forbidden("application session") },
    "@/lib/auth/recovery-password-validation": { validateRecoveryPassword },
  };
  const exports: { completePasswordRecoveryAction?: (locale: string, previous: {status: "idle"}, form: FormData) => Promise<unknown> } = {};
  new Script(compiled).runInNewContext({ exports, require: (name: string) => {
    if (!(name in mocks)) throw new Error("Unmocked action dependency");
    return mocks[name];
  }});
  for (const locale of ["en", "he"]) {
    for (const [, password, confirmation, code] of cases) {
      const form = new FormData();
      form.set("password", password); form.set("passwordConfirmation", confirmation);
      expect(await exports.completePasswordRecoveryAction!(locale, {status: "idle"}, form)).toEqual({status: "error", code});
    }
  }
  expect(effects).toEqual([]);
});
