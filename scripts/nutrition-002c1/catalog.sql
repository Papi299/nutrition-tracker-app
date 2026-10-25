-- LIVE, isolated-local observations only. Deparsers are not historical readers.
begin;
set local search_path='';
set local statement_timeout='15000';
create function pg_temp.addr(c oid,o oid,s integer default 0) returns jsonb
language plpgsql as $$
declare a record; t record;
begin
 if o=0 then return null; end if;
 if c='pg_catalog.pg_trigger'::regclass then
   select * into t from pg_catalog.pg_trigger where oid=o;
   if t.tgisinternal then
     if t.tgconstraint=0 then raise exception 'unsupported internal trigger'; end if;
     return jsonb_build_array('internal-trigger',pg_temp.addr('pg_catalog.pg_constraint'::regclass,t.tgconstraint),t.tgtype);
   end if;
 end if;
 select * into strict a from pg_catalog.pg_identify_object_as_address(c,o,s);
 if a.type is null or a.object_names is null then raise exception 'unresolved object'; end if;
 return jsonb_build_array(a.type,a.object_names,a.object_args);
end $$;
create function pg_temp.acl(a aclitem[],k "char",o oid) returns jsonb
language sql as $$
 select coalesce(jsonb_agg(jsonb_build_array(
   (select rolname from pg_catalog.pg_roles where oid=x.grantor),
   case when x.grantee=0 then 'PUBLIC' else (select rolname from pg_catalog.pg_roles where oid=x.grantee) end,
   x.privilege_type,x.is_grantable) order by x.grantor::regrole::text,
   case when x.grantee=0 then 'PUBLIC' else x.grantee::regrole::text end,x.privilege_type,x.is_grantable),'[]')
 from (select coalesce(a,case when k is not null then pg_catalog.acldefault(k,o) else null end) v) d, lateral pg_catalog.aclexplode(case when cardinality(d.v)>0 then d.v else null end) x
