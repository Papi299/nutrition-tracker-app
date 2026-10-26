import assert from 'node:assert/strict';
import test from 'node:test';
import { assertRuntime,requireFullHistoricalCatalog,rawSql,observeSnapshot } from './catalog.mjs';
import { Cluster } from './local.mjs';
import { Snapshot } from './snapshot.mjs';

test('local identity, exact versions and full-capture refusal',async()=>{
  assertRuntime({database:'postgres',postgres:'170006',nativeDump:'17.6'});
  for(const value of [{database:'other',postgres:'170006',nativeDump:'17.6'},
    {database:'postgres',postgres:'170007',nativeDump:'17.6'},
    {database:'postgres',postgres:'170006',nativeDump:'18.0'}]) assert.throws(()=>assertRuntime(value),/N002C1A_/);
  assert.throws(()=>new Cluster('Production'),/TARGET_DENIED/);
  assert.throws(()=>new Cluster('source').args(),/CLUSTER_NOT_STARTED/);
  await assert.rejects(Snapshot.open({}),/LOCAL_CLUSTER_REQUIRED/);
  await assert.rejects(observeSnapshot({},{}),/LOCAL_SNAPSHOT_REQUIRED/);
  assert.throws(requireFullHistoricalCatalog,/FULL_HISTORICAL_MAPPING_UNQUALIFIED/);
  assert.match(rawSql(),/aclexplode/);
});
