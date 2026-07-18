import { createHash } from "node:crypto";

export type JsonValue =
  | null
  | boolean
  | number
  | string
  | readonly JsonValue[]
  | { readonly [key: string]: JsonValue };

export function isPlainObject(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    Object.getPrototypeOf(value) === Object.prototype
  );
}

export function canonicalizeJson(value: JsonValue): string {
  if (value === null || typeof value === "boolean" || typeof value === "string") {
    return JSON.stringify(value);
  }

  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      throw new TypeError("Canonical JSON does not permit non-finite numbers.");
    }

    return JSON.stringify(Object.is(value, -0) ? 0 : value);
  }

  if (Array.isArray(value)) {
    return `[${value.map(canonicalizeJson).join(",")}]`;
  }

  if (!isPlainObject(value)) {
    throw new TypeError("Canonical JSON requires plain objects.");
  }

  return `{${Object.keys(value)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${canonicalizeJson(value[key] as JsonValue)}`)
    .join(",")}}`;
}

export function sha256Text(value: string) {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

export function fingerprintJson(value: JsonValue) {
  return sha256Text(canonicalizeJson(value));
}

export function deepFreezeJson<T extends JsonValue>(value: T): T {
  if (Array.isArray(value)) {
    for (const item of value) {
      deepFreezeJson(item);
    }
    Object.freeze(value);
  } else if (isPlainObject(value)) {
    for (const item of Object.values(value)) {
      deepFreezeJson(item as JsonValue);
    }
    Object.freeze(value);
  }

  return value;
}
