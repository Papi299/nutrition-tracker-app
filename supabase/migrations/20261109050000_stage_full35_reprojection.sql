-- Publish the exact accepted April Foundation reprojection through resumable
-- per-food transactions. Existing private plan items and interpretations are
-- the durable staging ledger. Only the shared publisher mutates public rows.
do $full35_staged_release$
begin
  if not exists (select from pg_catalog.pg_roles where rolname='full35_release_owner' and not rolcanlogin)
    or pg_catalog.has_schema_privilege('ingestion_reprojection_definer','ingestion','CREATE')
    or exists (select from pg_catalog.pg_auth_members
      where roleid='ingestion_reprojection_definer'::regrole and member='postgres'::regrole
        and grantor='postgres'::regrole) then
    raise exception 'Unexpected Full35 owner login or function-owner authority before staged release';
  end if;

  drop index ingestion.foundation_owner_authorization_release_slot;
  create unique index foundation_owner_authorization_release_slot on ingestion.foundation_owner_authorization
    ((case when id='21a76747-c907-4b67-b324-d384a685b111'::uuid then 2
           when id='1040560a-303d-4b3c-bcba-270ac3a05b56'::uuid then 3
           when id='a8a5608a-750d-4d1d-b47f-e5f8d47d061a'::uuid then 4
           when id='d76ef577-9223-4077-9b3f-d0f4145c9165'::uuid then 5 else 1 end))
    where id<>'283c6348-b19e-414f-a228-bc84f60c2297'::uuid;

create function ingestion.guard_full35_staged_authorization_v1()
returns trigger language plpgsql set search_path='' as $$
declare prior ingestion.foundation_owner_authorization;
begin
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
    'nutrition-tracker:foundation-dataset-lifecycle:'||new.dataset_id::text,0));
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
    'nutrition-tracker:foundation-promotion:'||new.source_release_id::text,0));
  select a.* into prior from ingestion.foundation_owner_authorization a
    where a.id='a8a5608a-750d-4d1d-b47f-e5f8d47d061a'::uuid
      and a.plan_hash='15afd45a9ea463a7d9b3ed550faa55babd6fba54516c5299a1ac9b4f28dde0a2'
      and a.diff_hash='849eeedb907aec8946366a6058172965eca8ee82c2f2ba26d6523627b8d6df0f'
      and a.retry_token='22c1f51e-eb1a-4fd7-8066-fb1ed8dac348'::uuid;
  if not found
    or pg_catalog.current_setting('transaction_isolation')<>'read committed'
    or new.authorized_at<prior.expires_at or new.expires_at<=pg_catalog.clock_timestamp()
    or (select count(*) from ingestion.foundation_owner_authorization)<>5
    or exists(select from ingestion.foundation_owner_authorization a
      where a.expires_at>pg_catalog.clock_timestamp() or new.plan_hash=a.plan_hash or new.retry_token=a.retry_token
        or new.authorization_reference=a.authorization_reference)
    or (new.project_ref,new.environment,new.dataset_id,new.source_release_id,new.mapping_version_id,
        new.prior_head_id,new.prior_head_hash,new.diff_hash)
      is distinct from (prior.project_ref,prior.environment,prior.dataset_id,prior.source_release_id,
        prior.mapping_version_id,prior.prior_head_id,prior.prior_head_hash,prior.diff_hash)
    or exists(select from ingestion.mapping_reprojection_plans p
      where p.owner_authorization_id is not null or (p.dataset_id=new.dataset_id and p.environment=new.environment))
    or exists(select from ingestion.mapping_reprojection_receipts r where r.dataset_id=new.dataset_id and r.environment=new.environment)
    or not exists(select from ingestion.dataset_projection_current_heads h where h.dataset_id=new.dataset_id
      and h.environment=new.environment and h.current_dataset_projection_head_id=new.prior_head_id
      and h.current_projection_fingerprint=new.prior_head_hash and h.current_head_version=1) then
    raise exception using errcode='55000',message='Full35 staging requires five expired unexecuted authorizations and the original scope';
  end if;
  return new;
end;
$$;
revoke all on function ingestion.guard_full35_staged_authorization_v1() from public,anon,authenticated,authenticator,service_role;
create trigger full35_owner_staged_guard before insert on ingestion.foundation_owner_authorization
  for each row when (new.id='d76ef577-9223-4077-9b3f-d0f4145c9165'::uuid)
  execute function ingestion.guard_full35_staged_authorization_v1();

  grant ingestion_reprojection_definer to postgres with admin false, inherit false, set true granted by postgres;
  grant create on schema ingestion to ingestion_reprojection_definer;
  set local role ingestion_reprojection_definer;

create function ingestion.lock_full35_staged_authorization_v1(p_authorization_id uuid,p_retry_token uuid)
returns ingestion.foundation_owner_authorization language plpgsql set search_path='' as $$
declare actor oid:=ingestion.full35_owner_login_v1(); auth ingestion.foundation_owner_authorization;
begin
  select a.* into auth from ingestion.foundation_owner_authorization a where a.id=p_authorization_id
    and a.id='d76ef577-9223-4077-9b3f-d0f4145c9165'::uuid and a.environment='production';
  if not found or auth.retry_token is distinct from p_retry_token then
    raise exception using errcode='42501',message='exact Full35 staged authorization and retry token required';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
    'nutrition-tracker:foundation-dataset-lifecycle:'||auth.dataset_id::text,0));
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
    'nutrition-tracker:foundation-promotion:'||auth.source_release_id::text,0));
  if auth.owner_oid is distinct from actor or auth.cluster_id is distinct from ingestion.mapping_identity_epoch_v1()
    or auth.owner_login_fingerprint is distinct from ingestion.mapping_login_fingerprint_v1(actor)
    or pg_catalog.clock_timestamp()<auth.authorized_at or pg_catalog.clock_timestamp()>=auth.expires_at then
    raise exception using errcode='42501',message='stale Full35 staged authorization';
  end if;
  if not exists(select from ingestion.dataset_projection_current_heads h where h.dataset_id=auth.dataset_id
    and h.environment=auth.environment and h.current_dataset_projection_head_id=auth.prior_head_id
    and h.current_head_version=1 and h.current_projection_fingerprint=auth.prior_head_hash) then
    raise exception using errcode='55000',message='Full35 staging catalog head changed';
  end if;
  return auth;
end;
$$;

