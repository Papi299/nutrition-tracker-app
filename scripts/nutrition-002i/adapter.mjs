import { Session, run } from '../nutrition-002g/process.mjs';
import {
  CONTRACT, boundary, assertCheckout, assertEqual, hash,
  identifier, literal, validateIdentity, validatePayload, fail,
} from '../nutrition-002g/contract.mjs';
import { identitySql, normalizeSchema } from '../nutrition-002g/capture.mjs';

export const ADAPTER = 'nutrition-002i-hosted-role/v1';
export const catalogs = [
  'pg_class','pg_attribute','pg_proc','pg_constraint','pg_policy','pg_trigger',
  'pg_namespace','pg_type','pg_depend','pg_authid','pg_auth_members',
  'pg_db_role_setting','pg_extension','pg_default_acl','pg_shdepend',
  'pg_index','pg_attrdef','pg_enum','pg_rewrite',
];
const authTables = [
  'users','identities','mfa_factors','webauthn_credentials','oauth_clients',
  'oauth_consents','custom_oauth_providers','sso_providers','sso_domains','saml_providers',
];
const appRoles = [
  'anon','authenticated','authenticator','service_role','ingestion_operator',
  'ingestion_approver','ingestion_definer','ingestion_promotion_definer',
  'ingestion_lifecycle_definer',
];
const roleNames = appRoles.map(literal).join(',');
export const rolesSql = `select jsonb_build_object(
 'roles',(select jsonb_agg(jsonb_build_array(rolname,rolsuper,rolinherit,rolcanlogin,rolbypassrls,rolcreaterole,rolcreatedb,rolreplication) order by rolname)
   from pg_roles where rolname in (${roleNames})),
 'members',(select coalesce(jsonb_agg(jsonb_build_array(r.rolname,u.rolname,a.admin_option,a.inherit_option,a.set_option)
   order by r.rolname,u.rolname),'[]') from pg_auth_members a
   join pg_roles r on r.oid=a.roleid join pg_roles u on u.oid=a.member
   where r.rolname in (${roleNames}) or u.rolname in ('anon','authenticated','authenticator','service_role')),
 'extensions',(select jsonb_agg(jsonb_build_array(e.extname,e.extversion,n.nspname) order by e.extname)
   from pg_extension e join pg_namespace n on n.oid=e.extnamespace
   where e.extname in ('pgcrypto','pg_trgm','supabase_vault')));`;
export const inventorySql = `select jsonb_agg(jsonb_build_object(
 'schema',n.nspname,'name',c.relname,'kind',c.relkind,
 'columns',(select jsonb_agg(a.attname order by a.attnum) from pg_attribute a
   where a.attrelid=c.oid and a.attnum>0 and not a.attisdropped and a.attgenerated=''))
 order by n.nspname,c.relname)
 from pg_class c join pg_namespace n on n.oid=c.relnamespace
 where n.nspname in ('public','ingestion') and c.relkind in ('r','p','v','m','S','f');`;

// Physical tuple/version tags detect catalog updates even when their logical
// values are subsequently restored. No password, role setting or body is read.
export const catalogWitnessSql = 'select jsonb_build_object(' + catalogs.map(name =>
  literal(name) + `,(select coalesce(jsonb_agg(jsonb_build_array(ctid::text,xmin::text,xmax::text)
  order by ctid),'[]') from pg_catalog.${name})`).join(',') + ');';

