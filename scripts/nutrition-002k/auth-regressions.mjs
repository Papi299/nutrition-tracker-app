import assert from 'node:assert/strict';
import { randomBytes, randomUUID, createHmac } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import { AUTH_VERSION, assertService, validateIdentity, assertEqual } from '../nutrition-002g/contract.mjs';
import { capture } from './transport.mjs';
import { fixturePassword } from '../nutrition-002g/password-fixture.mjs';
import { Environment as RestrictedEnvironment } from '../nutrition-002i/local.mjs';
import { issueRecentPasswordAuthProof, verifyRecentPasswordAuthProof } from '../../lib/auth/recent-password-auth-proof.ts';

export const observations = [];
const strong = fixturePassword;
const boundaryRecord=(count,record)=>(name,fn)=>record('boundary'+count+name.replace(/^auth197/,'Auth197'),fn);
const response = (r, status=200) => { assert.equal(r.status,status,'HTTP_STATUS_'+r.status); return r.body; };
const claims = token => JSON.parse(Buffer.from(token.split('.')[1],'base64url').toString());
const sqlJson = async(e,sql) => JSON.parse(await e.sql(sql));
const rejected = r => { assert.ok(r.status>=400 && r.status<500,'EXPECTED_SECURITY_REJECTION'); };
const address = label => label+'-'+randomBytes(6).toString('hex')+'@example.invalid';
async function signIn(e,user) { const s=response(await e.api('/token?grant_type=password',{method:'POST',body:{email:user.email,password:user.password}})); assert.equal(s.user.id,user.id);return s; }
async function adminCreate(e,{email=address('probe'),id=randomUUID(),password}={}) {
 const body={id,email,email_confirm:true,...(password?{password}:{})};
 const u=response(await e.api('/admin/users',{method:'POST',bearer:e.admin(),body}));assert.equal(u.id,id);
 return {id,email,password};
}
async function adminDelete(e,u) {response(await e.api('/admin/users/'+u.id,{method:'DELETE',bearer:e.admin()}));}
function totp(secret) {
 assert.match(secret,/^[A-Z2-7]{16,128}$/);
 let bits=''; for(const c of secret.replace(/=+$/,''))bits+='ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'.indexOf(c.toUpperCase()).toString(2).padStart(5,'0');
 const bytes=[];for(let i=0;i+8<=bits.length;i+=8)bytes.push(parseInt(bits.slice(i,i+8),2));
 const counter=Buffer.alloc(8);counter.writeBigUInt64BE(BigInt(Math.floor(Date.now()/30000)));
 const digest=createHmac('sha1',Buffer.from(bytes)).update(counter).digest(),offset=digest.at(-1)&15;
 return String((digest.readUInt32BE(offset)&0x7fffffff)%1000000).padStart(6,'0');
}
async function verifyTotp(e,factor,session) {
 const challenge=response(await e.api('/factors/'+factor.id+'/challenge',{method:'POST',bearer:session.access_token,body:{}}));
 return response(await e.api('/factors/'+factor.id+'/verify',{method:'POST',bearer:session.access_token,body:{challenge_id:challenge.id,code:totp(factor.totp.secret)}}));
}

export async function fixtureFacts({source,target,count,record}) {
 record=boundaryRecord(count,record);
 await record('auth197Actual197VersionsAndAuthSchema',async()=>{
  for(const e of [source,target]) {
   const health=response(await e.api('/health'));assertService(health.version);
   assert.throws(()=>assertService('v2.196.0'),/N002G_AUTH_VERSION/);
   const facts=await sqlJson(e,`select jsonb_build_object('postgres',current_setting('server_version_num'),
    'newTables',(select count(*) from information_schema.tables where table_schema='auth' and table_name in ('mfa_recovery_code_sets','mfa_recovery_codes','scim_users','scim_tokens')),
    'expiryColumn',exists(select 1 from information_schema.columns where table_schema='auth' and table_name='one_time_tokens' and column_name='expires_at'),
    'recoveryFactor',exists(select 1 from pg_enum e join pg_type t on t.oid=e.enumtypid join pg_namespace n on n.oid=t.typnamespace where n.nspname='auth' and e.enumlabel='recovery_code'),
    'appTables',(select count(*) from information_schema.tables where table_schema in ('public','ingestion') and table_type='BASE TABLE'));`);
   assertEqual(facts,{postgres:'170006',newTables:4,expiryColumn:true,recoveryFactor:true,appTables:61},'AUTH197_SCHEMA');
   observations.push({boundary:count,side:e.side,version:health.version,image:e.images.auth,postgres:facts.postgres,newAuthTables:facts.newTables,expiryColumn:true,appTables:61,observedAt:new Date().toISOString()});
  }
 });
}

