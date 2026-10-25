import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { prepareMigration44Capsule } from "./prepare-phase-11i-migration44-capsule.mjs";
import { assertMigrationHistory, assertRedactedEvidence, sha256 } from "./phase-11i-recovery-contract.mjs";
import { MIGRATION44_BOUNDARY, MIGRATION45_BOUNDARY, MIGRATION_INVENTORY, assertRecoveryCheckout } from "./phase-11i-migration-inventory.mjs";

// Fixed disposable local target only. This is a qualification harness, not a
// Production executor. It never accepts connection strings, project refs or SQL.
const project = "nutrition-002a-executor-isolated";
const container = `supabase_db_${project}`;
const cli = resolve("node_modules/.bin/supabase");
const output = process.argv[2];
if (process.argv.length !== 3 || !output?.startsWith("/") || existsSync(output)) throw new Error("A new absolute evidence path is required.");
const root = mkdtempSync(join(tmpdir(), "nutrition-002a-executor-"));
const directory = join(root, "capsule44");
const startedAt = new Date().toISOString();
const cases = {};
const git = args => run("git", args).stdout.trim();
const sourceCommit = git(["rev-parse", "HEAD"]);
function run(command, args, options = {}) {
  const result = spawnSync(command, args, { encoding: "utf8", timeout: 180000, maxBuffer: 64 * 1024 * 1024, ...options });
  if (result.status !== 0 && !options.allowFailure) throw new Error(`Local qualification command failed: ${command} ${args[0]} (exit ${result.status}).`);
  return result;
}
const cliAt = args => run(cli, [...args, "--workdir", directory]);
function dockerArgs(user = "supabase_admin") {
  return ["exec", "-i", container, "psql", "-h", "127.0.0.1", "-U", user, "-d", "postgres", "-X", "-v", "ON_ERROR_STOP=1", "-qAt"];
}
const db = sql => run("docker", dockerArgs(), { input: sql }).stdout.trim();
const ledger = () => db("select version from supabase_migrations.schema_migrations order by version").split("\n");
const schema = () => sha256(run("docker", ["exec", container, "pg_dump", "-h", "127.0.0.1", "-U", "supabase_admin", "-d", "postgres", "--schema-only", "-n", "public", "-n", "private", "-n", "ingestion"]).stdout.split("\n").filter(line => !line.startsWith("--") && !line.startsWith("\\restrict") && !line.startsWith("\\unrestrict")).join("\n"));
const background = sql => {
  const child = spawn("docker", dockerArgs(), { stdio: ["pipe", "ignore", "ignore"] });
  child.stdin.end(sql);
  return child;
};
async function waitFor(sql, expected = "1") {
  for (let n = 0; n < 100; n++) { if (db(sql) === expected) return; await delay(100); }
  throw new Error("Local qualification observation deadline exceeded.");
}
let databaseUrl;
let started = false;
function migration(options = "-c lock_timeout=5000 -c statement_timeout=120000 -c application_name=nutrition002a") {
  const url = new URL(databaseUrl);
  url.searchParams.set("options", options);
  const start = Date.now();
  const result = run(cli, ["migration", "up", "--db-url", url.href, "--workdir", directory], { allowFailure: true });
  return { ...result, elapsedMs: Date.now() - start };
}
function trigger(body, tag = "CREATE FUNCTION") {
  db(`create schema if not exists qualification;
    create or replace function qualification.inject_fault() returns event_trigger language plpgsql as $$ begin ${body}; end $$;
    create event trigger nutrition002a_fault on ddl_command_start when tag in ('${tag}') execute function qualification.inject_fault();`);
}
function clearTrigger() { db("drop event trigger if exists nutrition002a_fault; drop schema if exists qualification cascade;"); }
function failureCase(label, setup, expected, options, baselineSchema) {
  const before = baselineSchema ?? schema();
  setup();
  try {
    const result = migration(options);
    assert.notEqual(result.status, 0, label);
    assert.match(result.stdout + result.stderr, expected);
    assertMigrationHistory(ledger(), MIGRATION44_BOUNDARY);
    assert.equal(schema(), before, `Schema changed after ${label}`);
    assert.equal(db("select count(*) from information_schema.columns where column_name='additional_nutrient_snapshot' and table_schema='public'"), "0");
    cases[label] = { result: "PASS", cliExit: result.status, elapsedMs: result.elapsedMs, exact44Ledger: true, completeApplicationSchemaUnchanged: true };
  } finally { clearTrigger(); }
}
try {
  assert.equal(run("docker", ["ps", "-a", "--filter", `name=^/${container}$`, "--format", "{{.Names}}"] ).stdout.trim(), "", "Reserved executor stack exists.");
  prepareMigration44Capsule(directory);
  const configPath = join(directory, "supabase/config.toml");
  writeFileSync(configPath, readFileSync(configPath, "utf8").replace(/^project_id = .*$/m, `project_id = "${project}"`).replace(/^(\s*port = )(\d+)$/gm, (_, prefix, port) => prefix + String(Number(port) + 600)));
  assert.equal(run(cli, ["--version"]).stdout.trim(), "2.116.0");
  process.stdout.write("Starting fixed disposable44 executor fixture.\n");
  started = true;
  cliAt(["start", "--exclude", "realtime,studio,postgres-meta,edge-runtime,logflare,vector,supavisor"]);
  databaseUrl = JSON.parse(cliAt(["status", "-o", "json"]).stdout).DB_URL;
  assert.equal(new URL(databaseUrl).hostname, "127.0.0.1");
  assertMigrationHistory(ledger(), MIGRATION44_BOUNDARY);
  cpSync(join("supabase/migrations", MIGRATION_INVENTORY.at(-1).filename), join(directory, "supabase/migrations", MIGRATION_INVENTORY.at(-1).filename));
  assertRecoveryCheckout(join(directory, "supabase/migrations"));
  process.stdout.write("Testing exact-file SQL failures and actual-session timeout propagation.\n");
  failureCase("earlySqlFailure", () => trigger("raise exception '002A_EARLY'"), /002A_EARLY/);
  failureCase("lateSqlFailure", () => trigger("if to_regprocedure('public.log_recipe_to_diary_v2(uuid,timestamptz,numeric,date,text,uuid)') is not null then raise exception '002A_LATE'; end if"), /002A_LATE/);
  failureCase("actualSessionTimeoutSettings", () => trigger("raise exception '002A_SETTINGS|%|%', current_setting('lock_timeout'),current_setting('statement_timeout')"), /002A_SETTINGS\|5s\|2min/);
  failureCase("statementTimeout", () => trigger("perform pg_sleep(2)"), /statement timeout/, "-c lock_timeout=5000 -c statement_timeout=300 -c application_name=nutrition002a");
  process.stdout.write("Testing lock timeout and pre-commit connection loss.\n");
  const beforeLock = schema();
  const holder = background("set application_name='nutrition002a_holder'; begin; lock table public.diary_entries in access exclusive mode; select pg_sleep(60); rollback;");
  try {
    await waitFor("select count(*) from pg_stat_activity where application_name='nutrition002a_holder' and wait_event='PgSleep'");
    failureCase("lockTimeout5000ms", () => {}, /lock timeout/, undefined, beforeLock);
  } finally {
    db("select pg_terminate_backend(pid) from pg_stat_activity where application_name='nutrition002a_holder'");
    holder.kill();
  }
  // A connection loss during a late statement rolls the schema AND ledger back.
  trigger("if to_regprocedure('public.log_recipe_to_diary_v2(uuid,timestamptz,numeric,date,text,uuid)') is not null then perform pg_sleep(30); end if");
  const beforeDisconnect = schema();
  const url = new URL(databaseUrl);
  url.searchParams.set("options", "-c application_name=nutrition002a_disconnect -c statement_timeout=120000 -c lock_timeout=5000");
  const interrupted = spawn(cli, ["migration", "up", "--db-url", url.href, "--workdir", directory], { stdio: "ignore" });
  const interruptedExit = new Promise(resolve => interrupted.on("close", resolve));
  await waitFor("select count(*) from pg_stat_activity where wait_event='PgSleep' and backend_type='client backend'");
  db("select pg_terminate_backend(pid) from pg_stat_activity where wait_event='PgSleep' and backend_type='client backend'");
  assert.notEqual(await interruptedExit, 0);
  assertMigrationHistory(ledger(), MIGRATION44_BOUNDARY);
  assert.equal(schema(), beforeDisconnect);
  cases.connectionFailureBeforeCommit = { result: "PASS", exact44Ledger: true, completeApplicationSchemaUnchanged: true, blindRetryAllowed: false };
  clearTrigger();

  process.stdout.write("Testing count-only counterexamples and cooperative lock limits.\n");
  // Count-only consistency counterexamples on synthetic application/Auth state.
  db("create schema qualification; create table qualification.application(id int primary key,value text); create table qualification.durable_auth(id int primary key,value text); insert into qualification.application values(1,'before'); insert into qualification.durable_auth values(1,'before')");
  const count = () => db("select count(*) from qualification.application");
  const baselineCount = count();
  db("update qualification.application set value='after' where id=1");
  assert.equal(count(), baselineCount);
  assert.equal(db("select value from qualification.application"), "after");
  cases.inPlaceUpdate = { result: "COUNTEREXAMPLE_CONFIRMED", countCheckWouldAccept: true, coherenceProven: false };
  db("begin; delete from qualification.application; insert into qualification.application values(2,'replacement'); commit");
  assert.equal(count(), baselineCount);
  assert.equal(db("select id from qualification.application"), "2");
  cases.balancedDeleteInsert = { result: "COUNTEREXAMPLE_CONFIRMED", countCheckWouldAccept: true, coherenceProven: false };
  db("insert into auth.users(id) values ('99000000-0000-4000-8000-000000000001'); update auth.users set raw_app_meta_data='{\"synthetic_capture_probe\":true}'::jsonb where id='99000000-0000-4000-8000-000000000001'");
  assert.equal(db("select count(*) from auth.users"), "1");
  assert.equal(db("select raw_app_meta_data->>'synthetic_capture_probe' from auth.users"), "true");
  db("alter table public.profiles add column nutrition002a_schema_probe integer");
  assert.equal(db("select count(*) from information_schema.columns where table_schema='public' and table_name='profiles' and column_name='nutrition002a_schema_probe'"), "1");
  assert.equal(count(), baselineCount);
  db("alter table public.profiles drop column nutrition002a_schema_probe; delete from auth.users where id='99000000-0000-4000-8000-000000000001'");
  cases.authAndSchemaChanges = { result: "COUNTEREXAMPLE_CONFIRMED", countCheckWouldAccept: true, coherenceProven: false, scope: "actual disposable Auth row UPDATE and application DDL; not an integrated capture test" };
  // Cooperating administrative classes share a session lock; unrelated writes pass.
  const coordinator = background("set application_name='nutrition002a_coordinator'; select pg_advisory_lock(11002,45); select pg_sleep(60)");
  try {
    await waitFor("select count(*) from pg_stat_activity where application_name='nutrition002a_coordinator' and wait_event='PgSleep'");
    for (const operation of ["backupBackup", "backupMigration"]) {
      assert.equal(db("select pg_try_advisory_lock(11002,45)"), "f");
      cases[operation] = { result: "LOCAL_COOPERATION_ONLY", cooperatingSessionExcluded: true, productionIntegration: "UNIMPLEMENTED" };
    }
    db("update qualification.durable_auth set value='unrelated-writer'");
    assert.equal(db("select value from qualification.durable_auth"), "unrelated-writer");
    cases.advisoryDoesNotExcludeWriters = { result: "PASS", writeExclusion: false };
    db("select pg_terminate_backend(pid) from pg_stat_activity where application_name='nutrition002a_coordinator'");
    await waitFor("select pg_try_advisory_lock(11002,45)", "t");
    cases.coordinationLoss = { result: "CONTROL_UNIMPLEMENTED", lockAutomaticallyReleased: true, continuedCaptureMustBeRejected: true, productionLossMonitor: "UNIMPLEMENTED_CAPTURE_BLOCKED" };
  } finally { coordinator.kill(); }
  db("drop schema qualification cascade");
  process.stdout.write("Applying only the exact approved45 once.\n");
  const success = migration();
  assert.equal(success.status, 0);
  assertMigrationHistory(ledger(), MIGRATION45_BOUNDARY);
  const selected = [...success.stderr.matchAll(/Applying migration (\S+)\.\.\./g)].map(match => match[1]);
  assert.deepEqual(selected, [MIGRATION_INVENTORY.at(-1).filename]);
  cases.successfulOneTimeTransition = { result: "PASS", selected, elapsedMs: success.elapsedMs, exact45Ledger: true, migrationChecksum: MIGRATION_INVENTORY.at(-1).sha256 };
  // Lost successful acknowledgement is indistinguishable from failure to a caller:
  // model that by discarding stdout/status, then inspect authoritative state once.
  cases.ambiguousCompletionReadback = { result: "MODEL_ONLY_BLOCKED_FOR_EXECUTION", modeledLostAcknowledgement: true, exact45Ledger: true, decision: "ALREADY_APPLIED_VERIFY_SCHEMA_NO_RETRY", actualPostCommitNetworkFault: "NOT_INJECTED" };
  const again = migration();
  assert.equal(again.status, 0);
  assert.doesNotMatch(again.stderr, /Applying migration/);
  assertMigrationHistory(ledger());
  cases.noDuplicateLedgerOnSecondSelection = { result: "PASS", additionalMigrationsApplied: 0 };
  const report = { task: "NUTRITION-DIARY-CORRECTNESS-002A", startedAt, completedAt: new Date().toISOString(), sourceCommit,
    runtime: { node: process.version, platform: process.platform, arch: process.arch },
    toolingSha256: sha256(readFileSync(new URL(import.meta.url))), cli: "2.116.0", postgres: db("show server_version"),
    scope: "DISPOSABLE_LOCAL_ONLY", cases, productionExecutorShipped: false, productionAccess: false,
    remainingBlockers: ["consistentCaptureAndWriterExclusion", "integratedFailClosedCoordination", "actualPostCommitAmbiguousNetworkFault", "hostedSessionTimeoutAndTransportAcceptance"] };
  assertRedactedEvidence(report);
  writeFileSync(join(root, "report.json"), JSON.stringify(report, null, 2));
} finally {
  const stopped = started ? run(cli, ["stop", "--project-id", project, "--no-backup"], { allowFailure: true }) : { status: 0 };
  const report = existsSync(join(root, "report.json")) ? readFileSync(join(root, "report.json")) : null;
  rmSync(root, { recursive: true, force: true });
  assert.equal(existsSync(root), false);
  if (stopped.status !== 0) throw new Error("Executor local cleanup failed; evidence withheld.");
  if (report) writeFileSync(output, report, { mode: 0o600, flag: "wx" });
}
process.stdout.write("Pinned executor and consistency findings recorded; no Production readiness claimed.\n");
