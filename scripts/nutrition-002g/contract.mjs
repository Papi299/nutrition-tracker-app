import { createHash, createHmac, verify } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
export const root = new URL('../../', import.meta.url);
export const CONTRACT = 'nutrition-002g-local-recovery/v1';
export const AUTH_VERSION = 'v2.197.0';
export const AUTH_IMAGE = 'docker.io/supabase/gotrue@sha256:1736a63078f5922b198c4cbe50f80ab9a2d3b54fe8b7b6cfb2e9dc5dbbc12c6b';
export const DB_IMAGE = 'docker.io/supabase/postgres@sha256:28f0e16a019e648089fc1a6d333549a55548f6019c15ae4bd7cd58b989027518';
export const REST_IMAGE = 'docker.io/postgrest/postgrest@sha256:5922bde07147b82b1c9d8f749e48c1e5b99ebb233f3888bb7ab65f07cf4ac82d';
export const CLIENT_IMAGE = 'docker.io/library/node@sha256:de170b39439eb0e5a3444ad7d60b015614a381e10fecae2e30ec9e735122f38d';
export const hash = bytes => createHash('sha256').update(bytes).digest('hex');
export function canonical(v) {
 const sorted=x=>Array.isArray(x)?x.map(sorted):x!==null&&typeof x==='object'?Object.fromEntries(Object.keys(x).sort().map(k=>[k,sorted(x[k])])):x;
 return JSON.stringify(sorted(v));
}
export function fail(code) { throw Error('N002G_' + code); }
export function assertEqual(a,b,code) { if(canonical(a)!==canonical(b))fail(code); }
export function assertService(version) { assertEqual(version,AUTH_VERSION,'AUTH_VERSION'); }
export function identifier(v) { if(typeof v!=='string'||!/^[a-z_][a-z0-9_]{0,62}$/.test(v))fail('IDENTIFIER');return '"'+v+'"'; }
export function literal(v) { if(typeof v!=='string'||v.includes('\0'))fail('LITERAL');return "'"+v.replaceAll("'","''")+"'"; }
export function assertUuid(v) { if(typeof v!=='string'||!/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(v))fail('UUID');return v; }
export function token(secret,claims) {
 const h=Buffer.from(JSON.stringify({alg:'HS256',typ:'JWT'})).toString('base64url');
 const b=Buffer.from(JSON.stringify({...claims,exp:Math.floor(Date.now()/1000)+1800})).toString('base64url');
 return h+'.'+b+'.'+createHmac('sha256',secret).update(h+'.'+b).digest('base64url');
}
export const inventory=JSON.parse(readFileSync(new URL('ops/recovery/nutrition-002g-migrations.json',root)));
export function boundary(count) { if(![44,45].includes(count))fail('BOUNDARY');return inventory.slice(0,count); }
export function assertCheckout() {
 assertEqual(readdirSync(new URL('supabase/migrations',root)).filter(f=>f.endsWith('.sql')).sort(),inventory.map(m=>m.filename),'MIGRATION_INVENTORY');
 for(const m of inventory)assertEqual(hash(readFileSync(new URL('supabase/migrations/'+m.filename,root))),m.sha256,'MIGRATION_BYTES');
}
export function validateIdentity(w) {
 if(!w||w.profile!=='VERIFIED_EMAIL_NO_FACTORS_V1'||w.authVersion!==AUTH_VERSION||!Array.isArray(w.owners)||!w.owners.length)fail('IDENTITY_PROFILE');
 for(const o of w.owners) {
  const keys=['id','email','confirmed','deleted','banned','anonymous','phone','factors','passkeys','identities','provider','subject','unsupported'].sort();
  assertEqual(Object.keys(o).sort(),keys,'IDENTITY_FIELD_INVENTORY');
  assertUuid(o.id);
  if(typeof o.email!=='string'||!o.email.includes('@')||o.confirmed!==true||o.deleted!==false||o.banned!==false||o.anonymous!==false||o.phone!==''||o.factors!==0||o.passkeys!==0||o.identities!==1||o.provider!=='email'||o.subject!==o.id||o.unsupported!==0)fail('UNSUPPORTED_AUTH_STATE');
 }
 if(new Set(w.owners.map(o=>o.id)).size!==w.owners.length||new Set(w.owners.map(o=>o.email)).size!==w.owners.length)fail('DUPLICATE_IDENTITY');
}
export function approveIdentity(payload,approval,artifactSha256,operatorPublicKey,targetInstance) {
 validateIdentity(payload.identity);
 if(!approval||approval.targetInstance!==targetInstance||!targetInstance||approval.artifactSha256!==artifactSha256||approval.identitySha256!==hash(canonical(payload.identity))||approval.independentOwnerVerification!=='PREINCIDENT_OPERATOR_AND_RECOVERY_CHANNEL_VERIFIED'||approval.targetIsolated!==true)fail('OWNER_VERIFICATION_REQUIRED');
 const {signature,...statement}=approval;
 if(typeof signature!=='string'||!operatorPublicKey||!verify(null,Buffer.from(canonical(statement)),operatorPublicKey,Buffer.from(signature,'base64url')))fail('OPERATOR_SIGNATURE');
}
export function validatePayload(p,expected) {
 if(!p||p.contract!==CONTRACT||p.scope!=='LOCAL_SYNTHETIC_ONLY'||p.source!==expected.source||p.boundary!==expected.boundary||!p.capturedAt||!Array.isArray(p.application)||p.application.length!==61||typeof p.schema!=='string'||typeof p.roles!=='string')fail('PAYLOAD_BINDING');
 assertEqual(p.migrations,boundary(expected.boundary).map(m=>m.version),'LEDGER');validateIdentity(p.identity);
 const names=p.application.map(t=>t.schema+'.'+t.name);
 if(new Set(names).size!==61||p.application.filter(t=>t.schema==='public').length!==20||p.application.filter(t=>t.schema==='ingestion').length!==41)fail('TABLE_INVENTORY');
 for(const t of p.application) {
  if(!['public','ingestion'].includes(t.schema)||!Array.isArray(t.rows)||!Array.isArray(t.columns)||!t.columns.length)fail('TABLE_SHAPE');
  identifier(t.name);t.columns.forEach(identifier);
  if(new Set(t.columns).size!==t.columns.length||t.rows.some(r=>typeof r!=='string'))fail('ROW_SHAPE');
 }
}
