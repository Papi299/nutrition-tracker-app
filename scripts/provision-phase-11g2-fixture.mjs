import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

function parseEnvironment(output) {
  const values = new Map();
  for (const line of output.split(/\r?\n/)) {
    const match = /^([A-Z][A-Z0-9_]*)=(.*)$/.exec(line.trim());
    if (!match) continue;
    const raw = match[2];
    values.set(
      match[1],
      raw.startsWith('"') && raw.endsWith('"') ? raw.slice(1, -1) : raw,
    );
  }
  return values;
}

function requireLoopback(value, label) {
  const parsed = new URL(value);
  if (!["127.0.0.1", "localhost"].includes(parsed.hostname)) {
    throw new Error(`Refusing to use a nonlocal ${label}.`);
  }
  return parsed;
}

const password = process.env.PHASE11G2_FIXTURE_PASSWORD;
if (!password || password.length < 20) {
  throw new Error("A runtime-only G2 fixture password is required.");
}

const status = execFileSync(
  "npx",
  ["supabase", "status", "-o", "env"],
  { encoding: "utf8" },
);
const environment = parseEnvironment(status);
const apiUrl = environment.get("API_URL");
const serviceRoleKey =
  environment.get("SECRET_KEY") ?? environment.get("SERVICE_ROLE_KEY");
const projectId = readFileSync("supabase/config.toml", "utf8").match(
  /^project_id\s*=\s*"([^"]+)"/m,
)?.[1];

if (!apiUrl || !serviceRoleKey || !projectId) {
  throw new Error("Local Supabase did not report the required fixture values.");
}
requireLoopback(apiUrl, "Supabase API");

const administrator = createClient(apiUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const existing = await administrator.auth.admin.listUsers({ page: 1, perPage: 1 });
if (existing.error) throw new Error("Could not inspect the local Auth fixture.");
if (existing.data.users.length !== 0) {
  throw new Error("G2 provisioning requires a freshly reset local database.");
}

for (let ordinal = 1; ordinal <= 100; ordinal += 1) {
  const suffix = String(ordinal).padStart(3, "0");
  const email = `phase11g2-user-${suffix}@example.test`;
  const invited = await administrator.auth.admin.inviteUserByEmail(email, {
    redirectTo: "http://127.0.0.1:3100/en/auth/confirm",
  });
  const userId = invited.data.user?.id;
  if (invited.error || !userId) {
    throw new Error(`Could not provision synthetic invited identity ${suffix}.`);
  }
  const updated = await administrator.auth.admin.updateUserById(userId, {
    email_confirm: true,
    password,
  });
  if (updated.error) {
    throw new Error(`Could not complete synthetic identity ${suffix}.`);
  }
}

const fixtureSql = readFileSync("performance/fixture.sql", "utf8");
const databaseContainer = `supabase_db_${projectId}`;
const observed = execFileSync(
  "docker",
  [
    "exec",
    "-i",
    databaseContainer,
    "psql",
    "-U",
    "postgres",
    "-d",
    "postgres",
    "-X",
    "-q",
    "-t",
    "-A",
  ],
  { encoding: "utf8", input: fixtureSql, maxBuffer: 20 * 1024 * 1024 },
).trim();

const manifest = JSON.parse(
  readFileSync("performance/fixture-manifest.json", "utf8"),
);
const observedCardinalities = JSON.parse(observed.split(/\r?\n/).at(-1));
const expectedEntries = Object.entries(manifest.cardinalities).sort(([left], [right]) =>
  left.localeCompare(right),
);
const observedEntries = Object.entries(observedCardinalities).sort(
  ([left], [right]) => left.localeCompare(right),
);
if (JSON.stringify(observedEntries) !== JSON.stringify(expectedEntries)) {
  throw new Error("Observed G2 fixture cardinalities do not match the manifest.");
}

process.stdout.write(
  `${JSON.stringify({
    fixtureVersion: manifest.fixtureVersion,
    invitedIdentityCount: manifest.invitedIdentityCount,
    approvedConcurrency: manifest.approvedConcurrency,
    cardinalities: observedCardinalities,
  })}\n`,
);
