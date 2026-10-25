import assert from 'node:assert/strict';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { installFreshLocalOverlay, removeUnusedLocalOverlay, assertFreshState, FRESH_STATE_SQL, overlaySource } from './overlay.mjs';
import { Cluster, run, IMAGE, catalogSql, waitUntil } from './local.mjs';
import { observeLocalCatalog, compareCatalogs, canonical, hash, implementationDigest } from './catalog.mjs';
import { MIGRATION_INVENTORY, MIGRATION44_CAPSULE, assertRecoveryCheckout } from '../phase-11i-migration-inventory.mjs';
import { assertRedactedEvidence } from '../phase-11i-recovery-contract.mjs';

const output = process.argv[2];
if (!output?.startsWith('/') || existsSync(output) || process.argv.length !== 3 || !process.version.startsWith('v22.')) throw new Error('N002C1_RUNTIME_OR_OUTPUT_DENIED');
const root = fileURLToPath(new URL('../../', import.meta.url));
const source = new Cluster('source'), target = new Cluster('target');
const cases = [];
const startedAt = new Date().toISOString();
const sourceStartDigest = implementationDigest();
let success = false, failure;
async function record(name, action) {
  const start = Date.now();
  try { await action(); cases.push({name, result:'PASS', elapsedMs:Date.now()-start}); }
  catch (e) { cases.push({name, result:'FAIL', diagnostic:/^N002C1_[A-Z_]+$/.test(e.message) ? e.message : 'ASSERTION_OR_LOCAL_OPERATION_FAILED'}); throw e; }
}
async function replay(cluster, from, to) {
  for (const entry of MIGRATION_INVENTORY.slice(from,to)) {
    const bytes = readFileSync(new URL('../../supabase/migrations/'+entry.filename,import.meta.url));
    assert.equal(hash(bytes),entry.sha256);
    // Historical source is independently fixed, never selected by an artifact.
    if (to<=44) assert.equal(await run('git',['rev-parse',MIGRATION44_CAPSULE.source+':supabase/migrations/'+entry.filename]),await run('git',['hash-object','supabase/migrations/'+entry.filename]));
    await cluster.sql('set role postgres;\n'+bytes.toString('utf8'));
  }
}

