import { randomBytes, randomUUID } from 'node:crypto';
import { existsSync, writeFileSync } from 'node:fs';
import { setTimeout as delay } from 'node:timers/promises';
import { Environment, LABEL } from './local.mjs';
import { run } from '../nutrition-002e1/local.mjs';
import { assertEqual, assertSchema, assertUuid, claims, CLIENT_IMAGE } from '../nutrition-002e1/contract.mjs';
import { BASE, CONTRACT, json, fail, validateSources, implementationDigest } from './contract.mjs';
import { account, login, verifyFactor, activate, requireStatus, denied, inventory, replay, compareApp, copyDurable } from './helpers.mjs';
import { issueRecentPasswordAuthProof, verifyRecentPasswordAuthProof } from '../../lib/auth/recent-password-auth-proof.ts';

const output=process.argv[2];
if(!output?.startsWith('/')||existsSync(output)||process.argv.length!==3||!process.version.startsWith('v22.'))fail('RUNTIME_OR_OUTPUT');
const startedAt=new Date().toISOString(),cases=[],observations={},findings=[],envs=[];
let stage='initialize',failure,initialDigest,completed=false;
async function record(name,fn) {
 stage=name;const start=Date.now();
 try{await fn();cases.push({name,result:'PASS',elapsedMs:Date.now()-start});}
 catch(e){cases.push({name,result:'FAIL',code:/^N002[A-Z0-9_]+$/.test(e.message)?e.message:'ASSERTION_FAILED',elapsedMs:Date.now()-start});throw e;}
}
const password=()=>randomBytes(32).toString('base64url');
const verify=(e,hash)=>e.api('/verify',{method:'POST',body:{type:'recovery',token_hash:hash}});
async function generated(e,user) {
 const v=requireStatus(await e.api('/admin/generate_link',{method:'POST',bearer:e.admin(),body:{type:'recovery',email:user.email}}),200,'GENERATE_RECOVERY');
 if(typeof v.hashed_token!=='string'||typeof v.email_otp!=='string')fail('GENERATED_RECOVERY_SHAPE');
 return {hash:v.hashed_token,otp:v.email_otp};
}
async function change(e,user,session,newPassword) {
 const old=user.password;
 const updated=requireStatus(await e.api('/user',{method:'PUT',bearer:session.access_token,body:{password:newPassword}}),200,'RECOVERY_UPDATE');
 assertEqual(updated.id,user.id,'RECOVERY_UUID');user.password=newPassword;
 const fresh=await login(e,user);
 await denied(await e.api('/token?grant_type=password',{method:'POST',body:{email:user.email,password:old}}),'OLD_PASSWORD_ACCEPTED');
 return fresh;
}
async function reset(e,user,locale) {
 const mail=await e.recovery(user,locale);assertEqual(mail.locale,locale,'LOCALIZED_TEMPLATE');
 const session=requireStatus(await verify(e,mail.hash),200,'RECOVERY_VERIFY');assertEqual(session.user.id,user.id,'RECOVERY_SUBJECT');
 const fresh=await change(e,user,session,password());
 requireStatus(await e.api('/logout?scope=local',{method:'POST',bearer:session.access_token,body:{}}),204,'RECOVERY_LOGOUT');
 await denied(await verify(e,mail.hash),'REPLAY_ACCEPTED');
 await denied(await e.api('/user',{bearer:session.access_token}),'RECOVERY_SESSION_RETAINED');
 await denied(await e.api('/token?grant_type=refresh_token',{method:'POST',body:{refresh_token:session.refresh_token}}),'RECOVERY_REFRESH_RETAINED');
 return fresh;
}
async function state(e,session) {return requireStatus(await e.rest('/rpc/current_account_access_state',{method:'POST',bearer:session.access_token,body:{}}),200,'APP_ACCESS');}
try {
 validateSources();initialDigest=implementationDigest();
 const source=new Environment('source'),target=new Environment('target');envs.push(source,target);
 await record('ownedCollisionRefusedWithoutAdoption',async()=>{
  const name=source.prefix+'-auth';
  if(await run('docker',['ps','-a','--filter','name=^/'+name+'$','--format','{{.Names}}']))fail('PREEXISTING_RESOURCE');
  const id=await run('docker',['run','-d','--pull=never','--name',name,'--label','codex.task='+LABEL,'--network','none','--log-driver','none','--memory','128m',CLIENT_IMAGE,'node','-e','setInterval(()=>{},1000)']);
  async function check(){const c=JSON.parse(await run('docker',['inspect',id]))[0];if(c.Id!==id||c.Name!=='/'+name||c.Config.Labels?.['codex.task']!==LABEL||c.Config.Image!==CLIENT_IMAGE||c.HostConfig.NetworkMode!=='none'||c.Mounts.length)fail('COLLISION_IDENTITY');}
  try{let rejected=false;try{await source.start();}catch(e){rejected=e.message==='N002E1_PREEXISTING_RESOURCE';}if(!rejected)fail('COLLISION_ADOPTED');await check();}
  finally{await check();await run('docker',['rm','-f',id]);}
 });
 let metadata;
 await record('realIndependentBootstrapPinnedSchemaAndMigrationBytes',async()=>{
  await source.start();await target.start();metadata=await inventory(source);
  assertSchema(metadata,json('ops/recovery/nutrition-002e1/auth-inventory.json'));assertSchema(await inventory(target),metadata);
  const expected=json('ops/recovery/nutrition-002e1/upstream-sources.json').files.filter(f=>f.repo==='auth'&&f.path.startsWith('migrations/')).map(({path,sha256})=>({path,sha256})).sort((a,b)=>a.path.localeCompare(b.path));
  for(const e of envs) {
   const actual=(await run('docker',['exec',e.ids.get('auth'),'sh','-c','sha256sum /usr/local/etc/auth/migrations/*.sql'])).split('\n').map(l=>{const [sha256,path]=l.trim().split(/\s+/);return {path:'migrations/'+path.split('/').at(-1),sha256};}).sort((a,b)=>a.path.localeCompare(b.path));
   assertEqual(actual,expected,'IMAGE_MIGRATIONS');await replay(e,0,44);await compareApp(e,44);await e.startRest();
  }
  observations.provider={version:'v2.196.0',migrationCount:metadata.migrations.length,head:metadata.migrations.at(-1),independentSchemas:true,
   internalNetworks:2,publishedPorts:0,externalMail:false,template:'UNCHANGED_REPOSITORY_RECOVERY_TEMPLATE',sink:'PINNED_NODE_RECEIVE_ONLY_MEMORY'};
 });
 let owner,foreign,factorUser,expiredUser,incomplete,closed;
 await record('realInvitedPasswordAccountsAndNoUnapprovedSignup',async()=>{
  [owner,foreign,factorUser,expiredUser,incomplete,closed]=await Promise.all(['owner','foreign','factor','expiry','incomplete','closed'].map(n=>account(source,n+'@example.invalid')));
  for(const e of envs) {
   await denied(await e.api('/signup',{method:'POST',body:{email:'forbidden@example.invalid',password:password()}}),'UNAPPROVED_SIGNUP');
   await denied(await e.api('/signup',{method:'POST',body:{}}),'ANONYMOUS_SIGNUP');
   assertEqual(await e.sql("select count(*) from auth.users where email='forbidden@example.invalid';"),'0','SIGNUP_ROW');
  }
 });
 await record('sourcePublicRecoverMailVerificationUpdateOldDenialReplayBothLocales',async()=>{
  owner.session=await reset(source,owner,'en');owner.session=await reset(source,owner,'he');
  await denied(await verify(source,randomBytes(28).toString('hex')),'WRONG_RECOVERY_TOKEN');
  await denied(await source.api('/user',{method:'PUT',body:{password:password()}}),'UNAUTHENTICATED_PASSWORD_UPDATE');
 });
 await record('foreignTokenCannotChooseOwnerOrOverwriteOwnerPassword',async()=>{
  const mail=await source.recovery(foreign,'he');
  await denied(await source.api('/verify',{method:'POST',body:{type:'recovery',token_hash:mail.hash,email:owner.email}}),'FOREIGN_TOKEN_OWNER_SELECTION');
  const session=requireStatus(await verify(source,mail.hash),200,'FOREIGN_VERIFY');assertEqual(session.user.id,foreign.id,'FOREIGN_SUBJECT');
  const next=password();const updated=requireStatus(await source.api('/user',{method:'PUT',bearer:session.access_token,body:{id:owner.id,password:next}}),200,'FOREIGN_SELF_UPDATE');
  assertEqual(updated.id,foreign.id,'OWNER_SUBSTITUTED');foreign.password=next;
  await login(source,owner);await login(source,foreign);await denied(await verify(source,mail.hash),'FOREIGN_REPLAY');
 });
 await record('genuineRecoveryNaturallyExpiresWithoutTokenTimestampMutation',async()=>{
  await source.expiry(2);const before=Date.now(),mail=await source.recovery(expiredUser,'en');
  await delay(2300);
  const r=await verify(source,mail.hash);assertEqual(r.status,403,'EXPIRED_STATUS');assertEqual(r.body.error_code,'otp_expired','EXPIRED_CODE');
  observations.expiry={fixtureOtpLifetimeSeconds:2,elapsedMs:Date.now()-before,tokenStateMutated:false,httpStatus:r.status,code:r.body.error_code};
  await source.expiry(3600);await login(source,expiredUser);
 });
 await record('populatedEncryptedTotpPreservedAcrossAuthorizedRecovery',async()=>{
  factorUser.session=await login(source,factorUser);
  const f=requireStatus(await source.api('/factors',{method:'POST',bearer:factorUser.session.access_token,body:{factor_type:'totp',friendly_name:'Disposable recovery qualification'}}),200,'FACTOR_ENROLL');
  factorUser.factor=assertUuid(f.id);factorUser.totpSecret=f.totp.secret;factorUser.session=await verifyFactor(source,factorUser,factorUser.session);
  const mail=await source.recovery(factorUser,'en'),s=requireStatus(await verify(source,mail.hash),200,'MFA_RECOVERY');
  const deniedUpdate=await source.api('/user',{method:'PUT',bearer:s.access_token,body:{password:password()}});
  assertEqual(deniedUpdate.status,401,'MFA_AAL1_STATUS');assertEqual(deniedUpdate.body.error_code,'insufficient_aal','MFA_AAL1_CODE');
  const aal2=await verifyFactor(source,factorUser,s);factorUser.session=await change(source,factorUser,aal2,password());
  await verifyFactor(source,factorUser,factorUser.session);
  assertEqual(await source.sql("select count(*) from auth.mfa_factors where status='verified' and secret like '{%';"),'1','FACTOR_PERSISTENCE');
  observations.mfa={aal1PasswordUpdateHttp:401,aal1Code:'insufficient_aal',aal2ContinuationPassed:true,
   originalFactorIdPreserved:true,originalAuthenticatorPreserved:true,applicationMfaContinuation:'ABSENT_IN_REVIEWED_SOURCE_CONDITIONAL_GATE'};
 });
 let pendingHash,pendingOtp,pendingHashUser,pendingOtpUser;
 await record('sourceValidPendingRecoveryControlsAndDistinctUnconsumedTokens',async()=>{
  const controlHash=await account(source,'control-hash@example.invalid'),controlOtp=await account(source,'control-otp@example.invalid');
  const hc=await generated(source,controlHash);assertEqual(requireStatus(await verify(source,hc.hash),200,'SOURCE_HASH_CONTROL').user.id,controlHash.id,'HASH_CONTROL_UUID');
  await denied(await verify(source,hc.hash),'SOURCE_HASH_REPLAY');
  const oc=await generated(source,controlOtp);
  assertEqual(requireStatus(await source.api('/verify',{method:'POST',body:{type:'recovery',email:controlOtp.email,token:oc.otp}}),200,'SOURCE_OTP_CONTROL').user.id,controlOtp.id,'OTP_CONTROL_UUID');
  await denied(await source.api('/verify',{method:'POST',body:{type:'recovery',email:controlOtp.email,token:oc.otp}}),'SOURCE_OTP_REPLAY');
  pendingHashUser=await account(source,'pending-hash@example.invalid');pendingOtpUser=await account(source,'pending-otp@example.invalid');
  pendingHash=await generated(source,pendingHashUser);pendingOtp=await generated(source,pendingOtpUser);
  // Only counts/booleans leave memory. Both source tokens really have provider
  // OTT and users state before transfer; controls prove each verification path.
  assertEqual(await source.sql(`select count(*) from auth.one_time_tokens where user_id in ('${assertUuid(pendingHashUser.id)}','${assertUuid(pendingOtpUser.id)}') and token_type='recovery_token';`),'2','PENDING_STATE');
  observations.pending={sourceHashControl:true,sourceOtpControl:true,bothControlsReplayDenied:true,pendingTokensUnconsumed:true,
   sourceOtpLifetimeSeconds:3600,oldJwtSigningKeyIrrelevantToOtp:true};
 });
 await record('stoppedFourTableTransferExactRowsFreshTargetWithoutSessionsOrOtt',async()=>{
  await source.remove('auth');await target.remove('auth');target.key=source.key;
  await copyDurable(source,target,metadata);await target.startAuth();
 });
 await record('targetOriginalPasswordUuidFactorThenFreshPublicRecoveryBothLocales',async()=>{
  owner.session=await login(target,owner);factorUser.session=await login(target,factorUser);
  factorUser.session=await verifyFactor(target,factorUser,factorUser.session);
  owner.session=await reset(target,owner,'en');owner.session=await reset(target,owner,'he');
  const mail=await target.recovery(factorUser,'he'),s=requireStatus(await verify(target,mail.hash),200,'TARGET_FACTOR_RECOVERY');
  const aal2=await verifyFactor(target,factorUser,s);factorUser.session=await change(target,factorUser,aal2,password());
  factorUser.session=await verifyFactor(target,factorUser,factorUser.session);
  observations.identity={passwordBeforeTransferPreserved:true,uuidStable:true,factorIdStable:true,
   freshRecoveryAfterRestore:true,enTemplate:true,heTemplate:true,completeLocalizedBrowserJourney:'NOT_RUN'};
 });
 await record('targetActivationOwnerAnonymousForeignAndRecoveryAmrRestrictions',async()=>{
  await denied(await target.rest('/profiles',{method:'POST',bearer:owner.session.access_token,body:{id:owner.id}}),'UNACTIVATED_OWNER');
  await denied(await target.rest('/rpc/complete_invited_account_activation',{method:'POST',bearer:owner.session.access_token,body:{p_age_18_attested:false,p_israel_attested:true}}),'ATTESTATION_REQUIRED');
  await activate(target,owner.session);foreign.session=await login(target,foreign);await activate(target,foreign.session);
  requireStatus(await target.rest('/profiles',{method:'POST',bearer:owner.session.access_token,body:{id:owner.id}}),201,'OWNER_PROFILE');
  requireStatus(await target.rest('/profiles',{method:'POST',bearer:foreign.session.access_token,body:{id:foreign.id}}),201,'FOREIGN_PROFILE');
  assertEqual(requireStatus(await target.rest('/profiles?select=id',{bearer:owner.session.access_token}),200,'OWN_READ').map(p=>p.id),[owner.id],'OWNER_ROWS');
  assertEqual(requireStatus(await target.rest('/profiles?id=eq.'+owner.id,{bearer:foreign.session.access_token}),200,'FOREIGN_READ'),[],'FOREIGN_ROWS');
  await denied(await target.rest('/profiles',{method:'POST',bearer:foreign.session.access_token,body:{id:owner.id}}),'FOREIGN_WRITE');
  await denied(await target.rest('/profiles'),'ANONYMOUS_READ');
  const mail=await target.recovery(incomplete,'en'),s=requireStatus(await verify(target,mail.hash),200,'INCOMPLETE_RECOVERY');
  await denied(await target.rest('/rpc/complete_invited_account_activation',{method:'POST',bearer:s.access_token,body:{p_age_18_attested:true,p_israel_attested:true}}),'OTP_ONLY_ACTIVATION');
  assertEqual(await state(target,s),'activation_required','RECOVERY_BYPASSED_ACTIVATION');
 });
 await record('oldSourceJwtRefreshWrongSigningKeyAndValidatorSpecificLogout',async()=>{
  const sourceSession=closed.session;
  await denied(await target.api('/user',{bearer:sourceSession.access_token}),'OLD_SOURCE_AUTH');
  await denied(await target.rest('/profiles',{bearer:sourceSession.access_token}),'OLD_SOURCE_REST');
  await denied(await target.api('/token?grant_type=refresh_token',{method:'POST',body:{refresh_token:sourceSession.refresh_token}}),'OLD_SOURCE_REFRESH');
  const temporary=await login(target,foreign),current=claims(temporary.access_token);
  if(current.session_id===claims(foreign.session.access_token).session_id)fail('NEW_SESSION_ID');
  requireStatus(await target.api('/logout?scope=local',{method:'POST',bearer:temporary.access_token,body:{}}),204,'LOCAL_LOGOUT');
  await denied(await target.api('/user',{bearer:temporary.access_token}),'LOGGED_OUT_AUTH');
  await denied(await target.api('/token?grant_type=refresh_token',{method:'POST',body:{refresh_token:temporary.refresh_token}}),'LOGGED_OUT_REFRESH');
  assertEqual(requireStatus(await target.rest('/profiles?select=id',{bearer:temporary.access_token}),200,'SIGNED_JWT_AFTER_LOGOUT').map(p=>p.id),[foreign.id],'JWT_OWNER_AFTER_LOGOUT');
  observations.logout={authSessionDenied:true,refreshDenied:true,postgrestStillReadsOwnRows:true,allTokenRevocation:false,signingScheme:'HS256_FIXTURE_ONLY',asymmetricJwks:'NOT_RUN'};
 });
 await record('actualApplicationRecentProofBoundToFreshIdentitySessionAndSecret',async()=>{
  const identity=claims(owner.session.access_token),secret=randomBytes(48).toString('base64url'),nowSeconds=Math.floor(Date.now()/1000);
  const proof=issueRecentPasswordAuthProof({nowSeconds,secret,sessionId:identity.session_id,userId:owner.id});
  const input={currentSessionId:identity.session_id,currentUserId:owner.id,nowSeconds,proof,secret};
  assertEqual(verifyRecentPasswordAuthProof(input).status,'valid','RECENT_PROOF');
  for(const extra of [{currentSessionId:randomUUID()},{currentUserId:foreign.id},{secret:randomBytes(48).toString('base64url')},{nowSeconds:nowSeconds+600}])
   assertEqual(verifyRecentPasswordAuthProof({...input,...extra}).status,'invalid','RECENT_PROOF_REPLAY');
  await denied(await target.rest('/rpc/close_current_account',{method:'POST',bearer:owner.session.access_token,body:{p_capability:'invalid',p_closure_request_id:randomUUID()}}),'UNPROVEN_CLOSURE');
  observations.recentAuth={actualApplicationProofFunctions:true,realProviderSessionIdentity:true,wrongUserSessionSecretExpiryDenied:true,
   completeServerActionAndCookieJourney:'NOT_RUN',pairedVaultCapabilityJourney:'NOT_RUN'};
 });
 await record('wrongMissingCredentialRootsDenyPasswordAndEncryptedFactor',async()=>{
  const key=target.key;target.key=randomBytes(32).toString('base64url');await target.restartAuth();
  await denied(await target.api('/token?grant_type=password',{method:'POST',body:{email:factorUser.email,password:factorUser.password}}),'WRONG_CREDENTIAL_ROOT');
  let factorDenied=false;try{await verifyFactor(target,factorUser,factorUser.session);}catch{factorDenied=true;}if(!factorDenied)fail('WRONG_FACTOR_ROOT_ACCEPTED');
  target.key=key;await target.restartAuth({GOTRUE_SECURITY_DB_ENCRYPTION_ENCRYPT:'false',GOTRUE_SECURITY_DB_ENCRYPTION_ENCRYPTION_KEY_ID:'',GOTRUE_SECURITY_DB_ENCRYPTION_ENCRYPTION_KEY:'',GOTRUE_SECURITY_DB_ENCRYPTION_DECRYPTION_KEYS:''});
  await denied(await target.api('/token?grant_type=password',{method:'POST',body:{email:owner.email,password:owner.password}}),'MISSING_CREDENTIAL_ROOT');
  await target.restartAuth();await login(target,owner);factorUser.session=await verifyFactor(target,factorUser,await login(target,factorUser));
 });
 await record('wrongTargetCleanupRefusalInterruptionAndRetainedDatabaseRestart',async()=>{
  const own=target.ids.get('db');target.ids.set('db',source.ids.get('db'));
  try{for(const operation of [()=>target.sql('select 1;'),()=>target.remove('db')]){let rejected=false;try{await operation();}catch(e){rejected=e.message==='N002E1_RESOURCE_IDENTITY';}if(!rejected)fail('WRONG_TARGET_ACCEPTED');}}
  finally{target.ids.set('db',own);}
  assertEqual(await source.sql('select 1;'),'1','SOURCE_DAMAGED');assertEqual(await target.sql('select 1;'),'1','TARGET_DAMAGED');
  await target.check('auth');await run('docker',['stop',target.ids.get('auth')]);
  let unavailable=false;try{await target.api('/health');}catch{unavailable=true;}if(!unavailable)fail('INTERRUPTION');await target.restart('auth');
  await target.remove('auth');await target.remove('rest');await target.restart('db');await target.startAuth();await target.startRest();
  await login(target,owner);factorUser.session=await verifyFactor(target,factorUser,await login(target,factorUser));
 });
 await record('unchanged45ApplicationMetadataAndClosedRecoveryCannotAuthorize',async()=>{
  for(const e of envs){await replay(e,44,45);await compareApp(e,45);}
  closed.session=await login(target,closed);await activate(target,closed.session);
  requireStatus(await target.rest('/profiles',{method:'POST',bearer:closed.session.access_token,body:{id:closed.id}}),201,'CLOSED_PROFILE');
  // The closure marker is explicitly a synthetic application fixture. No signed
  // browser/Vault closure ceremony is claimed and no RLS is weakened.
  await target.sql(`set role postgres;insert into public.account_closures(user_id,closure_request_id,closure_policy_version) values('${assertUuid(closed.id)}','${randomUUID()}','p11e-e5-account-closure-v1');`);
  closed.session=await reset(target,closed,'he');assertEqual(await state(target,closed.session),'closed','RECOVERY_REOPENED_ACCOUNT');
  assertEqual(requireStatus(await target.rest('/profiles',{bearer:closed.session.access_token}),200,'CLOSED_READ'),[],'CLOSED_ROWS');
  await denied(await target.rest('/profiles',{method:'POST',bearer:closed.session.access_token,body:{id:closed.id}}),'CLOSED_WRITE');
  await denied(await target.rest('/rpc/complete_invited_account_activation',{method:'POST',bearer:closed.session.access_token,body:{p_age_18_attested:true,p_israel_attested:true}}),'CLOSED_REACTIVATION');
  observations.closure={realAuthRecoveryCompleted:true,applicationStateStillClosed:true,rlsStillDenies:true,
   marker:'SYNTHETIC_APPLICATION_FIXTURE',signedCapabilityBrowserJourney:'NOT_RUN'};
 });
 // Last acceptance gate: a real unexpected authorization result stops further
 // fixture work. Do not repair token columns or relabel a failed negative PASS.
 await record('pendingSourceHashAndEmailOtpMustNotRestoreOldRecoveryAuthority',async()=>{
  const hashResult=await verify(target,pendingHash.hash);
  observations.pending.targetHashStatus=hashResult.status;
  observations.pending.targetHashCode=hashResult.body?.error_code??null;
  if(hashResult.status!==403||hashResult.body?.error_code!=='otp_expired')fail('PENDING_HASH_AUTHORITY');
  const wrong=await target.api('/verify',{method:'POST',body:{type:'recovery',email:owner.email,token:pendingOtp.otp}});
  await denied(wrong,'PENDING_FOREIGN_OTP');
  const otpResult=await target.api('/verify',{method:'POST',body:{type:'recovery',email:pendingOtpUser.email,token:pendingOtp.otp}});
  observations.pending.targetOtpStatus=otpResult.status;
  observations.pending.targetOtpCode=otpResult.body?.error_code??null;
  observations.pending.targetOtpUserMatches=otpResult.body?.user?.id===pendingOtpUser.id;
  observations.pending.elapsedSinceFixtureStartMs=Date.now()-Date.parse(startedAt);
  if(otpResult.status===200) {
   assertEqual(otpResult.body.user.id,pendingOtpUser.id,'PENDING_OTP_SUBJECT');
   findings.push('N002E2_EMBEDDED_SOURCE_RECOVERY_OTP_AUTHORITY_SURVIVES_FOUR_TABLE_COPY');
   fail('PENDING_SOURCE_OTP_INVALIDATION_GATE');
  }
  if(otpResult.status!==403)fail('PENDING_OTP_UNEXPECTED_STATUS');
 });
 completed=true;
}catch(e){failure=/^N002[A-Z0-9_]+$/.test(e.message)?e.message:'LOCAL_QUALIFICATION_FAILED';process.exitCode=1;}
finally {
 const cleanup=await Promise.allSettled(envs.map(e=>e.stop()));
 let absent=false;
 try{absent=await run('docker',['ps','-a','--filter','label=codex.task='+LABEL,'--format','{{.Names}}'])===''&&await run('docker',['network','ls','--filter','label=codex.task='+LABEL,'--format','{{.Name}}'])===''&&await run('docker',['volume','ls','--filter','label=codex.task='+LABEL,'--format','{{.Name}}'])==='';}catch{}
 const cleanupConfirmed=cleanup.every(r=>r.status==='fulfilled')&&absent;
 if(!cleanupConfirmed){process.exitCode=1;failure??='N002E2_CLEANUP_FAILED';}
 let digest=null;try{digest=implementationDigest();assertEqual(digest,initialDigest,'SOURCE_CHANGED');}catch{process.exitCode=1;failure??='N002E2_SOURCE_IDENTITY';}
 const result={contract:CONTRACT,base:BASE,sourceCommit:await run('git',['rev-parse','HEAD']),implementationSha256:digest,node:process.version,startedAt,completedAt:new Date().toISOString(),
  result:completed&&cleanupConfirmed?'PASS_BOUNDED_LIFECYCLE_FULL_RECOVERY_BLOCKED':findings.length&&cleanupConfirmed?'BLOCKED_WITH_ACTUAL_SECURITY_FINDING':'FAIL',
  failedStage:completed?null:stage,failure:failure??null,cases,observations,findings,cleanupConfirmed,
  hostedFeatures:'HOSTED_CONFIGURATION_UNKNOWN',hostedCredentialRoot:'HOSTED_CUSTODY_UNKNOWN',conditionalCeremonies:'NOT_REQUIRED_BY_REVIEWED_SOURCE_NOT_RUN',
  completeLocalizedBrowserJourney:'NOT_RUN',fullApplicationCapture:false,recoveryEligible:false,productionAccess:false,additionalSpendDollars:0};
 writeFileSync(output,JSON.stringify(result,null,2)+'\n',{mode:0o600,flag:'wx'});
 process.stdout.write(JSON.stringify({result:result.result,failure:result.failure,failedStage:result.failedStage,cases:cases.map(({name,result,code})=>({name,result,...(code?{code}:{})})),findings,cleanupConfirmed})+'\n');
}