$$;
with ns as (
 select oid from pg_catalog.pg_namespace where nspname in ('public','private','ingestion','recovery_ops','auth','extensions','vault')
), objects as (
 select 'pg_catalog.pg_namespace'::regclass::oid c,oid o from pg_catalog.pg_namespace where oid in(select oid from ns)
 union all select 'pg_catalog.pg_class'::regclass,oid from pg_catalog.pg_class where relnamespace in(select oid from ns)
 union all select 'pg_catalog.pg_proc'::regclass,oid from pg_catalog.pg_proc where pronamespace in(select oid from ns)
 union all select 'pg_catalog.pg_operator'::regclass,oid from pg_catalog.pg_operator where oprnamespace in(select oid from ns)
 union all select 'pg_catalog.pg_opclass'::regclass,oid from pg_catalog.pg_opclass where opcnamespace in(select oid from ns)
 union all select 'pg_catalog.pg_opfamily'::regclass,oid from pg_catalog.pg_opfamily where opfnamespace in(select oid from ns)
 union all select 'pg_catalog.pg_amop'::regclass,a.oid from pg_catalog.pg_amop a join pg_catalog.pg_opfamily f on f.oid=a.amopfamily where f.opfnamespace in(select oid from ns)
 union all select 'pg_catalog.pg_amproc'::regclass,a.oid from pg_catalog.pg_amproc a join pg_catalog.pg_opfamily f on f.oid=a.amprocfamily where f.opfnamespace in(select oid from ns)
 union all select 'pg_catalog.pg_extension'::regclass,oid from pg_catalog.pg_extension
 union all select 'pg_catalog.pg_default_acl'::regclass,oid from pg_catalog.pg_default_acl

 union all select 'pg_catalog.pg_type'::regclass,oid from pg_catalog.pg_type where typnamespace in(select oid from ns)
 union all select 'pg_catalog.pg_constraint'::regclass,oid from pg_catalog.pg_constraint where connamespace in(select oid from ns)
 union all select 'pg_catalog.pg_trigger'::regclass,t.oid from pg_catalog.pg_trigger t join pg_catalog.pg_class c on c.oid=t.tgrelid where c.relnamespace in(select oid from ns)
 union all select 'pg_catalog.pg_policy'::regclass,p.oid from pg_catalog.pg_policy p join pg_catalog.pg_class c on c.oid=p.polrelid where c.relnamespace in(select oid from ns)
 union all select 'pg_catalog.pg_attrdef'::regclass,a.oid from pg_catalog.pg_attrdef a join pg_catalog.pg_class c on c.oid=a.adrelid where c.relnamespace in(select oid from ns)
 union all select 'pg_catalog.pg_rewrite'::regclass,r.oid from pg_catalog.pg_rewrite r join pg_catalog.pg_class c on c.oid=r.ev_class where c.relnamespace in(select oid from ns)
), rows as (
 select 'roles' section,rolname::text key,to_jsonb(r)-'oid'-'rolpassword' value from pg_catalog.pg_authid r
 union all select 'memberships',jsonb_build_array(r.roleid::regrole::text,r.member::regrole::text,r.grantor::regrole::text)::text,
   jsonb_build_object('role',r.roleid::regrole::text,'member',r.member::regrole::text,'grantor',r.grantor::regrole::text,'admin',r.admin_option,'inherit',r.inherit_option,'set',r.set_option) from pg_catalog.pg_auth_members r

 union all select 'casts',jsonb_build_array(pg_temp.addr('pg_catalog.pg_type'::regclass,castsource),pg_temp.addr('pg_catalog.pg_type'::regclass,casttarget))::text,jsonb_build_object('function',pg_temp.addr('pg_catalog.pg_proc'::regclass,castfunc),'context',castcontext,'method',castmethod) from pg_catalog.pg_cast
 union all select 'parameterACLs',parname,jsonb_build_object('acl',pg_temp.acl(paracl,null,0)) from pg_catalog.pg_parameter_acl
 union all select 'eventTriggers',evtname,jsonb_build_object('owner',evtowner::regrole::text,'event',evtevent,'function',pg_temp.addr('pg_catalog.pg_proc'::regclass,evtfoid),'enabled',evtenabled,'tags',evttags) from pg_catalog.pg_event_trigger
 union all select 'tablespaces',spcname,jsonb_build_object('owner',spcowner::regrole::text,'acl',pg_temp.acl(spcacl,'t',spcowner),'options',spcoptions) from pg_catalog.pg_tablespace
 union all select 'settings',jsonb_build_array(d.datname,r.rolname)::text,
   jsonb_build_object('database',d.datname,'role',r.rolname,'settings',(select jsonb_agg(x order by x) from unnest(s.setconfig) x))
   from pg_catalog.pg_db_role_setting s left join pg_catalog.pg_database d on d.oid=s.setdatabase left join pg_catalog.pg_roles r on r.oid=s.setrole
   where s.setdatabase=0 or d.datname=current_database()
 union all select 'database',datname,
   (to_jsonb(d)-array['oid','datdba','dattablespace','datfrozenxid','datminmxid','datacl']) || jsonb_build_object('owner',datdba::regrole::text,'tablespace',(select spcname from pg_catalog.pg_tablespace where oid=dattablespace),'acl',pg_temp.acl(datacl,'d',datdba)) from pg_catalog.pg_database d where datname=current_database()
 union all select 'schemas',nspname,jsonb_build_object('owner',nspowner::regrole::text,'acl',pg_temp.acl(nspacl,'n',nspowner)) from pg_catalog.pg_namespace where oid in(select oid from ns)
 union all select 'relations',pg_temp.addr('pg_catalog.pg_class'::regclass,c.oid)::text,
   (to_jsonb(c)-array['oid','relnamespace','reltype','reloftype','relowner','relam','relfilenode','reltablespace','relpages','reltuples','relallvisible','reltoastrelid','relrewrite','relfrozenxid','relminmxid','relacl','relpartbound']) ||
   jsonb_build_object('owner',relowner::regrole::text,'type',pg_temp.addr('pg_catalog.pg_type'::regclass,reltype),'ofType',pg_temp.addr('pg_catalog.pg_type'::regclass,reloftype),'accessMethod',(select amname from pg_catalog.pg_am where oid=relam),'tablespace',case when reltablespace=0 then null else (select spcname from pg_catalog.pg_tablespace where oid=reltablespace) end,'acl',pg_temp.acl(relacl,case when relkind='S' then 's'::"char" else 'r'::"char" end,relowner))
   from pg_catalog.pg_class c where relnamespace in(select oid from ns)
 union all select 'sequences',pg_temp.addr('pg_catalog.pg_class'::regclass,s.seqrelid)::text,jsonb_build_object('type',pg_temp.addr('pg_catalog.pg_type'::regclass,seqtypid),'start',seqstart::text,'increment',seqincrement::text,'max',seqmax::text,'min',seqmin::text,'cache',seqcache::text,'cycle',seqcycle) from pg_catalog.pg_sequence s join pg_catalog.pg_class c on c.oid=s.seqrelid where c.relnamespace in(select oid from ns)

 union all select 'operators',pg_temp.addr('pg_catalog.pg_operator'::regclass,p.oid)::text,
   jsonb_build_object('owner',oprowner::regrole::text,'kind',oprkind,'merge',oprcanmerge,'hash',oprcanhash,'left',pg_temp.addr('pg_catalog.pg_type'::regclass,oprleft),'right',pg_temp.addr('pg_catalog.pg_type'::regclass,oprright),'result',pg_temp.addr('pg_catalog.pg_type'::regclass,oprresult),'commutator',pg_temp.addr('pg_catalog.pg_operator'::regclass,oprcom),'negator',pg_temp.addr('pg_catalog.pg_operator'::regclass,oprnegate),'function',pg_temp.addr('pg_catalog.pg_proc'::regclass,oprcode),'restrict',pg_temp.addr('pg_catalog.pg_proc'::regclass,oprrest),'join',pg_temp.addr('pg_catalog.pg_proc'::regclass,oprjoin)) from pg_catalog.pg_operator p where oprnamespace in(select oid from ns)
 union all select 'operatorClasses',pg_temp.addr('pg_catalog.pg_opclass'::regclass,p.oid)::text,
   jsonb_build_object('owner',opcowner::regrole::text,'method',(select amname from pg_catalog.pg_am where oid=opcmethod),'family',pg_temp.addr('pg_catalog.pg_opfamily'::regclass,opcfamily),'input',pg_temp.addr('pg_catalog.pg_type'::regclass,opcintype),'key',pg_temp.addr('pg_catalog.pg_type'::regclass,opckeytype),'default',opcdefault) from pg_catalog.pg_opclass p where opcnamespace in(select oid from ns)
 union all select 'operatorFamilies',pg_temp.addr('pg_catalog.pg_opfamily'::regclass,p.oid)::text,
   jsonb_build_object('owner',opfowner::regrole::text,'method',(select amname from pg_catalog.pg_am where oid=opfmethod)) from pg_catalog.pg_opfamily p where opfnamespace in(select oid from ns)
 union all select 'operatorMembers',pg_temp.addr('pg_catalog.pg_amop'::regclass,p.oid)::text,
   jsonb_build_object('family',pg_temp.addr('pg_catalog.pg_opfamily'::regclass,amopfamily),'left',pg_temp.addr('pg_catalog.pg_type'::regclass,amoplefttype),'right',pg_temp.addr('pg_catalog.pg_type'::regclass,amoprighttype),'strategy',amopstrategy,'purpose',amoppurpose,'operator',pg_temp.addr('pg_catalog.pg_operator'::regclass,amopopr),'method',(select amname from pg_catalog.pg_am where oid=amopmethod),'sortFamily',pg_temp.addr('pg_catalog.pg_opfamily'::regclass,amopsortfamily)) from pg_catalog.pg_amop p join pg_catalog.pg_opfamily f on f.oid=p.amopfamily where f.opfnamespace in(select oid from ns)
 union all select 'operatorFunctions',pg_temp.addr('pg_catalog.pg_amproc'::regclass,p.oid)::text,
   jsonb_build_object('family',pg_temp.addr('pg_catalog.pg_opfamily'::regclass,amprocfamily),'left',pg_temp.addr('pg_catalog.pg_type'::regclass,amproclefttype),'right',pg_temp.addr('pg_catalog.pg_type'::regclass,amprocrighttype),'number',amprocnum,'function',pg_temp.addr('pg_catalog.pg_proc'::regclass,amproc)) from pg_catalog.pg_amproc p join pg_catalog.pg_opfamily f on f.oid=p.amprocfamily where f.opfnamespace in(select oid from ns)
 union all select 'columns',jsonb_build_array(pg_temp.addr('pg_catalog.pg_class'::regclass,attrelid),attnum)::text,
   (to_jsonb(a)-array['attrelid','atttypid','attcollation','attacl','atthasmissing','attmissingval']) || jsonb_build_object('type',pg_temp.addr('pg_catalog.pg_type'::regclass,atttypid),'collation',pg_temp.addr('pg_catalog.pg_collation'::regclass,attcollation),'acl',pg_temp.acl(attacl,null,0))
   from pg_catalog.pg_attribute a join pg_catalog.pg_class c on c.oid=a.attrelid where c.relnamespace in(select oid from ns) and attnum>0
 union all select 'functions',pg_temp.addr('pg_catalog.pg_proc'::regclass,p.oid)::text,
   (to_jsonb(p)-array['oid','pronamespace','proowner','prolang','prosupport','provariadic','prorettype','proargtypes','proallargtypes','proargdefaults','protrftypes','prosqlbody','proacl']) ||
   jsonb_build_object('owner',proowner::regrole::text,'language',pg_temp.addr('pg_catalog.pg_language'::regclass,prolang),'support',pg_temp.addr('pg_catalog.pg_proc'::regclass,prosupport),'variadic',pg_temp.addr('pg_catalog.pg_type'::regclass,provariadic),'return',pg_temp.addr('pg_catalog.pg_type'::regclass,prorettype),'definition',pg_catalog.pg_get_functiondef(p.oid),'acl',pg_temp.acl(proacl,'f',proowner),
    'arguments',(select coalesce(jsonb_agg(pg_temp.addr('pg_catalog.pg_type'::regclass,x) order by i),'[]') from unnest(coalesce(proallargtypes,proargtypes::oid[])) with ordinality t(x,i)),
    'transforms',(select coalesce(jsonb_agg(pg_temp.addr('pg_catalog.pg_type'::regclass,x) order by i),'[]') from unnest(protrftypes) with ordinality t(x,i)))
   from pg_catalog.pg_proc p where pronamespace in(select oid from ns) and prokind in ('f','p','w')
 union all select 'types',pg_temp.addr('pg_catalog.pg_type'::regclass,t.oid)::text,
   (to_jsonb(t)-array['oid','typnamespace','typowner','typrelid','typsubscript','typelem','typarray','typinput','typoutput','typreceive','typsend','typmodin','typmodout','typanalyze','typbasetype','typcollation','typacl','typdefaultbin']) || jsonb_build_object('name',typname,'owner',typowner::regrole::text,'kind',typtype,'category',typcategory,'length',typlen,'byValue',typbyval,'alignment',typalign,'storage',typstorage,'notNull',typnotnull,'default',typdefault,
     'relation',pg_temp.addr('pg_catalog.pg_class'::regclass,typrelid),'element',pg_temp.addr('pg_catalog.pg_type'::regclass,typelem),'array',pg_temp.addr('pg_catalog.pg_type'::regclass,typarray),'base',pg_temp.addr('pg_catalog.pg_type'::regclass,typbasetype),'typmod',typtypmod,'dimensions',typndims,'collation',pg_temp.addr('pg_catalog.pg_collation'::regclass,typcollation),'acl',pg_temp.acl(typacl,'T',typowner),
     'input',pg_temp.addr('pg_catalog.pg_proc'::regclass,typinput),'output',pg_temp.addr('pg_catalog.pg_proc'::regclass,typoutput),'receive',pg_temp.addr('pg_catalog.pg_proc'::regclass,typreceive),'send',pg_temp.addr('pg_catalog.pg_proc'::regclass,typsend),'modIn',pg_temp.addr('pg_catalog.pg_proc'::regclass,typmodin),'modOut',pg_temp.addr('pg_catalog.pg_proc'::regclass,typmodout),'analyze',pg_temp.addr('pg_catalog.pg_proc'::regclass,typanalyze),'subscript',pg_temp.addr('pg_catalog.pg_proc'::regclass,typsubscript),
     'enum',(select coalesce(jsonb_agg(jsonb_build_array(enumsortorder,enumlabel) order by enumsortorder),'[]') from pg_catalog.pg_enum where enumtypid=t.oid)) from pg_catalog.pg_type t where typnamespace in(select oid from ns)
 union all select 'constraints',pg_temp.addr('pg_catalog.pg_constraint'::regclass,c.oid)::text,
   (to_jsonb(c)-array['oid','connamespace','conrelid','contypid','conindid','conparentid','confrelid','conpfeqop','conppeqop','conffeqop','conbin']) ||
   jsonb_build_object('table',pg_temp.addr('pg_catalog.pg_class'::regclass,conrelid),'type',pg_temp.addr('pg_catalog.pg_type'::regclass,contypid),'index',pg_temp.addr('pg_catalog.pg_class'::regclass,conindid),'foreignTable',pg_temp.addr('pg_catalog.pg_class'::regclass,confrelid),'definition',pg_catalog.pg_get_constraintdef(c.oid,false),
     'operators',(select coalesce(jsonb_agg(pg_temp.addr('pg_catalog.pg_operator'::regclass,x) order by i),'[]') from unnest(coalesce(conpfeqop,'{}')||coalesce(conppeqop,'{}')||coalesce(conffeqop,'{}')) with ordinality t(x,i)))
   from pg_catalog.pg_constraint c where connamespace in(select oid from ns)
 union all select 'triggers',pg_temp.addr('pg_catalog.pg_trigger'::regclass,t.oid)::text,
   (to_jsonb(t)-array['oid','tgrelid','tgparentid','tgfoid','tgconstrrelid','tgconstrindid','tgconstraint','tgqual','tgname']) ||
   jsonb_build_object('name',case when tgisinternal then null else tgname end,'table',pg_temp.addr('pg_catalog.pg_class'::regclass,tgrelid),'function',pg_temp.addr('pg_catalog.pg_proc'::regclass,tgfoid),'constraintTable',pg_temp.addr('pg_catalog.pg_class'::regclass,tgconstrrelid),'constraintIndex',pg_temp.addr('pg_catalog.pg_class'::regclass,tgconstrindid),'constraint',pg_temp.addr('pg_catalog.pg_constraint'::regclass,tgconstraint),'definition',case when tgisinternal then null else pg_catalog.pg_get_triggerdef(t.oid,false) end)
   from pg_catalog.pg_trigger t join pg_catalog.pg_class c on c.oid=t.tgrelid where c.relnamespace in(select oid from ns)
 union all select 'policies',jsonb_build_array(pg_temp.addr('pg_catalog.pg_class'::regclass,polrelid),polname)::text,
   jsonb_build_object('command',polcmd,'permissive',polpermissive,'roles',(select jsonb_agg(case when x=0 then 'PUBLIC' else x::regrole::text end order by case when x=0 then 'PUBLIC' else x::regrole::text end) from unnest(polroles) x),'using',pg_catalog.pg_get_expr(polqual,polrelid,false),'check',pg_catalog.pg_get_expr(polwithcheck,polrelid,false))
   from pg_catalog.pg_policy p join pg_catalog.pg_class c on c.oid=p.polrelid where c.relnamespace in(select oid from ns)
 union all select 'indexes',pg_temp.addr('pg_catalog.pg_class'::regclass,indexrelid)::text,
   (to_jsonb(i)-array['indexrelid','indrelid','indcollation','indclass','indexprs','indpred']) || jsonb_build_object('table',pg_temp.addr('pg_catalog.pg_class'::regclass,indrelid),'definition',pg_catalog.pg_get_indexdef(indexrelid),
    'collations',(select jsonb_agg(pg_temp.addr('pg_catalog.pg_collation'::regclass,x) order by j) from unnest(indcollation) with ordinality t(x,j)),
    'classes',(select jsonb_agg(pg_temp.addr('pg_catalog.pg_opclass'::regclass,x) order by j) from unnest(indclass) with ordinality t(x,j)))
   from pg_catalog.pg_index i join pg_catalog.pg_class c on c.oid=i.indrelid where c.relnamespace in(select oid from ns)
 union all select 'expressions',jsonb_build_array(pg_temp.addr('pg_catalog.pg_class'::regclass,adrelid),adnum)::text,to_jsonb(pg_catalog.pg_get_expr(adbin,adrelid,false))
   from pg_catalog.pg_attrdef a join pg_catalog.pg_class c on c.oid=a.adrelid where c.relnamespace in(select oid from ns)
 union all select 'rules',pg_temp.addr('pg_catalog.pg_rewrite'::regclass,r.oid)::text,
   jsonb_build_object('table',pg_temp.addr('pg_catalog.pg_class'::regclass,ev_class),'type',ev_type,'enabled',ev_enabled,'instead',is_instead,'definition',pg_catalog.pg_get_ruledef(r.oid,false))
   from pg_catalog.pg_rewrite r join pg_catalog.pg_class c on c.oid=r.ev_class where c.relnamespace in(select oid from ns)
 union all select 'defaults',jsonb_build_array(defaclrole::regrole::text,n.nspname,defaclobjtype)::text,
   jsonb_build_object('owner',defaclrole::regrole::text,'schema',n.nspname,'kind',defaclobjtype,'acl',pg_temp.acl(defaclacl,null,defaclrole)) from pg_catalog.pg_default_acl d left join pg_catalog.pg_namespace n on n.oid=d.defaclnamespace
 union all select 'extensions',extname,jsonb_build_object('owner',extowner::regrole::text,'schema',n.nspname,'version',extversion,'relocatable',extrelocatable,'conditions',extcondition,
   'configTables',(select jsonb_agg(pg_temp.addr('pg_catalog.pg_class'::regclass,x) order by i) from unnest(extconfig) with ordinality t(x,i))) from pg_catalog.pg_extension e join pg_catalog.pg_namespace n on n.oid=e.extnamespace
 union all select 'dependencies',jsonb_build_array(pg_temp.addr(d.classid,d.objid,d.objsubid),pg_temp.addr(d.refclassid,d.refobjid,d.refobjsubid),d.deptype)::text,'true'::jsonb from pg_catalog.pg_depend d where exists(select 1 from objects o where o.c=d.classid and o.o=d.objid)
 union all select 'sharedDependencies',jsonb_build_array(pg_temp.addr(d.classid,d.objid,d.objsubid),pg_temp.addr(d.refclassid,d.refobjid),d.deptype)::text,'true'::jsonb from pg_catalog.pg_shdepend d where d.dbid=(select oid from pg_catalog.pg_database where datname=current_database()) and exists(select 1 from objects o where o.c=d.classid and o.o=d.objid)
 union all select 'objects',pg_temp.addr(c,o)::text,'true'::jsonb from objects
), unsupported as (
 select 'unapproved_schema' reason from pg_catalog.pg_namespace where oid not in(select oid from ns) and nspname not in ('graphql','graphql_public','information_schema','realtime','storage','pgbouncer') and nspname !~ '^pg_'
 union all select 'custom_tablespace' from pg_catalog.pg_tablespace where spcname not in ('pg_default','pg_global')
 union all select 'unmodeled_custom_cast' from pg_catalog.pg_cast c where c.oid>=16384 and not exists(select 1 from pg_catalog.pg_depend d where d.classid='pg_catalog.pg_cast'::regclass and d.objid=c.oid and d.deptype='e')
 union all select 'relation_kind_or_partition' from pg_catalog.pg_class where relnamespace in(select oid from ns) and (relkind not in ('r','i','v','c') and not (relkind='S' and relnamespace='auth'::regnamespace and relname='refresh_tokens_id_seq') or relispartition or reloftype<>0 or relrewrite<>0)
 union all select 'dropped_or_identity_column' from pg_catalog.pg_attribute a join pg_catalog.pg_class c on c.oid=a.attrelid where c.relnamespace in(select oid from ns) and (attisdropped or attidentity<>'')
 union all select 'aggregate_or_sql_body' from pg_catalog.pg_proc where pronamespace in(select oid from ns) and (prokind='a' or prosqlbody is not null)
 union all select 'unsupported_type' from pg_catalog.pg_type where typnamespace in(select oid from ns) and (typtype not in ('b','c','d','e') or typdefaultbin is not null)
 union all select 'user_base_type' from pg_catalog.pg_type where typnamespace in(select oid from ns) and typtype='b' and typelem=0 and not exists(select 1 from pg_catalog.pg_depend d where d.classid='pg_catalog.pg_type'::regclass and d.objid=pg_type.oid and d.deptype='e')

 union all select 'unmodeled_namespace_object' from pg_catalog.pg_depend d
  where d.refclassid='pg_catalog.pg_namespace'::regclass and d.refobjid in(select oid from ns)
    and not exists(select 1 from objects o where o.c=d.classid and o.o=d.objid)
 union all select 'external_dependency' from pg_catalog.pg_depend d join objects o on o.c=d.classid and o.o=d.objid
  where (pg_catalog.pg_identify_object(d.refclassid,d.refobjid,d.refobjsubid)).schema is not null
   and (pg_catalog.pg_identify_object(d.refclassid,d.refobjid,d.refobjsubid)).schema not in ('pg_catalog','public','private','ingestion','recovery_ops','auth','extensions','vault')
)
select jsonb_build_object('contract','nutrition-002c1-logical-catalog/v1','mode','ISOLATED_LOCAL_LIVE_ONLY','postgres',current_setting('server_version_num'),
 'records',(select jsonb_agg(jsonb_build_object('section',section,'key',key,'value',value) order by section,key,value::text) from rows),
 'unsupported',(select coalesce(jsonb_agg(distinct reason),'[]') from unsupported));
rollback;