async function rejectsCatalogMutation(name,sql) {
 await record(name,async()=>{
  const expected=await observeLocalCatalog(source);
  const mutated=JSON.parse(await target.sql('begin;'+sql+';'+catalogSql()));
  assert.throws(()=>compareCatalogs(expected,mutated),/N002C1_/);
  compareCatalogs(expected,await observeLocalCatalog(target));
 });
}
async function overlayCases(boundary) {
 const before=await observeLocalCatalog(source);
 await record('actual'+boundary+'FreshClosedOverlayAnd61Gates',async()=>{
  assert.equal((await installFreshLocalOverlay(source)).tableCoverage,61);
  await installFreshLocalOverlay(target);
  assert.notEqual(await source.sql("select oid from pg_roles where rolname='nutrition_recovery_owner';"),await target.sql("select oid from pg_roles where rolname='nutrition_recovery_owner';"));
  const after=await observeLocalCatalog(source);
  compareCatalogs(after,await observeLocalCatalog(target));
  for(const old of before.records.filter(r=>r.section==='relations')) {
   const actual=after.records.find(r=>r.section===old.section&&r.key===old.key);
   for(const field of ['owner','acl','relrowsecurity','relforcerowsecurity']) assert.equal(canonical(actual.value[field]),canonical(old.value[field]));
  }
  assert.equal(await source.sql("select count(*) from pg_trigger where tgname='nutrition002c_write_gate' and tgenabled='A' and tgtype=62 and tgfoid='recovery_ops.enforce_gate()'::regprocedure;"),'61');
  await assert.rejects(installFreshLocalOverlay(target),/N002C1_/);
 });
 if(boundary===45) {
  for(const [name,sql] of [
   ['missingOverlayObject','drop function recovery_ops.require_lock()'],
   ['extraOverlayObject','create table recovery_ops.unapproved(id integer)'],
   ['modifiedOverlayFunction',"create or replace function recovery_ops.enforce_gate() returns trigger language plpgsql security definer set search_path='' as $$begin return null;end$$"],
   ['wrongOverlayOwner','alter function recovery_ops.enforce_gate() owner to postgres'],
   ['broadOverlayExecute','grant execute on function recovery_ops.enforce_gate() to authenticated'],
   ['modifiedGateTrigger','alter table public.profiles disable trigger nutrition002c_write_gate'],
   ['missingGateTrigger','drop trigger nutrition002c_write_gate on public.profiles'],
   ['extraUnapprovedTrigger','create trigger unapproved before update on public.profiles for each row execute function public.set_updated_at()'],
  ]) await rejectsCatalogMutation(name,sql);
  for(const [name,sql] of [
   ['restoredOpenGateRejected','update recovery_ops.gate set closed=false'],
   ['restoredIdleAuthorityRejected',"update recovery_ops.control set state='IDLE'"],
   ['unexpectedAdmissionEpochRejected','update recovery_ops.control set epoch=1'],
   ['unsupportedOverlayVersionRejected',"alter table recovery_ops.control drop constraint control_overlay_version_check;update recovery_ops.control set overlay_version='unsupported'"],
  ]) await record(name,async()=>{
   const value=JSON.parse(await target.sql('begin;'+sql+';'+FRESH_STATE_SQL+'rollback;'));
   assert.throws(()=>assertFreshState(value),/N002C1_/);
  });
 }
 await record('actual'+boundary+'UnusedOverlayControlledRollback',async()=>{
  await removeUnusedLocalOverlay(source);await removeUnusedLocalOverlay(target);
  compareCatalogs(before,await observeLocalCatalog(source));
  compareCatalogs(before,await observeLocalCatalog(target));
  // A failing transaction after all overlay DDL must roll everything back.
  const failing=overlaySource().slice(0,-'commit;\n'.length)+'select 1/0;commit;';
  await assert.rejects(target.sql(failing),/N002C_/);
  assert.equal(await target.sql("select count(*) from pg_namespace where nspname='recovery_ops';select count(*) from pg_roles where rolname='nutrition_recovery_owner';"),'0\n0');
 });
}

