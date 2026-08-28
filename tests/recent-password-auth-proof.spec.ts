import { createHmac } from "node:crypto";
import { expect, test } from "@playwright/test";
import {
  expiredRecentPasswordAuthCookieOptions,
  issueRecentPasswordAuthProof,
  recentPasswordAuthCookieName,
  recentPasswordAuthCookieOptions,
  recentPasswordAuthLifetimeSeconds,
  recentPasswordAuthMaximumProofBytes,
  verifyRecentPasswordAuthProof,
} from "@/lib/auth/recent-password-auth-proof";

const secret = "phase11e3-unit-test-only-secret-material-0123456789";
const userId = "11111111-1111-4111-8111-111111111111";
const otherUserId = "22222222-2222-4222-8222-222222222222";
const sessionId = "33333333-3333-4333-8333-333333333333";
const otherSessionId = "44444444-4444-4444-8444-444444444444";
const issuedAt = 2_000_000_000;

function proofFor(payloadText: string, version = "v1") {
  const encodedPayload = Buffer.from(payloadText).toString("base64url");
  const authenticatedValue = `${version}.${encodedPayload}`;
  const signature = createHmac("sha256", Buffer.from(secret))
    .update(authenticatedValue)
    .digest("base64url");
  return `${authenticatedValue}.${signature}`;
}

function canonicalPayload(overrides: Record<string, unknown> = {}) {
  return JSON.stringify({
    v: 1,
    sub: userId,
    sid: sessionId,
    iat: issuedAt,
    exp: issuedAt + recentPasswordAuthLifetimeSeconds,
    ...overrides,
  });
}

function validProof() {
  return issueRecentPasswordAuthProof({
    nowSeconds: issuedAt,
    secret,
    sessionId,
    userId,
  });
}

function verify(
  proof = validProof(),
  options: {
    currentSessionId?: string;
    currentUserId?: string;
    nowSeconds?: number;
  } = {},
) {
  return verifyRecentPasswordAuthProof({
    currentSessionId: options.currentSessionId ?? sessionId,
    currentUserId: options.currentUserId ?? userId,
    nowSeconds: options.nowSeconds ?? issuedAt,
    proof,
    secret,
  });
}

