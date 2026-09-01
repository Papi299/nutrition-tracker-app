import { execFileSync, spawn } from "node:child_process";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import {
  cpus,
  freemem,
  loadavg,
  platform,
  release,
  totalmem,
  type as osType,
} from "node:os";
import {
  mkdtempSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { createServer, request as httpRequest } from "node:http";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { performance } from "node:perf_hooks";
import { createClient } from "@supabase/supabase-js";
import { chromium, devices } from "@playwright/test";
import {
  aggregateNormativeQualificationGroup,
  createProxyActivityTracker,
  serializePrivacySafeEvidence,
  validateFixtureManifest,
  validateNormativePerformanceSample,
} from "../lib/performance/qualification.ts";
import { createPlaywrightOperationCatalog } from "./phase-11g2-playwright-operations.mjs";

const browserPort = 3100;
const applicationPort = 3101;
const timeoutMs = 10_000;
const preparationTimeoutMs = 30_000;
const isFocused = process.argv.includes("--focused");
const warmSamples = Number(
  process.env.PHASE11G2_WARM_SAMPLES ?? (isFocused ? "10" : "30"),
);
const fixturePassword = process.env.PHASE11G2_FIXTURE_PASSWORD;
const operationFilter = new Set(
  (process.env.PHASE11G2_OPERATION_FILTER ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean),
);
const concurrencyFilter = process.env.PHASE11G2_CONCURRENCY_FILTER
  ? Number(process.env.PHASE11G2_CONCURRENCY_FILTER)
  : null;
if (concurrencyFilter !== null && ![1, 10].includes(concurrencyFilter)) {
  throw new Error("The optional concurrency filter must be 1 or 10.");
}
const outputDirectory = isFocused
  ? "performance/evidence/focused-normative"
  : "performance/evidence/normative";

if (!fixturePassword || fixturePassword.length < 20) {
  throw new Error("A runtime-only G2 fixture password is required.");
}
if (!Number.isSafeInteger(warmSamples) || warmSamples < 1) {
  throw new Error("The warm-sample count must be a positive integer.");
}
if (!isFocused && warmSamples < 30) {
  throw new Error("The final normative run requires at least 30 warm samples.");
}

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
  return parsed.toString().replace(/\/$/, "");
}

function command(commandName, args, options = {}) {
  return execFileSync(commandName, args, {
    encoding: "utf8",
    maxBuffer: 100 * 1024 * 1024,
    ...options,
  }).trim();
}

const statusOutput = command("npx", ["supabase", "status", "-o", "env"]);
const environment = parseEnvironment(statusOutput);
const apiUrl = requireLoopback(environment.get("API_URL"), "Supabase API");
const mailpitUrl = requireLoopback(
  environment.get("MAILPIT_URL") ?? environment.get("INBUCKET_URL"),
  "local mail capture",
);
const publishableKey =
  environment.get("PUBLISHABLE_KEY") ?? environment.get("ANON_KEY");
const serviceRoleKey =
  environment.get("SECRET_KEY") ?? environment.get("SERVICE_ROLE_KEY");
const projectId = readFileSync("supabase/config.toml", "utf8").match(
  /^project_id\s*=\s*"([^"]+)"/m,
)?.[1];
if (!publishableKey || !serviceRoleKey || !projectId) {
  throw new Error("Local Supabase did not report the required values.");
}
const databaseContainer = `supabase_db_${projectId}`;

function psql(statement) {
  return command(
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
      "-v",
      "ON_ERROR_STOP=1",
      "-q",
      "-t",
      "-A",
    ],
    { input: statement },
  );
}

const closureSecret = randomBytes(48).toString("base64url");
psql(`
  do $$
  declare v_id uuid;
  begin
    select id into v_id from vault.secrets
    where name = 'account_closure_capability_v1';
    if v_id is null then
      perform vault.create_secret(
        '${closureSecret}',
        'account_closure_capability_v1',
        'Synthetic local Phase 11G2 secret'
      );
    else
      perform vault.update_secret(
        v_id,
        '${closureSecret}',
        'account_closure_capability_v1',
        'Synthetic local Phase 11G2 secret'
      );
    end if;
  end $$;
`);

