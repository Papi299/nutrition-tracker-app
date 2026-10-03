import assert from "node:assert/strict";
import test from "node:test";
import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { captureBackup } from "./phase-11i-backup-pipeline.mjs";
import { createLinkedSourceTransport } from "./phase-11i-cli-transport.mjs";
import { assertRedactedEvidence, sha256 } from "./phase-11i-recovery-contract.mjs";
import { assertNewBackupPublicVerification } from "./phase-11i-public-verification.mjs";
import { readPsqlRows } from "./phase-11i-psql-diagnostics.mjs";

// These passwords and all returned database rows are synthetic; no provider is called.
const firstCredential = "synthetic-before-dumps";
const secondCredential = "synthetic-after-dumps";
const approved = {
  PGHOST: "aws-0-eu-west-1.pooler.supabase.com", PGPORT: "5432",
  PGUSER: "cli_login_postgres.hskfanrqwtqknzpquwhg", PGDATABASE: "postgres",
};
const migrations = readdirSync("supabase/migrations").filter((name) => name.endsWith(".sql"))
  .sort().map((name) => [name.split("_")[0]]);
const dumpLabels = ["DUMP_ROLES", "DUMP_APPLICATION_SCHEMA", "DUMP_APPLICATION_DATA", "DUMP_DURABLE_AUTH"];
const expectedOrder = [
  "ACQUIRE_INITIAL", "MIGRATION_LEDGER", "APPLICATION_TABLE_INVENTORY",
  "PRE_DUMP_TABLE_COUNTS", "OWNER_VALIDATION", "OWNER_ACTIVATION", "STORAGE_SCOPE",
  "VAULT_INVENTORY", "RLS_VALIDATION", "GRANT_VALIDATION", "SECURITY_DEFINER_VALIDATION",
  "AUTH_TABLE_INVENTORY", ...dumpLabels, "REFRESH_TRANSPORT",
  "POST_DUMP_TABLE_COUNTS", "POST_DUMP_OWNER_VALIDATION", "POST_DUMP_OWNER_ACTIVATION",
];
function fixtureRows(sql, stage) {
  if (stage === "MIGRATION_LEDGER") return migrations;
  if (stage === "APPLICATION_TABLE_INVENTORY") return [["public", "foods"]];
  if (stage.endsWith("TABLE_COUNTS")) return [["public.foods", "1"]];
  if (stage.endsWith("OWNER_ACTIVATION")) return [["1", "1"]];
  if (stage.endsWith("OWNER_VALIDATION")) {
    if (sql.includes("select 'users',count(*)")) return Object.entries({
      users: 1, identities: 1, sessions: 2, refreshTokens: 2,
      mfaFactors: 0, webauthnCredentials: 0,
    }).map(([key, count]) => [key, String(count)]);
    if (sql.includes("select count(*) from auth.users where deleted_at")) return [["1"]];
    if (sql.includes("from pg_constraint")) return [];
    return [["0"]];
  }
  if (stage === "STORAGE_SCOPE") return [["0", "0"]];
  if (stage === "VAULT_INVENTORY") return [["account_closure_capability_v1"]];
  if (stage === "AUTH_TABLE_INVENTORY") return [
    "identities", "mfa_factors", "users", "webauthn_credentials", "sessions", "refresh_tokens",
  ].sort().map((name) => [name]);
  if (["RLS_VALIDATION", "GRANT_VALIDATION", "SECURITY_DEFINER_VALIDATION"].includes(stage)) return [];
  assert.fail("Unexpected query stage.");
}
function harness(config = {}) {
  const root = mkdtempSync(join(tmpdir(), "phase11i-transport-test-"));
  const events = [];
  const reads = [];
  const dumpArguments = [];
  let acquisitions = 0;
  const record = (event) => { if (events.at(-1) !== event) events.push(event); };
  const runSupabase = (args) => {
    if (args.includes("--dry-run")) {
      assert.deepEqual(args, ["db", "dump", "--linked", "--dry-run"]);
      acquisitions++;
      assert.ok(acquisitions <= 2, "Transport acquisition must not retry.");
      record(acquisitions === 1 ? "ACQUIRE_INITIAL" : "REFRESH_TRANSPORT");
      if (acquisitions === 2) {
        assert.equal(dumpArguments.length, 4, "Refresh must follow all four dumps.");
        if (config.refreshFailure) throw new Error("Synthetic transport refresh failed.");
      }
      const linked = { ...approved, PGPASSWORD: acquisitions === 1 ? firstCredential : secondCredential,
        ...(acquisitions === 1 ? config.initialOverride : config.refreshOverride) };
      return Object.entries(linked).filter(([, value]) => value !== undefined)
        .map(([name, value]) => 'export ' + name + '="' + value + '"').join("\n");
    }
    if (args[0] === "--version") return "2.116.0";
    assert.deepEqual(args.slice(0, 2), ["db", "dump"]);
    dumpArguments.push(args);
    record(dumpLabels[dumpArguments.length - 1]);
    if (config.failedDump === dumpArguments.length) throw new Error("Synthetic dump failed.");
    writeFileSync(args[args.indexOf("--file") + 1], "-- synthetic dump\n");
    return "";
  };
  const readRows = ({ psqlBinary, sql, environment, stage }) => {
    record(stage);
    reads.push({ stage, environment });
    assert.equal(environment.PGSSLMODE, "require");
    assert.equal(environment.PGCONNECT_TIMEOUT, "20");
    assert.equal(environment.SYNTHETIC_SETTING, "retained");
    assert.equal(environment.PGPASSWORD, stage.startsWith("POST_DUMP_") ? secondCredential : firstCredential,
      "Every post-dump query must use the replaced credential.");
    return readPsqlRows({ psqlBinary, sql, environment, stage, spawn: () => {
      if (config.failedStage === stage) return { status: 2,
        stderr: 'psql: error: connection to server at "synthetic-host", port 5432 failed: FATAL: password authentication failed for user "' + environment.PGPASSWORD + '"' };
      return { status: 0, stdout: fixtureRows(sql, stage).map((row) => row.join("\t")).join("\n") };
    } });
  };
  const options = {
    sourceIdentity: { projectRef: "SYNTHETIC_TRANSPORT_FIXTURE", sourceEnvironment: "LocalSynthetic" },
    assertSourceIdentity: () => {}, assertArtifactIdentity: () => {}, assertRecipient: () => {},
    backupRootInput: root, recipientInput: join(process.cwd(), "ops/recovery/phase-11i-recipient.pem"),
    operator: "Local synthetic transport test",
    project: { id: "SYNTHETIC_TRANSPORT_FIXTURE", status: "ACTIVE_HEALTHY" }, authConfig: {},
    psqlBinary: process.execPath, runSupabase,
  };
  return {
    root, events, reads, dumpArguments, options,
    get acquisitions() { return acquisitions; },
    acquire() {
      Object.assign(options, createLinkedSourceTransport({
        runSupabase, psqlBinary: process.execPath, readRows,
        environment: { SYNTHETIC_SETTING: "retained", PGSSLMODE: "disable", PGPASSWORD: "synthetic-ambient" },
      }));
    },
    cleanup() { rmSync(root, { recursive: true, force: true }); },
  };
}
function assertNoOutput(h) { assert.deepEqual(readdirSync(h.root), []); }

