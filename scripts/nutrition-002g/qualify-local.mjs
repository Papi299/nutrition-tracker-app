import assert from 'node:assert/strict';
import { randomBytes, generateKeyPairSync, sign } from 'node:crypto';
import { readFileSync, writeFileSync, mkdtempSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, isAbsolute, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { Environment as DefaultEnvironment } from './mail-local.mjs';
import { run } from './process.mjs';
import { boundary, assertCheckout, hash, canonical, assertEqual, fail } from './contract.mjs';
import { capture as defaultCapture, schema as defaultSchema, restoreRows as defaultRestoreRows, roleState as defaultRoleState } from './capture.mjs';
import { seal as defaultSeal, openArchive as defaultOpenArchive } from './archive.mjs';
import { reconstructIdentities as defaultReconstructIdentities } from './identity.mjs';
import { populate } from './fixtures.mjs';

export async function qualify({
 output, profile='002g', Environment=DefaultEnvironment,
 capture=defaultCapture, schema=defaultSchema, restoreRows=defaultRestoreRows,
 roleState=defaultRoleState, afterReplay=async()=>{}, extraCaptureChecks=async()=>{},
 afterPopulate=async()=>{},
 seal=defaultSeal, openArchive=defaultOpenArchive, reconstructIdentities=defaultReconstructIdentities,
 extraRestoreChecks=async()=>{}, transition=true,
 implementationPaths=['contract.mjs','process.mjs','local.mjs','mail-local.mjs','mail-sink.mjs','capture.mjs','archive.mjs','identity.mjs','fixtures.mjs','qualify-local.mjs'],
 duringCapture=async source=>{
  for(const ddl of ['alter table public.profiles add column forbidden integer','grant authenticated to anon',"alter function public.is_current_account_activated() set search_path=public"])
   await assert.rejects(()=>source.sql("begin;set local lock_timeout='100ms';"+ddl+';commit;'),/N002G_LOCAL_PROCESS_FAILED_55P03/);
 },
}) {
if(!['002g','002i','002k'].includes(profile))fail('QUALIFICATION_PROFILE');
if(process.argv.length!==3||!isAbsolute(output??'')||existsSync(output)||!process.version.startsWith('v22.'))fail('RUNTIME_OR_OUTPUT');
const cases=[],envs=[],work=mkdtempSync(join(tmpdir(),'nutrition-'+profile+'-')),startedAt=new Date().toISOString();
let stage='start',failure,success=false;
const implementationSha256=hash(canonical(implementationPaths.map(p=>[p,hash(readFileSync(new URL(p,import.meta.url)))])));
function status(r,expected=200) {if(r.status!==expected)fail('HTTP_'+r.status);return r.body;}
async function record(name,fn) {
 stage=name;const start=Date.now();try{await fn();cases.push({name,result:'PASS',elapsedMs:Date.now()-start});process.stdout.write(name+' PASS\n');}
 catch(e){cases.push({name,result:'FAIL',code:/^N002G_[A-Z0-9_]+$/.test(e.message)?e.message:'ASSERTION_FAILED',elapsedMs:Date.now()-start});throw e;}
}
async function replay(e,count) {
 assertCheckout();
 const reference=count===44?'2617a6012d743e3196c7c2618e4ea46cbfe5c600':'50716d3759e9b75c66fe98b9c483ebb10c28b531';
 if(count===44)assertEqual(await run('git',['rev-parse',reference+'^{tree}']),'04e719ff60e0472a0760236c7fe6a481c54b7d17','HISTORICAL_TREE');
 await e.sql('set role postgres;create schema supabase_migrations;create table supabase_migrations.schema_migrations(version text primary key);');
 for(const m of boundary(count)) {
  const bytes=readFileSync(new URL('../../supabase/migrations/'+m.filename,import.meta.url));
  assertEqual(hash(await run('git',['show',reference+':supabase/migrations/'+m.filename])),hash(bytes.toString('utf8').trim()),'TRUSTED_GIT_BYTES');
  await e.sql("begin;set local role postgres;\n"+bytes+"\ninsert into supabase_migrations.schema_migrations values ('"+m.version+"');commit;");
 }
}
async function account(e,email) {
 const invite=status(await e.api('/admin/generate_link',{method:'POST',bearer:e.admin(),body:{type:'invite',email}}));
 const verified=status(await e.api('/verify',{method:'POST',body:{type:'invite',token_hash:invite.hashed_token}}));
 const password=randomBytes(32).toString('base64url');
 status(await e.api('/user',{method:'PUT',bearer:verified.access_token,body:{password}}));
 const session=status(await e.api('/token?grant_type=password',{method:'POST',body:{email,password}}));
 return {id:invite.id,email,password,session};
}
try {
 for(const count of [44,45]) {
  const source=new Environment('source'),target=new Environment('target');envs.push(source,target);
  await record('boundary'+count+'RealIndependentBootstrap',async()=>{await source.start();await target.start();});
  await record('boundary'+count+'TrustedReplayAndSecurity',async()=>{await replay(source,count);await replay(target,count);await afterReplay(source,target,count);assertEqual(await schema(source),await schema(target),'SCHEMA_REPLAY');});
  const owner=await account(source,'owner@example.invalid');
  const foreign=await account(source,'foreign@example.invalid'),inactive=await account(source,'inactive@example.invalid');
  await source.startRest();
  status(await source.rest('/rpc/complete_invited_account_activation',{method:'POST',bearer:owner.session.access_token,body:{p_age_18_attested:true,p_israel_attested:true}}));
  status(await source.rest('/profiles',{method:'POST',bearer:owner.session.access_token,body:{id:owner.id,display_name:'Snapshot original'}}),201);
  status(await source.rest('/rpc/complete_invited_account_activation',{method:'POST',bearer:foreign.session.access_token,body:{p_age_18_attested:true,p_israel_attested:true}}));
  status(await source.rest('/profiles',{method:'POST',bearer:foreign.session.access_token,body:{id:foreign.id,display_name:'Closed synthetic owner'}}),201);
  await source.sql("insert into public.account_closures(user_id,closure_request_id,closure_policy_version) values ('"+foreign.id+"',gen_random_uuid(),'p11e-e5-account-closure-v1');");
  await record('boundary'+count+'PopulatedNutritionAndReceipts',()=>populate(source,owner,count));
  await afterPopulate({source,target,count,owner});
  await source.sql("update public.profiles set display_name='Snapshot original';");
  const oldRecovery=status(await source.api('/admin/generate_link',{method:'POST',bearer:source.admin(),body:{type:'recovery',email:owner.email}}));
  let payload;
  await record('boundary'+count+'CoherentCompleteCapture',async()=>{
   payload=await capture(source,count,{reference:target,afterSnapshot:async()=>{
    await source.sql("update public.profiles set display_name='Equal count replacement value';");
    // Actual provider write after the shared snapshot: email/identity row counts
    // remain unchanged, but the captured original channel must stay coherent.
    status(await source.api('/admin/users/'+foreign.id,{method:'PUT',bearer:source.admin(),body:{email:'changed@example.invalid',email_confirm:true}}));
    await duringCapture(source);
   }});
   const rows=payload.application.find(t=>t.name==='profiles').rows;
   assert.equal(rows.length,2);assert.ok(rows.find(r=>r.includes(owner.id)).includes('Snapshot original'));
   assert.ok((await source.sql('select display_name from public.profiles;')).includes('Equal count replacement value'));
   assertEqual(payload.identity.owners.find(o=>o.id===foreign.id).email,'foreign@example.invalid','COHERENT_AUTH_CHANNEL');
  });
  await extraCaptureChecks({source,target,count,owner,record});
  await record('boundary'+count+'EqualCountRowReplacementRetainsSnapshotIdentity',async()=>{
   const p=await capture(source,count,{reference:target,afterSnapshot:()=>source.sql("begin;delete from public.profiles where id='"+owner.id+"';insert into public.profiles(id,display_name) values ('"+owner.id+"','Balanced replacement');commit;")});
   const a=p.application.find(t=>t.name==='profiles').rows;assert.equal(a.length,2);assert.ok(a.find(r=>r.includes(owner.id)).includes('Equal count replacement value'));
   assertEqual(await source.sql("select display_name from public.profiles where id='"+owner.id+"';"),'Balanced replacement','REPLACEMENT_EXECUTED');
  });
  await record('boundary'+count+'ReaderAndExporterFailureReject',async()=>{
   await assert.rejects(()=>capture(source,count,{reference:target,failReader:true}));
   await assert.rejects(()=>capture(source,count,{reference:target,killExporter:true}));
  });
  await record('boundary'+count+'ActualEnabledFactorProfileBlocked',async()=>{
   const factor=status(await source.api('/factors',{method:'POST',bearer:owner.session.access_token,body:{factor_type:'totp',friendly_name:'Unsupported profile negative'}}));
   await assert.rejects(()=>capture(source,count,{reference:target}),/N002G_UNSUPPORTED_AUTH_STATE/);
   status(await source.api('/factors/'+factor.id,{method:'DELETE',bearer:owner.session.access_token}));
  });
  const archive=join(work,'archive'+count),key=join(work,'key'+count+'.pem'),cert=join(work,'cert'+count+'.pem');
  let sealed,restored;
  await record('boundary'+count+'CmsEncryptedRoundtrip',async()=>{
   await run('openssl',['req','-x509','-newkey','rsa:3072','-nodes','-keyout',key,'-out',cert,'-subj','/CN=DISPOSABLE-002G','-days','1'],{timeoutMs:30000});
   sealed=await seal(payload,cert,archive);
   restored=await openArchive(archive,key,cert,{source:source.prefix,boundary:count,manifestSha256:sealed.manifestSha256});
   assertEqual(restored,payload,'ENCRYPTED_ROUNDTRIP');
  });
  await record('boundary'+count+'ArchiveNegatives',async()=>{
   const expected={source:source.prefix,boundary:count,manifestSha256:sealed.manifestSha256};
   await assert.rejects(()=>openArchive(archive,key,cert,{...expected,source:'wrong-source'}));
   await assert.rejects(()=>openArchive(archive,key,cert,{...expected,boundary:count===44?45:44}));
   await assert.rejects(()=>openArchive(archive,key,cert,{...expected,manifestSha256:'0'.repeat(64)}));
   const wrongKey=join(work,'wrong'+count+'.pem'),wrongCert=join(work,'wrong'+count+'.crt');
   await run('openssl',['req','-x509','-newkey','rsa:3072','-nodes','-keyout',wrongKey,'-out',wrongCert,'-subj','/CN=WRONG-DISPOSABLE','-days','1']);
   await assert.rejects(()=>openArchive(archive,wrongKey,wrongCert,expected));
   await assert.rejects(()=>openArchive(archive,wrongKey,cert,expected));
   const manifestPath=join(archive,'manifest.json'),manifestText=readFileSync(manifestPath);
   rmSync(manifestPath);await assert.rejects(()=>openArchive(archive,key,cert,expected));writeFileSync(manifestPath,manifestText);
   const path=join(archive,'archive.cms'),bytes=readFileSync(path),bad=Buffer.from(bytes);bad[bad.length-1]^=1;
   writeFileSync(path,bad);await assert.rejects(()=>openArchive(archive,key,cert,expected));writeFileSync(path,bytes);
  });
  const operator=generateKeyPairSync('ed25519');
  const statement={targetInstance:target.ids.get('db'),artifactSha256:sealed.manifest.cipherSha256,identitySha256:hash(canonical(restored.identity)),
   independentOwnerVerification:'PREINCIDENT_OPERATOR_AND_RECOVERY_CHANNEL_VERIFIED',targetIsolated:true};
  const approval={...statement,signature:sign(null,Buffer.from(canonical(statement)),operator.privateKey).toString('base64url')};
  await record('boundary'+count+'OwnerVerificationAndSameUuidApiReconstruction',async()=>{
   await assert.rejects(()=>reconstructIdentities(target,restored,null,sealed.manifest.cipherSha256,operator.publicKey));
   await reconstructIdentities(target,restored,approval,sealed.manifest.cipherSha256,operator.publicKey);
  });
  await record('boundary'+count+'ActualSchemaRoleAndBoundaryDriftRefused',async()=>{
   await assert.rejects(()=>restoreRows(target,restored,count===44?45:44));
   await target.sql('alter table public.profiles disable row level security;');
   await assert.rejects(()=>restoreRows(target,restored,count),/TRUSTED_SCHEMA_MISMATCH/);
   await target.sql('alter table public.profiles enable row level security;');
   await target.sql('grant authenticated to anon;');
   await assert.rejects(()=>restoreRows(target,restored,count),/ROLE_MISMATCH/);
   await target.sql('revoke authenticated from anon;');
  });
  await record('boundary'+count+'Complete61TableValueRestore',async()=>{await restoreRows(target,restored,count);assertEqual(await roleState(target),restored.roles,'RESTORED_ROLES');});
  await extraRestoreChecks({source,target,count,restored,record});
  await target.startRest();
  await record('boundary'+count+'OldSourceAuthorityRefusedBeforeFreshRecovery',async()=>{
   assert.match(oldRecovery.hashed_token,/^[a-f0-9]{56}$/);assert.match(oldRecovery.email_otp,/^[0-9]{6}$/);
   const invitation=status(await source.api('/admin/generate_link',{method:'POST',bearer:source.admin(),body:{type:'invite',email:'pending-invite@example.invalid'}}));
   for(const body of [{type:'invite',token_hash:invitation.hashed_token},{type:'invite',email:'pending-invite@example.invalid',token:invitation.email_otp},{type:'recovery',token_hash:oldRecovery.hashed_token},{type:'recovery',email:owner.email,token:oldRecovery.email_otp}])
    assert.ok((await target.api('/verify',{method:'POST',body})).status>=400);
   assert.ok((await target.api('/token?grant_type=refresh_token',{method:'POST',body:{refresh_token:owner.session.refresh_token}})).status>=400);
   assert.ok((await target.api('/user',{bearer:owner.session.access_token})).status>=400);
   assert.ok((await target.rest('/profiles',{bearer:owner.session.access_token})).status>=400);
   assert.match(invitation.hashed_token,/^[a-f0-9]{56}$/);assert.match(invitation.email_otp,/^[0-9]{6}$/);
   // Genuine source controls run after target refusal so they cannot consume
   // authority before the negative. Expired or malformed inputs cannot pass.
   assertEqual(status(await source.api('/verify',{method:'POST',body:{type:'recovery',email:owner.email,token:oldRecovery.email_otp}})).user.id,owner.id,'SOURCE_OTP_POSITIVE');
   assertEqual(status(await source.api('/verify',{method:'POST',body:{type:'invite',email:'pending-invite@example.invalid',token:invitation.email_otp}})).user.id,invitation.id,'SOURCE_INVITE_POSITIVE');
   assertEqual(status(await source.api('/token?grant_type=refresh_token',{method:'POST',body:{refresh_token:owner.session.refresh_token}})).user.id,owner.id,'SOURCE_REFRESH_POSITIVE');
   status(await source.api('/user',{bearer:owner.session.access_token}));
   status(await source.api('/admin/users/'+invitation.id,{method:'DELETE',bearer:source.admin()}));
   assert.ok((await target.api('/token?grant_type=password',{method:'POST',body:{email:owner.email,password:owner.password}})).status>=400);
  });
  let fresh;
  await record('boundary'+count+'VerifiedFreshTargetRecoverySingleUse',async()=>{
   const mail=await target.recovery(owner);
   const recovery=status(await target.api('/verify',{method:'POST',body:{type:'recovery',token_hash:mail.hash}}));
   assertEqual(recovery.user.id,owner.id,'RECOVERY_UUID');
   const password=randomBytes(32).toString('base64url');
   status(await target.api('/user',{method:'PUT',bearer:recovery.access_token,body:{password}}));
   assert.ok((await target.api('/verify',{method:'POST',body:{type:'recovery',token_hash:mail.hash}})).status>=400);
   fresh=status(await target.api('/token?grant_type=password',{method:'POST',body:{email:owner.email,password}}));
   assertEqual(fresh.user.id,owner.id,'FRESH_UUID');
   status(await target.api('/user',{bearer:fresh.access_token}));
  });
  await record('boundary'+count+'RealRlsActivationClosureAndSignup',async()=>{
   const profiles=status(await target.rest('/profiles?select=id',{bearer:fresh.access_token}));assertEqual(profiles.map(x=>x.id),[owner.id],'OWNER_ROWS');
   assert.ok((await target.rest('/profiles')).status>=400);
   assert.ok((await target.rest('/profiles',{method:'POST',bearer:fresh.access_token,body:{id:foreign.id}})).status>=400);
   assert.ok((await target.rest('/diary_entries',{method:'PATCH',bearer:fresh.access_token,body:{user_id:foreign.id}})).status>=400);
   assert.ok((await target.api('/signup',{method:'POST',body:{email:'intruder@example.invalid',password:randomBytes(32).toString('hex')}})).status>=400);
   const foreignMail=await target.recovery(foreign);
   const foreignSession=status(await target.api('/verify',{method:'POST',body:{type:'recovery',token_hash:foreignMail.hash}}));
   assertEqual(status(await target.rest('/profiles?id=eq.'+owner.id,{bearer:foreignSession.access_token})),[],'FOREIGN_OWNER_ACCESS');
   assertEqual(status(await target.rest('/profiles?select=id',{bearer:foreignSession.access_token})),[],'RESTORED_CLOSED_OWNER_DENIED');
   assert.ok((await target.rest('/profiles',{method:'POST',bearer:foreignSession.access_token,body:{id:owner.id}})).status>=400);
   const mail=await target.recovery(inactive);
   const session=status(await target.api('/verify',{method:'POST',body:{type:'recovery',token_hash:mail.hash}}));
   assert.ok((await target.rest('/profiles',{method:'POST',bearer:session.access_token,body:{id:inactive.id}})).status>=400);
   await target.sql("insert into public.account_closures(user_id,closure_request_id,closure_policy_version) values ('"+owner.id+"',gen_random_uuid(),'p11e-e5-account-closure-v1');");
   assertEqual(status(await target.rest('/profiles?select=id',{bearer:fresh.access_token})),[],'CLOSED_READ');
   await target.rest('/profiles',{method:'PATCH',bearer:fresh.access_token,body:{display_name:'forbidden'}});
   assert.notEqual(await target.sql('select display_name from public.profiles;'),'forbidden');
  });
  if(count===44&&transition)await record('maintenance44To45TrustedTransitionPreservesPriorValues',async()=>{
   await source.remove('rest');await source.remove('auth');
   const before=await capture(source,44),m=boundary(45).at(-1),bytes=readFileSync(new URL('../../supabase/migrations/'+m.filename,import.meta.url));
   assertEqual(hash(bytes),m.sha256,'TRANSITION_BYTES');
   // No concurrent clients or externally reachable endpoints exist. A lost
   // acknowledgement fails the run; no retry branch applies this SQL again.
   await source.sql("begin;set local role postgres;\n"+bytes+"\ninsert into supabase_migrations.schema_migrations values ('"+m.version+"');commit;");
   for(const t of before.application) {
    const q=`select coalesce(jsonb_agg(rowtext order by rowtext collate "C"),'[]') from (select row_to_json(t)::text rowtext from (select ${t.columns.map(c=>'"'+c+'"').join(',')} from "${t.schema}"."${t.name}") t) r;`;
    assertEqual(JSON.parse(await source.sql(q)),t.rows,'TRANSITION_PRIOR_COLUMN_VALUES');
   }
   const after=await capture(source,45);
   const transitionArchive=join(work,'transition45');const encrypted=await seal(after,cert,transitionArchive);
   assertEqual(await openArchive(transitionArchive,key,cert,{source:source.prefix,boundary:45,manifestSha256:encrypted.manifestSha256}),after,'TRANSITION_45_ARCHIVE');
  });
  for(const e of [source,target])await e.stop();
 }
 success=true;
}catch(e){failure={stage,code:/^N002G_[A-Z0-9_]+$/.test(e.message)?e.message:'LOCAL_QUALIFICATION_FAILED'};process.exitCode=1;}
finally {
 const cleanup=await Promise.allSettled(envs.map(e=>e.stop()));rmSync(work,{recursive:true,force:true});
 const cleanupConfirmed=cleanup.every(r=>r.status==='fulfilled');if(!cleanupConfirmed)process.exitCode=1;
 const evidence={contract:'nutrition-'+profile+'-local-qualification/v1',result:success&&cleanupConfirmed?'PASS':'BLOCKED',startedAt,completedAt:new Date().toISOString(),node:process.version,implementationSha256,cases,failure:failure??null,cleanupConfirmed,productionAccess:false};
 writeFileSync(output,JSON.stringify(evidence,null,2)+'\n',{mode:0o600,flag:'wx'});process.stdout.write(evidence.result+'\n');
}
}

if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href)await qualify({output:process.argv[2]});
