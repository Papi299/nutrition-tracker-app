import assert from "node:assert/strict";
import test from "node:test";
import { mkdtempSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { captureBackup } from "./phase-11i-backup-pipeline.mjs";
import { assertRedactedEvidence } from "./phase-11i-recovery-contract.mjs";
import { MAX_PSQL_DIAGNOSTIC_CHARACTERS, PSQL_FAILURE_CATEGORIES, PSQL_QUERY_STAGES, readPsqlRows, sanitizePsqlDiagnostic } from "./phase-11i-psql-diagnostics.mjs";

// Every credential/PII-shaped value in these fixtures is synthetic.
const stage = "POST_DUMP_TABLE_COUNTS";
const sql = "select 'synthetic-query-value', count(*) from synthetic_table;";
function failureError(stderr, extra = {}) {
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
  assert.ok(PSQL_FAILURE_CATEGORIES.includes(error.category));
  assert.equal(error.cause, undefined, "Never retain a secret-bearing process error.");
  return error;
}
const failure = (stderr, extra) => failureError(stderr, extra).message;

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
test("recognized PostgreSQL errors emit only category and diagnostic state", () => {
  assert.match(failure("ERROR: server closed the connection unexpectedly"), /category=CONNECTION_TERMINATED; diagnostic=SAFE_MESSAGE_RECOGNIZED/);
  assert.doesNotMatch(failure("ERROR: server closed the connection unexpectedly"), /server closed/);
});
test("connection diagnostics retain error category without host or client identity", () => {
  const output = failure('psql: error: connection to server at "synthetic-host", port 5432 failed: FATAL: password authentication failed for user "synthetic-user"');
  assert.match(output, /category=AUTHENTICATION_FAILURE; diagnostic=SAFE_MESSAGE_RECOGNIZED/);
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
    assert.match(output, /category=AUTHENTICATION_FAILURE/);
    assert.ok(!output.includes(value));
  }
});
test("connection IP/address details are redacted", () => {
  const output = failure('psql: error: connection to server at "synthetic-host" (192.0.2.10), port 5432 failed: Connection refused');
  assert.match(output, /category=CONNECTION_ESTABLISHMENT_FAILURE/);
  assert.doesNotMatch(output, /192\.0\.2\.10|synthetic-host/);
});
test("overlapping sensitive values are redacted longest first", () => {
  assert.equal(sanitizePsqlDiagnostic("FATAL: password authentication failed for user synthetic-long-secret", ["synthetic", "synthetic-long-secret"]), "FATAL: password authentication failed for user [REDACTED]");
});
test("SQL echoes, DETAIL, HINT, CONTEXT and database rows never escape", () => {
  const output = failure(`ERROR: server closed the connection unexpectedly\nLINE 1: ${sql}\nDETAIL: Key (email)=(synthetic-owner@example.invalid) already exists.\nHINT: synthetic-private-hint\nCONTEXT: SQL statement '${sql}'\nsynthetic-row-value\nPGPASSWORD=synthetic-environment-value`);
  assert.match(output, /category=CONNECTION_TERMINATED/);
  assert.doesNotMatch(output, /LINE|DETAIL|HINT|CONTEXT|synthetic-|PGPASSWORD/);
});
test("SQL fragments embedded in primary errors are replaced", () => {
  const output = failure(`ERROR: syntax error at or near "${sql}"`);
  assert.match(output, /category=SQL_EXECUTION_FAILURE/);
});
test("unknown SQL/row-shaped primary error fails closed", () => {
  assert.match(failure("ERROR: synthetic-row-value 70.5 height 180 select secret"), /category=UNCLASSIFIED_FAILURE; diagnostic=UNRECOGNIZED_DIAGNOSTIC/);
});
test("unrecognized diagnostics are distinct from actual guard rejection", () => {
  let guardCalls = 0;
  const unknown = failureError("ERROR: synthetic-unrecognized-provider-response", { guard: () => { guardCalls++; } });
  assert.equal(unknown.diagnosticState, "UNRECOGNIZED_DIAGNOSTIC");
  assert.equal(guardCalls, 0);
  const rejected = failureError("ERROR: server closed the connection unexpectedly", {
    guard: () => { guardCalls++; throw new Error("synthetic-sensitive-rejection-reason"); },
  });
  assert.equal(guardCalls, 1);
  assert.equal(rejected.category, "UNCLASSIFIED_FAILURE");
  assert.equal(rejected.diagnosticState, "REDACTION_GUARD_REJECTED");
  assert.doesNotMatch(rejected.stack, /synthetic-sensitive-rejection-reason/);
});
test("unrecognized diagnostic never escapes beside a recognized message", () => {
  const error = failureError("ERROR: server closed the connection unexpectedly\nERROR: synthetic-private-row-detail");
  assert.equal(error.category, "UNCLASSIFIED_FAILURE");
  assert.equal(error.diagnosticState, "UNRECOGNIZED_DIAGNOSTIC");
  assert.doesNotMatch(error.stack, /synthetic-private-row-detail/);
});