test.describe("recent-password authentication proof", () => {
  test("issues a bounded proof containing only the canonical identity, session, and time fields", () => {
    const proof = validProof();
    const [, encodedPayload] = proof.split(".");
    const payload = JSON.parse(
      Buffer.from(encodedPayload, "base64url").toString("utf8"),
    );

    expect(Buffer.byteLength(proof)).toBeLessThanOrEqual(
      recentPasswordAuthMaximumProofBytes,
    );
    expect(payload).toEqual({
      v: 1,
      sub: userId,
      sid: sessionId,
      iat: issuedAt,
      exp: issuedAt + 600,
    });
    expect(payload).not.toHaveProperty("email");
    expect(payload).not.toHaveProperty("password");
    expect(payload).not.toHaveProperty("access_token");
    expect(payload).not.toHaveProperty("refresh_token");
  });

  test("is valid immediately and immediately before the 600-second boundary", () => {
    expect(verify()).toMatchObject({ status: "valid" });
    expect(
      verify(validProof(), { nowSeconds: issuedAt + 599 }),
    ).toMatchObject({ status: "valid" });
  });

  test("is invalid at and after the exact expiry boundary", () => {
    expect(
      verify(validProof(), { nowSeconds: issuedAt + 600 }),
    ).toEqual({ reason: "expired", status: "invalid" });
    expect(
      verify(validProof(), { nowSeconds: issuedAt + 601 }),
    ).toEqual({ reason: "expired", status: "invalid" });
  });

  test("rejects another user and another session, including the same user's new session", () => {
    expect(
      verify(validProof(), { currentUserId: otherUserId }),
    ).toEqual({ reason: "user_mismatch", status: "invalid" });
    expect(
      verify(validProof(), { currentSessionId: otherSessionId }),
    ).toEqual({ reason: "session_mismatch", status: "invalid" });
  });

  test("rejects one-byte payload and signature modifications", () => {
    const [version, payload, signature] = validProof().split(".");
    const changedPayload = `${payload.slice(0, -1)}${payload.endsWith("A") ? "B" : "A"}`;
    const changedSignature = `${signature.slice(0, -1)}${signature.endsWith("A") ? "B" : "A"}`;

    expect(verify(`${version}.${changedPayload}.${signature}`)).toEqual({
      reason: "invalid_signature",
      status: "invalid",
    });
    expect(verify(`${version}.${payload}.${changedSignature}`)).toEqual({
      reason: "invalid_signature",
      status: "invalid",
    });
  });

  test("rejects truncation, malformed encoding, unsupported versions, and oversized input", () => {
    const [version, payload, signature] = validProof().split(".");

    expect(verify(`${version}.${payload}`)).toEqual({
      reason: "malformed",
      status: "invalid",
    });
    expect(verify(`${version}.%25.${signature}`)).toEqual({
      reason: "invalid_encoding",
      status: "invalid",
    });
    expect(verify(`v2.${payload}.${signature}`)).toEqual({
      reason: "unsupported_version",
      status: "invalid",
    });
    expect(verify("x".repeat(recentPasswordAuthMaximumProofBytes + 1))).toEqual({
      reason: "oversized",
      status: "invalid",
    });
  });

  test("rejects signed malformed, noncanonical, duplicate, and unexpected payloads", () => {
    expect(verify(proofFor("not-json"))).toEqual({
      reason: "invalid_payload",
      status: "invalid",
    });
    expect(verify(proofFor(`{ "v": 1, "sub": "${userId}" }`))).toEqual({
      reason: "invalid_payload",
      status: "invalid",
    });
    expect(
      verify(
        proofFor(
          `{"v":1,"sub":"${userId}","sub":"${otherUserId}","sid":"${sessionId}","iat":${issuedAt},"exp":${issuedAt + 600}}`,
        ),
      ),
    ).toEqual({ reason: "invalid_payload", status: "invalid" });
    expect(
      verify(proofFor(canonicalPayload({ extra: "unsupported" }))),
    ).toEqual({ reason: "invalid_payload", status: "invalid" });
  });

  test("rejects malformed timestamps, identity fields, and proof versions", () => {
    expect(verify(proofFor(canonicalPayload({ iat: "invalid" })))).toEqual({
      reason: "invalid_payload",
      status: "invalid",
    });
    expect(verify(proofFor(canonicalPayload({ sid: "invalid" })))).toEqual({
      reason: "invalid_payload",
      status: "invalid",
    });
    expect(verify(proofFor(canonicalPayload({ v: 2 })))).toEqual({
      reason: "invalid_payload",
      status: "invalid",
    });
  });

  test("rejects an impossible lifetime and materially future proof", () => {
    expect(
      verify(proofFor(canonicalPayload({ exp: issuedAt + 601 }))),
    ).toEqual({ reason: "invalid_lifetime", status: "invalid" });
    expect(
      verify(
        proofFor(
          canonicalPayload({
            iat: issuedAt + 31,
            exp: issuedAt + 631,
          }),
        ),
      ),
    ).toEqual({ reason: "future", status: "invalid" });
  });

  test("requires at least 32 bytes of server-only secret material", () => {
    expect(() =>
      issueRecentPasswordAuthProof({
        nowSeconds: issuedAt,
        secret: "too-short",
        sessionId,
        userId,
      }),
    ).toThrow(/unavailable/);
    expect(() =>
      verifyRecentPasswordAuthProof({
        currentSessionId: sessionId,
        currentUserId: userId,
        nowSeconds: issuedAt,
        proof: validProof(),
        secret: "too-short",
      }),
    ).toThrow(/unavailable/);
  });

  test("uses a stable strict host cookie and matching expiry attributes", () => {
    const production = recentPasswordAuthCookieOptions("production");
    const development = recentPasswordAuthCookieOptions("development");
    const expired = expiredRecentPasswordAuthCookieOptions("production");

    expect(recentPasswordAuthCookieName).toBe(
      "nutrition_tracker_recent_password_v1",
    );
    expect(production).toEqual({
      httpOnly: true,
      maxAge: 600,
      path: "/",
      sameSite: "strict",
      secure: true,
    });
    expect(production).not.toHaveProperty("domain");
    expect(development.secure).toBe(false);
    expect(expired).toEqual({ ...production, maxAge: 0 });
  });
});
