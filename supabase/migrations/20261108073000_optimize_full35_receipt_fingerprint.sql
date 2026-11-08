-- Preserve the Full35 canonical bytes while avoiding per-scalar recursive calls.
-- Reserve one final authorization for the two recorded failed attempts.
do $full35_receipt_performance$
begin
  if not exists (select from pg_catalog.pg_roles where rolname='full35_release_owner' and not rolcanlogin)
    or pg_catalog.has_schema_privilege('ingestion_reprojection_definer','ingestion','CREATE')
    or exists (select from pg_catalog.pg_auth_members
      where roleid='ingestion_reprojection_definer'::regrole and member='postgres'::regrole
        and grantor='postgres'::regrole) then
    raise exception 'Unexpected Full35 owner login or function-owner authority before receipt repair';
  end if;

  drop index ingestion.foundation_owner_authorization_release_slot;
  create unique index foundation_owner_authorization_release_slot
    on ingestion.foundation_owner_authorization
    ((case when id='21a76747-c907-4b67-b324-d384a685b111'::uuid then 2 else 1 end))
    where id <> '283c6348-b19e-414f-a228-bc84f60c2297'::uuid;

create or replace function ingestion.guard_full35_owner_authorization_insert_v1()
returns trigger language plpgsql set search_path='' as $$
declare previous ingestion.foundation_owner_authorization;
  timed_out ingestion.foundation_owner_authorization;
begin
  -- The same keys serialize activation and successor admission, in lock order.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
    'nutrition-tracker:foundation-dataset-lifecycle:'||new.dataset_id::text,0));
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
    'nutrition-tracker:foundation-promotion:'||new.source_release_id::text,0));
  select a.* into previous from ingestion.foundation_owner_authorization a
    where a.id='283c6348-b19e-414f-a228-bc84f60c2297';
  if new.id='21a76747-c907-4b67-b324-d384a685b111' then
    select a.* into timed_out from ingestion.foundation_owner_authorization a
      where a.id='a7c2fa47-8ce7-412e-95e0-2e8edade247c'
        and a.plan_hash='6d2a06dd802abe1b1b217d375ec3a336dfb1cbd06ee57659c2d1a381bc096e1d';
    if not found or previous.id is null
      or pg_catalog.current_setting('transaction_isolation')<>'read committed'
      or pg_catalog.clock_timestamp()<greatest(previous.expires_at,timed_out.expires_at)
      or new.authorized_at<greatest(previous.expires_at,timed_out.expires_at)
      or new.expires_at<=pg_catalog.clock_timestamp()
      or new.plan_hash in (previous.plan_hash,timed_out.plan_hash)
      or new.retry_token in (previous.retry_token,timed_out.retry_token)
      or new.authorization_reference in (previous.authorization_reference,timed_out.authorization_reference)
      or new.diff_hash<>timed_out.diff_hash
      or (new.project_ref,new.environment,new.dataset_id,new.source_release_id,new.mapping_version_id,new.prior_head_id,new.prior_head_hash)
        is distinct from
        (previous.project_ref,previous.environment,previous.dataset_id,previous.source_release_id,previous.mapping_version_id,previous.prior_head_id,previous.prior_head_hash)
      or (new.project_ref,new.environment,new.dataset_id,new.source_release_id,new.mapping_version_id,new.prior_head_id,new.prior_head_hash,new.cluster_id,new.owner_oid)
        is distinct from
        (timed_out.project_ref,timed_out.environment,timed_out.dataset_id,timed_out.source_release_id,timed_out.mapping_version_id,timed_out.prior_head_id,timed_out.prior_head_hash,timed_out.cluster_id,timed_out.owner_oid)
      or exists (select from ingestion.mapping_reprojection_plans p
        where p.owner_authorization_id in (previous.id,timed_out.id))
      or not exists (select from ingestion.dataset_projection_current_heads h where h.dataset_id=new.dataset_id
        and h.environment=new.environment and h.current_dataset_projection_head_id=new.prior_head_id
        and h.current_projection_fingerprint=new.prior_head_hash and h.current_head_version=1) then
      raise exception using errcode='55000',message='Full35 final slot requires both expired unexecuted authorizations and the unchanged scope';
    end if;
    return new;
  end if;
  if previous.id is null then
    -- A clean replay still supports a single initial authorization. It cannot
    -- introduce the failed H51 identity after some other operation was issued.
    if new.id='283c6348-b19e-414f-a228-bc84f60c2297'
      and exists (select from ingestion.foundation_owner_authorization) then
      raise exception using errcode='55000',message='Full35 initial authorization already exists';
    end if;
    return new;
  end if;

  if pg_catalog.current_setting('transaction_isolation')<>'read committed'
    or pg_catalog.clock_timestamp()<previous.expires_at or new.authorized_at<previous.expires_at
    or new.id=previous.id or new.plan_hash=previous.plan_hash or new.retry_token=previous.retry_token
    or new.authorization_reference=previous.authorization_reference
    or (new.project_ref,new.environment,new.dataset_id,new.source_release_id,new.mapping_version_id,new.prior_head_id,new.prior_head_hash)
      is distinct from
      (previous.project_ref,previous.environment,previous.dataset_id,previous.source_release_id,previous.mapping_version_id,previous.prior_head_id,previous.prior_head_hash)
    or exists (select from ingestion.mapping_reprojection_plans p where p.owner_authorization_id=previous.id)
    or not exists (select from ingestion.dataset_projection_current_heads h where h.dataset_id=new.dataset_id
      and h.environment=new.environment and h.current_dataset_projection_head_id=new.prior_head_id
      and h.current_projection_fingerprint=new.prior_head_hash and h.current_head_version=1) then
    raise exception using errcode='55000',message='Full35 successor requires the expired unexecuted authorization and original head';
  end if;
  return new;
