-- PROPOSED ONLY: NOT AUTHORIZED FOR HOSTED EXECUTION BY TASK 004.
-- Nutrition Tracker App / Production / eu-west-1 / hskfanrqwtqknzpquwhg ONLY.
-- Bind and verify the exact project in the separately approved inspection tool before SQL.
-- The literal expected_project_ref below is a label, NOT independent project attestation.
-- No connection command, linked project, URL, credential, owner/Auth row, Vault or application RPC.
-- One consistent catalog snapshot; each statement has a five-second budget.
BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY;
SET LOCAL statement_timeout = '5s';
SET LOCAL lock_timeout = '1s';
SET LOCAL search_path = pg_catalog;
-- R01: Complete role attributes and membership/grantor graph; never read rolpassword
WITH roles AS (
 SELECT r.oid,r.rolname,r.rolcanlogin,r.rolsuper,r.rolbypassrls,r.rolcreatedb,r.rolcreaterole,r.rolreplication,r.rolinherit,r.rolconnlimit,r.rolvaliduntil,r.rolconfig, CASE WHEN r.rolname ~ '^[A-Za-z_][A-Za-z0-9_]{0,62}$' THEN r.rolname::text
 ELSE 'REDACTED_ROLE_SHA256:'||pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(r.rolname::text,'UTF8')),'hex') END AS identity,
 r.rolname ~ '^[A-Za-z_][A-Za-z0-9_]{0,62}$' AS identity_complete
 FROM pg_catalog.pg_roles r
),
payload AS (SELECT pg_catalog.jsonb_build_object('roles',(SELECT pg_catalog.jsonb_build_object('total',count(*),'row_limit',256,'complete',count(*)<=256,
      'rows',CASE WHEN count(*)<=256 THEN coalesce(pg_catalog.jsonb_agg(v ORDER BY v::text COLLATE "C"),'[]'::jsonb) ELSE '[]'::jsonb END)
      FROM (SELECT pg_catalog.jsonb_build_object('name',r.identity,'identity_complete',r.identity_complete,'login',r.rolcanlogin,'superuser',r.rolsuper,'bypassrls',r.rolbypassrls,'createdb',r.rolcreatedb,'createrole',r.rolcreaterole,'replication',r.rolreplication,'inherit',r.rolinherit,'connection_limit',r.rolconnlimit,'valid_until',r.rolvaliduntil,'settings',(SELECT pg_catalog.jsonb_build_object('is_null',(r.rolconfig) IS NULL,
     'unsupported_count',count(*) FILTER (WHERE NOT (
 (pg_catalog.split_part(s.entry,'=',1) IN ('statement_timeout','lock_timeout','idle_in_transaction_session_timeout','transaction_timeout')
   AND pg_catalog.substr(s.entry,pg_catalog.strpos(s.entry,'=')+1) ~ '^[0-9]+(ms|s|min|h|d)?$')
 OR (pg_catalog.split_part(s.entry,'=',1) IN ('default_transaction_read_only','row_security','check_function_bodies')
   AND pg_catalog.substr(s.entry,pg_catalog.strpos(s.entry,'=')+1) IN ('on','off','true','false'))
 OR (pg_catalog.split_part(s.entry,'=',1)='default_transaction_isolation'
   AND pg_catalog.substr(s.entry,pg_catalog.strpos(s.entry,'=')+1) IN ('serializable','repeatable read','read committed','read uncommitted'))
 OR (pg_catalog.split_part(s.entry,'=',1) IN ('search_path','pgrst.db_schemas','pgrst.db_extra_search_path','default_tablespace','temp_tablespaces')
   AND pg_catalog.substr(s.entry,pg_catalog.strpos(s.entry,'=')+1) ~ '^[A-Za-z0-9_ ,"$\\.-]*$')
 OR (pg_catalog.split_part(s.entry,'=',1) IN ('client_min_messages','log_min_messages')
   AND pg_catalog.substr(s.entry,pg_catalog.strpos(s.entry,'=')+1) IN ('debug5','debug4','debug3','debug2','debug1','info','notice','warning','error','log','fatal','panic'))
 OR (pg_catalog.split_part(s.entry,'=',1)='log_statement' AND pg_catalog.substr(s.entry,pg_catalog.strpos(s.entry,'=')+1) IN ('none','ddl','mod','all'))
 OR (pg_catalog.split_part(s.entry,'=',1) IN ('session_preload_libraries','local_preload_libraries') AND pg_catalog.substr(s.entry,pg_catalog.strpos(s.entry,'=')+1) ~ '^[A-Za-z0-9_ ,]*$')
 OR (pg_catalog.split_part(s.entry,'=',1)='session_replication_role'
   AND pg_catalog.substr(s.entry,pg_catalog.strpos(s.entry,'=')+1) IN ('origin','replica','local'))
)),
     'entries',coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('position',s.position,
       'key',CASE WHEN pg_catalog.split_part(s.entry,'=',1) ~ '^[a-z_][a-z0-9_.]*$' THEN pg_catalog.split_part(s.entry,'=',1) ELSE 'REDACTED_KEY' END,
       'value',CASE WHEN (
 (pg_catalog.split_part(s.entry,'=',1) IN ('statement_timeout','lock_timeout','idle_in_transaction_session_timeout','transaction_timeout')
   AND pg_catalog.substr(s.entry,pg_catalog.strpos(s.entry,'=')+1) ~ '^[0-9]+(ms|s|min|h|d)?$')
 OR (pg_catalog.split_part(s.entry,'=',1) IN ('default_transaction_read_only','row_security','check_function_bodies')
   AND pg_catalog.substr(s.entry,pg_catalog.strpos(s.entry,'=')+1) IN ('on','off','true','false'))
 OR (pg_catalog.split_part(s.entry,'=',1)='default_transaction_isolation'
   AND pg_catalog.substr(s.entry,pg_catalog.strpos(s.entry,'=')+1) IN ('serializable','repeatable read','read committed','read uncommitted'))
 OR (pg_catalog.split_part(s.entry,'=',1) IN ('search_path','pgrst.db_schemas','pgrst.db_extra_search_path','default_tablespace','temp_tablespaces')
   AND pg_catalog.substr(s.entry,pg_catalog.strpos(s.entry,'=')+1) ~ '^[A-Za-z0-9_ ,"$\\.-]*$')
 OR (pg_catalog.split_part(s.entry,'=',1) IN ('client_min_messages','log_min_messages')
   AND pg_catalog.substr(s.entry,pg_catalog.strpos(s.entry,'=')+1) IN ('debug5','debug4','debug3','debug2','debug1','info','notice','warning','error','log','fatal','panic'))
 OR (pg_catalog.split_part(s.entry,'=',1)='log_statement' AND pg_catalog.substr(s.entry,pg_catalog.strpos(s.entry,'=')+1) IN ('none','ddl','mod','all'))
 OR (pg_catalog.split_part(s.entry,'=',1) IN ('session_preload_libraries','local_preload_libraries') AND pg_catalog.substr(s.entry,pg_catalog.strpos(s.entry,'=')+1) ~ '^[A-Za-z0-9_ ,]*$')
 OR (pg_catalog.split_part(s.entry,'=',1)='session_replication_role'
   AND pg_catalog.substr(s.entry,pg_catalog.strpos(s.entry,'=')+1) IN ('origin','replica','local'))
) THEN pg_catalog.substr(s.entry,pg_catalog.strpos(s.entry,'=')+1) END,
       'value_available',(
 (pg_catalog.split_part(s.entry,'=',1) IN ('statement_timeout','lock_timeout','idle_in_transaction_session_timeout','transaction_timeout')
   AND pg_catalog.substr(s.entry,pg_catalog.strpos(s.entry,'=')+1) ~ '^[0-9]+(ms|s|min|h|d)?$')
 OR (pg_catalog.split_part(s.entry,'=',1) IN ('default_transaction_read_only','row_security','check_function_bodies')
   AND pg_catalog.substr(s.entry,pg_catalog.strpos(s.entry,'=')+1) IN ('on','off','true','false'))
 OR (pg_catalog.split_part(s.entry,'=',1)='default_transaction_isolation'
   AND pg_catalog.substr(s.entry,pg_catalog.strpos(s.entry,'=')+1) IN ('serializable','repeatable read','read committed','read uncommitted'))
 OR (pg_catalog.split_part(s.entry,'=',1) IN ('search_path','pgrst.db_schemas','pgrst.db_extra_search_path','default_tablespace','temp_tablespaces')
   AND pg_catalog.substr(s.entry,pg_catalog.strpos(s.entry,'=')+1) ~ '^[A-Za-z0-9_ ,"$\\.-]*$')
 OR (pg_catalog.split_part(s.entry,'=',1) IN ('client_min_messages','log_min_messages')
   AND pg_catalog.substr(s.entry,pg_catalog.strpos(s.entry,'=')+1) IN ('debug5','debug4','debug3','debug2','debug1','info','notice','warning','error','log','fatal','panic'))
 OR (pg_catalog.split_part(s.entry,'=',1)='log_statement' AND pg_catalog.substr(s.entry,pg_catalog.strpos(s.entry,'=')+1) IN ('none','ddl','mod','all'))
 OR (pg_catalog.split_part(s.entry,'=',1) IN ('session_preload_libraries','local_preload_libraries') AND pg_catalog.substr(s.entry,pg_catalog.strpos(s.entry,'=')+1) ~ '^[A-Za-z0-9_ ,]*$')
 OR (pg_catalog.split_part(s.entry,'=',1)='session_replication_role'
   AND pg_catalog.substr(s.entry,pg_catalog.strpos(s.entry,'=')+1) IN ('origin','replica','local'))
)) ORDER BY s.position),'[]'::jsonb))
     FROM pg_catalog.unnest(r.rolconfig) WITH ORDINALITY s(entry,position))) FROM roles r) q(v)),'memberships',(SELECT pg_catalog.jsonb_build_object('total',count(*),'row_limit',2048,'complete',count(*)<=2048,
      'rows',CASE WHEN count(*)<=2048 THEN coalesce(pg_catalog.jsonb_agg(v ORDER BY v::text COLLATE "C"),'[]'::jsonb) ELSE '[]'::jsonb END)
      FROM (SELECT pg_catalog.jsonb_build_object('member',m.identity,'role',r.identity,'grantor',g.identity,'admin',a.admin_option,'inherit',a.inherit_option,'set',a.set_option) FROM pg_catalog.pg_auth_members a JOIN roles m ON m.oid=a.member JOIN roles r ON r.oid=a.roleid JOIN roles g ON g.oid=a.grantor) q(v))) AS body),
