import { randomBytes, randomUUID } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { Environment, LABEL, run } from './local.mjs';
import { BASE, CONTRACT, AUTH_BOUNDARY, CLIENT_IMAGE, DURABLE, root, hash, assertEqual, assertSchema,
 assertUuid, identifier, claims, totp, token, fail, implementationDigest } from './contract.mjs';
import { MIGRATION_INVENTORY, assertRecoveryCheckout } from '../phase-11i-migration-inventory.mjs';

const output=process.argv[2],compile=process.argv[3]==='--compile-local-proposal';
if(!output?.startsWith('/')||existsSync(output)||process.argv.length!==(compile?4:3)||!process.version.startsWith('v22.'))fail('RUNTIME_OR_OUTPUT');
const startedAt=new Date().toISOString(),cases=[],envs=[],runtime={},stages=[],securityFindings=[],observations={};
let passed=false,failure,stage='initialize',initialDigest;
const read=p=>readFileSync(new URL(p,root),'utf8');
const inventorySql=read('scripts/nutrition-002e1/inventory.sql');
const upstream=JSON.parse(read('ops/recovery/nutrition-002e1/upstream-sources.json'));
async function record(name,fn) {
 stage=name;const time=Date.now();try{await fn();cases.push({name,result:'PASS',elapsedMs:Date.now()-time});}
 catch(e){cases.push({name,result:'FAIL',code:/^N002[A-Z0-9_]+$/.test(e.message)?e.message:'ASSERTION_FAILED',elapsedMs:Date.now()-time});throw e;}
}
function requireStatus(r,expected,code) {if(r.status!==expected)fail(code+'_HTTP_'+r.status);return r.body;}
async function denied(r,code) {if(r.status<400)fail(code);}
async function inventory(e) {return JSON.parse(await e.sql(inventorySql));}
async function replay(e,from,to) {
 for(const m of MIGRATION_INVENTORY.slice(from,to)) {
  const bytes=read('supabase/migrations/'+m.filename);assertEqual(hash(bytes),m.sha256,'MIGRATION_HASH');
  const source=to===44?'2617a6012d743e3196c7c2618e4ea46cbfe5c600':'50716d3759e9b75c66fe98b9c483ebb10c28b531';
  assertEqual(await run('git',['rev-parse',source+':supabase/migrations/'+m.filename]),await run('git',['hash-object','supabase/migrations/'+m.filename]),'MIGRATION_BLOB');
  await e.sql('set role postgres;\n'+bytes);
 }
}
async function account(e,email) {
 const password=randomBytes(32).toString('base64url');
 const invite=requireStatus(await e.api('/admin/generate_link',{method:'POST',bearer:e.admin(),body:{type:'invite',email}}),200,'INVITE');
 const session=requireStatus(await e.api('/verify',{method:'POST',body:{type:'invite',token_hash:invite.hashed_token}}),200,'INVITE_VERIFY');
 assertEqual(session.user.id,invite.id,'INVITE_UUID');assertUuid(invite.id);
 requireStatus(await e.api('/user',{method:'PUT',bearer:session.access_token,body:{password}}),200,'PASSWORD_SET');
 const login=requireStatus(await e.api('/token?grant_type=password',{method:'POST',body:{email,password}}),200,'PASSWORD_LOGIN');
 assertEqual(login.user.id,invite.id,'LOGIN_UUID');
 return {email,password,id:invite.id,session:login};
}
async function login(e,user) {const s=requireStatus(await e.api('/token?grant_type=password',{method:'POST',body:{email:user.email,password:user.password}}),200,'PASSWORD_LOGIN');assertEqual(s.user.id,user.id,'RESTORED_UUID');return s;}
async function verifyFactor(e,user,session) {
 const challenge=requireStatus(await e.api('/factors/'+user.factor+'/challenge',{method:'POST',bearer:session.access_token,body:{}}),200,'FACTOR_CHALLENGE');
 const verified=requireStatus(await e.api('/factors/'+user.factor+'/verify',{method:'POST',bearer:session.access_token,body:{challenge_id:challenge.id,code:totp(user.totpSecret)}}),200,'FACTOR_VERIFY');
 assertEqual(claims(verified.access_token).aal,'aal2','FACTOR_AAL');return verified;
}
async function activate(e,session) {return requireStatus(await e.rest('/rpc/complete_invited_account_activation',{method:'POST',bearer:session.access_token,body:{p_age_18_attested:true,p_israel_attested:true}}),200,'APP_ACTIVATE');}
async function compareApp(e,count) {
 const sql=read('scripts/nutrition-002e/inventory.sql');
 const observed=JSON.parse(await e.sql(sql)).filter(t=>!t.table.startsWith('auth.'));
 const expected=JSON.parse(read(`ops/recovery/nutrition-002e/inventory-${count}.json`)).filter(t=>!t.table.startsWith('auth.'));
 assertEqual(observed,expected,'APPLICATION_METADATA_'+count);
}
async function copyDurable(source,target,metadata) {
 for(const table of DURABLE) {
  const columns=metadata.tables.find(t=>t.name===table).columns.filter(c=>!c.generated).map(c=>identifier(c.name)).join(',');
  if(await target.sql('select count(*) from auth.'+identifier(table)+';')!=='0')fail('TARGET_NOT_EMPTY');
  const data=await source.sql(`copy (select ${columns} from auth.${identifier(table)} order by id) to stdout;`);
  if(data)await target.sql(`begin;copy auth.${identifier(table)} (${columns}) from stdin;\n${data}\n\\.\ncommit;`);
  // Compare complete rows including generated columns before service writes.
  const q=`copy (select * from auth.${identifier(table)} order by id) to stdout;`;
  assertEqual(await target.sql(q),await source.sql(q),'DURABLE_ROW_EQUALITY');
 }
 for(const table of ['sessions','refresh_tokens','mfa_amr_claims','mfa_challenges','one_time_tokens','flow_state','webauthn_challenges'])
  assertEqual(await target.sql(`select count(*) from auth.${identifier(table)};`),'0','VOLATILE_IMPORTED');
}
try {
 assertRecoveryCheckout(fileURLToPath(new URL('supabase/migrations',root)));
 if(!compile)initialDigest=implementationDigest();
 const source=new Environment('source'),target=new Environment('target');envs.push(source,target);
 if(!compile)await record('preexistingOwnedNameCollisionRefusedWithoutAdoption',async()=>{
  const name='nutrition-002e1-source-auth';
  if(await run('docker',['ps','-a','--filter','name=^/'+name+'$','--format','{{.Names}}']))fail('PREEXISTING_RESOURCE');
  const id=await run('docker',['run','-d','--pull=never','--name',name,'--label','codex.task='+LABEL,
   '--network','none','--log-driver','none','--memory','128m',CLIENT_IMAGE,'node','-e','setInterval(()=>{},1000)']);
  async function check(){const c=JSON.parse(await run('docker',['inspect',id]))[0];if(c.Id!==id||c.Name!=='/'+name||c.Config.Image!==CLIENT_IMAGE||c.Config.Labels?.['codex.task']!==LABEL||c.HostConfig.NetworkMode!=='none'||c.Mounts.length)fail('COLLISION_FIXTURE_IDENTITY');}
  try{let refused=false;try{await source.start();}catch(e){refused=e.message==='N002E1_PREEXISTING_RESOURCE';}if(!refused)fail('COLLISION_ADOPTED');await check();}
  finally{await check();await run('docker',['rm','-f',id]);}
 });
 await record('independentRealProviderBootstrap',async()=>{
  await source.start();await target.start();
  for(const e of envs){
   const sums=await run('docker',['exec',e.ids.get('auth'),'sh','-c','sha256sum /usr/local/etc/auth/migrations/*.sql']);
   const actual=sums.split('\n').map(l=>{const [sha256,path]=l.trim().split(/\s+/);return {path:'migrations/'+path.split('/').at(-1),sha256};}).sort((a,b)=>a.path.localeCompare(b.path));
   const expected=upstream.files.filter(f=>f.repo==='auth'&&f.path.startsWith('migrations/')).map(({path,sha256})=>({path,sha256})).sort((a,b)=>a.path.localeCompare(b.path));
   assertEqual(actual,expected,'IMAGE_MIGRATION_PROVENANCE');
   const c=await e.check('auth'),d=await e.check('db');
   runtime[e.side]={authVersion:(await e.api('/health')).body.version,authImage:c.Config.Image,authImageId:c.Image,dbImage:d.Config.Image,dbImageId:d.Image,
    serverVersion:await e.sql('show server_version;'),networkInternal:true,publishedPorts:0,internalOwnedHttpClient:true,
    hostBindMounts:0,ownedDisposableDatabaseVolume:true};
  }
 });stages.push('REAL_AUTH_BOOTSTRAP');
 if(!compile)await record('wrongTargetAndCleanupIdentityRefuseBeforeOperatingOnSource',async()=>{
  const own=target.ids.get('db');target.ids.set('db',source.ids.get('db'));
  try{
   for(const operation of [()=>target.sql('select 1;'),()=>target.remove('db')]) {
    let refused=false;try{await operation();}catch(e){refused=e.message==='N002E1_RESOURCE_IDENTITY';}if(!refused)fail('WRONG_TARGET_ACCEPTED');
   }
  }finally{target.ids.set('db',own);}
  assertEqual(await source.sql('select 1;'),'1','SOURCE_PRESERVED');assertEqual(await target.sql('select 1;'),'1','TARGET_PRESERVED');
 });
 let metadata;
 await record('independentSchemaAndMigrationInventory',async()=>{
  metadata=await inventory(source);assertSchema(await inventory(target),metadata);
  assertEqual(metadata.migrations.at(-1),AUTH_BOUNDARY,'AUTH_BOUNDARY');
  for(const t of DURABLE)if(!metadata.tables.some(x=>x.name===t))fail('DURABLE_TABLE_ABSENT');
  const path=new URL('ops/recovery/nutrition-002e1/auth-inventory.json',root);
  if(compile)writeFileSync(path,JSON.stringify(metadata,null,2)+'\n',{flag:'wx'});
  else assertSchema(metadata,JSON.parse(readFileSync(path,'utf8')));
 });stages.push('PROVIDER_METADATA');
 if(compile) {passed=true;} else {
 await record('authSchemaDriftRefusals',async()=>{
  for(const sql of ['drop table auth.webauthn_credentials','alter table auth.users drop column encrypted_password','create table auth.unapproved_credentials(id uuid)',
   'delete from auth.schema_migrations where version=(select max(version) from auth.schema_migrations)',
   'alter table auth.users disable row level security','grant select on auth.users to anon']) {
   const changed=JSON.parse(await target.sql('begin;'+sql+';'+inventorySql.replace('begin read only;','').replace('rollback;','')+'rollback;'));
   let refused=false;try{assertSchema(changed,metadata);}catch{refused=true;}if(!refused)fail('DRIFT_NOT_REFUSED');
  }assertSchema(await inventory(target),metadata);
 });
 await record('authentic44ApplicationReplayBothEnvironments',async()=>{await replay(source,0,44);await replay(target,0,44);await compareApp(source,44);await compareApp(target,44);});
 stages.push('APPLICATION_44');
 await record('realApiUnauthorizedSignupAndAnonymousDenied',async()=>{
  for(const e of envs){await denied(await e.api('/signup',{method:'POST',body:{email:'forbidden@example.invalid',password:randomBytes(32).toString('hex')}}),'PUBLIC_SIGNUP');
   await denied(await e.api('/signup',{method:'POST',body:{}}),'ANONYMOUS_SIGNUP');}
 });
 let owner,foreign,pendingSourceRecovery;
 await record('apiInvitationConfirmationPasswordLoginAndRefresh',async()=>{
  owner=await account(source,'owner@example.invalid');foreign=await account(source,'foreign@example.invalid');
  const refreshed=requireStatus(await source.api('/token?grant_type=refresh_token',{method:'POST',body:{refresh_token:owner.session.refresh_token}}),200,'REFRESH');
  assertEqual(refreshed.user.id,owner.id,'REFRESH_UUID');owner.session=refreshed;
  assertEqual(await source.sql("select count(*) from auth.users where encrypted_password like '{%';"),'2','PASSWORD_ENCRYPTION');
 });stages.push('REAL_INVITED_PASSWORD_AND_REFRESH');
 await record('actual44ActivationRlsOwnerAndForeignDenial',async()=>{
  await source.startRest();await target.startRest();
  await denied(await source.rest('/profiles',{method:'POST',bearer:owner.session.access_token,body:{id:owner.id}}),'UNACTIVATED_WRITE');
  await denied(await source.rest('/rpc/complete_invited_account_activation',{method:'POST',bearer:owner.session.access_token,body:{p_age_18_attested:false,p_israel_attested:true}}),'MISSING_ATTESTATION');
  await activate(source,owner.session);await activate(source,foreign.session);
  requireStatus(await source.rest('/profiles',{method:'POST',bearer:owner.session.access_token,body:{id:owner.id}}),201,'OWN_PROFILE');
  requireStatus(await source.rest('/profiles',{method:'POST',bearer:foreign.session.access_token,body:{id:foreign.id}}),201,'FOREIGN_PROFILE');
  const own=requireStatus(await source.rest('/profiles?select=id',{bearer:owner.session.access_token}),200,'OWNER_READ');
  assertEqual(own.map(x=>x.id),[owner.id],'OWNER_ISOLATION');
  assertEqual(requireStatus(await source.rest('/profiles?id=eq.'+foreign.id,{bearer:owner.session.access_token}),200,'FOREIGN_READ'),[],'FOREIGN_ROWS');
  await denied(await source.rest('/profiles',{method:'POST',bearer:owner.session.access_token,body:{id:foreign.id}}),'FOREIGN_WRITE');
  await denied(await source.rest('/profiles'),'ANONYMOUS_READ');
 });
 await record('populatedEncryptedTotpEnrolmentAndVerification',async()=>{
  const f=requireStatus(await source.api('/factors',{method:'POST',bearer:owner.session.access_token,body:{factor_type:'totp',friendly_name:'Disposable qualification'}}),200,'FACTOR_ENROLL');
  owner.factor=assertUuid(f.id);owner.totpSecret=f.totp.secret;
  owner.session=await verifyFactor(source,owner,owner.session);
  assertEqual(await source.sql("select count(*) from auth.mfa_factors where status='verified' and secret like '{%';"),'1','FACTOR_ENCRYPTION');
  await denied(await source.api('/factors',{method:'POST',bearer:owner.session.access_token,body:{factor_type:'phone',phone:'+15550000000'}}),'PHONE_DISABLED');
  await denied(await source.api('/passkeys/authentication/options',{method:'POST',body:{}}),'PASSKEY_DISABLED');
 });stages.push('POPULATED_ENCRYPTED_TOTP');
 await record('sourcePendingRecoveryCreatedThroughSupportedApiWithoutMail',async()=>{
  pendingSourceRecovery=requireStatus(await source.api('/admin/generate_link',{method:'POST',bearer:source.admin(),body:{type:'recovery',email:foreign.email}}),200,'SOURCE_RECOVERY_LINK').hashed_token;
  if(typeof pendingSourceRecovery!=='string'||!pendingSourceRecovery)fail('RECOVERY_TOKEN_MISSING');
 });
 await record('stoppedSameVersionAuthOnlyCopyWithExactRowsAndNoSessions',async()=>{
  await source.remove('auth');await target.remove('auth');target.key=source.key;
  await copyDurable(source,target,metadata);await target.startAuth();
 });stages.push('AUTH_ONLY_DURABLE_TRANSFER');
 let recovered;
 await record('restoredOriginalPasswordUuidAndPopulatedFactorAccepted',async()=>{
  recovered=await login(target,owner);recovered=await verifyFactor(target,owner,recovered);
  assertEqual(claims(recovered.access_token).sub,owner.id,'TARGET_SUBJECT');
  if(claims(recovered.access_token).session_id===claims(owner.session.access_token).session_id)fail('SESSION_REUSED');
  await activate(target,recovered);
  requireStatus(await target.rest('/profiles',{method:'POST',bearer:recovered.access_token,body:{id:owner.id}}),201,'TARGET_PROFILE');
  assertEqual(requireStatus(await target.rest('/profiles?select=id',{bearer:recovered.access_token}),200,'TARGET_OWNER_READ').map(x=>x.id),[owner.id],'TARGET_OWNER');
 });stages.push('TARGET_PASSWORD_TOTP_UUID');
 await record('pendingSourceRecoveryEvaluatedBeforeAnyTargetPasswordLoginForThatUser',async()=>{
  const r=await target.api('/verify',{method:'POST',body:{type:'recovery',token_hash:pendingSourceRecovery}});
  observations.pendingSourceRecovery={targetHttpStatus:r.status,code:/^[a-z_]+$/.test(r.body?.error_code??'')?r.body.error_code:null};
  if(r.status===200){
   assertEqual(r.body.user.id,foreign.id,'PENDING_RECOVERY_UUID');
   securityFindings.push('N002E1_SOURCE_PENDING_RECOVERY_SURVIVES_ROW_COPY');
  }else if(r.status!==403)fail('PENDING_RECOVERY_UNEXPECTED_STATUS');
 });
 await record('oldSourceAccessAndRefreshDeniedByActualTargetPaths',async()=>{
  await denied(await target.api('/token?grant_type=refresh_token',{method:'POST',body:{refresh_token:owner.session.refresh_token}}),'SOURCE_REFRESH');
  await denied(await target.api('/user',{bearer:owner.session.access_token}),'SOURCE_AUTH_JWT');
  await denied(await target.rest('/profiles',{bearer:owner.session.access_token}),'SOURCE_REST_JWT');
  const forged=token(source.signing,{sub:owner.id,role:'authenticated',aud:'authenticated',session_id:randomUUID()});
  await denied(await target.api('/user',{bearer:forged}),'WRONG_KEY_AUTH');await denied(await target.rest('/profiles',{bearer:forged}),'WRONG_KEY_REST');
 });
 await record('logoutRevokesRefreshAndAuthSessionButJwtRlsRemainsExplicit',async()=>{
  const temporary=await login(target,foreign);
  requireStatus(await target.api('/logout',{method:'POST',bearer:temporary.access_token,body:{}}),204,'LOGOUT');
  await denied(await target.api('/token?grant_type=refresh_token',{method:'POST',body:{refresh_token:temporary.refresh_token}}),'SIGNED_OUT_REFRESH');
  await denied(await target.api('/user',{bearer:temporary.access_token}),'SIGNED_OUT_AUTH');
  // PostgREST validates signed JWTs without Auth session lookup. Do not call
  // this complete revocation; the user's account remains unactivated here.
  requireStatus(await target.rest('/profiles',{bearer:temporary.access_token}),200,'JWT_AFTER_LOGOUT');
 });
 await record('wrongAndMissingCredentialEncryptionKeyRejectPassword',async()=>{
  const original=target.key;
  target.key=randomBytes(32).toString('base64url');await target.restartAuth();
  await denied(await target.api('/token?grant_type=password',{method:'POST',body:{email:owner.email,password:owner.password}}),'WRONG_CREDENTIAL_ROOT');
  target.key=original;await target.restartAuth({GOTRUE_SECURITY_DB_ENCRYPTION_ENCRYPT:'false',GOTRUE_SECURITY_DB_ENCRYPTION_ENCRYPTION_KEY_ID:'',GOTRUE_SECURITY_DB_ENCRYPTION_ENCRYPTION_KEY:'',GOTRUE_SECURITY_DB_ENCRYPTION_DECRYPTION_KEYS:''});
  await denied(await target.api('/token?grant_type=password',{method:'POST',body:{email:owner.email,password:owner.password}}),'MISSING_CREDENTIAL_ROOT');
  await target.restartAuth();recovered=await login(target,owner);
 });
 await record('credentialTamperAndUuidBoundCiphertextRejected',async()=>{
  // Negative mutations of genuine API-created ciphertext, never a substitute
  // for credential provisioning. Restore exact bytes afterwards in memory.
  const id=assertUuid(owner.id);const before=await target.sql(`select encrypted_password from auth.users where id='${id}';`);
  const quoted=before.replaceAll("'","''");
  await target.sql(`update auth.users set encrypted_password='invalid-ciphertext' where id='${id}';`);
  await denied(await target.api('/token?grant_type=password',{method:'POST',body:{email:owner.email,password:owner.password}}),'TAMPERED_PASSWORD');
  await target.sql(`update auth.users set encrypted_password='${quoted}' where id='${id}';`);
  const other=await target.sql(`select encrypted_password from auth.users where id='${assertUuid(foreign.id)}';`);
  await target.sql(`update auth.users set encrypted_password='${quoted}' where id='${foreign.id}';`);
  await denied(await target.api('/token?grant_type=password',{method:'POST',body:{email:foreign.email,password:owner.password}}),'UUID_CIPHERTEXT_SUBSTITUTION');
  await target.sql(`update auth.users set encrypted_password='${other.replaceAll("'","''")}' where id='${foreign.id}';`);
  recovered=await login(target,owner);
 });
 await record('interruptedAuthAndTargetRestartPreserveFreshLogin',async()=>{
  await target.check('auth');await run('docker',['stop',target.ids.get('auth')]);
  let unavailable=false;try{await target.api('/health');}catch{unavailable=true;}if(!unavailable)fail('INTERRUPTION_NOT_OBSERVED');
  await target.restart('auth');await login(target,owner);
  await target.remove('rest');await target.remove('auth');await target.restart('db');
  await target.startAuth();await target.startRest();recovered=await login(target,owner);recovered=await verifyFactor(target,owner,recovered);
 });
 await record('authentic45ReplayBothAndAuthorizationContinuity',async()=>{
  await replay(source,44,45);await replay(target,44,45);await compareApp(source,45);await compareApp(target,45);
  assertEqual(requireStatus(await target.rest('/rpc/current_account_access_state',{method:'POST',bearer:recovered.access_token,body:{}}),200,'ACCESS_45'),'active','ACTIVE_45');
 });stages.push('APPLICATION_45');
 await record('closedAccountCannotAuthorizeOrReactivate',async()=>{
  // This inserts an application closure fixture only. The signed capability/
  // browser closure journey remains explicitly unqualified, not bypassed.
  await target.sql(`set role postgres;insert into public.account_closures(user_id,closure_request_id,closure_policy_version) values('${assertUuid(owner.id)}','${randomUUID()}','p11e-e5-account-closure-v1');`);
  assertEqual(requireStatus(await target.rest('/rpc/current_account_access_state',{method:'POST',bearer:recovered.access_token,body:{}}),200,'CLOSED_STATE'),'closed','CLOSURE');
  assertEqual(requireStatus(await target.rest('/profiles',{bearer:recovered.access_token}),200,'CLOSED_READ'),[],'CLOSED_ROWS');
  await denied(await target.rest('/rpc/complete_invited_account_activation',{method:'POST',bearer:recovered.access_token,body:{p_age_18_attested:true,p_israel_attested:true}}),'CLOSED_ACTIVATION');
  requireStatus(await target.rest('/profiles?id=eq.'+owner.id,{method:'PATCH',bearer:recovered.access_token,body:{display_name:'forbidden'}}),204,'CLOSED_FILTERED_MUTATION');
  assertEqual(await target.sql(`select count(*) from public.profiles where id='${owner.id}' and display_name='forbidden';`),'0','CLOSED_MUTATION');
 });
 passed=true;
 }
}catch(e){failure=/^N002[A-Z0-9_]+$/.test(e.message)?e.message:'LOCAL_QUALIFICATION_FAILED';process.exitCode=1;}
finally {
 const cleanup=await Promise.allSettled(envs.map(e=>e.stop()));
 let absent=false;try{absent=await run('docker',['ps','-a','--filter','label=codex.task='+LABEL,'--format','{{.Names}}'])===''&&await run('docker',['network','ls','--filter','label=codex.task='+LABEL,'--format','{{.Name}}'])===''&&await run('docker',['volume','ls','--filter','label=codex.task='+LABEL,'--format','{{.Name}}'])==='';}catch{}
 const cleanupConfirmed=cleanup.every(r=>r.status==='fulfilled')&&absent;if(!cleanupConfirmed)process.exitCode=1;
 let digest;try{digest=implementationDigest();if(initialDigest)assertEqual(digest,initialDigest,'SOURCE_CHANGED');}catch{if(!compile){passed=false;failure??='N002E1_SOURCE_IDENTITY';process.exitCode=1;}}
 const result={contract:CONTRACT,base:BASE,sourceCommit:await run('git',['rev-parse','HEAD']),implementationSha256:digest??null,
  startedAt,completedAt:new Date().toISOString(),node:process.version,runtime,stages,cases,securityFindings,observations,compileProposal:compile,
  result:passed&&cleanupConfirmed?(compile?'PASS_BOOTSTRAP_PROPOSAL_ONLY':'PASS_BOUNDED_AUTH_RECOVERY_BLOCKED'):'FAIL',
  failure:failure??null,failedStage:passed?null:stage,cleanupConfirmed,actualAuthService:true,
  passkeyCeremony:'NOT_RUN',mfaWebauthn:'NOT_RUN',hostedFeatures:'UNKNOWN',closureCapabilityJourney:'NOT_RUN',
  coherentApplicationCapture:false,producerAuthenticated:false,recoveryEligible:false,productionAccess:false};
 writeFileSync(output,JSON.stringify(result,null,2)+'\n',{mode:0o600,flag:'wx'});
 process.stdout.write(JSON.stringify({result:result.result,failure:result.failure,failedStage:result.failedStage,cleanupConfirmed,
  cases:cases.map(({name,result,code})=>({name,result,...(code?{code}:{})}))})+'\n');
}