-- Each entry is {food_id,item_hash}; item_hash covers the exact H55 canonical
-- item including the source bytes, identities, before-image, all 35 states,
-- evidence and proposed additions. The ordered root comes from the previously
-- oracle-checked H55 Production plan, independent of a new caller's manifest.
create function ingestion.verify_full35_staged_manifest_v1(p_body jsonb,p_auth ingestion.foundation_owner_authorization)
returns void language plpgsql set search_path='' as $$
begin
  perform ingestion.mapping_require_keys_v1(p_body,array[
    'contract_version','actor_authority','counts','diff','items','database_contract_hash','recovery_evidence_hash','commit','tree']);
  if p_body->>'contract_version' is distinct from 'foundation-full35-staged-plan/v1'
    or p_body->'actor_authority' is distinct from pg_catalog.jsonb_build_object(
      'contract_version','foundation-full35-owner-authority/v1','authorization_id',p_auth.id,'cluster_id',p_auth.cluster_id)
    or p_body->'counts' is distinct from '{"foods":353,"source_versions_inserted":0,"core_rows_preserved":1199,"inserted_rows":5062,"deleted_rows":0,"present_states":6261,"missing_states":6094,"states":12355}'::jsonb
    or p_body->'diff' is distinct from pg_catalog.jsonb_build_object(
      'before_hash','9fbecf6ee79f26e6744ea7470e9e0f1ffd06536c0a78f85ad7dea35f50c1c300',
      'approved_diff_hash',p_auth.diff_hash,
      'proposed_dataset_fingerprint','5de1c180cb3e165f3ebb9f3188e42ff40b977aa385c7c755950d02ef24b05a37')
    or p_auth.diff_hash is distinct from '849eeedb907aec8946366a6058172965eca8ee82c2f2ba26d6523627b8d6df0f'
    or p_body->>'recovery_evidence_hash' is distinct from p_auth.recovery_evidence_hash
    or coalesce(p_body->>'commit','') !~ '^[a-f0-9]{40}$' or coalesce(p_body->>'tree','') !~ '^[a-f0-9]{40}$'
    or ingestion.fingerprint_mapping_json_v1(p_body->'items') is distinct from
      'c03ddbdb209f9499a01d22324e64c99e0275b69cd6181e206dc5aead20f6ae24'
    or p_body->>'database_contract_hash' is distinct from ingestion.fingerprint_mapping_database_contract_v1()
    or ingestion.fingerprint_mapping_json_v1(p_body) is distinct from p_auth.plan_hash then
    raise exception using errcode='23514',message='Full35 staged manifest differs from the exact authorized release';
  end if;
end;
$$;

create function ingestion.prepare_full35_staged_plan_v1(p_authorization_id uuid,p_manifest json,p_retry_token uuid)
returns jsonb language plpgsql security definer set search_path='' set timezone='UTC' set lock_timeout='5s' as $$
declare auth ingestion.foundation_owner_authorization; plan ingestion.mapping_reprojection_plans; body jsonb;
begin
  auth:=ingestion.lock_full35_staged_authorization_v1(p_authorization_id,p_retry_token);
  if p_manifest is null or pg_catalog.octet_length(p_manifest::text)>65536
    or ingestion.mapping_source_record_hash_v1(p_manifest::text) is distinct from auth.plan_hash then
    raise exception using errcode='42501',message='exact bounded Full35 manifest required';
  end if;
  body:=ingestion.mapping_json_input_v1(p_manifest);
  perform ingestion.verify_full35_staged_manifest_v1(body,auth);
  select p.* into plan from ingestion.mapping_reprojection_plans p where p.owner_authorization_id=auth.id;
  if not found then
    insert into ingestion.mapping_reprojection_plans(operation_kind,dataset_id,environment,source_release_id,mapping_version_id,
      prior_head_id,prior_head_version,prior_head_hash,operator_oid,operator_name,authority_contract_version,
      origin_cluster_id,plan_body,plan_hash,retry_token,owner_authorization_id)
    values('reprojection',auth.dataset_id,auth.environment,auth.source_release_id,auth.mapping_version_id,
      auth.prior_head_id,1,auth.prior_head_hash,auth.owner_oid,session_user,
      'foundation-full35-owner-authority/v1',auth.cluster_id,body,auth.plan_hash,p_retry_token,auth.id) returning * into plan;
  elsif plan.plan_body is distinct from body or plan.state<>'prepared' then
    raise exception using errcode='55000',message='Full35 staged plan identity or state changed';
  end if;
  return pg_catalog.jsonb_build_object('plan_id',plan.id,'staged_food_ids',coalesce(
    (select pg_catalog.jsonb_agg(i.food_id order by i.food_id)
      from ingestion.mapping_reprojection_plan_items i where i.plan_id=plan.id),'[]'));
end;
$$;

create function ingestion.stage_full35_food_v1(p_authorization_id uuid,p_food_id uuid,p_item json,p_retry_token uuid)
returns uuid language plpgsql security definer set search_path='' set timezone='UTC' set lock_timeout='5s' as $$
declare auth ingestion.foundation_owner_authorization; plan ingestion.mapping_reprojection_plans;
  expected_item_hash text; item_id uuid; item jsonb; before_food jsonb; candidate jsonb; head ingestion.food_projection_heads;
