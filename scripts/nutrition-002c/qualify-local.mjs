import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync, chmodSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { randomUUID } from 'node:crypto';
import { LocalDatabase, CONTAINER, IMAGE, LABEL, run, verifyLocalTarget, waitUntil, assertLocalDocker } from './local-postgres.mjs';
import { initializeLocalOverlay, captureLocal44, captureLocal45, reconcileLocal, diagnoseLocal, sourceDigest, hash, participantName } from './capture.mjs';
import { installLocalGate, reopenLocalGate, closeLocalGate, verifyLocalGate } from './gate.mjs';
import { CATALOG_SQL, SEQUENCES_SQL } from './catalog.mjs';
import { buildLocalEvidence, verifyLocalEvidence } from './evidence.mjs';
import { MIGRATION44_BOUNDARY, MIGRATION45_BOUNDARY } from '../phase-11i-migration-inventory.mjs';
import { assertRedactedEvidence } from '../phase-11i-recovery-contract.mjs';

// No arbitrary host/project/source flag. Refuse any existing container with this
// name. Every durable result is sanitized; database contents and keys are removed.
const output = process.argv[2];
if (process.argv.length!==3 || !output?.startsWith('/') || existsSync(output)) throw new Error('A new absolute evidence filename is required.');
process.umask(0o077);
const root=mkdtempSync(join(tmpdir(),'nutrition-002c-qualification-'));
const db=new LocalDatabase(), restore=new LocalDatabase('nutrition002c_restore');
const cases={}, startedAt=new Date().toISOString();
let created=false, success=false;
async function record(name,fn) {
  const start=Date.now();
  try { await fn(); } catch(error) {
    cases[name]={result:'FAIL',elapsedMs:Date.now()-start,diagnosticCode:/^N002C_[A-Z0-9_]+$/.test(error.message)?error.message:'LOCAL_ASSERTION_FAILED'};
    throw error;
  }
  cases[name]={result:'PASS_COMPONENT_ONLY',elapsedMs:Date.now()-start};
  process.stdout.write(`${name}: PASS_COMPONENT_ONLY\n`);
}
async function deny(sql,options) { const r=await db.process(sql,options).result; assert.notEqual(r.code,0); return r; }
async function reconcile(outcome='DISCARDED') {
  const d=await diagnoseLocal(); assert.ok(d.control.attempt_id);
  await reconcileLocal({attemptId:d.control.attempt_id,epoch:d.control.epoch,outcome});
}
async function assertBlocked() {
  const d=await diagnoseLocal(); assert.ok(['CAPTURING','RECONCILIATION_REQUIRED'].includes(d.control.state));
  await assert.rejects(captureLocal45(),/N002C_/);
}
const dumpSchema=`create schema private; create schema ingestion; create schema auth;
create table public.parent(id integer primary key,user_id uuid not null,payload jsonb,note text);
create table public.child(id integer primary key,parent_id integer references public.parent(id) on delete cascade,note text);
create table public.additional_values(id integer primary key,sql_null jsonb,json_null jsonb,zero_value numeric,precision_value numeric);
create table ingestion.jobs(id integer primary key,note text);
create table auth.users(id integer primary key,payload jsonb,note text);
create table auth.identities(id integer primary key,user_id integer references auth.users(id),note text);
create table auth.mfa_factors(id integer primary key,user_id integer references auth.users(id));
create table auth.webauthn_credentials(id integer primary key,user_id integer references auth.users(id));
create function private.catalog_probe() returns integer language sql security definer set search_path='' as $$select 1$$;
revoke all on function private.catalog_probe() from public;
create function private.write_parent() returns void language sql security definer set search_path='' as $$update public.parent set note='definer mutation' where id=1$$;
revoke all on function private.write_parent() from public;
create role n002c_writer login nosuperuser noinherit;
grant usage on schema public,ingestion,private to n002c_writer;
grant select,insert,update,delete,truncate on all tables in schema public,ingestion to n002c_writer;
grant execute on function private.write_parent() to n002c_writer;
alter table public.parent enable row level security;
create policy owner_only on public.parent to n002c_writer using(user_id=nullif(current_setting('n002c.owner',true),'')::uuid)
with check(user_id=nullif(current_setting('n002c.owner',true),'')::uuid);`;
const owner='99000000-0000-4000-8000-000000000001';
const fixture=`insert into public.parent values
 (1,'${owner}','{"state":"before"}','before'),(2,'${owner}',null,'balanced old'),(5,'${owner}','null','deleted later');
insert into public.child values(1,1,'before');
insert into public.additional_values values(1,null,'null',0,0.123456789123456789);
insert into ingestion.jobs values(1,'before');
insert into auth.users values(1,'{"state":"before"}','before');
insert into auth.identities values(1,1,'before');`;
const mutation=`begin; update public.parent set payload='{"state":"after"}',note='after' where id=1;
update public.child set note='after' where id=1;
update auth.users set payload='{"state":"after"}',note='after' where id=1;
update auth.identities set note='after' where id=1;
delete from public.parent where id=2; insert into public.parent values(3,'${owner}','null','balanced replacement');
insert into public.parent values(4,'${owner}','{}','new insert'); delete from public.parent where id=5;
update ingestion.jobs set note='after'; commit;`;
async function resetRows() {
  await db.sql('truncate public.child,public.parent,public.additional_values,ingestion.jobs,auth.identities,auth.mfa_factors,auth.webauthn_credentials,auth.users cascade;'+fixture);
}
async function setLedger(boundary) {
  await db.sql('truncate supabase_migrations.schema_migrations;insert into supabase_migrations.schema_migrations(version) values '+boundary.versions.map(v=>`('${v}')`).join(',')+';');
}

