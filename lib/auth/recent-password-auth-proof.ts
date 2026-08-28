import { createHmac, timingSafeEqual } from "node:crypto";

export const recentPasswordAuthCookieName =
  "nutrition_tracker_recent_password_v1";
export const recentPasswordAuthLifetimeSeconds = 10 * 60;
export const recentPasswordAuthMaximumProofBytes = 1024;

const recentPasswordAuthVersion = "v1";
const maximumFutureSkewSeconds = 30;
const minimumSecretBytes = 32;
const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type RecentPasswordAuthPayload = Readonly<{
  v: 1;
  sub: string;
  sid: string;
  iat: number;
  exp: number;
}>;

export type RecentPasswordAuthVerification =
  | Readonly<{
      expiresAt: number;
      issuedAt: number;
      status: "valid";
    }>
  | Readonly<{
      reason:
        | "expired"
        | "future"
        | "invalid_encoding"
        | "invalid_lifetime"
        | "invalid_payload"
        | "invalid_signature"
        | "malformed"
        | "oversized"
        | "session_mismatch"
        | "unsupported_version"
        | "user_mismatch";
      status: "invalid";
    }>;

export function recentPasswordAuthCookieOptions(
  environment = process.env.NODE_ENV,
) {
  return {
    httpOnly: true,
    maxAge: recentPasswordAuthLifetimeSeconds,
    path: "/",
    sameSite: "strict" as const,
    secure: environment === "production",
  };
}

export function expiredRecentPasswordAuthCookieOptions(
  environment = process.env.NODE_ENV,
) {
  return {
    ...recentPasswordAuthCookieOptions(environment),
    maxAge: 0,
  };
}

function secretBytes(secret: string) {
  const bytes = Buffer.from(secret, "utf8");

  if (bytes.byteLength < minimumSecretBytes) {
    throw new Error(
      "The recent-password authentication proof secret is unavailable.",
    );
  }

  return bytes;
}

function requireUuid(value: string) {
  if (!uuidPattern.test(value)) {
    throw new Error("Recent-password authentication identity is invalid.");
  }
}

function requireServerTimestamp(value: number) {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error("Recent-password authentication time is invalid.");
  }
}

function canonicalPayload(payload: RecentPasswordAuthPayload) {
  return JSON.stringify(payload);
}

function canonicalBase64UrlDecode(value: string) {
  if (!/^[A-Za-z0-9_-]+$/.test(value)) {
    return null;
  }

  const decoded = Buffer.from(value, "base64url");
  return decoded.toString("base64url") === value ? decoded : null;
}

function invalid(
  reason: Extract<RecentPasswordAuthVerification, { status: "invalid" }>["reason"],
): RecentPasswordAuthVerification {
  return { reason, status: "invalid" };
}

export function issueRecentPasswordAuthProof({
  nowSeconds,
  secret,
  sessionId,
  userId,
}: {
  nowSeconds: number;
  secret: string;
  sessionId: string;
  userId: string;
}) {
  requireServerTimestamp(nowSeconds);
  requireUuid(userId);
  requireUuid(sessionId);

  const payload: RecentPasswordAuthPayload = {
    v: 1,
    sub: userId,
    sid: sessionId,
    iat: nowSeconds,
    exp: nowSeconds + recentPasswordAuthLifetimeSeconds,
  };
  const encodedPayload = Buffer.from(canonicalPayload(payload)).toString(
    "base64url",
  );
  const authenticatedValue = `${recentPasswordAuthVersion}.${encodedPayload}`;
  const signature = createHmac("sha256", secretBytes(secret))
    .update(authenticatedValue)
    .digest("base64url");

  return `${authenticatedValue}.${signature}`;
}

export function verifyRecentPasswordAuthProof({
  currentSessionId,
  currentUserId,
  nowSeconds,
  proof,
  secret,
}: {
  currentSessionId: string;
  currentUserId: string;
  nowSeconds: number;
  proof: string;
  secret: string;
}): RecentPasswordAuthVerification {
  requireServerTimestamp(nowSeconds);
  requireUuid(currentUserId);
  requireUuid(currentSessionId);
  const key = secretBytes(secret);

  if (Buffer.byteLength(proof, "utf8") > recentPasswordAuthMaximumProofBytes) {
    return invalid("oversized");
  }

  const segments = proof.split(".");

  if (segments.length !== 3 || segments.some((segment) => !segment)) {
    return invalid("malformed");
  }

  const [version, encodedPayload, encodedSignature] = segments;

  if (version !== recentPasswordAuthVersion) {
    return invalid("unsupported_version");
  }

  const payloadBytes = canonicalBase64UrlDecode(encodedPayload);
  const signatureBytes = canonicalBase64UrlDecode(encodedSignature);

  if (!payloadBytes || !signatureBytes) {
    return invalid("invalid_encoding");
  }

  const expectedSignature = createHmac("sha256", key)
    .update(`${version}.${encodedPayload}`)
    .digest();

  if (
    signatureBytes.byteLength !== expectedSignature.byteLength ||
    !timingSafeEqual(signatureBytes, expectedSignature)
  ) {
    return invalid("invalid_signature");
  }

  let payload: unknown;

  try {
    payload = JSON.parse(payloadBytes.toString("utf8"));
  } catch {
    return invalid("invalid_payload");
  }

  if (
    !payload ||
    typeof payload !== "object" ||
    Array.isArray(payload) ||
    Object.getPrototypeOf(payload) !== Object.prototype
  ) {
    return invalid("invalid_payload");
  }

  const candidate = payload as Record<string, unknown>;
  const expectedKeys = ["v", "sub", "sid", "iat", "exp"];

  if (
    Object.keys(candidate).length !== expectedKeys.length ||
    !expectedKeys.every((key, index) => Object.keys(candidate)[index] === key) ||
    candidate.v !== 1 ||
    typeof candidate.sub !== "string" ||
    typeof candidate.sid !== "string" ||
    typeof candidate.iat !== "number" ||
    typeof candidate.exp !== "number" ||
    !uuidPattern.test(candidate.sub) ||
    !uuidPattern.test(candidate.sid) ||
    !Number.isSafeInteger(candidate.iat) ||
    !Number.isSafeInteger(candidate.exp) ||
    candidate.iat < 0 ||
    candidate.exp < 0 ||
    canonicalPayload(candidate as unknown as RecentPasswordAuthPayload) !==
      payloadBytes.toString("utf8")
  ) {
    return invalid("invalid_payload");
  }

  if (candidate.exp - candidate.iat !== recentPasswordAuthLifetimeSeconds) {
    return invalid("invalid_lifetime");
  }

  if (candidate.iat > nowSeconds + maximumFutureSkewSeconds) {
    return invalid("future");
  }

  if (nowSeconds >= candidate.exp) {
    return invalid("expired");
  }

  if (candidate.sub !== currentUserId) {
    return invalid("user_mismatch");
  }

  if (candidate.sid !== currentSessionId) {
    return invalid("session_mismatch");
  }

  return {
    expiresAt: candidate.exp,
    issuedAt: candidate.iat,
    status: "valid",
  };
}