end;
$$;

  grant ingestion_reprojection_definer to postgres with admin false, inherit false, set true granted by postgres;
  grant create on schema ingestion to ingestion_reprojection_definer;
  set local role ingestion_reprojection_definer;

-- Arrays still follow ordinality and object keys still sort in C collation.
-- Numeric values and containers retain the original recursive validation.
create or replace function ingestion.canonicalize_mapping_json_v1(p_value jsonb)
returns text language plpgsql immutable set search_path='' as $$
declare result text; n numeric;
begin
  case pg_catalog.jsonb_typeof(p_value)
    when 'null' then return 'null';
    when 'boolean' then return p_value::text;
    when 'string' then return p_value::text;
    when 'number' then
      n := (p_value #>> '{}')::numeric;
      if n <> pg_catalog.trunc(n) or pg_catalog.abs(n)>9007199254740991 then
        raise exception using errcode='22023',message='mapping JSON requires safe integer numbers';
      end if;
      return pg_catalog.trunc(n)::text;
    when 'array' then
      select '['||coalesce(pg_catalog.string_agg(
        case pg_catalog.jsonb_typeof(e.value)
          when 'string' then e.value::text
          when 'boolean' then e.value::text
          when 'null' then 'null'
          else ingestion.canonicalize_mapping_json_v1(e.value)
        end,',' order by e.ordinality),'')||']'
      into result from pg_catalog.jsonb_array_elements(p_value) with ordinality e;
      return result;
    when 'object' then
      select '{'||coalesce(pg_catalog.string_agg(pg_catalog.to_jsonb(e.key)::text||':'||
        case pg_catalog.jsonb_typeof(e.value)
          when 'string' then e.value::text
          when 'boolean' then e.value::text
          when 'null' then 'null'
          else ingestion.canonicalize_mapping_json_v1(e.value)
        end,',' order by e.key collate "C"),'')||'}'
      into result from pg_catalog.jsonb_each(p_value) e;
      return result;
    else raise exception using errcode='22023',message='invalid mapping JSON';
  end case;
end;
$$;
  set local role postgres;
  revoke create on schema ingestion from ingestion_reprojection_definer;
  revoke ingestion_reprojection_definer from postgres granted by postgres;
end
$full35_receipt_performance$;