sized AS (SELECT body,pg_catalog.octet_length(body::text) AS bytes FROM payload)
SELECT pg_catalog.jsonb_build_object('query_id','R01','expected_project_ref','hskfanrqwtqknzpquwhg',
 'snapshot_at',pg_catalog.transaction_timestamp(),'read_only',pg_catalog.current_setting('transaction_read_only'),
 'statement_timeout',pg_catalog.current_setting('statement_timeout'),'lock_timeout',pg_catalog.current_setting('lock_timeout'),
 'output_bytes',bytes,'byte_limit',2097152,'byte_limit_ok',bytes<=2097152,
 'payload',CASE WHEN bytes<=2097152 THEN body ELSE NULL END) AS recovery_profile_observation FROM sized;

-- R02: Stored ACLs with original item order, null distinction, grantors and global/schema default scope
WITH roles AS (
 SELECT r.oid,r.rolname,r.rolcanlogin,r.rolsuper,r.rolbypassrls,r.rolcreatedb,r.rolcreaterole,r.rolreplication,r.rolinherit,r.rolconnlimit,r.rolvaliduntil,r.rolconfig, CASE WHEN r.rolname ~ '^[A-Za-z_][A-Za-z0-9_]{0,62}$' THEN r.rolname::text
 ELSE 'REDACTED_ROLE_SHA256:'||pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(r.rolname::text,'UTF8')),'hex') END AS identity,
 r.rolname ~ '^[A-Za-z_][A-Za-z0-9_]{0,62}$' AS identity_complete
 FROM pg_catalog.pg_roles r
),
payload AS (SELECT pg_catalog.jsonb_build_object('relations',(SELECT pg_catalog.jsonb_build_object('total',count(*),'row_limit',512,'complete',count(*)<=512,
      'rows',CASE WHEN count(*)<=512 THEN coalesce(pg_catalog.jsonb_agg(v ORDER BY v::text COLLATE "C"),'[]'::jsonb) ELSE '[]'::jsonb END)
      FROM (SELECT pg_catalog.jsonb_build_object('schema',n.nspname,'name',c.relname,'kind',c.relkind,'owner',r.identity,'acl_is_null',c.relacl IS NULL,'raw_acl_sha256',pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to((coalesce(c.relacl::text,'NULL'))::text,'UTF8')),'hex'),'stored_grants',(SELECT coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
      'acl_position',a.position,'grantor',g.identity,'grantee',CASE WHEN e.grantee=0 THEN 'PUBLIC' ELSE r.identity END,
      'privilege',e.privilege_type,'grantable',e.is_grantable)
      ORDER BY a.position,e.privilege_type COLLATE "C"),'[]'::jsonb)
      FROM pg_catalog.unnest(c.relacl) WITH ORDINALITY a(item,position)
      CROSS JOIN LATERAL pg_catalog.aclexplode(ARRAY[a.item]) e
      LEFT JOIN roles g ON g.oid=e.grantor LEFT JOIN roles r ON r.oid=e.grantee)) FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace JOIN roles r ON r.oid=c.relowner WHERE n.nspname IN ('public','private','ingestion','auth') AND c.relkind IN ('r','p','v','m','f','S')) q(v)),'column_grants',(SELECT pg_catalog.jsonb_build_object('total',count(*),'row_limit',2048,'complete',count(*)<=2048,
      'rows',CASE WHEN count(*)<=2048 THEN coalesce(pg_catalog.jsonb_agg(v ORDER BY v::text COLLATE "C"),'[]'::jsonb) ELSE '[]'::jsonb END)
      FROM (SELECT pg_catalog.jsonb_build_object('schema',n.nspname,'table',c.relname,'column',a.attname,'acl_is_null',a.attacl IS NULL,'raw_acl_sha256',pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to((coalesce(a.attacl::text,'NULL'))::text,'UTF8')),'hex'),'stored_grants',(SELECT coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
      'acl_position',a.position,'grantor',g.identity,'grantee',CASE WHEN e.grantee=0 THEN 'PUBLIC' ELSE r.identity END,
      'privilege',e.privilege_type,'grantable',e.is_grantable)
      ORDER BY a.position,e.privilege_type COLLATE "C"),'[]'::jsonb)
      FROM pg_catalog.unnest(a.attacl) WITH ORDINALITY a(item,position)
      CROSS JOIN LATERAL pg_catalog.aclexplode(ARRAY[a.item]) e
      LEFT JOIN roles g ON g.oid=e.grantor LEFT JOIN roles r ON r.oid=e.grantee)) FROM pg_catalog.pg_attribute a JOIN pg_catalog.pg_class c ON c.oid=a.attrelid JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname IN ('public','private','ingestion','auth') AND a.attnum>0 AND NOT a.attisdropped AND a.attacl IS NOT NULL) q(v)),'function_grants',(SELECT pg_catalog.jsonb_build_object('total',count(*),'row_limit',1024,'complete',count(*)<=1024,
      'rows',CASE WHEN count(*)<=1024 THEN coalesce(pg_catalog.jsonb_agg(v ORDER BY v::text COLLATE "C"),'[]'::jsonb) ELSE '[]'::jsonb END)
      FROM (SELECT pg_catalog.jsonb_build_object('schema',n.nspname,'name',p.proname,'args',pg_catalog.pg_get_function_identity_arguments(p.oid),'kind',p.prokind,'owner',r.identity,'acl_is_null',p.proacl IS NULL,'raw_acl_sha256',pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to((coalesce(p.proacl::text,'NULL'))::text,'UTF8')),'hex'),'stored_grants',(SELECT coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
      'acl_position',a.position,'grantor',g.identity,'grantee',CASE WHEN e.grantee=0 THEN 'PUBLIC' ELSE r.identity END,
      'privilege',e.privilege_type,'grantable',e.is_grantable)
      ORDER BY a.position,e.privilege_type COLLATE "C"),'[]'::jsonb)
      FROM pg_catalog.unnest(p.proacl) WITH ORDINALITY a(item,position)
      CROSS JOIN LATERAL pg_catalog.aclexplode(ARRAY[a.item]) e
      LEFT JOIN roles g ON g.oid=e.grantor LEFT JOIN roles r ON r.oid=e.grantee)) FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace JOIN roles r ON r.oid=p.proowner WHERE n.nspname IN ('public','private','ingestion','auth')) q(v)),'default_grants',(SELECT pg_catalog.jsonb_build_object('total',count(*),'row_limit',512,'complete',count(*)<=512,
      'rows',CASE WHEN count(*)<=512 THEN coalesce(pg_catalog.jsonb_agg(v ORDER BY v::text COLLATE "C"),'[]'::jsonb) ELSE '[]'::jsonb END)
      FROM (SELECT pg_catalog.jsonb_build_object('owner',r.identity,'scope',CASE WHEN d.defaclnamespace=0 THEN 'GLOBAL' ELSE 'SCHEMA' END,'schema',n.nspname,'kind',d.defaclobjtype,'raw_acl_sha256',pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to((d.defaclacl::text)::text,'UTF8')),'hex'),'stored_grants',(SELECT coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
      'acl_position',a.position,'grantor',g.identity,'grantee',CASE WHEN e.grantee=0 THEN 'PUBLIC' ELSE r.identity END,
      'privilege',e.privilege_type,'grantable',e.is_grantable)
      ORDER BY a.position,e.privilege_type COLLATE "C"),'[]'::jsonb)
      FROM pg_catalog.unnest(d.defaclacl) WITH ORDINALITY a(item,position)
      CROSS JOIN LATERAL pg_catalog.aclexplode(ARRAY[a.item]) e
      LEFT JOIN roles g ON g.oid=e.grantor LEFT JOIN roles r ON r.oid=e.grantee)) FROM pg_catalog.pg_default_acl d JOIN roles r ON r.oid=d.defaclrole LEFT JOIN pg_catalog.pg_namespace n ON n.oid=d.defaclnamespace WHERE d.defaclnamespace=0 OR n.nspname IN ('public','private','ingestion','auth')) q(v)),'schemas',(SELECT pg_catalog.jsonb_build_object('total',count(*),'row_limit',16,'complete',count(*)<=16,
      'rows',CASE WHEN count(*)<=16 THEN coalesce(pg_catalog.jsonb_agg(v ORDER BY v::text COLLATE "C"),'[]'::jsonb) ELSE '[]'::jsonb END)
      FROM (SELECT pg_catalog.jsonb_build_object('name',n.nspname,'owner',r.identity,'acl_is_null',n.nspacl IS NULL,'raw_acl_sha256',pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to((coalesce(n.nspacl::text,'NULL'))::text,'UTF8')),'hex'),'stored_grants',(SELECT coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
      'acl_position',a.position,'grantor',g.identity,'grantee',CASE WHEN e.grantee=0 THEN 'PUBLIC' ELSE r.identity END,
      'privilege',e.privilege_type,'grantable',e.is_grantable)
      ORDER BY a.position,e.privilege_type COLLATE "C"),'[]'::jsonb)
      FROM pg_catalog.unnest(n.nspacl) WITH ORDINALITY a(item,position)
      CROSS JOIN LATERAL pg_catalog.aclexplode(ARRAY[a.item]) e
      LEFT JOIN roles g ON g.oid=e.grantor LEFT JOIN roles r ON r.oid=e.grantee)) FROM pg_catalog.pg_namespace n JOIN roles r ON r.oid=n.nspowner WHERE n.nspname IN ('public','private','ingestion','auth')) q(v)),'database',(SELECT pg_catalog.jsonb_build_object('total',count(*),'row_limit',1,'complete',count(*)<=1,
      'rows',CASE WHEN count(*)<=1 THEN coalesce(pg_catalog.jsonb_agg(v ORDER BY v::text COLLATE "C"),'[]'::jsonb) ELSE '[]'::jsonb END)
      FROM (SELECT pg_catalog.jsonb_build_object('database','CURRENT_DATABASE','owner',r.identity,'acl_is_null',d.datacl IS NULL,'stored_grants',(SELECT coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
      'acl_position',a.position,'grantor',g.identity,'grantee',CASE WHEN e.grantee=0 THEN 'PUBLIC' ELSE r.identity END,
      'privilege',e.privilege_type,'grantable',e.is_grantable)
      ORDER BY a.position,e.privilege_type COLLATE "C"),'[]'::jsonb)
      FROM pg_catalog.unnest(d.datacl) WITH ORDINALITY a(item,position)
      CROSS JOIN LATERAL pg_catalog.aclexplode(ARRAY[a.item]) e
      LEFT JOIN roles g ON g.oid=e.grantor LEFT JOIN roles r ON r.oid=e.grantee)) FROM pg_catalog.pg_database d JOIN roles r ON r.oid=d.datdba WHERE d.datname=pg_catalog.current_database()) q(v)),'parameter_grants',(SELECT pg_catalog.jsonb_build_object('total',count(*),'row_limit',128,'complete',count(*)<=128,
      'rows',CASE WHEN count(*)<=128 THEN coalesce(pg_catalog.jsonb_agg(v ORDER BY v::text COLLATE "C"),'[]'::jsonb) ELSE '[]'::jsonb END)
      FROM (SELECT pg_catalog.jsonb_build_object('parameter',p.parname,'stored_grants',(SELECT coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
      'acl_position',a.position,'grantor',g.identity,'grantee',CASE WHEN e.grantee=0 THEN 'PUBLIC' ELSE r.identity END,
      'privilege',e.privilege_type,'grantable',e.is_grantable)
      ORDER BY a.position,e.privilege_type COLLATE "C"),'[]'::jsonb)
      FROM pg_catalog.unnest(p.paracl) WITH ORDINALITY a(item,position)
      CROSS JOIN LATERAL pg_catalog.aclexplode(ARRAY[a.item]) e
      LEFT JOIN roles g ON g.oid=e.grantor LEFT JOIN roles r ON r.oid=e.grantee)) FROM pg_catalog.pg_parameter_acl p) q(v))) AS body),