begin
  auth:=ingestion.lock_full35_staged_authorization_v1(p_authorization_id,p_retry_token);
  select p.* into strict plan from ingestion.mapping_reprojection_plans p where p.owner_authorization_id=auth.id;
  if plan.state<>'prepared' or plan.plan_body->>'contract_version' is distinct from 'foundation-full35-staged-plan/v1' then
    raise exception using errcode='55000',message='Full35 staged plan is not prepared';
  end if;
  select m.value->>'item_hash' into strict expected_item_hash from pg_catalog.jsonb_array_elements(plan.plan_body->'items') m
    where m.value->>'food_id'=p_food_id::text;
  if p_item is null or pg_catalog.octet_length(p_item::text)>196608
    or ingestion.mapping_source_record_hash_v1(p_item::text) is distinct from expected_item_hash then
    raise exception using errcode='42501',message='Full35 food item differs from approved commitment';
  end if;
  select i.id into item_id from ingestion.mapping_reprojection_plan_items i
    where i.plan_id=plan.id and i.food_id=p_food_id and i.item_hash=expected_item_hash;
  if found then return item_id; end if;
  item:=ingestion.mapping_json_input_v1(p_item);
  before_food:=item->'before';
  candidate:=item->'candidate';
  select h.* into strict head from ingestion.food_projection_heads h
    where h.food_id=p_food_id and h.dataset_id=auth.dataset_id and h.environment=auth.environment;
  if before_food->>'food_id' is distinct from p_food_id::text
    or head.dataset_projection_head_id is distinct from auth.prior_head_id or head.dataset_head_version<>1
    or head.lifecycle_state<>'active' or head.food_projection_version_id::text is distinct from before_food->>'prior_projection_id'
    or head.food_head_version::text is distinct from before_food->>'food_head_version'
    or head.source_record_id::text is distinct from before_food->>'source_record_id'
    or head.source_record_version_id::text is distinct from before_food->>'source_version_id' then
    raise exception using errcode='55000',message='Full35 food source or projection head changed';
  end if;
  -- The existing interpretation trigger verifies the exact source and reruns
  -- the scientific candidate checks. No approved public-write context exists.
  insert into ingestion.source_mapping_interpretations(source_record_version_id,source_release_id,mapping_version_id,
    mapping_hash,candidate_contract_version,candidate_hash,evidence_set_hash,raw_record_hash,candidate_body,provenance)
  values(head.source_record_version_id,auth.source_release_id,auth.mapping_version_id,candidate->>'mapping_hash',
    'foundation-normalized-candidate/v2',candidate->>'content_fingerprint',candidate->>'evidence_set_hash',
    candidate->'record_identity'->>'raw_content_sha256',candidate,pg_catalog.jsonb_build_object(
      'plan_id',plan.id,'plan_hash',plan.plan_hash,'raw_record',item->'raw_record'));
  insert into ingestion.mapping_reprojection_plan_items(plan_id,food_id,source_record_id,source_version_id,
    prior_projection_id,prior_food_head_version,item_body,item_hash)
  values(plan.id,p_food_id,head.source_record_id,head.source_record_version_id,
    head.food_projection_version_id,head.food_head_version,item,expected_item_hash) returning id into item_id;
  return item_id;
end;
$$;

create function ingestion.verify_full35_staged_publication_v1(p_plan ingestion.mapping_reprojection_plans)
returns void language plpgsql set search_path='' as $$
declare auth ingestion.foundation_owner_authorization; snapshot jsonb; manifest jsonb;
begin
  auth:=ingestion.lock_full35_staged_authorization_v1(p_plan.owner_authorization_id,p_plan.retry_token);
  perform ingestion.verify_full35_staged_manifest_v1(p_plan.plan_body,auth);
  select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('food_id',i.food_id,'item_hash',i.item_hash)
      order by i.food_id) into manifest
    from ingestion.mapping_reprojection_plan_items i where i.plan_id=p_plan.id;
  if manifest is distinct from p_plan.plan_body->'items' or
    (select count(*) from ingestion.food_projection_heads h
      where h.dataset_id=auth.dataset_id and h.environment=auth.environment)<>353 or
    not exists(select from ingestion.source_releases r
      join ingestion.nutrient_mapping_versions m on m.dataset_id=r.dataset_id
      join ingestion.mapping_version_evidence e on e.mapping_version_id=m.id
      where r.id=auth.source_release_id and r.dataset_id=auth.dataset_id and m.id=auth.mapping_version_id
        and r.sha256='186e988ec542e913f51ef62b86a47758e8cdd0d1dc3889e7b055581f3c09c77a'
        and r.manifest_fingerprint='ad3a51cbb0b3c6bbafd98d8bd59d996e10ac8cc4d82f22d8695d3a2838a8c2b0'
        and m.approval_status='approved'
        and m.content_sha256='028f426a5107af052caf49b6ec3d0d145599a708a28541cc00d28fde04df5c7c') then
    raise exception using errcode='55000',message='Full35 publication requires the complete staged source and manifest';
  end if;
  snapshot:=ingestion.mapping_scope_snapshot_v1(auth.dataset_id,auth.environment);
  if ingestion.fingerprint_mapping_json_v1(snapshot) is distinct from p_plan.plan_body->'diff'->>'before_hash' then
    raise exception using errcode='55000',message='Full35 publication catalog before-image changed';
  end if;
end;
$$;

create function ingestion.publish_full35_staged_plan_v1(p_authorization_id uuid,p_retry_token uuid)
returns jsonb language plpgsql security definer set search_path='' set timezone='UTC' set lock_timeout='5s' as $$
declare auth ingestion.foundation_owner_authorization; plan ingestion.mapping_reprojection_plans;
  approval_id uuid; approval_body jsonb; receipt jsonb;
begin
  if p_authorization_id is distinct from 'd76ef577-9223-4077-9b3f-d0f4145c9165'::uuid then
    raise exception using errcode='42501',message='staged Full35 authorization required';
  end if;
  receipt:=ingestion.get_foundation_full35_owner_receipt_v1(p_authorization_id,p_retry_token);
  if receipt is not null then return receipt; end if;
  begin
    auth:=ingestion.lock_full35_staged_authorization_v1(p_authorization_id,p_retry_token);
  exception when object_not_in_prerequisite_state then
    -- A concurrent publication can finish while this caller waits for the lock.
    receipt:=ingestion.get_foundation_full35_owner_receipt_v1(p_authorization_id,p_retry_token);
    if receipt is not null then return receipt; end if;
    raise;
  end;
  select p.* into strict plan from ingestion.mapping_reprojection_plans p where p.owner_authorization_id=auth.id;
  if plan.state<>'prepared' or plan.plan_body->>'contract_version' is distinct from 'foundation-full35-staged-plan/v1' then
    raise exception using errcode='55000',message='Full35 staged plan is not prepared';
  end if;
  update ingestion.mapping_reprojection_plans set state='validated' where id=plan.id;
  approval_body:=pg_catalog.jsonb_build_object('contract_version','foundation-full35-owner-approval/v1',
    'plan_hash',plan.plan_hash,'actor_authority',plan.plan_body->'actor_authority','owner_authorization',pg_catalog.to_jsonb(auth)-'singleton');
  insert into ingestion.mapping_reprojection_approvals(plan_id,plan_hash,retry_token,approver_oid,approver_name,
    authority_contract_version,approved_at,expires_at,approval_body,approval_hash)
  values(plan.id,plan.plan_hash,plan.retry_token,auth.owner_oid,session_user,'foundation-full35-owner-authority/v1',
    auth.authorized_at,auth.expires_at,approval_body,ingestion.fingerprint_mapping_json_v1(approval_body)) returning id into approval_id;
  update ingestion.mapping_reprojection_plans set state='approved' where id=plan.id;
  return ingestion.execute_mapping_plan_internal_v1(approval_id,p_retry_token,'reprojection');