export async function beforeCapture({source,target,count,record}) {
 record=boundaryRecord(count,record);
 let noPassword,probe;
 try {
  await record('auth197ExactAdminPayloadCreatesRandomCredentialAndEmailIdentity',async()=>{
   noPassword=await adminCreate(source);
   const facts=await sqlJson(source,`select jsonb_build_object('oneUser',count(*)=1,'confirmed',bool_and(email_confirmed_at is not null),'generatedCredential',bool_and(length(encrypted_password)>0),
    'identity',(select count(*)=1 and bool_and(provider='email' and provider_id=user_id::text) from auth.identities where user_id='${noPassword.id}')) from auth.users where id='${noPassword.id}';`);
   assertEqual(facts,{oneUser:true,confirmed:true,generatedCredential:true,identity:true},'AUTH197_ADMIN_IDENTITY');
  });
  await adminDelete(source,noPassword);noPassword=null;
  await record('auth197StrictAdminPasswordPolicyRejectsEveryInvalidClass',async()=>{
   const invalid=['Ab1!','abcdefghijklmnop!1','ABCDEFGHIJKLMNOP!1','Abcdefghijklmnop!','Abcdefghijklmnop12'];
   for(const password of invalid) {
    const id=randomUUID(),email=address('weak');
    const r=await source.api('/admin/users',{method:'POST',bearer:source.admin(),body:{id,email,email_confirm:true,password}});
    rejected(r);assert.equal(r.body?.error_code,'weak_password');
    assert.equal(await source.sql(`select count(*) from auth.users where id='${id}';`),'0');
   }
  });
  await record('auth197StrictSuppliedPasswordWorks',async()=>{
   probe=await adminCreate(source,{password:strong()});probe.session=await signIn(source,probe);
  });
  await record('auth197AdminContactUpdateRevokesGenuinePendingRecoveryAuthority',async()=>{
   const first=response(await source.api('/admin/generate_link',{method:'POST',bearer:source.admin(),body:{type:'recovery',email:probe.email}}));
   assert.equal(response(await source.api('/verify',{method:'POST',body:{type:'recovery',token_hash:first.hashed_token}})).user.id,probe.id);
   const pending=response(await source.api('/admin/generate_link',{method:'POST',bearer:source.admin(),body:{type:'recovery',email:probe.email}}));
   assert.equal(await source.sql(`select count(*) from auth.users where id='${probe.id}' and recovery_token<>'' and recovery_sent_at>now()-interval '15 seconds';`),'1');
   const changed=address('changed');response(await source.api('/admin/users/'+probe.id,{method:'PUT',bearer:source.admin(),body:{email:changed,email_confirm:true}}));probe.email=changed;
   rejected(await source.api('/verify',{method:'POST',body:{type:'recovery',token_hash:pending.hashed_token}}));
   rejected(await source.api('/verify',{method:'POST',body:{type:'recovery',email:changed,token:pending.email_otp}}));
   assert.equal(await source.sql(`select count(*) from auth.one_time_tokens where user_id='${probe.id}';`),'0');
   const fresh=response(await source.api('/admin/generate_link',{method:'POST',bearer:source.admin(),body:{type:'recovery',email:changed}}));
   assert.equal(response(await source.api('/verify',{method:'POST',body:{type:'recovery',token_hash:fresh.hashed_token}})).user.id,probe.id);
   probe.session=await signIn(source,probe);
  });
  await record('auth197RecoveryCodesCannotEnrollFromAal1',async()=>{
   const r=await source.api('/factors/recovery-codes',{method:'POST',bearer:probe.session.access_token,body:{}});
   assert.equal(r.status,403);assert.equal(r.body?.error_code,'insufficient_aal');
  });
  let factor,aal2,codes;
  await record('auth197RealTotpAndRecoveryCodeEnrollment',async()=>{
   factor=response(await source.api('/factors',{method:'POST',bearer:probe.session.access_token,body:{factor_type:'totp',friendly_name:'AUTH197 synthetic TOTP'}}));
   aal2=await verifyTotp(source,factor,probe.session);assert.equal(claims(aal2.access_token).aal,'aal2');
   const generated=response(await source.api('/factors/recovery-codes',{method:'POST',bearer:aal2.access_token,body:{friendly_name:'AUTH197 synthetic recovery'}}));
   codes=generated.codes;assert.equal(codes.length,10);
   const status=response(await source.api('/factors/recovery-codes',{bearer:aal2.access_token}));assert.equal(status.remaining,10);assert.equal(status.codes,undefined);
   assert.equal(await source.sql(`select count(*) from auth.mfa_recovery_code_sets where user_id='${probe.id}';`),'1');
   assert.equal(await source.sql('select count(*) from auth.mfa_recovery_codes;'),'10');
  });
  await record('auth197EnrolledRecoveryCodeStateRejectsCaptureAndRemainsOutsideTarget',async()=>{
   await assert.rejects(()=>capture(source,count,{reference:target}),/UNSUPPORTED_AUTH_STATE/);
   assert.equal(await target.sql('select count(*) from auth.mfa_recovery_codes;'),'0');
   assert.equal(await target.sql('select count(*) from auth.mfa_recovery_code_sets;'),'0');
   assert.equal(await source.sql(`select count(*) from auth.mfa_factors where user_id='${probe.id}' and factor_type='recovery_code';`),'1');
   assert.equal(await source.sql(`select count(*) from pg_constraint where conrelid='auth.mfa_recovery_code_sets'::regclass and confrelid='auth.mfa_factors'::regclass and contype='f' and convalidated;`),'1');
  });
  await record('auth197RecoveryCodeOneUseAndAmrBinding',async()=>{
   const login=await signIn(source,probe);
   const verified=response(await source.api('/factors/recovery-codes/verify',{method:'POST',bearer:login.access_token,body:{code:codes[0]}}));
   const identity=claims(verified.access_token);assert.equal(identity.aal,'aal2');assert.ok(identity.amr.some(x=>x.method==='mfa/recovery_code'));
   assert.equal(await source.sql('select count(*) from auth.mfa_recovery_codes where consumed_at is not null;'),'1');
   const replaySession=await signIn(source,probe);response(await source.api('/user',{bearer:replaySession.access_token}));
   const r=await source.api('/factors/recovery-codes/verify',{method:'POST',bearer:replaySession.access_token,body:{code:codes[0]}});
   assert.equal(r.status,422);assert.equal(r.body?.error_code,'mfa_verification_failed');aal2=verified;
  });
  await record('auth197RecoveryCodeRotationAndDeletionRevokeAuthority',async()=>{
   const previous=codes[1];const replacement=response(await source.api('/factors/recovery-codes/regenerate',{method:'POST',bearer:aal2.access_token,body:{}}));
   assert.equal(replacement.codes.length,10);const login=await signIn(source,probe);
   const old=await source.api('/factors/recovery-codes/verify',{method:'POST',bearer:login.access_token,body:{code:previous}});assert.equal(old.status,422);
   const verified=response(await source.api('/factors/recovery-codes/verify',{method:'POST',bearer:login.access_token,body:{code:replacement.codes[0]}}));
   response(await source.api('/factors/recovery-codes',{method:'DELETE',bearer:verified.access_token}));
   assert.equal(await source.sql('select count(*) from auth.mfa_recovery_code_sets;'),'0');assert.equal(await source.sql('select count(*) from auth.mfa_recovery_codes;'),'0');
   await assert.rejects(()=>capture(source,count,{reference:target}),/UNSUPPORTED_AUTH_STATE/);
  });
 } finally {if(noPassword)await adminDelete(source,noPassword);if(probe)await adminDelete(source,probe);}
 await record('auth197NoFactorCaptureRemainsEligibleAfterRecordedNegativeProbeCleanup',async()=>{
  assert.equal(await source.sql('select count(*) from auth.mfa_factors;'),'0');
  const p=await capture(source,count,{reference:target});assert.equal(p.identity.authVersion,AUTH_VERSION);assert.ok(p.identity.owners.every(o=>o.factors===0));
 });
}

