import assert from 'node:assert/strict';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { run, assertLocalDocker, waitUntil } from '../nutrition-002c/local-postgres.mjs';
import { catalogSql } from '../nutrition-002c1/local.mjs';
import { compareCatalogs, canonical } from '../nutrition-002c1/catalog.mjs';
import { MIGRATION_INVENTORY, assertRecoveryCheckout } from '../phase-11i-migration-inventory.mjs';
import { BASE, IMAGE, hash, securityFingerprint, validateInventory, implementationDigest } from './contract.mjs';

const output=process.argv[2], compile=process.argv[3]==='--compile-trusted-local-proposal';
if(!output?.startsWith('/') || existsSync(output) || process.argv.length!==(compile?4:3) || !process.version.startsWith('v22.')) throw new Error('N002E_RUNTIME_OR_OUTPUT');
const root=new URL('../../',import.meta.url), label='NUTRITION-DIARY-CORRECTNESS-002E';
const fail=code=>{throw new Error(code);};
const compiledInventories=[],cases=[],startedAt=new Date().toISOString(), profiles={};
let success=false,failure,initialDigest,caseDiagnostic,observedAuthTables;
const clusters=[];
// One fixed task-owned offline replay harness. No connection string, metadata
// selector, hosted adapter or independent operational authority is introduced.
class ReplayCluster {
  #id;
  constructor(side) { this.name='nutrition-002e-'+side; this.created=false; }
  async verify() {
    await assertLocalDocker();
    const list=JSON.parse(await run('docker',['inspect',this.name])), c=list[0];
    if(list.length!==1 || c.Id!==this.#id || c.Config.Image!==IMAGE || c.Config.Labels?.['codex.task']!==label ||
      c.HostConfig.NetworkMode!=='none' || Object.keys(c.HostConfig.PortBindings??{}).length ||
      !c.HostConfig.Tmpfs?.['/var/lib/postgresql/data'] || c.Mounts.some(m=>m.Type!=='tmpfs')) fail('N002E_LOCAL_IDENTITY');
  }
  async sql(input) {
    await this.verify();
    return run('docker',['exec','-i',this.#id,'psql','-XqAt','-v','ON_ERROR_STOP=1','-v','VERBOSITY=sqlstate','-U','supabase_admin','-d','postgres'],{input,timeoutMs:30000});
  }
  async start() {
    await assertLocalDocker();
    if(await run('docker',['ps','-a','--filter',`name=^/${this.name}$`,'--format','{{.Names}}'])) fail('N002E_PREEXISTING_REFUSED');
    this.#id=await run('docker',['run','-d','--pull=never','--name',this.name,'--label','codex.task='+label,'--network','none',
      '--tmpfs','/var/lib/postgresql/data:rw,size=512m','-e','POSTGRES_PASSWORD=local-disposable-only',IMAGE,
      'postgres','-D','/var/lib/postgresql/data','-c','listen_addresses=','-c','shared_preload_libraries='],{timeoutMs:30000});
    if(!/^[a-f0-9]{64}$/.test(this.#id)) fail('N002E_START_AMBIGUOUS');
    this.created=true;
    await waitUntil(async()=>{try{return (await run('docker',['logs',this.#id])).includes('PostgreSQL init process complete; ready for start up.') && await this.sql('select 1;')==='1';}catch{return false;}},60000);
    assert.equal(await this.sql('show server_version_num;'),'170006');
    assert.equal(await run('docker',['exec',this.#id,'pg_dump','--version']),'pg_dump (PostgreSQL) 17.6');
  }
  async stop() { if(this.created) {await this.verify();await run('docker',['rm','-f',this.#id]);this.created=false;} }
}
async function record(name,action) {
 const time=Date.now();
 try {await action();cases.push({name,result:'PASS',elapsedMs:Date.now()-time});}
 catch(e) {caseDiagnostic=/^N002[A-Z0-9_]+$/.test(e.message)?e.message:e.code??'ASSERTION_FAILED';cases.push({name,result:'FAIL',elapsedMs:Date.now()-time});throw new Error('N002E_CASE_FAILED');}
}
async function observe(cluster) {return JSON.parse(await cluster.sql(catalogSql()));}
async function replay(cluster,from,to) {
 for(const entry of MIGRATION_INVENTORY.slice(from,to)) {
  const bytes=readFileSync(new URL('supabase/migrations/'+entry.filename,root));assert.equal(hash(bytes),entry.sha256);
  const source=to===44?'2617a6012d743e3196c7c2618e4ea46cbfe5c600':'50716d3759e9b75c66fe98b9c483ebb10c28b531';
  assert.equal(await run('git',['rev-parse',source+':supabase/migrations/'+entry.filename]),await run('git',['hash-object','supabase/migrations/'+entry.filename]));
  await cluster.sql('set role postgres;\n'+bytes.toString('utf8'));
 }
}
try {
 assertRecoveryCheckout(fileURLToPath(new URL('supabase/migrations',root)));
 if(!compile) initialDigest=implementationDigest();
 const source=new ReplayCluster('source'),target=new ReplayCluster('target');clusters.push(source,target);
 await source.start();await target.start();
 await target.sql('create schema oid_churn;create table oid_churn.t(id integer);drop schema oid_churn cascade;create role oid_churn;drop role oid_churn;');
 for(const count of [44,45]) {
  let expected;
  await record('trusted'+count+'IndependentReplayAndInventory',async()=>{
   await replay(source,count===44?0:44,count);await replay(target,count===44?0:44,count);
   expected=await observe(source);compareCatalogs(expected,await observe(target));
   assert.notEqual(await source.sql("select 'public.profiles'::regclass::oid"),await target.sql("select 'public.profiles'::regclass::oid"));
   const sql=readFileSync(new URL('./inventory.sql',import.meta.url),'utf8');
   const observed=JSON.parse(await source.sql(sql));
   observedAuthTables=observed.map(t=>t.table).filter(t=>t.startsWith('auth.'));
   const tables=validateInventory(observed).tables;
   assert.equal(canonical(tables),canonical(validateInventory(JSON.parse(await target.sql(sql))).tables));
   const bytes=JSON.stringify(tables,null,2)+'\n';
   const inventoryPath=new URL(`ops/recovery/nutrition-002e/inventory-${count}.json`,root);
   profiles['migration'+count]={inventorySha256:hash(bytes),securitySections:securityFingerprint(expected),missingRequiredAuthTables:['auth.identities','auth.mfa_factors','auth.webauthn_credentials'],status:'PROPOSED_LOCAL_REPLAY_AUTH_BLOCKED'};
   if(compile) compiledInventories.push([inventoryPath,bytes]);
   else assert.equal(readFileSync(inventoryPath,'utf8'),bytes);
   assert.equal(tables.filter(t=>t.table.startsWith('public.')).length,20);
   assert.equal(tables.filter(t=>t.table.startsWith('ingestion.')).length,41);
   assert.equal(tables.filter(t=>t.table.startsWith('auth.')).length,1);
   assert.equal(await source.sql("select to_regclass('auth.webauthn_credentials') is null"),'t');
  });
  for(const [name,sql] of [
   ['extraTable','create table public.unapproved(id integer)'],
   ['columnPrecision','alter table public.diary_entries alter column protein_g type numeric(14,4)'],
   ['columnGrant','grant update(display_name) on public.profiles to anon with grant option'],
   ['functionGrant','grant execute on function public.complete_invited_account_activation(boolean,boolean) to anon'],
   ['definerOwner','alter function public.is_current_account_activated() owner to supabase_admin'],
   ['searchPath',"alter function public.is_current_account_activated() set search_path=public"],
   ['extraFunction',"create or replace function private.unapproved(p integer default 3) returns integer language sql as $$select p$$"],
   ['argumentDefault',`do $$declare definition text; begin
     select pg_get_functiondef('public.complete_invited_account_activation(boolean,boolean)'::regprocedure) into definition;
     if position('p_israel_attested boolean' in definition)=0 then raise exception 'fixture signature changed'; end if;
     execute replace(definition,'p_israel_attested boolean','p_israel_attested boolean DEFAULT false');
   end$$`],
   ['forceRls','alter table public.profiles force row level security'],
   ['definerMode','alter function public.is_current_account_activated() security definer'],
   ['tableGrant','grant insert on public.profiles to anon'],
   ['policy','alter policy "Users can select their own profile" on public.profiles using(true)'],
   ['rls','alter table public.profiles disable row level security'],
   ['defaultAcl','alter default privileges for role postgres in schema private grant execute on functions to anon'],
   ['triggerMode','alter table public.profiles disable trigger user'],
   ['roleMembership','grant authenticated to anon'],
   ['unknownSequence','create sequence public.unapproved'],
  ]) await record('actual'+count+'Reject'+name,async()=>{
   // Mutations roll back with the diagnostic transaction; only fixed trusted
   // fixture SQL runs. No observed/backup SQL is executed.
   const observed=JSON.parse(await target.sql('begin;'+sql+';'+catalogSql()));
   assert.throws(()=>compareCatalogs(expected,observed),/N002C1_/);
   compareCatalogs(expected,await observe(target));
  });
 }
 const path=new URL('ops/recovery/nutrition-002e/expected-profiles.json',root);
 const bytes=JSON.stringify(profiles,null,2)+'\n';
 if(compile) {for(const [path,data] of compiledInventories)writeFileSync(path,data,{flag:'wx'});writeFileSync(path,bytes,{flag:'wx'});}else assert.equal(readFileSync(path,'utf8'),bytes);
 success=true;
} catch(e) {failure=/^N002E_[A-Z_]+$/.test(e.message)?e.message:'LOCAL_REPLAY_FAILED';process.exitCode=1;}
finally {
 const cleanup=await Promise.allSettled(clusters.map(c=>c.stop()));
 let absent=false;try{absent=await run('docker',['ps','-a','--filter','label=codex.task='+label,'--format','{{.Names}}'])==='';}catch{}
 const cleanupConfirmed=cleanup.every(c=>c.status==='fulfilled')&&absent;
 if(!cleanupConfirmed)process.exitCode=1;
 let digest;try{digest=implementationDigest();if(initialDigest)assert.equal(digest,initialDigest);}catch{success=false;failure??='N002E_SOURCE_CHANGED_OR_DIGEST_UNAVAILABLE';process.exitCode=1;}
 const result={schemaVersion:'nutrition-002e-checkpoint1/v1',base:BASE,sourceCommit:await run('git',['rev-parse','HEAD']),
  implementationSha256:digest??null,startedAt,completedAt:new Date().toISOString(),node:process.version,image:IMAGE,
  result:success&&cleanupConfirmed?'PASS_CHECKPOINT1_RECOVERY_BLOCKED':'FAIL',failure:failure??null,caseDiagnostic:caseDiagnostic??null,observedAuthTables:observedAuthTables??[],cases,cleanupConfirmed,
  compileProposal:compile,actualAuthService:false,coherentCapture:false,encryptedRoundtrip:false,fullRowEquality:false,
  recoveryEligible:false,productionAccess:false};
 writeFileSync(output,JSON.stringify(result,null,2)+'\n',{mode:0o600,flag:'wx'});
 process.stdout.write(result.result+'\n');
}
