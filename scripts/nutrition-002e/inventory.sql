-- Expected metadata from trusted local replay only. No application/Auth rows,
-- role passwords, Vault values, snapshot tokens or backend identities are read.
begin read only;
set local search_path='';
set local statement_timeout='15000';
with tables as (
 select c.*, n.nspname from pg_catalog.pg_class c join pg_catalog.pg_namespace n on n.oid=c.relnamespace
 where c.relkind='r' and (n.nspname in ('public','ingestion') or
 (n.nspname='auth' and c.relname in ('users','identities','mfa_factors','webauthn_credentials')))
)
select jsonb_agg(jsonb_build_object(
 'table',t.nspname||'.'||t.relname,'owner',t.relowner::regrole::text,
 'rls',t.relrowsecurity,'forceRls',t.relforcerowsecurity,'acl',t.relacl::text,
 'columns',(select jsonb_agg(jsonb_build_object('name',a.attname,'ordinal',a.attnum,
  'type',pg_catalog.format_type(a.atttypid,a.atttypmod),'notNull',a.attnotnull,
  'identity',a.attidentity,'generated',a.attgenerated,'acl',a.attacl::text,
  'default',pg_catalog.pg_get_expr(d.adbin,d.adrelid,false)) order by a.attnum)
  from pg_catalog.pg_attribute a left join pg_catalog.pg_attrdef d on d.adrelid=a.attrelid and d.adnum=a.attnum
  where a.attrelid=t.oid and a.attnum>0 and not a.attisdropped),
 'constraints',(select coalesce(jsonb_agg(jsonb_build_object('name',c.conname,'kind',c.contype,
  'definition',pg_catalog.pg_get_constraintdef(c.oid,false),'validated',c.convalidated,
  'deferrable',c.condeferrable,'deferred',c.condeferred) order by c.conname),'[]')
  from pg_catalog.pg_constraint c where c.conrelid=t.oid),
 'policies',(select coalesce(jsonb_agg(jsonb_build_object('name',p.polname,'command',p.polcmd,
  'permissive',p.polpermissive,'roles',(select jsonb_agg(case when r=0 then 'PUBLIC' else r::regrole::text end order by r::regrole::text) from unnest(p.polroles) r),
  'using',pg_catalog.pg_get_expr(p.polqual,p.polrelid,false),'check',pg_catalog.pg_get_expr(p.polwithcheck,p.polrelid,false)) order by p.polname),'[]')
  from pg_catalog.pg_policy p where p.polrelid=t.oid),
 'triggers',(select coalesce(jsonb_agg(jsonb_build_object('name',g.tgname,'enabled',g.tgenabled,
  'definition',pg_catalog.pg_get_triggerdef(g.oid,false)) order by g.tgname),'[]')
  from pg_catalog.pg_trigger g where g.tgrelid=t.oid and not g.tgisinternal)
) order by t.nspname,t.relname) from tables t;
rollback;
