import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { chmodSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { expect, test } from "@playwright/test";
import { captureBackup } from "../scripts/phase-11i-backup-pipeline.mjs";
import { restoreBackup } from "../scripts/phase-11i-restore-pipeline.mjs";
import {removeDumpRow,replaceDumpColumn} from "../scripts/full35-recovery-dump.mjs";
import { RECOVERY_TARGET } from "../scripts/phase-11i-recovery-contract.mjs";
import { full35TableFingerprints, full35ReviewedSchemaHash, assertFull35SchemaHash, assertFreshFull35Marker } from "../scripts/phase-11i-full35-recovery.mjs";
import { buildMappingPlan, fingerprintMappingPlan, selectMappingActorAuthority, type MappingActorScope, type MappingPlan } from "../ingestion/usda/foundation/reprojection/contracts";
import { installSyntheticBaseline, fixtureId, fixtureHash, mappingId } from "./fixtures/foundation-full35-reprojection";
import { actorInput, installIdentityControllers, bindActor, proposeActorBinding, approveActorBinding, identityGovernor, identityReviewer, type ActorQuery, type PrincipalFixture } from "./fixtures/foundation-full35-actor-identity";

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
function initializeSource() {
  fixture=installSyntheticBaseline(source);
  // Extend the hand-authored fixture with completed durable owner metadata.
  // No Production identity or credential is used.
  source(`update auth.users set encrypted_password=extensions.crypt('synthetic-recovery-owner',extensions.gen_salt('bf',12));
    update public.account_activations set activation_completed_at=now(),eligibility_accepted_at=now();
    update public.foods set source_id=(select id from public.food_sources where code='user_custom') where owner_user_id is not null;
    insert into auth.identities(id,user_id,provider_id,identity_data,provider) values('${fixtureId(999701)}','${fixtureId(999700)}','synthetic-recovery-owner','{"sub":"${fixtureId(999700)}"}','email');
    select vault.create_secret('${hash("synthetic capability")}','account_closure_capability_v1');`);
  op=bindActor(source,fixture.datasetId,operator,"operator");app=bindActor(source,fixture.datasetId,approver,"approver");
  core=source("select to_jsonb(t)::text from public.food_nutrients t order by id");
  frozen=Object.fromEntries(Object.entries(full35TableFingerprints(rows(source))).filter(([name])=>name.startsWith("auth.")||
    ["public.profiles","public.food_favorites","public.diary_entries","public.saved_meals","public.saved_meal_items","public.recipes","public.recipe_ingredients","public.nutrition_targets","public.account_activations","public.manual_diary_entry_requests"].includes(name)));
}
function makePlan(compensate=false):MappingPlan {
  const scope=JSON.parse(source("select ingestion.get_foundation_mapping_reprojection_scope_v1('local')",operator));
  return buildMappingPlan({operation_kind:compensate?"compensation":"reprojection",dataset_id:fixture.datasetId,environment:"local",
    source_release_id:fixture.releaseId,mapping_version_id:mappingId,before_snapshot:scope.before_snapshot,
    actor_authority:selectMappingActorAuthority(scope.actor_authority as MappingActorScope,approver),
    operator_oid:Number(source(`select oid from pg_roles where rolname='${operator}'`)),operator_login:operator,
    approval_requirements:{approver_oid:Number(source(`select oid from pg_roles where rolname='${approver}'`)),not_before:new Date(Date.now()-60000).toISOString(),expires_at:new Date(Date.now()+7200000).toISOString()},
    implementation:{database_contract_hash:scope.database_contract_hash,commit:command("git",["rev-parse","HEAD"]),tree:command("git",["rev-parse","HEAD^{tree}"]),
      migrations:readdirSync("supabase/migrations").filter(n=>n.endsWith(".sql")).sort().map(filename=>({filename,version:filename.slice(0,14),sha256:hash(readFileSync(`supabase/migrations/${filename}`))})),
      contract_versions:{parser:"usda-fdc-foundation-json/v1",importer:"usda-foundation-importer/v3",candidate:"foundation-normalized-candidate/v2",mapping:"usda-foundation-full35-direct-v2",projection:"foundation-lifecycle-projection/v2"}},
    qualification:{...fixture.source,historical_allowance_fingerprint:"bdfc95e5009a8d5c5a5bbf82b24dff1a4e8c3decd7bee4406286c543e661ad4a",rejected:JSON.parse(readFileSync("docs/evidence/nutrition-usda-full35-local-qual-001/qualification.json","utf8")).source_inspection.rejected_records,source_qualification_hash:fixtureHash("recovery independent oracle")},
    recovery_requirements:{qualification_hash:fixtureHash("local encrypted recovery engineering"),production_ready:false},rejected_receipt_id:compensate?JSON.parse(original).receipt_id:null,records:fixture.records});
}
function approve(plan:MappingPlan,token:string) {
  const id=source(`select ingestion.prepare_foundation_mapping_${plan.operation_kind}_v1(${actorInput(plan)},'${token}')`,operator);
  return source(`select ingestion.approve_foundation_mapping_${plan.operation_kind}_v1('${id}','${fingerprintMappingPlan(plan)}','${plan.approval_requirements.expires_at}',${actorInput({independent_review_hash:fixtureHash("independent operation approval"),recovery_evidence_hash:plan.recovery_requirements.qualification_hash,approval_reference:"synthetic local independent reviewer"})})`,approver);
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
function independentOracle(q:ActorQuery) {
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
  const packet={identity_bindings:originalPlan.items.map(i=>({fdc_id:i.candidate.fdc_id,food_id:i.before.food_id})),raw_records:fixture.records.map(r=>r.record.raw),states,public_rows:publicRows,interpretation_evidence:interpretationEvidence};
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
async function checkpoint(label:string,expectedHead:number) {
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
  const oracle=expectedHead>1?independentOracle(target):null;
  const datasetRoots=independentDatasetRoots(target);expect(datasetRoots.heads).toHaveLength(expectedHead);
  const targetEpoch=target("select cluster_id from private.mapping_actor_cluster_epoch");expect(targetEpoch).not.toBe(sourceEpoch);
  const sourceRoles=JSON.parse(source(`select jsonb_object_agg(rolname,oid::bigint) from pg_roles where rolname in ('${operator}','${approver}')`));
  const targetRoles=JSON.parse(target(`select jsonb_object_agg(rolname,oid::bigint) from pg_roles where rolname in ('${operator}','${approver}')`));
  expect(targetRoles[operator]).not.toBe(sourceRoles[operator]);
  if(expectedHead===1){
    const name=target(`select rolname from pg_roles where oid='${sourceRoles[operator]}'::oid`);expect(name).toMatch(/^full35_recovery_padding_\d+$/);
    target(`alter role ${name} login password '${password}';grant ingestion_operator to ${name}`);
    noMutationDenied("D04_same_numeric_oid",target,"select ingestion.get_foundation_mapping_reprojection_scope_v1('local')",name);
    target(`revoke ingestion_operator from ${name};alter role ${name} nologin`);
  }
  const actual=full35TableFingerprints(rows(target));for(const [name,state] of Object.entries(frozen))expect(actual[name]).toEqual(state);
  expect(target("select current_head_version from ingestion.dataset_projection_current_heads")).toBe(String(expectedHead));
  if(expectedHead>1){noMutationDenied(`${label}_unverified_receipt`,target,`select ingestion.get_foundation_mapping_reprojection_receipt_v1('${originalApproval}')`,operator);
    noMutationDenied(`${label}_copied_binding`,target,retry("reprojection",originalApproval,originalToken),operator);}
  const before=full35TableFingerprints(rows(target));
  bindActor(target,fixture.datasetId,operator,"operator",op);bindActor(target,fixture.datasetId,approver,"approver",app);
  const after=full35TableFingerprints(rows(target));for(const name of Object.keys(before).filter(n=>!n.startsWith("ingestion.mapping_actor_")))expect(after[name]).toEqual(before[name]);
  if(expectedHead>1){exactReads(target,expectedHead===3);noMutationDenied(`${label}_pending_approval`,target,retry("compensation",pendingApproval,pendingToken),operator,/pending operation binding is stale/);}
  checkpoints.push({scenario:label,trace,approvedPipeline:true,approvedArtifactPairVerifier:true,encryptedArchiveSha256:captured.encryptedArchiveSha256,manifestSha256:captured.manifestSha256,
    quantities,oracle,datasetRoots,sourceRoles,targetRoles,sourceEpoch,targetEpoch,full35Recovery:restored.full35Recovery,sourceCounts:restored.sourceSafeCounts,
    allOwnerRowsAndTimestampsEqual:true,completedReceiptsByteEqual:expectedHead>1,completedRetriesNoMutation:expectedHead>1,
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
  function restoreRejected(label:string,changeManifest?:(m:typeof manifest)=>void,overrides:Record<string,unknown>={},replay=false) {
    const started=Date.now(),before=full35TableFingerprints(rows(target));let resets=0,error="";
    const changed=JSON.parse(readFileSync(capture.manifestPath,"utf8"));changeManifest?.(changed);writeFileSync(capture.manifestPath,JSON.stringify(changed));
    const report=join(config.scratch,"negative-restore.json");expect(existsSync(report)).toBe(false);
    try{process.chdir(config.targetDirectory);
      restoreBackup({archiveInput:capture.archivePath,manifestInput:capture.manifestPath,recipientInput:cert,privateKeyInput:key,reportInput:report,targetIdentity:RECOVERY_TARGET,
        assertSourceIdentity:assertSource,assertArtifactIdentity:assertArtifact,assertRecipient:(actual:string)=>assert.equal(actual,recipient),localNutritionSnapshots:false,
        runSupabase:(args:string[])=>{if(args[0]==="db"&&args[1]==="reset")resets++;const value=targetCli(args);if(args[0]==="db"&&args[1]==="reset")installRoles(target,true);return value;},...overrides});
    }catch(e){error=String((e as Error).message);}finally{process.chdir(repository);writeFileSync(capture.manifestPath,manifestBytes);}
    expect(error).toMatch(/mismatch|forbidden|failed|reviewed|target|unsafe|count|ledger|fingerprint|schema/i);expect(existsSync(report)).toBe(false);
    if(!replay){expect(resets).toBe(0);expect(full35TableFingerprints(rows(target))).toEqual(before);}
    else {expect(error).toMatch(/Full35 complete persisted row fingerprint mismatch/);expect(resets).toBe(1);expect(target("select count(*) from ingestion.mapping_reprojection_receipts")).toBe("0");expect(target("select count(*) from auth.users")).toBe("0");expect(target("select count(*) from ingestion.mapping_actor_current_bindings")).toBe("0");}
    negatives[label]={result:"PASS",expectedRejection:error,noUnauthorizedMutation:true,targetResetCount:resets,failedReplayRolledBack:replay,elapsedMs:Date.now()-started};
    process.stdout.write(`Negative recovery case ${label} refused with no unauthorized mutation.\n`);
  }
  function innerRejected(label:string,filename:string,mutate:(value:string)=>string,replay=false,updateDigest=true) {
    const file=join(badRoot,filename),originalBytes=readFileSync(file),content=JSON.parse(contentBytes.toString("utf8")),changed=structuredClone(manifest);
    const mutated=mutate(originalBytes.toString("utf8"));expect(mutated).not.toBe(originalBytes.toString("utf8"));writeFileSync(file,mutated);
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
  for(const [label,index] of [["H03_tampered_predecessor",0],["H02_tampered_migration47",46]] as const) {
    const file=join(config.targetDirectory,"supabase/migrations",readdirSync("supabase/migrations").filter(n=>n.endsWith(".sql")).sort()[index]),bytes=readFileSync(file);writeFileSync(file,Buffer.concat([bytes,Buffer.from("\n-- tamper\n")]));
    try{restoreRejected(label);}finally{writeFileSync(file,bytes);}
  }
  const sql47=join(config.targetDirectory,"supabase/migrations/20261031104559_foundation_full35_mapping_reprojection_v1.sql"),corrected=readFileSync(sql47);
  // The original PR head is no longer advertised after its authorized rewrite.
  // Its exact SQL is retained in the reachable Stage4A common ancestor.
  const obsoleteSql=execFileSync("git",["show","2a5e8ea95dccfa59a0122fd9f84456eb72c77e9b:supabase/migrations/20261031104559_foundation_full35_mapping_reprojection_v1.sql"]);
  expect(hash(obsoleteSql)).toBe("907f2b14e3baa485f1b9e92e6c3f601cc0f434945c48fbef9b0c823b781b1703");
  writeFileSync(sql47,obsoleteSql);
  try{restoreRejected("H02_obsolete_defective_SQL");}finally{writeFileSync(sql47,corrected);}
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

test.describe.serial("Approved encrypted Full35 recovery",()=>{
  test.beforeAll(()=>{mkdirSync(config.scratch,{recursive:true,mode:0o700});installRoles(source);
    command("openssl",["req","-x509","-newkey","rsa:3072","-nodes","-keyout",key,"-out",cert,"-days","1","-subj","/CN=Local Full35 Recovery Qualification"]);chmodSync(key,0o600);
    recipient=command("openssl",["x509","-in",cert,"-noout","-fingerprint","-sha256"]).split("=").at(-1)!.replaceAll(":","").toLowerCase();initializeSource();});
  test("1 — before reprojection: exact populated encrypted restore and independent authorization",async()=>{await checkpoint("before_reprojection",1);});
  test("2 — after reprojection: all values and immutable completed reads survive approved encrypted restore",async()=>{
    originalPlan=makePlan();originalApproval=approve(originalPlan,originalToken);original=source(retry("reprojection",originalApproval,originalToken),operator);
    pendingApproval=approve(makePlan(true),pendingToken);await checkpoint("after_reprojection",2);
  });
  test("3 — fresh separate compensated source: forward head 3 and both immutable receipts survive",async()=>{
    sourceCli(["db","reset","--local","--version","20261031104559"]);installRoles(source);initializeSource();
    originalPlan=makePlan();originalApproval=approve(originalPlan,originalToken);original=source(retry("reprojection",originalApproval,originalToken),operator);
    pendingApproval=approve(makePlan(true),pendingToken);const approval=approve(makePlan(true),compensationToken);
    compensation=source(retry("compensation",approval,compensationToken),operator);expect(source("select to_jsonb(t)::text from public.food_nutrients t order by id")).toBe(core);
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
    noMutationDenied("H19_marker_mutation",target,"update private.mapping_actor_cluster_epoch set cluster_id=gen_random_uuid()","supabase_admin",/immutable/);
    const revoke=proposeActorBinding(target,fixture.datasetId,operator,"operator",{principal:op,action:"revoke"});approveActorBinding(target,revoke);
    noMutationDenied("H25_revoked_principal",target,read,operator);
    const revokedPrior=target(`select binding_id from ingestion.mapping_actor_current_bindings where principal_id='${op.principalId}' and environment='local'`);
    noMutationDenied("H25_revoked_reenrollment",target,`select ingestion.request_foundation_actor_binding_v1(${actorInput({...proposed.request,prior_binding_id:revokedPrior,evidence_hash:fixtureHash("revive")})})`,identityGovernor,/permanently revoked/);
  });
  test("5 — encrypted tampering matrix refuses unsafe histories, artifacts and missing protected rows",()=>{test.setTimeout(1_800_000);recoveryNegatives();});
  test.afterAll(()=>{
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
    writeFileSync(join(evidence,"recovery-qualification.json"),JSON.stringify({task:"NUTRITION-USDA-FULL35-RECOVERY-001B",result,
      exactMigration47Sha256:hash(readFileSync("supabase/migrations/20261031104559_foundation_full35_mapping_reprojection_v1.sql")),checkpoints,negatives,recoveryMatrix,markerMatrix,productionAccess:false},null,2)+"\n",{mode:0o600});
  });
});