test("normal capture acquires twice, refreshes after dump 4, and all post-dump reads use the second credential", async () => {
  const h = harness();
  try {
    h.acquire();
    assert.deepEqual(h.events, ["ACQUIRE_INITIAL"]);
    const result = await captureBackup(h.options);
    assert.deepEqual(h.events, expectedOrder);
    assert.equal(h.acquisitions, 2);
    assert.equal(h.dumpArguments.length, 4);
    assert.ok(h.dumpArguments[0].includes("--role-only"));
    assert.deepEqual(h.dumpArguments.slice(1).map((args) => args[args.indexOf("--schema") + 1]),
      ["public,ingestion", "public,ingestion", "auth"]);
    assert.ok(h.dumpArguments[2].includes("--data-only"));
    assert.ok(h.dumpArguments[3].includes("--data-only"));
    assert.equal(h.dumpArguments[3][h.dumpArguments[3].indexOf("--exclude") + 1], "auth.refresh_tokens,auth.sessions");
    const before = h.reads.filter(({ stage }) => !stage.startsWith("POST_DUMP_"));
    const after = h.reads.filter(({ stage }) => stage.startsWith("POST_DUMP_"));
    assert.ok(before.length && after.length);
    assert.ok(before.every(({ environment }) => environment === before[0].environment));
    assert.ok(after.every(({ environment }) => environment === after[0].environment));
    assert.notEqual(before[0].environment, after[0].environment);
    assert.equal(before[0].environment.PGPASSWORD, firstCredential, "Original options remain unmodified.");
    assert.equal(after[0].environment.PGPASSWORD, secondCredential);
    assert.equal(result.status, "BACKUP_COMPLETE");
    assert.equal(readdirSync(h.root).length, 2);
    const manifest = JSON.parse(readFileSync(result.manifestPath, "utf8"));
    assertNewBackupPublicVerification(manifest);
    assertRedactedEvidence(manifest);
    assert.equal(sha256(readFileSync(result.archivePath)), manifest.encryptedArchiveSha256);
    assert.equal(manifest.plaintextTemporaryRemoved, true);
    assert.equal(manifest.publicVerificationSummary.sourceCaptureConsistency, "PASS");
  } finally { h.cleanup(); }
});

