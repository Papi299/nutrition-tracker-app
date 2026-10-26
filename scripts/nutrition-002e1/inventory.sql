-- Fixed metadata only. Never select user, factor, token, key or audit rows.
begin read only;
set local search_path='';
set local statement_timeout='15000';
with relations as (
 select c.*,n.nspname from pg_catalog.pg_class c join pg_catalog.pg_namespace n on n.oid=c.relnamespace
 where n.nspname='auth' and c.relkind in ('r','p','v','m','f')
), tables as (
 select jsonb_build_object('name',t.relname,'kind',t.relkind,'owner',t.relowner::regrole::text,
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
 'indexes',(select coalesce(jsonb_agg(jsonb_build_object('name',c.relname,'definition',pg_catalog.pg_get_indexdef(i.indexrelid),
  'valid',i.indisvalid,'ready',i.indisready) order by c.relname),'[]') from pg_catalog.pg_index i
  join pg_catalog.pg_class c on c.oid=i.indexrelid where i.indrelid=t.oid),
 'policies',(select coalesce(jsonb_agg(jsonb_build_object('name',p.polname,'command',p.polcmd,'permissive',p.polpermissive,
  'roles',(select jsonb_agg(case when r=0 then 'PUBLIC' else r::regrole::text end order by r::regrole::text) from unnest(p.polroles) r),
  'using',pg_catalog.pg_get_expr(p.polqual,p.polrelid,false),'check',pg_catalog.pg_get_expr(p.polwithcheck,p.polrelid,false)) order by p.polname),'[]')
  from pg_catalog.pg_policy p where p.polrelid=t.oid),
 'triggers',(select coalesce(jsonb_agg(jsonb_build_object('name',g.tgname,'enabled',g.tgenabled,
  'definition',pg_catalog.pg_get_triggerdef(g.oid,false)) order by g.tgname),'[]')
  from pg_catalog.pg_trigger g where g.tgrelid=t.oid and not g.tgisinternal)) as value,t.relname from relations t
)
select jsonb_build_object(
 'migrations',(select jsonb_agg(version order by version) from auth.schema_migrations),
 'tables',(select jsonb_agg(value order by relname) from tables),
 'schema',(select jsonb_build_object('owner',n.nspowner::regrole::text,'acl',n.nspacl::text) from pg_catalog.pg_namespace n where n.nspname='auth'),
 'sequences',(select coalesce(jsonb_agg(jsonb_build_object('name',c.relname,'owner',c.relowner::regrole::text,'acl',c.relacl::text,
  'type',pg_catalog.format_type(s.seqtypid,null),'start',s.seqstart::text,'increment',s.seqincrement::text,
  'min',s.seqmin::text,'max',s.seqmax::text,'cache',s.seqcache::text,'cycle',s.seqcycle) order by c.relname),'[]')
  from pg_catalog.pg_sequence s join pg_catalog.pg_class c on c.oid=s.seqrelid join pg_catalog.pg_namespace n on n.oid=c.relnamespace where n.nspname='auth'),
 'functions',(select coalesce(jsonb_agg(jsonb_build_object('name',p.proname,'arguments',pg_catalog.pg_get_function_identity_arguments(p.oid),
  'definition',pg_catalog.pg_get_functiondef(p.oid),'owner',p.proowner::regrole::text,'acl',p.proacl::text) order by p.proname,pg_catalog.pg_get_function_identity_arguments(p.oid)),'[]')
  from pg_catalog.pg_proc p join pg_catalog.pg_namespace n on n.oid=p.pronamespace where n.nspname='auth' and p.prokind in ('f','p')),
 'enums',(select coalesce(jsonb_agg(jsonb_build_object('name',t.typname,'labels',(select jsonb_agg(e.enumlabel order by e.enumsortorder) from pg_catalog.pg_enum e where e.enumtypid=t.oid)) order by t.typname),'[]')
  from pg_catalog.pg_type t join pg_catalog.pg_namespace n on n.oid=t.typnamespace where n.nspname='auth' and t.typtype='e'),
 'extensions',(select jsonb_agg(jsonb_build_object('name',e.extname,'version',e.extversion,'schema',n.nspname) order by e.extname)
  from pg_catalog.pg_extension e join pg_catalog.pg_namespace n on n.oid=e.extnamespace),
 'defaultAcls',(select coalesce(jsonb_agg(jsonb_build_object('role',d.defaclrole::regrole::text,'kind',d.defaclobjtype,'acl',d.defaclacl::text) order by d.defaclrole::regrole::text,d.defaclobjtype),'[]')
  from pg_catalog.pg_default_acl d join pg_catalog.pg_namespace n on n.oid=d.defaclnamespace where n.nspname='auth')
);
rollback;
