import { spawnSync } from "node:child_process";

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
    "Refusing to run authenticated date tests against a remote API.\n",
  );
  process.exit(1);
}

const childEnvironment = { ...process.env };

delete childEnvironment.SUPABASE_SERVICE_ROLE_KEY;
delete childEnvironment.SERVICE_ROLE_KEY;
delete childEnvironment.SUPABASE_SECRET_KEY;

Object.assign(childEnvironment, {
  DATE_E2E_LOCAL_SUPABASE: "1",
  LOCAL_SUPABASE_PUBLISHABLE_KEY: publishableKey,
  LOCAL_SUPABASE_URL: apiUrl,
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: publishableKey,
  NEXT_PUBLIC_SUPABASE_URL: apiUrl,
});

const playwright = spawnSync(
  "npx",
  ["playwright", "test", ...process.argv.slice(2)],
  {
    env: childEnvironment,
    stdio: "inherit",
  },
);

process.exit(playwright.status ?? 1);
