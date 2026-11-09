import { FULL35_OWNER_RELEASE_HISTORY, FULL35_PORTION_SCOPE_HISTORY, FULL35_VALIDATOR_REPAIR_HISTORY, FULL35_RECEIPT_PERFORMANCE_HISTORY, FULL35_OBSERVED_EXECUTION_HISTORY, FULL35_VALIDATOR_SPILL_HISTORY, FULL35_STAGED_PUBLICATION_HISTORY, assertReviewedFull35StagedPublicationFiles } from "./full35-owner-release-history.mjs";
import { FOUNDATION_WRITER_BARRIER_HISTORY } from "./foundation-writer-barrier-history.mjs";
import { execFileSync, spawn } from "node:child_process";
import { createHash, randomBytes } from "node:crypto";
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

// No database URL, linked project or hosted execution option is accepted.
const selections = process.argv.slice(2);
if (selections.some(arg => !/^e2e\/[a-z0-9-]+\.(?:spec|app)\.ts$/.test(arg))) {
  throw new Error("Only repository-local browser test filenames are accepted.");
}
const source = process.cwd();
const workspace = mkdtempSync(join(tmpdir(), "full35-app-"));
const runtime = join(workspace, "app");
const evidence = join(workspace, "evidence");
const project = `full35-app-${randomBytes(6).toString("hex")}`;
mkdirSync(runtime); mkdirSync(evidence);
for (const entry of readdirSync(source)) {
  if ([".git", ".next", "node_modules", "test-results", "playwright-report", ".vercel", ".codex", ".agents", ".aws", ".ingestion-workspace",
    ".phase-11i-recovery", "recovery-artifacts", "full35-app-evidence", "codeql-results"].includes(entry) || entry.startsWith(".env")) continue;
  cpSync(join(source, entry), join(runtime, entry), { recursive: true });
}
// Keep the historical legacy-writer scenarios on their exact history-48
// database. The atomicity and recovery jobs exercise the history-49 barrier.
const migrations = join(runtime, "supabase/migrations");
assertReviewedFull35StagedPublicationFiles(readdirSync(migrations).filter(name => name.endsWith(".sql")).sort(),
  name => readFileSync(join(migrations, name)));
rmSync(join(migrations, FOUNDATION_WRITER_BARRIER_HISTORY.filename));
rmSync(join(migrations, FULL35_OWNER_RELEASE_HISTORY.filename));
rmSync(join(migrations, FULL35_PORTION_SCOPE_HISTORY.filename));
rmSync(join(migrations, FULL35_VALIDATOR_REPAIR_HISTORY.filename));
rmSync(join(migrations, FULL35_RECEIPT_PERFORMANCE_HISTORY.filename));
rmSync(join(migrations, FULL35_OBSERVED_EXECUTION_HISTORY.filename));
rmSync(join(migrations, FULL35_VALIDATOR_SPILL_HISTORY.filename));
rmSync(join(migrations, FULL35_STAGED_PUBLICATION_HISTORY.filename));
// This legacy fixture runs against H48, whose ingestion contract also matches H49.
const legacyIngestionTypes = execFileSync("git", ["show",
  "7d284972dc3657656b66dfcdb542eb47e233e53f:ingestion/generated/database.types.ts"], { cwd: source });
if (createHash("sha256").update(legacyIngestionTypes).digest("hex") !==
    "e9edf94ab47820044e90305b38a922ee8fa5c77ad8e47e7d2e557bef01aa4fe3") {
  throw new Error("Exact historical ingestion types are required for the H48 fixture.");
}
writeFileSync(join(runtime, "ingestion/generated/database.types.ts"), legacyIngestionTypes);

