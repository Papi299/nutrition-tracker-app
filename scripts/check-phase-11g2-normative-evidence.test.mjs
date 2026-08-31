import assert from "node:assert/strict";
import test from "node:test";
import { assertPrivacySafeText } from "./check-phase-11g2-normative-evidence.mjs";

test("accepts opaque normative trace metadata", () => {
  assert.doesNotThrow(() =>
    assertPrivacySafeText(
      '{"correlationId":"perf_0123456789abcdef0123456789abcdef","routeTemplate":"/[locale]/foods"}',
    ),
  );
});

test("rejects identities, credentials, JWTs, and UUIDs", () => {
  for (const value of [
    "phase11g2-user-001@example.test",
    "authorization: Bearer secret",
    "refresh_token",
    "Phase11G2SyntheticOnly",
    "eyJabcdefghijk.abcdefghijkl.abcdefghijkl",
    "01234567-89ab-4def-8abc-0123456789ab",
  ]) {
    assert.throws(() => assertPrivacySafeText(value), /forbidden/);
  }
});
