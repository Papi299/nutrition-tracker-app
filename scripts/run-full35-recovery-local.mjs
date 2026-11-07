import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { createHash, randomBytes } from "node:crypto";
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { assertRedactedEvidence, assertTrustedMigrationReplay } from "./phase-11i-recovery-contract.mjs";
import { FULL35_OWNER_RELEASE_HISTORY, FULL35_PORTION_SCOPE_HISTORY } from "./full35-owner-release-history.mjs";
import { FOUNDATION_WRITER_BARRIER_HISTORY } from "./foundation-writer-barrier-history.mjs";
import { ATOMIC_DIARY_REVIEWED_HISTORY } from "./atomic-diary-recovery-history.mjs";
import { FULL35_REVIEWED_HISTORY } from "./full35-recovery-history.mjs";

// Local Docker only. The history-49 case seeds a history-48 source first.
const ownerRelease = process.argv[2] === "--owner-release";
const writerBarrier = process.argv[2] === "--writer-barrier";
const atomicDiary = process.argv[2] === "--atomic-diary";
if (process.argv.length !== (ownerRelease || writerBarrier || atomicDiary ? 3 : 2)) throw new Error("This local-only diagnostic accepts no connection options.");
const history = ownerRelease ? FULL35_PORTION_SCOPE_HISTORY : writerBarrier ? FOUNDATION_WRITER_BARRIER_HISTORY : atomicDiary ? ATOMIC_DIARY_REVIEWED_HISTORY : FULL35_REVIEWED_HISTORY;
const readMigration = name => readFileSync(join("supabase/migrations", name));
const migrations = assertTrustedMigrationReplay(readdirSync("supabase/migrations").sort(), history, readMigration);
const evidenceName = ownerRelease ? "full35-owner-recovery-evidence" : writerBarrier ? "writer-barrier-recovery-evidence" : atomicDiary ? "atomic-diary-recovery-evidence" : "full35-recovery-evidence";
const repository = process.cwd();
const root = mkdtempSync(join(tmpdir(), "full35-recovery-qualified-"));
const evidence = join(root, "evidence");
mkdirSync(evidence, { mode: 0o700 });
const cli = resolve("node_modules/.bin/supabase");
const started = [];
const stopped = new Set();
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
  const endpoint = await run("docker", ["context", "inspect", "--format", "{{.Endpoints.docker.Host}}"]);
  if (!endpoint.startsWith("unix://") || (process.env.DOCKER_HOST && !process.env.DOCKER_HOST.startsWith("unix://"))) throw new Error("A local Docker Unix socket is required.");
  const cliVersion=await run(cli,["--version"]);
  if(cliVersion.split(/\r?\n/)[0]!=="2.116.0") throw new Error("The reviewed Supabase CLI 2.116.0 is required.");
  const identities = {};
  for (const side of ["source", "target"]) {
    const project = side === "target" ? "phase-11i-recovery-isolated" : `full35-recovery-source-${randomBytes(6).toString("hex")}`;
    if ((await run("docker", ["ps", "-a", "--format", "{{.Names}}"])).split(/\r?\n/).some(name => name.endsWith(`_${project}`))) throw new Error("Reserved local recovery container already exists.");
    const directory = join(root, side);
    mkdirSync(join(directory, "supabase"), { recursive: true });
    let config = readFileSync("supabase/config.toml", "utf8").replace(/^project_id\s*=.*$/m, `project_id = "${project}"`);
    for (const old of [54320, 54321, 54322, 54323, 54324, 54327, 54329]) config = config.replaceAll(`= ${old}`, `= ${await unusedPort()}`);
    writeFileSync(join(directory, "supabase/config.toml"), config);
    mkdirSync(join(directory,"supabase/migrations"));
    const staged = new Set(writerBarrier ? [history.filename] : ownerRelease && side === "source"
      ? [FULL35_OWNER_RELEASE_HISTORY.filename, FULL35_PORTION_SCOPE_HISTORY.filename] : []);
    for (const file of migrations) {
      if (!staged.has(file)) cpSync(join("supabase/migrations", file), join(directory,"supabase/migrations",file));
    }
    cpSync("supabase/templates", join(directory, "supabase/templates"), { recursive: true });
    identities[side] = { project, directory, container: `supabase_db_${project}` };
    started.push({ project, directory });
    process.stdout.write(`Starting disposable local ${side} database ${project}.\n`);
    await run(cli, ["db", "start", "--workdir", directory], { log: `${side}-replay.log` });
    for (const file of staged) cpSync(join("supabase/migrations", file), join(directory, "supabase/migrations", file));
  }
  writeFileSync(join(evidence, "context.json"), JSON.stringify({
    commit: await run("git", ["rev-parse", "HEAD"]), tree: await run("git", ["rev-parse", "HEAD^{tree}"]),
    cli: cliVersion, node: process.version, identities,
    candidateSqlSha256: createHash("sha256").update(readMigration(history.filename)).digest("hex"),
    workingTreeStatus: await run("git",["status","--porcelain"]),
  }, null, 2) + "\n", { mode: 0o600 });
  writeFileSync(join(evidence, "diagnostic-input.json"), JSON.stringify({
    source: identities.source.container, target: identities.target.container,
    sourceDirectory: identities.source.directory, targetDirectory: identities.target.directory, scratch: join(root, "private"),
  }), { mode: 0o600 });
  await run(resolve("node_modules/.bin/playwright"), ["test", "--config=playwright.full35-recovery.config.ts", ...(ownerRelease ? ["--grep", "Full35 single owner"] : writerBarrier ? ["--grep", "Foundation writer barrier"] : ["--grep-invert", "Foundation writer barrier|Full35 single owner"])], {
    show: true, log: "diagnostic.log", timeout: 3_300_000, env: {
      FULL35_ATOMIC_DIARY_RECOVERY: ownerRelease ? "51" : writerBarrier ? "49" : atomicDiary ? "1" : "0", FULL35_EVIDENCE_DIR: evidence, FULL35_TEST_OUTPUT_DIR: join(root, "test-results"),
    },
  });
  const qualification=JSON.parse(readFileSync(join(evidence,"recovery-qualification.json"),"utf8"));
  if(atomicDiary && qualification.atomicDiary?.result!=="PASS") throw new Error("Exact new history atomic diary recovery must pass.");
  if (ownerRelease) {
    if (qualification.result !== "PASS" || qualification.migrationHead !== history.head ||
        qualification.checkpoint?.full35Recovery?.result !== "PASS" ||
        qualification.checkpoint.full35Recovery.tablesCompared !== 79) {
      throw new Error("Exact history 51, owner receipt continuity and encrypted restore must pass.");
    }
  } else if (writerBarrier) {
    if (qualification.result !== "PASS" || qualification.migrationHead !== history.head ||
        qualification.checkpoint?.full35Recovery?.result !== "PASS" || qualification.checkpoint?.atomicRace?.result !== "PASS") {
      throw new Error("Exact-history-49 encrypted restore, writer admission and restored race must pass.");
    }
  } else if (qualification.result !== "PASS" || qualification.checkpoints.length !== 3 ||
      Object.keys(qualification.recoveryMatrix).length !== 26 || Object.keys(qualification.markerMatrix).length !== 10) {
    throw new Error("Three approved encrypted scenarios, all 26 recovery negatives and all ten marker cases must pass.");
  }
} catch (error) { failure = error; }
finally {
  for (const { project, directory } of started) {
    try { await run(cli, ["stop", "--project-id", project, "--workdir", directory, "--no-backup"], { log: `${project}-cleanup.log` }); stopped.add(project); }
    catch (error) { failure ??= error; }
  }
  rmSync(join(root, "private"), { recursive: true, force: true });
  const cleanup={schemaVersion:"full35-recovery-cleanup/v1",privateKeyAndPlaintextRemoved:!existsSync(join(root,"private")),allOwnedProjectsStopped:stopped.size===started.length,ownedProjects:started.map(item=>item.project),productionAccess:false};
  writeFileSync(join(evidence,"cleanup.json"),JSON.stringify(cleanup,null,2)+"\n",{mode:0o600});
  if (!failure && process.env.CI === "true") {
    const destination=join(repository,evidenceName);mkdirSync(destination,{mode:0o700});
    for(const name of ["context.json","recovery-qualification.json","cleanup.json"]){const value=JSON.parse(readFileSync(join(evidence,name),"utf8"));assertRedactedEvidence(value);writeFileSync(join(destination,name),JSON.stringify(value,null,2)+"\n",{mode:0o600});}
  }
  if (!failure) process.stdout.write(`Approved encrypted Full35 migration-${history.count} recovery qualification PASS.\n`);
  process.stdout.write(`Sanitized recovery qualification evidence: ${evidence}\n`);
}
if (failure) { process.stderr.write(`${failure.message}\n`); process.exitCode = 1; }