const readOnly = "begin isolation level repeatable read read only;set local search_path=pg_catalog;set local lock_timeout='2s';set local statement_timeout='10s';";
export async function roleState(e) {
  return e.roleSql('begin read only;set local search_path=pg_catalog;' + rolesSql + 'commit;');
}
export async function schema(e, snapshot) {
  await e.check('db');
  if (snapshot && !/^[A-F0-9]{8}-[A-F0-9]{8}-[0-9]+$/.test(snapshot)) fail('SNAPSHOT_TOKEN');
  return normalizeSchema(await run('docker', ['exec','-i',e.ids.get('db'),'pg_dump',
    '-U','postgres','-d','postgres','--schema-only','--schema=public',
    '--schema=private','--schema=ingestion',...(snapshot ? ['--snapshot=' + snapshot] : [])],
  { timeoutMs: 30000 }));
}
export async function assertRestricted(e) {
  const facts = JSON.parse(await e.roleSql(`select jsonb_build_object(
    'role',current_user,'superuser',r.rolsuper,'bypass',r.rolbypassrls,
    'replica',has_parameter_privilege(current_user,'session_replication_role','SET'),
    'catalogMutation',exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace
      where n.nspname='pg_catalog' and c.relname in (${catalogs.map(literal).join(',')})
      and has_table_privilege(current_user,c.oid,'MAINTAIN,UPDATE,DELETE,TRUNCATE')))
    from pg_roles r where r.rolname=current_user;`));
  assertEqual(facts, {role:'postgres',superuser:false,bypass:true,replica:false,catalogMutation:false}, 'HOSTED_ROLE_PRIVILEGES');
}
async function trusted(e, count) {
  if (!e || e.side !== 'target' || e.scope !== '002i') fail('TRUSTED_TARGET');
  assertCheckout(); await assertRestricted(e);
  assertEqual((await e.roleSql('select version from supabase_migrations.schema_migrations order by version;')).split('\n'),
    boundary(count).map(m => m.version), 'TRUSTED_LEDGER');
  const inventory = JSON.parse(await e.roleSql(inventorySql));
  if (inventory.length !== 61 || inventory.some(t => t.kind !== 'r')) fail('UNSUPPORTED_RELATION');
  return { inventory, schema: await schema(e), roles: await roleState(e) };
}
export async function capture(e, count, { reference, afterSnapshot, failReader=false, killExporter=false } = {}) {
  if (e.side !== 'source' || e.scope !== '002i') fail('SOURCE_IDENTITY');
  const expected = await trusted(reference, count);
  await assertRestricted(e); await e.check('auth');
  const session = new Session(['exec','-i',e.ids.get('db'),'psql','-XqAt','-v',
    'ON_ERROR_STOP=1','-v','VERBOSITY=sqlstate','-U','postgres','-d','postgres']);
  const query = async sql => {
    const rows = await session.query(sql);
    if (session.closed || session.process.done) fail('EXPORTER_LOST');
    return rows;
  };
  try {
    await query(readOnly);
    const before = (await query(catalogWitnessSql))[0];
    const relations = [...expected.inventory.map(t => identifier(t.schema)+'.'+identifier(t.name)),
      ...authTables.map(t => 'auth.'+identifier(t)), 'supabase_migrations.schema_migrations'];
    await query('lock table '+relations.join(',')+' in access share mode;');
    const [snapshot] = await query('select pg_export_snapshot();');
    const migrations = await query('select version from supabase_migrations.schema_migrations order by version;');
    assertEqual(migrations, boundary(count).map(m => m.version), 'LEDGER');
    assertEqual(JSON.parse((await query(inventorySql))[0]), expected.inventory, 'SOURCE_TABLE_INVENTORY');
    const capturedAt = (await query('select transaction_timestamp();'))[0];
    if (afterSnapshot) await afterSnapshot();
    if (killExporter) { await query('select pg_terminate_backend(pg_backend_pid());'); fail('EXPORTER_SHOULD_FAIL'); }
    const application = [];
    for (const t of expected.inventory) {
      const name = identifier(t.schema)+'.'+identifier(t.name);
      const rows = JSON.parse((await query(`select coalesce(jsonb_agg(rowtext order by rowtext collate "C"),'[]')
        from (select row_to_json(t)::text rowtext from ${name} t) r;`))[0]);
      application.push({schema:t.schema,name:t.name,columns:t.columns,rows});
    }
    const identity = JSON.parse((await query(identitySql))[0]); validateIdentity(identity);
    const definition = await schema(e, failReader ? '00000000-00000000-0' : snapshot);
    const roles = (await query(rolesSql))[0];
    // Fresh visibility is essential: repeating this read inside the exported
    // snapshot would hide committed catalog changes and incorrectly accept ABA.
    const after = await e.roleSql('begin read only;set local search_path=pg_catalog;' + catalogWitnessSql + 'commit;');
    assertEqual(after, before, 'CATALOG_CHANGED_DURING_CAPTURE');
    assertEqual(definition, expected.schema, 'TRUSTED_SCHEMA_MISMATCH');
    assertEqual(roles, expected.roles, 'ROLE_MISMATCH');
    await query('select 1;'); await query('commit;');
    return {contract:CONTRACT,adapter:ADAPTER,scope:'LOCAL_SYNTHETIC_ONLY',source:e.prefix,
      boundary:count,capturedAt,migrations,schema:definition,roles,identity,application,
      captureProof:{role:'postgres',catalogWitnessSha256:hash(before),catalogStable:true}};
  } finally { await session.close(); }
}
export async function restoreRows(e, payload, count) {
  if (e.side !== 'target' || e.scope !== '002i') fail('TARGET_IDENTITY');
  validatePayload(payload, {source:'nutrition-002i-source',boundary:count});
  if (payload.adapter !== ADAPTER || payload.captureProof?.role !== 'postgres' ||
      payload.captureProof.catalogStable !== true || !/^[a-f0-9]{64}$/.test(payload.captureProof.catalogWitnessSha256)) fail('CAPTURE_PROOF');
  const expected = await trusted(e, count);
  assertEqual(payload.schema, expected.schema, 'TRUSTED_SCHEMA_MISMATCH');
  assertEqual(payload.roles, expected.roles, 'ROLE_MISMATCH');
  assertEqual(payload.application.map(({schema,name,columns}) => ({schema,name,kind:'r',columns})),
    expected.inventory, 'TARGET_TABLE_INVENTORY');
  // Only definitions obtained from independent trusted target replay are used.
  // Archive schema text is comparison evidence and never becomes executable SQL.
  const objects = JSON.parse(await e.roleSql('begin read only;set local search_path=pg_catalog;' + `select jsonb_build_object(
    'fks',(select coalesce(jsonb_agg(jsonb_build_object('table',c.conrelid::regclass::text,
      'name',c.conname,'validated',c.convalidated,'definition',pg_get_constraintdef(c.oid)) order by c.conrelid::regclass::text,c.conname),'[]')
      from pg_constraint c join pg_namespace n on n.oid=c.connamespace
      where n.nspname in ('public','ingestion') and c.contype='f'),
    'triggers',(select coalesce(jsonb_agg(jsonb_build_object('table',t.tgrelid::regclass::text,
      'name',t.tgname,'enabled',t.tgenabled) order by t.tgrelid::regclass::text,t.tgname),'[]')
      from pg_trigger t join pg_class c on c.oid=t.tgrelid join pg_namespace n on n.oid=c.relnamespace
      where n.nspname in ('public','ingestion') and not t.tgisinternal));` + 'commit;'));
  if (objects.triggers.some(t => t.enabled !== 'O')) fail('UNSUPPORTED_TRIGGER_MODE');
  if (objects.fks.some(c => c.validated !== true)) fail('UNVALIDATED_TRUSTED_FOREIGN_KEY');
  const tableName = name => {
    const parts = name.split('.');
    if (parts.length !== 2 || !['public','ingestion'].includes(parts[0]) ||
        !expected.inventory.some(t => t.schema===parts[0] && t.name===parts[1])) fail('TRUSTED_RELATION_NAME');
    return parts.map(identifier).join('.');
  };
  const tables = expected.inventory.map(t => identifier(t.schema)+'.'+identifier(t.name)).join(',');
  const sql = ["begin;set local search_path=pg_catalog;set local standard_conforming_strings=on;set local lock_timeout='2s';set local statement_timeout='30s';",
    'lock table '+tables+' in access exclusive mode;'];
  for (const t of expected.inventory) sql.push('alter table '+tableName(t.schema+'.'+t.name)+' disable trigger user;');
  for (const c of objects.fks) sql.push('alter table '+tableName(c.table)+' drop constraint '+identifier(c.name)+';');
  sql.push('truncate '+tables+';');
  for (const t of payload.application) {
    const name = tableName(t.schema+'.'+t.name), cols = t.columns.map(identifier).join(',');
    for (const row of t.rows) sql.push(`insert into ${name} (${cols}) select ${cols} from json_populate_record(null::${name},${literal(row)}::json);`);
  }
  for (const c of objects.fks) sql.push('alter table '+tableName(c.table)+' add constraint '+identifier(c.name)+' '+c.definition+';');
  for (const t of expected.inventory) sql.push('alter table '+tableName(t.schema+'.'+t.name)+' enable trigger user;');
  sql.push('commit;');
  await e.roleSql(sql.join('\n'));
  for (const t of payload.application) {
    const rows = JSON.parse(await e.roleSql(`select coalesce(jsonb_agg(rowtext order by rowtext collate "C"),'[]')
      from (select row_to_json(t)::text rowtext from ${tableName(t.schema+'.'+t.name)} t) r;`));
    assertEqual(rows, t.rows, 'COMPLETE_ROW_VALUE_MISMATCH');
  }
  assertEqual(await schema(e), expected.schema, 'RESTORED_SECURITY');
  assertEqual(await roleState(e), expected.roles, 'RESTORED_ROLES');
}
