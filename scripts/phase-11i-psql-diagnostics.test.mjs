import assert from "node:assert/strict";
import test from "node:test";
import { mkdtempSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { captureBackup } from "./phase-11i-backup-pipeline.mjs";
import { assertRedactedEvidence } from "./phase-11i-recovery-contract.mjs";
import { MAX_PSQL_DIAGNOSTIC_CHARACTERS, PSQL_QUERY_STAGES, readPsqlRows, sanitizePsqlDiagnostic } from "./phase-11i-psql-diagnostics.mjs";

// Every credential/PII-shaped value in these fixtures is synthetic.
const stage = "POST_DUMP_TABLE_COUNTS";
const sql = "select 'synthetic-query-value', count(*) from synthetic_table;";
function failure(stderr, extra = {}) {
  let calls = 0;
  let error;
  try {
    readPsqlRows({ psqlBinary: "psql", sql, environment: {}, stage,
      spawn: () => { calls++; return { status: 2, stdout: "synthetic-row-value", stderr }; }, ...extra });
  } catch (caught) { error = caught; }
  assert.ok(error instanceof Error);
  assert.equal(calls, 1, "A failed query must never be retried.");
  assert.doesNotMatch(error.message, /synthetic-query-value|synthetic-row-value|select |synthetic_table/i);
  assertRedactedEvidence(error.message);
  return error.message;
}

test("successful command keeps arguments, SQL, environment, timeout and row parsing", () => {
  const environment = { SYNTHETIC_SETTING: "unchanged" };
  let calls = 0;
  const rows = readPsqlRows({ psqlBinary: "/synthetic/psql", sql, environment, stage,
    spawn: (binary, args, options) => {
      calls++;
      assert.equal(binary, "/synthetic/psql");
      assert.deepEqual(args, ["-X", "-v", "ON_ERROR_STOP=1", "-q", "-A", "-t", "-F", "\t"]);
      assert.deepEqual(options, { encoding: "utf8", maxBuffer: 128 * 1024 * 1024,
        timeout: 15 * 60 * 1_000, input: `set role postgres; ${sql}`, env: environment });
      return { status: 0, stdout: "table-a\t1\r\ntable-b\t0\n", stderr: "ignored successful stderr" };
    }, sanitize: () => { throw new Error("Must not sanitize success."); } });
  assert.equal(calls, 1);
  assert.deepEqual(rows, [["table-a", "1"], ["table-b", "0"]]);
});
test("empty successful stdout retains empty rows", () => {
  assert.deepEqual(readPsqlRows({ psqlBinary: "psql", sql, environment: {}, stage,
    spawn: () => ({ status: 0, stdout: "\n" }) }), []);
});
test("safe PostgreSQL error text is preserved", () => {
  assert.match(failure("ERROR: server closed the connection unexpectedly"), /ERROR: server closed the connection unexpectedly/);
});
test("connection diagnostics retain error category without host or client identity", () => {
  const output = failure('psql: error: connection to server at "synthetic-host", port 5432 failed: FATAL: password authentication failed for user "synthetic-user"');
  assert.match(output, /connection to server at \[REDACTED\], port 5432 failed: FATAL: password authentication failed/);
  assert.doesNotMatch(output, /synthetic-host|synthetic-user/);
});
for (const [label, value] of [
  ["PostgreSQL URI", "postgresql://synthetic-user:synthetic-password@synthetic-host/synthetic-db"],
  ["Postgres URI alias", "postgres://synthetic-user:synthetic-password@synthetic-host/synthetic-db"],
  ["quoted password", '"synthetic-unlabeled-password"'],
  ["password assignment", "password=synthetic-password"],
  ["PGPASSWORD assignment", "PGPASSWORD=synthetic-password"],
  ["SUPABASE_ACCESS_TOKEN assignment", "SUPABASE_ACCESS_TOKEN=synthetic-access-value"],
  ["Authorization Bearer", "Authorization: Bearer synthetic-bearer-value"],
  ["Bearer token", "Bearer synthetic-bearer-value"],
  ["Supabase access token", "sbp_synthetic_token_abcdefghijklmnopqrstuvwxyz"],
  ["JWT-like value", "eyJsyntheticHeader0123456789.eyJsyntheticPayload0123456789.syntheticSignature0123456789"],
  ["email PII", "synthetic-owner@example.invalid"],
  ["owner UUID", "12345678-1234-1234-1234-123456789abc"],
  ["complete private key", "-----BEGIN PRIVATE KEY-----\nsynthetic-key-material\n-----END PRIVATE KEY-----"],
  ["incomplete RSA private key", "-----BEGIN RSA PRIVATE KEY-----\nsynthetic-key-material"],
]) {
  test(`${label} is redacted or suppressed`, () => {
    const output = failure(`FATAL: password authentication failed for user ${value}`);
    assert.ok(!output.includes(value));
    assert.doesNotMatch(output, /synthetic-|PRIVATE KEY|sbp_|eyJ|postgres(?:ql)?:\/\//);
  });
}
test("actual supplied runtime password and access-token fixtures are explicitly replaced", () => {
  for (const key of ["PGPASSWORD", "SUPABASE_ACCESS_TOKEN"]) {
    const value = `synthetic-${key}-runtime-value`;
    const output = failure(`FATAL: password authentication failed for user ${value}`, { environment: { [key]: value } });
    assert.match(output, /user \[REDACTED\]/);
    assert.ok(!output.includes(value));
  }
});
test("connection IP/address details are redacted", () => {
  const output = failure('psql: error: connection to server at "synthetic-host" (192.0.2.10), port 5432 failed: Connection refused');
  assert.match(output, /Connection refused/);
  assert.doesNotMatch(output, /192\.0\.2\.10|synthetic-host/);
});
test("overlapping sensitive values are redacted longest first", () => {
  assert.equal(sanitizePsqlDiagnostic("FATAL: password authentication failed for user synthetic-long-secret", ["synthetic", "synthetic-long-secret"]), "FATAL: password authentication failed for user [REDACTED]");
});
test("SQL echoes, DETAIL, HINT, CONTEXT and database rows never escape", () => {
  const output = failure(`ERROR: server closed the connection unexpectedly\nLINE 1: ${sql}\nDETAIL: Key (email)=(synthetic-owner@example.invalid) already exists.\nHINT: synthetic-private-hint\nCONTEXT: SQL statement '${sql}'\nsynthetic-row-value\nPGPASSWORD=synthetic-environment-value`);
  assert.match(output, /server closed the connection unexpectedly/);
  assert.doesNotMatch(output, /LINE|DETAIL|HINT|CONTEXT|synthetic-|PGPASSWORD/);
});
test("SQL fragments embedded in primary errors are replaced", () => {
  const output = failure(`ERROR: syntax error at or near "${sql}"`);
  assert.match(output, /syntax error at or near \[REDACTED\]/);
});
test("unknown SQL/row-shaped primary error fails closed", () => {
  assert.match(failure("ERROR: synthetic-row-value 70.5 height 180 select secret"), /diagnostic suppressed by redaction guard/);
});
test("unrecognized diagnostic never escapes beside a recognized message", () => {
  const output = failure("ERROR: server closed the connection unexpectedly\nERROR: synthetic-private-row-detail");
  assert.doesNotMatch(output, /synthetic-private-row-detail/);
});
test("diagnostic and complete failure message are bounded", () => {
  const stderr = "ERROR: server closed the connection unexpectedly\n".repeat(200);
  assert.equal(sanitizePsqlDiagnostic(stderr).length, MAX_PSQL_DIAGNOSTIC_CHARACTERS);
  assert.equal(failure(stderr).length, MAX_PSQL_DIAGNOSTIC_CHARACTERS);
});
test("stable stage and exit status appear", () => {
  assert.match(failure("ERROR: server closed the connection unexpectedly"), /^psql failed at POST_DUMP_TABLE_COUNTS \(exit 2\):/);
});
test("unknown stage input cannot leak SQL, owner details or secrets", () => {
  assert.match(failure("ERROR: server closed the connection unexpectedly", { stage: sql }), /QUERY_STAGE_UNAVAILABLE/);
});
for (const stderr of ["", " \n\t "]) {
  test(`missing stderr (${JSON.stringify(stderr)}) uses safe fallback`, () => {
    assert.equal(failure(stderr), "psql failed at POST_DUMP_TABLE_COUNTS (exit 2); no stderr was returned.");
  });
}
test("malformed stderr is suppressed", () => assert.match(failure({ unsafe: "synthetic-private-value" }), /diagnostic suppressed/));
test("throwing sanitizer uses generic suppression fallback", () => {
  assert.match(failure("ERROR: server closed the connection unexpectedly", { sanitize: () => { throw new Error("synthetic-secret-error"); } }), /diagnostic suppressed/);
});
test("repository redaction guard rejects unsafe sanitizer output before truncation", () => {
  const output = failure("unused", { sanitize: () => "safe ".repeat(500) + "synthetic-owner@example.invalid" });
  assert.match(output, /diagnostic suppressed by redaction guard/);
  assert.doesNotMatch(output, /safe |example.invalid/);
});
test("spawn errors cannot expose command/environment properties", () => {
  assert.throws(() => readPsqlRows({ psqlBinary: "psql", sql, environment: {}, stage,
    spawn: () => { throw new Error("synthetic-secret-launch-error"); } }),
  (error) => error.message === "psql failed at POST_DUMP_TABLE_COUNTS (exit unavailable); diagnostic suppressed by redaction guard.");
});

const migrations = readdirSync("supabase/migrations").filter((name) => name.endsWith(".sql"))
  .sort().map((name) => [name.split("_")[0]]);
const durableAuth = ["identities", "mfa_factors", "users", "webauthn_credentials"];
for (const failedStage of PSQL_QUERY_STAGES) {
  test(`capture labels ${failedStage} and aborts without retry or durable output`, async () => {
    const root = mkdtempSync(join(tmpdir(), "phase11i-diagnostic-test-"));
    const stages = [];
    let dumps = 0;
    const rows = (query, queryStage) => {
      stages.push(queryStage);
      if (queryStage === failedStage) return readPsqlRows({ psqlBinary: "synthetic-psql", sql: query,
        environment: {}, stage: queryStage, spawn: () => ({ status: 2, stderr: "ERROR: server closed the connection unexpectedly" }) });
      if (queryStage === "MIGRATION_LEDGER") return migrations;
      if (queryStage === "APPLICATION_TABLE_INVENTORY") return [["public", "foods"]];
      if (queryStage.endsWith("TABLE_COUNTS")) return [["public.foods", "1"]];
      if (queryStage.endsWith("OWNER_ACTIVATION")) return [["1", "1"]];
      if (queryStage.endsWith("OWNER_VALIDATION")) {
        if (query.includes("select 'users',count(*)")) return Object.entries({ users: 1, identities: 1,
          sessions: 0, refreshTokens: 0, mfaFactors: 0, webauthnCredentials: 0 }).map(([key, count]) => [key, String(count)]);
        if (query.includes("select count(*) from auth.users where deleted_at")) return [["1"]];
        if (query.includes("from pg_constraint")) return [];
        return [["0"]];
      }
      if (queryStage === "STORAGE_SCOPE") return [["0", "0"]];
      if (queryStage === "VAULT_INVENTORY") return [["account_closure_capability_v1"]];
      if (queryStage === "AUTH_TABLE_INVENTORY") return durableAuth.map((name) => [name]);
      if (["RLS_VALIDATION", "GRANT_VALIDATION", "SECURITY_DEFINER_VALIDATION"].includes(queryStage)) return [];
      assert.fail("Unexpected unlabeled query.");
    };
    try {
      await assert.rejects(captureBackup({
        sourceIdentity: { projectRef: "SYNTHETIC_DIAGNOSTIC_FIXTURE", sourceEnvironment: "LocalSynthetic" },
        assertSourceIdentity: () => {}, assertArtifactIdentity: () => {}, assertRecipient: () => {},
        backupRootInput: root, recipientInput: join(process.cwd(), "ops/recovery/phase-11i-recipient.pem"),
        operator: "Local synthetic diagnostic test", project: { id: "SYNTHETIC_DIAGNOSTIC_FIXTURE", status: "ACTIVE_HEALTHY" },
        authConfig: {}, rows, psqlBinary: "synthetic-psql",
        runSupabase: (args) => { dumps++; writeFileSync(args[args.indexOf("--file") + 1], "-- synthetic dump\n"); },
      }), (error) => {
        assert.match(error.message, new RegExp(`^psql failed at ${failedStage} \\(exit 2\\)`));
        assertRedactedEvidence(error.message);
        return true;
      });
      assert.equal(stages.filter((value) => value === failedStage).length, 1);
      assert.equal(dumps, failedStage.startsWith("POST_DUMP_") ? 4 : 0);
      assert.deepEqual(readdirSync(root), []);
    } finally { rmSync(root, { recursive: true, force: true }); }
  });
}