export async function targetInitialChecks({target,count,restored,record}) {
 record=boundaryRecord(count,record);
 await record('auth197IndependentReconstructedIdentityAndEmptyAuthorityTables',async()=>{
  assert.throws(()=>validateIdentity({...restored.identity,authVersion:'v2.196.0'}),/IDENTITY_PROFILE/);
  for(const owner of restored.identity.owners) {
   const f=await sqlJson(target,`select jsonb_build_object('sameUuid',count(*)=1,'confirmed',bool_and(email_confirmed_at is not null),'oneEmailIdentity',(select count(*)=1 and bool_and(provider='email' and provider_id=user_id::text) from auth.identities where user_id='${owner.id}')) from auth.users where id='${owner.id}' and email='${owner.email}';`);
   assertEqual(f,{sameUuid:true,confirmed:true,oneEmailIdentity:true},'AUTH197_RECONSTRUCTION');
  }
  const tables=['sessions','refresh_tokens','one_time_tokens','flow_state','mfa_factors','webauthn_credentials','mfa_recovery_code_sets','mfa_recovery_codes'];
  for(const table of tables)assert.equal(await target.sql('select count(*) from auth.'+table+';'),'0');
  assert.ok(restored.application.every(t=>['public','ingestion'].includes(t.schema)));
  observations.push({boundary:count,identityWitnessVersion:restored.identity.authVersion,independentIdentityChecks:true,emptyTargetAuthorityTables:tables,importedAuthCredentialRows:0});
 });
}