const administrator = createClient(apiUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const fixtureManifest = validateFixtureManifest(
  JSON.parse(readFileSync("performance/fixture-manifest.json", "utf8")),
);
const listed = await administrator.auth.admin.listUsers({ page: 1, perPage: 1000 });
if (listed.error) throw new Error("Could not inspect synthetic identities.");
const identities = listed.data.users
  .filter((user) => /^phase11g2-user-\d{3}@example\.test$/.test(user.email ?? ""))
  .sort((left, right) => left.email.localeCompare(right.email))
  .map((identity, index) => ({
    email: identity.email,
    identityId: identity.id,
    ordinal: index + 1,
    password: fixturePassword,
  }));
if (identities.length !== 100) {
  throw new Error("The G2 qualification requires exactly 100 synthetic identities.");
}

function nowMs() {
  return Number(performance.now().toFixed(3));
}

function opaqueCorrelation() {
  return `perf_${randomUUID().replaceAll("-", "")}`;
}

function contextId(profile, index) {
  return `ctx_${createHash("sha256")
    .update(`${profile}:${index}:phase-11g2`)
    .digest("hex")
    .slice(0, 16)}`;
}

function routePathname(requestUrl) {
  return new URL(requestUrl ?? "/", `http://127.0.0.1:${browserPort}`).pathname;
}

function privacySafeRouteTemplate(requestUrl) {
  return routePathname(requestUrl)
    .split("/")
    .map((segment) => {
      if (["en", "he"].includes(segment)) return "[locale]";
      if (/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(segment)) {
        return "[id]";
      }
      return segment;
    })
    .join("/");
}

function normalizedMethod(method) {
  return ["GET", "POST", "HEAD"].includes(method) ? method : "OTHER";
}

function trafficKind(incoming) {
  if (incoming.headers["next-router-prefetch"] === "1") return "prefetch";
  if (incoming.headers.rsc === "1") return "rsc";
  if (routePathname(incoming.url).startsWith("/_next/")) return "framework_asset";
  if (
    incoming.headers["sec-fetch-mode"] === "navigate" ||
    incoming.headers["sec-fetch-dest"] === "document"
  ) return "navigation";
  return "other";
}

class ProxyIdleTimeoutError extends Error {
  constructor(activeStreams) {
    super("The timing proxy did not return to an idle state.");
    this.name = "ProxyIdleTimeoutError";
    this.activeStreams = activeStreams;
  }
}

async function startTimingProxy() {
  const records = new Map();
  const expected = new Map();
  const waves = new Map();
  const activity = createProxyActivityTracker();

  function addRecord(correlationId, record) {
    const current = records.get(correlationId) ?? [];
    current.push(record);
    records.set(correlationId, current);
  }

  function beginUpstream(incoming, outgoing, correlationId) {
    const startedAtMs = nowMs();
    const definition = correlationId ? expected.get(correlationId) : undefined;
    const measured = definition &&
      definition.method === incoming.method &&
      definition.pathname === routePathname(incoming.url);
    const stream = activity.start({
      method: normalizedMethod(incoming.method),
      relevance: measured
        ? "measured"
        : correlationId
          ? "correlated_background"
          : "uncorrelated_background",
      routeTemplate: privacySafeRouteTemplate(incoming.url),
      startedAtMs,
      trafficKind: trafficKind(incoming),
    });
    const headers = { ...incoming.headers };
    headers.host = `127.0.0.1:${browserPort}`;
    const upstream = httpRequest(
      {
        headers,
        host: "127.0.0.1",
        method: incoming.method,
        path: incoming.url,
        port: applicationPort,
      },
      (response) => {
        stream.markHeadersArrived();
        const responseStartedAtMs = nowMs();
        const responseStartMs = Number((responseStartedAtMs - startedAtMs).toFixed(3));
        const responseHeaders = { ...response.headers };
        if (correlationId) {
          responseHeaders["server-timing"] = `phase11g2_app;dur=${responseStartMs}`;
          responseHeaders["x-phase11g2-correlation"] = correlationId;
          response.once("end", () => {
            stream.markContentCompleted();
            const endedAtMs = nowMs();
            addRecord(correlationId, {
              correlationId,
              durationMs: Number((endedAtMs - startedAtMs).toFixed(3)),
              endedAtMs,
              method: incoming.method,
              pathname: routePathname(incoming.url),
              serverTimingMs: responseStartMs,
              startedAtMs,
              status: response.statusCode ?? 500,
            });
            stream.finish();
          });
        }
        if (!correlationId) {
          response.once("end", () => {
            stream.markContentCompleted();
            stream.finish();
          });
        }
        response.once("aborted", stream.finish);
        response.once("error", stream.finish);
        response.once("close", stream.finish);
        outgoing.writeHead(response.statusCode ?? 500, responseHeaders);
        response.pipe(outgoing);
      },
    );
    upstream.on("error", (error) => {
      stream.finish();
      outgoing.destroy(error);
    });
    outgoing.on("close", () => {
      if (!outgoing.writableEnded) {
        upstream.destroy();
        stream.finish();
      }
    });
    incoming.pipe(upstream);
  }

  function releaseWave(waveId, force = false) {
    const wave = waves.get(waveId);
    if (
      !wave ||
      (!force && wave.arrivedCorrelationIds.size !== wave.correlationIds.size)
    ) return;
    clearTimeout(wave.releaseTimer);
    for (const arrival of wave.arrivals) arrival.release();
    waves.delete(waveId);
  }

  const server = createServer((incoming, outgoing) => {
    const headerValue = incoming.headers["x-phase11g2-correlation"];
    const correlationId = Array.isArray(headerValue) ? headerValue[0] : headerValue;
    const match = correlationId ? expected.get(correlationId) : undefined;
    if (
      match &&
      match.method === incoming.method &&
      match.pathname === routePathname(incoming.url) &&
      match.waveId
    ) {
      const wave = waves.get(match.waveId);
      if (
        wave &&
        wave.correlationIds.has(correlationId) &&
        !wave.arrivedCorrelationIds.has(correlationId)
      ) {
        wave.arrivedCorrelationIds.add(correlationId);
        wave.arrivals.push({
          correlationId,
          release: () => beginUpstream(incoming, outgoing, correlationId),
        });
        releaseWave(match.waveId);
        return;
      }
    }
    beginUpstream(incoming, outgoing, correlationId);
  });

  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(browserPort, "127.0.0.1", resolve);
  });

  return {
    arm(correlationId, definition, waveId) {
      expected.set(correlationId, {
        method: definition.expectedMethod,
        pathname: definition.expectedPath,
        waveId,
      });
    },
    armWave(waveId, correlationIds) {
      const wave = {
        arrivals: [],
        arrivedCorrelationIds: new Set(),
        correlationIds: new Set(correlationIds),
        releaseTimer: undefined,
      };
      wave.releaseTimer = setTimeout(
        () => releaseWave(waveId, true),
        timeoutMs - 250,
      );
      waves.set(waveId, wave);
    },
    close: () => new Promise((resolve, reject) => {
      for (const waveId of waves.keys()) releaseWave(waveId, true);
      server.closeAllConnections?.();
      server.close((error) => (error ? reject(error) : resolve()));
    }),
    async take(correlationId, definition, stableEndedAtMs) {
      for (let attempt = 0; attempt < 20; attempt += 1) {
        if (
          (records.get(correlationId) ?? []).some(
            (record) =>
              record.method === definition.expectedMethod &&
              record.pathname === definition.expectedPath,
          )
        ) break;
        await new Promise((resolve) => setTimeout(resolve, 5));
      }
      expected.delete(correlationId);
      const matching = (records.get(correlationId) ?? []).filter(
        (record) =>
          record.method === definition.expectedMethod &&
          record.pathname === definition.expectedPath &&
          record.endedAtMs <= stableEndedAtMs + 1,
      );
      records.delete(correlationId);
      if (matching.length === 0) {
        throw new Error("The browser action did not map to an application request.");
      }
      const startedAtMs = Math.min(...matching.map((record) => record.startedAtMs));
      const endedAtMs = Math.max(...matching.map((record) => record.endedAtMs));
      const durationMs = Number((endedAtMs - startedAtMs).toFixed(3));
      return {
        ...matching.at(-1),
        durationMs,
        endedAtMs,
        serverTimingMs: Math.max(...matching.map((record) => record.serverTimingMs)),
        startedAtMs,
        status: Math.max(...matching.map((record) => record.status)),
      };
    },
    async waitForIdle() {
      for (let attempt = 0; attempt < 600; attempt += 1) {
        if (activity.activeCount() === 0 && waves.size === 0) return;
        await new Promise((resolve) => setTimeout(resolve, 50));
      }
      throw new ProxyIdleTimeoutError(activity.inventory(nowMs()));
    },
  };
}

