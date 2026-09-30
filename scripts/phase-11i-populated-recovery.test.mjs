import assert from "node:assert/strict";
import test from "node:test";
import { spawnSync } from "node:child_process";
import { assertDatabaseSecurity, assertRestoredAuth, assertRestoredCounts, validateOwnerDatabase } from "./phase-11i-owner-validation.mjs";
import { assertArchiveMembers, assertRoleCompatibility } from "./phase-11i-restore-pipeline.mjs";
import { assertApprovedProductionTransport, assertProductionProjectMetadata, assertProductionSource, assertRecipientCertificateFingerprint, assertEncryptedDurableOutput, assertStorageScope, EXPECTED_RECIPIENT_CERT_SHA256 } from "./phase-11i-recovery-contract.mjs";

const durable = { users: 1, identities: 2, mfaFactors: 1, webauthnCredentials: 1 };
const source = { ...durable, sessions: 4, refreshTokens: 5 };
const restored = { ...durable, sessions: 0, refreshTokens: 0 };
const populated = { "public.foods": 354, "public.food_nutrients": 1420, "public.diary_entries": 20, "public.nutrition_targets": 2 };
const secure = { rlsDisabledTables: [], unexpectedMutationGrants: [], securityDefinerMissingSearchPath: [] };

function aggregateRows({ users = 1, activeUsers = 1, sessions = 4, refreshTokens = 5 } = {}) {
  return (sql) => {
    if (sql.includes("select 'users',count(*)")) return Object.entries({ ...durable, users, sessions, refreshTokens }).map(([name, count]) => [name, String(count)]);
    if (sql.includes("select count(*) from auth.users where deleted_at")) return [[String(activeUsers)]];
    if (sql.includes("from pg_constraint")) return [];
    return [["0"]];
  };
}
test("one non-deleted owner accepts arbitrary populated-state aggregate policy", () => {
  const result = validateOwnerDatabase(aggregateRows());
  assert.equal(result.ownershipIntegrity.result, "PASS");
  assert.equal(result.authCounts.identities, 2);
});
test("source live sessions are accepted", () => assert.equal(validateOwnerDatabase(aggregateRows()).authCounts.sessions, 4));
test("source live refresh tokens are accepted", () => assert.equal(validateOwnerDatabase(aggregateRows()).authCounts.refreshTokens, 5));
test("additional Auth user is rejected", () => assert.throws(() => validateOwnerDatabase(aggregateRows({ users: 2 }))));
test("deleted sole Auth user is rejected", () => assert.throws(() => validateOwnerDatabase(aggregateRows({ activeUsers: 0 }))));
test("empty bootstrap Auth is rejected by active owner policy", () => assert.throws(() => validateOwnerDatabase(aggregateRows({ users: 0, activeUsers: 0 }))));
test("populated and increased custom catalog counts round trip", () => assertRestoredCounts(populated, { ...populated }));
test("lost populated application row fails", () => assert.throws(() => assertRestoredCounts(populated, { ...populated, "public.diary_entries": 19 })));
test("missing application table fails", () => assert.throws(() => assertRestoredCounts(populated, {})));
test("unexpected restored table fails", () => assert.throws(() => assertRestoredCounts(populated, { ...populated, extra: 1 })));
test("invalid aggregate evidence fails", () => assert.throws(() => assertRestoredCounts({ table: -1 }, { table: -1 })));
test("durable Auth survives with volatile source state excluded", () => assertRestoredAuth(source, restored));
for (const name of ["users", "identities", "mfaFactors", "webauthnCredentials"]) {
  test(`lost durable Auth ${name} fails`, () => assert.throws(() => assertRestoredAuth(source, { ...restored, [name]: 0 })));
}
for (const name of ["sessions", "refreshTokens"]) {
  test(`restored volatile ${name} fails`, () => assert.throws(() => assertRestoredAuth(source, { ...restored, [name]: 1 })));
}
test("RLS/grant/search-path guards accept secure state", () => assertDatabaseSecurity(secure));
for (const name of Object.keys(secure)) {
  test(`nonempty ${name} fails closed`, () => assert.throws(() => assertDatabaseSecurity({ ...secure, [name]: ["synthetic-violation"] })));
}
test("wrong Production source fails", () => assert.throws(() => assertProductionSource({ projectRef: "PHASE_11I_SYNTHETIC_POPULATED_FIXTURE", sourceEnvironment: "Production" })));
test("wrong Production environment fails", () => assert.throws(() => assertProductionSource({ projectRef: "hskfanrqwtqknzpquwhg", sourceEnvironment: "LocalSynthetic" })));
test("Production recipient pin remains mandatory", () => {
  assertRecipientCertificateFingerprint(EXPECTED_RECIPIENT_CERT_SHA256);
  assert.throws(() => assertRecipientCertificateFingerprint("a".repeat(64)));
});
test("Production wrapper rejects local environment despite generic bypass variables", () => {
  const result = spawnSync(process.execPath, ["scripts/run-phase-11i-backup.mjs"], { encoding: "utf8", env: { ...process.env, PHASE11I_SOURCE_ENVIRONMENT: "LocalSynthetic", ALLOW_NON_PRODUCTION_SOURCE: "1", SKIP_PROJECT_CHECK: "1" } });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /requires source environment Production/);
});
test("plaintext durable output fails", () => assert.throws(() => assertEncryptedDurableOutput("/tmp/fixture.sql")));
test("expanded Storage remains rejected", () => assert.throws(() => assertStorageScope({ buckets: 0, objects: 1 }), /PHASE_11I_STORAGE_BACKUP_SCOPE_EXPANSION_REQUIRED/));
const files = ["application-data.sql", "application-schema.sql", "auth-config-redacted.json", "auth-durable-data.sql", "backup-content-manifest.json", "migration-ledger.json", "roles.sql", "source-snapshot-redacted.json"];
const members = ["./", ...files.map((name) => `./${name}`)];
const verbose = members.map((name, i) => `${i ? "-" : "d"} fixture ${name}`);
test("archive inventory accepts exactly controlled regular files", () => assertArchiveMembers(members, verbose));
for (const [label, changed, listing] of [
  ["traversal", ["./", "../application-data.sql", ...members.slice(2)], verbose],
  ["unexpected member", [...members, "./extra.sql"], [...verbose, "- fixture ./extra.sql"]],
  ["duplicate member", [...members, members[1]], [...verbose, verbose[1]]],
  ["symlink", members, verbose.map((line, i) => i === 1 ? line.replace(/^./, "l") : line)],
]) test(`archive ${label} fails`, () => assert.throws(() => assertArchiveMembers(changed, listing)));
test("identical role state is valid", () => assert.equal(assertRoleCompatibility([], []), true));
test("only accepted provider role delta is compatible", () => assert.equal(assertRoleCompatibility(['ALTER ROLE "supabase_admin" SET "statement_timeout" TO 100;'], ['GRANT SET ON PARAMETER "log_min_messages" TO "supabase_realtime_admin";']), false));
test("custom or provider role drift fails", () => assert.throws(() => assertRoleCompatibility(["GRANT admin TO anon;"], [])));

const transport = { PGHOST: "aws-0-eu-west-1.pooler.supabase.com", PGPORT: "5432", PGUSER: "cli_login_postgres.hskfanrqwtqknzpquwhg", PGDATABASE: "postgres" };
test("approved hosted transport is accepted", () => assertApprovedProductionTransport(transport));
for (const name of Object.keys(transport)) {
  test(`wrong hosted ${name} is rejected`, () => assert.throws(() => assertApprovedProductionTransport({ ...transport, [name]: "wrong" })));
}
test("Production metadata rejects wrong region, identity or health", () => {
  const project = { id: "hskfanrqwtqknzpquwhg", region: "eu-west-1", status: "ACTIVE_HEALTHY" };
  assertProductionProjectMetadata(project);
  for (const name of Object.keys(project)) assert.throws(() => assertProductionProjectMetadata({ ...project, [name]: "wrong" }));
});