try {
  assertRecoveryCheckout(resolve(root,'supabase/migrations'));
  await source.start(); await target.start();
  await target.sql('create schema oid_churn;'+Array.from({length:40},(_,i)=>`create table oid_churn.t${i}(id integer);`).join('')+'drop schema oid_churn cascade;create role discarded_oid;drop role discarded_oid;');
  await record('actual44MigrationsReplayAndCrossClusterCatalog',async()=>{
    await replay(source,0,44); await replay(target,0,44);
    const count = await source.sql("select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname in ('public','ingestion') and c.relkind='r';");
    assert.equal(count,'61');
    assert.notEqual(await source.sql("select 'public.profiles'::regclass::oid;"),await target.sql("select 'public.profiles'::regclass::oid;"));
    compareCatalogs(await observeLocalCatalog(source),await observeLocalCatalog(target));
  });
  await record('actual44NativeSchemaDumpRestore',async()=>{
    const before=await observeLocalCatalog(source), dump=await source.dump();
    await target.sql('drop schema public cascade;drop schema private cascade;drop schema ingestion cascade;');
    await target.sql(dump);
    // The image's initialized public schema grants PUBLIC USAGE. Native schema
    // dumps suppress that provider init-privilege baseline. Do not accept its
    // loss silently; reapply this one fixed local bootstrap grant as its owner.
    const restoredBeforeBaseline=await observeLocalCatalog(target);
    assert.throws(()=>compareCatalogs(before,restoredBeforeBaseline), /CATALOG_MISMATCH/);
    await target.sql('set role pg_database_owner;grant usage on schema public to public;');
    compareCatalogs(before,await observeLocalCatalog(target));
  });
  await overlayCases(44);
  await record('actual45MigrationsReplayAndCrossClusterCatalog',async()=>{
    await replay(source,44,45); await replay(target,44,45);
    compareCatalogs(await observeLocalCatalog(source),await observeLocalCatalog(target));
  });
  await record('actual45NativeSchemaDumpRestore',async()=>{
    const before=await observeLocalCatalog(source), dump=await source.dump();
    await target.sql('drop schema public cascade;drop schema private cascade;drop schema ingestion cascade;');
    await target.sql(dump);
    // The image's initialized public schema grants PUBLIC USAGE. Native schema
    // dumps suppress that provider init-privilege baseline. Do not accept its
    // loss silently; reapply this one fixed local bootstrap grant as its owner.
    const restoredBeforeBaseline=await observeLocalCatalog(target);
    assert.throws(()=>compareCatalogs(before,restoredBeforeBaseline), /CATALOG_MISMATCH/);
    await target.sql('set role pg_database_owner;grant usage on schema public to public;');
    compareCatalogs(before,await observeLocalCatalog(target));
  });
  for(const [name,sql] of [
   ['anonymousMutationGrant','grant insert on public.profiles to anon'],
   ['columnGrantOption','grant update(display_name) on public.profiles to anon with grant option'],
   ['anonymousFunctionExecute','grant execute on function public.complete_invited_account_activation(boolean,boolean) to anon'],
   ['changedDefinerOwner','alter function public.is_current_account_activated() owner to supabase_admin'],
   ['changedDefinerMode','alter function private.lock_readable_food_for_diary_create(uuid) security invoker'],
   ['changedFunctionSearchPath','alter function public.is_current_account_activated() set search_path=public'],
   ['missingFunctionGuard',"create or replace function public.is_current_account_activated() returns boolean language sql stable security invoker set search_path='' as $$ select true $$"],
   ['weakenedRlsPolicy','alter policy "Users can select their own profile" on public.profiles using(true)'],
   ['disabledRls','alter table public.profiles disable row level security'],
   ['constraintValidationDrift','alter table public.profiles drop constraint profiles_preferred_language_check;alter table public.profiles add constraint profiles_preferred_language_check check(preferred_language in(\'en\',\'he\')) not valid'],
   ['unexpectedDefaultExecute','alter default privileges for role postgres in schema private grant execute on functions to anon'],
   ['extraPrivilegedFunction',"create function private.unapproved() returns integer language sql security definer set search_path='' as $$select 1$$"],
   ['providerFunctionDrift',"create or replace function auth.uid() returns uuid language sql stable as $$select null::uuid$$"],
   ['databaseSettingDrift',"alter database postgres set statement_timeout='8s'"],
   ['roleAttributeDrift','alter role authenticated login'],
   ['roleMembershipDrift','grant authenticated to anon'],
   ['roleSettingDrift',"alter role authenticated set statement_timeout='7s'"],
   ['unsupportedApplicationSequence','create sequence public.unapproved'],
   ['unsupportedPartition','create table public.unapproved(id integer) partition by range(id)'],
   ['unmodeledNamespaceObject',"create collation public.unapproved(provider=icu,locale='und')"],
   ['extraUnapprovedSchema','create schema unapproved_schema'],
   ['parameterPrivilegeDrift','grant set on parameter log_min_messages to authenticated'],
   ['extraEventTrigger',"create function private.unapproved_ddl() returns event_trigger language plpgsql as $$begin end$$;create event trigger unapproved on ddl_command_end execute function private.unapproved_ddl()"],
   ['extensionSchemaDrift','alter extension pg_trgm set schema public'],
  ]) await rejectsCatalogMutation(name,sql);
  await overlayCases(45);
  await record('enumDomainVariadicAndViewOidMapping',async()=>{
   const ddl=`create type private.catalog_enum as enum('first','second');
    create domain private.catalog_domain as numeric check(value>=0);
    create table ingestion.catalog_probe(code private.catalog_enum,amount private.catalog_domain);
    alter table ingestion.catalog_probe enable row level security;
    create function private.catalog_probe(variadic codes private.catalog_enum[]) returns integer language sql security definer set search_path='' as $$select cardinality(codes)$$;
    create view public.catalog_probe with (security_invoker=true) as select * from ingestion.catalog_probe;`;
   try {
    await source.sql(ddl);await target.sql(ddl);
    assert.notEqual(await source.sql("select 'private.catalog_enum'::regtype::oid;"),await target.sql("select 'private.catalog_enum'::regtype::oid;"));
    compareCatalogs(await observeLocalCatalog(source),await observeLocalCatalog(target));
   }finally{
    const cleanup='drop view if exists public.catalog_probe;drop table if exists ingestion.catalog_probe;drop function if exists private.catalog_probe(private.catalog_enum[]);drop domain if exists private.catalog_domain;drop type if exists private.catalog_enum;';
    await Promise.allSettled([source.sql(cleanup),target.sql(cleanup)]);
   }
  });
  await record('liveDeparserAndActualDumpCannotCertifyHistoricalCatalog',async()=>{
   await source.sql("create function private.catalog_time_probe() returns integer language sql security definer set search_path='' as $$select 314159$$;");
   const process=source.process();
   // Retain one real exporter connection with stdin open. No token is printed.
   process.child.stdin.write("begin isolation level repeatable read read only;select pg_export_snapshot();\n");
   let buffered='';const lines=[];
   process.child.stdout.on('data',chunk=>{buffered+=chunk.toString();let pos;while((pos=buffered.indexOf('\n'))>=0){lines.push(buffered.slice(0,pos).trim());buffered=buffered.slice(pos+1);}});
   try {
    await waitUntil(()=>Promise.resolve(lines.length>0));const snapshot=lines.shift();
    // A private helper is replaced after snapshot export. The raw tuple read
    // under the imported snapshot and pg_dump's historical body are observed
    // independently of live function-definition helpers.
    await source.sql("create or replace function private.catalog_time_probe() returns integer language sql security definer set search_path='' as $$select 271828$$;");
    const dump=await source.dump(snapshot);
    assert.equal(dump.includes('select 314159'),true);assert.equal(dump.includes('select 271828'),false);
    const observed=await source.sql("begin isolation level repeatable read read only;set transaction snapshot '"+snapshot+"';select prosrc from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='private' and p.proname='catalog_time_probe';select pg_get_functiondef('private.catalog_time_probe()'::regprocedure);rollback;");
    assert.match(observed,/^select 314159\n/);assert.match(observed,/select 271828/);
   }finally{process.child.stdin.end('rollback;\n\\q\n');await process.result;await source.sql('drop function private.catalog_time_probe();');}
  });
  success=true;
} catch (e) {
  failure = /^N002C1_[A-Z_]+$/.test(e.message) ? e.message : 'LOCAL_QUALIFICATION_FAILED';
  process.stderr.write(failure+'\n');
  process.exitCode=1;
} finally {
  const cleanup=await Promise.allSettled([source.stop(),target.stop()]);
  const absent=await run('docker',['ps','-a','--filter','label=codex.task=NUTRITION-DIARY-CORRECTNESS-002C1','--format','{{.Names}}']);
  const cleanupConfirmed=cleanup.every(r=>r.status==='fulfilled') && absent==='';
  if (!cleanupConfirmed) process.exitCode=1;
  assert.equal(implementationDigest(),sourceStartDigest,'Source changed while qualification was running');
  const report={schemaVersion:'nutrition-002c1-local-qualification/v1',startedAt,completedAt:new Date().toISOString(),
    sourceCommit:await run('git',['rev-parse','HEAD']),implementationSha256:sourceStartDigest,node:process.version,image:IMAGE,postgres:'17.6',nativeDump:'17.6',
    result:success&&cleanupConfirmed?'PASS_DECLARED_SCOPE_RECOVERY_BLOCKED':'FAIL',failure,cases,cleanupConfirmed,
    scope:'ISOLATED_LIVE_SCHEMA_CATALOG_ONLY',actualGoTrueExercised:false,encryptedFullRecoveryQualified:false,
    historicalSnapshotCertified:false,producerAuthenticated:false,recoveryEligible:false,productionAccess:false};
  assertRedactedEvidence(report);writeFileSync(output,JSON.stringify(report,null,2)+'\n',{mode:0o600,flag:'wx'});
  if (success) process.stdout.write('002C1 declared local catalog scope passed; complete recovery remains blocked.\n');
}