function childEnvironment() {
  const value = { ...process.env };
  delete value.SUPABASE_SERVICE_ROLE_KEY;
  delete value.SERVICE_ROLE_KEY;
  delete value.SUPABASE_SECRET_KEY;
  Object.assign(value, {
    ACCOUNT_CLOSURE_CAPABILITY_SECRET: closureSecret,
    APP_ORIGIN: `http://127.0.0.1:${browserPort}`,
    AUTH_REAUTH_PROOF_SECRET:
      "phase11e3-local-e2e-only-proof-secret-material-0123456789",
    DATE_E2E_LOCAL_SUPABASE: "1",
    LOCAL_SUPABASE_MAILPIT_URL: mailpitUrl,
    LOCAL_SUPABASE_PUBLISHABLE_KEY: publishableKey,
    LOCAL_SUPABASE_URL: apiUrl,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: publishableKey,
    NEXT_PUBLIC_SUPABASE_URL: apiUrl,
  });
  return value;
}

async function waitUntilHealthy(url, child) {
  for (let attempt = 0; attempt < 120; attempt += 1) {
    if (child.exitCode !== null) {
      throw new Error("The local production application exited before qualification.");
    }
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {
      // The bounded readiness loop continues until the local server is ready.
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error("The local production application did not become ready.");
}

function startApplication() {
  const child = spawn(
    "npm",
    ["run", "start", "--", "-p", String(applicationPort), "-H", "127.0.0.1"],
    { env: childEnvironment(), stdio: ["ignore", "pipe", "pipe"] },
  );
  child.stdout.resume();
  child.stderr.pipe(process.stderr);
  return child;
}

function stopChild(child) {
  if (child.exitCode !== null) return Promise.resolve();
  child.kill("SIGTERM");
  return new Promise((resolve) => {
    const fallback = setTimeout(() => child.kill("SIGKILL"), 5_000);
    child.once("exit", () => {
      clearTimeout(fallback);
      resolve();
    });
  });
}

function profileOptions(profile) {
  if (profile === "desktop") {
    return {
      ...devices["Desktop Chrome"],
      viewport: { height: 900, width: 1280 },
    };
  }
  return {
    ...devices["Desktop Chrome"],
    deviceScaleFactor: 2,
    hasTouch: true,
    isMobile: true,
    viewport: { height: 844, width: 390 },
  };
}

function recordedProfile(profile, browserVersion) {
  return profile === "desktop"
    ? {
        deviceScaleFactor: 1,
        engine: "chromium",
        engineVersion: browserVersion,
        hasTouch: false,
        isMobile: false,
        javaScriptEnabled: true,
        profileId: "desktop-chromium-1280x900",
        viewportHeight: 900,
        viewportWidth: 1280,
      }
    : {
        deviceScaleFactor: 2,
        engine: "chromium",
        engineVersion: browserVersion,
        hasTouch: true,
        isMobile: true,
        javaScriptEnabled: true,
        profileId: "mobile-chromium-390x844",
        viewportHeight: 844,
        viewportWidth: 390,
      };
}

async function withTimeout(action) {
  let timeout;
  try {
    return await Promise.race([
      action(),
      new Promise((_, reject) => {
        timeout = setTimeout(
          () => reject(new Error("qualification_timeout")),
          timeoutMs,
        );
      }),
    ]);
  } finally {
    clearTimeout(timeout);
  }
}

function classifyError(error) {
  const message = error instanceof Error ? error.message : "unhandled_error";
  if (
    message === "qualification_timeout" ||
    (error instanceof Error && error.name === "TimeoutError")
  ) return "timeout";
  if (message.includes("integrity")) return "integrity_failure";
  if (message.includes("redirect")) return "incorrect_redirect";
  if (message.includes("visibility")) return "incorrect_visibility";
  if (message.includes("application request")) return "framework_failure";
  return "unhandled_error";
}

function hostSnapshot() {
  return {
    availableMemoryBytes: freemem(),
    loadAverage: loadavg().map((value) => Number(value.toFixed(3))),
    processUptimeSeconds: Number(process.uptime().toFixed(3)),
  };
}

function safeRoute(value) {
  try {
    const parsed = new URL(value);
    const segments = parsed.pathname.split("/").map((segment) =>
      /^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(segment) ? "[id]" : segment,
    );
    return segments.join("/") || "/";
  } catch {
    return "[redacted]";
  }
}

function sanitizeTraceValue(value, key = "") {
  if (Array.isArray(value)) return value.map((entry) => sanitizeTraceValue(entry));
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([childKey]) => !["body", "cookies", "headers", "sha1", "stack", "value"].includes(childKey))
        .map(([childKey, child]) => [childKey, sanitizeTraceValue(child, childKey)]),
    );
  }
  if (typeof value !== "string") return value;
  if (key.toLowerCase().includes("url")) return safeRoute(value);
  if (
    value.includes("@") ||
    /[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/i.test(value) ||
    /(?:password|token_hash|auth-token|bearer|cookie)/i.test(value)
  ) return "[redacted]";
  return value;
}