export async function afterRecovery({source,target,count,owner,fresh,record}) {
 record=boundaryRecord(count,record);
 let probe;
 try {
  await record('auth197SourcePasswordAndSessionPositiveControls',async()=>{
   const signed=await signIn(source,owner);assert.equal(signed.user.id,owner.id);
   const original=claims(owner.session.access_token).session_id;
   assert.equal(await source.sql(`select count(*) from auth.sessions where id='${original}' and user_id='${owner.id}';`),'1');
   assert.equal(await target.sql(`select count(*) from auth.sessions where id='${original}';`),'0');
  });
  await record('auth197StrictRecoveryPasswordUpdateAndSessionCleanup',async()=>{
   probe=await adminCreate(target,{password:strong()});
   const mail=await target.recovery(probe);const recovery=response(await target.api('/verify',{method:'POST',body:{type:'recovery',token_hash:mail.hash}}));
   assert.equal(recovery.user.id,probe.id);
   const weak=await target.api('/user',{method:'PUT',bearer:recovery.access_token,body:{password:'Ab1!'}});rejected(weak);assert.equal(weak.body?.error_code,'weak_password');
   const password=strong();response(await target.api('/user',{method:'PUT',bearer:recovery.access_token,body:{password}}));probe.password=password;
   rejected(await target.api('/verify',{method:'POST',body:{type:'recovery',token_hash:mail.hash}}));
   response(await target.api('/logout?scope=local',{method:'POST',bearer:recovery.access_token}),204);
   const session=claims(recovery.access_token).session_id;
   assert.equal(await target.sql(`select count(*) from auth.sessions where id='${session}';`),'0');
   rejected(await target.api('/token?grant_type=refresh_token',{method:'POST',body:{refresh_token:recovery.refresh_token}}));
   assert.equal((await signIn(target,probe)).user.id,probe.id);
  });
  await recentProofChecks(target,probe,record);
  await record('auth197RealConfiguredExpiryRejectsRecoveryHashAndNumericOtp',async()=>{
   await target.expiry(2);assertService(response(await target.api('/health')).version);
   const pending=response(await target.api('/admin/generate_link',{method:'POST',bearer:target.admin(),body:{type:'recovery',email:probe.email}}));
   const expiry=await sqlJson(target,`select jsonb_build_object('freshSentAt',recovery_sent_at>now()-interval '2 seconds','pending',recovery_token<>'','newExpiryColumnNull',(select bool_and(expires_at is null) from auth.one_time_tokens where user_id='${probe.id}')) from auth.users where id='${probe.id}';`);
   assert.equal(expiry.freshSentAt,true);assert.equal(expiry.pending,true);assert.equal(expiry.newExpiryColumnNull,true);
   await delay(3200);
   const h=await target.api('/verify',{method:'POST',body:{type:'recovery',token_hash:pending.hashed_token}});
   const n=await target.api('/verify',{method:'POST',body:{type:'recovery',email:probe.email,token:pending.email_otp}});
   rejected(h);rejected(n);assert.equal(h.body?.error_code,'otp_expired');assert.equal(n.body?.error_code,'otp_expired');
   await target.expiry(3600);
   const live=await target.recovery(probe);assert.equal(response(await target.api('/verify',{method:'POST',body:{type:'recovery',token_hash:live.hash}})).user.id,probe.id);
   observations.push({boundary:count,tokenExpirySecondsTested:2,expiredHashRejected:true,expiredNumericOtpRejected:true,newExpiresAtColumnPopulated:false,subsequentLiveRecoveryAccepted:true});
  });
  await record('auth197MandatoryAal2PolicyFailsClosedAndSchemaDriftIsRejected',async()=>{
   let created=false;
   try {
    await target.sql(`create policy auth197_require_aal2 on public.profiles as restrictive for select to authenticated using ((select auth.jwt()->>'aal')='aal2');`);created=true;
    assertEqual(response(await target.rest('/profiles?select=id',{bearer:fresh.access_token})),[],'AUTH197_REQUIRED_AAL2_DENIAL');
    await assert.rejects(()=>capture(source,count,{reference:target}),/TRUSTED_SCHEMA_MISMATCH/);
   } finally {if(created)await target.sql('drop policy auth197_require_aal2 on public.profiles;');}
   assert.equal(response(await target.rest('/profiles?select=id',{bearer:fresh.access_token})).length,1);
  });
 } finally {if(probe)await adminDelete(target,probe);}
}


