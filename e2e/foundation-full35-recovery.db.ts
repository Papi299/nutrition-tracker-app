import assert from "node:assert/strict";
import { execFileSync, spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { chmodSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { expect, test } from "@playwright/test";
import { captureBackup } from "../scripts/phase-11i-backup-pipeline.mjs";
import { restoreBackup } from "../scripts/phase-11i-restore-pipeline.mjs";
import {removeDumpRow,replaceDumpColumn} from "../scripts/full35-recovery-dump.mjs";
import { FULL35_OWNER_RELEASE_HISTORY } from "../scripts/full35-owner-release-history.mjs";
import { full35OwnerLogin, syntheticOwnerRelease } from "./fixtures/foundation-full35-owner-release";
import { FOUNDATION_WRITER_BARRIER_HISTORY } from "../scripts/foundation-writer-barrier-history.mjs";
import { RECOVERY_TARGET } from "../scripts/phase-11i-recovery-contract.mjs";
import { full35TableFingerprints, full35ReviewedSchemaHash, assertFull35SchemaHash, assertFreshFull35Marker } from "../scripts/phase-11i-full35-recovery.mjs";
import { buildMappingPlan, fingerprintMappingPlan, selectMappingActorAuthority, type MappingActorScope, type MappingPlan } from "../ingestion/usda/foundation/reprojection/contracts";
import { installSyntheticBaseline, fixtureId, fixtureHash, mappingId } from "./fixtures/foundation-full35-reprojection";
import { actorInput, installIdentityControllers, bindActor, proposeActorBinding, approveActorBinding, identityGovernor, identityReviewer, type ActorQuery, type PrincipalFixture } from "./fixtures/foundation-full35-actor-identity";

const ownerRelease = process.env.FULL35_ATOMIC_DIARY_RECOVERY === "50";
const writerBarrier = ownerRelease || process.env.FULL35_ATOMIC_DIARY_RECOVERY === "49";
const atomicDiary = writerBarrier || process.env.FULL35_ATOMIC_DIARY_RECOVERY === "1";
const historyHead=ownerRelease?FULL35_OWNER_RELEASE_HISTORY.head:writerBarrier?FOUNDATION_WRITER_BARRIER_HISTORY.head:atomicDiary?"20261102181943":"20261031104559";
const repository = process.cwd(), evidence = process.env.FULL35_EVIDENCE_DIR!;
const config = JSON.parse(readFileSync(join(evidence,"diagnostic-input.json"),"utf8")) as {source:string;target:string;sourceDirectory:string;targetDirectory:string;scratch:string};
const cli = resolve("node_modules/.bin/supabase");
const password = "synthetic-recovery-only", operator = "full35_recovery_operator", approver = "full35_recovery_approver";
const hash = (value:string|Buffer) => createHash("sha256").update(value).digest("hex");
function command(name:string,args:string[],input?:string|Buffer) {
  return execFileSync(name,args,{input,encoding:"utf8",timeout:1_200_000,maxBuffer:256*1024*1024,stdio:["pipe","pipe","pipe"]}).trim();
}
function db(container:string,sql:string,user="supabase_admin") {
  if (!/^supabase_db_(?:full35-recovery-source-[a-f0-9]{12}|phase-11i-recovery-isolated)$/.test(container)) throw new Error("Fixed local recovery container required.");
  return command("docker",["exec","-i","-e",`PGPASSWORD=${password}`,container,"psql",...(user==="postgres"||user==="supabase_admin"?[]:["-h","127.0.0.1"]),"-U",user,"-d","postgres","-X","-qAt","-F","\t","-v","ON_ERROR_STOP=1"],sql);
}
const source:ActorQuery=(sql,user)=>db(config.source,sql,user), target:ActorQuery=(sql,user)=>db(config.target,sql,user);
const rows=(q:ActorQuery)=>(sql:string)=>{const value=q(sql);return value?value.split(/\r?\n/).map(line=>line.split("\t")):[];};
const cliAt=(directory:string)=>(args:string[])=>command(cli,[...args,"--workdir",directory]);
const sourceCli=cliAt(config.sourceDirectory), targetCli=cliAt(config.targetDirectory);
const sourceIdentity={projectRef:"PHASE_11I_SYNTHETIC_POPULATED_FIXTURE",sourceEnvironment:"LocalSynthetic"};
function assertSource(identity:unknown){if(JSON.stringify(identity)!==JSON.stringify(sourceIdentity))throw new Error("Synthetic local recovery source mismatch.");}
function assertArtifact(id:string){assert.match(id,/^phase11i-PHASE_11I_SYNTHETIC_POPULATED_FIXTURE-\d{8}T\d{6}Z-[a-f0-9]{8}$/);}
let fixture:ReturnType<typeof installSyntheticBaseline>, op:PrincipalFixture, app:PrincipalFixture;
let originalPlan:MappingPlan, originalApproval:string, pendingApproval:string;
const originalToken=fixtureId(999840), compensationToken=fixtureId(999841), pendingToken=fixtureId(999842);
let original:string, compensation:string, core:string, frozen:ReturnType<typeof full35TableFingerprints>;
const checkpoints:Record<string,unknown>[]=[], negatives:Record<string,unknown>={};
const cert=join(config.scratch,"recipient.crt"),key=join(config.scratch,"recipient.key");
let recipient:string;
let lastCapture:Awaited<ReturnType<typeof captureBackup>>;
function installRoles(q:ActorQuery,padding=false) {
  if(padding) q("do $$ begin for i in 1..64 loop if not exists(select from pg_roles where rolname='full35_recovery_padding_'||i) then execute format('create role full35_recovery_padding_%s nologin',i);end if;end loop;end $$");
  for(const login of [operator,approver,identityGovernor,identityReviewer,...["anon","authenticated","service_role"].map(role=>"full35_recovery_"+role)]) {
    if(q(`select count(*) from pg_roles where rolname='${login}'`)==="1") q(`drop role ${login}`);
  }
  q(`create role ${operator} login password '${password}';create role ${approver} login password '${password}';grant ingestion_operator to ${operator};grant ingestion_approver to ${approver}`);
  installIdentityControllers(q,password);
  for(const role of ["anon","authenticated","service_role"])q(`create role full35_recovery_${role} login password '${password}';grant ${role} to full35_recovery_${role}`);
  if(!padding) q("do $$ begin for i in 1..64 loop if not exists(select from pg_roles where rolname='full35_recovery_padding_'||i) then execute format('create role full35_recovery_padding_%s nologin',i);end if;end loop;end $$");
}
function initializeSource(withMultiActor = true) {
  for(const key of Object.keys(atomicPayloads)){delete atomicPayloads[key];delete atomicResults[key];delete atomicKeys[key];}
  fixture=installSyntheticBaseline(source);
  // Extend the hand-authored fixture with completed durable owner metadata.
  // No Production identity or credential is used.
  source(`update auth.users set encrypted_password=extensions.crypt('synthetic-recovery-owner',extensions.gen_salt('bf',12));
    update public.account_activations set activation_completed_at=now(),eligibility_accepted_at=now();
    update public.foods set source_id=(select id from public.food_sources where code='user_custom') where owner_user_id is not null;
    insert into auth.identities(id,user_id,provider_id,identity_data,provider) values('${fixtureId(999701)}','${fixtureId(999700)}','synthetic-recovery-owner','{"sub":"${fixtureId(999700)}"}','email');
    select vault.create_secret('${hash("synthetic capability")}','account_closure_capability_v1');`);
  if(withMultiActor){op=bindActor(source,fixture.datasetId,operator,"operator");app=bindActor(source,fixture.datasetId,approver,"approver");}
  core=source("select to_jsonb(t)::text from public.food_nutrients t order by id");
  if(atomicDiary) {
    createAtomicOwnerEntry("before",source);
    for(const version of ownerRelease ? [] : [1,2]){
      const key=fixtureId(999870+version),food=source("select id from public.foods where is_public order by id limit 1");
      const originalArgs=`'${key}','2026-10-31','lunch','${food}','Synthetic historical manual receipt',null,200,'g',321,0,null,1,null`;
      const additional=`jsonb_build_object('version',1,'values',(select jsonb_agg(jsonb_build_object('code',d->>'code','amount',null)) from jsonb_array_elements(public.nutrient_snapshot_manifest_v1()) d where d->>'coreField' is null))`;
      const originalCall=version===1?`public.create_manual_diary_entry(${originalArgs})`:`public.create_manual_diary_entry_v2(${originalArgs},${additional})`;
      const result=source(`begin;set local role authenticated;set local request.jwt.claim.sub='${owner}';select row_to_json(r) from ${originalCall} r;commit;`);
      atomicPayloads[`legacy${version}`]=`select row_to_json(r) from public.create_reference_diary_entry_v1(${originalArgs},${version===2},${version===2?additional:"null"},'${"f".repeat(64)}',array['calories']) r;`;
      atomicResults[`legacy${version}`]=result;
    }
  }
  frozen=Object.fromEntries(Object.entries(full35TableFingerprints(rows(source))).filter(([name])=>name.startsWith("auth.")||
    ["public.profiles","public.food_favorites","public.diary_entries","public.saved_meals","public.saved_meal_items","public.recipes","public.recipe_ingredients","public.nutrition_targets","public.account_activations","public.manual_diary_entry_requests"].includes(name)));
}
const owner=fixtureId(999700);
const atomicKeys:Record<string,string>={};
const atomicPayloads:Record<string,string>={};
const atomicResults:Record<string,string>={};
function createAtomicOwnerEntry(label:string,q:ActorQuery) {
  const food=q("select id from public.foods where is_public order by id limit 1");
  const ref=JSON.parse(q(`begin;set local role authenticated;set local request.jwt.claim.sub='${owner}';select row_to_json(r) from public.get_readable_food_nutrition_reference_v2('${food}') r;commit;`));
  const key=fixtureId(label==="before"?999860:999861);atomicKeys[label]=key;
  const args=`'${key}','2026-11-01','lunch','${food}','Synthetic recovery atomic snapshot',null,100,'g',
    ${ref.nutrients.energy_kcal===null?"null":Math.round(Number(ref.nutrients.energy_kcal))},${ref.nutrients.protein_g??"null"},${ref.nutrients.carbohydrates_g??"null"},${ref.nutrients.fat_g??"null"},null,
    true,(select jsonb_build_object('version',1,'values',jsonb_agg(jsonb_build_object('code',d->>'code','amount',
      case when '${label}'='before' and d->>'code'='fiber_g' then '7'::jsonb else to_jsonb(('${JSON.stringify(ref.nutrients)}'::jsonb->> (d->>'code'))::numeric) end)))
      from jsonb_array_elements(public.nutrient_snapshot_manifest_v1()) d where d->>'coreField' is null),
    '${ref.reference_fingerprint}',${label==='before'?"array['calories','protein_g','carbohydrates_g','fat_g']::text[]":"(select array_agg(coalesce(d->>'coreField',d->>'code')) from jsonb_array_elements(public.nutrient_snapshot_manifest_v1()) d)"}`;
  atomicPayloads[label]=`select row_to_json(r) from public.create_reference_diary_entry_v1(${args}) r;`;
  atomicResults[label]=q(`begin;set local role authenticated;set local request.jwt.claim.sub='${owner}';${atomicPayloads[label]}commit;`);
  expect(JSON.parse(atomicResults[label]).result_status).toBe("success");
}
function exactAtomicOwnerRetry(q:ActorQuery) {
  for(const label of Object.keys(atomicPayloads)) {
    const before=full35TableFingerprints(rows(q));
    const actual=q(`begin;set local role authenticated;set local request.jwt.claim.sub='${owner}';${atomicPayloads[label]}commit;`);
    for(const field of ["result_status","diary_entry_id","completed_at"]) expect(JSON.parse(actual)[field]).toBe(JSON.parse(atomicResults[label])[field]);
    expect(full35TableFingerprints(rows(q))).toEqual(before);
  }
}
function makePlan(compensate=false,q:ActorQuery=source):MappingPlan {
  const scope=JSON.parse(q("select ingestion.get_foundation_mapping_reprojection_scope_v1('local')",operator));
  return buildMappingPlan({operation_kind:compensate?"compensation":"reprojection",dataset_id:fixture.datasetId,environment:"local",
    source_release_id:fixture.releaseId,mapping_version_id:mappingId,before_snapshot:scope.before_snapshot,
    actor_authority:selectMappingActorAuthority(scope.actor_authority as MappingActorScope,approver),
    operator_oid:Number(q(`select oid from pg_roles where rolname='${operator}'`)),operator_login:operator,
    approval_requirements:{approver_oid:Number(q(`select oid from pg_roles where rolname='${approver}'`)),not_before:new Date(Date.now()-60000).toISOString(),expires_at:new Date(Date.now()+7200000).toISOString()},
    implementation:{database_contract_hash:scope.database_contract_hash,commit:command("git",["rev-parse","HEAD"]),tree:command("git",["rev-parse","HEAD^{tree}"]),
      migrations:readdirSync("supabase/migrations").filter(n=>n.endsWith(".sql")&&n.slice(0,14)<=historyHead).sort().map(filename=>({filename,version:filename.slice(0,14),sha256:hash(readFileSync(`supabase/migrations/${filename}`))})),
      contract_versions:{parser:"usda-fdc-foundation-json/v1",importer:"usda-foundation-importer/v3",candidate:"foundation-normalized-candidate/v2",mapping:"usda-foundation-full35-direct-v2",projection:"foundation-lifecycle-projection/v2"}},
    qualification:{...fixture.source,historical_allowance_fingerprint:"bdfc95e5009a8d5c5a5bbf82b24dff1a4e8c3decd7bee4406286c543e661ad4a",rejected:JSON.parse(readFileSync("docs/evidence/nutrition-usda-full35-local-qual-001/qualification.json","utf8")).source_inspection.rejected_records,source_qualification_hash:fixtureHash("recovery independent oracle")},
    recovery_requirements:{qualification_hash:fixtureHash("local encrypted recovery engineering"),production_ready:false},rejected_receipt_id:compensate?JSON.parse(original).receipt_id:null,records:fixture.records});
}
function approve(plan:MappingPlan,token:string,q:ActorQuery=source) {
  const id=q(`select ingestion.prepare_foundation_mapping_${plan.operation_kind}_v1(${actorInput(plan)},'${token}')`,operator);
  return q(`select ingestion.approve_foundation_mapping_${plan.operation_kind}_v1('${id}','${fingerprintMappingPlan(plan)}','${plan.approval_requirements.expires_at}',${actorInput({independent_review_hash:fixtureHash("independent operation approval"),recovery_evidence_hash:plan.recovery_requirements.qualification_hash,approval_reference:"synthetic local independent reviewer"})})`,approver);
}
const retry=(kind:string,approval:string,token:string)=>`select ingestion.execute_foundation_mapping_${kind}_v1('${approval}','${token}')`;
function noMutationDenied(label:string,q:ActorQuery,sql:string,user:string,pattern=/binding|principal|identity|permission denied|42501|stale|read committed/i) {
  const before=full35TableFingerprints(rows(q));let error="";
  try{q("\\set VERBOSITY verbose\n"+sql,user);}catch(e){error=String((e as {stderr:Buffer}).stderr);}
  expect(error).toMatch(pattern);expect(full35TableFingerprints(rows(q))).toEqual(before);
  negatives[label]={result:"PASS",noUnauthorizedMutation:true,expectedRejection:pattern.source};
}
function exactReads(q:ActorQuery,both=false) {
  const before=full35TableFingerprints(rows(q));
  expect(q(retry("reprojection",originalApproval,originalToken),operator)).toBe(original);
  expect(q(`select ingestion.get_foundation_mapping_reprojection_receipt_v1('${originalApproval}')`,operator)).toBe(original);
  if(both){expect(q(retry("compensation",JSON.parse(compensation).approval_id,compensationToken),operator)).toBe(compensation);
    expect(q(`select ingestion.get_foundation_mapping_reprojection_receipt_v1('${JSON.parse(compensation).approval_id}')`,operator)).toBe(compensation);}
  expect(full35TableFingerprints(rows(q))).toEqual(before);
}
function independentOracle(q:ActorQuery, plan:Pick<MappingPlan,"items">) {
  const receipt=JSON.parse(original).receipt_id;
  const states=JSON.parse(q(`select jsonb_agg(jsonb_build_object('fdc_id',i.candidate_body->>'fdc_id','food_id',p.food_id,'mapping_hash',i.mapping_hash,'code',s.nutrient_code,
    'value',case when s.amount is null then null else trim_scale(s.amount)::text end,'source_id',s.source_nutrient_id,'source_unit',s.source_unit,'application_unit',s.application_unit,'basis','per_100g',
    'semantic',coalesce(s.source_semantic,'missing'),'derivation_code',s.derivation_code,'derivation_description',s.derivation_description,'raw_hash',i.raw_record_hash,'missing_reason',s.missing_reason)
    order by (i.candidate_body->>'fdc_id')::bigint,s.nutrient_code collate "C") from ingestion.food_nutrient_projection_versions s
    join ingestion.food_projection_versions p on p.id=s.food_projection_version_id join ingestion.source_mapping_interpretations i on i.id=p.source_mapping_interpretation_id where p.mapping_reprojection_receipt_id='${receipt}'`));
  const publicRows=JSON.parse(q(`with restored_values as (select n.food_id,n.nutrient_id,n.amount from public.food_nutrients n join public.nutrients d on d.id=n.nutrient_id
    where d.code in ('energy_kcal','protein_g','carbohydrates_g','fat_g') union all select food_id,nutrient_id,amount from ingestion.mapping_reprojection_inserted_rows where receipt_id='${receipt}')
    select jsonb_agg(jsonb_build_object('fdc_id',i.candidate_body->>'fdc_id','food_id',p.food_id,'mapping_hash',i.mapping_hash,'code',d.code,'value',trim_scale(n.amount)::text)
    order by (i.candidate_body->>'fdc_id')::bigint,d.code collate "C") from ingestion.food_projection_versions p join ingestion.source_mapping_interpretations i on i.id=p.source_mapping_interpretation_id
    join restored_values n on n.food_id=p.food_id join public.nutrients d on d.id=n.nutrient_id where p.mapping_reprojection_receipt_id='${receipt}'`));
  const interpretationEvidence=JSON.parse(q(`select jsonb_agg(jsonb_build_object('fdc_id',i.candidate_body->>'fdc_id','food_id',p.food_id,'mapping_hash',i.mapping_hash,'code',e->>'application_nutrient_code',
    'value',e->>'source_value','source_id',e->>'source_nutrient_id','source_unit',e->>'source_unit','application_unit',e->>'application_unit','basis',e->>'basis','semantic',e->>'semantic',
    'derivation_code',e->>'derivation_code','derivation_description',e->>'derivation_description','raw_hash',i.raw_record_hash,'source_name',e->>'source_nutrient_name','footnote',e->>'footnote','loq',e->>'loq','raw_field_path',e->>'raw_field_path'))
    from ingestion.source_mapping_interpretations i join ingestion.food_projection_versions p on p.source_mapping_interpretation_id=i.id
    cross join lateral jsonb_array_elements(i.candidate_body->'nutrient_evidence') e where p.mapping_reprojection_receipt_id='${receipt}'`));
  const packet={identity_bindings:plan.items.map(i=>({fdc_id:i.candidate.fdc_id,food_id:i.before.food_id})),raw_records:fixture.records.map(r=>r.record.raw),states,public_rows:publicRows,interpretation_evidence:interpretationEvidence};
  const result=JSON.parse(command("python3",["scripts/nutrition-usda-full35-reprojection-001/database_oracle.py"],JSON.stringify(packet)));
  expect(result).toMatchObject({states:12355,present:6261,missing:6094,withheld:1059,source_method_records:6452,public_values:6261,same_count_wrong_value_refused:true});return result;
}
function independentDatasetRoots(q:ActorQuery) {
  const packet=q(`select jsonb_build_object(
    'heads',(select jsonb_agg(jsonb_build_object('id',h.id,'version',h.head_version,'fingerprint',h.dataset_projection_fingerprint,
      'dataset_id',h.dataset_id,'environment',h.environment,'source_release_id',h.current_source_release_id,
      'receipt_id',h.mapping_reprojection_receipt_id,'mapping_version_id',p.mapping_version_id) order by h.head_version)
      from ingestion.dataset_projection_heads h left join ingestion.mapping_reprojection_receipts r on r.id=h.mapping_reprojection_receipt_id
      left join ingestion.mapping_reprojection_plans p on p.id=r.plan_id),
    'projections',(select jsonb_agg(jsonb_build_object('food_id',food_id,'projection_hash',projection_hash,
      'lifecycle_projection_hash',lifecycle_projection_hash,'projection_contract_version',projection_contract_version,
      'receipt_id',mapping_reprojection_receipt_id,'is_public',is_public,'is_archived',is_archived)) from ingestion.food_projection_versions),
    'pointer',(select to_jsonb(c) from ingestion.dataset_projection_current_heads c))`);
  const result=JSON.parse(command("python3",["scripts/nutrition-usda-full35-recovery-001b/verify_dataset_roots.py"],packet));
  expect(result).toMatchObject({result:"PASS",current_pointer_verified:true,same_count_changed_projection_hash_refused:true});return result;
}
async function restoredAtomicRace() {
  const proposal=makePlan(false,target), token=fixtureId(999862), approval=approve(proposal,token,target);
  function launch(sql:string,user:string,keep=false) {
    const child=spawn("docker",["exec","-i","-e",`PGPASSWORD=${password}`,config.target,"psql",
      ...(user==="supabase_admin"?[]:["-h","127.0.0.1"]),"-U",user,"-d","postgres","-X","-qAt","-v","ON_ERROR_STOP=1"]);
    let output="",error="";child.stdout.on("data",b=>output+=b);child.stderr.on("data",b=>error+=b);
    const done=new Promise<string>((ok,fail)=>{child.on("error",fail);child.on("close",code=>code===0?ok(output.trim()):fail(new Error(error)));});
    if(keep)child.stdin.write(sql);else child.stdin.end(sql);
    return {child,done,output:()=>output};
  }
  const controller=launch("select pg_advisory_lock(90048);\\echo atomic_recovery_ready\n","supabase_admin",true);
  await expect.poll(()=>controller.output().includes("atomic_recovery_ready")).toBe(true);
  let released=false;
  try {
    const writer=launch(`set application_name='restored_atomic_writer';begin;${retry("reprojection",approval,token)};select pg_advisory_xact_lock(90048);commit;`,operator);
    await expect.poll(()=>Number(target("select count(*) from pg_stat_activity where application_name='restored_atomic_writer' and wait_event='advisory'")),{timeout:90000}).toBe(1);
    const before=target(`select count(*) from public.manual_diary_entry_requests where user_id='${owner}'`);
    const attempt=atomicPayloads.before.replaceAll(atomicKeys.before,fixtureId(999863));
    const diary=launch(`set application_name='restored_atomic_diary';begin;set local role authenticated;set local request.jwt.claim.sub='${owner}';${attempt}commit;`,"full35_recovery_authenticated");
    await expect.poll(()=>Number(target("select count(*) from pg_stat_activity where application_name='restored_atomic_diary' and wait_event='advisory'"))).toBe(1);
    const locks=JSON.parse(target(`select jsonb_agg(jsonb_build_object('application',application_name,'wait',wait_event,'blockers',pg_blocking_pids(pid))) from pg_stat_activity where application_name in('restored_atomic_diary','restored_atomic_writer')`));
    controller.child.stdin.end("select pg_advisory_unlock(90048);\\q\n");await controller.done;released=true;
    await writer.done;const result=JSON.parse(await diary.done);expect(result.result_status).toBe("reference_changed");
    expect(target(`select count(*) from public.manual_diary_entry_requests where user_id='${owner}'`)).toBe(before);
    const current=target(`begin;set local role authenticated;set local request.jwt.claim.sub='${owner}';select reference_fingerprint from public.get_readable_food_nutrition_reference_v2('${proposal.items[0].before.food_id}');commit;`);
    expect(result.reference_fingerprint).toBe(current);
    exactAtomicOwnerRetry(target);
    return {result:"PASS",writerCommitted:true,diaryWaitedForWriter:true,currentFingerprintAfterWait:true,noNewReceipt:true,completedOriginalRetry:true,locks};
  }finally{if(!released){controller.child.stdin.end("select pg_advisory_unlock(90048);\\q\n");await controller.done;}}
}

async function checkpoint(label:string,expectedHead:number,oraclePlan:Pick<MappingPlan,"items">=originalPlan) {
  process.stdout.write(`Capturing approved encrypted checkpoint ${label}.\n`);
  const backupRoot=join(config.scratch,label);mkdirSync(backupRoot,{mode:0o700});
  const trace:string[]=[];
  const captured=await captureBackup({sourceIdentity,assertSourceIdentity:assertSource,assertArtifactIdentity:assertArtifact,assertRecipient:(actual:string)=>assert.equal(actual,recipient),
    backupRootInput:backupRoot,recipientInput:cert,privateKey:key,operator:"SyntheticLocalRecovery",project:{id:sourceIdentity.projectRef,status:"ACTIVE_HEALTHY",region:"LOCAL_DOCKER",database:{version:"LOCAL_SUPABASE"}},authConfig:{},
    psqlBinary:"psql",rows:(sql:string,stage:string)=>{trace.push(stage);return rows(source)(sql);},refreshSourceTransport:async()=>{trace.push("REFRESH_LOCAL_TRANSPORT");},
    runSupabase:(args:string[])=>{trace.push(`CAPTURE_${args.slice(0,2).join("_")}`);return sourceCli(args[0]==="db"&&args[1]==="dump"?[...args,"--local"]:args);},localNutritionSnapshots:false});
  lastCapture=captured;
  const verifiedArtifact=JSON.parse(command(process.execPath,["scripts/verify-full35-recovery-artifact-local.mjs"],JSON.stringify({backupRoot,scratch:config.scratch,repository,head:command("git",["rev-parse","HEAD"]),recipientSha256:recipient})));
  expect(verifiedArtifact.encryptedArchiveSha256).toBe(captured.encryptedArchiveSha256);expect(verifiedArtifact.manifestSha256).toBe(captured.manifestSha256);
  trace.push("VERIFY_APPROVED_ARTIFACT_PAIR");
  const sourceEpoch=source("select cluster_id from private.mapping_actor_cluster_epoch");
  let restored;
  try{process.chdir(config.targetDirectory);
    restored=restoreBackup({archiveInput:captured.archivePath,manifestInput:captured.manifestPath,recipientInput:cert,privateKeyInput:key,reportInput:join(backupRoot,"restore-report.json"),targetIdentity:RECOVERY_TARGET,
      assertSourceIdentity:assertSource,assertArtifactIdentity:assertArtifact,assertRecipient:(actual:string)=>assert.equal(actual,recipient),localNutritionSnapshots:false,
      runSupabase:(args:string[])=>{trace.push(`RESTORE_${args.slice(0,2).join("_")}`);const value=targetCli(args);
        if(args[0]==="db"&&args[1]==="reset")installRoles(target,true);return value;}});
  }finally{process.chdir(repository);}
  expect(restored.full35Recovery?.result).toBe("PASS");
  const quantities=JSON.parse(target(`select jsonb_build_object('public_foods',(select count(*) from public.foods where is_public),'source_versions',(select count(*) from ingestion.source_record_versions),
    'nutrients',(select count(*) from public.food_nutrients),'v2_projections',(select count(*) from ingestion.food_projection_versions where projection_contract_version='foundation-lifecycle-projection/v2'),
    'v2_states',(select count(*) from ingestion.food_nutrient_projection_versions where projection_contract_version='foundation-lifecycle-projection/v2'),
    'interpretations',(select count(*) from ingestion.source_mapping_interpretations),'receipts',(select count(*) from ingestion.mapping_reprojection_receipts),
    'heads',(select jsonb_agg(head_version order by head_version) from ingestion.dataset_projection_heads))`));
  expect(quantities).toEqual({public_foods:353,source_versions:353,nutrients:expectedHead===2?6261:1199,v2_projections:353*(expectedHead-1),v2_states:12355*(expectedHead-1),interpretations:expectedHead===1?0:353,receipts:expectedHead-1,heads:Array.from({length:expectedHead},(_,i)=>i+1)});
  const oracle=expectedHead>1?independentOracle(target,oraclePlan):null;
  const datasetRoots=independentDatasetRoots(target);expect(datasetRoots.heads).toHaveLength(expectedHead);
  const targetEpoch=target("select cluster_id from private.mapping_actor_cluster_epoch");expect(targetEpoch).not.toBe(sourceEpoch);
  const sourceRoles=JSON.parse(source(`select jsonb_object_agg(rolname,oid::bigint) from pg_roles where rolname in ('${operator}','${approver}')`));
  const targetRoles=JSON.parse(target(`select jsonb_object_agg(rolname,oid::bigint) from pg_roles where rolname in ('${operator}','${approver}')`));
  expect(targetRoles[operator]).not.toBe(sourceRoles[operator]);
  if(expectedHead===1 && !writerBarrier){
    const name=target(`select rolname from pg_roles where oid='${sourceRoles[operator]}'::oid`);expect(name).toMatch(/^full35_recovery_padding_\d+$/);
    target(`alter role ${name} login password '${password}';grant ingestion_operator to ${name}`);
    noMutationDenied("D04_same_numeric_oid",target,"select ingestion.get_foundation_mapping_reprojection_scope_v1('local')",name);
    target(`revoke ingestion_operator from ${name};alter role ${name} nologin`);
  }
  if(atomicDiary)exactAtomicOwnerRetry(target);
  const actual=full35TableFingerprints(rows(target));for(const [name,state] of Object.entries(frozen))expect(actual[name]).toEqual(state);
  expect(target("select current_head_version from ingestion.dataset_projection_current_heads")).toBe(String(expectedHead));
  if(expectedHead>1 && !ownerRelease){noMutationDenied(`${label}_unverified_receipt`,target,`select ingestion.get_foundation_mapping_reprojection_receipt_v1('${originalApproval}')`,operator);
    noMutationDenied(`${label}_copied_binding`,target,retry("reprojection",originalApproval,originalToken),operator);}
  const before=full35TableFingerprints(rows(target));
  if(!ownerRelease){bindActor(target,fixture.datasetId,operator,"operator",op);bindActor(target,fixture.datasetId,approver,"approver",app);}
  const after=full35TableFingerprints(rows(target));for(const name of Object.keys(before).filter(n=>!n.startsWith("ingestion.mapping_actor_")))expect(after[name]).toEqual(before[name]);
  if(expectedHead>1 && !ownerRelease){exactReads(target,expectedHead===3);noMutationDenied(`${label}_pending_approval`,target,retry("compensation",pendingApproval,pendingToken),operator,/pending operation binding is stale/);}
  const barrierAdmission = writerBarrier && !ownerRelease ? verifyWriterBarrier(target, 999890) : undefined;
  const atomicRace=atomicDiary&&!ownerRelease&&expectedHead===1?await restoredAtomicRace():undefined;
  checkpoints.push({scenario:label,atomicRace,barrierAdmission,trace,approvedPipeline:true,approvedArtifactPairVerifier:true,encryptedArchiveSha256:captured.encryptedArchiveSha256,manifestSha256:captured.manifestSha256,
    quantities,oracle,datasetRoots,sourceRoles,targetRoles,sourceEpoch,targetEpoch,full35Recovery:restored.full35Recovery,sourceCounts:restored.sourceSafeCounts,
    allOwnerRowsAndTimestampsEqual:true,completedReceiptsByteEqual:expectedHead>1&&!ownerRelease,completedRetriesNoMutation:expectedHead>1&&!ownerRelease,
    independentDecisions:JSON.parse(target(`select jsonb_agg(jsonb_build_object('body',b.body,'hash',b.body_hash,'request',r.body,'request_hash',r.body_hash) order by b.principal_id)
      from ingestion.mapping_actor_current_bindings c join ingestion.mapping_actor_bindings b on b.id=c.binding_id join ingestion.mapping_actor_binding_requests r on r.id=b.request_id`))});
  process.stdout.write(`Approved encrypted checkpoint ${label} passed.\n`);
}

function recoveryNegatives() {
  const capture=lastCapture, archiveBytes=readFileSync(capture.archivePath), manifestBytes=readFileSync(capture.manifestPath);
  const manifest=JSON.parse(manifestBytes.toString("utf8")), badRoot=join(config.scratch,"negative-content"),tar=join(config.scratch,"negative.tar");
  mkdirSync(badRoot,{mode:0o700});command("openssl",["cms","-decrypt","-binary","-inform","DER","-in",capture.archivePath,"-recip",cert,"-inkey",key,"-out",tar]);
  command("tar",["-xf",tar,"-C",badRoot]);
  const contentPath=join(badRoot,"backup-content-manifest.json"),contentBytes=readFileSync(contentPath),dataPath=join(badRoot,"application-data.sql"),dataBytes=readFileSync(dataPath);
  const ledgerPath=join(badRoot,"migration-ledger.json"),ledgerBytes=readFileSync(ledgerPath);
  function restoreRejected(label:string,changeManifest?:(m:typeof manifest)=>void,overrides:Record<string,unknown>={},replay=false,postResetSql?:string) {
    const started=Date.now(),before=full35TableFingerprints(rows(target));let resets=0,error="";
    const changed=JSON.parse(readFileSync(capture.manifestPath,"utf8"));changeManifest?.(changed);writeFileSync(capture.manifestPath,JSON.stringify(changed));
    const report=join(config.scratch,"negative-restore.json");expect(existsSync(report)).toBe(false);
    try{process.chdir(config.targetDirectory);
      restoreBackup({archiveInput:capture.archivePath,manifestInput:capture.manifestPath,recipientInput:cert,privateKeyInput:key,reportInput:report,targetIdentity:RECOVERY_TARGET,
        assertSourceIdentity:assertSource,assertArtifactIdentity:assertArtifact,assertRecipient:(actual:string)=>assert.equal(actual,recipient),localNutritionSnapshots:false,
        runSupabase:(args:string[])=>{if(args[0]==="db"&&args[1]==="reset")resets++;const value=targetCli(args);if(args[0]==="db"&&args[1]==="reset"){installRoles(target,true);if(postResetSql)target(postResetSql);}return value;},...overrides});
    }catch(e){error=String((e as Error).message);}finally{process.chdir(repository);writeFileSync(capture.manifestPath,manifestBytes);}
    expect(error).toMatch(/mismatch|forbidden|failed|reviewed|target|unsafe|count|ledger|fingerprint|schema/i);expect(existsSync(report)).toBe(false);
    if(postResetSql){expect(resets).toBe(1);expect(error).toMatch(/schema|fingerprint mismatch/);expect(target("select count(*) from auth.users")).toBe("0");expect(target("select count(*) from ingestion.mapping_reprojection_receipts")).toBe("0");}
    else if(!replay){expect(resets).toBe(0);expect(full35TableFingerprints(rows(target))).toEqual(before);}
    else {expect(error).toMatch(/Full35 complete persisted row fingerprint mismatch/);expect(resets).toBe(1);expect(target("select count(*) from ingestion.mapping_reprojection_receipts")).toBe("0");expect(target("select count(*) from auth.users")).toBe("0");expect(target("select count(*) from ingestion.mapping_actor_current_bindings")).toBe("0");}
    negatives[label]={result:"PASS",expectedRejection:error,noUnauthorizedMutation:true,targetResetCount:resets,failedReplayRolledBack:replay,elapsedMs:Date.now()-started};
    process.stdout.write(`Negative recovery case ${label} refused with no unauthorized mutation.\n`);
  }
  function innerRejected(label:string,filename:string,mutate:(value:string)=>string,replay=false,updateDigest=true) {
    const file=join(badRoot,filename),originalBytes=readFileSync(file),content=JSON.parse(contentBytes.toString("utf8")),changed=structuredClone(manifest);
    const mutated=mutate(originalBytes.toString("utf8"));
    // Playwright retains expected arguments in step metadata. Keep each large
    // plaintext dump out of that history and compare the complete bytes here.
    assert.ok(mutated!==originalBytes.toString("utf8"),"Synthetic tampering must change dump bytes.");
    writeFileSync(file,mutated);
    if(updateDigest){const artifact=content.artifacts.find((a:{filename:string})=>a.filename===filename);artifact.sha256=hash(readFileSync(file));artifact.bytes=readFileSync(file).length;}
    writeFileSync(contentPath,JSON.stringify(content));changed.contentManifestSha256=hash(readFileSync(contentPath));command("tar",["-cf",tar,"-C",badRoot,"."]);changed.plaintextArchiveSha256=hash(readFileSync(tar));
    command("openssl",["cms","-encrypt","-binary","-aes-256-gcm","-outform","DER","-in",tar,"-out",capture.archivePath,cert]);changed.encryptedArchiveSha256=hash(readFileSync(capture.archivePath));writeFileSync(capture.manifestPath,JSON.stringify(changed));
    try{restoreRejected(label,undefined,{},replay);}finally{writeFileSync(file,originalBytes);writeFileSync(contentPath,contentBytes);writeFileSync(capture.archivePath,archiveBytes);writeFileSync(capture.manifestPath,manifestBytes);}
  }
  restoreRejected("H05_wrong_recipient",m=>{m.encryption.recipientCertificateSha256="f".repeat(64);});
  restoreRejected("H06_wrong_source",m=>{m.sourceProjectRef="WRONG_SOURCE";});
  restoreRejected("H06_wrong_target",undefined,{targetIdentity:"ordinary-development"});
  restoreRejected("H06_nonlocal_target",undefined,{runSupabase:(args:string[])=>args[0]==="status"?'DB_URL="postgresql://synthetic@nonlocal.invalid/postgres"':targetCli(args)});
  const corrupt=Buffer.from(archiveBytes);corrupt[corrupt.length-1]^=1;writeFileSync(capture.archivePath,corrupt);
  try{restoreRejected("H07_ciphertext_digest");restoreRejected("H07_ciphertext_authentication",m=>{m.encryptedArchiveSha256=hash(corrupt);});}finally{writeFileSync(capture.archivePath,archiveBytes);}
  innerRejected("H08_artifact_digest","application-data.sql",text=>text+"\n-- tampered artifact\n",false,false);
  for(const [label,change] of [
    ["H01_incorrect_count",(v:string[])=>v.pop()],
    ["H04_partial_ledger",(v:string[])=>v.splice(10,1)],
    ["H01_wrong_head",(v:string[])=>{v[46]="20261031104560";}],
    ["H01_unknown_48",(v:string[])=>v.push("20261101000000")],
    ["H01_duplicate",(v:string[])=>{v[10]=v[9];}],
    ["H01_reordered",(v:string[])=>{[v[10],v[11]]=[v[11],v[10]];}],
  ] as const) innerRejected(label,"migration-ledger.json",text=>{const data=JSON.parse(text);change(data.versions);return JSON.stringify(data);});
  if(atomicDiary){
    innerRejected("A48_unknown_49","migration-ledger.json",text=>{const data=JSON.parse(text);data.versions.push("20270101000000");return JSON.stringify(data);});
    innerRejected("A48_wrong_version","migration-ledger.json",text=>{const data=JSON.parse(text);data.versions[47]="20261102181944";return JSON.stringify(data);});
  }
  for(const [label,index] of [["H03_tampered_predecessor",0],["H02_tampered_migration47",46]] as const) {
    const file=join(config.targetDirectory,"supabase/migrations",readdirSync("supabase/migrations").filter(n=>n.endsWith(".sql")).sort()[index]),bytes=readFileSync(file);writeFileSync(file,Buffer.concat([bytes,Buffer.from("\n-- tamper\n")]));
    try{restoreRejected(label);}finally{writeFileSync(file,bytes);}
  }
  const sql47=join(config.targetDirectory,"supabase/migrations/20261031104559_foundation_full35_mapping_reprojection_v1.sql"),corrected=readFileSync(sql47);
  // Immutable defect bytes remain available after squash and branch deletion.
  const obsoleteSql=readFileSync("docs/evidence/nutrition-usda-full35-combined-integration-001/defective-migration47.sql.historical");
  expect(hash(obsoleteSql)).toBe("907f2b14e3baa485f1b9e92e6c3f601cc0f434945c48fbef9b0c823b781b1703");
  writeFileSync(sql47,obsoleteSql);
  try{restoreRejected("H02_obsolete_defective_SQL");}finally{writeFileSync(sql47,corrected);}
  if(atomicDiary){
    const signature="public.create_reference_diary_entry_v1(uuid,date,text,uuid,text,text,numeric,text,integer,numeric,numeric,numeric,text,boolean,jsonb,text,text[])";
    for(const [label,sql] of [
      ["A48_restore_wrong_body","create or replace function private.diary_governed_dataset_v1(p_food_id uuid) returns uuid language sql stable security definer set search_path='' as 'select null::uuid'"],
      ["A48_restore_wrong_ACL",`grant execute on function ${signature} to anon`],
      ["A48_restore_security_definer",`alter function ${signature} security definer`],
    ]) restoreRejected(label,undefined,{},false,sql);
    const sql48=join(config.targetDirectory,"supabase/migrations/20261102181943_atomic_food_diary_persistence_v1.sql"),bytes=readFileSync(sql48);
    writeFileSync(sql48,Buffer.concat([bytes,Buffer.from("\n-- wrong atomic body\n")]));
    try{restoreRejected("A48_wrong_SQL_hash");}finally{writeFileSync(sql48,bytes);}
    innerRejected("A48_missing_diary_receipt","application-data.sql",text=>removeDumpRow(text,"public.manual_diary_entry_requests"),true);
  }
  innerRejected("D01_source_private_marker_in_payload","application-data.sql",text=>text+`\nINSERT INTO private.mapping_actor_cluster_epoch(singleton,cluster_id) VALUES (true,'${source("select cluster_id from private.mapping_actor_cluster_epoch")}');\n`);
  innerRejected("D02_invalid_marker_metadata","source-snapshot-redacted.json",text=>{const data=JSON.parse(text);data.full35Recovery.sourceClusterMarker=null;return JSON.stringify(data);});
  // A new dump with all outer/content digests recomputed still cannot omit any
  // protected row. These failures reach the real loader and roll back atomically.
  for(const [label,table,needle] of [
    ["H09_missing_v2_projection","ingestion.food_projection_versions","foundation-lifecycle-projection/v2"],
    ["H10_missing_full35_state","ingestion.food_nutrient_projection_versions","foundation-lifecycle-projection/v2"],
    ["H11_missing_evidence_link","ingestion.food_nutrient_projection_evidence_links",""],
    ["H13_missing_source_version","ingestion.source_record_versions",""],
    ["H14_missing_receipt","ingestion.mapping_reprojection_receipts",""],
    ["H15_inconsistent_dataset_pointer","ingestion.dataset_projection_current_heads",""],
    ["H20_lost_owner_snapshot","public.diary_entries",""],
    ["H21_invalid_compensation_provenance","ingestion.mapping_reprojection_inserted_rows",""],
  ]) innerRejected(label,"application-data.sql",text=>removeDumpRow(text,table,needle),true);
  innerRejected("H20_lost_private_custom_food","application-data.sql",text=>removeDumpRow(text,"public.foods",fixtureId(999705)),true);
  innerRejected("H20_lost_auth_identity","auth-durable-data.sql",text=>removeDumpRow(text,"auth.identities"),true);
  innerRejected("H19_forged_execution_context","application-data.sql",text=>text+`\ninsert into ingestion.mapping_reprojection_execution_context(backend_pid,transaction_id,plan_id,approval_id)
    select pg_backend_pid(),pg_current_xact_id(),plan_id,id from ingestion.mapping_reprojection_approvals order by id limit 1;\n`,true);
  innerRejected("H11_incorrect_evidence_link","application-data.sql",text=>replaceDumpColumn(text,"ingestion.food_nutrient_projection_evidence_links","food_nutrient_evidence_id",()=>`'${fixtureId(999888)}'`),true);
  innerRejected("H12_incorrect_mapping_hash","application-data.sql",text=>replaceDumpColumn(text,"ingestion.source_mapping_interpretations","mapping_hash",()=>`'${"f".repeat(64)}'`),true);
  innerRejected("H15_incorrect_current_fingerprint","application-data.sql",text=>replaceDumpColumn(text,"ingestion.dataset_projection_current_heads","current_projection_fingerprint",()=>`'${"f".repeat(64)}'`),true);
  innerRejected("N_same_count_wrong_public_value","application-data.sql",text=>replaceDumpColumn(text,"public.food_nutrients","amount",()=>"999999.1234"),true);
  innerRejected("H21_incorrect_compensation_row_image","application-data.sql",text=>replaceDumpColumn(text,"ingestion.mapping_reprojection_inserted_rows","row_image",(old:string)=>{
    const row=JSON.parse(old.slice(1,-1).replaceAll("''","'"));row.amount="999999.1234";return "'"+JSON.stringify(row).replaceAll("'","''")+"'";
  }),true);
  writeFileSync(dataPath,dataBytes);writeFileSync(ledgerPath,ledgerBytes);rmSync(badRoot,{recursive:true});rmSync(tar);
}

function ownerTransaction(sql: string) {
  return `begin;set local role authenticated;set local request.jwt.claim.sub='${owner}';${sql} commit;`;
}
function barrierArgs(q: ActorQuery, id: number, foodId?: string | null, calories = 0) {
  const food = foodId === undefined ? q("select id from public.foods where is_public order by id limit 1") : foodId;
  return `'${fixtureId(id)}','2026-11-06','lunch',${food ? `'${food}'` : "null"},'Synthetic barrier diary',null,100,'g',${calories},0,null,0,null`;
}
function verifyWriterBarrier(q: ActorQuery, firstRequest: number) {
  const food = q("select id from public.foods where is_public order by id limit 1");
  const request = barrierArgs(q, firstRequest, food);
  for (const [label, sql] of [
    ["legacy_v1", `select * from public.create_manual_diary_entry(${request});`],
    ["legacy_v2", `select * from public.create_manual_diary_entry_v2(${request},null);`],
    ["direct_insert", `insert into public.diary_entries(user_id,food_id,food_name,entry_date,meal_type)
      values('${owner}','${food}','Synthetic bypass','2026-11-06','lunch');`],
  ]) noMutationDenied(label,q,ownerTransaction(sql),"full35_recovery_authenticated",/42501.*row-level security/);
  noMutationDenied("role_switch",q,"set role diary_reference_writer;","full35_recovery_authenticated",/42501.*permission denied/);
  const signature = "create_reference_diary_entry_v1(uuid,date,text,uuid,text,text,numeric,text,integer,numeric,numeric,numeric,text,boolean,jsonb,text,text[])";
  const privilegeChecks = JSON.parse(q(`select jsonb_build_object(
    'restrictedRole',(select not rolcanlogin and not rolbypassrls and not rolsuper and not rolcreaterole
      from pg_roles where rolname='diary_reference_writer'),
    'noIngestionWrite',not has_any_column_privilege('diary_reference_writer','ingestion.source_records','UPDATE'),
    'privateAuth',not has_any_column_privilege('diary_reference_writer','auth.users','SELECT'),
    'privateSchemaNoCreate',not has_schema_privilege('diary_reference_writer','private','CREATE'),
    'noApiRoleSwitch',not pg_has_role('authenticator','diary_reference_writer','MEMBER'),
    'noAnonymousRpc',not has_function_privilege('anon','public.${signature}','EXECUTE'),
    'noServiceRpc',not has_function_privilege('service_role','private.${signature}','EXECUTE'),
    'privateDefiner',(select prosecdef and pg_get_userbyid(proowner)='diary_reference_writer'
      from pg_proc where oid='private.${signature}'::regprocedure),
    'publicInvoker',(select not prosecdef from pg_proc where oid='public.${signature}'::regprocedure))`));
  expect(privilegeChecks).toEqual({restrictedRole:true,noIngestionWrite:true,privateAuth:true,privateSchemaNoCreate:true,
    noApiRoleSwitch:true,noAnonymousRpc:true,noServiceRpc:true,privateDefiner:true,publicInvoker:true});
  // The writer inherits existing custom-food ACLs. The normal RLS and
  // governed mutation guard must still prevent edits to this Foundation food.
  const beforeCatalog = full35TableFingerprints(rows(q))["public.food_nutrients"];
  expect(q(`begin;set local role diary_reference_writer;set local request.jwt.claim.sub='${owner}';
    with changed as (update public.food_nutrients set amount=0 where food_id='${food}' returning 1)
    select count(*) from changed;rollback;`)).toBe("0");
  expect(full35TableFingerprints(rows(q))["public.food_nutrients"]).toEqual(beforeCatalog);
  const reference = JSON.parse(q(ownerTransaction(`select row_to_json(r) from public.get_readable_food_nutrition_reference_v2('${food}') r;`)));
  const fingerprint = reference.reference_fingerprint;
  const automaticArgs = barrierArgs(q,firstRequest+2,food,Math.round(Number(reference.nutrients.energy_kcal)));
  expect(q(ownerTransaction(`select result_status from public.create_reference_diary_entry_v1(
    ${automaticArgs},false,null,'${fingerprint}',array['calories']);`),"full35_recovery_authenticated")).toBe("success");
  const linked = ownerTransaction(`select row_to_json(r) from public.create_reference_diary_entry_v1(${request},false,null,'${fingerprint}',array[]::text[]) r;`);
  const snapshot = JSON.parse(q(linked,"full35_recovery_authenticated"));
  expect(snapshot.result_status).toBe("success");
  expect(q(`select calories from public.diary_entries where id='${snapshot.diary_entry_id}'`)).toBe("0");
  const beforeRetry = full35TableFingerprints(rows(q));
  expect(JSON.parse(q(linked,"full35_recovery_authenticated"))).toEqual(snapshot);
  const legacyRetry = q(ownerTransaction(`select row_to_json(r) from public.create_manual_diary_entry(${request}) r;`),
    "full35_recovery_authenticated");
  expect(JSON.parse(legacyRetry)).toMatchObject({result_status:"success",diary_entry_id:snapshot.diary_entry_id,completed_at:snapshot.completed_at});
  expect(full35TableFingerprints(rows(q))).toEqual(beforeRetry);
  expect(q(ownerTransaction(`select result_status from public.create_manual_diary_entry(${barrierArgs(q, firstRequest+1, null)});`),
    "full35_recovery_authenticated")).toBe("success");
  return {legacyV1Denied:true,legacyV2Denied:true,directDenied:true,noPartialReceipt:true,roleIsolation:true,
    validAtomic:true,linkedManualZero:true,unlinkedManual:true,exactRetry:true};
}
async function migrateWriterBarrier() {
  const pin = FOUNDATION_WRITER_BARRIER_HISTORY;
  const migration = readFileSync(join(repository,"supabase/migrations",pin.filename),"utf8");
  const before = full35TableFingerprints(rows(source));
  const beforeSchema = full35ReviewedSchemaHash(rows(source));
  const history = () => source(`select jsonb_build_object(
    'entries',(select jsonb_agg(to_jsonb(d) order by d.id) from public.diary_entries d where not exists(
      select from public.manual_diary_entry_requests r where r.idempotency_key='${fixtureId(999878)}'
      and r.completed_diary_entry_id=d.id)),
    'receipts',(select jsonb_agg(to_jsonb(r) order by r.id) from public.manual_diary_entry_requests r
      where r.idempotency_key<>'${fixtureId(999878)}'))`);
  const originalHistory = history();
  const originalLedger = source("select version from supabase_migrations.schema_migrations order by version");
  expect(originalLedger.split("\n")).toHaveLength(48);
  const install = `${migration}
    insert into supabase_migrations.schema_migrations(version,name,statements)
    values('${pin.head}','${pin.filename.slice(15,-4)}',array[]::text[]);`;
  const failed = `begin;set local lock_timeout='5s';${install} select 1/0;commit;`;
  expect(() => source(failed,"postgres")).toThrow();
  expect(source("select version from supabase_migrations.schema_migrations order by version")).toBe(originalLedger);
  expect(full35ReviewedSchemaHash(rows(source))).toBe(beforeSchema);
  expect(full35TableFingerprints(rows(source))).toEqual(before);
  expect(source("select to_regrole('diary_reference_writer') is null")).toBe("t");

  // Hold an actual admitted old transaction, then queue migration and another
  // legacy insert. Check lock dependencies before releasing the first writer.
  const launch = (sql: string, user: string, keep = false) => {
    const child = spawn("docker",["exec","-i",config.source,"psql","-U",user,"-d","postgres","-X","-qAt","-v","ON_ERROR_STOP=1"],
      { timeout: 15_000 });
    let output = "", stderr = "";
    child.stdout.on("data", chunk => output += chunk);
    child.stderr.on("data", chunk => stderr += chunk);
    const done = new Promise<{code: number | null; stderr: string}>((resolve,reject) => {
      child.on("error",reject);child.on("close",code => resolve({code,stderr}));
    });
    if (keep) child.stdin.write(sql); else child.stdin.end(sql);
    return {child,done,output:() => output};
  };
  const admitted = launch(`set application_name='barrier_admitted';
    ${ownerTransaction(`select result_status from public.create_manual_diary_entry(${barrierArgs(source,999878)});`).replace(/commit;$/, "")}
    \\echo barrier_ready
    `,"supabase_admin",true);
  const sessions = [admitted];
  const blockedBy = (blocked: string, blocker: string) => source(`select exists(select from pg_stat_activity a,pg_stat_activity b
    where a.application_name='${blocked}' and b.application_name='${blocker}' and b.pid=any(pg_blocking_pids(a.pid)))`);
  try {
    await expect.poll(() => admitted.output().includes("success") && admitted.output().includes("barrier_ready")).toBe(true);
    const barrier = launch(`set application_name='barrier_install';begin;set local lock_timeout='5s';${install}commit;`,"postgres");
    sessions.push(barrier);
    await expect.poll(() => blockedBy("barrier_install","barrier_admitted"),{timeout:3_000}).toBe("t");
    const queued = launch(`set application_name='barrier_queued';${ownerTransaction(
      `select result_status from public.create_manual_diary_entry(${barrierArgs(source,999879)});`)}`,"supabase_admin");
    sessions.push(queued);
    await expect.poll(() => blockedBy("barrier_queued","barrier_install"),{timeout:3_000}).toBe("t");
    admitted.child.stdin.end("commit;\n");
    expect((await admitted.done).code).toBe(0);
    expect(await barrier.done).toEqual({code:0,stderr:""});
    expect((await queued.done).stderr).toMatch(/row-level security policy/);
  } finally {
    for (const session of sessions) if (session.child.exitCode === null) session.child.kill();
    await Promise.all(sessions.map(session => session.done));
  }
  expect(source("select version from supabase_migrations.schema_migrations order by version")).toBe(`${originalLedger}\n${pin.head}`);
  const after = full35TableFingerprints(rows(source));
  expect(after["public.diary_entries"].count).toBe(before["public.diary_entries"].count+1);
  expect(after["public.manual_diary_entry_requests"].count).toBe(before["public.manual_diary_entry_requests"].count+1);
  for (const name of Object.keys(before).filter(n => !["public.diary_entries","public.manual_diary_entry_requests"].includes(n))) {
    expect(after[name]).toEqual(before[name]);
  }
  expect(history()).toBe(originalHistory);
  return {admittedCommitted:true,queuedRejected:true,failedMigrationRolledBack:true,catalogAndAuthPreserved:true,
    preexistingEntriesAndReceiptsUnchanged:true};
}

test("Foundation writer barrier drains, persists and survives encrypted history-49 recovery", async () => {
  mkdirSync(config.scratch,{recursive:true,mode:0o700});
  installRoles(source);
  command("openssl",["req","-x509","-newkey","rsa:3072","-nodes","-keyout",key,"-out",cert,"-days","1","-subj","/CN=Local Full35 Recovery Qualification"]);
  chmodSync(key,0o600);
  recipient=command("openssl",["x509","-in",cert,"-noout","-fingerprint","-sha256"]).split("=").at(-1)!.replaceAll(":","").toLowerCase();
  initializeSource();
  const activation = await migrateWriterBarrier();
  exactAtomicOwnerRetry(source);
  const admission = verifyWriterBarrier(source, 999880);
  const captureValues = full35TableFingerprints(rows(source));
  for (const name of ["public.diary_entries","public.manual_diary_entry_requests"]) frozen[name] = captureValues[name];
  const baseline = full35ReviewedSchemaHash(rows(source), true);
  for (const sql of ["drop policy foundation_manual_diary_requires_reference on public.diary_entries",
    "alter role diary_reference_writer bypassrls","grant diary_reference_writer to authenticator",
    "grant create on schema private to diary_reference_writer",
    "alter default privileges for role diary_reference_writer revoke execute on functions from public",
    "alter table public.diary_entries disable trigger diary_entries_increment_version"]) {
    const observed = full35ReviewedSchemaHash((query: string) => rows(source)(`begin;${sql};${query};rollback;`), true);
    expect(() => assertFull35SchemaHash(baseline,observed)).toThrow(/fingerprint mismatch/);
  }
  await checkpoint("writer_barrier_49",1);
  writeFileSync(join(evidence,"recovery-qualification.json"),JSON.stringify({result:"PASS",migrationHead:historyHead,
    activation,admission,checkpoint:checkpoints[0],productionAccess:false},null,2)+"\n",{mode:0o600});
});

test("Full35 single owner executes once and survives encrypted history-50 recovery", async () => {
  mkdirSync(config.scratch,{recursive:true,mode:0o700});
  installRoles(source);
  initializeSource(false);
  const pin = FULL35_OWNER_RELEASE_HISTORY;
  const migration = readFileSync(join(repository,"supabase/migrations",pin.filename),"utf8");
  const install = `${migration}
    insert into supabase_migrations.schema_migrations(version,name,statements)
    values('${pin.head}','${pin.filename.slice(15,-4)}',array[]::text[]);`;
  const beforeMigration = full35TableFingerprints(rows(source));
  expect(() => source(`begin;${install}select 1/0;commit;`,"postgres")).toThrow();
  expect(source("select to_regrole('full35_release_owner') is null")).toBe("t");
  source(install,"postgres");
  expect(source("select not rolcanlogin from pg_roles where rolname='full35_release_owner'")).toBe("t");
  const afterMigration = full35TableFingerprints(rows(source));
  expect(Object.fromEntries(Object.entries(afterMigration).filter(([name])=>name!=="ingestion.foundation_owner_authorization"))).toEqual(beforeMigration);
  source(`alter role ${full35OwnerLogin} login password '${password}';`);
  const release = syntheticOwnerRelease(source,fixture);
  const bounds = "set lock_timeout='5s';set statement_timeout='120s';set transaction_timeout='180s';";
  noMutationDenied("owner_no_authorization",source,release.execute(),full35OwnerLogin,/authorized operation/);
  noMutationDenied("owner_wrong_session",source,release.execute(),operator,/permission denied/);
  noMutationDenied("owner_no_self_authorization",source,release.authorize(),full35OwnerLogin,/permission denied/);
  const wrongValue = structuredClone(release.plan);
  wrongValue.items.find(i=>i.additions.length)!.additions[0].state.amount="999999";
  // Even a grant for a wrong value is refused by the shared catalog validator.
  noMutationDenied("owner_scientific_value_guard",source,
    `begin;${release.authorize(wrongValue)}set session authorization ${full35OwnerLogin};${release.execute(wrongValue)}commit;`,
    "supabase_admin",/additions|diff|projection|candidate/i);
  source(release.authorize(),"postgres");
  noMutationDenied("owner_wrong_dataset",source,release.execute({...release.plan,dataset_id:fixtureId(999899)}),full35OwnerLogin,/authorized operation/);
  noMutationDenied("owner_wrong_mapping",source,release.execute({...release.plan,mapping_version_id:fixtureId(999899)}),full35OwnerLogin,/authorized operation/);
  noMutationDenied("owner_wrong_count",source,release.execute({...release.plan,counts:{...release.plan.counts,inserted_rows:5061}}),full35OwnerLogin,/authorized operation/);
  noMutationDenied("owner_wrong_token",source,release.execute(release.plan,fixtureId(999918)),full35OwnerLogin,/authorized operation/);
  noMutationDenied("owner_stale_head",source,`begin;update public.food_nutrients set amount=amount+0.01 where id=(select min(id::text)::uuid from public.food_nutrients);
    set session authorization ${full35OwnerLogin};${release.execute()}commit;`,"supabase_admin",/stale plan|before-image/);
  noMutationDenied("owner_transaction_rollback",source,
    `begin;${bounds}${release.execute()}select 1/0;commit;`,full35OwnerLogin,/division by zero/);
  expect(source(release.receipt,full35OwnerLogin)).toBe("");
  expect(full35TableFingerprints(rows(source))["public.food_nutrients"]).toEqual(beforeMigration["public.food_nutrients"]);

  // An admitted reference save holds the shared dataset lock to commit. Start
  // the owner transaction while that save is open and verify it must wait.
  const launch = (sql:string,user:string,hold=false) => {
    const child=spawn("docker",["exec","-i","-e",`PGPASSWORD=${password}`,config.source,"psql","-h","127.0.0.1",
      "-U",user,"-d","postgres","-X","-qAt","-v","ON_ERROR_STOP=1"]);
    let output="",error="";
    child.stdout.on("data",b=>output+=b);child.stderr.on("data",b=>error+=b);
    const done=new Promise<string>((ok,fail)=>{child.on("error",fail);child.on("close",code=>code===0?ok(output.trim()):fail(new Error(error)));});
    if(hold)child.stdin.write(sql);else child.stdin.end(sql);
    return {child,done,output:()=>output};
  };
  const diary=launch(`begin;set local role authenticated;set local request.jwt.claim.sub='${owner}';
    ${atomicPayloads.before.replaceAll(atomicKeys.before,fixtureId(999917))}
\\echo diary_ready
`,"full35_recovery_authenticated",true);
  try {
    await expect.poll(()=>diary.output().includes("diary_ready")).toBe(true);
    const write=launch(`set application_name='full35_owner_release_test';${bounds}${release.execute()}`,full35OwnerLogin);
    try {
      await expect.poll(()=>source("select count(*) from pg_stat_activity where application_name='full35_owner_release_test' and wait_event='advisory'"),{timeout:4_000}).toBe("1");
    } finally {
      diary.child.stdin.end("commit;\\q\n");
    }
    const diaryOutput=await diary.done;
    expect(JSON.parse(diaryOutput.split("\n")[0]).result_status).toBe("success");
    await write.done;
  } finally {
    if(!diary.child.stdin.destroyed && !diary.child.stdin.writableEnded) diary.child.stdin.end("rollback;\\q\n");
  }
  original=source(release.receipt,full35OwnerLogin);
  const receipt=JSON.parse(original);
  expect(receipt).toMatchObject({contract_version:"foundation-full35-owner-receipt/v1",
    counts:{foods:353,inserted_rows:5062,core_rows_preserved:1199,missing_states:6094},
    owner_authorization:{owner_name:"Synthetic fixture owner",id:release.authorizationId}});
  const committed=full35TableFingerprints(rows(source));
  expect(source(release.execute(),full35OwnerLogin)).toBe(original);
  expect(full35TableFingerprints(rows(source))).toEqual(committed);
  expect(source("select count(*) from ingestion.mapping_actor_principals")).toBe("0");
  expect(source("select count(*) from ingestion.mapping_actor_bindings")).toBe("0");
  expect(source("select count(*) from ingestion.mapping_reprojection_execution_context")).toBe("0");
  expect(source("select to_jsonb(n)::text from public.food_nutrients n where n.id not in(select public_row_id from ingestion.mapping_reprojection_inserted_rows) order by n.id")).toBe(core);
  for(const name of Object.keys(frozen)) {
    if(!["public.diary_entries","public.manual_diary_entry_requests"].includes(name)) expect(committed[name]).toEqual(frozen[name]);
  }
  exactAtomicOwnerRetry(source);
  for(const name of ["public.diary_entries","public.manual_diary_entry_requests"]) frozen[name]=committed[name];

  source(`alter role ${full35OwnerLogin} nologin password null;`);
  command("openssl",["req","-x509","-newkey","rsa:3072","-nodes","-keyout",key,"-out",cert,"-days","1","-subj","/CN=Local Full35 Owner Recovery"]);
  chmodSync(key,0o600);
  recipient=command("openssl",["x509","-in",cert,"-noout","-fingerprint","-sha256"]).split("=").at(-1)!.replaceAll(":","").toLowerCase();
  await checkpoint("owner_release_50",2,release.plan);
  expect(target("select not rolcanlogin from pg_roles where rolname='full35_release_owner'")).toBe("t");
  target(`alter role ${full35OwnerLogin} login password '${password}';`);
  const restored=full35TableFingerprints(rows(target));
  expect(target(release.receipt,full35OwnerLogin)).toBe(original);
  expect(target(release.execute(),full35OwnerLogin)).toBe(original);
  expect(full35TableFingerprints(rows(target))).toEqual(restored);
  target(`alter role ${full35OwnerLogin} nologin password null;`);
  writeFileSync(join(evidence,"recovery-qualification.json"),JSON.stringify({result:"PASS",migrationHead:historyHead,
    checkpoint:checkpoints[0],ownerReceiptRecovered:true,exactRetryNoMutation:true,diarySerialized:true,productionAccess:false},null,2)+"\n",{mode:0o600});
});

test.describe.serial("Approved encrypted Full35 recovery",()=>{
  test.beforeAll(()=>{mkdirSync(config.scratch,{recursive:true,mode:0o700});installRoles(source);
    command("openssl",["req","-x509","-newkey","rsa:3072","-nodes","-keyout",key,"-out",cert,"-days","1","-subj","/CN=Local Full35 Recovery Qualification"]);chmodSync(key,0o600);
    recipient=command("openssl",["x509","-in",cert,"-noout","-fingerprint","-sha256"]).split("=").at(-1)!.replaceAll(":","").toLowerCase();initializeSource();});
  test("1 — before reprojection: exact populated encrypted restore and independent authorization",async()=>{await checkpoint("before_reprojection",1);});
  test("2 — after reprojection: all values and immutable completed reads survive approved encrypted restore",async()=>{
    originalPlan=makePlan();originalApproval=approve(originalPlan,originalToken);original=source(retry("reprojection",originalApproval,originalToken),operator);
    if(atomicDiary){createAtomicOwnerEntry("after",source);const current=full35TableFingerprints(rows(source));for(const name of ["public.diary_entries","public.manual_diary_entry_requests"]) frozen[name]=current[name];}
    pendingApproval=approve(makePlan(true),pendingToken);await checkpoint("after_reprojection",2);
  });
  test("3 — fresh separate compensated source: forward head 3 and both immutable receipts survive",async()=>{
    sourceCli(["db","reset","--local","--version",historyHead]);installRoles(source);initializeSource();
    originalPlan=makePlan();originalApproval=approve(originalPlan,originalToken);original=source(retry("reprojection",originalApproval,originalToken),operator);
    pendingApproval=approve(makePlan(true),pendingToken);const approval=approve(makePlan(true),compensationToken);
    if(atomicDiary)createAtomicOwnerEntry("after",source);
    compensation=source(retry("compensation",approval,compensationToken),operator);expect(source("select to_jsonb(t)::text from public.food_nutrients t order by id")).toBe(core);
    if(atomicDiary){const current=full35TableFingerprints(rows(source));for(const name of ["public.diary_entries","public.manual_diary_entry_requests"]) frozen[name]=current[name];}
    await checkpoint("after_compensation",3);
  });
  test("4 — restored actor negatives preserve every operation and owner row",()=>{
    const read=`select ingestion.get_foundation_mapping_reprojection_receipt_v1('${originalApproval}')`;
    noMutationDenied("H22_completed_approval_new_mutation",target,retry("reprojection",originalApproval,fixtureId(999849)),operator,/retry identity differs/);
    for(const isolation of ["repeatable read","serializable"])noMutationDenied("D10_isolation_"+isolation,target,`begin isolation level ${isolation};${read}`,operator,/fresh read committed/);
    noMutationDenied("D06_no_governor",target,"select ingestion.request_foundation_actor_binding_v1('{}'::json)",operator);
    const proposed=proposeActorBinding(target,fixture.datasetId,operator,"operator",{principal:op});
    noMutationDenied("D06_no_reviewer",target,`select ingestion.approve_foundation_actor_binding_v1('${proposed.requestId}','${fixtureHash("fake")}')`,identityGovernor);
    noMutationDenied("D09_invalid_decision_hash",target,`select ingestion.approve_foundation_actor_binding_v1('${proposed.requestId}','${fixtureHash("fake")}')`,identityReviewer);
    target(`alter role ${operator} connection limit 5`);
    noMutationDenied("D07_stale_role_fingerprint",target,`select ingestion.approve_foundation_actor_binding_v1('${proposed.requestId}',(select '${JSON.parse(target(`select ingestion.get_foundation_actor_binding_request_v1('${proposed.requestId}')`,identityReviewer)).body_hash}'))`,identityReviewer);
    noMutationDenied("H23_stale_current_binding",target,read,operator);target(`alter role ${operator} connection limit -1`);
    const request={...proposed.request,environment:"production"};noMutationDenied("D08_cross_environment",target,`select ingestion.request_foundation_actor_binding_v1(${actorInput(request)})`,identityGovernor,/scope|no rows|binding|42501/);
    noMutationDenied("D08_cross_dataset",target,`select ingestion.request_foundation_actor_binding_v1(${actorInput({...proposed.request,dataset_id:fixtureId(999899)})})`,identityGovernor,/scope|binding|42501/);
    const epoch=source("select cluster_id from private.mapping_actor_cluster_epoch");
    expect(()=>assertFreshFull35Marker(epoch,epoch)).toThrow(/copied/);negatives.D02_source_equals_target_marker={result:"PASS",explicitEqualityValidatorRefused:true,noUnauthorizedMutation:true};
    for(const group of ["anon","authenticated","service_role"]){
      const user="full35_recovery_"+group;
      noMutationDenied("Q_"+group,target,read,user);
      noMutationDenied("Q_"+group+"_binding",target,"select * from ingestion.mapping_actor_bindings",user);
      noMutationDenied("Q_"+group+"_private",target,"select * from private.mapping_actor_cluster_epoch",user);
    }
    for(const [label,sql] of [["H16_consumer_permission","grant insert on ingestion.mapping_actor_bindings to authenticated"],["H17_role_attributes",`alter role ingestion_identity_definer bypassrls`],["H17_role_membership",`grant ingestion_identity_definer to ingestion_operator`],["H18_function_default_acl","alter default privileges for role ingestion_identity_definer grant execute on functions to public"],["N_dictionary_unit","update public.nutrients set unit='g' where code='vitamin_k_ug'"]]) {
      const before=full35TableFingerprints(rows(target)),baseline=full35ReviewedSchemaHash(rows(target));
      // DDL tampering is contained in an uncommitted transaction; all guards stay enabled.
      const observed=full35ReviewedSchemaHash((query:string)=>rows(target)(`begin;${sql};${query};rollback;`));expect(()=>assertFull35SchemaHash(baseline,observed)).toThrow(/fingerprint mismatch/);expect(full35TableFingerprints(rows(target))).toEqual(before);negatives[label]={result:"PASS",schemaFingerprintMismatchRefused:true,noUnauthorizedMutation:true};
    }
    if(atomicDiary){
      const signature="public.create_reference_diary_entry_v1(uuid,date,text,uuid,text,text,numeric,text,integer,numeric,numeric,numeric,text,boolean,jsonb,text,text[])";
      for(const [label,sql] of [
        ["A48_security_definer",`alter function ${signature} security definer`],
        ["A48_function_ACL",`grant execute on function ${signature} to anon`],
        ["A48_function_body",`create or replace function private.diary_governed_dataset_v1(p_food_id uuid) returns uuid language sql stable security definer set search_path='' as 'select null::uuid'`],
        ["A48_role_authority","alter role diary_dataset_reader bypassrls"],
        ["A48_role_default_ACL","alter default privileges for role diary_dataset_reader grant execute on functions to public"],
      ]){
        const baseline=full35ReviewedSchemaHash(rows(target));
        const observed=full35ReviewedSchemaHash((query:string)=>rows(target)(`begin;${sql};${query};rollback;`));
        expect(()=>assertFull35SchemaHash(baseline,observed)).toThrow(/fingerprint mismatch/);negatives[label]={result:"PASS",noUnauthorizedMutation:true};
      }
    }
    noMutationDenied("H19_marker_mutation",target,"update private.mapping_actor_cluster_epoch set cluster_id=gen_random_uuid()","supabase_admin",/immutable/);
    const revoke=proposeActorBinding(target,fixture.datasetId,operator,"operator",{principal:op,action:"revoke"});approveActorBinding(target,revoke);
    noMutationDenied("H25_revoked_principal",target,read,operator);
    const revokedPrior=target(`select binding_id from ingestion.mapping_actor_current_bindings where principal_id='${op.principalId}' and environment='local'`);
    noMutationDenied("H25_revoked_reenrollment",target,`select ingestion.request_foundation_actor_binding_v1(${actorInput({...proposed.request,prior_binding_id:revokedPrior,evidence_hash:fixtureHash("revive")})})`,identityGovernor,/permanently revoked/);
  });
  test("5 — encrypted tampering matrix refuses unsafe histories, artifacts and missing protected rows",()=>{test.setTimeout(1_800_000);recoveryNegatives();});
  test.afterAll(()=>{
    const atomicCases=["A48_wrong_SQL_hash","A48_missing_diary_receipt","A48_unknown_49","A48_wrong_version",
      "A48_security_definer","A48_function_ACL","A48_function_body","A48_role_authority","A48_role_default_ACL",
      "A48_restore_wrong_body","A48_restore_wrong_ACL","A48_restore_security_definer"];
    const required={
      H01:["H01_incorrect_count","H01_wrong_head","H01_unknown_48","H01_duplicate","H01_reordered"],H02:["H02_tampered_migration47","H02_obsolete_defective_SQL"],H03:["H03_tampered_predecessor"],H04:["H04_partial_ledger"],
      H05:["H05_wrong_recipient"],H06:["H06_wrong_source","H06_wrong_target","H06_nonlocal_target"],H07:["H07_ciphertext_digest","H07_ciphertext_authentication"],H08:["H08_artifact_digest"],
      H09:["H09_missing_v2_projection"],H10:["H10_missing_full35_state"],H11:["H11_missing_evidence_link","H11_incorrect_evidence_link"],H12:["H12_incorrect_mapping_hash"],H13:["H13_missing_source_version"],H14:["H14_missing_receipt"],H15:["H15_inconsistent_dataset_pointer","H15_incorrect_current_fingerprint"],
      H16:["H16_consumer_permission"],H17:["H17_role_attributes","H17_role_membership"],H18:["H18_function_default_acl"],H19:["after_reprojection_copied_binding","H19_marker_mutation","H19_forged_execution_context"],H20:["H20_lost_owner_snapshot","H20_lost_private_custom_food","H20_lost_auth_identity"],H21:["H21_invalid_compensation_provenance","H21_incorrect_compensation_row_image"],
      H22:["H22_completed_approval_new_mutation"],H23:["H23_stale_current_binding"],H24:["D01_source_private_marker_in_payload","D02_source_equals_target_marker"],H25:["H25_revoked_principal","H25_revoked_reenrollment"],H26:["after_reprojection_pending_approval","after_compensation_pending_approval"]};
    const markerRequired={D01:["D01_source_private_marker_in_payload"],D02:["D02_source_equals_target_marker"],D03:["after_reprojection_copied_binding"],D04:["D04_same_numeric_oid"],D05:["after_reprojection_unverified_receipt"],D06:["D06_no_governor","D06_no_reviewer"],D07:["D07_stale_role_fingerprint"],D08:["D08_cross_environment","D08_cross_dataset"],D09:["D09_invalid_decision_hash"],D10:["D10_isolation_repeatable read","D10_isolation_serializable"]};
    const matrix=(requirements:Record<string,string[]>)=>Object.fromEntries(Object.entries(requirements).map(([id,cases])=>[id,{result:cases.every(name=>(negatives[name] as {result?:string})?.result==="PASS")?"PASS":"INCOMPLETE",cases}]));
    const recoveryMatrix=matrix(required),markerMatrix=matrix(markerRequired);
    const result=["N_same_count_wrong_public_value","N_dictionary_unit"].every(name=>(negatives[name] as {result?:string})?.result==="PASS")&&checkpoints.length===3&&Object.values(recoveryMatrix).every(r=>r.result==="PASS")&&Object.values(markerMatrix).every(r=>r.result==="PASS")?"PASS":"INCOMPLETE";
    writeFileSync(join(evidence,"recovery-qualification.json"),JSON.stringify({task:atomicDiary?"NUTRITION-USDA-FULL35-APP-ATOMIC-PERSISTENCE-002":"NUTRITION-USDA-FULL35-RECOVERY-001B",result,
      atomicDiary:atomicDiary?{result:checkpoints.length===3&&(checkpoints[0].atomicRace as {result?:string})?.result==="PASS"&&atomicCases.every(n=>(negatives[n] as {result?:string})?.result==="PASS")?"PASS":"INCOMPLETE",cases:atomicCases,historyHead,exactSQLSha256:hash(readFileSync("supabase/migrations/20261102181943_atomic_food_diary_persistence_v1.sql")),completedOwnerRetry:true}:undefined,
      exactMigration47Sha256:hash(readFileSync("supabase/migrations/20261031104559_foundation_full35_mapping_reprojection_v1.sql")),checkpoints,negatives,recoveryMatrix,markerMatrix,productionAccess:false},null,2)+"\n",{mode:0o600});
  });
});