end;
$$;

-- Reuse the same protected writer, evidence, final invariants and receipt.
CREATE OR REPLACE FUNCTION ingestion.execute_mapping_plan_internal_v1(p_approval_id uuid, p_retry_token uuid, p_kind text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare actor oid; binding ingestion.mapping_actor_bindings; approver_binding ingestion.mapping_actor_bindings; plan ingestion.mapping_reprojection_plans; approval ingestion.mapping_reprojection_approvals;
  receipt ingestion.mapping_reprojection_receipts; item ingestion.mapping_reprojection_plan_items;
  pointer ingestion.dataset_projection_current_heads; prior ingestion.food_projection_versions;
  interpretation ingestion.source_mapping_interpretations; candidate jsonb; body jsonb; state jsonb; evidence jsonb;
  snapshot jsonb; food jsonb; before_food jsonb; before_row jsonb; current_row public.food_nutrients;
  operation_receipt_id uuid:=pg_catalog.gen_random_uuid(); head_id uuid:=pg_catalog.gen_random_uuid(); projection_id uuid; state_id uuid;
  evidence_id uuid; resolved_nutrient_id uuid; public_row_id uuid; public_ids jsonb; state_ids jsonb; evidence_ids jsonb;
  states jsonb; row_count bigint; inserted_count bigint:=0; deleted_count bigint:=0; projection_count bigint:=0;
  evidence_count bigint:=0; interpretation_count bigint:=0; head_hash text; inventory jsonb; receipt_body jsonb;
  completed_at timestamptz; keys text[]:=array['food_row','source_version_row','source_record_row','metadata','source_links','portions','aliases','barcodes'];
  key text; staged boolean;
begin
  if p_retry_token is null then raise exception using errcode='22023',message='exact retry token required'; end if;
  select * into strict approval from ingestion.mapping_reprojection_approvals where id=p_approval_id;
  select * into strict plan from ingestion.mapping_reprojection_plans where id=approval.plan_id;
  if p_retry_token<>plan.retry_token or p_retry_token<>approval.retry_token then
    raise exception using errcode='23505',message='retry identity differs from approved operation';end if;
  if plan.operation_kind<>p_kind or plan.plan_hash<>ingestion.fingerprint_mapping_json_v1(plan.plan_body)
    or approval.plan_hash<>plan.plan_hash or approval.approval_hash<>ingestion.fingerprint_mapping_json_v1(approval.approval_body)
    or approval.approval_body->'actor_authority' is distinct from plan.plan_body->'actor_authority' then
    raise exception using errcode='42501',message='execution approval scope mismatch';end if;
  -- Shared with lifecycle, and also with the historical promotion key. Both
  -- namespaces are taken in this order. Environment is deliberately not added
  -- to the historical dataset key, which serializes environments more strictly.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
    'nutrition-tracker:foundation-dataset-lifecycle:'||plan.dataset_id::text,0));
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
    'nutrition-tracker:foundation-promotion:'||plan.source_release_id::text,0));
  -- A concurrent identical execution may have committed while this session
  -- waited. Refresh mutable state under the dataset locks before retry lookup.
  select * into strict plan from ingestion.mapping_reprojection_plans where id=approval.plan_id;
  if plan.owner_authorization_id is not null then
    actor:=ingestion.full35_owner_login_v1();
    if p_kind<>'reprojection' or approval.approver_oid<>actor or plan.operator_oid<>actor
      or plan.operator_name<>session_user then
      raise exception using errcode='42501',message='Full35 owner execution identity mismatch';
    end if;
  else
    actor:=ingestion.mapping_actor_oid_v1('ingestion_operator');
    perform ingestion.lock_mapping_principals_v1(array[plan.operator_principal_id,plan.approver_principal_id]);
    binding:=ingestion.mapping_current_actor_v1('operator',plan.dataset_id,plan.environment);
    if binding.principal_id<>plan.operator_principal_id then raise exception using errcode='42501',message='execution principal mismatch';end if;
    select * into receipt from ingestion.mapping_reprojection_receipts where approval_id=approval.id;
    if found then
      if receipt.operator_principal_id<>binding.principal_id or receipt.retry_token<>p_retry_token or receipt.plan_id<>plan.id
        or plan.state<>'completed' or receipt.receipt_hash<>ingestion.fingerprint_mapping_json_v1(receipt.receipt_body) then
        raise exception using errcode='23505',message='retry identity differs from committed operation';end if;
      return receipt.receipt_body;
    end if;
    if plan.origin_cluster_id<>binding.cluster_id or plan.operator_binding_id<>binding.id or plan.operator_oid<>actor or plan.operator_name<>session_user then
      raise exception using errcode='42501',message='pending operation binding is stale';end if;
    approver_binding:=ingestion.mapping_binding_by_id_v1(plan.approver_binding_id,plan.approver_principal_id,plan.dataset_id,plan.environment);
    if approval.approver_binding_id<>approver_binding.id or approval.approver_principal_id<>approver_binding.principal_id
      or approval.approver_oid<>approver_binding.login_oid or plan.operator_principal_id=approval.approver_principal_id then
      raise exception using errcode='42501',message='pending approval binding mismatch';end if;
  end if;
  select * into strict pointer from ingestion.dataset_projection_current_heads
    where dataset_id=plan.dataset_id and environment=plan.environment for update;
  select * into strict plan from ingestion.mapping_reprojection_plans where id=plan.id for update;
  select * into strict approval from ingestion.mapping_reprojection_approvals where id=approval.id for update;
  perform 1 from ingestion.food_projection_heads where dataset_id=plan.dataset_id and environment=plan.environment
    order by food_id::text collate "C" for update;
  if plan.state<>'approved' or approval.expires_at<=pg_catalog.clock_timestamp()
    or pointer.current_dataset_projection_head_id<>plan.prior_head_id
    or pointer.current_head_version<>plan.prior_head_version or pointer.current_projection_fingerprint<>plan.prior_head_hash then
    raise exception using errcode='55000',message='stale plan or expired approval';
  end if;
  staged:=plan.plan_body->>'contract_version'='foundation-full35-staged-plan/v1';
  if staged then
    perform ingestion.verify_full35_staged_publication_v1(plan);
  else
    perform ingestion.validate_mapping_plan_v1(plan.plan_body);
    if (select count(*) from ingestion.mapping_reprojection_plan_items where plan_id=plan.id)<>353
      or exists(
        select from pg_catalog.jsonb_array_elements(plan.plan_body->'items') as expected(value)
        left join ingestion.mapping_reprojection_plan_items i on i.plan_id=plan.id
          and i.food_id=(expected.value->'before'->>'food_id')::uuid
        where i.item_body is distinct from expected.value
          or i.item_hash is distinct from ingestion.fingerprint_mapping_json_v1(i.item_body)) then
      raise exception using errcode='23514',message='persisted plan item scope mismatch';
    end if;
  end if;
  insert into ingestion.mapping_reprojection_execution_context(backend_pid,transaction_id,plan_id,approval_id)
    values(pg_catalog.pg_backend_pid(),pg_catalog.pg_current_xact_id(),plan.id,approval.id);
  for item in select * from ingestion.mapping_reprojection_plan_items where plan_id=plan.id
    order by food_id::text collate "C" loop
    candidate:=item.item_body->'candidate'; body:=item.item_body->'projection_body';
    select * into interpretation from ingestion.source_mapping_interpretations
      where source_record_version_id=item.source_version_id and mapping_version_id=plan.mapping_version_id
        and candidate_contract_version='foundation-normalized-candidate/v2';
    if not found then
      if staged or p_kind='compensation' then raise exception 'missing required mapping interpretation'; end if;
      insert into ingestion.source_mapping_interpretations(source_record_version_id,source_release_id,mapping_version_id,
        mapping_hash,candidate_contract_version,candidate_hash,evidence_set_hash,raw_record_hash,candidate_body,provenance)
      values(item.source_version_id,plan.source_release_id,plan.mapping_version_id,candidate->>'mapping_hash',
        'foundation-normalized-candidate/v2',candidate->>'content_fingerprint',candidate->>'evidence_set_hash',
        candidate->'record_identity'->>'raw_content_sha256',candidate,pg_catalog.jsonb_build_object(
          'plan_id',plan.id,'plan_hash',plan.plan_hash,'raw_record',item.item_body->'raw_record')) returning * into interpretation;
      interpretation_count:=interpretation_count+1;
    elsif interpretation.candidate_body<>candidate
      or (staged and interpretation.provenance is distinct from pg_catalog.jsonb_build_object(
        'plan_id',plan.id,'plan_hash',plan.plan_hash,'raw_record',item.item_body->'raw_record')) then
      raise exception 'conflicting existing mapping interpretation';
    end if;
    select * into strict prior from ingestion.food_projection_versions where id=item.prior_projection_id;
    projection_id:=pg_catalog.gen_random_uuid();
    insert into ingestion.food_projection_versions(id,dataset_id,environment,food_id,source_record_id,source_record_version_id,
      prior_food_projection_version_id,origin_type,name,brand_name,locale,food_type,data_quality,is_public,is_archived,
      serving_size,serving_unit,projection_hash,normalized_candidate_hash,source_metadata_hash,lifecycle_projection_hash,
      projection_contract_version,source_mapping_interpretation_id,mapping_version_id,mapping_reprojection_receipt_id,projection_body_v2)
    values(projection_id,plan.dataset_id,plan.environment,item.food_id,item.source_record_id,item.source_version_id,
      prior.id,case when p_kind='compensation' then 'mapping_compensation' else 'mapping_reprojection' end,
      prior.name,prior.brand_name,prior.locale,prior.food_type,prior.data_quality,prior.is_public,prior.is_archived,
      prior.serving_size,prior.serving_unit,item.item_body->>'projection_hash',candidate->>'content_fingerprint',
      prior.source_metadata_hash,item.item_body->>'lifecycle_hash','foundation-lifecycle-projection/v2',
      interpretation.id,plan.mapping_version_id,operation_receipt_id,body);
    projection_count:=projection_count+1;
    public_ids:='{}'; state_ids:='{}'; evidence_ids:='{}';
    for state in select value from pg_catalog.jsonb_array_elements(body->'nutrient_states') loop
      select id into strict resolved_nutrient_id from public.nutrients where code=state->>'nutrient_code';
      state_id:=pg_catalog.gen_random_uuid();
      insert into ingestion.food_nutrient_projection_versions(id,food_projection_version_id,nutrient_id,nutrient_code,
        projection_state,basis,amount,source_semantic,source_nutrient_id,source_unit,derivation_code,derivation_description,
        projection_hash,projection_contract_version,missing_reason,application_unit,evidence_hash)
      values(state_id,projection_id,resolved_nutrient_id,state->>'nutrient_code',state->>'projection_state',state->>'basis',
        (state->>'amount')::numeric,state->>'source_semantic',state->>'source_nutrient_id',state->>'source_unit',
        state->>'derivation_code',state->>'derivation_description',ingestion.fingerprint_mapping_json_v1(state),
        'foundation-lifecycle-projection/v2',state->>'missing_reason',state->>'application_unit',state->>'evidence_hash');
      if state->>'projection_state'<>'present' then continue; end if;
      select id into public_row_id from public.food_nutrients where food_id=item.food_id and nutrient_id=resolved_nutrient_id and basis='per_100g';
      public_row_id:=coalesce(public_row_id,pg_catalog.gen_random_uuid());
      evidence_id:=pg_catalog.gen_random_uuid();
      select e into strict evidence from pg_catalog.jsonb_array_elements(candidate->'nutrient_evidence') e
        where e->>'evidence_hash'=state->>'evidence_hash';
      insert into ingestion.food_nutrient_evidence(id,food_nutrient_id,source_record_version_id,mapping_version_id,
        source_nutrient_id,original_value,original_unit,original_basis,value_kind,source_semantic,derivation_code,
        derivation_description,source_mapping_interpretation_id,evidence_body_v2,evidence_hash_v2,mapping_reprojection_receipt_id)
      values(evidence_id,public_row_id,item.source_version_id,plan.mapping_version_id,state->>'source_nutrient_id',
        (state->>'amount')::numeric,state->>'source_unit','per_100g',state->>'source_semantic',state->>'source_semantic',
        state->>'derivation_code',state->>'derivation_description',interpretation.id,evidence,state->>'evidence_hash',operation_receipt_id);
      public_ids:=public_ids||pg_catalog.jsonb_build_object(state->>'nutrient_code',public_row_id);
      state_ids:=state_ids||pg_catalog.jsonb_build_object(state->>'nutrient_code',state_id);
      evidence_ids:=evidence_ids||pg_catalog.jsonb_build_object(state->>'nutrient_code',evidence_id);
      evidence_count:=evidence_count+1;
    end loop;
    if p_kind='reprojection' then
      for state in select a->'state' from pg_catalog.jsonb_array_elements(item.item_body->'additions') a loop
        select id into strict resolved_nutrient_id from public.nutrients where code=state->>'nutrient_code';
        insert into public.food_nutrients(id,food_id,nutrient_id,amount,basis)
          values((public_ids->>(state->>'nutrient_code'))::uuid,item.food_id,resolved_nutrient_id,(state->>'amount')::numeric,'per_100g')
          returning * into current_row;
        insert into ingestion.mapping_reprojection_inserted_rows(plan_id,receipt_id,plan_item_id,public_row_id,food_id,nutrient_id,amount,basis,row_image)
          values(plan.id,operation_receipt_id,item.id,current_row.id,current_row.food_id,current_row.nutrient_id,current_row.amount,current_row.basis,pg_catalog.to_jsonb(current_row));
        inserted_count:=inserted_count+1;
      end loop;
    else
      for current_row in select n.* from public.food_nutrients n
        join ingestion.mapping_reprojection_inserted_rows r on r.public_row_id=n.id
        where r.receipt_id=plan.rejected_receipt_id and r.food_id=item.food_id order by n.id loop
        if not exists(select from ingestion.mapping_reprojection_inserted_rows r
          where r.receipt_id=plan.rejected_receipt_id and r.public_row_id=current_row.id and r.row_image=pg_catalog.to_jsonb(current_row)) then
          raise exception using errcode='55000',message='compensation row changed since reprojection';
        end if;
        delete from public.food_nutrients where id=current_row.id;
        get diagnostics row_count=row_count;
        if row_count<>1 then raise exception 'compensation deletion denied'; end if;
        deleted_count:=deleted_count+1;
      end loop;
    end if;
    for state in select value from pg_catalog.jsonb_array_elements(body->'nutrient_states') where value->>'projection_state'='present' loop
      insert into ingestion.food_nutrient_projection_evidence_links(food_nutrient_projection_version_id,food_nutrient_evidence_id)
        values((state_ids->>(state->>'nutrient_code'))::uuid,(evidence_ids->>(state->>'nutrient_code'))::uuid);
    end loop;
    insert into ingestion.food_source_link_events(food_id,source_record_id,source_record_version_id,prior_event_id,
      event_type,mapping_reprojection_receipt_id,mapping_dataset_id,mapping_environment,event_fingerprint)
    values(item.food_id,item.source_record_id,item.source_version_id,
      (select id from ingestion.food_source_link_events where food_id=item.food_id order by created_at desc,id desc limit 1),
      case when p_kind='compensation' then 'mapping_compensated' else 'mapping_reprojected' end,
      operation_receipt_id,plan.dataset_id,plan.environment,ingestion.fingerprint_mapping_json_v1(pg_catalog.jsonb_build_object('contract_version','foundation-mapping-source-event/v1',
        'receipt_id',operation_receipt_id,'food_id',item.food_id,'source_version_id',item.source_version_id,'projection_id',projection_id)));
    update ingestion.food_projection_heads set food_projection_version_id=projection_id,
      food_head_version=food_head_version+1,dataset_projection_head_id=head_id,
      dataset_head_version=plan.prior_head_version+1,updated_at=pg_catalog.clock_timestamp()
      where dataset_id=plan.dataset_id and environment=plan.environment and food_id=item.food_id
        and food_projection_version_id=item.prior_projection_id and food_head_version=item.prior_food_head_version;
    get diagnostics row_count=row_count;
    if row_count<>1 then raise exception 'food head compare-and-swap failed'; end if;
  end loop;
  select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('food_id',h.food_id,
    'projection_contract_version',p.projection_contract_version,'lifecycle_projection_hash',p.lifecycle_projection_hash,
    'lifecycle_state',h.lifecycle_state) order by h.food_id::text collate "C") into inventory
    from ingestion.food_projection_heads h join ingestion.food_projection_versions p on p.id=h.food_projection_version_id and p.food_id=h.food_id
        and p.source_record_id=h.source_record_id and p.source_record_version_id=h.source_record_version_id
    where h.dataset_id=plan.dataset_id and h.environment=plan.environment;
  head_hash:=ingestion.fingerprint_mapping_json_v1(pg_catalog.jsonb_build_object(
    'contract_version','foundation-mapping-dataset-projection/v2','dataset_id',plan.dataset_id,
    'environment',plan.environment,'source_release_id',plan.source_release_id,'mapping_version_id',plan.mapping_version_id,
    'mapping_hash','028f426a5107af052caf49b6ec3d0d145599a708a28541cc00d28fde04df5c7c','foods',inventory));
  if head_hash is distinct from plan.plan_body->'diff'->>'proposed_dataset_fingerprint' then
    raise exception 'resulting dataset fingerprint differs from approved plan';end if;
  insert into ingestion.dataset_projection_heads(id,dataset_id,environment,current_source_release_id,
    mapping_reprojection_receipt_id,dataset_projection_fingerprint,head_version,previous_head_id,projection_contract_version)
  values(head_id,plan.dataset_id,plan.environment,plan.source_release_id,operation_receipt_id,head_hash,
    plan.prior_head_version+1,plan.prior_head_id,'foundation-lifecycle-projection/v2');
  if approval.expires_at<=pg_catalog.clock_timestamp() then raise exception using errcode='55000',message='approval expired during execution';end if;
  completed_at:=pg_catalog.clock_timestamp();
  receipt_body:=pg_catalog.jsonb_build_object('contract_version',case
      when plan.owner_authorization_id is not null then 'foundation-full35-owner-receipt/v1'
      when p_kind='compensation'
      then 'foundation-mapping-compensation/v2' else 'foundation-mapping-reprojection-receipt/v2' end,
    'receipt_id',operation_receipt_id,'operation_kind',p_kind,'plan_id',plan.id,'plan_hash',plan.plan_hash,
    'approval_id',approval.id,'approval_hash',approval.approval_hash,'operator_oid',actor::bigint,'retry_token',p_retry_token,
    'actor_authority',plan.plan_body->'actor_authority',
    'dataset_id',plan.dataset_id,'environment',plan.environment,'source_release_id',plan.source_release_id,
    'prior_head_id',plan.prior_head_id,'resulting_head_id',head_id,'resulting_head_version',plan.prior_head_version+1,
    'resulting_head_fingerprint',head_hash,'counts',plan.plan_body->'counts','rejected_receipt_id',plan.rejected_receipt_id,
    'public_row_identity_set_hash',(select ingestion.fingerprint_mapping_json_v1(coalesce(pg_catalog.jsonb_agg(
      (r.row_image-'amount')||pg_catalog.jsonb_build_object('amount',pg_catalog.trim_scale(r.amount)::text) order by r.public_row_id::text collate "C"),'[]'))
      from ingestion.mapping_reprojection_inserted_rows r where r.receipt_id=case when p_kind='compensation' then plan.rejected_receipt_id else operation_receipt_id end),
    'completed_at',pg_catalog.to_char(completed_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"'));
  if plan.owner_authorization_id is not null then
    receipt_body:=receipt_body||pg_catalog.jsonb_build_object('owner_authorization',
      (select pg_catalog.to_jsonb(auth)-'singleton' from ingestion.foundation_owner_authorization auth
       where auth.id=plan.owner_authorization_id));
  end if;
  insert into ingestion.mapping_reprojection_receipts(id,dataset_id,environment,plan_id,approval_id,operator_oid,operator_principal_id,authority_contract_version,retry_token,
    prior_head_id,resulting_head_id,receipt_body,receipt_hash,completed_at)
  values(operation_receipt_id,plan.dataset_id,plan.environment,plan.id,approval.id,actor,plan.operator_principal_id,plan.authority_contract_version,p_retry_token,plan.prior_head_id,head_id,receipt_body,
    ingestion.fingerprint_mapping_json_v1(receipt_body),completed_at);
  update ingestion.dataset_projection_current_heads set current_dataset_projection_head_id=head_id,
    current_head_version=plan.prior_head_version+1,current_projection_fingerprint=head_hash,updated_at=completed_at
    where dataset_id=plan.dataset_id and environment=plan.environment
      and current_dataset_projection_head_id=plan.prior_head_id and current_head_version=plan.prior_head_version
      and current_projection_fingerprint=plan.prior_head_hash;
  get diagnostics row_count=row_count;
  if row_count<>1 then raise exception 'dataset pointer compare-and-swap failed'; end if;
  snapshot:=ingestion.mapping_scope_snapshot_v1(plan.dataset_id,plan.environment);
  if pg_catalog.jsonb_array_length(snapshot->'foods')<>353 or projection_count<>353
    or evidence_count<>(case when p_kind='compensation' then 1199 else 6261 end)
    or inserted_count<>(case when p_kind='compensation' then 0 else 5062 end)
    or deleted_count<>(case when p_kind='compensation' then 5062 else 0 end)
    or interpretation_count<>(case when staged or p_kind='compensation' then 0 else 353 end) then
    raise exception 'execution counters differ from exact approved scope';
  end if;
  for food in select value from pg_catalog.jsonb_array_elements(snapshot->'foods') loop
    select i.item_body->'before' into strict before_food from ingestion.mapping_reprojection_plan_items i
      where i.plan_id=plan.id and i.food_id=(food->>'food_id')::uuid;
    if before_food->>'prior_evidence_hash' is distinct from ingestion.fingerprint_mapping_projection_evidence_v1(
      (before_food->>'prior_projection_id')::uuid) then raise exception 'historical evidence changed';end if;
    foreach key in array keys loop
      if food->key is distinct from before_food->key then raise exception 'immutable catalog/source preservation failed'; end if;
    end loop;
    for before_row in select value from pg_catalog.jsonb_array_elements(before_food->'public_rows')
      where p_kind='reprojection' or value->>'code' in('energy_kcal','protein_g','carbohydrates_g','fat_g') loop
      if not food->'public_rows' @> pg_catalog.jsonb_build_array(before_row) then raise exception 'original public row changed'; end if;
    end loop;
    select item_body->'projection_body'->'nutrient_states' into states from ingestion.mapping_reprojection_plan_items
      where plan_id=plan.id and food_id=(food->>'food_id')::uuid;
    if pg_catalog.jsonb_array_length(food->'public_rows')<>(select count(*) from pg_catalog.jsonb_array_elements(states) s where s->>'projection_state'='present')
      or exists(select from pg_catalog.jsonb_array_elements(food->'public_rows') r where not exists(
        select from pg_catalog.jsonb_array_elements(states) s where s->>'projection_state'='present'
          and s->>'nutrient_code'=r->>'code' and s->>'amount'=r->>'amount' and r->>'basis'='per_100g')) then
      raise exception 'final public tuples differ from approved projection';
    end if;
  end loop;
  update ingestion.mapping_reprojection_plans set state='completed' where id=plan.id;
  if plan.owner_authorization_id is null then
    perform ingestion.append_mapping_event_v1(plan.id,'approved','completed');
  end if;
  delete from ingestion.mapping_reprojection_execution_context
    where backend_pid=pg_catalog.pg_backend_pid() and transaction_id=pg_catalog.pg_current_xact_id();
  return receipt_body;
end;
$function$;

CREATE OR REPLACE FUNCTION ingestion.execute_foundation_full35_owner_v1(p_authorization_id uuid, p_plan json, p_retry_token uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
 SET "TimeZone" TO 'UTC'
AS $function$
declare actor oid:=ingestion.full35_owner_login_v1();
  auth ingestion.foundation_owner_authorization; plan_id uuid; approval_id uuid; item jsonb; b jsonb; receipt jsonb;
  body jsonb;
begin
  select * into auth from ingestion.foundation_owner_authorization where id=p_authorization_id;
  if not found or p_retry_token is distinct from auth.retry_token then
    raise exception using errcode='42501',message='Full35 owner request differs from the authorized operation';
  end if;
  if auth.environment='production' then
    raise exception using errcode='42501',message='Production Full35 requires staged publication';
  end if;
  -- The approval hashes the exact canonical UTF-8 request. Check the bytes
  -- before parsing, and keep the canonical/duplicate-key check outside the lock.
  if p_plan is null or pg_catalog.octet_length(p_plan::text)>33554432
    or ingestion.mapping_source_record_hash_v1(p_plan::text) is distinct from auth.plan_hash then
    raise exception using errcode='42501',message='Full35 owner request differs from the authorized operation';
  end if;
  body:=ingestion.mapping_json_input_v1(p_plan);
  if body->'actor_authority'->>'contract_version' is distinct from 'foundation-full35-owner-authority/v1'
    or body->'actor_authority'->>'authorization_id' is distinct from auth.id::text then
    raise exception using errcode='42501',message='Full35 owner request differs from the authorized operation';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
    'nutrition-tracker:foundation-dataset-lifecycle:'||auth.dataset_id::text,0));
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
    'nutrition-tracker:foundation-promotion:'||auth.source_release_id::text,0));
  receipt:=ingestion.get_foundation_full35_owner_receipt_v1(auth.id,p_retry_token);
  if receipt is not null then return receipt; end if;
  -- The shared executor validates the complete plan under its row locks
  -- before creating the protected transaction context and touching any food.
  if auth.owner_oid is distinct from actor or auth.cluster_id is distinct from ingestion.mapping_identity_epoch_v1()
    or auth.owner_login_fingerprint is distinct from ingestion.mapping_login_fingerprint_v1(actor)
    or pg_catalog.clock_timestamp()>=auth.expires_at then
    raise exception using errcode='42501',message='stale Full35 owner authorization';
  end if;
  insert into ingestion.mapping_reprojection_plans(operation_kind,dataset_id,environment,source_release_id,mapping_version_id,
    prior_head_id,prior_head_version,prior_head_hash,operator_oid,operator_name,authority_contract_version,
    origin_cluster_id,plan_body,plan_hash,retry_token,owner_authorization_id)
  values('reprojection',auth.dataset_id,auth.environment,auth.source_release_id,auth.mapping_version_id,
    auth.prior_head_id,(body->'before_snapshot'->'head'->>'version')::bigint,auth.prior_head_hash,actor,session_user,
    'foundation-full35-owner-authority/v1',auth.cluster_id,body,auth.plan_hash,p_retry_token,auth.id) returning id into plan_id;
  for item in select value from pg_catalog.jsonb_array_elements(body->'items') loop
    insert into ingestion.mapping_reprojection_plan_items(plan_id,food_id,source_record_id,source_version_id,prior_projection_id,prior_food_head_version,item_body,item_hash)
    values(plan_id,(item->'before'->>'food_id')::uuid,(item->'before'->>'source_record_id')::uuid,
      (item->'before'->>'source_version_id')::uuid,(item->'before'->>'prior_projection_id')::uuid,
      (item->'before'->>'food_head_version')::bigint,item,ingestion.fingerprint_mapping_json_v1(item));
  end loop;
  update ingestion.mapping_reprojection_plans set state='validated' where id=plan_id;
  b:=pg_catalog.jsonb_build_object('contract_version','foundation-full35-owner-approval/v1',
    'plan_hash',auth.plan_hash,'actor_authority',body->'actor_authority',
    'owner_authorization',pg_catalog.to_jsonb(auth)-'singleton');
  insert into ingestion.mapping_reprojection_approvals(plan_id,plan_hash,retry_token,approver_oid,approver_name,
    authority_contract_version,approved_at,expires_at,approval_body,approval_hash)
  values(plan_id,auth.plan_hash,p_retry_token,actor,session_user,'foundation-full35-owner-authority/v1',
    auth.authorized_at,auth.expires_at,b,ingestion.fingerprint_mapping_json_v1(b)) returning id into approval_id;
  update ingestion.mapping_reprojection_plans set state='approved' where id=plan_id;
  return ingestion.execute_mapping_plan_internal_v1(approval_id,p_retry_token,'reprojection');
