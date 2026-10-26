import assert from 'node:assert/strict';
import { Cluster } from './local.mjs';
import { Snapshot } from './snapshot.mjs';

// Minimal first checkpoint; no replacement catalog engine is required to run it.
export async function minimalExperiment(source) {
  await source.sql("create schema private;create function private.snapshot_probe() returns integer language sql security definer set search_path='' as $$select 314159$$;");
  const lease = await Snapshot.open(source);
  try {
    const reader = await lease.reader();
    await source.sql("create or replace function private.snapshot_probe() returns integer language sql security definer set search_path='' as $$select 271828$$;");
    const raw = await lease.read(reader,"select prosrc from pg_catalog.pg_proc p join pg_catalog.pg_namespace n on n.oid=p.pronamespace where n.nspname='private' and p.proname='snapshot_probe';");
    assert.deepEqual(raw,['select 314159']);
    const helper = await lease.read(reader,"select pg_catalog.pg_get_functiondef('private.snapshot_probe()'::regprocedure);");
    assert.match(helper.join('\n'),/select 271828/);
    const dump = await lease.dump();
    assert.equal(dump.includes('select 314159'),true); assert.equal(dump.includes('select 271828'),false);
  } finally { await lease.close(); await source.sql('drop function private.snapshot_probe();drop schema private;'); }
}
if (process.argv[1]?.endsWith('/nutrition-002c1a/experiment.mjs')) {
  const source = new Cluster('source');
  try { await source.start(); await minimalExperiment(source); process.stdout.write('MINIMAL_HISTORICAL_RAW_HELPER_DUMP_CHECKPOINT_PASS\n'); }
  finally { await source.stop(); }
}
