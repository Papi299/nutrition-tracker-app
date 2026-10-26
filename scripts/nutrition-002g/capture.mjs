import { Session, run } from './process.mjs';
import { CONTRACT, AUTH_VERSION, boundary, literal, identifier, assertEqual, fail, validateIdentity, validatePayload } from './contract.mjs';

// Local superuser-controlled rehearsal only. Catalog locks prevent concurrent
// DDL/ACL/role changes; DML (including Auth writes) continues under MVCC. This
// privilege is deliberately not asserted to exist in a hosted environment.
const catalogs=['pg_class','pg_attribute','pg_proc','pg_constraint','pg_policy','pg_trigger','pg_namespace','pg_type','pg_depend','pg_authid','pg_auth_members','pg_db_role_setting','pg_extension','pg_default_acl','pg_shdepend','pg_index','pg_attrdef','pg_enum','pg_rewrite'];
export const identitySql=`select jsonb_build_object('profile','VERIFIED_EMAIL_NO_FACTORS_V1','authVersion','${AUTH_VERSION}',
 'owners',(select coalesce(jsonb_agg(jsonb_build_object('id',u.id,'email',u.email,'confirmed',u.email_confirmed_at is not null,
 'deleted',u.deleted_at is not null,'banned',u.banned_until>now(),'anonymous',u.is_anonymous,'phone',coalesce(u.phone,''),
 'factors',(select count(*) from auth.mfa_factors f where f.user_id=u.id),'passkeys',(select count(*) from auth.webauthn_credentials f where f.user_id=u.id),
 'identities',(select count(*) from auth.identities i where i.user_id=u.id),
 'provider',(select min(provider) from auth.identities i where i.user_id=u.id),
 'subject',(select min(provider_id) from auth.identities i where i.user_id=u.id),
 'unsupported',(select count(*) from auth.identities i where i.user_id=u.id and provider<>'email')+
 (select count(*) from auth.oauth_clients)+(select count(*) from auth.oauth_consents)+(select count(*) from auth.custom_oauth_providers)+
 (select count(*) from auth.sso_providers)+(select count(*) from auth.sso_domains)+(select count(*) from auth.saml_providers)+
 case when coalesce(u.raw_app_meta_data,'{}')-array['provider','providers']<>'{}'::jsonb or coalesce(u.raw_user_meta_data,'{}') not in ('{}'::jsonb,'{"email_verified":true}'::jsonb) then 1 else 0 end
 ) order by u.id),'[]') from auth.users u));`;
export function normalizeSchema(s) {
 return s.split('\n').filter(l=>!l.startsWith('--')&&!l.startsWith('\\restrict')&&!l.startsWith('\\unrestrict')).map(l=>l.trimEnd()).filter(Boolean).join('\n');
}
export async function schema(e,snapshot) {
 await e.check('db');
 if(snapshot&&!/^[A-F0-9]{8}-[A-F0-9]{8}-[0-9]+$/.test(snapshot))fail('SNAPSHOT_TOKEN');
 return normalizeSchema(await run('docker',['exec','-i',e.ids.get('db'),'pg_dump','-U','supabase_admin','-d','postgres','--schema-only','--schema=public','--schema=private','--schema=ingestion','--schema=auth',...(snapshot?['--snapshot='+snapshot]:[])],{timeoutMs:30000}));
}
const roleSql=`select jsonb_build_object('roles',(select coalesce(jsonb_agg(to_jsonb(r) order by rolname),'[]') from
 (select rolname,rolsuper,rolinherit,rolcreaterole,rolcreatedb,rolcanlogin,rolreplication,rolbypassrls,rolconnlimit,rolconfig from pg_roles) r),
 'members',(select coalesce(jsonb_agg(to_jsonb(m) order by role,member,grantor),'[]') from
 (select r.rolname role,u.rolname member,g.rolname grantor,a.admin_option,a.inherit_option,a.set_option from pg_auth_members a
 join pg_roles r on r.oid=a.roleid join pg_roles u on u.oid=a.member join pg_roles g on g.oid=a.grantor) m),
 'extensions',(select jsonb_agg(jsonb_build_array(extname,extversion,n.nspname) order by extname) from pg_extension e join pg_namespace n on n.oid=e.extnamespace));`;