const authQueryTimeout = "(EAUTHQUERY) auth_query secret check timed out";
for (const message of [
  "auth_query secret check timed out", authQueryTimeout,
  `ERROR: ${authQueryTimeout}`, `FATAL: ${authQueryTimeout}`, `PANIC: ${authQueryTimeout}`,
  `psql: error: ${authQueryTimeout}`,
  `psql: error: FATAL: ${authQueryTimeout}`,
  `psql:synthetic-file.sql:42: ERROR: ${authQueryTimeout}`,
  `psql: error: connection to server at "synthetic-host", port 5432 failed: FATAL: ${authQueryTimeout}`,
  `psql: error: connection to server at "synthetic-host" (192.0.2.10), port 5432 failed: FATAL: ${authQueryTimeout}`,
]) {
  test(`R1 exact auth-query template and standard wrapper: ${message.split(":")[0]}`, () => {
    const error = failureError(message);
    assert.equal(error.category, "AUTHENTICATION_FAILURE");
    assert.equal(error.diagnosticState, "SAFE_MESSAGE_RECOGNIZED");
    assert.doesNotMatch(error.stack, /EAUTHQUERY|auth_query|synthetic-file|synthetic-host|192\.0\.2\.10/);
  });
}
for (const message of [
  "(EUNKNOWN) auth_query secret check timed out",
  "(EAUTHQUERY_OTHER) auth_query secret check timed out",
  "(eauthquery) auth_query secret check timed out",
  "(EAUTHQUERY) auth_query secret check timed out synthetic-private-suffix",
  "(EAUTHQUERY) auth_query secret check timed out.",
  "(EAUTHQUERY) auth_query connection failed",
  "(EAUTHQUERY) server closed the connection unexpectedly",
]) {
  test("R1 unknown codes and altered provider messages fail closed", () => {
    const error = failureError(`FATAL: ${message}`);
    assert.equal(error.category, "UNCLASSIFIED_FAILURE");
    assert.equal(error.diagnosticState, "UNRECOGNIZED_DIAGNOSTIC");
    assert.doesNotMatch(error.stack, /EAUTHQUERY|EUNKNOWN|auth_query|synthetic-private-suffix/);
  });
}
for (const unknown of [
  "ERROR: synthetic-unknown-primary", "FATAL: synthetic-unknown-primary",
  "PANIC: synthetic-unknown-primary", "psql: error: synthetic-unknown-primary",
  "(EUNKNOWN) synthetic-unknown-primary", "(EAUTHQUERY) synthetic-altered-primary",
  "psql:synthetic-file.sql:42: ERROR: synthetic-unknown-primary",
  'psql: error: connection to server at "synthetic-host", port 5432 failed: FATAL: synthetic-unknown-primary',
]) {
  for (const unknownFirst of [false, true]) {
    test("R2 unknown primary vetoes recognized classification in either order", () => {
      const known = `FATAL: ${authQueryTimeout}`;
      const stderr = (unknownFirst ? [unknown, known] : [known, unknown]).join("\n");
      assert.equal(sanitizePsqlDiagnostic(stderr), null);
      const error = failureError(stderr);
      assert.equal(error.category, "UNCLASSIFIED_FAILURE");
      assert.equal(error.diagnosticState, "UNRECOGNIZED_DIAGNOSTIC");
      assert.doesNotMatch(error.stack, /synthetic-|EAUTHQUERY|auth_query/);
    });
  }
}
test("R2 unknown primary beyond the diagnostic bound still vetoes classification", () => {
  const error = failureError("ERROR: server closed the connection unexpectedly\n".repeat(200) + "ERROR: synthetic-unknown-at-end");
  assert.equal(error.category, "UNCLASSIFIED_FAILURE");
  assert.equal(error.diagnosticState, "UNRECOGNIZED_DIAGNOSTIC");
});
test("R2 masking an entire unknown primary cannot erase ambiguity", () => {
  const privatePrimary = "ERROR: synthetic-private-primary";
  const error = failureError(`FATAL: ${authQueryTimeout}\n${privatePrimary}`, { environment: { PGPASSWORD: privatePrimary } });
  assert.equal(error.category, "UNCLASSIFIED_FAILURE");
  assert.equal(error.diagnosticState, "UNRECOGNIZED_DIAGNOSTIC");
  assert.doesNotMatch(error.stack, /synthetic-private-primary/);
});
test("R2 ancillary labels, statement echoes and rows do not become unknown primaries", () => {
  const ancillary = [
    "DETAIL: ERROR: synthetic-private-detail", "HINT: FATAL: synthetic-private-hint",
    "CONTEXT: PANIC: synthetic-private-context", "STATEMENT: (EUNKNOWN) synthetic-private-sql",
    "QUERY: select 'ERROR: synthetic-private-query';", "LINE 1: ERROR: synthetic-private-line",
    "psql:synthetic-file.sql:42: CONTEXT: ERROR: synthetic-private-context",
    "select 'synthetic-unlabelled-statement';", "synthetic-private-row", "(ROW) synthetic-private-row", "       ^",
  ];
  const error = failureError([`FATAL: ${authQueryTimeout}`, ...ancillary].join("\r\n"));
  assert.equal(error.category, "AUTHENTICATION_FAILURE");
  assert.equal(error.diagnosticState, "SAFE_MESSAGE_RECOGNIZED");
  assert.doesNotMatch(error.stack, /synthetic-|select |DETAIL|HINT|CONTEXT|STATEMENT|QUERY|LINE 1/);
});
test("R2 mixed private primary data is absent from every error property and stack", () => {
  const credentials = { PGPASSWORD: "synthetic-runtime-password", SUPABASE_ACCESS_TOKEN: "synthetic-runtime-token" };
  const stderr = `FATAL: ${authQueryTimeout}\nERROR: synthetic-owner@example.invalid 12345678-1234-1234-1234-123456789abc select private_column PGPASSWORD=${credentials.PGPASSWORD} Authorization: Bearer ${credentials.SUPABASE_ACCESS_TOKEN}`;
  const error = failureError(stderr, { environment: credentials });
  assert.equal(error.category, "UNCLASSIFIED_FAILURE");
  assert.equal(error.diagnosticState, "UNRECOGNIZED_DIAGNOSTIC");
  assert.deepEqual(Object.getOwnPropertyNames(error).sort(), ["category", "diagnosticState", "message", "name", "stack"]);
  const emitted = Object.getOwnPropertyNames(error).map(key => String(error[key])).join("\n");
  assert.doesNotMatch(emitted, /synthetic-|example\.invalid|12345678|select |private_column|PGPASSWORD|Bearer|EAUTHQUERY|auth_query/);
  assert.equal(error.cause, undefined);
});
test("diagnostic and complete failure message are bounded", () => {
  const stderr = "ERROR: server closed the connection unexpectedly\n".repeat(200);
  assert.equal(sanitizePsqlDiagnostic(stderr).length, MAX_PSQL_DIAGNOSTIC_CHARACTERS);
  assert.ok(failure(stderr).length < MAX_PSQL_DIAGNOSTIC_CHARACTERS);
});
test("stable stage and exit status appear", () => {
  assert.match(failure("ERROR: server closed the connection unexpectedly"), /^psql failed at POST_DUMP_TABLE_COUNTS \(exit 2\);/);
});
test("unknown stage input cannot leak SQL, owner details or secrets", () => {
  assert.match(failure("ERROR: server closed the connection unexpectedly", { stage: sql }), /QUERY_STAGE_UNAVAILABLE/);
});
for (const stderr of [undefined, null, "", " \n\t "]) {
  test(`missing stderr (${JSON.stringify(stderr)}) uses safe fallback`, () => {
    assert.equal(failure(stderr), "psql failed at POST_DUMP_TABLE_COUNTS (exit 2); category=UNCLASSIFIED_FAILURE; diagnostic=NO_DIAGNOSTIC.");
  });
}
test("malformed stderr is unclassified without blaming the guard", () => assert.match(failure({ unsafe: "synthetic-private-value" }), /category=UNCLASSIFIED_FAILURE; diagnostic=UNRECOGNIZED_DIAGNOSTIC/));
test("throwing sanitizer uses generic suppression fallback", () => {
  assert.match(failure("ERROR: server closed the connection unexpectedly", { sanitize: () => { throw new Error("synthetic-secret-error"); } }), /category=UNCLASSIFIED_FAILURE; diagnostic=SANITIZER_FAILED/);
});
test("repository redaction guard rejects unsafe sanitizer output before truncation", () => {
  const output = failure("unused", { sanitize: () => "safe ".repeat(500) + "synthetic-owner@example.invalid" });
  assert.match(output, /category=UNCLASSIFIED_FAILURE; diagnostic=REDACTION_GUARD_REJECTED/);
  assert.doesNotMatch(output, /safe |example.invalid/);
});
test("spawn errors cannot expose command/environment properties", () => {
  assert.throws(() => readPsqlRows({ psqlBinary: "psql", sql, environment: {}, stage,
    spawn: () => { throw new Error("synthetic-secret-launch-error"); } }),
  (error) => error.message === "psql failed at POST_DUMP_TABLE_COUNTS (exit unavailable); category=CLIENT_PROCESS_FAILURE; diagnostic=CLIENT_PROCESS_FAILURE.");
});

