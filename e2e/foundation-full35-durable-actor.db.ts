import { execFileSync, spawn, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { chmodSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { expect, test } from "@playwright/test";
import { buildMappingPlan, fingerprintMappingPlan, selectMappingActorAuthority, type MappingActorScope, type MappingPlan } from "@/ingestion/usda/foundation/reprojection/contracts";
import { installSyntheticBaseline, fixtureHash, fixtureId, mappingId } from "./fixtures/foundation-full35-reprojection";
import { actorInput, installIdentityControllers, bindActor, proposeActorBinding, approveActorBinding,
  identityGovernor, identityReviewer, type ActorQuery, type PrincipalFixture } from "./fixtures/foundation-full35-actor-identity";

const evidence = process.env.FULL35_EVIDENCE_DIR!;
const config = JSON.parse(readFileSync(join(evidence, "diagnostic-input.json"), "utf8")) as {
  source: string; target: string; compensated: string; sourceDirectory: string; scratch: string;
};
const password = "synthetic-full35-actor-only";
const operator = "full35_durable_operator", approver = "full35_durable_approver", other = "full35_unrelated_operator";
const cli = resolve("node_modules/.bin/supabase");
const hash = (value: string | Buffer) => createHash("sha256").update(value).digest("hex");
function db(container: string, sql: string, user = "supabase_admin") {
  if (!/^supabase_db_full35-actor-(source|target|compensated)-[a-f0-9]{12}$/.test(container)) throw new Error("Fresh local actor cluster required.");
  return execFileSync("docker", ["exec", "-e", `PGPASSWORD=${password}`, "-i", container, "psql",
    ...(user === "supabase_admin" ? [] : ["-h", "127.0.0.1"]), "-U", user, "-d", "postgres", "-X", "-qAt", "-v", "ON_ERROR_STOP=1"],
  { input: sql, encoding: "utf8", maxBuffer: 128 * 1024 * 1024, stdio: ["pipe", "pipe", "pipe"] }).trim();
}
const at = (container: string): ActorQuery => (sql, user) => db(container, sql, user);
const source = at(config.source), target = at(config.target), compensated = at(config.compensated);
function command(executable: string, args: string[]) {
  const result = spawnSync(executable, args, { encoding: "utf8", timeout: 180_000, maxBuffer: 128 * 1024 * 1024 });
  if (result.status !== 0) throw new Error(`Local actor command ${executable} ${args[0]} failed (exit ${result.status}).`);
  return result.stdout.trim();
}
let fixture: ReturnType<typeof installSyntheticBaseline>;
let operatorPrincipal: PrincipalFixture, approverPrincipal: PrincipalFixture;
let original: Record<string, unknown>, compensation: Record<string, unknown>;
let originalApproval: string, compensationApproval: string, pendingApproval: string;
const originalToken = fixtureId(999820), compensationToken = fixtureId(999821), pendingToken = fixtureId(999822);
let sourceCore: string, sourcePrivate: string, tables: string[];
const continuityEvidence: Record<string, unknown>[] = [];
const checkpoints: Record<string, unknown>[] = [], negatives: Record<string, string> = {};
const privateSql = `select jsonb_build_object(
 'diary',(select jsonb_agg(to_jsonb(t) order by id) from public.diary_entries t),
 'meals',(select jsonb_agg(to_jsonb(t) order by id) from public.saved_meal_items t),
 'recipes',(select jsonb_agg(to_jsonb(t) order by id) from public.recipe_ingredients t),
 'targets',(select jsonb_agg(to_jsonb(t) order by id) from public.nutrition_targets t),
 'requests',(select jsonb_agg(to_jsonb(t) order by id) from public.manual_diary_entry_requests t));`;
function fingerprint(q: ActorQuery, all = true) {
  const selected = tables.filter(name => all || !name.startsWith("ingestion.mapping_actor_"));
  // Hash each complete canonical row, then its sorted multiset. Fixed-size row
  // hashes retain duplicates and avoid repeatedly aggregating huge plan bodies.
  const union = selected.map(name => `select '${name}' name,encode(sha256(convert_to(coalesce(string_agg(row_hash,'' order by row_hash collate "C"),''),'UTF8')),'hex') h
    from (with rows as materialized (select encode(sha256(convert_to(to_jsonb(t)::text,'UTF8')),'hex') row_hash from ${name} t) select row_hash from rows) fingerprints`).join(" union all ");
  return q(`select jsonb_object_agg(name,h order by name) from (${union}) hashes`);
}
function denied(q: ActorQuery, sql: string, user: string, pattern = /42501|permission denied|binding|principal|identity|immutable/i) {
  const before = fingerprint(q);
  let error = "";
  try { q("\\set VERBOSITY verbose\n" + sql, user); }
  catch (e) { error = String((e as { stderr: Buffer }).stderr); }
  expect(error).toMatch(pattern);
  expect(fingerprint(q)).toBe(before);
}
function makePlan(q: ActorQuery, compensate = false): MappingPlan {
  const scope = JSON.parse(q("select ingestion.get_foundation_mapping_reprojection_scope_v1('local')", operator));
  return buildMappingPlan({ operation_kind: compensate ? "compensation" : "reprojection", dataset_id: fixture.datasetId, environment: "local",
    source_release_id: fixture.releaseId, mapping_version_id: mappingId, before_snapshot: scope.before_snapshot,
    actor_authority: selectMappingActorAuthority(scope.actor_authority as MappingActorScope, approver),
    operator_oid: Number(q(`select oid from pg_roles where rolname='${operator}'`)), operator_login: operator,
    approval_requirements: { approver_oid: Number(q(`select oid from pg_roles where rolname='${approver}'`)),
      not_before: new Date(Date.now() - 60_000).toISOString(), expires_at: new Date(Date.now() + 3_600_000).toISOString() },
    implementation: { database_contract_hash: scope.database_contract_hash, commit: command("git", ["rev-parse", "HEAD"]),
      tree: command("git", ["rev-parse", "HEAD^{tree}"]), migrations: readdirSync("supabase/migrations").filter(n => n.endsWith(".sql")).sort().map(filename => ({
        filename, version: filename.slice(0, 14), sha256: hash(readFileSync(`supabase/migrations/${filename}`)) })),
      contract_versions: { parser: "usda-fdc-foundation-json/v1", importer: "usda-foundation-importer/v3", candidate: "foundation-normalized-candidate/v2",
        mapping: "usda-foundation-full35-direct-v2", projection: "foundation-lifecycle-projection/v2" } },
    qualification: { ...fixture.source, historical_allowance_fingerprint: "bdfc95e5009a8d5c5a5bbf82b24dff1a4e8c3decd7bee4406286c543e661ad4a",
      rejected: JSON.parse(readFileSync("docs/evidence/nutrition-usda-full35-local-qual-001/qualification.json", "utf8")).source_inspection.rejected_records,
      source_qualification_hash: fixtureHash("independent-synthetic-actor-oracle") },
    recovery_requirements: { qualification_hash: fixtureHash("actor-correction-not-recovery-qualification"), production_ready: false },
    rejected_receipt_id: compensate ? String(original.receipt_id) : null, records: fixture.records });
}
function approveOperation(plan: MappingPlan, token: string) {
  const id = source(`select ingestion.prepare_foundation_mapping_${plan.operation_kind}_v1(${actorInput(plan)},'${token}')`, operator);
  return source(`select ingestion.approve_foundation_mapping_${plan.operation_kind}_v1('${id}','${fingerprintMappingPlan(plan)}',
    '${plan.approval_requirements.expires_at}',${actorInput({ independent_review_hash: fixtureHash("independent actor operation review"),
      recovery_evidence_hash: plan.recovery_requirements.qualification_hash, approval_reference: "synthetic independent operation" })})`, approver);
}
const retrySql = (kind: string, approval: string, token: string) => `select ingestion.execute_foundation_mapping_${kind}_v1('${approval}','${token}')`;
function counts(q: ActorQuery) {
  return JSON.parse(q(`select jsonb_build_object('foods',(select count(*) from public.foods where is_public),
    'sources',(select count(*) from ingestion.source_record_versions),'values',(select count(*) from public.food_nutrients),
    'heads',(select jsonb_agg(head_version order by head_version) from ingestion.dataset_projection_heads),
    'projections',(select count(*) from ingestion.food_projection_versions where projection_contract_version='foundation-lifecycle-projection/v2'),
    'states',(select count(*) from ingestion.food_nutrient_projection_versions where projection_contract_version='foundation-lifecycle-projection/v2'),
    'receipts',(select count(*) from ingestion.mapping_reprojection_receipts),
    'context',(select count(*) from ingestion.mapping_reprojection_execution_context))`));
}
function completedReads(q: ActorQuery, includeCompensation = false, user = operator) {
  const before = fingerprint(q);
  expect(JSON.parse(q(retrySql("reprojection", originalApproval, originalToken), user))).toEqual(original);
  expect(JSON.parse(q(`select ingestion.get_foundation_mapping_reprojection_receipt_v1('${originalApproval}')`, user))).toEqual(original);
  if (includeCompensation) {
    expect(JSON.parse(q(retrySql("compensation", compensationApproval, compensationToken), user))).toEqual(compensation);
    expect(JSON.parse(q(`select ingestion.get_foundation_mapping_reprojection_receipt_v1('${compensationApproval}')`, user))).toEqual(compensation);
  }
  expect(fingerprint(q)).toBe(before);
}
function replay(q: ActorQuery, name: string) {
  mkdirSync(config.scratch, { recursive: true, mode: 0o700 });
  const content = join(config.scratch, "content"); mkdirSync(content, { mode: 0o700 });
  const excluded = source("select 'auth.'||tablename from pg_tables where schemaname='auth' and tablename not in ('users','identities','mfa_factors','webauthn_credentials') order by tablename").split("\n").join(",");
  for (const [file, args] of [["application.sql", ["--data-only", "--schema", "public,ingestion"]],
    ["auth.sql", ["--data-only", "--schema", "auth", "--exclude", excluded]]] as const) {
    command(cli, ["db", "dump", "--local", ...args, "--file", join(content, file), "--workdir", config.sourceDirectory]);
  }
  const key = join(config.scratch, "recipient.key"), cert = join(config.scratch, "recipient.crt"), tar = join(config.scratch, "data.tar"),
    archive = join(config.scratch, "data.archive.cms"), decrypted = join(config.scratch, "decrypted.tar");
  command("openssl", ["req", "-x509", "-newkey", "rsa:3072", "-nodes", "-keyout", key, "-out", cert, "-days", "1", "-subj", "/CN=Synthetic Durable Actor Continuity"]);
  chmodSync(key, 0o600);command("tar", ["-cf", tar, "-C", content, "."]);
  command("openssl", ["cms", "-encrypt", "-binary", "-aes-256-gcm", "-outform", "DER", "-in", tar, "-out", archive, cert]);
  const archiveHash = hash(readFileSync(archive)), plainHash = hash(readFileSync(tar));
  const header = readFileSync(archive).subarray(0, 2048);
  expect(header.includes(Buffer.from("060b2a864886f70d0109100117", "hex"))).toBe(true);
  expect(header.includes(Buffer.from("060960864801650304012e", "hex"))).toBe(true);
  command("openssl", ["cms", "-decrypt", "-binary", "-inform", "DER", "-in", archive, "-recip", cert, "-inkey", key, "-out", decrypted]);
  expect(hash(readFileSync(decrypted))).toBe(plainHash);
  rmSync(content, { recursive: true });mkdirSync(content, { mode: 0o700 });command("tar", ["-xf", decrypted, "-C", content]);
  q(`set session_replication_role=replica; truncate ${tables.join(",")} cascade;truncate auth.users cascade;`);
  q(readFileSync(join(content, "auth.sql"), "utf8"));q(readFileSync(join(content, "application.sql"), "utf8"));
  expect(fingerprint(q)).toBe(fingerprint(source));
  for (const table of ["ingestion.mapping_reprojection_plans", "ingestion.mapping_reprojection_approvals", "ingestion.mapping_reprojection_receipts", "ingestion.mapping_reprojection_events", "auth.users"]) {
    const sql = `select to_jsonb(t)::text from ${table} t order by to_jsonb(t)::text collate "C"`;
    expect(q(sql), `Immutable complete bytes: ${table}`).toBe(source(sql));
  }
  expect(q("select ingestion.fingerprint_mapping_database_contract_v1()"))
    .toBe(source("select ingestion.fingerprint_mapping_database_contract_v1()"));
  expect(q("select cluster_id from private.mapping_actor_cluster_epoch")).not.toBe(source("select cluster_id from private.mapping_actor_cluster_epoch"));
  expect(hash(q(privateSql))).toBe(sourcePrivate);
  checkpoints.push({ name, encryptedArchiveSha256: archiveHash, plaintextSha256: plainHash, dataEqualBeforeRebinding: true,
    immutableOperationBytesEqual: true, schemaContractEqual: true, independentClusterMarker: true, counts: counts(q) });
  rmSync(config.scratch, { recursive: true });
}
function recordContinuity(q: ActorQuery, checkpoint: string) {
  continuityEvidence.push({ checkpoint,
    sourceLoginOids: JSON.parse(source(`select jsonb_object_agg(rolname,oid::bigint) from pg_roles where rolname in ('${operator}','${approver}')`)),
    currentLoginOids: JSON.parse(q(`select jsonb_object_agg(rolname,oid::bigint) from pg_roles where rolname in ('${operator}','${approver}')`)),
    decisions: JSON.parse(q(`select jsonb_agg(jsonb_build_object('body',b.body,'body_hash',b.body_hash,'request_body',r.body,'request_hash',r.body_hash)
      order by b.principal_id) from ingestion.mapping_actor_current_bindings c join ingestion.mapping_actor_bindings b on b.id=c.binding_id
      join ingestion.mapping_actor_binding_requests r on r.id=b.request_id where c.principal_id in ('${operatorPrincipal.principalId}','${approverPrincipal.principalId}')`)) });
}
function rebind(q: ActorQuery, principal = operatorPrincipal, login = operator) {
  return bindActor(q, fixture.datasetId, login, principal.authority, principal);
}

test.describe.serial("Durable Full35 principal authority", () => {
  test.beforeAll(() => {
    for (const q of [source, target, compensated]) {
      if (q !== source) q("do $$ begin for i in 1..64 loop execute format('create role full35_actor_padding_%s nologin',i); end loop;end $$;");
      q(`create role ${operator} login password '${password}';create role ${approver} login password '${password}';
        create role ${other} login password '${password}';grant ingestion_operator to ${operator},${other};grant ingestion_approver to ${approver};`);
      installIdentityControllers(q, password);
    }
    fixture = installSyntheticBaseline(source);
    operatorPrincipal = bindActor(source, fixture.datasetId, operator, "operator");
    approverPrincipal = bindActor(source, fixture.datasetId, approver, "approver");
    tables = source("select schemaname||'.'||tablename from pg_tables where schemaname in ('public','ingestion') order by 1").split("\n");
    expect(tables.every(name => /^(public|ingestion)\.[a-z_]+$/.test(name))).toBe(true);
    sourceCore = source("select to_jsonb(t)::text from public.food_nutrients t order by id");sourcePrivate = hash(source(privateSql));
  });

  test("A — actual distinct principals execute the exact 353/1199/5062 reprojection", () => {
    test.setTimeout(420_000);
    originalApproval = approveOperation(makePlan(source), originalToken);
    original = JSON.parse(source(retrySql("reprojection", originalApproval, originalToken), operator));
    expect(counts(source)).toEqual({ foods: 353, sources: 353, values: 6261, heads: [1, 2], projections: 353, states: 12355, receipts: 1, context: 0 });
    expect(hash(source(privateSql))).toBe(sourcePrivate);completedReads(source);
    pendingApproval = approveOperation(makePlan(source, true), pendingToken);
  });
  test("B — independently verified changed-OID principals read completed receipts while pending approval remains closed", () => {
    test.setTimeout(420_000);replay(target, "reprojected");
    denied(target, retrySql("reprojection", originalApproval, originalToken), operator);
    denied(target, `select ingestion.get_foundation_mapping_reprojection_receipt_v1('${originalApproval}')`, operator);
    expect(target(`select oid from pg_roles where rolname='${operator}'`)).not.toBe(source(`select oid from pg_roles where rolname='${operator}'`));
    const before = fingerprint(target, false);rebind(target);rebind(target, approverPrincipal, approver);
    expect(fingerprint(target, false)).toBe(before);completedReads(target);recordContinuity(target, "reprojected");
    denied(target, retrySql("compensation", pendingApproval, pendingToken), operator, /pending operation binding is stale/);
    negatives["01_verified_oid_change_completed_read"] = "PASS";negatives["15_pending_operation_not_transferred"] = "PASS";
    bindActor(target, fixture.datasetId, other, "operator");
  });
  test("C — separately approved compensation restores head 3 and both original immutable receipts", () => {
    test.setTimeout(540_000);
    compensationApproval = approveOperation(makePlan(source, true), compensationToken);
    compensation = JSON.parse(source(retrySql("compensation", compensationApproval, compensationToken), operator));
    expect(source("select to_jsonb(t)::text from public.food_nutrients t order by id")).toBe(sourceCore);
    expect(counts(source)).toEqual({ foods: 353, sources: 353, values: 1199, heads: [1, 2, 3], projections: 706, states: 24710, receipts: 2, context: 0 });
    replay(compensated, "compensated");denied(compensated, retrySql("compensation", compensationApproval, compensationToken), operator);
    rebind(compensated);rebind(compensated, approverPrincipal, approver);completedReads(compensated, true);completedReads(source, true);recordContinuity(compensated, "compensated");
    expect(compensated("select to_jsonb(t)::text from public.food_nutrients t order by id")).toBe(sourceCore);
  });
  test("D — restricted roles, RLS, triggers and default ACLs preserve the original decisions", () => {
    for (const q of [source, target, compensated]) {
      for (const group of ["anon", "authenticated", "service_role"]) {
        const user = `full35_actor_${group}_client`;q(`create role ${user} login password '${password}';grant ${group} to ${user};`);
        denied(q, `select ingestion.request_foundation_actor_binding_v1('{}'::json)`, user);
        denied(q, retrySql("reprojection", originalApproval, originalToken), user);
        denied(q, "select * from ingestion.mapping_actor_current_bindings", user);
      }
      denied(q, "delete from public.food_nutrients", operator);
      denied(q, "delete from ingestion.mapping_actor_bindings", identityGovernor);
      denied(q, "select * from private.mapping_actor_cluster_epoch", operator);
      expect(q(`select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='ingestion'
        and p.proowner='ingestion_identity_definer'::regrole and p.prosecdef and not p.proconfig @> array['search_path=""']`)).toBe("0");
    }
  });
  test("02 — another actual login assigned the original numeric OID remains unauthorized", () => {
    const oid = source(`select oid from pg_roles where rolname='${operator}'`);
    const name = target(`select rolname from pg_roles where oid='${oid}'::oid`);
    expect(name).toMatch(/^full35_actor_padding_\d+$/);
    target(`alter role ${name} login password '${password}';grant ingestion_operator to ${name}`);
    denied(target, retrySql("reprojection", originalApproval, originalToken), name);negatives["02_old_oid_substitution"] = "PASS";
  });
  test("03 — a different registered operator cannot use the original token", () => {
    denied(target, retrySql("reprojection", originalApproval, originalToken), other);negatives["03_other_principal_token"] = "PASS";
  });
  test("04 — knowing a different login name supplies no continuity", () => {
    const user = "full35_actor_unbound";target(`create role ${user} login password '${password}';grant ingestion_operator to ${user}`);
    denied(target, `select ingestion.get_foundation_mapping_reprojection_receipt_v1('${originalApproval}')`, user);negatives["04_unbound_login_name"] = "PASS";
  });
  test("05 — renamed roles fail until an explicit independently approved binding", () => {
    const renamed = "full35_actor_renamed";target(`alter role ${operator} rename to ${renamed}`);
    denied(target, retrySql("reprojection", originalApproval, originalToken), renamed);
    rebind(target, operatorPrincipal, renamed);completedReads(target, false, renamed);
    target(`alter role ${renamed} rename to ${operator}`);rebind(target);negatives["05_role_rename"] = "PASS";
  });
  test("06 — deleted and recreated login cannot inherit its old binding", () => {
    target(`drop role ${operator};create role ${operator} login password '${password}';grant ingestion_operator to ${operator}`);
    denied(target, retrySql("reprojection", originalApproval, originalToken), operator);rebind(target);negatives["06_role_recreation"] = "PASS";
  });
  test("07 — operator cannot self-enroll or directly edit the registry", () => {
    denied(target, "select ingestion.request_foundation_actor_binding_v1('{}'::json)", operator);
    denied(target, "delete from ingestion.mapping_actor_principals", operator);negatives["07_self_enrollment"] = "PASS";
  });
  test("08 — approver cannot enroll as an operator or change durable authority", () => {
    denied(target, "select ingestion.request_foundation_actor_binding_v1('{}'::json)", approver);
    denied(target, `update ingestion.mapping_actor_principals set authority='operator' where id='${approverPrincipal.principalId}'`, approver);
    negatives["08_approver_operator_enrollment"] = "PASS";
  });
  test("09 — actual authenticated consumer session cannot bind a principal", () => {
    denied(target, "select ingestion.request_foundation_actor_binding_v1('{}'::json)", "full35_actor_authenticated_client");negatives["09_consumer_binding"] = "PASS";
  });
  test("10 — service_role membership and SET ROLE do not bypass authority", () => {
    const user = "full35_actor_service_role_client";
    denied(target, "set role service_role;select ingestion.request_foundation_actor_binding_v1('{}'::json)", user);
    denied(target, "set role service_role;" + retrySql("reprojection", originalApproval, originalToken), user);negatives["10_service_role"] = "PASS";
  });
  test("11 — JWT, GUC and session-authorization claims cannot replace the authenticated principal", () => {
    denied(target, `set role ingestion_operator;set nutrition_tracker.principal_id='${operatorPrincipal.principalId}';
      select set_config('request.jwt.claims','{"principal_id":"${operatorPrincipal.principalId}","role":"ingestion_operator"}',false);
      ${retrySql("reprojection", originalApproval, originalToken)}`, other);
    denied(target, `set session authorization ${operator};${retrySql("reprojection", originalApproval, originalToken)}`, other);
    negatives["11_forged_claims"] = "PASS";
  });
  test("12 — overlapping roles and SET ROLE cannot make a principal its own approver", () => {
    target(`grant ingestion_approver to ${operator}`);
    try { denied(target, retrySql("reprojection", originalApproval, originalToken), operator); }
    finally { target(`revoke ingestion_approver from ${operator}`); }
    denied(target, `set role ingestion_approver;select ingestion.approve_foundation_actor_binding_v1('${operatorPrincipal.requestId}','${fixtureHash("fake")}')`, operator);
    negatives["12_overlap_set_role"] = "PASS";
  });
  test("14 — completed approvals cannot authorize another operation or retry identity", () => {
    denied(target, retrySql("compensation", originalApproval, originalToken), operator);
    denied(target, retrySql("reprojection", originalApproval, fixtureId(999829)), operator);negatives["14_approval_reuse"] = "PASS";
  });
  test("16 — tampered binding bodies, hashes and local marker are rejected with constraints active", () => {
    denied(target, `update ingestion.mapping_actor_bindings set body_hash=repeat('f',64)`, "supabase_admin", /immutable actor identity/);
    denied(target, `insert into ingestion.mapping_actor_bindings select (jsonb_populate_record(null::ingestion.mapping_actor_bindings,
      to_jsonb(t)||jsonb_build_object('id',gen_random_uuid(),'body_hash',repeat('f',64)))).* from ingestion.mapping_actor_bindings t limit 1`, "supabase_admin", /actor identity body or fingerprint/);
    expect(() => target("update private.mapping_actor_cluster_epoch set cluster_id=gen_random_uuid()"))
      .toThrow(/immutable local cluster authorization marker/);negatives["16_tampering"] = "PASS";
  });
  test("17 — missing evidence or missing independent reviewer cannot activate a binding", () => {
    const proposal = proposeActorBinding(target, fixture.datasetId, "full35_actor_unbound", "operator");
    const bad = { ...proposal.request, evidence_hash: null };
    denied(target, `select ingestion.request_foundation_actor_binding_v1(${actorInput(bad)})`, identityGovernor);
    denied(target, `select ingestion.approve_foundation_actor_binding_v1('${proposal.requestId}','${fixtureHash("fake")}')`, identityGovernor);
    denied(target, retrySql("reprojection", originalApproval, originalToken), "full35_actor_unbound");negatives["17_missing_independent_evidence"] = "PASS";
  });
  test("18 — changed catalog fingerprint and stale current pointer fail closed", () => {
    target(`alter role ${operator} set application_name='unverified catalog change'`);
    try { denied(target, retrySql("reprojection", originalApproval, originalToken), operator); }
    finally { target(`alter role ${operator} reset application_name`); }
    const pointer = JSON.parse(target(`select to_jsonb(t) from ingestion.mapping_actor_current_bindings t where principal_id='${operatorPrincipal.principalId}'`));
    const old = JSON.parse(target(`select jsonb_build_object('binding_id',id,'cluster_id',cluster_id,'login_oid',login_oid::bigint,'login_name',login_name,'generation',generation)
      from ingestion.mapping_actor_bindings where principal_id='${operatorPrincipal.principalId}' order by generation limit 1`));
    const set = (row: typeof pointer) => target(`update ingestion.mapping_actor_current_bindings set binding_id='${row.binding_id}',cluster_id='${row.cluster_id}',
      login_oid=${row.login_oid},login_name='${row.login_name}',generation=${row.generation} where principal_id='${operatorPrincipal.principalId}'`);
    set(old);try { denied(target, retrySql("reprojection", originalApproval, originalToken), operator); } finally { set(pointer); }
    negatives["18_stale_binding"] = "PASS";
  });
  test("19 — concurrent conflicting continuity decisions serialize and only one wins", async () => {
    const a = "full35_actor_conflict_a", b = "full35_actor_conflict_b";
    target(`create role ${a} login password '${password}';create role ${b} login password '${password}';grant ingestion_operator to ${a},${b}`);
    const proposals = [proposeActorBinding(target, fixture.datasetId, a, "operator", { principal: operatorPrincipal }),
      proposeActorBinding(target, fixture.datasetId, b, "operator", { principal: operatorPrincipal })];
    const sqls = proposals.map(p => {
      const reviewed = JSON.parse(target(`select ingestion.get_foundation_actor_binding_request_v1('${p.requestId}')`, identityReviewer));
      return `select ingestion.approve_foundation_actor_binding_v1('${p.requestId}','${reviewed.body_hash}')`;
    });
    const blocker = spawn("docker", ["exec", "-i", config.target, "psql", "-U", "supabase_admin", "-d", "postgres", "-X", "-qAt", "-v", "ON_ERROR_STOP=1"]);
    await new Promise<void>((ok, fail) => {
      blocker.on("error", fail);blocker.stdout.on("data", c => { if (String(c).includes("HELD")) ok(); });
      blocker.stdin.write(`begin;select id from ingestion.mapping_actor_principals where id='${operatorPrincipal.principalId}' for update;\n\\echo HELD\n`);
    });
    const asyncSql = (sql: string, label: string) => new Promise<{code: number | null; stderr: string}>(ok => {
      const child = spawn("docker", ["exec", "-e", `PGPASSWORD=${password}`, "-e", `PGAPPNAME=${label}`, "-i", config.target,
        "psql", "-h", "127.0.0.1", "-U", identityReviewer, "-d", "postgres", "-X", "-qAt", "-v", "ON_ERROR_STOP=1"]);
      let stderr = "";child.stderr.on("data", c => stderr += c);child.on("close", code => ok({ code, stderr }));child.stdin.end(sql);
    });
    const before = fingerprint(target, false);
    const attempts = sqls.map((sql, index) => asyncSql(sql, `actor-conflict-${index}`));
    try {
      let waiting = false;
      for (let n = 0; n < 60; n++) {
        waiting = target("select count(*) from pg_stat_activity where application_name in ('actor-conflict-0','actor-conflict-1') and wait_event_type='Lock'") === "2";
        if (waiting) break;await new Promise(ok => setTimeout(ok, 100));
      }
      expect(waiting).toBe(true);
    } finally { blocker.stdin.end("commit;\n\\q\n"); }
    const results = await Promise.all(attempts);
    expect(results.filter(r => r.code === 0)).toHaveLength(1);expect(results.filter(r => r.code !== 0)[0].stderr).toMatch(/stale binding decision/);
    const winner = target(`select login_name from ingestion.mapping_actor_current_bindings where principal_id='${operatorPrincipal.principalId}'`);
    completedReads(target, false, winner);expect(fingerprint(target, false)).toBe(before);rebind(target);negatives["19_concurrent_conflicts"] = "PASS";
  });
  test("20 — dataset/environment and caller-supplied principal substitutions are refused", () => {
    const plan = makePlan(target, true);
    for (const mutate of [(p: MappingPlan) => { p.environment = "production"; }, (p: MappingPlan) => { p.dataset_id = fixtureId(998899); },
      (p: MappingPlan) => { p.actor_authority.operator_principal_id = approverPrincipal.principalId; }]) {
      const wrong = structuredClone(plan);mutate(wrong);
      denied(target, `select ingestion.prepare_foundation_mapping_compensation_v1(${actorInput(wrong)},'${fixtureId(999828)}')`, operator);
    }
    negatives["20_cross_scope"] = "PASS";
  });
  test("13 — permanent revocation denies completed reads and cannot revive through an old binding", () => {
    completedReads(target);
    const proposal = proposeActorBinding(target, fixture.datasetId, operator, "operator", { principal: operatorPrincipal, action: "revoke" });
    approveActorBinding(target, proposal);
    denied(target, retrySql("reprojection", originalApproval, originalToken), operator);
    denied(target, `select ingestion.get_foundation_mapping_reprojection_receipt_v1('${originalApproval}')`, operator);
    expect(() => rebind(target)).toThrow(/permanently revoked/);negatives["13_revocation"] = "PASS";
  });
  test.afterAll(() => {
    rmSync(config.scratch, { recursive: true, force: true });
    if (Object.keys(negatives).length === 20) {
      // Pending authority (15) and legitimate continuity (1) are exercised in B.
      expect(negatives["01_verified_oid_change_completed_read"]).toBe("PASS");
      writeFileSync(join(evidence, "durable-actor-qualification.json"), JSON.stringify({ task: "NUTRITION-USDA-FULL35-DURABLE-ACTOR-IDENTITY-001",
        result: "PASS", recoveryHistory47Qualified: false, principalIds: { operator: operatorPrincipal.principalId, approver: approverPrincipal.principalId },
        checkpoints, continuityEvidence, securityCases: negatives,
        originalReceiptHash: source(`select receipt_hash from ingestion.mapping_reprojection_receipts where approval_id='${originalApproval}'`),
        compensationReceiptHash: source(`select receipt_hash from ingestion.mapping_reprojection_receipts where approval_id='${compensationApproval}'`),
        originalAuditOidsUnchanged: true, completedRetriesAppendNoRows: true, productionAccess: false }, null, 2) + "\n", { mode: 0o600 });
    }
  });
});
