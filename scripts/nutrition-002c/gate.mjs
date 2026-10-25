import { LocalDatabase, identifier, verifyLocalTarget, reject } from './local-postgres.mjs';
import { TABLES_SQL } from './catalog.mjs';
import { verifyLocalOverlay } from './overlay.mjs';

// Standalone local installer: not called by ordinary capture. Application table
// ownership/RLS/grants are untouched. Partitions/foreign tables are unsupported.
export async function installLocalGate() {
  await verifyLocalTarget();
  const db = new LocalDatabase();
  const inventory = (await db.sql(TABLES_SQL)).split('\n').filter(Boolean).map(row=>row.split('|'));
  if (!inventory.length || inventory.some(([s,t,k])=>!['public','ingestion'].includes(s)||!t||k!=='r')) reject('N002C_GATE_INVENTORY_UNSUPPORTED');
  if ((await db.sql(`select count(*) from pg_catalog.pg_class c join pg_catalog.pg_namespace n on n.oid=c.relnamespace
    where n.nspname in ('public','ingestion') and (c.relispartition or c.relkind in ('p','f'));`)) !== '0') reject('N002C_GATE_PARTITIONS_UNSUPPORTED');
  let sql = 'begin;';
  for (const [s,t] of inventory) {
    const table = `${identifier(s)}.${identifier(t)}`;
    sql += `create trigger nutrition002c_write_gate before insert or update or delete or truncate on ${table}
      for each statement execute function recovery_ops.enforce_gate();
      alter table ${table} enable always trigger nutrition002c_write_gate;
      insert into recovery_ops.gated_tables values('${s}','${t}');`;
  }
  await db.sql(sql+'commit;');
  return inventory.map(([s,t])=>`${s}.${t}`);
}

export async function verifyLocalGate() {
  await verifyLocalTarget();
  await verifyLocalOverlay();
  const db = new LocalDatabase();
  const bad = await db.sql(`with expected as (
    select n.nspname,c.relname,c.oid,c.relkind,c.relispartition from pg_catalog.pg_class c
      join pg_catalog.pg_namespace n on n.oid=c.relnamespace where n.nspname in ('public','ingestion') and c.relkind in ('r','p','f'))
    select count(*) from expected e full join recovery_ops.gated_tables g on g.schema_name=e.nspname and g.table_name=e.relname
    left join pg_catalog.pg_trigger t on t.tgrelid=e.oid and t.tgname='nutrition002c_write_gate'
    where e.oid is null or g.table_name is null or e.relkind<>'r' or e.relispartition
      or t.oid is null or t.tgenabled<>'A' or t.tgtype<>62
      or t.tgfoid<>'recovery_ops.enforce_gate()'::regprocedure;`);
  if (bad !== '0') reject('N002C_GATE_COVERAGE_MISMATCH');
}

export async function closeLocalGate() {
  await verifyLocalGate();
  // UPDATE conflicts with every admitted mutation's FOR SHARE row lock. Commit
  // waits for those transactions, then all new statements see the closed state.
  await new LocalDatabase().sql(`update recovery_ops.gate set closed=true,reason='LOCAL_REVIEWED_CUTOVER',changed_at=clock_timestamp() where singleton;`);
}

export async function reopenLocalGate() {
  await verifyLocalGate();
  const db = new LocalDatabase(), owner = await db.session('n002c_gate_reopen');
  try {
    if ((await owner.query('select pg_try_advisory_lock(2002003,1);'))[0] !== 't') reject('N002C_ADMINISTRATIVE_COLLISION');
    await owner.query(`begin;
      do $$ begin if not exists(select 1 from recovery_ops.control where singleton and state='IDLE' and attempt_id is null) then
        raise exception 'N002C_REOPEN_REQUIRES_RECONCILIATION'; end if; end $$;
      update recovery_ops.gate set closed=false,reason='EXPLICIT_LOCAL_REVIEWED_REOPEN',changed_at=clock_timestamp() where singleton;
      commit;`);
  } finally { await owner.close(); }
}
