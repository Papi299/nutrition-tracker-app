import { createHash, createHmac } from 'node:crypto';
import { readFileSync } from 'node:fs';

export const BASE = '18cbb050244fc14ae9f0cc2def46e21e1072b779';
export const CONTRACT = 'nutrition-002e1-local-auth-compatibility/v1';
export const AUTH_IMAGE = 'docker.io/supabase/gotrue@sha256:c0c25187a6b835e65a6f6e6c6b39d090e832d40e6de5186f2c038e0411944232';
export const DB_IMAGE = 'docker.io/supabase/postgres@sha256:28f0e16a019e648089fc1a6d333549a55548f6019c15ae4bd7cd58b989027518';
export const REST_IMAGE = 'docker.io/postgrest/postgrest@sha256:5922bde07147b82b1c9d8f749e48c1e5b99ebb233f3888bb7ab65f07cf4ac82d';
export const CLIENT_IMAGE = 'docker.io/library/node@sha256:de170b39439eb0e5a3444ad7d60b015614a381e10fecae2e30ec9e735122f38d';
export const AUTH_VERSION = 'v2.196.0';
export const AUTH_BOUNDARY = '20260625000000';
export const DURABLE = Object.freeze(['users','identities','mfa_factors','webauthn_credentials']);
export const root = new URL('../../',import.meta.url);
export const hash = bytes => createHash('sha256').update(bytes).digest('hex');
export const canonical = value => JSON.stringify(value);
export function fail(code) { throw new Error('N002E1_'+code); }
export function assertEqual(actual,expected,code) { if(canonical(actual)!==canonical(expected)) fail(code); }
export function identifier(name) { if(typeof name!=='string'||/\s/.test(name)||!/^[a-z_][a-z0-9_]*$/.test(name)) fail('IDENTIFIER');return '"'+name+'"'; }
export function assertUuid(value) { if(typeof value!=='string'||value.length!==36||!/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(value)) fail('UUID');return value; }
export function token(secret,claims) {
 const head=Buffer.from(JSON.stringify({alg:'HS256',typ:'JWT'})).toString('base64url');
 const body=Buffer.from(JSON.stringify({...claims,exp:Math.floor(Date.now()/1000)+1800})).toString('base64url');
 return head+'.'+body+'.'+createHmac('sha256',secret).update(head+'.'+body).digest('base64url');
}
export function totp(secret) {
 let bits='';for(const c of secret.toUpperCase().replace(/=+$/,'')){const n='ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'.indexOf(c);if(n<0)fail('TOTP_ENCODING');bits+=n.toString(2).padStart(5,'0');}
 const key=Buffer.from(bits.match(/.{8}/g).map(b=>parseInt(b,2)));
 const time=Buffer.alloc(8);time.writeBigUInt64BE(BigInt(Math.floor(Date.now()/30000)));
 const h=createHmac('sha1',key).update(time).digest();const offset=h[19]&15;
 return ((h.readUInt32BE(offset)&0x7fffffff)%1000000).toString().padStart(6,'0');
}
export function claims(jwt) {try{return JSON.parse(Buffer.from(jwt.split('.')[1],'base64url'));}catch{fail('JWT_FORMAT');}}
export function assertSchema(actual,expected) {assertEqual(actual,expected,'SCHEMA_MISMATCH');}
export function assertService(version) {assertEqual(version,AUTH_VERSION,'VERSION_MISMATCH');}
export function assertRecoveryEligibility() {fail('FULL_RECOVERY_UNQUALIFIED');}
export function implementationDigest() {
 const paths=['contract.mjs','local.mjs','inventory.sql','qualify-local.mjs','contracts.test.mjs'].map(p=>'scripts/nutrition-002e1/'+p);
 paths.push('ops/recovery/nutrition-002e1/upstream-sources.json','ops/recovery/nutrition-002e1/contract-v1.json',
  'ops/recovery/nutrition-002e1/auth-inventory.json','scripts/phase-11i-migration-inventory.mjs',
  'ops/recovery/nutrition-migration-inventory.json','supabase/config.toml','package-lock.json',
  'scripts/nutrition-002c/local-postgres.mjs','scripts/nutrition-002e/inventory.sql',
  'ops/recovery/nutrition-002e/inventory-44.json','ops/recovery/nutrition-002e/inventory-45.json',
  '.github/workflows/nutrition-002e1-local.yml','scripts/check-workflow-security.mjs',
  'scripts/check-workflow-security.test.mjs','lib/nutrition-snapshots/manifest.ts');
 return hash(canonical(paths.map(path=>({path,sha256:hash(readFileSync(new URL(path,root)))}))));
}
