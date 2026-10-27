import { fixturePassword, fixturePasswordPolicy } from './password-fixture.mjs';
import './check-sarif.test.mjs';
import { generateKeyPairSync, sign } from 'node:crypto';
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { boundary, assertCheckout, canonical, validateIdentity, validatePayload, approveIdentity, hash, CONTRACT, AUTH_VERSION, AUTH_IMAGE, assertService, root } from './contract.mjs';

const witness=()=>({profile:'VERIFIED_EMAIL_NO_FACTORS_V1',authVersion:AUTH_VERSION,owners:[{id:'11000000-0000-4000-8000-000000000001',email:'owner@example.invalid',confirmed:true,deleted:false,banned:false,anonymous:false,phone:'',factors:0,passkeys:0,identities:1,provider:'email',subject:'11000000-0000-4000-8000-000000000001',unsupported:0}]});
test('only complete trusted 44/45 inventories are accepted',()=>{
 assertCheckout();assert.equal(boundary(44).at(-1).version,'20260927170418');assert.equal(boundary(45).at(-1).sha256,'d77cb58ae09a057892842fdc7fe0f6694be1948aafaf67ff2ee2d0f5d976dfbc');
 for(const n of [0,43,46,'44',null])assert.throws(()=>boundary(n),/N002G_BOUNDARY/);
});
test('every enabled unsupported durable authentication method blocks fresh reconstruction',()=>{
 validateIdentity(witness());
 for(const change of [{factors:1},{passkeys:1},{provider:'google'},{unsupported:1},{phone:'+15550000000'},{anonymous:true},{confirmed:false},{banned:true},{deleted:true},{identities:2},{subject:'wrong-owner'},{deleted:undefined},{banned:null},{confirmed:'true'},{anonymous:undefined}]) {
  const w=witness();Object.assign(w.owners[0],change);assert.throws(()=>validateIdentity(w),/N002G_UNSUPPORTED_AUTH_STATE/);
 }
 const extra=witness();extra.owners[0].unknownDurableFactor=true;assert.throws(()=>validateIdentity(extra),/IDENTITY_FIELD_INVENTORY/);
 const w=witness();w.authVersion='v9.0.0';assert.throws(()=>validateIdentity(w),/N002G_IDENTITY_PROFILE/);
});
test('owner authorization binds independently to both artifact and identity witness',()=>{
 const operator=generateKeyPairSync('ed25519'),target='isolated-target';
 const p={identity:witness()},sha='a'.repeat(64),statement={targetInstance:target,artifactSha256:sha,identitySha256:hash(canonical(p.identity)),independentOwnerVerification:'PREINCIDENT_OPERATOR_AND_RECOVERY_CHANNEL_VERIFIED',targetIsolated:true};
 const approval={...statement,signature:sign(null,Buffer.from(canonical(statement)),operator.privateKey).toString('base64url')};
 approveIdentity(p,approval,sha,operator.publicKey,target);
 for(const change of [{artifactSha256:'b'.repeat(64)},{identitySha256:'b'.repeat(64)},{independentOwnerVerification:'EMAIL_MATCH_ONLY'},{targetIsolated:false}])assert.throws(()=>approveIdentity(p,{...approval,...change},sha,operator.publicKey,target),/OWNER_VERIFICATION_REQUIRED/);
 assert.throws(()=>approveIdentity(p,{...approval,signature:'forged'},sha,operator.publicKey,target),/OPERATOR_SIGNATURE/);
 assert.throws(()=>approveIdentity(p,approval,sha,generateKeyPairSync('ed25519').publicKey,target),/OPERATOR_SIGNATURE/);
 assert.throws(()=>approveIdentity(p,null,sha,operator.publicKey,target),/OWNER_VERIFICATION_REQUIRED/);
});
test('unsupported versions, missing data members and migration fallback are rejected',()=>{
 const p={contract:CONTRACT,scope:'LOCAL_SYNTHETIC_ONLY',source:'nutrition-002g-source',boundary:44,capturedAt:new Date().toISOString(),migrations:boundary(44).map(m=>m.version),roles:'[]',schema:'trusted',identity:witness(),application:Array.from({length:61},(_,i)=>({schema:i<20?'public':'ingestion',name:'t'+i,columns:['id'],rows:['{"id":1.234567890123456789}']}))};
 const expected={source:p.source,boundary:44};validatePayload(p,expected);
 for(const change of [{contract:'v2'},{scope:'Production'},{boundary:45},{source:'wrong'},{application:p.application.slice(1)},{identity:undefined},{schema:undefined},{migrations:boundary(45).map(m=>m.version)}])assert.throws(()=>validatePayload({...p,...change},expected));
 assert.ok(canonical(p).includes('1.234567890123456789'));
});
test('original Production backup producer and schedule remain byte identical',()=>{
 for(const path of ['.github/workflows/phase-11i-production-backup.yml','scripts/phase-11i-backup-pipeline.mjs','scripts/phase-11i-restore-pipeline.mjs','scripts/phase-11i-recovery-contract.mjs','scripts/run-phase-11i-scheduled-backup.mjs','ops/recovery/phase-11i-recipient.pem','lib/nutrition-snapshots/manifest.ts','supabase/config.toml','package-lock.json']) {
  const baseline=spawnSync('git',['show','50716d3759e9b75c66fe98b9c483ebb10c28b531:'+path]);assert.equal(baseline.status,0);assert.equal(hash(readFileSync(new URL(path,root))),hash(baseline.stdout),path);
 }
});
test('new workflow guard rejects schedule, write token, mutable image and skipped security',()=>{
 const path=new URL('.github/workflows/nutrition-002g-local.yml',root),workflow=readFileSync(path,'utf8'),dir=mkdtempSync(join(tmpdir(),'nutrition-002g-policy-'));
 try {
  mkdirSync(join(dir,'.github/workflows'),{recursive:true});
  for(const name of ['ci.yml','phase-11i-production-backup.yml','nutrition-002i-local.yml','nutrition-002k-local.yml','nutrition-002l-b1e-local.yml'])writeFileSync(join(dir,'.github/workflows',name),readFileSync(new URL('.github/workflows/'+name,root)));
  for(const change of [workflow,workflow.replace('  pull_request:','  schedule:'),workflow.replace('contents: read','contents: write'),workflow.replace('upload: never','upload: always'),workflow.replace('@sha256:','@mutable:')]) {
   writeFileSync(join(dir,'.github/workflows/nutrition-002g-local.yml'),change);
   const r=spawnSync(process.execPath,[new URL('../check-workflow-security.mjs',import.meta.url).pathname],{cwd:dir});
   assert.equal(r.status===0,change===workflow);
  }
 }finally{rmSync(dir,{recursive:true,force:true});}
});


