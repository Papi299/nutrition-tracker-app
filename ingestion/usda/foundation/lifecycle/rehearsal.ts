import { execFileSync, spawn } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { mkdirSync, readFileSync, statSync, writeFileSync, chmodSync } from "node:fs";
import { join, resolve } from "node:path";
import { performance } from "node:perf_hooks";
import {
  attachContractFingerprint,
  foundationLifecycleAllowanceContractVersion,
  foundationLifecyclePolicyVersion,
  foundationReconciliationDecisionContractVersion,
  foundationReleaseDiffContractVersion,
  foundationReleaseScopeContractVersion,
  parseFoundationLifecycleUpdateReceiptV2,
} from "../../../contracts/foundation-lifecycle.ts";
import {
  createFoundationLifecycleRehearsalSummary,
  foundationLifecycleOverlayPolicyVersion,
  foundationLifecycleRehearsalContractVersion,
} from "../../../contracts/foundation-lifecycle-rehearsal.ts";
import { fingerprintSourceReleaseManifest } from "../../../contracts/source-release-manifest.ts";
import { fingerprintJson, type JsonValue } from "../canonical-json.ts";
import { runFoundationDryRun } from "../dry-run.ts";
import { foundationImporterContractVersion, foundationRejectPolicyVersion, foundationSchemaContractVersion } from "../contract.ts";
import { foundationNutrientMappingHash, foundationNutrientMappingVersion } from "../nutrient-mapping.ts";
import { serializeFoundationReleaseDiff, createFoundationReleaseDiff } from "./diff.ts";
import { createReleaseBOverlay, createReleaseCOverlay } from "./rehearsal-overlay.ts";
import type {
  FoundationCurrentConcept,
  FoundationLifecycleCandidate,
  FoundationLifecycleDiffInput,
  FoundationLifecycleDiffReport,
} from "./types.ts";

const expectedArchiveHash = "186e988ec542e913f51ef62b86a47758e8cdd0d1dc3889e7b055581f3c09c77a";
const expectedManifestFingerprint = "ad3a51cbb0b3c6bbafd98d8bd59d996e10ac8cc4d82f22d8695d3a2838a8c2b0";
const expectedReportFingerprint = "d845d61308d411673dd04651a50bb437ae3f0c6429c4d79c5af5ac055f0d9b5f";
const expectedBaseSha = "08a9aff498cc1099af0ba15b400f9188f7c9cf86";
const projectId = readFileSync("supabase/config.toml", "utf8")
  .match(/^project_id\s*=\s*"([^"]+)"/m)?.[1];
if (!projectId) throw new Error("Could not read the local Supabase project id.");
const databaseContainer = `supabase_db_${projectId}`;
let localDatabasePassword: string | null = null;

const argumentNames = new Set([
  "--archive", "--json", "--manifest", "--reject-allowance",
  "--promotion-approval", "--output-dir",
]);

function fail(message: string): never { throw new Error(message); }
function progress(stage: string) {
  process.stderr.write(`${JSON.stringify({ contract: foundationLifecycleRehearsalContractVersion, stage })}\n`);
}

function parseArguments(values: string[]) {
  const result = new Map<string, string>();
  const preparedIndex = values.indexOf("--prepared-local");
  if (preparedIndex >= 0) {
    values = values.toSpliced(preparedIndex, 1);
    result.set("--prepared-local", "true");
  }
  for (let index = 0; index < values.length; index += 2) {
    const name = values[index];
    const value = values[index + 1];
    if (!argumentNames.has(name) || !value || value.startsWith("--") || result.has(name)) {
      fail("Expected one value for every approved lifecycle-rehearsal argument.");
    }
    result.set(name, value);
  }
  if (result.size !== argumentNames.size + (result.has("--prepared-local") ? 1 : 0)) {
    fail("--archive, --json, --manifest, --reject-allowance, --promotion-approval, and --output-dir are required.");
  }
  return result;
}

function sha256(value: Uint8Array | string) {
  return createHash("sha256").update(value).digest("hex");
}

function command(name: string, args: string[], options: { quiet?: boolean } = {}) {
  const result = execFileSync(name, args, {
    encoding: "utf8", maxBuffer: 128 * 1024 * 1024,
    stdio: options.quiet ? ["ignore", "pipe", "pipe"] : ["ignore", "pipe", "pipe"],
  });
  return result.trim();
}

function sqlText(value: string) { return `'${value.replaceAll("'", "''")}'`; }
function sqlJson(value: unknown) { return `${sqlText(JSON.stringify(value))}::jsonb`; }

function database(sql: string) {
  return execFileSync("docker", [
    "exec", "-i", databaseContainer, "psql", "-U", "postgres", "-d", "postgres",
    "-v", "ON_ERROR_STOP=1", "-q", "-At",
  ], { input: sql, encoding: "utf8", maxBuffer: 128 * 1024 * 1024 }).trim();
}

function databaseAsAdmin(sql: string, databaseName = "postgres") {
  if (!localDatabasePassword) fail("Local database credentials were not discovered.");
  return execFileSync("docker", [
    "exec", "-e", `PGPASSWORD=${localDatabasePassword}`, "-i", databaseContainer,
    "psql", "-h", "127.0.0.1", "-U", "supabase_admin", "-d", databaseName,
    "-v", "ON_ERROR_STOP=1", "-q", "-At",
  ], { input: sql, encoding: "utf8", maxBuffer: 128 * 1024 * 1024 }).trim();
}

function databaseJson<T>(sql: string): T {
  const output = database(sql);
  const line = output.split(/\r?\n/).filter(Boolean).at(-1);
  if (!line) fail("Local database did not return JSON evidence.");
  return JSON.parse(line) as T;
}

function bootstrapBaseline() {
  const output = databaseAsAdmin(`
    begin;
    create temporary table context as
      select id receipt_id from ingestion.foundation_promotion_receipts limit 1;
    grant select on context to ingestion_operator;
    set local role ingestion_operator;
    select pg_catalog.to_jsonb(result)::text
    from context cross join lateral
      ingestion.bootstrap_foundation_lifecycle_baseline(context.receipt_id) result;
    commit;
  `);
  const line = output.split(/\r?\n/).filter(Boolean).at(-1);
  if (!line) fail("Baseline bootstrap evidence was not returned.");
  return JSON.parse(line) as Record<string, JsonValue>;
}

function roleCall(role: "ingestion_operator" | "ingestion_approver" | "ingestion_lifecycle_definer", expression: string) {
  return databaseAsAdmin(`
    begin;
    set local role ${role};
    ${expression}
    commit;
  `).split(/\r?\n/).filter(Boolean).at(-1) ?? "";
}

