-- Preserve both per-row checks and cache their unchanged SQL plan in PL/pgSQL.
-- Use native duplicate detection before the unchanged canonical-byte checks.
do $full35_execution_cost$
begin
  if not exists (select from pg_catalog.pg_roles where rolname='full35_release_owner' and not rolcanlogin)
    or pg_catalog.has_schema_privilege('ingestion_reprojection_definer','ingestion','CREATE')
    or exists (select from pg_catalog.pg_auth_members
      where roleid='ingestion_reprojection_definer'::regrole and member='postgres'::regrole
        and grantor='postgres'::regrole) then
    raise exception 'Unexpected Full35 owner login or function-owner authority before execution repair';
  end if;

  drop index ingestion.foundation_owner_authorization_release_slot;
  create unique index foundation_owner_authorization_release_slot on ingestion.foundation_owner_authorization
    ((case when id='21a76747-c907-4b67-b324-d384a685b111'::uuid then 2
           when id='1040560a-303d-4b3c-bcba-270ac3a05b56'::uuid then 3 else 1 end))
    where id<>'283c6348-b19e-414f-a228-bc84f60c2297'::uuid;

create function ingestion.guard_full35_observed_authorization_v1()
returns trigger language plpgsql set search_path='' as $$
declare prior ingestion.foundation_owner_authorization;
begin
  -- Acquire the same two transaction locks before reading any release state.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
    'nutrition-tracker:foundation-dataset-lifecycle:'||new.dataset_id::text,0));
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
    'nutrition-tracker:foundation-promotion:'||new.source_release_id::text,0));
  select a.* into prior from ingestion.foundation_owner_authorization a
    where a.id='21a76747-c907-4b67-b324-d384a685b111'::uuid
      and a.plan_hash='f4b4989e1d75b626df2799bab90660243f9225cbe2999d3f83ebc3297e2f770f'
      and a.diff_hash='849eeedb907aec8946366a6058172965eca8ee82c2f2ba26d6523627b8d6df0f'
      and a.retry_token='5d961011-2143-4bd6-92be-da78cd914e56'::uuid;
  if not found
    or pg_catalog.current_setting('transaction_isolation')<>'read committed'
    or new.authorized_at<prior.expires_at or new.expires_at<=pg_catalog.clock_timestamp()
    or (select count(*) from ingestion.foundation_owner_authorization)<>3
    or not exists(select from ingestion.foundation_owner_authorization a
      where a.id='a7c2fa47-8ce7-412e-95e0-2e8edade247c'::uuid
        and a.plan_hash='6d2a06dd802abe1b1b217d375ec3a336dfb1cbd06ee57659c2d1a381bc096e1d')
    or exists(select from ingestion.foundation_owner_authorization a
      where a.expires_at>pg_catalog.clock_timestamp() or new.plan_hash=a.plan_hash or new.retry_token=a.retry_token
        or new.authorization_reference=a.authorization_reference)
    or (new.project_ref,new.environment,new.dataset_id,new.source_release_id,new.mapping_version_id,
        new.prior_head_id,new.prior_head_hash,new.diff_hash,new.cluster_id,new.owner_oid)
      is distinct from (prior.project_ref,prior.environment,prior.dataset_id,prior.source_release_id,prior.mapping_version_id,
        prior.prior_head_id,prior.prior_head_hash,prior.diff_hash,prior.cluster_id,prior.owner_oid)
    or exists(select from ingestion.mapping_reprojection_plans p
      where p.owner_authorization_id is not null or (p.dataset_id=new.dataset_id and p.environment=new.environment))
    or exists(select from ingestion.mapping_reprojection_receipts r where r.dataset_id=new.dataset_id and r.environment=new.environment)
    or not exists(select from ingestion.dataset_projection_current_heads h where h.dataset_id=new.dataset_id
      and h.environment=new.environment and h.current_dataset_projection_head_id=new.prior_head_id
      and h.current_projection_fingerprint=new.prior_head_hash and h.current_head_version=1) then
    raise exception using errcode='55000',message='Full35 observed slot requires three expired unexecuted authorizations and the original scope';
  end if;
  return new;
end;
$$;
revoke all on function ingestion.guard_full35_observed_authorization_v1() from public,anon,authenticated,authenticator,service_role;
create trigger full35_owner_observed_guard before insert on ingestion.foundation_owner_authorization
  for each row when (new.id='1040560a-303d-4b3c-bcba-270ac3a05b56'::uuid)
  execute function ingestion.guard_full35_observed_authorization_v1();

  grant ingestion_reprojection_definer to postgres with admin false, inherit false, set true granted by postgres;
  grant create on schema ingestion to ingestion_reprojection_definer;
  set local role ingestion_reprojection_definer;

create or replace function ingestion.mapping_json_has_duplicate_keys_v1(p_value json)
returns boolean language sql immutable set search_path='' as $$
  select coalesce(not (p_value is json with unique keys),false);
$$;

create or replace function ingestion.mapping_public_mutation_authorized_v1(p_food uuid,p_nutrient uuid,p_amount numeric,p_basis text,p_row uuid,p_delete boolean)
returns boolean language plpgsql stable set search_path='' as $$
begin
  return current_user='ingestion_reprojection_definer' and exists(
    select from ingestion.mapping_reprojection_execution_context context
    join ingestion.mapping_reprojection_plans plan on plan.id=context.plan_id
    join ingestion.mapping_reprojection_approvals approval on approval.id=context.approval_id and approval.plan_id=plan.id
    join ingestion.mapping_reprojection_plan_items item on item.plan_id=plan.id and item.food_id=p_food
    join public.nutrients n on n.id=p_nutrient
    join public.foods f on f.id=item.food_id
    where context.backend_pid=pg_catalog.pg_backend_pid() and context.transaction_id=pg_catalog.pg_current_xact_id()
      and plan.state='approved' and p_basis='per_100g'
      and case when plan.owner_authorization_id is not null then
        not p_delete and session_user='full35_release_owner' and exists(
          select from ingestion.foundation_owner_authorization auth
          where auth.id=plan.owner_authorization_id and auth.plan_hash=plan.plan_hash and auth.retry_token=plan.retry_token
            and auth.owner_oid=plan.operator_oid and approval.approver_oid=auth.owner_oid
            and approval.authority_contract_version=plan.authority_contract_version)
      else plan.operator_oid=ingestion.mapping_actor_oid_v1('ingestion_operator')
        and approval.approver_oid<>plan.operator_oid end
      and f.source_food_id=item.item_body->'before'->>'concept_key'
      and n.code not in('energy_kcal','protein_g','carbohydrates_g','fat_g','added_sugars_g','vitamin_k_ug','folate_dfe_ug')
      and ((not p_delete and plan.operation_kind='reprojection' and exists(
        select from pg_catalog.jsonb_array_elements(item.item_body->'additions') a
        where a->'state'->>'nutrient_code'=n.code and (a->'state'->>'amount')::numeric=p_amount))
      or (p_delete and plan.operation_kind='compensation' and exists(
        select from ingestion.mapping_reprojection_inserted_rows r
        where r.receipt_id=plan.rejected_receipt_id and r.public_row_id=p_row and r.food_id=p_food
          and r.nutrient_id=p_nutrient and r.amount=p_amount and r.basis=p_basis))));
end;
$$;

  set local role postgres;
  revoke create on schema ingestion from ingestion_reprojection_definer;
  revoke ingestion_reprojection_definer from postgres granted by postgres;
end
$full35_execution_cost$;
