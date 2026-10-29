import { spawnSync } from "node:child_process";
import { assertRedactedEvidence } from "./phase-11i-recovery-contract.mjs";

export const MAX_PSQL_DIAGNOSTIC_CHARACTERS = 2000;
export const PSQL_FAILURE_CATEGORIES = Object.freeze([
  "CONNECTION_ESTABLISHMENT_FAILURE", "CONNECTION_TERMINATED", "CONNECTION_TIMEOUT",
  "TLS_FAILURE", "AUTHENTICATION_FAILURE", "POOLER_RESOURCE_LIMIT",
  "CLIENT_PROCESS_FAILURE", "SQL_EXECUTION_FAILURE", "UNCLASSIFIED_FAILURE",
]);
export const PSQL_QUERY_STAGES = Object.freeze([
  "MIGRATION_LEDGER", "APPLICATION_TABLE_INVENTORY", "PRE_DUMP_TABLE_COUNTS",
  "OWNER_VALIDATION", "OWNER_ACTIVATION", "STORAGE_SCOPE", "VAULT_INVENTORY",
  "RLS_VALIDATION", "GRANT_VALIDATION", "SECURITY_DEFINER_VALIDATION",
  "AUTH_TABLE_INVENTORY", "POST_DUMP_TABLE_COUNTS",
  "POST_DUMP_OWNER_VALIDATION", "POST_DUMP_OWNER_ACTIVATION",
]);

// Only fixed client/server message templates may leave stderr. Regex redaction
// alone cannot distinguish arbitrary SQL, row values, or extension error text.
// Pooler templates come from the upstream Supavisor error definitions; they do
// not establish that any particular pooler error caused the observed failures.
const ADDITIONAL_SAFE_CATEGORIES = [
  ["TLS_FAILURE", /^(?:server does not support SSL, but SSL was required|SSL error: certificate verify failed)$/i],
  ["AUTHENTICATION_FAILURE", /^(?:Tenant or user not found|auth_query secret check timed out)$/i],
  ["CONNECTION_TERMINATED", /^(?:DbHandler exited\. Check logs for more information|connection to database closed\. Check logs for more information)$/i],
  ["CONNECTION_ESTABLISHMENT_FAILURE", /^failed to start proxy connection$/i],
  ["CONNECTION_TIMEOUT", /^unable to check out connection from the pool after \d+ms in (?:Session|Transaction) mode$/i],
  ["POOLER_RESOURCE_LIMIT", /^(?:max clients reached in session mode - max clients are limited to pool_size: \d+|max client connections reached, limit: \d+)$/i],
];
const SAFE_MESSAGE_PATTERNS = [
  ...ADDITIONAL_SAFE_CATEGORIES.map(([, pattern]) => pattern),
  /^server closed the connection unexpectedly$/i,
  /^SSL connection has been closed unexpectedly$/i,
  /^connection to server was lost$/i,
  /^(?:could not receive data from server|could not send data to server|SSL SYSCALL error): (?:Connection reset by peer|Connection timed out|Broken pipe|EOF detected)$/i,
  /^(?:Connection refused|Connection timed out|Network is unreachable|No route to host|timeout expired)$/i,
  /^could not connect to server: (?:Connection refused|Connection timed out)$/i,
  /^could not translate host name \[REDACTED\] to address: (?:Name or service not known|Temporary failure in name resolution|nodename nor servname provided, or not known)$/i,
  /^(?:password|certificate|PAM|LDAP|GSSAPI) authentication failed for user \[REDACTED\]$/i,
  /^no password supplied$/i,
  /^permission denied for (?:schema|table|relation|database|sequence) \[REDACTED\]$/i,
  /^relation \[REDACTED\] does not exist$/i,
  /^syntax error at or near \[REDACTED\]$/i,
  /^canceling statement due to (?:statement timeout|lock timeout|user request)$/i,
  /^terminating connection due to (?:administrator command|idle-in-transaction timeout|idle-session timeout)$/i,
  /^the database system is (?:starting up|shutting down|in recovery mode)$/i,
  /^sorry, too many clients already$/i,
  /^remaining connection slots are reserved for non-replication superuser connections$/i,
  /^no pg_hba.conf entry for host \[REDACTED\], user \[REDACTED\], database \[REDACTED\], (?:SSL encryption|no encryption)$/i,
];

