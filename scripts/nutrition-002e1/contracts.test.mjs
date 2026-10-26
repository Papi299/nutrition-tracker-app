import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { AUTH_VERSION, AUTH_BOUNDARY, DURABLE, root, assertService, assertSchema, assertRecoveryEligibility,
 assertUuid, identifier, token, claims } from './contract.mjs';
import { Environment, LABEL, assertOwnedContainer } from './local.mjs';

const metadata=JSON.parse(readFileSync(new URL('ops/recovery/nutrition-002e1/auth-inventory.json',root)));
test('real provider proposal preserves every durable prerequisite and refuses operational recovery',()=>{
 assert.equal(metadata.migrations.at(-1),AUTH_BOUNDARY);
 for(const table of DURABLE)assert.ok(metadata.tables.some(t=>t.name===table));
 assert.throws(()=>assertRecoveryEligibility(),/FULL_RECOVERY_UNQUALIFIED/);
 const contract=JSON.parse(readFileSync(new URL('ops/recovery/nutrition-002e1/contract-v1.json',root)));
 assert.equal(contract.replacementFor002EContract,false);assert.equal(contract.durableScopeAccepted,false);
 assert.equal(contract.recoveryEligible,false);assert.equal(contract.additionalSpendDollars,0);
});
for(const version of ['v2.197.0','v2.195.0','2.196.0','latest',null,{},''])test('fixed service identity refuses '+JSON.stringify(version),()=>assert.throws(()=>assertService(version),/VERSION_MISMATCH/));
test('fixed accepted service identity',()=>assert.doesNotThrow(()=>assertService(AUTH_VERSION)));
for(const [name,mutate] of [
 ['wrong migration',v=>v.migrations.pop()],
 ['missing durable table',v=>v.tables=v.tables.filter(t=>t.name!=='webauthn_credentials')],
 ['missing password column',v=>{const t=v.tables.find(t=>t.name==='users');t.columns=t.columns.filter(c=>c.name!=='encrypted_password');}],
 ['unknown credential table',v=>v.tables.push({name:'unapproved_credentials'})],
 ['changed encryption column',v=>v.tables.find(t=>t.name==='mfa_factors').columns.find(c=>c.name==='secret').type='character varying(55)'],
 ['RLS disabled',v=>v.tables.find(t=>t.name==='users').rls=false],
 ['unexpected grant',v=>v.tables.find(t=>t.name==='users').acl='unapproved'],
 ['unknown index',v=>v.tables.find(t=>t.name==='identities').indexes.push({name:'unapproved'})],
])test('schema gate refuses '+name,()=>{const v=structuredClone(metadata);mutate(v);assert.throws(()=>assertSchema(v,metadata),/SCHEMA_MISMATCH/);});
test('resource identity rejects adoption, remote ports, changed image, network and mounts',()=>{
 const c={Id:'id',Config:{Image:'image',Labels:{'codex.task':LABEL}},HostConfig:{LogConfig:{Type:'none'},PortBindings:{'9999/tcp':[{HostIp:'127.0.0.1'}]}},Mounts:[],NetworkSettings:{Networks:{owned:{}}}};
 assert.doesNotThrow(()=>assertOwnedContainer(c,'id','image','owned'));
 for(const mutate of [v=>v.Id='other',v=>v.Config.Image='floating:latest',v=>v.Config.Labels={},v=>v.HostConfig.PortBindings['9999/tcp'][0].HostIp='0.0.0.0',v=>v.Mounts=[{Type:'bind'}],v=>v.NetworkSettings.Networks={other:{}}]) {
  const value=structuredClone(c);mutate(value);assert.throws(()=>assertOwnedContainer(value,'id','image','owned'),/RESOURCE_IDENTITY/);
 }
});
test('unapproved signup, passkey or provider config cannot be selected through restart',async()=>{
 const e=new Environment('target');
 for(const modes of [{GOTRUE_DISABLE_SIGNUP:'false'},{GOTRUE_PASSKEY_ENABLED:'true'},{GOTRUE_DB_DATABASE_URL:'remote'}])
  await assert.rejects(()=>e.restartAuth(modes),/UNAPPROVED_AUTH_SETTINGS/);
});
test('identifiers, side selectors and UUIDs reject injection and substitution shape',()=>{
 for(const value of ['auth.users','users;drop table users','x\n','x"',null])assert.throws(()=>identifier(value),/IDENTIFIER/);
 for(const value of ['remote','main',null])assert.throws(()=>new Environment(value),/SIDE/);
 for(const value of ['bad',null,'00000000-0000-0000-0000-000000000000;'])assert.throws(()=>assertUuid(value),/UUID/);
});
test('token decoder is diagnostic only; actual validators must authenticate signatures',()=>{
 const t=token('disposable-only',{sub:'synthetic',role:'authenticated'});
 assert.equal(claims(t).sub,'synthetic');assert.equal(claims(t).role,'authenticated');
 assert.throws(()=>assertRecoveryEligibility(claims(t)),/FULL_RECOVERY_UNQUALIFIED/);
});
