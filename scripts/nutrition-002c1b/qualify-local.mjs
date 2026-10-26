import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { Cluster, run, IMAGE, waitUntil } from './local.mjs';
import { Session, Snapshot } from './snapshot.mjs';
import { Operation, install, implementationDigest, sourceIdentity, BASE, BASE_TREE, PROTOCOL } from './protocol.mjs';
import { observe, functionWitness, compareWitness, requireHistoricalDefaultEquivalence, classifications } from './fidelity.mjs';
import { compareRaw, functionSubset, compareFunctionSubsets, projectLiveFunctions, requireFullHistoricalCatalog } from '../nutrition-002c1a/catalog.mjs';
import { catalogSql } from '../nutrition-002c1/local.mjs';
import { hash, compareCatalogs } from '../nutrition-002c1/catalog.mjs';
import { MIGRATION_INVENTORY, MIGRATION44_CAPSULE, assertRecoveryCheckout } from '../phase-11i-migration-inventory.mjs';
import { sourceDigest as legacyDigest } from '../nutrition-002c/capture.mjs';
import { assertRedactedEvidence } from '../phase-11i-recovery-contract.mjs';
const output = process.argv[2];
if (!output?.startsWith('/') || existsSync(output) || process.argv.length !== 3 || !process.version.startsWith('v22.'))
    throw new Error('N002C1B_RUNTIME_OR_OUTPUT_DENIED');
