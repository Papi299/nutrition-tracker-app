const controlUrlValue = process.env.LOCAL_SUPABASE_FAULT_CONTROL_URL;
const localSupabaseUrlValue = process.env.LOCAL_SUPABASE_URL;

if (controlUrlValue && localSupabaseUrlValue) {
  const controlUrl = new URL(controlUrlValue);
  const localSupabaseUrl = new URL(localSupabaseUrlValue);
  const loopbackHosts = new Set(["127.0.0.1", "localhost"]);

  if (
    !loopbackHosts.has(controlUrl.hostname) ||
    !loopbackHosts.has(localSupabaseUrl.hostname)
  ) {
    throw new Error(
      "Refusing to install the sign-out fault interceptor for a non-local URL.",
    );
  }

  const originalFetch = globalThis.fetch.bind(globalThis);
  const consumeRecoveryUrl = new URL(
    "/__phase11e2/recovery-failure/consume",
    controlUrl,
  );
  const consumeUrl = new URL(
    "/__phase11c/signout-failure/consume",
    controlUrl,
  );

  globalThis.fetch = async (input, init) => {
    const requestUrl = new URL(
      input instanceof Request ? input.url : String(input),
    );
    const method = (
      init?.method ?? (input instanceof Request ? input.method : "GET")
    ).toUpperCase();

    if (
      method === "POST" &&
      requestUrl.origin === localSupabaseUrl.origin &&
      requestUrl.pathname === "/auth/v1/recover"
    ) {
      const consumeResponse = await originalFetch(consumeRecoveryUrl, {
        method: "POST",
      });

      if (consumeResponse.status === 204) {
        return new Response(
          JSON.stringify({
            code: 503,
            error_code: "unexpected_failure",
            msg: "Deterministic local recovery failure",
          }),
          {
            headers: { "content-type": "application/json" },
            status: 503,
          },
        );
      }
    }

    if (
      method === "POST" &&
      requestUrl.origin === localSupabaseUrl.origin &&
      requestUrl.pathname === "/auth/v1/logout"
    ) {
      const consumeResponse = await originalFetch(consumeUrl, {
        method: "POST",
      });

      if (consumeResponse.status === 204) {
        return new Response(
          JSON.stringify({
            code: 503,
            error_code: "unexpected_failure",
            msg: "Deterministic local sign-out failure",
          }),
          {
            headers: { "content-type": "application/json" },
            status: 503,
          },
        );
      }
    }

    return originalFetch(input, init);
  };
}
