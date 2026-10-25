import assert from 'node:assert/strict';
import { existsSync,readFileSync,writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { Cluster,run,IMAGE } from './local.mjs';
import { Snapshot,PROTOCOL } from './snapshot.mjs';
import { minimalExperiment } from './experiment.mjs';
import { observeSnapshot,compareRaw,functionSubset,compareFunctionSubsets,projectLiveFunctions,implementationDigest,requireFullHistoricalCatalog,assertTrustedBaseline,SOURCE,TREE } from './catalog.mjs';
import { catalogSql } from '../nutrition-002c1/local.mjs';
import { compareCatalogs,hash } from '../nutrition-002c1/catalog.mjs';
import { MIGRATION_INVENTORY,MIGRATION44_CAPSULE,assertRecoveryCheckout } from '../phase-11i-migration-inventory.mjs';
import { assertRedactedEvidence } from '../phase-11i-recovery-contract.mjs';

const output = process.argv[2];
if (!output?.startsWith('/') || existsSync(output) || process.argv.length !== 3 || !process.version.startsWith('v22.')) throw new Error('N002C1A_RUNTIME_OR_OUTPUT_DENIED');
const source = new Cluster('source'), target = new Cluster('target'), cases = [];
const beforeDigest = implementationDigest(), startedAt = new Date().toISOString();
let success=false,failure;
async function record(name,action) {
  const start=Date.now();
  try { const facts=await action();cases.push({name,result:'PASS',elapsedMs:Date.now()-start,...facts});process.stdout.write(name+': PASS\n'); }
  catch(e) { cases.push({name,result:'FAIL',diagnostic:/^N002C[0-9A-Z_]+$/.test(e.message)?e.message:'ASSERTION_OR_LOCAL_OPERATION_FAILED',sections:e.sections,location:e.stack?.match(/qualify-local\.mjs:[0-9]+:[0-9]+/)?.[0]});throw e; }
}
async function replay(cluster,from,to) {
  for (const entry of MIGRATION_INVENTORY.slice(from,to)) {
    const bytes=readFileSync(new URL('../../supabase/migrations/'+entry.filename,import.meta.url));
    assert.equal(hash(bytes),entry.sha256);
    if (to<=44) assert.equal(await run('git',['rev-parse',MIGRATION44_CAPSULE.source+':supabase/migrations/'+entry.filename]),await run('git',['hash-object','supabase/migrations/'+entry.filename]));
    await cluster.sql('set role postgres;\n'+bytes.toString('utf8'));
  }
}
const TYPE_ADDRESSES = "select jsonb_agg(jsonb_build_array(jsonb_build_array(a.type,a.object_names,a.object_args),jsonb_build_array(n.nspname,t.typname))) from pg_type t join pg_namespace n on n.oid=t.typnamespace cross join lateral pg_identify_object_as_address('pg_type'::regclass,t.oid,0) a;";
const targetFunctions = async () => projectLiveFunctions(await live(target),JSON.parse(await target.sql(TYPE_ADDRESSES)));
const live = async cluster => JSON.parse(await cluster.sql(catalogSql()));
async function restore(dump) {
  assert.match(dump,/PostgreSQL database dump complete/);
  await target.sql('drop schema public cascade;drop schema private cascade;drop schema ingestion cascade;');
  await target.sql(dump);
  await target.sql('set role pg_database_owner;grant usage on schema public to public;');
}
async function snapshotAction(action) {
  const lease=await Snapshot.open(source);
  try { const reader=await lease.reader();return await action(lease,reader); }
  finally { await lease.close(); }
}
async function temporalCases() {
  await source.sql(`create table public.catalog_probe(id integer check(id>0),label text default 'old');
    revoke all on public.catalog_probe from anon,authenticated,public;
    alter table public.catalog_probe enable row level security;
    create policy catalog_probe on public.catalog_probe using(id>0);
    create index catalog_probe_label on public.catalog_probe(label);
    create function private.catalog_trigger() returns trigger language plpgsql as $$begin return new;end$$;
    create trigger catalog_probe before update on public.catalog_probe for each row execute function private.catalog_trigger();
    create function private.catalog_time_probe() returns integer language sql security definer set search_path='' as $$select 314159$$;
    create function private.catalog_argument_probe(x integer default 314159) returns integer language sql as $$select 314159$$;
    create view public.catalog_view as select id,label from public.catalog_probe;
    create role catalog_probe_role;`);
  await target.sql('create role catalog_probe_role;');
  const operations = [
    {name:'functionReplacement',sql:"create or replace function private.catalog_time_probe() returns integer language sql security definer set search_path='' as $$select 271828$$;",
      undo:"create or replace function private.catalog_time_probe() returns integer language sql security definer set search_path='' as $$select 314159$$;",
      helper:"select pg_get_functiondef('private.catalog_time_probe()'::regprocedure) like '%271828%';",dump: d=>{assert(d.includes('select 314159'));assert(!d.includes('select 271828'));}},
    {name:'functionRename',sql:'alter function private.catalog_time_probe() rename to catalog_time_renamed;',undo:'alter function private.catalog_time_renamed() rename to catalog_time_probe;',
      helper:"select (pg_identify_object_as_address('pg_proc'::regclass,(select oid from pg_proc where proname='catalog_time_probe'),0)).object_names=ARRAY['private','catalog_time_renamed'];",helperExpected:'t'},
    {name:'grantAfterSnapshot',sql:'grant update(label) on public.catalog_probe to anon with grant option;',undo:'revoke update(label) on public.catalog_probe from anon;',
      helper:"select has_column_privilege('anon','public.catalog_probe','label','UPDATE');"},
    {name:'revokeAfterSnapshot',before:'grant update(label) on public.catalog_probe to anon;',sql:'revoke update(label) on public.catalog_probe from anon;',undo:'revoke update(label) on public.catalog_probe from anon;',
      helper:"select has_column_privilege('anon','public.catalog_probe','label','UPDATE');",helperExpected:'f'},
    {name:'roleAttribute',sql:'alter role catalog_probe_role login;',undo:'alter role catalog_probe_role nologin;',
      helper:"select (pg_identify_object('pg_authid'::regclass,(select oid from pg_authid where rolname='catalog_probe_role'),0)).identity='catalog_probe_role';",helperScope:'IDENTITY_ONLY_NOT_ATTRIBUTE'},
    {name:'roleMembership',sql:'grant catalog_probe_role to anon;',undo:'revoke catalog_probe_role from anon;',
      helper:"select pg_has_role('anon','catalog_probe_role','MEMBER');"},
    {name:'defaultPrivilege',sql:'alter default privileges for role postgres in schema private grant execute on functions to anon;',undo:'alter default privileges for role postgres in schema private revoke execute on functions from anon;'},
    {name:'rlsPolicy',sql:'alter policy catalog_probe on public.catalog_probe using(true);',undo:'alter policy catalog_probe on public.catalog_probe using(id>0);',
      helper:"select pg_get_expr(polqual,polrelid,false)='(id > 0)' from pg_policy where polname='catalog_probe';",helperExpected:'t'},
    {name:'triggerDisable',sql:'alter table public.catalog_probe disable trigger catalog_probe;',undo:'alter table public.catalog_probe enable trigger catalog_probe;',
      helper:"select pg_get_triggerdef(oid,false) like '%catalog_probe%' from pg_trigger where tgname='catalog_probe';",helperScope:'DEFINITION_OMITS_ENABLED_STATE'},
    {name:'newObject',sql:'create function private.catalog_new_probe() returns integer language sql as $$select 271828$$;',undo:'drop function private.catalog_new_probe();',
      helper:"select to_regprocedure('private.catalog_new_probe()') is not null;"},
    {name:'dropRecreateFunction',sql:'drop function private.catalog_time_probe();create function private.catalog_time_probe() returns integer language sql security definer set search_path=\'\' as $$select 271828$$;',
      undo:"drop function private.catalog_time_probe();create function private.catalog_time_probe() returns integer language sql security definer set search_path='' as $$select 314159$$;",
      helper:"select pg_get_functiondef((select oid from pg_proc where proname='catalog_time_probe')) is null;",restoreFailure:true},
    {name:'changeAndRevert',sql:"create or replace function private.catalog_time_probe() returns integer language sql security definer set search_path='' as $$select 271828$$;create or replace function private.catalog_time_probe() returns integer language sql security definer set search_path='' as $$select 314159$$;",
      undo:'select 1;',sameCurrent:true,helper:"select pg_get_functiondef('private.catalog_time_probe()'::regprocedure) like '%314159%';"},
    {name:'mixedHistoricalBodyCurrentArguments',sql:"create or replace function private.catalog_argument_probe(x integer default 271828) returns integer language sql as $$select 271828$$;",
      undo:"create or replace function private.catalog_argument_probe(x integer default 314159) returns integer language sql as $$select 314159$$;",
      helper:"select pg_get_function_arguments('private.catalog_argument_probe(integer)'::regprocedure) like '%271828%';",mismatch:true,
      dump:d=>{assert(d.includes('x integer DEFAULT 271828'));assert(!d.includes('select 271828'));}},
  ];
  for (const op of operations) await record(op.name,async()=>{
    if(op.before) await source.sql(op.before);
    try {
      return await snapshotAction(async(lease,reader)=>{
        const historical=await observeSnapshot(lease,reader), expectedLive=await live(source);
        await source.sql("set lock_timeout='2000';set statement_timeout='5000';"+op.sql);
        compareRaw(historical,await observeSnapshot(lease,reader));
        const current=await live(source);
        if(op.sameCurrent) compareCatalogs(expectedLive,current);
        else assert.throws(()=>compareCatalogs(expectedLive,current),/CATALOG_MISMATCH/);
        if(op.helper) assert.equal((await lease.read(reader,op.helper)).join('\n'),op.helperExpected??'t');
        let dumpResult;
        try {
          const dump=await lease.dump();
          if(op.dumpFailure) assert.fail('Native dump unexpectedly succeeded');
          op.dump?.(dump);
          if(op.restoreFailure) {
            await assert.rejects(restore(dump),/N002C_LOCAL_PROCESS_FAILED_42601/);
            dumpResult='NATIVE_SUCCESS_UNRESTORABLE_SCHEMA_REJECTED';
          } else {
          await restore(dump);
          const restored=await live(target);
          if(op.mismatch) {
            assert.throws(()=>compareCatalogs(expectedLive,restored),/CATALOG_MISMATCH/);
            // Deliberately demonstrate why the incomplete projection can never
            // authorize full capture: argument defaults are outside its contract.
            compareFunctionSubsets(functionSubset(historical),await targetFunctions());
          }
          else compareCatalogs(expectedLive,restored);
          dumpResult=op.mismatch?'MIXED_STATE_REJECTED':'HISTORICAL_LIVE_MODEL_MATCH';
          }
        } catch(e) {
          if(!op.dumpFailure || !/^N002C_LOCAL_PROCESS_FAILED/.test(e.message)) throw e;
          dumpResult='DUMP_FAILED_CLOSED';
        }
        return {raw:'HISTORICAL_TUPLES_UNCHANGED',helper:op.helper?op.helperScope??'EXACT_EXPECTED_RESULT':'NOT_USED',
          nativeDump:dumpResult,partialProjectionMissesDefaults:op.mismatch??false,ddl:'COMMITTED',historicalRepresentation:'RAW_OBSERVATION_ONLY',
          exclusion:'MANDATORY_ADMINISTRATIVE_AND_PROVIDER_PRECONDITION',productionRecoveryEligibility:false};
      });
    } finally { await source.sql(op.undo); }
  });
  await record('existingRelationDdlLockTimeout',()=>snapshotAction(async(lease,reader)=>{
    await lease.read(reader,'lock table public.catalog_probe in access share mode;');
    await assert.rejects(source.sql("set lock_timeout='200ms';alter table public.catalog_probe add column unapproved integer;"),/55P03/);
    const dump=await lease.dump();assert(!dump.includes('unapproved'));
    await restore(dump);compareCatalogs(await live(source),await live(target));
    return {ddl:'LOCK_TIMEOUT',raw:'UNCHANGED',nativeDump:'HISTORICAL_LIVE_MODEL_MATCH',productionRecoveryEligibility:false};
  }));
  await record('exporterDeathAfterImport',async()=>{
    const lease=await Snapshot.open(source);
    try {
      const reader=await lease.reader();await lease.read(reader,'select 1;');
      await lease.terminateExporterForTest();
      // PostgreSQL permits an already imported participant to keep reading.
      assert.deepEqual(await reader.query('select 1;'),['1']);
      await assert.rejects(lease.read(reader,'select 1;'),/EXPORTER_LOST/);
      await assert.rejects(lease.dump(),/EXPORTER_LOST/);
      await assert.rejects(lease.importExpiredForTest(),/42704/);
      return {alreadyImportedReader:'SURVIVES_AT_SERVER',supervisor:'REFUSES',newImport:'REFUSES',productionRecoveryEligibility:false};
    } finally {await lease.close();}
  });
  await record('invalidLateImportReadOnlyAndParticipantFailures',()=>snapshotAction(async(lease,reader)=>{
    await assert.rejects(lease.importSequenceForTest('select 1;'),/25001/);
    await assert.rejects(source.sql("begin isolation level repeatable read read only;set transaction snapshot '00000000-00000000-0';"),/42704/);
    await assert.rejects(lease.read(reader,"create function pg_temp.unapproved() returns integer language sql as $$select 1$$;"),/PARTICIPANT_LOST/);
    const other=await lease.reader();
    await assert.rejects(lease.read(other,"set statement_timeout='100ms';select pg_sleep(2);"),/PARTICIPANT_LOST/);
    return {lateImport:'REFUSES',invalidImport:'REFUSES',catalogWritingDdl:'REFUSES',statementTimeout:'REFUSES',productionRecoveryEligibility:false};
  }));
}
try {
  assertRecoveryCheckout(fileURLToPath(new URL('../../supabase/migrations',import.meta.url)));
  assertTrustedBaseline({source:SOURCE,tree:await run('git',['rev-parse',SOURCE+'^{tree}'])});
  await source.start();await target.start();
  await record('preexistingOwnedContainerNameRefused',async()=>{await assert.rejects(new Cluster('source').start(),/EXISTING_CLUSTER_REFUSED/);});
  await record('minimalRawHelperNativeDumpCheckpoint',()=>minimalExperiment(source));
  await target.sql('create schema oid_churn;'+Array.from({length:40},(_,i)=>`create table oid_churn.t${i}(id integer);`).join('')+'drop schema oid_churn cascade;');
  for (const boundary of [44,45]) {
    await record('actual'+boundary+'TrustedMigrationReplay',async()=>{
      const from=boundary===44?0:44;await replay(source,from,boundary);await replay(target,from,boundary);
      assert.equal(await source.sql("select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname in ('public','ingestion') and c.relkind='r';"),'61');
      assert.notEqual(await source.sql("select 'public.profiles'::regclass::oid;"),await target.sql("select 'public.profiles'::regclass::oid;"));
      compareCatalogs(await live(source),await live(target));
    });
    await record('actual'+boundary+'ImportedSnapshotNativeDumpRestoreSubset',()=>snapshotAction(async(lease,reader)=>{
      const raw=await observeSnapshot(lease,reader), expected=functionSubset(raw), expectedLive=await live(source);
      compareRaw(raw,await observeSnapshot(lease,reader));
      const dump=await lease.dump();await restore(dump);
      compareCatalogs(expectedLive,await live(target));
      compareFunctionSubsets(expected,await targetFunctions());
      assert.throws(requireFullHistoricalCatalog,/FULL_HISTORICAL_MAPPING_UNQUALIFIED/);
      return {historicalFunctionSubset:'PASS',fullHistoricalCatalog:'BLOCKED',productionRecoveryEligibility:false};
    }));
  }
  await temporalCases();
  success=true;
} catch(e) {
  failure=/^N002C1A_[A-Z_]+$/.test(e.message)?e.message:'LOCAL_QUALIFICATION_FAILED';
  process.stderr.write(failure+'\n');process.exitCode=1;
} finally {
  const cleanup=await Promise.allSettled([source.stop(),target.stop()]);
  const absent=await run('docker',['ps','-a','--filter','label=codex.task=NUTRITION-DIARY-CORRECTNESS-002C1A','--format','{{.Names}}']);
  const cleanupConfirmed=cleanup.every(r=>r.status==='fulfilled')&&absent==='';
  if (!cleanupConfirmed || implementationDigest()!==beforeDigest) {success=false;process.exitCode=1;}
  const result={schemaVersion:'nutrition-002c1a-qualification/v1',startedAt,completedAt:new Date().toISOString(),
    sourceCommit:await run('git',['rev-parse','HEAD']),sourceTree:await run('git',['rev-parse','HEAD^{tree}']),trustedBase:SOURCE,trustedBaseTree:TREE,
    implementationSha256:beforeDigest,node:process.version,image:IMAGE,postgres:'17.6',nativeDump:'17.6',protocol:PROTOCOL,
    result:success?'PASS_BOUNDED_PREREQUISITE_RECOVERY_BLOCKED':'FAIL',failure,cases,cleanupConfirmed,
    fullHistoricalCatalog:'BLOCKED',fullHistoricalCatalogAndDumpEquivalence:'BLOCKED',producerAuthenticated:false,productionRecoveryEligibility:false,productionAccess:false};
  assertRedactedEvidence(result);writeFileSync(output,JSON.stringify(result,null,2)+'\n',{mode:0o600,flag:'wx'});
  if(success) process.stdout.write('002C1A bounded snapshot prerequisite passed; full mapping and recovery remain blocked.\n');
}
