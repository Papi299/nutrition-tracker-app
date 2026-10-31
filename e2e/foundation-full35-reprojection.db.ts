import { execFileSync, spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
import { buildMappingPlan, fingerprintMappingPlan, type MappingScopeSnapshot, type MappingPlan } from "@/ingestion/usda/foundation/reprojection/contracts";
import { canonicalizeJson, type JsonValue } from "@/ingestion/usda/foundation/canonical-json";
import { installSyntheticBaseline, fixtureId, fixtureHash, mappingId } from "./fixtures/foundation-full35-reprojection";

import { prepareLegacyRace } from "./fixtures/foundation-full35-legacy-race";

const container=process.env.FULL35_LOCAL_DATABASE_CONTAINER;
const password="synthetic-full35-local-only";
function query(sql:string,user="supabase_admin") {
  if(!container || !/^supabase_db_[a-zA-Z0-9_-]+$/.test(container)) throw new Error("Explicit disposable local database required.");
  return execFileSync("docker",["exec","-e",`PGPASSWORD=${password}`,"-i",container,"psql",
    ...(user==="supabase_admin"?[]:["-h","127.0.0.1"]),"-U",user,"-d","postgres","-X","-qAt","-v","ON_ERROR_STOP=1"],
    {input:sql,encoding:"utf8",maxBuffer:64*1024*1024,stdio:["pipe","pipe","pipe"]}).trim();
}
function json<T=Record<string,unknown>>(sql:string,user?:string):T {return JSON.parse(query(sql,user));}
const operator="full35_operator_test",approver="full35_approver_test";
let fixture:ReturnType<typeof installSyntheticBaseline>;
let plan:MappingPlan, planId:string, approvalId:string, receipt:Record<string,unknown>;
let frozenPrivate:string, frozenLegacy:string, competingApproval:string, legacyRace:ReturnType<typeof prepareLegacyRace>;
const token=fixtureId(999800);
const migrations=()=>readdirSync("supabase/migrations").filter(n=>n.endsWith(".sql")).sort().map(filename=>({
  filename,version:filename.split("_")[0],sha256:createHash("sha256").update(readFileSync(`supabase/migrations/${filename}`)).digest("hex")}));
function scope() {return json<MappingScopeSnapshot>(`select ingestion.get_foundation_mapping_reprojection_scope_v1('local')->'before_snapshot';`,operator);}
function makePlan(compensate=false):MappingPlan {
  return buildMappingPlan({operation_kind:compensate?"compensation":"reprojection",dataset_id:fixture.datasetId,environment:"local",
    source_release_id:fixture.releaseId,mapping_version_id:mappingId,before_snapshot:scope(),
    approval_requirements:{approver_oid:Number(query(`select oid from pg_roles where rolname='${approver}';`)),
      not_before:new Date(Date.now()-60000).toISOString(),expires_at:new Date(Date.now()+3600000).toISOString()},
    operator_oid:Number(query(`select oid from pg_roles where rolname='${operator}';`)),operator_login:operator,
    implementation:{database_contract_hash:query("select ingestion.get_foundation_mapping_reprojection_scope_v1('local')->>'database_contract_hash';",operator),commit:execFileSync("git",["rev-parse","HEAD"],{encoding:"utf8"}).trim(),tree:execFileSync("git",["rev-parse","HEAD^{tree}"],{encoding:"utf8"}).trim(),migrations:migrations(),contract_versions:{
      parser:"usda-fdc-foundation-json/v1",importer:"usda-foundation-importer/v3",candidate:"foundation-normalized-candidate/v2",
      mapping:"usda-foundation-full35-direct-v2",projection:"foundation-lifecycle-projection/v2"}},
    qualification:{...fixture.source,historical_allowance_fingerprint:"bdfc95e5009a8d5c5a5bbf82b24dff1a4e8c3decd7bee4406286c543e661ad4a",
      rejected:JSON.parse(readFileSync("docs/evidence/nutrition-usda-full35-local-qual-001/qualification.json","utf8")).source_inspection.rejected_records,source_qualification_hash:fixtureHash("independent-synthetic-oracle")},
    recovery_requirements:{qualification_hash:fixtureHash("synthetic-local-database-only"),production_ready:false},
    rejected_receipt_id:compensate?String(receipt.receipt_id):null,records:fixture.records});
}
const canonicalInput=(v:unknown)=>`'${canonicalizeJson(v as JsonValue).replaceAll("'","''")}'::json`;
function prepare(p:MappingPlan,retryToken=p.operation_kind==="compensation"?fixtureId(999802):token) {return query(`select ingestion.prepare_foundation_mapping_${p.operation_kind}_v1(${canonicalInput(p)},'${retryToken}');`,operator);}
function approve(id:string,p:MappingPlan) {return query(`select ingestion.approve_foundation_mapping_${p.operation_kind}_v1('${id}','${fingerprintMappingPlan(p)}','${p.approval_requirements.expires_at}'::timestamptz,${canonicalInput({independent_review_hash:fixtureHash("independent review"),recovery_evidence_hash:p.recovery_requirements.qualification_hash,approval_reference:"synthetic-independent-approval"})});`,approver);}
function stateFingerprint() {return query(`select md5(jsonb_build_object(
  'public',(select jsonb_agg(to_jsonb(n) order by id) from public.food_nutrients n),
  'source',(select jsonb_agg(to_jsonb(v) order by id) from ingestion.source_record_versions v),
  'pointer',(select jsonb_agg(to_jsonb(h)) from ingestion.dataset_projection_current_heads h),
  'heads',(select jsonb_agg(to_jsonb(h) order by id) from ingestion.food_projection_heads h),
  'interpretations',(select jsonb_agg(to_jsonb(i) order by id) from ingestion.source_mapping_interpretations i),
  'projections',(select jsonb_agg(to_jsonb(p) order by id) from ingestion.food_projection_versions p),
  'states',(select jsonb_agg(to_jsonb(s) order by id) from ingestion.food_nutrient_projection_versions s),
  'evidence',(select jsonb_agg(to_jsonb(e) order by id) from ingestion.food_nutrient_evidence e),
  'links',(select jsonb_agg(to_jsonb(l) order by id) from ingestion.food_nutrient_projection_evidence_links l),
  'receipts',(select jsonb_agg(to_jsonb(r) order by id) from ingestion.mapping_reprojection_receipts r),
  'approvals',(select jsonb_agg(to_jsonb(a) order by id) from ingestion.mapping_reprojection_approvals a)
  )::text);`);}

function executionFingerprint() {return query(`select md5(jsonb_build_object(
  'base','${stateFingerprint()}', 'private','${privateFingerprint()}',
  'plans',(select jsonb_agg(to_jsonb(x) order by id) from ingestion.mapping_reprojection_plans x),
  'items',(select jsonb_agg(to_jsonb(x) order by id) from ingestion.mapping_reprojection_plan_items x),
  'events',(select jsonb_agg(to_jsonb(x) order by id) from ingestion.mapping_reprojection_events x),
  'dataset_heads',(select jsonb_agg(to_jsonb(x) order by id) from ingestion.dataset_projection_heads x),
  'source_events',(select jsonb_agg(to_jsonb(x) order by id) from ingestion.food_source_link_events x),
  'inserted_rows',(select jsonb_agg(to_jsonb(x) order by public_row_id) from ingestion.mapping_reprojection_inserted_rows x),
  'context',(select jsonb_agg(to_jsonb(x)) from ingestion.mapping_reprojection_execution_context x)
)::text);`);}
function privateFingerprint() {return query(`select md5(jsonb_build_object(
  'profiles',(select jsonb_agg(to_jsonb(x) order by id) from public.profiles x),
  'targets',(select jsonb_agg(to_jsonb(x) order by id) from public.nutrition_targets x),
  'favorites',(select jsonb_agg(to_jsonb(x) order by food_id) from public.food_favorites x),
  'private_foods',(select jsonb_agg(to_jsonb(x) order by id) from public.foods x where owner_user_id is not null),
  'diary',(select jsonb_agg(to_jsonb(x) order by id) from public.diary_entries x),
  'requests',(select jsonb_agg(to_jsonb(x) order by id) from public.manual_diary_entry_requests x),
  'meals',(select jsonb_agg(to_jsonb(x) order by id) from public.saved_meals x),
  'items',(select jsonb_agg(to_jsonb(x) order by id) from public.saved_meal_items x),
  'recipes',(select jsonb_agg(to_jsonb(x) order by id) from public.recipes x),
  'ingredients',(select jsonb_agg(to_jsonb(x) order by id) from public.recipe_ingredients x)
)::text);`);}
function legacyFingerprint() {return query(`select md5(jsonb_build_object(
  'mapping',(select jsonb_agg(to_jsonb(m) order by id) from ingestion.nutrient_mapping_versions m where version_code='usda-foundation-mvp-v1'),
  'promotion',(select jsonb_agg(to_jsonb(r) order by id) from ingestion.foundation_promotion_receipts r),
  'v1_projection',(select jsonb_agg(to_jsonb(p) order by id) from ingestion.food_projection_versions p where projection_contract_version='foundation-lifecycle-projection/v1'),
  'v1_states',(select jsonb_agg(to_jsonb(s) order by id) from ingestion.food_nutrient_projection_versions s where projection_contract_version='foundation-lifecycle-projection/v1'),
  'v1_evidence',(select jsonb_agg(to_jsonb(e) order by id) from ingestion.food_nutrient_evidence e where mapping_reprojection_receipt_id is null),
  'v1_links',(select jsonb_agg(to_jsonb(l) order by l.id) from ingestion.food_nutrient_projection_evidence_links l join ingestion.food_nutrient_projection_versions s
    on s.id=l.food_nutrient_projection_version_id where s.projection_contract_version='foundation-lifecycle-projection/v1'),
  'original_head',(select jsonb_agg(to_jsonb(h) order by id) from ingestion.dataset_projection_heads h where head_version=1)
)::text);`);}
function asyncQuery(sql:string,user=operator,label="full35-race") {
  if(!container) throw new Error("Local database required.");
  return new Promise<{status:number|null;out:string;error:string}>(resolve=>{
    const child=spawn("docker",["exec","-e",`PGPASSWORD=${password}`,"-e",`PGAPPNAME=${label}`,"-i",container,"psql",
      "-h","127.0.0.1","-U",user,"-d","postgres","-X","-qAt","-v","ON_ERROR_STOP=1"]);
    let out="",error="";
    child.stdout.on("data",x=>out+=x);child.stderr.on("data",x=>error+=x);
    child.on("close",status=>resolve({status,out:out.trim(),error}));
    child.stdin.end(sql);
  });
}
async function barrier() {
  if(!container) throw new Error("Local database required.");
  const child=spawn("docker",["exec","-i",container,"psql","-U","supabase_admin","-d","postgres","-X","-qAt","-v","ON_ERROR_STOP=1"]);
  await new Promise<void>((resolve,reject)=>{
    child.stdout.on("data",x=>{if(x.toString().includes("HELD"))resolve();});child.on("error",reject);
    child.stdin.write("select pg_advisory_lock(864350001);\n\\echo HELD\n");
  });
  let released=false;
  return ()=>{if(released)return;released=true;child.stdin.end("select pg_advisory_unlock(864350001);\n\\q\n");};
}
async function waitBlocked(label:string) {
  for(let i=0;i<180;i++) {
    if(query(`select exists(select from pg_stat_activity where application_name='${label}' and wait_event='advisory');`)==="t") return;
    await new Promise(resolve=>setTimeout(resolve,500));
  }
  throw new Error(`Expected local advisory-lock contention for ${label}.`);
}
function installFault(table:string,event:string,body="raise exception 'synthetic_full35_failpoint';",timing="after") {
  if(!/^(ingestion|public)\.[a-z_]+$/.test(table) || !["insert","update","delete"].includes(event)) throw new Error("Invalid local fault target.");
  query(`create schema full35_fault; revoke all on schema full35_fault from public;
    create function full35_fault.inject() returns trigger language plpgsql set search_path='' as $$ begin ${body} return new; end; $$;
    create trigger full35_local_fault ${timing} ${event} on ${table} for each row execute function full35_fault.inject();`);
  return ()=>query(`drop trigger full35_local_fault on ${table}; drop schema full35_fault cascade;`);
}
function oraclePacket() {
  const states=json(`select jsonb_agg(jsonb_build_object('fdc_id',i.candidate_body->>'fdc_id','food_id',h.food_id,'mapping_hash',i.mapping_hash,'code',s.nutrient_code,
    'value',case when s.amount is null then null else trim_scale(s.amount)::text end,'source_id',s.source_nutrient_id,
    'source_unit',s.source_unit,'application_unit',s.application_unit,'basis','per_100g','semantic',coalesce(s.source_semantic,'missing'),
    'derivation_code',s.derivation_code,'derivation_description',s.derivation_description,'raw_hash',i.raw_record_hash,'missing_reason',s.missing_reason)
    order by (i.candidate_body->>'fdc_id')::bigint,s.nutrient_code collate "C")
    from ingestion.food_nutrient_projection_versions s join ingestion.food_projection_heads h on h.food_projection_version_id=s.food_projection_version_id
    join ingestion.food_projection_versions p on p.id=h.food_projection_version_id
    join ingestion.source_mapping_interpretations i on i.id=p.source_mapping_interpretation_id;`);
  const publicRows=json(`select jsonb_agg(jsonb_build_object('fdc_id',substr(v.upstream_version_key,5),'food_id',h.food_id,'mapping_hash','028f426a5107af052caf49b6ec3d0d145599a708a28541cc00d28fde04df5c7c','code',d.code,'value',trim_scale(n.amount)::text)
    order by substr(v.upstream_version_key,5)::bigint,d.code collate "C") from ingestion.food_projection_heads h
    join ingestion.source_record_versions v on v.id=h.source_record_version_id
    join public.food_nutrients n on n.food_id=h.food_id join public.nutrients d on d.id=n.nutrient_id;`);
  const evidence=json(`select jsonb_agg(jsonb_build_object('fdc_id',i.candidate_body->>'fdc_id','food_id',h.food_id,'mapping_hash',i.mapping_hash,'code',e->>'application_nutrient_code',
    'value',e->>'source_value','source_id',e->>'source_nutrient_id','source_unit',e->>'source_unit','application_unit',e->>'application_unit',
    'basis',e->>'basis','semantic',e->>'semantic','derivation_code',e->>'derivation_code','derivation_description',e->>'derivation_description',
    'raw_hash',i.raw_record_hash,'source_name',e->>'source_nutrient_name','footnote',e->>'footnote','loq',e->>'loq','raw_field_path',e->>'raw_field_path'))
    from ingestion.source_mapping_interpretations i join ingestion.food_projection_heads h on h.source_record_version_id=i.source_record_version_id cross join lateral jsonb_array_elements(i.candidate_body->'nutrient_evidence') e;`);
  return {identity_bindings:plan.items.map(i=>({fdc_id:i.candidate.fdc_id,food_id:i.before.food_id})),raw_records:fixture.records.map(r=>r.record.raw),states,public_rows:publicRows,interpretation_evidence:evidence};
}

test.describe.serial("Full35 governed local execution",()=>{
  test.setTimeout(300000);
  test.beforeAll(()=>{
    query(`drop role if exists full35_dual_test; drop role if exists full35_renamed_test; drop role if exists ${operator}; drop role if exists ${approver}; create role ${operator} login password '${password}'; create role ${approver} login password '${password}';
      grant ingestion_operator to ${operator}; grant ingestion_approver to ${approver};`);
    fixture=installSyntheticBaseline(query);
    frozenPrivate=privateFingerprint();frozenLegacy=legacyFingerprint();
  });
  test("353 synthetic identities and original 1199 core rows form an exact version-1 baseline",()=>{
    expect(json(`select jsonb_build_object('foods',(select count(*) from public.foods where is_public),
      'values',(select count(*) from public.food_nutrients),'versions',(select count(*) from ingestion.source_record_versions),
      'head',(select current_head_version from ingestion.dataset_projection_current_heads));`))
      .toEqual({foods:353,values:1199,versions:353,head:1});
    plan=makePlan();
    expect(plan.items.flatMap(i=>i.additions)).toHaveLength(5062);
    expect(plan.items.flatMap(i=>i.projection_body.nutrient_states as JsonValue[])).toHaveLength(12355);
    const reordered={...plan,records:[...fixture.records].reverse()};
    expect(fingerprintMappingPlan(buildMappingPlan(reordered))).toBe(fingerprintMappingPlan(plan));
  });
  test("prepare validates immutable exact scope without public/source/history writes",()=>{
    const before=stateFingerprint(); planId=prepare(plan);
    expect(stateFingerprint()).toBe(before);
    expect(prepare(plan)).toBe(planId);
    expect(privateFingerprint()).toBe(frozenPrivate);
    expect(query(`select state from ingestion.mapping_reprojection_plans where id='${planId}';`)).toBe("validated");
  });
  test("operator self-approval and actual consumer direct DML/RPC calls are rejected",()=>{
    expect(()=>query(`select ingestion.approve_foundation_mapping_reprojection_v1('${planId}','${fingerprintMappingPlan(plan)}',now()+interval '1 hour','{}'::json);`,operator)).toThrow(/permission denied/);
    for(const role of ["anon","authenticated","authenticator","service_role"]) {
      expect(()=>query(`set role ${role}; select ingestion.execute_foundation_mapping_reprojection_v1('${fixtureId(999)}','${token}');`)).toThrow(/permission denied/);
      expect(()=>query(`set role ${role}; set nutrition_tracker.lifecycle_execution_authorized='1'; insert into public.food_nutrients(food_id,nutrient_id,amount,basis)
        values('${plan.items[0].before.food_id}',(select id from public.nutrients where code='fiber_g'),1,'per_100g');`)).toThrow();
    }
  });
  test("rehashing wrong identities, values, mapping, schema and ordering cannot authorize a plan",()=>{
    const cases:((p:MappingPlan)=>void)[]=[
      p=>{p.operator_oid++;},p=>{p.operator_login=approver;},
      p=>{p.source_release_id=fixtureId(999990);},p=>{p.mapping_version_id=fixtureId(999991);},
      p=>{p.items[0].before.food_id=fixtureId(999705);},
      p=>{p.items[0].candidate.record_identity.source_version_id=fixtureId(999992);},
      p=>{p.items[0].candidate.record_identity.source_record_id=fixtureId(999993);},
      p=>{p.items[0].candidate.record_identity.raw_content_sha256="f".repeat(64);},
      p=>{p.items[0].additions[0].state.amount="999.9999";},
      p=>{p.implementation.migrations[46].filename="20990101000000_unreviewed.sql";},
      p=>{p.items.reverse();},
    ];
    const before=executionFingerprint();
    for(const mutate of cases) {const forged=structuredClone(plan);mutate(forged);expect(()=>prepare(forged)).toThrow();}
    expect(executionFingerprint()).toBe(before);
    for(const user of [operator,approver]) {
      for(const sql of [
        `update public.food_nutrients set amount=999 where id='${plan.items[0].before.public_rows[0]?.id}';`,
        `delete from public.food_nutrients where food_id='${plan.items[0].before.food_id}';`,
        "delete from ingestion.food_projection_versions;",
        `insert into ingestion.mapping_reprojection_execution_context values(pg_backend_pid(),pg_current_xact_id(),'${planId}','${fixtureId(999)}');`,
      ]) expect(()=>query(sql,user)).toThrow(/permission denied/);
    }
    expect(executionFingerprint()).toBe(before);
  });
  test("renamed overlapping authority, SET ROLE and forged GUC/search path cannot supply authority",()=>{
    query(`create role full35_dual_test login password '${password}';grant ingestion_operator,ingestion_approver to full35_dual_test;
      alter role full35_dual_test rename to full35_renamed_test;`);
    const forged=structuredClone(plan);
    forged.operator_login="full35_renamed_test";forged.operator_oid=Number(query("select oid from pg_roles where rolname='full35_renamed_test';"));
    expect(()=>query(`set role ingestion_operator;select ingestion.prepare_foundation_mapping_reprojection_v1(${canonicalInput(forged)},'${token}');`,"full35_renamed_test"))
      .toThrow(/trusted distinct login/);
    expect(()=>query("set role ingestion_approver;",operator)).toThrow(/permission denied/);
    expect(()=>query(`set nutrition_tracker.lifecycle_execution_authorized='1';set nutrition_tracker.lifecycle_plan_item_id='${planId}';
      create temp table mapping_reprojection_approvals(id uuid);
      set search_path=pg_temp,public;
      insert into public.food_nutrients(food_id,nutrient_id,amount,basis) values('${plan.items[0].before.food_id}',
        (select id from public.nutrients where code='fiber_g'),0,'per_100g');`,operator)).toThrow(/permission denied/);
    expect(privateFingerprint()).toBe(frozenPrivate);
  });

  test("distinct approver grants exact immutable-plan approval",()=>{
    test.setTimeout(600000);
    approvalId=approve(planId,plan);
    const competing=structuredClone(plan);competing.implementation.commit="1".repeat(40);
    const competingId=prepare(competing,fixtureId(999803));competingApproval=approve(competingId,competing);
    legacyRace=prepareLegacyRace(fixture,query,operator,approver);
    query(`begin; select ingestion.execute_foundation_lifecycle_update('${legacyRace.approvalId}'); set constraints all immediate; rollback;`,operator);
    expect(query(`select state from ingestion.mapping_reprojection_plans where id='${planId}';`)).toBe("approved");
    expect(()=>query(`select ingestion.execute_foundation_mapping_reprojection_v1('${approvalId}','${token}');`,approver)).toThrow(/permission denied/);
  });
  test("stale individual food heads fail without public, approval, history or pointer writes",()=>{
    const food=plan.items[0].before.food_id;
    query(`update ingestion.food_projection_heads set food_head_version=food_head_version+1 where food_id='${food}';`);
    try {
      const before=executionFingerprint();
      expect(()=>query(`select ingestion.execute_foundation_mapping_reprojection_v1('${approvalId}','${token}');`,operator)).toThrow(/before-image|identity|stale/);
      expect(executionFingerprint()).toBe(before);
    } finally {query(`update ingestion.food_projection_heads set food_head_version=food_head_version-1 where food_id='${food}';`);}
  });
  test("stale dataset pointers and actually expired approvals fail without writes", async()=>{
    const expiring=structuredClone(plan);
    expiring.approval_requirements.expires_at=new Date(Date.now()+65000).toISOString();
    const expiringId=prepare(expiring,fixtureId(999804)),expiringApproval=approve(expiringId,expiring);
    const beforeStale=executionFingerprint();
    expect(()=>query(`begin;select ingestion.execute_foundation_lifecycle_update('${legacyRace.approvalId}');
      select ingestion.execute_foundation_mapping_reprojection_v1('${approvalId}','${token}');`,operator)).toThrow(/stale/);
    expect(executionFingerprint()).toBe(beforeStale);
    while(Date.now()<=Date.parse(expiring.approval_requirements.expires_at)) await new Promise(resolve=>setTimeout(resolve,1000));
    const before=executionFingerprint();
    expect(()=>query(`select ingestion.execute_foundation_mapping_reprojection_v1('${expiringApproval}','${fixtureId(999804)}');`,operator)).toThrow(/expired/);
    expect(executionFingerprint()).toBe(before);
    query(`select ingestion.close_foundation_mapping_plan_v1('${expiringId}','expired');`,operator);
    expect(query(`select state from ingestion.mapping_reprojection_plans where id='${expiringId}';`)).toBe("expired");
  });
  test("eight local-only transaction failpoints roll back exact public, source, history and authority state",()=>{
    test.setTimeout(900000);
    for(const [table,event] of [
      ["ingestion.source_mapping_interpretations","insert"],["ingestion.food_nutrient_evidence","insert"],
      ["public.food_nutrients","insert"],["ingestion.food_nutrient_projection_evidence_links","insert"],
      ["ingestion.food_projection_heads","update"],["ingestion.dataset_projection_heads","insert"],
      ["ingestion.mapping_reprojection_receipts","insert"],["ingestion.dataset_projection_current_heads","update"],
    ]) {
      const before=executionFingerprint(),remove=installFault(table,event);
      try {expect(()=>query(`select ingestion.execute_foundation_mapping_reprojection_v1('${approvalId}','${token}');`,operator)).toThrow(/synthetic_full35_failpoint/);}
      finally {remove();}
      expect(executionFingerprint(),table).toBe(before);
    }
  });
  test("numeric overflow, deferred hash/cardinality failures and final CAS rejection are atomic",()=>{
    test.setTimeout(900000);
    const cases:[string,string,string,string,RegExp][]=[
      ["public.food_nutrients","insert","new.amount:=10000000000;","before",/numeric field overflow/],
      ["ingestion.food_projection_versions","insert","new.projection_hash:=repeat('f',64);","before",/invalid or incomplete v2 projection/],
      ["ingestion.food_nutrient_projection_versions","insert","if new.nutrient_code='vitamin_k_ug' then return null;end if;","before",/invalid or incomplete v2 projection/],
      ["ingestion.dataset_projection_heads","insert",`update ingestion.dataset_projection_current_heads set current_dataset_projection_head_id=new.id,
        current_head_version=new.head_version,current_projection_fingerprint=new.dataset_projection_fingerprint
        where dataset_id=new.dataset_id and environment=new.environment;`,"after",/compare-and-swap/],
    ];
    for(const [table,event,body,timing,error] of cases) {
      const before=executionFingerprint(),remove=installFault(table,event,body,timing);
      try {expect(()=>query(`select ingestion.execute_foundation_mapping_reprojection_v1('${approvalId}','${token}');`,operator)).toThrow(error);}
      finally {remove();}
      expect(executionFingerprint(),table).toBe(before);
    }
  });
  test("a real statement timeout after public insertion rolls back the full operation",()=>{
    test.setTimeout(180000);
    const before=executionFingerprint(),remove=installFault("public.food_nutrients","insert","perform pg_catalog.pg_sleep(120);");
    try {expect(()=>query(`set statement_timeout='60s';select ingestion.execute_foundation_mapping_reprojection_v1('${approvalId}','${token}');`,operator)).toThrow(/statement timeout[\s\S]*pg_sleep/);}
    finally {remove();}
    expect(executionFingerprint()).toBe(before);
  });

  test("parallel identical and competing plans serialize with an actual legacy lifecycle execution",async()=>{
    test.setTimeout(600000);
    const remove=installFault("ingestion.mapping_reprojection_execution_context","insert","perform pg_catalog.pg_advisory_xact_lock(864350001);");
    const release=await barrier();
    const first=asyncQuery(`select ingestion.execute_foundation_mapping_reprojection_v1('${approvalId}','${token}');`,operator,"full35-first");
    try {
      await waitBlocked("full35-first");
      const duplicate=asyncQuery(`select ingestion.execute_foundation_mapping_reprojection_v1('${approvalId}','${token}');`,operator,"full35-duplicate");
      const competing=asyncQuery(`select ingestion.execute_foundation_mapping_reprojection_v1('${competingApproval}','${fixtureId(999803)}');`,operator,"full35-competing");
      const legacy=asyncQuery(`select * from ingestion.execute_foundation_lifecycle_update('${legacyRace.approvalId}');`,operator,"full35-legacy");
      await waitBlocked("full35-duplicate");await waitBlocked("full35-competing");await waitBlocked("full35-legacy");
      expect(()=>query("set lock_timeout='50ms';update ingestion.dataset_projection_current_heads set updated_at=now();")).toThrow(/lock timeout/);
      release();
      const results=await Promise.all([first,duplicate,competing,legacy]);
      expect(results[0].status,results[0].error).toBe(0);expect(results[1].status,results[1].error).toBe(0);
      receipt=JSON.parse(results[0].out);expect(JSON.parse(results[1].out)).toEqual(receipt);
      expect(results[2].status).not.toBe(0);expect(results[2].error).toMatch(/stale/);
      expect(results[3].status).not.toBe(0);expect(results[3].error).toMatch(/head|stale|changed|projection/i);
    } finally {release();remove();}
    expect(receipt.counts).toEqual(plan.counts);
    expect(privateFingerprint()).toBe(frozenPrivate);
    expect(json(`select jsonb_build_object('foods',(select count(*) from public.foods where is_public),
      'values',(select count(*) from public.food_nutrients),'versions',(select count(*) from ingestion.source_record_versions),
      'v2',(select count(*) from ingestion.food_projection_versions where projection_contract_version='foundation-lifecycle-projection/v2'),
      'states',(select count(*) from ingestion.food_nutrient_projection_versions where projection_contract_version='foundation-lifecycle-projection/v2'),
      'interpretations',(select count(*) from ingestion.source_mapping_interpretations),
      'head',(select current_head_version from ingestion.dataset_projection_current_heads));`))
      .toEqual({foods:353,values:6261,versions:353,v2:353,states:12355,interpretations:353,head:2});
  });
  test("independent Python Decimal oracle compares every value, method, unit, missing reason and evidence tuple",()=>{
    const result=JSON.parse(execFileSync("python3",["scripts/nutrition-usda-full35-reprojection-001/database_oracle.py"],
      {input:JSON.stringify(oraclePacket()),encoding:"utf8",maxBuffer:4*1024*1024}));
    expect(result).toMatchObject({states:12355,present:6261,missing:6094,withheld:1059,source_method_records:6452,
      public_values:6261,same_count_wrong_value_refused:true});
    writeFileSync(`${process.env.FULL35_EVIDENCE_DIR}/independent-oracle.json`,JSON.stringify(result,null,2));
  });

  test("authenticated reference RPCs expose all 35 values while v1 hashes and frozen snapshots remain unchanged",()=>{
    const ids=plan.items.map(i=>`'${i.before.food_id}'::uuid`).join(",");
    const rows=json<{food_id:string;nutrients:Record<string,string|null>;reference_fingerprint:string;serving_quantity:number;serving_unit:string}[]>(`begin;
      set local request.jwt.claim.sub='00000000-0000-4000-8000-000000999700';set local role authenticated;
      select jsonb_agg(to_jsonb(r)) from unnest(array[${ids}]) f(food_id)
      cross join lateral public.get_readable_food_nutrition_reference_v2(f.food_id) r;rollback;`);
    expect(rows).toHaveLength(353);
    for(const row of rows) {
      expect(row.reference_fingerprint).toMatch(/^[a-f0-9]{64}$/);
      expect(row.serving_quantity).toBe(100);expect(row.serving_unit).toBe("g");
      const states=plan.items.find(i=>i.before.food_id===row.food_id)!.projection_body.nutrient_states as Record<string,JsonValue>[];
      expect(Object.keys(row.nutrients)).toHaveLength(35);
      for(const state of states) {
        const value=row.nutrients[String(state.nutrient_code)];
        if(state.projection_state==="missing") expect(value).toBeNull();else expect(Number(value)).toBe(Number(state.amount));
      }
    }
    expect(query(`select count(*) from ingestion.food_projection_versions p where projection_contract_version='foundation-lifecycle-projection/v1'
      and lifecycle_projection_hash<>ingestion.fingerprint_json_v1(ingestion.foundation_lifecycle_projection_version_body_v1(p.id));`)).toBe("0");
    expect(legacyFingerprint()).toBe(frozenLegacy);expect(privateFingerprint()).toBe(frozenPrivate);
    expect(()=>query(`insert into ingestion.food_nutrient_projection_versions(food_projection_version_id,nutrient_id,nutrient_code,projection_state,projection_hash)
      values('${plan.items[0].before.prior_projection_id}',(select id from public.nutrients where code='fiber_g'),'fiber_g','missing',repeat('0',64));`)).toThrow(/v1 projection contract is unchanged/);
  });

  test("lost-response retry returns original persisted receipt without any write",()=>{
    const before=stateFingerprint();
    expect(json(`select ingestion.execute_foundation_mapping_reprojection_v1('${approvalId}','${token}');`,operator)).toEqual(receipt);
    expect(stateFingerprint()).toBe(before);
    expect(json(`select ingestion.get_foundation_mapping_reprojection_receipt_v1('${approvalId}');`,operator)).toEqual(receipt);
    expect(()=>query(`select ingestion.execute_foundation_mapping_reprojection_v1('${approvalId}','${fixtureId(999801)}');`,operator)).toThrow(/retry identity differs/);
    expect(stateFingerprint()).toBe(before);
  });
  test("separately approved compensation rejects invalid inverses, is atomic and serializes concurrent attempts",async()=>{
    test.setTimeout(600000);
    const compensation=makePlan(true);
    const wrong=structuredClone(compensation);wrong.rejected_receipt_id=fixtureId(999799);
    const beforeWrong=executionFingerprint();expect(()=>prepare(wrong)).toThrow();expect(executionFingerprint()).toBe(beforeWrong);
    const id=prepare(compensation),approval=approve(id,compensation);
    const competing=structuredClone(compensation);competing.implementation.commit="3".repeat(40);
    const competingId=prepare(competing,fixtureId(999805)),competingApproval=approve(competingId,competing);
    const added=String(query("select public_row_id from ingestion.mapping_reprojection_inserted_rows order by food_id,public_row_id offset 2500 limit 1;"));
    const beforeChanged=executionFingerprint();
    expect(()=>query(`begin;update public.food_nutrients set amount=amount+1 where id='${added}';
      select ingestion.execute_foundation_mapping_compensation_v1('${approval}','${fixtureId(999802)}');`,operator)).toThrow(/permission denied/);
    expect(()=>query(`begin;update public.food_nutrients set amount=amount+1 where id='${added}';
      set local session authorization ${operator};
      select ingestion.execute_foundation_mapping_compensation_v1('${approval}','${fixtureId(999802)}');`)).toThrow(/before-image|changed/);
    expect(executionFingerprint()).toBe(beforeChanged);
    const beforeStale=executionFingerprint();
    expect(()=>query(`begin;update ingestion.dataset_projection_current_heads p set current_dataset_projection_head_id=h.id,
      current_head_version=h.head_version,current_projection_fingerprint=h.dataset_projection_fingerprint
      from ingestion.dataset_projection_heads h where h.dataset_id=p.dataset_id and h.environment=p.environment and h.head_version=1;
      set local session authorization ${operator};
      select ingestion.execute_foundation_mapping_compensation_v1('${approval}','${fixtureId(999802)}');`)).toThrow(/stale/);
    expect(executionFingerprint()).toBe(beforeStale);
    const core=String(plan.items.flatMap(i=>i.before.public_rows)[0].id);
    const beforeExtra=executionFingerprint(),removeExtra=installFault("public.food_nutrients","delete",`delete from public.food_nutrients where id='${core}'::uuid;
      if found then raise exception 'UNAUTHORIZED extra deletion accepted';end if;raise exception 'extra core deletion refused';`);
    try {expect(()=>query(`select ingestion.execute_foundation_mapping_compensation_v1('${approval}','${fixtureId(999802)}');`,operator)).toThrow(/extra core deletion refused/);}
    finally {removeExtra();}
    expect(executionFingerprint()).toBe(beforeExtra);
    const beforeDelete=executionFingerprint();
    const removeFailure=installFault("public.food_nutrients","delete",`if old.id='${added}'::uuid and (select count(*) from public.food_nutrients n join ingestion.mapping_reprojection_inserted_rows r on r.public_row_id=n.id) between 1 and 5061 then raise exception 'synthetic_full35_partial_delete';end if;`);
    try {expect(()=>query(`select ingestion.execute_foundation_mapping_compensation_v1('${approval}','${fixtureId(999802)}');`,operator)).toThrow(/synthetic_full35_partial_delete/);}
    finally {removeFailure();}
    expect(executionFingerprint()).toBe(beforeDelete);
    for(const user of [operator,approver]) expect(()=>query(`delete from public.food_nutrients where id='${added}';`,user)).toThrow(/permission denied/);
    const remove=installFault("ingestion.mapping_reprojection_execution_context","insert","perform pg_catalog.pg_advisory_xact_lock(864350001);");
    const release=await barrier();
    const first=asyncQuery(`select ingestion.execute_foundation_mapping_compensation_v1('${approval}','${fixtureId(999802)}');`,operator,"full35-comp-first");
    let result:Record<string,unknown>;
    try {
      await waitBlocked("full35-comp-first");
      const duplicate=asyncQuery(`select ingestion.execute_foundation_mapping_compensation_v1('${approval}','${fixtureId(999802)}');`,operator,"full35-comp-duplicate");
      const different=asyncQuery(`select ingestion.execute_foundation_mapping_compensation_v1('${competingApproval}','${fixtureId(999805)}');`,operator,"full35-comp-different");
      await waitBlocked("full35-comp-duplicate");await waitBlocked("full35-comp-different");release();
      const results=await Promise.all([first,duplicate,different]);
      expect(results[0].status,results[0].error).toBe(0);expect(results[1].status,results[1].error).toBe(0);
      result=JSON.parse(results[0].out);expect(JSON.parse(results[1].out)).toEqual(result);
      expect(results[2].status).not.toBe(0);expect(results[2].error).toMatch(/stale/);
    } finally {release();remove();}
    expect(result!.resulting_head_version).toBe(3);
    expect(legacyFingerprint()).toBe(frozenLegacy);
    expect(privateFingerprint()).toBe(frozenPrivate);
    expect(query("select count(*) from public.food_nutrients;")).toBe("1199");
    expect(query("select count(*) from ingestion.source_mapping_interpretations;")).toBe("353");
    expect(query("select count(*) from ingestion.food_projection_versions where projection_contract_version='foundation-lifecycle-projection/v2';")).toBe("706");
    expect(query("select count(*) from ingestion.food_nutrient_evidence where mapping_reprojection_receipt_id is null;")).toBe("1199");
    expect(query(`select count(*) from ingestion.food_nutrient_evidence where mapping_reprojection_receipt_id='${receipt.receipt_id}';`)).toBe("6261");
    const beforeRetry=executionFingerprint();
    expect(json(`select ingestion.execute_foundation_mapping_compensation_v1('${approval}','${fixtureId(999802)}');`,operator)).toEqual(result!);
    expect(executionFingerprint()).toBe(beforeRetry);
    writeFileSync(`${process.env.FULL35_EVIDENCE_DIR}/local-positive.json`,JSON.stringify({reprojection:receipt,compensation:result!},null,2));
  });
});
