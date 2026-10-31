import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { createHash, randomBytes } from "node:crypto";
import { cpSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

// This command has no database URL, linked-project, or remote execution option.
// Its only mutations are in its newly created disposable local Docker project.
if (process.argv.length !== 2) throw new Error("This local-only command accepts no connection options.");
const root = process.cwd();
const workspace = mkdtempSync(join(tmpdir(), "full35-reprojection-"));
const project = `full35-reprojection-${randomBytes(6).toString("hex")}`;
const evidence = join(workspace, "evidence");
mkdirSync(join(workspace, "supabase"));
mkdirSync(evidence);
const selectedPorts = new Set();
async function unusedPort() {
  const server = createServer();
  await new Promise((ok, fail) => server.listen(0, "127.0.0.1", ok).on("error", fail));
  const port = server.address().port;
  await new Promise((ok, fail) => server.close(error => error ? fail(error) : ok()));
  if (selectedPorts.has(port)) return unusedPort();
  selectedPorts.add(port);
  return port;
}
function run(command, args, options = {}) {
  return new Promise((ok, fail) => {
    const child = spawn(command, args, {cwd: root, env: {...process.env, ...options.env}, stdio: ["ignore", "pipe", "pipe"]});
    let output = "";
    child.stdout.on("data", chunk => {output += chunk; if (options.show) process.stdout.write(chunk);});
    child.stderr.on("data", chunk => {output += chunk; if (options.show) process.stderr.write(chunk);});
    child.on("error", fail);
    child.on("close", code => {
      if (options.log) writeFileSync(join(evidence, options.log), output);
      if (code === 0 || options.allowFailure) ok({code, output});
      else fail(new Error(`${command} exited ${code}; evidence: ${evidence}\n${output.slice(-3000)}`));
    });
  });
}
const cli = resolve("node_modules/.bin/supabase");
let started = false;
let failure;
try {
  const commit = (await run("git", ["rev-parse", "HEAD"])).output.trim();
  const tree = (await run("git", ["rev-parse", "HEAD^{tree}"])).output.trim();
  const migrationFiles = (await run("git", ["ls-files", "--cached", "--others", "--exclude-standard", "supabase/migrations"])).output.trim().split("\n").filter(name => name.endsWith(".sql")).sort();
  writeFileSync(join(evidence, "qualification-context.json"), JSON.stringify({commit, tree, node: process.version,
    identity_scope: "Synthetic local database fixtures only", migrations: migrationFiles.map(filename => ({filename,
      sha256: createHash("sha256").update(readFileSync(filename)).digest("hex")}))}, null, 2)+"\n");
  const endpoint = process.env.DOCKER_HOST || (await run("docker", ["context", "inspect", "--format", "{{.Endpoints.docker.Host}}"])) .output.trim();
  if (!endpoint.startsWith("unix://")) throw new Error("Qualification requires a local Docker Unix socket.");
  let config = readFileSync("supabase/config.toml", "utf8");
  config = config.replace(/^project_id\s*=.*$/m, `project_id = "${project}"`);
  for (const old of [54320, 54321, 54322, 54323, 54324, 54327, 54329]) {
    config = config.replaceAll(`= ${old}`, `= ${await unusedPort()}`);
  }
  writeFileSync(join(workspace, "supabase/config.toml"), config);
  cpSync("supabase/migrations", join(workspace, "supabase/migrations"), {recursive: true});
  cpSync("supabase/templates", join(workspace, "supabase/templates"), {recursive: true});
  await run(cli, ["--version"], {log: "supabase-version.log"});
  process.stdout.write(`Starting isolated local database ${project}.\n`);
  started = true;
  await run(cli, ["db", "start", "--workdir", workspace], {log: "database-replay.log"});
  await run(resolve("node_modules/.bin/playwright"), ["test", "--config=playwright.full35-database.config.ts"], {
    show: true, log: "qualification.log", env: {FULL35_LOCAL_DATABASE_CONTAINER: `supabase_db_${project}`,
      FULL35_EVIDENCE_DIR: evidence, FULL35_TEST_OUTPUT_DIR: join(workspace, "test-results"), PYTHONDONTWRITEBYTECODE: "1"},
  });
} catch (error) {
  failure = error;
} finally {
  if (started) {
    process.stdout.write(`Stopping isolated local database ${project}.\n`);
    try {await run(cli, ["stop", "--project-id", project, "--workdir", workspace, "--no-backup"], {log: "cleanup.log"});}
    catch (error) {failure ??= error;}
  }
  process.stdout.write(`Local qualification evidence: ${evidence}\n`);
}
if (failure) {process.stderr.write(`${failure.message}\n`); process.exitCode = 1;}
