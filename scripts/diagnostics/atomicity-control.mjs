import { createServer } from "node:http";

// Loaded only by the disposable diagnostic runner. Never part of app runtime.
export async function startAtomicityControl() {
  const events = [];
  let armed = false, held;
  const server = createServer(async (request, response) => {
    let body = "";
    for await (const chunk of request) body += chunk;
    const path = new URL(request.url, "http://127.0.0.1").pathname;
    if (path === "/arm") {
      if (armed || held) { response.writeHead(409).end(); return; }
      armed = true;
    } else if (path === "/diary-ready") {
      const event = { ...JSON.parse(body), controllerAt: new Date().toISOString(), held: armed };
      events.push(event);
      if (armed) { armed = false; held = response; return; }
    } else if (path === "/event" || path === "/reference-completed") {
      events.push({ ...JSON.parse(body), controllerAt: new Date().toISOString() });
    } else if (path === "/release") {
      if (!held) { response.writeHead(409).end(); return; }
      events.push({ kind: "barrier-release", at: new Date().toISOString() });
      held.writeHead(200).end("{}"); held = undefined;
    } else if (path !== "/status") { response.writeHead(404).end(); return; }
    response.setHeader("content-type", "application/json");
    response.end(JSON.stringify({ armed, held: Boolean(held), events }));
  });
  await new Promise((ok, fail) => server.listen(0, "127.0.0.1", ok).once("error", fail));
  return { url: `http://127.0.0.1:${server.address().port}`, events,
    close: async () => {
      held?.writeHead(503).end();
      await new Promise((ok, fail) => server.close(error => error ? fail(error) : ok()));
    } };
}
