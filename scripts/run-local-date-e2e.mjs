import { spawn, spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
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
const serviceRoleKey =
  localEnvironment.get("SECRET_KEY") ??
  localEnvironment.get("SERVICE_ROLE_KEY");
const mailpitUrl =
  localEnvironment.get("MAILPIT_URL") ?? localEnvironment.get("INBUCKET_URL");

if (!apiUrl || !publishableKey || !serviceRoleKey || !mailpitUrl) {
  process.stderr.write(
    "Local Supabase did not report the required local test endpoints and keys.\n",
  );
  process.exit(1);
}

const parsedUrl = new URL(apiUrl);
const parsedMailpitUrl = new URL(mailpitUrl);
const projectId = readFileSync("supabase/config.toml", "utf8").match(
  /^project_id\s*=\s*"([^"]+)"/m,
)?.[1];

if (
  !projectId ||
  ![parsedUrl.hostname, parsedMailpitUrl.hostname].every((hostname) =>
    ["127.0.0.1", "localhost"].includes(hostname),
  )
) {
  process.stderr.write(
    "Refusing to run authenticated Playwright tests against a remote API.\n",
  );
  process.exit(1);
}

const accountClosureCapabilitySecret = randomBytes(48).toString("base64url");
const vaultProvisioning = spawnSync(
  "docker",
  [
    "exec",
    "-i",
    `supabase_db_${projectId}`,
    "psql",
    "-U",
    "postgres",
    "-d",
    "postgres",
    "-X",
    "-v",
    "ON_ERROR_STOP=1",
    "-q",
  ],
  {
    encoding: "utf8",
    input: `
      do $$
      declare
        v_secret_id uuid;
      begin
        select secrets.id
        into v_secret_id
        from vault.secrets as secrets
        where secrets.name = 'account_closure_capability_v1';

        if v_secret_id is null then
          perform vault.create_secret(
            '${accountClosureCapabilitySecret}',
            'account_closure_capability_v1',
            'Synthetic local E5 test secret'
          );
        else
          perform vault.update_secret(
            v_secret_id,
            '${accountClosureCapabilitySecret}',
            'account_closure_capability_v1',
            'Synthetic local E5 test secret'
          );
        end if;
      end;
      $$;
    `,
  },
);

if (vaultProvisioning.status !== 0) {
  process.stderr.write(
    vaultProvisioning.stderr ||
      "Could not provision the synthetic local closure secret.\n",
  );
  process.exit(vaultProvisioning.status ?? 1);
}

function startLocalSupabaseFaultControl() {
  let pendingReauthenticationIdentityMismatches = 0;
  let pendingReauthenticationPasswordFailures = 0;
  let pendingRecoveryFailures = 0;
  let pendingSignOutFailures = 0;
  let pendingRenderFailures = 0;

  const server = createServer((request, response) => {
    const requestUrl = new URL(request.url ?? "/", "http://127.0.0.1");

    if (
      request.method === "POST" &&
      requestUrl.pathname === "/__phase11g1/render-failure"
    ) {
      pendingRenderFailures += 1;
      request.resume();
      response.writeHead(204);
      response.end();
      return;
    }

    if (
      request.method === "POST" &&
      requestUrl.pathname === "/__phase11g1/render-failure/consume"
    ) {
      request.resume();

      if (pendingRenderFailures > 0) {
        pendingRenderFailures -= 1;
        response.writeHead(204);
      } else {
        response.writeHead(200);
      }

      response.end();
      return;
    }

    if (
      request.method === "POST" &&
      requestUrl.pathname === "/__phase11e3/password-failure"
    ) {
      pendingReauthenticationPasswordFailures += 1;
      request.resume();
      response.writeHead(204);
      response.end();
      return;
    }

    if (
      request.method === "POST" &&
      requestUrl.pathname === "/__phase11e3/password-failure/consume"
    ) {
      request.resume();

      if (pendingReauthenticationPasswordFailures > 0) {
        pendingReauthenticationPasswordFailures -= 1;
        response.writeHead(204);
      } else {
        response.writeHead(200);
      }

      response.end();
      return;
    }

    if (
      request.method === "POST" &&
      requestUrl.pathname === "/__phase11e3/identity-mismatch"
    ) {
      pendingReauthenticationIdentityMismatches += 1;
      request.resume();
      response.writeHead(204);
      response.end();
      return;
    }

    if (
      request.method === "POST" &&
      requestUrl.pathname === "/__phase11e3/identity-mismatch/consume"
    ) {
      request.resume();

      if (pendingReauthenticationIdentityMismatches > 0) {
        pendingReauthenticationIdentityMismatches -= 1;
        response.writeHead(204);
      } else {
        response.writeHead(200);
      }

      response.end();
      return;
    }

    if (
      request.method === "POST" &&
      requestUrl.pathname === "/__phase11e2/recovery-failure"
    ) {
      pendingRecoveryFailures += 1;
      request.resume();
      response.writeHead(204);
      response.end();
      return;
    }

    if (
      request.method === "POST" &&
      requestUrl.pathname === "/__phase11e2/recovery-failure/consume"
    ) {
      request.resume();

      if (pendingRecoveryFailures > 0) {
        pendingRecoveryFailures -= 1;
        response.writeHead(204);
      } else {
        response.writeHead(200);
      }

      response.end();
      return;
    }

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
        reliabilityControlUrl: `${controlBaseUrl}/__phase11g1/render-failure`,
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
  ACCOUNT_CLOSURE_CAPABILITY_SECRET: accountClosureCapabilitySecret,
  APP_ORIGIN:
    process.env.PLAYWRIGHT_BASE_URL ??
    `http://127.0.0.1:${process.env.PLAYWRIGHT_PORT ?? "3100"}`,
  // This value is intentionally local-test-only and is never a hosted secret.
  AUTH_REAUTH_PROOF_SECRET:
    "phase11e3-local-e2e-only-proof-secret-material-0123456789",
  DATE_E2E_LOCAL_SUPABASE: "1",
  LOCAL_SUPABASE_FAULT_CONTROL_URL: faultControl.controlUrl,
  LOCAL_RELIABILITY_FAULT_CONTROL_URL: faultControl.reliabilityControlUrl,
  LOCAL_SUPABASE_MAILPIT_URL: mailpitUrl,
  LOCAL_SUPABASE_PUBLISHABLE_KEY: publishableKey,
  LOCAL_SUPABASE_SERVICE_ROLE_KEY: serviceRoleKey,
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