// A synthetic CMS envelope exercises the established cipher type, without
// pretending that this proposed component format is accepted by the old restore.
const cert=join(root,'synthetic.crt'), key=join(root,'synthetic.key');
async function encryptedSeal({outputs,proof,loseAck=false}) {
  const content=join(root,'content'); mkdirSync(content,{mode:0o700});
  for (const [label,bytes] of Object.entries(outputs)) writeFileSync(join(content,label+'.sql'),bytes,{mode:0o600});
  writeFileSync(join(content,'restricted-proof.json'),JSON.stringify(proof),{mode:0o600});
  const tar=join(root,'component.tar'), archive=join(root,'component.cms');
  await run('tar',['-cf',tar,'-C',content,'.']);
  await run('openssl',['cms','-encrypt','-binary','-outform','DER','-aes-256-gcm','-in',tar,'-out',archive,cert]);
  const description=await run('openssl',['cms','-cmsout','-inform','DER','-in',archive,'-print']);
  assert.match(description,/id-smime-ct-authEnvelopedData/); assert.match(description,/aes-256-gcm/);
  const ciphertext=readFileSync(archive), publicEvidence=buildLocalEvidence(proof,ciphertext);
  if (loseAck) writeFileSync(join(root,'published-synthetic.cms'),ciphertext,{mode:0o600,flag:'wx'});
  assert.equal(verifyLocalEvidence(publicEvidence,proof,ciphertext,sourceDigest()).recoveryEligible,false);
  const decrypted=join(root,'decrypted.tar'), restored=join(root,'decrypted'); mkdirSync(restored,{mode:0o700});
  await run('openssl',['cms','-decrypt','-binary','-inform','DER','-in',archive,'-recip',cert,'-inkey',key,'-out',decrypted]);
  assert.equal(hash(readFileSync(decrypted)),hash(readFileSync(tar)));
  await run('tar',['-xf',decrypted,'-C',restored]);
  assert.equal(readFileSync(join(restored,'restricted-proof.json'),'utf8'),JSON.stringify(proof));
  await restore.sql('truncate public.child,public.parent,public.additional_values,ingestion.jobs,auth.identities,auth.mfa_factors,auth.webauthn_credentials,auth.users cascade;');
  for (const label of ['auth','application']) await restore.sql(readFileSync(join(restored,label+'.sql'),'utf8'));
  for (const [table,expected] of Object.entries(proof.reference)) {
    const actual=await restore.sql(`select coalesce(jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text),'[]') from ${table.split('.').map(t=>`"${t}"`).join('.')} t;`);
    assert.equal(actual,expected,'Snapshot reference differs after encrypted component restore.');
  }
  const corrupted=Buffer.from(ciphertext); corrupted[corrupted.length-20]^=1;
  const bad=join(root,'corrupt.cms'); writeFileSync(bad,corrupted,{mode:0o600});
  const fail=await (await import('./local-postgres.mjs')).startProcess('openssl',['cms','-decrypt','-binary','-inform','DER','-in',bad,'-recip',cert,'-inkey',key,'-out',join(root,'corrupt.tar')],{input:''}).result;
  assert.notEqual(fail.code,0);
  rmSync(content,{recursive:true}); rmSync(restored,{recursive:true});
  for (const p of [tar,archive,decrypted,bad,join(root,'corrupt.tar')]) rmSync(p,{force:true});
  if (loseAck) throw new Error('N002C_SIMULATED_PUBLICATION_ACK_LOST');
  return hash(ciphertext);
}

