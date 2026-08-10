import { spawn, spawnSync } from "node:child_process";
import { createServer } from "node:http";

function parseEnvironment(output) {
  const values = new Map();

  for (const line of output.split(/\r?\n/)) {
    const match = /^([A-Z][A-Z0-9_]*)=(.*)$/.exec(line.trim());

    if (!match) {
      continue;
    }

    const rawValue = match[2];
    const value =
      rawValue.startsWith('"') && rawValue.endsWith('"')
        ? rawValue.slice(1, -1)
        : rawValue;
    values.set(match[1], value);
  }

  return values;
}

const status = spawnSync("npx", ["supabase", "status", "-o", "env"], {
  encoding: "utf8",
});

if (status.status !== 0) {
  process.stderr.write(status.stderr || "Local Supabase is not available.\n");
  process.exit(status.status ?? 1);
}

const localEnvironment = parseEnvironment(status.stdout);
const apiUrl = localEnvironment.get("API_URL");
const publishableKey =
  localEnvironment.get("PUBLISHABLE_KEY") ?? localEnvironment.get("ANON_KEY");

if (!apiUrl || !publishableKey) {
  process.stderr.write(
    "Local Supabase did not report an API URL and public client key.\n",
  );
  process.exit(1);
}

const parsedUrl = new URL(apiUrl);

if (parsedUrl.hostname !== "127.0.0.1" && parsedUrl.hostname !== "localhost") {
  process.stderr.write(
    "Refusing to run authenticated Playwright tests against a remote API.\n",
  );
  process.exit(1);
}

function startLocalSupabaseFaultControl() {
  let pendingSignOutFailures = 0;

  const server = createServer((request, response) => {
    const requestUrl = new URL(request.url ?? "/", "http://127.0.0.1");

    if (
      request.method === "POST" &&
      requestUrl.pathname === "/__phase11c/signout-failure"
    ) {
      pendingSignOutFailures += 1;
      request.resume();
      response.writeHead(204);
      response.end();
      return;
    }

    if (
      request.method === "POST" &&
      requestUrl.pathname === "/__phase11c/signout-failure/consume"
    ) {
      request.resume();

      if (pendingSignOutFailures > 0) {
        pendingSignOutFailures -= 1;
        response.writeHead(204);
      } else {
        response.writeHead(200);
      }

      response.end();
      return;
    }

    request.resume();
    response.writeHead(404);
    response.end();
  });

  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();

      if (!address || typeof address === "string") {
        reject(new Error("Local Supabase fault control did not bind a TCP port."));
        return;
      }

      const controlBaseUrl = `http://127.0.0.1:${address.port}`;
      resolve({
        controlUrl: `${controlBaseUrl}/__phase11c/signout-failure`,
        close: () =>
          new Promise((closeResolve, closeReject) => {
            server.close((error) => {
              if (error) closeReject(error);
              else closeResolve();
            });
          }),
      });
    });
  });
}

const faultControl = await startLocalSupabaseFaultControl();

const childEnvironment = { ...process.env };

delete childEnvironment.SUPABASE_SERVICE_ROLE_KEY;
delete childEnvironment.SERVICE_ROLE_KEY;
delete childEnvironment.SUPABASE_SECRET_KEY;

const signOutFaultPreload = new URL(
  "./local-supabase-signout-fault.mjs",
  import.meta.url,
);
const nodeOptions = childEnvironment.NODE_OPTIONS?.trim();

Object.assign(childEnvironment, {
  DATE_E2E_LOCAL_SUPABASE: "1",
  LOCAL_SUPABASE_FAULT_CONTROL_URL: faultControl.controlUrl,
  LOCAL_SUPABASE_PUBLISHABLE_KEY: publishableKey,
  LOCAL_SUPABASE_URL: apiUrl,
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: publishableKey,
  NEXT_PUBLIC_SUPABASE_URL: apiUrl,
  NODE_OPTIONS: [nodeOptions, `--import=${signOutFaultPreload.href}`]
    .filter(Boolean)
    .join(" "),
});

const playwright = spawn(
  "npx",
  ["playwright", "test", ...process.argv.slice(2)],
  {
    env: childEnvironment,
    stdio: "inherit",
  },
);

const playwrightStatus = await new Promise((resolve, reject) => {
  playwright.once("error", reject);
  playwright.once("exit", (code) => resolve(code ?? 1));
});

await faultControl.close();
process.exitCode = playwrightStatus;