function sanitizeTraceArchive(rawPath, finalPath) {
  const directory = mkdtempSync(`${tmpdir()}/phase11g2-trace-`);
  const absoluteFinalPath = resolve(finalPath);
  try {
    command("unzip", ["-q", rawPath, "-d", directory]);
    for (const name of readdirSync(directory)) {
      const path = `${directory}/${name}`;
      if (name === "trace.network") {
        writeFileSync(path, "");
        continue;
      }
      if (name === "trace.stacks" || name === "resources") {
        rmSync(path, { force: true, recursive: true });
        continue;
      }
      if (!name.endsWith(".trace")) continue;
      const sanitized = readFileSync(path, "utf8")
        .split(/\r?\n/)
        .filter(Boolean)
        .flatMap((line) => {
          try {
            const event = JSON.parse(line);
            if (["console", "log"].includes(event.type)) return [];
            return [JSON.stringify(sanitizeTraceValue(event))];
          } catch {
            return [];
          }
        })
        .join("\n");
      writeFileSync(path, `${sanitized}\n`);
    }
    rmSync(absoluteFinalPath, { force: true });
    command("zip", ["-q", "-r", absoluteFinalPath, "."], { cwd: directory });
  } finally {
    rmSync(directory, { force: true, recursive: true });
  }
}

function sqlIdentifier(value) {
  if (!/^[a-z][a-z0-9_]*$/.test(value)) {
    throw new Error("Invalid local fixture SQL identifier.");
  }
  return `"${value}"`;
}

function sqlLiteral(value) {
  if (value === null) return "null";
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new Error("Invalid local fixture number.");
    return String(value);
  }
  if (typeof value === "boolean") return value ? "true" : "false";
  return `'${String(value).replaceAll("'", "''")}'`;
}

function filterSql(filters) {
  const entries = Object.entries(filters);
  if (entries.length === 0) throw new Error("Local fixture mutations require filters.");
  return entries.map(([column, value]) =>
    value === null
      ? `${sqlIdentifier(column)} is null`
      : `${sqlIdentifier(column)} = ${sqlLiteral(value)}`,
  ).join(" and ");
}

async function deleteRows(table, filters) {
  psql(`delete from public.${sqlIdentifier(table)} where ${filterSql(filters)};`);
}

async function selectRows(table, columns, filters = {}, options = {}) {
  const projection = columns === "*"
    ? "*"
    : columns.split(",").map((column) => sqlIdentifier(column.trim())).join(", ");
  const where = Object.keys(filters).length ? `where ${filterSql(filters)}` : "";
  const order = options.order ? `order by ${sqlIdentifier(options.order)}` : "";
  const limit = options.limit ? `limit ${Number(options.limit)}` : "";
  return JSON.parse(
    psql(`
      select coalesce(jsonb_agg(to_jsonb(rows)), '[]'::jsonb)::text
      from (
        select ${projection}
        from public.${sqlIdentifier(table)}
        ${where}
        ${order}
        ${limit}
      ) as rows;
    `),
  );
}

async function insertRows(table, rows) {
  if (rows.length === 0) return;
  const serialized = JSON.stringify(rows).replaceAll("'", "''");
  psql(`
    insert into public.${sqlIdentifier(table)}
    select * from jsonb_populate_recordset(
      null::public.${sqlIdentifier(table)},
      '${serialized}'::jsonb
    );
  `);
}

async function updateRows(table, values, filters) {
  const columns = Object.keys(values);
  if (columns.length === 0) return;
  const serialized = JSON.stringify(values).replaceAll("'", "''");
  const assignments = columns.map((column) =>
    `${sqlIdentifier(column)} = source.${sqlIdentifier(column)}`,
  ).join(", ");
  psql(`
    with source as (
      select * from jsonb_populate_record(
        null::public.${sqlIdentifier(table)},
        '${serialized}'::jsonb
      )
    )
    update public.${sqlIdentifier(table)} as target
    set ${assignments}
    from source
    where ${Object.entries(filters).map(([column, value]) =>
      value === null
        ? `target.${sqlIdentifier(column)} is null`
        : `target.${sqlIdentifier(column)} = ${sqlLiteral(value)}`,
    ).join(" and ")};
  `);
}

async function countRows(table, filters) {
  const where = Object.keys(filters).length ? `where ${filterSql(filters)}` : "";
  return Number(
    psql(`select count(*) from public.${sqlIdentifier(table)} ${where};`),
  );
}

