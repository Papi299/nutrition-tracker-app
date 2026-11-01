import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { randomBytes } from "node:crypto";
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

// Diagnostic only: it must demonstrate the immutable actor-OID recovery failure.
// It never authorizes history 47 in the approved recovery pipeline.
if (process.argv.length !== 2) throw new Error("This local-only diagnostic accepts no connection options.");
const repository = process.cwd();
const root = mkdtempSync(join(tmpdir(), "full35-recovery-identity-"));
const evidence = join(root, "evidence");
mkdirSync(evidence, { mode: 0o700 });
const cli = resolve("node_modules/.bin/supabase");
const started = [];
const ports = new Set();
function run(command, args, options = {}) {
  return new Promise((ok, fail) => {
    const child = spawn(command, args, { cwd: repository, env: { ...process.env, ...options.env },
      stdio: ["ignore", "pipe", "pipe"], timeout: options.timeout ?? 120_000 });
    let output = "";
    child.stdout.on("data", chunk => { output += chunk; if (options.show) process.stdout.write(chunk); });
    child.stderr.on("data", chunk => { output += chunk; if (options.show) process.stderr.write(chunk); });
    child.on("error", fail);
    child.on("close", code => {
      if (options.log) writeFileSync(join(evidence, options.log), output, { mode: 0o600 });
      if (code === 0) ok(output.trim());
      else fail(new Error(`Local diagnostic command ${command} exited ${code}; see ${evidence}.`));
    });
  });
}
async function unusedPort() {
  const server = createServer();
  await new Promise((ok, fail) => server.listen(0, "127.0.0.1", ok).on("error", fail));
  const port = server.address().port;
  await new Promise((ok, fail) => server.close(error => error ? fail(error) : ok()));
  if (ports.has(port)) return unusedPort();
  ports.add(port);
  return port;
}
let failure;
try {
  const endpoint = process.env.DOCKER_HOST || await run("docker", ["context", "inspect", "--format", "{{.Endpoints.docker.Host}}"]);
  if (!endpoint.startsWith("unix://")) throw new Error("A local Docker Unix socket is required.");
  const identities = {};
  for (const side of ["source", "target"]) {
    const project = `full35-recovery-${side}-${randomBytes(6).toString("hex")}`;
    const directory = join(root, side);
    mkdirSync(join(directory, "supabase"), { recursive: true });
    let config = readFileSync("supabase/config.toml", "utf8").replace(/^project_id\s*=.*$/m, `project_id = "${project}"`);
    for (const old of [54320, 54321, 54322, 54323, 54324, 54327, 54329]) config = config.replaceAll(`= ${old}`, `= ${await unusedPort()}`);
    writeFileSync(join(directory, "supabase/config.toml"), config);
    cpSync("supabase/migrations", join(directory, "supabase/migrations"), { recursive: true });
    cpSync("supabase/templates", join(directory, "supabase/templates"), { recursive: true });
    identities[side] = { project, directory, container: `supabase_db_${project}` };
    started.push({ project, directory });
    process.stdout.write(`Starting disposable local ${side} database ${project}.\n`);
    await run(cli, ["db", "start", "--workdir", directory], { log: `${side}-replay.log` });
  }
  writeFileSync(join(evidence, "context.json"), JSON.stringify({
    commit: await run("git", ["rev-parse", "HEAD"]), tree: await run("git", ["rev-parse", "HEAD^{tree}"]),
    cli: await run(cli, ["--version"]), node: process.version, identities,
  }, null, 2) + "\n", { mode: 0o600 });
  writeFileSync(join(evidence, "diagnostic-input.json"), JSON.stringify({
    source: identities.source.container, target: identities.target.container,
    sourceDirectory: identities.source.directory, scratch: join(root, "private"),
  }), { mode: 0o600 });
  await run(resolve("node_modules/.bin/playwright"), ["test", "--config=playwright.full35-recovery-diagnostic.config.ts"], {
    show: true, log: "diagnostic.log", timeout: 720_000, env: {
      FULL35_EVIDENCE_DIR: evidence, FULL35_TEST_OUTPUT_DIR: join(root, "test-results"),
    },
  });
} catch (error) { failure = error; }
finally {
  for (const { project, directory } of started) {
    try { await run(cli, ["stop", "--project-id", project, "--workdir", directory, "--no-backup"], { log: `${project}-cleanup.log` }); }
    catch (error) { failure ??= error; }
  }
  rmSync(join(root, "private"), { recursive: true, force: true });
  if (!failure) process.stdout.write("Actor-OID recovery blocker reproduced; history 47 remains UNQUALIFIED.\n");
  process.stdout.write(`Sanitized diagnostic evidence: ${evidence}\n`);
}
if (failure) { process.stderr.write(`${failure.message}\n`); process.exitCode = 1; }