test('Auth 197 exact binding rejects the historical version and mutable fallback',()=>{
 assert.equal(AUTH_VERSION,'v2.197.0');assertService(AUTH_VERSION);
 assert.throws(()=>assertService('v2.196.0'),/AUTH_VERSION/);
 assert.equal(AUTH_IMAGE,'docker.io/supabase/gotrue@sha256:1736a63078f5922b198c4cbe50f80ab9a2d3b54fe8b7b6cfb2e9dc5dbbc12c6b');
 const w=witness();w.authVersion='v2.196.0';assert.throws(()=>validateIdentity(w),/IDENTITY_PROFILE/);
 for(const name of ['nutrition-002g-local.yml','nutrition-002i-local.yml','nutrition-002k-local.yml','nutrition-002l-b1e-local.yml'])
  assert.ok(readFileSync(new URL('.github/workflows/'+name,root),'utf8').includes('docker pull '+AUTH_IMAGE));
});
test('fixture passwords always satisfy the strict policy while retaining fresh randomness',()=>{
 assert.equal(fixturePasswordPolicy.minimumLength,12);
 const values=new Set();
 for(let i=0;i<64;i++) {
  const value=fixturePassword();assert.ok(value.length>=fixturePasswordPolicy.minimumLength&&value.length<=72);
  for(const pattern of [/[a-z]/,/[A-Z]/,/[0-9]/,/[!@#$%^&*()_+\-=[\]{};]/])assert.match(value,pattern);
  values.add(value);
 }
 assert.equal(values.size,64);
});
