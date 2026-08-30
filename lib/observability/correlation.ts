const correlationIdPattern = /^obs_[0-9a-f]{32}$/;

export function createCorrelationId() {
  return `obs_${crypto.randomUUID().replaceAll("-", "")}`;
}

export function isCorrelationId(value: unknown): value is string {
  return typeof value === "string" && correlationIdPattern.test(value);
}