// Classification consumes only an already-sanitized, guard-approved diagnostic.
// These fixed labels are evidence for diagnosis, never authorization to retry.
const CATEGORY_PATTERNS = [
  ...ADDITIONAL_SAFE_CATEGORIES,
  ["AUTHENTICATION_FAILURE", /^(?:(?:password|certificate|PAM|LDAP|GSSAPI) authentication failed for user \[REDACTED\]|no password supplied|no pg_hba.conf entry for host \[REDACTED\], user \[REDACTED\], database \[REDACTED\], (?:SSL encryption|no encryption))$/i],
  ["SQL_EXECUTION_FAILURE", /^(?:permission denied for (?:schema|table|relation|database|sequence) \[REDACTED\]|relation \[REDACTED\] does not exist|syntax error at or near \[REDACTED\]|canceling statement due to (?:statement timeout|lock timeout|user request))$/i],
  ["POOLER_RESOURCE_LIMIT", /^(?:sorry, too many clients already|remaining connection slots are reserved for non-replication superuser connections)$/i],
  ["CONNECTION_TIMEOUT", /^(?:Connection timed out|timeout expired|could not connect to server: Connection timed out|(?:could not receive data from server|could not send data to server|SSL SYSCALL error): Connection timed out)$/i],
  ["CONNECTION_TERMINATED", /^(?:server closed the connection unexpectedly|SSL connection has been closed unexpectedly|connection to server was lost|(?:could not receive data from server|could not send data to server|SSL SYSCALL error): (?:Connection reset by peer|Broken pipe|EOF detected)|terminating connection due to (?:administrator command|idle-in-transaction timeout|idle-session timeout))$/i],
  ["CONNECTION_ESTABLISHMENT_FAILURE", /^(?:Connection refused|Network is unreachable|No route to host|could not connect to server: Connection refused|could not translate host name \[REDACTED\] to address: (?:Name or service not known|Temporary failure in name resolution|nodename nor servname provided, or not known)|the database system is (?:starting up|shutting down|in recovery mode))$/i],
];

function primaryMessage(line) {
  return line.replace(/^connection to server at \[REDACTED\](?: \(\[REDACTED\]\))?, port \d{1,5} failed: /i, "")
    .replace(/^(?:ERROR|FATAL|PANIC):\s*/i, "");
}

function classifySafePsqlDiagnostic(diagnostic) {
  const categories = new Set(diagnostic.split("\n").map((line) => {
    const message = primaryMessage(line);
    return CATEGORY_PATTERNS.find(([, pattern]) => pattern.test(message))?.[0] ?? "UNCLASSIFIED_FAILURE";
  }));
  return categories.size === 1 ? [...categories][0] : "UNCLASSIFIED_FAILURE";
}

class PsqlReadError extends Error {
  constructor(stage, exit, category, diagnosticState) {
    super(`psql failed at ${stage} (exit ${exit}); category=${category}; diagnostic=${diagnosticState}.`);
    this.name = "PsqlReadError";
    this.category = category;
    this.diagnosticState = diagnosticState;
  }
}

