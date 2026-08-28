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
  const consumeReauthenticationIdentityMismatchUrl = new URL(
    "/__phase11e3/identity-mismatch/consume",
    controlUrl,
  );
  const consumeReauthenticationPasswordFailureUrl = new URL(
    "/__phase11e3/password-failure/consume",
    controlUrl,
  );
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
      requestUrl.pathname === "/auth/v1/token" &&
      requestUrl.searchParams.get("grant_type") === "password"
    ) {
      const failureControl = await originalFetch(
        consumeReauthenticationPasswordFailureUrl,
        { method: "POST" },
      );

      if (failureControl.status === 204) {
        return new Response(
          JSON.stringify({
            code: 503,
            error_code: "unexpected_failure",
            msg: "Deterministic local password verification failure",
          }),
          {
            headers: { "content-type": "application/json" },
            status: 503,
          },
        );
      }

      const mismatchControl = await originalFetch(
        consumeReauthenticationIdentityMismatchUrl,
        { method: "POST" },
      );

      if (mismatchControl.status === 204) {
        const providerResponse = await originalFetch(input, init);

        if (!providerResponse.ok) {
          return providerResponse;
        }

        const providerBody = await providerResponse.json();

        if (providerBody?.user) {
          providerBody.user.id = "00000000-0000-4000-8000-000000000001";
        }

        return new Response(JSON.stringify(providerBody), {
          headers: providerResponse.headers,
          status: providerResponse.status,
        });
      }
    }

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
