// This is an encrypted/restricted observation, never public evidence. Raw pg_*
// tuples preserve their MVCC view. No pg_get_functiondef/has_*_privilege call is
// used to pretend that a deparser or privilege helper has historical semantics.
export const CATALOG_SQL = `
with ns as (select oid from pg_catalog.pg_namespace where nspname in ('public','private','ingestion')),
rels as (select c.oid from pg_catalog.pg_class c where c.relnamespace in(select oid from ns)
  or (c.relnamespace=(select oid from pg_catalog.pg_namespace where nspname='auth')
      and c.relname in ('users','identities','mfa_factors','webauthn_credentials'))),
funcs as (select oid from pg_catalog.pg_proc where pronamespace in(select oid from ns))
select jsonb_build_object(
 'version','nutrition-002c-raw-catalog/v1',
 'roles',(select coalesce(jsonb_agg(to_jsonb(r)-'rolpassword' order by oid),'[]') from pg_catalog.pg_authid r),
 'memberships',(select coalesce(jsonb_agg(to_jsonb(r) order by oid),'[]') from pg_catalog.pg_auth_members r),
 'settings',(select coalesce(jsonb_agg(to_jsonb(r) order by setdatabase,setrole),'[]') from pg_catalog.pg_db_role_setting r),
 'database',(select to_jsonb(r)-'datfrozenxid'-'datminmxid' from pg_catalog.pg_database r where datname=current_database()),
 'namespaces',(select coalesce(jsonb_agg(to_jsonb(r) order by oid),'[]') from pg_catalog.pg_namespace r where oid in(select oid from ns)),
 'relations',(select coalesce(jsonb_agg(to_jsonb(r)-'relpages'-'reltuples'-'relallvisible'-'relfrozenxid'-'relminmxid' order by oid),'[]') from pg_catalog.pg_class r where oid in(select oid from rels)),
 'columns',(select coalesce(jsonb_agg(to_jsonb(r) order by attrelid,attnum),'[]') from pg_catalog.pg_attribute r where attrelid in(select oid from rels) and attnum>0),
 'functions',(select coalesce(jsonb_agg(to_jsonb(r) order by oid),'[]') from pg_catalog.pg_proc r where oid in(select oid from funcs)),
 'defaults',(select coalesce(jsonb_agg(to_jsonb(r) order by oid),'[]') from pg_catalog.pg_default_acl r),
 'policies',(select coalesce(jsonb_agg(to_jsonb(r) order by oid),'[]') from pg_catalog.pg_policy r where polrelid in(select oid from rels)),
 'constraints',(select coalesce(jsonb_agg(to_jsonb(r) order by oid),'[]') from pg_catalog.pg_constraint r where conrelid in(select oid from rels)),
 'triggers',(select coalesce(jsonb_agg(to_jsonb(r) order by oid),'[]') from pg_catalog.pg_trigger r where tgrelid in(select oid from rels)),
 'expressions',(select coalesce(jsonb_agg(to_jsonb(r) order by oid),'[]') from pg_catalog.pg_attrdef r where adrelid in(select oid from rels)),
 'rewrites',(select coalesce(jsonb_agg(to_jsonb(r) order by oid),'[]') from pg_catalog.pg_rewrite r where ev_class in(select oid from rels)),
 'dependencies',(select coalesce(jsonb_agg(to_jsonb(r) order by classid,objid,objsubid,refclassid,refobjid,refobjsubid,deptype),'[]') from pg_catalog.pg_depend r
    where (classid='pg_class'::regclass and objid in(select oid from rels))
       or (classid='pg_proc'::regclass and objid in(select oid from funcs))),
 'sharedDependencies',(select coalesce(jsonb_agg(to_jsonb(r) order by dbid,classid,objid,objsubid,refclassid,refobjid,deptype),'[]') from pg_catalog.pg_shdepend r
    where dbid=(select oid from pg_catalog.pg_database where datname=current_database())
      and ((classid='pg_class'::regclass and objid in(select oid from rels))
       or (classid='pg_proc'::regclass and objid in(select oid from funcs))
       or (classid='pg_namespace'::regclass and objid in(select oid from ns))))
);`;

export const TABLES_SQL = `select n.nspname,c.relname,c.relkind from pg_catalog.pg_class c
join pg_catalog.pg_namespace n on n.oid=c.relnamespace
where n.nspname in ('public','ingestion') and c.relkind in ('r','p','f') order by 1,2;`;

// Include scoped sequences, owned sequences and nextval dependencies of defaults.
// Arbitrary dynamic sequence lookup in functions is deliberately unsupported.
export const SEQUENCES_SQL = `with selected as (
 select c.oid from pg_catalog.pg_class c join pg_catalog.pg_namespace n on n.oid=c.relnamespace
 where n.nspname in ('public','private','ingestion')
 or (n.nspname='auth' and c.relname in ('users','identities','mfa_factors','webauthn_credentials'))
)
select n.nspname,c.relname from pg_catalog.pg_class c
join pg_catalog.pg_namespace n on n.oid=c.relnamespace where c.relkind='S' and (
 n.nspname in ('public','private','ingestion') or exists (
 select 1 from pg_catalog.pg_depend d where d.objid=c.oid and d.classid='pg_class'::regclass
   and d.refclassid='pg_class'::regclass and d.refobjid in(select oid from selected)) or exists (
 select 1 from pg_catalog.pg_depend d join pg_catalog.pg_attrdef a on a.oid=d.objid
 where d.classid='pg_attrdef'::regclass and d.refclassid='pg_class'::regclass and d.refobjid=c.oid
   and a.adrelid in(select oid from selected))) order by 1,2;`;

export const UNSUPPORTED_SQL = `select 'function_allocator' from pg_catalog.pg_proc p
join pg_catalog.pg_namespace n on n.oid=p.pronamespace
where n.nspname in ('public','private','ingestion') and p.prosrc ~* '\\m(nextval|setval)\\M'
union all select 'external_or_partitioned_relation' from pg_catalog.pg_class c
join pg_catalog.pg_namespace n on n.oid=c.relnamespace
where n.nspname in ('public','private','ingestion') and (c.relkind in ('p','f','m') or c.relispartition
  or (n.nspname='private' and c.relkind='r'));`;

export function inspectRawCatalog(value) {
  if (value?.version !== 'nutrition-002c-raw-catalog/v1') throw new Error('N002C_CATALOG_CONTRACT_MISMATCH');
  for (const key of ['roles','memberships','settings','namespaces','relations','columns','functions','defaults','policies','constraints','triggers','expressions','rewrites','dependencies','sharedDependencies']) {
    if (!Array.isArray(value[key])) throw new Error('N002C_CATALOG_INCOMPLETE');
  }
  if (value.roles.some(r => Object.hasOwn(r,'rolpassword'))) throw new Error('N002C_ROLE_CREDENTIAL_DISCLOSURE');
  for (const f of value.functions) {
    if (f.prosecdef && !(f.proconfig ?? []).some(c => c === 'search_path=""' || c === 'search_path=')) {
      throw new Error('N002C_DEFINER_SEARCH_PATH_UNSAFE');
    }
  }
  return value;
}
