import { createHash, randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';
import { LocalDatabase, verifyLocalTarget, uuid, digest, identifier, snapshotToken, reject } from './local-postgres.mjs';
import { CATALOG_SQL, TABLES_SQL, SEQUENCES_SQL, UNSUPPORTED_SQL, inspectRawCatalog } from './catalog.mjs';
import { verifyLocalOverlay } from './overlay.mjs';
import { MIGRATION44_BOUNDARY, MIGRATION45_BOUNDARY, assertRecoveryCheckout } from '../phase-11i-migration-inventory.mjs';

export const IMPLEMENTATION = 'nutrition-002c-local-capture/v1';
const AUTH = ['identities','mfa_factors','users','webauthn_credentials'];
export const hash = value => createHash('sha256').update(value).digest('hex');
export function sourceDigest() {
  return hash(['local-postgres.mjs','catalog.mjs','capture.mjs','gate.mjs','evidence.mjs','overlay.mjs',
    '../phase-11i-migration-inventory.mjs','../../ops/recovery/nutrition-migration-inventory.json',
    '../../ops/recovery/nutrition-002c/overlay-v1.sql','../../ops/recovery/nutrition-002c/overlay-v1.json']
    .map(p => readFileSync(new URL(p, import.meta.url))).map(hash).join('\n'));
}
export function assertSource() {
  assertRecoveryCheckout(fileURLToPath(new URL('../../supabase/migrations/',import.meta.url)));
  const overlay = JSON.parse(readFileSync(new URL('../../ops/recovery/nutrition-002c/overlay-v1.json',import.meta.url),'utf8'));
  if (overlay.schemaVersion !== 'nutrition-002c-overlay-inventory/v1' ||
      overlay.sqlSha256 !== hash(readFileSync(new URL('../../ops/recovery/nutrition-002c/overlay-v1.sql',import.meta.url)))) reject('N002C_OVERLAY_CHECKSUM_MISMATCH');
  return sourceDigest();
}
export function participantName(id,label) {
  uuid(id);
  if (!['schema','application','auth','reference'].includes(label)) reject('N002C_PARTICIPANT_DENIED');
  return `n002c_${id.replaceAll('-','')}_${label}`;
}
function parseTables(text) {
  return text ? text.split('\n').map(line => {
    const [schema,table,kind] = line.split('|'); identifier(schema); identifier(table);
    if (!['public','ingestion'].includes(schema) || kind !== 'r') reject('N002C_UNSUPPORTED_RELATION');
    return [schema,table];
  }) : [];
}
// Explicit installer/reviewer action for a new disposable database only. This is
// not an automatic restart/reconciliation path and is never called by capture.
export async function initializeLocalOverlay() {
  await verifyLocalTarget();
  const db = new LocalDatabase(); const source = assertSource();
  await db.sql(readFileSync(new URL('../../ops/recovery/nutrition-002c/overlay-v1.sql',import.meta.url),'utf8'));
  await db.sql(`update recovery_ops.control set expected_source='${source}',state='IDLE',reconciliation='LOCAL_FRESH_INSTALL_REVIEWED'
    where singleton and epoch=0 and attempt_id is null and state='RECONCILIATION_REQUIRED';`);
  // The write gate intentionally remains CLOSED until a separate explicit action.
}

export async function diagnoseLocal() {
  await verifyLocalTarget();
  return JSON.parse(await new LocalDatabase().sql(`select jsonb_build_object(
    'control',(select to_jsonb(c) from recovery_ops.control c),
    'attempt',(select to_jsonb(a) from recovery_ops.attempts a join recovery_ops.control c using(attempt_id,epoch)),
    'participants',(select coalesce(jsonb_agg(to_jsonb(p)),'[]') from recovery_ops.participants p join recovery_ops.control c using(attempt_id)),
    'gateClosed',(select closed from recovery_ops.gate where singleton));`));
}

export async function reconcileLocal({ attemptId, epoch, outcome }) {
  uuid(attemptId);
  if (!Number.isSafeInteger(epoch) || epoch < 1 || !['DISCARDED','VERIFIED_LOCAL_ARTIFACT','MIGRATION_READBACK_REVIEWED'].includes(outcome)) reject('N002C_RECONCILIATION_INPUT_DENIED');
  await verifyLocalTarget();
  const participants = JSON.parse(await new LocalDatabase().sql(`select coalesce(jsonb_agg(jsonb_build_object('pid',client_pid,'state',state)),'[]')
    from recovery_ops.participants where attempt_id='${attemptId}';`));
  for (const participant of participants) {
    // A missing registration acknowledgement cannot prove that a process never
    // started. Such ambiguity requires disposal/diagnosis, never automatic reset.
    if (!Number.isSafeInteger(participant.pid) || participant.pid < 1) reject('N002C_CLIENT_IDENTITY_UNCONFIRMED');
    try { process.kill(participant.pid,0); reject('N002C_LOCAL_CLIENT_STILL_PRESENT'); }
    catch (error) { if (error.code !== 'ESRCH') throw error; }
  }
  const owner = await new LocalDatabase().session('n002c_reconciler');
  try {
    const locked = await owner.query('select pg_try_advisory_lock(2002003,1);');
    if (locked[0] !== 't') reject('N002C_ADMINISTRATIVE_COLLISION');
    await owner.query(`select recovery_ops.reconcile('${attemptId}',${epoch},'${outcome}');`);
  } finally { await owner.close(); }
}

// Return values are restricted in-memory component outputs, not qualified backup
// artifacts. Hooks are an in-process fault/writer seam for the local harness;
// there is no metadata/env/CLI path into them or into Production capture.
async function capture(boundary, { afterSnapshot, duringDumps, seal, deadlineMs = 20000 } = {}) {
  if (![MIGRATION44_BOUNDARY,MIGRATION45_BOUNDARY].includes(boundary)) reject('N002C_BOUNDARY_DENIED');
  if (!Number.isInteger(deadlineMs) || deadlineMs < 500 || deadlineMs > 300000) reject('N002C_DEADLINE_DENIED');
  await verifyLocalTarget();
  const source = assertSource();
  await verifyLocalOverlay();
  const db = new LocalDatabase(), owner = await db.session();
  const id = randomUUID(), token = uuid(id);
  const children = [], readers = [];
  const started = Date.now();
  let epoch, snapshot, monitorFailure, stopping = false, ownerQuery = false;
  let monitor;
  const failMonitor = error => { monitorFailure ??= error; };
  async function check() {
    if (monitorFailure) throw monitorFailure;
    if (Date.now()-started > deadlineMs) reject('N002C_CAPTURE_DEADLINE');
    if (owner.closed || owner.process.done) reject('N002C_EXPORTER_LOST');
  }
  async function guarded(promise) {
    let settled = false, value, failure;
    Promise.resolve(promise).then(result=>{ value=result; settled=true; },error=>{ failure=error; settled=true; });
    while (!settled) { await check(); await delay(25); }
    if (failure) throw failure;
    await check(); return value;
  }
  // Public eligibility never follows merely from this callback succeeding.
  try {
    if ((await owner.query('select pg_try_advisory_lock(2002003,1);'))[0] !== 't') reject('N002C_ADMINISTRATIVE_COLLISION');
    epoch = Number((await owner.query(`select recovery_ops.admit('${token}','BACKUP',${boundary.count},'${source}',${Math.ceil(deadlineMs/1000)});`))[0]);
    if (!Number.isSafeInteger(epoch) || epoch < 1) reject('N002C_ADMISSION_FAILED');
    snapshot = snapshotToken((await owner.query('begin isolation level repeatable read read only; select pg_export_snapshot();'))[0]);
    const ledger = await owner.query('select version from supabase_migrations.schema_migrations order by version;');
    if (JSON.stringify(ledger) !== JSON.stringify(boundary.versions)) reject('N002C_EXACT_LEDGER_MISMATCH');
    if ((await owner.query(SEQUENCES_SQL)).length || (await owner.query(UNSUPPORTED_SQL)).length) reject('N002C_UNSUPPORTED_SEQUENCE_OR_RELATION');
    const tables = parseTables((await owner.query(TABLES_SQL)).join('\n'));
    if (!tables.length) reject('N002C_EMPTY_APPLICATION_SCOPE');
    // Pin existing relation identity; DML remains allowed. This does not fence
    // role changes, function replacement, new-object DDL or provider operations.
    await owner.query('lock table ' + [...tables,...AUTH.map(t=>['auth',t])]
      .map(([s,t])=>`${identifier(s)}.${identifier(t)}`).join(',') + ' in access share mode;');
    const catalogText = (await owner.query(CATALOG_SQL)).join('\n');
    inspectRawCatalog(JSON.parse(catalogText));
    const referenceName = participantName(id,'reference');
    await db.sql(`select recovery_ops.register('${token}',${epoch},'reference','${referenceName}');`);
    const reader = await db.session(referenceName); readers.push(reader);
    await db.sql(`update recovery_ops.participants set client_pid=${reader.process.child.pid} where attempt_id='${token}' and label='reference';`);
    // Import occurs before the first data/catalog query. Session initialization
    // only sets GUCs and observes its own pid before starting this transaction.
    await reader.query(`begin isolation level repeatable read read only; set transaction snapshot '${snapshot}';`);
    const reference = {};
    for (const [s,t] of [...tables,...AUTH.map(t=>['auth',t])]) {
      reference[`${s}.${t}`] = (await reader.query(`select coalesce(jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text),'[]') from ${identifier(s)}.${identifier(t)} t;`)).join('\n');
    }
    const readerCatalog = (await reader.query(CATALOG_SQL)).join('\n');
    if (readerCatalog !== catalogText) reject('N002C_READER_CATALOG_MISMATCH');
    await reader.query('commit;'); await reader.close();
    await db.sql(`update recovery_ops.participants set state='STOPPED',stopped_at=clock_timestamp(),output_sha256='${hash(JSON.stringify(reference))}' where attempt_id='${token}' and label='reference';`);

    if (afterSnapshot) await guarded(afterSnapshot({ db, id, epoch }));
    await check();
    // No blocking child invocation: monitor can observe exporter death and
    // terminate/reconcile actual database backends while pg_dump is running.
    monitor = (async () => {
      while (!stopping) {
        await delay(40);
        if (stopping) break;
        try {
          await check();
          if (!ownerQuery) {
            ownerQuery = true;
            const lock = await owner.query(`select count(*) from pg_catalog.pg_locks where pid=pg_backend_pid() and locktype='advisory' and classid=2002003 and objid=1 and objsubid=2 and granted;`);
            ownerQuery = false;
            if (lock[0] !== '1') reject('N002C_LOCK_LOST');
          }
          const state = await db.sql(`select c.state||':'||c.epoch from recovery_ops.control c where singleton and attempt_id='${token}';`);
          if (state !== `CAPTURING:${epoch}`) reject('N002C_ADMISSION_LOST');
          await db.sql(`update recovery_ops.attempts set last_observed_at=clock_timestamp() where attempt_id='${token}' and epoch=${epoch};
            update recovery_ops.participants p set backend_pid=s.pid,backend_start=s.backend_start,state='RUNNING',last_observed_at=clock_timestamp()
            from pg_catalog.pg_stat_activity s where p.attempt_id='${token}' and p.application_name=s.application_name and p.state<>'STOPPED';`);
        } catch (error) { ownerQuery = false; failMonitor(error); break; }
      }
    })();
    for (const label of ['schema','application','auth']) {
      await check(); const name = participantName(id,label);
      await db.sql(`select recovery_ops.register('${token}',${epoch},'${label}','${name}');`);
      const process = db.dump(snapshot,label,name); children.push(Object.assign(process,{label,name}));
      if (!Number.isSafeInteger(process.child.pid)) reject('N002C_CHILD_PID_MISSING');
      await db.sql(`update recovery_ops.participants set client_pid=${process.child.pid} where attempt_id='${token}' and label='${label}';`);
    }
    const hook = Promise.resolve(duringDumps?.({ db,id,epoch })); hook.catch(failMonitor);
    const outputs = {};
    for (const child of children) {
      while (!child.done) {
        try { await check(); } catch (error) { throw error; }
        await delay(25);
      }
      const result = await child.result;
      if (result.code !== 0 || result.timedOut || result.overflow || !result.stdout.length) reject('N002C_DUMP_FAILED');
      await check();
      // A local process exit is not accepted as database backend termination.
      if ((await db.sql(`select count(*) from pg_catalog.pg_stat_activity where application_name='${child.name}';`)) !== '0') reject('N002C_BACKEND_SURVIVED');
      outputs[child.label] = result.stdout;
      await db.sql(`update recovery_ops.participants set state='STOPPED',stopped_at=clock_timestamp(),output_sha256='${hash(result.stdout)}' where attempt_id='${token}' and label='${child.label}';`);
    }
    await guarded(hook); await check();
    // A diagnostic drift check rejects observed concurrent catalog changes. It
    // does not prove absence of change-and-revert races and does not qualify a
    // general role serializer or pg_dump's internal deparser behavior.
    const currentCatalog = await db.sql(CATALOG_SQL);
    if (currentCatalog !== catalogText) reject('N002C_CATALOG_DRIFT_OBSERVED');
    const proof = { contract:IMPLEMENTATION, id,epoch,source,boundary:boundary.count,
      snapshot, tables:tables.map(([s,t])=>`${s}.${t}`), catalog:catalogText, reference,
      components:Object.fromEntries(Object.entries(outputs).map(([k,v])=>[k,hash(v)])),
      catalogQualification:'RAW_SOURCE_OBSERVATION_ONLY_RESTORE_MAPPING_UNQUALIFIED',
      providerConfiguration:'SEPARATE_RECOVERY_CONTRACT_UNACCEPTED' };
    const artifact = seal ? await guarded(seal({ outputs,proof })) : hash(JSON.stringify(proof));
    digest(artifact); await check();
    // Continuous owner supervision extends through the entire asynchronous seal.
    stopping = true; await monitor; await check();
    await owner.query('commit;');
    await owner.query(`select recovery_ops.seal('${token}',${epoch},'${artifact}');`);
    return { id,epoch,artifact,outputs,proof,status:'LOCAL_COMPONENT_CAPTURE_SEALED_NOT_RECOVERY_ELIGIBLE' };
  } catch (error) {
    stopping = true;
    if (monitor) await monitor;
    if (epoch) {
      // Best effort only: a failed control connection leaves CAPTURING latched.
      // A deadline never grants a successor admission.
      await db.sql(`select recovery_ops.fail_attempt('${token}',${epoch});`).catch(()=>{});
      for (const child of children) if (!child.done) child.child.kill('SIGKILL');
      for (const reader of readers) reader.terminateClient();
      const names = ['schema','application','auth','reference'].map(label=>`'${participantName(id,label)}'`).join(',');
      // Narrow fixed local admin operation, not a requested hosted privilege.
      await db.sql(`select pg_terminate_backend(pid,2000) from pg_catalog.pg_stat_activity
        where datname=current_database() and application_name in (${names});`).catch(()=>{});
      await Promise.allSettled(children.map(child=>child.result));
      const remaining = await db.sql(`select count(*) from pg_catalog.pg_stat_activity where application_name in (${names});`).catch(()=>null);
      if (remaining !== '0') error = new Error('N002C_CLEANUP_UNCONFIRMED');
    }
    // Error text is a fixed diagnostic code; never interpolate raw SQL/stderr.
    throw new Error(/^N002C_[A-Z0-9_]+$/.test(error.message) ? error.message : 'N002C_CAPTURE_FAILED');
  } finally {
    stopping = true;
    for (const reader of readers) await reader.close().catch(()=>{});
    await owner.close().catch(()=>{});
  }
}

export const captureLocal44 = options => capture(MIGRATION44_BOUNDARY,options);
export const captureLocal45 = options => capture(MIGRATION45_BOUNDARY,options);