export function sanitizePsqlDiagnostic(stderr, sensitiveValues = []) {
  if (stderr == null) return "";
  if (typeof stderr !== "string") return null;
  if (!stderr.trim()) return "";
  let text = stderr;
  for (const value of sensitiveValues.filter((value) => typeof value === "string" && value.length)
    .sort((a, b) => b.length - a.length)) {
    text = text.replaceAll(value, "[REDACTED]");
  }
  text = text
    .replace(/-----BEGIN (?:[A-Z0-9]+ )*PRIVATE KEY-----[\s\S]*?(?:-----END (?:[A-Z0-9]+ )*PRIVATE KEY-----|$)/gi, "[REDACTED]")
    .replace(/postgres(?:ql)?:\/\/[^\s"'`]+/gi, "[REDACTED]")
    .replace(/\b(?:PGPASSWORD|SUPABASE_ACCESS_TOKEN|password)\s*[:=]\s*(?:"[^"\r\n]*"|'[^'\r\n]*'|[^\s]+)/gi, "[REDACTED]")
    .replace(/\b(?:Authorization\s*:\s*)?Bearer\s+[^\s"'`]+/gi, "[REDACTED]")
    .replace(/\bsbp_[A-Za-z0-9_-]+\b/g, "[REDACTED]")
    .replace(/\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g, "[REDACTED]")
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, "[REDACTED]")
    .replace(/\b[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}\b/gi, "[REDACTED]")
    .replace(/"[^"\r\n]*"|'[^'\r\n]*'|`[^`\r\n]*`/g, "[REDACTED]")
    .replace(/(at \[REDACTED\] )\([^\r\n)]*\)(, port )/gi, "$1([REDACTED])$2");

  const messages = [];
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim().replace(/[\t ]+/g, " ");
    // Never forward PostgreSQL DETAIL/HINT/CONTEXT/LINE, query echoes, or rows.
    let message = line.replace(/^psql:(?:[^:\r\n]*:\d+:)?\s*(?:error:\s*)?/i, "");
    const connection = message.match(/^(connection to server at \[REDACTED\](?: \(\[REDACTED\]\))?, port \d{1,5} failed: )(.+)$/i);
    if (connection) message = connection[2];
    const severity = message.match(/^(ERROR|FATAL|PANIC):\s*/i)?.[0] ?? "";
    message = message.slice(severity.length);
    if (!SAFE_MESSAGE_PATTERNS.some((pattern) => pattern.test(message))) continue;
    messages.push(`${connection?.[1] ?? ""}${severity}${message}`);
  }
  if (!messages.length) return null;
  return messages.join("\n").slice(0, MAX_PSQL_DIAGNOSTIC_CHARACTERS);
}

export function readPsqlRows({
  psqlBinary, sql, environment, stage,
  spawn = spawnSync, sanitize = sanitizePsqlDiagnostic, guard = assertRedactedEvidence,
}) {
  let result;
  let launchFailed = false;
  try {
    result = spawn(psqlBinary,
      ["-X", "-v", "ON_ERROR_STOP=1", "-q", "-A", "-t", "-F", "\t"], {
        encoding: "utf8", maxBuffer: 128 * 1024 * 1024, timeout: 15 * 60 * 1_000,
        input: `set role postgres; ${sql}`, env: environment,
      });
  } catch {
    launchFailed = true;
    result = { status: null, stderr: null };
  }
  if (result.status !== 0 || result.error || result.signal) {
    const safeStage = PSQL_QUERY_STAGES.includes(stage) ? stage : "QUERY_STAGE_UNAVAILABLE";
    const exit = Number.isInteger(result.status) && result.status >= 0 && result.status <= 255 ? result.status : "unavailable";
    const failure = (category, state) => new PsqlReadError(safeStage, exit, category, state);
    if (launchFailed || result.error || result.signal || exit === "unavailable") {
      throw failure("CLIENT_PROCESS_FAILURE", "CLIENT_PROCESS_FAILURE");
    }
    let diagnostic;
    try {
      diagnostic = sanitize(result.stderr, [environment?.PGPASSWORD, environment?.SUPABASE_ACCESS_TOKEN]);
    } catch {
      throw failure("UNCLASSIFIED_FAILURE", "SANITIZER_FAILED");
    }
    if (diagnostic === null) {
      throw failure("UNCLASSIFIED_FAILURE", "UNRECOGNIZED_DIAGNOSTIC");
    }
    if (typeof diagnostic !== "string") {
      throw failure("UNCLASSIFIED_FAILURE", "INVALID_SANITIZER_OUTPUT");
    }
    try {
      // Validate even injected sanitizer output before deriving a category.
      guard(diagnostic);
    } catch {
      throw failure("UNCLASSIFIED_FAILURE", "REDACTION_GUARD_REJECTED");
    }
    // No diagnostic text, SQL, process result or environment is attached to the
    // error. Even recognized safe templates become predefined labels only.
    throw failure(diagnostic ? classifySafePsqlDiagnostic(diagnostic) : "UNCLASSIFIED_FAILURE",
      diagnostic ? "SAFE_MESSAGE_RECOGNIZED" : "NO_DIAGNOSTIC");
  }
  const output = (result.stdout ?? "").trim();
  return output ? output.split(/\r?\n/).map((line) => line.split("\t")) : [];
}
