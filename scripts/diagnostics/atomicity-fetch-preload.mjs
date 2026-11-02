// External test-process instrumentation, supplied by NODE_OPTIONS only in the
// isolated runner. No instrumentation is included in the application build.
const control = process.env.FULL35_ATOMICITY_CONTROL;
if (control) {
  const api = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL);
  if (![new URL(control).hostname, api.hostname].every(host => host === "127.0.0.1")) {
    throw new Error("Atomicity diagnostics require loopback endpoints.");
  }
  const original = globalThis.fetch.bind(globalThis);
  const report = (path, data) => original(new URL(path, control), {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(data),
  });
  globalThis.fetch = async (input, init) => {
    const url = new URL(input instanceof Request ? input.url : String(input));
    const reference = url.origin === api.origin && url.pathname === "/rest/v1/rpc/get_readable_food_nutrition_reference_v2";
    const write = url.origin === api.origin && /^\/rest\/v1\/rpc\/(?:create_manual_diary_entry(?:_v2)?|create_reference_diary_entry_v1)$/.test(url.pathname);
    let args;
    if (write) {
      args = JSON.parse(init?.body ?? await input.clone().text());
      // At this seam getReadableFoodDiaryPrefill has returned, all app-side
      // freshness/scaling checks have passed and no diary HTTP RPC has begun.
      await report("/diary-ready", { kind: "diary-rpc-ready", at: new Date().toISOString(), processPid: process.pid, rpc: url.pathname, args });
      await report("/event", { kind: "diary-rpc-start", at: new Date().toISOString(), processPid: process.pid, rpc: url.pathname, args });
    }
    const response = await original(input, init);
    if (reference) {
      const data = await response.clone().json();
      // Observe the unmodified, completed database response. The barrier is
      // later, at write dispatch, after the app has fully consumed this read.
      await report("/reference-completed", { kind: "reference-read-completed", at: new Date().toISOString(), processPid: process.pid, status: response.status, data });
    }
    if (write) await report("/event", { kind: "diary-rpc-completed", at: new Date().toISOString(), processPid: process.pid,
      key: args.p_idempotency_key, status: response.status, data: await response.clone().json() });
    return response;
  };
}