end;
$function$;

create or replace function ingestion.get_foundation_full35_owner_receipt_v1(p_authorization_id uuid,p_retry_token uuid)
returns jsonb language plpgsql security definer set search_path='' set timezone='UTC' as $$
declare auth ingestion.foundation_owner_authorization; plan ingestion.mapping_reprojection_plans;
  receipt ingestion.mapping_reprojection_receipts;
begin
  perform ingestion.full35_owner_login_v1();
  select * into auth from ingestion.foundation_owner_authorization where id=p_authorization_id;
  if not found or p_retry_token is distinct from auth.retry_token then
    raise exception using errcode='42501',message='exact Full35 owner receipt identity required';
  end if;
  select * into plan from ingestion.mapping_reprojection_plans where owner_authorization_id=auth.id;
  if not found or (plan.state='prepared' and plan.plan_body->>'contract_version'='foundation-full35-staged-plan/v1') then
    return null;
  end if;
  select * into strict receipt from ingestion.mapping_reprojection_receipts where plan_id=plan.id;
  if plan.state<>'completed' or receipt.retry_token<>p_retry_token or plan.plan_hash<>auth.plan_hash
    or receipt.receipt_hash<>ingestion.fingerprint_mapping_json_v1(receipt.receipt_body)
    or receipt.receipt_body->'owner_authorization' is distinct from pg_catalog.to_jsonb(auth)-'singleton' then
    raise exception using errcode='23514',message='Full35 owner receipt integrity mismatch';
  end if;
  return receipt.receipt_body;
end;
$$;


revoke all on function ingestion.lock_full35_staged_authorization_v1(uuid,uuid),
  ingestion.verify_full35_staged_manifest_v1(jsonb,ingestion.foundation_owner_authorization),
  ingestion.verify_full35_staged_publication_v1(ingestion.mapping_reprojection_plans),
  ingestion.prepare_full35_staged_plan_v1(uuid,json,uuid),ingestion.stage_full35_food_v1(uuid,uuid,json,uuid),
  ingestion.publish_full35_staged_plan_v1(uuid,uuid)
  from public,anon,authenticated,authenticator,service_role,ingestion_operator,ingestion_approver,full35_release_owner;
grant execute on function ingestion.prepare_full35_staged_plan_v1(uuid,json,uuid),
  ingestion.stage_full35_food_v1(uuid,uuid,json,uuid),ingestion.publish_full35_staged_plan_v1(uuid,uuid)
  to full35_release_owner;

  set local role postgres;
  revoke create on schema ingestion from ingestion_reprojection_definer;
  revoke ingestion_reprojection_definer from postgres granted by postgres;
end
$full35_staged_release$;
