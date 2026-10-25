import { readFileSync } from 'node:fs';
import { isDeepStrictEqual } from 'node:util';
import { createHash } from 'node:crypto';
import { Cluster } from './local.mjs';

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8');
const manifest = JSON.parse(read('../../ops/recovery/nutrition-002c/overlay-v1.json'));
const inventory = JSON.parse(read('../../ops/recovery/nutrition-002c/gate-inventory.json')).tables;
const fail = () => { throw new Error('N002C1_OVERLAY_NOT_FRESH_CLOSED'); };
const identifier = value => {
  if (!/^[a-z_][a-z_0-9]{0,62}$/.test(value)) fail();
  return '"' + value + '"';
};
export function overlaySource() {
  const sql = read('../../ops/recovery/nutrition-002c/overlay-v1.sql');
  if (manifest.sqlSha256 !== '3930aa88b689294dccf90dd26cdf3a0b3e0183e5679a21043a11124fa1bd5463' ||
    createHash('sha256').update(sql).digest('hex') !== manifest.sqlSha256 || !sql.endsWith('commit;\n')) fail();
  return sql;
}
export const FRESH_STATE_SQL = `select jsonb_build_object(
  'control',(select jsonb_build_object('version',overlay_version,'source',expected_source,'epoch',epoch,'state',state,'attempt',attempt_id,'reconciliation',reconciliation) from recovery_ops.control where singleton),
  'controlRows',(select count(*) from recovery_ops.control),
  'closed',(select closed from recovery_ops.gate where singleton),
  'gateRows',(select count(*) from recovery_ops.gate),
  'attempts',(select count(*) from recovery_ops.attempts),
  'participants',(select count(*) from recovery_ops.participants));`;
export function assertFreshState(state) {
  if (!isDeepStrictEqual(state, {
    control:{version:'nutrition-002c-overlay/v1',source:null,epoch:0,state:'RECONCILIATION_REQUIRED',attempt:null,reconciliation:'FRESH_INSTALL_REQUIRES_LOCAL_REVIEW'},
    controlRows:1,closed:true,gateRows:1,attempts:0,participants:0,
  })) fail();
  return { state:'RECONCILIATION_REQUIRED', gateClosed:true, liveAuthorityRestored:false };
}
export async function verifyFreshLocalState(cluster) {
  if (!(cluster instanceof Cluster)) fail();
  await cluster.verify();
  return assertFreshState(JSON.parse(await cluster.sql(FRESH_STATE_SQL)));
}
export async function installFreshLocalOverlay(cluster) {
  if (!(cluster instanceof Cluster)) fail();
  await cluster.verify();
  if (await cluster.sql("select count(*) from pg_namespace where nspname='recovery_ops';") !== '0' ||
    await cluster.sql("select count(*) from pg_roles where rolname='nutrition_recovery_owner';") !== '0') fail();
  const tables = (await cluster.sql(`select n.nspname||'.'||c.relname from pg_class c join pg_namespace n on n.oid=c.relnamespace
    where n.nspname in ('public','ingestion') and c.relkind='r' and not c.relispartition order by 1;`)).split('\n');
  if (JSON.stringify(tables) !== JSON.stringify(inventory)) fail();
  if (await cluster.sql(`select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace
    where n.nspname in ('public','ingestion') and (c.relispartition or c.relkind in ('p','f','m','S'));`) !== '0') fail();
  // Compose the checksum-verified source transaction with the exact 61-table
  // gate installation before its one COMMIT. No migration or v1 source edit.
  let sql = overlaySource().slice(0,-'commit;\n'.length);
  for (const table of tables) {
    const [schema, name] = table.split('.');
    const qualified = `${identifier(schema)}.${identifier(name)}`;
    sql += `create trigger nutrition002c_write_gate before insert or update or delete or truncate on ${qualified}
      for each statement execute function recovery_ops.enforce_gate();
      alter table ${qualified} enable always trigger nutrition002c_write_gate;
      insert into recovery_ops.gated_tables values('${schema}','${name}');\n`;
  }
  await cluster.sql(sql+'commit;');
  await verifyFreshLocalState(cluster);
  return {installed:true,tableCoverage:61,gateClosed:true,liveAuthorityRestored:false};
}

// Fixture rollback only. A used overlay or unresolved attempt is never cleared.
// Whole disposable-cluster disposal remains the fallback after ambiguous work.
export async function removeUnusedLocalOverlay(cluster) {
  await verifyFreshLocalState(cluster);
  let sql='begin;';
  for (const table of inventory) {
    sql+=`drop trigger nutrition002c_write_gate on ${table.split('.').map(identifier).join('.')};`;
  }
  await cluster.sql(sql+'drop schema recovery_ops cascade;drop role nutrition_recovery_owner;commit;');
}