sized AS (SELECT body,pg_catalog.octet_length(body::text) AS bytes FROM payload)
SELECT pg_catalog.jsonb_build_object('query_id','R02','expected_project_ref','hskfanrqwtqknzpquwhg',
 'snapshot_at',pg_catalog.transaction_timestamp(),'read_only',pg_catalog.current_setting('transaction_read_only'),
 'statement_timeout',pg_catalog.current_setting('statement_timeout'),'lock_timeout',pg_catalog.current_setting('lock_timeout'),
 'output_bytes',bytes,'byte_limit',2097152,'byte_limit_ok',bytes<=2097152,
 'payload',CASE WHEN bytes<=2097152 THEN body ELSE NULL END) AS recovery_profile_observation FROM sized;

-- R03: Stable database/role configuration bindings and bounded nonsecret server settings
WITH roles AS (
 SELECT r.oid,r.rolname,r.rolcanlogin,r.rolsuper,r.rolbypassrls,r.rolcreatedb,r.rolcreaterole,r.rolreplication,r.rolinherit,r.rolconnlimit,r.rolvaliduntil,r.rolconfig, CASE WHEN r.rolname ~ '^[A-Za-z_][A-Za-z0-9_]{0,62}$' THEN r.rolname::text
 ELSE 'REDACTED_ROLE_SHA256:'||pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(r.rolname::text,'UTF8')),'hex') END AS identity,
 r.rolname ~ '^[A-Za-z_][A-Za-z0-9_]{0,62}$' AS identity_complete
 FROM pg_catalog.pg_roles r
),
payload AS (SELECT pg_catalog.jsonb_build_object('database_role_settings',(SELECT pg_catalog.jsonb_build_object('total',count(*),'row_limit',256,'complete',count(*)<=256,
      'rows',CASE WHEN count(*)<=256 THEN coalesce(pg_catalog.jsonb_agg(v ORDER BY v::text COLLATE "C"),'[]'::jsonb) ELSE '[]'::jsonb END)
      FROM (SELECT pg_catalog.jsonb_build_object('database',CASE WHEN d.setdatabase=0 THEN 'ALL_DATABASES' ELSE 'CURRENT_DATABASE' END,'role',CASE WHEN d.setrole=0 THEN 'ALL_ROLES' ELSE r.identity END,'settings',(SELECT pg_catalog.jsonb_build_object('is_null',(d.setconfig) IS NULL,
     'unsupported_count',count(*) FILTER (WHERE NOT (
 (pg_catalog.split_part(s.entry,'=',1) IN ('statement_timeout','lock_timeout','idle_in_transaction_session_timeout','transaction_timeout')
   AND pg_catalog.substr(s.entry,pg_catalog.strpos(s.entry,'=')+1) ~ '^[0-9]+(ms|s|min|h|d)?$')
 OR (pg_catalog.split_part(s.entry,'=',1) IN ('default_transaction_read_only','row_security','check_function_bodies')
   AND pg_catalog.substr(s.entry,pg_catalog.strpos(s.entry,'=')+1) IN ('on','off','true','false'))
 OR (pg_catalog.split_part(s.entry,'=',1)='default_transaction_isolation'
   AND pg_catalog.substr(s.entry,pg_catalog.strpos(s.entry,'=')+1) IN ('serializable','repeatable read','read committed','read uncommitted'))
 OR (pg_catalog.split_part(s.entry,'=',1) IN ('search_path','pgrst.db_schemas','pgrst.db_extra_search_path','default_tablespace','temp_tablespaces')
   AND pg_catalog.substr(s.entry,pg_catalog.strpos(s.entry,'=')+1) ~ '^[A-Za-z0-9_ ,"$\\.-]*$')
 OR (pg_catalog.split_part(s.entry,'=',1) IN ('client_min_messages','log_min_messages')
   AND pg_catalog.substr(s.entry,pg_catalog.strpos(s.entry,'=')+1) IN ('debug5','debug4','debug3','debug2','debug1','info','notice','warning','error','log','fatal','panic'))
 OR (pg_catalog.split_part(s.entry,'=',1)='log_statement' AND pg_catalog.substr(s.entry,pg_catalog.strpos(s.entry,'=')+1) IN ('none','ddl','mod','all'))
 OR (pg_catalog.split_part(s.entry,'=',1) IN ('session_preload_libraries','local_preload_libraries') AND pg_catalog.substr(s.entry,pg_catalog.strpos(s.entry,'=')+1) ~ '^[A-Za-z0-9_ ,]*$')
 OR (pg_catalog.split_part(s.entry,'=',1)='session_replication_role'
   AND pg_catalog.substr(s.entry,pg_catalog.strpos(s.entry,'=')+1) IN ('origin','replica','local'))
)),
     'entries',coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('position',s.position,
       'key',CASE WHEN pg_catalog.split_part(s.entry,'=',1) ~ '^[a-z_][a-z0-9_.]*$' THEN pg_catalog.split_part(s.entry,'=',1) ELSE 'REDACTED_KEY' END,
       'value',CASE WHEN (
 (pg_catalog.split_part(s.entry,'=',1) IN ('statement_timeout','lock_timeout','idle_in_transaction_session_timeout','transaction_timeout')
   AND pg_catalog.substr(s.entry,pg_catalog.strpos(s.entry,'=')+1) ~ '^[0-9]+(ms|s|min|h|d)?$')
 OR (pg_catalog.split_part(s.entry,'=',1) IN ('default_transaction_read_only','row_security','check_function_bodies')
   AND pg_catalog.substr(s.entry,pg_catalog.strpos(s.entry,'=')+1) IN ('on','off','true','false'))
 OR (pg_catalog.split_part(s.entry,'=',1)='default_transaction_isolation'
   AND pg_catalog.substr(s.entry,pg_catalog.strpos(s.entry,'=')+1) IN ('serializable','repeatable read','read committed','read uncommitted'))
 OR (pg_catalog.split_part(s.entry,'=',1) IN ('search_path','pgrst.db_schemas','pgrst.db_extra_search_path','default_tablespace','temp_tablespaces')
   AND pg_catalog.substr(s.entry,pg_catalog.strpos(s.entry,'=')+1) ~ '^[A-Za-z0-9_ ,"$\\.-]*$')
 OR (pg_catalog.split_part(s.entry,'=',1) IN ('client_min_messages','log_min_messages')
   AND pg_catalog.substr(s.entry,pg_catalog.strpos(s.entry,'=')+1) IN ('debug5','debug4','debug3','debug2','debug1','info','notice','warning','error','log','fatal','panic'))
 OR (pg_catalog.split_part(s.entry,'=',1)='log_statement' AND pg_catalog.substr(s.entry,pg_catalog.strpos(s.entry,'=')+1) IN ('none','ddl','mod','all'))
 OR (pg_catalog.split_part(s.entry,'=',1) IN ('session_preload_libraries','local_preload_libraries') AND pg_catalog.substr(s.entry,pg_catalog.strpos(s.entry,'=')+1) ~ '^[A-Za-z0-9_ ,]*$')
 OR (pg_catalog.split_part(s.entry,'=',1)='session_replication_role'
   AND pg_catalog.substr(s.entry,pg_catalog.strpos(s.entry,'=')+1) IN ('origin','replica','local'))
) THEN pg_catalog.substr(s.entry,pg_catalog.strpos(s.entry,'=')+1) END,
       'value_available',(
 (pg_catalog.split_part(s.entry,'=',1) IN ('statement_timeout','lock_timeout','idle_in_transaction_session_timeout','transaction_timeout')
   AND pg_catalog.substr(s.entry,pg_catalog.strpos(s.entry,'=')+1) ~ '^[0-9]+(ms|s|min|h|d)?$')
 OR (pg_catalog.split_part(s.entry,'=',1) IN ('default_transaction_read_only','row_security','check_function_bodies')
   AND pg_catalog.substr(s.entry,pg_catalog.strpos(s.entry,'=')+1) IN ('on','off','true','false'))
 OR (pg_catalog.split_part(s.entry,'=',1)='default_transaction_isolation'
   AND pg_catalog.substr(s.entry,pg_catalog.strpos(s.entry,'=')+1) IN ('serializable','repeatable read','read committed','read uncommitted'))
 OR (pg_catalog.split_part(s.entry,'=',1) IN ('search_path','pgrst.db_schemas','pgrst.db_extra_search_path','default_tablespace','temp_tablespaces')
   AND pg_catalog.substr(s.entry,pg_catalog.strpos(s.entry,'=')+1) ~ '^[A-Za-z0-9_ ,"$\\.-]*$')
 OR (pg_catalog.split_part(s.entry,'=',1) IN ('client_min_messages','log_min_messages')
   AND pg_catalog.substr(s.entry,pg_catalog.strpos(s.entry,'=')+1) IN ('debug5','debug4','debug3','debug2','debug1','info','notice','warning','error','log','fatal','panic'))
 OR (pg_catalog.split_part(s.entry,'=',1)='log_statement' AND pg_catalog.substr(s.entry,pg_catalog.strpos(s.entry,'=')+1) IN ('none','ddl','mod','all'))
 OR (pg_catalog.split_part(s.entry,'=',1) IN ('session_preload_libraries','local_preload_libraries') AND pg_catalog.substr(s.entry,pg_catalog.strpos(s.entry,'=')+1) ~ '^[A-Za-z0-9_ ,]*$')
 OR (pg_catalog.split_part(s.entry,'=',1)='session_replication_role'
   AND pg_catalog.substr(s.entry,pg_catalog.strpos(s.entry,'=')+1) IN ('origin','replica','local'))
)) ORDER BY s.position),'[]'::jsonb))
     FROM pg_catalog.unnest(d.setconfig) WITH ORDINALITY s(entry,position))) FROM pg_catalog.pg_db_role_setting d LEFT JOIN roles r ON r.oid=d.setrole WHERE d.setdatabase=0 OR d.setdatabase=(SELECT oid FROM pg_catalog.pg_database WHERE datname=pg_catalog.current_database())) q(v)),'server_settings',(SELECT pg_catalog.jsonb_build_object('total',count(*),'row_limit',32,'complete',count(*)<=32,
      'rows',CASE WHEN count(*)<=32 THEN coalesce(pg_catalog.jsonb_agg(v ORDER BY v::text COLLATE "C"),'[]'::jsonb) ELSE '[]'::jsonb END)
      FROM (SELECT pg_catalog.jsonb_build_object('name',name,'setting',setting,'reset_value',reset_val,'unit',unit,'source',source,'context',context,'inspection_override',name IN ('statement_timeout','lock_timeout','search_path')) FROM pg_catalog.pg_settings WHERE name IN ('server_version','max_connections','max_prepared_transactions','default_transaction_read_only','default_transaction_isolation','statement_timeout','lock_timeout','idle_in_transaction_session_timeout','transaction_timeout','row_security','session_replication_role','search_path','TimeZone','DateStyle','IntervalStyle','standard_conforming_strings','server_encoding','lc_collate','lc_ctype')) q(v))) AS body),