const source = new Cluster('source'), target = new Cluster('target'), cases = [], digest = implementationDigest(), startedAt = new Date().toISOString();
let success = false, failure, phase = 'BASELINE';
async function record(name, fn) { const start = Date.now(); try {
    const facts = await fn();
    cases.push({ name, result: 'PASS', elapsedMs: Date.now() - start, ...facts });
    process.stdout.write(name + ': PASS\n');
}
catch (e) {
    cases.push({ name, result: 'FAIL', diagnostic: /^N002C[0-9A-Z_]+$/.test(e.message) ? e.message : 'ASSERTION_OR_LOCAL_OPERATION_FAILED', location: e.stack?.match(/(?:qualify-local|fidelity|protocol)\.mjs:[0-9]+:[0-9]+/)?.[0] });
    throw e;
} }
const live = async (c) => JSON.parse(await c.sql(catalogSql()));
const targets = async () => projectLiveFunctions(await live(target), JSON.parse(await target.sql("select jsonb_agg(jsonb_build_array(jsonb_build_array(a.type,a.object_names,a.object_args),jsonb_build_array(n.nspname,t.typname))) from pg_type t join pg_namespace n on n.oid=t.typnamespace cross join lateral pg_identify_object_as_address('pg_type'::regclass,t.oid,0) a;")));
async function replay(c, from, to) { for (const e of MIGRATION_INVENTORY.slice(from, to)) {
    const b = readFileSync(new URL('../../supabase/migrations/' + e.filename, import.meta.url));
    assert.equal(hash(b), e.sha256);
    if (to <= 44)
        assert.equal(await run('git', ['rev-parse', MIGRATION44_CAPSULE.source + ':supabase/migrations/' + e.filename]), await run('git', ['hash-object', 'supabase/migrations/' + e.filename]));
    await c.sql('set role postgres;\n' + b);
} }
async function restore(dump) { assert.match(dump, /PostgreSQL database dump complete/); await target.sql('drop schema public cascade;drop schema private cascade;drop schema ingestion cascade;'); await target.sql(dump); await target.sql('set role pg_database_owner;grant usage on schema public to public;'); }
async function denyAdmission(kind = 'MIGRATION', options) { await assert.rejects(Operation.admit(source, kind, kind === 'MIGRATION' ? 44 : 45, options), /N002C/); }
async function reconcileClosed(op, outcome) { await op.close(); await op.reconcile(outcome ?? (op.kind === 'MIGRATION' ? 'MIGRATION_READBACK_REVIEWED' : 'DISCARDED')); }
async function concurrency() {
    for (const [a, b, label] of [['BACKUP', 'MIGRATION', 'backupBeforeMigration'], ['MIGRATION', 'BACKUP', 'migrationBeforeBackup'], ['BACKUP', 'BACKUP', 'competingBackups'], ['MIGRATION', 'MIGRATION', 'competingMigrations']])
        await record(label, async () => { const first = await Operation.admit(source, a, a === 'MIGRATION' ? 44 : 45); await denyAdmission(b); await first.check(); if (a === 'MIGRATION')
            await first.migration('create function public.ddl_admission_probe() returns integer language sql as $$select 1$$;drop function public.ddl_admission_probe();'); await reconcileClosed(first); const next = await Operation.admit(source, b, b === 'MIGRATION' ? 44 : 45); assert(next.epoch > first.epoch); if (b === 'MIGRATION')
            await next.migration('create function public.ddl_admission_probe() returns integer language sql as $$select 1$$;drop function public.ddl_admission_probe();'); await reconcileClosed(next); return { admission: 'SERIALIZED', automaticTakeover: false }; });
    await record('coordinatorDeathAfterAdmission', async () => { const op = await Operation.admit(source, 'BACKUP', 45); const [pid] = await op.owner.query('select pg_backend_pid();'); assert.match(pid, /^[1-9][0-9]*$/); await source.sql(`select pg_terminate_backend(${pid},2000);`); await assert.rejects(op.check(), /PARTICIPANT_LOST/); await op.close(); await denyAdmission('BACKUP'); await op.reconcile('DISCARDED'); return { state: 'DURABLE_LATCH_RECONCILED_EXPLICITLY' }; });
    await record('sessionLockLoss', async () => { const op = await Operation.admit(source, 'MIGRATION', 44); await op.owner.query('select pg_advisory_unlock(2002003,1);'); await assert.rejects(op.migration('select 1;'), /PARTICIPANT_LOST/); await op.close(); await denyAdmission(); await op.reconcile('MIGRATION_READBACK_REVIEWED'); return { operation: 'REFUSED', state: 'LATCHED' }; });
    await record('registrationAcknowledgementLoss', async () => {
        const op = await Operation.admit(source, 'BACKUP', 45);
        await op.register('reference'); // Commit succeeded, deliberately do not use acknowledgement.
        await assert.rejects(op.register('reference'), /N002C/);
        await op.close();
        await denyAdmission('BACKUP');
        await op.reconcile('DISCARDED');
        return { registration: 'DURABLE_DUPLICATE_REFUSED', state: 'NO_RETRY_OR_RESET' };
    });
    await record('participantSurvivesClientTermination', async () => { const op = await Operation.admit(source, 'BACKUP', 45); await op.register('reference'); const s = op.track(new Session(source)); await s.query(`set application_name='${op.name('reference')}';select 1;`); const [pid] = await s.query('select pg_backend_pid();'); assert.match(pid, /^[1-9][0-9]*$/); const pending = s.query('select pg_sleep(25);'); pending.catch(() => { }); await waitUntil(async () => await source.sql(`select count(*) from pg_stat_activity where pid=${pid} and wait_event='PgSleep';`) === '1', 5000); s.process.child.kill('SIGKILL'); await s.process.result; await op.close(); assert.equal(await source.sql(`select count(*) from pg_stat_activity where pid=${pid};`), '1'); await assert.rejects(op.reconcile('DISCARDED'), /N002C/); await source.sql(`select pg_terminate_backend(${pid},2000);`); await waitUntil(async () => await source.sql(`select count(*) from pg_stat_activity where pid=${pid};`) === '0', 5000); await op.reconcile('DISCARDED'); return { client: 'TERMINATED', backend: 'SURVIVED_RECONCILIATION_REFUSED_UNTIL_TERMINATED' }; });
    await record('staleProtocolAndSource', async () => { await denyAdmission('BACKUP', { protocol: 'nutrition-002c-local/v1' }); await denyAdmission('MIGRATION', { source: '0'.repeat(64) }); return { admission: 'REFUSED' }; });
    await record('expiredUnreconciledAttempt', async () => { const op = await Operation.admit(source, 'BACKUP', 45, { seconds: 1 }); await waitUntil(async () => await source.sql(`select deadline<clock_timestamp() from recovery_ops.attempts where attempt_id='${op.id}';`) === 't', 4000); await assert.rejects(op.check(), /N002C/); await op.close(); await denyAdmission('BACKUP'); await op.reconcile('DISCARDED'); return { expiry: 'NO_AUTOMATIC_RESET' }; });
    await record('queuedLegacySourceResume', async () => { const s = new Session(source); try {
        await s.query('select pg_advisory_lock(2002003,1);');
        await assert.rejects(s.query(`select recovery_ops.admit('00000000-0000-4000-8000-000000000001','MIGRATION',44,'${legacyDigest()}',20);`), /N002C/);
    }
    finally {
        await s.close();
    } return { legacySource: 'REFUSED_BY_EXACT_EXPECTED_SOURCE', privilegedSpoofing: 'NOT_EXCLUDED' }; });
    await record('immutableAttemptAndTerminalTransitions', async () => { const op = await Operation.admit(source, 'BACKUP', 45); await assert.rejects(source.sql(`update recovery_ops.attempts set source_sha256='${'0'.repeat(64)}' where attempt_id='${op.id}';`), /55000/); await op.close(); await assert.rejects(op.reconcile('MIGRATION_READBACK_REVIEWED'), /N002C/); await assert.rejects(op.reconcile('VERIFIED_LOCAL_ARTIFACT'), /N002C/); await op.reconcile('DISCARDED'); return { identityMutation: 'REFUSED', wrongTerminal: 'REFUSED' }; });
}
async function stableCapture(boundary, operations = []) {
    const op = await Operation.admit(source, 'BACKUP', boundary), lease = await Snapshot.open(source, op.owner);
    try {
        const readers = {};
        for (const label of ['reference', 'application', 'auth']) {
            await op.register(label);
            readers[label] = op.track(await lease.reader(op.name(label)));
        }
        const raw = await observe(lease, readers.reference);
        const names = new Map(raw.sections.namespaces.map(n => [String(n.oid), n.nspname]));
        const relationNames = raw.sections.classes.filter(c => c.relkind === 'r' && ['public', 'private', 'ingestion', 'auth'].includes(names.get(String(c.relnamespace)))).map(c => { const schema = names.get(String(c.relnamespace)); assert.match(schema, /^[a-z_][a-z0-9_]*$/); assert.match(c.relname, /^[a-z_][a-z0-9_]*$/); return '"' + schema + '"."' + c.relname + '"'; });
        assert(relationNames.length);
        await lease.read(readers.reference, 'lock table ' + relationNames.join(',') + ' in access share mode;');
        const expectedLive = await live(source);
        for (const fixture of operations) {
            await denyAdmission();
            await record('cooperating_' + fixture.name, async () => ({ scenario: 'COOPERATING_ADMINISTRATIVE_PROTOCOL', admission: 'REJECTED_BEFORE_DDL', historicalRaw: 'SHARED_STABLE_CAPTURE', nativeDump: 'SHARED_STABLE_CAPTURE', restore: 'SHARED_STABLE_CAPTURE', liveLogicalComparison: 'SHARED_STABLE_CAPTURE', recoveryEligibility: false, residualRisk: 'NONPARTICIPANTS_AND_PROVIDER_NOT_EXCLUDED' }));
        }
        await denyAdmission('BACKUP');
        await op.check();
        compareRaw(raw, await observe(lease, readers.reference));
        await op.register('schema');
        const dump = await lease.dump(op.name('schema'));
        await op.check();
        await restore(dump);
        compareCatalogs(expectedLive, await live(target));
        compareFunctionSubsets(functionSubset(raw), await targets());
        if (operations.length) {
            const query = 'select private.ddl_zero(),private.ddl_one(),private.ddl_many(),private.ddl_op(),private.ddl_call(),private.ddl_type()::text,private.ddl_variadic(1,2),private.ddl_inout();';
            assert.equal(await target.sql(query), await source.sql(query));
        }
        assert.throws(requireHistoricalDefaultEquivalence, /UNQUALIFIED/);
        assert.throws(requireFullHistoricalCatalog, /UNQUALIFIED/);
        let witness = 'RAW_DEPENDENCY_WITNESS_ONLY';
        try {
            functionWitness(raw);
        }
        catch (e) {
            if (!/^N002C/.test(e.message))
                throw e;
            witness = 'REFUSED_UNSUPPORTED_DEPENDENCY_OR_SIGNATURE';
        }
        await lease.releaseForCompletion();
        for (const label of ['reference', 'application', 'auth', 'schema'])
            await op.stopParticipant(label, hash(label === 'schema' ? dump : 'local synthetic read completed'));
        await op.seal(hash(dump));
        await lease.close();
        await op.reconcile('VERIFIED_LOCAL_ARTIFACT');
        return { boundary, nativeDump: 'RESTORED_AND_LIVE_MODEL_MATCH', historicalFunctionSubset: 'PASS', functionDefaults: witness, admission: 'PARTICIPATING_MIGRATION_EXCLUDED', fullHistoricalCatalog: 'BLOCKED', recoveryEligibility: false };
    }
    catch (e) {
        await lease.close();
        throw e;
    }
}
const fixtures = [
    { name: 'functionBody', sql: "create or replace function private.ddl_zero() returns integer language sql security definer set search_path='' as $$select 271828$$;", undo: "create or replace function private.ddl_zero() returns integer language sql security definer set search_path='' as $$select 314159$$;", helper: "select pg_get_functiondef((select oid from pg_proc where proname='ddl_zero')) like '%271828%';" },
    { name: 'literalDefault', sql: 'create or replace function private.ddl_one(x integer default 271828) returns integer language sql as $$select x$$;', undo: 'create or replace function private.ddl_one(x integer default 314159) returns integer language sql as $$select x$$;', mismatch: true, helper: "select pg_get_function_arguments((select oid from pg_proc where proname='ddl_one')) like '%271828%';" },
    { name: 'multipleDefaults', sql: 'create or replace function private.ddl_many(x integer default 13,y integer default 14) returns integer language sql as $$select x+y$$;', undo: 'create or replace function private.ddl_many(x integer default 11,y integer default 12) returns integer language sql as $$select x+y$$;', mismatch: true },
    { name: 'operatorDefault', sql: 'create or replace function private.ddl_op(x integer default (3*4)) returns integer language sql as $$select x$$;', undo: 'create or replace function private.ddl_op(x integer default (3+4)) returns integer language sql as $$select x$$;', mismatch: true },
    { name: 'referencedOverload', restoreState: '42883', sql: "create or replace function private.ddl_call(x integer default private.ddl_ref('2'::text)) returns integer language sql as $$select x$$;", undo: 'create or replace function private.ddl_call(x integer default private.ddl_ref(2)) returns integer language sql as $$select x$$;', restoreFailure: true },
    { name: 'referencedFunctionBody', sql: 'create or replace function private.ddl_ref(x integer) returns integer language sql as $$select x+30$$;', undo: 'create or replace function private.ddl_ref(x integer) returns integer language sql as $$select x+3$$;' },
    { name: 'referencedTypeRename', restoreState: '42704', sql: 'alter type private.ddl_kind rename to ddl_kind_new;', undo: 'alter type private.ddl_kind_new rename to ddl_kind;', restoreFailure: true },
    { name: 'functionRename', sql: 'alter function private.ddl_zero() rename to ddl_zero_new;', undo: 'alter function private.ddl_zero_new() rename to ddl_zero;' },
    { name: 'dropRecreate', restoreState: '42601', sql: 'drop function private.ddl_zero();create function private.ddl_zero() returns integer language sql security definer set search_path=\'\' as $$select 271828$$;', undo: 'drop function private.ddl_zero();create function private.ddl_zero() returns integer language sql security definer set search_path=\'\' as $$select 314159$$;', restoreFailure: true },
    { name: 'grant', sql: 'grant update(label) on public.ddl_probe to anon with grant option;', undo: 'revoke update(label) on public.ddl_probe from anon;' },
    { name: 'revoke', before: 'grant update(label) on public.ddl_probe to anon;', sql: 'revoke update(label) on public.ddl_probe from anon;', undo: 'revoke update(label) on public.ddl_probe from anon;' },
    { name: 'roleMembership', sql: 'grant ddl_fixture_role to anon;', undo: 'revoke ddl_fixture_role from anon;' },
    { name: 'roleAttribute', sql: 'alter role ddl_fixture_role login;', undo: 'alter role ddl_fixture_role nologin;' },
    { name: 'defaultPrivilege', sql: 'alter default privileges for role postgres in schema private grant execute on functions to anon;', undo: 'alter default privileges for role postgres in schema private revoke execute on functions from anon;' },
    { name: 'rlsPolicy', sql: 'alter policy ddl_probe on public.ddl_probe using(true);', undo: 'alter policy ddl_probe on public.ddl_probe using(id>0);' },
    { name: 'triggerDisable', sql: 'alter table public.ddl_probe disable trigger ddl_probe;', undo: 'alter table public.ddl_probe enable trigger ddl_probe;' },
    { name: 'newObject', sql: 'create function private.ddl_new() returns integer language sql as $$select 271828$$;', undo: 'drop function private.ddl_new();' },
    { name: 'existingTableDdl', sql: 'alter table public.ddl_probe add column added integer;', undo: 'select 1;', lock: true },
    { name: 'providerLikeDdl', sql: 'create function auth.ddl_provider() returns integer language sql as $$select 271828$$;', undo: 'drop function auth.ddl_provider();', provider: true },
    { name: 'changeAndRevert', sql: 'create or replace function private.ddl_zero() returns integer language sql security definer set search_path=\'\' as $$select 271828$$;', undo: 'create or replace function private.ddl_zero() returns integer language sql security definer set search_path=\'\' as $$select 314159$$;', revert: true },
    { name: 'mixedBodyCurrentDefault', sql: 'create or replace function private.ddl_one(x integer default 271828) returns integer language sql as $$select 271828$$;', undo: 'create or replace function private.ddl_one(x integer default 314159) returns integer language sql as $$select x$$;', mismatch: true, mixed: true },
];
async function createFixtures() {
    await source.sql(`create table public.ddl_probe(id integer,label text);revoke all on public.ddl_probe from anon,authenticated,public;alter table public.ddl_probe enable row level security;create policy ddl_probe on public.ddl_probe using(id>0);
create function private.ddl_trigger() returns trigger language plpgsql as $$begin return new;end$$;create trigger ddl_probe before update on public.ddl_probe for each row execute function private.ddl_trigger();
create function private.ddl_zero() returns integer language sql security definer set search_path='' as $$select 314159$$;
create function private.ddl_one(x integer default 314159) returns integer language sql as $$select x$$;
create function private.ddl_many(x integer default 11,y integer default 12) returns integer language sql as $$select x+y$$;
create function private.ddl_op(x integer default (3+4)) returns integer language sql as $$select x$$;
create function private.ddl_ref(x integer) returns integer language sql as $$select x+3$$;
create function private.ddl_ref(x text) returns integer language sql as $$select length(x)+20$$;
create function private.ddl_call(x integer default private.ddl_ref(2)) returns integer language sql as $$select x$$;
create type private.ddl_kind as enum('old','new');create function private.ddl_type(x private.ddl_kind default 'old'::private.ddl_kind) returns private.ddl_kind language sql as $$select x$$;
create function private.ddl_variadic(variadic x integer[]) returns integer language sql as $$select cardinality(x)$$;
create function private.ddl_inout(inout x integer default 11) language plpgsql as $$begin x:=x+1;end$$;
create role ddl_fixture_role;
create table auth.ddl_row_probe(id integer);create table private.ddl_row_probe(id integer);`);
    await target.sql('create role ddl_fixture_role;create table auth.ddl_row_probe(id integer);');
}
async function temporal(fixture, scenario) {
    if (fixture.before)
        await source.sql(fixture.before);
    const op = scenario === 'NONCOOPERATING_PRIVILEGED_WRITER' ? await Operation.admit(source, 'BACKUP', 45) : undefined;
    const lease = await Snapshot.open(source, op?.owner);
    try {
        const reader = await lease.reader(), raw = await observe(lease, reader), expected = await live(source);
        const query = fixture.name === 'multipleDefaults' ? 'select private.ddl_many();' : fixture.name === 'operatorDefault' ? 'select private.ddl_op();' : ['literalDefault', 'mixedBodyCurrentDefault'].includes(fixture.name) ? 'select private.ddl_one();' : undefined;
        const historicalMeaning = query ? await source.sql(query) : undefined;
        if (fixture.lock)
            await lease.read(reader, 'lock table public.ddl_probe in access share mode;');
        if (fixture.lock)
            await assert.rejects(source.sql("set lock_timeout='200ms';" + fixture.sql), /55P03/);
        else {
            await source.sql(fixture.sql);
            if (fixture.revert)
                await source.sql(fixture.undo);
        }
        compareRaw(raw, await observe(lease, reader));
        if (fixture.helper)
            assert.equal((await lease.read(reader, fixture.helper))[0], 't');
        if (['literalDefault', 'mixedBodyCurrentDefault'].includes(fixture.name))
            assert.equal((await lease.read(reader, "select pg_get_expr(proargdefaults,0,false) from pg_proc where proname='ddl_one';"))[0], '314159');
        if (fixture.name === 'referencedTypeRename')
            assert.match((await lease.read(reader, "select pg_get_expr(proargdefaults,0,false) from pg_proc where proname='ddl_type';")).join('\n'), /ddl_kind_new/);
        if (fixture.revert)
            compareCatalogs(expected, await live(source));
        const dump = await lease.dump();
        let restoreResult, comparison;
        if (fixture.restoreFailure) {
            await assert.rejects(restore(dump), new RegExp('N002C_LOCAL_PROCESS_FAILED_' + fixture.restoreState + '$'));
            restoreResult = 'REJECTED_UNRESTORABLE';
            comparison = 'NOT_RUN_RESTORE_FAILED';
        }
        else {
            await restore(dump);
            restoreResult = 'SUCCESS';
            if (fixture.mismatch) {
                const restored = await live(target);
                assert.throws(() => compareCatalogs(expected, restored), /CATALOG_MISMATCH/);
                comparison = 'MISMATCH_REJECTED';
                if (query)
                    assert.notEqual(await target.sql(query), historicalMeaning);
                if (fixture.mixed) {
                    assert(dump.includes('x integer DEFAULT 271828'));
                    assert(!dump.includes('select 271828'));
                    compareFunctionSubsets(functionSubset(raw), await targets());
                }
            }
            else {
                compareCatalogs(expected, await live(target));
                comparison = 'HISTORICAL_LIVE_MODEL_MATCH';
            }
        }
        return { scenario, historicalRaw: 'UNCHANGED', deparser: fixture.helper ? 'CURRENT_STATE_CONFIRMED' : fixture.name === 'referencedTypeRename' ? 'OLD_NODE_CURRENT_TYPE_NAME_CONFIRMED' : 'NOT_ASSERTED', restoredDefaultMeaning: query ? 'CHANGED_VALUE_CONFIRMED' : 'NOT_EVALUATED', rawDefaultDeparser: ['literalDefault', 'mixedBodyCurrentDefault'].includes(fixture.name) ? 'OLD_LITERAL_WITH_STABLE_NAMES' : 'NO_HISTORICAL_SEMANTIC_CLAIM', nativeDump: 'EXIT_ZERO', restore: restoreResult, liveLogicalComparison: comparison, admission: fixture.lock ? 'DDL_BLOCKED_BY_RELATION_LOCK' : op ? 'BYPASSED_PARTICIPANT_PROTOCOL' : 'NO_PROTOCOL', changeAndRevertDetection: fixture.revert ? 'PRE_POST_EQUAL_DESPITE_COMMITTED_CHANGES' : 'NOT_APPLICABLE', recoveryEligibility: false, residualRisk: 'NO_UNIVERSAL_DDL_EXCLUSION' };
    }
    finally {
        await lease.close();
        if (op)
            await op.reconcile('DISCARDED');
        await source.sql(fixture.undo);
    }
}
try {
    assertRecoveryCheckout(fileURLToPath(new URL('../../supabase/migrations', import.meta.url)));
    assert.equal(await run('git', ['rev-parse', BASE + '^{tree}']), BASE_TREE);
    phase = 'CLUSTER_START';
    await source.start();
    await target.start();
    phase = 'PROTOCOL';
    await install(source);
    await install(target);
    await record('preexistingTaskContainerNameRefused', async () => { await assert.rejects(new Cluster('source').start(), /EXISTING_CLUSTER_REFUSED/); });
    await concurrency();
    for (const boundary of [44, 45]) {
        await record('actual' + boundary + 'FreshDisposableClusters', async () => {
            await source.stop(); await target.stop();
            await source.start(); await target.start();
            await install(source); await install(target);
            return { initialization: 'NEW_CLUSTER_IDENTITIES', previousStateCarried: false };
        });
        await record('actual' + boundary + 'TrustedReplay', async () => { await replay(source, 0, boundary); await replay(target, 0, boundary); compareCatalogs(await live(source), await live(target)); return { actualSql: true, inventory: 'EXACT_TRUSTED' }; });
        await record('actual' + boundary + 'CoordinatedSnapshotDumpRestore', () => stableCapture(boundary));
        await record('actual' + boundary + 'UnsupportedObjectAndDependencyRefused', async () => { const expected = await live(source); await source.sql('create sequence public.ddl_unsupported;'); try {
            const unsupported = await live(source);
            assert.throws(() => compareCatalogs(expected, unsupported), /UNSUPPORTED/);
        }
        finally {
            await source.sql('drop sequence public.ddl_unsupported;');
        } const lease = await Snapshot.open(source); try {
            const r = await lease.reader(), raw = await observe(lease, r);
            raw.sections.types = [];
            assert.throws(() => functionWitness(raw), /N002C/);
        }
        finally {
            await lease.close();
        } return { unsupportedObject: 'REFUSED', missingTypeDependency: 'REFUSED', fullEquivalence: 'BLOCKED' }; });
    }
    phase = 'DDL_MATRIX';
    await createFixtures();
    await record('fixtureRawDefaultsDependencyWitnessAndRefusals', async () => { const lease = await Snapshot.open(source); try {
        const r = await lease.reader(), raw = await observe(lease, r), ids = raw.sections.procedures.filter(p => p.proname.startsWith('ddl_') && raw.sections.namespaces.some(n => String(n.oid) === String(p.pronamespace) && n.nspname === 'private')).map(p => p.oid);
        const w = functionWitness(raw, ids);
        assert(w.records.some(r => r.defaultSemantics === 'NO_DEFAULTS'));
        assert(w.records.some(r => r.defaultSemantics === 'UNRECONSTRUCTED_RAW_NODE_TREE'));
        const missing = structuredClone(raw);
        missing.sections.types = missing.sections.types.filter(t => String(t.oid) !== String(w.records[0].tuple.prorettype));
        assert.throws(() => functionWitness(missing, ids), /N002C/);
        const duplicate = structuredClone(raw);
        duplicate.sections.dependencies.push({ ...duplicate.sections.dependencies[0] });
        const picked = raw.sections.dependencies.find(e => w.records.some(r => r.directEdges.some(d => JSON.stringify(d) === JSON.stringify(e))));
        assert(picked);
        duplicate.sections.dependencies = raw.sections.dependencies.concat({ ...picked });
        assert.throws(() => compareWitness(w, functionWitness(duplicate, ids)), /WITNESS_MULTISET_MISMATCH/);
        return { rawDefaults: 'PRESERVED_OPAQUE', argumentForms: 'NO_DEFAULT_ONE_MULTIPLE_OVERLOADED_QUALIFIED_VARIADIC_INOUT', dependencyClosure: 'AVAILABLE_RAW_ONLY_NOT_COMPLETE', missingReference: 'REFUSED', duplicateEdge: 'REFUSED', historicalEquivalence: 'BLOCKED' };
    }
    finally {
        await lease.close();
    } });
    await record('stableFunctionFormsUnderCooperatingExclusion', () => stableCapture(45, fixtures));
    for (const scenario of ['NO_DDL_STABILITY_CONTRACT', 'NONCOOPERATING_PRIVILEGED_WRITER'])
        for (const f of fixtures)
            await record(scenario.toLowerCase() + '_' + f.name, () => temporal(f, scenario));
    await record('ordinaryRowWritesContinueUnderSnapshot', async () => { const op = await Operation.admit(source, 'BACKUP', 45), lease = await Snapshot.open(source, op.owner); try {
        const r = await lease.reader();
        assert.equal((await lease.read(r, 'select count(*) from private.ddl_row_probe;select count(*) from auth.ddl_row_probe;')).join(','), '0,0');
        await source.sql('insert into private.ddl_row_probe values(1);insert into auth.ddl_row_probe values(1);');
        assert.equal((await lease.read(r, 'select count(*) from private.ddl_row_probe;select count(*) from auth.ddl_row_probe;')).join(','), '0,0');
        assert.equal(await source.sql('select count(*) from auth.ddl_row_probe;'), '1');
        return { rowDml: 'CONTINUES', snapshot: 'STABLE', authScope: 'SYNTHETIC_AUTH_SCHEMA_ROW_ONLY_NO_GOTRUE_CLAIM' };
    }
    finally {
        await lease.close();
        await op.reconcile('DISCARDED');
    } });
    success = true;
}
catch (e) {
    failure = /^N002C[0-9A-Z_]+$/.test(e.message) ? e.message : 'LOCAL_QUALIFICATION_FAILED';
    process.stderr.write(failure + '\n');
    process.exitCode = 1;
}
finally {
    const cleanup = await Promise.allSettled([source.stop(), target.stop()]);
    const absent = await run('docker', ['ps', '-a', '--filter', 'label=codex.task=NUTRITION-DIARY-CORRECTNESS-002C1B', '--format', '{{.Names}}']);
    const cleanupConfirmed = cleanup.every(r => r.status === 'fulfilled') && absent === '';
    if (!cleanupConfirmed || implementationDigest() !== digest) {
        success = false;
        process.exitCode = 1;
    }
    const result = { schemaVersion: 'nutrition-002c1b-qualification/v1', startedAt, completedAt: new Date().toISOString(), ...await sourceIdentity(), trustedBase: BASE, trustedBaseTree: BASE_TREE, node: process.version, image: IMAGE, postgres: '17.6', nativeDump: '17.6', protocol: PROTOCOL, result: success ? 'PASS_LOCAL_BOUNDARY_ARCHITECTURE_BLOCKED' : 'FAIL', failure, failureStage: success ? undefined : phase, cases, cleanupConfirmed, ...classifications(), producerAuthenticated: false, productionAccess: false };
    assertRedactedEvidence(result);
    writeFileSync(output, JSON.stringify(result, null, 2) + '\n', { mode: 0o600, flag: 'wx' });
}
