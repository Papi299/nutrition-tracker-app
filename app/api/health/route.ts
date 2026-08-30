import {
  classifyObservabilityEnvironment,
  emitObservabilityEvent,
} from "@/lib/observability";

export const dynamic = "force-dynamic";

const responseHeaders = {
  "Cache-Control": "no-store, max-age=0",
  "Content-Type": "application/json; charset=utf-8",
} as const;

function recordLivenessSignal() {
  emitObservabilityEvent({
    environment: classifyObservabilityEnvironment(),
    name: "health.liveness",
    operation: "liveness",
    outcome: "healthy",
    routeTemplate: "/api/health",
    runtime: "node",
    severity: "info",
    surface: "health_endpoint",
  });
}

export async function GET() {
  recordLivenessSignal();

  return new Response(JSON.stringify({ status: "live" }), {
    headers: responseHeaders,
    status: 200,
  });
}

export async function HEAD() {
  recordLivenessSignal();

  return new Response(null, {
    headers: responseHeaders,
    status: 200,
  });
}