sized AS (SELECT body,pg_catalog.octet_length(body::text) AS bytes FROM payload)
SELECT pg_catalog.jsonb_build_object('query_id','R03','expected_project_ref','hskfanrqwtqknzpquwhg',
 'snapshot_at',pg_catalog.transaction_timestamp(),'read_only',pg_catalog.current_setting('transaction_read_only'),
 'statement_timeout',pg_catalog.current_setting('statement_timeout'),'lock_timeout',pg_catalog.current_setting('lock_timeout'),
 'output_bytes',bytes,'byte_limit',2097152,'byte_limit_ok',bytes<=2097152,
 'payload',CASE WHEN bytes<=2097152 THEN body ELSE NULL END) AS recovery_profile_observation FROM sized;

-- R04: Previously unobserved index/view/table/column/sequence attributes; definitions hash first
WITH roles AS (
 SELECT r.oid,r.rolname,r.rolcanlogin,r.rolsuper,r.rolbypassrls,r.rolcreatedb,r.rolcreaterole,r.rolreplication,r.rolinherit,r.rolconnlimit,r.rolvaliduntil,r.rolconfig, CASE WHEN r.rolname ~ '^[A-Za-z_][A-Za-z0-9_]{0,62}$' THEN r.rolname::text
 ELSE 'REDACTED_ROLE_SHA256:'||pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(r.rolname::text,'UTF8')),'hex') END AS identity,
 r.rolname ~ '^[A-Za-z_][A-Za-z0-9_]{0,62}$' AS identity_complete
 FROM pg_catalog.pg_roles r
),
payload AS (SELECT pg_catalog.jsonb_build_object('indexes',(SELECT pg_catalog.jsonb_build_object('total',count(*),'row_limit',1024,'complete',count(*)<=1024,
      'rows',CASE WHEN count(*)<=1024 THEN coalesce(pg_catalog.jsonb_agg(v ORDER BY v::text COLLATE "C"),'[]'::jsonb) ELSE '[]'::jsonb END)
      FROM (SELECT pg_catalog.jsonb_build_object('schema',n.nspname,'table',c.relname,'index',i.relname,'definition_sha256',pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to((pg_catalog.pg_get_indexdef(x.indexrelid))::text,'UTF8')),'hex'),'valid',x.indisvalid,'ready',x.indisready,'live',x.indislive,'unique',x.indisunique,'primary',x.indisprimary,'exclusion',x.indisexclusion,'immediate',x.indimmediate,'replica_identity',x.indisreplident,'nulls_not_distinct',x.indnullsnotdistinct,'predicate_sha256',pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to((coalesce(pg_catalog.pg_get_expr(x.indpred,x.indrelid),'NULL'))::text,'UTF8')),'hex'),'expressions_sha256',pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to((coalesce(pg_catalog.pg_get_expr(x.indexprs,x.indrelid),'NULL'))::text,'UTF8')),'hex')) FROM pg_catalog.pg_index x JOIN pg_catalog.pg_class c ON c.oid=x.indrelid JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace JOIN pg_catalog.pg_class i ON i.oid=x.indexrelid WHERE n.nspname IN ('public','private','ingestion','auth')) q(v)),'relations',(SELECT pg_catalog.jsonb_build_object('total',count(*),'row_limit',512,'complete',count(*)<=512,
      'rows',CASE WHEN count(*)<=512 THEN coalesce(pg_catalog.jsonb_agg(v ORDER BY v::text COLLATE "C"),'[]'::jsonb) ELSE '[]'::jsonb END)
      FROM (SELECT pg_catalog.jsonb_build_object('schema',n.nspname,'name',c.relname,'kind',c.relkind,'persistence',c.relpersistence,'partition',c.relispartition,'replica_identity',c.relreplident,'options',c.reloptions,'tablespace',t.spcname,'partition_bound_sha256',pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to((coalesce(pg_catalog.pg_get_expr(c.relpartbound,c.oid),'NULL'))::text,'UTF8')),'hex'),'view_definition_sha256',CASE WHEN c.relkind IN ('v','m') THEN pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to((pg_catalog.pg_get_viewdef(c.oid))::text,'UTF8')),'hex') END,'view_populated',CASE WHEN c.relkind='m' THEN c.relispopulated END) FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace LEFT JOIN pg_catalog.pg_tablespace t ON t.oid=c.reltablespace WHERE n.nspname IN ('public','private','ingestion','auth') AND c.relkind IN ('r','p','v','m','f','S')) q(v)),'columns',(SELECT pg_catalog.jsonb_build_object('total',count(*),'row_limit',4096,'complete',count(*)<=4096,
      'rows',CASE WHEN count(*)<=4096 THEN coalesce(pg_catalog.jsonb_agg(v ORDER BY v::text COLLATE "C"),'[]'::jsonb) ELSE '[]'::jsonb END)
      FROM (SELECT pg_catalog.jsonb_build_object('schema',n.nspname,'table',c.relname,'column',a.attname,'position',a.attnum,'type',pg_catalog.format_type(a.atttypid,a.atttypmod),'not_null',a.attnotnull,'identity',a.attidentity,'generated',a.attgenerated,'storage',a.attstorage,'compression',a.attcompression,'collation_schema',cn.nspname,'collation',co.collname,'default_sha256',pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to((coalesce(pg_catalog.pg_get_expr(d.adbin,d.adrelid),'NULL'))::text,'UTF8')),'hex'),'default_pretty_sha256',pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to((coalesce(pg_catalog.pg_get_expr(d.adbin,d.adrelid,true),'NULL'))::text,'UTF8')),'hex')) FROM pg_catalog.pg_attribute a JOIN pg_catalog.pg_class c ON c.oid=a.attrelid JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace LEFT JOIN pg_catalog.pg_attrdef d ON d.adrelid=a.attrelid AND d.adnum=a.attnum LEFT JOIN pg_catalog.pg_collation co ON co.oid=a.attcollation LEFT JOIN pg_catalog.pg_namespace cn ON cn.oid=co.collnamespace WHERE n.nspname IN ('public','private','ingestion','auth') AND c.relkind IN ('r','p','v','m','f') AND a.attnum>0 AND NOT a.attisdropped) q(v)),'inheritance',(SELECT pg_catalog.jsonb_build_object('total',count(*),'row_limit',512,'complete',count(*)<=512,
      'rows',CASE WHEN count(*)<=512 THEN coalesce(pg_catalog.jsonb_agg(v ORDER BY v::text COLLATE "C"),'[]'::jsonb) ELSE '[]'::jsonb END)
      FROM (SELECT pg_catalog.jsonb_build_object('child_schema',n.nspname,'child',c.relname,'parent_schema',pn.nspname,'parent',p.relname,'sequence',i.inhseqno,'detach_pending',i.inhdetachpending) FROM pg_catalog.pg_inherits i JOIN pg_catalog.pg_class c ON c.oid=i.inhrelid JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace JOIN pg_catalog.pg_class p ON p.oid=i.inhparent JOIN pg_catalog.pg_namespace pn ON pn.oid=p.relnamespace WHERE n.nspname IN ('public','private','ingestion','auth')) q(v)),'sequences',(SELECT pg_catalog.jsonb_build_object('total',count(*),'row_limit',128,'complete',count(*)<=128,
      'rows',CASE WHEN count(*)<=128 THEN coalesce(pg_catalog.jsonb_agg(v ORDER BY v::text COLLATE "C"),'[]'::jsonb) ELSE '[]'::jsonb END)
      FROM (SELECT pg_catalog.jsonb_build_object('schema',n.nspname,'name',c.relname,'type',pg_catalog.format_type(s.seqtypid,NULL),'start',s.seqstart::text,'increment',s.seqincrement::text,'minimum',s.seqmin::text,'maximum',s.seqmax::text,'cache',s.seqcache::text,'cycle',s.seqcycle,'owned_by',(SELECT pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('schema',tn.nspname,'table',tc.relname,'column',a.attname,'dependency',d.deptype)) FROM pg_catalog.pg_depend d JOIN pg_catalog.pg_class tc ON tc.oid=d.refobjid JOIN pg_catalog.pg_namespace tn ON tn.oid=tc.relnamespace JOIN pg_catalog.pg_attribute a ON a.attrelid=tc.oid AND a.attnum=d.refobjsubid WHERE d.classid='pg_catalog.pg_class'::regclass AND d.objid=c.oid AND d.refclassid='pg_catalog.pg_class'::regclass AND d.deptype IN ('a','i'))) FROM pg_catalog.pg_sequence s JOIN pg_catalog.pg_class c ON c.oid=s.seqrelid JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname IN ('public','private','ingestion','auth')) q(v))) AS body),