// Turbopack confines module resolution to the runtime project. Keep the locked
// installation inside that root instead of linking outside its filesystem.
cpSync(resolve("node_modules"), join(runtime, "node_modules"), { recursive: true, verbatimSymlinks: true });
const usedPorts = new Set();
async function unusedPort() {
  const server = createServer();
  await new Promise((ok, fail) => server.listen(0, "127.0.0.1", ok).on("error", fail));
  const port = server.address().port;
  await new Promise((ok, fail) => server.close(error => error ? fail(error) : ok()));
  if (usedPorts.has(port)) return unusedPort();
  usedPorts.add(port); return port;
}
async function run(command, args, options = {}) {
  return new Promise((ok, fail) => {
    const child = spawn(command, args, { cwd: options.cwd ?? runtime,
      env: { ...process.env, ...options.env }, stdio: ["ignore", "pipe", "pipe"] });
    let output = "";
    child.stdout.on("data", chunk => { output += chunk; if (options.show) process.stdout.write(chunk); });
    child.stderr.on("data", chunk => { output += chunk; if (options.show) process.stderr.write(chunk); });
    child.on("error", fail);
    child.on("close", code => {
      if (options.log) writeFileSync(join(evidence, options.log), output);
      if (code === 0) ok(output);
      else fail(new Error(`${command} exited ${code}; ${options.log ?? "no log"}; ${output.slice(-2000)}`));
    });
  });
}
const cli = resolve("node_modules/.bin/supabase");
let started = false;
let stopped = false;
let failure;
try {
  const endpoint = process.env.DOCKER_HOST || (await run("docker", ["context", "inspect", "--format", "{{.Endpoints.docker.Host}}"])).trim();
  if (!endpoint.startsWith("unix://")) throw new Error("A local Docker Unix socket is required.");
  const commit = (await run("git", ["rev-parse", "HEAD"], { cwd: source })).trim();
  const tree = (await run("git", ["rev-parse", "HEAD^{tree}"], { cwd: source })).trim();
  const workingTreeClean = (await run("git", ["status", "--porcelain=v1"], { cwd: source })).trim() === "";
  const versions = { node: process.version, npm: (await run("npm", ["--version"])).trim(),
    supabase: (await run(cli, ["--version"])).split(/\r?\n/).find(line => /^\d+\.\d+\.\d+$/.test(line.trim()))?.trim(),
    playwright: (await run(resolve("node_modules/.bin/playwright"), ["--version"])).trim(),
    python: (await run("python3", ["--version"])).trim(), docker: (await run("docker", ["version", "--format", "{{.Server.Version}}"])).trim() };
  writeFileSync(join(evidence, "source.json"), JSON.stringify({ commit, tree, workingTreeClean, versions,
    scope: "disposable synthetic local application only", project }, null, 2) + "\n");
  let config = readFileSync(join(runtime, "supabase/config.toml"), "utf8")
    .replace(/^project_id\s*=.*$/m, `project_id = "${project}"`);
  for (const port of [54320, 54321, 54322, 54323, 54324, 54327, 54329, 8083]) {
    config = config.replaceAll(`= ${port}`, `= ${await unusedPort()}`);
  }
  writeFileSync(join(runtime, "supabase/config.toml"), config);
  started = true;
  process.stdout.write(`Starting disposable application project ${project}.\n`);
  // Keep Auth, REST, Kong and mail for genuine browser/authenticated flows.
  await run(cli, ["start", "--workdir", runtime, "-x", "realtime,storage-api,imgproxy,postgres-meta,studio,edge-runtime,logflare,vector,supavisor"], { log: "startup.local.log" });
  await run("npm", ["run", "types:ingestion:check"], { log: "ingestion-types.log", show: true });
  versions.postgres = (await run("docker", ["exec", `supabase_db_${project}`, "psql", "-U", "supabase_admin", "-d", "postgres", "-qAt", "-c", "show server_version;"])).trim();
  const context = JSON.parse(readFileSync(join(evidence, "source.json"), "utf8"));
  context.versions = versions;
  writeFileSync(join(evidence, "source.json"), JSON.stringify(context, null, 2) + "\n");
  const status = await run(cli, ["status", "--workdir", runtime, "-o", "env"]);
  const values = Object.fromEntries(status.split(/\r?\n/).flatMap(line => {
    const match = /^([A-Z_]+)="(.*)"$/.exec(line.trim()); return match ? [[match[1], match[2]]] : [];
  }));
  if (!values.API_URL || !values.ANON_KEY || new URL(values.API_URL).hostname !== "127.0.0.1") throw new Error("Expected loopback-only local API.");
  const appPort = String(await unusedPort());
  const env = { APP_ENVIRONMENT: "local", SUPABASE_ENVIRONMENT: "local", SUPABASE_PROJECT_REF: "local",
    APP_ORIGIN: `http://127.0.0.1:${appPort}`,
    AUTH_REAUTH_PROOF_SECRET: randomBytes(48).toString("base64url"),
    ACCOUNT_CLOSURE_CAPABILITY_SECRET: randomBytes(48).toString("base64url"),
    NEXT_PUBLIC_SUPABASE_URL: values.API_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: values.PUBLISHABLE_KEY ?? values.ANON_KEY,
    FULL35_APP_SOURCE_COMMIT: commit, FULL35_APP_SOURCE_TREE: tree,
    PLAYWRIGHT_PORT: appPort };
  if (process.env.FULL35_APPROVED_SOURCE_ARCHIVE) {
    await run("python3", ["scripts/full35-app-source-oracle.py", "--archive", process.env.FULL35_APPROVED_SOURCE_ARCHIVE,
      "--output", ".ingestion-workspace/full35-local-qual-001/application-oracle.json"], { log: "official-source-oracle.json", show: true });
  }
  await run("npm", ["run", "build"], { env, log: "build.log", show: true });
  const configuration = selections.length && selections.every(file => file.endsWith(".spec.ts"))
    ? "playwright.config.ts" : "playwright.full35-app.config.ts";
  await run(process.execPath, ["scripts/run-local-date-e2e.mjs", `--config=${configuration}`, ...selections, "--reporter=line,json"],
    { env: { ...env, PLAYWRIGHT_JSON_OUTPUT_FILE: join(evidence, "playwright.json") }, log: "browser.log", show: true });
} catch (error) { failure = error; }
finally {
  if (started) {
    try { await run(cli, ["stop", "--workdir", runtime, "--project-id", project, "--no-backup"], { log: "cleanup.local.log" }); stopped = true; }
    catch (error) { failure ??= error; }
  }
  const exported = join(source, "full35-app-evidence", project);
  mkdirSync(exported, { recursive: true });
  if (existsSync(join(evidence, "source.json"))) cpSync(join(evidence, "source.json"), join(exported, "source.json"));
  if (existsSync(join(evidence, "playwright.json"))) {
    const report = JSON.parse(readFileSync(join(evidence, "playwright.json"), "utf8"));
    const results = [];
    function visit(value) {
      if (Array.isArray(value)) { value.forEach(visit); return; }
      if (!value || typeof value !== "object") return;
      if (value.status && value.duration !== undefined) results.push({ status: value.status, duration: value.duration });
      for (const attachment of value.attachments ?? []) {
        if (!["submission-observation", "200g-full-flow", "stage5-results", "353-before-after-references", "353-identity-comparison", "en-stale-review-axe", "he-stale-review-axe",
          "before-first-submit", "after-first-submit", "en-stale-review", "he-stale-review", "en-original-reference", "he-original-reference", "en-enriched-reference"].includes(attachment.name) || !attachment.body) continue;
        const extension = attachment.contentType === "application/json" ? ".json" : attachment.contentType === "image/png" ? ".png" : null;
        if (extension) writeFileSync(join(exported, attachment.name + extension), Buffer.from(attachment.body, "base64"));
      }
      Object.values(value).forEach(visit);
    }
    visit(report);
    writeFileSync(join(exported, "qualification.json"), JSON.stringify({ scope: "synthetic local owners and identities only", stats: report.stats, results }, null, 2) + "\n");
  }
  writeFileSync(join(exported, "cleanup.json"), JSON.stringify({ project, stopped, qualificationPassed: !failure, hostedOperations: false }) + "\n");
  process.stdout.write(`Local evidence (sanitize before sharing): ${evidence}\n`);
  process.stdout.write(`Bounded sanitized evidence: ${exported}\n`);
}
if (failure) { process.stderr.write(`${failure.message}\n`); process.exitCode = 1; }