try {
  await assertLocalDocker();
  assert.equal(await run('docker',['ps','-a','--filter',`name=^/${CONTAINER}$`,'--format','{{.Names}}']), '');
  await run('docker',['run','-d','--name',CONTAINER,'--label',LABEL,'--network','none',
    '--tmpfs','/var/lib/postgresql/data:rw,size=768m','-e','POSTGRES_PASSWORD=local-disposable-only',IMAGE,
    'postgres','-D','/var/lib/postgresql/data','-c','listen_addresses=','-c','shared_preload_libraries='],{timeoutMs:30000});
  created=true;
  await waitUntil(async()=>{
    try {
      // The image runs a temporary SQL server during initialization. A SELECT
      // can succeed there immediately before it shuts down. The image's init
      // completion marker is emitted only after that server has stopped. Then
      // require a fresh successful connection to the final postmaster.
      if (!(await run('docker',['logs',CONTAINER])).includes('PostgreSQL init process complete; ready for start up.')) return false;
      return (await run('docker',['exec',CONTAINER,'psql','-U','postgres','-d','postgres','-XqAt','-c','select 1']))==='1';
    } catch { return false; }
  },60000);
  await run('docker',['exec','-i',CONTAINER,'psql','-U','postgres','-d','postgres','-X','-v','ON_ERROR_STOP=1'],{
    input:'create database nutrition002c;create database nutrition002c_restore;'});
  await verifyLocalTarget();
  await db.sql(dumpSchema);
  // Roles are cluster-wide; restore only creates schema/table definitions.
  await restore.sql(dumpSchema.slice(0,dumpSchema.indexOf('create role n002c_writer')));
  await db.sql(`create schema if not exists supabase_migrations;create table if not exists supabase_migrations.schema_migrations(version text primary key);`);
  await setLedger(MIGRATION45_BOUNDARY); await db.sql(fixture);
  await initializeLocalOverlay();
  await record('closedByDefaultAndPrivateOverlay',async()=>{
    assert.equal((await diagnoseLocal()).gateClosed,true);
    await deny('select * from recovery_ops.control;', {user:'n002c_writer'});
    await deny("select recovery_ops.admit('99000000-0000-4000-8000-000000000099','BACKUP',45,'"+'0'.repeat(64)+"',20);",{user:'n002c_writer'});
    assert.equal(await db.sql("select count(*) from pg_roles where rolname='nutrition_recovery_owner' and not rolcanlogin and not rolsuper and not rolbypassrls and not rolinherit;"),'1');
  });
  const inventory=await installLocalGate(); assert.equal(inventory.length,4);
  await verifyLocalGate(); await reopenLocalGate();
  await run('openssl',['req','-x509','-newkey','rsa:3072','-nodes','-keyout',key,'-out',cert,'-days','1','-subj','/CN=002C Disposable Synthetic Recipient'],{timeoutMs:30000});
  chmodSync(key,0o600);

  for (const boundary of [MIGRATION44_BOUNDARY,MIGRATION45_BOUNDARY]) {
    await setLedger(boundary); await resetRows();
    await record('encryptedComponentLedger'+boundary.count,async()=>{
      const capture=boundary.count===44?captureLocal44:captureLocal45;
      const result=await capture({afterSnapshot:()=>db.sql(mutation),seal:encryptedSeal});
      assert.equal(result.status,'LOCAL_COMPONENT_CAPTURE_SEALED_NOT_RECOVERY_ELIGIBLE');
      assert.equal(await db.sql("select note from public.parent where id=1;"),'after');
      assert.equal((await diagnoseLocal()).control.state,'SEALED');
      await assert.rejects(capture(),/N002C_/);
      await reconcile('VERIFIED_LOCAL_ARTIFACT');
    });
  }
  await record('wrongBoundaryRejected',async()=>{
    await assert.rejects(captureLocal44(),/N002C_EXACT_LEDGER_MISMATCH/); await assertBlocked(); await reconcile();
  });
  await record('selectedSequenceRejected',async()=>{
    await db.sql('create sequence public.unsupported_allocator;');
    assert.notEqual(await db.sql(SEQUENCES_SQL),'');
    await assert.rejects(captureLocal45(),/UNSUPPORTED_SEQUENCE/); await reconcile();
    await db.sql('drop sequence public.unsupported_allocator;');
  });

  await record('catalogHistoricalFieldsAndCurrentHelpers',async()=>{
    const reader=await db.session('n002c_catalog_reader');
    try {
      await reader.query('begin isolation level repeatable read read only;');
      const before=(await reader.query(CATALOG_SQL)).join('\n');
      await db.sql(`create or replace function private.catalog_probe() returns integer language sql security definer set search_path='' as $$select 2$$;
        grant execute on function private.catalog_probe() to n002c_writer;
        grant update(note) on public.parent to n002c_writer;
        alter role n002c_writer connection limit 7;
        alter role n002c_writer set statement_timeout='6s';
        grant n002c_writer to postgres;
        alter default privileges in schema public grant select on tables to n002c_writer;
        create table public.new_catalog_object(id integer);
        alter table public.child add column catalog_probe integer;`);
      assert.equal((await reader.query(CATALOG_SQL)).join('\n'),before);
      const current=await db.sql(CATALOG_SQL); assert.notEqual(current,before);
      for (const key of ['roles','memberships','settings','relations','columns','functions','defaults']) {
        assert.notDeepEqual(JSON.parse(before)[key],JSON.parse(current)[key],`Catalog mutation was not exercised: ${key}`);
      }
      assert.match((await reader.query("select pg_get_functiondef('private.catalog_probe()'::regprocedure);")).join('\n'),/select 2/);
      await db.sql('revoke execute on function private.catalog_probe() from n002c_writer;revoke update(note) on public.parent from n002c_writer;');
      assert.equal((await reader.query(CATALOG_SQL)).join('\n'),before);
      await reader.query('rollback;');
    } finally { await reader.close(); }
    await db.sql(`drop table public.new_catalog_object;alter table public.child drop column catalog_probe;
      alter default privileges in schema public revoke select on tables from n002c_writer;
      revoke n002c_writer from postgres;
      alter role n002c_writer reset statement_timeout;alter role n002c_writer connection limit -1;
      revoke update(note) on public.parent from n002c_writer;
      revoke execute on function private.catalog_probe() from n002c_writer;
      create or replace function private.catalog_probe() returns integer language sql security definer set search_path='' as $$select 1$$;`);
  });
  await record('observedCatalogDriftRejectsCapture',async()=>{
    await assert.rejects(captureLocal45({afterSnapshot:()=>db.sql('grant select(note) on public.child to n002c_writer;')}),/CATALOG_DRIFT/);
    await reconcile(); await db.sql('revoke select(note) on public.child from n002c_writer;');
  });

  await record('competingBackupAndMigrationAndStaleInputs',async()=>{
    const result=await captureLocal45({afterSnapshot:async()=>{
      await assert.rejects(captureLocal45(),/COLLISION/);
      const competitor=await db.session('n002c_competitor');
      try { assert.equal((await competitor.query('select pg_try_advisory_lock(2002003,1);'))[0],'f'); }
      finally { await competitor.close(); }
      await deny(`select recovery_ops.admit('${randomUUID()}','MIGRATION',45,'${sourceDigest()}',20);`);
    }});
    const d=await diagnoseLocal();
    await assert.rejects(reconcileLocal({attemptId:result.id,epoch:d.control.epoch-1,outcome:'DISCARDED'}),/N002C_/);
    await reconcile('VERIFIED_LOCAL_ARTIFACT');
    const op=await db.session('n002c_old_source');
    try {
      await op.query('select pg_advisory_lock(2002003,1);');
      await assert.rejects(op.query(`select recovery_ops.admit('${randomUUID()}','BACKUP',45,'${'0'.repeat(64)}',20);`),/SESSION_EOF/);
    } finally { await op.close(); }
    assert.equal((await diagnoseLocal()).control.state,'IDLE');
  });

  await record('exporterLossAndDurableTakeoverRefusal',async()=>{
    await assert.rejects(captureLocal45({duringDumps:async()=>{
      await db.sql("select pg_terminate_backend(pid,2000) from pg_stat_activity where application_name='n002c_owner';");
    }}),/N002C_/);
    await assertBlocked();
    const successor=await db.session('n002c_successor');
    try { assert.equal((await successor.query('select pg_try_advisory_lock(2002003,1);'))[0],'t'); }
    finally { await successor.close(); }
    await reconcile();
  });
  await record('immutableAttemptAndMigrationAdmission',async()=>{
    const refused=await db.session('n002c_open_gate_migration');
    try {
      await refused.query('select pg_advisory_lock(2002003,1);');
      await assert.rejects(refused.query(`select recovery_ops.admit('${randomUUID()}','MIGRATION',44,'${sourceDigest()}',20);`),/SESSION_EOF/);
    } finally { await refused.close(); }
    await closeLocalGate(); await setLedger(MIGRATION44_BOUNDARY);
    const coordinator=await db.session('n002c_local_migration_reference'),id=randomUUID(); let epoch;
    try {
      epoch=Number((await coordinator.query(`select pg_advisory_lock(2002003,1);select recovery_ops.admit('${id}','MIGRATION',44,'${sourceDigest()}',20);`)).at(-1));
      assert.equal((await diagnoseLocal()).control.state,'MIGRATING');
      await assert.rejects(coordinator.query(`update recovery_ops.attempts set state='SEALED' where attempt_id='${id}';`),/SESSION_EOF/);
    } finally { await coordinator.close(); }
    await assert.rejects(reconcile(),/N002C_/);
    assert.equal(await db.sql('select count(*) from supabase_migrations.schema_migrations;'),'44');
    await db.sql(`select recovery_ops.fail_attempt('${id}',${epoch});`);
    await reconcile('MIGRATION_READBACK_REVIEWED');
    await setLedger(MIGRATION45_BOUNDARY); await reopenLocalGate();
  });
  await record('lostSessionLockInvalidatesCapture',async()=>{
    await assert.rejects(captureLocal45({duringDumps:()=>db.sql("select pg_terminate_backend(pid,2000) from pg_stat_activity where application_name='n002c_owner';")}),/N002C_/);
    await reconcile();
  });
  await record('sealFailureAndLostAcknowledgementStayBlocked',async()=>{
    await assert.rejects(captureLocal45({seal:args=>encryptedSeal({...args,loseAck:true})}),/PUBLICATION_ACK_LOST/);
    assert.equal(existsSync(join(root,'published-synthetic.cms')),true); await assertBlocked(); await reconcile();
    await assert.rejects(captureLocal45({seal:()=>run('openssl',['cms','-encrypt','-binary','-outform','DER','-aes-256-gcm','-in',cert,'-out',join(root,'failed.cms'),join(root,'absent-recipient.crt')])}),/N002C_/);
    await reconcile();
  });
  await record('captureDeadlineNoAutomaticExpiry',async()=>{
    await assert.rejects(captureLocal45({deadlineMs:1000,afterSnapshot:()=>new Promise(()=>{})}),/DEADLINE/);
    await delay(1200); await assertBlocked(); await reconcile();
  });

  await record('orphanBackendAndRestartRequireExplicitReconciliation',async()=>{
    const ownerSession=await db.session('n002c_interrupted_owner'); const id=randomUUID();
    const epoch=Number((await ownerSession.query(`select pg_advisory_lock(2002003,1);select recovery_ops.admit('${id}','BACKUP',45,'${sourceDigest()}',1);`)).at(-1));
    const name=participantName(id,'reference');
    await db.sql(`select recovery_ops.register('${id}',${epoch},'reference','${name}');`);
    const child=await db.session(name);
    await db.sql(`update recovery_ops.participants set client_pid=${child.process.child.pid} where attempt_id='${id}' and label='reference';`);
    try {
      ownerSession.terminateClient(); await ownerSession.process.result;
      // Docker client death may leave its psql/backend alive. Explicitly observe
      // and terminate the fixed owner backend, then demonstrate the child latch.
      await db.sql("select pg_terminate_backend(pid,2000) from pg_stat_activity where application_name='n002c_interrupted_owner';");
      await delay(1100);
      await assert.rejects(reconcileLocal({attemptId:id,epoch,outcome:'DISCARDED'}),/N002C_/);
      await assert.rejects(captureLocal45(),/N002C_/);
      assert.equal(await db.sql(`select count(*) from pg_stat_activity where application_name='${name}';`),'1');
    } finally { await child.close(); await ownerSession.close(); }
    await reconcile();
  });

  // Large synthetic rows keep a real COPY/pg_dump participant observable for
  // backend death and delayed-cleanup injection. No data is retained in evidence.
  await db.sql("insert into auth.users select n,'{}',repeat(md5(n::text),32768) from generate_series(2,49) n;");
  await record('actualDumpBackendFailureCancelsAttempt',async()=>{
    let terminated=false;
    await assert.rejects(captureLocal45({duringDumps:async({id})=>{
      const name=participantName(id,'auth'); let pid;
      await waitUntil(async()=>{pid=Number(await db.sql(`select pid from pg_stat_activity where application_name='${name}';`)); return Number.isSafeInteger(pid)&&pid>0;});
      terminated=(await db.sql(`select pg_terminate_backend(${pid},2000);`))==='t';
    }}),/N002C_/);
    assert.equal(terminated,true); await assertBlocked(); await reconcile();
  });
  await record('stalledDumpAndUnconfirmedCleanupStayBlocked',async()=>{
    let released=Promise.resolve(), stopped=false, name;
    await assert.rejects(captureLocal45({deadlineMs:7000,duringDumps:async({id})=>{
      name=participantName(id,'auth'); let pid;
      await waitUntil(async()=>{pid=Number(await db.sql(`select pid from pg_stat_activity where application_name='${name}';`)); return Number.isSafeInteger(pid)&&pid>0;});
      await run('docker',['exec',CONTAINER,'kill','-STOP',String(pid)]); stopped=true;
      // Keep the backend suspended beyond the cancellation confirmation bound.
      // Resume even if an assertion fails so local cleanup cannot leak it.
      released=(async()=>{await delay(12000);await run('docker',['exec',CONTAINER,'kill','-CONT',String(pid)]);})();
      await released;
    }}),/CLEANUP_UNCONFIRMED/);
    assert.equal(stopped,true); await assertBlocked();
    await assert.rejects(reconcile(),/N002C_/);
    await released;
    await waitUntil(async()=>(await db.sql(`select count(*) from pg_stat_activity where application_name='${name}';`))==='0');
    await reconcile();
  });
  await db.sql('delete from auth.users where id>1;');

  await record('gateDrainsInflightAndPersistsClosed',async()=>{
    await resetRows();
    const writer=await db.session('n002c_inflight_writer');
    const old=await db.session('n002c_old_writer');
    try {
      await writer.query("begin;update public.child set note='in flight' where id=1;");
      await old.query('begin isolation level repeatable read;select count(*) from public.child;');
      let finished=false; const closing=closeLocalGate().then(()=>{finished=true;});
      await waitUntil(async()=>(await db.sql("select count(*) from pg_stat_activity where application_name='n002c_control' and wait_event_type='Lock';"))!=='0');
      assert.equal(finished,false); await writer.query('commit;'); await closing;
      await assert.rejects(old.query("update public.child set note='stale' where id=1;"),/SESSION_EOF/);
      for (const sql of [
        "insert into public.child values(99,1,'blocked');",
        "update public.child set note='blocked' where id=1;",
        'delete from public.child where id=1;',
        'truncate public.child;',
        "copy public.child from stdin;\n99\t1\tblocked\n\\.\n",
        "insert into public.child values(1,1,'blocked') on conflict(id) do update set note=excluded.note;",
        "merge into public.child t using (values(1)) s(id) on t.id=s.id when matched then update set note='blocked';",
        'select private.write_parent();',
        "delete from public.parent where id=1;",
        "insert into ingestion.jobs values(2,'blocked');",
      ]) await deny(sql,{user:'n002c_writer'});
      assert.equal((await diagnoseLocal()).gateClosed,true);
      await db.sql('delete from recovery_ops.gate;');
      await deny('update public.child set note=note;');
      await db.sql("insert into recovery_ops.gate values(true,true,'LOCAL_TEST_RESTORED_CLOSED',clock_timestamp());");
      await deny("set session_replication_role=replica;update public.child set note=note;");
    } finally { await writer.close(); await old.close(); }
    await reopenLocalGate();
    assert.equal(await db.sql("select count(*) from public.parent;",{user:'n002c_writer'}),'0');
    assert.equal(await db.sql(`set n002c.owner='${owner}';select count(*) from public.parent;`,{user:'n002c_writer'}),'3');
  });
  await record('gateCoverageDriftAndPartitionFailClosed',async()=>{
    await db.sql('create table public.uncovered_table(id integer);');
    await assert.rejects(verifyLocalGate(),/COVERAGE/); await db.sql('drop table public.uncovered_table;');
    await db.sql('alter table public.child disable trigger nutrition002c_write_gate;');
    await assert.rejects(verifyLocalGate(),/COVERAGE/); await db.sql('alter table public.child enable always trigger nutrition002c_write_gate;');
    await db.sql('create table public.unsupported_partition(id integer) partition by range(id);');
    await assert.rejects(verifyLocalGate(),/COVERAGE/); await db.sql('drop table public.unsupported_partition;');
    await verifyLocalGate();
  });
  await record('overlayHelperAndGrantDriftRejected',async()=>{
    const sql=readFileSync(new URL('../../ops/recovery/nutrition-002c/overlay-v1.sql',import.meta.url),'utf8');
    const original=sql.match(/create function recovery_ops\.enforce_gate\(\) returns trigger[\s\S]*?end \$\$;/)[0];
    await db.sql("create or replace function recovery_ops.enforce_gate() returns trigger language plpgsql security definer set search_path='' as $$begin return null;end$$;");
    await assert.rejects(verifyLocalGate(),/FUNCTION_DRIFT/);
    await assert.rejects(captureLocal45(),/FUNCTION_DRIFT/);
    await db.sql(original.replace('create function','create or replace function'));
    await db.sql('grant execute on function recovery_ops.enforce_gate() to authenticated;');
    await assert.rejects(verifyLocalGate(),/CLIENT_GRANT_DRIFT/);
    await db.sql('revoke execute on function recovery_ops.enforce_gate() from authenticated;');
    await verifyLocalGate();
  });
  success=true;
} finally {
  if (created) await run('docker',['rm','-f',CONTAINER],{timeoutMs:30000});
  const absent=(await run('docker',['ps','-a','--filter',`name=^/${CONTAINER}$`,'--format','{{.Names}}']))==='';
  rmSync(root,{recursive:true,force:true});
  const report={task:'NUTRITION-DIARY-CORRECTNESS-002C',startedAt,completedAt:new Date().toISOString(),
    sourceCommit:await run('git',['rev-parse','HEAD']),implementationSha256:sourceDigest(),
    harnessSha256:hash(readFileSync(new URL(import.meta.url))),node:process.version,
    image:IMAGE,postgres:'17.6',nativeDump:'17.6',scope:'DISPOSABLE_COMPONENT_DATABASE_ONLY',
    fullApplicationMigrationsReplayed:false,actualGoTrueExercised:false,
    historicalLedgerFixtures:[44,45],all35NutrientApplicationContractsQualified:false,
    result:success?'PASS_COMPONENT_TESTS_RECOVERY_BLOCKED':'FAILED_COMPONENT_QUALIFICATION',
    cases,cleanup:{containerAbsent:absent,plaintextAndSyntheticKeysRemoved:!existsSync(root)},
    productionAccess:false,productionCaptureEnabled:false,
    blockers:['completeRoleCatalogRestoreMapping','fullApplicationOverlayQualification','encryptedFullApplication44And45Recovery','providerAndSecretRecoveryAcceptance','hostedCapabilitiesUnqualified']};
  assertRedactedEvidence(report); writeFileSync(resolve(output),JSON.stringify(report,null,2)+'\n',{mode:0o600,flag:'wx'});
  assert.equal(absent,true);
}