function roleCallAsync(
  role: "ingestion_operator" | "ingestion_approver" | "ingestion_lifecycle_definer",
  expression: string,
) {
  return new Promise<string>((resolvePromise, rejectPromise) => {
    if (!localDatabasePassword) return rejectPromise(new Error("Local database credentials were not discovered."));
    const child = spawn("docker", [
      "exec", "-e", `PGPASSWORD=${localDatabasePassword}`, "-i", databaseContainer,
      "psql", "-h", "127.0.0.1", "-U", "supabase_admin", "-d", "postgres",
      "-v", "ON_ERROR_STOP=1", "-q", "-At",
    ], { stdio: ["pipe", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8").on("data", (value) => { stdout += value; });
    child.stderr.setEncoding("utf8").on("data", (value) => { stderr += value; });
    child.on("error", rejectPromise);
    child.on("close", (code) => {
      if (code !== 0) return rejectPromise(new Error(stderr.trim() || "Concurrent local role call failed."));
      resolvePromise(stdout.trim().split(/\r?\n/).filter(Boolean).at(-1) ?? "");
    });
    child.stdin.end(`begin; set local role ${role}; ${expression} commit;`);
  });
}

function lifecycleStateFingerprint() {
  return databaseAsAdmin(`
    begin;
    set local role ingestion_lifecycle_definer;
    select ingestion.fingerprint_json_v1(pg_catalog.jsonb_build_object(
      'foods',(select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
        'id',x.id,'source_id',x.source_id,'source_food_id',x.source_food_id,
        'name',x.name,'is_archived',x.is_archived
      ) order by x.id) from public.foods x),
      'nutrients',(select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
        'id',x.id,'food_id',x.food_id,'nutrient_id',x.nutrient_id,
        'amount',x.amount,'basis',x.basis
      ) order by x.id) from public.food_nutrients x),
      'heads',(select pg_catalog.jsonb_agg(pg_catalog.to_jsonb(x) order by x.id) from ingestion.dataset_projection_heads x),
      'receipts',(select pg_catalog.jsonb_agg(pg_catalog.to_jsonb(x) order by x.id) from ingestion.lifecycle_update_receipts x)
    ));
    commit;
  `).split(/\r?\n/).filter(Boolean).at(-1) ?? "";
}

function requireLocalSupabase() {
  for (const key of ["DATABASE_URL", "SUPABASE_DB_URL", "SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_URL"]) {
    const value = process.env[key];
    if (!value) continue;
    const host = new URL(value).hostname;
    if (!new Set(["127.0.0.1", "localhost", "host.docker.internal"]).has(host)) {
      fail(`Refusing to use nonlocal ${key}.`);
    }
  }
  const status = command("npx", ["supabase", "status", "-o", "env"], { quiet: true });
  const url = status.match(/^API_URL="?([^"\n]+)"?$/m)?.[1];
  const databaseUrl = status.match(/^DB_URL="?([^"\n]+)"?$/m)?.[1];
  if (!url || !new Set(["127.0.0.1", "localhost"]).has(new URL(url).hostname)) {
    fail("A healthy local-only Supabase stack is required.");
  }
  if (!databaseUrl || !new Set(["127.0.0.1", "localhost"]).has(new URL(databaseUrl).hostname)) {
    fail("A local-only database connection is required.");
  }
  localDatabasePassword = decodeURIComponent(new URL(databaseUrl).password);
  if (!localDatabasePassword) fail("Local database credentials are unavailable.");
}

function cleanupLocalOperatorMemberships() {
  databaseAsAdmin(`
    revoke ingestion_operator, ingestion_approver,
      ingestion_lifecycle_definer from postgres;
  `);
}

function aggregateEvidence() {
  return databaseJson<Record<string, JsonValue>>(`select pg_catalog.jsonb_build_object(
    'foods',(select count(*) from public.foods),
    'foundation_foods',(select count(*) from public.foods foods join public.food_sources sources on sources.id=foods.source_id where sources.code='usda' and foods.food_type='generic' and foods.is_public),
    'nutrients',(select count(*) from public.food_nutrients),
    'portions',(select count(*) from ingestion.food_portions),
    'source_records',(select count(*) from ingestion.source_records),
    'source_versions',(select count(*) from ingestion.source_record_versions),
    'source_links',(select count(*) from ingestion.food_source_links),
    'evidence',(select count(*) from ingestion.food_nutrient_evidence),
    'aliases',(select count(*) from public.food_aliases),
    'barcodes',(select count(*) from public.food_barcodes),
    'diary_entries',(select count(*) from public.diary_entries),
    'saved_meals',(select count(*) from public.saved_meals),
    'recipes',(select count(*) from public.recipes),
    'rls_policies',(select count(*) from pg_catalog.pg_policies),
    'database_bytes',pg_catalog.pg_database_size(pg_catalog.current_database()),
    'migration_count',(select count(*) from supabase_migrations.schema_migrations),
    'final_migration',(select max(version) from supabase_migrations.schema_migrations)
  )::text;`);
}

function snapshotEvidence(databaseName = "postgres") {
  const output = databaseAsAdmin(`with body as (
    select pg_catalog.jsonb_build_object(
      'profiles',coalesce((select pg_catalog.jsonb_agg(pg_catalog.to_jsonb(x) order by x.id) from (select id,display_name,preferred_language,unit_system from public.profiles) x),'[]'::jsonb),
      'targets',coalesce((select pg_catalog.jsonb_agg(pg_catalog.to_jsonb(x) order by x.id) from (select id,user_id,effective_from,calories,protein_g,carbohydrates_g,fat_g from public.nutrition_targets) x),'[]'::jsonb),
      'diary',coalesce((select pg_catalog.jsonb_agg(pg_catalog.to_jsonb(x) order by x.id) from (select id,user_id,food_id,entry_date,meal_type,food_name,serving_quantity,serving_unit,calories,protein_g,carbohydrates_g,fat_g,source from public.diary_entries) x),'[]'::jsonb),
      'favorites',coalesce((select pg_catalog.jsonb_agg(pg_catalog.to_jsonb(x) order by x.user_id,x.food_id) from (select user_id,food_id from public.food_favorites) x),'[]'::jsonb),
      'saved_meals',coalesce((select pg_catalog.jsonb_agg(pg_catalog.to_jsonb(x) order by x.id) from (select id,user_id,name,locale,is_archived from public.saved_meals) x),'[]'::jsonb),
      'saved_items',coalesce((select pg_catalog.jsonb_agg(pg_catalog.to_jsonb(x) order by x.id) from (select id,saved_meal_id,position,food_id,food_name,serving_quantity,serving_unit,calories,protein_g,carbohydrates_g,fat_g from public.saved_meal_items) x),'[]'::jsonb),
      'recipes',coalesce((select pg_catalog.jsonb_agg(pg_catalog.to_jsonb(x) order by x.id) from (select id,user_id,name,locale,yield_servings,is_archived from public.recipes) x),'[]'::jsonb),
      'ingredients',coalesce((select pg_catalog.jsonb_agg(pg_catalog.to_jsonb(x) order by x.id) from (select id,recipe_id,position,food_id,ingredient_name,quantity,unit,calories,protein_g,carbohydrates_g,fat_g from public.recipe_ingredients) x),'[]'::jsonb)
    ) value
  ) select pg_catalog.jsonb_build_object('body',value,'fingerprint',encode(extensions.digest(convert_to(value::text,'UTF8'),'sha256'),'hex'))::text from body;`, databaseName);
  const line = output.split(/\r?\n/).filter(Boolean).at(-1);
  if (!line) fail("Application snapshot evidence was not returned.");
  return JSON.parse(line) as { body: JsonValue; fingerprint: string };
}

function applicationReadEvidence(databaseName = "postgres") {
  const output = databaseAsAdmin(`
    begin;
    create temporary table rehearsal_timings(kind text, duration_ms numeric);
    create temporary table rehearsal_application_evidence(body jsonb);
    grant select,insert on rehearsal_timings,rehearsal_application_evidence
      to authenticated;
    set local role authenticated;
    select pg_catalog.set_config(
      'request.jwt.claim.sub','70000000-0000-4000-8000-000000000001',true
    );
    do $block$
    declare
      query_text text;
      selected_food_id uuid;
      started_at timestamptz;
    begin
      select left(foods.name,least(8,char_length(foods.name))),foods.id
      into query_text,selected_food_id
      from public.foods foods join public.food_sources sources
        on sources.id=foods.source_id
      where sources.code='usda' and foods.is_public and not foods.is_archived
      order by foods.source_food_id collate "C" limit 1;
      for iteration in 1..25 loop
        started_at:=clock_timestamp();
        perform count(*) from public.search_readable_foods(query_text);
        insert into rehearsal_timings values (
          'search',extract(epoch from clock_timestamp()-started_at)*1000
        );
        started_at:=clock_timestamp();
        perform count(*) from public.get_readable_food_diary_prefill(selected_food_id);
        insert into rehearsal_timings values (
          'prefill',extract(epoch from clock_timestamp()-started_at)*1000
        );
      end loop;
      insert into rehearsal_application_evidence
      select pg_catalog.jsonb_build_object(
        'search',coalesce((select pg_catalog.jsonb_agg(pg_catalog.to_jsonb(results)
          order by results.food_id) from public.search_readable_foods(query_text) results),'[]'::jsonb),
        'prefill',coalesce((select pg_catalog.jsonb_agg(pg_catalog.to_jsonb(results)
          order by results.food_id) from public.get_readable_food_diary_prefill(selected_food_id) results),'[]'::jsonb)
      );
    end
    $block$;
    reset role;
    select pg_catalog.jsonb_build_object(
      'fingerprint',encode(extensions.digest(convert_to(body::text,'UTF8'),'sha256'),'hex'),
      'search_p95_ms',(select percentile_cont(0.95) within group(order by duration_ms)
        from rehearsal_timings where kind='search'),
      'prefill_p95_ms',(select percentile_cont(0.95) within group(order by duration_ms)
        from rehearsal_timings where kind='prefill')
    )::text from rehearsal_application_evidence;
    commit;
  `, databaseName);
  const line = output.split(/\r?\n/).filter(Boolean).at(-1);
  if (!line) fail("Application read evidence was not returned.");
  return JSON.parse(line) as { fingerprint: string; search_p95_ms: number; prefill_p95_ms: number };
}

function createApplicationSnapshots() {
  database(`
    begin;
    insert into auth.users (
      id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,
      raw_app_meta_data,raw_user_meta_data,created_at,updated_at
    ) values (
      '70000000-0000-4000-8000-000000000001',
      '00000000-0000-0000-0000-000000000000','authenticated','authenticated',
      'phase10e4-local@example.test',crypt('Phase10E4LocalOnly!',gen_salt('bf')),
      now(),'{}','{}',now(),now()
    );
    insert into public.profiles (id,display_name,preferred_language,unit_system)
      values ('70000000-0000-4000-8000-000000000001','Synthetic rehearsal user','he','metric');
    insert into public.nutrition_targets (id,user_id,effective_from,calories,protein_g,carbohydrates_g,fat_g)
      values ('70000000-0000-4000-8000-000000000002','70000000-0000-4000-8000-000000000001','2026-07-21',2000,100,220,70);
    with selected as (
      select foods.id,foods.name from public.foods foods join public.food_sources sources on sources.id=foods.source_id
      where sources.code='usda' and foods.is_public order by foods.source_food_id collate "C" limit 1
    ), nutrients as (
      select selected.id,selected.name,
        max(rows.amount) filter(where catalog.code='energy_kcal') calories,
        max(rows.amount) filter(where catalog.code='protein_g') protein,
        max(rows.amount) filter(where catalog.code='carbohydrates_g') carbs,
        max(rows.amount) filter(where catalog.code='fat_g') fat
      from selected left join public.food_nutrients rows on rows.food_id=selected.id
      left join public.nutrients catalog on catalog.id=rows.nutrient_id group by selected.id,selected.name
    )
    insert into public.diary_entries (id,user_id,entry_date,meal_type,food_id,food_name,serving_quantity,serving_unit,calories,protein_g,carbohydrates_g,fat_g,source)
      select '70000000-0000-4000-8000-000000000003','70000000-0000-4000-8000-000000000001','2026-07-21','lunch',id,name,100,'g',round(calories),protein,carbs,fat,'manual' from nutrients;
    insert into public.food_favorites (user_id,food_id)
      select '70000000-0000-4000-8000-000000000001',food_id from public.diary_entries where id='70000000-0000-4000-8000-000000000003';
    insert into public.saved_meals (id,user_id,name,locale)
      values ('70000000-0000-4000-8000-000000000004','70000000-0000-4000-8000-000000000001','Synthetic saved snapshot','en');
    insert into public.saved_meal_items (id,saved_meal_id,position,food_id,food_name,serving_quantity,serving_unit,calories,protein_g,carbohydrates_g,fat_g)
      select '70000000-0000-4000-8000-000000000005','70000000-0000-4000-8000-000000000004',1,food_id,food_name,serving_quantity,serving_unit,calories,protein_g,carbohydrates_g,fat_g from public.diary_entries where id='70000000-0000-4000-8000-000000000003';
    insert into public.recipes (id,user_id,name,locale,yield_servings)
      values ('70000000-0000-4000-8000-000000000006','70000000-0000-4000-8000-000000000001','Synthetic recipe snapshot','he',2);
    insert into public.recipe_ingredients (id,recipe_id,position,food_id,ingredient_name,quantity,unit,calories,protein_g,carbohydrates_g,fat_g)
      select '70000000-0000-4000-8000-000000000007','70000000-0000-4000-8000-000000000006',1,food_id,food_name,serving_quantity,serving_unit,calories,protein_g,carbohydrates_g,fat_g from public.diary_entries where id='70000000-0000-4000-8000-000000000003';
    commit;
  `);
}

type HeadContext = {
  dataset_id: string; prior_release_id: string; prior_release_fingerprint: string;
  head_id: string; head_version: number; head_fingerprint: string;
};

function headContext(): HeadContext {
  return databaseJson<HeadContext>(`select pg_catalog.jsonb_build_object(
    'dataset_id',heads.dataset_id,'prior_release_id',heads.current_source_release_id,
    'prior_release_fingerprint',releases.manifest_fingerprint,'head_id',heads.id,
    'head_version',heads.head_version,'head_fingerprint',heads.dataset_projection_fingerprint
  )::text from ingestion.dataset_projection_current_heads current_heads
  join ingestion.dataset_projection_heads heads on heads.id=current_heads.current_dataset_projection_head_id
  join ingestion.source_releases releases on releases.id=heads.current_source_release_id
  where current_heads.environment='local';`);
}

function currentConcepts(): FoundationCurrentConcept[] {
  const output = databaseAsAdmin(`begin;
  set local role ingestion_lifecycle_definer;
  select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
    'food_id',heads.food_id,'source_record_id',heads.source_record_id,
    'source_record_version_id',heads.source_record_version_id,
    'concept_key',records.concept_key,'upstream_version_key',versions.upstream_version_key,
    'raw_payload_hash',versions.content_sha256,
    'normalized_candidate_hash',projections.normalized_candidate_hash,
    'source_metadata_hash',projections.source_metadata_hash,
    'lifecycle_state',heads.lifecycle_state,
    'projection',ingestion.foundation_lifecycle_projection_version_body_v1(heads.food_projection_version_id)
  ) order by records.concept_key collate "C"),'[]'::jsonb)::text
  from ingestion.food_projection_heads heads
  join ingestion.source_records records on records.id=heads.source_record_id
  join ingestion.source_record_versions versions on versions.id=heads.source_record_version_id
  join ingestion.food_projection_versions projections on projections.id=heads.food_projection_version_id
  where heads.environment='local';
  commit;`);
  const line = output.split(/\r?\n/).filter(Boolean).at(-1);
  if (!line) fail("Local lifecycle concepts were not returned.");
  return JSON.parse(line) as FoundationCurrentConcept[];
}

function stageCandidates(runId: string, candidates: readonly FoundationLifecycleCandidate[]) {
  const lines = ["begin;", "set local role ingestion_operator;", "create temporary table staged_ids(source_row_key text primary key, id uuid);" ];
  candidates.forEach((item, index) => {
    const raw = { synthetic_rehearsal_only: true, ordinal: index + 1 };
    lines.push(`insert into staged_ids values (${sqlText(item.source_row_key)},ingestion.stage_source_record(${sqlText(runId)}::uuid,${sqlText(item.source_row_key)},${sqlText(item.raw_payload_hash)},${sqlJson(raw)},now()+interval '1 day'));`);
  });
  lines.push(`select ingestion.transition_import_run(${sqlText(runId)}::uuid,'created','staged','Synthetic Phase 10E.4 operator');`);
  candidates.forEach((item) => {
    const normalized = item.normalized_candidate;
    if (item.validation_status === "rejected") {
      lines.push(`select ingestion.record_import_run_item(${sqlText(runId)}::uuid,null,${sqlText(item.source_row_key)},'reject','rejected',${sqlText(item.reject_category!)},null);`);
    } else {
      lines.push(`select ingestion.stage_candidate(${sqlText(runId)}::uuid,(select id from staged_ids where source_row_key=${sqlText(item.source_row_key)}),${sqlText(item.source_row_key)},${normalized?.concept_key ? sqlText(normalized.concept_key) : "null"},${normalized ? sqlText(normalized.upstream_version_key) : "null"},${normalized ? sqlText(normalized.content_fingerprint) : "null"},${normalized ? sqlJson(normalized) : "null"},${sqlText(item.validation_status)},null,${normalized?.warning_categories.length ?? 0},now()+interval '1 day');`);
    }
  });
  lines.push("commit;");
  databaseAsAdmin(lines.join("\n"));
}

function registerDecision(input: {
  report: FoundationLifecycleDiffReport; conceptKey: string; decisionType: string;
  datasetId: string; releaseId: string; label: string;
}) {
  const diffItem = input.report.items.find((item) =>
    item.classification === "missing_prior_concept" && item.concept_key === input.conceptKey,
  );
  const current = currentConcepts().find((item) => item.concept_key === input.conceptKey);
  if (!diffItem || !current) fail(`Missing decision identity was not found: ${input.label}.`);
  const itemBody = {
    source_record_id: current.source_record_id,
    source_record_version_id: current.source_record_version_id,
    related_source_record_id: null,
    food_id: current.food_id,
    diff_item_fingerprint: diffItem.item_fingerprint,
  };
  const contract = attachContractFingerprint({
    contract_version: foundationReconciliationDecisionContractVersion,
    dataset_id: input.datasetId, source_release_id: input.releaseId,
    environment: "local", decision_type: input.decisionType,
    relationship_direction: "none",
    reason: "Synthetic complete-snapshot lifecycle rehearsal decision",
    evidence_references: [`synthetic_rehearsal_only:${input.label}`],
    reviewer_identity: "Synthetic Phase 10E.4 lifecycle approver",
    approval_reference: `phase-10e4-${input.label}`,
    approval_timestamp: "2026-07-21T12:00:00Z",
    expires_at: "2026-08-21T12:00:00Z", supersedes_decision_id: null,
    items: [{ ...itemBody, item_fingerprint: fingerprintJson(itemBody as JsonValue) }],
  } as Record<string, JsonValue>);
  roleCall("ingestion_approver", `select ingestion.register_foundation_reconciliation_decision(${sqlJson(contract)});`);
}

function registerAllowance(input: {
  report: FoundationLifecycleDiffReport; classification: "rejected" | "trace_blocked" | "unsupported";
  datasetId: string; releaseId: string; headId: string; label: string;
}) {
  const items = input.report.items.filter((item) => item.classification === input.classification);
  if (items.length === 0) fail(`Allowance set is empty: ${input.label}.`);
  const contract = attachContractFingerprint({
    contract_version: foundationLifecycleAllowanceContractVersion,
    dataset_id: input.datasetId, source_release_id: input.releaseId,
    prior_dataset_projection_head_id: input.headId, environment: "local",
    allowance_type: input.classification === "rejected" ? "rejected_set" :
      input.classification === "trace_blocked" ? "trace_blocked_set" : "unsupported_set",
    exact_set_fingerprint: input.report.exact_set_fingerprints[input.classification],
    exact_item_fingerprints: items.map((item) => item.item_fingerprint),
    allowed_lifecycle_action: "exclude",
    approver_identity: "Synthetic Phase 10E.4 lifecycle approver",
    approval_reference: `phase-10e4-${input.label}`,
    approval_timestamp: "2026-07-21T12:00:00Z",
    expires_at: "2026-08-21T12:00:00Z",
  } as Record<string, JsonValue>);
  roleCall("ingestion_approver", `select ingestion.register_foundation_lifecycle_allowance(${sqlJson(contract)});`);
}

type ReleaseResult = {
  report: FoundationLifecycleDiffReport;
  receipt: ReturnType<typeof parseFoundationLifecycleUpdateReceiptV2> & {
    receipt_fingerprint: string;
    resulting_dataset_head_version: number;
    resulting_dataset_head_fingerprint: string;
    public_mutation_counts: Record<string, number>;
    history_insertion_counts: Record<string, number>;
  };
  approvalId: string;
  head: HeadContext;
  timings: Record<string, number>;
};

async function executeRelease(input: {
  label: "b" | "c"; candidates: readonly FoundationLifecycleCandidate[];
  missing: Record<string, string>; baselineManifest: Record<string, unknown>;
  failureInjection?: boolean;
}): Promise<ReleaseResult> {
  const timings: Record<string, number> = {};
  const before = headContext();
  const releaseManifest = {
    ...input.baselineManifest,
    original_release_identifier: `synthetic-lifecycle-release-${input.label}`,
    publication_date: input.label === "b" ? "2026-05-01" : "2026-06-01",
    official_url: `https://fdc.nal.usda.gov/synthetic-rehearsal-${input.label}`,
    authorized_delivery_url: `https://fdc.nal.usda.gov/synthetic-rehearsal-${input.label}.zip`,
    archive_name: `synthetic-lifecycle-release-${input.label}.json.zip`,
    sha256: fingerprintJson({ synthetic_rehearsal_only: true, release: input.label }),
    compressed_size: 1, uncompressed_size: 1,
    approval_reference: `phase-10e4-synthetic-release-${input.label}`,
  };
  const releaseId = roleCall("ingestion_operator", `select ingestion.register_source_release(${sqlJson(releaseManifest)});`);
  const runId = roleCall("ingestion_operator", `select import_run_id from ingestion.create_foundation_lifecycle_run(
    ${sqlText(releaseId)}::uuid,'release_update',${sqlText(before.head_id)}::uuid,
    ${sqlText(foundationImporterContractVersion)},${sqlText(foundationSchemaContractVersion)},
    ${sqlText(foundationNutrientMappingVersion)},${sqlText(foundationRejectPolicyVersion)},
    ${sqlText(foundationReleaseDiffContractVersion)},${sqlText(foundationLifecyclePolicyVersion)},
    'local',${sqlText(fingerprintJson({ synthetic_rehearsal_only: true, release: input.label, run: randomUUID() }))},
    'Synthetic Phase 10E.4 operator',${sqlText(`phase-10e4-release-${input.label}`)},null
  );`);
  stageCandidates(runId, input.candidates);
  const release = databaseJson<{ dataset_id: string; manifest_fingerprint: string; sha256: string }>(`select pg_catalog.jsonb_build_object('dataset_id',dataset_id,'manifest_fingerprint',manifest_fingerprint,'sha256',sha256)::text from ingestion.source_releases where id=${sqlText(releaseId)}::uuid;`);
  const scope = attachContractFingerprint({
    contract_version: foundationReleaseScopeContractVersion,
    source_release_id: releaseId, dataset_id: release.dataset_id,
    artifact_kind: "official_bulk_archive", scope_classification: "complete_snapshot",
    manifest_fingerprint: release.manifest_fingerprint, archive_sha256: release.sha256,
    evidence_references: [`synthetic_rehearsal_only:release-${input.label}-complete-snapshot`],
    environment: "local", reviewer_identity: "Synthetic Phase 10E.4 scope approver",
    approval_reference: `phase-10e4-release-${input.label}-scope`,
    approval_timestamp: "2026-07-21T12:00:00Z", expires_at: "2026-08-21T12:00:00Z",
    supersedes_scope_evidence_id: null,
  } as Record<string, JsonValue>);
  const scopeId = roleCall("ingestion_approver", `select ingestion.register_foundation_release_scope_evidence(${sqlJson(scope)});`);
  const concepts = currentConcepts();
  const diffInput: FoundationLifecycleDiffInput = {
    prior_release: { id: before.prior_release_id, fingerprint: before.prior_release_fingerprint },
    new_release: { id: releaseId, fingerprint: release.manifest_fingerprint },
    prior_head: { id: before.head_id, version: Number(before.head_version), fingerprint: before.head_fingerprint },
    scope_evidence: { id: scopeId, fingerprint: scope.contract_fingerprint, classification: "complete_snapshot" },
    import_run_id: runId, environment: "local", current_concepts: concepts,
    candidates: input.candidates, reconciliation_decisions: [], allowances: [],
    contract_versions: {
      importer_contract_version: foundationImporterContractVersion,
      schema_contract_version: foundationSchemaContractVersion,
      mapping_version: foundationNutrientMappingVersion,
      mapping_hash: foundationNutrientMappingHash,
      parser_contract_version: foundationSchemaContractVersion,
      reject_policy_version: foundationRejectPolicyVersion,
      lifecycle_policy_version: foundationLifecyclePolicyVersion,
      scope_contract_version: foundationReleaseScopeContractVersion,
      reconciliation_contract_version: foundationReconciliationDecisionContractVersion,
      diff_contract_version: foundationReleaseDiffContractVersion,
    },
  };
  let started = performance.now();
  const report = createFoundationReleaseDiff(diffInput);
  const repeated = createFoundationReleaseDiff(diffInput);
  if (serializeFoundationReleaseDiff(report) !== serializeFoundationReleaseDiff(repeated)) {
    fail(`Release ${input.label.toUpperCase()} TypeScript diff is nondeterministic.`);
  }
  timings.typescript_diff = performance.now() - started;
  started = performance.now();
  const databaseReport = JSON.parse(roleCall(
    "ingestion_lifecycle_definer",
    `select ingestion.recompute_foundation_release_diff_v1(${sqlText(runId)}::uuid)::text;`,
  )) as FoundationLifecycleDiffReport;
  timings.database_diff = performance.now() - started;
  if (databaseReport.report_fingerprint !== report.report_fingerprint) {
    fail(`Release ${input.label.toUpperCase()} TypeScript/PostgreSQL diff mismatch.`);
  }
  started = performance.now();
  roleCall("ingestion_operator", `select ingestion.register_foundation_release_diff_report(${sqlText(runId)}::uuid,${sqlJson(report)});`);
  timings.report_registration = performance.now() - started;
  for (const [decisionType, conceptKey] of Object.entries(input.missing)) {
    registerDecision({ report, conceptKey, decisionType, datasetId: before.dataset_id, releaseId, label: `${input.label}-${decisionType}` });
  }
  for (const classification of ["rejected", "trace_blocked", "unsupported"] as const) {
    if ((report.exact_set_counts[classification] ?? 0) > 0) registerAllowance({
      report, classification, datasetId: before.dataset_id, releaseId,
      headId: before.head_id, label: `${input.label}-${classification}`,
    });
  }
  started = performance.now();
  const validationId = roleCall("ingestion_operator", `select validation_receipt_id from ingestion.validate_foundation_lifecycle_run(${sqlText(runId)}::uuid);`);
  timings.validation = performance.now() - started;
  started = performance.now();
  const planId = roleCall("ingestion_operator", `select execution_plan_id from ingestion.prepare_foundation_lifecycle_execution_plan(${sqlText(validationId)}::uuid);`);
  timings.plan = performance.now() - started;
  const approvalBody = JSON.parse(roleCall("ingestion_lifecycle_definer", `select pg_catalog.jsonb_build_object(
    'contract_version','foundation-lifecycle-update-approval/v2',
    'validation_receipt_id',validation.id,'validation_fingerprint',validation.validation_fingerprint,
    'execution_plan_id',plans.id,'execution_plan_fingerprint',plans.plan_fingerprint,
    'release_diff_report_fingerprint',plans.plan_contract->>'release_diff_report_fingerprint',
    'prior_dataset_head_id',plans.prior_dataset_projection_head_id,
    'prior_dataset_head_version',(plans.plan_contract->>'current_dataset_head_version')::bigint,
    'prior_dataset_head_fingerprint',plans.plan_contract->>'current_dataset_head_fingerprint',
    'current_scope_evidence_fingerprint',plans.plan_contract->>'current_scope_evidence_fingerprint',
    'decision_set_fingerprint',ingestion.fingerprint_json_v1(plans.decision_fingerprints),
    'allowance_set_fingerprint',ingestion.fingerprint_json_v1(plans.allowance_fingerprints),
    'before_projection_fingerprint',plans.before_projection_fingerprint,
    'after_projection_fingerprint',plans.after_projection_fingerprint,
    'environment',plans.environment,'approver_identity','Synthetic Phase 10E.4 lifecycle approver',
    'approval_reference',${sqlText(`phase-10e4-release-${input.label}-approval`)},
    'approval_timestamp','2026-07-21T12:00:00Z','expires_at','2026-08-21T12:00:00Z'
  )::text from ingestion.lifecycle_validation_receipts validation
  join ingestion.lifecycle_execution_plans plans on plans.validation_receipt_id=validation.id
  where validation.id=${sqlText(validationId)}::uuid and plans.id=${sqlText(planId)}::uuid;`)) as Record<string, JsonValue>;
  const approval = attachContractFingerprint(approvalBody);
  started = performance.now();
  const approvalId = roleCall("ingestion_approver", `select ingestion.register_foundation_lifecycle_update_approval(${sqlText(validationId)}::uuid,${sqlJson(approval)});`);
  timings.approval = performance.now() - started;
  if (input.failureInjection) {
    const stages = [
      "after_public_food_insertion", "after_current_nutrient_upsert",
      "after_evidence_insertion", "after_current_nutrient_deletion",
      "after_dataset_head_insertion", "after_receipt_insertion",
      "after_current_pointer_advancement", "after_completion_transition_before_return",
    ];
    const fingerprint = lifecycleStateFingerprint();
    for (const stage of stages) {
      try {
        roleCall("ingestion_operator", `select pg_catalog.set_config('nutrition_tracker.lifecycle_execution_failpoint',${sqlText(stage)},true); select * from ingestion.execute_foundation_lifecycle_update(${sqlText(approvalId)}::uuid);`);
        fail(`Full-shape failpoint did not fire: ${stage}.`);
      } catch (error) {
        if (!(error instanceof Error) || !error.message.includes(`synthetic lifecycle execution failpoint: ${stage}`)) {
          throw error;
        }
        const after = lifecycleStateFingerprint();
        if (after !== fingerprint) fail(`Full-shape failpoint leaked state: ${stage}.`);
      }
    }
  }
  started = performance.now();
  if (input.failureInjection) {
    const concurrent = await Promise.all([1, 2].map(() => roleCallAsync(
      "ingestion_operator",
      `select pg_catalog.jsonb_build_object('receipt_id',lifecycle_update_receipt_id,'exact_retry',exact_retry)::text from ingestion.execute_foundation_lifecycle_update(${sqlText(approvalId)}::uuid);`,
    )));
    const results = concurrent.map((value) => JSON.parse(value) as { receipt_id: string; exact_retry: boolean });
    if (new Set(results.map((value) => value.receipt_id)).size !== 1 ||
        results.filter((value) => value.exact_retry).length !== 1) {
      fail("Concurrent same-approval execution did not resolve to one receipt and one exact retry.");
    }
    timings.concurrent_same_approval = performance.now() - started;
  } else {
    roleCall("ingestion_operator", `select lifecycle_update_receipt_id from ingestion.execute_foundation_lifecycle_update(${sqlText(approvalId)}::uuid);`);
  }
  timings.execution = performance.now() - started;
  started = performance.now();
  roleCall("ingestion_operator", `select lifecycle_update_receipt_id from ingestion.execute_foundation_lifecycle_update(${sqlText(approvalId)}::uuid);`);
  timings.retry = performance.now() - started;
  started = performance.now();
  const receipt = parseFoundationLifecycleUpdateReceiptV2(databaseJson(`select receipt_contract::text from ingestion.lifecycle_update_receipts where lifecycle_update_approval_id=${sqlText(approvalId)}::uuid;`)) as ReleaseResult["receipt"];
  timings.final_verification = performance.now() - started;
  return { report, receipt, approvalId, head: headContext(), timings };
}

function backupAndRestore(
  outputDir: string,
  approvalId: string,
  expectedSnapshotFingerprint: string,
  expectedReadFingerprint: string,
) {
  const rolesPath = join(outputDir, "phase10e4-roles.sql");
  const databasePath = join(outputDir, "phase10e4-database.dump");
  const started = performance.now();
  const roles = execFileSync("docker", ["exec", databaseContainer, "pg_dumpall", "-U", "postgres", "--roles-only"], { encoding: "utf8" });
  writeFileSync(rolesPath, roles, { mode: 0o600 });
  const dump = execFileSync("docker", ["exec", databaseContainer, "pg_dump", "-U", "postgres", "-d", "postgres", "-Fc"], { encoding: "buffer", maxBuffer: 256 * 1024 * 1024 });
  writeFileSync(databasePath, dump, { mode: 0o600 });
  chmodSync(rolesPath, 0o600); chmodSync(databasePath, 0o600);
  const databaseHash = sha256(dump); const rolesHash = sha256(roles);
  database("drop database if exists phase10e4_restore;");
  database("create database phase10e4_restore template template0;");
  execFileSync("docker", [
    "exec", "-e", `PGPASSWORD=${localDatabasePassword}`, "-i", databaseContainer,
    "pg_restore", "-h", "127.0.0.1", "-U", "supabase_admin",
    "-d", "phase10e4_restore", "--exit-on-error",
  ], { input: dump, maxBuffer: 256 * 1024 * 1024 });
  databaseAsAdmin(`begin; set local role ingestion_operator; select exact_retry from ingestion.execute_foundation_lifecycle_update('${approvalId}'::uuid); commit;`, "phase10e4_restore");
  const restoredSnapshot = snapshotEvidence("phase10e4_restore");
  const restoredReads = applicationReadEvidence("phase10e4_restore");
  if (restoredSnapshot.fingerprint !== expectedSnapshotFingerprint ||
      restoredReads.fingerprint !== expectedReadFingerprint) {
    fail("Restored application evidence does not match the source database.");
  }
  const verification = databaseAsAdmin(`select jsonb_build_object(
    'head_version',(select current_head_version from ingestion.dataset_projection_current_heads where environment='local'),
    'foods',(select count(*) from public.foods),
    'nutrients',(select count(*) from public.food_nutrients),
    'receipts',(select count(*) from ingestion.lifecycle_update_receipts),
    'invalid_receipt_fingerprints',(select count(*) from ingestion.lifecycle_update_receipts
      where receipt_fingerprint<>ingestion.fingerprint_json_v1(receipt_contract)),
    'rls_policies',(select count(*) from pg_catalog.pg_policies),
    'lifecycle_memberships',(select count(*) from pg_catalog.pg_auth_members memberships
      join pg_catalog.pg_roles roles on roles.oid=memberships.roleid
      where roles.rolname='ingestion_lifecycle_definer')
  )::text;`, "phase10e4_restore");
  database("select pg_terminate_backend(pid) from pg_stat_activity where datname='phase10e4_restore';");
  database("drop database phase10e4_restore;");
  return {
    status: "tested_local_logical_restore", roles_bytes: statSync(rolesPath).size,
    roles_sha256: rolesHash, database_bytes: statSync(databasePath).size,
    database_sha256: databaseHash, verification_fingerprint: sha256(verification),
    duration_ms: Number((performance.now() - started).toFixed(3)),
  };
}

async function main() {
  const args = parseArguments(process.argv.slice(2));
  requireLocalSupabase();
  cleanupLocalOperatorMemberships();
  const archive = readFileSync(resolve(args.get("--archive")!));
  const jsonText = readFileSync(resolve(args.get("--json")!), "utf8");
  const manifest = JSON.parse(readFileSync(resolve(args.get("--manifest")!), "utf8")) as Record<string, unknown>;
  if (sha256(archive) !== expectedArchiveHash || fingerprintSourceReleaseManifest(manifest) !== expectedManifestFingerprint) {
    fail("Verified April 2026 baseline input hash mismatch.");
  }
  const dryRun = runFoundationDryRun({ manifest, archiveBytes: archive, jsonText });
  if (
    dryRun.report.report_fingerprint !== expectedReportFingerprint ||
    dryRun.report.source_count !== 363 || dryRun.report.accepted_count !== 353 ||
    dryRun.report.rejected_count !== 10 || dryRun.report.warning_count !== 1018 ||
    dryRun.report.portion_counts.total_portions !== 375
  ) fail("Verified April 2026 baseline report mismatch.");
  const outputDir = resolve(args.get("--output-dir")!);
  mkdirSync(outputDir, { recursive: true, mode: 0o700 });
  const timings: Record<string, number> = {};
  let started = performance.now();
  let preUpgrade: Record<string, JsonValue>;
  let snapshotsBefore: ReturnType<typeof snapshotEvidence>;
  let readsBefore: ReturnType<typeof applicationReadEvidence>;
  let bootstrap: Record<string, JsonValue>;
  if (args.has("--prepared-local")) {
    progress("use_prepared_local_baseline");
    preUpgrade = aggregateEvidence();
    snapshotsBefore = snapshotEvidence();
    readsBefore = applicationReadEvidence();
    bootstrap = bootstrapBaseline();
  } else {
    progress("reconstruct_phase_10d_baseline");
    command("npx", ["supabase", "db", "reset", "--local", "--version", "20260718140000"], { quiet: true });
    command("npm", ["run", "ingestion:foundation:promote-local", "--",
      "--archive", resolve(args.get("--archive")!), "--json", resolve(args.get("--json")!),
      "--manifest", resolve(args.get("--manifest")!), "--report", join(outputDir, "baseline-report.json"),
      "--reject-allowance", resolve(args.get("--reject-allowance")!),
      "--approval", resolve(args.get("--promotion-approval")!),
    ], { quiet: true });
    timings.baseline_reconstruction = performance.now() - started;
    preUpgrade = aggregateEvidence();
    progress("create_application_snapshots");
    createApplicationSnapshots();
    snapshotsBefore = snapshotEvidence();
    readsBefore = applicationReadEvidence();
    started = performance.now();
    progress("apply_phase_10e_migrations");
    command("npx", ["supabase", "migration", "up", "--local", "--include-all"], { quiet: true });
    timings.migration_upgrade = performance.now() - started;
    const snapshotsAfterMigration = snapshotEvidence();
    if (snapshotsAfterMigration.fingerprint !== snapshotsBefore.fingerprint) fail("Migration upgrade changed application snapshots.");
    started = performance.now();
    progress("bootstrap_lifecycle_baseline");
    bootstrap = bootstrapBaseline();
    timings.bootstrap = performance.now() - started;
  }
  const bootstrapRetry = bootstrapBaseline();
  if (bootstrapRetry.exact_retry !== true || bootstrapRetry.dataset_projection_fingerprint !== bootstrap.dataset_projection_fingerprint) fail("Baseline bootstrap exact retry failed.");
  const releaseBOverlay = createReleaseBOverlay(dryRun.accepted);
  const releaseCOverlay = createReleaseCOverlay(dryRun.accepted, releaseBOverlay);
  progress("execute_release_b");
  const releaseB = await executeRelease({ label: "b", candidates: releaseBOverlay.candidates, missing: releaseBOverlay.missing, baselineManifest: manifest, failureInjection: true });
  const snapshotsAfterB = snapshotEvidence();
  if (snapshotsAfterB.fingerprint !== snapshotsBefore.fingerprint) fail("Release B changed durable application snapshots.");
  progress("execute_release_c");
  const releaseC = await executeRelease({ label: "c", candidates: releaseCOverlay.candidates, missing: releaseCOverlay.missing, baselineManifest: manifest });
  const snapshotsAfterC = snapshotEvidence();
  if (snapshotsAfterC.fingerprint !== snapshotsBefore.fingerprint) fail("Release C changed durable application snapshots.");
  const readsAfter = applicationReadEvidence();
  if (readsAfter.search_p95_ms > Math.max(50, readsBefore.search_p95_ms * 2) ||
      readsAfter.prefill_p95_ms > Math.max(25, readsBefore.prefill_p95_ms * 2)) {
    fail("Application search or diary-prefill performance regressed.");
  }
  if (Number(releaseB.receipt.resulting_dataset_head_version) !== 2 || Number(releaseC.receipt.resulting_dataset_head_version) !== 3) fail("Sequential dataset heads did not advance to versions 2 and 3.");
  if ((timings.bootstrap ?? 0) >= 30000 || releaseB.timings.database_diff >= 30000 ||
      releaseB.timings.execution >= 30000 || releaseC.timings.execution >= 30000 ||
      releaseB.timings.retry >= 2000 || releaseC.timings.retry >= 2000) {
    fail("A production-shaped local performance gate was exceeded.");
  }
  cleanupLocalOperatorMemberships();
  const security = databaseJson<Record<string, JsonValue>>(`select pg_catalog.jsonb_build_object(
    'definer', (select pg_catalog.jsonb_build_object('login',rolcanlogin,'inherit',rolinherit,'super',rolsuper,'createdb',rolcreatedb,'createrole',rolcreaterole,'bypassrls',rolbypassrls) from pg_roles where rolname='ingestion_lifecycle_definer'),
    'standing_memberships',(select count(*) from pg_auth_members memberships join pg_roles roles on roles.oid=memberships.roleid where roles.rolname='ingestion_lifecycle_definer'),
    'service_execute',has_function_privilege('service_role','ingestion.execute_foundation_lifecycle_update(uuid)','execute'),
    'authenticated_execute',has_function_privilege('authenticated','ingestion.execute_foundation_lifecycle_update(uuid)','execute'),
    'aliases',(select count(*) from public.food_aliases),'barcodes',(select count(*) from public.food_barcodes)
  )::text;`);
  if (security.service_execute !== false || security.authenticated_execute !== false || security.standing_memberships !== 0) fail("Lifecycle authority regression detected.");
  progress("backup_and_restore");
  const backup = backupAndRestore(
    outputDir, releaseC.approvalId, snapshotsBefore.fingerprint, readsAfter.fingerprint,
  );
  const repositorySha = command("git", ["rev-parse", "main"]);
  if (repositorySha !== expectedBaseSha) fail("Rehearsal repository base SHA changed unexpectedly.");
  const summary = createFoundationLifecycleRehearsalSummary({
    contract_version: foundationLifecycleRehearsalContractVersion,
    repository_sha: repositorySha,
    baseline_manifest_fingerprint: expectedManifestFingerprint,
    baseline_report_fingerprint: expectedReportFingerprint,
    overlay_policy_version: foundationLifecycleOverlayPolicyVersion,
    synthetic_rehearsal_only: true,
    baseline: { ...preUpgrade, bootstrap, snapshot_fingerprint: snapshotsBefore.fingerprint },
    release_b: {
      diff_counts: releaseB.report.exact_set_counts as unknown as JsonValue,
      receipt_fingerprint: releaseB.receipt.receipt_fingerprint,
      head_fingerprint: releaseB.receipt.resulting_dataset_head_fingerprint,
      public_mutation_counts: releaseB.receipt.public_mutation_counts as JsonValue,
      history_insertion_counts: releaseB.receipt.history_insertion_counts as JsonValue,
    },
    release_c: {
      diff_counts: releaseC.report.exact_set_counts as unknown as JsonValue,
      receipt_fingerprint: releaseC.receipt.receipt_fingerprint,
      head_fingerprint: releaseC.receipt.resulting_dataset_head_fingerprint,
      public_mutation_counts: releaseC.receipt.public_mutation_counts as JsonValue,
      history_insertion_counts: releaseC.receipt.history_insertion_counts as JsonValue,
    },
    application: {
      snapshot_fingerprint: snapshotsBefore.fingerprint,
      snapshots_preserved: true,
      pre_update_read_fingerprint: readsBefore.fingerprint,
      post_update_read_fingerprint: readsAfter.fingerprint,
      search_p95_before_ms: readsBefore.search_p95_ms,
      search_p95_after_ms: readsAfter.search_p95_ms,
      prefill_p95_before_ms: readsBefore.prefill_p95_ms,
      prefill_p95_after_ms: readsAfter.prefill_p95_ms,
      security,
    },
    failure_and_concurrency: {
      critical_full_shape_failpoints: 8, bounded_failpoints: 21,
      same_approval_concurrency: "one_receipt_one_exact_retry", exact_retry: true,
    },
    performance_ms: Object.fromEntries(Object.entries({ ...timings, ...Object.fromEntries(Object.entries(releaseB.timings).map(([key, value]) => [`release_b_${key}`, value])), ...Object.fromEntries(Object.entries(releaseC.timings).map(([key, value]) => [`release_c_${key}`, value])) }).map(([key, value]) => [key, Number(value.toFixed(3))])) as Record<string, JsonValue>,
    backup: backup as unknown as Record<string, JsonValue>,
  });
  const summaryPath = join(outputDir, "phase10e4-sanitized-summary.json");
  writeFileSync(summaryPath, `${JSON.stringify(summary, null, 2)}\n`, { mode: 0o600 });
  progress("completed");
  process.stdout.write(`${JSON.stringify({
    status: "completed", contract_version: summary.contract_version,
    summary_fingerprint: summary.summary_fingerprint,
    baseline_foods: bootstrap.food_count, baseline_present_nutrients: bootstrap.present_nutrient_count,
    baseline_missing_nutrients: bootstrap.missing_nutrient_count,
    release_b_head_version: releaseB.receipt.resulting_dataset_head_version,
    release_c_head_version: releaseC.receipt.resulting_dataset_head_version,
    restore_status: backup.status,
  }, null, 2)}\n`);
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : "Lifecycle rehearsal failed."}\n`);
  process.exitCode = 1;
});