// Optional feature availability is enabled only in the disposable regression
// environment. Enrolled factors still make the accepted profile fail closed.
export class AuthRegressionEnvironment extends RestrictedEnvironment {
 authEnvironment() {
  return {...super.authEnvironment(),GOTRUE_MFA_RECOVERY_CODES_ENROLL_ENABLED:'true',GOTRUE_MFA_RECOVERY_CODES_VERIFY_ENABLED:'true'};
 }
}

async function recentProofChecks(environment,probe,record) {
 let primary,original,proof,temporary;
 const secret=randomBytes(48).toString('base64url'),now=Math.floor(Date.now()/1000);
 await record('auth197RecentProofRealPasswordSessionClaims',async()=>{
  primary=await signIn(environment,probe);original=claims(primary.access_token);
  assert.equal(original.sub,probe.id);assert.equal(original.aal,'aal1');assert.ok(original.amr.some(x=>x.method==='password'));
  assert.equal(await environment.sql(`select count(*) from auth.mfa_amr_claims where session_id='${original.session_id}' and authentication_method='password';`),'1');
 });
 await record('auth197RecentProofWrongPasswordRejected',async()=>{
  const r=await environment.api('/token?grant_type=password',{method:'POST',body:{email:probe.email,password:fixturePassword()}});
  assert.equal(r.status,400);assert.equal(r.body.error_code,'invalid_credentials');
 });
 await record('auth197RecentProofTemporarySessionCleanupPreservesPrimary',async()=>{
  temporary=await signIn(environment,probe);const temp=claims(temporary.access_token);
  assert.equal(temp.sub,original.sub);assert.notEqual(temp.session_id,original.session_id);
  response(await environment.api('/logout?scope=local',{method:'POST',bearer:temporary.access_token}),204);
  assert.equal(await environment.sql(`select count(*) from auth.sessions where id='${temp.session_id}';`),'0');
  assert.equal(response(await environment.api('/user',{bearer:primary.access_token})).id,probe.id);
  rejected(await environment.api('/token?grant_type=refresh_token',{method:'POST',body:{refresh_token:temporary.refresh_token}}));
 });
 await record('auth197RecentProofActualClaimBindingAndExpiry',async()=>{
  // Construct an independent expected receipt from actual provider claims.
  // Check issuance against it, then exercise verification with that receipt.
  // No password or provider credential enters this session-bound HMAC input.
  const payload={v:1,sub:original.sub,sid:original.session_id,iat:now,exp:now+600};
  const authenticatedValue='v1.'+Buffer.from(JSON.stringify(payload)).toString('base64url');
  proof=authenticatedValue+'.'+createHmac('sha256',secret).update(authenticatedValue).digest('base64url');
  assert.equal(issueRecentPasswordAuthProof({nowSeconds:now,secret,sessionId:original.session_id,userId:original.sub}),proof);
  const verify=(sessionId,userId,at=now)=>verifyRecentPasswordAuthProof({currentSessionId:sessionId,currentUserId:userId,nowSeconds:at,proof,secret});
  assert.equal(verify(original.session_id,original.sub).status,'valid');
  assert.equal(verify(randomUUID(),original.sub).reason,'session_mismatch');assert.equal(verify(original.session_id,randomUUID()).reason,'user_mismatch');
  assert.equal(verify(original.session_id,original.sub,now+599).status,'valid');assert.equal(verify(original.session_id,original.sub,now+600).reason,'expired');
  assert.equal(verifyRecentPasswordAuthProof({currentSessionId:original.session_id,currentUserId:original.sub,nowSeconds:now,proof:proof.slice(0,-1)+'!',secret}).status,'invalid');
 });
 await record('auth197RecentProofNewRealSessionCannotReuseOldProof',async()=>{
  const next=await signIn(environment,probe),nextClaims=claims(next.access_token);
  assert.equal(verifyRecentPasswordAuthProof({currentSessionId:nextClaims.session_id,currentUserId:nextClaims.sub,nowSeconds:now,proof,secret}).reason,'session_mismatch');
 });
}
