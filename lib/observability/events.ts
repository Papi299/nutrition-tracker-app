import {
  createObservabilityEvent,
  type ObservabilityEvent,
  type ObservabilityEventInput,
} from "./contracts";

export type ObservabilitySink = Readonly<{
  emit: (event: ObservabilityEvent) => void;
}>;

export type ObservabilityEmissionResult =
  | { accepted: false }
  | { accepted: true; event: ObservabilityEvent };

export const consoleObservabilitySink: ObservabilitySink = Object.freeze({
  emit(event) {
    console.info(JSON.stringify({ observability: event }));
  },
});

export function emitObservabilityEvent(
  input: ObservabilityEventInput,
  sink: ObservabilitySink = consoleObservabilitySink,
): ObservabilityEmissionResult {
  try {
    const event = createObservabilityEvent(input);
    sink.emit(event);
    return { accepted: true, event };
  } catch {
    return { accepted: false };
  }
}

export class InMemoryObservabilitySink implements ObservabilitySink {
  readonly #events: ObservabilityEvent[] = [];
  readonly #limit: number;

  constructor(limit = 100) {
    if (!Number.isSafeInteger(limit) || limit < 1 || limit > 1_000) {
      throw new TypeError("Invalid in-memory observability limit.");
    }

    this.#limit = limit;
  }

  emit(event: ObservabilityEvent) {
    if (this.#events.length >= this.#limit) {
      throw new Error("In-memory observability sink capacity reached.");
    }

    this.#events.push(event);
  }

  read() {
    return Object.freeze([...this.#events]);
  }
}