export async function roleState(e) {return e.sql(roleSql);}
export async function capture(e,count,{afterSnapshot,failReader=false,killExporter=false}={}) {
 await e.check('db');if(e.side!=='source'||e.scope!=='002g')fail('SOURCE_IDENTITY');
 const session=new Session(['exec','-i',e.ids.get('db'),'psql','-XqAt','-v','ON_ERROR_STOP=1','-v','VERBOSITY=sqlstate','-U','supabase_admin','-d','postgres']);
 const query=async sql=>{const lines=await session.query(sql);if(session.closed||session.process.done)fail('EXPORTER_LOST');return lines;};
 try {
  await query("begin isolation level repeatable read; set local lock_timeout='2s'; set local statement_timeout='10s';");
  await query('lock table '+catalogs.map(n=>'pg_catalog.'+n).join(',')+' in share mode;');
  const [snapshot]=await query('select pg_export_snapshot();');
  const migrations=await query('select version from supabase_migrations.schema_migrations order by version;');
  assertEqual(migrations,boundary(count).map(m=>m.version),'LEDGER');
  const tables=JSON.parse((await query(`select jsonb_agg(jsonb_build_object('schema',n.nspname,'name',c.relname,'kind',c.relkind,
   'columns',(select jsonb_agg(a.attname order by a.attnum) from pg_attribute a where a.attrelid=c.oid and a.attnum>0 and not a.attisdropped and a.attgenerated='')) order by n.nspname,c.relname)
   from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname in ('public','ingestion') and c.relkind in ('r','p','S','f');`))[0]);
  if(tables.length!==61||tables.some(t=>t.kind!=='r'))fail('UNSUPPORTED_RELATION');
  const authTables=await query("select quote_ident(table_schema)||'.'||quote_ident(table_name) from information_schema.tables where table_schema='auth' and table_type='BASE TABLE' order by table_name;");
  await query('lock table '+[...tables.map(t=>identifier(t.schema)+'.'+identifier(t.name)),...authTables].join(',')+' in access share mode;');
  const capturedAt=(await query('select transaction_timestamp();'))[0];
  const roles=(await query(roleSql))[0];
  if(afterSnapshot)await afterSnapshot();
  if(killExporter){await query('select pg_terminate_backend(pg_backend_pid());');fail('EXPORTER_SHOULD_FAIL');}
  const application=[];
  for(const t of tables) {
   const name=identifier(t.schema)+'.'+identifier(t.name);
   const rows=JSON.parse((await query(`select coalesce(jsonb_agg(rowtext order by rowtext collate "C"),'[]') from (select row_to_json(t)::text rowtext from ${name} t) r;`))[0]);
   application.push({schema:t.schema,name:t.name,columns:t.columns,rows});
  }
  const identity=JSON.parse((await query(identitySql))[0]);validateIdentity(identity);
  const definition=await schema(e,failReader?'00000000-00000000-0':snapshot);
  await query('select 1;');
  await query('commit;');
  return {contract:CONTRACT,scope:'LOCAL_SYNTHETIC_ONLY',source:e.prefix,boundary:count,capturedAt,migrations,roles,schema:definition,identity,application};
 }finally{await session.close();}
}
export async function restoreRows(e,p,count) {
 validatePayload(p,{source:'nutrition-002g-source',boundary:count});
 await e.check('db');if(e.side!=='target'||e.scope!=='002g')fail('TARGET_IDENTITY');
 assertEqual((await e.sql('select version from supabase_migrations.schema_migrations order by version;')).split('\n'),boundary(count).map(m=>m.version),'TARGET_LEDGER');
 assertEqual(await schema(e),p.schema,'TRUSTED_SCHEMA_MISMATCH');assertEqual(await roleState(e),p.roles,'ROLE_MISMATCH');
 const discovered=JSON.parse(await e.sql(`select jsonb_agg(jsonb_build_object('schema',table_schema,'name',table_name,'columns',(select jsonb_agg(column_name order by ordinal_position) from information_schema.columns c where c.table_schema=t.table_schema and c.table_name=t.table_name and is_generated='NEVER')) order by table_schema,table_name) from information_schema.tables t where table_schema in ('public','ingestion') and table_type='BASE TABLE';`));
 assertEqual(discovered,p.application.map(({schema,name,columns})=>({schema,name,columns})),'TARGET_TABLE_INVENTORY');
 const statements=['begin;set local standard_conforming_strings=on;set local session_replication_role=replica;'];
 statements.push('truncate '+p.application.map(t=>identifier(t.schema)+'.'+identifier(t.name)).join(',')+';');
 for(const t of p.application) {
  const name=identifier(t.schema)+'.'+identifier(t.name),cols=t.columns.map(identifier).join(',');
  for(const row of t.rows)statements.push(`insert into ${name} (${cols}) select ${cols} from json_populate_record(null::${name},${literal(row)}::json);`);
 }
 statements.push('set local session_replication_role=origin;commit;');
 await e.sql(statements.join('\n'));
 for(const t of p.application) {
  const rows=JSON.parse(await e.sql(`select coalesce(jsonb_agg(rowtext order by rowtext collate "C"),'[]') from (select row_to_json(t)::text rowtext from ${identifier(t.schema)}.${identifier(t.name)} t) r;`));
  assertEqual(rows,t.rows,'COMPLETE_ROW_VALUE_MISMATCH');
 }
 // Validate every FK explicitly after trigger-bypassed bulk load.
 const checks=(await e.sql(`select format('select count(*) from %s c where %s and not exists (select 1 from %s p where %s)',conrelid::regclass,
 string_agg(format('c.%I is not null',a.attname),case when confmatchtype='f' then ' or ' else ' and ' end order by k.n),confrelid::regclass,
 string_agg(format('c.%I=p.%I',a.attname,b.attname),' and ' order by k.n)) from pg_constraint
 cross join lateral unnest(conkey,confkey) with ordinality k(x,y,n)
 join pg_attribute a on a.attrelid=conrelid and a.attnum=k.x join pg_attribute b on b.attrelid=confrelid and b.attnum=k.y
 where contype='f' and connamespace in ('public'::regnamespace,'ingestion'::regnamespace) group by pg_constraint.oid;`)).split('\n').filter(Boolean);
 for(const q of checks)assertEqual(await e.sql(q),'0','FOREIGN_KEY');
 assertEqual(await schema(e),p.schema,'RESTORED_SECURITY');
}
