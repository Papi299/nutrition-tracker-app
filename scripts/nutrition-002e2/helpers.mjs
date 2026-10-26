// Bounded fixture helpers retained from the reviewed 002E1 experiment; no
// operational pipeline integration or additional table-selection authority.
import { randomBytes } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { run } from '../nutrition-002e1/local.mjs';
import { root, hash, assertEqual, assertUuid, identifier, claims, totp, DURABLE, fail } from '../nutrition-002e1/contract.mjs';
import { MIGRATION_INVENTORY } from '../phase-11i-migration-inventory.mjs';
const read=p=>readFileSync(new URL(p,root),'utf8');
const inventorySql=read('scripts/nutrition-002e1/inventory.sql');
export function requireStatus(r,expected,code) {if(r.status!==expected)fail(code+'_HTTP_'+r.status);return r.body;}
export async function denied(r,code) {if(r.status<400)fail(code);}
export async function inventory(e) {return JSON.parse(await e.sql(inventorySql));}
export async function replay(e,from,to) {
 for(const m of MIGRATION_INVENTORY.slice(from,to)) {
  const bytes=read('supabase/migrations/'+m.filename);assertEqual(hash(bytes),m.sha256,'MIGRATION_HASH');
  const source=to===44?'2617a6012d743e3196c7c2618e4ea46cbfe5c600':'50716d3759e9b75c66fe98b9c483ebb10c28b531';
  assertEqual(await run('git',['rev-parse',source+':supabase/migrations/'+m.filename]),await run('git',['hash-object','supabase/migrations/'+m.filename]),'MIGRATION_BLOB');
  await e.sql('set role postgres;\n'+bytes);
 }
}
export async function account(e,email) {
 const password=randomBytes(32).toString('base64url');
 const invite=requireStatus(await e.api('/admin/generate_link',{method:'POST',bearer:e.admin(),body:{type:'invite',email}}),200,'INVITE');
 const session=requireStatus(await e.api('/verify',{method:'POST',body:{type:'invite',token_hash:invite.hashed_token}}),200,'INVITE_VERIFY');
 assertEqual(session.user.id,invite.id,'INVITE_UUID');assertUuid(invite.id);
 requireStatus(await e.api('/user',{method:'PUT',bearer:session.access_token,body:{password}}),200,'PASSWORD_SET');
 const login=requireStatus(await e.api('/token?grant_type=password',{method:'POST',body:{email,password}}),200,'PASSWORD_LOGIN');
 assertEqual(login.user.id,invite.id,'LOGIN_UUID');
 return {email,password,id:invite.id,session:login};
}
export async function login(e,user) {const s=requireStatus(await e.api('/token?grant_type=password',{method:'POST',body:{email:user.email,password:user.password}}),200,'PASSWORD_LOGIN');assertEqual(s.user.id,user.id,'RESTORED_UUID');return s;}
export async function verifyFactor(e,user,session) {
 const challenge=requireStatus(await e.api('/factors/'+user.factor+'/challenge',{method:'POST',bearer:session.access_token,body:{}}),200,'FACTOR_CHALLENGE');
 const verified=requireStatus(await e.api('/factors/'+user.factor+'/verify',{method:'POST',bearer:session.access_token,body:{challenge_id:challenge.id,code:totp(user.totpSecret)}}),200,'FACTOR_VERIFY');
 assertEqual(claims(verified.access_token).aal,'aal2','FACTOR_AAL');return verified;
}
export async function activate(e,session) {return requireStatus(await e.rest('/rpc/complete_invited_account_activation',{method:'POST',bearer:session.access_token,body:{p_age_18_attested:true,p_israel_attested:true}}),200,'APP_ACTIVATE');}
export async function compareApp(e,count) {
 const sql=read('scripts/nutrition-002e/inventory.sql');
 const observed=JSON.parse(await e.sql(sql)).filter(t=>!t.table.startsWith('auth.'));
 const expected=JSON.parse(read(`ops/recovery/nutrition-002e/inventory-${count}.json`)).filter(t=>!t.table.startsWith('auth.'));
 assertEqual(observed,expected,'APPLICATION_METADATA_'+count);
}
export async function copyDurable(source,target,metadata) {
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
