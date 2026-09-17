import { spawn, spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const EXPECTED_PROJECT_ID = "phase-11i-recovery-isolated";
const port = 3102;
const origin = `http://127.0.0.1:${port}`;

function fail(message) {
  throw new Error(message);
}

function parseEnvironment(output) {
  return Object.fromEntries(
    output
      .split(/\r?\n/)
      .map((line) => /^([A-Z][A-Z0-9_]*)=(.*)$/.exec(line.trim()))
      .filter(Boolean)
      .map((match) => {
        const raw = match[2];
        return [
          match[1],
          raw.startsWith('"') && raw.endsWith('"') ? raw.slice(1, -1) : raw,
        ];
      }),
  );
}

const projectId = readFileSync("supabase/config.toml", "utf8").match(
  /^project_id\s*=\s*"([^"]+)"/m,
)?.[1];
if (projectId !== EXPECTED_PROJECT_ID) {
  fail("Recovery smoke requires the approved isolated local project identity.");
}

const status = spawnSync("npx", ["supabase", "status", "-o", "env"], {
  encoding: "utf8",
});
if (status.status !== 0) fail("The isolated local Supabase stack is unavailable.");
const local = parseEnvironment(status.stdout);
const apiUrl = local.API_URL;
const publishableKey = local.PUBLISHABLE_KEY ?? local.ANON_KEY;
const serviceRoleKey = local.SECRET_KEY ?? local.SERVICE_ROLE_KEY;
if (!apiUrl || !publishableKey || !serviceRoleKey) {
  fail("Local Supabase did not provide the required recovery-smoke settings.");
}
if (!["127.0.0.1", "localhost"].includes(new URL(apiUrl).hostname)) {
  fail("Recovery smoke refuses a non-local Supabase endpoint.");
}

const childEnvironment = { ...process.env };
for (const key of [
  "LOCAL_SUPABASE_SERVICE_ROLE_KEY",
  "SERVICE_ROLE_KEY",
  "SUPABASE_SECRET_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
]) {
  delete childEnvironment[key];
}
Object.assign(childEnvironment, {
  ACCOUNT_CLOSURE_CAPABILITY_SECRET: randomBytes(48).toString("base64url"),
  APP_ENVIRONMENT: "local",
  APP_ORIGIN: origin,
  AUTH_REAUTH_PROOF_SECRET: randomBytes(48).toString("base64url"),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: publishableKey,
  NEXT_PUBLIC_SUPABASE_URL: apiUrl,
  SUPABASE_ENVIRONMENT: "local",
  SUPABASE_PROJECT_REF: "local",
});

const app = spawn(
  "npm",
  ["run", "start", "--", "-p", String(port), "-H", "127.0.0.1"],
  { env: childEnvironment, stdio: ["ignore", "ignore", "pipe"] },
);
let appError = "";
app.stderr.on("data", (chunk) => {
  appError = `${appError}${chunk}`.slice(-2_000);
});

async function waitForHealth() {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${origin}/api/health`, { cache: "no-store" });
      if (response.ok && (await response.json()).status === "live") return;
    } catch {
      // The server may still be starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  fail(`Recovered application did not become healthy: ${appError}`);
}

const admin = createClient(apiUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});
let userId;

try {
  await waitForHealth();
  const [english, hebrew] = await Promise.all([
    fetch(`${origin}/en`, { cache: "no-store" }),
    fetch(`${origin}/he`, { cache: "no-store" }),
  ]);
  const englishHtml = await english.text();
  const hebrewHtml = await hebrew.text();
  if (!english.ok || !/<html[^>]*lang="en"[^>]*dir="ltr"/.test(englishHtml)) {
    fail("Recovered English route did not preserve LTR document semantics.");
  }
  if (!hebrew.ok || !/<html[^>]*lang="he"[^>]*dir="rtl"/.test(hebrewHtml)) {
    fail("Recovered Hebrew route did not preserve RTL document semantics.");
  }

  const email = `phase11i-recovery-${Date.now()}@example.test`;
  const password = `${randomBytes(24).toString("base64url")}Aa1!`;
  const created = await admin.auth.admin.createUser({
    email,
    email_confirm: true,
    password,
  });
  if (created.error || !created.data.user) fail("Synthetic local user creation failed.");
  userId = created.data.user.id;
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      userId,
    )
  ) {
    fail("Synthetic local user ID is invalid.");
  }
  const activated = spawnSync(
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
        insert into public.account_activations (
          user_id,
          activation_completed_at,
          eligibility_statement_version,
          eligibility_accepted_at
        ) values (
          '${userId}'::uuid,
          statement_timestamp(),
          'p11e-e001-private-beta-eligibility-v1',
          statement_timestamp()
        );
      `,
    },
  );
  if (activated.status !== 0) fail("Synthetic local activation failed.");

  const userClient = createClient(apiUrl, publishableKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const signedIn = await userClient.auth.signInWithPassword({ email, password });
  if (signedIn.error) fail("Synthetic local user sign-in failed.");
  const search = await userClient.rpc("search_readable_foods", {
    p_query: "Garlic",
  });
  if (search.error || !Array.isArray(search.data)) {
    fail("Recovered reference-food search failed.");
  }
  const recoveredReferenceFound = search.data.some(
    (food) =>
      food.food_id === "dfb0051f-1652-4d91-ae19-c2ba91d4ad31" &&
      food.source_code === "usda",
  );
  if (!recoveredReferenceFound) {
    fail("Recovered USDA reference food was not returned by safe search.");
  }

  process.stdout.write(
    `${JSON.stringify({
      status: "RECOVERY_APPLICATION_SMOKE_PASS",
      targetIdentity: "PHASE_11I_RECOVERY_ISOLATED",
      health: "live",
      englishLtr: true,
      hebrewRtl: true,
      recoveredReferenceFound: true,
      resultCount: search.data.length,
      externalDeliveryUsed: false,
    })}\n`,
  );
} finally {
  if (userId) await admin.auth.admin.deleteUser(userId);
  app.kill("SIGTERM");
  await new Promise((resolve) => {
    let timer;
    const finish = () => {
      clearTimeout(timer);
      app.off("exit", finish);
      resolve();
    };
    app.once("exit", finish);
    timer = setTimeout(finish, 5_000);
    if (app.exitCode !== null || app.signalCode !== null) finish();
  });
}