test("pipeline awaits an asynchronous phase refresh before the first post-dump query", async () => {
  const h = harness();
  try {
    h.acquire();
    const refresh = h.options.refreshSourceTransport;
    h.options.refreshSourceTransport = async () => { await Promise.resolve(); refresh(); };
    await captureBackup(h.options);
    assert.deepEqual(h.events, expectedOrder);
    assert.equal(h.acquisitions, 2);
  } finally { h.cleanup(); }
});

test("refresh command failure stops before post-dump reads without retry or durable output", async () => {
  const h = harness({ refreshFailure: true });
  try {
    h.acquire();
    await assert.rejects(captureBackup(h.options), /Synthetic transport refresh failed/);
    assert.equal(h.acquisitions, 2);
    assert.equal(h.dumpArguments.length, 4);
    assert.ok(h.reads.every(({ stage }) => !stage.startsWith("POST_DUMP_")));
    assert.equal(h.events.at(-1), "REFRESH_TRANSPORT");
    assertNoOutput(h);
  } finally { h.cleanup(); }
});

for (const field of Object.keys(approved)) {
  test("refreshed " + field + " must pass the existing exact Production transport guard", async () => {
    const h = harness({ refreshOverride: { [field]: "wrong-synthetic-target" } });
    try {
      h.acquire();
      await assert.rejects(captureBackup(h.options), /approved Production project/);
      assert.equal(h.acquisitions, 2);
      assert.equal(h.dumpArguments.length, 4);
      assert.ok(h.reads.every(({ stage }) => !stage.startsWith("POST_DUMP_")));
      assertNoOutput(h);
    } finally { h.cleanup(); }
  });
}
for (const field of [...Object.keys(approved), "PGPASSWORD"]) {
  test("missing refreshed " + field + " fails closed without refresh retry", async () => {
    const h = harness({ refreshOverride: { [field]: undefined } });
    try {
      h.acquire();
      await assert.rejects(captureBackup(h.options), new RegExp("Linked transport omitted " + field));
      assert.equal(h.acquisitions, 2);
      assert.ok(h.reads.every(({ stage }) => !stage.startsWith("POST_DUMP_")));
      assertNoOutput(h);
    } finally { h.cleanup(); }
  });
}
test("initial acquisition validates the approved transport before any query or dump", () => {
  const h = harness({ initialOverride: { PGUSER: "wrong-synthetic-user" } });
  try {
    assert.throws(() => h.acquire(), /approved Production project/);
    assert.equal(h.acquisitions, 1);
    assert.equal(h.reads.length, 0);
    assert.equal(h.dumpArguments.length, 0);
    assertNoOutput(h);
  } finally { h.cleanup(); }
});

for (const stage of ["POST_DUMP_TABLE_COUNTS", "POST_DUMP_OWNER_VALIDATION", "POST_DUMP_OWNER_ACTIVATION"]) {
  test(stage + " failure retains sanitized diagnostics and never retries query or transport", async () => {
    const h = harness({ failedStage: stage });
    try {
      h.acquire();
      await assert.rejects(captureBackup(h.options), (error) => {
        assert.match(error.message, new RegExp("^psql failed at " + stage + " \\(exit 2\\):"));
        assert.match(error.message, /FATAL: password authentication failed for user \[REDACTED\]/);
        assert.doesNotMatch(error.message, /synthetic-|select |PGPASSWORD|postgresql:\/\//);
        assertRedactedEvidence(error.message);
        return true;
      });
      assert.equal(h.reads.filter((read) => read.stage === stage).length, 1);
      assert.equal(h.acquisitions, 2);
      assert.equal(h.dumpArguments.length, 4);
      assertNoOutput(h);
    } finally { h.cleanup(); }
  });
}
for (const dump of [1, 2, 3, 4]) {
  test("dump " + dump + " failure never reaches the transport refresh", async () => {
    const h = harness({ failedDump: dump });
    try {
      h.acquire();
      await assert.rejects(captureBackup(h.options), /Synthetic dump failed/);
      assert.equal(h.acquisitions, 1);
      assert.equal(h.dumpArguments.length, dump);
      assert.ok(!h.events.includes("REFRESH_TRANSPORT"));
      assertNoOutput(h);
    } finally { h.cleanup(); }
  });
}
test("shared pipeline requires an explicit refresh callback", async () => {
  const h = harness();
  try {
    h.acquire();
    delete h.options.refreshSourceTransport;
    await assert.rejects(captureBackup(h.options), /Source transport refresh callback is required/);
    assert.equal(h.reads.length, 0);
    assert.equal(h.dumpArguments.length, 0);
    assertNoOutput(h);
  } finally { h.cleanup(); }
});
