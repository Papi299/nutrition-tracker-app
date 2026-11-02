import { execFileSync, spawn } from "node:child_process";
import { createHash, randomBytes } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { canonicalizeJson, type JsonValue } from "@/ingestion/usda/foundation/canonical-json";
import { parseFoundationArchive } from "@/ingestion/usda/foundation/parser";
import { normalizeFoundationRecord } from "@/ingestion/usda/foundation/normalization";
import { extractFoundationFull35Json } from "@/ingestion/usda/foundation/full35/archive";
import { buildMappingPlan, fingerprintMappingPlan, selectMappingActorAuthority, type MappingActorScope, type MappingScopeSnapshot } from "@/ingestion/usda/foundation/reprojection/contracts";
import { installSyntheticBaseline, fixtureId, fixtureHash, mappingId, excludedIds, syntheticReprojectionRecords } from "./foundation-full35-reprojection";
import { bindActor, installIdentityControllers } from "./foundation-full35-actor-identity";

export function installApplicationTransition() {
  if (process.env.DATE_E2E_LOCAL_SUPABASE !== "1" ||
    !["127.0.0.1", "localhost"].includes(new URL(process.env.LOCAL_SUPABASE_URL ?? "https://invalid").hostname)) {
    throw new Error("An explicit disposable local application environment is required.");
  }
  const project = readFileSync("supabase/config.toml", "utf8").match(/^project_id\s*=\s*"([^"]+)"/m)?.[1];
  if (!project || !/^[a-zA-Z0-9_-]+$/.test(project)) throw new Error("Invalid local project.");
  const container = `supabase_db_${project}`;
  const password = randomBytes(24).toString("hex");
  const operator = "full35_app_operator", approver = "full35_app_approver", consumer = "full35_app_consumer";
  function args(user: string) {
    return ["exec", "-e", `PGPASSWORD=${password}`, "-i", container, "psql",
      ...(user === "supabase_admin" ? [] : ["-h", "127.0.0.1"]), "-U", user, "-d", "postgres", "-X", "-qAt", "-v", "ON_ERROR_STOP=1"];
  }
  function query(sql: string, user = "supabase_admin") {
    try {
      return execFileSync("docker", args(user), { input: sql, encoding: "utf8", maxBuffer: 64 * 1024 * 1024, stdio: ["pipe", "pipe", "pipe"] }).trim();
    } catch (error) {
      // Keep generated LOGIN credentials out of command-line diagnostics.
      throw new Error(`Local qualification SQL failed: ${String((error as { stderr?: unknown }).stderr ?? "unknown error").slice(-1800)}`);
    }
  }
  function asyncQuery(sql: string, user = operator) {
    return new Promise<string>((ok, fail) => {
      const child = spawn("docker", args(user)); let output = "", error = "";
      child.stdout.on("data", data => output += data); child.stderr.on("data", data => error += data);
      child.on("error", fail); child.on("close", code => code === 0 ? ok(output.trim()) : fail(new Error(error)));
      child.stdin.end(sql);
    });
  }
  const visibilityLock = "73535001";
  async function holdReferenceReader() {
    const child = spawn("docker", args("supabase_admin"));
    let output = "", error = "", ready = false;
    const closed = new Promise<number | null>(ok => child.once("close", ok));
    await new Promise<void>((ok, fail) => {
      child.stdout.on("data", data => {
        output += data;
        if (!ready && output.includes("stage5_reader_barrier_ready")) { ready = true; ok(); }
      });
      child.stderr.on("data", data => error += data);
      child.once("error", fail);
      child.once("close", () => { if (!ready) fail(new Error(`Local reader barrier failed: ${error}`)); });
      child.stdin.write(`select pg_advisory_lock(${visibilityLock});select 'stage5_reader_barrier_ready';\n`);
    });
    return async () => {
      child.stdin.end(`select pg_advisory_unlock(${visibilityLock});\n\\q\n`);
      if (await closed !== 0) throw new Error(`Local reader barrier cleanup failed: ${error}`);
    };
  }
  const json = <T>(sql: string, user?: string): T => JSON.parse(query(sql, user));
  query(`create role ${operator} login password '${password}';create role ${approver} login password '${password}';
    create role ${consumer} login password '${password}';grant authenticated to ${consumer};
    grant ingestion_operator to ${operator};grant ingestion_approver to ${approver};`);
  // Fix reference revisions without disabling any existing trigger, RLS or
  // constraint. This invoker-only fixture clock changes timestamps alone;
  // governance validity continues to use the real current transaction clock.
  query(`begin;create schema full35_app_fixture;
    revoke all on schema full35_app_fixture from public,anon,authenticated,service_role;
    create function full35_app_fixture.reference_revision() returns trigger language plpgsql security invoker as $$
    begin new.updated_at:=tg_argv[0]::timestamptz;
      if tg_op='INSERT' then new.created_at:=tg_argv[0]::timestamptz;end if;return new;end;$$;
    create trigger zz_full35_source_revision before update on public.food_sources for each row
      execute function full35_app_fixture.reference_revision('2026-11-01T00:00:00Z');
    update public.food_sources set updated_at='2026-11-01T00:00:00Z' where code='usda';
    drop trigger zz_full35_source_revision on public.food_sources;
    create trigger zz_full35_food_revision before insert on public.foods for each row
      execute function full35_app_fixture.reference_revision('2026-11-01T00:00:00Z');
    create trigger zz_full35_nutrient_revision before insert on public.food_nutrients for each row
      execute function full35_app_fixture.reference_revision('2026-11-01T00:00:00Z');commit;`);
  let records = syntheticReprojectionRecords();
  const archivePath = process.env.FULL35_APPROVED_SOURCE_ARCHIVE;
  if (archivePath) {
    const bytes = readFileSync(archivePath);
    if (createHash("sha256").update(bytes).digest("hex") !== "186e988ec542e913f51ef62b86a47758e8cdd0d1dc3889e7b055581f3c09c77a") throw new Error("Unapproved source archive.");
    const text = extractFoundationFull35Json(bytes, "FoodData_Central_foundation_food_json_2026-04-30.json");
    if (createHash("sha256").update(text).digest("hex") !== "27d1fe3fd89edfbe528ed915da5619320e1d004d4594603a1b19bdb1511590cc") throw new Error("Unapproved source member.");
    const archive = parseFoundationArchive(text);
    archive.records = archive.records.filter(record => !excludedIds.includes(String(record.raw.fdcId)));
    if (archive.records.length !== 353) throw new Error("Expected exact accepted source membership.");
    const identities = archive.records.map((record, i) => ({ fdc_id: String(record.raw.fdcId), source_record_id: fixtureId(i * 3 + 1),
      source_version_id: fixtureId(i * 3 + 2), raw_content_sha256: record.rawContentSha256 }));
    records = { archive, identities, legacy: archive.records.map(record => normalizeFoundationRecord(record)) };
  }
  const fixture = installSyntheticBaseline(query, records);
  query(`drop trigger zz_full35_food_revision on public.foods;drop trigger zz_full35_nutrient_revision on public.food_nutrients;
    create trigger zz_full35_nutrient_revision before insert on public.food_nutrients for each row
      execute function full35_app_fixture.reference_revision('2026-11-02T00:00:00Z');`);
  installIdentityControllers(query, password);
  bindActor(query, fixture.datasetId, operator, "operator"); bindActor(query, fixture.datasetId, approver, "approver");
  const scope = json<MappingScopeSnapshot>("select ingestion.get_foundation_mapping_reprojection_scope_v1('local')->'before_snapshot'", operator);
  const migrations = readdirSync("supabase/migrations").filter(name => name.endsWith(".sql")).sort().map(filename => ({ filename,
    version: filename.split("_")[0], sha256: createHash("sha256").update(readFileSync(`supabase/migrations/${filename}`)).digest("hex") }));
  if (migrations.length !== 47 || migrations[46].sha256 !== "086f5c27a0270d6452db18b89e89c685c9ed5b677e0e841535d192c5408613af") throw new Error("Migration identity drift.");
  const plan = buildMappingPlan({ operation_kind: "reprojection", dataset_id: fixture.datasetId, environment: "local",
    source_release_id: fixture.releaseId, mapping_version_id: mappingId, before_snapshot: scope,
    actor_authority: selectMappingActorAuthority(json<MappingActorScope>("select ingestion.get_foundation_mapping_reprojection_scope_v1('local')->'actor_authority'", operator), approver),
    approval_requirements: { approver_oid: Number(query(`select oid from pg_roles where rolname='${approver}'`)),
      not_before: new Date(Date.now() - 60_000).toISOString(), expires_at: new Date(Date.now() + 3_600_000).toISOString() },
    operator_oid: Number(query(`select oid from pg_roles where rolname='${operator}'`)), operator_login: operator,
    implementation: { database_contract_hash: query("select ingestion.get_foundation_mapping_reprojection_scope_v1('local')->>'database_contract_hash'", operator),
      commit: process.env.FULL35_APP_SOURCE_COMMIT ?? execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(),
      tree: process.env.FULL35_APP_SOURCE_TREE ?? execFileSync("git", ["rev-parse", "HEAD^{tree}"], { encoding: "utf8" }).trim(),
      migrations, contract_versions: { parser: "usda-fdc-foundation-json/v1", importer: "usda-foundation-importer/v3", candidate: "foundation-normalized-candidate/v2",
        mapping: "usda-foundation-full35-direct-v2", projection: "foundation-lifecycle-projection/v2" } },
    qualification: { ...fixture.source, historical_allowance_fingerprint: "bdfc95e5009a8d5c5a5bbf82b24dff1a4e8c3decd7bee4406286c543e661ad4a",
      rejected: JSON.parse(readFileSync("docs/evidence/nutrition-usda-full35-local-qual-001/qualification.json", "utf8")).source_inspection.rejected_records,
      source_qualification_hash: fixtureHash(archivePath ? "pinned-official-source-values-synthetic-local-identities" : "accepted-synthetic-oracle") },
    recovery_requirements: { qualification_hash: fixtureHash("accepted-local-only-stage4b-boundary"), production_ready: false },
    rejected_receipt_id: null, records: fixture.records });
  const canonical = (value: unknown) => `'${canonicalizeJson(value as JsonValue).replaceAll("'", "''")}'::json`;
  const token = fixtureId(998800);
  const planId = query(`select ingestion.prepare_foundation_mapping_reprojection_v1(${canonical(plan)},'${token}')`, operator);
  const approvalId = query(`select ingestion.approve_foundation_mapping_reprojection_v1('${planId}','${fingerprintMappingPlan(plan)}',
    '${plan.approval_requirements.expires_at}'::timestamptz,${canonical({ independent_review_hash: fixtureHash("synthetic independent app qualification"),
      recovery_evidence_hash: plan.recovery_requirements.qualification_hash, approval_reference: "synthetic-independent-stage5" })})`, approver);
  return { query, asyncQuery, holdReferenceReader, visibilityLock, json, fixture, plan, planId, approvalId, token, operator, approver, consumer,
    sourceMode: archivePath ? "verified official source values; synthetic local identity/release/governance" : "deterministic synthetic source values and identities",
    execution: `select ingestion.execute_foundation_mapping_reprojection_v1('${approvalId}','${token}');` };
}