async function ensureSignedIn(page, actor) {
  await page.context().clearCookies();
  await page.goto("/en/auth/sign-in");
  await page.locator('input[name="email"]').fill(actor.email);
  await page.locator('input[name="password"]').fill(actor.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL(/\/en\/(?:today|auth\/activate)/, { timeout: timeoutMs });
}

async function clearSession(slot) {
  await slot.context.clearCookies();
  await slot.page.goto("/en/auth/sign-in");
}

async function establishRecentAuthentication(page, actor, intent) {
  await ensureSignedIn(page, actor);
  await page.goto(`/en/account/${intent === "account-export" ? "export" : "closure"}`);
  const link = page.getByRole("link", { name: "Confirm current password" });
  if (await link.count()) {
    await link.click();
    await page.locator('input[name="password"]').fill(actor.password);
    await page.getByRole("button", { name: "Confirm password" }).click();
  }
  await page.waitForURL(`/en/account/${intent === "account-export" ? "export" : "closure"}`);
}

async function waitForRecoveryLink(email) {
  const searchUrl = new URL("/api/v1/search", mailpitUrl);
  searchUrl.searchParams.set("query", `to:${email}`);
  for (let attempt = 0; attempt < 50; attempt += 1) {
    const searchResponse = await fetch(searchUrl);
    if (searchResponse.ok) {
      const search = await searchResponse.json();
      for (const message of search.messages ?? []) {
        const response = await fetch(
          new URL(`/api/v1/message/${encodeURIComponent(message.ID)}`, mailpitUrl),
        );
        if (!response.ok) continue;
        const detail = await response.json();
        const links = `${detail.HTML ?? ""}\n${detail.Text ?? ""}`.match(
          /https?:\/\/[^\s"'<]+/gi,
        ) ?? [];
        for (const candidate of links) {
          const parsed = new URL(candidate.replaceAll("&amp;", "&"));
          if (
            ["127.0.0.1", "localhost"].includes(parsed.hostname) &&
            parsed.searchParams.get("type") === "recovery" &&
            parsed.searchParams.has("token_hash")
          ) return parsed;
        }
      }
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error("The local recovery link was not captured.");
}

const helpers = {
  administrator,
  apiUrl,
  clearSession,
  countRows,
  deleteRows,
  ensureSignedIn,
  establishRecentAuthentication,
  fixturePassword,
  identities,
  insertRows,
  psql,
  publishableKey,
  selectRows,
  updateRows,
  waitForRecoveryLink,
};

const allOperations = createPlaywrightOperationCatalog(helpers);
const operations = operationFilter.size
  ? allOperations.filter((operation) => operationFilter.has(operation.id))
  : isFocused
    ? allOperations.filter((operation) => operation.focused)
    : allOperations;
if (operations.length === 0) throw new Error("No qualifying operations were selected.");
if (operationFilter.size && operations.length !== operationFilter.size) {
  throw new Error("The operation filter contains an unknown operation.");
}

rmSync(outputDirectory, { force: true, recursive: true });
mkdirSync(outputDirectory, { recursive: true });
mkdirSync(`${outputDirectory}/traces`, { recursive: true });
const proxy = await startTimingProxy();
const application = startApplication();
let browser;
let browserVersion = "unavailable";
const samples = [];
const reliabilityEvents = [];
const traceMap = [];
const operationOrder = [];
const runtimeStartedAt = new Date().toISOString();
const runtimeBefore = hostSnapshot();

try {
  await waitUntilHealthy(`http://127.0.0.1:${applicationPort}/api/health`, application);
  browser = await chromium.launch();
  browserVersion = browser.version();
  const slots = { desktop: [], mobile: [] };
  for (const profile of ["desktop", "mobile"]) {
    for (let index = 0; index < 10; index += 1) {
      const context = await browser.newContext({
        ...profileOptions(profile),
        acceptDownloads: true,
        baseURL: `http://127.0.0.1:${browserPort}`,
      });
      // Preparation is outside the normative timer and gets a separate bounded
      // budget. The action-to-stable-UI boundary remains capped by withTimeout.
      context.setDefaultTimeout(preparationTimeoutMs);
      context.setDefaultNavigationTimeout(preparationTimeoutMs);
      const archiveId = `trace_${profile}_ctx${String(index + 1).padStart(2, "0")}`;
      await context.tracing.start({ screenshots: false, snapshots: false, sources: false });
      slots[profile].push({
        archiveId,
        context,
        contextId: contextId(profile, index),
        page: await context.newPage(),
      });
    }
  }

  async function prepareMeasured(operation, profile, concurrency, sampleIndex, actorIndex) {
    const slot = slots[profile][actorIndex];
    slot.page.setDefaultTimeout(preparationTimeoutMs);
    slot.page.setDefaultNavigationTimeout(preparationTimeoutMs);
    const actor = operation.actor
      ? operation.actor({ concurrency, identities, profile, sampleIndex, actorIndex })
      : identities[actorIndex];
    const state = await operation.prepare({
      actor,
      concurrency,
      page: slot.page,
      profile,
      sampleIndex,
      slot,
    });
    return { actor, operation, slot, state };
  }

  async function recycleProfilePages(profile) {
    for (const slot of slots[profile]) {
      await slot.page.close({ runBeforeUnload: false });
      slot.page = await slot.context.newPage();
    }
  }

  async function runMeasured(prepared, profile, concurrency, temperature, sampleIndex, waveId) {
    const { actor, operation, slot, state } = prepared;
    slot.page.setDefaultTimeout(timeoutMs);
    slot.page.setDefaultNavigationTimeout(timeoutMs);
    const measurementDefinition = {
      ...operation,
      expectedPath: operation.expectedPathFor?.(state) ?? operation.expectedPath,
    };
    const correlationId = prepared.preassignedCorrelation ?? opaqueCorrelation();
    await slot.page.setExtraHTTPHeaders({ "x-phase11g2-correlation": correlationId });
    proxy.arm(correlationId, measurementDefinition, waveId);
    let classification = "succeeded";
    let outcome = "success";
    let stableSatisfied = false;
    let failureDiagnostic;
    let serverBoundary;
    const startedAtMs = nowMs();
    try {
      await slot.context.tracing.group(
        `${operation.metricId} ${operation.id} ${profile} c${concurrency} s${sampleIndex} ${correlationId}`,
      );
      await withTimeout(async () => {
        await operation.trigger({ actor, page: slot.page, state });
        await operation.stable({ actor, page: slot.page, state });
      });
      stableSatisfied = true;
    } catch (error) {
      outcome = "failure";
      classification = classifyError(error);
      failureDiagnostic = operation.failureDiagnostic
        ? await operation.failureDiagnostic({ actor, page: slot.page, state }).catch(() => ({
            currentPath: "unavailable",
            errorCode: "diagnosticFailed",
          }))
        : undefined;
    }
    const observedStableEnd = nowMs();
    const durationMs = classification === "timeout"
      ? timeoutMs
      : Number((observedStableEnd - startedAtMs).toFixed(3));
    const endedAtMs = Number((startedAtMs + durationMs).toFixed(3));
    if (classification === "timeout") {
      await slot.page.close({ runBeforeUnload: false }).catch(() => {});
      slot.page = await slot.context.newPage();
    }
    try {
      serverBoundary = await proxy.take(
        correlationId,
        measurementDefinition,
        endedAtMs,
      );
    } catch {
      if (outcome === "success") {
        outcome = "failure";
        classification = "framework_failure";
      }
    }
    await slot.context.tracing.groupEnd().catch(() => {});
    await slot.page.setExtraHTTPHeaders({}).catch(() => {});
    const fallbackBoundary = {
      correlationId,
      durationMs: Math.max(0, durationMs - 0.002),
      endedAtMs: Math.max(startedAtMs, endedAtMs - 0.001),
      method: measurementDefinition.expectedMethod,
      pathname: measurementDefinition.expectedPath,
      serverTimingMs: Math.max(0, durationMs - 0.002),
      startedAtMs: startedAtMs + 0.001,
      status: 500,
    };
    const boundary = serverBoundary ?? fallbackBoundary;
    const sample = {
      schemaVersion: "1",
      metricId: operation.metricId,
      operationId: operation.id,
      journeyIds: operation.journeys,
      profile,
      concurrency,
      temperature,
      sampleIndex,
      ...(waveId ? { waveId } : {}),
      startedAtMs,
      endedAtMs,
      durationMs,
      outcome,
      classification,
      correlationId,
      integrityPassed: false,
      browserEvidence: {
        sourceBoundary: "playwright_application",
        browserAction: {
          kind: operation.actionKind,
          triggerId: operation.triggerId,
          startedAtMs,
        },
        profileConfig: recordedProfile(profile, browserVersion),
        serverBoundary: {
          correlationId,
          durationMs: boundary.durationMs,
          endedAtMs: boundary.endedAtMs,
          matched: Boolean(serverBoundary),
          method: boundary.method,
          routeTemplate: operation.serverRouteTemplate,
          serverTimingMs: boundary.serverTimingMs,
          startedAtMs: boundary.startedAtMs,
          status: boundary.status,
        },
        stableUi: {
          conditionId: operation.stableConditionId,
          endedAtMs,
          routeTemplate: operation.stableRouteTemplate,
          satisfied: stableSatisfied,
        },
        traceEvidence: {
          actionPresent: true,
          archiveId: slot.archiveId,
          contextId: slot.contextId,
          serverBoundaryPresent: Boolean(serverBoundary),
          stableUiPresent: stableSatisfied,
        },
      },
    };
    traceMap.push({
      archiveId: slot.archiveId,
      concurrency,
      correlationId,
      metricId: operation.metricId,
      operationId: operation.id,
      profile,
      sampleIndex,
      stableConditionId: operation.stableConditionId,
      temperature,
      ...(waveId ? { waveId } : {}),
    });
    return { actor, failureDiagnostic, operation, sample, slot, state };
  }

  async function finalizeMeasured(measured) {
    const { actor, failureDiagnostic, operation, sample, slot, state } = measured;
    let integrityPassed = false;
    try {
      integrityPassed = await operation.integrity({
        actor,
        page: slot.page,
        state,
      });
    } catch {
      integrityPassed = false;
    }
    sample.integrityPassed = integrityPassed;
    if (!integrityPassed && sample.outcome === "success") {
      sample.outcome = "failure";
      sample.classification = "integrity_failure";
    }
    samples.push(sample);
    if (sample.outcome === "failure") {
      const diagnostic = failureDiagnostic ?? operation.integrityDiagnostic?.(state);
      reliabilityEvents.push({
        classification: sample.classification,
        concurrency: sample.concurrency,
        correlationId: sample.correlationId,
        metricId: sample.metricId,
        operationId: sample.operationId,
        profile: sample.profile,
        sampleIndex: sample.sampleIndex,
        ...(diagnostic ? { diagnostic } : {}),
      });
    }
    try {
      if (operation.cleanup) {
        await withTimeout(() => operation.cleanup({ actor, page: slot.page, sample, state }));
      }
    } catch {
      if (sample.outcome === "success") {
        sample.outcome = "failure";
        sample.classification = "framework_failure";
      }
      sample.integrityPassed = false;
      reliabilityEvents.push({
        classification: "framework_failure",
        concurrency: sample.concurrency,
        correlationId: sample.correlationId,
        metricId: sample.metricId,
        operationId: sample.operationId,
        phase: "cleanup",
        profile: sample.profile,
        sampleIndex: sample.sampleIndex,
      });
    }
    process.stderr.write(
      `G2 sample ${sample.operationId} ${sample.profile} c${sample.concurrency} ${sample.temperature} ${sample.sampleIndex} ${sample.classification} ${sample.durationMs}ms\n`,
    );
    return sample;
  }

  async function runGroup(operation, profile, concurrency) {
    process.stderr.write(
      `G2 Playwright ${operation.metricId} ${operation.id} ${profile} c${concurrency}\n`,
    );
    operationOrder.push({
      concurrency,
      metricId: operation.metricId,
      operationId: operation.id,
      profile,
      sequence: operationOrder.length + 1,
    });
    const cold = await prepareMeasured(operation, profile, concurrency, 0, 0);
    await finalizeMeasured(
      await runMeasured(
        cold,
        profile,
        concurrency,
        "cold",
        0,
        concurrency === 10 ? `${operation.id}-${profile}-cold` : undefined,
      ),
    );
    if (concurrency === 1) {
      for (let sampleIndex = 1; sampleIndex <= warmSamples; sampleIndex += 1) {
        const prepared = await prepareMeasured(operation, profile, concurrency, sampleIndex, 0);
        await finalizeMeasured(
          await runMeasured(prepared, profile, concurrency, "warm", sampleIndex),
        );
      }
      return;
    }
    if (warmSamples % 10 !== 0) {
      throw new Error("Concurrency-ten warm samples must form complete ten-operation waves.");
    }
    for (let waveIndex = 1; waveIndex <= warmSamples / 10; waveIndex += 1) {
      const waveId = `${operation.id}-${profile}-${waveIndex}`;
      const prepared = [];
      for (let actorIndex = 0; actorIndex < 10; actorIndex += 1) {
        prepared.push(
          await prepareMeasured(
            operation,
            profile,
            concurrency,
            (waveIndex - 1) * 10 + actorIndex + 1,
            actorIndex,
          ),
        );
      }
      const correlations = prepared.map(() => opaqueCorrelation());
      proxy.armWave(waveId, correlations);
      // Pre-arm exact correlations so the proxy releases only when all real
      // application requests have reached the synchronized wave boundary.
      const measured = prepared.map((entry, actorIndex) => {
        entry.preassignedCorrelation = correlations[actorIndex];
        return entry;
      });
      const measuredResults = await Promise.all(
        measured.map((entry, actorIndex) =>
          runMeasured(
            entry,
            profile,
            concurrency,
            "warm",
            (waveIndex - 1) * 10 + actorIndex + 1,
            waveId,
          )),
      );
      await Promise.all(measuredResults.map(finalizeMeasured));
    }
  }

  const shapes = operations.flatMap((operation) =>
    operation.concurrency
      .filter((concurrency) => concurrencyFilter === null || concurrency === concurrencyFilter)
      .map((concurrency) => ({ concurrency, operation })),
  );
  for (let index = 0; index < shapes.length; index += 1) {
    const { concurrency, operation } = shapes[index];
    const profiles = index % 2 === 0
      ? ["desktop", "mobile"]
      : ["mobile", "desktop"];
    for (const profile of profiles) {
      try {
        await runGroup(operation, profile, concurrency);
      } catch (error) {
        reliabilityEvents.push({
          classification: "framework_failure",
          concurrency,
          correlationId: opaqueCorrelation(),
          metricId: operation.metricId,
          operationId: operation.id,
          phase: "group_execution",
          profile,
          reasonCode:
            error instanceof Error && error.name === "TimeoutError"
              ? "preparation_timeout"
              : "preparation_failure",
          sampleIndex: 0,
        });
        process.stderr.write(
          `G2 group ${operation.id} ${profile} c${concurrency} framework_failure\n`,
        );
      }
      try {
        await proxy.waitForIdle();
      } catch (error) {
        reliabilityEvents.push({
          ...(error instanceof ProxyIdleTimeoutError
            ? { activeStreams: error.activeStreams }
            : {}),
          classification: "framework_failure",
          concurrency,
          correlationId: opaqueCorrelation(),
          metricId: operation.metricId,
          operationId: operation.id,
          phase: "proxy_idle",
          profile,
          reasonCode: "background_request_timeout",
          sampleIndex: 0,
        });
      }
      try {
        // Keep the accepted browser contexts, profile schedule, tracing, and
        // cache boundary while releasing completed page documents that no
        // later operation consumes. Retaining all 20 loaded pages caused
        // cross-operation memory pressure during the long normative run.
        await recycleProfilePages(profile);
      } catch {
        reliabilityEvents.push({
          classification: "framework_failure",
          concurrency,
          correlationId: opaqueCorrelation(),
          metricId: operation.metricId,
          operationId: operation.id,
          phase: "profile_page_recycle",
          profile,
          reasonCode: "page_recycle_failure",
          sampleIndex: 0,
        });
      }
    }
    await operation.afterProfilePair?.();
  }

  for (const profile of ["desktop", "mobile"]) {
    for (const slot of slots[profile]) {
      const rawPath = `${outputDirectory}/traces/${slot.archiveId}.raw.zip`;
      const finalPath = `${outputDirectory}/traces/${slot.archiveId}.zip`;
      await slot.context.tracing.stop({ path: rawPath });
      await slot.context.close();
      sanitizeTraceArchive(rawPath, finalPath);
      rmSync(rawPath, { force: true });
    }
  }
} finally {
  await browser?.close().catch(() => {});
  await stopChild(application);
  await proxy.close();
}

const validatedSamples = [];
for (const sample of samples) {
  try {
    validatedSamples.push(validateNormativePerformanceSample(sample));
  } catch {
    reliabilityEvents.push({
      classification: "framework_failure",
      concurrency: sample.concurrency,
      correlationId: sample.correlationId,
      metricId: sample.metricId,
      operationId: sample.operationId,
      profile: sample.profile,
      sampleIndex: sample.sampleIndex,
    });
  }
}

const groups = [];
for (const operation of operations) {
  for (const concurrency of operation.concurrency) {
    for (const profile of ["desktop", "mobile"]) {
      const groupSamples = validatedSamples.filter(
        (sample) =>
          sample.operationId === operation.id &&
          sample.profile === profile &&
          sample.concurrency === concurrency,
      );
      if (groupSamples.length === 0) continue;
      groups.push(
        aggregateNormativeQualificationGroup({
          samples: groupSamples,
          thresholdMs: operation.threshold,
          minimumWarmSamples: isFocused ? warmSamples : 30,
        }),
      );
    }
  }
}

const cardinalityPairs = Object.keys(fixtureManifest.cardinalities)
  .sort()
  .map((table) => `'${table}', (select count(*) from public.${table})`)
  .join(", ");
const postRunCardinalities = JSON.parse(
  psql(`select jsonb_build_object(${cardinalityPairs})::text;`),
);
const cardinalityPassed = Object.entries(fixtureManifest.cardinalities).every(
  ([table, expected]) => postRunCardinalities[table] === expected,
);
const runtimeEndedAt = new Date().toISOString();
const hostManifest = {
  schemaVersion: "1",
  architecture: process.arch,
  browser: { engine: "chromium", version: browserVersion },
  cpuLogicalCount: cpus().length,
  dockerLocalSupabaseHealth: "healthy",
  nodeVersion: process.version,
  operationOrder,
  os: { platform: platform(), release: release(), type: osType() },
  playwrightVersion: JSON.parse(readFileSync("node_modules/@playwright/test/package.json", "utf8")).version,
  postgresqlVersion: psql("show server_version;"),
  qualificationEndedAt: runtimeEndedAt,
  qualificationStartedAt: runtimeStartedAt,
  runtimeAfter: hostSnapshot(),
  runtimeBefore,
  supabaseCliVersion: command("npx", ["supabase", "--version"]),
  totalMemoryBytes: totalmem(),
};
const sourceHasher = createHash("sha256");
for (const path of [
  "scripts/run-phase-11g2-playwright-qualification.mjs",
  "scripts/phase-11g2-playwright-operations.mjs",
  "lib/performance/qualification.ts",
  "app/[locale]/(app)/foods/page.tsx",
  "performance/fixture-manifest.json",
  "performance/fixture.sql",
]) {
  sourceHasher.update(path);
  sourceHasher.update("\0");
  sourceHasher.update(readFileSync(path));
  sourceHasher.update("\0");
}
const report = {
  schemaVersion: "1",
  evidenceType: isFocused
    ? "phase-11g2-focused-normative-diagnostic"
    : "phase-11g2-normative-local-performance-capacity-qualification",
  approvedConcurrency: fixtureManifest.approvedConcurrency,
  cardinalityPassed,
  fixtureCardinalities: Object.entries(fixtureManifest.cardinalities)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([relation, count]) => ({ count, relation })),
  observedFixtureCardinalities: Object.entries(postRunCardinalities)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([relation, count]) => ({ count, relation })),
  fixtureVersion: fixtureManifest.fixtureVersion,
  groupCount: groups.length,
  groups,
  measurementBoundary:
    "Playwright user action through the real Next application and local Supabase to deterministic stable UI; correlated loopback Next server-response timing is recorded separately.",
  serverTimingBoundary:
    "The correlated server interval runs from proxy request receipt through the complete Next response body; Server-Timing records response-start latency for the same request.",
  normativePlaywrightBoundarySatisfied:
    validatedSamples.length === samples.length && groups.every((group) => group.browserBoundaryPassed),
  passed:
    cardinalityPassed &&
    reliabilityEvents.length === 0 &&
    groups.length > 0 &&
    groups.every((group) => group.passed),
  percentileMethod: "nearest-rank",
  profileSchedule: "deterministic counterbalanced AB/BA profile order per operation/concurrency shape",
  reliabilityEvents,
  sampleCount: validatedSamples.length,
  sourceIdentitySha256: sourceHasher.digest("hex"),
  timeoutMs,
  warmSamplesPerGroup: warmSamples,
};

writeFileSync(
  `${outputDirectory}/normative-performance-samples.json`,
  serializePrivacySafeEvidence(validatedSamples),
);
writeFileSync(
  `${outputDirectory}/normative-performance-report.json`,
  serializePrivacySafeEvidence(report),
);
writeFileSync(
  `${outputDirectory}/normative-browser-trace-map.json`,
  serializePrivacySafeEvidence(traceMap),
);
writeFileSync(
  `${outputDirectory}/runtime-manifest.json`,
  serializePrivacySafeEvidence(hostManifest),
);
writeFileSync(
  `${outputDirectory}/operation-boundaries.json`,
  serializePrivacySafeEvidence(
    operations.map((operation) => ({
      actionKind: operation.actionKind,
      expectedMethod: operation.expectedMethod,
      expectedPathTemplate: operation.serverRouteTemplate,
      metricId: operation.metricId,
      operationId: operation.id,
      stableCondition: operation.stableDescription,
      stableConditionId: operation.stableConditionId,
      stableRouteTemplate: operation.stableRouteTemplate,
      timerEnd: "after deterministic stable UI assertion succeeds",
      timerStart: "immediately before the triggering Playwright action",
      trigger: operation.triggerDescription,
      triggerId: operation.triggerId,
    })),
  ),
);

process.stdout.write(
  `${JSON.stringify({
    cardinalityPassed,
    groupCount: groups.length,
    passed: report.passed,
    sampleCount: validatedSamples.length,
  })}\n`,
);
if (!report.passed) process.exitCode = 1;