sized AS (SELECT body,pg_catalog.octet_length(body::text) AS bytes FROM payload)
SELECT pg_catalog.jsonb_build_object('query_id','R04','expected_project_ref','hskfanrqwtqknzpquwhg',
 'snapshot_at',pg_catalog.transaction_timestamp(),'read_only',pg_catalog.current_setting('transaction_read_only'),
 'statement_timeout',pg_catalog.current_setting('statement_timeout'),'lock_timeout',pg_catalog.current_setting('lock_timeout'),
 'output_bytes',bytes,'byte_limit',2097152,'byte_limit_ok',bytes<=2097152,
 'payload',CASE WHEN bytes<=2097152 THEN body ELSE NULL END) AS recovery_profile_observation FROM sized;

-- R05: Fresh definition/ACL/RLS metadata hashes only; no application function execution or body text
WITH roles AS (
 SELECT r.oid,r.rolname,r.rolcanlogin,r.rolsuper,r.rolbypassrls,r.rolcreatedb,r.rolcreaterole,r.rolreplication,r.rolinherit,r.rolconnlimit,r.rolvaliduntil,r.rolconfig, CASE WHEN r.rolname ~ '^[A-Za-z_][A-Za-z0-9_]{0,62}$' THEN r.rolname::text
 ELSE 'REDACTED_ROLE_SHA256:'||pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(r.rolname::text,'UTF8')),'hex') END AS identity,
 r.rolname ~ '^[A-Za-z_][A-Za-z0-9_]{0,62}$' AS identity_complete
 FROM pg_catalog.pg_roles r
),
payload AS (SELECT pg_catalog.jsonb_build_object('functions',(SELECT pg_catalog.jsonb_build_object('total',count(*),'row_limit',1024,'complete',count(*)<=1024,
      'rows',CASE WHEN count(*)<=1024 THEN coalesce(pg_catalog.jsonb_agg(v ORDER BY v::text COLLATE "C"),'[]'::jsonb) ELSE '[]'::jsonb END)
      FROM (SELECT pg_catalog.jsonb_build_object('schema',n.nspname,'name',p.proname,'args',pg_catalog.pg_get_function_identity_arguments(p.oid),'result',pg_catalog.pg_get_function_result(p.oid),'kind',p.prokind,'owner',r.identity,'language',l.lanname,'security_definer',p.prosecdef,'volatility',p.provolatile,'parallel',p.proparallel,'leakproof',p.proleakproof,'strict',p.proisstrict,'settings',(SELECT pg_catalog.jsonb_build_object('is_null',(p.proconfig) IS NULL,
     'unsupported_count',count(*) FILTER (WHERE NOT (
 (pg_catalog.split_part(s.entry,'=',1) IN ('statement_timeout','lock_timeout','idle_in_transaction_session_timeout','transaction_timeout')
   AND pg_catalog.substr(s.entry,pg_catalog.strpos(s.entry,'=')+1) ~ '^[0-9]+(ms|s|min|h|d)?$')
 OR (pg_catalog.split_part(s.entry,'=',1) IN ('default_transaction_read_only','row_security','check_function_bodies')
   AND pg_catalog.substr(s.entry,pg_catalog.strpos(s.entry,'=')+1) IN ('on','off','true','false'))
 OR (pg_catalog.split_part(s.entry,'=',1)='default_transaction_isolation'
   AND pg_catalog.substr(s.entry,pg_catalog.strpos(s.entry,'=')+1) IN ('serializable','repeatable read','read committed','read uncommitted'))
 OR (pg_catalog.split_part(s.entry,'=',1) IN ('search_path','pgrst.db_schemas','pgrst.db_extra_search_path','default_tablespace','temp_tablespaces')
   AND pg_catalog.substr(s.entry,pg_catalog.strpos(s.entry,'=')+1) ~ '^[A-Za-z0-9_ ,"$\\.-]*$')
 OR (pg_catalog.split_part(s.entry,'=',1) IN ('client_min_messages','log_min_messages')
   AND pg_catalog.substr(s.entry,pg_catalog.strpos(s.entry,'=')+1) IN ('debug5','debug4','debug3','debug2','debug1','info','notice','warning','error','log','fatal','panic'))
 OR (pg_catalog.split_part(s.entry,'=',1)='log_statement' AND pg_catalog.substr(s.entry,pg_catalog.strpos(s.entry,'=')+1) IN ('none','ddl','mod','all'))
 OR (pg_catalog.split_part(s.entry,'=',1) IN ('session_preload_libraries','local_preload_libraries') AND pg_catalog.substr(s.entry,pg_catalog.strpos(s.entry,'=')+1) ~ '^[A-Za-z0-9_ ,]*$')
 OR (pg_catalog.split_part(s.entry,'=',1)='session_replication_role'
   AND pg_catalog.substr(s.entry,pg_catalog.strpos(s.entry,'=')+1) IN ('origin','replica','local'))
)),
     'entries',coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('position',s.position,
       'key',CASE WHEN pg_catalog.split_part(s.entry,'=',1) ~ '^[a-z_][a-z0-9_.]*$' THEN pg_catalog.split_part(s.entry,'=',1) ELSE 'REDACTED_KEY' END,
       'value',CASE WHEN (
 (pg_catalog.split_part(s.entry,'=',1) IN ('statement_timeout','lock_timeout','idle_in_transaction_session_timeout','transaction_timeout')
   AND pg_catalog.substr(s.entry,pg_catalog.strpos(s.entry,'=')+1) ~ '^[0-9]+(ms|s|min|h|d)?$')
 OR (pg_catalog.split_part(s.entry,'=',1) IN ('default_transaction_read_only','row_security','check_function_bodies')
   AND pg_catalog.substr(s.entry,pg_catalog.strpos(s.entry,'=')+1) IN ('on','off','true','false'))
 OR (pg_catalog.split_part(s.entry,'=',1)='default_transaction_isolation'
   AND pg_catalog.substr(s.entry,pg_catalog.strpos(s.entry,'=')+1) IN ('serializable','repeatable read','read committed','read uncommitted'))
 OR (pg_catalog.split_part(s.entry,'=',1) IN ('search_path','pgrst.db_schemas','pgrst.db_extra_search_path','default_tablespace','temp_tablespaces')
   AND pg_catalog.substr(s.entry,pg_catalog.strpos(s.entry,'=')+1) ~ '^[A-Za-z0-9_ ,"$\\.-]*$')
 OR (pg_catalog.split_part(s.entry,'=',1) IN ('client_min_messages','log_min_messages')
   AND pg_catalog.substr(s.entry,pg_catalog.strpos(s.entry,'=')+1) IN ('debug5','debug4','debug3','debug2','debug1','info','notice','warning','error','log','fatal','panic'))
 OR (pg_catalog.split_part(s.entry,'=',1)='log_statement' AND pg_catalog.substr(s.entry,pg_catalog.strpos(s.entry,'=')+1) IN ('none','ddl','mod','all'))
 OR (pg_catalog.split_part(s.entry,'=',1) IN ('session_preload_libraries','local_preload_libraries') AND pg_catalog.substr(s.entry,pg_catalog.strpos(s.entry,'=')+1) ~ '^[A-Za-z0-9_ ,]*$')
 OR (pg_catalog.split_part(s.entry,'=',1)='session_replication_role'
   AND pg_catalog.substr(s.entry,pg_catalog.strpos(s.entry,'=')+1) IN ('origin','replica','local'))
) THEN pg_catalog.substr(s.entry,pg_catalog.strpos(s.entry,'=')+1) END,
       'value_available',(
 (pg_catalog.split_part(s.entry,'=',1) IN ('statement_timeout','lock_timeout','idle_in_transaction_session_timeout','transaction_timeout')
   AND pg_catalog.substr(s.entry,pg_catalog.strpos(s.entry,'=')+1) ~ '^[0-9]+(ms|s|min|h|d)?$')
 OR (pg_catalog.split_part(s.entry,'=',1) IN ('default_transaction_read_only','row_security','check_function_bodies')
   AND pg_catalog.substr(s.entry,pg_catalog.strpos(s.entry,'=')+1) IN ('on','off','true','false'))
 OR (pg_catalog.split_part(s.entry,'=',1)='default_transaction_isolation'
   AND pg_catalog.substr(s.entry,pg_catalog.strpos(s.entry,'=')+1) IN ('serializable','repeatable read','read committed','read uncommitted'))
 OR (pg_catalog.split_part(s.entry,'=',1) IN ('search_path','pgrst.db_schemas','pgrst.db_extra_search_path','default_tablespace','temp_tablespaces')
   AND pg_catalog.substr(s.entry,pg_catalog.strpos(s.entry,'=')+1) ~ '^[A-Za-z0-9_ ,"$\\.-]*$')
 OR (pg_catalog.split_part(s.entry,'=',1) IN ('client_min_messages','log_min_messages')
   AND pg_catalog.substr(s.entry,pg_catalog.strpos(s.entry,'=')+1) IN ('debug5','debug4','debug3','debug2','debug1','info','notice','warning','error','log','fatal','panic'))
 OR (pg_catalog.split_part(s.entry,'=',1)='log_statement' AND pg_catalog.substr(s.entry,pg_catalog.strpos(s.entry,'=')+1) IN ('none','ddl','mod','all'))
 OR (pg_catalog.split_part(s.entry,'=',1) IN ('session_preload_libraries','local_preload_libraries') AND pg_catalog.substr(s.entry,pg_catalog.strpos(s.entry,'=')+1) ~ '^[A-Za-z0-9_ ,]*$')
 OR (pg_catalog.split_part(s.entry,'=',1)='session_replication_role'
   AND pg_catalog.substr(s.entry,pg_catalog.strpos(s.entry,'=')+1) IN ('origin','replica','local'))
)) ORDER BY s.position),'[]'::jsonb))
     FROM pg_catalog.unnest(p.proconfig) WITH ORDINALITY s(entry,position)),'body_sha256',pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to((p.prosrc)::text,'UTF8')),'hex'),'definition_sha256',pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to((pg_catalog.pg_get_functiondef(p.oid))::text,'UTF8')),'hex')) FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace JOIN pg_catalog.pg_language l ON l.oid=p.prolang JOIN roles r ON r.oid=p.proowner WHERE n.nspname IN ('public','private','ingestion','auth') AND p.prokind<>'a') q(v)),'rls',(SELECT pg_catalog.jsonb_build_object('total',count(*),'row_limit',512,'complete',count(*)<=512,
      'rows',CASE WHEN count(*)<=512 THEN coalesce(pg_catalog.jsonb_agg(v ORDER BY v::text COLLATE "C"),'[]'::jsonb) ELSE '[]'::jsonb END)
      FROM (SELECT pg_catalog.jsonb_build_object('schema',n.nspname,'table',c.relname,'enabled',c.relrowsecurity,'forced',c.relforcerowsecurity) FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname IN ('public','private','ingestion','auth') AND c.relkind IN ('r','p')) q(v)),'policies',(SELECT pg_catalog.jsonb_build_object('total',count(*),'row_limit',1024,'complete',count(*)<=1024,
      'rows',CASE WHEN count(*)<=1024 THEN coalesce(pg_catalog.jsonb_agg(v ORDER BY v::text COLLATE "C"),'[]'::jsonb) ELSE '[]'::jsonb END)
      FROM (SELECT pg_catalog.jsonb_build_object('schema',n.nspname,'table',c.relname,'name',p.polname,'command',p.polcmd,'permissive',p.polpermissive,'roles_in_oid_order',(SELECT pg_catalog.jsonb_agg(CASE WHEN x.id=0 THEN 'PUBLIC' ELSE r.identity END ORDER BY x.id) FROM pg_catalog.unnest(p.polroles) x(id) LEFT JOIN roles r ON r.oid=x.id),'using_sha256',pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to((coalesce(pg_catalog.pg_get_expr(p.polqual,p.polrelid),'NULL'))::text,'UTF8')),'hex'),'check_sha256',pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to((coalesce(pg_catalog.pg_get_expr(p.polwithcheck,p.polrelid),'NULL'))::text,'UTF8')),'hex')) FROM pg_catalog.pg_policy p JOIN pg_catalog.pg_class c ON c.oid=p.polrelid JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname IN ('public','private','ingestion','auth')) q(v)),'constraints',(SELECT pg_catalog.jsonb_build_object('total',count(*),'row_limit',2048,'complete',count(*)<=2048,
      'rows',CASE WHEN count(*)<=2048 THEN coalesce(pg_catalog.jsonb_agg(v ORDER BY v::text COLLATE "C"),'[]'::jsonb) ELSE '[]'::jsonb END)
      FROM (SELECT pg_catalog.jsonb_build_object('schema',n.nspname,'table',c.relname,'name',x.conname,'type',x.contype,'validated',x.convalidated,'definition_sha256',pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to((pg_catalog.pg_get_constraintdef(x.oid))::text,'UTF8')),'hex'),'definition_pretty_sha256',pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to((pg_catalog.pg_get_constraintdef(x.oid,true))::text,'UTF8')),'hex')) FROM pg_catalog.pg_constraint x JOIN pg_catalog.pg_class c ON c.oid=x.conrelid JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname IN ('public','private','ingestion','auth')) q(v)),'triggers',(SELECT pg_catalog.jsonb_build_object('total',count(*),'row_limit',1024,'complete',count(*)<=1024,
      'rows',CASE WHEN count(*)<=1024 THEN coalesce(pg_catalog.jsonb_agg(v ORDER BY v::text COLLATE "C"),'[]'::jsonb) ELSE '[]'::jsonb END)
      FROM (SELECT pg_catalog.jsonb_build_object('schema',n.nspname,'table',c.relname,'name',t.tgname,'enabled',t.tgenabled,'definition_sha256',pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to((pg_catalog.pg_get_triggerdef(t.oid))::text,'UTF8')),'hex'),'definition_pretty_sha256',pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to((pg_catalog.pg_get_triggerdef(t.oid,true))::text,'UTF8')),'hex'),'function_schema',fn.nspname,'function_name',p.proname,'function_args',pg_catalog.pg_get_function_identity_arguments(p.oid)) FROM pg_catalog.pg_trigger t JOIN pg_catalog.pg_class c ON c.oid=t.tgrelid JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace JOIN pg_catalog.pg_proc p ON p.oid=t.tgfoid JOIN pg_catalog.pg_namespace fn ON fn.oid=p.pronamespace WHERE n.nspname IN ('public','private','ingestion','auth') AND NOT t.tgisinternal) q(v))) AS body),
