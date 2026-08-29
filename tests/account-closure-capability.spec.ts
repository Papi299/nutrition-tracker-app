import { expect, test } from "@playwright/test";
import {
  accountClosureCapabilityIntent,
  accountClosurePolicyVersion,
  issueAccountClosureCapability,
  verifyAccountClosureCapability,
} from "@/lib/account-closure/capability";

const secret =
  "phase11e5-unit-test-only-closure-capability-secret-material-0123456789";
const userId = "10000000-0000-4000-8000-000000000001";
const sessionId = "20000000-0000-4000-8000-000000000002";
const requestId = "30000000-0000-4000-8000-000000000003";
const nowSeconds = 1_800_000_000;

function issue(overrides: Partial<Parameters<typeof issueAccountClosureCapability>[0]> = {}) {
  return issueAccountClosureCapability({
    e3ExpiresAt: nowSeconds + 600,
    nowSeconds,
    requestId,
    secret,
    sessionId,
    userId,
    ...overrides,
  });
}

function verify(
  capability: string,
  overrides: Partial<
    Parameters<typeof verifyAccountClosureCapability>[0]
  > = {},
) {
  return verifyAccountClosureCapability({
    capability,
    currentSessionId: sessionId,
    currentUserId: userId,
    nowSeconds,
    requestId,
    secret,
    ...overrides,
  });
}

test("issues the exact canonical E3-bound closure capability", () => {
  const capability = issue();
  const [version, encodedPayload, signature] = capability.split(".");
  const payload = JSON.parse(
    Buffer.from(encodedPayload, "base64url").toString("utf8"),
  );

  expect(version).toBe("v1");
  expect(signature).toMatch(/^[A-Za-z0-9_-]+$/);
  expect(Object.keys(payload)).toEqual([
    "v",
    "sub",
    "sid",
    "intent",
    "rid",
    "policy",
    "iat",
    "exp",
  ]);
  expect(payload).toEqual({
    v: 1,
    sub: userId,
    sid: sessionId,
    intent: accountClosureCapabilityIntent,
    rid: requestId,
    policy: accountClosurePolicyVersion,
    iat: nowSeconds,
    exp: nowSeconds + 60,
  });
  expect(verify(capability)).toEqual({
    expiresAt: nowSeconds + 60,
    issuedAt: nowSeconds,
    status: "valid",
  });
});

test("never extends authority beyond the E3 proof and rejects unsafe issuance", () => {
  const bounded = issue({ e3ExpiresAt: nowSeconds + 20 });

  expect(verify(bounded)).toEqual({
    expiresAt: nowSeconds + 20,
    issuedAt: nowSeconds,
    status: "valid",
  });
  expect(() => issue({ e3ExpiresAt: nowSeconds + 4 })).toThrow(
    "Recent password authentication must be repeated.",
  );
  expect(() => issue({ secret: "too-short" })).toThrow(
    "Account closure is unavailable.",
  );
  expect(() => issue({ requestId: "not-a-uuid" })).toThrow(
    "Account-closure capability identity is invalid.",
  );
});

test("rejects tampering, wrong bindings, expiry, future time, and malformed values", () => {
  const capability = issue();
  const [version, payload, signature] = capability.split(".");
  const mutatedSignature = `${signature[0] === "A" ? "B" : "A"}${signature.slice(1)}`;
  const mutatedPayload = `${payload[0] === "A" ? "B" : "A"}${payload.slice(1)}`;

  expect(verify(`${version}.${payload}.${mutatedSignature}`).status).toBe(
    "invalid",
  );
  expect(verify(`${version}.${mutatedPayload}.${signature}`).status).toBe(
    "invalid",
  );
  expect(
    verify(capability, {
      currentUserId: "40000000-0000-4000-8000-000000000004",
    }).status,
  ).toBe("invalid");
  expect(
    verify(capability, {
      currentSessionId: "50000000-0000-4000-8000-000000000005",
    }).status,
  ).toBe("invalid");
  expect(
    verify(capability, {
      requestId: "60000000-0000-4000-8000-000000000006",
    }).status,
  ).toBe("invalid");
  expect(
    verify(capability, { secret: `${secret}-wrong` }).status,
  ).toBe("invalid");
  expect(
    verify(capability, { nowSeconds: nowSeconds + 60 }).status,
  ).toBe("invalid");
  expect(
    verify(issue({ nowSeconds: nowSeconds + 31 }), { nowSeconds }).status,
  ).toBe("invalid");

  for (const malformed of [
    "",
    "v1.only-two",
    "v2.payload.signature",
    "v1.%%%.%%%",
    `v1.${"a".repeat(2100)}.signature`,
  ]) {
    expect(verify(malformed).status).toBe("invalid");
  }
});
