import { canonicalize, fail, sha256 } from "./phase-11i-recovery-contract.mjs";
import { readFileSync } from "node:fs";
import { FULL35_REVIEWED_HISTORY } from "./full35-recovery-history.mjs";

const identifier = /^(?:public|ingestion|auth)\.[a-z_]+$/;
const uuid = /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/;
export function full35AtomicRejectionMessage(stderr) {
  // Report only known guard labels. PostgreSQL DETAIL can contain private rows.
  if (stderr.includes("Full35 complete persisted row fingerprint mismatch")) return "Full35 complete persisted row fingerprint mismatch; atomic data replay rolled back.";
  if (stderr.includes("Full35 target marker changed during recovery")) return "Full35 target marker changed during recovery; atomic data replay rolled back.";
  if (stderr.includes("Copied actor authorization unexpectedly active")) return "Copied actor authorization unexpectedly active; atomic data replay rolled back.";
  return "Full35 atomic data replay failed outside the reviewed integrity guards.";
}
export function assertFull35SourceMetadata(value) {
  if (value?.schemaVersion !== "phase-11i-full35-recovery/v1" || !uuid.test(value?.sourceClusterMarker ?? "") ||
      !/^[a-f0-9]{64}$/.test(value?.installedContractHash ?? "") || !/^[a-f0-9]{64}$/.test(value?.reviewedSchemaHash ?? "") ||
      !value.rowFingerprints || Object.keys(value.rowFingerprints).length !== 78 ||
      Object.entries(value.rowFingerprints).some(([name,row]) => !identifier.test(name) || !Number.isSafeInteger(row.count) || row.count < 0 || !/^[a-f0-9]{64}$/.test(row.sha256 ?? ""))) {
    fail("Full35 recovery metadata mismatch.");
  }
}
export function assertFull35SchemaHash(expected, actual) {
  if (!/^[a-f0-9]{64}$/.test(expected ?? "") || expected !== actual) fail("Full35 installed schema, roles or ACL fingerprint mismatch.");
}
export function full35FingerprintSql(tables) {
  if (!tables.length || tables.some(name => !identifier.test(name))) fail("Unsafe Full35 table inventory.");
  return tables.map(name => `select '${name}' name,count(*)::text count,
    encode(sha256(convert_to(coalesce(string_agg(h,'' order by h collate "C"),''),'UTF8')),'hex') digest
    from (select encode(sha256(convert_to(to_jsonb(t)::text,'UTF8')),'hex') h from ${name} t) r`).join(" union all ");
}
export function full35TableFingerprints(rows) {
  const tables = rows(`select schemaname||'.'||tablename from pg_tables
    where schemaname in ('public','ingestion') or
    (schemaname='auth' and tablename in ('users','identities','mfa_factors','webauthn_credentials')) order by 1`).map(([name]) => name);
  if (!tables.length || tables.some(name => !identifier.test(name))) fail("Unsafe Full35 table inventory.");
  // A sorted multiset of complete canonical row hashes retains IDs, decimals,
  // timestamps, duplicates and explicit nulls without exporting private rows.
  const sql = full35FingerprintSql(tables);
  return Object.fromEntries(rows(sql + " order by 1").map(([name, count, digest]) => [name, {count:Number(count),sha256:digest}]));
}
export function full35AtomicRestoreGuard(source, freshMarker) {
  assertFreshFull35Marker(source?.sourceClusterMarker,freshMarker);
  const expected = source.rowFingerprints;
  if (!expected || Object.values(expected).some(row => !Number.isSafeInteger(row.count) || row.count < 0 || !/^[a-f0-9]{64}$/.test(row.sha256))) fail("Invalid Full35 recovery row fingerprint metadata.");
  const sql = full35FingerprintSql(Object.keys(expected));
  const literal = JSON.stringify(expected).replaceAll("'","''");
  return `do $full35_restore_guard$ declare observed jsonb; begin
    select jsonb_object_agg(name,jsonb_build_object('count',count::bigint,'sha256',digest)) into observed from (${sql}) hashes;
    if observed is distinct from '${literal}'::jsonb then raise exception 'Full35 complete persisted row fingerprint mismatch';end if;
    if (select cluster_id::text from private.mapping_actor_cluster_epoch where singleton) is distinct from '${freshMarker}' then
      raise exception 'Full35 target marker changed during recovery';end if;
    if exists(select from ingestion.mapping_actor_current_bindings where cluster_id='${freshMarker}') then
      raise exception 'Copied actor authorization unexpectedly active';end if;
    end $full35_restore_guard$;`;
}
export function full35ClusterMarker(rows) {
  const result = rows("select cluster_id::text from private.mapping_actor_cluster_epoch where singleton");
  if (result.length !== 1 || !uuid.test(result[0][0])) fail("Full35 operational marker missing or invalid.");
  return result[0][0];
}
export function assertFreshFull35Marker(source, target, current = target) {
  if (!uuid.test(source ?? "") || !uuid.test(target ?? "") || source === target || target !== current) {
    fail("Full35 target marker is copied, missing or changed during recovery.");
  }
}
export function assertFull35Payload(data) {
  // Application data has no legitimate reference to this operational relation.
  // Reject even an attempted copy before the first target reset or data replay.
  if (/mapping_actor_cluster_epoch/i.test(data)) fail("Source private marker in recovery payload is forbidden.");
  if (/^\s*(?:BEGIN|COMMIT|ROLLBACK|END)\b/im.test(data)) fail("Full35 dump must not override the atomic restore transaction.");
}
export function assertFull35Rows(expected, actual) {
  if (!expected || canonicalize(expected) !== canonicalize(actual)) fail("Full35 complete persisted row fingerprint mismatch.");
}
export function validateFull35Integrity(rows) {
  const violations = rows(`
    select 'rls',count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace
      where n.nspname in ('public','ingestion') and c.relkind='r' and not c.relrowsecurity
    union all select 'execution_context',count(*) from ingestion.mapping_reprojection_execution_context
    union all select 'actor_principal',count(*) from ingestion.mapping_actor_principals t
      where body<>to_jsonb(t)-array['body','body_hash'] or body_hash<>ingestion.fingerprint_mapping_json_v1(body)
    union all select 'actor_request',count(*) from ingestion.mapping_actor_binding_requests t
      where body<>to_jsonb(t)-array['body','body_hash'] or body_hash<>ingestion.fingerprint_mapping_json_v1(body)
    union all select 'actor_decision',count(*) from ingestion.mapping_actor_bindings t
      where body<>to_jsonb(t)-array['body','body_hash'] or body_hash<>ingestion.fingerprint_mapping_json_v1(body)
    union all select 'receipt_hash',count(*) from ingestion.mapping_reprojection_receipts
      where receipt_hash<>ingestion.fingerprint_mapping_json_v1(receipt_body)
    union all select 'event_hash',count(*) from ingestion.mapping_reprojection_events
      where event_hash<>ingestion.fingerprint_mapping_json_v1(event_body)
    union all select 'v1_projection_hash',count(*) from ingestion.food_projection_versions p
      where projection_contract_version='foundation-lifecycle-projection/v1'
      and lifecycle_projection_hash<>ingestion.fingerprint_json_v1(ingestion.foundation_lifecycle_projection_version_body_v1(p.id))
    union all select 'v2_projection_hash',count(*) from ingestion.food_projection_versions p
      where projection_contract_version='foundation-lifecycle-projection/v2' and
      (projection_hash<>ingestion.fingerprint_mapping_json_v1(ingestion.mapping_projection_body_v2(p.id)) or
       lifecycle_projection_hash<>ingestion.mapping_lifecycle_hash_v2(ingestion.mapping_projection_body_v2(p.id)))
    union all select 'dataset_pointer',count(*) from ingestion.dataset_projection_current_heads c
      left join ingestion.dataset_projection_heads h on h.id=c.current_dataset_projection_head_id
      where h.id is null or h.head_version<>c.current_head_version or
        h.dataset_projection_fingerprint<>c.current_projection_fingerprint or h.dataset_id<>c.dataset_id or h.environment<>c.environment
    union all select 'inserted_row_image',count(*) from ingestion.mapping_reprojection_inserted_rows r
      where r.public_row_id::text<>r.row_image->>'id' or r.food_id::text<>r.row_image->>'food_id' or
        r.nutrient_id::text<>r.row_image->>'nutrient_id' or r.amount<>(r.row_image->>'amount')::numeric or r.basis<>r.row_image->>'basis'
    order by 1`);
  if (violations.length !== 11 || violations.some(([, count]) => count !== "0")) fail("Full35 projection, receipt, authority or security integrity violation.");
  return Object.fromEntries(violations.map(([name]) => [name,"PASS"]));
}
export function captureFull35Recovery(rows, includeWriterBarrier = false) {
  const integrity = validateFull35Integrity(rows);
  return {schemaVersion:"phase-11i-full35-recovery/v1",sourceClusterMarker:full35ClusterMarker(rows),
    installedContractHash:rows("select ingestion.fingerprint_mapping_database_contract_v1()")[0][0],
    reviewedSchemaHash:full35ReviewedSchemaHash(rows, includeWriterBarrier),
    rowFingerprints:full35TableFingerprints(rows),integrity};
}
export function full35ReviewedSchemaHash(rows, includeWriterBarrier = false) {
  const bytes = readFileSync(`supabase/migrations/${FULL35_REVIEWED_HISTORY.filename}`);
  if (sha256(bytes) !== FULL35_REVIEWED_HISTORY.sqlSha256) fail("Reviewed Full35 SQL required for schema verification.");
  // Use the exact reviewed catalog query, excluding only dictionary row IDs.
  // Fresh migrations generate new dictionary UUIDs; the original complete rows
  // and full original installed-contract hash must match after data restoration.
  const body = bytes.toString("utf8").split("create function ingestion.fingerprint_mapping_database_contract_v1()\n")[1]?.split("as $$\n")[1]?.split("$$;")[0];
  const dictionary = "    'dictionary',(select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('id',id,'code',code,'unit',unit) order by code collate \"C\") from public.nutrients),\n";
  if (!body?.includes(dictionary)) fail("Pinned Full35 schema query extraction failed.");
  const catalog = rows(body.replace(dictionary,dictionary.replace("'id',id,","")))[0][0];
  const roles = rows(`select jsonb_build_object('roles',(select jsonb_agg(jsonb_build_object(
      'name',rolname,'login',rolcanlogin,'superuser',rolsuper,'bypassrls',rolbypassrls,'createdb',rolcreatedb,
      'createrole',rolcreaterole,'replication',rolreplication,'inherit',rolinherit,'connection_limit',rolconnlimit,
      'valid_until',rolvaliduntil,'settings',rolconfig) order by rolname collate "C") from pg_roles),
    'memberships',(select jsonb_agg(jsonb_build_object('member',m.rolname,'role',r.rolname,'grantor',g.rolname,
      'admin',a.admin_option,'inherit',a.inherit_option,'set',a.set_option)
      order by m.rolname collate "C",r.rolname collate "C",g.rolname collate "C")
      from pg_auth_members a join pg_roles m on m.oid=a.member join pg_roles r on r.oid=a.roleid join pg_roles g on g.oid=a.grantor))::jsonb
    ||case when exists(select from pg_roles where rolname='diary_dataset_reader') then jsonb_build_object(
      'atomicDefaults',(select jsonb_agg(jsonb_build_object('owner',pg_get_userbyid(d.defaclrole),'schema',n.nspname,
        'kind',d.defaclobjtype,'acl',d.defaclacl::text) order by pg_get_userbyid(d.defaclrole) collate "C",n.nspname collate "C",d.defaclobjtype)
        from pg_default_acl d left join pg_namespace n on n.oid=d.defaclnamespace
        where pg_get_userbyid(d.defaclrole)='diary_dataset_reader'))::jsonb else '{}'::jsonb end`)[0][0];
  const snapshot = { catalog, roles: JSON.parse(roles) };
  if (includeWriterBarrier) {
    // The existing catalog hash includes the functions, table ACLs, policies
    // and triggers. Also pin the non-exposed writer schema ACL and any
    // defaults for its owner. Keep old archive hashes byte-for-byte stable.
    snapshot.writerBarrier = JSON.parse(rows(`select jsonb_build_object(
      'privateSchema', (select jsonb_build_object('owner',pg_get_userbyid(nspowner),'acl',nspacl::text)
        from pg_namespace where nspname='private'),
      'writerDefaults', (select jsonb_agg(jsonb_build_object('schema',n.nspname,'kind',d.defaclobjtype,'acl',d.defaclacl::text)
        order by n.nspname collate "C",d.defaclobjtype)
        from pg_default_acl d left join pg_namespace n on n.oid=d.defaclnamespace
        where d.defaclrole='diary_reference_writer'::regrole))`)[0][0]);
  }
  return sha256(canonicalize(snapshot));
}
export function validateRestoredFull35(rows, source, freshMarker, reviewedContract, includeWriterBarrier = false) {
  assertFull35SourceMetadata(source);
  assertFreshFull35Marker(source.sourceClusterMarker,freshMarker,full35ClusterMarker(rows));
  const contract = rows("select ingestion.fingerprint_mapping_database_contract_v1()")[0][0];
  assertFull35SchemaHash(reviewedContract,full35ReviewedSchemaHash(rows, includeWriterBarrier));
  assertFull35SchemaHash(source.reviewedSchemaHash,reviewedContract);
  if (contract !== source.installedContractHash) fail("Full35 installed contract differs from reviewed target migration.");
  assertFull35Rows(source.rowFingerprints,full35TableFingerprints(rows));
  const active = Number(rows(`select count(*) from ingestion.mapping_actor_current_bindings where cluster_id='${freshMarker}'`)[0][0]);
  if (active !== 0) fail("Copied actor authorization unexpectedly active before independent rebinding.");
  const integrity = validateFull35Integrity(rows);
  return {result:"PASS",freshTargetMarker:true,sourceBindingsInactive:true,
    completeRowFingerprintsEqual:true,tablesCompared:Object.keys(source.rowFingerprints).length,
    installedContractEqual:true,integrity,fingerprintSetSha256:sha256(canonicalize(source.rowFingerprints))};
}
