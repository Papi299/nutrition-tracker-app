import { createHmac, timingSafeEqual } from "node:crypto";

export const accountClosureCapabilityIntent = "account-closure";
export const accountClosureCapabilitySecretName =
  "ACCOUNT_CLOSURE_CAPABILITY_SECRET";
export const accountClosurePolicyVersion =
  "p11e-e5-account-closure-v1";
export const accountClosureCapabilityMaximumLifetimeSeconds = 60;
export const accountClosureCapabilityMinimumLifetimeSeconds = 5;
export const accountClosureCapabilityMaximumBytes = 2048;

const capabilityVersion = "v1";
const maximumFutureSkewSeconds = 30;
const minimumSecretBytes = 32;
const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

type AccountClosureCapabilityPayload = Readonly<{
  v: 1;
  sub: string;
  sid: string;
  intent: typeof accountClosureCapabilityIntent;
  rid: string;
  policy: typeof accountClosurePolicyVersion;
  iat: number;
  exp: number;
}>;

export type AccountClosureCapabilityVerification =
  | Readonly<{
      expiresAt: number;
      issuedAt: number;
      status: "valid";
    }>
  | Readonly<{ status: "invalid" }>;

function requireTimestamp(value: number) {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error("Account-closure capability time is invalid.");
  }
}

function requireUuid(value: string) {
  if (!uuidPattern.test(value)) {
    throw new Error("Account-closure capability identity is invalid.");
  }
}

function secretBytes(secret: string) {
  const bytes = Buffer.from(secret, "utf8");

  if (bytes.byteLength < minimumSecretBytes) {
    throw new Error("Account closure is unavailable.");
  }

  return bytes;
}

function canonicalPayload(payload: AccountClosureCapabilityPayload) {
  return JSON.stringify(payload);
}

function canonicalBase64UrlDecode(value: string) {
  if (!/^[A-Za-z0-9_-]+$/.test(value)) {
    return null;
  }

  const decoded = Buffer.from(value, "base64url");
  return decoded.toString("base64url") === value ? decoded : null;
}

export function issueAccountClosureCapability({
  e3ExpiresAt,
  nowSeconds,
  requestId,
  secret,
  sessionId,
  userId,
}: {
  e3ExpiresAt: number;
  nowSeconds: number;
  requestId: string;
  secret: string;
  sessionId: string;
  userId: string;
}) {
  requireTimestamp(nowSeconds);
  requireTimestamp(e3ExpiresAt);
  requireUuid(requestId);
  requireUuid(sessionId);
  requireUuid(userId);

  const expiresAt = Math.min(
    nowSeconds + accountClosureCapabilityMaximumLifetimeSeconds,
    e3ExpiresAt,
  );

  if (
    expiresAt - nowSeconds < accountClosureCapabilityMinimumLifetimeSeconds
  ) {
    throw new Error("Recent password authentication must be repeated.");
  }

  const payload: AccountClosureCapabilityPayload = {
    v: 1,
    sub: userId,
    sid: sessionId,
    intent: accountClosureCapabilityIntent,
    rid: requestId,
    policy: accountClosurePolicyVersion,
    iat: nowSeconds,
    exp: expiresAt,
  };
  const encodedPayload = Buffer.from(canonicalPayload(payload)).toString(
    "base64url",
  );
  const authenticatedValue = `${capabilityVersion}.${encodedPayload}`;
  const signature = createHmac("sha256", secretBytes(secret))
    .update(authenticatedValue)
    .digest("base64url");

  return `${authenticatedValue}.${signature}`;
}

export function verifyAccountClosureCapability({
  capability,
  currentSessionId,
  currentUserId,
  nowSeconds,
  requestId,
  secret,
}: {
  capability: string;
  currentSessionId: string;
  currentUserId: string;
  nowSeconds: number;
  requestId: string;
  secret: string;
}): AccountClosureCapabilityVerification {
  requireTimestamp(nowSeconds);
  requireUuid(currentSessionId);
  requireUuid(currentUserId);
  requireUuid(requestId);
  const key = secretBytes(secret);

  if (Buffer.byteLength(capability, "utf8") > accountClosureCapabilityMaximumBytes) {
    return { status: "invalid" };
  }

  const segments = capability.split(".");

  if (segments.length !== 3 || segments.some((segment) => !segment)) {
    return { status: "invalid" };
  }

  const [version, encodedPayload, encodedSignature] = segments;

  if (version !== capabilityVersion) {
    return { status: "invalid" };
  }

  const payloadBytes = canonicalBase64UrlDecode(encodedPayload);
  const signatureBytes = canonicalBase64UrlDecode(encodedSignature);

  if (!payloadBytes || !signatureBytes) {
    return { status: "invalid" };
  }

  const expectedSignature = createHmac("sha256", key)
    .update(`${version}.${encodedPayload}`)
    .digest();

  if (
    signatureBytes.byteLength !== expectedSignature.byteLength ||
    !timingSafeEqual(signatureBytes, expectedSignature)
  ) {
    return { status: "invalid" };
  }

  let payload: unknown;

  try {
    payload = JSON.parse(payloadBytes.toString("utf8"));
  } catch {
    return { status: "invalid" };
  }

  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return { status: "invalid" };
  }

  const candidate = payload as Record<string, unknown>;
  const expectedKeys = [
    "v",
    "sub",
    "sid",
    "intent",
    "rid",
    "policy",
    "iat",
    "exp",
  ];

  if (
    Object.keys(candidate).length !== expectedKeys.length ||
    !expectedKeys.every((key, index) => Object.keys(candidate)[index] === key) ||
    candidate.v !== 1 ||
    candidate.sub !== currentUserId ||
    candidate.sid !== currentSessionId ||
    candidate.intent !== accountClosureCapabilityIntent ||
    candidate.rid !== requestId ||
    candidate.policy !== accountClosurePolicyVersion ||
    !Number.isSafeInteger(candidate.iat) ||
    !Number.isSafeInteger(candidate.exp) ||
    canonicalPayload(candidate as unknown as AccountClosureCapabilityPayload) !==
      payloadBytes.toString("utf8")
  ) {
    return { status: "invalid" };
  }

  const issuedAt = candidate.iat as number;
  const expiresAt = candidate.exp as number;

  if (
    issuedAt < 0 ||
    expiresAt <= issuedAt ||
    expiresAt - issuedAt > accountClosureCapabilityMaximumLifetimeSeconds ||
    issuedAt > nowSeconds + maximumFutureSkewSeconds ||
    nowSeconds >= expiresAt
  ) {
    return { status: "invalid" };
  }

  return { expiresAt, issuedAt, status: "valid" };
}