sized AS (SELECT body,pg_catalog.octet_length(body::text) AS bytes FROM payload)
SELECT pg_catalog.jsonb_build_object('query_id','R05','expected_project_ref','hskfanrqwtqknzpquwhg',
 'snapshot_at',pg_catalog.transaction_timestamp(),'read_only',pg_catalog.current_setting('transaction_read_only'),
 'statement_timeout',pg_catalog.current_setting('statement_timeout'),'lock_timeout',pg_catalog.current_setting('lock_timeout'),
 'output_bytes',bytes,'byte_limit',2097152,'byte_limit_ok',bytes<=2097152,
 'payload',CASE WHEN bytes<=2097152 THEN body ELSE NULL END) AS recovery_profile_observation FROM sized;

-- R06: Effective permissions for API/reader/ingestion roles, including inherited authority; masks have fixed documented order
WITH roles AS (
 SELECT r.oid,r.rolname,r.rolcanlogin,r.rolsuper,r.rolbypassrls,r.rolcreatedb,r.rolcreaterole,r.rolreplication,r.rolinherit,r.rolconnlimit,r.rolvaliduntil,r.rolconfig, CASE WHEN r.rolname ~ '^[A-Za-z_][A-Za-z0-9_]{0,62}$' THEN r.rolname::text
 ELSE 'REDACTED_ROLE_SHA256:'||pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(r.rolname::text,'UTF8')),'hex') END AS identity,
 r.rolname ~ '^[A-Za-z_][A-Za-z0-9_]{0,62}$' AS identity_complete
 FROM pg_catalog.pg_roles r
),tracked AS (SELECT * FROM roles WHERE rolname IN ('anon','authenticated','authenticator','service_role','diary_dataset_reader','postgres','supabase_admin') OR rolname LIKE 'ingestion\_%' ESCAPE '\'),
payload AS (SELECT pg_catalog.jsonb_build_object('roles',(SELECT pg_catalog.jsonb_build_object('total',count(*),'row_limit',64,'complete',count(*)<=64,
      'rows',CASE WHEN count(*)<=64 THEN coalesce(pg_catalog.jsonb_agg(v ORDER BY v::text COLLATE "C"),'[]'::jsonb) ELSE '[]'::jsonb END)
      FROM (SELECT pg_catalog.jsonb_build_object('name',identity) FROM tracked) q(v)),'tables',(SELECT pg_catalog.jsonb_build_object('total',count(*),'row_limit',32768,'complete',count(*)<=32768,
      'rows',CASE WHEN count(*)<=32768 THEN coalesce(pg_catalog.jsonb_agg(v ORDER BY v::text COLLATE "C"),'[]'::jsonb) ELSE '[]'::jsonb END)
      FROM (SELECT pg_catalog.jsonb_build_object('role',r.identity,'object',n.nspname||'.'||c.relname,'table_mask',(SELECT pg_catalog.string_agg(CASE WHEN pg_catalog.has_table_privilege(r.oid,c.oid,p.name) THEN '1' ELSE '0' END,'' ORDER BY p.position) FROM pg_catalog.unnest(ARRAY['SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER','MAINTAIN']) WITH ORDINALITY p(name,position)),'any_column_mask',(SELECT pg_catalog.string_agg(CASE WHEN pg_catalog.has_any_column_privilege(r.oid,c.oid,p.name) THEN '1' ELSE '0' END,'' ORDER BY p.position) FROM pg_catalog.unnest(ARRAY['SELECT','INSERT','UPDATE','REFERENCES']) WITH ORDINALITY p(name,position))) FROM tracked r CROSS JOIN pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname IN ('public','private','ingestion','auth') AND c.relkind IN ('r','p','v','m','f')) q(v)),'functions',(SELECT pg_catalog.jsonb_build_object('total',count(*),'row_limit',65536,'complete',count(*)<=65536,
      'rows',CASE WHEN count(*)<=65536 THEN coalesce(pg_catalog.jsonb_agg(v ORDER BY v::text COLLATE "C"),'[]'::jsonb) ELSE '[]'::jsonb END)
      FROM (SELECT pg_catalog.jsonb_build_object('role',r.identity,'schema',n.nspname,'name',p.proname,'args',pg_catalog.pg_get_function_identity_arguments(p.oid),'execute',pg_catalog.has_function_privilege(r.oid,p.oid,'EXECUTE')) FROM tracked r CROSS JOIN pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname IN ('public','private','ingestion','auth')) q(v)),'schemas',(SELECT pg_catalog.jsonb_build_object('total',count(*),'row_limit',256,'complete',count(*)<=256,
      'rows',CASE WHEN count(*)<=256 THEN coalesce(pg_catalog.jsonb_agg(v ORDER BY v::text COLLATE "C"),'[]'::jsonb) ELSE '[]'::jsonb END)
      FROM (SELECT pg_catalog.jsonb_build_object('role',r.identity,'schema',n.nspname,'usage',pg_catalog.has_schema_privilege(r.oid,n.oid,'USAGE'),'create',pg_catalog.has_schema_privilege(r.oid,n.oid,'CREATE')) FROM tracked r CROSS JOIN pg_catalog.pg_namespace n WHERE n.nspname IN ('public','private','ingestion','auth')) q(v)),'role_reachability',(SELECT pg_catalog.jsonb_build_object('total',count(*),'row_limit',16384,'complete',count(*)<=16384,
      'rows',CASE WHEN count(*)<=16384 THEN coalesce(pg_catalog.jsonb_agg(v ORDER BY v::text COLLATE "C"),'[]'::jsonb) ELSE '[]'::jsonb END)
      FROM (SELECT pg_catalog.jsonb_build_object('member',r.identity,'role',t.identity,'member_path',pg_catalog.pg_has_role(r.oid,t.oid,'MEMBER'),'inherit_path',pg_catalog.pg_has_role(r.oid,t.oid,'USAGE'),'set_path',pg_catalog.pg_has_role(r.oid,t.oid,'SET')) FROM tracked r CROSS JOIN roles t) q(v))) AS body),
sized AS (SELECT body,pg_catalog.octet_length(body::text) AS bytes FROM payload)
SELECT pg_catalog.jsonb_build_object('query_id','R06','expected_project_ref','hskfanrqwtqknzpquwhg',
 'snapshot_at',pg_catalog.transaction_timestamp(),'read_only',pg_catalog.current_setting('transaction_read_only'),
 'statement_timeout',pg_catalog.current_setting('statement_timeout'),'lock_timeout',pg_catalog.current_setting('lock_timeout'),
 'output_bytes',bytes,'byte_limit',2097152,'byte_limit_ok',bytes<=2097152,
 'payload',CASE WHEN bytes<=2097152 THEN body ELSE NULL END) AS recovery_profile_observation FROM sized;

-- R07: Fresh accepted migration metadata and public nutrient dictionary definitions; no owner/Auth payload
WITH roles AS (
 SELECT r.oid,r.rolname,r.rolcanlogin,r.rolsuper,r.rolbypassrls,r.rolcreatedb,r.rolcreaterole,r.rolreplication,r.rolinherit,r.rolconnlimit,r.rolvaliduntil,r.rolconfig, CASE WHEN r.rolname ~ '^[A-Za-z_][A-Za-z0-9_]{0,62}$' THEN r.rolname::text
 ELSE 'REDACTED_ROLE_SHA256:'||pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(r.rolname::text,'UTF8')),'hex') END AS identity,
 r.rolname ~ '^[A-Za-z_][A-Za-z0-9_]{0,62}$' AS identity_complete
 FROM pg_catalog.pg_roles r
),
payload AS (SELECT pg_catalog.jsonb_build_object('ledger',(SELECT pg_catalog.jsonb_build_object('total',count(*),'row_limit',64,'complete',count(*)<=64,
      'rows',CASE WHEN count(*)<=64 THEN coalesce(pg_catalog.jsonb_agg(v ORDER BY v::text COLLATE "C"),'[]'::jsonb) ELSE '[]'::jsonb END)
      FROM (SELECT pg_catalog.jsonb_build_object('ordinal',pg_catalog.row_number() OVER (ORDER BY version),'version',version,'name',name,'statement_hashes',(SELECT pg_catalog.jsonb_agg(pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(s.body,'UTF8')),'hex') ORDER BY s.position) FROM pg_catalog.unnest(statements) WITH ORDINALITY s(body,position))) FROM supabase_migrations.schema_migrations) q(v)),'extensions',(SELECT pg_catalog.jsonb_build_object('total',count(*),'row_limit',64,'complete',count(*)<=64,
      'rows',CASE WHEN count(*)<=64 THEN coalesce(pg_catalog.jsonb_agg(v ORDER BY v::text COLLATE "C"),'[]'::jsonb) ELSE '[]'::jsonb END)
      FROM (SELECT pg_catalog.jsonb_build_object('name',e.extname,'version',e.extversion,'schema',n.nspname,'owner',r.identity) FROM pg_catalog.pg_extension e JOIN pg_catalog.pg_namespace n ON n.oid=e.extnamespace JOIN roles r ON r.oid=e.extowner) q(v)),'dictionary',(SELECT pg_catalog.jsonb_build_object('total',count(*),'row_limit',64,'complete',count(*)<=64,
      'rows',CASE WHEN count(*)<=64 THEN coalesce(pg_catalog.jsonb_agg(v ORDER BY v::text COLLATE "C"),'[]'::jsonb) ELSE '[]'::jsonb END)
      FROM (SELECT pg_catalog.jsonb_build_object('code',code,'unit',unit) FROM public.nutrients) q(v))) AS body),
sized AS (SELECT body,pg_catalog.octet_length(body::text) AS bytes FROM payload)
SELECT pg_catalog.jsonb_build_object('query_id','R07','expected_project_ref','hskfanrqwtqknzpquwhg',
 'snapshot_at',pg_catalog.transaction_timestamp(),'read_only',pg_catalog.current_setting('transaction_read_only'),
 'statement_timeout',pg_catalog.current_setting('statement_timeout'),'lock_timeout',pg_catalog.current_setting('lock_timeout'),
 'output_bytes',bytes,'byte_limit',2097152,'byte_limit_ok',bytes<=2097152,
 'payload',CASE WHEN bytes<=2097152 THEN body ELSE NULL END) AS recovery_profile_observation FROM sized;

ROLLBACK;