for (const [message, category] of [
  ['psql: error: connection to server at "synthetic-host" (192.0.2.10), port 5432 failed: Connection refused', "CONNECTION_ESTABLISHMENT_FAILURE"],
  ["psql: error: SSL connection has been closed unexpectedly", "CONNECTION_TERMINATED"],
  ["ERROR: SSL SYSCALL error: EOF detected", "CONNECTION_TERMINATED"],
  ["psql: error: timeout expired", "CONNECTION_TIMEOUT"],
  ["psql: error: could not receive data from server: Connection timed out", "CONNECTION_TIMEOUT"],
  ["psql: error: server does not support SSL, but SSL was required", "TLS_FAILURE"],
  ["psql: error: SSL error: certificate verify failed", "TLS_FAILURE"],
  ["FATAL: Tenant or user not found", "AUTHENTICATION_FAILURE"],
  ["FATAL: auth_query secret check timed out", "AUTHENTICATION_FAILURE"],
  ["FATAL: DbHandler exited. Check logs for more information", "CONNECTION_TERMINATED"],
  ["FATAL: failed to start proxy connection", "CONNECTION_ESTABLISHMENT_FAILURE"],
  ["FATAL: unable to check out connection from the pool after 10000ms in Session mode", "CONNECTION_TIMEOUT"],
  ["FATAL: max clients reached in session mode - max clients are limited to pool_size: 15", "POOLER_RESOURCE_LIMIT"],
  ["FATAL: max client connections reached, limit: 200", "POOLER_RESOURCE_LIMIT"],
  ['FATAL: password authentication failed for user "synthetic-user"', "AUTHENTICATION_FAILURE"],
  ["FATAL: sorry, too many clients already", "POOLER_RESOURCE_LIMIT"],
  ['ERROR: permission denied for table "synthetic-table"', "SQL_EXECUTION_FAILURE"],
  ['ERROR: syntax error at or near "synthetic-query"', "SQL_EXECUTION_FAILURE"],
  ["ERROR: synthetic-unknown-primary-message", "UNCLASSIFIED_FAILURE"],
]) {
  test(`fixed safe category ${category}: ${message.split(":")[0]}`, () => {
    const error = failureError(message);
    assert.equal(error.category, category);
    assert.equal(error.diagnosticState, category === "UNCLASSIFIED_FAILURE" ? "UNRECOGNIZED_DIAGNOSTIC" : "SAFE_MESSAGE_RECOGNIZED");
    assert.deepEqual(Object.keys(error).sort(), ["category", "diagnosticState", "name"]);
    assert.doesNotMatch(error.stack, /synthetic-host|synthetic-user|synthetic-table|synthetic-query|synthetic-unknown|192\.0\.2\.10/);
  });
}
test("exit status 2 alone never establishes a connection category", () => {
  assert.equal(failureError("unrecognized synthetic private diagnostic").category, "UNCLASSIFIED_FAILURE");
});
test("unrecognized suffixes beside pooler templates cannot leak or classify", () => {
  const error = failureError("FATAL: DbHandler exited. Check logs for more information synthetic-owner@example.invalid");
  assert.equal(error.category, "UNCLASSIFIED_FAILURE");
  assert.equal(error.diagnosticState, "UNRECOGNIZED_DIAGNOSTIC");
});
test("conflicting recognized categories stay unclassified", () => {
  const error = failureError('ERROR: server closed the connection unexpectedly\nERROR: permission denied for table "synthetic-table"');
  assert.equal(error.category, "UNCLASSIFIED_FAILURE");
});
test("sanitizer returning a non-string cannot emit or classify its payload", () => {
  assert.equal(failureError("unused", { sanitize: () => ({ secret: "synthetic-private-value" }) }).diagnosticState, "INVALID_SANITIZER_OUTPUT");
});
for (const result of [
  { status: null, error: { code: "ENOENT", message: "synthetic-secret-command" } },
  { status: null, error: { code: "ETIMEDOUT", message: "synthetic-secret-timeout" }, signal: "SIGTERM" },
  { status: 2, signal: "SIGTERM", stderr: "ERROR: server closed the connection unexpectedly" },
  { status: 0, error: { code: "ENOBUFS", message: "synthetic-secret-process-error" } },
]) {
  test("client process failure stays distinct from a database diagnostic", () => {
    let calls = 0;
    assert.throws(() => readPsqlRows({ psqlBinary: "psql", sql, environment: {}, stage,
      spawn: () => { calls++; return result; } }), error => {
      assert.equal(error.category, "CLIENT_PROCESS_FAILURE");
      assert.equal(error.diagnosticState, "CLIENT_PROCESS_FAILURE");
      assert.doesNotMatch(error.stack, /synthetic-secret|ENOENT|ETIMEDOUT|SIGTERM/);
      return true;
    });
    assert.equal(calls, 1);
  });
}

const migrations = readdirSync("supabase/migrations").filter((name) => name.endsWith(".sql"))
  .sort().map((name) => [name.split("_")[0]]).filter(([version]) => version <= "20260927170418");
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
        authConfig: {}, rows, psqlBinary: "synthetic-psql", refreshSourceTransport: () => {},
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
